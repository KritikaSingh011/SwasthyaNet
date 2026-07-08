import { CATALOG, getMed } from '../data/catalog.js';
import { FACILITIES, getFacility } from '../data/facilities.js';
import { renderHotspotsMap } from '../services/maps.js';

export function renderAdminOverview(container, state, actions) {
  const currentTab = state.adminTab || 'overview';

  container.innerHTML = `
    <div class="tabs">
      <button class="${currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
        <div class="tab-icon">🏛️</div>
        <span>Overview</span>
      </button>
      <button class="${currentTab === 'ai' ? 'active' : ''}" data-tab="ai">
        <div class="tab-icon">🤖</div>
        <span>AI Insights</span>
      </button>
      <button class="${currentTab === 'under' ? 'active' : ''}" data-tab="under">
        <div class="tab-icon">⚠️</div>
        <span>Underperforming</span>
      </button>
      <button class="${currentTab === 'verify' ? 'active' : ''}" data-tab="verify">
        <div class="tab-icon">🎓</div>
        <span>Staff Verification <span class="badge-count" id="admin-verify-badge">0</span></span>
      </button>
      <button class="${currentTab === 'attendance' ? 'active' : ''}" data-tab="attendance">
        <div class="tab-icon">👤</div>
        <span>Staff Attendance</span>
      </button>
    </div>

    <!-- Admin Overview Tab -->
    <div id="admin-tab-overview" style="display: ${currentTab === 'overview' ? 'block' : 'none'};">
      <div class="facility-grid" id="admin-facility-grid"></div>
    </div>

    <!-- AI Insights Tab -->
    <div id="admin-tab-ai" style="display: ${currentTab === 'ai' ? 'block' : 'none'};">
      <div class="section-head">
        <div>
          <span class="eyebrow">AI Demand Forecasts</span>
          <h2>Stock-out risk predictions</h2>
          <p>Depletion analytics derived via Vertex AI endpoints and historical average consumption rates.</p>
        </div>
        <select class="pill-select" id="ai-medicine"></select>
      </div>

      <div class="card chart-wrap">
        <div id="forecast-chart-container" style="padding: 10px 0;">
          <!-- SVG chart will dynamically mount here -->
        </div>
        <div class="legend">
          <span><i style="background:var(--teal-500); width:10px; height:10px; display:inline-block; border-radius:3px;"></i> Healthy (14+ days)</span>
          <span><i style="background:var(--amber-500); width:10px; height:10px; display:inline-block; border-radius:3px;"></i> Watch (7–14 days)</span>
          <span><i style="background:var(--coral-500); width:10px; height:10px; display:inline-block; border-radius:3px;"></i> Critical (&lt;7 days)</span>
        </div>
      </div>

      <div class="section-head">
        <div><span class="eyebrow">Early Warning Systems</span><h2>Stock Warnings District-wide</h2></div>
      </div>
      <div class="card" id="warnings-card" style="margin-bottom:28px;"></div>

      <div class="section-head">
        <div><span class="eyebrow">Redistributions</span><h2>Smart Logistics Suggestions</h2><p>Move excess supply inventory to deficit clinics before they dry out.</p></div>
      </div>
      <div class="card" id="redist-card"></div>
    </div>

    <!-- Underperforming Centres Tab -->
    <div id="admin-tab-under" style="display: ${currentTab === 'under' ? 'block' : 'none'};">
      <div class="section-head">
        <div><span class="eyebrow">Flagged Parameters</span><h2>Centres Needing Intervention</h2></div>
      </div>
      <div class="card" id="under-card"></div>
    </div>

    <!-- Staff Verification Tab -->
    <div id="admin-tab-verify" style="display: ${currentTab === 'verify' ? 'block' : 'none'};">
      <div class="section-head">
        <div><span class="eyebrow">Credentialing reviews</span><h2>Staff approvals queue</h2></div>
      </div>
      <div class="verify-grid" id="verify-grid"></div>
    </div>

    <!-- Staff Attendance Tab -->
    <div id="admin-tab-attendance" style="display: ${currentTab === 'attendance' ? 'block' : 'none'};">
      <div class="section-head">
        <div><span class="eyebrow">Live maps</span><h2>Attendance logs roll</h2></div>
      </div>
      <div class="card" style="overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Staff Name</th>
              <th>Facility Center</th>
              <th>Punch Time</th>
              <th>Check Type</th>
              <th>Proximity</th>
              <th>Flag Status</th>
            </tr>
          </thead>
          <tbody id="admin-attendance-body"></tbody>
        </table>
      </div>
    </div>
  `;

  // Bind tab toggles
  container.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = () => actions.setAdminTab(btn.dataset.tab);
  });

  // Load and render child panels
  if (currentTab === 'overview') {
    renderAdminOverviewGrid(container, state, actions);
  } else if (currentTab === 'ai') {
    renderAIInsights(container, state, actions);
  } else if (currentTab === 'under') {
    renderUnderperformingList(container, state, actions);
  } else if (currentTab === 'verify') {
    renderVerifyGrid(container, state, actions);
  } else if (currentTab === 'attendance') {
    renderAdminAttendanceLogs(container, state);
  }
  
  // Set badge count
  const verifyBadge = container.querySelector('#admin-verify-badge');
  if (verifyBadge) {
    verifyBadge.textContent = state.pendingStaff.length;
    verifyBadge.style.display = state.pendingStaff.length > 0 ? 'inline-block' : 'none';
  }
}

function calculateFacilityStatus(f, state) {
  const stock = state.facilityStock[f.id] || {};
  const meds = Object.values(stock);
  const stockouts = meds.filter(fs => fs.stock <= 0).length;
  const lowStocks = meds.filter(fs => {
    const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
    return fs.stock > 0 && dl < 14;
  }).length;
  const docRate = f.docSched ? f.docPresent / f.docSched : 1;
  const bedRate = f.bedsTotal ? f.bedsOcc / f.bedsTotal : 0;

  let level = 'good';
  const reasons = [];

  if (stockouts >= 2) {
    level = 'critical';
    reasons.push(`${stockouts} medicines out of stock`);
  } else if (stockouts === 1 || lowStocks >= 3) {
    level = 'watch';
    reasons.push(stockouts ? '1 medicine out of stock' : `${lowStocks} medicines running low`);
  }

  if (docRate < 0.5) {
    level = 'critical';
    reasons.push(`Doctor understaffing: only ${f.docPresent}/${f.docSched} present`);
  } else if (docRate < 0.8) {
    if (level === 'good') level = 'watch';
    reasons.push(`Doctor understaffing`);
  }

  if (bedRate > 0.95) {
    level = 'critical';
    reasons.push(`Beds fully occupied (${Math.round(bedRate*100)}%)`);
  } else if (bedRate > 0.85) {
    if (level === 'good') level = 'watch';
    reasons.push(`Beds capacity watch`);
  }

  return { level, reasons, stockouts, lowStocks, docRate, bedRate };
}

function renderAdminOverviewGrid(container, state, actions) {
  const grid = container.querySelector('#admin-facility-grid');
  grid.innerHTML = FACILITIES.map(f => {
    // Check if status overwritten by live actions
    const liveFac = state.facilities.find(fac => fac.id === f.id) || f;
    const status = calculateFacilityStatus(liveFac, state);
    const bedRate = Math.round(status.bedRate * 100);
    const label = status.level === 'good' ? 'Healthy' : (status.level === 'watch' ? 'Watch' : 'Critical');
    const badgeColor = status.level === 'good' ? 'ok' : (status.level === 'watch' ? 'low' : 'out');

    return `
      <div class="card facility-card">
        <div class="top">
          <div>
            <h4><span class="status-dot ${status.level}"></span>${liveFac.name}</h4>
            <div class="sub">${liveFac.type} · Lucknow District</div>
          </div>
          <span class="badge ${badgeColor}">${label}</span>
        </div>
        <div class="mini-metrics">
          <div class="mini-metric ${bedRate > 85 ? (bedRate > 95 ? 'bad' : 'warn') : ''}">
            <div class="l">Beds</div><div class="v">${liveFac.bedsOcc}/${liveFac.bedsTotal}</div>
          </div>
          <div class="mini-metric ${status.docRate < 0.8 ? (status.docRate < 0.5 ? 'bad' : 'warn') : ''}">
            <div class="l">Doctors</div><div class="v">${liveFac.docPresent}/${liveFac.docSched}</div>
          </div>
          <div class="mini-metric">
            <div class="l">Footfall today</div><div class="v">${liveFac.footfall}</div>
          </div>
          <div class="mini-metric ${status.stockouts ? 'bad' : (status.lowStocks ? 'warn' : '')}">
            <div class="l">Stock alerts</div><div class="v">${status.stockouts} out · ${status.lowStocks} low</div>
          </div>
        </div>
        <div style="font-size:11.5px; color:var(--muted)">
          Services check: ${liveFac.tests.filter(t => t.available).map(t => t.name).join(', ') || 'No services'}
        </div>
      </div>`;
  }).join('');
}

function renderAIInsights(container, state, actions) {
  const select = container.querySelector('#ai-medicine');
  
  if (!select.options.length) {
    select.innerHTML = CATALOG.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('');
    select.value = state.aiMedId || 9; // default to insulin
  }
  
  select.onchange = () => {
    actions.setAdminAIMed(Number(select.value));
  };

  const activeMedId = Number(select.value);
  const activeMed = getMed(activeMedId);

  // Render SVG forecasting graph using predictions from state / mock AI curves
  const chartWrapper = container.querySelector('#forecast-chart-container');
  const rows = FACILITIES.map(f => {
    const fs = state.facilityStock[f.id]?.[activeMedId] || { stock: 0, avgDailyUse: 0 };
    const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
    return { name: f.name.replace(/^PHC |^CHC /, ''), daysLeft: dl };
  });

  const maxVal = Math.max(30, ...rows.map(r => Math.min(60, r.daysLeft)));
  const barW = 80, gap = 30, leftOffset = 60, topOffset = 40, chartH = 180;
  
  let bars = "";
  let labels = "";
  rows.forEach((r, i) => {
    const cappedDays = Math.min(60, r.daysLeft);
    const height = (cappedDays / maxVal) * chartH;
    const x = leftOffset + i * (barW + gap);
    const y = topOffset + (chartH - height);
    
    const color = r.daysLeft < 7 ? 'var(--coral-500)' : (r.daysLeft < 14 ? 'var(--amber-500)' : 'var(--teal-500)');
    
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${height}" rx="6" fill="${color}"></rect>
      <text x="${x + barW/2}" y="${y - 8}" text-anchor="middle" font-family="IBM Plex Mono" font-size="12" fill="#1A2421" font-weight="600">
        ${r.daysLeft > 90 ? '90+d' : Math.round(r.daysLeft) + 'd'}
      </text>
    `;
    
    labels += `<text x="${x + barW/2}" y="${topOffset + chartH + 20}" text-anchor="middle" font-family="IBM Plex Sans" font-size="11.5" fill="#6B7C76">${r.name}</text>`;
  });

  chartWrapper.innerHTML = `
    <svg viewBox="0 0 760 270" style="width:100%; height:auto;">
      <line x1="${leftOffset - 10}" y1="${topOffset + chartH}" x2="${leftOffset + rows.length * (barW + gap)}" y2="${topOffset + chartH}" stroke="#D8E3DE" stroke-width="1"/>
      ${bars}
      ${labels}
      <text x="10" y="22" font-family="IBM Plex Mono" font-size="11" fill="#6B7C76">${activeMed.icon} ${activeMed.name} - projected depletion supply</text>
    </svg>
  `;

  // Render early warnings panel
  const warningsCard = container.querySelector('#warnings-card');
  const warningList = [];
  FACILITIES.forEach(f => {
    CATALOG.forEach(m => {
      const fs = state.facilityStock[f.id]?.[m.id] || { stock: 0, avgDailyUse: 0 };
      const dl = fs.avgDailyUse > 0 ? fs.stock / fs.avgDailyUse : 999;
      if (dl < 14) {
        warningList.push({ f, m, fs, dl });
      }
    });
  });
  warningList.sort((a,b) => a.dl - b.dl);

  if (!warningList.length) {
    warningsCard.innerHTML = `<div class="empty-note">No critical depletion warnings detected.</div>`;
  } else {
    warningsCard.innerHTML = warningList.slice(0, 6).map(w => {
      const isCritical = w.dl < 7;
      return `
        <div class="alert-row">
          <span class="status-dot ${isCritical ? 'critical' : 'watch'} dot"></span>
          <div class="body">
            <div class="title">${w.m.icon} ${w.m.name} at ${w.f.name}</div>
            <div class="desc">${w.fs.stock} units left · uses ~${w.fs.avgDailyUse}/day → <b>${Math.round(w.dl)} days</b> until stockout</div>
          </div>
          <span class="badge ${isCritical ? 'out' : 'low'}">${isCritical ? 'Critical' : 'Watch'}</span>
        </div>`;
    }).join('');
  }

  // Smart redistribution logic suggestions
  const redistCard = container.querySelector('#redist-card');
  const items = FACILITIES.map(f => ({ f, fs: state.facilityStock[f.id]?.[activeMedId] || { stock: 0, avgDailyUse: 0 } }));
  const deficits = items.filter(r => (r.fs.avgDailyUse > 0 ? r.fs.stock / r.fs.avgDailyUse : 999) < 10);
  const surpluses = items.filter(r => (r.fs.avgDailyUse > 0 ? r.fs.stock / r.fs.avgDailyUse : 999) > 25);

  if (!deficits.length || !surpluses.length) {
    redistCard.innerHTML = `<div class="empty-note">Inventory levels for ${activeMed.name} are balanced. No transfers suggested.</div>`;
  } else {
    let routesHtml = "";
    deficits.forEach((d, i) => {
      const s = surpluses[i % surpluses.length];
      if (s.f.id === d.f.id) return;
      const amountToMove = Math.min(Math.round(s.fs.stock * 0.35), Math.round(d.fs.avgDailyUse * 14));
      if (amountToMove <= 0) return;
      
      routesHtml += `
        <div class="redist-card" data-from="${s.f.id}" data-to="${d.f.id}" data-med="${activeMedId}" data-qty="${amountToMove}">
          <span>📦</span>
          <span><b>${s.f.name}</b> (${Math.round(s.fs.stock / s.fs.avgDailyUse)}d)</span>
          <span class="redist-arrow">→ ${amountToMove} units →</span>
          <span><b>${d.f.name}</b> (${Math.round(d.fs.stock / d.fs.avgDailyUse)}d)</span>
          <button class="btn btn-ghost btn-sm btn-apply-redist" style="margin-left:auto;">Apply Transfer</button>
        </div>`;
    });
    
    redistCard.innerHTML = routesHtml || `<div class="empty-note">No viable transfer paths found.</div>`;
    
    redistCard.querySelectorAll('.btn-apply-redist').forEach(btn => {
      btn.onclick = () => {
        const card = btn.parentElement;
        const from = Number(card.dataset.from);
        const to = Number(card.dataset.to);
        const med = Number(card.dataset.med);
        const qty = Number(card.dataset.qty);
        actions.applyRedistribution(from, to, med, qty);
      };
    });
  }
}

function renderUnderperformingList(container, state, actions) {
  const panel = container.querySelector('#under-card');
  const flagged = FACILITIES.map(f => {
    const liveFac = state.facilities.find(fac => fac.id === f.id) || f;
    return { f: liveFac, status: calculateFacilityStatus(liveFac, state) };
  }).filter(x => x.status.level !== 'good');

  if (!flagged.length) {
    panel.innerHTML = `<div class="empty-note">All district centers operating within targets.</div>`;
    return;
  }

  panel.innerHTML = flagged.map(x => `
    <div class="alert-row">
      <span class="status-dot ${x.status.level} dot"></span>
      <div class="body">
        <div class="title">${x.f.name} <span class="badge ${x.status.level === 'critical' ? 'out' : 'low'}">${x.status.level === 'critical' ? 'Critical' : 'Watch'}</span></div>
        <div class="desc">${x.status.reasons.join(' · ')}</div>
      </div>
      <button class="btn btn-coral btn-sm btn-notify-fac" data-name="${x.f.name}">Send Intervention Notice</button>
    </div>`).join('');

  panel.querySelectorAll('.btn-notify-fac').forEach(btn => {
    btn.onclick = () => {
      actions.notifyFacility(btn.dataset.name);
    };
  });
}

function renderVerifyGrid(container, state, actions) {
  const grid = container.querySelector('#verify-grid');
  
  if (!state.pendingStaff.length) {
    grid.innerHTML = `<div class="empty-note">No new credential applications pending verification.</div>`;
    return;
  }

  grid.innerHTML = state.pendingStaff.map(p => {
    const f = getFacility(p.facilityId);
    return `
      <div class="card verify-card">
        <div class="vtop">
          <img class="vphoto" src="${p.selfie}" alt="" onerror="this.src='https://randomuser.me/api/portraits/men/41.jpg';">
          <div style="flex:1">
            <h4 style="margin:0; font-family:var(--font-display); font-size:15.5px;">${p.name}</h4>
            <div class="spec" style="color:var(--teal-500); font-size:12.5px;">${p.role} · ${p.specialty}</div>
          </div>
        </div>
        <div class="fac" style="font-size:13px; margin: 4px 0;">📍 Applying to: <b>${f.name}</b></div>
        <div style="font-size:12px; color:var(--muted)">🎓 Qualification: ${p.degree}</div>
        <div style="font-size:12px; color:var(--muted); margin-bottom: 6px;">💼 Experience: ${p.experience} yrs · phone: ${p.phone}</div>
        <div class="vdocs">
          <div class="vdoc-col">
            <img src="${p.govIdPhoto}" style="width:100%; height:75px; object-fit:cover; border-radius:6px; border:1px solid var(--line);">
            <span>Govt. ID</span>
          </div>
          <div class="vdoc-col">
            <img src="${p.selfie}" style="width:100%; height:75px; object-fit:cover; border-radius:6px; border:1px solid var(--line);">
            <span>Selfie</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:8px;" data-staff-id="${p.id}">
          <button class="btn btn-primary btn-sm btn-approve-staff" style="flex:1">Approve &amp; Activate</button>
          <button class="btn btn-ghost btn-sm btn-reject-staff">Reject</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.verify-card [data-staff-id]').forEach(actionsEl => {
    const id = actionsEl.dataset.staffId;
    actionsEl.querySelector('.btn-approve-staff').onclick = () => actions.approveStaff(id);
    actionsEl.querySelector('.btn-reject-staff').onclick = () => actions.rejectStaff(id);
  });
}

function renderAdminAttendanceLogs(container, state) {
  const body = container.querySelector('#admin-attendance-body');
  
  if (!state.attendanceLog.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-note">No check-ins marked in the district today.</td></tr>`;
    return;
  }

  body.innerHTML = state.attendanceLog.map(a => {
    const f = getFacility(a.facilityId);
    return `
      <tr>
        <td><img src="${a.photo}" style="width:36px; height:36px; object-fit:cover; border-radius:6px;"></td>
        <td><b>${a.staff}</b></td>
        <td>${f.name}</td>
        <td>Today · ${a.time}</td>
        <td><span class="badge ${a.type === 'in' ? 'info' : 'pending'}">${a.type === 'in' ? 'Check-in' : 'Check-out'}</span></td>
        <td>${a.distance}m</td>
        <td><span class="badge ${a.onSite ? 'ok' : 'out'}">${a.onSite ? 'On site' : 'Outside Geofence'}</span></td>
      </tr>`;
  }).join('');
}
