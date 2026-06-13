// ===== Get task ID from URL =====
const urlParams = new URLSearchParams(window.location.search);
const taskId = urlParams.get('task') || urlParams.get('taskId') || urlParams.get('task_id');

// ===== DOM Elements =====
const ball = document.getElementById('ball');
const ballShadow = document.getElementById('ballShadow');
const ballWrap = document.querySelector('.ball-wrap');
const keeper = document.getElementById('keeper');
const resultFlash = document.getElementById('resultFlash');
const shotsCounter = document.getElementById('shotsCounter');
const earnedAmountEl = document.getElementById('earnedAmount');
const perShotAmountEl = document.getElementById('perShotAmount');
const historyEl = document.getElementById('history');
const aimGrid = document.getElementById('aimGrid');
const claimBtn = document.getElementById('claimBtn');
const claimBtnText = document.getElementById('claimBtnText');
const statusMsg = document.getElementById('statusMsg');
const loadingOverlay = document.getElementById('loadingOverlay');
const successOverlay = document.getElementById('successOverlay');
const errorOverlay = document.getElementById('errorOverlay');
const successAmount = document.getElementById('successAmount');
const successClose = document.getElementById('successClose');
const errorTitle = document.getElementById('errorTitle');
const errorMsg = document.getElementById('errorMsg');

let taskData = null;
let shooting = false;

// Map shot direction -> keeper dive class
const keeperDiveMap = {
  'top-left': 'dive-left',
  'top-center': 'dive-up',
  'top-right': 'dive-right',
  'bottom-left': 'dive-left',
  'bottom-center': 'dive-center',
  'bottom-right': 'dive-right'
};

// ===== Init =====
async function init() {
  if (!taskId) {
    showError('Invalid Link', 'No task ID found. Please open this game from your bot.');
    return;
  }

  try {
    const res = await fetch(`/api/task/${taskId}`);
    const data = await res.json();

    if (!data.success) {
      showError('Task Error', data.message || 'Task not found.');
      return;
    }

    if (data.status === 'claimed') {
      showError('Already Claimed', 'This task reward has already been claimed.');
      return;
    }

    taskData = data;
    renderState();
    loadingOverlay.classList.add('hidden');

    if (data.status === 'completed') {
      setStatus('All shots complete. Claim your reward!');
    }
  } catch (err) {
    showError('Connection Error', 'Could not load the game. Check your connection.');
  }
}

// ===== Render current state =====
function renderState() {
  shotsCounter.textContent = `${taskData.shotsTaken} / ${taskData.shotsRequired}`;
  earnedAmountEl.textContent = taskData.earnedAmount.toFixed(6);
  perShotAmountEl.textContent = taskData.perShotReward.toFixed(6);

  // Render history
  historyEl.innerHTML = '';
  for (let i = 0; i < taskData.shotsRequired; i++) {
    const dot = document.createElement('div');
    dot.className = 'history-dot';
    if (i < taskData.shotResults.length) {
      const result = taskData.shotResults[i];
      dot.classList.add(result ? 'goal' : 'save');
      dot.textContent = result ? '✓' : '✕';
    } else {
      dot.textContent = i + 1;
    }
    historyEl.appendChild(dot);
  }

  const allDone = taskData.shotsTaken >= taskData.shotsRequired;
  setAimButtonsDisabled(allDone);
  claimBtn.disabled = !allDone;
  claimBtnText.textContent = allDone ? 'Claim Reward' : `Complete all shots (${taskData.shotsTaken}/${taskData.shotsRequired})`;
}

function setAimButtonsDisabled(disabled) {
  document.querySelectorAll('.aim-btn').forEach(btn => {
    btn.disabled = disabled || shooting;
  });
}

function setStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg' + (type ? ' ' + type : '');
}

function showError(title, msg) {
  loadingOverlay.classList.add('hidden');
  errorTitle.textContent = title;
  errorMsg.textContent = msg;
  errorOverlay.classList.remove('hidden');
}

// ===== Take shot =====
aimGrid.addEventListener('click', async (e) => {
  const btn = e.target.closest('.aim-btn');
  if (!btn || shooting) return;

  const direction = btn.dataset.dir;
  shooting = true;
  setAimButtonsDisabled(true);
  setStatus('');

  try {
    const res = await fetch(`/api/task/${taskId}/shot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction })
    });
    const data = await res.json();

    if (!data.success) {
      setStatus(data.message || 'Shot failed', 'error');
      shooting = false;
      setAimButtonsDisabled(false);
      return;
    }

    await playShotAnimation(direction, data.keeperZone, data.isGoal);

    // Update task data
    taskData.shotsTaken = data.shotsTaken;
    taskData.goalsScored = data.goalsScored;
    taskData.earnedAmount = data.earnedAmount;
    taskData.status = data.status;
    taskData.shotResults.push(data.isGoal);

    renderState();

    if (data.status === 'completed') {
      setStatus('All shots complete. Claim your reward!', 'success');
    }
  } catch (err) {
    setStatus('Connection error. Try again.', 'error');
  }

  shooting = false;
  setAimButtonsDisabled(taskData.shotsTaken >= taskData.shotsRequired);
});

// ===== Animation sequence =====
function playShotAnimation(direction, keeperZone, isGoal) {
  return new Promise(resolve => {
    // Reset ball position instantly
    ball.classList.remove(
      'shoot-top-left', 'shoot-top-center', 'shoot-top-right',
      'shoot-bottom-left', 'shoot-bottom-center', 'shoot-bottom-right'
    );
    ball.classList.add('reset');
    keeper.className = 'keeper';
    resultFlash.className = 'result-flash';

    // Force reflow
    void ball.offsetWidth;

    setTimeout(() => {
      ball.classList.remove('reset');
      ballWrap.classList.add('kicking');

      // Kick ball toward goal
      ball.classList.add(`shoot-${direction}`);

      // Keeper dives toward their guessed zone
      const diveClass = keeperDiveMap[keeperZone] || '';
      setTimeout(() => {
        if (diveClass) keeper.classList.add(diveClass);
      }, 80);

      // Show result after ball reaches goal
      setTimeout(() => {
        resultFlash.textContent = isGoal ? 'GOAL!' : 'SAVED!';
        resultFlash.classList.add(isGoal ? 'show-goal' : 'show-save');

        // Flash the zone
        const zoneEl = document.querySelector(`.zone[data-zone="${direction}"]`);
        if (zoneEl) {
          zoneEl.classList.add(isGoal ? 'flash-goal' : 'flash-save');
          setTimeout(() => zoneEl.classList.remove('flash-goal', 'flash-save'), 900);
        }
      }, 580);

      // Reset everything after animation completes
      setTimeout(() => {
        ballWrap.classList.remove('kicking');
        resolve();
      }, 1400);
    }, 50);
  });
}

// ===== Claim reward =====
claimBtn.addEventListener('click', async () => {
  if (claimBtn.disabled) return;

  claimBtn.disabled = true;
  claimBtnText.textContent = 'Claiming...';

  try {
    const res = await fetch(`/api/task/${taskId}/claim`, { method: 'POST' });
    const data = await res.json();

    if (!data.success) {
      setStatus(data.message || 'Claim failed', 'error');
      claimBtn.disabled = false;
      claimBtnText.textContent = 'Claim Reward';
      return;
    }

    successAmount.textContent = data.earnedAmount.toFixed(6);
    successOverlay.classList.remove('hidden');
  } catch (err) {
    setStatus('Connection error. Try again.', 'error');
    claimBtn.disabled = false;
    claimBtnText.textContent = 'Claim Reward';
  }
});

successClose.addEventListener('click', () => {
  // Try to close the webview (Telegram WebApp)
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.close();
  } else {
    successOverlay.classList.add('hidden');
    claimBtnText.textContent = 'Claimed';
  }
});

// ===== Telegram WebApp integration (optional) =====
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

init();
