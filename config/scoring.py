"""
점수 계산 기준 및 함수
- 기존 7가지 (감정 포함) + VPR 추가
"""

SCORING_CRITERIA = {
    # 말의 속도 (WPM: Words Per Minute)
    'speed': {
        'optimal_min': 100,
        'optimal_max': 150,
        'weight': 1.0
    },
    
    # 발화 길이 (초)
    'duration': {
        'optimal_min': 3.0,
        'optimal_max': 10.0,
        'weight': 1.0
    },
    
    # 반응 속도 (초)
    'response': {
        'optimal_min': 0.0,
        'optimal_max': 2.0,
        'weight': 1.0
    },
    
    # 단어 개수
    'word_count': {
        'optimal_min': 5,
        'optimal_max': 20,
        'weight': 1.0
    },
    
    # 어휘 다양성 (TTR)
    'vocabulary': {
        'optimal_min': 0.6,
        'optimal_max': 0.9,
        'weight': 1.0
    },
    
    # 침묵 패턴 (초)
    'silence': {
        'optimal_min': 0.0,
        'optimal_max': 1.0,
        'weight': 1.0
    },
    
    # 감정 안정도 (신규)
    'emotion': {
        'optimal_min': 70.0,  # 기본 70점 이상
        'optimal_max': 100.0,
        'weight': 1.5  # 가중치 높음 (중요 지표)
    },
    
    # 활력도 (VPR: Vocalization-to-Pause Ratio) - 추가!
    # Reference: Mundt et al. (2007), "Voice acoustic measures of depression severity"
    # VPR = 발화시간 / 침묵시간
    # 높을수록 활발함, 낮을수록 우울/무기력 가능성
    'vitality': {
        'optimal_min': 2.0,   # VPR >= 2.0: 정상 (발화가 침묵의 2배)
        'optimal_max': 10.0,  # VPR <= 10.0: 과도한 말 아님
        'weight': 1.0
    }
}


def calculate_score(value, optimal_min, optimal_max):
    """
    0-100 점수 계산 (기존 로직)
    """
    if optimal_min <= value <= optimal_max:
        return 100.0
    elif value < optimal_min:
        if optimal_min == 0:
            return 0.0
        ratio = value / optimal_min
        return max(0.0, ratio * 100.0)
    else:
        excess = value - optimal_max
        penalty = (excess / optimal_max) * 100
        return max(0.0, 100.0 - penalty)


def calculate_emotion_score(emotion_info):
    """
    감정 안정도 점수 계산
    
    Args:
        emotion_info: EmotionEnsemble.predict() 결과
            {
                'final_emotion': '기쁨' | '중립' | '분노' | '슬픔' | '불안' | '공포' | '혐오',
                'text_emotion': str,
                'text_conf': float,
                'audio_emotion': str,
                'audio_conf': float
            }
    
    Returns:
        score: 0-100 점수
    
    로직:
        - 긍정 감정 (기쁨): 80~100점
        - 중립 감정: 70~80점
        - 부정 감정 (분노, 슬픔, 불안, 공포, 혐오): 0~60점
        - 확신도가 높을수록 점수 변동폭 증가
    """
    if not emotion_info or 'final_emotion' not in emotion_info:
        return 70.0  # 기본값 (중립)
    
    final_emotion = emotion_info.get('final_emotion', '중립')
    
    # 음성 감정의 확신도 사용 (더 신뢰도 높음)
    confidence = emotion_info.get('audio_conf', 0.5)
    
    # 감정 카테고리 정의
    POSITIVE = ['기쁨', '행복', 'happiness', 'happy']
    NEUTRAL = ['중립', 'neutral']
    NEGATIVE = ['분노', '슬픔', '불안', '공포', '혐오', 'anger', 'sadness', 'fear', 'disgust']
    
    # 감정별 점수 계산
    if any(pos in final_emotion.lower() for pos in POSITIVE):
        # 긍정 감정: 80 + (확신도 * 20)
        base_score = 80.0
        bonus = confidence * 20.0
        score = min(100.0, base_score + bonus)
        
    elif any(neu in final_emotion.lower() for neu in NEUTRAL):
        # 중립 감정: 70 + (확신도 * 10)
        base_score = 70.0
        bonus = confidence * 10.0
        score = base_score + bonus
        
    else:
        # 부정 감정: 60 - (확신도 * 60)
        # 확신도가 높을수록 점수 낮아짐 (위험 신호)
        base_score = 60.0
        penalty = confidence * 60.0
        score = max(0.0, base_score - penalty)
    
    return round(score, 1)


def get_emotion_feedback(emotion_score):
    """
    감정 점수에 따른 피드백 메시지
    
    Args:
        emotion_score: 감정 점수 (0-100)
    
    Returns:
        feedback: 피드백 메시지
    """
    if emotion_score >= 80:
        return "😊 매우 안정적인 감정 상태"
    elif emotion_score >= 70:
        return "😌 안정적인 감정 상태"
    elif emotion_score >= 50:
        return "😐 주의가 필요한 감정 상태"
    elif emotion_score >= 30:
        return "😟 불안정한 감정 상태 - 관심 필요"
    else:
        return "😢 매우 불안정한 감정 상태 - 즉시 관심 필요"