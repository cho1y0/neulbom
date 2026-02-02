/**
 * ========================================
 * 늘봄 AI - 메인 스크립트
 * ========================================
 * 
 * 목차:
 * 1. 전역 변수 및 데이터
 * 2. 초기화 함수
 * 3. 페이지 네비게이션
 * 4. 로그인/로그아웃
 * 5. 회원가입 프로세스
 * 6. 입력 검증 (Validation)
 * 7. 개인정보 마스킹 함수
 * 8. 주소 검색 (Daum API)
 * 9. 약관 처리
 * 10. 기기 등록
 * 11. 대시보드 기능
 * 12. 리포트 기능 (주간/월간 필터링)
 * 13. 차트 초기화 및 업데이트
 * 14. 마이페이지 기능
 * 15. 알림 기능
 * 16. 모달 처리
 * 17. 토스트 알림
 * 18. 보미 AI 비서
 * 19. 유틸리티 함수
 */

// ========================================
// 1. 전역 변수 및 데이터
// ========================================

let isAbnormalAlertOn = true;
let isEmergencyAlertOn = true;

// 현재 로그인된 사용자 정보
let currentUser = null;

// 회원가입 중복확인 상태
let isUsernameChecked = false;

// 회원가입 시 등록할 기기 목록
let registeredDevices = [];

// 현재 회원가입 진행 중인지 여부 (시스템 메시지 조건문용)
let isSignupInProgress = false;

// 테스트 계정 데이터 (화면에 표시하지 않음)
const TEST_ACCOUNT = {
    username: 'neulbom2024',
    password: 'Neulbom@123',
    name: '김보미',
    phone: '010-1234-5678',
    zipcode: '06234',
    address: '서울특별시 강남구 테헤란로 152',
    addressDetail: '강남파이낸스센터 10층',
    senior: {
        name: '김영순',
        birthYear: '1945',
        birthMonth: '3',
        birthDay: '15',
        gender: 'female',
        living: 'alone',
        phone: '010-9876-5432',
        relation: 'parent',
        zipcode: '06754',
        address: '서울특별시 서초구 서초대로 398',
        addressDetail: '플래티넘타워 201호',
        notes: '고혈압 약 복용 중, 무릎 관절 주의'
    },
    devices: [
        { id: 'DEV001', serial: 'NB-ENV-2024-001', name: '거실 환경센서', location: 'living', status: 'online' },
        { id: 'DEV002', serial: 'NB-MOT-2024-002', name: '침실 모션센서', location: 'bedroom', status: 'online' }
    ]
};

// 알림 데이터
let DUMMY_NOTIFICATIONS = [
    { id: 1, type: 'info', title: '활동량 정상', message: '오늘 활동량이 정상 범위입니다. 3,240걸음을 기록했습니다.', time: '36분 전', read: false },
    { id: 2, type: 'warning', title: '수분 섭취 권장', message: '오늘 수분 섭취량이 부족합니다. 물을 마시도록 권해주세요.', time: '1시간 전', read: false },
    { id: 3, type: 'info', title: '수면 분석 완료', message: '어젯밤 7.5시간 수면하셨습니다. 수면의 질이 양호합니다.', time: '3시간 전', read: true },
    { id: 4, type: 'danger', title: '낙상 위험 감지', message: '어제 오후 2시경 거실에서 비틀거림이 감지되었습니다.', time: '어제', read: true },
    { id: 5, type: 'warning', title: '실내 온도 주의', message: '현재 실내 온도가 28°C입니다. 에어컨 사용을 권장합니다.', time: '어제', read: true }
];

// 주의/위험 이력 데이터
const DUMMY_HISTORY = [
    { id: 1, type: 'warning', title: '장시간 무활동 감지', description: '거실에서 45분간 움직임이 없었습니다.', time: '2024-01-20 14:30', resolved: true },
    { id: 2, type: 'danger', title: '낙상 위험 감지', description: '침실에서 비틀거림이 감지되었습니다. 확인 필요.', time: '2024-01-19 09:15', resolved: true },
    { id: 3, type: 'warning', title: '수면 패턴 이상', description: '최근 3일간 평균 수면시간이 5시간 미만입니다.', time: '2024-01-18 08:00', resolved: false },
    { id: 4, type: 'danger', title: '응급 버튼 작동', description: '어르신이 응급 버튼을 눌렀습니다. 즉시 확인하세요.', time: '2024-01-15 16:45', resolved: true },
    { id: 5, type: 'warning', title: '실내 온도 이상', description: '실내 온도가 30°C를 초과했습니다.', time: '2024-01-14 13:20', resolved: true }
];

// 👇 [수정] 실제 사용하는 변수는 'let'으로 선언하고 더미 데이터를 복사해서 넣습니다.
let notifications = [...DUMMY_NOTIFICATIONS];
let alertHistory = [...DUMMY_HISTORY];


// 차트 인스턴스 저장
let charts = {};

// 리포트 데이터 (주간/월간)
const reportData = {
    weekly: {
        labels: ['월', '화', '수', '목', '금', '토', '일'],
        activity: [2800, 3240, 2950, 3100, 2700, 3500, 3200],
        sleep: [7.2, 7.5, 6.8, 7.0, 7.3, 8.0, 7.5],
        emotion: [75, 80, 72, 78, 85, 82, 88],
        emotionDetail: {
            joy: [70, 72, 65, 68, 78, 74, 80],
            anger: [6, 5, 8, 6, 4, 5, 3],
            sadness: [10, 9, 12, 11, 8, 9, 7],
            anxiety: [8, 7, 9, 8, 6, 7, 5],
            hurt: [4, 4, 3, 4, 3, 3, 3],
            embarrassed: [2, 3, 3, 3, 1, 2, 2]
        },
        cognitive: [45, 50, 40, 55, 48, 60, 52],
        temperature: [24, 24.5, 25, 24.2, 23.8, 24, 24.5],
        humidity: [45, 48, 50, 47, 44, 46, 45]
    },
    monthly: {
        labels: ['1주', '2주', '3주', '4주'],
        activity: [21000, 22500, 20800, 23100],
        sleep: [7.5, 6.2, 8.0, 5.3],
        emotion: [76, 79, 82, 85],
        emotionDetail: {
            joy: [68, 70, 72, 74],
            anger: [6, 5, 5, 4],
            sadness: [12, 11, 10, 9],
            anxiety: [9, 8, 8, 7],
            hurt: [3, 4, 3, 3],
            embarrassed: [2, 2, 2, 3]
        },
        cognitive: [280, 310, 295, 340],
        temperature: [23.5, 24.2, 24.8, 24.0],
        humidity: [46, 47, 49, 45]
    }
};

// ========================================
// 2. 초기화 함수
// ========================================

/**
 * 페이지 로드 시 초기화
 */
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🌸 늘봄 AI 시스템 초기화...');

    // 생년월일 셀렉트 박스 초기화
    initBirthDateSelects();

    // 네비게이션 이벤트 초기화
    initNavigation();

    // 실시간 입력 검증 이벤트 바인딩
    initValidationEvents();

    // 전화번호 자동 포맷팅
    initPhoneFormatting();

    // 보미 메시지 초기화
    initBomiMessages();

    // 👇 [추가] 알림 설정 불러오기
    initNotificationSettings();

    // 👇 [추가] 실시간 알림 감시 시작
    startAlertPolling();

    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    
    if (username) {
        // 센서 확인
        await checkSensor(username);
    }

    // 👇 [추가] 저장된 로그인 정보가 있는지 확인!
    if (loadUserData()) {
        console.log("🔄 자동 로그인 (새로고침 유지)");
        
        // 👇 username 가져오기 (이제 loadUserData에서 복원됨!)
        const username = sessionStorage.getItem('username') || localStorage.getItem('username');
        
        if (username) {
            await checkSensor(username);
        }
        
        showPage('main-app');
    } else {
        showPage('login-page');
    }

    console.log('✅ 늘봄 AI 초기화 완료');
});


/**
 * [필수] 저장된 알림 설정 불러와서 전역 변수에 적용하기
 */
function initNotificationSettings() {
    // 1. 로컬 스토리지에서 값 가져오기
    const storedAbnormal = localStorage.getItem('setting_abnormal');
    const storedEmergency = localStorage.getItem('setting_emergency');

    // 2. 전역 변수 업데이트 ('false'라는 문자열이 아니면 무조건 켜짐으로 간주)
    isAbnormalAlertOn = (storedAbnormal !== 'false');
    isEmergencyAlertOn = (storedEmergency !== 'false');

    // 3. 화면의 토글 버튼(체크박스) 상태도 변수에 맞게 변경
    const abnormalToggle = document.getElementById('alert-abnormal');
    const emergencyToggle = document.getElementById('alert-emergency');

    if (abnormalToggle) abnormalToggle.checked = isAbnormalAlertOn;
    if (emergencyToggle) emergencyToggle.checked = isEmergencyAlertOn;

    console.log(`⚙️ 알림 설정 로드됨: 이상행동=${isAbnormalAlertOn}, 응급=${isEmergencyAlertOn}`);
}




/**
 * 생년월일 셀렉트 박스 초기화
 */
function initBirthDateSelects() {
    const yearSelect = document.getElementById('senior-birth-year');
    const monthSelect = document.getElementById('senior-birth-month');
    const daySelect = document.getElementById('senior-birth-day');

    if (!yearSelect || !monthSelect || !daySelect) return;

    // 년도 옵션 (1920 ~ 현재년도)
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1920; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}년`;
        yearSelect.appendChild(option);
    }

    // 월 옵션
    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = `${month}월`;
        monthSelect.appendChild(option);
    }

    // 일 옵션 (기본 31일)
    for (let day = 1; day <= 31; day++) {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = `${day}일`;
        daySelect.appendChild(option);
    }

    // 년/월 변경 시 일 수 조정
    yearSelect.addEventListener('change', updateDays);
    monthSelect.addEventListener('change', updateDays);
}

/**
 * 선택된 년/월에 따라 일 수 업데이트
 */
function updateDays() {
    const year = parseInt(document.getElementById('senior-birth-year').value);
    const month = parseInt(document.getElementById('senior-birth-month').value);
    const daySelect = document.getElementById('senior-birth-day');
    const currentDay = daySelect.value;

    if (!year || !month) return;

    // 해당 월의 마지막 날짜 계산
    const daysInMonth = new Date(year, month, 0).getDate();

    // 일 옵션 재생성
    daySelect.innerHTML = '<option value="">일</option>';
    for (let day = 1; day <= daysInMonth; day++) {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = `${day}일`;
        daySelect.appendChild(option);
    }

    // 이전 선택값 복원 (유효한 경우)
    if (currentDay && parseInt(currentDay) <= daysInMonth) {
        daySelect.value = currentDay;
    }
}

/**
 * 네비게이션 이벤트 초기화
 */
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            const page = this.dataset.page;
            switchView(page);

            // 활성 상태 변경
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

/**
 * [수정됨] 실시간 입력 검증 이벤트 바인딩 (비밀번호 확인 기능 추가)
 */
function initValidationEvents() {
    // 1. 기존 유효성 검사 (data-rule 있는 항목들)
    const inputs = document.querySelectorAll('input[data-rule], select[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function () {
            if (!isSignupInProgress) return;
            validateField(this);
        });

        input.addEventListener('input', function () {
            clearFieldError(this);
        });
    });

    // 2. [추가됨] 비밀번호 확인 실시간 비교 로직
    const pwInput = document.getElementById('signup-password');
    const pwConfirmInput = document.getElementById('signup-password-confirm');

    if (pwInput && pwConfirmInput) {
        // (1) 확인 칸에서 포커스가 나갈 때 -> 다르면 에러 표시
        pwConfirmInput.addEventListener('blur', function() {
            if (this.value && this.value !== pwInput.value) {
                const wrapper = this.closest('.input-wrapper');
                setFieldError(wrapper, '비밀번호가 일치하지 않습니다.');
            }
        });

        // (2) 입력하는 도중 -> 같아지면 에러 즉시 제거 (파란불)
        pwConfirmInput.addEventListener('input', function() {
            const wrapper = this.closest('.input-wrapper');
            if (this.value === pwInput.value) {
                clearFieldError(wrapper); // 에러 메시지 삭제
                // (선택사항) 일치한다는 표시를 주고 싶다면 아래처럼 클래스 추가 가능
                // wrapper.classList.add('valid'); 
            } else {
                // 입력 중에는 굳이 에러를 띄우지 않고(짜증 유발 방지), 기존 에러가 있다면 냅둠
                // 하지만 사용자가 지우고 다시 쓸 때를 위해, 값이 비어있으면 에러 제거
                if(this.value === '') clearFieldError(wrapper);
            }
        });
    }
}

/**
 * 전화번호 자동 포맷팅
 */
function initPhoneFormatting() {
    const phoneInputs = document.querySelectorAll('input[data-rule="phone"], input[data-rule="phone-optional"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function (e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 3 && value.length <= 7) {
                value = value.slice(0, 3) + '-' + value.slice(3);
            } else if (value.length > 7) {
                value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
            }
            e.target.value = value;
        });
    });
}

// ========================================
// 3. 페이지 네비게이션
// ========================================

/**
 * 페이지 전환
 * @param {string} pageId - 전환할 페이지 ID
 */
function showPage(pageId) {
    // 1. 모든 페이지 숨기기
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 2. 모든 내비게이션 메뉴 초기화
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // 3. 현재 클릭한 메뉴 활성화 (초록 박스)
    // HTML의 onclick="showPage('page-healthcheck')"와 매칭되는 버튼을 찾습니다.
    const currentLink = document.querySelector(`.nav-link[onclick*="${pageId}"]`);
    if (currentLink) {
        currentLink.classList.add('active');
    }

    // 4. 보미 비서 표시 설정
    const bomi = document.getElementById('bomi-assistant');
    if (bomi) {
        if (pageId === 'login-page' || pageId === 'signup-page') {
            bomi.style.display = 'none';
        } else {
            bomi.style.display = 'flex';
        }
    }

    // 5. 실제 페이지 표시
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // 6. 헬스체크 페이지일 때 그라파나 로드
    if (pageId === 'page-healthcheck') {
        const iframe = document.getElementById('grafana-iframe');
        // kiosk 모드를 추가하여 깔끔하게 출력
        const grafanaUrl = "https://060ce0fe678ede.lhr.life/d/adkhgvl/eb8a98-ebb484-ed9484-eba19c-eca09d-ed8ab8?orgId=1&from=now-3h&to=now&timezone=browser&kiosk&theme=light";

        if (iframe && (iframe.src === "" || iframe.src !== grafanaUrl)) {
            console.log("📊 그라파나 대시보드 로드 시작...");
            iframe.src = grafanaUrl;
        }
    }

    // 7. 회원가입 및 메인 앱 초기화 로직 (기존 유지)
    if (pageId === 'signup-page') {
        isSignupInProgress = true;
        resetSignupForm();
    } else {
        isSignupInProgress = false;
    }

    if (pageId === 'main-app') {
        setTimeout(() => {
            initCharts();
            renderNotifications();
            renderDevices();
            renderMypageDevices();
            renderAlertHistory();
            updateMyPage();
            updateDashboard();
            updateDynamicGreeting();
        }, 100);
    }
}

/**
 * 메인 앱 내 뷰 전환
 * @param {string} viewId - 전환할 뷰 ID
 */
function switchView(viewId) {
    // 1. 모든 뷰 숨기기
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // 2. 선택한 뷰 보이기
    const targetView = document.getElementById(viewId + '-view');
    if (targetView) {
        targetView.classList.add('active');
    }

    // 3. 리포트 뷰 전환 시 차트 새로고침
    if (viewId === 'report') {
        setTimeout(() => {
            initReportCharts();
            renderAlertHistory();
        }, 100);
    }

    // 4. [수정됨] 헬스체크 뷰 전환 시 그라파나 URL 로드
    if (viewId === 'healthcheck') {
        const iframe = document.getElementById('grafana-iframe');
        // 네가 제공한 새로운 URL (kiosk 모드 적용)
        const grafanaUrl = "https://060ce0fe678ede.lhr.life/d/adkhgvl/eb8a98-ebb484-ed9484-eba19c-eca09d-ed8ab8?orgId=1&from=now-3h&to=now&timezone=browser&kiosk&theme=light";

        // iframe이 있고, 주소가 비어있거나 다르면 로드
        if (iframe && iframe.src !== grafanaUrl) {
            console.log("📊 헬스체크 그라파나 대시보드 로드 중...");
            iframe.src = grafanaUrl;
        }
    }
}

// ========================================
// 4. 로그인/로그아웃
// ========================================

/**
 * [수정됨] 로그인 처리 (DB 연동 버전)
 */
function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    // 유효성 검사
    if (!username || !password) {
        showToast('warning', '입력 오류', '아이디와 비밀번호를 입력해주세요.');
        return false;
    }

    console.log("🔑 로그인 시도:", username);

    // 서버로 로그인 요청 (DB 확인)
    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                // 로그인 실패
                showToast('danger', '로그인 실패', '아이디 또는 비밀번호를 확인해주세요.');
                document.getElementById('login-password').value = '';
            } else {
                // 로그인 성공!
                currentUser = data; // DB에서 받아온 정보로 설정

                sessionStorage.setItem('username', data.username);
                localStorage.setItem('username', data.username);
                saveUserData();
                
                showToast('success', '로그인 성공', `${currentUser.name}님, 환영합니다!`);

                // 화면 전환
                setTimeout(() => {
                    showPage('main-app');
                    // 대시보드 데이터 갱신
                    updateDashboard();
                    updateMyPage();
                }, 500);
            }
        })
        .catch(error => {
            console.error('로그인 통신 에러:', error);
            showToast('danger', '오류', '서버와 연결할 수 없습니다.');
        });

    return false;
}

/**
 * [수정됨] 로그아웃 처리 (저장된 정보 삭제)
 */
function handleLogout() {
    currentUser = null;

    // 👇 [추가] 브라우저에 저장된 로그인 정보 삭제
    localStorage.removeItem('neulbom_user');

    showToast('info', '로그아웃', '안전하게 로그아웃되었습니다.');

    // 입력 필드 초기화
    const idInput = document.getElementById('login-username');
    const pwInput = document.getElementById('login-password');
    if (idInput) idInput.value = '';
    if (pwInput) pwInput.value = '';

    showPage('login-page');
}

// ========================================
// 5. 회원가입 프로세스
// ========================================

/**
 * [수정됨] 아이디 중복 확인 (진짜 DB 조회)
 */
function checkDuplicate() {
    const usernameInput = document.getElementById('signup-username');
    const username = usernameInput.value.trim();
    const wrapper = usernameInput.closest('.input-wrapper');

    // 1. 입력값 기본 검사
    if (!username) {
        setFieldError(wrapper, '아이디를 입력해주세요.');
        return;
    }

    // 아이디 형식 검증 (영문, 숫자 4~20자)
    const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
    if (!usernameRegex.test(username)) {
        setFieldError(wrapper, '영문, 숫자 4-20자로 입력해주세요.');
        return;
    }

    // 2. 서버에 진짜 중복 확인 요청
    fetch('/api/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
    })
    .then(res => res.json())
    .then(data => {
        if (data.isDuplicate) {
            // 중복된 경우
            setFieldError(wrapper, '이미 사용 중인 아이디입니다.');
            isUsernameChecked = false;
        } else {
            // 사용 가능한 경우
            clearFieldError(wrapper);
            // 성공 메시지 표시 (초록색 테두리 등 스타일 적용 가능)
            wrapper.classList.add('success'); 
            showToast('success', '사용 가능', '사용 가능한 아이디입니다.');
            isUsernameChecked = true;
        }
    })
    .catch(err => {
        console.error('중복 확인 에러:', err);
        showToast('error', '오류', '서버 연결에 실패했습니다.');
    });
}

/**
 * 회원가입 단계 이동
 * @param {number} currentStep - 현재 단계
 */
function nextStep(currentStep) {
    let isValid = false;

    // 단계별 검증 - 회원가입 진행 중일 때만 메시지 표시
    if (currentStep === 1) {
        isValid = validateStep1();
    } else if (currentStep === 2) {
        isValid = validateStep2();
    }

    if (isValid) {
        // 현재 단계 숨기기
        document.getElementById(`signup-step-${currentStep}`).classList.remove('active');
        // 다음 단계 표시
        document.getElementById(`signup-step-${currentStep + 1}`).classList.add('active');

        // 스크롤 맨 위로 이동
        document.querySelector('.signup-container').scrollTop = 0;
        window.scrollTo(0, 0);

        // 진행 표시 업데이트
        document.querySelectorAll('.step').forEach((step, index) => {
            if (index < currentStep) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (index === currentStep) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }
}

/**
 * 이전 단계로 이동
 * @param {number} currentStep - 현재 단계
 */
function prevStep(currentStep) {
    document.getElementById(`signup-step-${currentStep}`).classList.remove('active');
    document.getElementById(`signup-step-${currentStep - 1}`).classList.add('active');

    // 스크롤 맨 위로 이동
    document.querySelector('.signup-container').scrollTop = 0;
    window.scrollTo(0, 0);

    // 진행 표시 업데이트

    // 진행 표시 업데이트
    document.querySelectorAll('.step').forEach((step, index) => {
        if (index < currentStep - 1) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (index === currentStep - 1) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

/**
 * Step 1 검증 (보호자 정보)
 */
function validateStep1() {
    let isValid = true;

    // 아이디 중복확인 여부 (회원가입 진행 중일 때만 체크)
    if (isSignupInProgress && !isUsernameChecked) {
        const usernameWrapper = document.getElementById('signup-username').closest('.input-wrapper');
        setFieldError(usernameWrapper, '아이디 중복확인을 해주세요.');
        isValid = false;
    }

    // 각 필드 검증
    const fieldsToValidate = ['signup-username', 'signup-password', 'signup-password-confirm', 'signup-name', 'signup-phone'];
    fieldsToValidate.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!validateField(field)) {
            isValid = false;
        }
    });

    // 비밀번호 확인 일치 여부
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    if (password !== passwordConfirm) {
        const wrapper = document.getElementById('signup-password-confirm').closest('.input-wrapper');
        setFieldError(wrapper, '비밀번호가 일치하지 않습니다.');
        isValid = false;
    }

    // 주소 검증
    const zipcode = document.getElementById('signup-zipcode').value;
    const addressDetail = document.getElementById('signup-address-detail').value.trim();

    if (!zipcode) {
        if (isSignupInProgress) {
            const wrapper = document.getElementById('signup-zipcode').closest('.input-wrapper');
            setFieldError(wrapper, '주소를 검색해주세요.');
        }
        isValid = false;
    }

    if (!addressDetail) {
        if (isSignupInProgress) {
            const wrapper = document.getElementById('signup-address-detail').closest('.input-wrapper');
            setFieldError(wrapper, '상세주소를 입력해주세요.');
        }
        isValid = false;
    }

    // 필수 약관 동의 확인
    const requiredTerms = document.querySelectorAll('#step1-form .required-term');
    let allTermsChecked = true;
    requiredTerms.forEach(term => {
        if (!term.checked) {
            allTermsChecked = false;
        }
    });

    if (!allTermsChecked) {
        if (isSignupInProgress) {
            document.getElementById('terms-error').textContent = '필수 약관에 모두 동의해주세요.';
        }
        isValid = false;
    } else {
        document.getElementById('terms-error').textContent = '';
    }

    if (!isValid && isSignupInProgress) {
        focusFirstError();
    }

    return isValid;
}

/**
 * Step 2 검증 (어르신 정보)
 */
function validateStep2() {
    let isValid = true;

    // 성함 검증
    const nameField = document.getElementById('senior-name');
    if (!validateField(nameField)) {
        isValid = false;
    }

    // 생년월일 검증
    const birthYear = document.getElementById('senior-birth-year').value;
    const birthMonth = document.getElementById('senior-birth-month').value;
    const birthDay = document.getElementById('senior-birth-day').value;

    if (!birthYear || !birthMonth || !birthDay) {
        if (isSignupInProgress) {
            document.getElementById('senior-birth-error').textContent = '생년월일을 모두 선택해주세요.';
        }
        isValid = false;
    } else {
        document.getElementById('senior-birth-error').textContent = '';
    }

    // 성별 검증
    const genderSelected = document.querySelector('input[name="senior-gender"]:checked');
    if (!genderSelected) {
        if (isSignupInProgress) {
            document.getElementById('senior-gender-error').textContent = '성별을 선택해주세요.';
        }
        isValid = false;
    } else {
        document.getElementById('senior-gender-error').textContent = '';
    }

    // 가족관계 검증
    const relation = document.getElementById('senior-relation').value;
    if (!relation) {
        if (isSignupInProgress) {
            const wrapper = document.getElementById('senior-relation').closest('.input-wrapper');
            setFieldError(wrapper, '가족관계를 선택해주세요.');
        }
        isValid = false;
    }

    // 주거형태 검증
    const livingSelected = document.querySelector('input[name="senior-living"]:checked');
    if (!livingSelected) {
        if (isSignupInProgress) {
            document.getElementById('senior-living-error').textContent = '주거형태를 선택해주세요.';
        }
        isValid = false;
    } else {
        document.getElementById('senior-living-error').textContent = '';
    }

    // 주소 검증
    const zipcode = document.getElementById('senior-zipcode').value;
    const addressDetail = document.getElementById('senior-address-detail').value.trim();

    if (!zipcode) {
        if (isSignupInProgress) {
            const wrapper = document.getElementById('senior-zipcode').closest('.input-wrapper');
            setFieldError(wrapper, '주소를 검색해주세요.');
        }
        isValid = false;
    }

    if (!addressDetail) {
        if (isSignupInProgress) {
            const wrapper = document.getElementById('senior-address-detail').closest('.input-wrapper');
            setFieldError(wrapper, '상세주소를 입력해주세요.');
        }
        isValid = false;
    }

    // 필수 약관 동의 확인
    const requiredTerms = document.querySelectorAll('#step2-form .required-term');
    let allTermsChecked = true;
    requiredTerms.forEach(term => {
        if (!term.checked) {
            allTermsChecked = false;
        }
    });

    if (!allTermsChecked) {
        if (isSignupInProgress) {
            document.getElementById('senior-terms-error').textContent = '필수 약관에 모두 동의해주세요.';
        }
        isValid = false;
    } else {
        document.getElementById('senior-terms-error').textContent = '';
    }

    if (!isValid && isSignupInProgress) {
        focusFirstError();
    }

    return isValid;
}

/**
 * [수정됨] 회원가입 완료 처리 (중복 클릭 방지 + 버튼 잠금 적용)
 */
function completeSignup() {
    // 1. 중복 클릭 방지 (이미 처리 중이면 함수 강제 종료)
    if (isSignupInProgress) return;

    // 2. 잠금 걸기 & 버튼 비활성화 (시각적 피드백)
    isSignupInProgress = true;
    const signupBtn = document.querySelector('.form-buttons .btn-primary'); // 버튼 찾기

    // 버튼이 있다면 '처리 중...'으로 바꾸고 비활성화
    if (signupBtn) {
        signupBtn.disabled = true;
        signupBtn.textContent = '가입 처리 중...';
        signupBtn.style.opacity = '0.7';
    }

    // 3. 생년월일 합치기
    const year = document.getElementById('senior-birth-year').value;
    const month = document.getElementById('senior-birth-month').value.padStart(2, '0');
    const day = document.getElementById('senior-birth-day').value.padStart(2, '0');
    const fullBirth = `${year}-${month}-${day}`;

    // 4. 전송할 데이터 수집
    const signupData = {
        guardian: {
            username: document.getElementById('signup-username').value.trim(),
            password: document.getElementById('signup-password').value,
            name: document.getElementById('signup-name').value.trim(),
            phone: document.getElementById('signup-phone').value.trim(),
            zipcode: document.getElementById('signup-zipcode').value,
            address: document.getElementById('signup-address').value,
            addressDetail: document.getElementById('signup-address-detail').value.trim()
        },
        senior: {
            name: document.getElementById('senior-name').value.trim(),
            fullBirthdate: fullBirth,
            gender: document.querySelector('input[name="senior-gender"]:checked')?.value || 'unknown',
            phone: document.getElementById('senior-phone').value.trim(),
            zipcode: document.getElementById('senior-zipcode').value,
            address: document.getElementById('senior-address').value,
            addressDetail: document.getElementById('senior-address-detail').value.trim(),
            relation: document.getElementById('senior-relation').value,
            living: document.querySelector('input[name="senior-living"]:checked')?.value || 'alone'
        }
    };

    console.log("📤 회원가입 요청 시작...");

    // 5. 서버 전송
    fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                // 실패 시 버튼 다시 살리기 (재시도 가능하게)
                isSignupInProgress = false;
                if (signupBtn) {
                    signupBtn.disabled = false;
                    signupBtn.textContent = '가입 완료';
                    signupBtn.style.opacity = '1';
                }
                showToast('danger', '가입 실패', '입력 정보를 확인해주세요. (아이디 중복 등)');
                console.error('서버 에러:', data.error);
            } else {
                // 성공 시 (버튼 비활성화 유지 - 페이지 이동 예정)
                showToast('success', '가입 완료', '회원가입이 완료되었습니다!');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        })
        .catch(error => {
            // 통신 에러 시 버튼 다시 살리기
            isSignupInProgress = false;
            if (signupBtn) {
                signupBtn.disabled = false;
                signupBtn.textContent = '가입 완료';
                signupBtn.style.opacity = '1';
            }
            console.error('통신 에러:', error);
            showToast('danger', '연결 실패', '서버와 통신할 수 없습니다.');
        });
}

/**
 * 기기 등록 건너뛰고 완료
 */
function skipDeviceAndComplete() {
    registeredDevices = [];
    completeSignup(); // 위에서 수정한 안전한 함수를 호출
}

/**
 * [수정됨] 회원가입 폼 초기화 (버튼 텍스트 덮어쓰기 버그 수정)
 */
function resetSignupForm() {
    // 혹시라도 잠겨있을 수 있는 진행 상태를 초기화
    isSignupInProgress = false;

    // Step 1 초기화
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-password-confirm').value = '';
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-phone').value = '';
    document.getElementById('signup-zipcode').value = '';
    document.getElementById('signup-address').value = '';
    document.getElementById('signup-address-detail').value = '';

    // Step 2 초기화
    document.getElementById('senior-name').value = '';
    document.getElementById('senior-birth-year').value = '';
    document.getElementById('senior-birth-month').value = '';
    document.getElementById('senior-birth-day').value = '';
    document.getElementById('senior-phone').value = '';
    document.getElementById('senior-relation').value = '';
    document.getElementById('senior-zipcode').value = '';
    document.getElementById('senior-address').value = '';
    document.getElementById('senior-address-detail').value = '';
    document.getElementById('senior-notes').value = '';

    // 라디오 버튼 초기화
    document.querySelectorAll('input[name="senior-gender"]').forEach(radio => radio.checked = false);
    document.querySelectorAll('input[name="senior-living"]').forEach(radio => radio.checked = false);

    // 체크박스 초기화
    document.querySelectorAll('.term-check, .senior-term-check, #terms-all, #senior-terms-all').forEach(cb => cb.checked = false);

    // 에러 메시지 초기화
    document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
    document.querySelectorAll('.input-wrapper').forEach(wrapper => wrapper.classList.remove('has-error'));

    // 기기 목록 초기화
    registeredDevices = [];
    renderDeviceList();

    // 단계 초기화 (Step 1 활성화)
    document.querySelectorAll('.signup-step').forEach((step, index) => {
        step.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('completed');
        step.classList.toggle('active', index === 0);
    });

    // 중복확인 상태 초기화
    isUsernameChecked = false;

    // 👇 [핵심 수정] Step 1 버튼이 아니라, 'Step 3의 가입완료 버튼'만 콕 집어서 초기화해야 함!
    // 기존 코드: const signupBtn = document.querySelector('.form-buttons .btn-primary'); (X) -> 1단계 버튼을 잡음
    const step3Btn = document.querySelector('#signup-step-3 .btn-primary'); // (O) -> 3단계 버튼만 잡음
    
    if (step3Btn) {
        step3Btn.disabled = false;
        step3Btn.textContent = '가입 완료';
        step3Btn.style.opacity = '1';
    }
}

// ========================================
// 6. 입력 검증 (Validation)
// ========================================

/**
 * 필드 검증
 * @param {HTMLElement} input - 검증할 입력 필드
 * @returns {boolean} 검증 결과
 */
function validateField(input) {
    if (!input) return true;

    const rule = input.dataset.rule;
    const value = input.value.trim();
    const wrapper = input.closest('.input-wrapper');

    // 규칙별 검증
    switch (rule) {
        case 'username':
            if (!value) {
                if (isSignupInProgress) setFieldError(wrapper, '아이디를 입력해주세요.');
                return false;
            }
            if (!/^[a-zA-Z0-9]{4,20}$/.test(value)) {
                if (isSignupInProgress) setFieldError(wrapper, '영문, 숫자 4-20자로 입력해주세요.');
                return false;
            }
            break;

        case 'password':
            if (!value) {
                if (isSignupInProgress) setFieldError(wrapper, '비밀번호를 입력해주세요.');
                return false;
            }
            if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(value)) {
                if (isSignupInProgress) setFieldError(wrapper, '영문, 숫자, 특수문자 포함 8자 이상 입력해주세요.');
                return false;
            }
            break;

        case 'name':
            if (!value) {
                if (isSignupInProgress) setFieldError(wrapper, '이름을 입력해주세요.');
                return false;
            }
            if (value.length < 2) {
                if (isSignupInProgress) setFieldError(wrapper, '이름은 2자 이상 입력해주세요.');
                return false;
            }
            break;

        case 'phone':
            if (!value) {
                if (isSignupInProgress) setFieldError(wrapper, '휴대폰 번호를 입력해주세요.');
                return false;
            }
            if (!/^010-\d{4}-\d{4}$/.test(value)) {
                if (isSignupInProgress) setFieldError(wrapper, '올바른 형식으로 입력해주세요. (010-0000-0000)');
                return false;
            }
            break;

        case 'phone-optional':
            if (value && !/^010-\d{4}-\d{4}$/.test(value)) {
                if (isSignupInProgress) setFieldError(wrapper, '올바른 형식으로 입력해주세요. (010-0000-0000)');
                return false;
            }
            break;
    }

    clearFieldError(wrapper);
    return true;
}

/**
 * 필드 에러 설정
 * @param {HTMLElement} wrapper - input-wrapper 요소
 * @param {string} message - 에러 메시지
 */
function setFieldError(wrapper, message) {
    if (!wrapper) return;
    wrapper.classList.add('has-error');
    const errorText = wrapper.querySelector('.error-text');
    if (errorText) {
        errorText.textContent = message;
    }
    // shake 애니메이션
    const input = wrapper.querySelector('input, select');
    if (input) {
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
    }
}

/**
 * 필드 에러 제거
 * @param {HTMLElement} wrapper - input-wrapper 요소 또는 input 요소
 */
function clearFieldError(wrapper) {
    if (!wrapper) return;
    if (!wrapper.classList.contains('input-wrapper')) {
        wrapper = wrapper.closest('.input-wrapper');
    }
    if (!wrapper) return;

    wrapper.classList.remove('has-error');
    const errorText = wrapper.querySelector('.error-text');
    if (errorText) {
        errorText.textContent = '';
    }
}

/**
 * 첫 번째 에러 필드로 포커스 이동
 */
function focusFirstError() {
    const firstError = document.querySelector('.has-error input, .has-error select');
    if (firstError) {
        firstError.focus();
    }
}

// ========================================
// 7. 개인정보 마스킹 함수
// ========================================

/**
 * 전화번호 마스킹 (뒷자리 4자리)
 * @param {string} phone - 전화번호
 * @returns {string} 마스킹된 전화번호
 */
function maskPhone(phone) {
    if (!phone) return '-';
    // 010-1234-5678 -> 010-****-5678
    return phone.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3');
}

/**
 * 상세주소 마스킹
 * @param {string} address - 전체 주소
 * @param {string} detail - 상세주소
 * @returns {string} 마스킹된 주소
 */
function maskAddress(address, detail) {
    if (!address) return '-';
    // 상세주소 부분을 **** 로 대체
    if (detail) {
        return address + ' ****';
    }
    return address;
}

/**
 * 생년월일 마스킹 (월/일만)
 * @param {string} year - 년도
 * @param {string} month - 월
 * @param {string} day - 일
 * @returns {string} 마스킹된 생년월일
 */
function maskBirthDate(year, month, day) {
    if (!year) return '-';
    // 1945년 3월 15일 -> 1945년 **월 **일
    return `${year}년 **월 **일`;
}

/**
 * 마이페이지 정보 마스킹 적용
 */
function applyMasking() {
    if (!currentUser) return;

    // 보호자 정보 마스킹
    document.getElementById('mypage-phone').textContent = maskPhone(currentUser.phone);
    document.getElementById('mypage-address').textContent = maskAddress(currentUser.address, currentUser.addressDetail);

    // 어르신 정보 마스킹
    if (currentUser.senior) {
        document.getElementById('mypage-senior-phone').textContent = maskPhone(currentUser.senior.phone);
        document.getElementById('mypage-senior-birth').textContent = maskBirthDate(
            currentUser.senior.birthYear,
            currentUser.senior.birthMonth,
            currentUser.senior.birthDay
        );
        document.getElementById('mypage-senior-address').textContent = maskAddress(
            currentUser.senior.address,
            currentUser.senior.addressDetail
        );
    }
}

// ========================================
// 8. 주소 검색 (Daum API)
// ========================================

/**
 * 주소 검색 (Daum 우편번호 서비스)
 * @param {string} type - 주소 타입 ('signup', 'senior', 'edit-guardian', 'edit-senior')
 */
function searchAddress(type) {
    new daum.Postcode({
        oncomplete: function (data) {
            let zipcode, address, detailInput;

            switch (type) {
                case 'signup':
                    zipcode = document.getElementById('signup-zipcode');
                    address = document.getElementById('signup-address');
                    detailInput = document.getElementById('signup-address-detail');
                    break;
                case 'senior':
                    zipcode = document.getElementById('senior-zipcode');
                    address = document.getElementById('senior-address');
                    detailInput = document.getElementById('senior-address-detail');
                    break;
                case 'edit-guardian':
                    zipcode = document.getElementById('edit-guardian-zipcode');
                    address = document.getElementById('edit-guardian-address');
                    detailInput = document.getElementById('edit-guardian-address-detail');
                    break;
                case 'edit-senior':
                    zipcode = document.getElementById('edit-senior-zipcode');
                    address = document.getElementById('edit-senior-address');
                    detailInput = document.getElementById('edit-senior-address-detail');
                    break;
            }

            if (zipcode) zipcode.value = data.zonecode;
            if (address) address.value = data.roadAddress || data.jibunAddress;
            if (detailInput) {
                detailInput.focus();
                clearFieldError(detailInput);
            }

            // 우편번호 필드 에러 제거
            if (zipcode) clearFieldError(zipcode);
        }
    }).open();
}

// ========================================
// 9. 약관 처리
// ========================================

/**
 * 약관 내용 토글
 * @param {string} termId - 약관 내용 요소 ID
 */
function toggleTermContent(termId) {
    const content = document.getElementById(termId);
    const button = content.previousElementSibling.querySelector('.term-toggle');

    content.classList.toggle('active');
    button.classList.toggle('active');
}

/**
 * 전체 약관 동의 토글 (Step 1)
 * @param {HTMLElement} checkbox - 전체 동의 체크박스
 */
function toggleAllTerms(checkbox) {
    const termChecks = document.querySelectorAll('#step1-form .term-check');
    termChecks.forEach(check => {
        check.checked = checkbox.checked;
    });
}

/**
 * 전체 약관 동의 토글 (Step 2 - 어르신)
 * @param {HTMLElement} checkbox - 전체 동의 체크박스
 */
function toggleAllSeniorTerms(checkbox) {
    const termChecks = document.querySelectorAll('#step2-form .senior-term-check');
    termChecks.forEach(check => {
        check.checked = checkbox.checked;
    });
}

// ========================================
// 10. 기기 등록
// ========================================

/**
 * 기기 등록 방식 선택
 * @param {string} method - 'qr' 또는 'manual'
 */
function selectDeviceMethod(method) {
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(method === 'qr' ? 'QR' : '직접'));
    });

    document.getElementById('device-qr').classList.toggle('active', method === 'qr');
    document.getElementById('device-manual').classList.toggle('active', method === 'manual');
}

/**
 * QR 스캔 시뮬레이션
 */
function simulateQRScan() {
    const serial = 'NB-ENV-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    registeredDevices.push({
        id: 'DEV' + Date.now(),
        serial: serial,
        name: '환경센서',
        location: 'living',
        status: 'online'
    });

    renderDeviceList();
    showToast('success', '기기 스캔 완료', `${serial} 기기가 등록되었습니다.`);
}

/**
 * 기기 직접 추가
 */
function addDeviceToList() {
    const serial = document.getElementById('device-serial').value.trim();
    const name = document.getElementById('device-name').value.trim() || '센서';
    const location = document.getElementById('device-location').value;

    if (!serial) {
        const wrapper = document.getElementById('device-serial').closest('.input-wrapper');
        setFieldError(wrapper, '시리얼 번호를 입력해주세요.');
        return;
    }

    // 중복 확인
    if (registeredDevices.some(d => d.serial === serial)) {
        showToast('warning', '중복 기기', '이미 등록된 기기입니다.');
        return;
    }

    registeredDevices.push({
        id: 'DEV' + Date.now(),
        serial: serial,
        name: name,
        location: location,
        status: 'online'
    });

    // 입력 필드 초기화
    document.getElementById('device-serial').value = '';
    document.getElementById('device-name').value = '';

    renderDeviceList();
    showToast('success', '기기 추가', `${name} 기기가 등록되었습니다.`);
}

/**
 * 기기 목록 렌더링 (회원가입)
 */
function renderDeviceList() {
    const container = document.getElementById('device-list');
    if (!container) return;

    if (registeredDevices.length === 0) {
        container.innerHTML = `
            <div class="empty-device-list">
                <span class="material-icons-round">devices_off</span>
                <p>등록된 기기가 없습니다</p>
            </div>
        `;
        return;
    }

    const locationNames = {
        living: '거실',
        bedroom: '침실',
        kitchen: '주방',
        bathroom: '화장실',
        entrance: '현관'
    };

    container.innerHTML = registeredDevices.map(device => `
        <div class="device-item">
            <div class="device-item-info">
                <div class="device-item-icon">
                    <span class="material-icons-round">sensors</span>
                </div>
                <div class="device-item-text">
                    <h5>${device.name}</h5>
                    <span>${device.serial} · ${locationNames[device.location] || device.location}</span>
                </div>
            </div>
            <button class="device-item-remove" onclick="removeDevice('${device.id}')">
                <span class="material-icons-round">close</span>
            </button>
        </div>
    `).join('');
}

/**
 * 기기 제거
 * @param {string} deviceId - 제거할 기기 ID
 */
function removeDevice(deviceId) {
    registeredDevices = registeredDevices.filter(d => d.id !== deviceId);
    renderDeviceList();
}

/**
 * 대시보드 기기 상태 렌더링
 */
function renderDevices() {
    const container = document.getElementById('device-status-list');
    if (!container || !currentUser) return;

    const devices = currentUser.devices || [];

    if (devices.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">등록된 기기가 없습니다</p>';
        return;
    }

    const locationNames = {
        living: '거실',
        bedroom: '침실',
        kitchen: '주방',
        bathroom: '화장실',
        entrance: '현관'
    };

    container.innerHTML = devices.map(device => `
        <div class="device-status-item">
            <div class="device-status-info">
                <div class="device-status-icon">
                    <span class="material-icons-round">sensors</span>
                </div>
                <div class="device-status-text">
                    <h5>${device.name}</h5>
                    <span>${locationNames[device.location] || device.location}</span>
                </div>
            </div>
            <span class="device-status-badge ${device.status}">${device.status === 'online' ? '정상' : '오프라인'}</span>
        </div>
    `).join('');
}

/**
 * 마이페이지 기기 목록 렌더링
 */
function renderMypageDevices() {
    const container = document.getElementById('mypage-device-list');
    if (!container || !currentUser) return;

    const devices = currentUser.devices || [];

    if (devices.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">등록된 기기가 없습니다</p>';
        return;
    }

    const locationNames = {
        living: '거실',
        bedroom: '침실',
        kitchen: '주방',
        bathroom: '화장실',
        entrance: '현관'
    };

    container.innerHTML = devices.map(device => `
        <div class="device-status-item">
            <div class="device-status-info">
                <div class="device-status-icon">
                    <span class="material-icons-round">sensors</span>
                </div>
                <div class="device-status-text">
                    <h5>${device.name}</h5>
                    <span>${device.serial}</span>
                </div>
            </div>
            <span class="device-status-badge ${device.status}">${device.status === 'online' ? '정상' : '오프라인'}</span>
        </div>
    `).join('');
}



/**
 * [수정됨] 모달에서 기기 추가 (로그인 ID 포함 전송)
 */
function addDeviceFromModal() {
    // 1. 입력값 가져오기
    const serial = document.getElementById('modal-device-serial').value.trim();
    const name = document.getElementById('modal-device-name').value.trim() || '센서';
    const location = document.getElementById('modal-device-location').value;

    // 검증
    if (!serial) {
        const wrapper = document.getElementById('modal-device-serial').closest('.input-wrapper');
        setFieldError(wrapper, '시리얼 번호를 입력해주세요.');
        return;
    }

    // 2. 서버로 보낼 데이터 준비 (★중요: 누가 보내는지 알려줘야 함!)
    const deviceData = {
        serial: serial,
        name: name,
        location: location,
        username: currentUser.username // 👈 로그인한 사용자 아이디 추가
    };

    console.log("📤 기기 등록 요청:", deviceData);

    // 3. API 호출
    fetch('/api/add-device', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast('danger', '등록 실패', '기기 등록 중 오류가 발생했습니다.');
                console.error(data.error);
            } else {
                // 4. 성공 시 화면에 추가
                if (currentUser) {
                    if (!currentUser.devices) currentUser.devices = [];
                    currentUser.devices.push({
                        id: 'DEV' + data.device_id,
                        serial: serial,
                        name: name,
                        location: location,
                        status: 'online'
                    });
                    renderDevices();
                    renderMypageDevices();
                }

                closeModal('add-device-modal');
                document.getElementById('modal-device-serial').value = '';
                document.getElementById('modal-device-name').value = '';

                showToast('success', '등록 완료', `${name} 기기가 등록되었습니다.`);
            }
        })
        .catch(error => {
            console.error('통신 에러:', error);
            showToast('danger', '연결 실패', '서버와 통신할 수 없습니다.');
        });
}




/**
 * 기기 추가 모달 열기
 */
function openAddDeviceModal() {
    openModal('add-device-modal');
}

// ========================================
// 11. 대시보드 기능
// ========================================

/**
 * [수정됨] 대시보드 업데이트 (활동량 DB 연동 포함)
 */
function updateDashboard() {
    if (!currentUser) return;

    const userNameEl = document.getElementById('user-name-display');
    const seniorNameEl = document.getElementById('senior-name-display');

    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (seniorNameEl) seniorNameEl.textContent = currentUser.senior?.name || '어르신';

    updateCurrentDate();
    updateDynamicGreeting();

    // 👇 [추가] DB에서 오늘 활동량(움직임 횟수) 가져오기
    fetch('/api/activity-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
    })
        .then(res => res.json())
        .then(data => {
            const count = data.count || 0;
            const valueEl = document.getElementById('activity-value');
            const badgeEl = document.getElementById('activity-badge');

            // 1. 숫자 표시 (예: 15회 감지)
            if (valueEl) {
                valueEl.innerHTML = `${count}<small>회 감지</small>`;
            }

            // 2. 뱃지 상태 변경 (많이 움직이면 '활발', 적으면 '부족')
            if (badgeEl) {
                if (count >= 50) {
                    badgeEl.textContent = '매우 활발';
                    badgeEl.className = 'metric-badge good'; // 초록색
                } else if (count >= 10) {
                    badgeEl.textContent = '보통';
                    badgeEl.className = 'metric-badge normal'; // 파란색
                } else {
                    badgeEl.textContent = '활동 부족';
                    badgeEl.className = 'metric-badge warning'; // 주황색
                }
            }
        })
        .catch(err => console.error('활동량 가져오기 실패:', err));

    // 👇 [추가] 새로고침 시에도 알림 유지하기 위해 DB에서 불러오기!
    loadRecentAlerts();
}

/**
 * [최종 수정] 알림 불러오기 (읽음 상태 인식 오류 수정)
 */
function loadRecentAlerts() {
    fetch('/api/alert-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    })
    .then(res => res.json())
    .then(data => {
        if (!Array.isArray(data)) return;

        const dbAlerts = data.map(item => {
            const rawType = String(item.alert_type).toLowerCase().trim();
            let normalizedType = 'info';

            if (rawType.includes('emergency') || rawType === 'danger') {
                normalizedType = 'danger';
            } else if (rawType.includes('no movement') || rawType === 'warning') {
                normalizedType = 'warning';
            }

            return {
                id: item.alert_id,
                type: normalizedType,
                title: getAlertTitle(normalizedType),
                message: item.alert_content,
                time: item.sented_at, 
                // 👇 [수정] === (엄격) 대신 == (느슨) 사용! 
                // (DB에서 문자 '1'로 오거나 숫자 1로 와도 다 알아듣게 됨)
                read: (item.received_yes == 1), 
                resolved: true
            };
        });

        // 나머지 로직은 그대로...
        const dbHistory = dbAlerts.map(alert => ({
            id: alert.id,
            type: alert.type,
            title: alert.title,
            description: alert.message,
            time: alert.time,
            resolved: true
        }));

        notifications = [...dbAlerts];
        alertHistory = [...dbHistory];

        updateAllUI();
        console.log(`🔄 알림 상태 동기화 완료: ${dbAlerts.length}개`);
    })
    .catch(err => console.error("알림 목록 로드 실패:", err));
}

/**
 * 현재 날짜 업데이트
 */
function updateCurrentDate() {
    const dateEl = document.getElementById('current-date');
    if (!dateEl) return;

    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateEl.textContent = now.toLocaleDateString('ko-KR', options);
}

/**
 * 동적 인사말 업데이트 (시간대별)
 */
function updateDynamicGreeting() {
    const greetingEl = document.getElementById('dynamic-greeting');
    if (!greetingEl || !currentUser) return;

    const hour = new Date().getHours();
    const seniorName = currentUser.senior?.name || '어르신';

    let greeting;
    if (hour >= 5 && hour < 12) {
        greeting = `${seniorName} 어르신께서 상쾌한 아침을 맞이하셨습니다 🌅 오늘 하루도 늘봄이 정성껏 보살펴 드리겠습니다`;
    } else if (hour >= 12 && hour < 17) {
        greeting = `${seniorName} 어르신의 오후를 늘봄이 따뜻하게 지켜보고 있습니다 🌿`;
    } else if (hour >= 17 && hour < 21) {
        greeting = `${seniorName} 어르신, 편안한 저녁 시간 되시길 바랍니다 🌆 늘봄이 함께합니다`;
    } else {
        greeting = `${seniorName} 어르신께서 편안히 주무실 수 있도록 늘봄이 밤새 지켜드리겠습니다 🌙`;
    }

    greetingEl.innerHTML = greeting;
}

// ========================================
// 12. 리포트 기능 (주간/월간 필터링)
// ========================================

/**
 * 리포트 기간 변경
 * @param {string} period - 'weekly' 또는 'monthly'
 * @param {HTMLElement} btn - 클릭된 버튼
 */
function changeReportPeriod(period, btn) {
    // 1. 버튼 활성화 상태 변경
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 2. 타이틀 업데이트
    const titleText = period === 'weekly' ? '주간' : '월간';
    document.getElementById('activity-report-title').textContent = titleText;
    document.getElementById('sleep-report-title').textContent = titleText;
    document.getElementById('emotion-report-title').textContent = titleText;
    document.getElementById('cognitive-report-title').textContent = titleText;
    document.getElementById('env-report-title').textContent = titleText;

    // 3. 👇 [핵심] 기간에 맞춰 서버 데이터 요청
    if (!currentUser) return;

    if (period === 'monthly') {
        // === 월간 데이터 요청 ===

        // (1) 라벨 만들기: 최근 4주 날짜 생성 (예: "1월 4주", "1월 3주"...)
        const today = new Date();
        const labels = [];
        for (let i = 3; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - (i * 7));
            const month = d.getMonth() + 1;

            // 간단하게 '월'과 '주차' 계산 (대략적인 계산)
            const weekNum = Math.ceil(d.getDate() / 7);
            labels.push(`${month}월 ${weekNum}주`); // 예: 1월 4주
        }
        reportData.monthly.labels = labels;

        // (2) 서버에서 데이터 가져오기
        fetch('/api/activity-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
        })
            .then(res => res.json())
            .then(resData => {
                const realData = resData.data || [0, 0, 0, 0];
                reportData.monthly.activity = realData;

                // 차트 업데이트
                updateReportCharts('monthly');
            })
            .catch(err => {
                console.error('월간 데이터 로드 실패:', err);
                updateReportCharts('monthly'); // 에러 나도 빈 차트는 그림
            });

    } else {
        // === 주간 데이터 요청 (기존 함수 재활용) ===
        // 주간 탭을 다시 눌렀을 때를 대비해 initReportCharts 호출
        initReportCharts();
    }

    console.log(`📊 리포트 기간 변경: ${period}`);
}

/**
 * 리포트 차트 데이터 업데이트
 * @param {string} period - 'weekly' 또는 'monthly'
 */
function updateReportCharts(period) {
    const data = reportData[period];

    // 활동량 차트 업데이트
    if (charts.activity) {
        charts.activity.data.labels = data.labels;
        charts.activity.data.datasets[0].data = data.activity;
        charts.activity.update();
    }

    // 수면 차트 업데이트
    if (charts.sleep) {
        charts.sleep.data.labels = data.labels;
        charts.sleep.data.datasets[0].data = data.sleep;
        charts.sleep.update();
    }

    // 감정 차트 업데이트 (긍정/부정 분할 + 요일별 상세)
    if (charts.emotionReport) {
        charts.emotionReport.data.labels = data.labels;

        const detail = data.emotionDetail;
        if (detail) {
            charts.emotionReport.data.datasets.forEach(ds => {
                if (ds.key && detail[ds.key]) {
                    ds.data = detail[ds.key];
                }
            });
        }
        charts.emotionReport.update();
    }

    // 인지 활동 차트 업데이트
    if (charts.cognitiveReport) {
        charts.cognitiveReport.data.labels = data.labels;
        charts.cognitiveReport.data.datasets[0].data = data.cognitive;
        charts.cognitiveReport.update();
    }

    // 환경 차트 업데이트
    if (charts.envReport) {
        charts.envReport.data.labels = data.labels;
        charts.envReport.data.datasets[0].data = data.temperature;
        charts.envReport.data.datasets[1].data = data.humidity;
        charts.envReport.update();
    }
}

/**
 * 주의/위험 이력 렌더링 (오늘 날짜 필터링 + 최신/과거 섹션 구분)
 */
function renderAlertHistory() {
    const container = document.getElementById('alert-history-list');
    if (!container) return;

    // 1. 오늘 날짜 구하기 (YYYY-MM-DD)
    const today = new Date();
    const todayString = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0');

    // 2. 오늘 발생한 알림만 필터링
    const todayAlerts = alertHistory.filter(alert => {
        return alert.time && alert.time.startsWith(todayString);
    });

    // 3. 날짜 변환 및 최신순 정렬 함수
    const toDate = (s) => {
        if (!s) return new Date(0);
        const iso = String(s).replace(' ', 'T');
        const d = new Date(iso);
        return isNaN(d.getTime()) ? new Date(0) : d;
    };

    const sortedToday = [...todayAlerts].sort((a, b) => toDate(b.time) - toDate(a.time));

    // 4. 최신(상단 2개) / 과거(나머지) 구분
    const latest = sortedToday.slice(0, 2);
    const past = sortedToday.slice(2);

    // 읽음 여부 확인 함수 (script1.js 로직 적용)
    const isUnread = (a) => (a.read === false) || (a.resolved === false);

    // 아이템 렌더링 템플릿
    const renderItem = (alert) => `
        <div class="alert-history-item ${alert.type} ${isUnread(alert) ? 'unread' : ''}">
            <div class="alert-history-icon">
                <span class="material-icons-round">${alert.type === 'danger' ? 'error' : 'warning'}</span>
            </div>
            <div class="alert-history-content">
                <h4>${alert.title}</h4>
                <p>${alert.description}</p>
            </div>
            <span class="alert-history-time">${alert.time.split(' ')[1]}</span> </div>
    `;

    const renderEmpty = (text) => `
        <div class="empty-state small" style="padding: 20px 0; text-align:center; color: var(--text-light); font-size:0.85rem;">
            ${text}
        </div>
    `;

    // 5. 최종 HTML 구조 생성
    if (sortedToday.length === 0) {
        container.innerHTML = renderEmpty('오늘 발생한 알림이 없습니다.');
        return;
    }

    container.innerHTML = `
        <div class="alert-history-section latest">
            <div class="alert-history-section-header">
                <span class="badge-latest">최신 업데이트</span>
                <span class="section-title">오늘의 최신 알림</span>
            </div>
            ${latest.length ? latest.map(renderItem).join('') : renderEmpty('최신 알림이 없습니다')}
        </div>

        <div class="alert-history-section past">
            <div class="alert-history-section-header">
                <span class="section-title">이전 알림 (오늘)</span>
            </div>
            ${past.length ? past.map(renderItem).join('') : renderEmpty('이전 알림이 없습니다')}
        </div>
    `;
}

// ========================================
// 13. 차트 초기화 및 업데이트
// ========================================

/**
 * 모든 차트 초기화
 */
function initCharts() {
    // 기존 차트 파괴
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};

    // 대시보드 차트
    initEmotionBubbleChart();
    initCognitiveChart();
    initEnvChart();
}

window.addEventListener('resize', function () {
    Object.values(charts).forEach(function (chart) {
        if (chart) {
            chart.resize();
        }
    });
});


/**
 * [최종 수정] 리포트 차트 초기화 (날짜 자동 생성 + DB 데이터 연동)
 */
function initReportCharts() {
    // 1. 최근 7일 날짜 라벨 만들기 (오늘 기준)
    const today = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dynamicLabels = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const dayName = days[d.getDay()];
        dynamicLabels.push(`${month}.${date}(${dayName})`);
    }

    // 2. 라벨 적용
    if (reportData && reportData.weekly) {
        reportData.weekly.labels = dynamicLabels;
    }

    // 3. 👇 [핵심] 서버에서 진짜 데이터 가져오기
    if (currentUser) {
        fetch('/api/activity-weekly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
        })
            .then(res => res.json())
            .then(resData => {
                // 받아온 데이터([0, 0, 0, ... 5])로 덮어쓰기
                // 데이터가 없으면 0으로 채움
                const realData = resData.data || [0, 0, 0, 0, 0, 0, 0];

                reportData.weekly.activity = realData;

                // 데이터 준비 끝났으니 차트 그리기!
                renderAllReportCharts();
            })
            .catch(err => {
                console.error('리포트 데이터 로드 실패:', err);
                renderAllReportCharts(); // 에러 나도 빈 차트는 그림
            });
    } else {
        renderAllReportCharts();
    }
}

/**
 * [보조 함수] 모든 리포트 차트 그리기
 */
function renderAllReportCharts() {
    // 기존 차트 파괴
    ['activity', 'sleep', 'emotionReport', 'cognitiveReport', 'envReport'].forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    });

    // 차트 생성 함수들 호출
    initActivityChart();
    initSleepChart();
    initEmotionReportChart();
    initCognitiveReportChart();
    initEnvReportChart();
}



/**
 * (UI 전용) 부정 감정 컬러 그라데이션 생성
 * - 가장 큰 값: 진한 빨간색
 * - 나머지: 비중에 따라 점점 연해지는 빨간 계열
 */
function makeNegativeGradient(values, alpha = 0.85) {
    const dark = { r: 183, g: 28, b: 28 };     // 진한 빨강
    const light = { r: 255, g: 205, b: 210 };  // 연한 빨강(핑크 계열)
    const max = Math.max(...values, 0);
    return values.map(v => {
        const t = max === 0 ? 1 : (1 - (v / max)); // max일수록 t=0(진함)
        const r = Math.round(dark.r + (light.r - dark.r) * t);
        const g = Math.round(dark.g + (light.g - dark.g) * t);
        const b = Math.round(dark.b + (light.b - dark.b) * t);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
}



/**
 * 감정 분석 버블 차트 (대시보드) - 다채로운 색상 버전
 */
function initEmotionBubbleChart() {
    const ctx = document.getElementById('emotion-bubble-chart');
    if (!ctx) return;

    // ✅ 대시보드 데이터
    const positiveJoy = 62; 
    const negative = {
        anger: 6,        // 분노
        sadness: 14,     // 슬픔
        anxiety: 10,     // 불안
        hurt: 5,         // 상처
        embarrassed: 3   // 당황
    };

    // ✅ 감정별 고유 색상 설정 (빨강 일변도에서 탈피)
    const emotionPalette = {
        joy: 'rgba(255, 251, 0, 0.68)',          // 기쁨: 초록
        sadness: 'rgba(54, 162, 235, 0.95)',      // 슬픔: 파랑
        anxiety: 'rgba(153, 102, 255, 0.95)',     // 불안: 보라
        anger: 'rgba(255, 87, 87, 0.95)',         // 분노: 빨강
        hurt: 'rgba(255, 159, 64, 0.95)',        // 상처: 주황
        embarrassed: 'rgba(255, 205, 86, 0.95)'  // 당황: 노랑
    };

    charts.emotionBubble = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['긍정', '부정'],
            datasets: [
                {
                    key: 'joy',
                    label: '기쁨',
                    data: [positiveJoy, 0],
                    backgroundColor: emotionPalette.joy,
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    key: 'sadness',
                    label: '슬픔',
                    data: [0, negative.sadness],
                    backgroundColor: emotionPalette.sadness,
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    key: 'anxiety',
                    label: '불안',
                    data: [0, negative.anxiety],
                    backgroundColor: emotionPalette.anxiety,
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    key: 'anger',
                    label: '분노',
                    data: [0, negative.anger],
                    backgroundColor: emotionPalette.anger,
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    key: 'hurt',
                    label: '상처',
                    data: [0, negative.hurt],
                    backgroundColor: emotionPalette.hurt,
                    borderRadius: 10,
                    borderSkipped: false
                },
                {
                    key: 'embarrassed',
                    label: '당황',
                    data: [0, negative.embarrassed],
                    backgroundColor: emotionPalette.embarrassed,
                    borderRadius: 10,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // 가로 막대
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                x: {
                    stacked: true, // 부정 카테고리 내에서 감정들이 쌓임
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: (v) => v + '%' }
                },
                y: {
                    stacked: true,
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * 인지 활동 차트 (대시보드)
 */
function initCognitiveChart() {
    const ctx = document.getElementById('cognitive-chart');
    if (!ctx) return;

    charts.cognitive = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['대화', '독서', 'TV', '산책'],
            datasets: [{
                data: [30, 15, 45, 20],
                backgroundColor: [
                    'rgba(124, 179, 66, 0.8)',
                    'rgba(255, 183, 77, 0.8)',
                    'rgba(66, 165, 245, 0.8)',
                    'rgba(126, 87, 194, 0.8)'
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 60,
                    ticks: { display: false },
                    grid: { display: false }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * [최종 수정] 실내 환경 차트 (초기화 시점부터 현재 시간 반영)
 */
function initEnvChart() {
    const ctx = document.getElementById('env-chart');
    if (!ctx) return;

    // 1. 👇 [수정됨] 초기 라벨을 '현재 시간' 기준으로 자동 생성 (3초 간격)
    // 기존에 고정된 ['10:00', '10:10'...] 대신 이걸 씁니다.
    const initialLabels = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        // i가 6이면 18초 전, 0이면 현재
        const past = new Date(now.getTime() - (i * 3000)); 
        
        const timeStr = `${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}:${String(past.getSeconds()).padStart(2, '0')}`;
        initialLabels.push(timeStr);
    }

    // 2. 초기 데이터 (랜덤값으로 채움 - DB 연동 전 시뮬레이션용)
    const tempData = [];
    const humidData = [];
    for(let i=0; i<7; i++) {
        tempData.push(23 + Math.random()); // 23.xx 도
        humidData.push(45 + Math.random()); // 45.xx %
    }

    // 3. 차트 생성
    charts.env = new Chart(ctx, {
        type: 'line',
        data: {
            labels: initialLabels, // 👈 위에서 만든 현재 시간 라벨 적용
            datasets: [
                {
                    label: '온도(°C)',
                    data: tempData,
                    borderColor: '#EF5350',
                    backgroundColor: 'rgba(239, 83, 80, 0.1)',
                    fill: true,
                    tension: 0.4,
                },
                {
                    label: '습도(%)',
                    data: humidData,
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    fill: true,
                    tension: 0.4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000 },
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });

    // 4. 실시간 시뮬레이션 시작
    startEnvSimulation();
}

/**
 * [추가됨] 환경 센서 데이터 시뮬레이터 (랜덤 워크)
 */
function startEnvSimulation() {
    // 이미 실행 중이면 중복 실행 방지
    if (window.envInterval) clearInterval(window.envInterval);

    // 3초마다 데이터 갱신
    window.envInterval = setInterval(() => {
        if (!charts.env) return;

        // 현재 차트의 마지막 값 가져오기
        const lastTemp = charts.env.data.datasets[0].data.slice(-1)[0];
        const lastHumid = charts.env.data.datasets[1].data.slice(-1)[0];

        // --- 랜덤 변화 로직 (자연스럽게) ---
        // 온도는 -0.3도 ~ +0.3도 사이로 변함
        let newTemp = lastTemp + (Math.random() - 0.5) * 0.6;
        newTemp = Math.max(18, Math.min(30, newTemp)); // 18~30도 제한

        // 습도는 -2% ~ +2% 사이로 변함
        let newHumid = lastHumid + (Math.random() - 0.5) * 4;
        newHumid = Math.max(30, Math.min(70, newHumid)); // 30~70% 제한

        // --- 데이터 밀어내기 (Queue) ---
        // 1. 라벨 시간 업데이트 (현재 시간)
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        charts.env.data.labels.shift(); // 맨 앞 삭제
        charts.env.data.labels.push(timeStr); // 맨 뒤 추가

        charts.env.data.datasets[0].data.shift();
        charts.env.data.datasets[0].data.push(newTemp); // 온도 추가

        charts.env.data.datasets[1].data.shift();
        charts.env.data.datasets[1].data.push(newHumid); // 습도 추가

        // 차트 업데이트
        charts.env.update();

        // --- 화면 숫자 & 공기질 텍스트 갱신 ---
        const displayTemp = document.getElementById('env-display-temp');
        const displayHumid = document.getElementById('env-display-humidity');
        const displayAir = document.getElementById('env-display-air');

        if (displayTemp) displayTemp.textContent = newTemp.toFixed(1);
        if (displayHumid) displayHumid.textContent = Math.round(newHumid);

        // 공기질 랜덤 결정 (습도가 높으면 나쁨 확률 증가 등 간단한 로직)
        if (displayAir) {
            // 90% 확률로 좋음/보통 유지
            const rand = Math.random();
            if (newHumid > 60 || rand > 0.95) {
                displayAir.textContent = '나쁨';
                displayAir.style.color = '#EF5350'; // 빨강
            } else if (rand > 0.7) {
                displayAir.textContent = '보통';
                displayAir.style.color = '#FFB74D'; // 주황
            } else {
                displayAir.textContent = '좋음';
                displayAir.style.color = '#66BB6A'; // 초록
            }
        }

    }, 3000); // 3초마다 갱신
}



/**
 * [수정됨] 활동량 차트 (리포트) - 걸음 수 -> 움직임 횟수로 변경
 */
function initActivityChart() {
    const ctx = document.getElementById('activity-chart');
    if (!ctx) return;

    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            // reportData.weekly.labels (월~일) 등은 그대로 사용
            labels: reportData.weekly.labels,
            datasets: [{
                // 👇 [수정] 라벨을 '걸음 수'에서 '움직임(회)'로 변경
                label: '움직임(회)',
                data: reportData.weekly.activity,
                // 👇 [수정] 색상을 '활동' 느낌의 주황색 계열로 변경 (기존 초록색 -> 주황색)
                backgroundColor: '#7CB342', // Orange
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                // 👇 [수정] 범례(Legend)가 보이도록 설정 (단위 확인용)
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    // 👇 [추가] Y축 제목 추가
                    title: {
                        display: true,
                        text: '감지 횟수'
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * 수면 차트 (리포트)
 */
function initSleepChart() {
    const ctx = document.getElementById('sleep-chart');
    if (!ctx) return;

    charts.sleep = new Chart(ctx, {
        type: 'line',
        data: {
            labels: reportData.weekly.labels,
            datasets: [{
                label: '수면 시간',
                data: reportData.weekly.sleep,
                borderColor: '#7E57C2',
                backgroundColor: 'rgba(126, 87, 194, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 5,
                    max: 10,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}



/**
 * 감정 변화 차트 (리포트) - 일관된 컬러 적용 버전
 */
function initEmotionReportChart() {
    const ctx = document.getElementById('emotion-report-chart');
    if (!ctx) return;

    const detail = reportData.weekly.emotionDetail;

    // ✅ 대시보드와 동일한 컬러 팔레트 정의 (시각적 일관성)
    const emotionColors = {
        joy: 'rgba(255, 251, 0, 0.68)',          // 기쁨: 초록
        sadness: 'rgba(54, 162, 235, 0.85)',      // 슬픔: 파랑
        anxiety: 'rgba(153, 102, 255, 0.85)',     // 불안: 보라
        anger: 'rgba(255, 87, 87, 0.85)',         // 분노: 빨강
        hurt: 'rgba(255, 159, 64, 0.85)',        // 상처: 주황
        embarrassed: 'rgba(255, 205, 86, 0.85)'  // 당황: 노랑
    };

    charts.emotionReport = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: reportData.weekly.labels,
            datasets: [
                {
                    key: 'joy',
                    label: '기쁨',
                    data: detail.joy,
                    backgroundColor: emotionColors.joy,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    key: 'sadness',
                    label: '슬픔',
                    data: detail.sadness,
                    backgroundColor: emotionColors.sadness,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    key: 'anxiety',
                    label: '불안',
                    data: detail.anxiety,
                    backgroundColor: emotionColors.anxiety,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    key: 'anger',
                    label: '분노',
                    data: detail.anger,
                    backgroundColor: emotionColors.anger,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    key: 'hurt',
                    label: '상처',
                    data: detail.hurt,
                    backgroundColor: emotionColors.hurt,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    key: 'embarrassed',
                    label: '당황',
                    data: detail.embarrassed,
                    backgroundColor: emotionColors.embarrassed,
                    borderRadius: 8,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { boxWidth: 12, usePointStyle: true } // 범례를 점 형태로 깔끔하게
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: (v) => v + '%' },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });
}



/**
 * 인지 활동 차트 (리포트)
 */
function initCognitiveReportChart() {
    const ctx = document.getElementById('cognitive-report-chart');
    if (!ctx) return;

    charts.cognitiveReport = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: reportData.weekly.labels,
            datasets: [{
                label: '활동 시간(분)',
                data: reportData.weekly.cognitive,
                backgroundColor: 'rgba(255, 183, 77, 0.8)',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * 환경 추이 차트 (리포트)
 */
function initEnvReportChart() {
    const ctx = document.getElementById('env-report-chart');
    if (!ctx) return;

    charts.envReport = new Chart(ctx, {
        type: 'line',
        data: {
            labels: reportData.weekly.labels,
            datasets: [
                {
                    label: '온도(°C)',
                    data: reportData.weekly.temperature,
                    borderColor: '#EF5350',
                    backgroundColor: 'rgba(239, 83, 80, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '습도(%)',
                    data: reportData.weekly.humidity,
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15 }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// ========================================
// 14. 마이페이지 기능
// ========================================

/**
 * [최종 수정] 마이페이지 정보 업데이트 (보안 마스킹 적용)
 */
function updateMyPage() {
    if (!currentUser) return;

    // ==========================================
    // 1. 보호자 정보 (마스킹 적용)
    // ==========================================
    document.getElementById('mypage-name').textContent = currentUser.name;
    document.getElementById('mypage-username').textContent = currentUser.username;

    // 연락처 마스킹 (010-****-5678)
    document.getElementById('mypage-phone').textContent = maskPhone(currentUser.phone);

    // 주소 마스킹 (서울시 강남구 ****)
    document.getElementById('mypage-address').textContent = maskAddress(currentUser.address, currentUser.addressDetail);

    // ==========================================
    // 2. 어르신 정보 (마스킹 적용)
    // ==========================================
    if (currentUser.senior) {
        document.getElementById('mypage-senior-name').textContent = currentUser.senior.name;

        const genderText = currentUser.senior.gender === 'male' ? '남성' : '여성';
        document.getElementById('mypage-senior-gender').textContent = genderText;

        document.getElementById('mypage-senior-living').textContent = currentUser.senior.living || '-';

        // 연락처 마스킹
        document.getElementById('mypage-senior-phone').textContent = maskPhone(currentUser.senior.phone);

        // 생년월일 마스킹 (1945년 **월 **일)
        document.getElementById('mypage-senior-birth').textContent = maskBirthDate(
            currentUser.senior.birthYear,
            currentUser.senior.birthMonth,
            currentUser.senior.birthDay
        );

        // 주소 마스킹
        document.getElementById('mypage-senior-address').textContent = maskAddress(
            currentUser.senior.address, 
            currentUser.senior.addressDetail
        );
    }
}

/**
 * 비밀번호 변경 폼 토글
 */
function togglePasswordForm() {
    const wrapper = document.getElementById('password-form-wrapper');
    const header = document.querySelector('.password-header');

    wrapper.classList.toggle('active');
    header.classList.toggle('active');
}

/**
 * [최종 수정] 비밀번호 변경 (서버 DB 연동)
 */
function changePassword() {
    const currentPw = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    const confirmPw = document.getElementById('new-password-confirm').value;

    // 1. 기본 입력 체크
    if (!currentPw) {
        const wrapper = document.getElementById('current-password').closest('.input-wrapper');
        setFieldError(wrapper, '현재 비밀번호를 입력해주세요.');
        return;
    }

    if (!newPw) {
        const wrapper = document.getElementById('new-password').closest('.input-wrapper');
        setFieldError(wrapper, '새 비밀번호를 입력해주세요.');
        return;
    }

    if (newPw !== confirmPw) {
        const wrapper = document.getElementById('new-password-confirm').closest('.input-wrapper');
        setFieldError(wrapper, '새 비밀번호가 일치하지 않습니다.');
        return;
    }

    // 2. 서버에 변경 요청 (DB까지 진짜로 바꿈!)
    fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: currentUser.username, // 로그인한 아이디
            currentPassword: currentPw,     // 입력한 옛날 비번
            newPassword: newPw              // 바꿀 새 비번
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                // 실패 시 (예: 현재 비번 틀림)
                const wrapper = document.getElementById('current-password').closest('.input-wrapper');
                setFieldError(wrapper, '현재 비밀번호가 일치하지 않습니다.');
            } else {
                // 성공 시
                showToast('success', '변경 완료', '비밀번호가 성공적으로 변경되었습니다.');

                // 입력창 비우고 닫기
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('new-password-confirm').value = '';
                togglePasswordForm();
            }
        })
        .catch(error => {
            console.error('통신 에러:', error);
            showToast('danger', '오류', '서버와 연결할 수 없습니다.');
        });
}

/**
 * 정보 수정 모달 열기
 * @param {string} type - 'guardian' 또는 'senior'
 */
function openEditModal(type) {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-modal-title');
    const body = document.getElementById('edit-modal-body');
    const saveBtn = document.getElementById('edit-modal-save');

    if (type === 'guardian') {
        title.innerHTML = '<span class="material-icons-round">edit</span> 내 정보 수정';
        body.innerHTML = `
            <form id="edit-guardian-form">
                <div class="input-wrapper">
                    <label>연락처 <span class="required">*</span></label>
                    <input type="tel" id="edit-guardian-phone" value="${currentUser?.phone || ''}" data-rule="phone">
                    <span class="error-text"></span>
                </div>
                <div class="input-wrapper">
                    <label>우편번호</label>
                    <div class="input-with-btn">
                        <input type="text" id="edit-guardian-zipcode" value="${currentUser?.zipcode || ''}" readonly>
                        <button type="button" class="btn btn-sm btn-outline" onclick="searchAddress('edit-guardian')">주소검색</button>
                    </div>
                </div>
                <div class="input-wrapper">
                    <label>기본주소</label>
                    <input type="text" id="edit-guardian-address" value="${currentUser?.address || ''}" readonly>
                </div>
                <div class="input-wrapper">
                    <label>상세주소 <span class="required">*</span></label>
                    <input type="text" id="edit-guardian-address-detail" value="${currentUser?.addressDetail || ''}" placeholder="상세주소">
                    <span class="error-text"></span>
                </div>
            </form>
        `;
        saveBtn.onclick = saveGuardianInfo;
    } else {
        title.innerHTML = '<span class="material-icons-round">edit</span> 어르신 정보 수정';
        body.innerHTML = `
            <form id="edit-senior-form">
                <div class="input-wrapper">
                    <label>연락처</label>
                    <input type="tel" id="edit-senior-phone" value="${currentUser?.senior?.phone || ''}" data-rule="phone-optional">
                    <span class="error-text"></span>
                </div>
                <div class="input-wrapper">
                    <label>우편번호</label>
                    <div class="input-with-btn">
                        <input type="text" id="edit-senior-zipcode" value="${currentUser?.senior?.zipcode || ''}" readonly>
                        <button type="button" class="btn btn-sm btn-outline" onclick="searchAddress('edit-senior')">주소검색</button>
                    </div>
                </div>
                <div class="input-wrapper">
                    <label>기본주소</label>
                    <input type="text" id="edit-senior-address" value="${currentUser?.senior?.address || ''}" readonly>
                </div>
                <div class="input-wrapper">
                    <label>상세주소 <span class="required">*</span></label>
                    <input type="text" id="edit-senior-address-detail" value="${currentUser?.senior?.addressDetail || ''}" placeholder="상세주소">
                    <span class="error-text"></span>
                </div>
            </form>
        `;
        saveBtn.onclick = saveSeniorInfo;
    }

    // 전화번호 포맷팅 이벤트 바인딩
    const phoneInput = body.querySelector('input[data-rule="phone"], input[data-rule="phone-optional"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 3 && value.length <= 7) {
                value = value.slice(0, 3) + '-' + value.slice(3);
            } else if (value.length > 7) {
                value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
            }
            e.target.value = value;
        });
    }

    openModal('edit-modal');
}

/**
 * [수정됨] 보호자 정보 저장 (DB 연동)
 */
function saveGuardianInfo() {
    const phone = document.getElementById('edit-guardian-phone').value.trim();
    const zipcode = document.getElementById('edit-guardian-zipcode').value;
    const address = document.getElementById('edit-guardian-address').value;
    const addressDetail = document.getElementById('edit-guardian-address-detail').value.trim();

    // 검증
    if (!phone || !/^010-\d{4}-\d{4}$/.test(phone)) {
        const wrapper = document.getElementById('edit-guardian-phone').closest('.input-wrapper');
        setFieldError(wrapper, '올바른 전화번호를 입력해주세요.');
        return;
    }
    if (!addressDetail) {
        const wrapper = document.getElementById('edit-guardian-address-detail').closest('.input-wrapper');
        setFieldError(wrapper, '상세주소를 입력해주세요.');
        return;
    }

    // 서버 전송
    fetch('/api/update-guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: currentUser.username, // 누구인지 식별
            phone: phone,
            zipcode: zipcode,
            address: address,
            addressDetail: addressDetail
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showToast('danger', '수정 실패', '정보 수정 중 오류가 발생했습니다.');
            } else {
                // 성공 시 화면 갱신
                currentUser.phone = phone;
                currentUser.zipcode = zipcode;
                currentUser.address = address;
                currentUser.addressDetail = addressDetail;

                updateMyPage();
                closeModal('edit-modal');
                showToast('success', '저장 완료', '내 정보가 수정되었습니다.');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('danger', '연결 실패', '서버와 통신할 수 없습니다.');
        });
}

/**
 * [수정됨] 어르신 정보 저장 (DB 연동)
 */
function saveSeniorInfo() {
    const phone = document.getElementById('edit-senior-phone').value.trim();
    const zipcode = document.getElementById('edit-senior-zipcode').value;
    const address = document.getElementById('edit-senior-address').value;
    const addressDetail = document.getElementById('edit-senior-address-detail').value.trim();

    // 검증
    if (phone && !/^010-\d{4}-\d{4}$/.test(phone)) {
        const wrapper = document.getElementById('edit-senior-phone').closest('.input-wrapper');
        setFieldError(wrapper, '올바른 전화번호를 입력해주세요.');
        return;
    }
    if (!addressDetail) {
        const wrapper = document.getElementById('edit-senior-address-detail').closest('.input-wrapper');
        setFieldError(wrapper, '상세주소를 입력해주세요.');
        return;
    }

    // 서버 전송
    fetch('/api/update-senior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: currentUser.username, // 보호자 아이디로 어르신 찾음
            phone: phone,
            zipcode: zipcode,
            address: address,
            addressDetail: addressDetail
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showToast('danger', '수정 실패', '정보 수정 중 오류가 발생했습니다.');
            } else {
                // 성공 시 화면 갱신
                if (currentUser.senior) {
                    currentUser.senior.phone = phone;
                    currentUser.senior.zipcode = zipcode;
                    currentUser.senior.address = address;
                    currentUser.senior.addressDetail = addressDetail;
                }

                updateMyPage();
                closeModal('edit-modal');
                showToast('success', '저장 완료', '어르신 정보가 수정되었습니다.');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('danger', '연결 실패', '서버와 통신할 수 없습니다.');
        });
}

/**
 * [수정] 알림 설정 토글 (전역 변수 즉시 업데이트)
 */
function toggleNotification(type) {
    const checkbox = document.getElementById(`alert-${type}`);
    const isChecked = checkbox.checked;

    // 1. 핵심! 전역 변수 값을 바로 바꿔줍니다.
    if (type === 'abnormal') {
        isAbnormalAlertOn = isChecked;
    } else if (type === 'emergency') {
        isEmergencyAlertOn = isChecked;
    }

    // 2. 나중을 위해 저장소에도 저장
    localStorage.setItem(`setting_${type}`, isChecked);

    // 3. 안내 메시지
    const status = isChecked ? '활성화' : '비활성화';
    const typeName = type === 'abnormal' ? '이상 행동 감지' : '응급상황';
    showToast('info', '알림 설정 저장', `${typeName} 알림이 ${status}되었습니다.`);

    console.log(`🔔 설정 변경됨: ${type} -> ${isChecked}`);
}


// ========================================
// 15. 알림 기능
// ========================================

/**
 * [수정됨] 대시보드 알림 렌더링 (클릭 기능 제거됨)
 */
function renderNotifications() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    // 최근 3개만 표시
    const recentNotifications = notifications.slice(0, 10);

    container.innerHTML = recentNotifications.map(notif => `
        <div class="notif-item ${notif.type} ${notif.read ? '' : 'unread'}">
            <div class="notif-item-icon">
                <span class="material-icons-round">${getNotifIcon(notif.type)}</span>
            </div>
            <div class="notif-item-text">
                <div class="notif-item-title">${notif.title}</div>
                <div class="notif-item-sub">${notif.time}</div>
            </div>
        </div>
    `).join('');

    // 뱃지 업데이트
    updateNotificationBadge();
}

/**
 * 알림 아이콘 반환
 * @param {string} type - 알림 타입
 */
function getNotifIcon(type) {
    switch (type) {
        case 'danger': return 'error';
        case 'warning': return 'warning';
        default: return 'info';
    }
}

/**
 * 알림 선택
 * @param {number} id - 알림 ID
 */
function selectNotification(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        notif.read = true;
        showToast('info', notif.title, notif.message);
        updateNotificationBadge();
    }
}

/**
 * 알림 뱃지 업데이트
 */
function updateNotificationBadge() {
    const badge = document.getElementById('nav-bell-badge');
    if (!badge) return;

    const unreadCount = notifications.filter(n => !n.read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
}

/**
 * [수정됨] 알림 모달 열기 (여는 순간 DB까지 모두 읽음 처리!)
 */
function openNotificationModal() {
    // 1. 서버에 '모두 읽음' 요청 전송 (DB 저장 -> 새로고침 해도 유지됨!)
    fetch('/api/alert-read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(data => {
            console.log("📭 알림 전체 읽음 처리 완료 (DB 저장됨)");
        })
        .catch(err => console.error("전체 읽음 처리 실패:", err));

    // 2. 화면(UI)에서도 즉시 '읽음'으로 변경
    notifications.forEach(n => {
        n.read = true;
    });

    // 3. 뱃지 없애기 & 목록 다시 그리기
    updateNotificationBadge();
    renderNotifications(); // 대시보드 업데이트
    renderFullNotifications('all'); // 모달 목록 업데이트

    // 4. 모달 열기
    openModal('notification-modal');
}

/**
 * [수정됨] 전체 알림 렌더링 (클릭 기능 제거됨)
 */
function renderFullNotifications(filter) {
    const container = document.getElementById('full-notification-list');
    if (!container) return;

    let filtered = notifications;
    if (filter === 'unread') {
        filtered = notifications.filter(n => !n.read);
    } else if (filter === 'danger') {
        filtered = notifications.filter(n => n.type === 'danger');
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">알림이 없습니다</p>';
        return;
    }

    container.innerHTML = filtered.map(notif => `
        <div class="full-notif-item ${notif.type} ${notif.read ? '' : 'unread'}">
            <div class="full-notif-icon">
                <span class="material-icons-round">${getNotifIcon(notif.type)}</span>
            </div>
            <div class="full-notif-content">
                <h4>${notif.title}</h4>
                <p>${notif.message}</p>
                <span class="notif-time">${notif.time}</span>
            </div>
        </div>
    `).join('');
}

/**
 * 알림 필터링
 * @param {string} filter - 필터 타입
 * @param {HTMLElement} btn - 클릭된 버튼
 */
function filterNotifications(filter, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFullNotifications(filter);
}

// ========================================
// 16. 모달 처리
// ========================================

/**
 * 모달 열기
 * @param {string} modalId - 모달 ID
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * 모달 닫기
 * @param {string} modalId - 모달 ID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ========================================
// 17. 토스트 알림
// ========================================

/**
 * 토스트 알림 표시
 * @param {string} type - 'success', 'warning', 'danger', 'info'
 * @param {string} title - 제목
 * @param {string} message - 메시지
 */
function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: 'check_circle',
        warning: 'warning',
        danger: 'error',
        info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="material-icons-round toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <span class="material-icons-round">close</span>
        </button>
    `;

    container.appendChild(toast);

    // 자동 제거 (4초)
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ========================================
// 18. 보미 AI 비서
// ========================================

/**
 * 보미 메시지 초기화
 */
function initBomiMessages() {
    const messages = [
        '오늘도 좋은 하루 되세요! 🌸',
        '어르신 건강을 함께 지켜요 💚',
        '궁금한 점이 있으시면 말씀해주세요!',
        '늘봄이 항상 곁에 있어요 🌿',
        '오늘 어르신 컨디션이 좋아 보여요!',
        '산책하기 좋은 날씨예요 ☀️',
        '수분 섭취 잊지 마세요! 💧'
    ];

    const bubble = document.getElementById('bomi-bubble');
    if (!bubble) return;

    let index = 0;
    setInterval(() => {
        index = (index + 1) % messages.length;
        bubble.style.opacity = '0';
        setTimeout(() => {
            bubble.textContent = messages[index];
            bubble.style.opacity = '1';
        }, 200);
    }, 8000);
}

// ========================================
// 19. 유틸리티 함수
// ========================================

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 대기 시간(ms)
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 로컬 스토리지에 사용자 데이터 저장
 */
function saveUserData() {
    if (currentUser) {
        localStorage.setItem('neulbom_user', JSON.stringify(currentUser));
    }
}

/**
 * 로컬 스토리지에서 사용자 데이터 불러오기
 */
function loadUserData() {
    const saved = localStorage.getItem('neulbom_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        
        if (currentUser && currentUser.username) {
            sessionStorage.setItem('username', currentUser.username);
            localStorage.setItem('username', currentUser.username);
        }
        
        return true;
    }
    return false;
}


/* ========================================
 * 20. 실시간 알림 폴링 시스템 (최종 수정)
 * ======================================== */

let lastProcessedAlertId = null;

document.addEventListener('DOMContentLoaded', function () {
    console.log("📡 실시간 알림 감시 시작...");

    // 페이지 로드 시 기존 더미 데이터를 비우고 싶다면 아래 주석 해제
    // alertHistory = []; 
    // updateAllUI();

    startAlertPolling();
});

function startAlertPolling() {
    setInterval(() => {
        fetch('/api/check-alert')
            .then(response => response.json())
            .then(data => {
                // 데이터가 있고, 새로운 ID일 때만 처리
                if (data && data.alert_id !== lastProcessedAlertId) {
                    handleNewAlert(data);
                }
            })
            .catch(error => console.error('알림 확인 중 에러:', error));
    }, 3000);
}

/**
 * [최종 수정] 새 알림 처리 함수 (DB 데이터 이름 변환 및 필터링)
 */
function handleNewAlert(data) {
    // 1. 중복 방지
    if (lastProcessedAlertId === data.alert_id) return;
    lastProcessedAlertId = data.alert_id;

    // ============================================================
    // 👇 [핵심 수정] DB의 이름을 코드용 이름으로 번역(매핑)합니다.
    // ============================================================
    const rawType = String(data.alert_type).toLowerCase().trim(); // 소문자로 변환 (emergency, no movement)
    let normalizedType = 'info'; // 기본값

    // 1. "Emergency" 또는 "danger" -> "danger"로 통일
    if (rawType.includes('emergency') || rawType === 'danger') {
        normalizedType = 'danger';
    }
    // 2. "No Movement" 또는 "warning" -> "warning"으로 통일
    else if (rawType.includes('no movement') || rawType === 'warning') {
        normalizedType = 'warning';
    }

    // 디버깅 로그 (이제 정확한 타입이 찍힐 겁니다)
    console.log(`🔍 [타입 변환] DB: "${data.alert_type}" -> 코드: "${normalizedType}"`);
    console.log(`   [설정 확인] 이상행동: ${isAbnormalAlertOn}, 응급: ${isEmergencyAlertOn}`);

    // ============================================================
    // 👇 필터링 (차단 로직) - 이제 normalizedType으로 검사합니다.
    // ============================================================

    // 타입이 'warning'(No Movement)이고 스위치가 꺼져있으면 -> 차단
    if (normalizedType === 'warning' && !isAbnormalAlertOn) {
        console.log("⛔️ [차단 성공] 이상행동(미동 없음) 알림이 차단되었습니다.");
        return;
    }

    // 타입이 'danger'(Emergency)이고 스위치가 꺼져있으면 -> 차단
    if (normalizedType === 'danger' && !isEmergencyAlertOn) {
        console.log("⛔️ [차단 성공] 응급상황 알림이 차단되었습니다.");
        return;
    }

    // ============================================================
    // 👇 통과된 알림 처리
    // ============================================================
    console.log("✅ 알림 허용됨. 화면에 표시합니다.");

    const newAlert = {
        id: data.alert_id,
        // UI에는 변환된 타입(danger/warning)을 사용해서 색상이 제대로 나오게 함
        type: normalizedType,
        title: getAlertTitle(normalizedType), // 제목도 변환된 타입 기준
        message: data.alert_content,
        time: data.sented_at,
        read: false,
        resolved: false
    };

    notifications.unshift(newAlert);

    alertHistory.unshift({
        id: newAlert.id,
        type: newAlert.type,
        title: newAlert.title,
        description: newAlert.message,
        time: newAlert.time,
        resolved: false
    });

    updateAllUI();
}

function getAlertTitle(type) {
    if (type === 'danger') return '🚨 긴급 위험 감지';
    if (type === 'warning') return '⚠️ 주의 요망';
    return '알림';
}

function updateAllUI() {
    updateNotificationBadge();
    renderNotifications();
    renderAlertHistory(); // 여기서 정렬과 필터링이 수행됨

    const modal = document.getElementById('notification-modal');
    if (modal && modal.classList.contains('active')) {
        renderFullNotifications('all');
    }
}




// ========================================
// 21. 보미와 대화 (마이크 녹음 및 UI 제어)
// ========================================

// ========================================
// 보미와 대화 - 완전한 음성 녹음 + FastAPI 연동
// 
// 사용법:
// 1. script.js의 3225~3279줄을 이 코드로 교체
// 2. 또는 script.js 파일 끝에 이 코드 추가
// ========================================

// 전역 변수
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let conversationCount = 0;
let totalWords = 0;
let sessionStartTime = null;
let currentSensingId = null;

/**
 * 녹음 토글 함수 (실제 녹음 기능 포함)
 */
async function toggleRecording() {
    if (!isRecording) {
        // 녹음 시작
        await startRecording();
    } else {
        // 녹음 중지 및 전송
        await stopRecording();
    }
}

/**
 * 녹음 시작
 */
async function startRecording() {

    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    currentSensingId = await createVoiceSession(username);
    console.log('🎯 sensing_id:', currentSensingId);

    try {
        console.log('🎤 녹음 시작 시도...');

        // 1. 마이크 권한 요청
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        // 2. MediaRecorder 생성 (브라우저 호환성 체크)
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
            }
        }

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType
        });

        audioChunks = [];

        // 3. 데이터 수집
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log(`📦 오디오 청크 수집: ${event.data.size} bytes`);
            }
        };

        // 4. 녹음 중지 시 처리
        mediaRecorder.onstop = async () => {
            console.log('⏹️ 녹음 중지됨, 총 청크:', audioChunks.length);
            
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                console.log(`📊 생성된 Blob 크기: ${audioBlob.size} bytes`);
                await sendToServer(audioBlob);
            } else {
                console.warn('⚠️ 녹음된 데이터가 없습니다');
                showToast('warning', '녹음 실패', '녹음된 데이터가 없습니다. 다시 시도해주세요.');
                resetRecordingUI();
            }
            
            // 스트림 정리
            stream.getTracks().forEach(track => track.stop());
        };

        // 5. 에러 처리
        mediaRecorder.onerror = (event) => {
            console.error('❌ MediaRecorder 오류:', event.error);
            showToast('danger', '녹음 오류', '녹음 중 오류가 발생했습니다.');
            resetRecordingUI();
        };

        // 6. 녹음 시작
        mediaRecorder.start();
        isRecording = true;

        setBomiState('listening');

        // 세션 시작 시간 기록
        if (!sessionStartTime) {
            sessionStartTime = Date.now();
        }

        // 7. UI 업데이트
        updateRecordingUI(true);

        console.log('✅ 녹음 시작 성공');

    } catch (error) {
        console.error('❌ 마이크 권한 오류:', error);
        
        let errorMessage = '마이크 권한을 허용해주세요.';
        if (error.name === 'NotAllowedError') {
            errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
        }
        
        showToast('danger', '마이크 오류', errorMessage);
        isRecording = false;
    }
}

/**
 * 녹음 중지
 */
async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.log('⏹️ 녹음 중지 요청...');
        mediaRecorder.stop();
        isRecording = false;

        // UI 업데이트 (분석 중 상태)
        updateRecordingUI(false, true);
    }
}

/**
 * UI 업데이트 (녹음 상태)
 * @param {boolean} recording - 녹음 중 여부
 * @param {boolean} analyzing - 분석 중 여부
 */
function updateRecordingUI(recording, analyzing = false) {
    const btn = document.getElementById('record-btn');
    const icon = document.getElementById('record-icon');
    const hint = document.getElementById('record-hint');
    const wave = document.getElementById('voice-wave');
    const status = document.getElementById('bomi-status');
    const realtimeText = document.getElementById('realtime-text');

    if (recording) {
        // 녹음 중
        btn.classList.add('recording');
        icon.textContent = 'stop';
        hint.textContent = '말씀하세요...';
        
        if (wave) wave.classList.add('active');
        if (status) {
            status.textContent = "🎤 듣고 있어요...";
            status.style.color = "#EF5350";
        }
        if (realtimeText) {
            realtimeText.classList.add('active');
            realtimeText.textContent = "녹음 중...";
        }
    } else if (analyzing) {
        // 분석 중
        btn.classList.remove('recording');
        btn.disabled = true; // 분석 중엔 버튼 비활성화
        icon.textContent = 'mic';
        hint.textContent = '분석 중...';
        
        if (wave) wave.classList.remove('active');
        if (status) {
            status.textContent = "⏳ 분석 중...";
            status.style.color = "#FFB74D";
        }
        if (realtimeText) {
            realtimeText.textContent = "음성 분석 중...";
        }
    } else {
        // 대기 중
        btn.classList.remove('recording');
        btn.disabled = false;
        icon.textContent = 'mic';
        hint.textContent = '버튼을 눌러 말하기';
        
        if (wave) wave.classList.remove('active');
        if (status) {
            status.textContent = "대기 중";
            status.style.color = "#666";
        }
        if (realtimeText) {
            realtimeText.textContent = "";
            realtimeText.classList.remove('active');
        }
    }
}

/**
 * UI 리셋 (에러 발생 시)
 */
function resetRecordingUI() {
    updateRecordingUI(false, false);
    isRecording = false;
    if (mediaRecorder) {
        mediaRecorder = null;
    }
}

/**
 * FastAPI 서버로 음성 전송
 */
async function sendToServer(audioBlob) {
    try {
        console.log('📤 서버로 전송 시작...');

        // WAV 변환
        console.log('🔄 WAV 변환 시작...');
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wavBlob = await audioBufferToWav(audioBuffer);
        console.log(`✅ WAV 변환 완료: ${wavBlob.size} bytes`);

        // FormData 만들기
        const formData = new FormData();
        formData.append('audio_file', wavBlob, 'recording.wav'); // ✅ WAV 사용!

        const seniorId = currentUser?.senior?.senior_id || 1;
        formData.append('senior_id', seniorId); // ✅ 1번만
        formData.append('sensing_id', currentSensingId);
        formData.append('generate_response', 'true'); // ✅ 1번만

        // 스트리밍 방식으로 요청
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const status = document.getElementById('bomi-status');
        const realtimeText = document.getElementById('realtime-text');

        // ========================================
        // 🎨 진행 바 요소 추가 (안전하게!)
        // ========================================
        let progressContainer = document.querySelector('.progress-container');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            progressContainer.innerHTML = `
                <div class="progress-bar-wrapper">
                    <div class="progress-bar" id="analysis-progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text" id="analysis-progress-text">준비 중...</div>
                </div>
            `;
            
            // ✅ 가장 안전: body 최상단에 추가 (fixed 위치라 상관없음!)
            document.body.appendChild(progressContainer);
        }

        // 재사용 시 초기화
        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressContainer.style.opacity = '1';
        }

        const progressBar = document.querySelector('.progress-fill');
        const progressText = document.getElementById('analysis-progress-text');

        if (progressBar) {
            progressBar.style.width = '0%';
        }
        if (progressText) {
            progressText.textContent = '준비 중...';
            progressText.style.color = '#666';
        }

        // ========================================
        // 📊 단계별 진행률 맵핑 (초록색 통일!)
        // ========================================
        const stepProgress = {
            1: { percent: 10, text: '📋 파일 준비 완료', color: '#4CAF50' },
            2: { percent: 25, text: '🎤 음성 인식 중...', color: '#66BB6A' },
            3: { percent: 50, text: '✅ 텍스트 변환 완료', color: '#4CAF50' },
            4: { percent: 70, text: '❤️ 감정 분석 완료', color: '#81C784' },
            5: { percent: 85, text: '🤖 AI 응답 생성 중...', color: '#66BB6A' },
            6: { percent: 95, text: '💾 저장 중...', color: '#A5D6A7' },
            'complete': { percent: 100, text: '✨ 완료!', color: '#4CAF50' }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
            
                    // 에러 처리
                    if (data.error) {
                        throw new Error(data.error);
                    }
            
                    // ========================================
                    // 🎨 진행 상황 시각화 (강화!)
                    // ========================================
                    if (data.step && data.step !== 'complete') {
                        const stepInfo = stepProgress[data.step];
                
                        if (stepInfo && progressBar && progressText) {
                            // 진행 바 업데이트
                            progressBar.style.width = stepInfo.percent + '%';
                            progressBar.style.backgroundColor = stepInfo.color;
                    
                            // 진행 텍스트 업데이트
                            progressText.textContent = stepInfo.text;
                            progressText.style.color = stepInfo.color;
                    
                            // 상태 메시지도 업데이트
                            if (status) {
                                status.textContent = stepInfo.text;
                                status.style.color = stepInfo.color;
                                status.style.fontSize = '1.1rem';
                                status.style.fontWeight = 'bold';
                            }
                        }
                
                        // STT 텍스트 미리보기
                        if (data.text && realtimeText) {
                            realtimeText.textContent = `"${data.text.substring(0, 50)}..."`;
                            realtimeText.style.opacity = '1';
                            realtimeText.style.animation = 'fadeIn 0.3s ease-in';
                        }
                
                        // 텍스트 미리보기 (추가)
                        if (data.text_preview && realtimeText) {
                            realtimeText.textContent = `"${data.text_preview}..."`;
                            realtimeText.style.opacity = '1';
                        }

                        if (data.step === 2 || data.step === 3 || data.step === 4) {
                            setBomiState('thinking');  // STT/감정 분석 중
                        }
                        if (data.step === 5) {
                            setBomiState('thinking');  // AI 응답 생성 중
                        }
                    }
            
                    // ========================================
                    // ✨ 최종 완료
                    // ========================================
                    else if (data.step === 'complete') {
                        // 진행 바 100%
                        if (progressBar && progressText) {
                            progressBar.style.width = '100%';
                            progressBar.style.backgroundColor = '#4CAF50';
                            progressText.textContent = '✨ 분석 완료!';
                            progressText.style.color = '#4CAF50';
                    
                            // 2초 후 진행 바 숨기기
                            setTimeout(() => {
                                if (progressContainer) {
                                    progressContainer.style.opacity = '0';
                                    progressContainer.style.transition = 'opacity 0.5s';
                                    setTimeout(() => {
                                        progressContainer.style.display = 'none';
                                    }, 500);
                                }
                            }, 2000);
                        }
                
                        console.log('✅ 분석 완료:', data);
                        displayAnalysisResult(data);
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ 전송 오류:', error);
        showToast('danger', '연결 오류', error.message);
        resetRecordingUI();
    }
}
/**
 * 분석 결과를 화면에 표시
 */
function displayAnalysisResult(result) {
    console.log('🎨 UI 업데이트 시작...');

    try {
        const analysis = result.analysis;
        const aiResponse = result.ai_response;

        // 1. STT 텍스트 표시 (사용자 메시지)
        if (analysis && analysis.text) {
            addChatMessage('user', analysis.text);
            console.log('   ✓ 사용자 메시지 추가됨');
        }

        // 2. AI 응답 표시 (보미 메시지)
        if (aiResponse) {
            setTimeout(() => {
                addChatMessage('bomi', aiResponse);
                console.log('   ✓ 보미 응답 추가됨');
                bomiTTS.speak(
                    aiResponse,
                    () => setBomiState('speaking'),  // 시작: 말하는 중
                    () => setBomiState('idle')       // 종료: 대기 중
                );
            }, 500);
        }

        // 3. 분석 결과 업데이트
        if (analysis) {
            updateAnalysisPanel(analysis);
            console.log('   ✓ 분석 패널 업데이트됨');

            // 4. 통계 업데이트
            conversationCount++;
            if (analysis.whisper && analysis.whisper.word_count) {
                totalWords += analysis.whisper.word_count;
            }
            updateConversationStats();
            console.log('   ✓ 통계 업데이트됨');
        }

        // 5. 성공 상태 표시
        const status = document.getElementById('bomi-status');
        if (status) {
            status.textContent = "✅ 분석 완료!";
            status.style.color = "#66BB6A";
            setTimeout(() => {
                status.textContent = "대기 중";
                status.style.color = "#666";
            }, 2000);
        }

        // 6. UI 리셋
        setTimeout(() => {
            resetRecordingUI();
        }, 500);

        console.log('✅ UI 업데이트 완료');

    } catch (error) {
        console.error('❌ UI 업데이트 오류:', error);
        showToast('warning', '표시 오류', '결과를 표시하는 중 오류가 발생했습니다.');
        resetRecordingUI();
    }
}

/**
 * 대화 메시지 추가
 */
function addChatMessage(sender, text) {
    const messagesContainer = document.getElementById('chat-messages');
    const emptyState = document.getElementById('chat-empty-state');

    if (!messagesContainer) {
        console.warn('⚠️ chat-messages 컨테이너를 찾을 수 없습니다');
        return;
    }

    // 첫 메시지면 빈 상태 숨기기
    if (emptyState && !emptyState.classList.contains('minimized')) {
        // 보미를 숨기지 않고 작게 만들기
        emptyState.classList.add('minimized');
        
        // 인사말 숨기기
        const greeting = emptyState.querySelector('.bomi-greeting');
        if (greeting) {
            greeting.style.display = 'none';
        }
        
        // 보미 아바타만 작게 표시
        const avatar = emptyState.querySelector('.bomi-avatar');
        if (avatar) {
            avatar.style.transform = 'scale(0.6)';
            avatar.style.marginBottom = '10px';
        }
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(text)}</div>
                <div class="message-time">${timeStr}</div>
            </div>
            <div class="message-avatar">
                <span class="material-icons-round">person</span>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-avatar bomi">
                <img src="static/images/bomi-welcome.png" alt="보미">
            </div>
            <div class="message-content">
                <div class="message-text">${escapeHtml(text)}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * HTML 이스케이프 (XSS 방지)
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 분석 패널 업데이트
 */
function updateAnalysisPanel(analysis) {
    // 감정
    const emotionEl = document.getElementById('analysis-emotion');
    if (emotionEl && analysis.emotion) {
        const emotion = analysis.emotion.final || '중립';
        const confidence = analysis.emotion.confidence 
            ? (analysis.emotion.confidence * 100).toFixed(0) 
            : '0';
        emotionEl.textContent = `${emotion} (${confidence}%)`;
        emotionEl.style.color = getEmotionColor(emotion);
    }

    // 음성 톤
    const toneEl = document.getElementById('analysis-tone');
    if (toneEl && analysis.emotion) {
        toneEl.textContent = analysis.emotion.decision || '정상';
        toneEl.style.color = analysis.emotion.decision === '주의' || analysis.emotion.decision === '위험' 
            ? '#EF5350' : '#66BB6A';
    }

    // 말하기 속도
    const speedEl = document.getElementById('analysis-speed');
    if (speedEl && analysis.whisper && analysis.whisper.wpm) {
        const wpm = analysis.whisper.wpm.toFixed(0);
        speedEl.textContent = `${wpm} WPM`;
        
        // 속도에 따른 색상
        if (wpm < 50) {
            speedEl.style.color = '#42A5F5'; // 느림
        } else if (wpm > 150) {
            speedEl.style.color = '#EF5350'; // 빠름
        } else {
            speedEl.style.color = '#66BB6A'; // 정상
        }
    }

    // 명확도 (점수 기반)
    const clarityEl = document.getElementById('analysis-clarity');
    if (clarityEl && analysis.scores && analysis.scores.average) {
        const score = analysis.scores.average.toFixed(0);
        clarityEl.textContent = `${score}점`;
        
        // 점수에 따른 색상
        if (score >= 80) {
            clarityEl.style.color = '#66BB6A';
        } else if (score >= 60) {
            clarityEl.style.color = '#FFB74D';
        } else {
            clarityEl.style.color = '#EF5350';
        }
    }
}

/**
 * 감정에 따른 색상 반환
 */
function getEmotionColor(emotion) {
    const colors = {
        '기쁨': '#66BB6A',
        '중립': '#FFB74D',
        '분노': '#EF5350',
        '슬픔': '#42A5F5',
        '불안': '#FFA726',
        '혐오': '#9C27B0'
    };
    return colors[emotion] || '#666';
}

function setBomiState(state) {
    const bomiAvatar = document.querySelector('.bomi-avatar');
    const bomiStatus = document.getElementById('bomi-status');
    const voiceWave = document.getElementById('voice-wave');
    
    if (!bomiAvatar) return;
    
    // 기존 상태 클래스 제거
    bomiAvatar.classList.remove('listening', 'thinking', 'speaking');
    
    switch(state) {
        case 'listening':
            bomiAvatar.classList.add('listening');
            if (bomiStatus) bomiStatus.textContent = '듣고 있어요 🎤';
            if (voiceWave) voiceWave.classList.add('active');
            break;
            
        case 'thinking':
            bomiAvatar.classList.add('thinking');
            if (bomiStatus) bomiStatus.textContent = '생각하는 중... 🤔';
            if (voiceWave) voiceWave.classList.remove('active');
            break;
            
        case 'speaking':
            bomiAvatar.classList.add('speaking');
            if (bomiStatus) bomiStatus.textContent = '말하고 있어요 💬';
            if (voiceWave) voiceWave.classList.remove('active');
            break;
            
        case 'idle':
        default:
            if (bomiStatus) bomiStatus.textContent = '대기 중';
            if (voiceWave) voiceWave.classList.remove('active');
            break;
    }
}

// ============================================
// TTS 핸들러 클래스
// ============================================

class BomiTTS {
    constructor() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.enabled = true;
            this.voice = null;
            this.rate = 1.0;
            this.pitch = 1.2;
            this.volume = 1.0;
            this.loadKoreanVoice();
        } else {
            console.warn('⚠️ TTS 미지원');
            this.enabled = false;
        }
    }
    
    loadKoreanVoice() {
        const loadVoices = () => {
            const voices = this.synth.getVoices();
            this.voice = voices.find(v => v.lang === 'ko-KR') ||
                        voices.find(v => v.lang.startsWith('ko')) ||
                        voices[0];
            if (this.voice) {
                console.log('✅ TTS 음성:', this.voice.name);
            }
        };
        
        if (this.synth.getVoices().length > 0) {
            loadVoices();
        } else {
            this.synth.addEventListener('voiceschanged', loadVoices);
        }
    }
    
    speak(text, onStart = null, onEnd = null) {
        if (!this.enabled) return;
        
        this.stop();
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.volume = this.volume;
        utterance.lang = 'ko-KR';
        
        utterance.onstart = () => {
            console.log('🔊 TTS 시작');
            if (onStart) onStart();
        };
        
        utterance.onend = () => {
            console.log('✅ TTS 종료');
            if (onEnd) onEnd();
        };
        
        utterance.onerror = (e) => {
            console.error('❌ TTS 오류:', e);
            if (onEnd) onEnd();
        };
        
        this.synth.speak(utterance);
    }
    
    stop() {
        if (this.enabled && this.synth.speaking) {
            this.synth.cancel();
        }
    }
}

// 전역 TTS 인스턴스
const bomiTTS = new BomiTTS();

/**
 * 대화 통계 업데이트
 */
function updateConversationStats() {
    const totalEl = document.getElementById('stat-total');
    const durationEl = document.getElementById('stat-duration');
    const wordsEl = document.getElementById('stat-words');

    if (totalEl) totalEl.textContent = conversationCount;
    if (wordsEl) wordsEl.textContent = totalWords;
    
    // 대화 시간 계산
    if (durationEl && sessionStartTime) {
        const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
        durationEl.textContent = `${minutes}분`;
    }
}

// ========================================
// 초기화
// ========================================

console.log('🎤 음성 녹음 모듈 로드 완료');
console.log('   - 브라우저 MediaRecorder 지원:', typeof MediaRecorder !== 'undefined');
console.log('   - 브라우저 getUserMedia 지원:', typeof navigator.mediaDevices !== 'undefined');

async function audioBufferToWav(audioBuffer) { 
    const numChannels = 1; // Mono (백엔드가 16kHz mono 기대)
    const sampleRate = 16000; // 16kHz (백엔드 설정)
    const format = 1; // PCM
    const bitDepth = 16;
    
    // 리샘플링 (브라우저 샘플레이트 → 16kHz)
    const resampledBuffer = await resampleAudioBuffer(audioBuffer, sampleRate);  // ← await 추가!
    
    let length = resampledBuffer.length * numChannels * 2;
    let buffer = new ArrayBuffer(44 + length);
    let view = new DataView(buffer);
    
    // WAV 헤더 작성
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
    view.setUint16(32, numChannels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // 오디오 데이터 작성 (Mono로 변환)
    let offset = 44;
    const channelData = resampledBuffer.getChannelData(0);
    for (let i = 0; i < resampledBuffer.length; i++) {
        let sample = channelData[i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    if (audioBuffer.sampleRate === targetSampleRate) {
        return audioBuffer;
    }
    
    const offlineContext = new OfflineAudioContext(
        1,
        audioBuffer.duration * targetSampleRate,
        targetSampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    return offlineContext.startRendering();
}

console.log('🎤 WAV 변환 모듈 로드 완료');

async function checkSensor(username) {
    try {
        console.log('🔍 센서 확인 중...');
        
        const response = await fetch('/api/check-sensor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username })
        });
        
        const data = await response.json();
        
        const recordBtn = document.getElementById('recordBtn');
        
        if (data.has_sensor) {
            // 센서 있음
            if (recordBtn) {
                recordBtn.disabled = false;
            }
            console.log('✅ 센서 확인:', data.device_name);
        } else {
            // 센서 없음
            if (recordBtn) {
                recordBtn.disabled = true;
            }
            console.warn('⚠️ 센서 없음:', data.message);
        }
        
        return data.has_sensor;
        
    } catch (error) {
        console.error('❌ 센서 확인 실패:', error);
        return false;
    }
}

// 음성 세션 생성 함수
async function createVoiceSession(username) {
    try {
        console.log('📡 음성 세션 생성 중...');
        
        const response = await fetch('/api/create-voice-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ 음성 세션 생성:', data.sensing_id);
            return data.sensing_id;
        } else {
            throw new Error(data.message || '세션 생성 실패');
        }
        
    } catch (error) {
        console.error('❌ 음성 세션 생성 실패:', error);
        alert('음성 세션 생성에 실패했습니다.\n' + error.message);
        throw error;
    }
}
