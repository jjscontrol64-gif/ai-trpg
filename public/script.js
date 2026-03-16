// ── 초기 게임 상태 ────────────────────────────────────────────
const DEFAULT_STATE = {
  player: {
    name: '여행자',
    hp: 100,
    maxHp: 100,
    inventory: [],
    gold: 0,
  },
  world: {
    location: '안개 낀 마을 어귀',
    chapter: 1,
    flags: {},
  },
  turn: 0,
};

// 현재 게임 상태와 대화 히스토리
let gameState = structuredClone(DEFAULT_STATE);
let history = [];  // Claude API messages 배열

// ── DOM 요소 참조 ─────────────────────────────────────────────
const narrativeArea   = document.getElementById('narrativeArea');
const actionInput     = document.getElementById('actionInput');
const sendBtn         = document.getElementById('sendBtn');
const loadingOverlay  = document.getElementById('loadingOverlay');
const errorMsg        = document.getElementById('errorMsg');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverMsg     = document.getElementById('gameOverMsg');

// ── 상태 패널 갱신 ────────────────────────────────────────────
function updateStatusPanel() {
  const { player, world } = gameState;

  document.getElementById('playerName').textContent  = player.name;
  document.getElementById('hpText').textContent      = `${player.hp} / ${player.maxHp}`;
  document.getElementById('locationText').textContent = world.location;
  document.getElementById('goldText').textContent    = player.gold;
  document.getElementById('chapterText').textContent = world.chapter;

  // HP 바 너비 및 색상
  const hpRatio = Math.max(0, player.hp / player.maxHp);
  const hpBar = document.getElementById('hpBar');
  hpBar.style.width = `${hpRatio * 100}%`;
  hpBar.className = 'hp-bar';
  if (hpRatio <= 0.25)      hpBar.classList.add('danger');
  else if (hpRatio <= 0.5)  hpBar.classList.add('warning');

  // 인벤토리
  const list = document.getElementById('inventoryList');
  if (player.inventory.length === 0) {
    list.innerHTML = '<li class="inventory-empty">소지품이 없습니다</li>';
  } else {
    list.innerHTML = player.inventory
      .map(item => `<li>${escapeHtml(item)}</li>`)
      .join('');
  }
}

// ── 내레이션 추가 ─────────────────────────────────────────────
function appendNarration(action, text) {
  // 플레이스홀더 제거
  const placeholder = narrativeArea.querySelector('.placeholder-text');
  if (placeholder) placeholder.remove();

  const entry = document.createElement('div');
  entry.className = 'narration-entry';
  entry.innerHTML = `
    <p class="narration-action">▶ ${escapeHtml(action)}</p>
    <p class="narration-text">${renderNarration(text)}</p>
  `;
  narrativeArea.appendChild(entry);

  // 최신 항목으로 스크롤
  narrativeArea.scrollTop = narrativeArea.scrollHeight;
}

// ── 게임 오버 처리 ────────────────────────────────────────────
function showGameOver(narration) {
  // 마지막 내레이션 먼저 갱신
  gameOverMsg.textContent = narration || '그대의 이야기는 여기서 막을 내리노라...';
  gameOverOverlay.style.display = 'flex';
}

// ── 게임 리셋 ─────────────────────────────────────────────────
function resetGame() {
  gameState = structuredClone(DEFAULT_STATE);
  history = [];

  narrativeArea.innerHTML = '<p class="placeholder-text">첫 행동을 입력하여 여정을 시작하시오...</p>';
  gameOverOverlay.style.display = 'none';
  actionInput.value = '';
  updateStatusPanel();
}

// ── 행동 전송 ─────────────────────────────────────────────────
async function sendAction() {
  const action = actionInput.value.trim();

  if (!action) {
    showError('행동을 입력하시오.');
    return;
  }

  hideError();
  setLoading(true);

  try {
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, gameState, history }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || '알 수 없는 오류가 발생하였습니다.');
      return;
    }

    const { narration, newState } = data;

    // 내레이션 출력
    appendNarration(action, narration);

    // 히스토리 누적 (맥락 유지)
    history.push({ role: 'user', content: action });
    history.push({ role: 'assistant', content: narration });

    // gameState 갱신 (history 필드는 서버가 관리하지 않으므로 제외)
    gameState = { ...newState };
    updateStatusPanel();

    // 게임 오버 확인
    if (newState.isGameOver || newState.player?.hp <= 0) {
      showGameOver(narration);
    }

    // 입력창 초기화
    actionInput.value = '';

  } catch (err) {
    showError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
  } finally {
    setLoading(false);
  }
}

// ── 유틸 ──────────────────────────────────────────────────────
function setLoading(active) {
  loadingOverlay.style.display = active ? 'flex' : 'none';
  sendBtn.disabled = active;
  actionInput.disabled = active;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  setTimeout(() => hideError(), 5000);
}

function hideError() {
  errorMsg.style.display = 'none';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 내레이션 전용: **bold** 및 줄바꿈을 HTML로 변환
function renderNarration(str) {
  return escapeHtml(str)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────
actionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAction();
  }
});

// ── 초기화 ────────────────────────────────────────────────────
updateStatusPanel();
