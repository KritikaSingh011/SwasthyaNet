import { INITIAL_USERS } from './data/users.js';
import { CATALOG, getMed } from './data/catalog.js';
import { FACILITIES, getFacility } from './data/facilities.js';
import { DOCTORS } from './data/doctors.js';
import { I18N } from './utils/i18n.js';
import { changeTextSize, toggleContrast, toggleReadAloud } from './utils/a11y.js';
import { cloudSpeechToText, cloudTextToSpeech, startVoiceRecognition } from './services/voice.js';
import { renderTopbar } from './components/Topbar.js';
import { renderPatientDashboard } from './components/PatientDashboard.js';
import { renderClinicianDashboard } from './components/ClinicianDashboard.js';
import { renderAdminOverview } from './components/AdminOverview.js';
import { renderAISymptomChecker } from './components/AISymptomChecker.js';
import { dbPlaceOrder, dbBookAppointment, dbMarkAttendance, auth, db } from './services/firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { scanAadhaarCard } from './services/gemini.js';

// Setup state
const state = {
  currentUser: null,
  activeRole: 'patient',
  currentLang: 'en',
  patientTab: 'pharmacy',
  clinTab: 'inv',
  adminTab: 'overview',
  clinFacilityId: 1,
  aiMedId: 9,
  cart: {},
  showRoleSwitch: false, // hidden in prod, managed by login role
  myMeds: [
    {medId:2, daysLeft:4}, 
    {medId:4, daysLeft:11}, 
    {medId:9, daysLeft:2}
  ],
  requests: [
    {id: 5001, patient: "Asha Verma", facilityId: 1, medId: 9, qty: 1, delivery: "pickup", date: "Jul 2", status: "pending"}
  ],
  appointments: [
    {id: 5002, patient: "Asha Verma", doctorId: 1, date: "Today", time: "11:00", reason: "Routine diabetes follow-up", urgent: false, status: "scheduled", patientRating: 0}
  ],
  patients: [
    {id: 4001, name: "Ram Kumar", age: 58, gender: "Male", facilityId: 1, diseases: ["Type 2 Diabetes", "Hypertension"], meds: ["Metformin 500mg", "Amlodipine 5mg"], lastVisit: "Jun 28"},
    {id: 4002, name: "Sunita Devi", age: 34, gender: "Female", facilityId: 1, diseases: ["Anaemia"], meds: ["Multivitamin"], lastVisit: "Jul 1"},
    {id: 4003, name: "Asha Verma", age: 41, gender: "Female", facilityId: 1, diseases: ["Type 1 Diabetes"], meds: ["Insulin Glargine", "Atorvastatin 10mg"], lastVisit: "Jul 3"},
    {id: 4004, name: "Mohd. Irfan", age: 66, gender: "Male", facilityId: 2, diseases: ["COPD", "Hypertension"], meds: ["Cough Syrup 100ml", "Amlodipine 5mg"], lastVisit: "Jun 30"}
  ],
  pendingStaff: [
    {
      id: 'ps5003', role: 'Doctor', name: 'Dr. Kabir Malhotra', phone: '97XXXXXX02', username: 'dr.kabir', password: 'pending123',
      facilityId: 3, degree: 'MBBS, MD (Chest Medicine)', specialty: 'Pulmonology', experience: 6,
      govIdPhoto: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=300&h=200&fit=crop',
      selfie: 'https://randomuser.me/api/portraits/men/41.jpg', submittedOn: 'Jul 6'
    }
  ],
  attendanceLog: [],
  facilities: JSON.parse(JSON.stringify(FACILITIES)),
  facilityStock: {}
};

// Seed stock levels just like the monolithic code
const OVERRIDES = {
  "5-9": {stock: 2, avgDailyUse: 1.2},
  "4-7": {stock: 6, avgDailyUse: 2.1},
  "2-3": {stock: 4, avgDailyUse: 1.6},
  "1-9": {stock: 38, avgDailyUse: 0.6},
  "3-9": {stock: 30, avgDailyUse: 0.4},
};

function seededRand(a, b) {
  const x = Math.sin(a * 17.31 + b * 7.13) * 10000;
  return x - Math.floor(x);
}

FACILITIES.forEach((f, fi) => {
  state.facilityStock[f.id] = {};
  CATALOG.forEach((m, mi) => {
    const key = `${f.id}-${m.id}`;
    if (OVERRIDES[key]) {
      state.facilityStock[f.id][m.id] = { ...OVERRIDES[key], reorder: Math.round(OVERRIDES[key].avgDailyUse * 7) };
      return;
    }
    const r1 = seededRand(fi + 1, mi + 1);
    const r2 = seededRand(mi + 1, fi + 3);
    const avgDailyUse = +(1 + r2 * 4).toFixed(1);
    const stock = Math.round(avgDailyUse * (8 + r1 * 30));
    state.facilityStock[f.id][m.id] = { stock, avgDailyUse, reorder: Math.round(avgDailyUse * 7) };
  });
});

// Translation helper
state.translate = (key) => {
  return I18N[state.currentLang]?.[key] || I18N.en[key] || key;
};

// Global notifications handler
function toast(msg, isErr = false) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.innerHTML = (isErr ? '⚠️ ' : '✅ ') + msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

// Router actions
const actions = {
  toast,
  setRole(role) {
    state.activeRole = role;
    const views = { patient: 'view-patient', clinician: 'view-clinician', admin: 'view-admin' };
    
    Object.keys(views).forEach(k => {
      const el = document.getElementById(views[k]);
      if (el) el.classList.toggle('active', k === role);
    });
    
    const cartFab = document.getElementById('cart-fab');
    if (cartFab) cartFab.style.display = role === 'patient' ? 'flex' : 'none';
    
    renderApp();
  },
  
  setLang(lang) {
    state.currentLang = lang;
    renderApp();
  },

  setPatientTab(tab) {
    state.patientTab = tab;
    renderApp();
  },

  setClinTab(tab) {
    state.clinTab = tab;
    renderApp();
  },

  setAdminTab(tab) {
    state.adminTab = tab;
    renderApp();
  },

  setClinFacility(id) {
    state.clinFacilityId = id;
    renderApp();
  },

  setAdminAIMed(id) {
    state.aiMedId = id;
    renderApp();
  },

  addToCart(medId) {
    const fs = state.facilityStock[state.currentUser.facilityId]?.[medId] || { stock: 0 };
    if (fs.stock <= 0) {
      toast(`${getMed(medId).name} is out of stock right now`, true);
      return;
    }
    state.cart[medId] = (state.cart[medId] || 0) + 1;
    toast(`Added ${getMed(medId).name} to your cart`);
    renderApp();
  },

  changeCart(medId, delta) {
    state.cart[medId] = (state.cart[medId] || 0) + delta;
    if (state.cart[medId] <= 0) {
      delete state.cart[medId];
    }
    renderApp();
  },

  toggleDrawer(open) {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
  },

  async submitOrder() {
    const ids = Object.keys(state.cart);
    if (!ids.length) {
      toast('Add at least one medicine first', true);
      return;
    }
    
    const delivery = state.deliveryMode;
    
    // Address out-of-range check for home delivery
    if (delivery === 'delivery') {
      const pin = document.getElementById('addr-pin').value.trim();
      const addrLine = document.getElementById('addr-line').value.trim();
      if (!pin || pin.length !== 6 || isNaN(pin)) {
        toast("Please enter a valid 6-digit pincode.", true);
        return;
      }
      // Check if pincode belongs to Lucknow (starts with 226)
      if (!pin.startsWith("226")) {
        toast("Out of Range! We currently only deliver within the Lucknow district region (pincode starting with 226).", true);
        return;
      }
    }

    const date = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    let medListText = [];

    for (let id of ids) {
      const m = getMed(id);
      const order = {
        patient: state.currentUser.name,
        facilityId: state.currentUser.facilityId || 1,
        medId: Number(id),
        qty: state.cart[id],
        delivery: delivery,
        date: date,
        status: 'pending'
      };
      
      medListText.push(`${state.cart[id]}x ${m.name}`);
      
      // Save order to Firestore (or state fallback)
      await dbPlaceOrder(order);
      state.requests.push({ id: Math.floor(Math.random() * 1000) + 6000, ...order });
    }

    state.cart = {};
    actions.toggleDrawer(false);
    toast(delivery === 'delivery' ? 'Order placed — it will be delivered to your address' : 'Order placed — ready for pickup once approved');
    
    // Simulate SMS/WhatsApp/Email notification
    const userContact = state.currentUser.phone || "98XXXXXX21";
    const userEmail = `${state.currentUser.username || 'user'}@swasthyanet.in`;
    setTimeout(() => {
      actions.toast(`📱 SMS/WhatsApp sent to ${userContact}: "SwasthyaNet Order placed! Meds: [${medListText.join(', ')}]. Mode: ${delivery.toUpperCase()}."`);
      actions.toast(`✉️ Email sent to ${userEmail}: "Your SwasthyaNet Prescription Refill Request has been submitted for approval."`);
    }, 1500);

    renderApp();
  },

  openApptModal(docId, prefillReason = '') {
    actions.apptDoctorId = docId;
    const d = DOCTORS.find(doc => doc.id === docId);
    document.getElementById('appt-modal-title').textContent = `Book with ${d.name}`;
    document.getElementById('appt-doc-name').value = `${d.name} — ${d.specialty}`;
    document.getElementById('appt-date').value = '';
    document.getElementById('appt-time').value = '';
    document.getElementById('appt-reason').value = prefillReason;
    document.getElementById('appt-modal').classList.add('open');
  },

  closeApptModal() {
    document.getElementById('appt-modal').classList.remove('open');
  },

  async confirmBooking() {
    const dateInput = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value || '—';
    const reason = document.getElementById('appt-reason').value.trim();

    if (!reason) {
      toast('Please add a reason for the visit', true);
      return;
    }

    const date = dateInput ? new Date(dateInput).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
    const d = DOCTORS.find(doc => doc.id === actions.apptDoctorId) || DOCTORS[0];

    const newAppt = {
      patient: state.currentUser.name,
      doctorId: actions.apptDoctorId,
      date: date,
      time: time,
      reason: reason,
      urgent: false,
      status: 'scheduled',
      patientRating: 0
    };

    await dbBookAppointment(newAppt);
    state.appointments.push({ id: Math.floor(Math.random() * 1000) + 7000, ...newAppt });

    actions.closeApptModal();
    toast('Appointment booked successfully!');
    actions.setPatientTab('appts');

    // Simulate SMS/WhatsApp/Email notification
    const userContact = state.currentUser.phone || "98XXXXXX21";
    const userEmail = `${state.currentUser.username || 'user'}@swasthyanet.in`;
    setTimeout(() => {
      actions.toast(`📱 SMS/WhatsApp sent to ${userContact}: "Appointment booked! with ${d.name} on ${date} at ${time}. Ref: #${Math.floor(Math.random()*10000)}."`);
      actions.toast(`✉️ Email sent to ${userEmail}: "SwasthyaNet Booking Confirmed: Appt with ${d.name} is scheduled."`);
    }, 1500);
  },

  rateDoctor(apptId, stars) {
    const appt = state.appointments.find(a => a.id === apptId);
    if (!appt || appt.patientRating) return;
    
    const docItem = DOCTORS.find(d => d.id === appt.doctorId);
    if (docItem) {
      docItem.ratingSum += stars;
      docItem.ratingCount += 1;
    }
    appt.patientRating = stars;
    toast('Thanks for rating your doctor');
    renderApp();
  },

  completeAppointment(apptId) {
    const appt = state.appointments.find(a => a.id === apptId);
    if (appt) {
      appt.status = 'completed';
      toast(`Marked appointment with ${appt.patient} as completed`);
      renderApp();
    }
  },

  restockInventory(facilityId, medId, qty) {
    if (qty <= 0) {
      toast('Enter a valid quantity', true);
      return;
    }
    if (state.facilityStock[facilityId] && state.facilityStock[facilityId][medId]) {
      state.facilityStock[facilityId][medId].stock += qty;
      toast(`Restocked ${qty} units of ${getMed(medId).name}`);
      renderApp();
    }
  },

  savePatientRecord(facilityId, patientData) {
    const lastVisit = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const p = {
      id: Math.floor(Math.random() * 1000) + 8000,
      facilityId,
      lastVisit,
      ...patientData
    };
    state.patients.push(p);
    toast(`Patient record created for ${p.name}`);
    renderApp();
  },

  saveFacilityLiveStatus(facilityId, statusData) {
    const fac = state.facilities.find(f => f.id === facilityId);
    if (fac) {
      Object.assign(fac, statusData);
      toast(`Live operational status updated for ${fac.name}`);
      renderApp();
    }
  },

  async submitAttendanceRecord(record) {
    await dbMarkAttendance(record);
    state.attendanceLog.unshift({ id: Math.floor(Math.random() * 1000) + 9000, ...record });
    toast(record.onSite ? `Attendance ${record.type} recorded!` : `Attendance logged but FLAGGED outside bounds!`, !record.onSite);
    renderApp();
  },

  approveStaff(id) {
    const staff = state.pendingStaff.find(p => p.id === id);
    if (!staff) return;

    const initials = staff.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const newUser = {
      username: staff.username,
      password: staff.password,
      role: 'clinician',
      name: staff.name,
      phone: staff.phone,
      facilityId: staff.facilityId,
      initials: initials
    };

    INITIAL_USERS.push(newUser);
    state.pendingStaff = state.pendingStaff.filter(p => p.id !== id);
    toast(`${staff.name} credential profiles approved & activated.`);
    renderApp();
  },

  rejectStaff(id) {
    const staff = state.pendingStaff.find(p => p.id === id);
    if (staff) {
      state.pendingStaff = state.pendingStaff.filter(p => p.id !== id);
      toast(`Credential application for ${staff.name} has been rejected.`, true);
      renderApp();
    }
  },

  applyRedistribution(fromId, toId, medId, units) {
    const fromStock = state.facilityStock[fromId]?.[medId];
    const toStock = state.facilityStock[toId]?.[medId];

    if (!fromStock || fromStock.stock < units) {
      toast("Source facility has insufficient stock to complete transfer", true);
      return;
    }

    fromStock.stock -= units;
    toStock.stock += units;
    toast(`Transferred ${units} units of ${getMed(medId).name} from ${getFacility(fromId).name} to ${getFacility(toId).name}`);
    renderApp();
  },

  notifyFacility(name) {
    toast(`Sent formal administrative notice of underperformance request to: ${name}`);
  },

  requestUrgentAdvice(text) {
    const reason = text ? `URGENT: ${text}` : 'URGENT: patient requested immediate doctor advice';
    const facilityDoctor = DOCTORS.find(d => d.facilityId === (state.currentUser?.facilityId || 1)) || DOCTORS[0];
    
    state.appointments.push({
      id: Math.floor(Math.random() * 1000) + 7000,
      patient: state.currentUser?.name || "Patient",
      doctorId: facilityDoctor.id,
      date: "Today",
      time: "ASAP",
      reason: reason,
      urgent: true,
      status: 'scheduled',
      patientRating: 0
    });

    toast('Urgent alert sent to the duty doctor at your facility!');
    actions.setPatientTab('appts');
  },

  // Mounting sub-components
  mountSymptomChecker(container) {
    renderAISymptomChecker(container, state, actions);
  },

  async toggleVoiceSearch(inputId, callback) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    // Try native Web Speech API recognition first
    const nativeRec = startVoiceRecognition(
      (text) => {
        inputEl.value = text;
        inputEl.dispatchEvent(new Event('input'));
        if (callback) callback();
      },
      () => {
        // finished
      },
      state.currentLang
    );

    if (nativeRec) {
      toast("Listening... Speak now");
      return;
    }

    // Cloud REST Fallback using MediaRecorder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      
      mediaRecorder.ondataavailable = ev => chunks.push(ev.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        inputEl.placeholder = "Recognizing voice...";
        const text = await cloudSpeechToText(blob, state.currentLang);
        inputEl.placeholder = "";
        if (text) {
          inputEl.value = text;
          inputEl.dispatchEvent(new Event('input'));
          if (callback) callback();
        }
      };
      
      mediaRecorder.start();
      toast("Listening (Cloud Mode)... Speak now");
      setTimeout(() => mediaRecorder.stop(), 4000);
    } catch (err) {
      toast("Voice permission denied or not supported.", true);
    }
  },

  speakText(text) {
    cloudTextToSpeech(text, state.currentLang);
  },

  changeTextSize(dir) {
    changeTextSize(dir);
  },

  toggleContrast() {
    toggleContrast();
  },

  toggleReadAloud() {
    toggleReadAloud(state.currentLang);
  },

  openProfile() {
    const u = state.currentUser;
    if (!u) return;
    document.getElementById('profile-avatar').textContent = u.initials || '??';
    document.getElementById('profile-name').textContent = u.name || 'Anonymous';
    document.getElementById('profile-role').textContent = u.role ? u.role.toUpperCase() : 'USER';
    document.getElementById('profile-name-input').value = u.name || '';
    document.getElementById('profile-phone-input').value = u.phone || '';
    document.getElementById('profile-username-input').value = u.username || '';
    
    document.getElementById('profile-drawer').classList.add('open');
    document.getElementById('profile-overlay').classList.add('open');
  },

  async doLogout() {
    state.currentUser = null;
    document.getElementById('profile-drawer').classList.remove('open');
    document.getElementById('profile-overlay').classList.remove('open');
    document.getElementById('app-root').style.display = 'none';
    document.getElementById('login-gate').style.display = 'flex';
    
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    
    if (auth) {
      try {
        await signOut(auth);
        toast("Logged out successfully from Firebase.");
      } catch (err) {
        console.warn("Firebase sign out failed:", err);
      }
    }
  },

  async saveProfile() {
    const newName = document.getElementById('profile-name-input').value.trim();
    const newPhone = document.getElementById('profile-phone-input').value.trim();
    if (newName && state.currentUser) {
      state.currentUser.name = newName;
      state.currentUser.phone = newPhone;
      state.currentUser.initials = newName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      
      // Update in Firestore
      if (db && state.currentUser.uid) {
        try {
          await setDoc(doc(db, "users", state.currentUser.uid), {
            name: newName,
            phone: newPhone,
            role: state.currentUser.role,
            facilityId: state.currentUser.facilityId || 1,
            username: state.currentUser.username,
            initials: state.currentUser.initials
          }, { merge: true });
          toast("Profile synced with Firestore database.");
        } catch (err) {
          console.warn("Firestore profile sync failed:", err);
        }
      }
      
      toast("Profile updated.");
      document.getElementById('profile-drawer').classList.remove('open');
      document.getElementById('profile-overlay').classList.remove('open');
      renderApp();
    }
  }
};

// Global render router
function renderApp() {
  if (!state.currentUser) return;
  
  // Header Topbar
  const headerMount = document.getElementById('topbar-mount');
  if (headerMount) renderTopbar(headerMount, state, actions);

  // Dynamic dashboards
  if (state.activeRole === 'patient') {
    const patientMount = document.getElementById('patient-view-mount');
    if (patientMount) renderPatientDashboard(patientMount, state, actions);
  } else if (state.activeRole === 'clinician') {
    const clinicianMount = document.getElementById('clinician-view-mount');
    if (clinicianMount) renderClinicianDashboard(clinicianMount, state, actions);
  } else if (state.activeRole === 'admin') {
    const adminMount = document.getElementById('admin-view-mount');
    if (adminMount) renderAdminOverview(adminMount, state, actions);
  }

  // Sync Cart Drawer elements
  syncCartDrawer();
}

function syncCartDrawer() {
  const ids = Object.keys(state.cart);
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = ids.reduce((s, id) => s + state.cart[id], 0);

  const drawerBody = document.getElementById('drawer-items');
  if (drawerBody) {
    if (!ids.length) {
      drawerBody.innerHTML = `<div class="empty-note">Your cart is empty.</div>`;
    } else {
      drawerBody.innerHTML = ids.map(id => {
        const m = getMed(id);
        return `
          <div class="cart-item">
            <div class="info"><div class="n">${m.icon} ${m.name}</div><div class="p">₹${m.price} · ${m.category}</div></div>
            <div class="qty-stepper">
              <button class="btn-dec">−</button>
              <span>${state.cart[id]}</span>
              <button class="btn-inc">+</button>
            </div>
          </div>`;
      }).join('');
      
      drawerBody.querySelectorAll('.cart-item').forEach((item, idx) => {
        const medId = Number(ids[idx]);
        item.querySelector('.btn-inc').onclick = () => actions.changeCart(medId, 1);
        item.querySelector('.btn-dec').onclick = () => actions.changeCart(medId, -1);
      });
    }
  }

  const drawerTotal = document.getElementById('drawer-total');
  if (drawerTotal) {
    const total = ids.reduce((s, id) => s + getMed(id).price * state.cart[id], 0);
    drawerTotal.textContent = `₹${total}`;
  }
}

// Authentication gate bindings
window.setLoginRole = (role) => {
  const tabs = document.querySelectorAll('#login-role-tabs button');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.role === role));
  
  // Set demo login guidance hints
  const hints = {
    patient: 'Demo account — username <b>asha</b>, password <b>asha123</b>. Or create your own patient account below.',
    clinician: 'Demo account — username <b>dr.priya</b>, password <b>doctor123</b>. Register below for admin review.',
    admin: 'Demo account — username <b>admin</b>, password <b>admin123</b>. Admin keys are issued offline.'
  };
  document.getElementById('login-hint').innerHTML = hints[role] || '';
  document.getElementById('login-error').style.display = 'none';

  // Toggle patient/clinician self-signup options
  document.getElementById('login-signup-switch').style.display = role === 'patient' ? 'block' : 'none';
  document.getElementById('login-docsignup-switch').style.display = role === 'clinician' ? 'block' : 'none';
};

window.attemptLogin = async () => {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const activeTab = document.querySelector('#login-role-tabs button.active');
  const role = activeTab ? activeTab.dataset.role : 'patient';

  if (!u || !p) {
    showLoginError("Please enter username and password.");
    return;
  }

  // Format email from username
  const email = u.includes('@') ? u : `${u}@swasthyanet.in`;
  
  if (auth && db) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, p);
      const uid = userCredential.user.uid;
      const userDoc = await getDoc(doc(db, "users", uid));
      
      if (userDoc.exists()) {
        completeLogin({ ...userDoc.data(), uid });
        toast("Authenticated securely via Firebase!");
        return;
      } else {
        // Doc doesn't exist yet but user does (e.g. newly created auth user)
        const initials = u.slice(0, 2).toUpperCase();
        const fallbackProfile = { username: u, name: u, role, facilityId: 1, initials, uid };
        await setDoc(doc(db, "users", uid), fallbackProfile);
        completeLogin(fallbackProfile);
        toast("Created missing user profile document.");
        return;
      }
    } catch (error) {
      console.warn("Firebase Auth failed. Checking local fallbacks:", error.message);
    }
  }

  // Fallback to local INITIAL_USERS mock arrays
  const user = INITIAL_USERS.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p && x.role === role);
  if (!user) {
    showLoginError("Incorrect credentials or Firebase connection error.");
    return;
  }

  completeLogin(user);
};

window.showSignup = () => {
  document.getElementById('login-form-fields').style.display = 'none';
  document.getElementById('login-submit-btn').style.display = 'none';
  document.getElementById('login-hint').style.display = 'none';
  document.getElementById('login-role-tabs').style.display = 'none';
  document.getElementById('login-signup-switch').style.display = 'none';
  document.getElementById('login-docsignup-switch').style.display = 'none';
  document.getElementById('signup-fields').style.display = 'block';
};

window.showDoctorSignup = () => {
  document.getElementById('login-form-fields').style.display = 'none';
  document.getElementById('login-submit-btn').style.display = 'none';
  document.getElementById('login-hint').style.display = 'none';
  document.getElementById('login-role-tabs').style.display = 'none';
  document.getElementById('login-signup-switch').style.display = 'none';
  document.getElementById('login-docsignup-switch').style.display = 'none';
  
  const dsFac = document.getElementById('ds-facility');
  if (!dsFac.options.length) {
    dsFac.innerHTML = FACILITIES.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  }
  document.getElementById('doctor-signup-fields').style.display = 'block';
};

window.hideSignup = () => {
  document.getElementById('login-form-fields').style.display = 'block';
  document.getElementById('login-submit-btn').style.display = 'block';
  document.getElementById('login-hint').style.display = 'block';
  document.getElementById('login-role-tabs').style.display = 'flex';
  document.getElementById('signup-fields').style.display = 'none';
  document.getElementById('doctor-signup-fields').style.display = 'none';
  
  const activeTab = document.querySelector('#login-role-tabs button.active');
  const role = activeTab ? activeTab.dataset.role : 'patient';
  window.setLoginRole(role);
};

window.attemptSignup = () => {
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  
  const fileInput = document.getElementById('signup-aadhaar');
  const file = fileInput ? fileInput.files[0] : null;

  if (!name || !username || !password) {
    toast("Name, Username and Password are required", true);
    return;
  }

  if (!file) {
    toast("Please upload a clear photo of your Aadhaar card first.", true);
    return;
  }

  const statusEl = document.getElementById('signup-aadhaar-status');
  statusEl.style.display = "block";
  statusEl.innerHTML = "<div class='attend-status-line'>🔍 Verifying Aadhaar details via Gemini Vision AI...</div>";

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64Data = reader.result;
      const result = await scanAadhaarCard(base64Data, file.type);
      
      if (!result.isValid) {
        statusEl.innerHTML = `<div class='attend-status-line err'>❌ Invalid Aadhaar: ${result.error || "Please upload a valid Aadhaar card photo."}</div>`;
        toast("Aadhaar Verification Failed: " + (result.error || "Invalid Card"), true);
        return;
      }
      
      if (!result.isClear) {
        statusEl.innerHTML = `<div class='attend-status-line err'>❌ Blurry Image: ${result.error || "Please upload a clear, readable image."}</div>`;
        toast("Verification Failed: Image is too blurry or text is not readable.", true);
        return;
      }

      // Check name match
      const adharName = (result.name || "").replace(/\s+/g, ' ').trim().toLowerCase();
      const inputName = name.replace(/\s+/g, ' ').trim().toLowerCase();

      if (!adharName || (!adharName.includes(inputName) && !inputName.includes(adharName))) {
        statusEl.innerHTML = `<div class='attend-status-line err'>❌ Name Mismatch: Aadhaar says "${result.name || 'Unknown'}" but you typed "${name}"</div>`;
        toast(`Verification Failed: Name on Aadhaar ("${result.name || 'Unknown'}") does not match "${name}"`, true);
        return;
      }

      statusEl.innerHTML = `<div class='attend-status-line ok'>✅ Aadhaar Verified! Name: ${result.name}, No: ${result.aadhaarNum}</div>`;
      
      // Proceed with registration
      if (auth && db) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, `${username}@swasthyanet.in`, password);
          const uid = userCredential.user.uid;
          const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          
          const newUser = {
            username: username,
            role: 'patient',
            name: name,
            phone: phone,
            facilityId: 1,
            initials: initials
          };
          
          await setDoc(doc(db, "users", uid), newUser);
          toast("Account created and synced with Firebase!");
          setTimeout(() => {
            completeLogin({ ...newUser, uid });
          }, 300);
          return;
        } catch (err) {
          console.error("Firebase Sign up failed:", err);
          toast("Firebase error: " + err.message, true);
        }
      }

      // Local array fallback
      setTimeout(() => {
        const newUser = {
          username: username,
          password: password,
          role: 'patient',
          name: name,
          phone: phone,
          facilityId: 1,
          initials: name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
        };
        
        INITIAL_USERS.push(newUser);
        toast(`Aadhaar Verified (${result.name}). Welcome to SwasthyaNet (Local Mode)!`);
        completeLogin(newUser);
      }, 800);

    } catch (err) {
      console.error("Aadhaar scanning exception:", err);
      statusEl.innerHTML = `<div class='attend-status-line err'>❌ Verification crashed: ${err.message}</div>`;
      toast("Error processing document: " + err.message, true);
    }
  };
  reader.readAsDataURL(file);
};

window.attemptDoctorSignup = () => {
  const role = document.getElementById('ds-role').value;
  const name = document.getElementById('ds-name').value.trim();
  const phone = document.getElementById('ds-phone').value.trim();
  const username = document.getElementById('ds-username').value.trim();
  const password = document.getElementById('ds-password').value;
  const facId = Number(document.getElementById('ds-facility').value);
  const degree = document.getElementById('ds-degree').value.trim();
  const specialty = document.getElementById('ds-specialty').value.trim();
  const exp = Number(document.getElementById('ds-experience').value) || 0;

  if (!name || !username || !password || !degree || !specialty) {
    toast("Please complete all profile details.", true);
    return;
  }

  // In production, we register them as pending in Firestore. 
  // For prototype ease, we save to the pending staff log.
  state.pendingStaff.push({
    id: 'ps' + (Math.floor(Math.random() * 1000) + 5000),
    role, name, phone, username, password, facilityId: facId, degree, specialty, experience: exp,
    selfie: "https://randomuser.me/api/portraits/men/41.jpg",
    govIdPhoto: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=300&h=200&fit=crop",
    submittedOn: 'Jul 6'
  });

  toast("Roster application submitted! Pending admin review.");
  window.hideSignup();
};

function showLoginError(msg) {
  const errEl = document.getElementById('login-error');
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

function completeLogin(user) {
  state.currentUser = user;
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('app-root').style.display = 'block';
  
  // Set router context role
  actions.setRole(user.role);
}

// Global actions triggers
window.setDeliveryMode = (mode) => {
  state.deliveryMode = mode;
  document.getElementById('opt-pickup').classList.toggle('active', mode==='pickup');
  document.getElementById('opt-delivery').classList.toggle('active', mode==='delivery');
  document.getElementById('address-fields').style.display = mode==='delivery' ? 'block' : 'none';
};

window.closeApptModal = () => actions.closeApptModal();
window.confirmBooking = () => actions.confirmBooking();
window.submitOrder = () => actions.submitOrder();
window.toggleCartDrawer = (open) => actions.toggleDrawer(open);

window.openProfile = () => actions.openProfile();
window.doLogout = () => actions.doLogout();
window.saveProfile = () => actions.saveProfile();

// Bootstrap
window.onload = () => {
  window.setLoginRole('patient');

  // Set up Aadhaar upload preview listener
  const signupAadhaar = document.getElementById('signup-aadhaar');
  const signupAadhaarPreview = document.getElementById('signup-aadhaar-preview');
  if (signupAadhaar && signupAadhaarPreview) {
    signupAadhaar.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          signupAadhaarPreview.innerHTML = `<img src="${reader.result}" style="max-width:100%; border-radius:4px; max-height:180px; object-fit:contain;">`;
        };
        reader.readAsDataURL(file);
      }
    };
  }
};
