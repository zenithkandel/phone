// Global state
let allVoters = [];
let allTracking = {};
let config = {};
let filteredVoters = [];
let currentPage = 1;
const perPage = 24; // divisible by 1, 2, 3, and 4 (perfect for responsive grids)

// DOM Elements
const cardsGrid = document.getElementById('voter-cards-grid');
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
    // Show spinner loading state
    cardsGrid.innerHTML = `
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

        // Update candidate name in UI
        if (config.candidate_name) {
            document.getElementById('display-candidate-name').textContent = config.candidate_name;
            const parts = config.candidate_name.trim().split(/\s+/);
            let initials = '';
            if (parts.length > 0) initials += parts[0][0];
            if (parts.length > 1) initials += parts[parts.length - 1][0];
            document.getElementById('user-avatar-initials').textContent = initials.toUpperCase();
        }

        populateTitleFilter();
        applyFilters();
    } catch (err) {
        cardsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-sharp-duotone fa-solid fa-triangle-exclamation" style="color: var(--color-red)"></i>
                <h3>Error Loading Data</h3>
                <p>Could not connect to database. Make sure you are running via a PHP server.</p>
            </div>
        `;
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
    renderVoterCards();
    renderPagination();
    updateStats();
}

// Render the current page of voter cards
function renderVoterCards() {
    const start = (currentPage - 1) * perPage;
    const page = filteredVoters.slice(start, start + perPage);

    if (page.length === 0) {
        cardsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-sharp-duotone fa-solid fa-magnifying-glass"></i>
                <h3>No Voters Found</h3>
                <p>Try widening your search or changing the filters.</p>
            </div>
        `;
        return;
    }

    cardsGrid.innerHTML = page.map((voter, idx) => {
        const t = allTracking[voter.id] || { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };

        // Card badges
        const sourceBadge = voter.source === 'Life Member'
            ? `<span class="badge badge-source-life"><i class="fa-sharp-duotone fa-solid fa-medal"></i> Life Member</span>`
            : `<span class="badge badge-source-voter"><i class="fa-sharp-duotone fa-solid fa-address-book"></i> Voter</span>`;

        const renewalBadge = voter.renewal === 'life_member'
            ? ''
            : (voter.renewal === 'new'
                ? `<span class="badge badge-renewal-new"><i class="fa-sharp-duotone fa-solid fa-plus"></i> New</span>`
                : `<span class="badge badge-renewal-existing"><i class="fa-sharp-duotone fa-solid fa-history"></i> Existing</span>`);

        const calledClass = t.called ? 'active-called' : '';
        const voteMeClass = t.vote_me ? 'active-vote-me' : '';
        const oppositionClass = t.vote_opposition ? 'active-opposition' : '';

        // Render opposition select or text input depending on configurations
        let oppositionContainer = '';
        if (t.vote_opposition) {
            const candidates = config.opposition_candidates || [];
            if (candidates.length === 0) {
                oppositionContainer = `
                    <div class="opposition-select-container">
                        <span class="opposition-select-label">Opposition Name</span>
                        <input type="text" class="opposition-card-input" placeholder="Type candidate name..."
                            onchange="setOppositionCandidate(${voter.id}, this.value)"
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
                        <select class="opposition-card-select" onchange="setOppositionCandidate(${voter.id}, this.value)">
                            <option value="">Select Candidate...</option>
                            ${options}
                        </select>
                    </div>
                `;
            }
        }

        // Apply a staggered entry animation delay for beautiful loading experiences
        const animDelay = (idx % 6) * 0.05;

        return `
            <div class="voter-card" style="animation-delay: ${animDelay}s">
                <div class="card-header">
                    <span class="voter-id-badge">#${voter.serial || voter.id}</span>
                    <div class="badge-group">
                        ${sourceBadge}
                        ${renewalBadge}
                    </div>
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
                                <button class="copy-phone-btn" onclick="copyToClipboard('${voter.phone}', '${escapeHtml(voter.name)}')" title="Copy Phone Number">
                                    <i class="fa-sharp-duotone fa-solid fa-copy"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn ${calledClass}" onclick="toggleField(${voter.id}, 'called', ${!t.called})" title="Mark as Called">
                        <i class="fa-sharp-duotone fa-solid fa-phone-arrow-up-right"></i>
                        <span>Called</span>
                    </button>
                    <button class="card-action-btn ${voteMeClass}" onclick="toggleField(${voter.id}, 'vote_me', ${!t.vote_me})" title="Supporting Me">
                        <i class="fa-sharp-duotone fa-solid fa-thumbs-up"></i>
                        <span>Vote Me</span>
                    </button>
                    <button class="card-action-btn ${oppositionClass}" onclick="toggleOpposition(${voter.id}, ${!t.vote_opposition})" title="Opposition Supporter">
                        <i class="fa-sharp-duotone fa-solid fa-user-slash"></i>
                        <span>Opposition</span>
                    </button>
                </div>
                ${oppositionContainer}
            </div>
        `;
    }).join('');
}

// Toggle a boolean field (handles exclusive state logic as well)
async function toggleField(voterId, field, value) {
    if (!allTracking[voterId]) {
        allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };
    }
    
    allTracking[voterId][field] = value;
    let sideEffects = [];

    // Logical Improvement: "Vote Me" and "Opposition" are mutually exclusive
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

    renderVoterCards();
    updateStats();

    try {
        await Promise.all([
            saveTracking(voterId, field, value),
            ...sideEffects
        ]);
    } catch (err) {
        console.error('Failed to save tracking:', err);
    }
}

// Toggle opposition state (and mutual exclusion check)
async function toggleOpposition(voterId, value) {
    if (!allTracking[voterId]) {
        allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };
    }
    
    allTracking[voterId].vote_opposition = value;
    let sideEffects = [];

    if (value) {
        // Logical Improvement: Mutual exclusion check
        if (allTracking[voterId].vote_me) {
            allTracking[voterId].vote_me = false;
            sideEffects.push(saveTracking(voterId, 'vote_me', false));
        }
    } else {
        allTracking[voterId].opposition_candidate = '';
        sideEffects.push(saveTracking(voterId, 'opposition_candidate', ''));
    }

    renderVoterCards();
    updateStats();

    try {
        await Promise.all([
            saveTracking(voterId, 'vote_opposition', value),
            ...sideEffects
        ]);
    } catch (err) {
        console.error('Failed to save opposition toggle:', err);
    }
}

// Save specific tracking field to PHP api
async function saveTracking(voterId, field, value) {
    return fetch('api/save_tracking.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: voterId, field: field, value: value })
    });
}

// Set opposition candidate name
async function setOppositionCandidate(voterId, candidate) {
    if (!allTracking[voterId]) {
        allTracking[voterId] = { called: false, vote_me: false, vote_opposition: false, opposition_candidate: '' };
    }
    allTracking[voterId].opposition_candidate = candidate;

    try {
        await saveTracking(voterId, 'opposition_candidate', candidate);
    } catch (err) {
        console.error('Failed to save opposition candidate name:', err);
    }
}

// Update stats cards in real-time
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

    // Previous Button
    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}"
        onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-sharp-duotone fa-solid fa-angle-left"></i></button>`;

    // Page numbers display (max 7 numbers showing around current page)
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

    // Next Button
    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}"
        onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-sharp-duotone fa-solid fa-angle-right"></i></button>`;

    paginationEl.innerHTML = html;
}

// Jump to a page and smooth scroll to view filters
function goToPage(page) {
    const totalPages = Math.ceil(filteredVoters.length / perPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderVoterCards();
    renderPagination();
    
    // Smooth scroll to card search bar filter panel
    document.querySelector('.filter-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Utility: copy text to clipboard and trigger clean toast
function copyToClipboard(text, name) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied phone number of ${name}`);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

// Simple dynamic toast notification
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
