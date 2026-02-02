from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
from datetime import datetime
from typing import Optional

# 로컬 모듈
from analyzer import SpeechAnalyzer
from db_handler import VoiceDBHandler
from llm_handler import LLMHandler

# ========================================
# FastAPI 앱 생성
# ========================================
app = FastAPI(
    title="노인 케어 음성 분석 서버",
    description="음성 파일을 받아서 분석하고 DB에 저장",
    version="1.0.0"
)

# CORS 설정 (프론트엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프론트엔드 주소로 변경 권장!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# 전역 변수 (모델 저장용)
# ========================================
analyzer = None
db_handler = None
llm_handler = None

# ========================================
# 서버 시작 이벤트: 모델 로딩
# ========================================
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 1회 로드"""
    global analyzer, db_handler, llm_handler
    
    print("="*60)
    print("🚀 서버 시작 중...")
    print("="*60)
    
    # 1. 음성 분석기 로드 (무거운 작업!)
    print("\n[1/3] 음성 분석기 로드 중... (2-3분 소요)")
    try:
        analyzer = SpeechAnalyzer()
        print("✅ 음성 분석기 로드 완료!")
    except Exception as e:
        print(f"❌ 음성 분석기 로드 실패: {e}")
        raise e
    
    # 2. DB 핸들러 초기화
    print("\n[2/3] DB 연결 중...")
    try:
        db_handler = VoiceDBHandler()
        if db_handler.connect():
            print("✅ DB 연결 성공!")
        else:
            print("⚠️ DB 연결 실패 - DB 저장 비활성화")
            db_handler = None
    except Exception as e:
        print(f"⚠️ DB 초기화 실패: {e}")
        db_handler = None
    
    # 3. LLM 핸들러 초기화
    print("\n[3/3] LLM 초기화 중...")
    try:
        llm_handler = LLMHandler()
        print("✅ LLM 초기화 완료!")
    except Exception as e:
        print(f"⚠️ LLM 초기화 실패: {e}")
        llm_handler = None
    
    print("\n" + "="*60)
    print("✅ 서버 준비 완료!")
    print("="*60)
    print("📡 엔드포인트:")
    print("   POST /analyze - 음성 분석")
    print("   GET /latest-sensing - 최신 센서 데이터")
    print("   GET /health - 서버 상태")
    print("="*60)

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 정리"""
    global db_handler
    
    print("\n🛑 서버 종료 중...")
    
    if db_handler:
        db_handler.close()
    
    print("✅ 서버 종료 완료")

# ========================================
# API 엔드포인트
# ========================================

@app.get("/")
async def root():
    """서버 루트"""
    return {
        "message": "노인 케어 음성 분석 서버",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "analyzer": analyzer is not None,
        "db": db_handler is not None,
        "llm": llm_handler is not None,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/latest-sensing")
async def get_latest_sensing(senior_id: int = 1):
    """
    최신 센서 데이터 가져오기
    
    Args:
        senior_id: 시니어 ID (기본값: 1)
    
    Returns:
        최신 sensing_id 또는 None
    """
    if not db_handler:
        return {"sensing_id": None, "message": "DB 연결 없음"}
    
    try:
        # tb_sensing에서 최신 데이터 조회
        cursor = db_handler.cursor
        sql = """
            SELECT sensing_id 
            FROM tb_sensing 
            ORDER BY created_at DESC 
            LIMIT 1
        """
        cursor.execute(sql)
        result = cursor.fetchone()
        
        if result:
            sensing_id = result[0]
            return {
                "sensing_id": sensing_id,
                "message": "최신 센서 데이터"
            }
        else:
            return {
                "sensing_id": None,
                "message": "센서 데이터 없음"
            }
    
    except Exception as e:
        return {
            "sensing_id": None,
            "error": str(e)
        }

@app.post("/analyze")
async def analyze_audio(
    audio_file: UploadFile = File(...),
    senior_id: int = Form(1),
    sensing_id: Optional[int] = Form(None),
    generate_response: bool = Form(True)
):
    """
    음성 파일 분석 + DB 저장
    
    Args:
        audio_file: 음성 파일 (.wav)
        senior_id: 시니어 ID (기본값: 1)
        sensing_id: 센싱 ID (없으면 None → 0)
        generate_response: AI 응답 생성 여부
    
    Returns:
        분석 결과 + AI 응답
    """
    
    # 모델 체크
    if not analyzer:
        raise HTTPException(status_code=503, detail="음성 분석기 초기화 안 됨")
    
    print(f"\n{'='*60}")
    print(f"🎤 음성 분석 요청")
    print(f"{'='*60}")
    print(f"시니어 ID: {senior_id}")
    print(f"센싱 ID: {sensing_id}")
    
    # ========================================
    # 1. 음성 파일 저장
    # ========================================
    try:
        # 임시 파일 생성
        suffix = os.path.splitext(audio_file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            content = await audio_file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        print(f"✅ 음성 파일 저장: {tmp_path}")
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 저장 실패: {str(e)}")
    
    # ========================================
    # 2. 음성 분석
    # ========================================
    try:
        print("\n[분석 중...]")
        analysis_result = analyzer.analyze(tmp_path)
        
        whisper = analysis_result['features']['whisper']
        emotion = analysis_result['features']['emotion']
        scores = analysis_result['scores']
        
        print(f"✅ 분석 완료!")
        print(f"   텍스트: {whisper['text']}")
        print(f"   감정: {emotion['final_emotion']} ({emotion['final_conf']:.3f})")
        print(f"   종합 점수: {scores['average']:.1f}점")
    
    except Exception as e:
        # 임시 파일 삭제
        try:
            os.remove(tmp_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"분석 실패: {str(e)}")
    
    # ========================================
    # 3. AI 응답 생성 (선택)
    # ========================================
    ai_response = None
    if generate_response and llm_handler:
        try:
            print("\n[AI 응답 생성 중...]")
            ai_response = llm_handler.chat(
                whisper['text'],
                emotion_info=emotion,
                scores=scores
            )
            print(f"✅ AI 응답: {ai_response[:50]}...")
        except Exception as e:
            print(f"⚠️ AI 응답 생성 실패: {e}")
            ai_response = None
    
    # ========================================
    # 4. DB 저장
    # ========================================
    voice_id = None
    if db_handler:
        try:
            # ========== sensing_id 처리 ==========
            # None이면 0으로 변환!
            save_sensing_id = sensing_id if sensing_id is not None else 0
            # ====================================
            
            print(f"\n[DB 저장 중... (sensing_id={save_sensing_id})]")
            voice_id = db_handler.save_analysis(
                senior_id,
                analysis_result,
                save_sensing_id
            )
            
            if voice_id:
                print(f"✅ DB 저장 성공 (voice_id: {voice_id})")
            else:
                print(f"⚠️ DB 저장 실패")
        
        except Exception as e:
            print(f"❌ DB 저장 에러: {e}")
    
    # ========================================
    # 5. 임시 파일 삭제
    # ========================================
    try:
        os.remove(tmp_path)
    except:
        pass
    
    # ========================================
    # 6. 결과 반환
    # ========================================
    return {
        "success": True,
        "voice_id": voice_id,
        "analysis": {
            "text": whisper['text'],
            "emotion": {
                "final": emotion['final_emotion'],
                "confidence": emotion['final_conf'],
                "text_emotion": emotion['text_emotion'],
                "audio_emotion": emotion['audio_emotion'],
                "z_peak": emotion['z_peak'],
                "decision": emotion['decision']
            },
            "scores": scores,
            "whisper": {
                "word_count": whisper['word_count'],
                "wpm": whisper['wpm'],
                "duration": whisper['duration'],
                "response_time": whisper['response_time']
            }
        },
        "ai_response": ai_response,
        "metadata": {
            "senior_id": senior_id,
            "sensing_id": save_sensing_id if db_handler else None,
            "timestamp": datetime.now().isoformat()
        }
    }

# ========================================
# 서버 실행
# ========================================
if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║     🏥 노인 케어 음성 분석 서버                          ║
    ║                                                          ║
    ║     FastAPI 기반 - 모델 1회 로드, 요청별 분석            ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    
    # 서버 시작
    uvicorn.run(
        app,
        host="0.0.0.0",  # 외부 접근 허용
        port=8000,
        log_level="info"
    )
