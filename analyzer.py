"""
음성 분석기
Whisper + KcELECTRA + 개선된 감정 분석 (PDF 기반)
"""

import torch
import numpy as np
from transformers import WhisperProcessor, WhisperForConditionalGeneration, AutoTokenizer
from config.models import MODELS
from config.scoring import SCORING_CRITERIA, calculate_score
from emotion_model import EmotionEnsemble


def calculate_emotion_score(emotion_info):
    """
    감정 안정도 점수 계산
    
    Args:
        emotion_info: EmotionEnsemble.predict() 결과
    
    Returns:
        score: 0-100 점수
    """
    if not emotion_info or 'final_emotion' not in emotion_info:
        return 70.0
    
    final_emotion = emotion_info.get('final_emotion', '중립')
    confidence = emotion_info.get('audio_conf', 0.5)
    
    # 감정 분류
    POSITIVE = ['기쁨', '행복', 'happiness', 'happy']
    NEUTRAL = ['중립', 'neutral']
    
    # 점수 계산
    if any(pos in final_emotion.lower() for pos in POSITIVE):
        score = 80.0 + (confidence * 20.0)
    elif any(neu in final_emotion.lower() for neu in NEUTRAL):
        score = 70.0 + (confidence * 10.0)
    else:  # 부정 감정
        score = 60.0 - (confidence * 60.0)
    
    return max(0.0, min(100.0, score))


class SpeechAnalyzer:
    """음성 분석기 (Whisper + KcELECTRA + 개선된 감정)"""
    
    def __init__(self):
        print("⏳ 모델 로딩 중... (2-3분 소요)")
        self.load_models()
        print("✅ 모델 로딩 완료!")
    
    def load_models(self):
        """모델 로드"""
        # GPU 체크
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Device set to use {self.device}")
        
        # Whisper (STT)
        whisper_model = MODELS['whisper']
        self.processor = WhisperProcessor.from_pretrained(whisper_model)
        self.model = WhisperForConditionalGeneration.from_pretrained(whisper_model).to(self.device)
        
        # KcELECTRA (어휘 분석)
        tokenizer_model = MODELS['tokenizer']
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_model)
        
        # 개선된 감정 분석 엔진 (PDF 기반)
        self.emotion_engine = EmotionEnsemble()
    
    def analyze(self, audio_path):
        """
        음성 파일 분석 (main.py 호환용)
        
        Args:
            audio_path: WAV 파일 경로
        
        Returns:
            분석 결과 딕셔너리
        """
        return self.analyze_audio(audio_path)
    
    def analyze_audio(self, audio_path):
        """
        음성 파일 분석
        
        Args:
            audio_path: WAV 파일 경로
        
        Returns:
            분석 결과 딕셔너리
        """
        print("="*60)
        print(f"🎤 분석 시작: {audio_path}")
        print("="*60)
        
        # 1. Whisper 분석
        print("\n[1/3] 📝 Whisper 분석 중...")
        whisper_results = self._whisper_analysis(audio_path)
        
        # 2. 어휘 분석
        print("\n[2/3] 📚 어휘력 분석 중...")
        vocab_results = self._vocabulary_analysis(whisper_results['text'])
        
        # 3. 개선된 감정 분석 (PDF 기반)
        print("\n[3/3] ❤️ 개선된 감정 분석 중...")
        emotion_results = self.emotion_engine.predict(audio_path, whisper_results['text'])
        print(f"      👉 최종 감정: {emotion_results['final_emotion']}")
        print(f"      👉 텍스트: {emotion_results['text_emotion']} ({emotion_results['text_conf']:.2f})")
        print(f"      👉 음성: {emotion_results['audio_emotion']} ({emotion_results['audio_conf']:.2f})")
        
        # Z-peak 정보 출력
        if 'z_peak' in emotion_results:
            print(f"      👉 Z-peak: {emotion_results['z_peak']:.2f}")
        
        # 가중치 적용 이유 출력
        if emotion_results.get('boost_reason'):
            print(f"      👉 적용된 가중치:")
            for reason in emotion_results['boost_reason']:
                print(f"         • {reason}")
        
        # 4. 점수 계산 (감정 포함!)
        scores = self._calculate_scores(whisper_results, vocab_results, emotion_results)
        
        # 5. 결과 출력
        self._print_scores(scores)
        
        # 6. 결과 반환 (main.py 호환 구조)
        return {
            'features': {
                'whisper': whisper_results,
                'vocabulary': vocab_results, 
                'emotion': emotion_results
            },
            'scores': scores
        }
    
    def _whisper_analysis(self, audio_path):
        """Whisper STT 분석"""
        import librosa
        
        # 오디오 로드
        audio, sr = librosa.load(audio_path, sr=16000)
        duration = len(audio) / sr
        
        # Whisper 처리
        input_features = self.processor(
            audio, 
            sampling_rate=16000, 
            return_tensors="pt"
        ).input_features.to(self.device)
        
        # 생성 (한국어 명시 + 경고 제거)
        predicted_ids = self.model.generate(
            input_features,
            language="ko",
            task="transcribe"
        )
        transcription = self.processor.batch_decode(
            predicted_ids, 
            skip_special_tokens=True
        )[0]
        
        # 단어 분석
        words = transcription.split()
        word_count = len(words)
        
        # WPM 계산
        wpm = (word_count / duration) * 60 if duration > 0 else 0
        
        # 반응시간 (첫 단어까지 시간 - 간단 추정)
        response_time = 0.0
        
        # 침묵 분석 (간단 추정)
        avg_silence = max(0, duration - (word_count * 0.5))
        
        # VPR (Vocalization-to-Pause Ratio) 계산 - 추가!
        # Reference: Mundt et al. (2007)
        vpr = duration / (avg_silence + 0.01) if avg_silence > 0 else duration * 100
        
        print(f"      ✓ 텍스트: {transcription}")
        print(f"      ✓ 단어 수: {word_count}개")
        print(f"      ✓ WPM: {wpm:.1f}")
        print(f"      ✓ 발화시간: {duration:.2f}초")
        print(f"      ✓ 반응시간: {response_time:.2f}초")
        print(f"      ✓ 평균침묵: {avg_silence:.2f}초")
        print(f"      ✓ VPR (활력도): {vpr:.2f}")  # 추가!
        
        return {
            'text': transcription,
            'word_count': word_count,
            'wpm': wpm,
            'duration': duration,
            'response_time': response_time,
            'avg_silence': avg_silence,
            'vpr': vpr  # VPR 추가!
        }
    
    def _vocabulary_analysis(self, text):
        """어휘 다양성 분석"""
        if not text:
            return {
                'total_tokens': 0,
                'unique_tokens': 0,
                'ttr': 0.0
            }
        
        # 토큰화
        tokens = self.tokenizer.tokenize(text)
        total_tokens = len(tokens)
        unique_tokens = len(set(tokens))
        
        # TTR 계산
        ttr = unique_tokens / total_tokens if total_tokens > 0 else 0.0
        
        print(f"      ✓ 총 토큰: {total_tokens}개")
        print(f"      ✓ 고유 토큰: {unique_tokens}개")
        print(f"      ✓ TTR: {ttr:.3f}")
        
        return {
            'total_tokens': total_tokens,
            'unique_tokens': unique_tokens,
            'ttr': ttr
        }
    
    def _calculate_scores(self, whisper_results, vocab_results, emotion_results):
        """점수 계산 (감정 + VPR 포함!)"""
        criteria = SCORING_CRITERIA
        
        scores = {
            'speed': calculate_score(
                whisper_results['wpm'],
                criteria['speed']['optimal_min'],
                criteria['speed']['optimal_max']
            ),
            'duration': calculate_score(
                whisper_results['duration'],
                criteria['duration']['optimal_min'],
                criteria['duration']['optimal_max']
            ),
            'response': calculate_score(
                whisper_results['response_time'],
                criteria['response']['optimal_min'],
                criteria['response']['optimal_max']
            ),
            'word_count': calculate_score(
                whisper_results['word_count'],
                criteria['word_count']['optimal_min'],
                criteria['word_count']['optimal_max']
            ),
            'vocabulary': calculate_score(
                vocab_results['ttr'],
                criteria['vocabulary']['optimal_min'],
                criteria['vocabulary']['optimal_max']
            ),
            'silence': calculate_score(
                whisper_results['avg_silence'],
                criteria['silence']['optimal_min'],
                criteria['silence']['optimal_max']
            ),
            # 감정 점수 (기존)
            'emotion': calculate_emotion_score(emotion_results),
            # VPR 점수 (추가!)
            'vitality': calculate_score(
                whisper_results['vpr'],
                criteria['vitality']['optimal_min'],
                criteria['vitality']['optimal_max']
            )
        }
        
        # 평균 점수
        scores['average'] = sum(scores.values()) / len(scores)
        
        return scores
    
    def _print_scores(self, scores):
        """점수 출력"""
        print("\n" + "="*60)
        print("📊 최종 점수")
        print("="*60)
        print(f"말의 속도:    {scores['speed']:.1f}점")
        print(f"발화 길이:    {scores['duration']:.1f}점")
        print(f"반응 속도:    {scores['response']:.1f}점")
        print(f"단어 개수:    {scores['word_count']:.1f}점")
        print(f"어휘 다양성:  {scores['vocabulary']:.1f}점")
        print(f"침묵 패턴:    {scores['silence']:.1f}점")
        print(f"감정 안정도:  {scores['emotion']:.1f}점  ← PDF 기반 개선!")
        print(f"활력도(VPR):  {scores['vitality']:.1f}점  ← 논문 기반!")  # 추가!
        print()
        print(f"🎯 평균 점수: {scores['average']:.1f}점")
        print("="*60)


# ========== 테스트 ==========
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("사용법: python analyzer.py <audio_file.wav>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    
    analyzer = SpeechAnalyzer()
    results = analyzer.analyze_audio(audio_file)
    
    print("\n분석 완료!")