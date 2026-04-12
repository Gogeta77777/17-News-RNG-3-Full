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

// ==================== TAGLINE CYCLING ====================
function typeText(text, element, speed = 45) {
  element.classList.add('typing');
  element.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i += 1;
    } else {
      clearInterval(timer);
      setTimeout(() => {
        element.classList.remove('typing');
        setTimeout(nextTagline, 2200);
      }, 1200);
    }
  }, speed);
}

function nextTagline() {
  currentTaglineIndex = (currentTaglineIndex + 1) % taglines.length;
  const taglineElement = document.getElementById('tagline');
  if (taglineElement) {
    typeText(taglines[currentTaglineIndex], taglineElement);
  }
}

function initTagline() {
  const taglineElement = document.getElementById('tagline');
  if (taglineElement) {
    typeText(taglines[0], taglineElement);
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
      const emoji = item.name.includes('Fragment') ? '🔮' : item.name.includes('Clover') ? '🍀' : '💧';
      card.innerHTML = `
        <h4 class="shop-item-name">${emoji} ${item.name}</h4>
        <p class="shop-item-price">💎 ${formatCoins(item.cost)} coins</p>
        <button class="potion-buy-btn" onclick="buyShopItem('${item.name}')">Purchase</button>
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
      const emoji = key === 'luck' ? '🍀' : '⚡';
      card.innerHTML = `
        <h4>${emoji} ${potion.name}</h4>
        <p>${potion.multiplier}x ${potion.effect} • ${potion.duration}s duration</p>
        <div class="potion-stats">
          <span>⚡ +${potion.multiplier}x ${potion.effect}</span>
          <span>⏱️ ${potion.duration}s active</span>
        </div>
        <div class="potion-cost">💎 ${formatCoins(potion.cost)} coins</div>
        <button class="potion-buy-btn" onclick="buyPotion('${key}')">Buy Now</button>
      `;
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
      showPopup(`${POTIONS[potionType].name} activated!`);
    } else {
      showPopup(response.error || 'Unable to use potion', 'error');
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
    listDiv.innerHTML = gameState.userTitles.length ? '' : '<p style="color: rgba(241,245,249,0.7); text-align: center; padding: 20px;">🔒 No titles yet. Complete requirements to unlock!</p>';
    gameState.userTitles.forEach(titleId => {
      const title = TITLES.find(t => t.id === titleId);
      if (!title) return;
      const card = document.createElement('div');
      card.className = 'title-card active';
      card.style.borderColor = title.color;
      card.style.animation = 'titleEntry 0.5s ease-out';
      const emoji = titleId === 'owner' ? '👑' : titleId === 'veteran' ? '🎖️' : titleId === 'millionaire' ? '💰' : '✨';
      card.innerHTML = `
        <div class="title-name" style="color: ${title.color}; font-size: 1.1rem;">${emoji} ${title.name}</div>
        <div class="title-status" style="font-size: 0.85rem;">Unlocked</div>
        ${gameState.activeTitle === titleId ? '<button class="btn" style="font-size:0.8rem; padding:6px; background: rgba(34,197,94,0.3);">(Active)</button>' : `<button class="btn" onclick="setActiveTitle('${titleId}')" style="font-size:0.8rem; padding:6px;">Equip</button>`}
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
      const emoji = title.id === 'owner' ? '👑' : title.id === 'veteran' ? '🎖️' : title.id === 'millionaire' ? '💰' : '✨';
      card.innerHTML = `
        <div class="title-name" style="color: ${title.color};">🔒 ${emoji} ${title.name}</div>
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
  gameState.userTitles = Array.from(existing);
}

// ==================== PORTAL SYSTEM ====================
function setupPortalUI() {
  const lockBtn = document.getElementById('portal-lock');
  if (lockBtn) {
    lockBtn.addEventListener('click', tryUnlockPortal);
  }

  const portalBtn = document.querySelector('.portal-base');
  if (portalBtn) {
    portalBtn.addEventListener('click', showDimensions);
  }

  const unlockBtn = document.getElementById('unlock-portal-btn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', tryUnlockPortal);
  }

  const redeemBtn = document.getElementById('redeem-btn');
  if (redeemBtn) {
    redeemBtn.addEventListener('click', redeemCode);
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
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.animationDuration = (Math.random() * 6) + 's';
    bubble.style.animationDelay = Math.random() * 2 + 's';
    bubbleContainer.appendChild(bubble);
  }

  // Setup Deep Sea roll
  document.getElementById('ds-roll-btn').addEventListener('click', rollInDeepSea);

  showPopup('Welcome to the Deep Sea! 🌊 (2x Luck Boost Active)');
}

async function rollInDeepSea() {
  const rollBtn = document.getElementById('ds-roll-btn');
  const rollDisplay = document.getElementById('ds-roll-display');
  const rewardDisplay = document.getElementById('ds-reward-display');
  if (!rollBtn || !rollDisplay || !rewardDisplay) return;

  setLoading(rollBtn, true, 'DIVING...');
  rollDisplay.textContent = '🌊 Diving...';

  const deepSeaAnimations = ['🐠 Current', '🌊 Tide', '⭐ Luck', '🌀 Vortex', '🦑 Deep'];
  let index = 0;
  const spinner = setInterval(() => {
    rollDisplay.textContent = deepSeaAnimations[index % deepSeaAnimations.length];
    index += 1;
  }, 90);

  const response = await handleAPI('/api/spin', { method: 'POST', body: { dimension: 'deep-sea' } });
  await new Promise(resolve => setTimeout(resolve, 1800));
  clearInterval(spinner);
  setLoading(rollBtn, false);

  if (!response.success) {
    rollDisplay.textContent = '❌ Dive Failed';
    showPopup(response.error || 'Deep Sea roll failed', 'error');
    return;
  }

  const result = response.result;
  const multiplierDisplay = result.multiplier > 1 ? ` • ×${result.multiplier.toFixed(1)}` : '';
  rollDisplay.textContent = `🌊 ${result.name}${multiplierDisplay}`;
  rewardDisplay.textContent = `💰 Reward: ${formatCoins(result.reward)} coins`;
  currentUser = response.user;
  updateUI(currentUser);
  showRewardPopup(`🌊 +${formatCoins(result.reward)} coins!`);
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
        const rarity = rarityOptions.find(r => r.key === key);
        if (!rarity) return;
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.style.borderLeft = `4px solid ${rarity.color}`;
        const emoji = rarity.key === '17-news' ? '📺' : rarity.key === '17-news-reborn' ? '🔄' : '🌟';
        card.innerHTML = `
          <div>
            <h4>${emoji} ${rarity.name}</h4>
            <span>${count} owned</span>
          </div>
          <div><span style="color: ${rarity.color}; font-weight: 700;">💰 ${formatCoins(rarity.reward)} each</span></div>
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
          <button class="btn" style="padding: 8px 12px; font-size: 0.85rem;" onclick="usePotion('${key}')">Use Now</button>
        `;
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

  // Show admin button if user is admin
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    if (user.is_admin) {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  }

  document.getElementById('reward-display').textContent = `Reward: 0 coins`;

  checkTitleUnlocks(user);
  renderTitles();
  renderInventory(user);
  renderShop();
  updatePortalUI();
}

function updatePortalUI() {
  const lock = document.getElementById('portal-lock');
  const unlockBtn = document.getElementById('unlock-portal-btn');
  const status = document.getElementById('portal-status');
  const fragmentsText = document.getElementById('portal-fragments-needed');

  const fragments = gameState.itemInventory.fragments || 0;
  if (gameState.portalUnlocked) {
    if (lock) lock.style.display = 'none';
    if (unlockBtn) unlockBtn.style.display = 'none';
    if (status) status.textContent = 'Portal Unlocked!';
    if (fragmentsText) fragmentsText.textContent = `Sea Essence needed to enter.`;
  } else {
    if (lock) lock.style.display = fragments < 10 ? 'block' : 'block';
    if (unlockBtn) unlockBtn.style.display = fragments >= 10 ? 'inline-flex' : 'none';
    if (status) status.textContent = fragments >= 10 ? 'Ready to unlock' : 'Locked';
    if (fragmentsText) fragmentsText.textContent = `Requires: 10 Portal Fragments (${fragments}/10)`;
  }
}

// ==================== CHAT SYSTEM ====================
function addChatMessage(username, message, timestamp, isSystem = false, title = null, titleColor = '#ffd700') {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const msgEl = document.createElement('div');
  msgEl.className = isSystem ? 'chat-message system-message' : 'chat-message';
  msgEl.dataset.messageId = timestamp;
  
  const time = new Date(timestamp).toLocaleTimeString();
  
  if (isSystem) {
    msgEl.innerHTML = `
      <span style="font-weight: bold; color: #FF0000;">⚡ ${escapeHtml(message)}</span>
      <br><small style="opacity: 0.7;">${time}</small>
    `;
  } else {
    const titleLabel = title ? `<span style="color: ${titleColor}; font-weight: 700; margin-right: 6px;">[${escapeHtml(title)}]</span>` : '';
    msgEl.innerHTML = `
      <span class="username" style="font-weight: bold;">${titleLabel}${escapeHtml(username)}:</span>
      <span>${escapeHtml(message)}</span>
      <br><small style="opacity: 0.7;">${time}</small>
    `;
  }
  
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
      showPopup('Welcome back, ' + currentUser.username + '!', '#27ae60');
      showPage('game');
      setupPortalUI();
      setupRollButton();
      updateUI(currentUser);
      e.target.reset();
    } else {
      throw new Error(data.message || 'Login failed');
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
      showPopup('Account created! Welcome, ' + currentUser.username + '!', '#27ae60');
      showPage('game');
      setupPortalUI();
      setupRollButton();
      updateUI(currentUser);
      e.target.reset();
    } else {
      throw new Error(data.message || 'Registration failed');
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
    if (!rollDisplay || !rewardDisplay) return;

    setLoading(rollBtn, true, 'ROLLING...');
    const animationValues = rarityOptions.map(r => r.name);
    let index = 0;
    
    // Enhanced spinning animation with faster speeds and color changes
    const spinner = setInterval(() => {
      rollDisplay.textContent = animationValues[index % animationValues.length];
      index += 1;
    }, 85); // Faster spinning

    const response = await handleAPI('/api/spin', {
      method: 'POST',
      body: { dimension: gameState.currentDimension || null }
    });

    await new Promise(resolve => setTimeout(resolve, 1800)); // Longer animation duration for impact
    clearInterval(spinner);
    setLoading(rollBtn, false);

    if (!response.success) {
      rollDisplay.textContent = '❌ Roll Failed';
      showPopup(response.error || 'Roll failed', 'error');
      return;
    }

    const result = response.result;
    const multiplierDisplay = result.multiplier > 1 ? ` • ×${result.multiplier.toFixed(1)}` : '';
    rollDisplay.textContent = `✨ ${result.name}${multiplierDisplay}`;
    rewardDisplay.textContent = `💰 Reward: ${formatCoins(result.reward)} coins`;
    currentUser = response.user;
    updateUI(response.user);
    showRewardPopup(`💎 +${formatCoins(result.reward)} coins!`);
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

  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const tabPane = document.getElementById(tab.dataset.tab + '-tab');
      if (tabPane) tabPane.classList.add('active');
    });
  });

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
  
  // Admin panel
  document.getElementById('admin-btn')?.addEventListener('click', () => showPage('admin-panel'));
  document.getElementById('back-to-game')?.addEventListener('click', () => showPage('game'));
  
  // Admin events
  document.getElementById('start-hollow-rally')?.addEventListener('click', () => triggerAdminEvent('hollow-rally'));
  document.getElementById('stop-hollow-rally')?.addEventListener('click', () => triggerAdminEvent('stop-hollow-rally'));
  document.getElementById('start-geometric-cascade')?.addEventListener('click', () => triggerAdminEvent('geometric-cascade'));
  document.getElementById('start-quantum-boost')?.addEventListener('click', () => triggerAdminEvent('quantum-boost'));
  document.getElementById('stop-quantum-boost')?.addEventListener('click', () => triggerAdminEvent('stop-quantum-boost'));
  document.getElementById('start-upside-down')?.addEventListener('click', () => triggerAdminEvent('upside-down'));
  document.getElementById('stop-upside-down')?.addEventListener('click', () => triggerAdminEvent('stop-upside-down'));
  
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
