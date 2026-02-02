MODELS = {
    # STT (Whisper)
    'whisper': "openai/whisper-medium",
    
    # 어휘 분석 (KcELECTRA)
    'tokenizer': "beomi/KcELECTRA-base-v2022",
    
    # LLM (EXAONE 3.0 - 한국어 최고 성능)
    'llm': "LGAI-EXAONE/EXAONE-3.0-7.8B-Instruct",
    
    # 감정분석용 모델 (한국어 전용으로 변경!)
    'emotion_text': "MelissaJ/koelectra-emotion-6-emotion-base",  # ← 여기만 바꿈!
    'emotion_audio': "jungjongho/wav2vec2-xlsr-korean-speech-emotion-recognition",
    
    'llm_options': {
        'load_in_4bit': True,
        'device_map': 'auto',
        'torch_dtype': 'float16',
    }
}


