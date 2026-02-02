"""
TTS (Text-to-Speech) 핸들러
pyttsx3 (오프라인) + gTTS (온라인) 지원
"""

import os
import platform


class TTSHandler:
    """TTS 핸들러"""
    
    def __init__(self, engine="pyttsx3", voice_rate=150):
        """
        Args:
            engine: "pyttsx3" (오프라인) 또는 "gtts" (온라인)
            voice_rate: 말하기 속도 (pyttsx3 전용, 기본 150)
        """
        self.engine_type = engine
        self.voice_rate = voice_rate
        
        if engine == "pyttsx3":
            self._init_pyttsx3()
        elif engine == "gtts":
            self._init_gtts()
        else:
            raise ValueError("engine은 'pyttsx3' 또는 'gtts'여야 합니다.")
    
    def _init_pyttsx3(self):
        """pyttsx3 초기화 (오프라인)"""
        try:
            import pyttsx3
            self.engine = pyttsx3.init()
            
            # 속도 설정
            self.engine.setProperty('rate', self.voice_rate)
            
            # 볼륨 설정
            self.engine.setProperty('volume', 1.0)
            
            # 한국어 음성 찾기 (있으면)
            voices = self.engine.getProperty('voices')
            for voice in voices:
                if 'korean' in voice.name.lower() or 'kr' in voice.id.lower():
                    self.engine.setProperty('voice', voice.id)
                    break
            
            print("✅ pyttsx3 TTS 초기화 완료 (오프라인)")
            
        except ImportError:
            print("❌ pyttsx3가 설치되지 않았습니다.")
            print("   설치: pip install pyttsx3")
            raise
    
    def _init_gtts(self):
        """gTTS 초기화 (온라인)"""
        try:
            from gtts import gTTS
            self.gtts = gTTS
            print("✅ gTTS 초기화 완료 (온라인)")
            
        except ImportError:
            print("❌ gTTS가 설치되지 않았습니다.")
            print("   설치: pip install gtts")
            raise
    
    def speak(self, text, save_to_file=None):
        """
        텍스트를 음성으로 변환 및 재생
        
        Args:
            text: 읽을 텍스트
            save_to_file: WAV 파일로 저장할 경로 (선택)
        """
        if not text:
            print("⚠️  텍스트가 비어있습니다.")
            return
        
        if self.engine_type == "pyttsx3":
            self._speak_pyttsx3(text, save_to_file)
        elif self.engine_type == "gtts":
            self._speak_gtts(text, save_to_file)
    
    def _speak_pyttsx3(self, text, save_to_file=None):
        """pyttsx3로 음성 재생"""
        try:
            if save_to_file:
                # 파일로 저장 + 재생
                self.engine.save_to_file(text, save_to_file)
                self.engine.runAndWait()
                print(f"💾 음성 저장: {save_to_file}")
                
                # 저장 후 즉시 재생
                self.engine.say(text)
                self.engine.runAndWait()
            else:
                # 즉시 재생만
                self.engine.say(text)
                self.engine.runAndWait()
                
        except Exception as e:
            print(f"❌ TTS 오류: {e}")
    
    def _speak_gtts(self, text, save_to_file=None):
        """gTTS로 음성 재생"""
        try:
            # gTTS 생성 (한국어)
            tts = self.gtts(text=text, lang='ko')
            
            # 파일명 결정
            if save_to_file:
                # .wav를 .mp3로 변경 (gTTS는 MP3만 지원)
                if save_to_file.endswith('.wav'):
                    filename = save_to_file.replace('.wav', '.mp3')
                else:
                    filename = save_to_file
            else:
                filename = "./temp_tts.mp3"
            
            # MP3 저장
            tts.save(filename)
            print(f"💾 음성 생성: {filename}")
            
            # 재생
            self._play_audio(filename)
            
            # 임시 파일 삭제
            if not save_to_file and os.path.exists(filename):
                os.remove(filename)
                    
        except Exception as e:
            print(f"❌ TTS 오류: {e}")
    
    def _play_audio(self, filename):
        """플랫폼별 오디오 재생"""
        system = platform.system()
        
        try:
            if system == "Windows":
                # Windows: playsound3
                try:
                    from playsound3 import playsound
                    playsound(filename)
                except ImportError:
                    print("⚠️  playsound3 미설치, 파일만 저장됨")
                    print(f"   재생하려면: pip install playsound3")
                    
            elif system == "Darwin":  # macOS
                os.system(f"afplay {filename}")
                
            elif system == "Linux":
                os.system(f"mpg123 {filename}")
                
        except Exception as e:
            print(f"⚠️  재생 실패: {e}")
            print(f"   파일: {filename}")
    
    def set_rate(self, rate):
        """말하기 속도 변경 (pyttsx3 전용)"""
        if self.engine_type == "pyttsx3":
            self.voice_rate = rate
            self.engine.setProperty('rate', rate)
            print(f"✅ 속도 변경: {rate}")
        else:
            print("⚠️  gTTS는 속도 조절 미지원")
    
    def set_volume(self, volume):
        """볼륨 변경 (pyttsx3 전용, 0.0-1.0)"""
        if self.engine_type == "pyttsx3":
            self.engine.setProperty('volume', volume)
            print(f"✅ 볼륨 변경: {volume}")
        else:
            print("⚠️  gTTS는 볼륨 조절 미지원")


# ========== 테스트 ==========
if __name__ == "__main__":
    print("="*60)
    print("🔊 TTS 테스트")
    print("="*60)
    
    # 옵션 1: pyttsx3 (오프라인)
    print("\n[1] pyttsx3 테스트 (오프라인)")
    try:
        tts1 = TTSHandler(engine="pyttsx3", voice_rate=150)
        tts1.speak("할머니, 저 보미예요!")
        print("✅ pyttsx3 성공!")
    except Exception as e:
        print(f"❌ pyttsx3 실패: {e}")
    
    # 옵션 2: gTTS (온라인)
    print("\n[2] gTTS 테스트 (온라인)")
    try:
        tts2 = TTSHandler(engine="gtts")
        tts2.speak("할머니, 뭐 드시고 싶으세요?")
        print("✅ gTTS 성공!")
    except Exception as e:
        print(f"❌ gTTS 실패: {e}")
    
    print("\n" + "="*60)
    print("테스트 완료!")