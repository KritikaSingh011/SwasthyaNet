import { starString } from '../data/doctors.js';

export function renderTopbar(container, state, actions) {
  if (!state.currentUser) {
    container.innerHTML = "";
    return;
  }
  
  const colors = { patient: 'var(--coral-500)', clinician: 'var(--teal-500)', admin: 'var(--blue-500)' };
  const currentAvatarBg = colors[state.currentUser.role] || 'var(--teal-500)';
  
  const isPatient = state.currentUser.role === 'patient';
  const isClinician = state.currentUser.role === 'clinician';
  const isAdmin = state.currentUser.role === 'admin';

  container.innerHTML = `
    <div class="brand">
      <svg class="mark" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" fill="#1B4B43"/>
        <path d="M20 11v18M11 20h18" stroke="#FBFAF7" stroke-width="3.4" stroke-linecap="round"/>
      </svg>
      <div>
        <div class="name">SwasthyaNet</div>
        <div class="tag" data-i18n="brandTag">${state.translate("brandTag")}</div>
      </div>
    </div>
    
    <div class="role-switch" style="display: ${state.showRoleSwitch ? 'flex' : 'none'};">
      <button id="btn-role-patient" class="${state.activeRole === 'patient' ? 'active' : ''}" data-role="patient">🧑 ${state.translate("navPatient")}</button>
      <button id="btn-role-clinician" class="${state.activeRole === 'clinician' ? 'active' : ''}" data-role="clinician">🩺 ${state.translate("navClinician")}</button>
      <button id="btn-role-admin" class="${state.activeRole === 'admin' ? 'active' : ''}" data-role="admin">🏛️ ${state.translate("navAdmin")}</button>
    </div>
    
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <div class="a11y-bar" id="a11y-bar">
        <button class="a11y-btn" id="a11y-dec" title="Smaller text">A−</button>
        <button class="a11y-btn" id="a11y-inc" title="Larger text">A+</button>
        <button class="a11y-btn" id="contrast-toggle-btn" title="High contrast">◐</button>
        <button class="a11y-btn" id="readaloud-toggle-btn" title="Read this screen aloud">🔊</button>
      </div>
      
      <div class="lang-switch">
        <button id="lang-en" class="${state.currentLang === 'en' ? 'active' : ''}">EN</button>
        <button id="lang-hi" class="${state.currentLang === 'hi' ? 'active' : ''}">हिं</button>
      </div>
      
      <div class="who-menu">
        <button class="who-btn" id="who-box">
          <div class="avatar" style="background:${currentAvatarBg}">${state.currentUser.initials}</div>
          <span>${state.currentUser.name}</span> ▾
        </button>
        <div class="who-dropdown" id="who-dropdown">
          <button id="btn-open-profile">👤 My profile</button>
          <button id="btn-logout">🚪 Log out</button>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  container.querySelectorAll('.role-switch button').forEach(btn => {
    btn.onclick = () => actions.setRole(btn.dataset.role);
  });
  
  container.querySelector('#a11y-dec').onclick = () => actions.changeTextSize(-1);
  container.querySelector('#a11y-inc').onclick = () => actions.changeTextSize(1);
  container.querySelector('#contrast-toggle-btn').onclick = () => actions.toggleContrast();
  container.querySelector('#readaloud-toggle-btn').onclick = () => actions.toggleReadAloud();

  container.querySelector('#lang-en').onclick = () => actions.setLang('en');
  container.querySelector('#lang-hi').onclick = () => actions.setLang('hi');

  const whoBox = container.querySelector('#who-box');
  const dropdown = container.querySelector('#who-dropdown');
  whoBox.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  };
  
  container.querySelector('#btn-open-profile').onclick = () => {
    dropdown.classList.remove('open');
    actions.openProfile();
  };
  
  container.querySelector('#btn-logout').onclick = () => {
    dropdown.classList.remove('open');
    actions.doLogout();
  };

  document.addEventListener('click', () => {
    if (dropdown) dropdown.classList.remove('open');
  });
}
