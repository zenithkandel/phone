// DOM Elements
const candidateNameInput = document.getElementById('candidate-name');
const saveNameBtn = document.getElementById('save-name-btn');
const oppositionList = document.getElementById('opposition-list');
const newOppositionInput = document.getElementById('new-opposition');
const addOppositionBtn = document.getElementById('add-opposition-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

let config = {};

// Initialize
async function init() {
    if (window.location.protocol === 'file:') {
        oppositionList.innerHTML = '<p class="empty-text">Server required. Open via http://localhost/phone/config.html</p>';
        return;
    }

    try {
        const res = await fetch('api/get_config.php');
        config = await res.json();
        
        candidateNameInput.value = config.candidate_name || '';
        updateProfileWidget();
        renderOppositionList();
    } catch (err) {
        console.error('Failed to load configuration settings:', err);
        showToast('Error loading configuration settings', 'error');
    }
}

// Update profile initials in the top right widget
function updateProfileWidget() {
    if (config.candidate_name) {
        document.getElementById('display-candidate-name').textContent = config.candidate_name;
        const parts = config.candidate_name.trim().split(/\s+/);
        let initials = '';
        if (parts.length > 0) initials += parts[0][0];
        if (parts.length > 1) initials += parts[parts.length - 1][0];
        document.getElementById('user-avatar-initials').textContent = initials.toUpperCase();
    } else {
        document.getElementById('display-candidate-name').textContent = 'Candidate';
        document.getElementById('user-avatar-initials').textContent = 'VT';
    }
}

// Save candidate name
saveNameBtn.addEventListener('click', async () => {
    config.candidate_name = candidateNameInput.value.trim();
    await saveConfig();
    updateProfileWidget();
    showToast('Candidate profile updated');
});

// Add opposition candidate
addOppositionBtn.addEventListener('click', addOpposition);
newOppositionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addOpposition();
});

function addOpposition() {
    const name = newOppositionInput.value.trim();
    if (!name) return;
    if (!config.opposition_candidates) config.opposition_candidates = [];
    if (config.opposition_candidates.includes(name)) {
        showToast('Candidate already exists', 'error');
        return;
    }
    config.opposition_candidates.push(name);
    newOppositionInput.value = '';
    renderOppositionList();
    saveConfig();
    showToast(`Added opposition candidate: ${name}`);
}

// Remove opposition candidate
function removeOpposition(index) {
    const name = config.opposition_candidates[index];
    config.opposition_candidates.splice(index, 1);
    renderOppositionList();
    saveConfig();
    showToast(`Removed opposition candidate: ${name}`);
}

// Render opposition list
function renderOppositionList() {
    const candidates = config.opposition_candidates || [];
    if (candidates.length === 0) {
        oppositionList.innerHTML = '<p class="empty-text">No opposition candidates added yet.</p>';
        return;
    }
    
    oppositionList.innerHTML = candidates.map((name, i) => `
        <div class="opposition-item">
            <span class="opposition-name">${escapeHtml(name)}</span>
            <button class="btn btn-danger btn-sm" onclick="removeOpposition(${i})">
                <i class="fa-sharp-duotone fa-solid fa-trash"></i> Remove
            </button>
        </div>
    `).join('');
}

// Save config to server
async function saveConfig() {
    try {
        await fetch('api/save_config.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
    } catch (err) {
        console.error('Failed to save config:', err);
        showToast('Error saving configuration settings', 'error');
    }
}

// Export tracking data
exportBtn.addEventListener('click', async () => {
    try {
        const [trackingRes, votersRes] = await Promise.all([
            fetch('api/get_tracking.php'),
            fetch('api/get_voters.php')
        ]);
        const tracking = await trackingRes.json();
        const voters = await votersRes.json();
        
        const exportData = {
            config: config,
            tracking: tracking,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voter-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Tracking data exported successfully');
    } catch (err) {
        console.error('Export failed:', err);
        showToast('Error exporting data', 'error');
    }
});

// Import tracking data
importBtn.addEventListener('click', () => {
    importFile.click();
});

importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.config) {
            config = data.config;
            candidateNameInput.value = config.candidate_name || '';
            updateProfileWidget();
            renderOppositionList();
            await saveConfig();
        }
        
        if (data.tracking) {
            // Save each tracking entry
            for (const voterId in data.tracking) {
                const t = data.tracking[voterId];
                for (const field in t) {
                    await fetch('api/save_tracking.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ voter_id: parseInt(voterId), field: field, value: t[field] })
                    });
                }
            }
        }
        
        showToast('Backup data imported successfully');
    } catch (err) {
        console.error('Import failed:', err);
        showToast('Error importing backup. Invalid format.', 'error');
    }
    
    importFile.value = '';
});

// Premium toast notification
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const icon = type === 'success' 
        ? `<i class="fa-sharp-duotone fa-solid fa-circle-check"></i>`
        : `<i class="fa-sharp-duotone fa-solid fa-triangle-exclamation" style="color: var(--color-red)"></i>`;
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2200);
}

// Escape HTML utility
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
