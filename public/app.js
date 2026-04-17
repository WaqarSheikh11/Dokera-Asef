// ══════════════════════════════════════════════════════
//  DOKERA DASHBOARD — Frontend Logic
// ══════════════════════════════════════════════════════

const API = '/api/jobs';
let jobs = [];
let statusFilter = 'all';
let specialtyFilter = '';
let scheduleFilter = '';
let searchQuery = '';
let editingId = null;
let statusChart = null;

// ── Specialty colour palette ─────────────────────────
const SPECIALTY_COLORS = [
  '#2563EB','#4F46E5','#7C3AED','#9333EA','#0D9488',
  '#0891B2','#16A34A','#E11D48','#EA580C','#D97706',
  '#1D4ED8','#6D28D9','#059669','#DC2626','#B45309',
];
const specialtyColor = (() => {
  const map = {};
  let i = 0;
  return s => {
    if (!map[s]) map[s] = SPECIALTY_COLORS[i++ % SPECIALTY_COLORS.length];
    return map[s];
  };
})();

// ── Helpers ──────────────────────────────────────────
const API_FETCH = async (url, opts = {}) => {
  const r = await fetch(url, { headers: {'Content-Type':'application/json'}, ...opts });
  const d = await r.json();
  if (!r.ok) throw d;
  return d;
};

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtDate = s => {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};
const fmtDateTime = s => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};

const initials = s => String(s||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();

// ── Toast ────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${type==='success'?'✓':'✕'}</span> ${esc(msg)}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove());
  }, 3000);
}

// ── Load & render ─────────────────────────────────────
async function loadJobs() {
  jobs = await API_FETCH(API);
  renderAll();
}

function renderAll() {
  updateKPIs();
  renderNavBadge();
  renderRecent();
  renderChart();
  renderSpecialtyBars();
  renderTable();
  populateSpecialtyFilter();
}

// ── KPIs ──────────────────────────────────────────────
function updateKPIs() {
  document.getElementById('kpi-total').textContent  = jobs.length;
  document.getElementById('kpi-open').textContent   = jobs.filter(j=>j.status==='Open').length;
  document.getElementById('kpi-draft').textContent  = jobs.filter(j=>j.status==='Draft').length;
  document.getElementById('kpi-closed').textContent = jobs.filter(j=>j.status==='Closed').length;
}

// ── Nav badge ─────────────────────────────────────────
function renderNavBadge() {
  const open = jobs.filter(j=>j.status==='Open').length;
  document.getElementById('nav-open-count').textContent = open;
}

// ── Recent posts (dashboard, 5 most recent) ───────────
function renderRecent() {
  const container = document.getElementById('recent-list');
  const recent = jobs.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--gray-400);font-size:13px;">No job posts yet. Create your first one!</div>`;
    return;
  }
  container.innerHTML = recent.map(job => {
    const col = specialtyColor(job.specialty);
    return `
      <div class="recent-item" onclick="openDetail(${job.id})" role="button" tabindex="0"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail(${job.id})}"
        aria-label="View ${esc(job.title)}">
        <div class="recent-avatar" style="background:${col}">${esc(initials(job.specialty))}</div>
        <div class="recent-body">
          <div class="recent-title">${esc(job.title)}</div>
          <div class="recent-meta">${esc(job.specialty)} &middot; ${esc(job.location)}</div>
        </div>
        <div class="recent-right">
          <span class="badge badge-${job.status.toLowerCase()}">${esc(job.status)}</span>
          <span class="recent-date">${fmtDateTime(job.created_at)}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Donut chart ───────────────────────────────────────
function renderChart() {
  const open   = jobs.filter(j=>j.status==='Open').length;
  const draft  = jobs.filter(j=>j.status==='Draft').length;
  const closed = jobs.filter(j=>j.status==='Closed').length;
  const total  = jobs.length;

  const canvas = document.getElementById('status-chart');
  const legend = document.getElementById('chart-legend');

  const data = [
    { label:'Open',   count: open,   color:'#16A34A' },
    { label:'Draft',  count: draft,  color:'#D97706' },
    { label:'Closed', count: closed, color:'#DC2626' },
  ];

  if (statusChart) { statusChart.destroy(); statusChart = null; }

  if (!total) {
    canvas.style.display = 'none';
    legend.innerHTML = `<p style="font-size:12px;color:var(--gray-400);text-align:center">No data yet</p>`;
    return;
  }
  canvas.style.display = '';

  statusChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.map(d=>d.label),
      datasets: [{
        data: data.map(d=>d.count),
        backgroundColor: data.map(d=>d.color),
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/total*100)}%)`
          }
        }
      },
      animation: { animateScale: true }
    }
  });

  legend.innerHTML = data.map(d => `
    <div class="legend-item">
      <span class="legend-label"><span class="legend-dot" style="background:${d.color}"></span>${d.label}</span>
      <span class="legend-count">${d.count}</span>
    </div>
  `).join('');
}

// ── Specialty bars ────────────────────────────────────
function renderSpecialtyBars() {
  const container = document.getElementById('specialty-bars');
  if (!jobs.length) {
    container.innerHTML = `<div class="specialty-empty">No data available</div>`;
    return;
  }
  const counts = {};
  jobs.forEach(j => { counts[j.specialty] = (counts[j.specialty]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = sorted[0][1];

  container.innerHTML = sorted.map(([name, count]) => {
    const pct = Math.round(count/max*100);
    const col = specialtyColor(name);
    return `
      <div class="specialty-bar-item">
        <div class="specialty-bar-label">
          <span>${esc(name)}</span>
          <span style="color:var(--gray-500)">${count}</span>
        </div>
        <div class="specialty-bar-track">
          <div class="specialty-bar-fill" style="width:${pct}%;background:${col}"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Table (Job Posts view) ─────────────────────────────
function renderTable() {
  const tbody = document.getElementById('jobs-table-body');
  const empty = document.getElementById('table-empty');

  let filtered = jobs.filter(j => {
    const matchStatus    = statusFilter === 'all' || j.status === statusFilter;
    const matchSpecialty = !specialtyFilter || j.specialty === specialtyFilter;
    const matchSchedule  = !scheduleFilter  || j.schedule  === scheduleFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      j.title.toLowerCase().includes(q) ||
      j.specialty.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q);
    return matchStatus && matchSpecialty && matchSchedule && matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = filtered.map(job => {
    const dot = specialtyColor(job.specialty);
    const opts = ['Draft','Open','Closed'].map(s => `
      <button class="status-opt ${job.status===s?'is-current':''}" onclick="selectStatus(event,${job.id},'${s}')">
        <span class="status-opt-dot sod-${s.toLowerCase()}"></span>
        ${s}
        ${job.status===s ? '<span class="status-opt-check">✓</span>' : ''}
      </button>`).join('');

    return `
      <tr id="row-${job.id}">
        <td><div class="td-title" title="${esc(job.title)}">${esc(job.title)}</div></td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0"></span>
            ${esc(job.specialty)}
          </span>
        </td>
        <td>${esc(job.location)}</td>
        <td>${job.schedule ? esc(job.schedule) : '<span class="td-muted">—</span>'}</td>
        <td>
          <div class="status-select-wrap">
            <button class="status-trigger st-${job.status.toLowerCase()}"
              onclick="toggleStatusDrop(event,${job.id})" aria-haspopup="listbox"
              aria-label="Status: ${esc(job.status)}">
              ${esc(job.status)}
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 4l3.5 3.5L9 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="status-drop hidden" role="listbox">${opts}</div>
          </div>
        </td>
        <td class="td-muted">${fmtDateTime(job.created_at)}</td>
        <td>
          <div class="row-actions">
            <button class="btn-row btn-row-view"  onclick="openDetail(${job.id})"            title="View details">View</button>
            <button class="btn-row btn-row-edit"  onclick="openEdit(${job.id})"              title="Edit post">Edit</button>
            <button class="btn-row btn-row-dupe"  onclick="duplicateJob(${job.id})"          title="Duplicate post">Duplicate</button>
            <button class="btn-row btn-row-del"   onclick="deleteJobFromTable(${job.id})"    title="Delete post">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Populate specialty filter options ─────────────────
function populateSpecialtyFilter() {
  const sel = document.getElementById('filter-specialty');
  const current = sel.value;
  const specialties = [...new Set(jobs.map(j=>j.specialty))].sort();
  sel.innerHTML = `<option value="">All Departments</option>` +
    specialties.map(s=>`<option value="${esc(s)}" ${s===current?'selected':''}>${esc(s)}</option>`).join('');
}

// ── Custom Status Dropdown (table) ─────────────────────────
function toggleStatusDrop(e, id) {
  e.stopPropagation();
  const trigger = e.currentTarget;
  const drop = trigger.nextElementSibling;
  // Close all others
  document.querySelectorAll('.status-drop:not(.hidden)').forEach(d => {
    if (d !== drop) {
      d.classList.add('hidden');
      d.previousElementSibling?.classList.remove('is-open');
    }
  });
  const isNowOpen = !drop.classList.contains('hidden');
  // Toggle
  drop.classList.toggle('hidden');
  trigger.classList.toggle('is-open', isNowOpen ? false : true);
}

async function selectStatus(e, id, newStatus) {
  e.stopPropagation();
  const drop = e.currentTarget.closest('.status-drop');
  const trigger = drop.previousElementSibling;
  drop.classList.add('hidden');
  trigger.classList.remove('is-open');

  const job = jobs.find(j => j.id === id);
  if (job && job.status === newStatus) return; // no-op

  try {
    await API_FETCH(`${API}/${id}/status`, { method:'PATCH', body: JSON.stringify({status:newStatus}) });
    if (job) addNotif(
      newStatus==='Open' ? '✅' : newStatus==='Closed' ? '🔒' : '📝',
      `n-${newStatus.toLowerCase()}`,
      `<strong>${job.title}</strong> moved to <strong>${newStatus}</strong>.`
    );
    toast(`Status updated to ${newStatus}`, 'success');
    await loadJobs();
  } catch(err) {
    toast(err.errors?.[0] || err.error || 'Failed to update status.', 'error');
    await loadJobs();
  }
}

// ── Apply status from detail modal seg buttons ──────────────
async function applyDetailStatus(id, newStatus) {
  const job = jobs.find(j => j.id === id);
  if (job && job.status === newStatus) { closeDetail(); return; }
  try {
    await API_FETCH(`${API}/${id}/status`, { method:'PATCH', body: JSON.stringify({status:newStatus}) });
    if (job) addNotif(
      newStatus==='Open' ? '✅' : newStatus==='Closed' ? '🔒' : '📝',
      `n-${newStatus.toLowerCase()}`,
      `<strong>${job.title}</strong> marked <strong>${newStatus}</strong>.`
    );
    toast(`Status set to ${newStatus}.`);
    closeDetail();
    await loadJobs();
  } catch(err) {
    toast(err.errors?.[0] || err.error || 'Failed to update.', 'error');
  }
}

// ── Confirm dialog (replaces native confirm()) ─────────
function confirmDialog({ title, message, okLabel = 'Confirm', okClass = 'btn-danger', icon = '🗑️', iconType = 'danger' }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent   = title;
    document.getElementById('confirm-message').innerHTML   = message;
    document.getElementById('confirm-ok-btn').textContent  = okLabel;
    document.getElementById('confirm-ok-btn').className    = `btn ${okClass}`;
    const iconWrap = document.getElementById('confirm-icon-wrap');
    iconWrap.className = `confirm-icon-wrap ${iconType}`;
    iconWrap.textContent = icon;

    overlay.classList.remove('hidden');
    document.getElementById('confirm-ok-btn').focus();

    const cleanup = (result) => {
      overlay.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const okBtn     = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click',     onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// ── Delete ─────────────────────────────────────────────
async function deleteJob(id, jobTitle) {
  const confirmed = await confirmDialog({
    title:    'Delete Job Post?',
    message:  `This will permanently remove <strong>${esc(jobTitle)}</strong>. This action cannot be undone.`,
    okLabel:  'Yes, Delete',
    okClass:  'btn-danger',
    icon:     '🗑️',
    iconType: 'danger',
  });
  if (!confirmed) return false;
  await API_FETCH(`${API}/${id}`, { method: 'DELETE' });
  addNotif('🗑️', 'n-closed', `Job post <strong>${esc(jobTitle)}</strong> was deleted.`);
  toast(`“${jobTitle}” deleted.`);
  return true;
}

// Delete from table row (with row-loading state)
async function deleteJobFromTable(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;
  const row = document.getElementById(`row-${id}`);
  try {
    const ok = await deleteJob(id, job.title);
    if (!ok) return;
    if (row) row.classList.add('row-loading');
    await loadJobs();
  } catch(err) {
    if (row) row.classList.remove('row-loading');
    toast(err.error || 'Failed to delete.', 'error');
  }
}

// ── Duplicate ──────────────────────────────────────────
async function duplicateJob(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;
  const confirmed = await confirmDialog({
    title:    'Duplicate Job Post?',
    message:  `A copy of <strong>${esc(job.title)}</strong> will be created as a <strong>Draft</strong>.`,
    okLabel:  'Duplicate',
    okClass:  'btn-primary',
    icon:     '📚',
    iconType: 'info',
  });
  if (!confirmed) return;
  const row = document.getElementById(`row-${id}`);
  try {
    if (row) row.classList.add('row-loading');
    const copy = await API_FETCH(`${API}/${id}/duplicate`, { method: 'POST' });
    addNotif('📚', 'n-draft', `Duplicated: <strong>${esc(copy.title)}</strong>`);
    toast(`Duplicated as “${copy.title}”`);
    await loadJobs();
  } catch(err) {
    if (row) row.classList.remove('row-loading');
    toast(err.error || 'Failed to duplicate.', 'error');
  }
}

// ── View switching ────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  document.getElementById(`view-${viewId}`).classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.getElementById(`nav-${viewId}`);
  if (navItem) navItem.classList.add('active');
}

document.getElementById('nav-dashboard').addEventListener('click', e => { e.preventDefault(); switchView('dashboard'); });
document.getElementById('nav-jobs').addEventListener('click', e => { e.preventDefault(); switchView('jobs'); });
document.getElementById('btn-view-all').addEventListener('click', () => switchView('jobs'));

// ── Filters ───────────────────────────────────────────
document.getElementById('filter-tabs').addEventListener('click', e => {
  if (!e.target.matches('.filter-tab')) return;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  statusFilter = e.target.dataset.status;
  renderTable();
});

document.getElementById('filter-specialty').addEventListener('change', e => {
  specialtyFilter = e.target.value;
  renderTable();
});

document.getElementById('filter-schedule').addEventListener('change', e => {
  scheduleFilter = e.target.value;
  renderTable();
});

document.getElementById('global-search').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  // If on dashboard, switch to jobs view to show results
  if (searchQuery && !document.getElementById('view-jobs').classList.contains('active-view')) {
    switchView('jobs');
  }
  renderTable();
});

// ── Sidebar collapse ──────────────────────────────────
document.getElementById('btn-collapse').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

document.getElementById('btn-mobile-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
});

// ── Modal (Create/Edit) ───────────────────────────────
const modalOverlay = document.getElementById('modal-overlay');
const jobForm      = document.getElementById('job-form');
const formErrors   = document.getElementById('form-errors');

// Field accessors
const F = {
  id:           () => document.getElementById('field-id'),
  title:        () => document.getElementById('field-title'),
  specialty:    () => document.getElementById('field-specialty'),
  location:     () => document.getElementById('field-location'),
  schedule:     () => document.getElementById('field-schedule'),
  compensation: () => document.getElementById('field-compensation'),
  startDate:    () => document.getElementById('field-start-date'),
  status:       () => document.getElementById('field-status'),
  description:  () => document.getElementById('field-description'),
};

// ── Validation rules ──────────────────────────────────
const RULES = {
  title:       { required: true, minLen: 3, maxLen: 120, label: 'Job Title' },
  specialty:   { required: true,             label: 'Specialty / Department' },
  location:    { required: true, minLen: 2, maxLen: 100, label: 'Location' },
  compensation:{ required: false, maxLen: 80,  label: 'Compensation' },
  description: { required: false, maxLen: 2000, label: 'Description' },
};

// Validate one field; returns error string or null
function validateField(name, value) {
  const r = RULES[name];
  if (!r) return null;
  const v = value.trim();
  if (r.required && !v)          return `${r.label} is required.`;
  if (v && r.minLen && v.length < r.minLen)
    return `${r.label} must be at least ${r.minLen} characters.`;
  if (r.maxLen && v.length > r.maxLen)
    return `${r.label} cannot exceed ${r.maxLen} characters.`;
  if (name === 'title' && v && !/[a-zA-Z]/.test(v))
    return 'Job title must contain letters.';
  return null;
}

// Apply visual state to a field wrapper
function setFieldState(fieldEl, errorMsg) {
  const wrap = document.getElementById(`wrap-${fieldEl.id.replace('field-','')}`);
  const errEl = document.getElementById(`err-${fieldEl.id.replace('field-','').replace('-','_')}`);
  const errKey = fieldEl.id.replace('field-','').replace(/-/g,'_');
  const errElById = document.getElementById(`err-${fieldEl.id.replace('field-','')}`);

  if (!wrap) return;
  const err = errElById;

  if (errorMsg) {
    wrap.classList.add('has-error');
    wrap.classList.remove('is-valid');
    if (err) { err.textContent = errorMsg; err.classList.remove('hidden'); }
    fieldEl.setAttribute('aria-invalid', 'true');
  } else if (fieldEl.value.trim() || fieldEl.tagName === 'SELECT') {
    // Only mark valid if the user has interacted (has a value)
    const hasValue = fieldEl.tagName === 'SELECT'
      ? !!fieldEl.value
      : !!fieldEl.value.trim();
    if (hasValue) {
      wrap.classList.remove('has-error');
      wrap.classList.add('is-valid');
    } else {
      wrap.classList.remove('has-error', 'is-valid');
    }
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    fieldEl.removeAttribute('aria-invalid');
  } else {
    wrap.classList.remove('has-error', 'is-valid');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    fieldEl.removeAttribute('aria-invalid');
  }
}

// Apply server-returned field errors to specific fields
function applyServerFieldErrors(errors) {
  const fieldMap = {
    title:       F.title(),
    specialty:   F.specialty(),
    location:    F.location(),
    compensation:F.compensation(),
    description: F.description(),
    status:      F.status(),
    start_date:  F.startDate(),
  };
  const unmapped = [];
  errors.forEach(e => {
    const msg     = typeof e === 'string' ? e : e.message;
    const field   = typeof e === 'object' ? e.field : null;
    const targetEl = field ? fieldMap[field] : null;
    if (targetEl) {
      setFieldState(targetEl, msg);
    } else {
      unmapped.push(msg);
    }
  });
  if (unmapped.length) {
    showSummaryErrors(unmapped);
  }
}

// Run full validation; returns array of {field, el, msg}
function validateAll() {
  const checks = [
    { name:'title',       el: F.title() },
    { name:'specialty',   el: F.specialty() },
    { name:'location',    el: F.location() },
    { name:'compensation',el: F.compensation() },
    { name:'description', el: F.description() },
  ];
  const fieldErrors = [];
  checks.forEach(({ name, el }) => {
    const msg = validateField(name, el.value);
    setFieldState(el, msg);
    if (msg) fieldErrors.push({ name, el, msg });
  });

  // Business rule: Open requires required fields
  const status = F.status().value;
  if (status === 'Open') {
    const title    = F.title().value.trim();
    const spec     = F.specialty().value.trim();
    const loc      = F.location().value.trim();
    if (!title || !spec || !loc) {
      const errEl = document.getElementById('err-status');
      const wrap  = document.getElementById('wrap-status');
      if (errEl) { errEl.textContent = 'Open status requires Title, Specialty, and Location.'; errEl.classList.remove('hidden'); }
      if (wrap)  { wrap.classList.add('has-error'); wrap.classList.remove('is-valid'); }
      fieldErrors.push({ name:'status', el: F.status(), msg: 'Status business rule' });
    }
  }

  return fieldErrors;
}

// ── Character counters ────────────────────────────────
function updateCounter(inputEl, counterId, max) {
  const cnt  = document.getElementById(counterId);
  if (!cnt) return;
  const used = inputEl.value.length;
  cnt.textContent = `${used} / ${max}`;
  cnt.classList.remove('near-limit','at-limit');
  if (used >= max)          cnt.classList.add('at-limit');
  else if (used >= max * .85) cnt.classList.add('near-limit');
}

// ── Dirty state ────────────────────────────────────────
let formDirty = false;
jobForm.addEventListener('input',  () => { formDirty = true; });
jobForm.addEventListener('change', () => { formDirty = true; });

// ── Modal open / close ────────────────────────────────
function clearAllFieldStates() {
  document.querySelectorAll('.field').forEach(w => {
    w.classList.remove('has-error','is-valid');
  });
  document.querySelectorAll('.field-error').forEach(e => {
    e.textContent = ''; e.classList.add('hidden');
  });
  document.querySelectorAll('[aria-invalid]').forEach(e => {
    e.removeAttribute('aria-invalid');
  });
  updateCounter(F.title(),       'cnt-title',       120);
  updateCounter(F.description(), 'cnt-description', 2000);
  clearErrors();
  formDirty = false;
}

function openModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'New Job Post';
  document.getElementById('modal-sub').textContent   = 'Fill in the details below. Fields marked * are required.';
  jobForm.reset();
  clearAllFieldStates();
  modalOverlay.classList.remove('hidden');
  attachFieldValidation();
  setTimeout(() => F.title().focus(), 50);
}

function closeModal() {
  if (formDirty) {
    if (!confirm('You have unsaved changes. Close anyway?')) return;
  }
  modalOverlay.classList.add('hidden');
  jobForm.reset();
  clearAllFieldStates();
  validationAttached = false; // allow re-attach with fresh touched set on next open
  editingId = null;
}

function openEdit(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Job Post';
  document.getElementById('modal-sub').textContent   = 'Update the fields below. Fields marked * are required.';
  F.id().value           = job.id;
  F.title().value        = job.title;
  F.specialty().value    = job.specialty;
  F.location().value     = job.location;
  F.schedule().value     = job.schedule || '';
  F.compensation().value = job.compensation || '';
  F.startDate().value    = job.start_date || '';
  F.status().value       = job.status;
  F.description().value  = job.description || '';
  clearAllFieldStates();
  // Mark pre-filled required fields as valid immediately
  [F.title(), F.specialty(), F.location()].forEach(el => setFieldState(el, null));
  updateCounter(F.title(),       'cnt-title',       120);
  updateCounter(F.description(), 'cnt-description', 2000);
  modalOverlay.classList.remove('hidden');
  validationAttached = false; // fresh listeners for this edit session
  attachFieldValidation();
  setTimeout(() => F.title().focus(), 50);
}

// ── Attach real-time per-field validation ─────────────
let validationAttached = false;
function attachFieldValidation() {
  if (validationAttached) return;
  validationAttached = true;

  // blur → validate immediately
  // input → validate if field was already touched (has-error or is-valid)
  const touched = new Set();

  const validateOnBlur = (name, el) => {
    touched.add(name);
    setFieldState(el, validateField(name, el.value));
  };
  const validateOnInput = (name, el) => {
    if (touched.has(name)) setFieldState(el, validateField(name, el.value));
  };

  // Title
  F.title().addEventListener('blur',  e => validateOnBlur('title', e.target));
  F.title().addEventListener('input', e => {
    validateOnInput('title', e.target);
    updateCounter(e.target, 'cnt-title', 120);
  });

  // Specialty
  F.specialty().addEventListener('change', e => {
    touched.add('specialty');
    setFieldState(e.target, validateField('specialty', e.target.value));
  });

  // Location
  F.location().addEventListener('blur',  e => validateOnBlur('location', e.target));
  F.location().addEventListener('input', e => validateOnInput('location', e.target));

  // Compensation (optional — only check max length)
  F.compensation().addEventListener('blur',  e => validateOnBlur('compensation', e.target));
  F.compensation().addEventListener('input', e => validateOnInput('compensation', e.target));

  // Description
  F.description().addEventListener('blur',  e => validateOnBlur('description', e.target));
  F.description().addEventListener('input', e => {
    validateOnInput('description', e.target);
    updateCounter(e.target, 'cnt-description', 2000);
  });

  // Status: warn about Open rule in real-time
  F.status().addEventListener('change', e => {
    const errEl = document.getElementById('err-status');
    const wrap  = document.getElementById('wrap-status');
    if (e.target.value === 'Open') {
      const allFilled = F.title().value.trim() && F.specialty().value && F.location().value.trim();
      if (!allFilled) {
        if (errEl) { errEl.textContent = 'Complete Title, Specialty, and Location before setting to Open.'; errEl.classList.remove('hidden'); }
        if (wrap) wrap.classList.add('has-error');
        return;
      }
    }
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
    if (wrap) wrap.classList.remove('has-error');
  });
}

// ── Form submit ────────────────────────────────────────
document.getElementById('btn-open-modal').addEventListener('click', openModal);
document.getElementById('btn-close-modal').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

jobForm.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  // Client-side full validation
  const fieldErrors = validateAll();
  if (fieldErrors.length) {
    // Shake modal
    const modal = jobForm.closest('.modal');
    if (modal) {
      modal.classList.remove('shake');
      void modal.offsetWidth; // force reflow
      modal.classList.add('shake');
      modal.addEventListener('animationend', () => modal.classList.remove('shake'), { once: true });
    }
    // Focus first errored field
    fieldErrors[0].el.focus({ preventScroll: false });
    // Show summary
    showSummaryErrors(fieldErrors.map(f => f.msg).filter(m => m !== 'Status business rule'));
    return;
  }

  const payload = {
    title:        F.title().value.trim(),
    specialty:    F.specialty().value.trim(),
    location:     F.location().value.trim(),
    schedule:     F.schedule().value || null,
    compensation: F.compensation().value.trim() || null,
    start_date:   F.startDate().value || null,
    description:  F.description().value.trim() || null,
    status:       F.status().value,
  };

  const btn = document.getElementById('btn-submit');
  try {
    // Loading state
    btn.disabled = true;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,.35)" stroke-width="2"/><path d="M7 2a5 5 0 0 1 5 5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> Saving…';
    jobForm.classList.add('form-loading');
    formDirty = false; // prevent dirty-close warning after save

    if (editingId) {
      await API_FETCH(`${API}/${editingId}`, { method:'PUT', body: JSON.stringify(payload) });
      addNotif('✏️', 'n-info', `<strong>${esc(payload.title)}</strong> was updated.`);
      toast('Job post updated successfully.');
    } else {
      const created = await API_FETCH(API, { method:'POST', body: JSON.stringify(payload) });
      addNotif('📋', 'n-draft', `New post created: <strong>${esc(created.title)}</strong>`);
      toast('Job post created successfully.');
    }
    closeModal();
    await loadJobs();
  } catch(err) {
    const errs = err.errors || (err.error ? [err.error] : ['Unexpected error. Please try again.']);
    applyServerFieldErrors(errs);
    // Shake
    const modal = jobForm.closest('.modal');
    if (modal) {
      modal.classList.remove('shake');
      void modal.offsetWidth;
      modal.classList.add('shake');
      modal.addEventListener('animationend', () => modal.classList.remove('shake'), { once: true });
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Save Job Post';
    jobForm.classList.remove('form-loading');
  }
});

function showSummaryErrors(msgs) {
  if (!msgs.length) return;
  formErrors.innerHTML = `
    <div class="err-summary-title">Please fix the following:</div>
    <ul>${msgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`;
  formErrors.classList.remove('hidden');
  formErrors.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function showErrors(errors) { showSummaryErrors(errors.map(e => typeof e === 'string' ? e : e.message)); }
function clearErrors() {
  formErrors.innerHTML = '';
  formErrors.classList.add('hidden');
}

// ── Detail modal ──────────────────────────────────────
const detailOverlay = document.getElementById('detail-overlay');

function openDetail(id) {
  const job = jobs.find(j=>j.id===id);
  if (!job) return;

  document.getElementById('detail-title').textContent    = job.title;
  document.getElementById('detail-subtitle').textContent = job.specialty + ' · ' + job.location;

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-body">
      <div class="detail-head-title">${esc(job.title)}</div>
      <div class="detail-meta">
        <span>🏥 ${esc(job.specialty)}</span>
        <span>📍 ${esc(job.location)}</span>
        ${job.schedule    ? `<span>🕐 ${esc(job.schedule)}</span>` : ''}
        ${job.compensation? `<span>💰 ${esc(job.compensation)}</span>` : ''}
      </div>

      <div class="detail-grid">
        <div class="detail-section">
          <div class="detail-label">Status</div>
          <div class="detail-value"><span class="badge badge-${job.status.toLowerCase()}">${esc(job.status)}</span></div>
        </div>
        ${job.start_date ? `<div class="detail-section"><div class="detail-label">Start Date</div><div class="detail-value">${fmtDate(job.start_date)}</div></div>` : ''}
        <div class="detail-section">
          <div class="detail-label">Posted</div>
          <div class="detail-value">${fmtDateTime(job.created_at)}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">Last Updated</div>
          <div class="detail-value">${fmtDateTime(job.updated_at)}</div>
        </div>
      </div>

      ${job.description ? `<div class="detail-label" style="margin-bottom:8px">Description</div><div class="detail-desc">${esc(job.description)}</div>` : ''}

      <div class="status-panel">
        <div class="status-panel-label">Change Status</div>
        <div class="status-seg-group">
          <button class="seg-btn ${job.status==='Draft'?'seg-active-draft':''}"
            onclick="applyDetailStatus(${job.id},'Draft')">
            <span class="status-opt-dot sod-draft"></span>Draft
          </button>
          <button class="seg-btn ${job.status==='Open'?'seg-active-open':''}"
            onclick="applyDetailStatus(${job.id},'Open')">
            <span class="status-opt-dot sod-open"></span>Open
          </button>
          <button class="seg-btn ${job.status==='Closed'?'seg-active-closed':''}"
            onclick="applyDetailStatus(${job.id},'Closed')">
            <span class="status-opt-dot sod-closed"></span>Closed
          </button>
        </div>
      </div>
    </div>`;

  document.getElementById('detail-footer').innerHTML = `
    <button class="btn btn-danger btn-sm" id="btn-delete">Delete</button>
    <div style="margin-left:auto;display:flex;gap:8px">
      <button class="btn btn-ghost" id="btn-close-detail-footer">Close</button>
      <button class="btn btn-primary" id="btn-edit-from-detail">Edit Post</button>
    </div>`;

  // Edit from detail
  document.getElementById('btn-edit-from-detail').addEventListener('click', () => {
    closeDetail();
    openEdit(id);
  });

  document.getElementById('btn-close-detail-footer').addEventListener('click', closeDetail);

  document.getElementById('btn-delete').addEventListener('click', async () => {
    try {
      const ok = await deleteJob(id, job.title);
      if (!ok) return;
      closeDetail();
      await loadJobs();
    } catch(err) {
      toast(err.error || 'Failed to delete.', 'error');
    }
  });

  detailOverlay.classList.remove('hidden');
}

function closeDetail() { detailOverlay.classList.add('hidden'); }
document.getElementById('btn-close-detail').addEventListener('click', closeDetail);
detailOverlay.addEventListener('click', e => { if (e.target===detailOverlay) closeDetail(); });

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeDetail();
    // Close confirm dialog (resolves false — same as Cancel)
    const co = document.getElementById('confirm-overlay');
    if (!co.classList.contains('hidden')) {
      co.classList.add('hidden');
    }
    // Close any open status dropdowns
    document.querySelectorAll('.status-drop:not(.hidden)').forEach(d => {
      d.classList.add('hidden');
      d.previousElementSibling?.classList.remove('is-open');
    });
  }
});

// Click outside — close status dropdowns + notification panel
document.addEventListener('click', e => {
  // Close custom status dropdowns
  if (!e.target.closest('.status-select-wrap')) {
    document.querySelectorAll('.status-drop:not(.hidden)').forEach(d => {
      d.classList.add('hidden');
      d.previousElementSibling?.classList.remove('is-open');
    });
  }
  // Close notification dropdown
  if (!notifDropdown.classList.contains('hidden') &&
      !notifDropdown.contains(e.target) &&
      e.target !== btnNotif) {
    notifDropdown.classList.add('hidden');
    btnNotif.setAttribute('aria-expanded', 'false');
  }
});

// ── Header date ───────────────────────────────────────
function setHeaderDate() {
  const now = new Date();
  document.getElementById('header-date').textContent =
    now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
}

// ── Notification system ───────────────────────────────
const notifications = [];

function addNotif(icon, cls, html) {
  const ts = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  notifications.unshift({ icon, cls, html, ts });
  renderNotifDot();
  renderNotifList();
}

function renderNotifDot() {
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = notifications.length ? '' : 'none';
}

function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    return;
  }
  list.innerHTML = notifications.slice(0, 8).map(n => `
    <div class="notif-item">
      <div class="notif-icon ${n.cls}">${n.icon}</div>
      <div>
        <div class="notif-text">${n.html}</div>
        <div class="notif-time">${n.ts}</div>
      </div>
    </div>
  `).join('');
}

// Notification button toggle
const btnNotif     = document.getElementById('btn-notif');
const notifDropdown = document.getElementById('notif-dropdown');
const notifClear   = document.getElementById('notif-clear');

btnNotif.addEventListener('click', e => {
  e.stopPropagation();
  const isHidden = notifDropdown.classList.toggle('hidden');
  btnNotif.setAttribute('aria-expanded', String(!isHidden));
  if (!isHidden) renderNotifList();
});

notifClear.addEventListener('click', () => {
  notifications.length = 0;
  renderNotifDot();
  renderNotifList();
  notifDropdown.classList.add('hidden');
  btnNotif.setAttribute('aria-expanded', 'false');
});

// Start with hidden dot (no notifs yet)
document.addEventListener('DOMContentLoaded', () => {
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = 'none';
});

// ── Init ──────────────────────────────────────────────
setHeaderDate();
loadJobs();
