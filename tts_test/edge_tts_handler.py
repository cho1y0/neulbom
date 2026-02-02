"""
Edge TTS 핸들러
Microsoft Edge의 다양한 한국어 음성 지원
"""

import os
import asyncio


class EdgeTTSHandler:
    """Edge TTS 핸들러 (다양한 한국어 목소리)"""
    
    # 한국어 음성 목록
    VOICES = {
        # 여성 음성
        'sun-hi': 'ko-KR-SunHiNeural',      # 여성 1 (밝고 친절)
        'ji-min': 'ko-KR-JiMinNeural',      # 여성 2 (차분함)
        'seo-hyeon': 'ko-KR-SeoHyeonNeural', # 여성 3 (부드러움)
        'soon-bok': 'ko-KR-SoonBokNeural',  # 여성 4 (할머니 느낌)
        'yu-jin': 'ko-KR-YuJinNeural',      # 여성 5 (젊음)
        
        # 남성 음성
        'in-joon': 'ko-KR-InJoonNeural',    # 남성 1 (차분함)
        'hyun-su': 'ko-KR-HyunsuNeural',    # 남성 2 (명랑)
        'bong-jin': 'ko-KR-BongJinNeural',  # 남성 3 (할아버지 느낌)
        'gook-min': 'ko-KR-GookMinNeural',  # 남성 4 (젊음)
    }
    
    def __init__(self, voice='sun-hi', rate='+0%', volume='+0%'):
        """
        Args:
            voice: 음성 선택 (위 VOICES 키 또는 전체 이름)
            rate: 속도 (+0% = 보통, +10% = 빠름, -10% = 느림)
            volume: 볼륨 (+0% = 보통, +10% = 크게, -10% = 작게)
        """
        try:
            import edge_tts
            self.edge_tts = edge_tts
        except ImportError:
            print("❌ edge-tts가 설치되지 않았습니다.")
            print("   설치: pip install edge-tts")
            raise
        
        # 음성 선택
        if voice in self.VOICES:
            self.voice = self.VOICES[voice]
            self.voice_name = voice
        else:
            self.voice = voice
            self.voice_name = voice
        
        self.rate = rate
        self.volume = volume
        
        print(f"✅ Edge TTS 초기화 완료 (목소리: {self.voice_name})")
    
    def speak(self, text, save_to_file=None):
        """
        텍스트를 음성으로 변환 및 재생
        
        Args:
            text: 읽을 텍스트
            save_to_file: MP3 파일로 저장할 경로 (선택)
        """
        if not text:
            print("⚠️  텍스트가 비어있습니다.")
            return
        
        # asyncio 실행
        try:
            asyncio.run(self._speak_async(text, save_to_file))
        except Exception as e:
            print(f"❌ TTS 오류: {e}")
    
    async def _speak_async(self, text, save_to_file=None):
        """비동기 음성 생성"""
        # 파일명 결정
        if save_to_file:
            # .wav를 .mp3로 변경
            if save_to_file.endswith('.wav'):
                filename = save_to_file.replace('.wav', '.mp3')
            else:
                filename = save_to_file
        else:
            filename = "./temp_edge_tts.mp3"
        
        # Edge TTS 생성
        communicate = self.edge_tts.Communicate(
            text=text,
            voice=self.voice,
            rate=self.rate,
            volume=self.volume
        )
        
        # MP3 저장
        await communicate.save(filename)
        print(f"💾 음성 생성: {filename}")
        
        # 재생
        self._play_audio(filename)
        
        # 임시 파일 삭제
        if not save_to_file and os.path.exists(filename):
            os.remove(filename)
    
    def _play_audio(self, filename):
        """오디오 재생"""
        import platform
        system = platform.system()
        
        try:
            if system == "Windows":
                try:
                    from playsound3 import playsound
                    playsound(filename)
                except ImportError:
                    print("⚠️  playsound3 미설치, 파일만 저장됨")
                    
            elif system == "Darwin":  # macOS
                os.system(f"afplay {filename}")
                
            elif system == "Linux":
                os.system(f"mpg123 {filename}")
                
        except Exception as e:
            print(f"⚠️  재생 실패: {e}")
    
    def list_voices(self):
        """사용 가능한 목소리 목록 출력"""
        print("\n" + "="*60)
        print("🎤 사용 가능한 한국어 목소리")
        print("="*60)
        
        print("\n[여성 음성]")
        for name, voice in list(self.VOICES.items())[:5]:
            print(f"  {name:15s} - {voice}")
        
        print("\n[남성 음성]")
        for name, voice in list(self.VOICES.items())[5:]:
            print(f"  {name:15s} - {voice}")
        
        print("\n사용법: EdgeTTSHandler(voice='sun-hi')")
        print("="*60)
    
    def set_voice(self, voice):
        """목소리 변경"""
        if voice in self.VOICES:
            self.voice = self.VOICES[voice]
            self.voice_name = voice
            print(f"✅ 목소리 변경: {self.voice_name}")
        else:
            print(f"⚠️  알 수 없는 목소리: {voice}")
    
    def set_rate(self, rate):
        """속도 변경 (예: '+10%', '-10%', '+0%')"""
        self.rate = rate
        print(f"✅ 속도 변경: {rate}")
    
    def set_volume(self, volume):
        """볼륨 변경 (예: '+10%', '-10%', '+0%')"""
        self.volume = volume
        print(f"✅ 볼륨 변경: {volume}")


# ========== 테스트 ==========
if __name__ == "__main__":
    print("="*60)
    print("🎤 Edge TTS 테스트")
    print("="*60)
    
    # 목소리 목록 확인
    tts = EdgeTTSHandler()
    tts.list_voices()
    
    # 여러 목소리 테스트
    test_voices = ['sun-hi', 'soon-bok', 'in-joon', 'bong-jin']
    test_text = "할머니, 저 보미예요! 잘 지내셨어요?"
    
    print("\n" + "="*60)
    print("🔊 목소리별 테스트")
    print("="*60)
    
    for voice in test_voices:
        print(f"\n▶ {voice} 목소리:")
        tts = EdgeTTSHandler(voice=voice, rate='-10%')  # 천천히
        tts.speak(test_text)
        input("   [Enter를 눌러 다음 목소리...]")
    
    print("\n✅ 테스트 완료!")
