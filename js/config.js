// Toast CSS styles needed in the page:
// .toast { position: fixed; bottom: 20px; right: 20px; background: #333; color: #fff;
//   padding: 12px 24px; border-radius: 6px; opacity: 0; transition: opacity 0.3s;
//   z-index: 9999; font-size: 14px; }
// .toast.show { opacity: 1; }

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
    try {
        const res = await fetch('api/get_config.php');
        config = await res.json();
        
        candidateNameInput.value = config.candidate_name || '';
        renderOppositionList();
    } catch (err) {
        console.error('Failed to load config:', err);
    }
}

// Save candidate name
saveNameBtn.addEventListener('click', async () => {
    config.candidate_name = candidateNameInput.value.trim();
    await saveConfig();
    showToast('Name saved successfully');
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
        showToast('Candidate already exists');
        return;
    }
    config.opposition_candidates.push(name);
    newOppositionInput.value = '';
    renderOppositionList();
    saveConfig();
}

// Remove opposition candidate
function removeOpposition(index) {
    config.opposition_candidates.splice(index, 1);
    renderOppositionList();
    saveConfig();
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
            <button class="btn btn-danger btn-sm" onclick="removeOpposition(${i})">Remove</button>
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
        showToast('Error saving config');
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
        showToast('Data exported successfully');
    } catch (err) {
        console.error('Export failed:', err);
        showToast('Error exporting data');
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
        
        showToast('Data imported successfully');
    } catch (err) {
        console.error('Import failed:', err);
        showToast('Error importing data. Invalid file format.');
    }
    
    importFile.value = '';
});

// Simple toast notification
function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Escape HTML utility
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Init
init();
