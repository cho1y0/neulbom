"""
노인 케어 시스템 통합 모듈 - 개선된 감정 분석 + DB 저장
녹음 → STT → 분석(개선된 감정) + LLM(감정 반영) → TTS → DB 저장
"""

import os
from audio_recorder import AudioRecorder
from analyzer import SpeechAnalyzer
from llm_handler import LLMHandler
from db_handler import VoiceDBHandler


class ElderCareSystemAdvanced:
    """
    노인 케어 통합 시스템 (개선된 감정 분석 + DB 저장)
    - 음성 녹음
    - 음성 분석 (점수화 + 개선된 감정)
    - LLM 대화 (감정 반영)
    - TTS 음성 출력
    - DB 저장 (선택적)
    """
    
    def __init__(self, use_tts=True, tts_engine="edge", tts_voice="sun-hi", 
                 use_db=True, senior_id=1, sensing_id=None):
        """
        시스템 초기화
        
        Args:
            use_tts: TTS 사용 여부
            tts_engine: "pyttsx3", "gtts", "edge"
            tts_voice: 목소리 선택 (edge 전용)
            use_db: DB 저장 여부
            senior_id: 시니어 ID
            sensing_id: 센싱 ID (None이면 NULL로 저장)
        """
        print("="*60)
        print("🏥 노인 케어 시스템 초기화 중 (개선된 감정 분석)...")
        print("="*60)
        
        # 녹음기 (상대적 침묵 감지!)
        print("\n[1/5] 녹음기 초기화 (상대적 침묵 감지)...")
        self.recorder = AudioRecorder(
            silence_threshold=None,  # 자동 측정!
            silence_duration=10.0,   # 10초 (말 중간에 쉴 시간 충분히)
            auto_calibrate=True      # 처음 한 번만 배경 소음 측정
        )
        
        # 음성 분석기 (개선된 감정 포함)
        print("\n[2/5] 음성 분석기 초기화 (개선된 감정)...")
        self.analyzer = SpeechAnalyzer()
        
        # LLM (감정 기반)
        print("\n[3/5] LLM 초기화 (감정 기반)...")
        self.llm = LLMHandler()
        
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
        
        print("\n✅ 시스템 초기화 완료! (개선된 감정 기반 대화 준비)")
    
    def conversation_turn(self, save_recording=True, sensing_id=None):
        """
        대화 1턴 실행 (개선된 감정 반영 + DB 저장)
        1. 녹음 → 2. STT + 분석(개선된 감정) → 3. LLM(감정 반영) → 4. TTS → 5. DB 저장
        
        Args:
            save_recording: 녹음 파일 저장 여부
            sensing_id: 이번 턴의 센싱 ID (None이면 초기화 때 값 사용)
        
        Returns:
            결과 딕셔너리 (recording, text, scores, emotion, ai_response, turn)
        """
        self.turn_count += 1
        
        # sensing_id 결정
        turn_sensing_id = sensing_id if sensing_id is not None else self.sensing_id
        
        print("\n" + "="*60)
        print(f"💬 대화 턴 {self.turn_count}")
        print("="*60)
        
        # 1. 녹음
        print("\n[1/5] 🎤 음성 녹음")
        print("말씀하세요. 침묵이 10초 지속되면 자동 종료됩니다.")
        
        recording_path = self.recorder.record_until_silence(
            output_filename=f"./recordings/turn_{self.turn_count:03d}.wav" if save_recording else None,
            max_duration=120  # 2분 (넉넉하게)
        )
        
        # 2. STT + 분석 (개선된 감정 포함!)
        print("\n[2/5] 📝 음성 분석 중 (개선된 감정)...")
        analysis_result = self.analyzer.analyze(recording_path)
        
        user_text = analysis_result['features']['whisper']['text']
        scores = analysis_result['scores']
        emotion = analysis_result['features']['emotion']  # 개선된 감정 정보!
        
        print(f"\n   👤 노인: {user_text}")
        print(f"   ❤️  감정: {emotion['final_emotion']} (확신도: {emotion['final_conf']:.3f})")
        print(f"   🔬 Z-peak: {emotion['z_peak']:.2f}")
        print(f"   ⚙️  결정: {emotion['decision']}")
        print(f"   📊 종합 점수: {scores['average']:.1f}점")
        print(f"   📊 감정 점수: {scores['emotion']:.1f}점")
        
        # 세션 기록 저장
        self.session_scores.append(scores)
        self.session_emotions.append(emotion)
        
        # 3. LLM 응답 생성 (감정 정보 전달!)
        print("\n[3/5] 🤖 AI 응답 생성 중 (감정 반영)...")
        ai_response = self.llm.chat(
            user_text,
            emotion_info=emotion,  # 개선된 감정 정보 전달!
            scores=scores          # 점수 정보 전달!
        )
        
        print(f"\n   🤖 보미: {ai_response}")
        
        # 4. TTS 음성 출력
        print("\n[4/5] 🔊 TTS 음성 출력")
        if self.use_tts:
            try:
                tts_filename = f"./tts_outputs/turn_{self.turn_count:03d}_response.mp3"
                self.tts.speak(ai_response, save_to_file=tts_filename)
                print(f"   💾 음성 저장: {tts_filename}")
                print("   ✅ 음성 재생 완료")
            except Exception as e:
                print(f"   ⚠️  TTS 오류: {e}")
        else:
            print("   ⏭️  TTS 비활성화")
        
        # 5. DB 저장 (선택적!)
        print("\n[5/5] 💾 DB 저장")
        if self.use_db and self.db:
            voice_id = self.db.save_analysis(
                self.senior_id,
                analysis_result,
                turn_sensing_id  # None이면 NULL로 저장!
            )
            if voice_id:
                print(f"   ✅ DB 저장 완료 (voice_id: {voice_id})")
        else:
            print("   ⏭️  DB 저장 비활성화")
        
        return {
            'recording': recording_path,
            'text': user_text,
            'scores': scores,
            'emotion': emotion,
            'ai_response': ai_response,
            'turn': self.turn_count
        }
    
    def interactive_session(self, max_turns=10):
        """대화 세션 시작"""
        print("\n" + "="*60)
        print("💬 대화 세션 시작 (개선된 감정 분석)")
        print("="*60)
        print(f"최대 {max_turns}턴까지 대화합니다.")
        print("중단하려면 아무 말도 안 하고 Ctrl+C를 누르세요.\n")
        
        try:
            for turn in range(max_turns):
                result = self.conversation_turn()
                
                # 다음 턴 준비
                if turn < max_turns - 1:
                    try:
                        input("\n[다음 턴] Enter를 눌러 계속하세요 (또는 Ctrl+C로 종료)...")
                    except (KeyboardInterrupt, EOFError):
                        print("\n\n⏹️  세션 종료")
                        break
        
        except KeyboardInterrupt:
            print("\n\n⏹️  세션 종료")
        
        # 세션 요약
        self.print_session_summary()
    
    def print_session_summary(self):
        """세션 요약 출력 (개선된 감정 포함)"""
        if not self.session_scores:
            print("세션 데이터가 없습니다.")
            return
        
        print("\n" + "="*60)
        print("📊 세션 요약 (개선된 감정 분석)")
        print("="*60)
        
        print(f"총 대화 턴: {self.turn_count}턴")
        
        # 평균 점수 계산
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
        
        # 감정 분포
        emotions = [e['final_emotion'] for e in self.session_emotions]
        emotion_counts = {}
        for em in emotions:
            emotion_counts[em] = emotion_counts.get(em, 0) + 1
        
        print(f"\n[감정 분포]")
        for emotion, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(emotions)) * 100
            print(f"  {emotion}: {count}회 ({percentage:.1f}%)")
        
        # 개선된 감정 분석 통계
        avg_z_peak = sum(e['z_peak'] for e in self.session_emotions) / len(self.session_emotions)
        print(f"\n[Pitch 분석]")
        print(f"  평균 Z-peak: {avg_z_peak:.2f}")
        
        # 각 턴 점수
        print("\n[턴별 상세]")
        for i, scores in enumerate(self.session_scores, 1):
            emotion = self.session_emotions[i-1]
            print(f"  턴 {i}: {scores['average']:.1f}점")
            print(f"       감정: {emotion['final_emotion']} (Z-peak: {emotion['z_peak']:.2f})")
            print(f"       결정: {emotion['decision']}")
    
    def generate_caregiver_report(self):
        """보호자용 리포트 생성 (개선된 감정 포함)"""
        if not self.session_scores:
            print("세션 데이터가 없습니다.")
            return
        
        print("\n📋 보호자 리포트 생성 중 (개선된 감정)...")
        
        # 평균 점수
        avg_scores = {
            'average': sum(s['average'] for s in self.session_scores) / len(self.session_scores),
            'emotion': sum(s['emotion'] for s in self.session_scores) / len(self.session_scores),
            'response': sum(s['response'] for s in self.session_scores) / len(self.session_scores),
            'vocabulary': sum(s['vocabulary'] for s in self.session_scores) / len(self.session_scores),
            'speed': sum(s['speed'] for s in self.session_scores) / len(self.session_scores),
            'silence': sum(s['silence'] for s in self.session_scores) / len(self.session_scores),
        }
        
        # 감정 요약
        emotions = [e['final_emotion'] for e in self.session_emotions]
        most_common_emotion = max(set(emotions), key=emotions.count)
        
        # Z-peak 통계
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
        
        print("\n" + "="*60)
        print("📄 보호자 리포트")
        print("="*60)
        print(report)
        print("="*60)
        
        return report
    
    def close(self):
        """시스템 종료"""
        try:
            self.recorder.close()
        except:
            pass
        
        if self.use_db and self.db:
            self.db.close()
        
        print("\n✅ 시스템이 종료되었습니다.")


# ========== 테스트 코드 ==========
if __name__ == "__main__":
    # 시스템 초기화
    system = ElderCareSystemAdvanced(
        use_tts=True,
        tts_engine="edge",
        tts_voice="sun-hi",
        use_db=True,         # ← DB ON/OFF
        senior_id=1,
        sensing_id=None      # ← 센서 없으면 None
    )
    
    # 마이크 테스트
    print("\n" + "="*60)
    print("🎤 마이크 테스트")
    print("="*60)
    system.recorder.test_microphone(duration=3)
    
    # 대화 세션 시작
    input("\n준비되면 Enter를 눌러 대화를 시작하세요...")
    
    try:
        system.interactive_session(max_turns=3)
        
        # 보호자 리포트 생성
        system.generate_caregiver_report()
    
    finally:
        system.close()