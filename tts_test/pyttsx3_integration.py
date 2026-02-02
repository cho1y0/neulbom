"""
노인 케어 시스템 통합 모듈 (pyttsx3 버전)
녹음 → STT → 분석 + LLM → TTS 파이프라인
"""

import os
from audio_recorder import AudioRecorder
from analyzer import SpeechAnalyzer
from llm_handler import LLMHandler


class ElderCareSystem:
    """
    노인 케어 통합 시스템 (pyttsx3 TTS)
    - 음성 녹음
    - 음성 분석 (점수화)
    - LLM 대화
    - TTS 음성 출력 (pyttsx3)
    """
    
    def __init__(self, use_tts=True):
        """
        시스템 초기화
        
        Args:
            use_tts: TTS 사용 여부
        """
        print("="*60)
        print("🏥 노인 케어 시스템 초기화 중... (pyttsx3)")
        print("="*60)
        
        # 녹음기
        print("\n[1/4] 녹음기 초기화...")
        self.recorder = AudioRecorder(
            silence_threshold=500,  # 마이크 테스트 후 조정
            silence_duration=2.0
        )
        
        # 음성 분석기
        print("\n[2/4] 음성 분석기 초기화...")
        self.analyzer = SpeechAnalyzer()
        
        # LLM
        print("\n[3/4] LLM 초기화...")
        self.llm = LLMHandler()
        
        # TTS (pyttsx3)
        self.use_tts = use_tts
        if use_tts:
            print("\n[4/4] TTS 초기화 (pyttsx3)...")
            try:
                import pyttsx3
                self.tts_engine = pyttsx3.init()
                
                # 속도 설정
                self.tts_engine.setProperty('rate', 120)  # 천천히 (노인용)
                
                # 볼륨 설정
                self.tts_engine.setProperty('volume', 1.0)
                
                print("✅ pyttsx3 TTS 초기화 완료!")
                
            except Exception as e:
                print(f"⚠️  TTS 초기화 실패: {e}")
                print("   pip install pyttsx3")
                self.use_tts = False
        else:
            print("\n[4/4] TTS 비활성화")
        
        # 녹음 폴더 생성
        os.makedirs("./recordings", exist_ok=True)
        os.makedirs("./tts_outputs", exist_ok=True)
        os.makedirs("./analysis_logs", exist_ok=True)
        
        # 세션 데이터
        self.session_scores = []
        self.turn_count = 0
        
        print("\n✅ 시스템 초기화 완료!")
    
    def speak_tts(self, text, save_to_file=None):
        """
        TTS 음성 출력
        
        Args:
            text: 읽을 텍스트
            save_to_file: 저장할 파일 경로 (선택)
        """
        if not self.use_tts or not text:
            return
        
        try:
            if save_to_file:
                # 1. 파일로 저장
                self.tts_engine.save_to_file(text, save_to_file)
                self.tts_engine.runAndWait()
                print(f"   💾 음성 저장: {save_to_file}")
                
                # 2. 저장된 파일 재생 (playsound)
                try:
                    from playsound3 import playsound
                    playsound(save_to_file)
                except ImportError:
                    # playsound 없으면 pyttsx3로 재생
                    self.tts_engine.say(text)
                    self.tts_engine.runAndWait()
                except Exception as e:
                    print(f"   ⚠️  재생 오류 (파일은 저장됨): {e}")
                    
            else:
                # 재생만
                self.tts_engine.say(text)
                self.tts_engine.runAndWait()
                
        except Exception as e:
            print(f"   ⚠️  TTS 오류: {e}")
    
    def conversation_turn(self, save_recording=True):
        """
        대화 1턴 실행
        1. 녹음 → 2. STT → 3. 분석 + LLM 응답 → 4. TTS
        """
        self.turn_count += 1
        
        print("\n" + "="*60)
        print(f"💬 대화 턴 {self.turn_count}")
        print("="*60)
        
        # 1. 녹음
        print("\n[1/4] 🎤 음성 녹음")
        print("말씀하세요. 침묵이 2초 지속되면 자동 종료됩니다.")
        
        recording_path = self.recorder.record_until_silence(
            output_filename=f"./recordings/turn_{self.turn_count:03d}.wav" if save_recording else None,
            max_duration=30
        )
        
        # 2. STT + 분석
        print("\n[2/4] 📝 음성 분석 중...")
        analysis_result = self.analyzer.analyze(recording_path)
        
        user_text = analysis_result['features']['whisper']['text']
        scores = analysis_result['scores']
        
        print(f"\n   👤 노인: {user_text}")
        print(f"   📊 종합 점수: {scores['average']:.1f}점")
        
        # 세션 기록 저장
        self.session_scores.append(scores)
        
        # 3. LLM 응답 생성
        print("\n[3/4] 🤖 AI 응답 생성 중...")
        ai_response = self.llm.chat(user_text)
        
        print(f"\n   🤖 AI: {ai_response}")
        
        # 4. TTS 음성 출력
        print("\n[4/4] 🔊 TTS 음성 출력")
        if self.use_tts:
            tts_filename = f"./tts_outputs/turn_{self.turn_count:03d}_response.wav"
            self.speak_tts(ai_response, save_to_file=tts_filename)
            print("   ✅ 음성 재생 완료")
        else:
            print("   ⏭️  TTS 비활성화")
        
        return {
            'recording': recording_path,
            'text': user_text,
            'scores': scores,
            'ai_response': ai_response,
            'turn': self.turn_count
        }
    
    def interactive_session(self, max_turns=10):
        """대화 세션 시작"""
        print("\n" + "="*60)
        print("💬 대화 세션 시작")
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
        """세션 요약 출력"""
        if not self.session_scores:
            print("세션 데이터가 없습니다.")
            return
        
        print("\n" + "="*60)
        print("📊 세션 요약")
        print("="*60)
        
        print(f"총 대화 턴: {self.turn_count}턴")
        
        # 평균 점수 계산
        avg_scores = {
            'average': sum(s['average'] for s in self.session_scores) / len(self.session_scores),
            'response': sum(s['response'] for s in self.session_scores) / len(self.session_scores),
            'vocabulary': sum(s['vocabulary'] for s in self.session_scores) / len(self.session_scores),
        }
        
        print(f"\n평균 종합 점수: {avg_scores['average']:.1f}점")
        print(f"평균 반응 속도: {avg_scores['response']:.1f}점")
        print(f"평균 어휘 다양성: {avg_scores['vocabulary']:.1f}점")
        
        # 각 턴 점수
        print("\n[턴별 점수]")
        for i, scores in enumerate(self.session_scores, 1):
            print(f"  턴 {i}: {scores['average']:.1f}점")
    
    def generate_caregiver_report(self):
        """보호자용 리포트 생성"""
        if not self.session_scores:
            print("세션 데이터가 없습니다.")
            return
        
        print("\n📋 보호자 리포트 생성 중...")
        
        # 평균 점수
        avg_scores = {
            'average': sum(s['average'] for s in self.session_scores) / len(self.session_scores),
            'response': sum(s['response'] for s in self.session_scores) / len(self.session_scores),
            'vocabulary': sum(s['vocabulary'] for s in self.session_scores) / len(self.session_scores),
            'speed': sum(s['speed'] for s in self.session_scores) / len(self.session_scores),
            'silence': sum(s['silence'] for s in self.session_scores) / len(self.session_scores),
        }
        
        summary = f"{self.turn_count}턴의 대화에서 자연스러운 응답을 보이심"
        
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
        print("\n✅ 시스템이 종료되었습니다.")


# ========== 테스트 코드 ==========
if __name__ == "__main__":
    # 시스템 초기화 (pyttsx3 TTS)
    system = ElderCareSystem(use_tts=True)
    
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