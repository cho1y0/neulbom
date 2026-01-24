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
let notifications = [
    { id: 1, type: 'info', title: '활동량 정상', message: '오늘 활동량이 정상 범위입니다. 3,240걸음을 기록했습니다.', time: '36분 전', read: false },
    { id: 2, type: 'warning', title: '수분 섭취 권장', message: '오늘 수분 섭취량이 부족합니다. 물을 마시도록 권해주세요.', time: '1시간 전', read: false },
    { id: 3, type: 'info', title: '수면 분석 완료', message: '어젯밤 7.5시간 수면하셨습니다. 수면의 질이 양호합니다.', time: '3시간 전', read: true },
    { id: 4, type: 'danger', title: '낙상 위험 감지', message: '어제 오후 2시경 거실에서 비틀거림이 감지되었습니다.', time: '어제', read: true },
    { id: 5, type: 'warning', title: '실내 온도 주의', message: '현재 실내 온도가 28°C입니다. 에어컨 사용을 권장합니다.', time: '어제', read: true }
];

// 주의/위험 이력 데이터
const alertHistory = [
    { id: 1, type: 'warning', title: '장시간 무활동 감지', description: '거실에서 45분간 움직임이 없었습니다.', time: '2024-01-20 14:30', resolved: true },
    { id: 2, type: 'danger', title: '낙상 위험 감지', description: '침실에서 비틀거림이 감지되었습니다. 확인 필요.', time: '2024-01-19 09:15', resolved: true },
    { id: 3, type: 'warning', title: '수면 패턴 이상', description: '최근 3일간 평균 수면시간이 5시간 미만입니다.', time: '2024-01-18 08:00', resolved: false },
    { id: 4, type: 'danger', title: '응급 버튼 작동', description: '어르신이 응급 버튼을 눌렀습니다. 즉시 확인하세요.', time: '2024-01-15 16:45', resolved: true },
    { id: 5, type: 'warning', title: '실내 온도 이상', description: '실내 온도가 30°C를 초과했습니다.', time: '2024-01-14 13:20', resolved: true }
];

// 차트 인스턴스 저장
let charts = {};

// 리포트 데이터 (주간/월간)
const reportData = {
    weekly: {
        labels: ['월', '화', '수', '목', '금', '토', '일'],
        activity: [2800, 3240, 2950, 3100, 2700, 3500, 3200],
        sleep: [7.2, 7.5, 6.8, 7.0, 7.3, 8.0, 7.5],
        emotion: [75, 80, 72, 78, 85, 82, 88],
        cognitive: [45, 50, 40, 55, 48, 60, 52],
        temperature: [24, 24.5, 25, 24.2, 23.8, 24, 24.5],
        humidity: [45, 48, 50, 47, 44, 46, 45]
    },
    monthly: {
        labels: ['1주', '2주', '3주', '4주'],
        activity: [21000, 22500, 20800, 23100],
        sleep: [49, 52, 48, 53],
        emotion: [76, 79, 82, 85],
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
document.addEventListener('DOMContentLoaded', function() {
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
    
    console.log('✅ 늘봄 AI 초기화 완료');
});

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
        item.addEventListener('click', function() {
            const page = this.dataset.page;
switchView(page);
            
            // 활성 상태 변경
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

/**
 * 실시간 입력 검증 이벤트 바인딩
 */
function initValidationEvents() {
    const inputs = document.querySelectorAll('input[data-rule], select[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
    if (!isSignupInProgress) return;
    validateField(this);
});
        
        input.addEventListener('input', function() {
            // 입력 시 에러 제거
            clearFieldError(this);
        });
    });
}

/**
 * 전화번호 자동 포맷팅
 */
function initPhoneFormatting() {
    const phoneInputs = document.querySelectorAll('input[data-rule="phone"], input[data-rule="phone-optional"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
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
    // 모든 페이지 숨기기
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    // 보미 표시/숨김
    const bomi = document.getElementById('bomi-assistant');
    if (bomi) {
        if (pageId === 'login-page' || pageId === 'signup-page') {
            bomi.style.display = 'none';
        } else {
            bomi.style.display = 'flex';
        }
    }
    // 해당 페이지 표시
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 회원가입 페이지로 이동 시 상태 설정
    if (pageId === 'signup-page') {
        isSignupInProgress = true;
        resetSignupForm();
    } else {
        isSignupInProgress = false;
    }
    
    // 메인 앱으로 이동 시 차트 초기화
    if (pageId === 'main-app') {
  setTimeout(() => {
    const bomi = document.getElementById('bomi-assistant');
    if (bomi) bomi.style.display = 'flex';

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
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const targetView = document.getElementById(viewId + '-view');
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // 리포트 뷰 전환 시 차트 새로고침
    // 리포트 뷰 전환 시 차트 새로고침
    if (viewId === 'report') {
        setTimeout(() => {
            initReportCharts();
            renderAlertHistory();
        }, 100);
    }
    
    if (viewId === 'healthcheck') {
    loadGrafanaUrl();
    loadGrafanaAlertSettings();
}
}

// ========================================
// 4. 로그인/로그아웃
// ========================================

/**
 * 로그인 처리
 * @param {Event} event - 폼 제출 이벤트
 */
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    // 테스트 계정 확인
    if (username === TEST_ACCOUNT.username && password === TEST_ACCOUNT.password) {
        currentUser = { ...TEST_ACCOUNT };
        showToast('success', '로그인 성공', `${currentUser.name}님, 환영합니다!`);
        showPage('main-app');
    } else {
        showToast('danger', '로그인 실패', '아이디 또는 비밀번호를 확인해주세요.');
        document.getElementById('login-password').value = '';
    }
    
    return false;
}

/**
 * 로그아웃 처리
 */
function handleLogout() {
    currentUser = null;
    showToast('info', '로그아웃', '안전하게 로그아웃되었습니다.');
    
    // 입력 필드 초기화
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    
    showPage('login-page');
}

// ========================================
// 5. 회원가입 프로세스
// ========================================

/**
 * 아이디 중복 확인
 */
function checkDuplicate() {
    const username = document.getElementById('signup-username').value.trim();
    const wrapper = document.getElementById('signup-username').closest('.input-wrapper');
    
    if (!username) {
        setFieldError(wrapper, '아이디를 입력해주세요.');
        return;
    }
    
    // 아이디 형식 검증
    const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
    if (!usernameRegex.test(username)) {
        setFieldError(wrapper, '영문, 숫자 4-20자로 입력해주세요.');
        return;
    }
    
    // 중복 확인 (테스트 계정과 비교)
    if (username === TEST_ACCOUNT.username) {
        setFieldError(wrapper, '이미 사용 중인 아이디입니다.');
        isUsernameChecked = false;
    } else {
        clearFieldError(wrapper);
        showToast('success', '사용 가능', '사용 가능한 아이디입니다.');
        isUsernameChecked = true;
    }
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
 * 회원가입 완료
 */
function completeSignup() {
    // 사용자 정보 수집
    const newUser = {
        username: document.getElementById('signup-username').value.trim(),
        password: document.getElementById('signup-password').value,
        name: document.getElementById('signup-name').value.trim(),
        phone: document.getElementById('signup-phone').value.trim(),
        zipcode: document.getElementById('signup-zipcode').value,
        address: document.getElementById('signup-address').value,
        addressDetail: document.getElementById('signup-address-detail').value.trim(),
        senior: {
            name: document.getElementById('senior-name').value.trim(),
            birthYear: document.getElementById('senior-birth-year').value,
            birthMonth: document.getElementById('senior-birth-month').value,
            birthDay: document.getElementById('senior-birth-day').value,
            gender: document.querySelector('input[name="senior-gender"]:checked')?.value || '',
            living: document.querySelector('input[name="senior-living"]:checked')?.value || '',
            phone: document.getElementById('senior-phone').value.trim(),
            relation: document.getElementById('senior-relation').value,
            zipcode: document.getElementById('senior-zipcode').value,
            address: document.getElementById('senior-address').value,
            addressDetail: document.getElementById('senior-address-detail').value.trim(),
            notes: document.getElementById('senior-notes').value.trim()
        },
        devices: [...registeredDevices]
    };
    
    console.log('📝 회원가입 데이터:', newUser);
    
    isSignupInProgress = false;
    showToast('success', '회원가입 완료', '환영합니다! 로그인 후 서비스를 이용해주세요.');
    showPage('login-page');
}

/**
 * 기기 등록 건너뛰고 완료
 */
function skipDeviceAndComplete() {
    registeredDevices = [];
    completeSignup();
}

/**
 * 회원가입 폼 초기화
 */
function resetSignupForm() {
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
    
    // 단계 초기화
    document.querySelectorAll('.signup-step').forEach((step, index) => {
        step.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('completed');
        step.classList.toggle('active', index === 0);
    });
    
    // 중복확인 상태 초기화
    isUsernameChecked = false;
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
        oncomplete: function(data) {
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
 * 모달에서 기기 추가
 */
function addDeviceFromModal() {
    const serial = document.getElementById('modal-device-serial').value.trim();
    const name = document.getElementById('modal-device-name').value.trim() || '센서';
    const location = document.getElementById('modal-device-location').value;
    
    if (!serial) {
        const wrapper = document.getElementById('modal-device-serial').closest('.input-wrapper');
        setFieldError(wrapper, '시리얼 번호를 입력해주세요.');
        return;
    }
    
    if (currentUser) {
        // 중복 확인
        if (currentUser.devices.some(d => d.serial === serial)) {
            showToast('warning', '중복 기기', '이미 등록된 기기입니다.');
            return;
        }
        
        currentUser.devices.push({
            id: 'DEV' + Date.now(),
            serial: serial,
            name: name,
            location: location,
            status: 'online'
        });
        
        renderDevices();
        renderMypageDevices();
    }
    
    // 모달 닫기 및 필드 초기화
    closeModal('add-device-modal');
    document.getElementById('modal-device-serial').value = '';
    document.getElementById('modal-device-name').value = '';
    
    showToast('success', '기기 추가 완료', `${name} 기기가 등록되었습니다.`);
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
 * 대시보드 업데이트
 */
function updateDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name-display').textContent = currentUser.name;
    document.getElementById('senior-name-display').textContent = currentUser.senior?.name || '어르신';
    updateCurrentDate();
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
    // 버튼 활성화 상태 변경
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 타이틀 업데이트
    const titleText = period === 'weekly' ? '주간' : '월간';
    document.getElementById('activity-report-title').textContent = titleText;
    document.getElementById('sleep-report-title').textContent = titleText;
    document.getElementById('emotion-report-title').textContent = titleText;
    document.getElementById('cognitive-report-title').textContent = titleText;
    document.getElementById('env-report-title').textContent = titleText;
    
    // 차트 데이터 업데이트
    updateReportCharts(period);
    
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
    
    // 감정 차트 업데이트
    if (charts.emotionReport) {
        charts.emotionReport.data.labels = data.labels;
        charts.emotionReport.data.datasets[0].data = data.emotion;
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
 * 주의/위험 이력 렌더링
 */
function renderAlertHistory() {
    const container = document.getElementById('alert-history-list');
    if (!container) return;
    
    container.innerHTML = alertHistory.map(alert => `
        <div class="alert-history-item ${alert.type}">
            <div class="alert-history-icon">
                <span class="material-icons-round">${alert.type === 'danger' ? 'error' : 'warning'}</span>
            </div>
            <div class="alert-history-content">
                <h4>${alert.title}</h4>
                <p>${alert.description}</p>
            </div>
            <span class="alert-history-time">${alert.time}</span>
        </div>
    `).join('');
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

window.addEventListener('resize', function() {
    Object.values(charts).forEach(function(chart) {
        if (chart) {
            chart.resize();
        }
    });
});
/**
 * 리포트 차트 초기화
 */
function initReportCharts() {
    // 기존 리포트 차트 파괴
    ['activity', 'sleep', 'emotionReport', 'cognitiveReport', 'envReport'].forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    });
    
    initActivityChart();
    initSleepChart();
    initEmotionReportChart();
    initCognitiveReportChart();
    initEnvReportChart();
}

/**
 * 감정 분석 버블 차트 (대시보드)
 */
function initEmotionBubbleChart() {
    const ctx = document.getElementById('emotion-bubble-chart');
    if (!ctx) return;
    
    charts.emotionBubble = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [
                {
                    label: '긍정',
                    data: [
                        { x: 2, y: 80, r: 25 },
                        { x: 4, y: 85, r: 20 },
                        { x: 6, y: 78, r: 22 }
                    ],
                    backgroundColor: 'rgba(102, 187, 106, 0.7)',
                    borderColor: '#66BB6A'
                },
                {
                    label: '중립',
                    data: [
                        { x: 3, y: 50, r: 15 },
                        { x: 5, y: 55, r: 12 }
                    ],
                    backgroundColor: 'rgba(255, 183, 77, 0.7)',
                    borderColor: '#FFB74D'
                },
                {
                    label: '부정',
                    data: [
                        { x: 1, y: 20, r: 8 },
                        { x: 7, y: 15, r: 6 }
                    ],
                    backgroundColor: 'rgba(239, 83, 80, 0.7)',
                    borderColor: '#EF5350'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    display: false,
                    min: 0,
                    max: 8
                },
                y: {
                    display: false,
                    min: 0,
                    max: 100
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
 * 실내 환경 차트 (대시보드)
 */
function initEnvChart() {
    const ctx = document.getElementById('env-chart');
    if (!ctx) return;
    
    charts.env = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00시', '04시', '08시', '12시', '16시', '20시', '현재'],
            datasets: [
                {
                    label: '온도(°C)',
                    data: [22, 21, 22, 24, 25, 24, 24.5],
                    borderColor: '#EF5350',
                    backgroundColor: 'rgba(239, 83, 80, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '습도(%)',
                    data: [48, 50, 47, 45, 43, 45, 45],
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

/**
 * 활동량 차트 (리포트)
 */
function initActivityChart() {
    const ctx = document.getElementById('activity-chart');
    if (!ctx) return;
    
    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: reportData.weekly.labels,
            datasets: [{
                label: '걸음 수',
                data: reportData.weekly.activity,
                backgroundColor: 'rgba(124, 179, 66, 0.8)',
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
 * 감정 변화 차트 (리포트)
 */
function initEmotionReportChart() {
    const ctx = document.getElementById('emotion-report-chart');
    if (!ctx) return;
    
    charts.emotionReport = new Chart(ctx, {
        type: 'line',
        data: {
            labels: reportData.weekly.labels,
            datasets: [{
                label: '감정 점수',
                data: reportData.weekly.emotion,
                borderColor: '#66BB6A',
                backgroundColor: 'rgba(102, 187, 106, 0.2)',
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
                    min: 50,
                    max: 100,
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
 * 마이페이지 정보 업데이트
 */
function updateMyPage() {
    if (!currentUser) return;
    
    // 보호자 정보 (비마스킹)
    document.getElementById('mypage-name').textContent = currentUser.name;
    document.getElementById('mypage-username').textContent = currentUser.username;
    
    // 어르신 정보 (비마스킹)
    if (currentUser.senior) {
        document.getElementById('mypage-senior-name').textContent = currentUser.senior.name;
        
        // 성별 표시
        const genderText = currentUser.senior.gender === 'male' ? '남성' : '여성';
        document.getElementById('mypage-senior-gender').textContent = genderText;
        
        // 주거형태 표시
        const livingTexts = {
            'with-family': '자녀와 거주',
            'alone': '독거',
            'couple': '부부 거주'
        };
        document.getElementById('mypage-senior-living').textContent = livingTexts[currentUser.senior.living] || '-';
    }
    
    // 마스킹 적용
    applyMasking();
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
 * 비밀번호 변경
 */
function changePassword() {
    const currentPw = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    const confirmPw = document.getElementById('new-password-confirm').value;
    
    let isValid = true;
    
    // 현재 비밀번호 확인
    if (!currentPw) {
        const wrapper = document.getElementById('current-password').closest('.input-wrapper');
        setFieldError(wrapper, '현재 비밀번호를 입력해주세요.');
        isValid = false;
    } else if (currentUser && currentPw !== currentUser.password) {
        const wrapper = document.getElementById('current-password').closest('.input-wrapper');
        setFieldError(wrapper, '현재 비밀번호가 일치하지 않습니다.');
        isValid = false;
    }
    
    // 새 비밀번호 검증
    if (!newPw) {
        const wrapper = document.getElementById('new-password').closest('.input-wrapper');
        setFieldError(wrapper, '새 비밀번호를 입력해주세요.');
        isValid = false;
    } else if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(newPw)) {
        const wrapper = document.getElementById('new-password').closest('.input-wrapper');
        setFieldError(wrapper, '영문, 숫자, 특수문자 포함 8자 이상');
        isValid = false;
    }
    
    // 비밀번호 확인
    if (newPw !== confirmPw) {
        const wrapper = document.getElementById('new-password-confirm').closest('.input-wrapper');
        setFieldError(wrapper, '새 비밀번호가 일치하지 않습니다.');
        isValid = false;
    }
    
    if (isValid) {
        // 비밀번호 변경 처리
        if (currentUser) {
            currentUser.password = newPw;
            console.log('🔐 비밀번호 변경 완료:', { oldPw: currentPw, newPw: newPw });
        }
        
        // 폼 초기화
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('new-password-confirm').value = '';
        
        // 폼 접기
        togglePasswordForm();
        
        showToast('success', '비밀번호 변경', '비밀번호가 성공적으로 변경되었습니다.');
    }
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
        phoneInput.addEventListener('input', function(e) {
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
 * 보호자 정보 저장
 */
function saveGuardianInfo() {
    const phone = document.getElementById('edit-guardian-phone').value.trim();
    const zipcode = document.getElementById('edit-guardian-zipcode').value;
    const address = document.getElementById('edit-guardian-address').value;
    const addressDetail = document.getElementById('edit-guardian-address-detail').value.trim();
    
    let isValid = true;
    
    // 전화번호 검증
    if (!phone || !/^010-\d{4}-\d{4}$/.test(phone)) {
        const wrapper = document.getElementById('edit-guardian-phone').closest('.input-wrapper');
        setFieldError(wrapper, '올바른 전화번호를 입력해주세요.');
        isValid = false;
    }
    
    // 상세주소 검증
    if (!addressDetail) {
        const wrapper = document.getElementById('edit-guardian-address-detail').closest('.input-wrapper');
        setFieldError(wrapper, '상세주소를 입력해주세요.');
        isValid = false;
    }
    
    if (isValid && currentUser) {
        currentUser.phone = phone;
        currentUser.zipcode = zipcode;
        currentUser.address = address;
        currentUser.addressDetail = addressDetail;
        
        updateMyPage();
        closeModal('edit-modal');
        showToast('success', '저장 완료', '내 정보가 수정되었습니다.');
        
        console.log('📝 보호자 정보 수정:', { phone, zipcode, address, addressDetail });
    }
}

/**
 * 어르신 정보 저장
 */
function saveSeniorInfo() {
    const phone = document.getElementById('edit-senior-phone').value.trim();
    const zipcode = document.getElementById('edit-senior-zipcode').value;
    const address = document.getElementById('edit-senior-address').value;
    const addressDetail = document.getElementById('edit-senior-address-detail').value.trim();
    
    let isValid = true;
    
    // 전화번호 검증 (선택)
    if (phone && !/^010-\d{4}-\d{4}$/.test(phone)) {
        const wrapper = document.getElementById('edit-senior-phone').closest('.input-wrapper');
        setFieldError(wrapper, '올바른 전화번호를 입력해주세요.');
        isValid = false;
    }
    
    // 상세주소 검증
    if (!addressDetail) {
        const wrapper = document.getElementById('edit-senior-address-detail').closest('.input-wrapper');
        setFieldError(wrapper, '상세주소를 입력해주세요.');
        isValid = false;
    }
    
    if (isValid && currentUser && currentUser.senior) {
        currentUser.senior.phone = phone;
        currentUser.senior.zipcode = zipcode;
        currentUser.senior.address = address;
        currentUser.senior.addressDetail = addressDetail;
        
        updateMyPage();
        closeModal('edit-modal');
        showToast('success', '저장 완료', '어르신 정보가 수정되었습니다.');
        
        console.log('📝 어르신 정보 수정:', { phone, zipcode, address, addressDetail });
    }
}

/**
 * 알림 설정 토글
 * @param {string} type - 'abnormal' 또는 'emergency'
 */
function toggleNotification(type) {
    const checkbox = document.getElementById(`alert-${type}`);
    const status = checkbox.checked ? '활성화' : '비활성화';
    const typeName = type === 'abnormal' ? '이상 행동 감지' : '응급상황';
    
    showToast('info', '알림 설정', `${typeName} 알림이 ${status}되었습니다.`);
    console.log(`🔔 알림 설정 변경: ${type} = ${checkbox.checked}`);
}

// ========================================
// 15. 알림 기능
// ========================================

/**
 * 대시보드 알림 렌더링
 */
function renderNotifications() {
    const container = document.getElementById('notification-list');
    if (!container) return;
    
    // 최근 3개만 표시
    const recentNotifications = notifications.slice(0, 3);
    
    container.innerHTML = recentNotifications.map(notif => `
        <div class="notif-item ${notif.type} ${notif.read ? '' : 'unread'}" onclick="selectNotification(${notif.id})">
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
 * 알림 모달 열기
 */
function openNotificationModal() {
    renderFullNotifications('all');
    openModal('notification-modal');
}

/**
 * 전체 알림 렌더링
 * @param {string} filter - 'all', 'unread', 'danger'
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
        return true;
    }
    return false;
}
// ========================================
// 헬스체크 - 그라파나 URL 관리
// ========================================

function saveGrafanaUrl() {
    const url = document.getElementById('grafana-url').value.trim();
    if (!url) {
        showToast('warning', '입력 필요', 'URL을 입력해주세요.');
        return;
    }
    localStorage.setItem('grafana_url', url);
    showToast('success', '저장 완료', '그라파나 URL이 저장되었습니다.');
}

function openGrafana() {
    const url = localStorage.getItem('grafana_url');
    if (!url) {
        showToast('warning', 'URL 없음', '먼저 그라파나 URL을 설정해주세요.');
        return;
    }
    window.open(url, '_blank');
}

function loadGrafanaUrl() {
    const url = localStorage.getItem('grafana_url');
    if (url) {
        document.getElementById('grafana-url').value = url;
    }
}
console.log('🌸 늘봄 AI 스크립트 로드 완료');
// ========================================
// 그라파나 알림 설정 함수
// ========================================

function saveGrafanaAlertSettings() {
    const webhookUrl = document.getElementById('grafana-webhook-url').value.trim();
    const refreshInterval = document.getElementById('grafana-refresh-interval').value;
    const sensorAlert = document.getElementById('grafana-sensor-alert').checked;
    const emergencyAlert = document.getElementById('grafana-emergency-alert').checked;
    
    const settings = {
        webhookUrl: webhookUrl,
        refreshInterval: parseInt(refreshInterval),
        sensorAlert: sensorAlert,
        emergencyAlert: emergencyAlert
    };
    
    localStorage.setItem('grafana_alert_settings', JSON.stringify(settings));
    showToast('success', '저장 완료', '그라파나 알림 설정이 저장되었습니다.');
}

function loadGrafanaAlertSettings() {
    const settings = localStorage.getItem('grafana_alert_settings');
    if (settings) {
        const parsed = JSON.parse(settings);
        const webhookInput = document.getElementById('grafana-webhook-url');
        const intervalSelect = document.getElementById('grafana-refresh-interval');
        const sensorCheck = document.getElementById('grafana-sensor-alert');
        const emergencyCheck = document.getElementById('grafana-emergency-alert');
        
        if (webhookInput) webhookInput.value = parsed.webhookUrl || '';
        if (intervalSelect) intervalSelect.value = parsed.refreshInterval || '30';
        if (sensorCheck) sensorCheck.checked = parsed.sensorAlert !== false;
        if (emergencyCheck) emergencyCheck.checked = parsed.emergencyAlert !== false;
    }
}