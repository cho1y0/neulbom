from flask import Flask, render_template, jsonify, request, Response
from datetime import datetime, timedelta
import pymysql
from flask_cors import CORS
import os
import tempfile
from werkzeug.utils import secure_filename

import json
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor

from analyzer import SpeechAnalyzer
from llm_handler import LLMHandler
from db_handler import VoiceDBHandler

app = Flask(__name__)
CORS(app)

speech_analyzer = None
llm_handler = None
voice_db_handler = None

# 👇 [여기부터] 이 3줄을 꼭 추가해! (Ngrok 로그인 유지용)
app.secret_key = 'bomi_secret_key'             # 암호화 키 (아무거나 써도 됨)
app.config['SESSION_COOKIE_SAMESITE'] = 'None' # 외부(Ngrok)에서도 허용
app.config['SESSION_COOKIE_SECURE'] = True     # HTTPS에서만 작동하도록 설정
# 👆 [여기까지]

# =========================
# 비동기(백그라운드) 처리용 스토어
# =========================
JOB_STORE = {}
JOB_LOCK = threading.Lock()
EXECUTOR = ThreadPoolExecutor(max_workers=2)  # 팀PC 성능에 따라 1~2 권장

FAST_REPLY_TEXT = "네, 어르신. 말씀 잘 들었어요. 잠시만요. 바로 도와드릴게요."


# 데이터베이스 연결 설정
def get_db():
    return pymysql.connect(
        host='192.168.0.31',  # <-- 워크벤치에 넣은 칼리 IP 주소로 수정!
        user='root',
        password='1234',
        db='care_db',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )


@app.route('/')
def index():
    return render_template('index.html')


# [수정됨] 깔끔해진 회원가입 API (HTML에서 한글을 보내주므로 변환 불필요)
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        # 1. 보호자 저장
        sql_guardian = """
            INSERT INTO tb_guardian 
            (user_id, password, name, phone, post_num, addr1, addr2, relation_with_senior, voice_collection_approved, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """
        cursor.execute(sql_guardian, (
            data['guardian']['username'],
            data['guardian']['password'],
            data['guardian']['name'],
            data['guardian']['phone'],
            data['guardian']['zipcode'],
            data['guardian']['address'],
            data['guardian']['addressDetail'],
            data['senior']['relation'],
            'Y'
        ))
        new_guardian_id = cursor.lastrowid

        # 2. 어르신 저장 (생년월일 조립 & 성별 변환)
        sr = data['senior']

        # 생년월일 합치기 (YYYY-MM-DD)
        if 'fullBirthdate' in sr and sr['fullBirthdate']:
            final_birth = sr['fullBirthdate']
        else:
            final_birth = f"{sr.get('birthYear')}-{sr.get('birthMonth').zfill(2)}-{sr.get('birthDay').zfill(2)}"

        # 성별 변환 (영어 -> 한글 DB값)
        final_gender = 'F' if 'female' in sr.get('gender', '') else 'M'

        sql_senior = """
            INSERT INTO tb_senior 
            (name, birthdate, gender, phone, post_num, addr1, addr2, relation_with_guardian, living_type, guardian_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """
        cursor.execute(sql_senior, (
            sr['name'],
            final_birth,
            final_gender,
            sr['phone'],
            sr['zipcode'],
            sr['address'],
            sr['addressDetail'],
            "보호자",
            sr['living'],  # HTML에서 '독거','가족'으로 보내주므로 그대로 저장!
            new_guardian_id
        ))

        conn.commit()
        return jsonify({"message": "가입 성공", "guardian_id": new_guardian_id})

    except Exception as e:
        conn.rollback()
        print(f"❌ 가입 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# [최종 수정] 로그인 API (기기 목록 조회 기능 추가)
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    conn = get_db()
    cursor = conn.cursor()

    try:
        # 1. 보호자 조회
        cursor.execute("SELECT * FROM tb_guardian WHERE user_id = %s AND password = %s", (username, password))
        guardian = cursor.fetchone()

        if not guardian:
            return jsonify({"error": "로그인 실패"}), 401

        # 딕셔너리 변환 (안전장치)
        if not isinstance(guardian, dict):
            g_dict = {
                'guardian_id': guardian[0], 'name': guardian[1], 'phone': guardian[2],
                'post_num': guardian[3], 'addr1': guardian[4], 'addr2': guardian[5], 'user_id': guardian[9]
            }
        else:
            g_dict = guardian

        # 기본 사용자 정보 구성
        user_data = {
            "username": g_dict['user_id'],
            "name": g_dict['name'],
            "phone": g_dict['phone'],
            "zipcode": g_dict['post_num'],
            "address": g_dict['addr1'],
            "addressDetail": g_dict['addr2'],
            "senior": None,
            "devices": []  # 👈 기기 목록 초기화
        }

        # 2. 어르신 조회
        cursor.execute("SELECT * FROM tb_senior WHERE guardian_id = %s", (g_dict['guardian_id'],))
        senior = cursor.fetchone()

        if senior:
            if not isinstance(senior, dict):
                s_dict = {
                    'senior_id': senior[0],  # ID가 0번째라고 가정
                    'name': senior[1], 'birthdate': senior[2], 'gender': senior[3],
                    'phone': senior[4], 'post_num': senior[5], 'addr1': senior[6], 'addr2': senior[7],
                    'living_type': senior[9]
                }
            else:
                s_dict = senior

            # 생년월일 처리
            birth_str = str(s_dict['birthdate'])
            b_year, b_month, b_day = birth_str.split('-')

            user_data["senior"] = {
                "name": s_dict['name'],
                "gender": 'female' if s_dict['gender'] == 'F' else 'male',
                "phone": s_dict['phone'],
                "living": s_dict['living_type'],
                "birthYear": b_year,
                "birthMonth": b_month,
                "birthDay": b_day,
                "zipcode": s_dict['post_num'],
                "address": s_dict['addr1'],
                "addressDetail": s_dict['addr2']
            }

            # ==========================================
            # 🌟 [추가됨] 3. 기기 목록 조회
            # ==========================================
            sql_devices = "SELECT * FROM tb_device WHERE senior_id = %s"
            cursor.execute(sql_devices, (s_dict['senior_id'],))
            devices = cursor.fetchall()

            device_list = []
            for d in devices:
                d_obj = {
                    'id': f"DEV{d['device_id']}",
                    'serial': d['device_uid'],
                    'name': d['device_name'],
                    'location': d['location'],
                    'status': 'online'
                }
                device_list.append(d_obj)

            user_data["devices"] = device_list

        return jsonify(user_data)

    except Exception as e:
        print(f"❌ 로그인 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ==========================================
# 👇 bomi.py 맨 아래에 추가 (활동량 조회 API)
# ==========================================

@app.route('/api/activity-daily', methods=['POST'])
def activity_daily():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql_sensor = """
            SELECT s.sensor_id 
            FROM tb_sensor s
            JOIN tb_device d ON s.device_id = d.device_id
            JOIN tb_senior sn ON d.senior_id = sn.senior_id
            JOIN tb_guardian g ON sn.guardian_id = g.guardian_id
            WHERE g.user_id = %s AND s.sensor_type = 'motion'
            LIMIT 1
        """
        cursor.execute(sql_sensor, (user_id,))
        sensor = cursor.fetchone()

        count = 0
        if sensor:
            sensor_id = sensor['sensor_id'] if isinstance(sensor, dict) else sensor[0]

            sql_count = """
                SELECT COUNT(*) as cnt 
                FROM tb_sensing 
                WHERE sensor_id = %s AND DATE(created_at) = CURDATE()
            """
            cursor.execute(sql_count, (sensor_id,))
            result = cursor.fetchone()
            count = result['cnt'] if isinstance(result, dict) else result[0]

        return jsonify({"count": count})

    except Exception as e:
        print(f"❌ 활동량 조회 에러: {e}")
        return jsonify({"count": 0})
    finally:
        conn.close()


# ==========================================
# 👇 bomi.py 맨 아래에 추가 (데이터 시뮬레이션 API)
# ==========================================

@app.route('/api/simulate-data', methods=['POST'])
def simulate_data():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql_sensor = """
            SELECT s.sensor_id 
            FROM tb_sensor s
            JOIN tb_device d ON s.device_id = d.device_id
            JOIN tb_senior sn ON d.senior_id = sn.senior_id
            JOIN tb_guardian g ON sn.guardian_id = g.guardian_id
            WHERE g.user_id = %s AND s.sensor_type = 'motion'
            LIMIT 1
        """
        cursor.execute(sql_sensor, (user_id,))
        sensor = cursor.fetchone()

        current_count = 0

        if sensor:
            s_id = sensor['sensor_id'] if isinstance(sensor, dict) else sensor[0]

            sql_insert = "INSERT INTO tb_sensing (sensor_id, value, created_at) VALUES (%s, 1, NOW())"
            cursor.execute(sql_insert, (s_id,))
            conn.commit()

            sql_count = "SELECT COUNT(*) as cnt FROM tb_sensing WHERE sensor_id = %s AND DATE(created_at) = CURDATE()"
            cursor.execute(sql_count, (s_id,))
            result = cursor.fetchone()
            current_count = result['cnt'] if isinstance(result, dict) else result[0]

        return jsonify({"count": current_count})

    except Exception as e:
        conn.rollback()
        print(f"❌ 시뮬레이션 에러: {e}")
        return jsonify({"count": 0})
    finally:
        conn.close()


# ==========================================
# 👇 bomi.py 맨 아래에 추가 (주간 활동량 조회 API)
# ==========================================

@app.route('/api/activity-weekly', methods=['POST'])
def activity_weekly():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql_sensor = """
            SELECT s.sensor_id 
            FROM tb_sensor s
            JOIN tb_device d ON s.device_id = d.device_id
            JOIN tb_senior sn ON d.senior_id = sn.senior_id
            JOIN tb_guardian g ON sn.guardian_id = g.guardian_id
            WHERE g.user_id = %s AND s.sensor_type = 'motion'
            LIMIT 1
        """
        cursor.execute(sql_sensor, (user_id,))
        sensor = cursor.fetchone()

        weekly_counts = [0] * 7

        if sensor:
            s_id = sensor['sensor_id'] if isinstance(sensor, dict) else sensor[0]

            today = datetime.now().date()

            for i in range(7):
                target_date = today - timedelta(days=(6 - i))

                sql_count = """
                    SELECT COUNT(*) as cnt 
                    FROM tb_sensing 
                    WHERE sensor_id = %s AND DATE(created_at) = %s
                """
                cursor.execute(sql_count, (s_id, target_date))
                result = cursor.fetchone()
                count = result['cnt'] if isinstance(result, dict) else result[0]

                weekly_counts[i] = count

        return jsonify({"data": weekly_counts})

    except Exception as e:
        print(f"❌ 주간 활동량 에러: {e}")
        return jsonify({"data": [0] * 7})
    finally:
        conn.close()


# ==========================================
# 👇 bomi.py 맨 아래에 추가 (월간 활동량 조회 API)
# ==========================================

@app.route('/api/activity-monthly', methods=['POST'])
def activity_monthly():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql_sensor = """
            SELECT s.sensor_id 
            FROM tb_sensor s
            JOIN tb_device d ON s.device_id = d.device_id
            JOIN tb_senior sn ON d.senior_id = sn.senior_id
            JOIN tb_guardian g ON sn.guardian_id = g.guardian_id
            WHERE g.user_id = %s AND s.sensor_type = 'motion'
            LIMIT 1
        """
        cursor.execute(sql_sensor, (user_id,))
        sensor = cursor.fetchone()

        monthly_counts = [0] * 4

        if sensor:
            s_id = sensor['sensor_id'] if isinstance(sensor, dict) else sensor[0]
            today = datetime.now().date()

            for i in range(4):
                end_date = today - timedelta(days=(i * 7))
                start_date = end_date - timedelta(days=6)

                sql_count = """
                    SELECT COUNT(*) as cnt 
                    FROM tb_sensing 
                    WHERE sensor_id = %s 
                    AND DATE(created_at) BETWEEN %s AND %s
                """
                cursor.execute(sql_count, (s_id, start_date, end_date))
                result = cursor.fetchone()
                count = result['cnt'] if isinstance(result, dict) else result[0]

                monthly_counts[3 - i] = count

        return jsonify({"data": monthly_counts})

    except Exception as e:
        print(f"❌ 월간 활동량 에러: {e}")
        return jsonify({"data": [0] * 4})
    finally:
        conn.close()


# ==========================================
# 👇 bomi.py 맨 아래에 추가 (정보 수정 API)
# ==========================================

@app.route('/api/update-guardian', methods=['POST'])
def update_guardian():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql = """
            UPDATE tb_guardian 
            SET phone = %s, post_num = %s, addr1 = %s, addr2 = %s
            WHERE user_id = %s
        """
        cursor.execute(sql, (
            data['phone'],
            data['zipcode'],
            data['address'],
            data['addressDetail'],
            user_id
        ))
        conn.commit()
        return jsonify({"message": "보호자 정보 수정 성공"})

    except Exception as e:
        conn.rollback()
        print(f"❌ 보호자 수정 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/update-senior', methods=['POST'])
def update_senior():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT guardian_id FROM tb_guardian WHERE user_id = %s", (user_id,))
        guardian = cursor.fetchone()

        if not guardian:
            return jsonify({"error": "보호자 정보를 찾을 수 없습니다."}), 404

        g_id = guardian['guardian_id'] if isinstance(guardian, dict) else guardian[0]

        sql = """
            UPDATE tb_senior 
            SET phone = %s, post_num = %s, addr1 = %s, addr2 = %s
            WHERE guardian_id = %s
        """
        cursor.execute(sql, (
            data['phone'],
            data['zipcode'],
            data['address'],
            data['addressDetail'],
            g_id
        ))
        conn.commit()
        return jsonify({"message": "어르신 정보 수정 성공"})

    except Exception as e:
        conn.rollback()
        print(f"❌ 어르신 수정 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/change-password', methods=['POST'])
def change_password():
    data = request.get_json()
    user_id = data.get('username')
    current_pw = data.get('currentPassword')
    new_pw = data.get('newPassword')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql_check = "SELECT * FROM tb_guardian WHERE user_id = %s AND password = %s"
        cursor.execute(sql_check, (user_id, current_pw))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "현재 비밀번호가 일치하지 않습니다."}), 400

        sql_update = "UPDATE tb_guardian SET password = %s WHERE user_id = %s"
        cursor.execute(sql_update, (new_pw, user_id))
        conn.commit()

        print(f"🔐 비밀번호 변경 완료: {user_id}")
        return jsonify({"message": "비밀번호 변경 성공"})

    except Exception as e:
        conn.rollback()
        print(f"❌ 비밀번호 변경 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# [최종 수정] 기기 추가 API (내 어르신 찾아서 등록)
@app.route('/api/add-device', methods=['POST'])
def add_device():
    data = request.get_json()

    serial = data.get('serial')
    name = data.get('name')
    location = data.get('location')
    user_id = data.get('username')

    conn = get_db()
    if not conn:
        return jsonify({"error": "DB 연결 실패"}), 500

    try:
        cursor = conn.cursor()

        sql_find_guardian = "SELECT guardian_id FROM tb_guardian WHERE user_id = %s"
        cursor.execute(sql_find_guardian, (user_id,))
        guardian_result = cursor.fetchone()

        if not guardian_result:
            return jsonify({"error": "사용자 정보를 찾을 수 없습니다."}), 404

        g_id = guardian_result['guardian_id']

        sql_find_senior = "SELECT senior_id FROM tb_senior WHERE guardian_id = %s"
        cursor.execute(sql_find_senior, (g_id,))
        senior_result = cursor.fetchone()

        if not senior_result:
            return jsonify({"error": "등록된 어르신이 없습니다."}), 404

        s_id = senior_result['senior_id']

        sql_device = """
            INSERT INTO tb_device (device_uid, device_name, location, senior_id, installed_at)
            VALUES (%s, %s, %s, %s, NOW())
        """
        cursor.execute(sql_device, (serial, name, location, s_id))

        new_device_id = cursor.lastrowid

        sensor_type = 'env' if '환경' in name else 'motion'
        sql_sensor = """
            INSERT INTO tb_sensor (device_id, sensor_type, created_at)
            VALUES (%s, %s, NOW())
        """
        cursor.execute(sql_sensor, (new_device_id, sensor_type))

        conn.commit()
        print(f"✅ 기기 등록 완료: {name} (ID: {new_device_id}) -> 어르신 {s_id}번")

        return jsonify({"message": "등록 성공", "device_id": new_device_id})

    except Exception as e:
        conn.rollback()
        print(f"❌ 기기 등록 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# [최종 수정] 실시간 알림 확인 (읽음 처리 로직 삭제!)
@app.route('/api/check-alert')
def check_alert():
    conn = get_db()
    if not conn:
        return jsonify({"error": "DB 연결 실패"}), 500

    try:
        cursor = conn.cursor()
        sql = """
            SELECT alert_id, alert_type, alert_content, sented_at 
            FROM tb_alert 
            WHERE received_yes = 0 
            ORDER BY sented_at DESC 
            LIMIT 1
        """
        cursor.execute(sql)
        alert = cursor.fetchone()

        if alert:
            if isinstance(alert['sented_at'], datetime):
                alert['sented_at'] = alert['sented_at'].strftime('%Y-%m-%d %H:%M:%S')
            return jsonify(alert)

        return jsonify(None)

    except Exception as e:
        print(f"그라파나 연동 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/alert-list', methods=['POST'])
def get_alert_list():
    conn = get_db()
    cursor = conn.cursor()

    try:
        sql = """
            SELECT alert_id, alert_type, alert_content, sented_at, received_yes 
            FROM tb_alert 
            ORDER BY sented_at DESC 
            LIMIT 10
        """
        cursor.execute(sql)
        alerts = cursor.fetchall()

        for a in alerts:
            if isinstance(a['sented_at'], datetime):
                a['sented_at'] = a['sented_at'].strftime('%Y-%m-%d %H:%M:%S')

        return jsonify(alerts)

    except Exception as e:
        print(f"❌ 알림 목록 조회 에러: {e}")
        return jsonify([])
    finally:
        conn.close()


@app.route('/api/alert-read-all', methods=['POST'])
def mark_all_read():
    conn = get_db()
    cursor = conn.cursor()

    try:
        sql = "UPDATE tb_alert SET received_yes = 1"
        cursor.execute(sql)
        conn.commit()

        return jsonify({"message": "모든 알림 읽음 처리 완료"})

    except Exception as e:
        conn.rollback()
        print(f"❌ 전체 읽음 처리 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/check-duplicate', methods=['POST'])
def check_duplicate():
    data = request.get_json()
    user_id = data.get('username')

    conn = get_db()
    cursor = conn.cursor()

    try:
        sql = "SELECT count(*) as count FROM tb_guardian WHERE user_id = %s"
        cursor.execute(sql, (user_id,))
        result = cursor.fetchone()

        if result['count'] > 0:
            return jsonify({"isDuplicate": True})
        else:
            return jsonify({"isDuplicate": False})

    except Exception as e:
        print(f"중복 확인 에러: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ========================================
# 서버 시작 시 모델 로드 (Flask용)
# ========================================
def initialize_voice_models():
    global speech_analyzer, llm_handler, voice_db_handler

    print("\n" + "=" * 60)
    print("🎤 음성 분석 모델 로딩 중...")
    print("=" * 60)

    # 1. 음성 분석기
    try:
        print("\n[1/3] SpeechAnalyzer 로드 중... (2-3분 소요)")
        speech_analyzer = SpeechAnalyzer()
        print("✅ SpeechAnalyzer 로드 완료!")
    except Exception as e:
        print(f"⚠️ SpeechAnalyzer 로드 실패: {e}")
        speech_analyzer = None

    # 2. LLM 핸들러
    try:
        print("\n[2/3] LLMHandler 로드 중...")
        llm_handler = LLMHandler()
        print("✅ LLMHandler 로드 완료!")
    except Exception as e:
        print(f"⚠️ LLMHandler 로드 실패: {e}")
        llm_handler = None

    # 3. DB 핸들러
    try:
        print("\n[3/3] VoiceDBHandler 초기화 중...")
        voice_db_handler = VoiceDBHandler()
        if voice_db_handler.connect():
            print("✅ VoiceDBHandler 초기화 완료!")
        else:
            print("⚠️ DB 연결 실패")
            voice_db_handler = None
    except Exception as e:
        print(f"⚠️ VoiceDBHandler 초기화 실패: {e}")
        voice_db_handler = None

    print("\n" + "=" * 60)
    print("✅ 음성 분석 모델 준비 완료!")
    print("=" * 60 + "\n")


# ========================================
# ✅ 비동기 백그라운드 작업(핵심)
# ========================================
def _safe_update_job(job_id: str, patch: dict):
    with JOB_LOCK:
        if job_id in JOB_STORE:
            JOB_STORE[job_id].update(patch)


def _process_audio_job(job_id: str, tmp_path: str, senior_id: int, sensing_id: int, generate_response_flag: bool):
    """
    백그라운드에서 STT/감정/LLM/DB 저장을 수행하고 JOB_STORE에 결과를 저장합니다.
    """
    try:
        _safe_update_job(job_id, {"stage": "analyzing", "message": "STT 및 감정 분석 중..."})

        # 1) 음성 분석
        if not speech_analyzer:
            raise RuntimeError("speech_analyzer is not initialized")

        analysis_result = speech_analyzer.analyze(tmp_path)

        whisper = analysis_result['features']['whisper']
        emotion = analysis_result['features']['emotion']
        scores = analysis_result['scores']

        _safe_update_job(job_id, {
            "stage": "analyzed",
            "message": "분석 완료, 응답 생성 중...",
            "analysis_preview": {
                "text": whisper.get('text', '')[:80],
                "emotion": emotion.get('final_emotion'),
                "score": scores.get('average')
            }
        })

        # 2) LLM 응답(가장 느린 구간)
        ai_response = None
        if generate_response_flag and llm_handler:
            _safe_update_job(job_id, {"stage": "llm", "message": "AI 답변 생성 중..."})
            try:
                ai_response = llm_handler.chat(
                    whisper['text'],
                    emotion_info=emotion,
                    scores=scores
                )
            except Exception as e:
                ai_response = "죄송해요, 지금은 답변을 만들 수 없어요. 다시 말씀해주시겠어요?"
                _safe_update_job(job_id, {"warning": f"LLM 생성 실패: {e}"})

        # 3) DB 저장
        voice_id = None
        if voice_db_handler:
            _safe_update_job(job_id, {"stage": "db", "message": "DB 저장 중..."})
            try:
                voice_id = voice_db_handler.save_analysis(
                    senior_id,
                    analysis_result,
                    sensing_id
                )
            except Exception as e:
                _safe_update_job(job_id, {"warning": f"DB 저장 실패: {e}"})

        # 4) 결과 저장
        result = {
            "done": True,
            "stage": "complete",
            "success": True,
            "voice_id": voice_id,
            "analysis": {
                "text": whisper['text'],
                "emotion": {
                    "final": emotion['final_emotion'],
                    "confidence": emotion['final_conf'],
                    "text_emotion": emotion.get('text_emotion'),
                    "audio_emotion": emotion.get('audio_emotion'),
                    "z_peak": emotion.get('z_peak'),
                    "decision": emotion.get('decision')
                },
                "scores": scores,
                "whisper": {
                    "word_count": whisper.get('word_count'),
                    "wpm": whisper.get('wpm'),
                    "duration": whisper.get('duration'),
                    "response_time": whisper.get('response_time')
                }
            },
            "ai_response": ai_response,
            "metadata": {
                "senior_id": senior_id,
                "sensing_id": sensing_id,
                "timestamp": datetime.now().isoformat()
            }
        }

        _safe_update_job(job_id, result)

    except Exception as e:
        _safe_update_job(job_id, {
            "done": True,
            "stage": "error",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
    finally:
        # 임시 파일 정리
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


# ========================================
# ✅ (신규) 비동기 analyze: 즉시 응답 + job_id
# ========================================
@app.route('/api/analyze', methods=['POST'])
def analyze_voice_async():
    """
    [새 기본값] 즉시 응답(5초 이내 체감)용 엔드포인트
    - 업로드 즉시 fast_reply + job_id 반환
    - 실제 분석/LLM/DB 저장은 백그라운드에서 수행
    - 결과는 /api/result/<job_id>로 조회
    """

    # 1) 모델 체크
    if not speech_analyzer:
        return jsonify({'error': '음성 분석기가 초기화되지 않았습니다'}), 503

    # 2) 파일 체크
    if 'audio_file' not in request.files:
        return jsonify({'error': '음성 파일이 없습니다'}), 400

    audio_file = request.files['audio_file']
    if audio_file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다'}), 400

    # 3) 파라미터
    senior_id = int(request.form.get('senior_id', 1))
    sensing_id = request.form.get('sensing_id', None)
    generate_response_flag = request.form.get('generate_response', 'true').lower() == 'true'

    if not sensing_id:
        return jsonify({
            'error': 'sensing_id가 필요합니다. /api/create-voice-session을 먼저 호출하세요.'
        }), 400

    save_sensing_id = int(sensing_id)

    # 4) 임시 파일 저장
    try:
        filename = secure_filename(audio_file.filename)
        suffix = os.path.splitext(filename)[1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            audio_file.save(tmp_file)
            tmp_path = tmp_file.name

    except Exception as e:
        return jsonify({'error': f'파일 저장 실패: {str(e)}'}), 500

    # 5) Job 생성 + 백그라운드 등록
    job_id = uuid.uuid4().hex

    with JOB_LOCK:
        JOB_STORE[job_id] = {
            "done": False,
            "stage": "queued",
            "message": "작업 대기 중",
            "ai_response_fast": FAST_REPLY_TEXT,
            "created_at": datetime.now().isoformat()
        }

    EXECUTOR.submit(_process_audio_job, job_id, tmp_path, senior_id, save_sensing_id, generate_response_flag)

    # ✅ 여기서 즉시 응답
    return jsonify({
        "done": False,
        "job_id": job_id,
        "ai_response": FAST_REPLY_TEXT,
        "message": "요청 접수 완료. 결과는 /api/result/<job_id>에서 확인하세요.",
        "timestamp": datetime.now().isoformat()
    })


# ========================================
# ✅ (신규) 결과 조회 엔드포인트
# ========================================
@app.route('/api/result/<job_id>', methods=['GET'])
def get_result(job_id: str):
    with JOB_LOCK:
        data = JOB_STORE.get(job_id)

    if not data:
        return jsonify({"done": True, "success": False, "error": "job_id 없음"}), 404

    return jsonify(data)


# ========================================
# ✅ (유지) 기존 SSE 방식은 별도 엔드포인트로 보존
# ========================================
@app.route('/api/analyze_sse', methods=['POST'])
def analyze_voice_sse():
    """
    [기존 방식 유지] SSE Stream: 진행 상황 + 최종 결과를 한 번에 스트리밍
    (기존 프론트가 SSE에 의존하면 이 엔드포인트를 계속 사용할 수 있습니다.)
    """

    if not speech_analyzer:
        return jsonify({'error': '음성 분석기가 초기화되지 않았습니다'}), 503

    if 'audio_file' not in request.files:
        return jsonify({'error': '음성 파일이 없습니다'}), 400

    audio_file = request.files['audio_file']
    if audio_file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다'}), 400

    senior_id = int(request.form.get('senior_id', 1))
    sensing_id = request.form.get('sensing_id', None)
    generate_response_flag = request.form.get('generate_response', 'true').lower() == 'true'

    if not sensing_id:
        return jsonify({
            'error': 'sensing_id가 필요합니다. /api/create-voice-session을 먼저 호출하세요.'
        }), 400

    save_sensing_id = int(sensing_id)

    try:
        filename = secure_filename(audio_file.filename)
        suffix = os.path.splitext(filename)[1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            audio_file.save(tmp_file)
            tmp_path = tmp_file.name

    except Exception as e:
        return jsonify({'error': f'파일 저장 실패: {str(e)}'}), 500

    def generate():
        try:
            yield f"data: {json.dumps({'step': 1, 'message': '파일 저장 완료'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'step': 2, 'message': 'STT 음성 인식 중...'}, ensure_ascii=False)}\n\n"

            analysis_result = speech_analyzer.analyze(tmp_path)

            whisper = analysis_result['features']['whisper']
            emotion = analysis_result['features']['emotion']
            scores = analysis_result['scores']

            yield f"data: {json.dumps({'step': 3, 'message': 'STT 완료', 'text_preview': whisper['text'][:50]}, ensure_ascii=False)}\n\n"

            emotion_msg = f"{emotion['final_emotion']} ({emotion['final_conf']*100:.0f}%)"
            yield f"data: {json.dumps({'step': 4, 'message': f'감정 분석: {emotion_msg}'}, ensure_ascii=False)}\n\n"

            ai_response = None
            if generate_response_flag and llm_handler:
                yield f"data: {json.dumps({'step': 5, 'message': 'AI 응답 생성 중...'}, ensure_ascii=False)}\n\n"
                try:
                    ai_response = llm_handler.chat(
                        whisper['text'],
                        emotion_info=emotion,
                        scores=scores
                    )
                except Exception:
                    ai_response = "죄송해요, 지금은 답변을 만들 수 없어요. 다시 말씀해주시겠어요?"

            yield f"data: {json.dumps({'step': 6, 'message': 'DB 저장 중...'}, ensure_ascii=False)}\n\n"

            voice_id = None
            if voice_db_handler:
                try:
                    voice_id = voice_db_handler.save_analysis(
                        senior_id,
                        analysis_result,
                        save_sensing_id
                    )
                except Exception:
                    pass

            try:
                os.remove(tmp_path)
            except Exception:
                pass

            result = {
                'step': 'complete',
                'success': True,
                'voice_id': voice_id,
                'analysis': {
                    'text': whisper['text'],
                    'emotion': {
                        'final': emotion['final_emotion'],
                        'confidence': emotion['final_conf'],
                        'text_emotion': emotion.get('text_emotion'),
                        'audio_emotion': emotion.get('audio_emotion'),
                        'z_peak': emotion.get('z_peak'),
                        'decision': emotion.get('decision')
                    },
                    'scores': scores,
                    'whisper': {
                        'word_count': whisper.get('word_count'),
                        'wpm': whisper.get('wpm'),
                        'duration': whisper.get('duration'),
                        'response_time': whisper.get('response_time')
                    }
                },
                'ai_response': ai_response,
                'metadata': {
                    'senior_id': senior_id,
                    'sensing_id': save_sensing_id if voice_db_handler else None,
                    'timestamp': datetime.now().isoformat()
                }
            }

            yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"

        except Exception as e:
            error_result = {'step': 'error', 'error': str(e), 'error_type': type(e).__name__}
            yield f"data: {json.dumps(error_result, ensure_ascii=False)}\n\n"

            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


# ========================================
# 서버 상태 확인 엔드포인트
# ========================================
@app.route('/api/voice-health', methods=['GET'])
def voice_health():
    return jsonify({
        'analyzer': speech_analyzer is not None,
        'llm': llm_handler is not None,
        'db': voice_db_handler is not None,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/check-sensor', methods=['GET', 'POST'])
def check_sensor():
    if request.method == 'POST':
        data = request.get_json()
        user_id = data.get('username')
    else:
        user_id = request.args.get('username')

    if not user_id:
        return jsonify({"has_sensor": False, "message": "사용자 아이디가 필요합니다"}), 400

    conn = get_db()
    if not conn:
        return jsonify({"has_sensor": False, "message": "DB 연결 실패"}), 500

    try:
        cursor = conn.cursor()

        sql = """
            SELECT 
                s.sensor_id, 
                s.sensor_type,
                d.device_id,
                d.device_name,
                d.location
            FROM tb_sensor s
            JOIN tb_device d ON s.device_id = d.device_id
            JOIN tb_senior sn ON d.senior_id = sn.senior_id
            JOIN tb_guardian g ON sn.guardian_id = g.guardian_id
            WHERE g.user_id = %s
            ORDER BY s.created_at DESC
            LIMIT 1
        """

        cursor.execute(sql, (user_id,))
        result = cursor.fetchone()

        if result:
            return jsonify({
                "has_sensor": True,
                "sensor_id": result['sensor_id'],
                "sensor_type": result['sensor_type'],
                "device_id": result['device_id'],
                "device_name": result['device_name'],
                "location": result['location'],
                "message": f"센서 사용 가능 ({result['device_name']})"
            })
        else:
            return jsonify({"has_sensor": False, "message": "등록된 센서가 없습니다. 센서를 먼저 등록해주세요."})

    except Exception as e:
        print(f"❌ 센서 확인 실패: {e}")
        return jsonify({"has_sensor": False, "error": str(e)}), 500

    finally:
        conn.close()


@app.route('/api/create-voice-session', methods=['POST'])
def create_voice_session():
    data = request.get_json()
    user_id = data.get('username')

    if not user_id:
        return jsonify({"success": False, "message": "사용자 아이디가 필요합니다"}), 400

    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "DB 연결 실패"}), 500

    try:
        cursor = conn.cursor()

        find_sensor_sql = """
            SELECT s.sensor_id, s.sensor_type, d.device_name
            FROM tb_sensor s
            JOIN tb_device d ON s.device_id = d.device_id
            JOIN tb_senior sn ON d.senior_id = sn.senior_id
            JOIN tb_guardian g ON sn.guardian_id = g.guardian_id
            WHERE g.user_id = %s
            ORDER BY s.created_at DESC
            LIMIT 1
        """

        cursor.execute(find_sensor_sql, (user_id,))
        sensor_result = cursor.fetchone()

        if not sensor_result:
            return jsonify({"success": False, "message": "센서를 찾을 수 없습니다. 센서를 먼저 등록해주세요."}), 404

        sensor_id = sensor_result['sensor_id']
        sensor_type = sensor_result['sensor_type']
        device_name = sensor_result['device_name']

        create_sensing_sql = """
            INSERT INTO tb_sensing 
            (sensor_id, sensing_type, sensing_value) 
            VALUES (%s, 'voice_session', 'recording_start')
        """

        cursor.execute(create_sensing_sql, (sensor_id,))
        conn.commit()

        sensing_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "sensing_id": sensing_id,
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "device_name": device_name,
            "message": "음성 세션이 시작되었습니다"
        })

    except Exception as e:
        conn.rollback()
        print(f"❌ 음성 세션 생성 실패: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        conn.close()


# 인증서 추가 할려면?(pyopenssl 라이브러리 필요):
# python generate_cert.py
if __name__ == '__main__':
    initialize_voice_models()
    app.run(debug=True, host='0.0.0.0', port=5000)
