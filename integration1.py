"""
노인 케어 시스템 통합 모듈 - 개선된 감정 분석 + DB 저장
녹음 → STT → 분석(개선된 감정) + (즉시 1차응답) + LLM(백그라운드) → (완료 후 2차응답) → TTS → DB 저장

✅ 목표
- 5초 이내 "즉시 응답" 제공 (체감 속도 개선)
- LLM이 느려도 대화가 멈추지 않게 설계
"""

import os
import time
from concurrent.futures import ThreadPoolExecutor, Future

from audio_recorder import AudioRecorder
from analyzer import SpeechAnalyzer
from llm_handler import LLMHandler
from db_handler import VoiceDBHandler


class ElderCareSystemAdvanced:
    """
    노인 케어 통합 시스템 (개선된 감정 분석 + DB 저장)
    - 음성 녹음
    - 음성 분석 (점수화 + 개선된 감정)
    - 즉시 1차 응답 (규칙 기반 / 5초 이내)
    - LLM 2차 응답 (백그라운드)
    - TTS 음성 출력
    - DB 저장 (선택적)
    """

    def __init__(
        self,
        use_tts=True,
        tts_engine="edge",
        tts_voice="sun-hi",
        use_db=True,
        senior_id=1,
        sensing_id=None,
        # ✅ 비동기 LLM 옵션
        llm_timeout_sec=45,          # LLM 최종답 기다릴 최대 시간(세션 턴 내)
        quick_reply_enabled=True,    # 즉시 1차응답 사용 여부
    ):
        """
        시스템 초기화

        Args:
            use_tts: TTS 사용 여부
            tts_engine: "pyttsx3", "gtts", "edge"
            tts_voice: 목소리 선택 (edge 전용)
            use_db: DB 저장 여부
            senior_id: 시니어 ID
            sensing_id: 센싱 ID (None이면 NULL로 저장)

            llm_timeout_sec: LLM 최종 응답 대기 최대 시간
            quick_reply_enabled: 즉시(규칙기반) 1차 응답 활성화
        """
        print("=" * 60)
        print("🏥 노인 케어 시스템 초기화 중 (비동기 LLM + 즉시응답)...")
        print("=" * 60)

        # 녹음기 (상대적 침묵 감지!)
        print("\n[1/5] 녹음기 초기화 (상대적 침묵 감지)...")
        self.recorder = AudioRecorder(
            silence_threshold=None,   # 자동 측정!
            silence_duration=10.0,    # 10초
            auto_calibrate=True       # 배경 소음 측정
        )

        # 음성 분석기 (개선된 감정 포함)
        print("\n[2/5] 음성 분석기 초기화 (개선된 감정)...")
        self.analyzer = SpeechAnalyzer()

        # LLM (감정 기반)
        print("\n[3/5] LLM 초기화 (감정 기반)...")
        self.llm = LLMHandler()

        # ✅ LLM 백그라운드 실행용 Executor
        self.executor = ThreadPoolExecutor(max_workers=1)

        # TTS
        self.use_tts = use_tts
        self.tts_engine = tts_engine

        if use_tts:
            print(f"\n[4/5] TTS 초기화 ({tts_engine}, 목소리: {tts_voice})...")
            try:
                if tts_engine == "edge":
                    from tts_handler import EdgeTTSHandler
                    self.tts = EdgeTTSHandler(
                        voice=tts_voice,
                        rate='-10%'
                    )
                elif tts_engine == "pyttsx3":
                    from tts_handler import TTSHandler
                    self.tts = TTSHandler(engine="pyttsx3", voice_rate=120)
                elif tts_engine == "gtts":
                    from tts_handler import TTSHandler
                    self.tts = TTSHandler(engine="gtts")
                else:
                    raise ValueError(f"알 수 없는 TTS 엔진: {tts_engine}")

            except Exception as e:
                print(f"⚠️  TTS 초기화 실패: {e}")
                print("   TTS 없이 계속 진행합니다.")
                self.use_tts = False
        else:
            print("\n[4/5] TTS 비활성화")

        # DB 핸들러 (선택적!)
        self.use_db = use_db
        self.senior_id = senior_id
        self.sensing_id = sensing_id

        if use_db:
            print(f"\n[5/5] DB 초기화...")
            self.db = VoiceDBHandler()
            if self.db.connect():
                print(f"   시니어 ID: {self.senior_id}")
                if self.sensing_id:
                    print(f"   센싱 ID: {self.sensing_id} (센서 연결됨!)")
                else:
                    print(f"   센싱 ID: None (센서 없음 → NULL 저장)")
            else:
                print("⚠️  DB 연결 실패 - DB 저장 비활성화")
                self.use_db = False
        else:
            print(f"\n[5/5] DB 저장 비활성화")
            self.db = None

        # 디렉토리 생성
        os.makedirs("./recordings", exist_ok=True)
        os.makedirs("./tts_outputs", exist_ok=True)
        os.makedirs("./analysis_logs", exist_ok=True)

        # 세션 데이터
        self.session_scores = []
        self.session_emotions = []
        self.turn_count = 0

        # 옵션
        self.llm_timeout_sec = llm_timeout_sec
        self.quick_reply_enabled = quick_reply_enabled

        print("\n✅ 시스템 초기화 완료! (즉시응답 + 비동기 LLM 준비)")

    # ---------------------------
    # ✅ 1) 즉시(규칙 기반) 1차 응답 생성
    # ---------------------------
    def _build_quick_reply(self, user_text: str, emotion: dict, scores: dict) -> str:
        """
        LLM 없이도 1~2초 안에 만들 수 있는 '짧은 공감 + 선택지' 응답.
        - 보미 컨셉: AI는 방향을 제시하고, 최종 결정은 어르신이 하도록 설계
        """
        final_emotion = (emotion or {}).get("final_emotion", "중립")
        conf = (emotion or {}).get("final_conf", 0.5)
        avg = (scores or {}).get("average", 70.0)

        # 공감 멘트(감정 기반)
        if "불안" in final_emotion or "걱정" in final_emotion:
            empath = "지금 걱정이 조금 느껴지세요."
        elif "화" in final_emotion or "분노" in final_emotion:
            empath = "말씀하시는 게 답답하게 느껴지실 수 있어요."
        elif "슬" in final_emotion or "우울" in final_emotion:
            empath = "마음이 조금 가라앉아 보이세요."
        elif "기쁨" in final_emotion or "행복" in final_emotion:
            empath = "기분이 좋아 보이셔서 저도 좋습니다."
        else:
            empath = "말씀 잘 들었어요."

        # 상태(점수) 기반 안내
        if avg < 60:
            state = "지금은 천천히, 짧게 이야기해도 괜찮아요."
        else:
            state = "지금처럼 편하게 말씀해 주세요."

        # “선택지를 제시하고 결정은 어르신” 메시지
        options = (
            "제가 먼저 두 가지 중에서 골라보실 수 있게 도와드릴게요. "
            "① 간단히 정리해서 바로 답을 드릴까요? "
            "② 아니면 몇 가지를 더 여쭤보고 정확히 도와드릴까요? "
            "선택은 어르신이 하시면 됩니다."
        )

        # 마지막 한 줄(기다림 안내)
        waiting = "잠시만요. 더 좋은 답을 준비하고 있어요."

        # 너무 길지 않게 구성
        return f"{empath} {state} {options} {waiting}"

    # ---------------------------
    # ✅ 2) LLM 호출을 백그라운드로 실행
    # ---------------------------
    def _submit_llm(self, user_text: str, emotion: dict, scores: dict) -> Future:
        return self.executor.submit(
            self.llm.chat,
            user_text,
            emotion_info=emotion,
            scores=scores
        )

    # ---------------------------
    # ✅ 3) TTS 안전 실행
    # ---------------------------
    def _speak_safe(self, text: str, filename_prefix: str = ""):
        if not self.use_tts:
            return
        try:
            if filename_prefix:
                tts_filename = f"./tts_outputs/{filename_prefix}.mp3"
                self.tts.speak(text, save_to_file=tts_filename)
                print(f"   💾 음성 저장: {tts_filename}")
            else:
                self.tts.speak(text)
            print("   ✅ 음성 재생 완료")
        except Exception as e:
            print(f"   ⚠️  TTS 오류: {e}")

    # ---------------------------
    # ✅ 메인: 대화 1턴
    # ---------------------------
    def conversation_turn(self, save_recording=True, sensing_id=None):
        """
        대화 1턴 실행
        1. 녹음
        2. STT + 분석(개선된 감정)
        3. (즉시) 1차 응답: 규칙 기반(5초 이내)
        4. (백그라운드) LLM 최종 응답 생성
        5. (완료 시) 최종 응답 말하기 + DB 저장

        Returns:
            결과 딕셔너리
        """
        self.turn_count += 1

        # sensing_id 결정
        turn_sensing_id = sensing_id if sensing_id is not None else self.sensing_id

        print("\n" + "=" * 60)
        print(f"💬 대화 턴 {self.turn_count}")
        print("=" * 60)

        # 1. 녹음
        print("\n[1/5] 🎤 음성 녹음")
        print("말씀하세요. 침묵이 10초 지속되면 자동 종료됩니다.")

        recording_path = self.recorder.record_until_silence(
            output_filename=f"./recordings/turn_{self.turn_count:03d}.wav" if save_recording else None,
            max_duration=120
        )

        # 2. STT + 분석
        print("\n[2/5] 📝 음성 분석 중 (개선된 감정)...")
        analysis_result = self.analyzer.analyze(recording_path)

        user_text = analysis_result['features']['whisper']['text']
        scores = analysis_result['scores']
        emotion = analysis_result['features']['emotion']

        print(f"\n   👤 노인: {user_text}")
        print(f"   ❤️  감정: {emotion['final_emotion']} (확신도: {emotion['final_conf']:.3f})")
        print(f"   🔬 Z-peak: {emotion['z_peak']:.2f}")
        print(f"   ⚙️  결정: {emotion['decision']}")
        print(f"   📊 종합 점수: {scores['average']:.1f}점")
        print(f"   📊 감정 점수: {scores['emotion']:.1f}점")

        # 세션 기록
        self.session_scores.append(scores)
        self.session_emotions.append(emotion)

        # 3. LLM 백그라운드 시작
        print("\n[3/5] 🤖 AI 응답 생성 시작 (백그라운드)...")
        start_time = time.time()
        llm_future = self._submit_llm(user_text, emotion, scores)

        # 4. 즉시 1차 응답 (5초 이내)
        print("\n[4/5] 🔊 즉시 응답 (5초 이내)")
        quick_reply = None
        if self.quick_reply_enabled:
            quick_reply = self._build_quick_reply(user_text, emotion, scores)
            print(f"\n   🤖 보미(즉시): {quick_reply}")
            # 빠르게 말해주기
            self._speak_safe(quick_reply, filename_prefix=f"turn_{self.turn_count:03d}_quick")

        # 5. 최종 LLM 응답 기다리기(최대 llm_timeout_sec)
        print("\n[5/5] 🧠 최종 답변 대기 (LLM 완료 시 안내)")
        ai_response = None
        done = False

        # 이미 끝났을 수도 있으니 빠르게 체크
        try:
            # 남은 시간만큼 기다림
            remaining = max(0.0, self.llm_timeout_sec - (time.time() - start_time))
            ai_response = llm_future.result(timeout=remaining)
            done = True
        except Exception:
            done = False

        if done and ai_response:
            print(f"\n   🤖 보미(최종): {ai_response}")
            self._speak_safe(ai_response, filename_prefix=f"turn_{self.turn_count:03d}_final")

            # DB 저장 (최종 응답 포함)
            if self.use_db and self.db:
                try:
                    # analysis_result에 LLM 응답 추가 저장(선택)
                    analysis_result["ai_response"] = ai_response
                except Exception:
                    pass

                voice_id = self.db.save_analysis(
                    self.senior_id,
                    analysis_result,
                    turn_sensing_id
                )
                if voice_id:
                    print(f"   ✅ DB 저장 완료 (voice_id: {voice_id})")
            else:
                print("   ⏭️  DB 저장 비활성화")

        else:
            # 시간 내에 LLM이 안 끝났다면, “후속 알림” 멘트만 출력
            fallback = (
                "조금 더 정확한 답을 준비 중입니다. "
                "어르신, 제가 먼저 ‘간단 요약’으로 도와드릴까요, "
                "아니면 ‘조금만 더 기다렸다가’ 자세히 알려드릴까요? "
                "결정은 어르신이 하시면 됩니다."
            )
            print(f"\n   🤖 보미(대기): {fallback}")
            self._speak_safe(fallback, filename_prefix=f"turn_{self.turn_count:03d}_waiting")

            # DB 저장은 우선 분석까지만 저장(선택)
            if self.use_db and self.db:
                try:
                    analysis_result["ai_response"] = None
                except Exception:
                    pass
                voice_id = self.db.save_analysis(
                    self.senior_id,
                    analysis_result,
                    turn_sensing_id
                )
                if voice_id:
                    print(f"   ✅ DB 저장(분석만) 완료 (voice_id: {voice_id})")
            else:
                print("   ⏭️  DB 저장 비활성화")

        return {
            'recording': recording_path,
            'text': user_text,
            'scores': scores,
            'emotion': emotion,
            'ai_response': ai_response,      # 최종이 있으면 문자열, 없으면 None
            'quick_reply': quick_reply,      # 즉시 응답
            'turn': self.turn_count
        }

    def interactive_session(self, max_turns=10):
        """대화 세션 시작"""
        print("\n" + "=" * 60)
        print("💬 대화 세션 시작 (즉시응답 + 비동기 LLM)")
        print("=" * 60)
        print(f"최대 {max_turns}턴까지 대화합니다.")
        print("중단하려면 Ctrl+C를 누르세요.\n")

        try:
            for turn in range(max_turns):
                result = self.conversation_turn()

                if turn < max_turns - 1:
                    try:
                        input("\n[다음 턴] Enter를 눌러 계속하세요 (또는 Ctrl+C로 종료)...")
                    except (KeyboardInterrupt, EOFError):
                        print("\n\n⏹️  세션 종료")
                        break

        except KeyboardInterrupt:
            print("\n\n⏹️  세션 종료")

        self.print_session_summary()

    def print_session_summary(self):
        """세션 요약 출력"""
        if not self.session_scores:
            print("세션 데이터가 없습니다.")
            return

        print("\n" + "=" * 60)
        print("📊 세션 요약 (즉시응답 + 비동기 LLM)")
        print("=" * 60)

        print(f"총 대화 턴: {self.turn_count}턴")

        avg_scores = {
            'average': sum(s['average'] for s in self.session_scores) / len(self.session_scores),
            'emotion': sum(s['emotion'] for s in self.session_scores) / len(self.session_scores),
            'response': sum(s['response'] for s in self.session_scores) / len(self.session_scores),
            'vocabulary': sum(s['vocabulary'] for s in self.session_scores) / len(self.session_scores),
        }

        print(f"\n평균 종합 점수: {avg_scores['average']:.1f}점")
        print(f"평균 감정 점수: {avg_scores['emotion']:.1f}점")
        print(f"평균 반응 속도: {avg_scores['response']:.1f}점")
        print(f"평균 어휘 다양성: {avg_scores['vocabulary']:.1f}점")

        emotions = [e['final_emotion'] for e in self.session_emotions]
        emotion_counts = {}
        for em in emotions:
            emotion_counts[em] = emotion_counts.get(em, 0) + 1

        print(f"\n[감정 분포]")
        for emotion, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(emotions)) * 100
            print(f"  {emotion}: {count}회 ({percentage:.1f}%)")

        avg_z_peak = sum(e['z_peak'] for e in self.session_emotions) / len(self.session_emotions)
        print(f"\n[Pitch 분석]")
        print(f"  평균 Z-peak: {avg_z_peak:.2f}")

        print("\n[턴별 상세]")
        for i, scores in enumerate(self.session_scores, 1):
            emotion = self.session_emotions[i - 1]
            print(f"  턴 {i}: {scores['average']:.1f}점")
            print(f"       감정: {emotion['final_emotion']} (Z-peak: {emotion['z_peak']:.2f})")
            print(f"       결정: {emotion['decision']}")

    def generate_caregiver_report(self):
        """보호자용 리포트 생성"""
        if not self.session_scores:
            print("세션 데이터가 없습니다.")
            return

        print("\n📋 보호자 리포트 생성 중...")

        avg_scores = {
            'average': sum(s['average'] for s in self.session_scores) / len(self.session_scores),
            'emotion': sum(s['emotion'] for s in self.session_scores) / len(self.session_scores),
            'response': sum(s['response'] for s in self.session_scores) / len(self.session_scores),
            'vocabulary': sum(s['vocabulary'] for s in self.session_scores) / len(self.session_scores),
            'speed': sum(s['speed'] for s in self.session_scores) / len(self.session_scores),
            'silence': sum(s['silence'] for s in self.session_scores) / len(self.session_scores),
        }

        emotions = [e['final_emotion'] for e in self.session_emotions]
        most_common_emotion = max(set(emotions), key=emotions.count)

        avg_z_peak = sum(e['z_peak'] for e in self.session_emotions) / len(self.session_emotions)

        summary = (
            f"{self.turn_count}턴의 대화에서 주로 '{most_common_emotion}' 감정을 보임. "
            f"감정 안정도 {avg_scores['emotion']:.1f}점, "
            f"Pitch 변화(Z-peak) 평균 {avg_z_peak:.2f}, "
            f"전반적으로 {'안정적' if avg_scores['average'] >= 70 else '주의 필요'}한 상태"
        )

        report = self.llm.generate_report(
            scores=avg_scores,
            text_summary=summary
        )

        print("\n" + "=" * 60)
        print("📄 보호자 리포트")
        print("=" * 60)
        print(report)
        print("=" * 60)

        return report

    def close(self):
        """시스템 종료"""
        try:
            self.recorder.close()
        except Exception:
            pass

        if self.use_db and self.db:
            try:
                self.db.close()
            except Exception:
                pass

        # ✅ Executor 종료
        try:
            self.executor.shutdown(wait=False, cancel_futures=True)
        except Exception:
            pass

        print("\n✅ 시스템이 종료되었습니다.")


# ========== 테스트 코드 ==========
if __name__ == "__main__":
    system = ElderCareSystemAdvanced(
        use_tts=True,
        tts_engine="edge",
        tts_voice="sun-hi",
        use_db=True,
        senior_id=1,
        sensing_id=None,
        llm_timeout_sec=45,
        quick_reply_enabled=True
    )

    print("\n" + "=" * 60)
    print("🎤 마이크 테스트")
    print("=" * 60)
    system.recorder.test_microphone(duration=3)

    input("\n준비되면 Enter를 눌러 대화를 시작하세요...")

    try:
        system.interactive_session(max_turns=3)
        system.generate_caregiver_report()
    finally:
        system.close()
