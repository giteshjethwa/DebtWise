/* ============================================================
   DebtWise — Onboarding JS
   Covers: tab switch, validation, caps lock tooltip,
           password strength, OTP flow, social auth, forgot pw
   ============================================================ */

'use strict';

/* ── State ── */
let currentTab   = 'login';        // 'login' | 'signup'
let otpContext   = null;           // { mode, phone }
let resendTimer  = null;

/* ═══════════════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════════════ */
function switchTab(tab) {
  currentTab = tab;

  // Tab buttons
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('tab-login').setAttribute('aria-selected', tab === 'login');
  document.getElementById('tab-signup').setAttribute('aria-selected', tab === 'signup');

  // Panels
  showPanel(tab);

  // Reset any visible OTP or phone panels when switching
  hidePhoneLogin();
  hideOTP();
  clearAllErrors();
}

function showPanel(name) {
  const panels = ['login', 'signup', 'forgot'];
  panels.forEach(p => {
    const el = document.getElementById('panel-' + p);
    if (el) el.classList.toggle('hidden', p !== name);
  });
}

/* ═══════════════════════════════════════════════════
   CAPS LOCK TOOLTIP
   Attaches to any password input; shows tooltip above
═══════════════════════════════════════════════════ */
function attachCapsLock(inputId, tooltipId) {
  const input   = document.getElementById(inputId);
  const tooltip = document.getElementById(tooltipId);
  if (!input || !tooltip) return;

  function check(e) {
    // getModifierState available on keydown/keyup/mousemove
    const caps = e.getModifierState && e.getModifierState('CapsLock');
    tooltip.classList.toggle('show', !!caps);
  }

  input.addEventListener('keydown',   check);
  input.addEventListener('keyup',     check);
  input.addEventListener('mouseenter', check);
  // Hide on blur so tooltip doesn't stay when field loses focus
  input.addEventListener('blur', () => tooltip.classList.remove('show'));
}

// Wire up all password fields
attachCapsLock('login-password',  'caps-login-pw');
attachCapsLock('signup-password', 'caps-signup-pw');
attachCapsLock('signup-confirm',  'caps-signup-pw2');

/* ═══════════════════════════════════════════════════
   PASSWORD VISIBILITY TOGGLE
═══════════════════════════════════════════════════ */
function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
  icon.className = isHidden ? 'ti ti-eye-off' : 'ti ti-eye';
}

/* ═══════════════════════════════════════════════════
   PASSWORD STRENGTH METER (signup only)
═══════════════════════════════════════════════════ */
const signupPwInput = document.getElementById('signup-password');
if (signupPwInput) {
  signupPwInput.addEventListener('input', updateStrength);
}

function scorePassword(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function updateStrength() {
  const pw    = signupPwInput.value;
  const score = scorePassword(pw);
  const wrap  = document.getElementById('pw-strength');
  const label = document.getElementById('pw-label');
  const bars  = ['bar1','bar2','bar3','bar4'].map(id => document.getElementById(id));

  if (!pw) { wrap.classList.remove('show'); return; }
  wrap.classList.add('show');

  const levels   = ['','weak','fair','good','strong'];
  const labels   = ['','Weak — try adding numbers & symbols','Fair — add uppercase letters','Good — almost there','Strong password'];
  const colours  = ['','#EF4444','#F59E0B','#3B82F6', '#1A9E75'];

  bars.forEach((bar, i) => {
    bar.className = 'dw-pw-bar';
    if (i < score) {
      bar.classList.add(levels[score]);
      bar.style.background = colours[score];
    } else {
      bar.style.background = '';
    }
  });

  label.textContent  = labels[score];
  label.style.color  = colours[score];
}

/* ═══════════════════════════════════════════════════
   VALIDATION HELPERS
═══════════════════════════════════════════════════ */
function setError(fieldId, message) {
  const el = document.getElementById('err-' + fieldId);
  const input = document.getElementById(fieldId);
  if (el)    { el.textContent = message ? '⚠ ' + message : ''; }
  if (input) { input.classList.toggle('error', !!message); input.classList.toggle('valid', !message && input.value.trim() !== ''); }
}

function clearError(fieldId) { setError(fieldId, ''); }

function clearAllErrors() {
  const ids = ['login-email','login-pw','login-phone','signup-name','signup-email','signup-pw','signup-confirm','signup-terms','forgot-email','otp'];
  ids.forEach(clearError);
}

function isValidEmail(val) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()); }
function isValidPhone(val) { return /^[6-9]\d{9}$/.test(val.replace(/\s/g,'')); }

/* ═══════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════ */
function handleLogin() {
  let ok = true;
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;

  clearError('login-email');
  clearError('login-pw');

  if (!email) {
    setError('login-email', 'Email is required'); ok = false;
  } else if (!isValidEmail(email)) {
    setError('login-email', 'Enter a valid email address'); ok = false;
  }

  if (!pw) {
    setError('login-pw', 'Password is required'); ok = false;
  } else if (pw.length < 6) {
    setError('login-pw', 'Password must be at least 6 characters'); ok = false;
  }

  if (!ok) return;

  // Mock success — replace with real auth
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Logging in…';

  setTimeout(() => {
    showToast('Welcome back!', 'success');
    setTimeout(() => { window.location.href = 'debtwise_dashboard.html'; }, 900);
  }, 1200);
}

/* ═══════════════════════════════════════════════════
   SIGNUP
═══════════════════════════════════════════════════ */
function handleSignup() {
  let ok = true;
  const name    = document.getElementById('signup-name').value.trim();
  const email   = document.getElementById('signup-email').value.trim();
  const pw      = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  const terms   = document.getElementById('chk-terms').checked;

  clearError('signup-name');
  clearError('signup-email');
  clearError('signup-pw');
  clearError('signup-confirm');
  clearError('signup-terms');

  if (!name) {
    setError('signup-name', 'Full name is required'); ok = false;
  } else if (name.length < 2) {
    setError('signup-name', 'Name must be at least 2 characters'); ok = false;
  }

  if (!email) {
    setError('signup-email', 'Email is required'); ok = false;
  } else if (!isValidEmail(email)) {
    setError('signup-email', 'Enter a valid email address'); ok = false;
  }

  if (!pw) {
    setError('signup-pw', 'Password is required'); ok = false;
  } else if (pw.length < 8) {
    setError('signup-pw', 'Password must be at least 8 characters'); ok = false;
  } else if (scorePassword(pw) < 2) {
    setError('signup-pw', 'Password is too weak — add numbers or symbols'); ok = false;
  }

  if (!confirm) {
    setError('signup-confirm', 'Please confirm your password'); ok = false;
  } else if (pw !== confirm) {
    setError('signup-confirm', 'Passwords don't match'); ok = false;
  }

  if (!terms) {
    setError('signup-terms', 'You must accept the Terms to continue'); ok = false;
  }

  if (!ok) return;

  // Persist name for dashboard greeting
  localStorage.setItem('dw_user', JSON.stringify({ name, email }));

  const btn = document.getElementById('btn-signup');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Creating account…';

  setTimeout(() => {
    showToast('Account created! Welcome to DebtWise.', 'success');
    setTimeout(() => { window.location.href = 'debtwise_dashboard.html'; }, 900);
  }, 1200);
}

/* ═══════════════════════════════════════════════════
   SOCIAL AUTH (Google)
═══════════════════════════════════════════════════ */
function handleSocial(provider) {
  showToast(`Connecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}…`);
  // Wire to real OAuth here; for prototype, simulate success
  setTimeout(() => {
    localStorage.setItem('dw_user', JSON.stringify({ name: 'Gitesh', email: 'jethwagitesh@gmail.com' }));
    showToast('Signed in with Google!', 'success');
    setTimeout(() => { window.location.href = 'debtwise_dashboard.html'; }, 900);
  }, 1400);
}

/* ═══════════════════════════════════════════════════
   PHONE / OTP FLOW
═══════════════════════════════════════════════════ */
function showPhoneLogin() {
  document.getElementById('login-email-form').classList.add('hidden');
  document.getElementById('btn-phone-login').classList.add('hidden');
  document.getElementById('login-phone-form').classList.remove('hidden');
}

function hidePhoneLogin() {
  const emailForm  = document.getElementById('login-email-form');
  const phoneForm  = document.getElementById('login-phone-form');
  const phonebtn   = document.getElementById('btn-phone-login');
  const otpPanel   = document.getElementById('otp-panel');
  if (emailForm) emailForm.classList.remove('hidden');
  if (phoneForm) phoneForm.classList.add('hidden');
  if (phonebtn)  phonebtn.classList.remove('hidden');
  if (otpPanel)  otpPanel.classList.add('hidden');
}

function hideOTP() {
  const el = document.getElementById('otp-panel');
  if (el) el.classList.add('hidden');
  clearOTPInputs();
}

function sendOTP(mode) {
  const phoneInput = document.getElementById('login-phone');
  if (!phoneInput) return;
  const phone = phoneInput.value.replace(/\s/g,'');
  clearError('login-phone');

  if (!phone) {
    setError('login-phone', 'Phone number is required'); return;
  }
  if (!isValidPhone(phone)) {
    setError('login-phone', 'Enter a valid 10-digit Indian mobile number'); return;
  }

  const code = document.getElementById('login-country').value;
  otpContext  = { mode, phone: code + phone };

  document.getElementById('login-phone-form').classList.add('hidden');

  const hint = document.getElementById('otp-hint');
  hint.textContent = `A 6-digit OTP was sent to ${otpContext.phone}`;

  document.getElementById('otp-panel').classList.remove('hidden');
  document.getElementById('otp1').focus();

  startResendTimer(30);
  showToast('OTP sent!');
}

function verifyOTP() {
  const digits = ['otp1','otp2','otp3','otp4','otp5','otp6'].map(id => document.getElementById(id).value);
  const otp    = digits.join('');
  clearError('otp');

  if (otp.length < 6 || digits.some(d => !d)) {
    setError('otp', 'Enter all 6 digits');
    return;
  }
  // Mock: accept any 6-digit OTP
  localStorage.setItem('dw_user', JSON.stringify({ name: 'Gitesh', phone: otpContext?.phone }));
  showToast('Verified!', 'success');
  setTimeout(() => { window.location.href = 'debtwise_dashboard.html'; }, 900);
}

function resendOTP(e) {
  e.preventDefault();
  clearOTPInputs();
  clearError('otp');
  startResendTimer(30);
  showToast('OTP resent!');
}

function startResendTimer(seconds) {
  clearInterval(resendTimer);
  const timerEl = document.getElementById('resend-timer');
  let s = seconds;
  timerEl.textContent = `(${s}s)`;
  resendTimer = setInterval(() => {
    s--;
    timerEl.textContent = s > 0 ? `(${s}s)` : '';
    if (s <= 0) clearInterval(resendTimer);
  }, 1000);
}

function clearOTPInputs() {
  ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  });
}

/* Auto-advance OTP digits on input */
document.querySelectorAll('.dw-otp-input').forEach((input, idx, inputs) => {
  input.addEventListener('input', e => {
    const val = e.target.value.replace(/\D/g,'');
    e.target.value = val.slice(-1);
    e.target.classList.toggle('filled', !!val);
    if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) inputs[idx - 1].focus();
  });
  // Handle paste of full OTP
  input.addEventListener('paste', e => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
    if (pasted.length >= 6) {
      inputs.forEach((inp, i) => {
        inp.value = pasted[i] || '';
        inp.classList.toggle('filled', !!pasted[i]);
      });
      inputs[Math.min(pasted.length, inputs.length) - 1].focus();
    }
  });
});

/* ═══════════════════════════════════════════════════
   FORGOT PASSWORD
═══════════════════════════════════════════════════ */
function showForgotPassword(e) {
  e.preventDefault();
  showPanel('forgot');
}

function handleForgot() {
  const email = document.getElementById('forgot-email').value.trim();
  clearError('forgot-email');

  if (!email) {
    setError('forgot-email', 'Email is required'); return;
  }
  if (!isValidEmail(email)) {
    setError('forgot-email', 'Enter a valid email address'); return;
  }

  showToast('Reset link sent — check your inbox', 'success');
  setTimeout(() => showPanel('login'), 1800);
}

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = 'dw-toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'dw-toast hidden'; }, 2800);
}

/* ═══════════════════════════════════════════════════
   CSS ANIMATION for spinner
═══════════════════════════════════════════════════ */
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(spinStyle);

/* ═══════════════════════════════════════════════════
   REAL-TIME INLINE VALIDATION (on blur)
═══════════════════════════════════════════════════ */
function attachBlurValidation(inputId, validate) {
  const el = document.getElementById(inputId);
  if (el) el.addEventListener('blur', () => validate(el.value));
}

attachBlurValidation('login-email', v => {
  if (v && !isValidEmail(v)) setError('login-email', 'Enter a valid email address');
  else clearError('login-email');
});

attachBlurValidation('signup-email', v => {
  if (v && !isValidEmail(v)) setError('signup-email', 'Enter a valid email address');
  else clearError('signup-email');
});

attachBlurValidation('signup-name', v => {
  if (v && v.trim().length < 2) setError('signup-name', 'Name must be at least 2 characters');
  else clearError('signup-name');
});

attachBlurValidation('signup-confirm', v => {
  const pw = document.getElementById('signup-password').value;
  if (v && v !== pw) setError('signup-confirm', 'Passwords don't match');
  else clearError('signup-confirm');
});

/* ── Enter key submits ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (currentTab === 'login')  handleLogin();
  if (currentTab === 'signup') handleSignup();
});
