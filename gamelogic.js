// ==================== GAME CONSTANTS ====================
const rarityOptions = [
  { key: '17-news', name: '17 News', reward: 150, chance: 68, color: '#60a5fa' },
  { key: '17-news-reborn', name: '17 News Reborn', reward: 300, chance: 25, color: '#3b82f6' },
  { key: 'delan-fernando', name: 'Delan Fernando', reward: 1450, chance: 7, color: '#0f172a' }
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
  { id: 'owner', name: 'Owner', color: '#FFD700', requirement: 'admin', description: 'Only for Mr_Fernanski' },
  { id: 'veteran', name: 'Veteran', color: '#CD853F', requirement: 'code:THETHREEQUEL', description: 'Redeem code THETHREEQUEL' },
  { id: 'millionaire', name: 'Millionaire', color: '#90EE90', requirement: 'coins:1000000', description: 'Reach 1,000,000 coins' },
  { id: 'portalmancer', name: 'Portalmancer', color: '#87CEEB', requirement: 'portal', description: 'Open the Deep Sea portal' }
];

const CODE_REWARDS = {
  'THETHREEQUEL': { title: 'veteran', coins: 0 }
};

// ==================== GAME STATE ====================
let currentUser = null;
let gameState = {
  activeEffects: {},
  currentDimension: null,
  rotatingShopIndex: 0,
  shopLastRestock: Date.now(),
  deathSeaUnlocked: false,
  portalFragments: 0,
  seaEssence: 0,
  portalUnlocked: false,
  userTitles: [],
  activeTitle: null,
  potionInventory: { luck: 0, speed: 0 },
  itemInventory: { fragments: 0, clovers: 0, essence: 0 }
};

// ==================== UTILITY FUNCTIONS ====================
function formatCoins(amount) {
  return Number(amount).toLocaleString();
}

function showPopup(message, type = 'success') {
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.textContent = message;
  popup.style.background = type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(14, 165, 233, 0.95)';
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
  button.disabled = isLoading;
  button.textContent = isLoading ? text : button.dataset.defaultText || button.textContent;
}

async function handleAPI(url, options = {}) {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
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

function getPotionMultiplier() {
  let mult = 1;
  Object.values(gameState.activeEffects).forEach(eff => {
    if (Date.now() < eff.endTime) mult *= eff.multiplier;
  });
  return mult;
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
      card.innerHTML = `
        <h4 class="shop-item-name">${item.name}</h4>
        <p class="shop-item-price">${formatCoins(item.cost)} coins</p>
        <button class="potion-buy-btn" onclick="buyShopItem('${item.name}')">Buy</button>
      `;
      rotatingDiv.appendChild(card);
    });
  }

  const potionsDiv = document.getElementById('potions-list');
  if (potionsDiv) {
    potionsDiv.innerHTML = '';
    Object.entries(POTIONS).forEach(([key, potion]) => {
      const card = document.createElement('div');
      card.className = 'potion-card';
      card.innerHTML = `
        <h4>${potion.name}</h4>
        <p>${potion.multiplier}x ${potion.effect} • ${potion.duration}s</p>
        <div class="potion-stats">
          <span>Effect: +${potion.multiplier}x</span>
          <span>Duration: ${potion.duration}s</span>
        </div>
        <div class="potion-cost">${formatCoins(potion.cost)} coins</div>
        <button class="potion-buy-btn" onclick="buyPotion('${key}')">Purchase</button>
      `;
      potionsDiv.appendChild(card);
    });
  }
}

function buyPotion(potionType) {
  if (currentUser.coins < POTIONS[potionType].cost) {
    showPopup('Not enough coins!', 'error');
    return;
  }
  
  // Call backend to buy potion
  handleAPI('/api/buy-potion', { method: 'POST', body: { potionType } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      applyPotion(potionType);
      updateUI(currentUser);
      showPopup(`Purchased ${POTIONS[potionType].name}!`);
    } else {
      showPopup(response.error || 'Purchase failed', 'error');
    }
  });
}

function buyShopItem(itemName) {
  const item = ROTATING_SHOP_ITEMS.find(i => i.name === itemName);
  if (!item || currentUser.coins < item.cost) {
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
    listDiv.innerHTML = gameState.userTitles.length ? '' : '<p style="color: rgba(241,245,249,0.7);">No titles yet. Complete requirements to unlock!</p>';
    gameState.userTitles.forEach(titleId => {
      const title = TITLES.find(t => t.id === titleId);
      if (!title) return;
      const card = document.createElement('div');
      card.className = 'title-card active';
      card.style.borderColor = title.color;
      card.innerHTML = `
        <div class="title-name" style="color: ${title.color}">✨ ${title.name}</div>
        <div class="title-status">Unlocked</div>
        ${gameState.activeTitle === titleId ? '<button class="btn" style="font-size:0.8rem; padding:6px;">(Active)</button>' : `<button class="btn" onclick="setActiveTitle('${titleId}')" style="font-size:0.8rem; padding:6px;">Set Active</button>`}
      `;
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
        <div class="title-name" style="color: ${title.color}">🔒 ${title.name}</div>
        <div class="title-status">${title.description}</div>
      `;
      availDiv.appendChild(card);
    });
  }
}

function setActiveTitle(titleId) {
  gameState.activeTitle = titleId;
  renderTitles();
  showPopup(`Active title changed to ${TITLES.find(t => t.id === titleId).name}`);
}

function checkTitleUnlocks(user) {
  // Owner title
  if (user.is_admin && !gameState.userTitles.includes('owner')) {
    gameState.userTitles.push('owner');
    showPopup('Title Unlocked: Owner! 👑');
  }

  // Millionaire title
  if (user.coins >= 1000000 && !gameState.userTitles.includes('millionaire')) {
    gameState.userTitles.push('millionaire');
    showPopup('Title Unlocked: Millionaire! 💰');
  }
}

// ==================== PORTAL SYSTEM ====================
function setupPortalUI() {
  const lockBtn = document.getElementById('portal-lock');
  if (lockBtn) {
    lockBtn.addEventListener('click', tryUnlockPortal);
  }

  const redeemBtn = document.getElementById('redeem-btn');
  if (redeemBtn) {
    redeemBtn.addEventListener('click', redeemCode);
  }
}

function tryUnlockPortal() {
  if (gameState.itemInventory.fragments < 10) {
    showPopup(`Need ${10 - gameState.itemInventory.fragments} more Portal Fragments`, 'error');
    return;
  }

  // Call backend to unlock portal
  handleAPI('/api/unlock-portal', { method: 'POST' }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.itemInventory = currentUser.items || {};
      gameState.userTitles = currentUser.titles || [];
      gameState.portalUnlocked = true;
      
      document.getElementById('portal-lock').style.display = 'none';
      document.getElementById('unlock-portal-btn').style.display = 'none';
      document.getElementById('portal-status').textContent = 'Portal Unlocked!';
      
      // Screen fade effect
      const fade = document.createElement('div');
      fade.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:10000;opacity:0;transition:opacity 2s';
      document.body.appendChild(fade);
      setTimeout(() => fade.style.opacity = '1', 100);
      setTimeout(() => fade.style.opacity = '0', 2100);
      setTimeout(() => fade.remove(), 4100);

      showPopup('Portal Unlocked! Explore the Deep Sea...');
      setupPortalDimensions();
    } else {
      showPopup(response.error || 'Failed to unlock portal', 'error');
    }
  });
}

function setupPortalDimensions() {
  // Shows available dimensions
  const portalBtn = document.querySelector('.portal-base');
  if (portalBtn) {
    portalBtn.addEventListener('click', showDimensions);
  }
}

function showDimensions() {
  if (!gameState.portalUnlocked) {
    showPopup('Portal is locked. Get 10 Portal Fragments!', 'error');
    return;
  }

  const choice = confirm('Enter Deep Sea Realm? (Requires 1 Sea Essence)');
  if (choice) {
    if (gameState.itemInventory.essence < 1) {
      showPopup('Need 1 Sea Essence to enter!', 'error');
      return;
    }
    gameState.itemInventory.essence--;
    enterDeepSea();
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
    const size = 10 + Math.random() * 40;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.animationDuration = (4 + Math.random() * 6) + 's';
    bubble.style.animationDelay = Math.random() * 2 + 's';
    bubbleContainer.appendChild(bubble);
  }

  // Setup Deep Sea roll
  document.getElementById('ds-roll-btn').addEventListener('click', rollInDeepSea);

  showPopup('Welcome to the Deep Sea! 🌊 (2x Luck Boost Active)');
}

function exitDeepSea() {
  document.getElementById('deep-sea-dimension').classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  gameState.currentDimension = null;
}

function rollInDeepSea() {
  // Roll with 2x luck multiplier
  const baseMultiplier = getPotionMultiplier();
  const totalMultiplier = baseMultiplier * 2; // Deep Sea bonus
  showPopup(`Rolling with ${totalMultiplier}x multiplier! 🌊`);
  // Would do actual roll here with enhanced rewards
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
      rarGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center;">No rare items yet</div>';
    } else {
      Object.entries(rarities).forEach(([key, count]) => {
        const rarity = rarityOptions.find(r => r.key === key);
        if (!rarity) return;
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.style.borderLeft = `4px solid ${rarity.color}`;
        card.innerHTML = `
          <div><h4>${rarity.name}</h4><span>${count} owned</span></div>
          <div><span>${formatCoins(rarity.reward)} each</span></div>
        `;
        rarGrid.appendChild(card);
      });
    }
  }

  // Potions sub-tab
  const potGrid = document.getElementById('inv-potions-grid');
  if (potGrid) {
    potGrid.innerHTML = '';
    const hasPotions = gameState.potionInventory.luck > 0 || gameState.potionInventory.speed > 0;
    if (!hasPotions) {
      potGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center;">No potions in inventory</div>';
    } else {
      if (gameState.potionInventory.luck > 0) {
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.innerHTML = `
          <div><h4>Luck Potion I</h4><span>${gameState.potionInventory.luck}x</span></div>
        `;
        potGrid.appendChild(card);
      }
      if (gameState.potionInventory.speed > 0) {
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.innerHTML = `
          <div><h4>Speed Potion I</h4><span>${gameState.potionInventory.speed}x</span></div>
        `;
        potGrid.appendChild(card);
      }
    }
  }

  // Items sub-tab
  const itemGrid = document.getElementById('inv-items-grid');
  if (itemGrid) {
    itemGrid.innerHTML = '';
    const items = [
      { name: 'Portal Fragments', count: gameState.itemInventory.fragments },
      { name: 'Clover Leaves', count: gameState.itemInventory.clovers },
      { name: 'Sea Essence', count: gameState.itemInventory.essence }
    ];
    items.forEach(item => {
      if (item.count === 0) return;
      const card = document.createElement('div');
      card.className = 'inventory-item';
      card.innerHTML = `<div><h4>${item.name}</h4><span>${item.count}x</span></div>`;
      itemGrid.appendChild(card);
    });
    if (items.every(i => i.count === 0)) {
      itemGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center;">No items in inventory</div>';
    }
  }
}

// ==================== UI UPDATES ====================
function updateUI(user) {
  currentUser = user;
  
  // Load game state from user
  gameState.itemInventory = user.items || { fragments: 0, clovers: 0, essence: 0 };
  gameState.potionInventory = user.potions || { luck: 0, speed: 0 };
  gameState.userTitles = user.titles || [];
  gameState.portalUnlocked = user.portal_unlocked || false;
  
  document.getElementById('game-username').textContent = user.username;
  document.getElementById('game-coins').textContent = `${formatCoins(user.coins)} coins`;
  document.getElementById('reward-display').textContent = `Reward: 0 coins`;

  checkTitleUnlocks(user);
  renderTitles();
  renderInventory(user);
  renderShop();

  // Update portal UI
  if (gameState.portalUnlocked) {
    const lock = document.getElementById('portal-lock');
    if (lock) lock.style.display = 'none';
    const unlockBtn = document.getElementById('unlock-portal-btn');
    if (unlockBtn) unlockBtn.style.display = 'none';
    const status = document.getElementById('portal-status');
    if (status) status.textContent = 'Portal Unlocked!';
  }

  // Tabs
  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.removeEventListener('click', null); // Remove old listeners
    tab.addEventListener('click', () => {
      document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const tabPane = document.getElementById(tab.dataset.tab + '-tab');
      if (tabPane) tabPane.classList.add('active');
    });
  });

  // Inventory subtabs
  document.querySelectorAll('.inv-subtab').forEach(tab => {
    tab.removeEventListener('click', null); // Remove old listeners
    tab.addEventListener('click', () => {
      document.querySelectorAll('.inv-subtab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.inventory-subtab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      const content = document.getElementById('inv-' + tab.dataset.inv);
      if (content) content.classList.remove('hidden');
    });
  });
}

// ==================== PAGE NAVIGATION ====================
function showGamePage() {
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('register-page').classList.remove('active');
  document.getElementById('game-page').classList.remove('hidden');
}

function hideGamePage() {
  document.getElementById('game-page').classList.add('hidden');
}

function showLanding() {
  document.getElementById('landing-page').classList.remove('hidden');
}

// ==================== AUTH ====================
async function loadSession() {
  const response = await handleAPI('/api/session');
  if (response.success && response.user) {
    currentUser = response.user;
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

// ==================== ROLL BUTTON ====================
function setupRollButton() {
  const rollBtn = document.getElementById('roll-btn');
  if (!rollBtn) return;

  rollBtn.addEventListener('click', async () => {
    if (!currentUser) {
      showPopup('Login first to roll', 'error');
      return;
    }

    const rollDisplay = document.getElementById('roll-display');
    const rewardDisplay = document.getElementById('reward-display');
    rollBtn.dataset.defaultText = 'ROLL';
    setLoading(rollBtn, true, 'ROLLING...');

    const animationValues = rarityOptions.map(r => r.name);
    let index = 0;
    const spinner = setInterval(() => {
      rollDisplay.textContent = animationValues[index % animationValues.length];
      index += 1;
    }, 120);

    const response = await handleAPI('/api/spin', { method: 'POST' });
    await new Promise(resolve => setTimeout(resolve, 1600));
    clearInterval(spinner);
    setLoading(rollBtn, false);

    if (!response.success) {
      rollDisplay.textContent = 'Roll Failed';
      showPopup(response.error || 'Roll failed', 'error');
      return;
    }

    const result = response.result;
    const mult = getPotionMultiplier();
    const finalReward = result.reward * mult;

    rollDisplay.textContent = result.name;
    rewardDisplay.textContent = `Reward: ${formatCoins(finalReward)} coins`;
    showRewardPopup(`+${formatCoins(finalReward)} coins!`);
    currentUser = response.user;
    updateUI(response.user);
  });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  loadSession();
  setInterval(updatePotionDisplay, 100);
  setInterval(updateShopTimer, 1000);
});
