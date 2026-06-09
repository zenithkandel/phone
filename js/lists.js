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
  } catch (err) {
    showError('Error Loading Data', 'Could not connect to database. Make sure you are running via a PHP server.');
  }
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

  // Render Will Vote Me list
  renderList(listVoteMe, voteMeList, 'vote_me');

  // Render Call Later list
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

    // Status tags
    const tags = [];
    if (t.called) tags.push('<span class="list-tag tag-blue">Called</span>');
    if (t.vote_opposition) tags.push('<span class="list-tag tag-red">Opposition</span>');

    return `
      <div class="voter-list-item">
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
          ${phone ? `<button class="list-action-btn copy-btn" onclick="copyToClipboard('${phone}', '${escapeHtml(voter.name)}')" title="Copy phone"><i class="fa-sharp-duotone fa-solid fa-copy"></i></button>` : ''}
        </div>
      </div>
    `;
  }).join('');
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
