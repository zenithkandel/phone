// ── Global State ─────────────────────────────────────
let allVoters = [];
let allTracking = {};
let config = {};
let filteredVoters = [];
let displayedCount = 0;
const perLoad = 20;
let currentQuickFilter = 'all';

// ── DOM Elements ────────────────────────────────────
const reelFeed = document.getElementById('reel-feed');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const filterChips = document.getElementById('filter-chips');
const filterTitle = document.getElementById('filter-title');
const filterSource = document.getElementById('filter-source');
const filterRenewal = document.getElementById('filter-renewal');
const toggleShowNoPhone = document.getElementById('toggle-show-no-phone');
const loadMoreBtn = document.getElementById('load-more-btn');
const loadMoreContainer = document.getElementById('load-more-container');
const emptyState = document.getElementById('empty-state');
const voterCounter = document.getElementById('counter-text');
const advToggleBtn = document.getElementById('adv-toggle-btn');
const advFiltersPanel = document.getElementById('advanced-filters-panel');
const activeFilterTags = document.getElementById('active-filter-tags');

// Edit modal
const editModalOverlay = document.getElementById('edit-modal-overlay');
const editModal = document.getElementById('edit-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalVoterId = document.getElementById('modal-voter-id');
const editName = document.getElementById('edit-name');
const editTitle = document.getElementById('edit-title');
const editPhone = document.getElementById('edit-phone');

let editingVoterId = null;

// ── localStorage Helpers ────────────────────────────
const STORAGE_KEY = 'voterTracker_filters';

function saveFiltersToStorage() {
  const filters = {
    quickFilter: currentQuickFilter,
    search: searchInput.value,
    title: filterTitle.value,
    source: filterSource.value,
    renewal: filterRenewal.value,
    showNoPhone: toggleShowNoPhone.checked,
    advPanelOpen: advFiltersPanel.classList.contains('open')
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (e) { /* ignore */ }
}

function loadFiltersFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const filters = JSON.parse(raw);

    if (filters.quickFilter) {
      currentQuickFilter = filters.quickFilter;
      const chip = filterChips.querySelector(`[data-filter="${filters.quickFilter}"]`);
      if (chip) {
        filterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
    }

    if (filters.search) searchInput.value = filters.search;
    if (filters.title) filterTitle.value = filters.title;
    if (filters.source) filterSource.value = filters.source;
    if (filters.renewal) filterRenewal.value = filters.renewal;
    if (filters.showNoPhone) toggleShowNoPhone.checked = true;
    if (filters.advPanelOpen) {
      advFiltersPanel.classList.add('open');
      advToggleBtn.classList.add('open');
    }
  } catch (e) { /* ignore */ }
}

// ── Initialize ──────────────────────────────────────
async function init() {
  if (window.location.protocol === 'file:') {
    reelFeed.innerHTML = '';
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
      <i class="fa-sharp-duotone fa-solid fa-triangle-exclamation" style="color: var(--color-red)"></i>
      <h3>Server Required</h3>
      <p>This app requires a PHP server. Please start Apache in XAMPP and open via<br><strong>http://localhost/phone/index.html</strong></p>
    `;
    return;
  }

  reelFeed.innerHTML = `
    <div class="spinner-container">
      <div class="spinner"></div>
      <p>Loading voters list...</p>
    </div>
  `;

  try {
    const [votersRes, trackingRes, configRes] = await Promise.all([
      fetch('api/get_voters.php'),
      fetch('api/get_tracking.php'),
      fetch('api/get_config.php')
    ]);

    allVoters = await votersRes.json();
    allTracking = await trackingRes.json();
    config = await configRes.json();

    if (config.candidate_name) {
      document.getElementById('display-candidate-name').textContent = config.candidate_name;
      const parts = config.candidate_name.trim().split(/\s+/);
      let initials = '';
      if (parts.length > 0) initials += parts[0][0];
      if (parts.length > 1) initials += parts[parts.length - 1][0];
      document.getElementById('user-avatar-initials').textContent = initials.toUpperCase();
    }

    populateTitleFilter();
    loadFiltersFromStorage();
    searchClearBtn.classList.toggle('visible', searchInput.value.length > 0);
    updateChipCounts();
    applyFilters();
  } catch (err) {
    reelFeed.innerHTML = '';
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
      <i class="fa-sharp-duotone fa-solid fa-triangle-exclamation" style="color: var(--color-red)"></i>
      <h3>Error Loading Data</h3>
      <p>Could not connect to database. Make sure you are running via a PHP server.</p>
    `;
  }
}

// ── Populate Title Filter ───────────────────────────
function populateTitleFilter() {
  const titleMap = {};
  allVoters.forEach(v => {
    if (v.title) {
      const normalized = v.title.charAt(0).toUpperCase() + v.title.slice(1);
      if (!titleMap[normalized]) titleMap[normalized] = normalized;
    }
  });
  const titles = Object.values(titleMap).sort();
  titles.forEach(title => {
    const opt = document.createElement('option');
    opt.value = title;
    opt.textContent = title;
    filterTitle.appendChild(opt);
  });
}

// ── Get Tracking Defaults ───────────────────────────
function getTracking(voterId) {
  return allTracking[voterId] || {
    called: false,
    vote_me: false,
    vote_opposition: false,
    opposition_candidate: '',
    call_later: false
  };
}

// ── Update Chip Counts ──────────────────────────────
function updateChipCounts() {
  let counts = {
    all: allVoters.length,
    vote_me: 0,
    vote_opposition: 0,
    call_later: 0,
    called: 0,
    not_called: 0,
    unmarked: 0
  };

  allVoters.forEach(voter => {
    const t = getTracking(voter.id);
    if (t.vote_me) counts.vote_me++;
    if (t.vote_opposition) counts.vote_opposition++;
    if (t.call_later) counts.call_later++;
    if (t.called) counts.called++;
    if (!t.called) counts.not_called++;
    if (!t.vote_me && !t.vote_opposition && !t.call_later && !t.called) counts.unmarked++;
  });

  for (const key in counts) {
    const el = document.getElementById(`chip-count-${key}`);
    if (el) el.textContent = counts[key].toLocaleString();
  }
}

// ── Apply All Filters ───────────────────────────────
function applyFilters() {
  const search = searchInput.value.toLowerCase().trim();
  const titleFilter = filterTitle.value;
  const sourceFilter = filterSource.value;
  const renewalFilter = filterRenewal.value;
  const showNoPhone = toggleShowNoPhone ? toggleShowNoPhone.checked : false;

  filteredVoters = allVoters.filter(voter => {
    // Phone filter
    const phoneStr = String(voter.phone || '');
    const hasNoPhone = !phoneStr || phoneStr === 'Not Found' || phoneStr.trim() === '';
    if (!showNoPhone && hasNoPhone) return false;

    // Search
    if (search && !voter.name.toLowerCase().includes(search) && !phoneStr.toLowerCase().includes(search)) return false;

    // Title
    const voterTitle = voter.title ? (voter.title.charAt(0).toUpperCase() + voter.title.slice(1)) : '';
    if (titleFilter !== 'all' && voterTitle !== titleFilter) return false;

    // Source
    if (sourceFilter !== 'all' && voter.source !== sourceFilter) return false;

    // Renewal
    if (renewalFilter !== 'all' && voter.renewal !== renewalFilter) return false;

    // Quick filter (status chips)
    const t = getTracking(voter.id);
    if (currentQuickFilter === 'vote_me' && !t.vote_me) return false;
    if (currentQuickFilter === 'vote_opposition' && !t.vote_opposition) return false;
    if (currentQuickFilter === 'call_later' && !t.call_later) return false;
    if (currentQuickFilter === 'called' && !t.called) return false;
    if (currentQuickFilter === 'not_called' && t.called) return false;
    if (currentQuickFilter === 'unmarked' && (t.vote_me || t.vote_opposition || t.call_later || t.called)) return false;

    return true;
  });

  displayedCount = 0;
  reelFeed.innerHTML = '';
  emptyState.style.display = 'none';
  loadMoreCards();
  updateCounter();
  updateActiveFilterTags();
  saveFiltersToStorage();
}

// ── Load More Cards ─────────────────────────────────
function loadMoreCards() {
  const start = displayedCount;
  const end = start + perLoad;
  const batch = filteredVoters.slice(start, end);

  if (batch.length === 0 && displayedCount === 0) {
    reelFeed.innerHTML = '';
    emptyState.style.display = 'flex';
    loadMoreContainer.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  batch.forEach((voter, idx) => {
    const card = createVoterCard(voter, idx);
    reelFeed.appendChild(card);
  });

  displayedCount = end;
  loadMoreContainer.style.display = displayedCount >= filteredVoters.length ? 'none' : 'flex';
}

// ── Create Voter Card Element ───────────────────────
function createVoterCard(voter, idx) {
  const t = getTracking(voter.id);

  const card = document.createElement('div');
  card.className = 'voter-card';
  card.dataset.voterId = voter.id;

  // Add status class for stripe color
  if (t.vote_me) card.classList.add('status-vote_me');
  else if (t.vote_opposition) card.classList.add('status-vote_opposition');
  else if (t.call_later) card.classList.add('status-call_later');
  else if (t.called) card.classList.add('status-called');

  card.style.animationDelay = `${(idx % 6) * 0.05}s`;

  // Badges
  const sourceBadge = voter.source === 'Life Member'
    ? `<span class="badge badge-source-life"><i class="fa-sharp-duotone fa-solid fa-medal"></i> Life Member</span>`
    : `<span class="badge badge-source-voter"><i class="fa-sharp-duotone fa-solid fa-address-book"></i> Voter</span>`;

  const renewalBadge = voter.renewal === 'life_member'
    ? ''
    : (voter.renewal === 'new'
      ? `<span class="badge badge-renewal-new"><i class="fa-sharp-duotone fa-solid fa-plus"></i> New</span>`
      : `<span class="badge badge-renewal-existing"><i class="fa-sharp-duotone fa-solid fa-history"></i> Existing</span>`);

  // Called toggle (compact row below main buttons)
  const calledToggle = `
    <div class="card-called-toggle">
      <button class="called-toggle-btn ${t.called ? 'active' : ''}" data-action="toggle" data-field="called" data-voter-id="${voter.id}" data-current="${t.called}">
        <i class="fa-sharp-duotone fa-solid fa-phone-arrow-up-right"></i>
        <span>${t.called ? 'Called' : 'Mark Called'}</span>
      </button>
    </div>
  `;

  // Opposition select
  let oppositionContainer = '';
  if (t.vote_opposition) {
    const candidates = config.opposition_candidates || [];
    if (candidates.length === 0) {
      oppositionContainer = `
        <div class="opposition-select-container">
          <span class="opposition-select-label">Whom in the Opposition?</span>
          <input type="text" class="opposition-card-input" placeholder="Type candidate name..."
            data-action="set-opposition" data-voter-id="${voter.id}"
            value="${escapeHtml(t.opposition_candidate)}">
        </div>
      `;
    } else {
      const options = candidates.map(c =>
        `<option value="${escapeHtml(c)}" ${c === t.opposition_candidate ? 'selected' : ''}>${escapeHtml(c)}</option>`
      ).join('');
      oppositionContainer = `
        <div class="opposition-select-container">
          <span class="opposition-select-label">Whom in the Opposition?</span>
          <select class="opposition-card-select" data-action="set-opposition" data-voter-id="${voter.id}">
            <option value="">Select Candidate...</option>
            ${options}
          </select>
        </div>
      `;
    }
  }

  card.innerHTML = `
    <div class="card-top-row">
      <div class="card-badges">
        <span class="voter-id-badge">#${voter.serial || voter.id}</span>
        ${sourceBadge}
        ${renewalBadge}
      </div>
      <button class="card-edit-btn" data-action="edit" data-voter-id="${voter.id}" title="Edit voter details">
        <i class="fa-sharp-duotone fa-solid fa-pen"></i>
      </button>
    </div>
    <div class="card-body">
      <h3 class="voter-name">${escapeHtml(voter.name)}</h3>
      <div class="voter-title">
        <i class="fa-sharp-duotone fa-solid fa-user-tie"></i>
        <span>${escapeHtml(voter.title || 'Voter')}</span>
      </div>
      <div class="voter-contact">
        <a href="tel:${voter.phone}" class="phone-link" title="Call ${escapeHtml(voter.name)}">
          <i class="fa-sharp-duotone fa-solid fa-phone"></i>
          <span>${escapeHtml(voter.phone)}</span>
        </a>
        <div class="phone-actions">
          ${voter.phone && voter.phone !== 'Not Found' ? `
            <button class="copy-phone-btn" data-action="copy" data-phone="${voter.phone}" data-name="${escapeHtml(voter.name)}" title="Copy Phone Number">
              <i class="fa-sharp-duotone fa-solid fa-copy"></i>
            </button>
          ` : ''}
        </div>
      </div>
    </div>
    <div class="card-status-actions">
      <button class="status-btn btn-vote-me ${t.vote_me ? 'active' : ''}" data-action="toggle" data-field="vote_me" data-voter-id="${voter.id}" data-current="${t.vote_me}">
        <i class="fa-sharp-duotone fa-solid fa-circle-check"></i>
        <span>Will Vote Me</span>
      </button>
      <button class="status-btn btn-opposition ${t.vote_opposition ? 'active' : ''}" data-action="toggle-opposition" data-voter-id="${voter.id}" data-current="${t.vote_opposition}">
        <i class="fa-sharp-duotone fa-solid fa-circle-xmark"></i>
        <span>Won't Vote</span>
      </button>
      <button class="status-btn btn-call-later ${t.call_later ? 'active' : ''}" data-action="toggle" data-field="call_later" data-voter-id="${voter.id}" data-current="${t.call_later}">
        <i class="fa-sharp-duotone fa-solid fa-clock"></i>
        <span>Call Later</span>
      </button>
    </div>
    ${calledToggle}
    ${oppositionContainer}
  `;

  return card;
}

// ── Toggle Status Field ─────────────────────────────
async function toggleField(voterId, field, value) {
  if (!allTracking[voterId]) {
    allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '', call_later: false };
  }

  allTracking[voterId][field] = value;
  let sideEffects = [];

  // Mutual exclusion: vote_me and vote_opposition
  if (field === 'vote_me' && value) {
    if (allTracking[voterId].vote_opposition) {
      allTracking[voterId].vote_opposition = false;
      allTracking[voterId].opposition_candidate = '';
      sideEffects.push(
        saveTracking(voterId, 'vote_opposition', false),
        saveTracking(voterId, 'opposition_candidate', '')
      );
    }
  }

  if (field === 'vote_opposition' && value) {
    if (allTracking[voterId].vote_me) {
      allTracking[voterId].vote_me = false;
      sideEffects.push(saveTracking(voterId, 'vote_me', false));
    }
  }

  if (field === 'vote_opposition' && !value) {
    allTracking[voterId].opposition_candidate = '';
    sideEffects.push(saveTracking(voterId, 'opposition_candidate', ''));
  }

  updateChipCounts();
  updateCardState(voterId);

  try {
    await Promise.all([
      saveTracking(voterId, field, value),
      ...sideEffects
    ]);
  } catch (err) {
    console.error('Failed to save tracking:', err);
  }
}

// ── Toggle Opposition (with candidate select) ───────
async function toggleOpposition(voterId, value) {
  if (!allTracking[voterId]) {
    allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '', call_later: false };
  }

  allTracking[voterId].vote_opposition = value;
  let sideEffects = [];

  if (value) {
    if (allTracking[voterId].vote_me) {
      allTracking[voterId].vote_me = false;
      sideEffects.push(saveTracking(voterId, 'vote_me', false));
    }
  } else {
    allTracking[voterId].opposition_candidate = '';
    sideEffects.push(saveTracking(voterId, 'opposition_candidate', ''));
  }

  updateChipCounts();
  // Need full re-render for opposition select show/hide
  applyFiltersWithoutReset();

  try {
    await Promise.all([
      saveTracking(voterId, 'vote_opposition', value),
      ...sideEffects
    ]);
  } catch (err) {
    console.error('Failed to save opposition toggle:', err);
  }
}

// ── Update a single card's state (no full re-render) ─
function updateCardState(voterId) {
  const card = reelFeed.querySelector(`[data-voter-id="${voterId}"]`);
  if (!card) return;

  const t = getTracking(voterId);

  // Update stripe color
  card.classList.remove('status-vote_me', 'status-vote_opposition', 'status-call_later', 'status-called');
  if (t.vote_me) card.classList.add('status-vote_me');
  else if (t.vote_opposition) card.classList.add('status-vote_opposition');
  else if (t.call_later) card.classList.add('status-call_later');
  else if (t.called) card.classList.add('status-called');

  // Update button states
  const btns = card.querySelectorAll('.status-btn, .called-toggle-btn');
  btns.forEach(btn => {
    const action = btn.dataset.action;
    const field = btn.dataset.field;
    if (action === 'toggle' && field === 'vote_me') {
      btn.classList.toggle('active', t.vote_me);
      btn.dataset.current = t.vote_me;
    } else if (action === 'toggle' && field === 'call_later') {
      btn.classList.toggle('active', t.call_later);
      btn.dataset.current = t.call_later;
    } else if (action === 'toggle' && field === 'called') {
      btn.classList.toggle('active', t.called);
      btn.dataset.current = t.called;
      btn.querySelector('span').textContent = t.called ? 'Called' : 'Mark Called';
    } else if (action === 'toggle-opposition') {
      btn.classList.toggle('active', t.vote_opposition);
      btn.dataset.current = t.vote_opposition;
    }
  });
}

// ── Re-render without resetting scroll (for filter changes) ─
function applyFiltersWithoutReset() {
  const search = searchInput.value.toLowerCase().trim();
  const titleFilter = filterTitle.value;
  const sourceFilter = filterSource.value;
  const renewalFilter = filterRenewal.value;
  const showNoPhone = toggleShowNoPhone ? toggleShowNoPhone.checked : false;

  filteredVoters = allVoters.filter(voter => {
    const phoneStr = String(voter.phone || '');
    const hasNoPhone = !phoneStr || phoneStr === 'Not Found' || phoneStr.trim() === '';
    if (!showNoPhone && hasNoPhone) return false;
    if (search && !voter.name.toLowerCase().includes(search) && !phoneStr.toLowerCase().includes(search)) return false;
    const voterTitle = voter.title ? (voter.title.charAt(0).toUpperCase() + voter.title.slice(1)) : '';
    if (titleFilter !== 'all' && voterTitle !== titleFilter) return false;
    if (sourceFilter !== 'all' && voter.source !== sourceFilter) return false;
    if (renewalFilter !== 'all' && voter.renewal !== renewalFilter) return false;

    const t = getTracking(voter.id);
    if (currentQuickFilter === 'vote_me' && !t.vote_me) return false;
    if (currentQuickFilter === 'vote_opposition' && !t.vote_opposition) return false;
    if (currentQuickFilter === 'call_later' && !t.call_later) return false;
    if (currentQuickFilter === 'called' && !t.called) return false;
    if (currentQuickFilter === 'not_called' && t.called) return false;
    if (currentQuickFilter === 'unmarked' && (t.vote_me || t.vote_opposition || t.call_later || t.called)) return false;

    return true;
  });

  displayedCount = 0;
  reelFeed.innerHTML = '';
  emptyState.style.display = 'none';
  loadMoreCards();
  updateCounter();
}

// ── Update Counter ──────────────────────────────────
function updateCounter() {
  voterCounter.textContent = `${filteredVoters.length.toLocaleString()} voter${filteredVoters.length !== 1 ? 's' : ''}`;
}

// ── Update Active Filter Tags ───────────────────────
function updateActiveFilterTags() {
  const tags = [];

  if (currentQuickFilter !== 'all') {
    const chipLabel = filterChips.querySelector(`[data-filter="${currentQuickFilter}"] span:first-child`);
    tags.push({ label: chipLabel ? chipLabel.textContent : currentQuickFilter, clear: () => setQuickFilter('all') });
  }
  if (filterTitle.value !== 'all') {
    tags.push({ label: filterTitle.value, clear: () => { filterTitle.value = 'all'; applyFilters(); } });
  }
  if (filterSource.value !== 'all') {
    tags.push({ label: filterSource.value, clear: () => { filterSource.value = 'all'; applyFilters(); } });
  }
  if (filterRenewal.value !== 'all') {
    tags.push({ label: filterRenewal.value, clear: () => { filterRenewal.value = 'all'; applyFilters(); } });
  }
  if (toggleShowNoPhone.checked) {
    tags.push({ label: 'No Phone Shown', clear: () => { toggleShowNoPhone.checked = false; applyFilters(); } });
  }

  if (tags.length === 0) {
    activeFilterTags.innerHTML = '';
    return;
  }

  activeFilterTags.innerHTML = tags.map((tag, i) =>
    `<span class="active-filter-tag">${escapeHtml(tag.label)} <i class="fa-sharp-duotone fa-solid fa-xmark" data-tag-idx="${i}"></i></span>`
  ).join('');

  // Attach clear handlers
  activeFilterTags.querySelectorAll('i[data-tag-idx]').forEach(icon => {
    icon.addEventListener('click', () => {
      const idx = parseInt(icon.dataset.tagIdx);
      if (tags[idx] && tags[idx].clear) tags[idx].clear();
    });
  });
}

// ── Set Quick Filter ────────────────────────────────
function setQuickFilter(filter) {
  currentQuickFilter = filter;
  filterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  const chip = filterChips.querySelector(`[data-filter="${filter}"]`);
  if (chip) chip.classList.add('active');
  applyFilters();
}

// ── Save Tracking ───────────────────────────────────
async function saveTracking(voterId, field, value) {
  return fetch('api/save_tracking.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter_id: voterId, field: field, value: value })
  });
}

// ── Set Opposition Candidate ────────────────────────
async function setOppositionCandidate(voterId, candidate) {
  if (!allTracking[voterId]) {
    allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '', call_later: false };
  }
  allTracking[voterId].opposition_candidate = candidate;
  try {
    await saveTracking(voterId, 'opposition_candidate', candidate);
  } catch (err) {
    console.error('Failed to save opposition candidate:', err);
  }
}

// ── Edit Modal ──────────────────────────────────────
function openEditModal(voterId) {
  const voter = allVoters.find(v => v.id === voterId);
  if (!voter) return;

  editingVoterId = voterId;
  modalVoterId.textContent = `#${voter.serial || voter.id}`;
  editName.value = voter.name || '';
  editTitle.value = voter.title || '';
  editPhone.value = voter.phone || '';

  editModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  editName.focus();
}

function closeEditModal() {
  editModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  editingVoterId = null;
}

async function saveEditModal() {
  if (!editingVoterId) return;

  const voter = allVoters.find(v => v.id === editingVoterId);
  if (!voter) return;

  const newName = editName.value.trim();
  const newTitle = editTitle.value.trim();
  const newPhone = editPhone.value.trim();

  if (!newName) {
    showToast('Name cannot be empty');
    return;
  }

  // Update local data
  voter.name = newName;
  voter.title = newTitle;
  voter.phone = newPhone;

  // Save to server
  try {
    await fetch('api/save_voter.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: editingVoterId, name: newName, title: newTitle, phone: newPhone })
    });
  } catch (err) {
    console.error('Failed to save voter:', err);
  }

  closeEditModal();
  applyFiltersWithoutReset();
  showToast('Voter details updated');
}

// ── Toast Notification ──────────────────────────────
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-sharp-duotone fa-solid fa-circle-check"></i><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// ── Copy to Clipboard ───────────────────────────────
function copyToClipboard(text, name) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied phone number of ${name}`);
  }).catch(err => {
    console.error('Copy failed:', err);
  });
}

// ── Escape HTML ─────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Debounce ────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Event Listeners ─────────────────────────────────

// Quick filter chips
filterChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  setQuickFilter(chip.dataset.filter);
});

// Search
searchInput.addEventListener('input', debounce(() => {
  searchClearBtn.classList.toggle('visible', searchInput.value.length > 0);
  applyFilters();
}, 300));

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchClearBtn.classList.remove('visible');
  applyFilters();
});

// Advanced filters
filterTitle.addEventListener('change', applyFilters);
filterSource.addEventListener('change', applyFilters);
filterRenewal.addEventListener('change', applyFilters);
if (toggleShowNoPhone) toggleShowNoPhone.addEventListener('change', applyFilters);

// Advanced filters toggle
advToggleBtn.addEventListener('click', () => {
  advFiltersPanel.classList.toggle('open');
  advToggleBtn.classList.toggle('open');
  saveFiltersToStorage();
});

// Load more
loadMoreBtn.addEventListener('click', loadMoreCards);

// Delegated events on reel feed
reelFeed.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const voterId = parseInt(target.dataset.voterId);

  if (action === 'toggle') {
    const field = target.dataset.field;
    const current = target.dataset.current === 'true';
    toggleField(voterId, field, !current);
  } else if (action === 'toggle-opposition') {
    const current = target.dataset.current === 'true';
    toggleOpposition(voterId, !current);
  } else if (action === 'edit') {
    openEditModal(voterId);
  } else if (action === 'copy') {
    copyToClipboard(target.dataset.phone, target.dataset.name);
  }
});

// Delegated change events on reel feed (for selects and inputs)
reelFeed.addEventListener('change', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'set-opposition') {
    const voterId = parseInt(target.dataset.voterId);
    setOppositionCandidate(voterId, target.value);
  }
});

reelFeed.addEventListener('input', (e) => {
  const target = e.target.closest('[data-action="set-opposition"]');
  if (!target) return;
  // Debounced save for text input
  const voterId = parseInt(target.dataset.voterId);
  clearTimeout(target._debounce);
  target._debounce = setTimeout(() => {
    setOppositionCandidate(voterId, target.value);
  }, 500);
});

// Edit modal
modalCloseBtn.addEventListener('click', closeEditModal);
modalCancelBtn.addEventListener('click', closeEditModal);
modalSaveBtn.addEventListener('click', saveEditModal);
editModalOverlay.addEventListener('click', (e) => {
  if (e.target === editModalOverlay) closeEditModal();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeEditModal();
});

// Init
init();
