// API base (supports ?api= override)
const BASE_API_URL = (function() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('api');
  
  // For Vercel deployment, use demo mode if no API override
  if (override) {
    return override;
  } else if (window.location.hostname.includes('vercel.app')) {
    // In Vercel deployment, use demo data
    console.log('Running in demo mode on Vercel');
    return null; // This will trigger demo data
  }
  
  // Local development - point to your backend server
  return 'http://localhost:3001/api'; // Updated to full backend URL
})();

// Embed mode
const EMBED_MODE = (function() {
  const params = new URLSearchParams(window.location.search);
  return params.get('embed') === '1';
})();

// In-memory state
let players = [];
let lastAssistLogId = null; // for undo
let isMutating = false; // pause operations during mutations
let hasShownError = false;
let isLoading = true;
let errorCount = 0;
const MAX_ERROR_COUNT = 3;

// Track current state for change detection
let lastKnownState = null;

// Debug info
console.log('🔄 Script loaded on:', window.location.hostname);
console.log('🔗 BASE_API_URL:', BASE_API_URL);
console.log('🌐 Vercel detected:', window.location.hostname.includes('vercel.app'));

// Initialize the widget
document.addEventListener('DOMContentLoaded', function() {
  bootstrapUI();
});

async function bootstrapUI() {
  // Force demo data on Vercel - ADD THIS FIX
  if (window.location.hostname.includes('vercel.app')) {
    console.log('Vercel detected - forcing demo mode');
    loadDemoData();
  }
  
  if (EMBED_MODE) {
    document.documentElement.classList.add('embed');
  }
  
  // Initialize theme first
  initializeTheme();
  
  // Initial load
  await refreshPlayers();

  document.getElementById('addAssists').addEventListener('click', addAssists);
  document.getElementById('reduceAssists').addEventListener('click', reduceAssists);
  document.getElementById('undoButton').addEventListener('click', undoLastUpdate);
  document.getElementById('undoButton').disabled = true;
  document.getElementById('assistInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addAssists();
    }
  });

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark';
      setTheme(next);
    });
  }

  console.log('✅ Auto-refresh disabled. Leaderboard updates only on assist changes.');
}

// Enhanced theme initialization
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    // Force a re-render to ensure dark mode styles apply
    setTimeout(() => {
        if (players.length > 0) {
            renderLeaderboard();
        }
    }, 100);
}

async function refreshPlayers() {
  try {
    showLoading(true);
    
    // If no API URL (demo mode), use demo data immediately
    if (!BASE_API_URL || window.location.hostname.includes('vercel.app')) {
      console.log('Running in demo mode');
      loadDemoData();
      showLoading(false);
      return;
    }
    
    const res = await fetch(`${BASE_API_URL}/players`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load players');

    // Create state fingerprint for change detection
    const currentState = json.data.map(p => `${p.id}-${p.assists}`).join('|');
    
    // Only update if state actually changed
    if (lastKnownState !== currentState) {
      lastKnownState = currentState;
      
      // Normalize and decorate colors for non-Braden players deterministically
      players = json.data
        .map(p => ({
          id: p.id,
          name: p.name,
          team: p.team,
          assists: p.assists,
          isBraden: !!p.is_braden,
          color: stringToColor(p.team || p.name)
        }))
        .sort((a, b) => b.assists - a.assists);

      renderPlayerMarkers();
      renderLeaderboard();
      updateProgressBar();
      setError(null);
      errorCount = 0; // Reset error count on success
      
      console.log('🔄 Leaderboard updated (state changed)');
    } else {
      console.log('ℹ️  Leaderboard state unchanged, skipping UI update');
    }
  } catch (e) {
    console.error('Refresh failed:', e);
    errorCount++;
    
    if (errorCount >= MAX_ERROR_COUNT) {
      setError('Unable to connect to server. Using demo data.');
      loadDemoData();
    } else {
      setError(`Connection issue (${errorCount}/${MAX_ERROR_COUNT}). Retrying on next action...`);
    }
    
    // Use demo data if API fails
    if (players.length === 0) {
      loadDemoData();
    }
  } finally {
    showLoading(false);
  }
}

// Force refresh regardless of state changes (for manual updates)
async function forceRefreshPlayers() {
  lastKnownState = null; // Reset state to force update
  await refreshPlayers();
}

// Load demo data when API is unavailable
function loadDemoData() {
  console.log('📊 Loading demo data...');
  players = [
    { id: 1, name: "Bobby Hurley", assists: 1076, team: "Duke", color: "#001A57", isBraden: false },
    { id: 2, name: "Chris Corchiani", assists: 1038, team: "NC State", color: "#CC0000", isBraden: false },
    { id: 3, name: "Ed Cota", assists: 1030, team: "North Carolina", color: "#7BAFD4", isBraden: false },
    { id: 4, name: "Jason Brickman", assists: 1007, team: "Long Island University", color: "#002D62", isBraden: false },
    { id: 5, name: "Keith Jennings", assists: 983, team: "East Tennessee State", color: "#003366", isBraden: false },
    { id: 6, name: "Steve Blake", assists: 972, team: "Maryland", color: "#E03A3E", isBraden: false },
    { id: 7, name: "Sherman Douglas", assists: 960, team: "Syracuse", color: "#F76900", isBraden: false },
    { id: 8, name: "Tony Miller", assists: 956, team: "Marquette", color: "#003366", isBraden: false },
    { id: 9, name: "Aaron Miles", assists: 954, team: "Kansas", color: "#0051BA", isBraden: false },
    { id: 10, name: "Greg Anthony", assists: 950, team: "Nevada-Las Vegas", color: "#BA0C2F", isBraden: false },
    { id: 11, name: "Braden Smith", assists: 758, team: "Purdue", color: "#CEB888", isBraden: true }
  ].sort((a, b) => b.assists - a.assists);

  console.log('✅ Demo data loaded, player count:', players.length);
  renderPlayerMarkers();
  renderLeaderboard();
  updateProgressBar();
}

// Deterministic pastel color from string
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 40%)`;
}

function setTheme(mode) {
  if (mode === 'dark') {
    document.documentElement.classList.add('theme-dark');
    localStorage.setItem('theme', 'dark');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '☀️';
  } else {
    document.documentElement.classList.remove('theme-dark');
    localStorage.setItem('theme', 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '🌙';
  }
  
  // Re-render leaderboard to apply theme-specific styles
  if (players.length > 0) {
    renderLeaderboard();
  }
}

function setError(message) {
  const banner = document.getElementById('errorBanner');
  if (!banner) return;
  if (!message) {
    banner.classList.add('d-none');
    banner.textContent = '';
    hasShownError = false;
  } else {
    banner.classList.remove('d-none');
    banner.textContent = message;
    hasShownError = true;
  }
}

// Enhanced error display
function showError(message) {
  const banner = document.getElementById('errorBanner');
  if (!banner) return;
  
  banner.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <span>❌ ${message}</span>
      <button type="button" class="btn-close btn-close-sm" onclick="setError(null)"></button>
    </div>
  `;
  banner.classList.remove('d-none');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    setError(null);
  }, 5000);
}

// Render player markers on the court with enhanced animations
function renderPlayerMarkers() {
  const court = document.querySelector('.court-background');
  const timeline = document.querySelector('.timeline');
  
  if (!court || !timeline) {
    console.error('Court or timeline element not found');
    return;
  }
  
  const timelineWidth = timeline.offsetWidth;
  const timelineLeft = timeline.offsetLeft;
  
  // Clear existing markers
  const existingMarkers = document.querySelectorAll('.player-marker');
  existingMarkers.forEach(marker => marker.remove());
  
  // Find Braden Smith
  const braden = players.find(player => player.isBraden);
  if (!braden) {
    console.error('Braden Smith not found in players');
    return;
  }
  
  const maxAssists = players[0].assists;
  const minAssists = braden.assists;
  const assistRange = Math.max(maxAssists - minAssists, 1); // Avoid division by zero
  
  players.forEach((player, index) => {
    // Calculate position on timeline
    const playerPosition = ((player.assists - minAssists) / assistRange) * timelineWidth;
    
    const marker = document.createElement('div');
    marker.className = `player-marker ${player.isBraden ? 'braden' : 'other'}`;
    marker.style.left = `${timelineLeft + playerPosition}px`;
    marker.style.backgroundColor = player.isBraden ? '' : player.color;
    marker.textContent = player.isBraden ? 'BS' : player.name.split(' ').map(n => n[0]).join('');
    marker.title = `${player.name}: ${player.assists} assists`;
    
    // Stagger animation
    marker.style.animationDelay = `${index * 0.1}s`;
    
    marker.addEventListener('click', function() {
      highlightPlayer(player.id);
    });
    
    marker.addEventListener('mouseenter', function() {
      this.style.transform = 'translateX(-50%) scale(1.15)';
      this.style.zIndex = '100';
    });
    
    marker.addEventListener('mouseleave', function() {
      this.style.transform = 'translateX(-50%) scale(1)';
      this.style.zIndex = '';
    });
    
    court.appendChild(marker);
  });
}

// Enhanced renderLeaderboard with staggered animations and dark mode support
function renderLeaderboard() {
  const leaderboard = document.getElementById('leaderboard');
  if (!leaderboard) {
    console.error('Leaderboard element not found');
    return;
  }
  
  leaderboard.innerHTML = '';
  
  players.forEach((player, index) => {
    const rank = index + 1;
    const card = document.createElement('div');
    card.className = `player-card ${player.isBraden ? 'active' : ''}`;
    card.dataset.playerId = player.id;
    card.style.setProperty('--index', index);
    
    // Rank badge color based on position
    let badgeClass = 'bg-secondary';
    if (rank === 1) badgeClass = 'bg-warning text-dark';
    else if (rank <= 3) badgeClass = 'bg-success';
    else if (player.isBraden) badgeClass = 'bg-warning text-dark';
    
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center">
          <span class="badge ${badgeClass} me-3 rank-badge">${rank}</span>
          <div class="flex-grow-1">
            <h6 class="mb-1 fw-bold player-name">${player.name}</h6>
            <small class="text-muted d-block player-team">${player.team}</small>
          </div>
        </div>
        <div class="text-end">
          <strong class="h5 mb-0 player-assists">${player.assists.toLocaleString()}</strong>
          <div class="text-muted small">assists</div>
        </div>
      </div>
    `;
    
    card.addEventListener('click', function() {
      highlightPlayer(player.id);
    });
    
    leaderboard.appendChild(card);
  });
}

// Enhanced updateProgressBar with smooth counting
function updateProgressBar() {
  const braden = players.find(player => player.isBraden);
  if (!braden) {
    console.error('Braden Smith not found for progress bar');
    return;
  }
  
  const recordAssists = players[0].assists;
  const progressPercentage = Math.min((braden.assists / recordAssists) * 100, 100);
  
  const progressBar = document.getElementById('progressBar');
  const bradenProgress = document.getElementById('bradenProgress');
  const bradenAssists = document.getElementById('bradenAssists');
  
  // Smooth progress bar animation
  if (progressBar) {
    progressBar.style.width = `${progressPercentage}%`;
  }
  if (bradenProgress) {
    bradenProgress.style.width = `${progressPercentage}%`;
  }
  
  // Animated counter
  if (bradenAssists) {
    animateValue(bradenAssists, parseInt(bradenAssists.textContent.replace(/,/g, '')) || 0, braden.assists, 800);
  }
  
  // Update "needs X assists" text
  const neededAssists = recordAssists - braden.assists;
  const smallText = document.querySelector('#bradenCard small');
  if (smallText) {
    smallText.textContent = `Needs ${neededAssists} assists to break record`;
    smallText.className = neededAssists <= 100 ? 'text-success fw-bold' : 'text-muted';
  }
}

// Animate numeric values
function animateValue(element, start, end, duration) {
  const startTime = performance.now();
  const difference = end - start;
  
  // If no change needed, return early
  if (difference === 0) return;
  
  function updateValue(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const value = Math.floor(start + (difference * easeOutQuart));
    
    element.textContent = value.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(updateValue);
    } else {
      element.textContent = end.toLocaleString();
    }
  }
  
  requestAnimationFrame(updateValue);
}

// Highlight a specific player
function highlightPlayer(playerId) {
  // Remove active class from all cards
  document.querySelectorAll('.player-card').forEach(card => {
    card.classList.remove('active');
  });
  
  // Add active class to selected player
  const playerCard = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
  if (playerCard) {
    playerCard.classList.add('active');
    
    // Scroll into view if needed
    playerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Animate assist addition
function animateAssistAddition(assistsAdded) {
  const counter = document.getElementById('bradenAssists');
  const card = document.getElementById('bradenCard');
  
  // Pulse animation
  if (card) {
    card.classList.add('assist-added');
    setTimeout(() => {
      card.classList.remove('assist-added');
    }, 600);
  }
  
  // Show success message
  showSuccessMessage(`+${assistsAdded} assists added!`);
}

// Animate assist removal
function animateAssistRemoval(assistsRemoved) {
  const counter = document.getElementById('bradenAssists');
  const card = document.getElementById('bradenCard');
  
  // Shake animation
  if (card) {
    card.classList.add('assist-removed');
    setTimeout(() => {
      card.classList.remove('assist-removed');
    }, 600);
  }
  
  // Show danger message
  showDangerMessage(`-${assistsRemoved} assists removed!`);
}

// Show success message
function showSuccessMessage(message) {
  const existingBanner = document.querySelector('.success-banner');
  if (existingBanner) {
    existingBanner.remove();
  }
  
  const banner = document.createElement('div');
  banner.className = 'success-banner';
  banner.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <span>✅ ${message}</span>
      <button type="button" class="btn-close btn-close-sm" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  
  const errorBanner = document.getElementById('errorBanner');
  if (errorBanner) {
    errorBanner.parentNode.insertBefore(banner, errorBanner.nextSibling);
  }
  
  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (banner.parentNode) {
          banner.remove();
        }
      }, 300);
    }
  }, 3000);
}

// Show danger message
function showDangerMessage(message) {
  const existingBanner = document.querySelector('.danger-banner');
  if (existingBanner) {
    existingBanner.remove();
  }
  
  const banner = document.createElement('div');
  banner.className = 'danger-banner';
  banner.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <span>⚠️ ${message}</span>
      <button type="button" class="btn-close btn-close-sm" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  
  const errorBanner = document.getElementById('errorBanner');
  if (errorBanner) {
    errorBanner.parentNode.insertBefore(banner, errorBanner.nextSibling);
  }
  
  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (banner.parentNode) {
          banner.remove();
        }
      }, 300);
    }
  }, 3000);
}

// Enhanced addAssists function with animations
async function addAssists() {
  const input = document.getElementById('assistInput');
  if (!input) {
    showError('Input field not found');
    return;
  }
  
  const assistsToAdd = parseInt(input.value);
  
  if (isNaN(assistsToAdd) || assistsToAdd < 1) {
    showError('Please enter a valid number of assists');
    return;
  }

  // Always allow demo mode operation on Vercel
  if (!BASE_API_URL || window.location.hostname.includes('vercel.app') || errorCount >= MAX_ERROR_COUNT) {
    let braden = players.find(player => player.isBraden);
    
    // If Braden not found, load demo data first
    if (!braden) {
      console.log('Braden not found, loading demo data...');
      loadDemoData();
      // Try again after loading demo data
      setTimeout(() => {
        addAssists();
      }, 100);
      return;
    }
    
    braden.assists += assistsToAdd;
    players.sort((a, b) => b.assists - a.assists);
    renderPlayerMarkers();
    renderLeaderboard();
    updateProgressBar();
    animateAssistAddition(assistsToAdd);
    input.value = '';
    return;
  }

  try {
    isMutating = true;
    showLoading(true);
    const res = await fetch(`${BASE_API_URL}/players/${braden.id}/add-assists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assists_to_add: assistsToAdd,
        game_date: new Date().toISOString().split('T')[0]
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to add assists');

    lastAssistLogId = json.assistLogId || null;
    document.getElementById('undoButton').disabled = !lastAssistLogId;

    input.value = '';
    animateAssistAddition(assistsToAdd);
    
    // Refresh data after successful addition
    await forceRefreshPlayers();
  } catch (e) {
    console.error('Add assists failed:', e);
    showError('Failed to add assists. Please try again.');
    errorCount++;
  } finally {
    isMutating = false;
    showLoading(false);
  }
}

// Updated reduceAssists function
async function reduceAssists() {
  const input = document.getElementById('assistInput');
  if (!input) {
    showError('Input field not found');
    return;
  }
  
  const assistsToRemove = parseInt(input.value);
  
  if (isNaN(assistsToRemove) || assistsToRemove < 1) {
    showError('Please enter a valid number of assists to remove');
    return;
  }

  // Always allow demo mode operation on Vercel
  if (!BASE_API_URL || window.location.hostname.includes('vercel.app') || errorCount >= MAX_ERROR_COUNT) {
    let braden = players.find(player => player.isBraden);
    
    // If Braden not found, load demo data first
    if (!braden) {
      console.log('Braden not found, loading demo data...');
      loadDemoData();
      // Try again after loading demo data
      setTimeout(() => {
        reduceAssists();
      }, 100);
      return;
    }

    // Prevent negative assists (client-side validation)
    if (braden.assists - assistsToRemove < 0) {
      showError(`Cannot remove ${assistsToRemove} assists. Braden only has ${braden.assists} assists.`);
      return;
    }

    braden.assists -= assistsToRemove;
    players.sort((a, b) => b.assists - a.assists);
    renderPlayerMarkers();
    renderLeaderboard();
    updateProgressBar();
    animateAssistRemoval(assistsToRemove);
    input.value = '';
    return;
  }

  try {
    isMutating = true;
    showLoading(true);
    
    // Use the reduce-assists endpoint
    const res = await fetch(`${BASE_API_URL}/players/${braden.id}/reduce-assists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assists_to_remove: assistsToRemove
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${res.status}`);
    }
    
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to reduce assists');

    lastAssistLogId = json.assistLogId || null;
    document.getElementById('undoButton').disabled = !lastAssistLogId;

    input.value = '';
    animateAssistRemoval(assistsToRemove);
    
    // Refresh data after successful reduction
    await forceRefreshPlayers();
  } catch (e) {
    console.error('Reduce assists failed:', e);
    showError(e.message || 'Failed to reduce assists. Please try again.');
    errorCount++;
  } finally {
    isMutating = false;
    showLoading(false);
  }
}

// Undo the last assist update via API (delete last assist log)
async function undoLastUpdate() {
  if (!lastAssistLogId) return;
  
  try {
    isMutating = true;
    showLoading(true);
    const res = await fetch(`${BASE_API_URL}/assists/${lastAssistLogId}`, { method: 'DELETE' });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to undo');
    
    lastAssistLogId = null;
    document.getElementById('undoButton').disabled = true;
    
    // Show undo success message
    showSuccessMessage('Last update undone successfully!');
    
    // Refresh data after successful undo
    await forceRefreshPlayers();
  } catch (e) {
    console.error('Undo failed:', e);
    showError('Failed to undo. Please try again.');
  } finally {
    isMutating = false;
    showLoading(false);
  }
}

function showLoading(loading) {
  const skeleton = document.getElementById('leaderboardSkeleton');
  const list = document.getElementById('leaderboard');
  if (!skeleton || !list) return;
  
  if (loading) {
    skeleton.style.display = '';
    list.style.display = 'none';
  } else {
    skeleton.style.display = 'none';
    list.style.display = '';
  }
}

// Add input validation styling
document.getElementById('assistInput')?.addEventListener('input', function(e) {
  const value = parseInt(e.target.value);
  if (value > 0) {
    e.target.classList.remove('is-invalid');
    e.target.classList.add('is-valid');
  } else {
    e.target.classList.remove('is-valid');
    e.target.classList.add('is-invalid');
  }
});

// Enhanced input validation for better UX
document.getElementById('assistInput')?.addEventListener('blur', function(e) {
  const value = parseInt(e.target.value);
  if (isNaN(value) || value < 1) {
    e.target.classList.add('is-invalid');
    showError('Please enter a valid number of assists (1 or more)');
  } else {
    e.target.classList.remove('is-invalid');
    setError(null);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl+Enter or Cmd+Enter to add assists
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    addAssists();
  }
  
  // Escape to clear input
  if (e.key === 'Escape') {
    const input = document.getElementById('assistInput');
    if (input && document.activeElement === input) {
      input.value = '';
      input.classList.remove('is-valid', 'is-invalid');
      setError(null);
    }
  }
});

// Performance optimization: Throttle resize events
let resizeTimeout;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (players.length > 0) {
      renderPlayerMarkers();
    }
  }, 250);
});

// Export functions for global access (if needed)
window.addAssists = addAssists;
window.reduceAssists = reduceAssists;
window.undoLastUpdate = undoLastUpdate;
window.setError = setError;
window.highlightPlayer = highlightPlayer;