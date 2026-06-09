// ── Global State ─────────────────────────────────────
let allVoters = [];
let allTracking = {};
let config = {};

// ── DOM Elements ────────────────────────────────────
const summaryVoteMeCount = document.getElementById('summary-vote-me-count');
const summaryCallLaterCount = document.getElementById('summary-call-later-count');
const listVoteMe = document.getElementById('list-vote-me');
const listCallLater = document.getElementById('list-call-later');
const listCountVoteMe = document.getElementById('list-count-vote-me');
const listCountCallLater = document.getElementById('list-count-call-later');

// Edit modal
const editModalOverlay = document.getElementById('edit-modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalVoterId = document.getElementById('modal-voter-id');
const editName = document.getElementById('edit-name');
const editTitle = document.getElementById('edit-title');
const editPhone = document.getElementById('edit-phone');

let editingVoterId = null;

// ── Initialize ──────────────────────────────────────
async function init() {
  if (window.location.protocol === 'file:') {
    listVoteMe.innerHTML = '';
    listCallLater.innerHTML = '';
    showError('Server Required', 'This app requires a PHP server. Please start Apache in XAMPP and open via<br><strong>http://localhost/phone/lists.html</strong>');
    return;
  }

  showLoading();

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

    renderLists();
    setupEventListeners();
  } catch (err) {
    showError('Error Loading Data', 'Could not connect to database. Make sure you are running via a PHP server.');
  }
}

// ── Event Listeners ─────────────────────────────────
function setupEventListeners() {
  // Delegated click events on lists
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const voterId = parseInt(target.dataset.voterId);

    if (action === 'remove') {
      removeFromList(voterId, target.dataset.field);
    } else if (action === 'edit') {
      openEditModal(voterId);
    } else if (action === 'copy') {
      copyToClipboard(target.dataset.phone, target.dataset.name);
    }
  });

  // Modal events
  modalCloseBtn.addEventListener('click', closeEditModal);
  modalCancelBtn.addEventListener('click', closeEditModal);
  modalSaveBtn.addEventListener('click', saveEditModal);
  editModalOverlay.addEventListener('click', (e) => {
    if (e.target === editModalOverlay) closeEditModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditModal();
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

// ── Show Loading State ──────────────────────────────
function showLoading() {
  const loadingHtml = `
    <div class="spinner-container" style="padding: 40px;">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  `;
  listVoteMe.innerHTML = loadingHtml;
  listCallLater.innerHTML = loadingHtml;
}

// ── Show Error State ────────────────────────────────
function showError(title, message) {
  const errorHtml = `
    <div class="list-empty">
      <i class="fa-sharp-duotone fa-solid fa-triangle-exclamation"></i>
      <strong>${title}</strong><br>
      <span style="font-size:12px;opacity:0.7">${message}</span>
    </div>
  `;
  listVoteMe.innerHTML = errorHtml;
  listCallLater.innerHTML = errorHtml;
}

// ── Remove Voter from List ──────────────────────────
async function removeFromList(voterId, field) {
  if (!allTracking[voterId]) {
    allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '', call_later: false };
  }

  allTracking[voterId][field] = false;

  // Also clear opposition_candidate if removing opposition
  const sideEffects = [];
  if (field === 'vote_opposition') {
    allTracking[voterId].opposition_candidate = '';
    sideEffects.push(saveTracking(voterId, 'opposition_candidate', ''));
  }

  const voter = allVoters.find(v => v.id === voterId);
  const label = field === 'vote_me' ? 'Will Vote Me' : 'Call Later';

  // Animate the row out
  const row = document.querySelector(`[data-voter-id="${voterId}"]`);
  if (row) {
    row.classList.add('list-item-removing');
    row.addEventListener('animationend', () => {
      renderLists();
    }, { once: true });
  } else {
    renderLists();
  }

  try {
    await Promise.all([
      saveTracking(voterId, field, false),
      ...sideEffects
    ]);
    showToast(`${voter ? voter.name : 'Voter'} removed from ${label}`);
  } catch (err) {
    console.error('Failed to save tracking:', err);
  }
}

// ── Render Both Lists ───────────────────────────────
function renderLists() {
  const voteMeList = [];
  const callLaterList = [];

  allVoters.forEach(voter => {
    const t = getTracking(voter.id);
    if (t.vote_me) voteMeList.push(voter);
    if (t.call_later) callLaterList.push(voter);
  });

  // Sort by serial number
  voteMeList.sort((a, b) => (a.serial || a.id) - (b.serial || b.id));
  callLaterList.sort((a, b) => (a.serial || a.id) - (b.serial || b.id));

  // Update counts
  summaryVoteMeCount.textContent = voteMeList.length.toLocaleString();
  summaryCallLaterCount.textContent = callLaterList.length.toLocaleString();
  listCountVoteMe.textContent = voteMeList.length;
  listCountCallLater.textContent = callLaterList.length;

  renderList(listVoteMe, voteMeList, 'vote_me');
  renderList(listCallLater, callLaterList, 'call_later');
}

// ── Render a Single List ────────────────────────────
function renderList(container, voters, type) {
  if (voters.length === 0) {
    const icon = type === 'vote_me' ? 'fa-circle-check' : 'fa-clock';
    const text = type === 'vote_me' ? 'No voters marked yet' : 'No voters to call later';
    container.innerHTML = `
      <div class="list-empty">
        <i class="fa-sharp-duotone fa-solid ${icon}"></i>
        ${text}
      </div>
    `;
    return;
  }

  container.innerHTML = voters.map(voter => {
    const phone = voter.phone && voter.phone !== 'Not Found' ? voter.phone : '';
    const t = getTracking(voter.id);

    const tags = [];
    if (t.called) tags.push('<span class="list-tag tag-blue">Called</span>');
    if (t.vote_opposition) tags.push('<span class="list-tag tag-red">Opposition</span>');

    return `
      <div class="voter-list-item" data-voter-id="${voter.id}">
        <div class="voter-list-item-info">
          <div class="voter-list-item-name">
            <span class="list-item-id">#${voter.serial || voter.id}</span>
            ${escapeHtml(voter.name)}
          </div>
          <div class="voter-list-item-detail">
            <i class="fa-sharp-duotone fa-solid fa-user-tie"></i> ${escapeHtml(voter.title || 'Voter')}
            ${phone ? `<i class="fa-sharp-duotone fa-solid fa-phone"></i> ${escapeHtml(phone)}` : ''}
          </div>
          ${tags.length ? `<div class="list-item-tags">${tags.join('')}</div>` : ''}
        </div>
        <div class="voter-list-item-actions">
          ${phone ? `<a href="tel:${phone}" class="list-action-btn call-btn" title="Call ${escapeHtml(voter.name)}"><i class="fa-sharp-duotone fa-solid fa-phone"></i></a>` : ''}
          ${phone ? `<button class="list-action-btn copy-btn" data-action="copy" data-phone="${phone}" data-name="${escapeHtml(voter.name)}" title="Copy phone"><i class="fa-sharp-duotone fa-solid fa-copy"></i></button>` : ''}
          <button class="list-action-btn edit-btn" data-action="edit" data-voter-id="${voter.id}" title="Edit details">
            <i class="fa-sharp-duotone fa-solid fa-pen"></i>
          </button>
          <button class="list-action-btn remove-btn" data-action="remove" data-voter-id="${voter.id}" data-field="${type}" title="Remove from list">
            <i class="fa-sharp-duotone fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
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
  renderLists();
  showToast('Voter details updated');
}

// ── Save Tracking ───────────────────────────────────
async function saveTracking(voterId, field, value) {
  return fetch('api/save_tracking.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter_id: voterId, field: field, value: value })
  });
}

// ── Copy to Clipboard ───────────────────────────────
function copyToClipboard(text, name) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied phone number of ${name}`);
  }).catch(err => {
    console.error('Copy failed:', err);
  });
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

// Init
init();
