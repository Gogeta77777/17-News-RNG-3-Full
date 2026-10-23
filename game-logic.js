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
  { key: '17-news', name: '17 News', reward: 150, chance: 66.13, color: '#0f172a' },
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
  { key: 'the-ceo', name: 'The CEO', reward: 7000, chance: 0.05, color: '#000000', glowColor: '#f8fafc', isGlobal: true },
  { key: 'mrs-joseph-mcglashan', name: 'Mrs Joseph Mcglashan', reward: 9500, chance: 0.07, color: '#16a34a', glowColor: '#4ade80', isGlobal: true }
];

const diveGlobalOptions = [
  { key: 'fisher-baxter', name: 'Fisher Baxter', reward: 12000, chance: 0.05, color: '#7dd3fc', glowColor: '#dbeafe', diveOnly: true },
  { key: 'sharky', name: 'Sharky', reward: 4500, chance: 0.5, color: '#0ea5e9', glowColor: '#7dd3fc', diveOnly: true }
];

const POTIONS = {
  luck: { name: 'Luck Potion I', cost: 5000, multiplier: 2, duration: 120, effect: 'luck', effectKey: 'luck' },
  'luck-ii': { name: 'Luck Potion II', cost: 18000, multiplier: 3, duration: 120, effect: 'luck', effectKey: 'luck' },
  'luck-v': { name: 'Luck Potion V', cost: 0, multiplier: 5, duration: 120, effect: 'luck', effectKey: 'luck', craftOnly: true },
  speed: { name: 'Speed Potion I', cost: 3500, multiplier: 2, duration: 90, effect: 'speed', effectKey: 'speed' },
};

const ROTATING_SHOP_ITEMS = [
  { name: 'Portal Fragment', cost: 15000, rarity: 'epic' },
  { name: 'Clover Leaf', cost: 500, rarity: 'common' },
  { name: 'Sea Essence', cost: 300000, rarity: 'legendary' },
  { name: 'Molten Rock', cost: 1000, rarity: 'common' },
  { name: 'Ancient Ore', cost: 100000, rarity: 'legendary' }
];

const TITLES = [
  { id: 'owner', name: 'Owner', color: '#fbbf24', requirement: 'admin', description: 'Administrator' },
  { id: 'admin', name: 'Admin', color: '#fb7185', requirement: 'gift', description: 'Granted by Mr Fernanski; unlocks Mini Operations' },
  { id: 'veteran', name: 'Veteran', color: '#38bdf8', requirement: 'code:THETHREEQUEL', description: 'Redeem THETHREEQUEL' },
  { id: 'millionaire', name: 'Millionaire', color: '#4ade80', requirement: 'coins:1000000', description: 'Reach 1,000,000 coins' },
  { id: 'portalmancer', name: 'Portalmancer', color: '#a78bfa', requirement: 'portal', description: 'Open the portal gateway' },
  { id: 'locked-in', name: 'Locked In', color: '#22d3ee', requirement: 'spins:1000', description: 'Complete 1,000 rolls' },
  { id: 'endless-frequency', name: 'The Endless Frequency', color: '#60a5fa', requirement: 'spins:5000', description: 'Complete 5,000 rolls' },
  { id: 'potato', name: 'Potato', color: '#8b5a2b', requirement: 'old-potato-sticker', description: 'Find an Old Potato Sticker in a Treasure Chest' },
  { id: 'collector', name: 'Rarity Collector', color: '#34d399', requirement: 'drops:10', description: 'Collect 10 rarity drops' },
  { id: 'global-headliner', name: 'Global Headliner', color: '#fb7185', requirement: 'global:1', description: 'Find a global rarity' },
  { id: 'tidekeeper', name: 'Tidekeeper', color: '#2dd4bf', requirement: 'sea-realm', description: 'Permanently unlock Sea Realm' },
  { id: 'blacksmith', name: 'Blacksmith', color: '#fb923c', requirement: 'forge-realm', description: 'Permanently unlock Forge Realm' }
];

const CODE_REWARDS = {
  'THETHREEQUEL': { title: 'veteran', coins: 0 }
};

// ==================== GAME STATE ====================
let currentUser = null;
let isEnteringDimension = false;
let eventVisualLayer = null;
let cameraShakeTimer = null;
let cameraShakeEndTimer = null;
let diveCooldownTimer = null;
let diveCollectPending = false;
let autoRollTimer = null;
let gameState = {
  activeEffects: {},
  currentDimension: null,
  rotatingShopIndex: 0,
  shopNextRestockAt: 0,
  shopServerOffset: 0,
  shopRotationSlot: null,
  shopRefreshPending: false,
  shopRetryAt: 0,
  dive: null,
  deathSeaUnlocked: false,
  portalFragments: 0,
  seaEssence: 0,
  portalUnlocked: false,
  seaRealmUnlocked: false,
  forgeRealmUnlocked: false,
  autoRollEnabled: false,
  userTitles: [],
  activeTitle: null,
  potionInventory: { luck: 0, 'luck-ii': 0, speed: 0 },
  itemInventory: { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, event_controller: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0 }
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
        ...data,
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
    const div = document.createElement('div');
    const effectName = type === 'luck' ? 'Luck' : type === 'speed' ? 'Speed' : type;
    div.textContent = `${effectName} effect · ${Number(effect.multiplier) || 1}× · ${remaining}s`;
    container.appendChild(div);
  });
}

function getPotionMultiplier(potionType) {
  const effect = gameState.activeEffects[potionType];
  return effect && Date.now() < effect.endTime ? Math.max(1, Number(effect.multiplier) || 1) : 1;
}

// ==================== SHOP SYSTEM ====================
function getRotatingShopItems() {
  return [ROTATING_SHOP_ITEMS[gameState.rotatingShopIndex]];
}

async function loadShopRotation() {
  if (gameState.shopRefreshPending) return;
  gameState.shopRefreshPending = true;
  const response = await handleAPI('/api/shop/rotation');
  const rotation = response.rotation;
  const itemIndex = ROTATING_SHOP_ITEMS.findIndex(item => item.name === rotation?.name);
  if (!response.success || !rotation || itemIndex < 0) {
    gameState.shopRetryAt = Date.now() + 5000;
    gameState.shopRefreshPending = false;
    return;
  }

  const previousSlot = gameState.shopRotationSlot;
  let storedSlot = null;
  try {
    const value = Number(localStorage.getItem('rng3-shop-rotation-slot'));
    if (Number.isSafeInteger(value)) storedSlot = value;
  } catch {}
  gameState.rotatingShopIndex = itemIndex;
  gameState.shopNextRestockAt = Number(rotation.nextRestockAt);
  gameState.shopServerOffset = Number(rotation.serverTime) - Date.now();
  gameState.shopRotationSlot = Number(rotation.slot);
  gameState.shopRetryAt = 0;
  try {
    localStorage.setItem('rng3-shop-rotation-slot', String(gameState.shopRotationSlot));
  } catch {}
  renderRotatingShopItems();

  const rotationChanged = previousSlot !== null
    ? gameState.shopRotationSlot > previousSlot
    : storedSlot !== null && gameState.shopRotationSlot > storedSlot;
  if (rotationChanged && currentUser) showShopRestockNotice(ROTATING_SHOP_ITEMS[itemIndex]);
  gameState.shopRefreshPending = false;
  updateShopTimer();
}

function updateShopTimer() {
  const timer = document.getElementById('shop-timer');
  if (!timer) return;
  if (!gameState.shopNextRestockAt) {
    timer.textContent = 'Syncing';
    if (currentUser && Date.now() >= gameState.shopRetryAt) loadShopRotation();
    return;
  }
  const remainingMilliseconds = Math.max(0, gameState.shopNextRestockAt - (Date.now() + gameState.shopServerOffset));
  const remaining = Math.ceil(remainingMilliseconds / 1000);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  if (remainingMilliseconds <= 0 && Date.now() >= gameState.shopRetryAt) loadShopRotation();
}

function showShopRestockNotice(item) {
  document.querySelector('.shop-restock-notice')?.remove();
  const notice = document.createElement('aside');
  notice.className = 'shop-restock-notice';
  notice.setAttribute('role', 'status');
  const kicker = document.createElement('span');
  kicker.textContent = 'SHOP RESTOCKED';
  const detail = document.createElement('strong');
  detail.textContent = `${item.name} is now in stock`;
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'shop-restock-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss shop restock notice');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => notice.remove());
  notice.append(kicker, detail, dismiss);
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 12000);
}

function renderRotatingShopItems() {
  const rotatingDiv = document.getElementById('rotating-items');
  if (!rotatingDiv) return;
  rotatingDiv.innerHTML = '';
  getRotatingShopItems().forEach(item => {
    const card = document.createElement('div');
    card.className = 'shop-item';
    const emoji = item.name.includes('Fragment') ? '🔮' : item.name.includes('Clover') ? '🍀' : item.name.includes('Rock') ? '🌋' : item.name.includes('Ore') ? '⛏️' : '💧';
    card.innerHTML = `
      <h4 class="shop-item-name">${emoji} ${item.name}</h4>
      <p class="shop-item-price">🪙 ${formatCoins(item.cost)} coins</p>
      <button class="potion-buy-btn shop-item-buy">Buy</button>
    `;
    card.querySelector('.shop-item-buy')?.addEventListener('click', () => {
      buyShopItem(item.name);
    });
    rotatingDiv.appendChild(card);
  });
}

function renderShopGuide() {
  const guide = document.getElementById('rotating-shop-guide-items');
  if (!guide) return;
  guide.innerHTML = '';
  ROTATING_SHOP_ITEMS.forEach(item => {
    const row = document.createElement('div');
    row.className = 'shop-guide-item';
    const name = document.createElement('strong');
    name.textContent = item.name;
    const price = document.createElement('span');
    price.textContent = `${formatCoins(item.cost)} coins`;
    row.append(name, price);
    guide.appendChild(row);
  });
}

function renderShop() {
  updateShopTimer();
  renderRotatingShopItems();

  const potionsDiv = document.getElementById('potions-list');
  if (potionsDiv) {
    potionsDiv.innerHTML = '';
    Object.entries(POTIONS).filter(([, potion]) => !potion.craftOnly).forEach(([key, potion]) => {
      const card = document.createElement('div');
      card.className = 'potion-card';
      const emoji = key.startsWith('luck') ? '🍀' : '⚡';
      card.innerHTML = `
        <h4>${emoji} ${potion.name}</h4>
        <p>${potion.multiplier}x ${potion.effect} • ${potion.duration}s duration</p>
        <div class="potion-stats">
          <span>⚡ +${potion.multiplier}x ${potion.effect}</span>
          <span>⏱️ ${potion.duration}s active</span>
        </div>
        <div class="potion-cost">${potion.vialCost ? `🧪 ${potion.vialCost} Empty Vial · ` : ''}🪙 ${formatCoins(potion.cost)} coins</div>
        <div class="potion-purchase-controls">
          <button class="potion-buy-btn potion-buy">${potion.vialCost ? 'Craft' : 'Buy Now'}</button>
          <label class="potion-bulk-quantity">Qty<input class="potion-bulk-quantity-input" type="number" min="2" max="99" value="10" aria-label="Bulk quantity for ${potion.name}"></label>
          <button class="potion-buy-btn potion-bulk-buy">Bulk Buy</button>
        </div>
      `;
      card.querySelector('.potion-buy')?.addEventListener('click', () => buyPotion(key));
      card.querySelector('.potion-bulk-buy')?.addEventListener('click', () => {
        buyPotion(key, Number(card.querySelector('.potion-bulk-quantity-input')?.value));
      });
      potionsDiv.appendChild(card);
    });
  }
}

function buyPotion(potionType, quantity = 1) {
  const potion = POTIONS[potionType];
  if (!potion || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    showPopup('Choose a quantity from 1 to 99.', 'error');
    return;
  }

  const totalCost = potion.cost * quantity;
  const totalVialCost = (potion.vialCost || 0) * quantity;
  if (!currentUser || currentUser.coins < totalCost) {
    showPopup('Not enough coins!', 'error');
    return;
  }
  if ((Number(currentUser.items?.empty_vial) || 0) < totalVialCost) {
    showPopup(`Requires ${totalVialCost} Empty Vial to craft ${potion.name}.`, 'error');
    return;
  }

  handleAPI('/api/buy-potion', { method: 'POST', body: { potionType, quantity } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.potionInventory = currentUser.potions || { luck: 0, 'luck-ii': 0, speed: 0 };
      updateUI(currentUser);
      showPopup(`Purchased ${quantity} × ${potion.name}! Added to inventory.`);
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
      gameState.potionInventory = currentUser.potions || { luck: 0, 'luck-ii': 0, speed: 0 };
      updateUI(currentUser);
      showPopup(`${POTIONS[potionType].name} used. Matching luck and time effects stack.`);
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
  
  handleAPI('/api/buy-shop-item', { method: 'POST', body: { itemName } }).then(response => {
    if (response.success) {
      currentUser = response.user;
      gameState.itemInventory = currentUser.items || {};
      updateUI(currentUser);
      renderShop();
      showPopup(`Purchased ${itemName}!`);
    } else {
      if (response.status === 409) loadShopRotation();
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
  if ((Number(user.spins) || 0) >= 1000) existing.add('locked-in');
  if ((Number(user.spins) || 0) >= 5000) existing.add('endless-frequency');
  if (rarityTotal >= 10) existing.add('collector');
  if (['mr-fermanski', 'ellerslie-schoolcast', 'the-ceo', 'mrs-joseph-mcglashan'].some(key => Number(rarities[key]) > 0)) existing.add('global-headliner');
  if ((Number(user.items?.old_potato_sticker) || 0) >= 1) existing.add('potato');
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

  const forgeAction = document.getElementById('forge-realm-action');
  if (forgeAction && !forgeAction.dataset.bound) {
    forgeAction.addEventListener('click', enterOrUnlockForgeRealm);
    forgeAction.dataset.bound = 'true';
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
  const cooldownMs = gameState.dive?.remaining === 0 ? Math.max(0, Number(gameState.dive.cooldownUntil) - Date.now()) : 0;
  const cooldownText = cooldownMs ? ` · New dive in ${formatDiveTime(cooldownMs)}` : '';
  status.textContent = unlocked ? `Permanently unlocked · entry is free${cooldownText}` : `${essence} Sea Essence available · unlock costs 1`;
  const forgeAction = document.getElementById('forge-realm-action');
  const forgeStatus = document.getElementById('forge-realm-status');
  const forgeUnlocked = gameState.forgeRealmUnlocked;
  const molten = Number(gameState.itemInventory.molten_rock) || 0;
  const ore = Number(gameState.itemInventory.ancient_ore) || 0;
  if (forgeAction) {
    forgeAction.textContent = forgeUnlocked ? 'ENTER FORGE' : 'UNLOCK · 1 ORE + 30 ROCK';
    forgeAction.disabled = !forgeUnlocked && (ore < 1 || molten < 30);
  }
  if (forgeStatus) forgeStatus.textContent = forgeUnlocked
    ? 'Permanently unlocked · entry is free'
    : `${ore}/1 Ancient Ore · ${molten}/30 Molten Rock`;
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

async function enterOrUnlockForgeRealm() {
  if (isEnteringDimension) return;
  const action = document.getElementById('forge-realm-action');
  isEnteringDimension = true;
  if (action) action.disabled = true;
  try {
    if (!gameState.forgeRealmUnlocked) {
      const unlock = await handleAPI('/api/realms/forge/unlock', { method: 'POST' });
      if (!unlock.success || !unlock.user) throw new Error(unlock.error || 'Unable to unlock Forge Realm.');
      currentUser = unlock.user;
      updateUI(currentUser);
    }
    const entry = await handleAPI('/api/enter-dimension', { method: 'POST', body: { dimension: 'forge-realm' } });
    if (!entry.success || !entry.user) throw new Error(entry.error || 'Unable to enter Forge Realm.');
    currentUser = entry.user;
    updateUI(currentUser);
    closeRealmSelector();
    enterForgeRealm();
  } catch (error) {
    showPopup(error.message, 'error');
  } finally {
    isEnteringDimension = false;
    renderRealmSelector();
  }
}

function enterForgeRealm() {
  showRealmTransition('Forge Realm', 'enter', 'forge');
  document.getElementById('game-page').classList.add('hidden');
  document.getElementById('forge-dimension')?.classList.remove('hidden');
  gameState.currentDimension = 'forge-realm';
  window.updatePlayerActivity?.('At the Forge');
  renderForgeState();
}

function showRealmTransition(realmName, mode = 'enter', realmType = 'portal') {
  const overlay = document.getElementById('realm-transition-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.remove('sea-realm', 'forge-realm');
  overlay.classList.add(realmType === 'sea' ? 'sea-realm' : 'forge-realm');
  overlay.classList.toggle('is-leaving', mode === 'leave');
  overlay.innerHTML = `
    <div class="realm-transition-panel">
      <span class="realm-transition-kicker">${mode === 'enter' ? 'Entering' : 'Leaving'}</span>
      <strong>${realmName}</strong>
    </div>
  `;
  clearTimeout(showRealmTransition.timer);
  showRealmTransition.timer = setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('is-leaving');
  }, 1100);
}

function updateForgeCraftStatus() {
  const items = gameState.itemInventory;
  const potions = currentUser?.potions || {};
  const luckNeedVial = Math.max(0, 1 - (Number(items.empty_vial) || 0));
  const luckNeedPotion = Math.max(0, 3 - (Number(potions.luck) || 0));
  const controllerNeedClovers = Math.max(0, 10 - (Number(items.clovers) || 0));
  const controllerNeedStickers = Math.max(0, 3 - (Number(items.old_potato_sticker) || 0));

  const luckNote = document.getElementById('forge-luck-note');
  if (luckNote) {
    if (luckNeedVial > 0 || luckNeedPotion > 0) {
      const parts = [];
      if (luckNeedVial > 0) parts.push(`${luckNeedVial} more Empty Vial`);
      if (luckNeedPotion > 0) parts.push(`${luckNeedPotion} more Luck Potion I`);
      luckNote.textContent = `Need ${parts.join(' and ')} to craft this.`;
      luckNote.classList.add('needs-more');
    } else {
      luckNote.textContent = 'Ready to forge. This recipe is craftable now.';
      luckNote.classList.remove('needs-more');
    }
  }

  const controllerNote = document.getElementById('forge-controller-note');
  if (controllerNote) {
    if (controllerNeedClovers > 0 || controllerNeedStickers > 0) {
      const parts = [];
      if (controllerNeedClovers > 0) parts.push(`${controllerNeedClovers} more Clover Leaf${controllerNeedClovers > 1 ? 's' : ''}`);
      if (controllerNeedStickers > 0) parts.push(`${controllerNeedStickers} more Old Potato Sticker${controllerNeedStickers > 1 ? 's' : ''}`);
      controllerNote.textContent = `You still need ${parts.join(' and ')} before this works.`;
      controllerNote.classList.add('needs-more');
    } else {
      controllerNote.textContent = 'Ready to forge. You must craft this controller before activating any event.';
      controllerNote.classList.remove('needs-more');
    }
  }

  const useButton = document.getElementById('use-event-controller');
  if (useButton) {
    useButton.disabled = (Number(items.event_controller) || 0) < 1;
    useButton.title = (Number(items.event_controller) || 0) < 1
      ? 'Craft an Event Controller first before activating events.'
      : 'Activate the chosen event for 2 minutes.';
  }
}

function renderForgeState() {
  const items = gameState.itemInventory;
  const potions = currentUser?.potions || {};
  const refs = {
    'forge-clovers': items.clovers,
    'forge-stickers': items.old_potato_sticker,
    'forge-vials': items.empty_vial,
    'forge-luck': potions.luck,
    'forge-controllers': items.event_controller
  };
  Object.entries(refs).forEach(([id, count]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(count) || 0;
  });
  const luckButton = document.getElementById('craft-luck-v');
  const controllerButton = document.getElementById('craft-event-controller');
  const luckMissing = (Number(items.empty_vial) || 0) < 1 || (Number(potions.luck) || 0) < 3;
  const controllerMissing = (Number(items.clovers) || 0) < 10 || (Number(items.old_potato_sticker) || 0) < 3;
  if (luckButton) luckButton.disabled = luckMissing;
  if (controllerButton) controllerButton.disabled = controllerMissing;
  updateForgeCraftStatus();
}

let activeForgeMiniGame = null;

function startForgeMiniGame(recipe) {
  const overlay = document.getElementById('forge-mini-game');
  const meter = document.getElementById('forge-mini-fill');
  const status = document.getElementById('forge-mini-status');
  const button = document.getElementById('forge-mini-button');
  const cancel = document.getElementById('forge-mini-cancel');
  if (!overlay || !meter || !status || !button || !cancel) {
    craftForgeRecipeNow(recipe);
    return;
  }

  activeForgeMiniGame = {
    recipe,
    progress: 0,
    target: 10,
    interval: null,
    complete: false
  };

  overlay.classList.remove('hidden');
  meter.style.width = '0%';
  status.textContent = '0.0s / 10.0s';
  button.textContent = 'Click to charge';
  button.onclick = () => {
    if (!activeForgeMiniGame || activeForgeMiniGame.complete) return;
    activeForgeMiniGame.progress = Math.min(activeForgeMiniGame.target, activeForgeMiniGame.progress + 0.55);
    const percent = (activeForgeMiniGame.progress / activeForgeMiniGame.target) * 100;
    meter.style.width = `${percent}%`;
    status.textContent = `${activeForgeMiniGame.progress.toFixed(1)}s / ${activeForgeMiniGame.target.toFixed(1)}s`;
    if (activeForgeMiniGame.progress >= activeForgeMiniGame.target) {
      activeForgeMiniGame.complete = true;
      button.textContent = 'Forge complete';
      setTimeout(() => {
        overlay.classList.add('hidden');
        craftForgeRecipeNow(activeForgeMiniGame.recipe);
      }, 220);
    }
  };

  cancel.onclick = () => {
    overlay.classList.add('hidden');
    activeForgeMiniGame = null;
  };
}

async function craftForgeRecipe(recipe) {
  startForgeMiniGame(recipe);
}

async function craftForgeRecipeNow(recipe) {
  const response = await handleAPI('/api/forge/craft', { method: 'POST', body: { recipe } });
  if (!response.success || !response.user) {
    showPopup(response.error || 'Unable to craft that recipe.', 'error');
    activeForgeMiniGame = null;
    return;
  }
  currentUser = response.user;
  updateUI(currentUser);
  showPopup(recipe === 'luck-v' ? 'Crafted Luck Potion V.' : 'Crafted an Event Controller.');
  activeForgeMiniGame = null;
}

async function useForgeEventController() {
  const eventName = document.getElementById('forge-event-select')?.value;
  const response = await handleAPI('/api/forge/use-event-controller', { method: 'POST', body: { eventName } });
  if (!response.success || !response.user) {
    showPopup(response.error || 'Unable to activate the Event Controller.', 'error');
    return;
  }
  currentUser = response.user;
  updateUI(currentUser);
  showPopup(`${response.event.title} activated for two minutes.`);
}

function enterDeepSea() {
  showRealmTransition('Sea Realm', 'enter', 'sea');
  document.getElementById('game-page').classList.add('hidden');
  const dsDiv = document.getElementById('deep-sea-dimension');
  dsDiv.classList.remove('hidden');
  gameState.currentDimension = 'deep-sea';
  window.updatePlayerActivity?.('Diving in the Sea Realm');

  // Generate bubbles
  const bubbleContainer = document.querySelector('.bubbles');
  bubbleContainer.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.setProperty('--bubble-size', `${6 + Math.random() * 24}px`);
    bubble.style.animationDuration = (Math.random() * 6) + 's';
    bubble.style.animationDelay = Math.random() * 2 + 's';
    bubbleContainer.appendChild(bubble);
  }

  bindDiveControls();
  startDive();
  showPopup('Click the sonar signals to collect them.');
}

function bindDiveControls() {
  if (document.documentElement.dataset.diveControlsBound) return;
  document.getElementById('dive-rescan')?.addEventListener('click', startDive);
  document.documentElement.dataset.diveControlsBound = 'true';
}

async function startDive() {
  const response = await handleAPI('/api/sea/dive/start', { method: 'POST' });
  if (!response.success && response.status === 429 && response.dive) {
    renderDiveMap(response.dive);
    return;
  }
  if (!response.success || !response.dive) {
    showPopup(response.error || 'Unable to start the dive.', 'error');
    return;
  }
  gameState.dive = null;
  renderDiveMap(response.dive);
}

function renderDiveMap(dive) {
  const map = document.getElementById('dive-map');
  if (!map) return;
  const rebuildNodes = !gameState.dive || gameState.dive.nodes.map(node => node.id).join() !== dive.nodes.map(node => node.id).join();
  gameState.dive = dive;
  if (rebuildNodes) {
    map.querySelectorAll('.dive-cache').forEach(node => node.remove());
    dive.nodes.forEach(node => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'dive-cache';
      marker.dataset.nodeId = node.id;
      marker.style.left = `${node.x}%`;
      marker.style.top = `${node.y}%`;
      marker.setAttribute('aria-label', `Collect sonar signal ${node.id.slice(0, 8)}`);
      marker.textContent = '✧';
      marker.addEventListener('click', () => collectDiveSignal(node.id, marker));
      map.appendChild(marker);
    });
  }
  dive.nodes.forEach(node => {
    const marker = map.querySelector(`[data-node-id="${node.id}"]`);
    marker?.classList.toggle('collected', node.collected);
    if (marker) {
      marker.disabled = node.collected;
      marker.textContent = node.collected ? '✓' : '✧';
    }
  });
  const remaining = document.getElementById('dive-remaining');
  const status = document.getElementById('dive-status');
  if (remaining) remaining.textContent = `${dive.remaining} SIGNAL${dive.remaining === 1 ? '' : 'S'} LEFT`;
  if (status) status.textContent = dive.remaining ? 'Click any signal to recover its contents.' : 'All signals recovered. Wait two minutes before your next dive.';
  updateDiveCooldown(dive);
}

function formatDiveTime(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateDiveCooldown(dive = gameState.dive) {
  const rescan = document.getElementById('dive-rescan');
  const status = document.getElementById('dive-status');
  if (!dive) return;
  const remainingMs = Math.max(0, Number(dive.cooldownUntil) - Date.now());
  const timeText = formatDiveTime(remainingMs);
  if (rescan) {
    rescan.disabled = dive.remaining > 0 || remainingMs > 0;
    rescan.textContent = dive.remaining > 0 ? 'COLLECT ALL SIGNALS' : remainingMs > 0 ? `NEW DIVE · ${timeText}` : 'NEW DIVE';
  }
  if (dive.remaining === 0 && status) {
    status.textContent = remainingMs > 0
      ? `All signals recovered. Wait two minutes; ${timeText} remaining.`
      : 'All signals recovered. Your next dive is ready.';
  }
  const realmStatus = document.getElementById('sea-realm-status');
  if (realmStatus && gameState.seaRealmUnlocked) {
    const nextDive = dive.remaining === 0
      ? remainingMs > 0 ? ` · New dive in ${timeText}` : ' · New dive is ready'
      : '';
    realmStatus.textContent = `Permanently unlocked · entry is free${nextDive}`;
  }
  clearInterval(diveCooldownTimer);
  diveCooldownTimer = null;
  if (dive.remaining === 0 && remainingMs > 0) {
    diveCooldownTimer = setInterval(() => updateDiveCooldown(), 1000);
  }
}

async function collectDiveSignal(nodeId, marker) {
  if (diveCollectPending || marker.disabled) return;
  diveCollectPending = true;
  marker.disabled = true;
  marker.classList.add('collecting');
  try {
    const response = await handleAPI('/api/sea/dive/collect', { method: 'POST', body: { nodeId } });
    if (!response.success || !response.dive || !response.result) {
      marker.disabled = false;
      marker.classList.remove('collecting');
      showPopup(response.error || 'Unable to collect that signal.', 'error');
      return;
    }
    renderDiveMap(response.dive);
    const result = response.result;
    currentUser = result.user;
    updateUI(currentUser);
    document.getElementById('dive-result').textContent = `${result.name} · ${formatRollChance(result.rollChance)}`;
    if (result.itemType === 'potion') showPopup(`Found ${result.name}; added to your potion inventory.`);
    else if (result.key === 'treasure-chest') showPopup(`Treasure Chest recovered! +${formatCoins(result.reward)} coins.`);
    else showPopup(`Recovered ${result.name}! +${formatCoins(result.reward)} coins.`, result.color || '#38bdf8');
    if (result.globalRevealToken) {
      handleAPI('/api/announce-global-reveal', { method: 'POST', body: { token: result.globalRevealToken } });
    }
  } finally {
    diveCollectPending = false;
  }
}

function exitDeepSea() {
  clearInterval(diveCooldownTimer);
  diveCooldownTimer = null;
  showRealmTransition('Sea Realm', 'leave', 'sea');
  document.getElementById('deep-sea-dimension').classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  gameState.currentDimension = null;
  window.updatePlayerActivity?.('At the RNG console');
}

function exitForgeRealm() {
  showRealmTransition('Forge Realm', 'leave', 'forge');
  document.getElementById('forge-dimension')?.classList.add('hidden');
  document.getElementById('game-page').classList.remove('hidden');
  gameState.currentDimension = null;
  window.updatePlayerActivity?.('At the RNG console');
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
      const titleName = TITLES.find(t => t.id === response.title)?.name;
      showPopup(titleName ? `Code redeemed! Title unlocked: ${titleName}` : `Code redeemed! ${response.reward}`);
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
        const rarity = [...rarityOptions, ...globalOptions, ...diveGlobalOptions].find(r => r.key === key);
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
    const hasPotions = Object.keys(POTIONS).some(key => (Number(potions[key]) || 0) > 0);
    if (!hasPotions) {
      potGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center; padding: 20px;">🧪 No potions. Buy some in the shop!</div>';
    } else {
      Object.entries(POTIONS).forEach(([key, potion]) => {
        const count = potions[key] || 0;
        if (count <= 0) return;
        const emoji = key.startsWith('luck') ? '🍀' : '⚡';
        const card = document.createElement('div');
        card.className = 'inventory-item potion-inventory-item';
        card.innerHTML = `
          <div class="potion-inventory-copy">
            <h4>${emoji} ${potion.name}</h4>
            <span>x${count} available</span>
          </div>
          <button class="btn potion-use" type="button">Use Now</button>
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
      { name: 'Sea Essence', count: gameState.itemInventory.essence || 0, emoji: '💧' },
      { name: 'Molten Rock', count: gameState.itemInventory.molten_rock || 0, emoji: '🌋' },
      { name: 'Ancient Ore', count: gameState.itemInventory.ancient_ore || 0, emoji: '⛏️' },
      { name: 'Event Controller', count: gameState.itemInventory.event_controller || 0, emoji: '🎛️' },
      { name: 'Treasure Chest', count: gameState.itemInventory.treasure_chest || 0, emoji: '🧰', openChest: true },
      { name: 'Old Potato Sticker', count: gameState.itemInventory.old_potato_sticker || 0, emoji: '🏷️' },
      { name: 'Empty Vial', count: gameState.itemInventory.empty_vial || 0, emoji: '🧪' }
    ];
    items.forEach(item => {
      if (item.count > 0) {
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.innerHTML = `<div><h4>${item.emoji} ${item.name}</h4><span>${item.count}x available</span></div>${item.openChest ? '<button class="btn open-treasure-chest" type="button">Open</button>' : ''}`;
        card.querySelector('.open-treasure-chest')?.addEventListener('click', openTreasureChest);
        itemGrid.appendChild(card);
      }
    });
    if (items.every(i => i.count === 0)) {
      itemGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(241,245,249,0.7);text-align:center; padding: 20px;">🛍️ No items yet. Purchase from the shop!</div>';
    }
  }
}

async function openTreasureChest() {
  const response = await handleAPI('/api/sea/open-treasure-chest', { method: 'POST' });
  if (!response.success || !response.user) {
    showPopup(response.error || 'Unable to open the Treasure Chest.', 'error');
    return;
  }
  currentUser = response.user;
  updateUI(currentUser);
  showPopup('Found an Old Potato Sticker and an Empty Vial!');
}

function renderRarityCatalog() {
  const renderRows = (listId, options) => {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    options.sort((left, right) => left.chance - right.chance).forEach((rarity, index) => {
      const row = document.createElement('div');
      const rarityColor = ['#0f172a', '#000000', '#1e3a8a'].includes(rarity.color.toLowerCase()) ? '#93c5fd' : rarity.color;
      row.className = `rarity-catalog-row${rarity.isGlobal ? ' global-catalog-row' : ''}${rarity.diveOnly ? ' dive-only-rarity' : ''}`;
      row.style.setProperty('--rarity-color', rarityColor);
      if (rarity.isGlobal) row.style.setProperty('--rarity-glow', rarity.glowColor || rarity.color);
      row.innerHTML = `<span class="rarity-rank">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(rarity.name)}${rarity.diveOnly ? '<small> SEA ONLY</small>' : ''}</strong><span class="rarity-catalog-rate">${rarity.chance}%</span>`;
      list.appendChild(row);
    });
  };
  renderRows('rarity-catalog-list', [...rarityOptions, ...globalOptions]);

  const secretCatalog = document.getElementById('secret-index');
  const secretSummary = secretCatalog?.querySelector('summary');
  if (secretCatalog && secretSummary && !secretCatalog.dataset.gateBound) {
    const blockLockedAccess = event => {
      if (gameState.portalUnlocked) return;
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      showPopup('Unlock the Portal Gateway to view realm rarities.', 'error');
    };
    secretSummary.addEventListener('click', blockLockedAccess);
    secretSummary.addEventListener('keydown', blockLockedAccess);
    secretCatalog.dataset.gateBound = 'true';
  }
  renderRows('secret-catalog-list', gameState.portalUnlocked ? diveGlobalOptions.filter(rarity => !rarity.isGlobal) : []);
  if (secretCatalog) secretCatalog.open = false;
  if (secretSummary) {
    secretSummary.setAttribute('aria-disabled', String(!gameState.portalUnlocked));
    secretSummary.querySelector('span').textContent = gameState.portalUnlocked
      ? 'Realm rarities · rarest first'
      : 'Locked · unlock Portal Gateway';
  }
}

// ==================== UI UPDATES ====================
function updateUI(user) {
  currentUser = user;
  gameState.totalRolls = Number(user.spins) || 0;
  if (user.is_admin) setShutdownScreen(false);
  
  // Load game state from user
  gameState.itemInventory = user.items || { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, event_controller: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0 };
  gameState.potionInventory = user.potions || { luck: 0, 'luck-ii': 0, speed: 0 };
  gameState.userTitles = user.titles || [];
  gameState.activeTitle = user.active_title || null;
  gameState.activeEffects = user.active_effects || {};
  gameState.portalUnlocked = user.portal_unlocked || false;
  gameState.seaRealmUnlocked = user.sea_realm_unlocked || false;
  gameState.forgeRealmUnlocked = user.forge_realm_unlocked || false;
  
  document.getElementById('game-username').textContent = user.username;
  document.getElementById('game-coins').textContent = `🪙 ${formatCoins(user.coins)} coins`;
  const totalRolls = document.getElementById('settings-total-rolls');
  if (totalRolls) totalRolls.textContent = formatCoins(user.spins || 0);

  // Show admin button if user is admin
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    if (user.is_admin || (user.titles || []).includes('admin')) {
      adminBtn.classList.remove('hidden');
      adminBtn.textContent = user.is_admin ? 'Admin Panel' : 'Mini Operations';
    } else {
      adminBtn.classList.add('hidden');
    }
  }

  document.getElementById('reward-display').textContent = `🪙 Reward: 0 coins`;

  checkTitleUnlocks(user);
  renderTitles();
  renderInventory(user);
  renderRarityCatalog();
  if (!gameState.shopNextRestockAt) loadShopRotation();
  renderShop();
  updatePortalUI();
  renderForgeState();
  updatePotionDisplay();
  renderRealmSelector();
  syncCurrentActivity();
  updateAutoRollUI();
}

function updateAutoRollUI() {
  const button = document.getElementById('auto-roll-btn');
  if (!button) return;
  const unlocked = gameState.totalRolls >= 100;
  button.disabled = !unlocked;
  button.textContent = unlocked ? `AUTO ROLL ${gameState.autoRollEnabled ? 'ON' : 'OFF'}` : `AUTO ROLL · ${gameState.totalRolls}/100`;
  button.setAttribute('aria-pressed', String(gameState.autoRollEnabled));
  button.title = unlocked ? 'Toggle automatic rolling' : 'Unlocks after 100 total rolls';
}

function syncCurrentActivity() {
  if (gameState.currentDimension === 'deep-sea') {
    window.updatePlayerActivity?.('Diving in the Sea Realm');
    return;
  }
  if (gameState.currentDimension === 'forge-realm') {
    window.updatePlayerActivity?.('At the Forge');
    return;
  }
  const activityByTab = {
    inventory: 'Browsing inventory',
    shop: 'Using the shop',
    titles: 'Browsing titles',
    chat: 'In chat',
    settings: 'Viewing settings'
  };
  window.updatePlayerActivity?.(activityByTab[document.querySelector('.content-tab.active')?.dataset.tab] || 'At the RNG console');
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
      ? gameState.forgeRealmUnlocked ? 'Sea Realm and Forge Realm are permanently unlocked.' : 'Sea Realm unlocked · Forge Realm needs 1 Ancient Ore and 30 Molten Rock.'
      : 'Choose a realm · Sea Realm costs 1 Essence; Forge Realm costs 1 Ancient Ore and 30 Molten Rock.';
  } else {
    if (lock) lock.style.display = fragments < 10 ? 'block' : 'block';
    if (unlockBtn) unlockBtn.style.display = fragments >= 10 ? 'inline-flex' : 'none';
    if (status) status.textContent = fragments >= 10 ? 'Ready to unlock' : 'Locked';
    if (fragmentsText) fragmentsText.textContent = `Requires: 10 Portal Fragments (${fragments}/10)`;
  }
  renderRarityCatalog();
}

// ==================== CHAT SYSTEM ====================
function formatChatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return time;
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${day} · ${time}`;
}

function addChatMessage(username, message, timestamp, isSystem = false, title = null, titleColor = '#7dd3fc', isGlobalDrop = false, announceGlobalDrop = false, isAnnouncement = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const msgEl = document.createElement('div');
  msgEl.className = isAnnouncement ? 'chat-message admin-announcement-message' : isSystem ? 'chat-message system-message' : `chat-message${isGlobalDrop ? ' global-drop-message' : ''}`;
  msgEl.dataset.messageId = timestamp;
  if (isGlobalDrop) msgEl.style.setProperty('--drop-glow', titleColor || '#38bdf8');
  
  const time = formatChatTimestamp(timestamp);
  
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
          <label>Grant potion<select name="potion">${Object.entries(POTIONS).map(([key, potion]) => `<option value="${key}">${escapeHtml(potion.name)}</option>`).join('')}</select></label>
          <label>Qty<input name="amount" type="number" min="1" max="99" value="1" required></label>
          <button class="btn" type="submit">Grant</button>
        </form>
        <form class="admin-adjust-form" data-adjustment="item">
          <label>Grant item<select name="item"><option value="fragments">Portal fragments</option><option value="clovers">Clover leaves</option><option value="essence">Sea essence</option><option value="molten_rock">Molten Rock</option><option value="ancient_ore">Ancient Ore</option><option value="event_controller">Event Controller</option><option value="old_potato_sticker">Old Potato Sticker</option><option value="empty_vial">Empty Vial</option><option value="treasure_chest">Treasure Chest</option></select></label>
          <label>Qty<input name="amount" type="number" min="1" max="99" value="1" required></label>
          <button class="btn" type="submit">Grant</button>
        </form>
        ${String(currentUser?.username || '').toLowerCase() === 'mr_fernanski' ? `<form class="admin-title-form"><span>Admin title</span><button class="btn" type="submit">${(user.titles || []).includes('admin') ? 'Revoke title' : 'Grant title'}</button></form>` : ''}
        <form class="admin-forge-form"><span>Forge Realm</span><button class="btn" type="submit">${user.forge_realm_unlocked ? 'Revoke access' : 'Grant access'}</button></form>
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
    row.querySelector('.admin-title-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const result = await handleAPI(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'POST',
        body: { type: 'title', grant: !(user.titles || []).includes('admin') }
      });
      if (!result.success) {
        showPopup(result.error || 'Unable to update title.', 'error');
        return;
      }
      showPopup(`${(user.titles || []).includes('admin') ? 'Revoked' : 'Granted'} the Admin title ${user.username === currentUser.username ? 'for your account' : `for ${user.username}`}.`);
      loadAdminUsers();
    });
    row.querySelector('.admin-forge-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const grant = !user.forge_realm_unlocked;
      const result = await handleAPI(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'POST', body: { type: 'forge-realm', grant }
      });
      if (!result.success) {
        showPopup(result.error || 'Unable to update Forge access.', 'error');
        return;
      }
      showPopup(`${grant ? 'Granted' : 'Revoked'} Forge Realm access for ${user.username}.`);
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

let miniAdminActiveEvent = null;
let miniAdminRefreshTimer = null;

async function loadMiniAdminOverview() {
  const roster = document.getElementById('mini-user-roster');
  const status = document.getElementById('mini-ops-status');
  if (!roster || !(currentUser?.is_admin || (currentUser?.titles || []).includes('admin'))) return;
  const response = await handleAPI('/api/mini-admin/overview');
  if (!response.success) {
    if (status) status.textContent = response.error || 'Unable to load player activity.';
    return;
  }
  miniAdminActiveEvent = response.activeEvent;
  if (status) status.textContent = `${response.onlineCount} online · Active event: ${response.activeEvent?.title || 'none'}`;
  roster.innerHTML = response.users.map(user => `
    <div class="mini-user-row">
      <span class="mini-user-presence ${user.online ? 'online' : ''}" aria-hidden="true"></span>
      <strong>${escapeHtml(user.username)}</strong>
      <span>${escapeHtml(user.activity)}</span>
      <small>${formatCoins(user.coins)} coins · ${user.spins} rolls</small>
    </div>
  `).join('') || '<p class="admin-empty-state">No player records yet.</p>';
  const stop = document.querySelector('[data-mini-stop]');
  if (stop) stop.disabled = !response.activeEvent || response.activeEvent.initiatedBy !== currentUser.username;
}

function renderGlobalDropOptions() {
  const typeSelect = document.getElementById('global-drop-type');
  const keySelect = document.getElementById('global-drop-key');
  if (!typeSelect || !keySelect) return;
  const optionsByType = {
    rarity: [...rarityOptions, ...globalOptions, ...diveGlobalOptions].filter(option => !option.isItem),
    potion: Object.entries(POTIONS).map(([key, potion]) => ({ key, name: potion.name })),
    item: [
      { key: 'fragments', name: 'Portal Fragment' }, { key: 'clovers', name: 'Clover Leaf' },
      { key: 'essence', name: 'Sea Essence' }, { key: 'molten_rock', name: 'Molten Rock' },
      { key: 'ancient_ore', name: 'Ancient Ore' }, { key: 'event_controller', name: 'Event Controller' },
      { key: 'old_potato_sticker', name: 'Old Potato Sticker' },
      { key: 'empty_vial', name: 'Empty Vial' }, { key: 'treasure_chest', name: 'Treasure Chest' }
    ]
  };
  const seen = new Set();
  keySelect.innerHTML = optionsByType[typeSelect.value].filter(option => {
    if (seen.has(option.key)) return false;
    seen.add(option.key);
    return true;
  }).map(option => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.name)}</option>`).join('');
}

function setupAdminTools() {
  const typeSelect = document.getElementById('global-drop-type');
  typeSelect?.addEventListener('change', renderGlobalDropOptions);
  renderGlobalDropOptions();
  document.getElementById('global-drop-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const response = await handleAPI('/api/admin/global-drop', {
      method: 'POST',
      body: { type: fields.get('type'), key: fields.get('key'), amount: Number(fields.get('amount')) }
    });
    if (!response.success) {
      showPopup(response.error || 'Unable to send the global drop.', 'error');
      return;
    }
    showPopup(`${response.amount} × ${response.name} granted to ${response.count} accounts.`);
  });
  document.querySelectorAll('[data-mini-event]').forEach(button => button.addEventListener('click', async () => {
    const response = await handleAPI('/api/mini-admin/event', {
      method: 'POST', body: { eventName: button.dataset.miniEvent, action: 'start' }
    });
    if (!response.success) showPopup(response.error || 'Unable to launch mini event.', 'error');
    else showPopup(`${response.event.title} is live.`);
    loadMiniAdminOverview();
  }));
  document.querySelector('[data-mini-stop]')?.addEventListener('click', async () => {
    const response = await handleAPI('/api/mini-admin/event', {
      method: 'POST', body: { eventName: miniAdminActiveEvent?.eventName, action: 'stop' }
    });
    if (!response.success) showPopup(response.error || 'Unable to end mini event.', 'error');
    else showPopup(`${miniAdminActiveEvent?.title || 'Event'} ended.`);
    loadMiniAdminOverview();
  });
  document.getElementById('mini-announcement-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const response = await handleAPI('/api/mini-admin/announcement', {
      method: 'POST', body: { title: fields.get('title'), content: fields.get('content') }
    });
    if (!response.success) {
      showPopup(response.error || 'Unable to send the announcement.', 'error');
      return;
    }
    form.reset();
    showPopup('Mini Operations announcement sent.');
  });
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

const LIVE_EVENT_PRESENTATION = {
  'starlight-surge': { className: 'starlight-surge', startId: 'activate-starlight-surge', stopId: 'deactivate-starlight-surge' },
  'meteor-shower': { className: 'meteor-shower-live', startId: 'activate-meteor-shower', stopId: 'deactivate-meteor-shower' },
  'abyssal-resonance': { className: 'abyssal-resonance-live', startId: 'activate-abyssal-resonance', stopId: 'deactivate-abyssal-resonance', shakeEveryMs: 26000 }
};

function triggerCameraShake() {
  document.body.classList.remove('event-camera-shake');
  void document.body.offsetWidth;
  document.body.classList.add('event-camera-shake');
  clearTimeout(cameraShakeEndTimer);
  cameraShakeEndTimer = setTimeout(() => document.body.classList.remove('event-camera-shake'), 720);
}

function clearEventVisuals() {
  eventVisualLayer?.remove();
  eventVisualLayer = null;
  clearInterval(cameraShakeTimer);
  clearTimeout(cameraShakeEndTimer);
  cameraShakeTimer = null;
  cameraShakeEndTimer = null;
  document.body.classList.remove('event-camera-shake');
  Object.values(LIVE_EVENT_PRESENTATION).forEach(event => document.body.classList.remove(event.className));
}

function createAdminEventVisual(eventName) {
  clearEventVisuals();
  const presentation = LIVE_EVENT_PRESENTATION[eventName];
  if (!presentation) return;
  document.body.classList.add(presentation.className);
  const layer = document.createElement('div');
  layer.className = `event-visual-layer event-visual-${eventName}`;
  layer.setAttribute('aria-hidden', 'true');
  if (eventName === 'meteor-shower') {
    for (let index = 0; index < 18; index += 1) {
      const meteor = document.createElement('span');
      meteor.className = 'event-meteor-streak';
      meteor.style.setProperty('--meteor-left', `${Math.random() * 120 - 10}%`);
      meteor.style.setProperty('--meteor-delay', `${Math.random() * -9}s`);
      meteor.style.setProperty('--meteor-duration', `${2.5 + Math.random() * 2.5}s`);
      meteor.style.setProperty('--meteor-size', `${10 + Math.random() * 12}px`);
      layer.appendChild(meteor);
    }
  } else if (eventName === 'starlight-surge') {
    for (let index = 0; index < 24; index += 1) {
      const star = document.createElement('span');
      star.className = 'event-falling-star';
      star.style.setProperty('--star-left', `${Math.random() * 100}%`);
      star.style.setProperty('--star-delay', `${Math.random() * -12}s`);
      star.style.setProperty('--star-duration', `${5 + Math.random() * 8}s`);
      star.style.setProperty('--star-size', `${3 + Math.random() * 6}px`);
      layer.appendChild(star);
    }
  }
  if (eventName === 'abyssal-resonance') {
    for (let index = 0; index < 24; index += 1) {
      const bubble = document.createElement('span');
      bubble.className = 'event-abyss-bubble';
      bubble.style.setProperty('--bubble-left', `${Math.random() * 100}%`);
      bubble.style.setProperty('--bubble-size', `${6 + Math.random() * 18}px`);
      bubble.style.setProperty('--bubble-delay', `${Math.random() * -14}s`);
      bubble.style.setProperty('--bubble-duration', `${8 + Math.random() * 10}s`);
      layer.appendChild(bubble);
    }
  }
  document.body.appendChild(layer);
  eventVisualLayer = layer;
  if (presentation.shakeEveryMs) {
    triggerCameraShake();
    cameraShakeTimer = setInterval(triggerCameraShake, presentation.shakeEveryMs);
  }
}

function applyThemeEvent(eventData, legacyInitiatedBy = 'Admin') {
  const event = typeof eventData === 'string' ? { eventName: eventData, initiatedBy: legacyInitiatedBy } : eventData || {};
  const eventName = String(event.eventName || '').toLowerCase();
  const presentation = LIVE_EVENT_PRESENTATION[eventName];
  if (!presentation) return;
  const active = event.active !== false;
  const title = event.title || eventName.replaceAll('-', ' ');
  const description = event.description || 'Special rewards are active';
  const status = document.getElementById(`${eventName}-status`);
  const startButton = document.getElementById(presentation.startId);
  const stopButton = document.getElementById(presentation.stopId);

  if (active) {
    createAdminEventVisual(eventName);
    if (startButton) startButton.hidden = true;
    if (stopButton) stopButton.hidden = false;
    if (status) status.textContent = `LIVE · ${description}`;
  } else {
    clearEventVisuals();
    if (startButton) startButton.hidden = false;
    if (stopButton) stopButton.hidden = true;
    if (status) status.textContent = 'Ready · stays live until ended';
  }

  const eventBar = document.getElementById('active-event-bar');
  const eventTitle = document.getElementById('active-event-title');
  const eventDetails = document.getElementById('active-event-details');
  if (eventTitle) eventTitle.textContent = title;
  if (eventDetails) eventDetails.textContent = active ? description : '';
  eventBar?.classList.toggle('hidden', !active);
  const initiatedBy = event.initiatedBy || 'Admin';
  showPopup(active ? `${title} activated by ${initiatedBy}!` : `${title} ended.`, active ? '#38bdf8' : '#64748b');
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
      window.updatePlayerActivity?.('At the RNG console');
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
      window.updatePlayerActivity?.('At the RNG console');
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
    window.updatePlayerActivity?.('At the RNG console');
    setupPortalUI();
    setupRollButton();
  }
}

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await handleAPI('/api/logout', { method: 'POST' });
  clearInterval(autoRollTimer);
  autoRollTimer = null;
  gameState.autoRollEnabled = false;
  currentUser = null;
  hideGamePage();
  showLanding();
  showPopup('Logged out successfully');
});

document.getElementById('exit-dimension')?.addEventListener('click', exitDeepSea);
document.getElementById('exit-forge-dimension')?.addEventListener('click', exitForgeRealm);
document.getElementById('craft-luck-v')?.addEventListener('click', () => craftForgeRecipe('luck-v'));
document.getElementById('craft-event-controller')?.addEventListener('click', () => craftForgeRecipe('event-controller'));
document.getElementById('use-event-controller')?.addEventListener('click', useForgeEventController);

function getRarityDisplayColor(rarity) {
  return ['#0f172a', '#000000', '#1e3a8a'].includes((rarity.color || '').toLowerCase())
    ? (rarity.glowColor || '#93c5fd')
    : rarity.color || '#f8fafc';
}

function formatRollChance(chance) {
  const value = Number(chance);
  if (!Number.isFinite(value) || value <= 0) return 'Chance: —';
  return `Chance: ${value < 0.001 ? '<0.001' : value.toFixed(value < 0.01 ? 4 : 3)}%`;
}

async function animateRarityRoll(rollDisplay, result) {
  const catalog = [...rarityOptions, ...globalOptions];
  const speedMultiplier = getPotionMultiplier('speed');
  rollDisplay.classList.remove('global-rarity-reveal');
  rollDisplay.style.removeProperty('--roll-glow');

  for (let step = 0; step < 18; step += 1) {
    if (result.isGlobal && step === 13) rollDisplay.classList.add('global-anticipation');
    const rarity = catalog[Math.floor(Math.random() * catalog.length)];
    rollDisplay.textContent = rarity.name;
    rollDisplay.style.color = getRarityDisplayColor(rarity);
    rollDisplay.style.textShadow = `0 0 14px ${rarity.glowColor || rarity.color}`;
    rollDisplay.classList.remove('rarity-slot-tick');
    void rollDisplay.offsetWidth;
    rollDisplay.classList.add('rarity-slot-tick');
    await new Promise(resolve => setTimeout(resolve, (42 + step * 7) / speedMultiplier));
  }

  rollDisplay.classList.remove('global-anticipation');
  rollDisplay.classList.remove('rarity-slot-tick');
  rollDisplay.style.color = getRarityDisplayColor(result);
  rollDisplay.style.textShadow = `0 0 20px ${result.glowColor || result.color || '#38bdf8'}`;
  rollDisplay.classList.toggle('global-rarity-reveal', Boolean(result.isGlobal));
  if (result.isGlobal) rollDisplay.style.setProperty('--roll-glow', result.glowColor || result.color);
  rollDisplay.textContent = result.name;
}

// ==================== ROLL BUTTON ====================
function setupRollButton() {
  const rollBtn = document.getElementById('roll-btn');
  if (!rollBtn || rollBtn.dataset.bound) return;

  rollBtn.dataset.bound = 'true';
  document.getElementById('auto-roll-btn')?.addEventListener('click', () => {
    if (gameState.totalRolls < 100) {
      showPopup('Auto Roll unlocks after 100 total rolls.', 'error');
      return;
    }
    gameState.autoRollEnabled = !gameState.autoRollEnabled;
    clearInterval(autoRollTimer);
    autoRollTimer = gameState.autoRollEnabled
      ? setInterval(() => {
        if (currentUser && !gameState.currentDimension && !rollBtn.disabled) rollBtn.click();
      }, 500)
      : null;
    updateAutoRollUI();
  });

  rollBtn.addEventListener('click', async () => {
    if (!currentUser) {
      showPopup('Login first to roll', 'error');
      return;
    }
    if (rollBtn.disabled) return;

    const rollDisplay = document.getElementById('roll-display');
    const chanceDisplay = document.getElementById('roll-chance-display');
    const rewardDisplay = document.getElementById('reward-display');
    if (!rollDisplay || !rewardDisplay) return;

    setLoading(rollBtn, true, 'ROLLING...');
    rollDisplay.textContent = 'Drawing signal...';
    rollDisplay.style.opacity = '1';
    if (chanceDisplay) chanceDisplay.textContent = 'Chance: —';

    const response = await handleAPI('/api/spin', {
      method: 'POST',
      body: { dimension: gameState.currentDimension || null, autoRoll: gameState.autoRollEnabled }
    });

    if (response.success && response.result && response.user) await animateRarityRoll(rollDisplay, response.result);

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
    rollDisplay.style.color = getRarityDisplayColor(result);
    rollDisplay.style.textShadow = `0 0 20px ${result.glowColor || result.color || '#38bdf8'}`;
    rollDisplay.classList.toggle('global-rarity-reveal', Boolean(result.isGlobal));
    if (result.isGlobal) rollDisplay.style.setProperty('--roll-glow', result.glowColor || result.color);
    else rollDisplay.style.removeProperty('--roll-glow');
    rollDisplay.textContent = `${result.name}${multiplierDisplay}${luckDisplay}`;
    if (chanceDisplay) chanceDisplay.textContent = formatRollChance(result.rollChance);
    
    rewardDisplay.textContent = `🪙 Reward: ${formatCoins(result.reward)} coins`;
    rewardDisplay.style.color = '#7dd3fc';
    
    showRewardPopup(`🪙 +${formatCoins(result.reward)} coins!`);
    if (result.isGlobal && result.globalRevealToken) {
      handleAPI('/api/announce-global-reveal', { method: 'POST', body: { token: result.globalRevealToken } });
    }
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
      syncCurrentActivity();
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
    if (currentUser && (currentUser.is_admin || (currentUser.titles || []).includes('admin'))) {
      const panel = document.getElementById('admin-panel');
      const isMini = !currentUser.is_admin;
      panel?.classList.toggle('mini-admin', isMini);
      const heading = panel?.querySelector('.admin-header h1');
      if (heading) heading.textContent = isMini ? 'Mini Operations' : 'Admin Control Center';
      document.getElementById('refresh-admin-users')?.classList.toggle('hidden', isMini);
      showPage('admin-panel');
      if (currentUser.is_admin) {
        loadAdminUsers();
        loadShutdownState();
        loadAdminHeadline();
      }
      loadMiniAdminOverview();
      clearInterval(miniAdminRefreshTimer);
      miniAdminRefreshTimer = setInterval(loadMiniAdminOverview, 10000);
    } else {
      showPopup('Admin access denied', 'error');
    }
  });
  document.getElementById('back-to-game')?.addEventListener('click', () => {
    document.getElementById('admin-panel')?.classList.remove('mini-admin');
    if (miniAdminRefreshTimer) clearInterval(miniAdminRefreshTimer);
    showPage('game');
  });
  document.getElementById('refresh-admin-users')?.addEventListener('click', loadAdminUsers);
  setupAdminTools();
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

  Object.entries(LIVE_EVENT_PRESENTATION).forEach(([eventName, presentation]) => {
    document.getElementById(presentation.startId)?.addEventListener('click', () => triggerAdminEvent(eventName));
    document.getElementById(presentation.stopId)?.addEventListener('click', () => triggerAdminEvent(eventName, 'stop'));
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

  const shopGuide = document.getElementById('rotating-shop-guide');
  document.getElementById('shop-info-button')?.addEventListener('click', () => {
    renderShopGuide();
    shopGuide?.showModal();
  });
  document.getElementById('close-rotating-shop-guide')?.addEventListener('click', () => shopGuide?.close());
  shopGuide?.addEventListener('click', event => {
    if (event.target === shopGuide) shopGuide.close();
  });
  
  // Game loops
  setInterval(updatePotionDisplay, 1000);
  setInterval(updateShopTimer, 1000);
});
