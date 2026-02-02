"""
DB 연결 설정
"""

# MySQL 연결 정보
DB_CONFIG = {
    'host': '192.168.0.31',         # DB 서버 주소
    'port': 3306,                   # 포트
    'user': 'root',                 # 사용자명
    'password': '1234',             # 비밀번호 (수정 필요!)
    'database': 'care_db',   # DB 이름 (수정 필요!)
    'charset': 'utf8mb4'
}

# 시니어 ID (임시 - 나중에 로그인 시스템과 연동)
DEFAULT_SENIOR_ID = 1

# 센싱 ID (임시 - 나중에 센서와 연동)
DEFAULT_SENSING_ID = 1
