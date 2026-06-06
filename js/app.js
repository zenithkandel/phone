// Global state
let allVoters = [];
let allTracking = {};
let config = {};
let filteredVoters = [];
let currentPage = 1;
const perPage = 50;

// DOM Elements
const tableBody = document.getElementById('voter-table-body');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterTitle = document.getElementById('filter-title');
const filterSource = document.getElementById('filter-source');
const filterRenewal = document.getElementById('filter-renewal');
const paginationEl = document.getElementById('pagination');

// Stats elements
const statTotal = document.getElementById('stat-total');
const statCalled = document.getElementById('stat-called');
const statVoteMe = document.getElementById('stat-vote-me');
const statOpposition = document.getElementById('stat-opposition');

// Initialize
async function init() {
    // Show loading
    tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Loading voters...</td></tr>';

    try {
        const [votersRes, trackingRes, configRes] = await Promise.all([
            fetch('api/get_voters.php'),
            fetch('api/get_tracking.php'),
            fetch('api/get_config.php')
        ]);

        allVoters = await votersRes.json();
        allTracking = await trackingRes.json();
        config = await configRes.json();

        populateTitleFilter();
        applyFilters();
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Error loading data. Make sure you are running via PHP server.</td></tr>';
    }
}

// Populate title filter dropdown with unique titles
function populateTitleFilter() {
    const titles = [...new Set(allVoters.map(v => v.title).filter(Boolean))].sort();
    titles.forEach(title => {
        const opt = document.createElement('option');
        opt.value = title;
        opt.textContent = title;
        filterTitle.appendChild(opt);
    });
}

// Apply all filters and search
function applyFilters() {
    const search = searchInput.value.toLowerCase().trim();
    const statusFilter = filterStatus.value;
    const titleFilter = filterTitle.value;
    const sourceFilter = filterSource.value;
    const renewalFilter = filterRenewal.value;

    filteredVoters = allVoters.filter(voter => {
        // Search
        if (search && !voter.name.toLowerCase().includes(search) && !voter.phone.includes(search)) {
            return false;
        }

        // Title
        if (titleFilter !== 'all' && voter.title !== titleFilter) return false;

        // Source
        if (sourceFilter !== 'all' && voter.source !== sourceFilter) return false;

        // Renewal
        if (renewalFilter !== 'all' && voter.renewal !== renewalFilter) return false;

        // Status
        const t = allTracking[voter.id] || {};
        if (statusFilter === 'called' && !t.called) return false;
        if (statusFilter === 'not-called' && t.called) return false;
        if (statusFilter === 'vote-me' && !t.vote_me) return false;
        if (statusFilter === 'vote-opposition' && !t.vote_opposition) return false;

        return true;
    });

    currentPage = 1;
    renderTable();
    renderPagination();
    updateStats();
}

// Render the current page of the table
function renderTable() {
    const start = (currentPage - 1) * perPage;
    const page = filteredVoters.slice(start, start + perPage);

    if (page.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No voters found matching your filters.</td></tr>';
        return;
    }

    tableBody.innerHTML = page.map(voter => {
        const t = allTracking[voter.id] || { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };

        return `<tr>
            <td>${voter.serial || voter.id}</td>
            <td class="name-cell">${escapeHtml(voter.name)}</td>
            <td>${voter.phone}</td>
            <td><span class="title-badge">${escapeHtml(voter.title)}</span></td>
            <td><span class="source-badge source-${voter.source === 'Life Member' ? 'life' : 'voter'}">${voter.source}</span></td>
            <td>
                <button class="toggle-btn toggle-called ${t.called ? 'active-blue' : ''}"
                    onclick="toggleField(${voter.id}, 'called', ${!t.called})" title="Mark as ${t.called ? 'not called' : 'called'}">
                    ${t.called ? '📞' : '—'}
                </button>
            </td>
            <td>
                <button class="toggle-btn toggle-vote-me ${t.vote_me ? 'active-green' : ''}"
                    onclick="toggleField(${voter.id}, 'vote_me', ${!t.vote_me})" title="${t.vote_me ? 'Remove support' : 'Mark as supporter'}">
                    ${t.vote_me ? '✓' : '—'}
                </button>
            </td>
            <td class="opposition-cell">
                <button class="toggle-btn toggle-opposition ${t.vote_opposition ? 'active-red' : ''}"
                    onclick="toggleOpposition(${voter.id}, ${!t.vote_opposition})" title="${t.vote_opposition ? 'Remove opposition' : 'Mark as opposition'}">
                    ${t.vote_opposition ? '✗' : '—'}
                </button>
                ${t.vote_opposition ? renderOppositionDropdown(voter.id, t.opposition_candidate) : ''}
            </td>
        </tr>`;
    }).join('');
}

// Render opposition candidate dropdown
function renderOppositionDropdown(voterId, currentCandidate) {
    const candidates = config.opposition_candidates || [];
    if (candidates.length === 0) {
        return `<input type="text" class="opposition-input" placeholder="Name..."
            onchange="setOppositionCandidate(${voterId}, this.value)"
            value="${escapeHtml(currentCandidate)}">`;
    }

    const options = candidates.map(c =>
        `<option value="${escapeHtml(c)}" ${c === currentCandidate ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');

    return `<select class="opposition-select" onchange="setOppositionCandidate(${voterId}, this.value)">
        <option value="">Select...</option>
        ${options}
    </select>`;
}

// Toggle a boolean field
async function toggleField(voterId, field, value) {
    // Update local state
    if (!allTracking[voterId]) {
        allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };
    }
    allTracking[voterId][field] = value;

    renderTable();
    updateStats();

    // Save to server
    try {
        await fetch('api/save_tracking.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voter_id: voterId, field: field, value: value })
        });
    } catch (err) {
        console.error('Failed to save:', err);
    }
}

// Toggle opposition (and clear candidate if turning off)
async function toggleOpposition(voterId, value) {
    if (!allTracking[voterId]) {
        allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };
    }
    allTracking[voterId].vote_opposition = value;
    if (!value) allTracking[voterId].opposition_candidate = '';

    renderTable();
    updateStats();

    try {
        await fetch('api/save_tracking.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voter_id: voterId, field: 'vote_opposition', value: value })
        });
        if (!value) {
            await fetch('api/save_tracking.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voter_id: voterId, field: 'opposition_candidate', value: '' })
            });
        }
    } catch (err) {
        console.error('Failed to save:', err);
    }
}

// Set opposition candidate name
async function setOppositionCandidate(voterId, candidate) {
    if (!allTracking[voterId]) {
        allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };
    }
    allTracking[voterId].opposition_candidate = candidate;

    try {
        await fetch('api/save_tracking.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voter_id: voterId, field: 'opposition_candidate', value: candidate })
        });
    } catch (err) {
        console.error('Failed to save:', err);
    }
}

// Update stats cards
function updateStats() {
    const total = allVoters.length;
    let called = 0, voteMe = 0, opposition = 0;

    for (const id in allTracking) {
        const t = allTracking[id];
        if (t.called) called++;
        if (t.vote_me) voteMe++;
        if (t.vote_opposition) opposition++;
    }

    statTotal.textContent = total.toLocaleString();
    statCalled.textContent = called.toLocaleString();
    statVoteMe.textContent = voteMe.toLocaleString();
    statOpposition.textContent = opposition.toLocaleString();
}

// Render pagination
function renderPagination() {
    const totalPages = Math.ceil(filteredVoters.length / perPage);

    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    let html = '';

    // Previous
    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}"
        onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

    // Page numbers (show max 7)
    const startPage = Math.max(1, currentPage - 3);
    const endPage = Math.min(totalPages, currentPage + 3);

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
        html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Next
    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}"
        onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;

    paginationEl.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredVoters.length / perPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
    // Scroll to top of table
    document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Utility: escape HTML
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Event listeners
searchInput.addEventListener('input', debounce(applyFilters, 300));
filterStatus.addEventListener('change', applyFilters);
filterTitle.addEventListener('change', applyFilters);
filterSource.addEventListener('change', applyFilters);
filterRenewal.addEventListener('change', applyFilters);

// Debounce utility
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Init on load
init();
