"""
MySQL DB 핸들러 (서버용)
sensing_id=None → 0 처리
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
            sensing_id: 센싱 ID (없으면 None → 0)
        
        Returns:
            voice_id: 성공 시 저장된 voice_id
            None: 실패 시
        """
        if not self.connection:
            print("❌ DB 연결이 없습니다!")
            return None
        
        try:
            # ========== sensing_id 처리 ==========
            # None이면 0으로 변환!
            if sensing_id is None:
                sensing_id = 0
            # ====================================
            
            # 데이터 추출
            whisper = analysis_result['features']['whisper']
            emotion = analysis_result['features']['emotion']
            
            # tb_voice_log에 저장
            voice_sql = """
                INSERT INTO tb_voice_log 
                (senior_id, sensing_id, voice_text, response_time_sec, utterance_length)
                VALUES (%s, %s, %s, %s, %s)
            """
            
            self.cursor.execute(voice_sql, (
                senior_id,
                sensing_id,  # 0 또는 실제 값
                whisper['text'],
                round(whisper['response_time'], 1),
                round(whisper['duration'], 1)
            ))
            
            voice_id = self.cursor.lastrowid
            
            # tb_analysis에 저장
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
                None,
                candidates.get('happy', 0.0),
                candidates.get('sad', 0.0),
                candidates.get('neutral', 0.0),
                candidates.get('angry', 0.0),
                candidates.get('anxious', 0.0),
                candidates.get('embarrassed', 0.0),
                candidates.get('heartache', 0.0)
            ))
            
            self.connection.commit()
            
            return voice_id
            
        except Exception as e:
            print(f"\n❌ DB 저장 실패: {e}")
            self.connection.rollback()
            return None
    
    def get_recent_analyses(self, senior_id, limit=10):
        """최근 분석 결과 조회"""
        if not self.connection:
            return []
        
        try:
            sql = """
                SELECT 
                    v.voice_id,
                    v.voice_text,
                    v.created_at,
                    v.sensing_id,
                    a.emotion_label
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
