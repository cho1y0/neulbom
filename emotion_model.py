"""
적응형 감정 통합 엔진 (Adaptive Emotion Fusion)
PDF 기술노트 기반 구현 + MelissaJ 모델 대응

핵심 개선사항:
1. Z-score 기반 Pitch Dynamics 분석
2. 동적 신뢰도 부스팅 (Dynamic Confidence Boosting)
3. 3가지 상황별 가중치 적용
4. MelissaJ 6감정 모델 지원
5. 영어 레이블 강제 한글 매핑 (수정!)
"""

import torch
import torch.nn.functional as F
import librosa
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from transformers import Wav2Vec2Processor, Wav2Vec2ForSequenceClassification
from config.models import MODELS


class EmotionEnsemble:
    """
    개선된 감정 분석 엔진 (PDF 기반)
    - 적응형 감정 통합
    - Pitch Dynamics 기반 보정
    - 가면 우울증 탐지
    - MelissaJ 6감정 모델 지원
    """
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"❤️‍🩹 개선된 감정 분석 엔진 초기화 (Device: {self.device})")

        try:
            # Config에서 모델명 가져오기
            text_model_name = MODELS['emotion_text']
            audio_model_name = MODELS['emotion_audio']
            
            print(f"   텍스트 모델: {text_model_name}")
            print(f"   음성 모델: {audio_model_name}")
            
            # 1. 텍스트 모델 로딩
            self.text_tokenizer = AutoTokenizer.from_pretrained(text_model_name)
            self.text_model = AutoModelForSequenceClassification.from_pretrained(
                text_model_name
            ).to(self.device)
            
            # ========== 수정: MelissaJ 모델 강제 한글 매핑 ==========
            if "MelissaJ" in text_model_name:
                # MelissaJ: 영어 레이블을 한글로 강제 매핑!
                self.text_labels = {
                    0: '기쁨',
                    1: '분노',
                    2: '상처',
                    3: '불안',
                    4: '당황',
                    5: '슬픔'
                }
                self.use_korean_6 = True
                print(f"   → 한국어 6감정 모델 (강제 한글 매핑): {list(self.text_labels.values())}")
            else:
                # 기존 모델
                self.text_labels = self.text_model.config.id2label
                self.use_korean_6 = False
                print(f"   → 기존 모델 (레이블: {len(self.text_labels)}개)")
            # ======================================================

            # 2. 음성 모델 로딩
            self.audio_processor = Wav2Vec2Processor.from_pretrained(audio_model_name)
            self.audio_model = Wav2Vec2ForSequenceClassification.from_pretrained(
                audio_model_name
            ).to(self.device)
            self.audio_labels = self.audio_model.config.id2label
            
            print("✅ 개선된 멀티모달 감정 모델 준비 완료")
            
        except Exception as e:
            print(f"❌ 모델 로딩 실패: {e}")
            raise e

    def predict(self, audio_path, text):
        """
        개선된 감정 예측
        
        Args:
            audio_path: 음성 파일 경로
            text: STT 결과 텍스트
        
        Returns:
            감정 분석 결과 딕셔너리
        """
        try:
            # === [1단계] 특징 추출 (Feature Extraction) ===
            
            # [Text 분석]
            inputs = self.text_tokenizer(
                text, 
                return_tensors="pt", 
                truncation=True, 
                max_length=128
            ).to(self.device)
            
            with torch.no_grad():
                text_probs = F.softmax(self.text_model(**inputs).logits, dim=-1)
            
            text_idx = torch.argmax(text_probs).item()
            text_emotion_raw = self.text_labels[text_idx]  # ← 이제 한글!
            text_conf_raw = text_probs[0][text_idx].item()
            
            # 디버그: 텍스트 모델의 모든 후보 출력
            print(f"      [텍스트 감정 후보]")
            for idx, prob in enumerate(text_probs[0].cpu().numpy()):
                if prob > 0.05:  # 5% 이상만
                    emotion_label = self.text_labels.get(idx, f"Unknown_{idx}")
                    print(f"         {emotion_label}: {prob:.3f}")

            # [Audio 분석]
            y, sr = librosa.load(audio_path, sr=16000)
            target_len = 16000 * 60  # 60초 (1분)
            if len(y) > target_len: 
                y = y[:target_len]
            else: 
                y = np.pad(y, (0, max(0, target_len - len(y))), "constant")
            
            a_inputs = self.audio_processor(
                y, 
                sampling_rate=16000, 
                return_tensors="pt", 
                padding=True
            ).input_values.to(self.device)
            
            with torch.no_grad():
                audio_probs = F.softmax(self.audio_model(a_inputs).logits, dim=-1)
                text_probs = F.softmax(self.text_model(**inputs).logits, dim=-1)
            
            audio_idx = torch.argmax(audio_probs).item()
            audio_emotion_raw = self.audio_labels[audio_idx]
            audio_conf_raw = audio_probs[0][audio_idx].item()

            # [Pitch 분석] - Z-score 계산
            z_peak = self._calculate_pitch_zscore(y, sr)
            
            # === [2단계] 상황별 가중치 적용 (Context-Aware Boosting) ===
            
            # 텍스트 감정은 이미 한글! (MelissaJ 강제 매핑)
            if self.use_korean_6:
                text_emotion_kr = text_emotion_raw  # 이미 한글!
            else:
                text_emotion_kr = self._translate(text_emotion_raw)
            
            # 음성 감정은 한글 변환 필요
            audio_emotion_kr = self._translate_audio(audio_emotion_raw)
            
            # 가중치 초기화
            text_boost = 1.0
            audio_boost = 1.0
            boost_reason = []
            
            # ① 톤 역동성 보정 (Pitch Dynamics)
            if z_peak >= 2.0:
                # 급격한 변화 → 실제 격양됨
                audio_boost *= 1.3
                boost_reason.append(f"톤 역동성 높음(Z={z_peak:.2f}) → 음성×1.3")
            elif z_peak < 1.0:
                # 단조로움 → 원래 톤이 높거나 오류
                audio_boost *= 0.7
                boost_reason.append(f"톤 역동성 낮음(Z={z_peak:.2f}) → 음성×0.7")
            
            # ② 긍정 감정 수호 (Positive Override)
            if text_emotion_kr in ['기쁨', '행복'] and text_conf_raw >= 0.8:
                # 명확한 긍정 → 텍스트 우선
                text_boost *= 1.5
                boost_reason.append(f"명확한 긍정 표현({text_conf_raw:.2f}) → 텍스트×1.5")
            
            # ③ 가면 우울증 탐지 (Masked Depression)
            # MelissaJ는 '중립' 없으므로 조건 수정
            if self.use_korean_6:
                # 6감정 모델: 기쁨이지만 음성은 부정
                if text_emotion_kr == '기쁨' and audio_emotion_kr in ['슬픔', '불안']:
                    audio_boost *= 1.4
                    boost_reason.append(f"가면 감정 의심(텍스트:{text_emotion_kr}, 음성:{audio_emotion_kr}) → 음성×1.4")
            else:
                # 기존 모델: 중립이지만 음성은 부정
                if text_emotion_kr in ['중립'] and audio_emotion_kr in ['슬픔', '불안', '공포']:
                    audio_boost *= 1.4
                    boost_reason.append(f"가면 우울 의심(텍스트:{text_emotion_kr}, 음성:{audio_emotion_kr}) → 음성×1.4")
            
            # === [3단계] 최종 점수 계산 (Scoring) ===
            
            text_score_final = text_conf_raw * text_boost
            audio_score_final = audio_conf_raw * audio_boost
            
            # Min-Max 정규화 (0.0~1.0)
            max_score = max(text_score_final, audio_score_final)
            
            if max_score > 1.0:
                text_score_final = text_score_final / max_score
                audio_score_final = audio_score_final / max_score
            
            # === [4단계] 최종 결정 (Decision) ===
            
            score_diff = abs(text_score_final - audio_score_final)
            
            # 안전 가중치 (Safety Bias): 점수 차이가 0.15 미만이면 부정 감정 우선
            if score_diff < 0.15:
                # 판단 불확실 → 부정 감정 우선 (안전 지향)
                if self.use_korean_6:
                    NEGATIVE = ['분노', '슬픔', '불안', '상처', '당황']
                else:
                    NEGATIVE = ['분노', '슬픔', '불안', '공포', '혐오']
                
                if audio_emotion_kr in NEGATIVE:
                    audio_score_final *= 1.2
                    boost_reason.append(f"판단 불확실({score_diff:.3f}<0.15) → 음성 부정 우선×1.2")
                elif text_emotion_kr in NEGATIVE:
                    text_score_final *= 1.2
                    boost_reason.append(f"판단 불확실({score_diff:.3f}<0.15) → 텍스트 부정 우선×1.2")
            
            # 최종 감정 선택
            if audio_score_final >= text_score_final:
                final_emotion = audio_emotion_kr
                final_conf = audio_score_final
                decision = "음성 우선"
            else:
                final_emotion = text_emotion_kr
                final_conf = text_score_final
                decision = "텍스트 우선"
            
            emotion_scores = {}
        
            if self.use_korean_6:
                # MelissaJ: 한글 레이블로 저장
                for idx in range(len(text_probs[0])):
                    emotion_name = self.text_labels[idx]  # '기쁨', '분노', ...
                    prob_value = float(text_probs[0][idx].item())
                    emotion_scores[emotion_name] = round(prob_value * 100, 2)  # 퍼센트
            else:
                # 기존 모델: 영어 → 한글 변환
                for idx in range(len(text_probs[0])):
                    emotion_name_eng = self.text_labels[idx]
                    emotion_name_kr = self._translate(emotion_name_eng)
                    prob_value = float(text_probs[0][idx].item())
                    emotion_scores[emotion_name_kr] = round(prob_value * 100, 2)
        
            print(f"      [감정 점수] {emotion_scores}")
            
            return {
                # 원본 결과
                'text_emotion': text_emotion_kr,  # 이제 한글!
                'text_conf': text_conf_raw,
                'audio_emotion': audio_emotion_kr, 
                'audio_conf': audio_conf_raw,
                
                # 개선된 결과
                'text_score_boosted': float(text_score_final),
                'audio_score_boosted': float(audio_score_final),
                'z_peak': float(z_peak),
                'boost_reason': boost_reason,
                'decision': decision,
                
                'candidates': emotion_scores,
                
                # 최종 결과
                'final_emotion': final_emotion,
                'final_conf': float(final_conf)
            }
            
        except Exception as e:
            print(f"⚠️ 분석 오류: {e}")
            return {
                'final_emotion': '알수없음',
                'audio_emotion': '알수없음',
                'text_emotion': '알수없음',
                'text_conf': 0.5,
                'audio_conf': 0.5,
                'final_conf': 0.5,
                'z_peak': 0.0,
                'boost_reason': [],
                'decision': '오류'
            }

    def _calculate_pitch_zscore(self, y, sr, sigma_min=5.0):
        """
        Pitch Z-score 계산
        
        Args:
            y: 오디오 신호
            sr: 샘플링 레이트
            sigma_min: 최소 표준편차 임계값 (기본 5.0 Hz)
        
        Returns:
            z_peak: 최대 Z-score 절댓값
        
        수식:
            Z_peak = max(|F0(t) - μ_F0| / max(σ_F0, σ_min))
        """
        try:
            # F0 추출 (Fundamental Frequency)
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y, 
                fmin=librosa.note_to_hz('C2'),  # 최소 65.4 Hz
                fmax=librosa.note_to_hz('C7'),  # 최대 2093 Hz
                sr=sr
            )
            
            # NaN 제거 (무성음 구간)
            f0_valid = f0[~np.isnan(f0)]
            
            if len(f0_valid) < 10:
                # 유효한 피치가 너무 적으면 0 반환
                return 0.0
            
            # 평균과 표준편차 계산
            mu_f0 = np.mean(f0_valid)
            sigma_f0 = np.std(f0_valid)
            
            # 안전 상수 적용 (표준편차가 너무 작으면 sigma_min 사용)
            sigma_safe = max(sigma_f0, sigma_min)
            
            # Z-score 계산
            z_scores = np.abs((f0_valid - mu_f0) / sigma_safe)
            
            # 최댓값 반환 (순간적인 격양 포착)
            z_peak = np.max(z_scores)
            
            return z_peak
            
        except Exception as e:
            print(f"⚠️ Pitch Z-score 계산 오류: {e}")
            return 0.0

    def _translate_audio(self, label):
        """
        음성 감정 레이블만 한글 변환
        (텍스트 감정은 이미 한글이므로 변환 안 함!)
        """
        label = str(label).lower()
        
        # 음성 모델 레이블 매핑만
        audio_mapping = {
            'angry': '분노',
            'fear': '불안',
            'happy': '기쁨',
            'neutral': '중립',
            'sad': '슬픔',
            # 숫자 레이블
            '0': '분노',
            '1': '기쁨',
            '2': '불안',
            '3': '슬픔',
            '4': '중립',
        }
        
        for k, v in audio_mapping.items():
            if k in label:
                return v
        
        return '중립'

    def _translate(self, label):
        """
        기존 모델용 감정 레이블 한글 변환
        (MelissaJ는 이미 한글이라 호출 안 됨)
        """
        label = str(label).lower()
        mapping = {
            'anger': '분노', 'angry': '분노',
            'disgust': '혐오', 'disgusted': '혐오',
            'fear': '공포', 'fearful': '공포',
            'happiness': '기쁨', 'happy': '기쁨',
            'neutral': '중립',
            'sadness': '슬픔', 'sad': '슬픔',
            'surprise': '놀람', 'surprised': '놀람',
            'embarrassed': '당황',
            'heartache': '슬픔',
            '0': '공포', '1': '놀람', '2': '분노', '3': '슬픔', 
            '4': '중립', '5': '기쁨', '6': '혐오'
        }
        
        for k, v in mapping.items():
            if k in label: 
                return v
        return '중립'