"""
음성 녹음 모듈 (상대적 침묵 감지 버전)
- 배경 소음 자동 측정
- 상대적 침묵 기준 (환경 적응형)
- 동적 임계값 조정
"""

import pyaudio
import wave
import numpy as np
import time
from datetime import datetime


class AudioRecorder:
    """실시간 음성 녹음기 (상대적 침묵 감지)"""
    
    def __init__(self, 
                 sample_rate=16000,
                 channels=1,
                 chunk_size=1024,
                 silence_threshold=None,  # None = 자동 측정!
                 silence_duration=3.0,
                 auto_calibrate=True,     # 자동 보정
                 calibration_time=1.5):   # 보정 시간 (초)
        """
        Args:
            sample_rate: 샘플링 레이트 (16000)
            channels: 채널 수 (1=모노)
            chunk_size: 버퍼 크기
            silence_threshold: 침묵 판단 기준
                - None: 자동 측정 (배경 소음의 2배) ← 추천!
                - 숫자: 절대값 사용 (예: 200)
            silence_duration: 침묵 지속 시간 (초)
            auto_calibrate: 배경 소음 자동 보정 여부
            calibration_time: 배경 소음 측정 시간 (초)
        """
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self.format = pyaudio.paInt16
        
        # VAD 설정
        self.base_silence_threshold = silence_threshold
        self.silence_duration = silence_duration
        self.auto_calibrate = auto_calibrate
        self.calibration_time = calibration_time
        
        # 동적 임계값
        self.current_threshold = silence_threshold
        self.background_rms = None
        self.max_rms = 0
        
        # PyAudio 초기화
        self.audio = pyaudio.PyAudio()
    
    def _calibrate_background(self, stream):
        """
        배경 소음 자동 보정
        
        Returns:
            background_rms: 배경 소음 평균 RMS
        """
        print(f"\n🔊 배경 소음 측정 중... ({self.calibration_time}초)")
        print("   조용히 있어주세요...")
        
        background_samples = []
        chunks_to_read = int(self.sample_rate / self.chunk_size * self.calibration_time)
        
        for i in range(chunks_to_read):
            try:
                data = stream.read(self.chunk_size, exception_on_overflow=False)
                rms = self._calculate_rms(data)
                background_samples.append(rms)
                
                # 진행 표시
                if i % 10 == 0:
                    print(".", end="", flush=True)
            except Exception as e:
                print(f"\n⚠️  측정 오류: {e}")
                continue
        
        if background_samples:
            avg_background = np.mean(background_samples)
            max_background = np.max(background_samples)
            
            print(f"\n✅ 배경 소음 측정 완료!")
            print(f"   평균: {avg_background:.1f} RMS")
            print(f"   최대: {max_background:.1f} RMS")
            
            return avg_background
        else:
            print("\n⚠️  배경 소음 측정 실패 - 기본값 사용")
            return 100.0
    
    def record_until_silence(self, output_filename=None, max_duration=60):
        """
        침묵이 감지될 때까지 녹음 (상대적 침묵 감지)
        
        Args:
            output_filename: 저장할 파일 이름 (None이면 자동 생성)
            max_duration: 최대 녹음 시간 (초)
        
        Returns:
            filename: 저장된 파일 경로
        """
        if output_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"recordings/audio_{timestamp}.wav"
        
        # 디렉토리 생성
        import os
        os.makedirs(os.path.dirname(output_filename) if os.path.dirname(output_filename) else ".", exist_ok=True)
        
        # 스트림 열기
        stream = self.audio.open(
            format=self.format,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )
        
        # 1단계: 배경 소음 자동 보정 (처음 한 번만!)
        if self.auto_calibrate and self.base_silence_threshold is None:
            # 이미 측정했으면 재사용!
            if self.background_rms is None:
                self.background_rms = self._calibrate_background(stream)
                print(f"   ✅ 배경 소음: {self.background_rms:.1f} RMS (측정 완료)")
            else:
                print(f"   ♻️  배경 소음: {self.background_rms:.1f} RMS (기존 값 사용)")
            
            # 초기 임계값: 배경의 2배
            self.current_threshold = self.background_rms * 2.0
            print(f"   초기 침묵 기준: {self.current_threshold:.1f} RMS (배경의 2배)")
        else:
            # 절대값 사용
            self.current_threshold = self.base_silence_threshold or 200
            print(f"   침묵 기준: {self.current_threshold:.1f} RMS (절대값)")
        
        # 2단계: 실제 녹음
        print(f"\n🎤 녹음 준비... (최대 {max_duration}초)")
        print(f"   침묵이 {self.silence_duration}초 지속되면 자동 종료됩니다.")
        print(f"   말씀하시면 자동으로 녹음이 시작됩니다.\n")
        
        frames = []
        silent_chunks = 0
        chunks_per_second = self.sample_rate / self.chunk_size
        silence_chunks_threshold = int(self.silence_duration * chunks_per_second)
        
        start_time = time.time()
        recording_started = False
        self.max_rms = 0
        
        # 상태 표시용 카운터
        chunk_counter = 0
        last_status_time = start_time
        
        try:
            while True:
                # 데이터 읽기
                data = stream.read(self.chunk_size, exception_on_overflow=False)
                frames.append(data)
                
                # RMS 계산
                rms = self._calculate_rms(data)
                
                # 최대 RMS 추적 (동적 임계값용)
                if rms > self.max_rms:
                    self.max_rms = rms
                    
                    # 동적 임계값 업데이트 (하이브리드 방식!)
                    if self.auto_calibrate and self.background_rms:
                        # 배경의 2배 vs 최대값의 20% 중 더 높은 값
                        self.current_threshold = max(
                            self.background_rms * 2.0,  # 배경 기반
                            self.max_rms * 0.2          # 발화 기반
                        )
                
                # 침묵 판정
                is_silent = rms < self.current_threshold
                
                # 시각적 피드백 (명확한 녹음 상태 표시!)
                if recording_started:
                    chunk_counter += 1
                    current_time = time.time()
                    elapsed = current_time - start_time
                    
                    # 1초마다 상태 표시
                    if current_time - last_status_time >= 1.0:
                        silent_seconds = int(silent_chunks / chunks_per_second)
                        print(f"\r🔴 [녹음 중] {elapsed:05.1f}초 | 침묵: {silent_seconds}/{int(self.silence_duration)}초", end="", flush=True)
                        last_status_time = current_time
                    
                    if is_silent:
                        silent_chunks += 1
                    else:
                        silent_chunks = 0
                else:
                    # 녹음 시작 트리거
                    if not is_silent:
                        recording_started = True
                        print("🔴🔴🔴 녹음 시작! 🔴🔴🔴")
                        print("="*50)
                        last_status_time = time.time()
                
                # 종료 조건 체크
                if recording_started:
                    # 침묵 지속 확인
                    if silent_chunks >= silence_chunks_threshold:
                        print(f"\n\n✅ 침묵 감지 ({self.silence_duration}초) - 종료")
                        break
                
                # 최대 시간 확인
                if time.time() - start_time > max_duration:
                    print(f"\n\n⏰ 최대 녹음 시간({max_duration}초) 도달 - 종료")
                    break
        
        except KeyboardInterrupt:
            print("\n\n⚠️  사용자가 녹음을 중단했습니다.")
        
        finally:
            stream.stop_stream()
            stream.close()
        
        # WAV 파일 저장
        wf = wave.open(output_filename, 'wb')
        wf.setnchannels(self.channels)
        wf.setsampwidth(self.audio.get_sample_size(self.format))
        wf.setframerate(self.sample_rate)
        wf.writeframes(b''.join(frames))
        wf.close()
        
        # 통계 출력
        duration = len(frames) * self.chunk_size / self.sample_rate
        print(f"\n📊 녹음 통계:")
        print(f"   시간: {duration:.2f}초")
        print(f"   파일: {output_filename}")
        if self.background_rms:
            print(f"   배경 소음: {self.background_rms:.1f} RMS")
        print(f"   최대 음량: {self.max_rms:.1f} RMS")
        print(f"   최종 침묵 기준: {self.current_threshold:.1f} RMS")
        
        return output_filename
    
    def _calculate_rms(self, audio_data):
        """
        RMS (Root Mean Square) 계산
        
        Args:
            audio_data: 바이트 형태의 오디오 데이터
        
        Returns:
            rms: RMS 값
        """
        try:
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            
            # 빈 배열 체크
            if len(audio_array) == 0:
                return 0.0
            
            # RMS 계산
            mean_square = np.mean(audio_array.astype(np.float64)**2)
            
            # NaN/inf 체크
            if np.isnan(mean_square) or np.isinf(mean_square) or mean_square < 0:
                return 0.0
            
            rms = np.sqrt(mean_square)
            
            # 최종 NaN 체크
            if np.isnan(rms) or np.isinf(rms):
                return 0.0
            
            return float(rms)
        
        except Exception:
            # 에러 발생 시 안전한 값 반환
            return 0.0
    
    def test_microphone(self, duration=5):
        """
        마이크 테스트 (RMS 실시간 표시)
        
        Args:
            duration: 테스트 시간 (초)
        """
        print(f"\n🎤 마이크 테스트 ({duration}초)")
        print("말을 해보세요. RMS 값이 실시간으로 표시됩니다.\n")
        
        stream = self.audio.open(
            format=self.format,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )
        
        rms_values = []
        chunks_to_read = int(self.sample_rate / self.chunk_size * duration)
        
        try:
            for i in range(chunks_to_read):
                data = stream.read(self.chunk_size, exception_on_overflow=False)
                rms = self._calculate_rms(data)
                rms_values.append(rms)
                
                # 시각화
                bar_length = min(int(rms / 50), 40)
                bar = "█" * bar_length
                print(f"\rRMS: {rms:6.1f}  {bar}     ", end="", flush=True)
                
                time.sleep(0.05)
        
        except KeyboardInterrupt:
            print("\n\n테스트 중단")
        
        finally:
            stream.stop_stream()
            stream.close()
        
        # 통계
        if rms_values:
            avg_rms = np.mean(rms_values)
            max_rms = np.max(rms_values)
            min_rms = np.min(rms_values)
            
            print(f"\n\n📊 테스트 결과:")
            print(f"   평균 RMS: {avg_rms:.1f}")
            print(f"   최대 RMS: {max_rms:.1f}")
            print(f"   최소 RMS: {min_rms:.1f}")
            print(f"\n💡 추천 설정:")
            print(f"   절대값 방식: silence_threshold={avg_rms * 1.5:.0f}")
            print(f"   상대값 방식: auto_calibrate=True (자동)")
    
    def close(self):
        """리소스 정리"""
        self.audio.terminate()


# ========== 테스트 ==========
if __name__ == "__main__":
    print("="*60)
    print("🎤 음성 녹음 테스트 (상대적 침묵 감지)")
    print("="*60)
    
    # 상대적 침묵 감지 (자동 보정)
    print("\n[모드] 상대적 침묵 감지 (자동 보정)")
    recorder = AudioRecorder(
        silence_threshold=None,  # 자동!
        silence_duration=3.0,
        auto_calibrate=True
    )
    
    print("\n[1단계] 마이크 테스트")
    recorder.test_microphone(duration=3)
    
    print("\n\n[2단계] 실제 녹음")
    print("말을 하세요. 배경 소음을 자동으로 측정합니다.")
    input("준비되면 Enter를 누르세요...")
    
    filename = recorder.record_until_silence(max_duration=60)
    
    print(f"\n녹음 완료! 파일: {filename}")
    
    # 정리
    recorder.close()