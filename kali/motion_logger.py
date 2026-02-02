import sys
import pymysql
import datetime
import time
import os

# 중복 실행 방지용 파일
LAST_RUN_FILE = "/tmp/motion_last_run"
COOL_DOWN = 5.0  # 로그를 찍을 최소 간격 (초 단위)

# 1. 중복 실행 체크
current_time = time.time()
if os.path.exists(LAST_RUN_FILE):
    with open(LAST_RUN_FILE, "r") as f:
        try:
            last_run = float(f.read())
            if current_time - last_run < COOL_DOWN:
                sys.exit()
        except ValueError:
            pass

with open(LAST_RUN_FILE, "w") as f:
    f.write(str(current_time))

# Motion에서 전달받은 픽셀 변화량
try:
    pixel_change = int(sys.argv[1])
except:
    pixel_change = 0

# 상태 판별 문구
if pixel_change >= 20000:
    sensing_val = "2"
    status_label = "🚨 긴급 상황"
    msg = "급격한 움직임 감지!"
elif pixel_change >= 4000:
    sensing_val = "1"
    status_label = "🏃 활동 중"
    msg = "어르신 움직임 포착"
else:
    sensing_val = "0"
    status_label = "✅ 안정 상태"
    msg = "평온한 상태입니다."

try:
    # 2. DB 연결
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

    # 3. 센싱 데이터 저장
    sql = "INSERT INTO tb_sensing (sensor_id, sensing_type, sensing_value, created_at) VALUES (%s, %s, %s, NOW())"
    cursor.execute(sql, (14, 'motion', sensing_val))
    
    # 4. 긴급 상황(2) 발생 시 알람 저장 (sent_at -> sented_at 수정 완료)
    if sensing_val == "2":
        alert_sql = "INSERT INTO tb_alert (guardian_id, alert_type, alert_content, alert_channel, sented_at, received_yes) VALUES (8, 'Emergency', '🚨 긴급 상황: 급격한 움직임 발생!', 'WEB', NOW(), 0)"
        cursor.execute(alert_sql)
        print(f">>> [경보] {status_label} 데이터가 DB에 기록되었습니다!")

    # 5. 미동 시간 계산 (현재 상태 출력용)
    check_sql = "SELECT TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) FROM tb_sensing WHERE sensing_value >= '1'"
    cursor.execute(check_sql)
    result = cursor.fetchone()
    diff = result[0] if result and result[0] is not None else 0

    # 터미널 한글 로그 출력
    print(f"[{status_label}] {msg} (변화량: {pixel_change}) | 미동 지속: {diff}초")

    conn.close()

except Exception as e:
    print(f"파이썬 오류 발생: {e}")