"""
노인 음성 분석 시스템 (파일 모드) - 감정 기반 버전
- 이미 녹음된 파일 분석
- 감정 정보 포함
- 빠른 테스트
"""

from analyzer import SpeechAnalyzer
from llm_handler import LLMHandler


class AudioFileAnalyzer:
    """파일 분석용 클래스 (감정 기반)"""
    
    def __init__(self, use_tts=False, tts_engine="edge", tts_voice="sun-hi"):
        """
        초기화
        
        Args:
            use_tts: TTS 사용 여부
            tts_engine: "edge", "pyttsx3", "gtts"
            tts_voice: Edge TTS 목소리 선택
        """
        print("="*60)
        print("🏥 노인 음성 분석 시스템 (파일 모드 - 감정 기반)")
        print("="*60)
        
        print("\n[1/3] 음성 분석기 초기화 (감정 포함)...")
        self.analyzer = SpeechAnalyzer()
        
        print("\n[2/3] LLM 초기화 (감정 기반)...")
        self.llm = LLMHandler()
        
        # TTS
        self.use_tts = use_tts
        if use_tts:
            print(f"\n[3/3] TTS 초기화 ({tts_engine}, 목소리: {tts_voice})...")
            try:
                if tts_engine == "edge":
                    from tts_handler import EdgeTTSHandler
                    self.tts = EdgeTTSHandler(voice=tts_voice, rate='-10%')
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
                self.use_tts = False
        else:
            print("\n[3/3] TTS 비활성화")
        
        print("\n✅ 시스템 초기화 완료! (감정 기반)\n")
    
    def analyze_file(self, audio_file, play_response=True):
        """
        단일 파일 분석 (감정 포함)
        
        Args:
            audio_file: 분석할 WAV 파일 경로
            play_response: TTS로 응답 재생 여부
        
        Returns:
            result: 분석 결과 + LLM 응답
        """
        print("="*60)
        print(f"🎵 파일 분석: {audio_file}")
        print("="*60)
        
        # 1. 음성 분석 (감정 포함!)
        print("\n[1/3] 📊 음성 분석 중 (감정 포함)...")
        analysis_result = self.analyzer.analyze(audio_file)
        
        user_text = analysis_result['features']['whisper']['text']
        scores = analysis_result['scores']
        emotion = analysis_result['features']['emotion']  # 감정 정보!
        
        print(f"\n   👤 발화 내용: {user_text}")
        print(f"   ❤️  감정: {emotion['final_emotion']} (확신도: {emotion['audio_conf']:.2f})")
        print(f"   📊 종합 점수: {scores['average']:.1f}점")
        print(f"   📊 감정 점수: {scores['emotion']:.1f}점")
        
        # 2. LLM 응답 생성 (감정 정보 전달!)
        print("\n[2/3] 🤖 LLM 응답 생성 중 (감정 반영)...")
        ai_response = self.llm.chat(
            user_text,
            emotion_info=emotion,  # 감정 정보 전달!
            scores=scores          # 점수 정보 전달!
        )
        
        print(f"\n   🤖 보미: {ai_response}")
        
        # 3. TTS
        if self.use_tts and play_response:
            print("\n[3/3] 🔊 TTS 음성 출력")
            try:
                self.tts.speak(ai_response)
                print("   ✅ 음성 재생 완료")
            except Exception as e:
                print(f"   ⚠️  TTS 오류: {e}")
        else:
            print("\n[3/3] TTS 비활성화")
        
        return {
            'analysis': analysis_result,
            'user_text': user_text,
            'scores': scores,
            'emotion': emotion,
            'ai_response': ai_response
        }
    
    def batch_analyze(self, audio_files, play_responses=False):
        """
        여러 파일 배치 분석 (감정 포함)
        
        Args:
            audio_files: 파일 경로 리스트
            play_responses: TTS로 응답 재생 여부
        """
        print("\n" + "="*60)
        print("📁 배치 분석 모드 (감정 포함)")
        print("="*60)
        print(f"총 {len(audio_files)}개 파일 분석\n")
        
        results = []
        
        for i, audio_file in enumerate(audio_files, 1):
            print(f"\n[{i}/{len(audio_files)}] {audio_file}")
            print("-"*40)
            
            # 분석
            result = self.analyze_file(audio_file, play_response=play_responses)
            
            results.append({
                'file': audio_file,
                'text': result['user_text'],
                'score': result['scores']['average'],
                'emotion': result['emotion']['final_emotion'],
                'emotion_score': result['scores']['emotion'],
                'response': result['ai_response']
            })
        
        # 요약
        print("\n" + "="*60)
        print("📊 배치 분석 요약 (감정 포함)")
        print("="*60)
        
        avg_score = sum(r['score'] for r in results) / len(results)
        avg_emotion_score = sum(r['emotion_score'] for r in results) / len(results)
        
        print(f"\n평균 종합 점수: {avg_score:.1f}점")
        print(f"평균 감정 점수: {avg_emotion_score:.1f}점")
        
        # 감정 분포
        emotions = [r['emotion'] for r in results]
        emotion_counts = {}
        for em in emotions:
            emotion_counts[em] = emotion_counts.get(em, 0) + 1
        
        print(f"\n[감정 분포]")
        for emotion, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(emotions)) * 100
            print(f"  {emotion}: {count}회 ({percentage:.1f}%)")
        
        print("\n[파일별 결과]")
        for i, r in enumerate(results, 1):
            print(f"  {i}. {r['file']}")
            print(f"     점수: {r['score']:.1f}점, 감정: {r['emotion']} ({r['emotion_score']:.1f}점)")
        
        return results


# ========== 편의 함수 ==========

def quick_test(audio_file, use_tts=True, tts_voice="sun-hi"):
    """
    빠른 테스트 (감정 기반)
    
    Args:
        audio_file: 분석할 파일
        use_tts: TTS 사용 여부
        tts_voice: 목소리 선택
    """
    analyzer = AudioFileAnalyzer(
        use_tts=use_tts,
        tts_engine="edge",
        tts_voice=tts_voice
    )
    
    result = analyzer.analyze_file(audio_file, play_response=use_tts)
    
    return result


# ========== 메인 실행 ==========

def main():
    """메인 실행 함수 (감정 기반)"""
    
    # ========== 옵션 선택 ==========
    
    USE_TTS = False  # TTS 사용 여부 (테스트 시 False 권장)
    TTS_VOICE = "sun-hi"  # 목소리 선택
    
    # ========== 시스템 초기화 ==========
    
    analyzer = AudioFileAnalyzer(
        use_tts=USE_TTS,
        tts_engine="edge",
        tts_voice=TTS_VOICE
    )
    
    # ========== 단일 파일 분석 ==========
    
    # 분석할 오디오 파일 경로 (실제 파일 경로로 변경하세요!)
    audio_file = "./data/251227_123803_out.wav"
    
    # 분석 실행
    try:
        result = analyzer.analyze_file(audio_file, play_response=USE_TTS)
        
        print("\n" + "="*60)
        print("✅ 분석 완료!")
        print("="*60)
        print(f"\n💡 핵심 결과:")
        print(f"   감정: {result['emotion']['final_emotion']}")
        print(f"   감정 점수: {result['scores']['emotion']:.1f}점")
        print(f"   종합 점수: {result['scores']['average']:.1f}점")
        print(f"   AI 응답: {result['ai_response']}")
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        print(f"   파일 경로를 확인해주세요: {audio_file}")
    
    # ========== 배치 분석 (선택사항) ==========
    
    # 여러 파일 한번에 분석하고 싶으면 주석 해제
    # audio_files = [
    #     "./data/file1.wav",
    #     "./data/file2.wav",
    #     "./data/file3.wav",
    # ]
    # batch_results = analyzer.batch_analyze(audio_files, play_responses=False)


if __name__ == "__main__":
    main()