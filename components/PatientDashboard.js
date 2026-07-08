import { CATALOG, getMed } from '../data/catalog.js';
import { FACILITIES, getFacility } from '../data/facilities.js';
import { DOCTORS, doctorAvgRating, starString } from '../data/doctors.js';

export function renderPatientDashboard(container, state, actions) {
  try {
    const currentTab = state.patientTab || 'pharmacy';
    
    container.innerHTML = `
      <!-- Patient view container -->
      <div class="hero">
        <div>
          <span class="eyebrow">${state.translate("heroEyebrow")}</span>
          <h1>${state.translate("heroTitle").replace("Asha", state.currentUser.name)}</h1>
          <p>${state.translate("heroSub")}</p>
        </div>
        <div class="hero-stats">
          <div><div class="n" id="stat-due-soon">0</div><div class="l">${state.translate("statDueSoon")}</div></div>
          <div><div class="n" id="stat-pending">0</div><div class="l">${state.translate("statPending")}</div></div>
          <div><div class="n" id="stat-fulfilled">0</div><div class="l">${state.translate("statFulfilled")}</div></div>
        </div>
      </div>

      <div class="tabs">
        <button class="${currentTab === 'pharmacy' ? 'active' : ''}" data-tab="pharmacy">
          <div class="tab-icon">💊</div>
          <span>${state.translate("tabPharmacy")}</span>
        </button>
        <button class="${currentTab === 'symptoms' ? 'active' : ''}" data-tab="symptoms">
          <div class="tab-icon">🤖</div>
          <span>${state.translate("tabSymptoms")}</span>
        </button>
        <button class="${currentTab === 'doctors' ? 'active' : ''}" data-tab="doctors">
          <div class="tab-icon">🩺</div>
          <span>${state.translate("tabDoctors")}</span>
        </button>
        <button class="${currentTab === 'appts' ? 'active' : ''}" data-tab="appts">
          <div class="tab-icon">📅</div>
          <span>${state.translate("tabAppts")}</span>
        </button>
      </div>

      <!-- Sub-tab content containers -->
      <div id="patient-tab-pharmacy" style="display: ${currentTab === 'pharmacy' ? 'block' : 'none'};">
        <div class="section-head">
          <div><span class="eyebrow">${state.translate("eyebrowRegulars")}</span><h2>${state.translate("hRegulars")}</h2></div>
        </div>
        <div class="myrx-row" id="myrx-row"></div>

        <div class="section-head" style="margin-top:28px;">
          <div>
            <span class="eyebrow">${state.translate("eyebrowPharmacy")}</span>
            <h2>${state.translate("hPharmacy")}</h2>
            <p>${state.translate("pPharmacy")}</p>
          </div>
        </div>
        
        <div class="toolbar">
          <div class="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7C76" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input id="patient-search" placeholder="${state.translate("phSearchMed")}">
            <button class="speak-btn" style="width:26px;height:26px;font-size:11px;" id="mic-patient-search" title="Search by voice">🎙️</button>
          </div>
          <select class="pill-select" id="patient-category"></select>
        </div>
        
        <div class="catalog-grid" id="catalog-grid"></div>

        <div class="section-head">
          <div><span class="eyebrow">${state.translate("eyebrowHistory")}</span><h2>${state.translate("hHistory")}</h2></div>
        </div>
        <div class="card" style="overflow:hidden;">
          <table>
            <thead>
              <tr>
                <th>${state.translate("colMedicine")}</th>
                <th>${state.translate("colQty")}</th>
                <th>${state.translate("colDelivery")}</th>
                <th>${state.translate("colDate")}</th>
                <th>${state.translate("colStatus")}</th>
              </tr>
            </thead>
            <tbody id="patient-history-body"></tbody>
          </table>
        </div>
      </div>

      <div id="patient-tab-symptoms" style="display: ${currentTab === 'symptoms' ? 'block' : 'none'};">
        <div id="symptom-checker-mount"></div>
      </div>

      <div id="patient-tab-doctors" style="display: ${currentTab === 'doctors' ? 'block' : 'none'};">
        <div class="consult-hero">
          <div>
            <h3>${state.translate("consultHeroTitle")}</h3>
            <p>${state.translate("consultHeroSub")}</p>
          </div>
          <div class="stats">
            <div><div class="n" id="consult-stat-docs">0</div><div class="l">${state.translate("statDoctors")}</div></div>
            <div><div class="n" id="consult-stat-specs">0</div><div class="l">${state.translate("statSpecialties")}</div></div>
            <div><div class="n" id="consult-stat-rating">0</div><div class="l">${state.translate("statAvgRating")}</div></div>
          </div>
        </div>
        
        <div class="spec-row" id="spec-row"></div>
        
        <div class="toolbar">
          <div class="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7C76" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input id="doctor-search" placeholder="${state.translate("phSearchDoctor")}">
            <button class="speak-btn" style="width:26px;height:26px;font-size:11px;" id="mic-doctor-search">🎙️</button>
          </div>
          <select class="pill-select" id="doctor-specialty-filter"></select>
        </div>

        <div class="doctor-grid" id="doctor-grid"></div>
      </div>

      <div id="patient-tab-appts" style="display: ${currentTab === 'appts' ? 'block' : 'none'};">
        <div class="section-head">
          <div><span class="eyebrow">${state.translate("eyebrowSchedule")}</span><h2>${state.translate("hMyAppts")}</h2></div>
        </div>
        <div class="card" style="overflow:hidden;">
          <table>
            <thead>
              <tr>
                <th>${state.translate("colDoctor")}</th>
                <th>${state.translate("colDateTime")}</th>
                <th>${state.translate("colReason")}</th>
                <th>${state.translate("colStatus")}</th>
                <th>${state.translate("colYourRating")}</th>
              </tr>
            </thead>
            <tbody id="patient-appts-body"></tbody>
          </table>
        </div>
      </div>
    `;

    // Dynamic content loading
    updateRefillStats(state);
    renderMyMedsList(container, state, actions);
    populatePharmacyFilters(container, state);
    renderCatalogItems(container, state, actions);
    renderHistoryItems(container, state);
    
    if (currentTab === 'symptoms') {
      const mountEl = container.querySelector('#symptom-checker-mount');
      if (mountEl) actions.mountSymptomChecker(mountEl);
    } else if (currentTab === 'doctors') {
      renderDoctorsGrid(container, state, actions);
    } else if (currentTab === 'appts') {
      renderAppointmentsTable(container, state, actions);
    }

    // Bind tab switches
    container.querySelectorAll('.tabs button').forEach(btn => {
      btn.onclick = () => actions.setPatientTab(btn.dataset.tab);
    });

    // Bind search events
    const medSearch = container.querySelector('#patient-search');
    if (medSearch) {
      medSearch.oninput = () => renderCatalogItems(container, state, actions);
    }
    const categoryFilter = container.querySelector('#patient-category');
    if (categoryFilter) {
      categoryFilter.onchange = () => renderCatalogItems(container, state, actions);
    }
    
    const docSearch = container.querySelector('#doctor-search');
    if (docSearch) {
      docSearch.oninput = () => renderDoctorsGrid(container, state, actions);
    }
    const specialtyFilter = container.querySelector('#doctor-specialty-filter');
    if (specialtyFilter) {
      specialtyFilter.onchange = () => renderDoctorsGrid(container, state, actions);
    }

    // Voice Search triggers
    const micMed = container.querySelector('#mic-patient-search');
    if (micMed) micMed.onclick = () => actions.toggleVoiceSearch('patient-search', () => renderCatalogItems(container, state, actions));
    const micDoc = container.querySelector('#mic-doctor-search');
    if (micDoc) micDoc.onclick = () => actions.toggleVoiceSearch('doctor-search', () => renderDoctorsGrid(container, state, actions));
  } catch (error) {
    console.error("Exception in PatientDashboard render:", error);
    container.innerHTML = `
      <div class="card" style="padding: 24px; border-color: var(--coral-500); background: var(--coral-100);">
        <h3 style="color:var(--coral-600); margin:0 0 8px;">Dashboard Error</h3>
        <p style="margin:0; font-size:13.5px; color:var(--ink);">${error.message}</p>
      </div>`;
  }
}

function updateRefillStats(state) {
  const mine = state.requests.filter(r => r.patient === state.currentUser.name);
  document.getElementById('stat-due-soon').textContent = state.myMeds.filter(m => m.daysLeft <= 5).length;
  document.getElementById('stat-pending').textContent = mine.filter(r => r.status === 'pending').length;
  document.getElementById('stat-fulfilled').textContent = mine.filter(r => r.status === 'fulfilled').length;
}

function renderMyMedsList(container, state, actions) {
  const row = container.querySelector('#myrx-row');
  row.innerHTML = state.myMeds.map(mm => {
    const m = getMed(mm.medId);
    const fs = state.facilityStock[state.currentUser.facilityId]?.[m.id] || { stock: 0, avgDailyUse: 0 };
    const urgent = mm.daysLeft <= 5;
    
    // Blister pack UI
    const lvl = fs.stock <= 0 ? 'out' : (fs.stock / fs.avgDailyUse < 7 ? 'out' : (fs.stock / fs.avgDailyUse < 14 ? 'low' : 'ok'));
    const ratio = Math.max(0, Math.min(1, fs.stock / m.capacity));
    const filled = Math.round(ratio * 10);
    let pods = "";
    for (let i = 0; i < 10; i++) pods += `<div class="pod ${i < filled ? `filled ${lvl}` : ''}"></div>`;
    const blisterHtml = `<div class="blister">${pods}</div>`;

    return `
      <div class="card myrx-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div><h4>${m.name}</h4><div class="sub">${m.category}</div></div>
          <span class="badge ${urgent ? 'low' : 'ok'}">${urgent ? 'Refill soon' : 'On track'}</span>
        </div>
        <div class="days"><b>${mm.daysLeft}</b> day${mm.daysLeft === 1 ? '' : 's'} of your supply left</div>
        ${blisterHtml}
        <button class="btn btn-sm ${urgent ? 'btn-coral' : 'btn-ghost'}" style="margin-top:10px" data-med-id="${m.id}">
          ${state.translate("sendOrder") === 'Place order' ? 'Request refill' : 'रीफिल का अनुरोध करें'}
        </button>
      </div>`;
  }).join('');

  row.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => actions.addToCart(Number(btn.dataset.medId));
  });
}

function populatePharmacyFilters(container, state) {
  const categorySel = container.querySelector('#patient-category');
  if (!categorySel.options.length) {
    const cats = [...new Set(CATALOG.map(m => m.category))].sort();
    const allLabel = state.currentLang === 'hi' ? 'सभी श्रेणियाँ' : 'All categories';
    categorySel.innerHTML = `<option value="all">${allLabel}</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

function renderCatalogItems(container, state, actions) {
  const grid = container.querySelector('#catalog-grid');
  const q = (container.querySelector('#patient-search').value || '').toLowerCase();
  const cat = container.querySelector('#patient-category').value;
  
  const list = CATALOG.filter(m => {
    const matchQ = m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    const matchC = cat === 'all' || !cat || m.category === cat;
    return matchQ && matchC;
  });

  if (!list.length) {
    grid.innerHTML = `<div class="empty-note" style="grid-column:1/-1">No medicines match.</div>`;
    return;
  }

  grid.innerHTML = list.map(m => {
    const fs = state.facilityStock[state.currentUser.facilityId]?.[m.id] || { stock: 0, avgDailyUse: 0 };
    const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
    const lvl = fs.stock <= 0 ? 'out' : (dl < 7 ? 'out' : (dl < 14 ? 'low' : 'ok'));
    const label = lvl === 'out' ? 'Out of stock' : (lvl === 'low' ? 'Low stock' : 'In stock');
    const inCart = state.cart[m.id] || 0;
    
    // Blister pods
    const ratio = Math.max(0, Math.min(1, fs.stock / m.capacity));
    const filled = Math.round(ratio * 10);
    let pods = "";
    for (let i = 0; i < 10; i++) pods += `<div class="pod ${i < filled ? `filled ${lvl}` : ''}"></div>`;
    const blisterHtml = `<div class="blister">${pods}</div>`;

    const speakLine = `${m.name}. ${m.dose}. Price ${m.price} rupees. ${fs.stock} units left in stock.`.replace(/'/g, "\\'");

    return `
      <div class="med-card">
        <div class="icon-row">
          <div class="med-icon">${m.icon}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="speak-btn" style="width:26px;height:26px;font-size:11px;" data-speak="${speakLine}">🔊</button>
            <span class="badge ${lvl}">${label}</span>
          </div>
        </div>
        <div class="cat">${m.category}</div>
        <h4>${m.name}</h4>
        <div class="dose">${m.dose}</div>
        <div class="row"><span class="price">₹${m.price}</span><span class="unitsleft">${fs.stock} units left</span></div>
        <div class="stockline">${blisterHtml}</div>
        <div class="actions" data-med-id="${m.id}">
          ${lvl === 'out'
            ? `<button class="btn btn-ghost btn-sm" disabled style="flex:1">Unavailable</button>`
            : inCart
              ? `<div class="qty-stepper"><button class="btn-dec">−</button><span>${inCart}</span><button class="btn-inc">+</button></div>
                 <button class="btn btn-primary btn-sm btn-view-cart" style="flex:1">In cart</button>`
              : `<button class="btn btn-primary btn-sm btn-add">Add to cart</button>`}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.speak-btn').forEach(btn => {
    btn.onclick = () => actions.speakText(btn.dataset.speak);
  });

  grid.querySelectorAll('.actions').forEach(el => {
    const medId = Number(el.dataset.medId);
    const btnAdd = el.querySelector('.btn-add');
    if (btnAdd) btnAdd.onclick = () => actions.addToCart(medId);
    
    const btnInc = el.querySelector('.btn-inc');
    if (btnInc) btnInc.onclick = () => actions.changeCart(medId, 1);
    
    const btnDec = el.querySelector('.btn-dec');
    if (btnDec) btnDec.onclick = () => actions.changeCart(medId, -1);
    
    const btnCart = el.querySelector('.btn-view-cart');
    if (btnCart) btnCart.onclick = () => actions.toggleDrawer(true);
  });
}

function renderHistoryItems(container, state) {
  const body = container.querySelector('#patient-history-body');
  const mine = state.requests.filter(r => r.patient === state.currentUser.name).slice().reverse();
  
  if (!mine.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-note">No orders yet.</td></tr>`;
    return;
  }
  
  body.innerHTML = mine.map(r => {
    const m = getMed(r.medId);
    const capped = r.status.charAt(0).toUpperCase() + r.status.slice(1);
    return `
      <tr>
        <td>${m.icon} ${m.name}</td>
        <td style="font-family:var(--font-mono)">${r.qty}</td>
        <td><span class="badge info">${r.delivery === 'delivery' ? 'Home delivery' : 'Pickup'}</span></td>
        <td>${r.date}</td>
        <td><span class="badge ${r.status}">${capped}</span></td>
      </tr>`;
  }).join('');
}

function renderDoctorsGrid(container, state, actions) {
  const grid = container.querySelector('#doctor-grid');
  const q = (container.querySelector('#doctor-search').value || '').toLowerCase();
  const spec = container.querySelector('#doctor-specialty-filter').value;
  
  // Specialties row list
  const specRow = container.querySelector('#spec-row');
  const specs = [...new Set(DOCTORS.map(d => d.specialty))];
  specRow.innerHTML = `<div class="spec-pill ${spec === 'all' || !spec ? 'active' : ''}" data-spec="all"><div class="spec-icon">🔎</div><div class="spec-label">All</div></div>` +
    specs.map(s => `<div class="spec-pill ${spec === s ? 'active' : ''}" data-spec="${s}"><div class="spec-icon">🩺</div><div class="spec-label">${s}</div></div>`).join('');
  
  specRow.querySelectorAll('.spec-pill').forEach(pill => {
    pill.onclick = () => {
      container.querySelector('#doctor-specialty-filter').value = pill.dataset.spec;
      renderDoctorsGrid(container, state, actions);
    };
  });

  // Doctor specialties select filter population
  const filterSel = container.querySelector('#doctor-specialty-filter');
  if (!filterSel.options.length) {
    filterSel.innerHTML = `<option value="all">All specialties</option>` + specs.sort().map(s => `<option value="${s}">${s}</option>`).join('');
  }

  // Stats calculation
  const avgAll = DOCTORS.reduce((s, d) => s + doctorAvgRating(d), 0) / DOCTORS.length;
  container.querySelector('#consult-stat-docs').textContent = DOCTORS.length;
  container.querySelector('#consult-stat-specs').textContent = specs.length;
  container.querySelector('#consult-stat-rating').textContent = avgAll.toFixed(1);

  const list = DOCTORS.filter(d => {
    const matchQ = d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q);
    const matchS = !spec || spec === 'all' || d.specialty === spec;
    return matchQ && matchS;
  });

  if (!list.length) {
    grid.innerHTML = `<div class="empty-note" style="grid-column:1/-1">No doctors match.</div>`;
    return;
  }

  grid.innerHTML = list.map(d => {
    const f = getFacility(d.facilityId);
    const avg = doctorAvgRating(d);
    const speakLine = `${d.name}, ${d.specialty}, at ${f.name}. rated ${avg.toFixed(1)} out of 5.`.replace(/'/g, "\\'");
    return `
      <div class="card doctor-card">
        <div class="top">
          <img class="doc-avatar" src="${d.photo}" alt="${d.name}" style="object-fit:cover;" onerror="this.outerHTML='<div class=&quot;doc-avatar&quot;>🩺</div>'">
          <div style="flex:1">
            <h4>${d.name}</h4>
            <div class="spec">${d.specialty}</div>
            <div class="fac" style="margin-top:2px;">🎓 ${d.degree}</div>
          </div>
          <button class="speak-btn" data-speak="${speakLine}" title="Listen">🔊</button>
        </div>
        <div class="fac">📍 ${f.name}</div>
        <div class="meta"><span>${d.experience} yrs experience</span><span class="fee">₹${d.fee} consult fee</span></div>
        <div class="rating-line"><span class="stars">${starString(avg)}</span> ${avg.toFixed(1)} (${d.ratingCount} ratings)</div>
        <div class="avail-badge ${d.available ? '' : 'off'}"><span class="dot"></span>${d.available ? 'Available today' : 'Next available: tomorrow'}</div>
        <button class="btn btn-primary btn-sm btn-book" data-doc-id="${d.id}">Book appointment</button>
      </div>`;
  }).join('');

  grid.querySelectorAll('.speak-btn').forEach(btn => {
    btn.onclick = () => actions.speakText(btn.dataset.speak);
  });

  grid.querySelectorAll('.btn-book').forEach(btn => {
    btn.onclick = () => actions.openApptModal(Number(btn.dataset.docId));
  });
}

function renderAppointmentsTable(container, state, actions) {
  const body = container.querySelector('#patient-appts-body');
  const mine = state.appointments.filter(a => a.patient === state.currentUser.name).slice().reverse();
  
  if (!mine.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-note">No appointments yet.</td></tr>`;
    return;
  }
  
  body.innerHTML = mine.map(a => {
    const d = DOCTORS.find(doc => doc.id === a.doctorId);
    const capped = a.status.charAt(0).toUpperCase() + a.status.slice(1);
    
    let ratingHtml = '—';
    if (a.status === 'completed') {
      if (a.patientRating) {
        ratingHtml = `<span class="stars">${starString(a.patientRating)}</span>`;
      } else {
        ratingHtml = `<span class="stars interactive" data-appt-id="${a.id}">
          <span data-star="1">☆</span>
          <span data-star="2">☆</span>
          <span data-star="3">☆</span>
          <span data-star="4">☆</span>
          <span data-star="5">☆</span>
        </span>`;
      }
    }
    
    return `
      <tr>
        <td><b>${d.name}</b><div style="color:var(--muted); font-size:11px">${d.specialty}</div></td>
        <td>${a.date} ${a.time !== '—' ? '· ' + a.time : ''}</td>
        <td>${a.reason}${a.urgent ? ' <span class="badge out">Urgent</span>' : ''}</td>
        <td><span class="badge ${a.status === 'completed' ? 'fulfilled' : (a.status === 'cancelled' ? 'rejected' : 'pending')}">${capped}</span></td>
        <td>${ratingHtml}</td>
      </tr>`;
  }).join('');

  body.querySelectorAll('.stars.interactive span').forEach(star => {
    star.onclick = () => {
      const apptId = Number(star.parentElement.dataset.apptId);
      const rating = Number(star.dataset.star);
      actions.rateDoctor(apptId, rating);
    };
  });
}
