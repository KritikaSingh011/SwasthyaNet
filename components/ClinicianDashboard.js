import { CATALOG, getMed } from '../data/catalog.js';
import { FACILITIES, getFacility } from '../data/facilities.js';
import { renderAttendanceMap } from '../services/maps.js';
import { haversineMeters } from '../utils/geo.js';
import { cloudSpeechToText } from '../services/voice.js';

export function renderClinicianDashboard(container, state, actions) {
  const currentTab = state.clinTab || 'inv';
  const facility = getFacility(state.clinFacilityId || 1);

  container.innerHTML = `
    <div class="facility-picker">
      <span data-i18n="staffingAt">${state.translate("staffingAt")}</span>
      <select class="pill-select" id="clin-facility"></select>
      <b id="clin-facility-type">(${facility.type} · Footfall: ${facility.footfall})</b>
    </div>

    <div class="tabs">
      <button class="${currentTab === 'inv' ? 'active' : ''}" data-tab="inv">
        <div class="tab-icon">📦</div>
        <span>${state.translate("tabInventory")}</span>
      </button>
      <button class="${currentTab === 'rec' ? 'active' : ''}" data-tab="rec">
        <div class="tab-icon">📋</div>
        <span>${state.translate("tabRecords")}</span>
      </button>
      <button class="${currentTab === 'status' ? 'active' : ''}" data-tab="status">
        <div class="tab-icon">🏥</div>
        <span>${state.translate("tabFacilityStatus")}</span>
      </button>
      <button class="${currentTab === 'appts' ? 'active' : ''}" data-tab="appts">
        <div class="tab-icon">📅</div>
        <span>Appointments</span>
      </button>
      <button class="${currentTab === 'attendance' ? 'active' : ''}" data-tab="attendance">
        <div class="tab-icon">📍</div>
        <span>Attendance</span>
      </button>
    </div>

    <!-- Inventory Tab -->
    <div id="clin-tab-inv" style="display: ${currentTab === 'inv' ? 'block' : 'none'};">
      <div class="stat-row">
        <div class="card stat-card"><div class="l">${state.translate("statTotal")}</div><div class="n" id="c-stat-total">0</div></div>
        <div class="card stat-card warn"><div class="l">${state.translate("statLow")}</div><div class="n" id="c-stat-low">0</div></div>
        <div class="card stat-card alert"><div class="l">${state.translate("statOut")}</div><div class="n" id="c-stat-out">0</div></div>
        <div class="card stat-card good"><div class="l">${state.translate("statPendingReq")}</div><div class="n" id="c-stat-pending">0</div></div>
      </div>

      <div class="section-head">
        <div><span class="eyebrow">${state.translate("eyebrowQueue")}</span><h2>${state.translate("hQueue")}</h2></div>
      </div>
      <div class="card" style="margin-bottom:30px; overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>${state.translate("colPatient")}</th>
              <th>${state.translate("colMedicine")}</th>
              <th>${state.translate("colQty")}</th>
              <th>${state.translate("colDelivery")}</th>
              <th>${state.translate("colStock")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="queue-body"></tbody>
        </table>
      </div>

      <div class="section-head">
        <div><span class="eyebrow">${state.translate("eyebrowStock")}</span><h2>${state.translate("hInventory")}</h2></div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7C76" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="inv-search" placeholder="${state.translate("phSearchInv")}">
          <button class="speak-btn" style="width:26px;height:26px;font-size:11px;" id="mic-inv-search">🎙️</button>
        </div>
        <select class="pill-select" id="inv-filter">
          <option value="all">${state.translate("filterAll")}</option>
          <option value="low">${state.translate("filterLow")}</option>
          <option value="out">${state.translate("filterOut")}</option>
        </select>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>${state.translate("colMedicine")}</th>
              <th>${state.translate("colCategory")}</th>
              <th>${state.translate("colStock")}</th>
              <th>Count</th>
              <th>Avg daily use</th>
              <th>Days left</th>
              <th>Restock</th>
            </tr>
          </thead>
          <tbody id="inventory-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Records Tab -->
    <div id="clin-tab-rec" style="display: ${currentTab === 'rec' ? 'block' : 'none'};">
      <div class="section-head">
        <div><span class="eyebrow">${state.translate("eyebrowRecords")}</span><h2>${state.translate("hRecords")}</h2></div>
        <button class="btn btn-primary btn-sm" id="btn-toggle-add-patient">${state.translate("addPatient")}</button>
      </div>

      <div class="card" id="add-patient-card" style="display:none; padding:18px; margin-bottom:20px;">
        <div class="form-field full" style="margin-bottom:12px;">
          <label>Dictate intake notes (read out paper files or patient's words)</label>
          <textarea class="dictation-box" id="np-dictation" rows="3" placeholder="e.g. Name is Ram Kumar, age 58, male, diagnosed with type 2 diabetes and hypertension, taking metformin 500mg and amlodipine 5mg"></textarea>
          <div class="mic-row">
            <button class="mic-btn" id="np-mic-btn">🎙️ <span id="np-mic-text">Start dictation</span></button>
            <button class="btn btn-coral btn-sm" id="btn-ai-fill">🤖 AI: fill form from notes</button>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label>${state.translate("fName")}</label><input id="np-name"></div>
          <div class="form-field"><label>${state.translate("fAge")}</label><input id="np-age" type="number"></div>
          <div class="form-field">
            <label>${state.translate("fGender")}</label>
            <select id="np-gender">
              <option>${state.translate("genderF")}</option>
              <option>${state.translate("genderM")}</option>
              <option>${state.translate("genderO")}</option>
            </select>
          </div>
          <div class="form-field"><label>${state.translate("fPhone")}</label><input id="np-phone"></div>
          <div class="form-field full"><label>${state.translate("fDiseases")}</label><input id="np-dis"></div>
          <div class="form-field full"><label>${state.translate("fMeds")}</label><input id="np-meds"></div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn btn-primary" id="btn-save-record">${state.translate("save")}</button>
          <button class="btn btn-ghost" id="btn-cancel-add">${state.translate("cancel")}</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7C76" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="rec-search" placeholder="${state.translate("phSearchPatient")}">
          <button class="speak-btn" style="width:26px;height:26px;font-size:11px;" id="mic-rec-search">🎙️</button>
        </div>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>${state.translate("fName")}</th>
              <th>${state.translate("fAge")}</th>
              <th>${state.translate("fGender")}</th>
              <th>${state.translate("fDiseases")}</th>
              <th>${state.translate("fMeds")}</th>
              <th>${state.translate("colLastVisit")}</th>
            </tr>
          </thead>
          <tbody id="records-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Live Update Status Tab -->
    <div id="clin-tab-status" style="display: ${currentTab === 'status' ? 'block' : 'none'};">
      <div class="section-head">
        <div>
          <span class="eyebrow">${state.translate("eyebrowStatus")}</span>
          <h2>${state.translate("hStatus")}</h2>
          <p>${state.translate("pStatus")}</p>
        </div>
      </div>
      <div class="card" style="padding:20px;">
        <div class="form-grid">
          <div class="form-field"><label>${state.translate("fBedsTotal")}</label><input id="fs-bedsTotal" type="number" value="${facility.bedsTotal}"></div>
          <div class="form-field"><label>${state.translate("fBedsOcc")}</label><input id="fs-bedsOcc" type="number" value="${facility.bedsOcc}"></div>
          <div class="form-field"><label>${state.translate("fDocSched")}</label><input id="fs-docSched" type="number" value="${facility.docSched}"></div>
          <div class="form-field"><label>${state.translate("fDocPresent")}</label><input id="fs-docPresent" type="number" value="${facility.docPresent}"></div>
          <div class="form-field"><label>${state.translate("fFootfall")}</label><input id="fs-footfall" type="number" value="${facility.footfall}"></div>
        </div>
        <button class="btn btn-primary" style="margin-top:14px;" id="btn-save-live-status">${state.translate("saveUpdate")}</button>
      </div>
    </div>

    <!-- Appointments Tab -->
    <div id="clin-tab-appts" style="display: ${currentTab === 'appts' ? 'block' : 'none'};">
      <div class="section-head">
        <div><span class="eyebrow">Urgent first</span><h2>Appointments roster</h2></div>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date &amp; time</th>
              <th>Reason</th>
              <th>Priority</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="clin-appts-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Attendance (Check-in Camera & Location) Tab -->
    <div id="clin-tab-attendance" style="display: ${currentTab === 'attendance' ? 'block' : 'none'};">
      <div class="section-head">
        <div>
          <span class="eyebrow">Geo-verified Check-in</span>
          <h2>Punch Attendance</h2>
          <p>Verify check-in at <span id="attend-facility-name">${facility.name}</span></p>
        </div>
      </div>
      
      <div class="card attend-card">
        <div class="attend-cam-wrap" id="attend-cam-wrap">
          <div class="cam-placeholder" id="attend-cam-placeholder">Camera preview will appear here.<br>Click "Start camera" to capture selfie.</div>
          <video id="attend-video" autoplay playsinline muted style="display:none;"></video>
          <img id="attend-shot" class="attend-shot" style="display:none;">
        </div>
        <canvas id="attend-canvas" width="480" height="360" style="display:none;"></canvas>
        
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="attend-start-btn">🎥 Start camera</button>
          <button class="btn btn-coral btn-sm" id="attend-capture-btn" style="display:none;">📸 Capture Selfie</button>
          <button class="btn btn-ghost btn-sm" id="attend-retake-btn" style="display:none;">↺ Retake</button>
        </div>
        
        <div class="attend-status-line" id="attend-status-line" style="display:none;"></div>
        <div id="attend-map-wrap" style="height: 180px; width: 100%; margin-top:8px; border-radius:10px; overflow:hidden;"></div>
        
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn btn-primary btn-block" id="attend-in-btn" style="display:none; max-width:220px;">Confirm Check-in</button>
          <button class="btn btn-coral btn-block" id="attend-out-btn" style="display:none; max-width:220px;">Confirm Check-out</button>
        </div>
      </div>

      <div class="section-head" style="margin-top:20px;">
        <div><span class="eyebrow">Log</span><h2>Your attendance history</h2></div>
      </div>
      <div class="card" style="overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Date &amp; time</th>
              <th>Type</th>
              <th>Distance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="attend-my-body"></tbody>
        </table>
      </div>
    </div>
  `;

  // Populate facility picker dropdown
  const facSelect = container.querySelector('#clin-facility');
  if (!facSelect.options.length) {
    facSelect.innerHTML = FACILITIES.map(f => `<option value="${f.id}" ${f.id === state.clinFacilityId ? 'selected' : ''}>${f.name}</option>`).join('');
  }
  facSelect.onchange = () => {
    actions.setClinFacility(Number(facSelect.value));
  };

  // Bind tab navigation
  container.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = () => actions.setClinTab(btn.dataset.tab);
  });

  // Dynamic renders
  if (currentTab === 'inv') {
    renderInventoryTables(container, state, facility, actions);
  } else if (currentTab === 'rec') {
    renderRecordsTable(container, state, facility, actions);
  } else if (currentTab === 'appts') {
    renderClinicianAppts(container, state, actions);
  } else if (currentTab === 'attendance') {
    setupAttendanceCheckin(container, state, facility, actions);
  }

  // Live status updater binding
  const saveLiveBtn = container.querySelector('#btn-save-live-status');
  if (saveLiveBtn) {
    saveLiveBtn.onclick = () => {
      const updated = {
        bedsTotal: Number(container.querySelector('#fs-bedsTotal').value),
        bedsOcc: Number(container.querySelector('#fs-bedsOcc').value),
        docSched: Number(container.querySelector('#fs-docSched').value),
        docPresent: Number(container.querySelector('#fs-docPresent').value),
        footfall: Number(container.querySelector('#fs-footfall').value)
      };
      actions.saveFacilityLiveStatus(facility.id, updated);
    };
  }
}

function renderInventoryTables(container, state, facility, actions) {
  const stock = state.facilityStock[facility.id] || {};
  const meds = Object.values(stock);
  
  // Tally stats
  const low = meds.filter(fs => {
    const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
    return fs.stock > 0 && dl < 14;
  }).length;
  const out = meds.filter(fs => fs.stock <= 0).length;
  const pending = state.requests.filter(r => r.facilityId === facility.id && r.status === 'pending').length;

  container.querySelector('#c-stat-total').textContent = CATALOG.length;
  container.querySelector('#c-stat-low').textContent = low;
  container.querySelector('#c-stat-out').textContent = out;
  container.querySelector('#c-stat-pending').textContent = pending;

  // Requests queue
  const pendingReqs = state.requests.filter(r => r.facilityId === facility.id && r.status === 'pending').slice().reverse();
  const queueBody = container.querySelector('#queue-body');
  if (!pendingReqs.length) {
    queueBody.innerHTML = `<tr><td colspan="6" class="empty-note">No pending requests.</td></tr>`;
  } else {
    queueBody.innerHTML = pendingReqs.map(r => {
      const m = getMed(r.medId);
      const fs = stock[m.id] || { stock: 0 };
      const enough = fs.stock >= r.qty;
      return `
        <tr>
          <td>${r.patient}</td>
          <td>${m.icon} ${m.name}</td>
          <td style="font-family:var(--font-mono)">${r.qty}</td>
          <td><span class="badge info">${r.delivery === 'delivery' ? 'Delivery' : 'Pickup'}</span></td>
          <td><span class="badge ${fs.stock > 0 ? 'ok' : 'out'}">${fs.stock} units left</span></td>
          <td style="white-space:nowrap" data-req-id="${r.id}">
            <button class="btn btn-primary btn-sm btn-approve" ${enough ? '' : 'disabled'}>Approve</button>
            <button class="btn btn-ghost btn-sm btn-reject">Reject</button>
          </td>
        </tr>`;
    }).join('');

    queueBody.querySelectorAll('tr').forEach(tr => {
      const reqId = Number(tr.querySelector('td:last-child').dataset.reqId);
      const btnApprove = tr.querySelector('.btn-approve');
      if (btnApprove) btnApprove.onclick = () => actions.approveRequest(reqId);
      tr.querySelector('.btn-reject').onclick = () => actions.rejectRequest(reqId);
    });
  }

  // Inventory Stock Room
  const q = (container.querySelector('#inv-search').value || '').toLowerCase();
  const filter = container.querySelector('#inv-filter').value;
  const invBody = container.querySelector('#inventory-body');

  const filteredMeds = CATALOG.filter(m => {
    const fs = stock[m.id] || { stock: 0, avgDailyUse: 0 };
    const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
    const lvl = fs.stock <= 0 ? 'out' : (dl < 14 ? 'low' : 'ok');
    
    const matchQ = m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    const matchF = filter === 'all' || lvl === filter;
    return matchQ && matchF;
  });

  if (!filteredMeds.length) {
    invBody.innerHTML = `<tr><td colspan="7" class="empty-note">No inventory matches search criteria.</td></tr>`;
    return;
  }

  invBody.innerHTML = filteredMeds.map(m => {
    const fs = stock[m.id] || { stock: 0, avgDailyUse: 0 };
    const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
    const lvl = fs.stock <= 0 ? 'out' : (dl < 7 ? 'out' : (dl < 14 ? 'low' : 'ok'));
    const isOut = fs.stock <= 0;

    return `
      <tr>
        <td><b>${m.icon} ${m.name}</b><div style="color:var(--muted); font-size:11px">${m.dose}</div></td>
        <td>${m.category}</td>
        <td><span class="badge ${lvl}">${isOut ? 'Out of stock' : (lvl === 'low' ? 'Low stock' : 'In stock')}</span></td>
        <td><span class="badge ${lvl}">${fs.stock} units</span></td>
        <td style="font-family:var(--font-mono); color:var(--muted)">${fs.avgDailyUse}/day</td>
        <td style="font-family:var(--font-mono); color:${dl < 7 ? 'var(--coral-600)' : (dl < 14 ? 'var(--amber-500)' : 'var(--muted)')}">
          ${dl > 90 ? '90+d' : Math.round(dl) + 'd'}
        </td>
        <td data-med-id="${m.id}">
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" min="1" value="20" class="restock-input" style="width:50px;">
            <button class="btn btn-ghost btn-sm btn-restock">+ Add</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  invBody.querySelectorAll('td:last-child').forEach(td => {
    const medId = Number(td.dataset.medId);
    td.querySelector('.btn-restock').onclick = () => {
      const qty = Number(td.querySelector('input').value);
      actions.restockInventory(facility.id, medId, qty);
    };
  });

  // Attach filters
  container.querySelector('#inv-search').oninput = () => renderInventoryTables(container, state, facility, actions);
  container.querySelector('#inv-filter').onchange = () => renderInventoryTables(container, state, facility, actions);
  
  const micInv = container.querySelector('#mic-inv-search');
  if (micInv) {
    micInv.onclick = () => actions.toggleVoiceSearch('inv-search', () => renderInventoryTables(container, state, facility, actions));
  }
}

function renderRecordsTable(container, state, facility, actions) {
  const recordsBody = container.querySelector('#records-body');
  const q = (container.querySelector('#rec-search').value || '').toLowerCase();
  
  const list = state.patients.filter(p => {
    const matchesFacility = p.facilityId === facility.id;
    const matchesQuery = p.name.toLowerCase().includes(q) || p.diseases.join(' ').toLowerCase().includes(q);
    return matchesFacility && matchesQuery;
  });

  if (!list.length) {
    recordsBody.innerHTML = `<tr><td colspan="6" class="empty-note">No patient records found.</td></tr>`;
  } else {
    recordsBody.innerHTML = list.map(p => `
      <tr>
        <td><b>${p.name}</b></td>
        <td style="font-family:var(--font-mono)">${p.age}</td>
        <td>${p.gender}</td>
        <td>${p.diseases.map(d => `<span class="pill-tag">${d}</span>`).join('') || '—'}</td>
        <td>${p.meds.map(m => `<span class="pill-tag" style="background:var(--mint-100); color:var(--teal-700)">${m}</span>`).join('') || '—'}</td>
        <td>${p.lastVisit}</td>
      </tr>`).join('');
  }

  // Intake Notes Form toggles
  const addCard = container.querySelector('#add-patient-card');
  container.querySelector('#btn-toggle-add-patient').onclick = () => {
    addCard.style.display = addCard.style.display === 'none' ? 'block' : 'none';
  };
  
  container.querySelector('#btn-cancel-add').onclick = () => {
    addCard.style.display = 'none';
  };

  // AI Intake Dictation
  const dictBtn = container.querySelector('#np-mic-btn');
  const dictText = container.querySelector('#np-mic-text');
  const dictBox = container.querySelector('#np-dictation');
  let dictRecording = false;
  let dictRecorderInstance = null;
  let dictChunks = [];

  dictBtn.onclick = async () => {
    if (dictRecording) {
      if (dictRecorderInstance) dictRecorderInstance.stop();
      dictRecording = false;
      dictBtn.classList.remove('listening');
      dictText.textContent = "Start dictation";
    } else {
      dictChunks = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        dictRecorderInstance = new MediaRecorder(stream);
        dictRecorderInstance.ondataavailable = ev => dictChunks.push(ev.data);
        dictRecorderInstance.onstop = async () => {
          const blob = new Blob(dictChunks, { type: 'audio/webm' });
          dictBox.placeholder = "Transcribing voice...";
          const text = await cloudSpeechToText(blob, state.currentLang);
          dictBox.placeholder = "Intake notes text...";
          if (text) dictBox.value = (dictBox.value ? dictBox.value + ' ' : '') + text;
        };
        dictRecorderInstance.start();
        dictRecording = true;
        dictBtn.classList.add('listening');
        dictText.textContent = "Listening... tap to stop";
      } catch (err) {
        actions.toast("Mic permissions blocked.", true);
      }
    }
  };

  // AI autofill parser
  container.querySelector('#btn-ai-fill').onclick = () => {
    const text = dictBox.value.trim();
    if (!text) {
      actions.toast("No notes captured to process.", true);
      return;
    }
    
    // Pattern matching intake notes parsing
    const lower = text.toLowerCase();
    let name = '';
    let age = '';
    let gender = '';
    
    let m = text.match(/name is ([a-zA-Z .]+?)(?:,|\.|\s+age|$)/i); if (m) name = m[1].trim();
    m = lower.match(/age(?: is| of)? (\d{1,3})/); if (m) age = m[1];
    if (!age) { m = lower.match(/(\d{1,3})\s*(?:years|yrs|year)/); if (m) age = m[1]; }
    
    if (/\bfemale\b/.test(lower)) gender = 'Female';
    else if (/\bmale\b/.test(lower)) gender = 'Male';
    else if (/\bother\b/.test(lower)) gender = 'Other';

    let dis = [];
    m = text.match(/diagnosed with ([^.]+?)(?:,? taking|,? on medic|\.|$)/i); if (m) dis = m[1].split(/,| and /).map(s => s.trim()).filter(Boolean);
    
    let meds = [];
    m = text.match(/taking ([^.]+?)(?:\.|$)/i); if (m) meds = m[1].split(/,| and /).map(s => s.trim()).filter(Boolean);

    if (name) container.querySelector('#np-name').value = name;
    if (age) container.querySelector('#np-age').value = age;
    if (gender) container.querySelector('#np-gender').value = gender;
    if (dis.length) container.querySelector('#np-dis').value = dis.join(', ');
    if (meds.length) container.querySelector('#np-meds').value = meds.join(', ');
    
    actions.toast("Form pre-filled from dictation!");
  };

  // Save patient intake record
  container.querySelector('#btn-save-record').onclick = () => {
    const newPatient = {
      name: container.querySelector('#np-name').value.trim(),
      age: Number(container.querySelector('#np-age').value),
      gender: container.querySelector('#np-gender').value,
      diseases: container.querySelector('#np-dis').value.split(',').map(s => s.trim()).filter(Boolean),
      meds: container.querySelector('#np-meds').value.split(',').map(s => s.trim()).filter(Boolean)
    };
    
    if (!newPatient.name || !newPatient.age) {
      actions.toast("Please fill in Name and Age.", true);
      return;
    }
    
    actions.savePatientRecord(facility.id, newPatient);
    addCard.style.display = 'none';
  };

  container.querySelector('#rec-search').oninput = () => renderRecordsTable(container, state, facility, actions);
  
  const micRec = container.querySelector('#mic-rec-search');
  if (micRec) {
    micRec.onclick = () => actions.toggleVoiceSearch('rec-search', () => renderRecordsTable(container, state, facility, actions));
  }
}

function renderClinicianAppts(container, state, actions) {
  const body = container.querySelector('#clin-appts-body');
  const roster = state.appointments.filter(a => a.status === 'scheduled').sort((a,b) => (b.urgent?1:0) - (a.urgent?1:0));

  if (!roster.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-note">No scheduled appointments.</td></tr>`;
    return;
  }

  body.innerHTML = roster.map(a => `
    <tr>
      <td><b>${a.patient}</b></td>
      <td>${a.date} · ${a.time}</td>
      <td>${a.reason}</td>
      <td><span class="badge ${a.urgent ? 'out' : 'info'}">${a.urgent ? 'Urgent' : 'Routine'}</span></td>
      <td><span class="badge pending">Scheduled</span></td>
      <td><button class="btn btn-primary btn-sm btn-complete" data-appt-id="${a.id}">Mark complete</button></td>
    </tr>`).join('');

  body.querySelectorAll('.btn-complete').forEach(btn => {
    btn.onclick = () => actions.completeAppointment(Number(btn.dataset.apptId));
  });
}

function setupAttendanceCheckin(container, state, facility, actions) {
  let stream = null;
  let selfieDataUrl = null;
  let geoResult = null;

  const camWrap = container.querySelector('#attend-cam-wrap');
  const placeholder = container.querySelector('#attend-cam-placeholder');
  const video = container.querySelector('#attend-video');
  const shotImg = container.querySelector('#attend-shot');
  const canvas = container.querySelector('#attend-canvas');
  const mapWrap = container.querySelector('#attend-map-wrap');

  const startBtn = container.querySelector('#attend-start-btn');
  const captureBtn = container.querySelector('#attend-capture-btn');
  const retakeBtn = container.querySelector('#attend-retake-btn');
  const statusLine = container.querySelector('#attend-status-line');
  const checkinBtn = container.querySelector('#attend-in-btn');
  const checkoutBtn = container.querySelector('#attend-out-btn');

  // Renders logs
  renderAttendanceHistory();

  startBtn.onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      video.style.display = 'block';
      placeholder.style.display = 'none';
      shotImg.style.display = 'none';
      
      startBtn.style.display = 'none';
      captureBtn.style.display = 'inline-flex';
      retakeBtn.style.display = 'none';
    } catch (err) {
      actions.toast("Selfie camera blocked or unavailable.", true);
    }
  };

  captureBtn.onclick = () => {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    selfieDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    shotImg.src = selfieDataUrl;
    shotImg.style.display = 'block';
    video.style.display = 'none';

    // Stop streams
    if (stream) stream.getTracks().forEach(t => t.stop());

    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-flex';

    verifyLocationAndGeofence();
  };

  retakeBtn.onclick = () => {
    selfieDataUrl = null;
    geoResult = null;
    
    shotImg.style.display = 'none';
    placeholder.style.display = 'block';
    video.style.display = 'none';
    statusLine.style.display = 'none';
    mapWrap.innerHTML = "";
    
    checkinBtn.style.display = 'none';
    checkoutBtn.style.display = 'none';
    
    startBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
  };

  function verifyLocationAndGeofence() {
    statusLine.style.display = 'flex';
    statusLine.textContent = "📍 Acquiring GPS signal coordinates...";
    
    if (!navigator.geolocation) {
      statusLine.textContent = "⚠️ Browser does not support geolocation.";
      return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
      geoResult = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      
      const distance = haversineMeters(geoResult.lat, geoResult.lng, facility.lat, facility.lng);
      const isWithinBounds = distance <= 400; // 400 meters geofence

      statusLine.className = 'attend-status-line ' + (isWithinBounds ? 'ok' : 'warn');
      statusLine.innerHTML = isWithinBounds
        ? `✅ Geofence Verified: You are ${Math.round(distance)}m from facility. Inside premises.`
        : `⚠️ Out of Bounds: You are ${(distance / 1000).toFixed(1)}km from facility. Checked-in will be flagged.`;

      // Render Dynamic Google Map
      renderAttendanceMap(mapWrap, geoResult.lat, geoResult.lng, facility.lat, facility.lng, 400);

      checkinBtn.style.display = 'inline-flex';
      checkoutBtn.style.display = 'inline-flex';
    }, err => {
      statusLine.textContent = "⚠️ Geolocation permission denied or unavailable.";
    });
  }

  checkinBtn.onclick = () => submitPunch('in');
  checkoutBtn.onclick = () => submitPunch('out');

  function submitPunch(type) {
    const distance = Math.round(haversineMeters(geoResult.lat, geoResult.lng, facility.lat, facility.lng));
    const onSite = distance <= 400;

    const punchRecord = {
      staff: state.currentUser.name,
      facilityId: facility.id,
      type: type,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      photo: selfieDataUrl,
      distance: distance,
      onSite: onSite,
      lat: geoResult.lat,
      lng: geoResult.lng
    };

    actions.submitAttendanceRecord(punchRecord);
    
    // Clear and redraw
    retakeBtn.click();
    renderAttendanceHistory();
  }

  function renderAttendanceHistory() {
    const historyBody = container.querySelector('#attend-my-body');
    const mine = state.attendanceLog.filter(a => a.staff === state.currentUser.name);
    
    if (!mine.length) {
      historyBody.innerHTML = `<tr><td colspan="5" class="empty-note">No punch records found for today.</td></tr>`;
      return;
    }

    historyBody.innerHTML = mine.map(a => `
      <tr>
        <td><img class="attend-log-thumb" src="${a.photo}" style="width:34px;height:34px;object-fit:cover;border-radius:6px;"></td>
        <td>Today · ${a.time}</td>
        <td><span class="badge ${a.type === 'in' ? 'info' : 'pending'}">${a.type === 'in' ? 'In' : 'Out'}</span></td>
        <td>${a.distance}m</td>
        <td><span class="badge ${a.onSite ? 'ok' : 'out'}">${a.onSite ? 'On site' : 'Flagged'}</span></td>
      </tr>`).join('');
  }
}
