/* =============================================
   늘봄 AI - 메인 스크립트
   SPA 리팩토링 버전
   ============================================= */

/* =============================================
   설정 (Configuration)
   ============================================= */
const CONFIG = {
  GRAFANA_DASHBOARD_URL: '[GRAFANA_DASHBOARD_URL]', // Grafana 대시보드 URL
  RELAY_BASE_URL: '[RELAY_BASE_URL]', // 릴레이 서버 URL
  DEMO_MODE: true,
  STORAGE_KEYS: {
    USER: 'neulbom_user',
    SENIORS: 'neulbom_seniors',
    DEVICES: 'neulbom_devices',
    NOTIFICATIONS: 'neulbom_notifications',
    NOTIFICATION_SETTINGS: 'neulbom_notification_settings',
    REGISTER_DATA: 'neulbom_register_data'
  }
};

/* =============================================
   상태 관리 (State)
   ============================================= */
const State = {
  currentPage: 'login',
  registerStep: 1,
  registerData: {},
  user: null,
  seniors: [],
  devices: [],
  notifications: [],
  sseConnection: null
};

/* =============================================
   DOM 요소 캐싱
   ============================================= */
const DOM = {};

/* =============================================
   초기화 (Initialization)
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  cacheDOM();
  initEventListeners();
  loadStoredData();
  checkAuthStatus();
  initNotificationConnection();
});

function cacheDOM() {
  // 페이지들
  DOM.pages = {
    login: document.getElementById('page-login'),
    register: document.getElementById('page-register'),
    dashboard: document.getElementById('page-dashboard'),
    reports: document.getElementById('page-reports'),
    devices: document.getElementById('page-devices'),
    mypage: document.getElementById('page-mypage')
  };
  
  // 네비게이션
  DOM.navHeader = document.getElementById('nav-header');
  DOM.navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
  DOM.navLogoutBtn = document.getElementById('nav-logout-btn');
  DOM.navToggleBtn = document.getElementById('nav-toggle-btn');
  DOM.mobileMenu = document.getElementById('mobile-menu');
  DOM.navNotificationBtn = document.getElementById('nav-notification-btn');
  DOM.notificationBadge = document.getElementById('notification-badge');
  
  // 로딩 & 토스트
  DOM.loadingOverlay = document.getElementById('loading-overlay');
  DOM.toastContainer = document.getElementById('toast-container');
  
  // 로그인
  DOM.loginForm = document.getElementById('login-form');
  DOM.gotoRegisterBtn = document.getElementById('goto-register-btn');
  
  // 회원가입
  DOM.registerSteps = document.querySelectorAll('.register-step');
  DOM.stepItems = document.querySelectorAll('.step-item');
  DOM.regPrevBtn = document.getElementById('reg-prev-btn');
  DOM.regNextBtn = document.getElementById('reg-next-btn');
  DOM.backToLoginLink = document.getElementById('back-to-login');
  
  // 모달
  DOM.deviceModal = document.getElementById('device-modal');
  DOM.seniorModal = document.getElementById('senior-modal');
  DOM.notificationModal = document.getElementById('notification-modal');
}

/* =============================================
   이벤트 리스너 (Event Listeners)
   ============================================= */
function initEventListeners() {
  // 네비게이션
  DOM.navLinks.forEach(link => {
    link.addEventListener('click', handleNavClick);
  });
  
  DOM.navLogoutBtn.addEventListener('click', handleLogout);
  DOM.navToggleBtn.addEventListener('click', toggleMobileMenu);
  DOM.navNotificationBtn.addEventListener('click', openNotificationModal);
  
  // 로그인
  DOM.loginForm.addEventListener('submit', handleLogin);
  DOM.gotoRegisterBtn.addEventListener('click', () => navigateTo('register'));
  
  // 회원가입
  DOM.regPrevBtn.addEventListener('click', prevRegisterStep);
  DOM.regNextBtn.addEventListener('click', nextRegisterStep);
  DOM.backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });
  
  // 회원가입 - 주소 검색
  document.getElementById('search-address-btn').addEventListener('click', () => searchAddress('reg'));
  document.getElementById('search-senior-address-btn').addEventListener('click', () => searchAddress('senior'));
  
  // 회원가입 - 약관 토글
  document.querySelectorAll('.terms-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTermsContent);
  });
  
  // 회원가입 - 전체 동의
  document.getElementById('terms-all-1').addEventListener('change', (e) => toggleAllTerms(e, 1));
  document.getElementById('terms-all-2').addEventListener('change', (e) => toggleAllTerms(e, 2));
  
  // 회원가입 - 비밀번호 강도
  document.getElementById('reg-password').addEventListener('input', checkPasswordStrength);
  
  // 회원가입 - 전화번호 포맷
  document.getElementById('reg-phone').addEventListener('input', formatPhoneNumber);
  document.getElementById('senior-phone').addEventListener('input', formatPhoneNumber);
  
  // 회원가입 - 기기 등록
  document.getElementById('qr-scan-btn').addEventListener('click', simulateQRScan);
  document.getElementById('add-device-reg-btn').addEventListener('click', addDeviceInRegister);
  
  // 대시보드 - 어르신 추가
  document.getElementById('add-senior-btn').addEventListener('click', openSeniorModal);
  
  // 기기관리 - 기기 추가
  document.getElementById('add-device-btn').addEventListener('click', openDeviceModal);
  document.getElementById('add-first-device-btn').addEventListener('click', openDeviceModal);
  
  // 모달 닫기
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
  
  // 모달 - 기기 추가
  document.getElementById('modal-add-device-btn').addEventListener('click', addDeviceFromModal);
  
  // 모달 - 어르신 추가
  document.getElementById('modal-add-senior-btn').addEventListener('click', addSeniorFromModal);
  document.getElementById('modal-senior-address-btn').addEventListener('click', () => searchAddress('modal-senior'));
  
  // 마이페이지
  document.getElementById('profile-form').addEventListener('submit', saveProfile);
  document.getElementById('password-form').addEventListener('submit', changePassword);
  document.getElementById('profile-address-btn').addEventListener('click', () => searchAddress('profile'));
  
  // 알림 설정 토글
  document.getElementById('notify-abnormal').addEventListener('change', handleNotificationToggle);
  document.getElementById('notify-emergency').addEventListener('change', handleNotificationToggle);
  
  // 리포트 탭 클릭
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', handleReportTabClick);
  });
}

/* =============================================
   헤더/네비게이션
   ============================================= */
function handleNavClick(e) {
  e.preventDefault();
  const page = e.currentTarget.dataset.page;
  
  // 헬스체크는 외부 URL로 리다이렉트
  if (page === 'healthcheck') {
    window.open(CONFIG.GRAFANA_DASHBOARD_URL, '_blank');
    return;
  }
  
  navigateTo(page);
  closeMobileMenu();
}

function toggleMobileMenu() {
  DOM.mobileMenu.classList.toggle('hidden');
}

function closeMobileMenu() {
  DOM.mobileMenu.classList.add('hidden');
}

function handleLogout() {
  State.user = null;
  localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
  showToast('로그아웃 되었습니다.', 'info');
  navigateTo('login');
}

function updateNavActiveState(page) {
  DOM.navLinks.forEach(link => {
    if (link.dataset.page === page) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/* =============================================
   페이지 네비게이션
   ============================================= */
function navigateTo(page) {
  // 모든 페이지 숨기기
  Object.values(DOM.pages).forEach(p => p.classList.add('hidden'));
  
  // 대상 페이지 표시
  if (DOM.pages[page]) {
    DOM.pages[page].classList.remove('hidden');
  }
  
  // 네비게이션 헤더 표시/숨기기
  if (page === 'login' || page === 'register') {
    DOM.navHeader.classList.add('hidden');
  } else {
    DOM.navHeader.classList.remove('hidden');
    updateNavActiveState(page);
  }
  
  // 페이지별 초기화
  if (page === 'dashboard') {
    renderDashboard();
  } else if (page === 'reports') {
    initReportCharts('weekly');
  } else if (page === 'devices') {
    renderDevices();
  } else if (page === 'mypage') {
    renderMypage();
  }
  
  State.currentPage = page;
  window.scrollTo(0, 0);
}

/* =============================================
   로그인 처리
   ============================================= */
function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  showLoading(true);
  
  // 데모 로그인 시뮬레이션
  setTimeout(() => {
    if ((username === 'demo' && password === 'demo123') || checkStoredUser(username, password)) {
      State.user = getOrCreateUser(username);
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(State.user));
      
      showLoading(false);
      showToast('로그인 성공! 환영합니다.', 'success');
      navigateTo('dashboard');
    } else {
      showLoading(false);
      showToast('아이디 또는 비밀번호가 올바르지 않습니다.', 'error');
    }
  }, 800);
}

function checkStoredUser(username, password) {
  const users = JSON.parse(localStorage.getItem('neulbom_users') || '[]');
  return users.some(u => u.username === username && u.password === password);
}

function getOrCreateUser(username) {
  const users = JSON.parse(localStorage.getItem('neulbom_users') || '[]');
  let user = users.find(u => u.username === username);
  
  if (!user) {
    // 데모 사용자
    user = {
      id: 'demo_user',
      username: 'demo',
      name: '보호자님',
      phone: '010-1234-5678',
      address: '',
      addressDetail: '',
      postcode: '',
      createdAt: new Date().toISOString()
    };
  }
  
  return user;
}

function checkAuthStatus() {
  const storedUser = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
  if (storedUser) {
    State.user = JSON.parse(storedUser);
    navigateTo('dashboard');
  } else {
    navigateTo('login');
  }
}

/* =============================================
   회원가입 처리
   ============================================= */
function updateRegisterStep(step) {
  State.registerStep = step;
  
  // 단계 표시 업데이트
  DOM.stepItems.forEach((item, idx) => {
    const itemStep = idx + 1;
    item.classList.remove('active', 'completed');
    if (itemStep === step) {
      item.classList.add('active');
    } else if (itemStep < step) {
      item.classList.add('completed');
    }
  });
  
  // 단계 내용 표시
  DOM.registerSteps.forEach((content, idx) => {
    if (idx + 1 === step) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
  
  // 버튼 상태 업데이트
  if (step === 1) {
    DOM.regPrevBtn.classList.add('hidden');
  } else {
    DOM.regPrevBtn.classList.remove('hidden');
  }
  
  if (step === 6) {
    DOM.regNextBtn.textContent = '가입 완료';
  } else {
    DOM.regNextBtn.textContent = '다음';
  }
}

function prevRegisterStep() {
  if (State.registerStep > 1) {
    updateRegisterStep(State.registerStep - 1);
  }
}

function nextRegisterStep() {
  // 현재 단계 유효성 검사
  if (!validateRegisterStep(State.registerStep)) {
    return;
  }
  
  // 데이터 저장
  saveRegisterStepData(State.registerStep);
  
  if (State.registerStep < 6) {
    updateRegisterStep(State.registerStep + 1);
  } else {
    // 가입 완료
    completeRegistration();
  }
}

function validateRegisterStep(step) {
  switch (step) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return validateStep4();
    case 5:
      return validateStep5();
    case 6:
      return true; // 기기 등록은 선택사항
    default:
      return true;
  }
}

function validateStep1() {
  const username = document.getElementById('reg-username').value;
  const name = document.getElementById('reg-name').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const passwordConfirm = document.getElementById('reg-password-confirm').value;
  
  // 아이디 검증 (영문+숫자)
  const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
  if (!usernameRegex.test(username)) {
    document.getElementById('reg-username-error').textContent = '영문+숫자 4~20자로 입력해주세요.';
    showToast('아이디 형식을 확인해주세요.', 'error');
    return false;
  }
  document.getElementById('reg-username-error').textContent = '';
  
  // 이름 검증 (한글 2~6글자)
  const nameRegex = /^[가-힣]{2,6}$/;
  if (!nameRegex.test(name)) {
    document.getElementById('reg-name-error').textContent = '한글 2~6글자로 입력해주세요.';
    showToast('이름 형식을 확인해주세요.', 'error');
    return false;
  }
  document.getElementById('reg-name-error').textContent = '';
  
  // 전화번호 검증
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  if (!phoneRegex.test(phone.replace(/-/g, ''))) {
    document.getElementById('reg-phone-error').textContent = '올바른 전화번호를 입력해주세요.';
    showToast('전화번호를 확인해주세요.', 'error');
    return false;
  }
  document.getElementById('reg-phone-error').textContent = '';
  
  // 비밀번호 검증 (영문+숫자 혼합 8자 이상)
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    document.getElementById('reg-password-error').textContent = '영문+숫자 혼합 8자 이상 입력해주세요.';
    showToast('비밀번호 형식을 확인해주세요.', 'error');
    return false;
  }
  
  // 비밀번호 확인
  if (password !== passwordConfirm) {
    document.getElementById('reg-password-error').textContent = '비밀번호가 일치하지 않습니다.';
    showToast('비밀번호가 일치하지 않습니다.', 'error');
    return false;
  }
  document.getElementById('reg-password-error').textContent = '';
  
  return true;
}

function validateStep2() {
  const postcode = document.getElementById('reg-postcode').value;
  const address = document.getElementById('reg-address').value;
  
  if (!postcode || !address) {
    showToast('주소를 검색해주세요.', 'error');
    return false;
  }
  
  return true;
}

function validateStep3() {
  const requiredCheckboxes = document.querySelectorAll('.terms-checkbox-1[data-required="true"]');
  for (const checkbox of requiredCheckboxes) {
    if (!checkbox.checked) {
      showToast('필수 약관에 동의해주세요.', 'error');
      return false;
    }
  }
  return true;
}

function validateStep4() {
  const name = document.getElementById('senior-name').value;
  const birth = document.getElementById('senior-birth').value;
  const phone = document.getElementById('senior-phone').value;
  const postcode = document.getElementById('senior-postcode').value;
  
  if (!name || name.length < 2) {
    showToast('어르신 성함을 입력해주세요.', 'error');
    return false;
  }
  
  if (!birth || birth < 1900 || birth > 2000) {
    showToast('올바른 출생년도를 입력해주세요.', 'error');
    return false;
  }
  
  if (!phone) {
    showToast('어르신 연락처를 입력해주세요.', 'error');
    return false;
  }
  
  if (!postcode) {
    showToast('어르신 주소를 입력해주세요.', 'error');
    return false;
  }
  
  return true;
}

function validateStep5() {
  const requiredCheckboxes = document.querySelectorAll('.terms-checkbox-2[data-required="true"]');
  for (const checkbox of requiredCheckboxes) {
    if (!checkbox.checked) {
      showToast('필수 약관에 동의해주세요.', 'error');
      return false;
    }
  }
  return true;
}

function saveRegisterStepData(step) {
  switch (step) {
    case 1:
      State.registerData.username = document.getElementById('reg-username').value;
      State.registerData.name = document.getElementById('reg-name').value;
      State.registerData.phone = document.getElementById('reg-phone').value;
      State.registerData.password = document.getElementById('reg-password').value;
      break;
    case 2:
      State.registerData.postcode = document.getElementById('reg-postcode').value;
      State.registerData.address = document.getElementById('reg-address').value;
      State.registerData.addressDetail = document.getElementById('reg-address-detail').value;
      break;
    case 4:
      State.registerData.senior = {
        name: document.getElementById('senior-name').value,
        birth: document.getElementById('senior-birth').value,
        phone: document.getElementById('senior-phone').value,
        tel: document.getElementById('senior-tel').value,
        postcode: document.getElementById('senior-postcode').value,
        address: document.getElementById('senior-address').value,
        addressDetail: document.getElementById('senior-address-detail').value
      };
      break;
  }
}

function completeRegistration() {
  showLoading(true);
  
  setTimeout(() => {
    // 사용자 저장
    const newUser = {
      id: 'user_' + Date.now(),
      username: State.registerData.username,
      password: State.registerData.password,
      name: State.registerData.name,
      phone: State.registerData.phone,
      postcode: State.registerData.postcode,
      address: State.registerData.address,
      addressDetail: State.registerData.addressDetail,
      createdAt: new Date().toISOString()
    };
    
    const users = JSON.parse(localStorage.getItem('neulbom_users') || '[]');
    users.push(newUser);
    localStorage.setItem('neulbom_users', JSON.stringify(users));
    
    // 어르신 저장
    if (State.registerData.senior) {
      const senior = {
        id: 'senior_' + Date.now(),
        userId: newUser.id,
        ...State.registerData.senior,
        createdAt: new Date().toISOString()
      };
      
      const seniors = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SENIORS) || '[]');
      seniors.push(senior);
      localStorage.setItem(CONFIG.STORAGE_KEYS.SENIORS, JSON.stringify(seniors));
    }
    
    // 기기 저장
    if (State.registerData.devices && State.registerData.devices.length > 0) {
      const devices = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICES) || '[]');
      State.registerData.devices.forEach(serial => {
        devices.push({
          id: 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          userId: newUser.id,
          serial: serial,
          name: '환경 센서',
          location: '거실',
          status: 'online',
          battery: 100,
          createdAt: new Date().toISOString()
        });
      });
      localStorage.setItem(CONFIG.STORAGE_KEYS.DEVICES, JSON.stringify(devices));
    }
    
    showLoading(false);
    showToast('회원가입이 완료되었습니다!', 'success');
    
    // 초기화
    State.registerData = {};
    State.registerStep = 1;
    updateRegisterStep(1);
    
    navigateTo('login');
  }, 1000);
}

/* =============================================
   주소 검색 (Daum API)
   ============================================= */
function searchAddress(prefix) {
  new daum.Postcode({
    oncomplete: function(data) {
      let postcodeEl, addressEl;
      
      switch (prefix) {
        case 'reg':
          postcodeEl = document.getElementById('reg-postcode');
          addressEl = document.getElementById('reg-address');
          break;
        case 'senior':
          postcodeEl = document.getElementById('senior-postcode');
          addressEl = document.getElementById('senior-address');
          break;
        case 'profile':
          postcodeEl = document.getElementById('profile-postcode');
          addressEl = document.getElementById('profile-address');
          break;
        case 'modal-senior':
          postcodeEl = document.getElementById('modal-senior-postcode');
          addressEl = document.getElementById('modal-senior-address');
          break;
      }
      
      if (postcodeEl && addressEl) {
        postcodeEl.value = data.zonecode;
        addressEl.value = data.roadAddress || data.jibunAddress;
      }
    }
  }).open();
}

/* =============================================
   약관 동의 처리
   ============================================= */
function toggleTermsContent(e) {
  const targetId = e.currentTarget.dataset.target;
  const content = document.getElementById(targetId);
  
  if (content) {
    content.classList.toggle('hidden');
    e.currentTarget.classList.toggle('open');
  }
}

function toggleAllTerms(e, group) {
  const checkboxes = document.querySelectorAll(`.terms-checkbox-${group}`);
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
  });
}

/* =============================================
   비밀번호 강도 체크
   ============================================= */
function checkPasswordStrength(e) {
  const password = e.target.value;
  const strengthContainer = document.getElementById('password-strength');
  const strengthLevel = document.getElementById('strength-level');
  const strengthText = document.getElementById('strength-text');
  
  if (password.length === 0) {
    strengthContainer.classList.add('hidden');
    return;
  }
  
  strengthContainer.classList.remove('hidden');
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  strengthLevel.className = 'strength-level';
  if (strength <= 1) {
    strengthLevel.classList.add('weak');
    strengthText.textContent = '약함 - 영문+숫자 혼합 8자 이상';
  } else if (strength <= 2) {
    strengthLevel.classList.add('medium');
    strengthText.textContent = '보통';
  } else {
    strengthLevel.classList.add('strong');
    strengthText.textContent = '강함';
  }
}

/* =============================================
   전화번호 포맷
   ============================================= */
function formatPhoneNumber(e) {
  let value = e.target.value.replace(/[^0-9]/g, '');
  if (value.length > 3 && value.length <= 7) {
    value = value.slice(0, 3) + '-' + value.slice(3);
  } else if (value.length > 7) {
    value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
  }
  e.target.value = value;
}

/* =============================================
   기기 등록 (회원가입)
   ============================================= */
function simulateQRScan() {
  const serial = 'NB-2024-' + Math.random().toString().substr(2, 6);
  addDeviceToRegister(serial);
}

function addDeviceInRegister() {
  const serial = document.getElementById('device-serial').value.trim();
  if (!serial) {
    showToast('일련번호를 입력해주세요.', 'error');
    return;
  }
  addDeviceToRegister(serial);
  document.getElementById('device-serial').value = '';
}

function addDeviceToRegister(serial) {
  if (!State.registerData.devices) {
    State.registerData.devices = [];
  }
  
  if (State.registerData.devices.includes(serial)) {
    showToast('이미 등록된 기기입니다.', 'warning');
    return;
  }
  
  State.registerData.devices.push(serial);
  updateRegisteredDevicesList();
  showToast('기기가 등록되었습니다.', 'success');
}

function updateRegisteredDevicesList() {
  const container = document.getElementById('registered-devices-list');
  const list = document.getElementById('device-list-reg');
  
  if (!State.registerData.devices || State.registerData.devices.length === 0) {
    container.classList.add('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  list.innerHTML = State.registerData.devices.map(serial => `
    <li>
      <span class="material-icons">check_circle</span>
      ${serial}
    </li>
  `).join('');
}

/* =============================================
   대시보드 렌더링
   ============================================= */
function renderDashboard() {
  loadStoredData();
  updateDashboardGreeting();
  renderSeniorList();
  updateDeviceStatusSummary();
  renderNotificationHistory();
}

function updateDashboardGreeting() {
  const greeting = document.getElementById('dashboard-greeting');
  const hour = new Date().getHours();
  let timeGreeting = '안녕하세요';
  
  if (hour >= 5 && hour < 12) {
    timeGreeting = '좋은 아침이에요';
  } else if (hour >= 12 && hour < 18) {
    timeGreeting = '좋은 오후에요';
  } else {
    timeGreeting = '좋은 저녁이에요';
  }
  
  const name = State.user?.name || '보호자님';
  greeting.textContent = `${timeGreeting}, ${name}! 🌞`;
  
  document.getElementById('nav-user-name').textContent = name;
  
  // 어르신 이름으로 위치 업데이트
  if (State.seniors.length > 0) {
    document.getElementById('nav-user-location').textContent = State.seniors[0].name + ' 어르신 댁';
  }
}

function renderSeniorList() {
  const container = document.getElementById('senior-list');
  
  if (State.seniors.length === 0) {
    container.innerHTML = '<p class="empty-message">등록된 어르신이 없습니다.</p>';
    return;
  }
  
  container.innerHTML = State.seniors.map(senior => `
    <div class="senior-item">
      <div class="senior-avatar">👴</div>
      <div class="senior-info">
        <div class="senior-name">${senior.name}</div>
        <div class="senior-detail">${2024 - senior.birth}세 • ${senior.address || '주소 미등록'}</div>
      </div>
      <span class="senior-status">정상</span>
    </div>
  `).join('');
}

function updateDeviceStatusSummary() {
  const onlineCount = State.devices.filter(d => d.status === 'online').length;
  const offlineCount = State.devices.filter(d => d.status === 'offline').length;
  
  document.getElementById('device-online-count').textContent = onlineCount;
  document.getElementById('device-offline-count').textContent = offlineCount;
}

function renderNotificationHistory() {
  const container = document.getElementById('notification-history');
  
  if (State.notifications.length === 0) {
    container.innerHTML = '<p class="empty-message">알림이 없습니다.</p>';
    return;
  }
  
  const recentNotifications = State.notifications.slice(0, 5);
  container.innerHTML = recentNotifications.map(notif => `
    <div class="notification-history-item ${notif.type}">
      <span class="material-icons">${notif.type === 'danger' ? 'error' : 'warning'}</span>
      <div class="notification-history-content">
        <h4>${notif.title}</h4>
        <p>${formatRelativeTime(notif.timestamp)}</p>
      </div>
    </div>
  `).join('');
}

/* =============================================
   기기관리 렌더링
   ============================================= */
function renderDevices() {
  loadStoredData();
  
  const onlineCount = State.devices.filter(d => d.status === 'online').length;
  const offlineCount = State.devices.filter(d => d.status === 'offline').length;
  const warningCount = State.devices.filter(d => d.battery && d.battery < 30).length;
  
  document.getElementById('devices-online').textContent = onlineCount;
  document.getElementById('devices-offline').textContent = offlineCount;
  document.getElementById('devices-warning').textContent = warningCount;
  
  const container = document.getElementById('device-grid');
  const noDevices = document.getElementById('no-devices');
  
  if (State.devices.length === 0) {
    container.classList.add('hidden');
    noDevices.classList.remove('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  noDevices.classList.add('hidden');
  
  container.innerHTML = State.devices.map(device => {
    const batteryClass = device.battery > 50 ? 'high' : device.battery > 20 ? 'medium' : 'low';
    return `
      <div class="device-card">
        <div class="device-card-header">
          <div class="device-info">
            <div class="device-icon">
              <span class="material-icons">sensors</span>
            </div>
            <div>
              <div class="device-name">${device.name || '환경 센서'}</div>
              <div class="device-location">${device.location || '미지정'} • ${device.serial}</div>
            </div>
          </div>
          <div class="device-status-badge ${device.status}">
            <span class="dot"></span>
            ${device.status === 'online' ? '연결됨' : '오프라인'}
          </div>
        </div>
        
        <div class="device-stats">
          <div class="device-stat">
            <div class="device-stat-value">24.5°C</div>
            <div class="device-stat-label">온도</div>
          </div>
          <div class="device-stat">
            <div class="device-stat-value">45%</div>
            <div class="device-stat-label">습도</div>
          </div>
          <div class="device-stat">
            <div class="device-stat-value">좋음</div>
            <div class="device-stat-label">공기질</div>
          </div>
        </div>
        
        <div class="device-battery">
          <span class="material-icons">battery_${device.battery > 80 ? 'full' : device.battery > 50 ? '5_bar' : device.battery > 20 ? '3_bar' : 'alert'}</span>
          <div class="battery-bar">
            <div class="battery-level ${batteryClass}" style="width: ${device.battery || 100}%;"></div>
          </div>
          <span class="battery-text">${device.battery || 100}%</span>
        </div>
        
        <div class="device-actions">
          <button class="btn btn-outline btn-sm">설정</button>
          <button class="btn btn-primary btn-sm">상세보기</button>
        </div>
      </div>
    `;
  }).join('');
}

/* =============================================
   마이페이지 렌더링
   ============================================= */
function renderMypage() {
  loadStoredData();
  
  // 프로필 정보
  document.getElementById('mypage-name').textContent = State.user?.name || '보호자님';
  document.getElementById('stat-seniors').textContent = State.seniors.length;
  document.getElementById('stat-devices').textContent = State.devices.length;
  
  // 이용일수 계산
  if (State.user?.createdAt) {
    const days = Math.floor((Date.now() - new Date(State.user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    document.getElementById('stat-days').textContent = days;
  }
  
  // 프로필 폼 채우기
  document.getElementById('profile-name').value = State.user?.name || '';
  document.getElementById('profile-phone').value = State.user?.phone || '';
  document.getElementById('profile-postcode').value = State.user?.postcode || '';
  document.getElementById('profile-address').value = State.user?.address || '';
  document.getElementById('profile-address-detail').value = State.user?.addressDetail || '';
  
  // 알림 설정 상태
  const settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.NOTIFICATION_SETTINGS) || '{}');
  document.getElementById('notify-abnormal').checked = settings.abnormal || false;
  document.getElementById('notify-emergency').checked = settings.emergency || false;
  
  // 알림 권한 상태 체크
  checkNotificationPermissionStatus();
  
  // 알림 기록 렌더링
  renderMypageNotificationHistory();
}

function saveProfile(e) {
  e.preventDefault();
  
  State.user.name = document.getElementById('profile-name').value;
  State.user.phone = document.getElementById('profile-phone').value;
  State.user.postcode = document.getElementById('profile-postcode').value;
  State.user.address = document.getElementById('profile-address').value;
  State.user.addressDetail = document.getElementById('profile-address-detail').value;
  
  localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(State.user));
  
  // 저장된 사용자 목록도 업데이트
  const users = JSON.parse(localStorage.getItem('neulbom_users') || '[]');
  const idx = users.findIndex(u => u.username === State.user.username);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...State.user };
    localStorage.setItem('neulbom_users', JSON.stringify(users));
  }
  
  showToast('프로필이 저장되었습니다.', 'success');
  
  // 네비게이션 이름 업데이트
  document.getElementById('nav-user-name').textContent = State.user.name;
  document.getElementById('mypage-name').textContent = State.user.name;
}

function changePassword(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('new-password-confirm').value;
  
  // 현재 비밀번호 확인
  const users = JSON.parse(localStorage.getItem('neulbom_users') || '[]');
  const user = users.find(u => u.username === State.user.username);
  
  if (user && user.password !== currentPassword && currentPassword !== 'demo123') {
    showToast('현재 비밀번호가 올바르지 않습니다.', 'error');
    return;
  }
  
  // 새 비밀번호 유효성 검사
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    showToast('비밀번호는 영문+숫자 혼합 8자 이상이어야 합니다.', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('새 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }
  
  // 비밀번호 변경
  if (user) {
    user.password = newPassword;
    localStorage.setItem('neulbom_users', JSON.stringify(users));
  }
  
  // 폼 초기화
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('new-password-confirm').value = '';
  
  showToast('비밀번호가 변경되었습니다.', 'success');
}

function renderMypageNotificationHistory() {
  const container = document.getElementById('mypage-notification-history');
  
  if (State.notifications.length === 0) {
    container.innerHTML = '<p class="empty-message">알림 기록이 없습니다.</p>';
    return;
  }
  
  container.innerHTML = State.notifications.map(notif => `
    <div class="notification-item">
      <div class="notification-icon ${notif.type}">
        <span class="material-icons">${notif.type === 'danger' ? 'error' : notif.type === 'warning' ? 'warning' : 'info'}</span>
      </div>
      <div class="notification-content">
        <h4>${notif.title}</h4>
        <p>${notif.message}</p>
      </div>
      <span class="notification-time">${formatRelativeTime(notif.timestamp)}</span>
    </div>
  `).join('');
}

/* =============================================
   알림 설정 & 권한
   ============================================= */
function handleNotificationToggle(e) {
  const type = e.target.id === 'notify-abnormal' ? 'abnormal' : 'emergency';
  const isEnabled = e.target.checked;
  
  if (isEnabled) {
    // 알림 권한 요청
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          saveNotificationSetting(type, true);
          showToast('알림이 활성화되었습니다.', 'success');
        } else {
          e.target.checked = false;
          saveNotificationSetting(type, false);
          showNotificationPermissionWarning();
          showToast('알림 권한이 거부되었습니다.', 'error');
        }
      });
    } else {
      showToast('이 브라우저는 알림을 지원하지 않습니다.', 'error');
      e.target.checked = false;
    }
  } else {
    saveNotificationSetting(type, false);
  }
}

function saveNotificationSetting(type, value) {
  const settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.NOTIFICATION_SETTINGS) || '{}');
  settings[type] = value;
  localStorage.setItem(CONFIG.STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
}

function checkNotificationPermissionStatus() {
  const statusEl = document.getElementById('notification-permission-status');
  
  if ('Notification' in window && Notification.permission === 'denied') {
    statusEl.classList.remove('hidden');
    document.getElementById('notify-abnormal').checked = false;
    document.getElementById('notify-emergency').checked = false;
  } else {
    statusEl.classList.add('hidden');
  }
}

function showNotificationPermissionWarning() {
  document.getElementById('notification-permission-status').classList.remove('hidden');
}

/* =============================================
   실시간 알림 연결 (SSE)
   ============================================= */
function initNotificationConnection() {
  // 릴레이 서버 연결 시도 (SSE 우선)
  if (CONFIG.RELAY_BASE_URL && CONFIG.RELAY_BASE_URL !== '[RELAY_BASE_URL]') {
    connectSSE();
  } else {
    // 데모 모드: 주기적으로 가짜 알림 생성
    if (CONFIG.DEMO_MODE) {
      setInterval(generateDemoNotification, 60000); // 1분마다
    }
  }
}

function connectSSE() {
  try {
    State.sseConnection = new EventSource(CONFIG.RELAY_BASE_URL + '/events');
    
    State.sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingNotification(data);
      } catch (e) {
        console.error('SSE 메시지 파싱 오류:', e);
      }
    };
    
    State.sseConnection.onerror = () => {
      console.log('SSE 연결 오류, 재연결 시도...');
      setTimeout(connectSSE, 5000);
    };
  } catch (e) {
    console.error('SSE 연결 실패:', e);
  }
}

function handleIncomingNotification(payload) {
  // 메시지 추출 (다양한 payload 형식 지원)
  const message = payload.message || 
                  payload.title || 
                  payload.commonAnnotations?.summary ||
                  payload.alerts?.[0]?.annotations?.summary ||
                  '새로운 알림이 있습니다.';
  
  const type = payload.status === 'firing' ? 'danger' : 
               payload.severity === 'critical' ? 'danger' : 'warning';
  
  const notification = {
    id: 'notif_' + Date.now(),
    title: type === 'danger' ? '응급 상황' : '이상 행동 감지',
    message: message,
    type: type,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  // 알림 저장
  State.notifications.unshift(notification);
  localStorage.setItem(CONFIG.STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(State.notifications));
  
  // 브라우저 알림 표시
  showBrowserNotification(notification);
  
  // 토스트 팝업 표시
  showNotificationToast(notification);
  
  // 배지 업데이트
  updateNotificationBadge();
  
  // 대시보드/마이페이지 업데이트
  if (State.currentPage === 'dashboard') {
    renderNotificationHistory();
  } else if (State.currentPage === 'mypage') {
    renderMypageNotificationHistory();
  }
}

function showBrowserNotification(notification) {
  const settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.NOTIFICATION_SETTINGS) || '{}');
  
  // 알림 설정 확인
  if (notification.type === 'danger' && !settings.emergency) return;
  if (notification.type === 'warning' && !settings.abnormal) return;
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('늘봄 AI - ' + notification.title, {
      body: notification.message,
      icon: 'images/icon-192.png',
      tag: notification.id
    });
  }
}

function showNotificationToast(notification) {
  const toast = document.createElement('div');
  toast.className = `toast ${notification.type === 'danger' ? 'error' : 'warning'}`;
  toast.innerHTML = `
    <span class="material-icons">${notification.type === 'danger' ? 'error' : 'warning'}</span>
    <div class="toast-content">
      <div class="toast-title">${notification.title}</div>
      <div class="toast-message">${notification.message}</div>
    </div>
  `;
  
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

function generateDemoNotification() {
  const messages = [
    { title: '활동 이상 감지', message: '30분 이상 움직임이 감지되지 않습니다.', type: 'warning' },
    { title: '환경 알림', message: '실내 온도가 28°C를 초과했습니다.', type: 'warning' },
    { title: '기기 알림', message: '센서 배터리가 20% 미만입니다.', type: 'warning' }
  ];
  
  // 10% 확률로 알림 발생
  if (Math.random() > 0.9) {
    const msg = messages[Math.floor(Math.random() * messages.length)];
    handleIncomingNotification(msg);
  }
}

function updateNotificationBadge() {
  const unreadCount = State.notifications.filter(n => !n.read).length;
  const badge = DOM.notificationBadge;
  
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* =============================================
   모달
   ============================================= */
function openDeviceModal() {
  DOM.deviceModal.classList.remove('hidden');
}

function openSeniorModal() {
  DOM.seniorModal.classList.remove('hidden');
}

function openNotificationModal() {
  DOM.notificationModal.classList.remove('hidden');
  renderNotificationModalList();
  
  // 모든 알림을 읽음으로 표시
  State.notifications.forEach(n => n.read = true);
  localStorage.setItem(CONFIG.STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(State.notifications));
  updateNotificationBadge();
}

function closeAllModals() {
  DOM.deviceModal.classList.add('hidden');
  DOM.seniorModal.classList.add('hidden');
  DOM.notificationModal.classList.add('hidden');
}

function renderNotificationModalList() {
  const container = document.getElementById('notification-list');
  
  if (State.notifications.length === 0) {
    container.innerHTML = '<p class="empty-message">알림이 없습니다.</p>';
    return;
  }
  
  container.innerHTML = State.notifications.map(notif => `
    <div class="notification-item">
      <div class="notification-icon ${notif.type}">
        <span class="material-icons">${notif.type === 'danger' ? 'error' : notif.type === 'warning' ? 'warning' : 'info'}</span>
      </div>
      <div class="notification-content">
        <h4>${notif.title}</h4>
        <p>${notif.message}</p>
      </div>
      <span class="notification-time">${formatRelativeTime(notif.timestamp)}</span>
    </div>
  `).join('');
}

function addDeviceFromModal() {
  const serial = document.getElementById('modal-device-serial').value.trim();
  
  if (!serial) {
    showToast('일련번호를 입력해주세요.', 'error');
    return;
  }
  
  // 중복 체크
  if (State.devices.some(d => d.serial === serial)) {
    showToast('이미 등록된 기기입니다.', 'warning');
    return;
  }
  
  const newDevice = {
    id: 'device_' + Date.now(),
    userId: State.user?.id,
    serial: serial,
    name: '환경 센서',
    location: '거실',
    status: 'online',
    battery: 100,
    createdAt: new Date().toISOString()
  };
  
  State.devices.push(newDevice);
  localStorage.setItem(CONFIG.STORAGE_KEYS.DEVICES, JSON.stringify(State.devices));
  
  document.getElementById('modal-device-serial').value = '';
  closeAllModals();
  showToast('기기가 등록되었습니다.', 'success');
  
  renderDevices();
  updateDeviceStatusSummary();
}

function addSeniorFromModal() {
  const name = document.getElementById('modal-senior-name').value.trim();
  const birth = document.getElementById('modal-senior-birth').value;
  const phone = document.getElementById('modal-senior-phone').value;
  const postcode = document.getElementById('modal-senior-postcode').value;
  const address = document.getElementById('modal-senior-address').value;
  const addressDetail = document.getElementById('modal-senior-address-detail').value;
  
  if (!name || !birth || !phone || !postcode) {
    showToast('필수 정보를 모두 입력해주세요.', 'error');
    return;
  }
  
  const newSenior = {
    id: 'senior_' + Date.now(),
    userId: State.user?.id,
    name: name,
    birth: birth,
    phone: phone,
    postcode: postcode,
    address: address,
    addressDetail: addressDetail,
    createdAt: new Date().toISOString()
  };
  
  State.seniors.push(newSenior);
  localStorage.setItem(CONFIG.STORAGE_KEYS.SENIORS, JSON.stringify(State.seniors));
  
  // 폼 초기화
  document.getElementById('modal-senior-name').value = '';
  document.getElementById('modal-senior-birth').value = '';
  document.getElementById('modal-senior-phone').value = '';
  document.getElementById('modal-senior-postcode').value = '';
  document.getElementById('modal-senior-address').value = '';
  document.getElementById('modal-senior-address-detail').value = '';
  
  closeAllModals();
  showToast('어르신이 등록되었습니다.', 'success');
  
  renderSeniorList();
}

/* =============================================
   데이터 로드
   ============================================= */
function loadStoredData() {
  // 어르신 데이터
  const seniors = localStorage.getItem(CONFIG.STORAGE_KEYS.SENIORS);
  State.seniors = seniors ? JSON.parse(seniors) : [];
  
  // 현재 사용자의 어르신만 필터링
  if (State.user) {
    State.seniors = State.seniors.filter(s => s.userId === State.user.id || s.userId === 'demo_user');
  }
  
  // 기기 데이터
  const devices = localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICES);
  State.devices = devices ? JSON.parse(devices) : [];
  
  // 현재 사용자의 기기만 필터링
  if (State.user) {
    State.devices = State.devices.filter(d => d.userId === State.user.id || d.userId === 'demo_user');
  }
  
  // 알림 데이터
  const notifications = localStorage.getItem(CONFIG.STORAGE_KEYS.NOTIFICATIONS);
  State.notifications = notifications ? JSON.parse(notifications) : [];
  
  updateNotificationBadge();
}

/* =============================================
   유틸리티 함수
   ============================================= */
function showToast(message, type = 'info') {
  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-icons">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showLoading(show) {
  if (show) {
    DOM.loadingOverlay.classList.remove('hidden');
  } else {
    DOM.loadingOverlay.classList.add('hidden');
  }
}

function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return '방금 전';
  if (diff < 3600) return Math.floor(diff / 60) + '분 전';
  if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
  if (diff < 604800) return Math.floor(diff / 86400) + '일 전';
  
  return date.toLocaleDateString('ko-KR');
}

/* =============================================
   리포트 차트
   ============================================= */
let chartInstances = {
  activity: null,
  sleep: null,
  environment: null
};

function handleReportTabClick(e) {
  // 탭 활성화 상태 변경
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  e.target.classList.add('active');
  
  // 차트 다시 그리기
  const period = e.target.dataset.period;
  initReportCharts(period);
}

function initReportCharts(period) {
  // 기존 차트 파괴
  if (chartInstances.activity) chartInstances.activity.destroy();
  if (chartInstances.sleep) chartInstances.sleep.destroy();
  if (chartInstances.environment) chartInstances.environment.destroy();
  
  // 제목 업데이트
  const isWeekly = period === 'weekly';
  document.getElementById('activity-chart-title').textContent = isWeekly ? '주간 활동량' : '월간 활동량';
  document.getElementById('sleep-chart-title').textContent = isWeekly ? '주간 수면 패턴' : '월간 수면 패턴';
  document.getElementById('env-chart-title').textContent = isWeekly ? '환경 데이터 추이 (24시간)' : '환경 데이터 추이 (30일 평균)';
  
  // 차트 초기화
  initActivityChart(period);
  initSleepChart(period);
  initEnvironmentChart(period);
}

function initActivityChart(period) {
  const ctx = document.getElementById('activity-chart');
  if (!ctx) return;
  
  const isWeekly = period === 'weekly';
  
  // 더미 데이터
  const weeklyData = {
    labels: ['월', '화', '수', '목', '금', '토', '일'],
    data: [120, 135, 98, 156, 142, 110, 127]
  };
  
  const monthlyData = {
    labels: ['1주', '2주', '3주', '4주'],
    data: [845, 920, 780, 890]
  };
  
  const chartData = isWeekly ? weeklyData : monthlyData;
  
  // 통계 업데이트
  const avg = Math.round(chartData.data.reduce((a, b) => a + b, 0) / chartData.data.length);
  const max = Math.max(...chartData.data);
  document.getElementById('activity-avg').textContent = avg + '회';
  document.getElementById('activity-max').textContent = max + '회';
  
  chartInstances.activity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: '활동량 (회)',
        data: chartData.data,
        backgroundColor: 'rgba(124, 179, 66, 0.7)',
        borderColor: '#7CB342',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(124, 179, 66, 0.1)' }
        }
      }
    }
  });
}

function initSleepChart(period) {
  const ctx = document.getElementById('sleep-chart');
  if (!ctx) return;
  
  const isWeekly = period === 'weekly';
  
  // 더미 데이터
  const weeklyData = {
    labels: ['월', '화', '수', '목', '금', '토', '일'],
    data: [7.5, 6.8, 7.2, 8.0, 6.5, 7.8, 7.2],
    recommend: [7, 7, 7, 7, 7, 7, 7]
  };
  
  const monthlyData = {
    labels: ['1주', '2주', '3주', '4주'],
    data: [7.3, 7.0, 7.5, 7.2],
    recommend: [7, 7, 7, 7]
  };
  
  const chartData = isWeekly ? weeklyData : monthlyData;
  
  // 통계 업데이트
  const avg = (chartData.data.reduce((a, b) => a + b, 0) / chartData.data.length).toFixed(1);
  document.getElementById('sleep-avg').textContent = avg + '시간';
  
  chartInstances.sleep = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: '수면 시간',
          data: chartData.data,
          borderColor: '#5C6BC0',
          backgroundColor: 'rgba(92, 107, 192, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#5C6BC0',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: '권장 수면',
          data: chartData.recommend,
          borderColor: 'rgba(124, 179, 66, 0.5)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
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
          grid: { display: false }
        },
        y: {
          min: 4,
          max: 10,
          grid: { color: 'rgba(124, 179, 66, 0.1)' },
          ticks: {
            callback: function(value) {
              return value + 'h';
            }
          }
        }
      }
    }
  });
}

function initEnvironmentChart(period) {
  const ctx = document.getElementById('environment-chart');
  if (!ctx) return;
  
  const isWeekly = period === 'weekly';
  
  let labels, tempData, humidityData, airData;
  
  if (isWeekly) {
    // 24시간 데이터
    labels = [];
    for (let i = 0; i < 24; i++) {
      labels.push(i.toString().padStart(2, '0') + ':00');
    }
    tempData = [22, 22, 21, 21, 20, 20, 21, 22, 23, 24, 25, 26, 26, 27, 27, 26, 25, 24, 24, 23, 23, 22, 22, 22];
    humidityData = [55, 56, 58, 60, 62, 63, 60, 55, 50, 48, 45, 42, 40, 38, 40, 42, 45, 48, 50, 52, 54, 55, 55, 55];
    airData = [85, 85, 84, 82, 80, 78, 80, 82, 85, 88, 90, 92, 90, 88, 85, 87, 90, 92, 94, 92, 90, 88, 86, 85];
  } else {
    // 30일 데이터
    labels = [];
    tempData = [];
    humidityData = [];
    airData = [];
    for (let i = 1; i <= 30; i++) {
      labels.push(i + '일');
      tempData.push(Math.round(22 + Math.random() * 6));
      humidityData.push(Math.round(40 + Math.random() * 25));
      airData.push(Math.round(75 + Math.random() * 20));
    }
  }
  
  chartInstances.environment = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '온도 (°C)',
          data: tempData,
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: '습도 (%)',
          data: humidityData,
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: '공기질',
          data: airData,
          borderColor: '#7CB342',
          backgroundColor: 'rgba(124, 179, 66, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#2D3436',
          bodyColor: '#636E72',
          borderColor: 'rgba(124, 179, 66, 0.3)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: isWeekly ? 12 : 15
          }
        },
        y: {
          grid: { color: 'rgba(124, 179, 66, 0.1)' },
          min: 0,
          max: 100
        }
      }
    }
  });
}
