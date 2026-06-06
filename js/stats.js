// Global state for stats page
let allVoters = [];
let allTracking = {};
let config = {};

// DOM Elements
const statTotal = document.getElementById('stat-total');
const statCalled = document.getElementById('stat-called');
const statVoteMe = document.getElementById('stat-vote-me');
const statOpposition = document.getElementById('stat-opposition');

const labelProgressCalled = document.getElementById('label-progress-called');
const fillProgressCalled = document.getElementById('fill-progress-called');
const labelProgressSupport = document.getElementById('label-progress-support');
const fillProgressSupport = document.getElementById('fill-progress-support');

// Initialize
async function init() {
    try {
        const [votersRes, trackingRes, configRes] = await Promise.all([
            fetch('api/get_voters.php'),
            fetch('api/get_tracking.php'),
            fetch('api/get_config.php')
        ]);

        allVoters = await votersRes.json();
        allTracking = await trackingRes.json();
        config = await configRes.json();

        // Update candidate name in top-bar UI
        if (config.candidate_name) {
            document.getElementById('display-candidate-name').textContent = config.candidate_name;
            const parts = config.candidate_name.trim().split(/\s+/);
            let initials = '';
            if (parts.length > 0) initials += parts[0][0];
            if (parts.length > 1) initials += parts[parts.length - 1][0];
            document.getElementById('user-avatar-initials').textContent = initials.toUpperCase();
        }

        renderMetrics();
        renderCharts();
    } catch (err) {
        console.error('Failed to load stats details:', err);
    }
}

// Calculate and render numerical metrics and progress bars
function renderMetrics() {
    const total = allVoters.length;
    let called = 0;
    let voteMe = 0;
    let opposition = 0;

    for (const id in allTracking) {
        const t = allTracking[id];
        if (t.called) called++;
        if (t.vote_me) voteMe++;
        if (t.vote_opposition) opposition++;
    }

    // Update main count boxes
    statTotal.textContent = total.toLocaleString();
    statCalled.textContent = called.toLocaleString();
    statVoteMe.textContent = voteMe.toLocaleString();
    statOpposition.textContent = opposition.toLocaleString();

    // Progress bar 1: Called Outreach Ratio
    const calledPercent = total > 0 ? Math.round((called / total) * 100) : 0;
    labelProgressCalled.textContent = `${calledPercent}% (${called.toLocaleString()} of ${total.toLocaleString()})`;
    fillProgressCalled.style.width = `${calledPercent}%`;

    // Progress bar 2: Support leaning rate out of called voters
    const supportPercent = called > 0 ? Math.round((voteMe / called) * 100) : 0;
    labelProgressSupport.textContent = `${supportPercent}% (${voteMe.toLocaleString()} of ${called.toLocaleString()})`;
    fillProgressSupport.style.width = `${supportPercent}%`;
}

// Draw charts using Chart.js API
function renderCharts() {
    const total = allVoters.length;
    let called = 0;
    let voteMe = 0;
    let opposition = 0;

    // Compile opposition names mapping counts
    const oppositionBreakdown = {};
    const configuredOpponents = config.opposition_candidates || [];
    configuredOpponents.forEach(name => {
        oppositionBreakdown[name] = 0;
    });
    oppositionBreakdown['Unspecified / Other'] = 0;

    for (const id in allTracking) {
        const t = allTracking[id];
        if (t.called) called++;
        if (t.vote_me) voteMe++;
        if (t.vote_opposition) {
            opposition++;
            const oppName = t.opposition_candidate ? t.opposition_candidate.trim() : '';
            if (oppName && configuredOpponents.includes(oppName)) {
                oppositionBreakdown[oppName]++;
            } else {
                oppositionBreakdown['Unspecified / Other']++;
            }
        }
    }

    const calledUndecided = Math.max(0, called - (voteMe + opposition));
    const uncalled = Math.max(0, total - called);

    // ── Chart 1: Donut Chart (Support Overview) ──
    const donutCtx = document.getElementById('chart-donut-support').getContext('2d');
    new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Supporting Me', 'Opposition Leaning', 'Called & Undecided', 'Not Contacted'],
            datasets: [{
                data: [voteMe, opposition, calledUndecided, uncalled],
                backgroundColor: [
                    '#10b981', // green for Supporting Me
                    '#f43f5e', // rose/red for Opposition
                    '#3b82f6', // blue for Called & Undecided
                    '#e4e4e7'  // light grey for Uncalled
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 12,
                            weight: '500'
                        },
                        padding: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });

    // ── Chart 2: Bar Chart (Opposition Competitors Breakdown) ──
    const barLabels = Object.keys(oppositionBreakdown);
    const barData = Object.values(oppositionBreakdown);

    // Only render opposition chart if there's data or configured options
    const barCtx = document.getElementById('chart-bar-opposition').getContext('2d');
    new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{
                label: 'Voter Count',
                data: barData,
                backgroundColor: '#27272a', // zinc-800 monochromatic
                hoverBackgroundColor: '#09090b', // pure black hover
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // hide dataset legend box
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: "'Inter', sans-serif",
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9'
                    },
                    ticks: {
                        precision: 0,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Init stats loader
init();
