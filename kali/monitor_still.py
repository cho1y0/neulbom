import pymysql
import time
import os

def monitor():
    print("========================================")
    print("   👴 어르신 미동 감시 시스템 가동 중   ")
    print("        (60초 움직임 없을 시 알람)      ")
    print("========================================")

    alert_sent_this_event = False  # 알람 발송 여부 체크용 변수

    while True:
        try:
            conn = pymysql.connect(
                host='localhost',
                user='root',
                password='1234',
                db='care_db',
                charset='utf8mb4',
                autocommit=True
            )
            cursor = conn.cursor()
            cursor.execute("SET time_zone = '+09:00';")

            # 1. 마지막 활동 확인
            check_sql = """
                SELECT TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) 
                FROM tb_sensing 
                WHERE sensing_value >= '1'
            """
            cursor.execute(check_sql)
            result = cursor.fetchone()
            diff = result[0] if result and result[0] is not None else 0

            # 2. 상태별 터미널 출력 로직
            if diff < 60:
                # 움직임이 감지되어 초가 초기화되면 변수도 초기화
                alert_sent_this_event = False 
                print(f"[정상] 현재 미동 없음 시간: {diff}초...    ", end="\r")
            
            else:
                # 60초 도달 시점에 딱 한 번만 DB 저장 및 로그 출력
                if not alert_sent_this_event:
                    # 중복 방지 체크 (DB 기준)
                    cursor.execute("""
                        SELECT COUNT(*) FROM tb_alert 
                        WHERE alert_type = 'No Movement' 
                        AND sented_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                    """)
                    
                    if cursor.fetchone()[0] == 0:
                        alert_sql = """
                            INSERT INTO tb_alert 
                            (guardian_id, alert_type, alert_content, alert_channel, sented_at, received_yes) 
                            VALUES (8, 'No Movement', '⚠️ 60초 이상 미동 없음 (확인 요망)', 'WEB', NOW(), 0)
                        """
                        cursor.execute(alert_sql)
                        print(f"\n>>> [알림 발생] 60초 경과! DB에 '미동 없음' 기록 완료. (웹 팝업 대기 중)")
                    
                    alert_sent_this_event = True  # 이번 미동 이벤트에서는 더 이상 저장/출력 안 함
                
                # 60초 이후에는 터미널에서 초만 조용히 업데이트
                print(f"🚨 [경보 상태] 미동 없음 지속 중: {diff}초...      ", end="\r")

            conn.close()
            
        except Exception as e:
            print(f"\n오류 발생: {e}")
        
        time.sleep(1)

if __name__ == "__main__":
    monitor()
