"""
MySQL DB 핸들러
음성 분석 결과를 DB에 저장
"""

import pymysql
from config.db_config import DB_CONFIG


class VoiceDBHandler:
    """음성 분석 결과 DB 저장 핸들러"""
    
    def __init__(self):
        """초기화"""
        self.connection = None
        self.cursor = None
    
    def connect(self):
        """DB 연결"""
        try:
            self.connection = pymysql.connect(
                host=DB_CONFIG['host'],
                port=DB_CONFIG['port'],
                user=DB_CONFIG['user'],
                password=DB_CONFIG['password'],
                database=DB_CONFIG['database'],
                charset=DB_CONFIG['charset']
            )
            self.cursor = self.connection.cursor()
            print(f"✅ DB 연결 성공: {DB_CONFIG['database']}")
            return True
        except Exception as e:
            print(f"❌ DB 연결 실패: {e}")
            return False
    
    def save_analysis(self, senior_id, analysis_result, sensing_id=None):
        """
        분석 결과를 DB에 저장
        
        Args:
            senior_id: 시니어 ID
            analysis_result: analyzer.analyze() 결과
            sensing_id: 센싱 ID (없으면 None → 0으로 저장)
        
        Returns:
            voice_id: 성공 시 저장된 voice_id
            None: 실패 시
        """
        if not self.connection:
            print("❌ DB 연결이 없습니다!")
            return None
        
        try:
            # ========== 수정: None → 0 변환 ==========
            if sensing_id is None:
                sensing_id = 0
            # =========================================
            
            # 데이터 추출
            whisper = analysis_result['features']['whisper']
            emotion = analysis_result['features']['emotion']
            
            # ========================================
            # 1단계: tb_voice_log에 저장
            # ========================================
            voice_sql = """
                INSERT INTO tb_voice_log 
                (senior_id, sensing_id, voice_text, response_time_sec, utterance_length)
                VALUES (%s, %s, %s, %s, %s)
            """
            
            self.cursor.execute(voice_sql, (
                senior_id,
                sensing_id,  # ← 0 또는 실제 값!
                whisper['text'],
                round(whisper['response_time'], 1),
                round(whisper['duration'], 1)
            ))
            
            # 방금 삽입한 voice_id 가져오기
            voice_id = self.cursor.lastrowid
            
            # ========================================
            # 2단계: tb_analysis에 저장
            # ========================================
            
            # 감정 비율 추출 (candidates에서)
            candidates = emotion.get('candidates', {})
            
            analysis_sql = """
                INSERT INTO tb_analysis 
                (voice_idx, emotion_label, stt_text, behavior_policy,
                 hap_ratio, sad_ratio, neu_ratio, ang_ratio, 
                 anxi_ratio, emba_ratio, heart_ratio)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            self.cursor.execute(analysis_sql, (
                voice_id,
                emotion['final_emotion'],
                whisper['text'],
                None,  # behavior_policy (나중에 추가)
                candidates.get('기쁨', 0.0),      # hap_ratio
                candidates.get('슬픔', 0.0),      # sad_ratio
                candidates.get('중립', 0.0),      # neu_ratio (MelissaJ는 없을 수도)
                candidates.get('분노', 0.0),      # ang_ratio
                candidates.get('불안', 0.0),      # anxi_ratio
                candidates.get('당황', 0.0),      # emba_ratio
                candidates.get('상처', 0.0)       # heart_ratio
            ))
            
            # 커밋 (저장 확정!)
            self.connection.commit()
            
            print(f"\n💾 DB 저장 성공!")
            print(f"   voice_id: {voice_id}")
            if sensing_id > 0:
                print(f"   sensing_id: {sensing_id} (센서 연결됨!)")
            else:
                print(f"   sensing_id: 0 (센서 없음)")
            print(f"   텍스트: {whisper['text'][:30]}...")
            print(f"   감정: {emotion['final_emotion']}")
            
            return voice_id
            
        except Exception as e:
            print(f"\n❌ DB 저장 실패: {e}")
            self.connection.rollback()  # 실패하면 롤백!
            return None
    
    def get_recent_analyses(self, senior_id, limit=10):
        """
        최근 분석 결과 조회
        
        Args:
            senior_id: 시니어 ID
            limit: 조회 개수
        
        Returns:
            분석 결과 리스트
        """
        if not self.connection:
            return []
        
        try:
            sql = """
                SELECT 
                    v.voice_id,
                    v.voice_text,
                    v.created_at,
                    v.sensing_id,
                    a.emotion_label,
                    a.hap_ratio,
                    a.sad_ratio,
                    a.ang_ratio
                FROM tb_voice_log v
                LEFT JOIN tb_analysis a ON v.voice_id = a.voice_idx
                WHERE v.senior_id = %s
                ORDER BY v.created_at DESC
                LIMIT %s
            """
            
            self.cursor.execute(sql, (senior_id, limit))
            results = self.cursor.fetchall()
            
            return results
            
        except Exception as e:
            print(f"❌ 조회 실패: {e}")
            return []
    
    def close(self):
        """DB 연결 종료"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            print("✅ DB 연결 종료")


# ========== 테스트 ==========
if __name__ == "__main__":
    # DB 핸들러 생성
    db = VoiceDBHandler()
    
    # 연결 테스트
    if db.connect():
        print("DB 연결 테스트 성공!")
        
        # 최근 분석 조회 테스트
        recent = db.get_recent_analyses(senior_id=1, limit=5)
        print(f"\n최근 분석 {len(recent)}건:")
        for r in recent:
            sensing_status = f"센서 {r[3]}" if r[3] else "센서 없음"
            print(f"  - {r[2]}: {r[4]} ({sensing_status}) - {r[1][:20]}...")
        
        db.close()
    else:
        print("DB 연결 실패! db_config.py를 확인하세요.")
