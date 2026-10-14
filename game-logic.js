// ==================== GAME CONSTANTS ====================
const taglines = [
  'The third installment',
  'Back for more',
  'For the community',
  'For Ellerslie School',
  'For 17 News',
  'The Threequel'
];

let currentTaglineIndex = 0;
let taglineTimer = null;
let taglineRun = 0;

const rarityOptions = [
  { key: '17-news', name: '17 News', reward: 150, chance: 66.2, color: '#0f172a' },
  { key: '17-news-reborn', name: '17 News Reborn', reward: 300, chance: 20, color: '#38bdf8' },
  { key: 'daniel-poole', name: 'Daniel Poole', reward: 450, chance: 4, color: '#166534' },
  { key: 'dominik-procter', name: 'Dominik Procter', reward: 450, chance: 3, color: '#0d9488' },
  { key: 'gabe-muir', name: 'Gabe Muir', reward: 450, chance: 2, color: '#115e59' },
  { key: 'inesh-jayasinghe', name: 'Inesh Jayasinghe', reward: 550, chance: 1.5, color: '#7c3aed' },
  { key: 'leo-thacker', name: 'Leo Thacker', reward: 700, chance: 0.8, color: '#2dd4bf' },
  { key: 'sam-whitworth', name: 'Sam Whitworth', reward: 700, chance: 0.7, color: '#f97316' },
  { key: 'john-tan', name: 'John Tan', reward: 1050, chance: 0.6, color: '#f87171' },
  { key: 'rison-pandigama', name: 'Rison Pandigama', reward: 1250, chance: 0.4, color: '#c084fc' },
  { key: 'atticus-lok', name: 'Atticus Lok', reward: 1750, chance: 0.3, color: '#ddd6fe' },
  { key: 'baxter-walter', name: 'Baxter Walter', reward: 2250, chance: 0.2, color: '#facc15' }
];

const globalOptions = [
  { key: 'mr-fermanski', name: 'Mr Fernanski', reward: 3333, chance: 0.15, color: '#f59e0b', glowColor: '#ef4444', isGlobal: true },
  { key: 'ellerslie-schoolcast', name: 'Ellerslie Schoolcast', reward: 5000, chance: 0.1, color: '#1e3a8a', glowColor: '#38bdf8', isGlobal: true },
  { key: 'the-ceo', name: 'The CEO', reward: 7000, chance: 0.05, color: '#000000', glowColor: '#f8fafc', isGlobal: true }
];

const POTIONS = {
  luck: { name: 'Luck Potion I', cost: 5000, multiplier: 2, duration: 120, effect: 'luck' },
  speed: { name: 'Speed Potion I', cost: 3500, multiplier: 2, duration: 90, effect: 'speed' }
};

const ROTATING_SHOP_ITEMS = [
  { name: 'Portal Fragment', cost: 15000, rarity: 'epic' },
  { name: 'Clover Leaf', cost: 500, rarity: 'common' },
  { name: 'Sea Essence', cost: 300000, rarity: 'legendary' }
];

const TITLES = [
  { id: 'owner', name: 'Owner', color: '#fbbf24', requirement: 'admin', description: 'Administrator' },
  { id: 'veteran', name: 'Veteran', color: '#38bdf8', requirement: 'code:THETHREEQUEL', description: 'Redeem THETHREEQUEL' },
  { id: 'millionaire', name: 'Millionaire', color: '#4ade80', requirement: 'coins:1000000', description: 'Reach 1,000,000 coins' },
  { id: 'portalmancer', name: 'Portalmancer', color: '#a78bfa', requirement: 'portal', description: 'Open the portal gateway' },
  { id: 'signal-cartographer', name: 'Signal Cartographer', color: '#22d3ee', requirement: 'spins:250', description: 'Complete 250 rolls' },
  { id: 'endless-frequency', name: 'The Endless Frequency', color: '#60a5fa', requirement: 'spins:5000', description: 'Complete 5,000 rolls' },
  { id: 'collector', name: 'Rarity Collector', color: '#34d399', requirement: 'drops:10', description: 'Collect 10 rarity drops' },
  { id: 'global-headliner', name: 'Global Headliner', color: '#fb7185', requirement: 'global:1', description: 'Find a global rarity' },
  { id: 'tidekeeper', name: 'Tidekeeper', color: '#2dd4bf', requirement: 'sea-realm', description: 'Permanently unlock Sea Realm' }
];

const CODE_REWARDS = {
  'THETHREEQUEL': { title: 'veteran', coins: 0 }
};

// ==================== GAME STATE ====================
let currentUser = null;
let isEnteringDimension = false;
let meteorShowerLayer = null;
let eventCountdownTimer = null;
let gameState = {
  activeEffects: {},
  currentDimension: null,
  rotatingShopIndex: 0,
  shopLastRestock: Date.now(),
  deathSeaUnlocked: false,
  portalFragments: 0,
  seaEssence: 0,
  portalUnlocked: false,
  seaRealmUnlocked: false,
  userTitles: [],
  activeTitle: null,
  potionInventory: { luck: 0, speed: 0 },
  itemInventory: { fragments: 0, clovers: 0, essence: 0 }
};

// ==================== TAGLINE CYCLING ====================
function typeText(text, element, speed = 45) {
  clearTimeout(taglineTimer);
  const run = ++taglineRun;
  let index = 0;
  element.classList.add('typing');
  element.textContent = '';

  function typeNextCharacter() {
    if (run !== taglineRun) return;
    if (index < text.length) {
      element.textContent += text.charAt(index);
      index += 1;
      taglineTimer = setTimeout(typeNextCharacter, speed);
      return;
    }

    element.classList.remove('typing');
    taglineTimer = setTimeout(nextTagline, 2200);
  }

  typeNextCharacter();
}

function nextTagline() {
  currentTaglineIndex = (currentTaglineIndex + 1) % taglines.length;
  const taglineElement = document.getElementById('tagline');
  if (taglineElement) {
    typeText(taglines[currentTaglineIndex], taglineElement);
  }
}

function initTagline() {
  currentTaglineIndex = 0;
  const taglineElement = document.getElementById('tagline');
  if (taglineElement) {
    typeText(taglines[currentTaglineIndex], taglineElement);
  }
}

// ==================== UTILITY FUNCTIONS ====================
function formatCoins(amount) {
  return Number(amount).toLocaleString();
}

function showPopup(message, type = 'success') {
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.textContent = message;
  if (type === 'error') {
    popup.style.background = 'rgba(239, 68, 68, 0.95)';
  } else if (/^(#|rgb|hsl)/i.test(type)) {
    popup.style.background = type;
  } else {
    popup.style.background = 'rgba(14, 165, 233, 0.95)';
  }
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
}

function showRewardPopup(message) {
  const reward = document.createElement('div');
  reward.className = 'reward-pop';
  reward.textContent = message;
  document.body.appendChild(reward);
  setTimeout(() => reward.remove(), 1100);
}

function setLoading(button, isLoading, text = 'Loading...') {
  if (!button) return;
  if (isLoading && !button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? text : button.dataset.defaultText || button.textContent;
}

async function handleAPI(url, options = {}) {
  try {
    const body = options.body !== undefined
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : undefined;

    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.banned) showBanScreen(data.banReason);
      if (data.shutdown) setShutdownScreen(true, data.error);
      return {
        success: false,
        error: data.error || data.message || `Request failed (${response.status})`,
        status: response.status,
        banned: data.banned || false,
        banReason: data.banReason || '',
        shutdown: data.shutdown || false
      };
    }
    return data;
  } catch (error) {
    console.error('API error:', error);
    return { success: false, error: 'Unable to contact server' };
  }
}

// ==================== POTION SYSTEM ====================
function applyPotion(potionType) {
  const potion = POTIONS[potionType];
  if (!potion) return;

  gameState.activeEffects[potionType] = {
    multiplier: potion.multiplier,
    duration: potion.duration,
    endTime: Date.now() + potion.duration * 1000,
    started: Date.now()
  };

  updatePotionDisplay();
  showPopup(`${potion.name} activated! +${potion.multiplier}x ${potion.effect} for ${potion.duration}s`);
}

function updatePotionDisplay() {
  const container = document.getElementById('potion-effects');
  if (!container) return;

  container.innerHTML = '';
  Object.entries(gameState.activeEffects).forEach(([type, effect]) => {
    const remaining = Math.max(0, Math.ceil((effect.endTime - Date.now()) / 1000));
    if (remaining <= 0) {
      delete gameState.activeEffects[type];
      return;
    }
    const potion = POTIONS[type];
    const div = document.createElement('div');
    div.innerHTML = `✨ ${potion.name}: ${remaining}s`;
    container.appendChild(div);
  });
}

function getPotionMultiplier(potionType) {
  const effect = gameState.activeEffects[potionType];
  return effect && Date.now() < effect.endTime ? Math.max(1, Number(effect.multiplier) || 1) : 1;
}

// ==================== SHOP SYSTEM ====================
function getRotatingShopItems() {
  const now = Date.now();
  if (now - gameState.shopLastRestock > 600000) { // 10 minutes
    gameState.shopLastRestock = now;
    gameState.rotatingShopIndex = Math.floor(Math.random() * ROTATING_SHOP_ITEMS.length);
  }
  return [ROTATING_SHOP_ITEMS[gameState.rotatingShopIndex]];
}

function updateShopTimer() {
  const timer = document.getElementById('shop-timer');
  if (!timer) return;
  const elapsed = Math.floor((Date.now() - gameState.shopLastRestock) / 1000);
  const remaining = Math.max(0, 600 - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function renderShop() {
  updateShopTimer();
  
  const rotatingDiv = document.getElementById('rotating-items');
  if (rotatingDiv) {
    rotatingDiv.innerHTML = '';
    getRotatingShopItems().forEach(item => {
      const card = document.createElement('div');
      card.className = 'shop-item';
      const emoji = item.name.includes('Fragment') ? '🔮' : item.name.includes('Clover') ? '🍀' : '💧';
      card.innerHTML = `
        <h4 class="shop-item-name">${emoji} ${item.name}</h4>
        <p class="shop-item-price">🪙 ${formatCoins(item.cost)} coins</p>
        <button class="potion-buy-btn shop-item-buy">Purchase</button>
      `;
      card.querySelector('.shop-item-buy')?.addEventListener('click', () => buyShopItem(item.name));
      rotatingDiv.appendChild(card);
    });
  }

  const potionsDiv = document.getElementById('potions-list');
  if (potionsDiv) {
    potionsDiv.innerHTML = '';
    Object.entries(POTIONS).forEach(([key, potion]) => {
      const card = document.createElement('div');
      card.className = 'potion-card';
      const emoji = key === 'luck' ? '🍀' : '⚡';
      card.innerHTML = `
        <h4>${emoji} ${potion.name}</h4>
        <p>${potion.multiplier}x ${potion.effect} • ${potion.duration}s duration</p>
        <div class="potion-stats">
          <span>⚡ +${potion.multiplier}x ${potion.effect}</span>
          <span>⏱️ ${potion.duration}s active</span>
        </div>
        <div class="potion-cost">🪙 ${formatCoins(potion.cost)} coins</div>
        <button class="potion-buy-btn potion-buy">Buy Now</button>
      `;
      card.querySelector('.potion-buy')?.addEventListener('click', () => buyPotion(key));
      potionsDiv.appendChild(card);
    });
  }
}

function buyPotion(potionType) {
  if (!currentUser || currentUser.coins < POTIONS[potionType].cost) {
    showPopup('Not enough coins!', 'error');
    return;
  }

  handleAPI('/api/buy-potion', { method: 'POST', body: { potionType } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.potionInventory = currentUser.potions || { luck: 0, speed: 0 };
      updateUI(currentUser);
      showPopup(`Purchased ${POTIONS[potionType].name}! Added to inventory.`);
    } else {
      showPopup(response.error || 'Purchase failed', 'error');
    }
  });
}

function usePotion(potionType) {
  if (!currentUser || (currentUser.potions?.[potionType] || 0) <= 0) {
    showPopup('No potion available to use.', 'error');
    return;
  }

  handleAPI('/api/use-potion', { method: 'POST', body: { potionType } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.potionInventory = currentUser.potions || { luck: 0, speed: 0 };
      updateUI(currentUser);
      applyPotion(potionType);
    } else {
      showPopup(response.error || 'Unable to use potion', 'error');
    }
  });
}

function buyShopItem(itemName) {
  const item = ROTATING_SHOP_ITEMS.find(i => i.name === itemName);
  if (!item || !currentUser || currentUser.coins < item.cost) {
    showPopup('Not enough coins!', 'error');
    return;
  }
  
  // Call backend to buy item
  handleAPI('/api/buy-shop-item', { method: 'POST', body: { itemName } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.itemInventory = currentUser.items || {};
      updateUI(currentUser);
      renderShop();
      showPopup(`Purchased ${itemName}!`);
    } else {
      showPopup(response.error || 'Purchase failed', 'error');
    }
  });
}

// ==================== TITLE SYSTEM ====================
function renderTitles() {
  const listDiv = document.getElementById('titles-list');
  const availDiv = document.getElementById('titles-available');

  if (listDiv) {
    listDiv.innerHTML = gameState.userTitles.length ? '' : '<p style="color: rgba(241,245,249,0.7); text-align: center; padding: 20px;">No titles yet. Complete requirements to unlock.</p>';
    gameState.userTitles.forEach(titleId => {
      const title = TITLES.find(t => t.id === titleId);
      if (!title) return;
      const card = document.createElement('div');
      card.className = 'title-card active';
      card.style.borderColor = title.color;
      card.style.animation = 'titleEntry 0.5s ease-out';
      card.innerHTML = `
        <div class="title-name" style="color: ${title.color}; font-size: 1.1rem;">${title.name}</div>
        <div class="title-status" style="font-size: 0.85rem;">Unlocked</div>
        ${gameState.activeTitle === titleId ? '<button class="btn" style="font-size:0.8rem; padding:6px;" disabled>(Active)</button>' : '<button class="btn title-equip" style="font-size:0.8rem; padding:6px;">Equip</button>'}
      `;
      card.querySelector('.title-equip')?.addEventListener('click', () => setActiveTitle(titleId));
      listDiv.appendChild(card);
    });
  }

  if (availDiv) {
    availDiv.innerHTML = '';
    TITLES.forEach(title => {
      if (gameState.userTitles.includes(title.id)) return;
      const card = document.createElement('div');
      card.className = 'title-card';
      card.style.borderColor = title.color;
      card.style.opacity = '0.6';
      card.innerHTML = `
        <div class="title-name" style="color: ${title.color};">${title.name}</div>
        <div class="title-status" style="font-size: 0.85rem;">${title.description}</div>
      `;
      availDiv.appendChild(card);
    });
  }
}

async function setActiveTitle(titleId) {
  const title = TITLES.find(t => t.id === titleId);
  if (!title) {
    showPopup('Unable to activate title.', 'error');
    return;
  }
  const response = await handleAPI('/api/set-active-title', { method: 'POST', body: { titleId } });
  if (response.success && response.user) {
    currentUser = response.user;
    gameState.activeTitle = response.user.active_title;
    renderTitles();
    updateUI(currentUser);
    showPopup(`Active title set to ${title.name}`);
  } else {
    showPopup(response.error || 'Unable to set active title', 'error');
  }
}

function checkTitleUnlocks(user) {
  if (!user) return;
  const existing = new Set(gameState.userTitles);
  if (user.is_admin) {
    existing.add('owner');
  }
  if (user.coins >= 1000000) {
    existing.add('millionaire');
  }
  if (user.portal_unlocked) {
    existing.add('portalmancer');
  }
  const rarities = user.inventory?.rarities || {};
  const rarityTotal = Object.values(rarities).reduce((sum, count) => sum + (Number(count) || 0), 0);
  if ((Number(user.spins) || 0) >= 250) existing.add('signal-cartographer');
  if ((Number(user.spins) || 0) >= 5000) existing.add('endless-frequency');
  if (rarityTotal >= 10) existing.add('collector');
  if (['mr-fermanski', 'ellerslie-schoolcast', 'the-ceo'].some(key => Number(rarities[key]) > 0)) existing.add('global-headliner');
  if (user.sea_realm_unlocked) existing.add('tidekeeper');
  gameState.userTitles = Array.from(existing);
}

// ==================== PORTAL SYSTEM ====================
function setupPortalUI() {
  const lockBtn = document.getElementById('portal-lock');
  if (lockBtn && !lockBtn.dataset.bound) {
    lockBtn.addEventListener('click', event => {
      event.stopPropagation();
      tryUnlockPortal();
    });
    lockBtn.addEventListener('keydown', event => event.stopPropagation());
    lockBtn.dataset.bound = 'true';
  }

  const portalBtn = document.querySelector('.portal-base');
  if (portalBtn && !portalBtn.dataset.bound) {
    portalBtn.addEventListener('click', showDimensions);
    portalBtn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showDimensions();
      }
    });
    portalBtn.dataset.bound = 'true';
  }

  const unlockBtn = document.getElementById('unlock-portal-btn');
  if (unlockBtn && !unlockBtn.dataset.bound) {
    unlockBtn.addEventListener('click', tryUnlockPortal);
    unlockBtn.dataset.bound = 'true';
  }

  const realmAction = document.getElementById('sea-realm-action');
  if (realmAction && !realmAction.dataset.bound) {
    realmAction.addEventListener('click', enterOrUnlockSeaRealm);
    realmAction.dataset.bound = 'true';
  }

  const realmClose = document.getElementById('close-realm-selector');
  if (realmClose && !realmClose.dataset.bound) {
    realmClose.addEventListener('click', closeRealmSelector);
    realmClose.dataset.bound = 'true';
  }

  const realmSelector = document.getElementById('realm-selector');
  if (realmSelector && !realmSelector.dataset.escapeBound) {
    realmSelector.addEventListener('click', event => {
      if (event.target === realmSelector) closeRealmSelector();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !realmSelector.classList.contains('hidden')) closeRealmSelector();
    });
    realmSelector.dataset.escapeBound = 'true';
  }

  const redeemBtn = document.getElementById('redeem-btn');
  if (redeemBtn && !redeemBtn.dataset.bound) {
    redeemBtn.addEventListener('click', redeemCode);
    redeemBtn.dataset.bound = 'true';
  }
}

function tryUnlockPortal() {
  const fragments = gameState.itemInventory.fragments || 0;
  if (fragments < 10) {
    showPopup(`Need ${10 - fragments} more Portal Fragments`, 'error');
    return;
  }

  handleAPI('/api/unlock-portal', { method: 'POST' }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.itemInventory = currentUser.items || {};
      gameState.userTitles = currentUser.titles || [];
      gameState.portalUnlocked = true;
      updatePortalUI();

      // Screen fade effect
      const fade = document.createElement('div');
      fade.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:10000;opacity:0;transition:opacity 2s';
      document.body.appendChild(fade);
      setTimeout(() => fade.style.opacity = '1', 100);
      setTimeout(() => fade.style.opacity = '0', 2100);
      setTimeout(() => fade.remove(), 4100);

      showPopup('Portal Unlocked! Explore the Deep Sea...');
    } else {
      showPopup(response.error || 'Failed to unlock portal', 'error');
    }
  });
}

async function showDimensions() {
  if (!gameState.portalUnlocked) {
    showPopup('Portal is locked. Get 10 Portal Fragments!', 'error');
    return;
  }
  renderRealmSelector();
  document.getElementById('realm-selector')?.classList.remove('hidden');
}

function closeRealmSelector() {
  document.getElementById('realm-selector')?.classList.add('hidden');
}

function renderRealmSelector() {
  const action = document.getElementById('sea-realm-action');
  const status = document.getElementById('sea-realm-status');
  if (!action || !status) return;
  const unlocked = gameState.seaRealmUnlocked;
  const essence = Number(gameState.itemInventory.essence) || 0;
  action.textContent = unlocked ? 'ENTER REALM' : 'UNLOCK & ENTER · 1 ESSENCE';
  action.disabled = !unlocked && essence < 1;
  status.textContent = unlocked ? 'Permanently unlocked · entry is free' : `${essence} Sea Essence available · unlock costs 1`;
}

async function enterOrUnlockSeaRealm() {
  if (isEnteringDimension) return;
  if (!gameState.seaRealmUnlocked && (Number(gameState.itemInventory.essence) || 0) < 1) {
    showPopup('1 Sea Essence is required to permanently unlock this realm.', 'error');
    return;
  }

  const action = document.getElementById('sea-realm-action');
  isEnteringDimension = true;
  if (action) {
    action.disabled = true;
    action.textContent = gameState.seaRealmUnlocked ? 'ENTERING...' : 'UNLOCKING...';
  }
  try {
    if (!gameState.seaRealmUnlocked) {
      const unlock = await handleAPI('/api/realms/sea/unlock', { method: 'POST' });
      if (!unlock.success || !unlock.user) throw new Error(unlock.error || 'Unable to unlock Sea Realm.');
      currentUser = unlock.user;
      updateUI(currentUser);
    }

    const entry = await handleAPI('/api/enter-dimension', { method: 'POST', body: { dimension: 'deep-sea' } });
    if (!entry.success || !entry.user) throw new Error(entry.error || 'Unable to enter Sea Realm.');
    currentUser = entry.user;
    updateUI(currentUser);
    closeRealmSelector();
    enterDeepSea();
  } catch (error) {
    showPopup(error.message, 'error');
    renderRealmSelector();
  } finally {
    isEnteringDimension = false;
    renderRealmSelector();
  }
}

function enterDeepSea() {
  document.getElementById('game-page').classList.add('hidden');
  const dsDiv = document.getElementById('deep-sea-dimension');
  dsDiv.classList.remove('hidden');
  gameState.currentDimension = 'deep-sea';

  // Generate bubbles
  const bubbleContainer = document.querySelector('.bubbles');
  bubbleContainer.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.setProperty('--bubble-size', `${6 + Math.random() * 24}px`);
    bubble.style.animationDuration = (Math.random() * 6) + 's';
    bubble.style.animationDelay = Math.random() * 2 + 's';
    bubbleContainer.appendChild(bubble);
  }

  // Setup Deep Sea roll
  const deepSeaRollButton = document.getElementById('ds-roll-btn');
  if (deepSeaRollButton && !deepSeaRollButton.dataset.bound) {
    deepSeaRollButton.addEventListener('click', rollInDeepSea);
    deepSeaRollButton.dataset.bound = 'true';
  }

  showPopup('Welcome to the Deep Sea! 🌊 (2x Luck Boost Active)');
}

async function rollInDeepSea() {
  const rollBtn = document.getElementById('ds-roll-btn');
  const rollDisplay = document.getElementById('ds-roll-display');
  const rewardDisplay = document.getElementById('ds-reward-display');
  if (!rollBtn || !rollDisplay || !rewardDisplay) return;

  setLoading(rollBtn, true, 'DIVING...');
  rollDisplay.textContent = 'Reading the current...';

  const response = await handleAPI('/api/spin', { method: 'POST', body: { dimension: 'deep-sea' } });
  if (response.success && response.result && response.user) await waitForRollReveal();
  setLoading(rollBtn, false);

  if (!response.success || !response.result || !response.user) {
    rollDisplay.textContent = '❌ Dive Failed';
    showPopup(response.error || 'Deep Sea roll failed', 'error');
    return;
  }

  const result = response.result;
  const multiplierDisplay = result.multiplier > 1 ? ` · ${result.multiplier}x coins` : '';
  const luckDisplay = result.luckMultiplier > 1 ? ` · ${result.luckMultiplier}x luck` : '';
  const readableColor = ['#0f172a', '#000000', '#1e3a8a'].includes((result.color || '').toLowerCase()) ? (result.glowColor || '#93c5fd') : result.color;
  rollDisplay.style.color = readableColor || '#f8fafc';
  rollDisplay.style.textShadow = `0 0 20px ${result.glowColor || result.color || '#38bdf8'}`;
  rollDisplay.classList.toggle('global-rarity-reveal', Boolean(result.isGlobal));
  if (result.isGlobal) rollDisplay.style.setProperty('--roll-glow', result.glowColor || result.color);
  else rollDisplay.style.removeProperty('--roll-glow');
  rollDisplay.textContent = `${result.name}${multiplierDisplay}${luckDisplay}`;
  rewardDisplay.textContent = `🪙 Reward: ${formatCoins(result.reward)} coins`;
  currentUser = response.user;
  updateUI(currentUser);
  showRewardPopup(`🪙 +${formatCoins(result.reward)} coins!`);
}

function exitDeepSea() {
  document.getElementById('deep-sea-dimension').classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  gameState.currentDimension = null;
}

// ==================== CODE REDEMPTION ====================
function redeemCode() {
  const input = document.getElementById('code-input');
  const code = input.value.trim().toUpperCase();

  if (!code) {
    showPopup('Enter a code!', 'error');
    return;
  }

  // Call backend to redeem code
  handleAPI('/api/redeem-code', { method: 'POST', body: { code } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.userTitles = currentUser.titles || [];
      const titleName = TITLES.find(t => t.id === response.title)?.name || 'Unknown';
      showPopup(`Code redeemed! Title unlocked: ${titleName}`);
      input.value = '';
      renderTitles();
      updateUI(currentUser);
    } else {
      showPopup(response.error || 'Invalid code', 'error');
      input.value = '';
    }
  });
}

// ==================== INVENTORY RENDERING ====================
function renderInventory(user) {
  // Rarities sub-tab
  const rarGrid = document.getElementById('inv-rarities-grid');
  if (rarGrid) {
    rarGrid.innerHTML = '';
    const rarities = user.inventory?.rarities || {};
    const hasItems = Object.keys(rarities).length > 0;
    if (!hasItems) {
      rarGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center; padding: 20px;">🎲 No rare items yet. Roll to collect!</div>';
    } else {
      Object.entries(rarities).forEach(([key, count]) => {
        const rarity = [...rarityOptions, ...globalOptions].find(r => r.key === key);
        if (!rarity) return;
        const card = document.createElement('div');
        const rarityColor = ['#0f172a', '#000000', '#1e3a8a'].includes(rarity.color.toLowerCase()) ? '#93c5fd' : rarity.color;
        card.className = `inventory-item rarity-card${rarity.isGlobal ? ' global-rarity-card' : ''}`;
        card.style.setProperty('--rarity-color', rarityColor);
        if (rarity.isGlobal) card.style.setProperty('--rarity-glow', rarity.glowColor || rarity.color);
        card.innerHTML = `
          <div class="rarity-card-head">
            <h4>${escapeHtml(rarity.name)}</h4>
            <span class="rarity-count">x${Number(count) || 0}</span>
          </div>
          <span class="rarity-reward">🪙 ${formatCoins(rarity.reward)} per drop</span>
        `;
        rarGrid.appendChild(card);
      });
    }
  }

  // Potions sub-tab
  const potGrid = document.getElementById('inv-potions-grid');
  if (potGrid) {
    potGrid.innerHTML = '';
    const potions = currentUser?.potions || gameState.potionInventory;
    const hasPotions = (potions.luck || 0) > 0 || (potions.speed || 0) > 0;
    if (!hasPotions) {
      potGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center; padding: 20px;">🧪 No potions. Buy some in the shop!</div>';
    } else {
      Object.entries({ luck: 'Luck Potion I', speed: 'Speed Potion I' }).forEach(([key, name]) => {
        const count = potions[key] || 0;
        if (count <= 0) return;
        const emoji = key === 'luck' ? '🍀' : '⚡';
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.innerHTML = `
          <div>
            <h4>${emoji} ${name}</h4>
            <span>x${count} available</span>
          </div>
          <button class="btn potion-use" style="padding: 8px 12px; font-size: 0.85rem;">Use Now</button>
        `;
        card.querySelector('.potion-use')?.addEventListener('click', () => usePotion(key));
        potGrid.appendChild(card);
      });
    }
  }

  // Items sub-tab
  const itemGrid = document.getElementById('inv-items-grid');
  if (itemGrid) {
    itemGrid.innerHTML = '';
    const items = [
      { name: 'Portal Fragments', count: gameState.itemInventory.fragments || 0, emoji: '🔮' },
      { name: 'Clover Leaves', count: gameState.itemInventory.clovers || 0, emoji: '🍀' },
      { name: 'Sea Essence', count: gameState.itemInventory.essence || 0, emoji: '💧' }
    ];
    items.forEach(item => {
      if (item.count > 0) {
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.innerHTML = `<div><h4>${item.emoji} ${item.name}</h4><span>${item.count}x available</span></div>`;
        itemGrid.appendChild(card);
      }
    });
    if (items.every(i => i.count === 0)) {
      itemGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center; padding: 20px;">🛍️ No items yet. Purchase from the shop!</div>';
    }
  }
}

function renderRarityCatalog() {
  const list = document.getElementById('rarity-catalog-list');
  if (!list) return;
  list.innerHTML = '';

  [...rarityOptions, ...globalOptions]
    .sort((left, right) => left.chance - right.chance)
    .forEach((rarity, index) => {
      const row = document.createElement('div');
      const rarityColor = ['#0f172a', '#000000', '#1e3a8a'].includes(rarity.color.toLowerCase()) ? '#93c5fd' : rarity.color;
      row.className = `rarity-catalog-row${rarity.isGlobal ? ' global-catalog-row' : ''}`;
      row.style.setProperty('--rarity-color', rarityColor);
      if (rarity.isGlobal) row.style.setProperty('--rarity-glow', rarity.glowColor || rarity.color);
      row.innerHTML = `<span class="rarity-rank">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(rarity.name)}</strong><span class="rarity-catalog-rate">${rarity.chance}%</span>`;
      list.appendChild(row);
    });
}

// ==================== UI UPDATES ====================
function updateUI(user) {
  currentUser = user;
  if (user.is_admin) setShutdownScreen(false);
  
  // Load game state from user
  gameState.itemInventory = user.items || { fragments: 0, clovers: 0, essence: 0 };
  gameState.potionInventory = user.potions || { luck: 0, speed: 0 };
  gameState.userTitles = user.titles || [];
  gameState.activeTitle = user.active_title || null;
  gameState.activeEffects = user.active_effects || {};
  gameState.portalUnlocked = user.portal_unlocked || false;
  gameState.seaRealmUnlocked = user.sea_realm_unlocked || false;
  
  document.getElementById('game-username').textContent = user.username;
  document.getElementById('game-coins').textContent = `🪙 ${formatCoins(user.coins)} coins`;
  const totalRolls = document.getElementById('settings-total-rolls');
  if (totalRolls) totalRolls.textContent = formatCoins(user.spins || 0);

  // Show admin button if user is admin
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    if (user.is_admin) {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  }

  document.getElementById('reward-display').textContent = `🪙 Reward: 0 coins`;

  checkTitleUnlocks(user);
  renderTitles();
  renderInventory(user);
  renderRarityCatalog();
  renderShop();
  updatePortalUI();
  updatePotionDisplay();
  renderRealmSelector();
}

function updatePortalUI() {
  const portal = document.getElementById('portal-container');
  const lock = document.getElementById('portal-lock');
  const unlockBtn = document.getElementById('unlock-portal-btn');
  const status = document.getElementById('portal-status');
  const fragmentsText = document.getElementById('portal-fragments-needed');

  const fragments = gameState.itemInventory.fragments || 0;
  if (portal) portal.classList.toggle('portal-open', gameState.portalUnlocked);
  if (gameState.portalUnlocked) {
    if (lock) lock.style.display = 'none';
    if (unlockBtn) unlockBtn.style.display = 'none';
    if (status) status.textContent = 'Gateway Online';
    if (fragmentsText) fragmentsText.textContent = gameState.seaRealmUnlocked
      ? 'Sea Realm unlocked permanently · two destinations coming soon.'
      : 'Choose a realm · Sea Realm unlock costs 1 Essence once.';
  } else {
    if (lock) lock.style.display = fragments < 10 ? 'block' : 'block';
    if (unlockBtn) unlockBtn.style.display = fragments >= 10 ? 'inline-flex' : 'none';
    if (status) status.textContent = fragments >= 10 ? 'Ready to unlock' : 'Locked';
    if (fragmentsText) fragmentsText.textContent = `Requires: 10 Portal Fragments (${fragments}/10)`;
  }
}

// ==================== CHAT SYSTEM ====================
function addChatMessage(username, message, timestamp, isSystem = false, title = null, titleColor = '#7dd3fc', isGlobalDrop = false, announceGlobalDrop = false, isAnnouncement = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const msgEl = document.createElement('div');
  msgEl.className = isAnnouncement ? 'chat-message admin-announcement-message' : isSystem ? 'chat-message system-message' : `chat-message${isGlobalDrop ? ' global-drop-message' : ''}`;
  msgEl.dataset.messageId = timestamp;
  if (isGlobalDrop) msgEl.style.setProperty('--drop-glow', titleColor || '#38bdf8');
  
  const time = new Date(timestamp).toLocaleTimeString();
  
  if (isSystem) {
    msgEl.innerHTML = `
      <span style="font-weight: bold; color: #FF0000;">⚡ ${escapeHtml(message)}</span>
      <br><small style="opacity: 0.7;">${time}</small>
    `;
  } else {
    const titleDefinition = TITLES.find(titleOption => titleOption.id === title);
    let displayTitle = titleDefinition?.name || title;
    let displayColor = titleDefinition?.color || (/^#[0-9a-f]{6}$/i.test(titleColor || '') ? titleColor : '#7dd3fc');
    let textShadow = `0 0 8px ${displayColor}`;
    if (title === 'The CEO' || displayColor.toLowerCase() === '#000000') {
      displayColor = '#ffffff';
      textShadow = '0 0 16px rgba(255, 255, 255, 0.85)';
    }
    const titleLabel = displayTitle ? `<span class="chat-title-badge" style="--title-color:${displayColor}; --title-glow:${textShadow};">${escapeHtml(displayTitle)}</span>` : '';
    msgEl.innerHTML = `
      ${isAnnouncement ? '<span class="global-drop-kicker">ADMIN EVENT</span>' : ''}
      ${isGlobalDrop ? '<span class="global-drop-kicker">GLOBAL DROP</span>' : ''}
      <span class="username" style="font-weight: bold;">${titleLabel}${escapeHtml(username)}:</span>
      <span>${escapeHtml(message)}</span>
      <br><small style="opacity: 0.7;">${time}</small>
    `;
  }
  
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (isGlobalDrop && announceGlobalDrop) showGlobalDropBanner(username, title, message, titleColor);
}

function showAdminAnnouncementBanner(announcement) {
  if (!announcement?.title || !announcement?.content) return;
  document.querySelector('.admin-announcement-banner')?.remove();
  const banner = document.createElement('aside');
  banner.className = 'admin-announcement-banner';
  banner.setAttribute('role', 'alert');
  const label = document.createElement('span');
  label.className = 'admin-announcement-label';
  label.textContent = 'ADMIN EVENT';
  const copy = document.createElement('div');
  copy.className = 'admin-announcement-copy';
  const title = document.createElement('strong');
  title.textContent = announcement.title;
  const content = document.createElement('p');
  content.textContent = announcement.content;
  copy.append(title, content);
  const close = document.createElement('button');
  close.className = 'admin-announcement-dismiss';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss admin announcement');
  close.textContent = '×';
  close.addEventListener('click', () => banner.remove());
  banner.append(label, copy, close);
  document.body.appendChild(banner);
  const globalBanner = document.querySelector('.global-drop-banner');
  if (globalBanner) globalBanner.style.top = `${banner.offsetHeight + 12}px`;
  setTimeout(() => banner.remove(), 15000);
}

function showBanScreen(reason = '') {
  const screen = document.getElementById('ban-screen');
  const details = document.getElementById('ban-screen-reason');
  if (details) details.textContent = reason || 'Access to this game has been restricted.';
  screen?.classList.remove('hidden');
}

function setShutdownScreen(active, message = 'Update or Fix in progress please wait') {
  const screen = document.getElementById('shutdown-screen');
  const title = document.getElementById('shutdown-screen-title');
  if (title && message) title.textContent = message;
  screen?.classList.toggle('hidden', !active || Boolean(currentUser?.is_admin));
}

function showGlobalDropBanner(username, rarityName, message, rarityColor) {
  document.querySelector('.global-drop-banner')?.remove();
  const banner = document.createElement('aside');
  banner.className = 'global-drop-banner';
  banner.setAttribute('role', 'status');
  const accent = /^#[0-9a-f]{6}$/i.test(rarityColor || '') && rarityColor.toLowerCase() !== '#000000' ? rarityColor : '#f8fafc';
  banner.style.setProperty('--drop-color', accent);

  const eyebrow = document.createElement('span');
  eyebrow.className = 'global-drop-banner-kicker';
  eyebrow.textContent = 'GLOBAL SIGNAL';
  const headline = document.createElement('strong');
  headline.textContent = rarityName || 'Global rarity';
  const detail = document.createElement('p');
  detail.textContent = message || `${username} found a global rarity!`;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'global-drop-dismiss';
  close.setAttribute('aria-label', 'Dismiss global drop announcement');
  close.textContent = '×';
  close.addEventListener('click', () => banner.remove());
  banner.append(eyebrow, headline, detail, close);
  document.body.appendChild(banner);
  const adminBanner = document.querySelector('.admin-announcement-banner');
  if (adminBanner) banner.style.top = `${adminBanner.offsetHeight + 12}px`;
  setTimeout(() => banner.remove(), 8500);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadAdminUsers() {
  const userList = document.getElementById('user-list');
  if (!userList || !currentUser?.is_admin) return;

  userList.innerHTML = '<p class="admin-empty-state">Loading player records...</p>';
  const response = await handleAPI('/api/admin/users');
  if (!response.success) {
    userList.innerHTML = `<p class="admin-empty-state">${escapeHtml(response.error || 'Unable to load players.')}</p>`;
    return;
  }

  userList.innerHTML = '';
  response.users.forEach(user => {
    const row = document.createElement('div');
    row.className = 'admin-user-row';
    row.dataset.username = String(user.username || '').toLowerCase();
    row.innerHTML = `
      <div class="admin-user-summary">
        <div><strong>${escapeHtml(user.username)}</strong><span>${user.is_banned ? 'BANNED' : user.is_admin ? 'Administrator' : 'Player'}</span></div>
        <div><strong>🪙 ${formatCoins(user.coins)} coins</strong><span>${user.spins || 0} rolls · ${user.inventoryTotal || 0} drops · ${(user.titles || []).length} titles</span></div>
      </div>
      <div class="admin-user-tools">
        <form class="admin-adjust-form" data-adjustment="coins">
          <label>Set coins<input name="amount" type="number" min="0" max="2147483647" step="1" value="${Number(user.coins) || 0}" required></label>
          <button class="btn" type="submit">Save balance</button>
        </form>
        <form class="admin-adjust-form" data-adjustment="potion">
          <label>Grant potion<select name="potion"><option value="luck">Luck</option><option value="speed">Speed</option></select></label>
          <label>Qty<input name="amount" type="number" min="1" max="99" value="1" required></label>
          <button class="btn" type="submit">Grant</button>
        </form>
        <form class="admin-adjust-form" data-adjustment="item">
          <label>Grant item<select name="item"><option value="fragments">Portal fragments</option><option value="clovers">Clover leaves</option><option value="essence">Sea essence</option></select></label>
          <label>Qty<input name="amount" type="number" min="1" max="99" value="1" required></label>
          <button class="btn" type="submit">Grant</button>
        </form>
      </div>
      <form class="admin-ban-form">
        <label>Ban reason<input class="ban-reason" type="text" maxlength="250" placeholder="Optional reason" ${user.is_admin ? 'disabled' : ''}></label>
        <button class="btn ${user.is_banned ? '' : 'danger-btn'}" type="submit" ${user.is_admin ? 'disabled' : ''}>${user.is_banned ? 'Unban player' : 'Ban player'}</button>
      </form>
    `;
    row.classList.toggle('admin-user-banned', Boolean(user.is_banned));
    row.querySelector('.ban-reason').value = user.ban_reason || '';
    row.querySelector('.admin-ban-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const banned = !user.is_banned;
      const result = await handleAPI(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'POST',
        body: { type: 'ban', banned, reason: row.querySelector('.ban-reason').value }
      });
      if (!result.success) {
        showPopup(result.error || 'Unable to update player access.', 'error');
        return;
      }
      showPopup(banned ? `${user.username} has been banned.` : `${user.username} has been unbanned.`);
      loadAdminUsers();
    });
    row.querySelectorAll('.admin-adjust-form').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const fields = new FormData(form);
        const body = { type: form.dataset.adjustment, amount: Number(fields.get('amount')) };
        if (body.type === 'potion') body.potion = fields.get('potion');
        if (body.type === 'item') body.item = fields.get('item');
        const result = await handleAPI(`/api/admin/users/${encodeURIComponent(user.username)}`, { method: 'POST', body });
        if (!result.success) {
          showPopup(result.error || 'Unable to update player.', 'error');
          return;
        }
        if (result.user?.username === currentUser?.username) {
          currentUser = result.user;
          updateUI(currentUser);
        }
        showPopup(`Updated ${user.username}.`);
        loadAdminUsers();
      });
    });
    userList.appendChild(row);
  });
  const search = document.getElementById('admin-user-search');
  if (search && !search.dataset.bound) {
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      userList.querySelectorAll('.admin-user-row').forEach(row => {
        row.hidden = !row.dataset.username.includes(query);
      });
    });
    search.dataset.bound = 'true';
  }
  search?.dispatchEvent(new Event('input'));
  if (!response.users.length) {
    userList.innerHTML = '<p class="admin-empty-state">No player records yet.</p>';
  }
}

async function loadShutdownState() {
  if (!currentUser?.is_admin) return;
  const response = await handleAPI('/api/admin/shutdown');
  if (!response.success) return;
  const status = document.getElementById('shutdown-status');
  const button = document.getElementById('shutdown-toggle');
  if (status) status.textContent = response.active ? 'Maintenance mode active' : 'All systems online';
  if (status) status.style.color = response.active ? '#fca5a5' : '#86efac';
  if (button) button.textContent = response.active ? 'Resume game' : 'Begin shutdown';
}

function applyAdminHeadline(headline = {}) {
  const active = Boolean(headline.active && String(headline.text || '').trim());
  const ticker = document.getElementById('admin-headline');
  const display = document.getElementById('admin-headline-text-display');
  const enabled = document.getElementById('admin-headline-enabled');
  const input = document.getElementById('admin-headline-text');
  const status = document.getElementById('admin-headline-status');
  if (display) display.textContent = active ? headline.text : '';
  ticker?.classList.toggle('hidden', !active);
  if (currentUser?.is_admin) {
    if (enabled) enabled.checked = active;
    if (input) input.value = headline.text || '';
    if (status) status.textContent = active ? 'Headline is live for all players' : 'Headline is off';
  }
}

async function loadAdminHeadline() {
  if (!currentUser?.is_admin) return;
  const response = await handleAPI('/api/admin/headline');
  if (response.success) applyAdminHeadline(response.headline);
}

// ==================== THEME EVENTS ====================
function applyThemeEvent(eventData, legacyInitiatedBy = 'Admin') {
  const event = typeof eventData === 'string' ? { eventName: eventData, initiatedBy: legacyInitiatedBy } : eventData || {};
  const eventName = String(event.eventName || '').toLowerCase();
  const isActive = event.active !== false;
  const title = event.title || (eventName === 'starlight-surge' ? 'Starlight Surge' : 'Meteor Shower');
  const status = document.getElementById(`${eventName}-status`);
  const startButton = eventName === 'starlight-surge' ? document.getElementById('activate-starlight-surge') : document.getElementById('activate-meteor-shower');
  const stopButton = eventName === 'starlight-surge' ? document.getElementById('deactivate-starlight-surge') : null;

  if (eventName === 'starlight-surge') {
    document.body.classList.toggle('starlight-surge', isActive);
    if (startButton) startButton.hidden = isActive;
    if (stopButton) stopButton.hidden = !isActive;
  } else if (eventName === 'meteor-shower') {
    if (isActive) {
      createMeteorShower(event.durationSeconds || 90);
      if (startButton) startButton.disabled = true;
    } else {
      meteorShowerLayer?.remove();
      meteorShowerLayer = null;
      if (startButton) startButton.disabled = false;
    }
  } else {
    return;
  }

  clearInterval(eventCountdownTimer);
  eventCountdownTimer = null;
  const eventBar = document.getElementById('active-event-bar');
  const eventTitle = document.getElementById('active-event-title');
  const eventDetails = document.getElementById('active-event-details');
  if (status) {
    if (!isActive) {
      status.textContent = 'Ready';
      eventBar?.classList.add('hidden');
    } else {
      const rewardText = eventName === 'starlight-surge' ? '2x coins per roll' : '+250 coins per roll';
      const updateStatus = () => {
        const remaining = event.expiresAt ? Math.max(0, Math.ceil((Number(event.expiresAt) - Date.now()) / 1000)) : event.durationSeconds || 0;
        status.textContent = `ACTIVE · ${rewardText} · ${remaining}s`;
        if (eventTitle) eventTitle.textContent = title;
        if (eventDetails) {
          const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
          const seconds = (remaining % 60).toString().padStart(2, '0');
          eventDetails.textContent = `${rewardText} · ${minutes}:${seconds} remaining`;
        }
        eventBar?.classList.remove('hidden');
      };
      updateStatus();
      eventCountdownTimer = setInterval(updateStatus, 1000);
    }
  }

  const initiatedBy = event.initiatedBy || 'Admin';
  showPopup(isActive ? `${title} activated by ${initiatedBy}!` : `${title} ended.`, '#38bdf8');
}

function createMeteorShower(durationSeconds) {
  meteorShowerLayer?.remove();
  const layer = document.createElement('div');
  layer.className = 'meteor-layer';
  layer.setAttribute('aria-hidden', 'true');

  for (let index = 0; index < 18; index += 1) {
    const meteor = document.createElement('span');
    meteor.className = 'event-meteor';
    meteor.style.setProperty('--meteor-left', `${Math.random() * 100}%`);
    meteor.style.setProperty('--meteor-delay', `${Math.random() * 6}s`);
    meteor.style.setProperty('--meteor-duration', `${2.8 + Math.random() * 2.6}s`);
    layer.appendChild(meteor);
  }

  document.body.appendChild(layer);
  meteorShowerLayer = layer;
  setTimeout(() => {
    if (meteorShowerLayer === layer) {
      layer.remove();
      meteorShowerLayer = null;
    }
  }, durationSeconds * 1000);
}

// ==================== CHAT API ====================

function showPage(pageName) {
  const pageIds = ['landing-page', 'login-page', 'register-page', 'game-page', 'admin-panel'];
  pageIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('active');
    }
  });

  const targetPage = document.getElementById(pageName + '-page') || document.getElementById(pageName);
  if (targetPage) {
    targetPage.classList.remove('hidden');
    if (targetPage.classList.contains('auth-container')) {
      targetPage.classList.add('active');
    }
    if (pageName === 'landing') {
      initTagline();
    }
  }
}

function showGamePage() {
  showPage('game');
}

function hideGamePage() {
  document.getElementById('game-page').classList.add('hidden');
}

function showLanding() {
  showPage('landing');
}

// ==================== AUTH HANDLERS ====================
async function handleLogin(e) {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('login-error');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    errorDiv.textContent = 'Please enter both username and password';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    setLoading(button, true, 'Logging in...');
    errorDiv.classList.add('hidden');

    const data = await handleAPI('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    if (data.banned) {
      errorDiv.textContent = 'Your account has been banned';
      errorDiv.classList.remove('hidden');
      button.disabled = false;
      button.innerHTML = 'Login';
      return;
    }

    if (data.success && data.user) {
      currentUser = data.user;
      console.log('✅ Logged in as:', currentUser.username);
      window.refreshMultiplayerSession?.();
      window.loadChatFallback?.();
      showPopup('Welcome back, ' + currentUser.username + '!', '#27ae60');
      showPage('game');
      setupPortalUI();
      setupRollButton();
      updateUI(currentUser);
      e.target.reset();
    } else {
      throw new Error(data.error || data.message || 'Login failed');
    }
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
    showPopup('Login failed', '#e74c3c');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Login';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('register-error');
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;

  if (!username || !password) {
    errorDiv.textContent = 'Please enter both username and password';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (username.length < 3) {
    errorDiv.textContent = 'Username must be at least 3 characters';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    setLoading(button, true, 'Registering...');
    errorDiv.classList.add('hidden');

    const data = await handleAPI('/api/register', {
      method: 'POST',
      body: { username, password }
    });

    if (data.success && data.user) {
      currentUser = data.user;
      window.refreshMultiplayerSession?.();
      window.loadChatFallback?.();
      showPopup('Account created! Welcome, ' + currentUser.username + '!', '#27ae60');
      showPage('game');
      setupPortalUI();
      setupRollButton();
      updateUI(currentUser);
      e.target.reset();
    } else {
      throw new Error(data.error || data.message || 'Registration failed');
    }
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
    showPopup('Registration failed', '#e74c3c');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Register';
  }
}

// ==================== AUTH ====================
async function loadSession() {
  const response = await handleAPI('/api/session');
  if (response.success && response.user) {
    if (response.user.is_banned) {
      showBanScreen(response.user.ban_reason);
      return;
    }
    currentUser = response.user;
    window.refreshMultiplayerSession?.();
    window.loadChatFallback?.();
    showGamePage();
    updateUI(response.user);
    setupPortalUI();
    setupRollButton();
  }
}

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await handleAPI('/api/logout', { method: 'POST' });
  currentUser = null;
  hideGamePage();
  showLanding();
  showPopup('Logged out successfully');
});

document.getElementById('exit-dimension')?.addEventListener('click', exitDeepSea);

function waitForRollReveal() {
  const speedMultiplier = getPotionMultiplier('speed');
  return new Promise(resolve => setTimeout(resolve, 300 / speedMultiplier));
}

// ==================== ROLL BUTTON ====================
function setupRollButton() {
  const rollBtn = document.getElementById('roll-btn');
  if (!rollBtn || rollBtn.dataset.bound) return;

  rollBtn.dataset.bound = 'true';

  rollBtn.addEventListener('click', async () => {
    if (!currentUser) {
      showPopup('Login first to roll', 'error');
      return;
    }
    if (rollBtn.disabled) return;

    const rollDisplay = document.getElementById('roll-display');
    const rewardDisplay = document.getElementById('reward-display');
    if (!rollDisplay || !rewardDisplay) return;

    setLoading(rollBtn, true, 'ROLLING...');
    rollDisplay.textContent = 'Drawing signal...';
    rollDisplay.style.opacity = '1';

    const response = await handleAPI('/api/spin', {
      method: 'POST',
      body: { dimension: gameState.currentDimension || null }
    });

    if (response.success && response.result && response.user) {
      await waitForRollReveal();
    }

    setLoading(rollBtn, false);

    if (!response.success || !response.result || !response.user) {
      rollDisplay.textContent = '❌ Roll Failed';
      showPopup(response.error || 'Roll failed', 'error');
      rollDisplay.style.opacity = '0.5';
      return;
    }

    currentUser = response.user;
    updateUI(response.user);

    const result = response.result;
    const multiplierDisplay = result.multiplier > 1 ? ` · ${result.multiplier}x coins` : '';
    const luckDisplay = result.luckMultiplier > 1 ? ` · ${result.luckMultiplier}x luck` : '';
    
    // Dramatic reveal with color animation
    const readableColor = ['#0f172a', '#000000', '#1e3a8a'].includes((result.color || '').toLowerCase()) ? (result.glowColor || '#93c5fd') : result.color;
    rollDisplay.style.color = readableColor || '#f8fafc';
    rollDisplay.style.textShadow = `0 0 20px ${result.glowColor || result.color || '#38bdf8'}`;
    rollDisplay.classList.toggle('global-rarity-reveal', Boolean(result.isGlobal));
    if (result.isGlobal) rollDisplay.style.setProperty('--roll-glow', result.glowColor || result.color);
    else rollDisplay.style.removeProperty('--roll-glow');
    rollDisplay.textContent = `${result.name}${multiplierDisplay}${luckDisplay}`;
    
    rewardDisplay.textContent = `🪙 Reward: ${formatCoins(result.reward)} coins`;
    rewardDisplay.style.color = '#7dd3fc';
    
    showRewardPopup(`🪙 +${formatCoins(result.reward)} coins!`);
  });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Show landing page and start tagline
  showPage('landing');
  
  // Auth form listeners
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);
  
  // Landing page buttons
  document.getElementById('login-btn')?.addEventListener('click', () => showPage('login'));
  document.getElementById('register-btn')?.addEventListener('click', () => showPage('register'));
  
  // Auth page links
  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('login');
  });
  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('register');
  });
  
  // Chat send button
  document.getElementById('send-chat')?.addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    if (input && input.value.trim()) {
      sendChatToServer(input.value);
      input.value = '';
    }
  });
  
  // Allow Enter key in chat input
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('send-chat')?.click();
    }
  });

  function activateDefaultTabs() {
    const firstTab = document.querySelector('.content-tab');
    if (firstTab) {
      document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
      });
      firstTab.classList.add('active');
      const tabPane = document.getElementById(firstTab.dataset.tab + '-tab');
      if (tabPane) {
        tabPane.classList.remove('hidden');
        tabPane.classList.add('active');
      }
    }
  }

  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
      });
      tab.classList.add('active');
      const tabPane = document.getElementById(tab.dataset.tab + '-tab');
      if (tabPane) {
        tabPane.classList.remove('hidden');
        tabPane.classList.add('active');
      }
    });
  });

  activateDefaultTabs();

  document.querySelectorAll('.inv-subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.inv-subtab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.inventory-subtab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      const content = document.getElementById('inv-' + tab.dataset.inv);
      if (content) content.classList.remove('hidden');
    });
  });
  
  // Load session if already logged in
  loadSession();
  
  // Admin panel controls
  document.getElementById('admin-btn')?.addEventListener('click', () => {
    if (currentUser && currentUser.is_admin) {
      showPage('admin-panel');
      loadAdminUsers();
      loadShutdownState();
      loadAdminHeadline();
    } else {
      showPopup('Admin access denied', 'error');
    }
  });
  document.getElementById('back-to-game')?.addEventListener('click', () => showPage('game'));
  document.getElementById('refresh-admin-users')?.addEventListener('click', loadAdminUsers);
  document.getElementById('shutdown-toggle')?.addEventListener('click', async () => {
    const active = document.getElementById('shutdown-toggle').textContent === 'Begin shutdown';
    if (active && !confirm('Put the game into maintenance mode for every player?')) return;
    const response = await handleAPI('/api/admin/shutdown', { method: 'POST', body: { active } });
    if (!response.success) {
      showPopup(response.error || 'Unable to change service mode.', 'error');
      return;
    }
    loadShutdownState();
    showPopup(active ? 'Maintenance mode enabled.' : 'Game services resumed.');
  });
  document.getElementById('admin-headline-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const active = document.getElementById('admin-headline-enabled').checked;
    const text = document.getElementById('admin-headline-text').value.trim();
    if (active && !text) {
      showPopup('Enter headline text before enabling it.', 'error');
      return;
    }
    const response = await handleAPI('/api/admin/headline', { method: 'POST', body: { active, text } });
    if (!response.success) {
      showPopup(response.error || 'Unable to save headline.', 'error');
      return;
    }
    applyAdminHeadline(response.headline);
    showPopup(active ? 'Moving headline is live.' : 'Moving headline turned off.');
  });
  
  // Server-authoritative, timed reward events.
  document.getElementById('activate-starlight-surge')?.addEventListener('click', () => {
    triggerAdminEvent('starlight-surge');
  });
  document.getElementById('deactivate-starlight-surge')?.addEventListener('click', () => {
    triggerAdminEvent('starlight-surge', 'stop');
  });
  document.getElementById('activate-meteor-shower')?.addEventListener('click', () => {
    triggerAdminEvent('meteor-shower');
  });
  
  // Broadcast button
  document.getElementById('broadcast-btn')?.addEventListener('click', () => {
    const msg = prompt('Enter broadcast message:');
    if (msg && msg.trim()) {
      handleAPI('/api/broadcast', {
        method: 'POST',
        body: { message: msg.trim() }
      }).then(response => {
        if (response.success) {
          showPopup('📢 Message broadcast to all players!', '#FFD700');
        } else {
          showPopup(response.error || 'Broadcast failed', 'error');
        }
      });
    }
  });
  
  // Clear chat button
  document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
    if (confirm('Clear all chat messages? This cannot be undone.')) {
      requestClearChat();
      showPopup('💬 Chat cleared by admin', '#0ea5e9');
    }
  });
  
  // Clear chat
  document.getElementById('clear-chat')?.addEventListener('click', requestClearChat);
  
  // Announcement form
  document.getElementById('announcement-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('announcement-title').value.trim();
    const content = document.getElementById('announcement-content').value;
    if (!title || !content) return;
  
    try {
      const response = await handleAPI('/api/admin/announcement', {
        method: 'POST',
        body: { title, content }
      });
      if (response.success) {
        showPopup('Announcement sent!', 'success');
        e.target.reset();
      } else {
        showPopup(response.error || 'Failed to send announcement', 'error');
      }
    } catch (err) {
      showPopup('Failed to send announcement', 'error');
    }
  });
  
  // Game loops
  setInterval(updatePotionDisplay, 100);
  setInterval(updateShopTimer, 1000);
});
