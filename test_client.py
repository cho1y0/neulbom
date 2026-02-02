"""
서버 테스트 클라이언트
음성 파일을 서버에 전송하고 결과 받기
"""

import requests
import json


def test_health():
    """서버 상태 확인"""
    print("\n" + "="*60)
    print("🔍 서버 상태 확인")
    print("="*60)
    
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 서버 상태: {data['status']}")
            print(f"   분석기: {'✅' if data['analyzer'] else '❌'}")
            print(f"   DB: {'✅' if data['db'] else '❌'}")
            print(f"   LLM: {'✅' if data['llm'] else '❌'}")
            return True
        else:
            print(f"❌ 서버 응답 실패: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")
        return False


def test_latest_sensing():
    """최신 센서 데이터 조회"""
    print("\n" + "="*60)
    print("📡 최신 센서 데이터 조회")
    print("="*60)
    
    try:
        response = requests.get("http://localhost:8000/latest-sensing")
        if response.status_code == 200:
            data = response.json()
            print(f"센싱 ID: {data.get('sensing_id')}")
            print(f"메시지: {data.get('message')}")
            return data.get('sensing_id')
        else:
            print(f"❌ 조회 실패: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ 요청 실패: {e}")
        return None


def test_analyze(audio_file_path, senior_id=1, sensing_id=None):
    """음성 파일 분석 요청"""
    print("\n" + "="*60)
    print("🎤 음성 분석 요청")
    print("="*60)
    print(f"파일: {audio_file_path}")
    print(f"시니어 ID: {senior_id}")
    print(f"센싱 ID: {sensing_id}")
    
    try:
        # 파일 열기
        with open(audio_file_path, 'rb') as f:
            files = {'audio_file': f}
            data = {
                'senior_id': senior_id,
                'sensing_id': sensing_id if sensing_id else '',
                'generate_response': True
            }
            
            # 서버 요청
            print("\n서버 요청 중...")
            response = requests.post(
                "http://localhost:8000/analyze",
                files=files,
                data=data,
                timeout=300  # 5분 타임아웃
            )
        
        # 결과 처리
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "="*60)
            print("✅ 분석 완료!")
            print("="*60)
            
            # 분석 결과
            analysis = result['analysis']
            print(f"\n📝 텍스트: {analysis['text']}")
            
            emotion = analysis['emotion']
            print(f"\n❤️  감정:")
            print(f"   최종: {emotion['final']} ({emotion['confidence']:.3f})")
            print(f"   텍스트: {emotion['text_emotion']}")
            print(f"   음성: {emotion['audio_emotion']}")
            print(f"   Z-peak: {emotion['z_peak']:.2f}")
            print(f"   결정: {emotion['decision']}")
            
            scores = analysis['scores']
            print(f"\n📊 점수:")
            print(f"   종합: {scores['average']:.1f}점")
            print(f"   감정: {scores['emotion']:.1f}점")
            print(f"   반응: {scores['response']:.1f}점")
            print(f"   어휘: {scores['vocabulary']:.1f}점")
            
            if result['ai_response']:
                print(f"\n🤖 AI 응답:")
                print(f"   {result['ai_response']}")
            
            metadata = result['metadata']
            print(f"\n💾 저장 정보:")
            print(f"   voice_id: {result.get('voice_id')}")
            print(f"   sensing_id: {metadata['sensing_id']}")
            print(f"   timestamp: {metadata['timestamp']}")
            
            return result
        
        else:
            print(f"\n❌ 분석 실패: {response.status_code}")
            print(f"   {response.text}")
            return None
    
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        return None


def main():
    """메인 함수"""
    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║     🧪 서버 테스트 클라이언트                            ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    
    # 1. 서버 상태 확인
    if not test_health():
        print("\n⚠️  서버가 실행되지 않았습니다!")
        print("   먼저 서버를 실행하세요: python server.py")
        return
    
    # 2. 최신 센서 데이터 조회
    latest_sensing = test_latest_sensing()
    
    # 3. 음성 파일 경로 입력
    print("\n" + "="*60)
    audio_path = input("음성 파일 경로 입력 (Enter=테스트 파일): ").strip()
    
    if not audio_path:
        audio_path = "./recordings/turn_001.wav"
        print(f"기본 경로 사용: {audio_path}")
    
    # 4. 분석 요청
    result = test_analyze(
        audio_path,
        senior_id=1,
        sensing_id=latest_sensing  # 최신 센서 데이터 사용 (또는 None)
    )
    
    if result:
        print("\n" + "="*60)
        print("✅ 테스트 완료!")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("❌ 테스트 실패!")
        print("="*60)


if __name__ == "__main__":
    main()
