/*
  17 News RNG 3 - The Next Generation
  - Modern multiplayer RNG game
  - Enhanced security and performance
  - New features and mechanics
  - Community-driven development
*/

require('dotenv').config();
const express = require('express');
const fs = require('fs/promises');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const os = require('os');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const SERVER_VERSION = process.env.RENDER_GIT_COMMIT
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.BUILD_ID
  || crypto.randomUUID();
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6,
  serveClient: true,
  allowEIO3: true
});

app.set('trust proxy', 1);

// Database Setup
let pool;
const IS_VERCEL = process.env.VERCEL === '1';
const IS_RENDER = process.env.RENDER === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || IS_RENDER || IS_VERCEL;
// Neon/Postgres connection string: prefer NEON_DATABASE_URL or DATABASE_URL as a fallback
const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
const USE_POSTGRES = Boolean(DATABASE_URL);

if (USE_POSTGRES) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      ssl: (IS_PRODUCTION || /sslmode=require|\.neon\.tech/i.test(DATABASE_URL) || process.env.PGSSLMODE === 'require')
        ? { rejectUnauthorized: false }
        : false
    });
    pool.on('error', error => console.error('Neon PostgreSQL pool error:', error.message || error));
    console.log('✅ PostgreSQL/Neon initialized for RNG 3');
  } catch (error) {
    console.error('⚠️ PostgreSQL pool initialization failed:', error.message || error);
    pool = null;
  }
}

const inMemoryStore = {
  users: {},
  chatMessages: [],
  adminChatMessages: [],
  inboxMessages: [],
  adminAudit: []
};
const playtimeLastTick = new Map();
const playtimeWritesInFlight = new Set();
const inboxClaimsInFlight = new Set();
const INBOX_ITEM_GIFTS = new Set(['fragments', 'clovers', 'essence', 'light_essence', 'molten_rock', 'ancient_ore', 'event_controller', 'old_potato_sticker', 'empty_vial', 'treasure_chest']);

const ROTATING_SHOP_ITEMS = [
  { name: 'Portal Fragment', cost: 15000, rarity: 'epic' },
  { name: 'Clover Leaf', cost: 500, rarity: 'common' },
  { name: 'Sea Essence', cost: 300000, rarity: 'legendary' },
  { name: 'Molten Rock', cost: 1000, rarity: 'common' },
  { name: 'Ancient Ore', cost: 100000, rarity: 'legendary' }
];
const SHOP_ROTATION_INTERVAL_MS = 10 * 60 * 1000;
const MAX_STACKED_EFFECT_MULTIPLIER = 5;
const MAX_LUCK_EFFECT_MULTIPLIER = 25;
const MAX_TOTAL_LUCK_MULTIPLIER = 100;
const HALLOWEEN_END_AT = Date.UTC(2026, 10, 1);
const LOCAL_SETTINGS_PATH = path.join(os.tmpdir(), '17-news-rng-3-settings.json');
const CORE_RARITIES = [
  { key: '17-news', name: '17 News', chance: 32.85, reward: 150, color: '#0f172a' },
  { key: '17-news-reborn', name: '17 News Reborn', chance: 20, reward: 300, color: '#38bdf8' },
  { key: 'the-daily-ellerslilian', name: 'The Daily Ellerslilian', chance: 2.5, reward: 2000, color: '#a16207' },
  { key: 'daniel-poole', name: 'Daniel Poole', chance: 4, reward: 1600, color: '#166534' },
  { key: 'dominik-procter', name: 'Dominik Procter', chance: 3, reward: 1800, color: '#0d9488' },
  { key: 'gabe-muir', name: 'Gabe Muir', chance: 2, reward: 2200, color: '#115e59' },
  { key: 'inesh-jayasinghe', name: 'Inesh Jayasinghe', chance: 1.5, reward: 2500, color: '#7c3aed' },
  { key: 'leo-thacker', name: 'Leo Thacker', chance: 0.8, reward: 3000, color: '#2dd4bf' },
  { key: 'sam-whitworth', name: 'Sam Whitworth', chance: 0.7, reward: 3300, color: '#ea580c' },
  { key: 'john-tan', name: 'John Tan', chance: 0.6, reward: 3600, color: '#f87171' },
  { key: 'rison-pandigama', name: 'Rison Pandigama', chance: 0.4, reward: 4200, color: '#c084fc' },
  { key: 'atticus-lok', name: 'Atticus Lok', chance: 0.3, reward: 5000, color: '#ddd6fe' },
  { key: 'baxter-walter', name: 'Baxter Walter', chance: 0.2, reward: 6000, color: '#facc15' },
  { key: 'pod-1', name: 'Pod 1', chance: 10, reward: 800, color: '#38bdf8' },
  { key: 'pod-2', name: 'Pod 2', chance: 10, reward: 800, color: '#22c55e' },
  { key: 'william-marks', name: 'William marks', chance: 5, reward: 1400, color: '#f97316' },
  { key: 'miharu-sato', name: 'Miharu Sato', chance: 5.5, reward: 1200, color: '#e879f9' },
  { key: 'mr-fermanski', name: 'Mr Fernanski', chance: 0.15, reward: 7000, isGlobal: true, color: '#f59e0b', glowColor: '#ef4444' },
  { key: 'ellerslie-schoolcast', name: 'Ellerslie Schoolcast', chance: 0.1, reward: 8500, isGlobal: true, color: '#1e3a8a', glowColor: '#38bdf8' },
  { key: 'the-ceo', name: 'The CEO', chance: 0.05, reward: 12000, isGlobal: true, color: '#000000', glowColor: '#f8fafc' },
  { key: 'mrs-joseph-mcglashan', name: 'Mrs Joseph Mcglashan', chance: 0.07, reward: 10500, isGlobal: true, color: '#16a34a', glowColor: '#4ade80' },
  { key: 'lord-crinkle', name: 'Lord Crinkle', chance: 0.03, reward: 15000, isGlobal: true, color: '#e11d48', glowColor: '#fda4af' },
  { key: 'mr-butler', name: 'Mr Butler', glitchName: 'The Principal', chance: 0.01, reward: 20000, isGlobal: true, color: '#d946ef', glowColor: '#f0abfc' },
  { key: 'mr-vaughan', name: 'Mr Vaughan', chance: 0.08, reward: 9500, isGlobal: true, color: '#0ea5e9', glowColor: '#bae6fd' },
  { key: 'mrs-bradley', name: 'Mrs Bradley', chance: 0.08, reward: 9500, isGlobal: true, color: '#db2777', glowColor: '#fbcfe8' },
  { key: 'mrs-croft', name: 'Mrs Croft', chance: 0.08, reward: 9500, isGlobal: true, color: '#16a34a', glowColor: '#bbf7d0' }
];
const HALLOWEEN_RARITIES = [
  { key: 'pumpkin-baxter', name: 'Pumpkin Baxter', chance: 0.1, reward: 8500, color: '#fb923c', glowColor: '#fed7aa', halloweenOnly: true, isGlobal: true },
  { key: 'grim-reaper', name: 'Grim Reaper', chance: 0.01, reward: 20000, color: '#5b21b6', glowColor: '#c4b5fd', halloweenOnly: true, isGlobal: true }
];
const halloweenRaritySerials = new Map();
const limitedCodeClaims = new Map();

function isHalloweenUpdateActive(now = Date.now()) {
  return now < HALLOWEEN_END_AT;
}

function getActiveCoreRarities() {
  const halloweenAdjustment = isHalloweenUpdateActive() ? 0.11 : 0;
  const rarities = CORE_RARITIES.map(rarity => rarity.key === '17-news'
    ? { ...rarity, chance: rarity.chance - halloweenAdjustment }
    : rarity);
  return isHalloweenUpdateActive() ? [...rarities, ...HALLOWEEN_RARITIES] : rarities;
}

const DIVE_OPTIONS = [
  ...CORE_RARITIES.map(rarity => rarity.key === '17-news' ? { ...rarity, chance: 30.3 } : rarity),
  { key: 'treasure-chest', name: 'Treasure Chest', chance: 0.5, reward: 350, isItem: true, color: '#fbbf24' },
  { key: 'potion-cache', name: 'Potion Cache', chance: 1.5, reward: 0, isItem: true, itemType: 'potion', color: '#a3e635' },
  { key: 'fisher-baxter', name: 'Fisher Baxter', chance: 0.05, reward: 12000, color: '#7dd3fc', glowColor: '#dbeafe', diveOnly: true, isGlobal: true },
  { key: 'sharky', name: 'Sharky', chance: 0.5, reward: 4000, color: '#0ea5e9', glowColor: '#7dd3fc', diveOnly: true }
];

function getActiveDiveOptions() {
  const options = isHalloweenUpdateActive()
    ? DIVE_OPTIONS.map(option => option.key === '17-news' ? { ...option, chance: option.chance - 0.11 } : option)
    : DIVE_OPTIONS;
  return isHalloweenUpdateActive() ? [...options, ...HALLOWEEN_RARITIES] : options;
}

async function assignHalloweenSerial(rarityKey, inventory) {
  if (!HALLOWEEN_RARITIES.some(rarity => rarity.key === rarityKey)) return null;

  let serial;
  if (pool) {
    const result = await executeQuery(
      `INSERT INTO halloween_rarity_serials (rarity_key, last_serial) VALUES ($1, 1)
       ON CONFLICT (rarity_key) DO UPDATE SET last_serial = halloween_rarity_serials.last_serial + 1
       RETURNING last_serial`,
      [rarityKey]
    );
    serial = Number(result.rows[0].last_serial);
  } else {
    serial = (halloweenRaritySerials.get(rarityKey) || 0) + 1;
    halloweenRaritySerials.set(rarityKey, serial);
  }

  const serials = normalizeRecord(inventory.halloweenSerials);
  serials[rarityKey] = [...normalizeList(serials[rarityKey]), serial];
  inventory.halloweenSerials = serials;
  return serial;
}

const GLOBAL_RARITIES = [...new Map(
  [...CORE_RARITIES, ...DIVE_OPTIONS, ...HALLOWEEN_RARITIES]
    .filter(rarity => rarity.isGlobal)
    .map(rarity => [rarity.key, rarity])
).values()];
const POTION_CATALOG = {
  luck: { name: 'Luck Potion I', cost: 5000, multiplier: 2, duration: 120, effectKey: 'luck', effect: 'luck' },
  'luck-ii': { name: 'Luck Potion II', cost: 18000, multiplier: 3, duration: 120, effectKey: 'luck', effect: 'luck' },
  'luck-v': { name: 'Luck Potion V', cost: 0, multiplier: 5, duration: 120, effectKey: 'luck', effect: 'luck', craftOnly: true },
  coin: { name: 'Coin Potion', cost: 10000, multiplier: 2, duration: 120, effectKey: 'coin', effect: 'coins' },
  'coin-ii': { name: 'Coin Potion II', cost: 0, multiplier: 4, maxMultiplier: 9, duration: 120, effectKey: 'coin', effect: 'coins', craftOnly: true },
  speed: { name: 'Speed Potion I', cost: 3500, multiplier: 2, duration: 90, effectKey: 'speed', effect: 'speed' },
};
const activeDiveSessions = new Map();
const pendingGlobalReveals = new Map();

function createGlobalRevealToken(username, rarity) {
  const token = crypto.randomBytes(24).toString('hex');
  pendingGlobalReveals.set(normalizeUsername(username), {
    token,
    rarityName: rarity.name,
    serialNumber: rarity.serialNumber || null,
    color: rarity.glowColor || rarity.color,
    expiresAt: Date.now() + 60000
  });
  return token;
}

function getShopRotation(timestamp = Date.now()) {
  const slot = Math.floor(timestamp / SHOP_ROTATION_INTERVAL_MS);
  const itemIndex = slot % ROTATING_SHOP_ITEMS.length;
  return {
    ...ROTATING_SHOP_ITEMS[itemIndex],
    itemIndex,
    slot,
    serverTime: timestamp,
    nextRestockAt: (slot + 1) * SHOP_ROTATION_INTERVAL_MS
  };
}

const TITLE_CATALOG = {
  owner: { name: '👑 Owner', color: '#fbbf24' },
  admin: { name: '🛡️ Admin', color: '#fb7185' },
  veteran: { name: 'Veteran', color: '#2563eb' },
  millionaire: { name: 'Millionaire', color: '#4ade80' },
  portalmancer: { name: 'Portalmancer', color: '#a78bfa' },
  'locked-in': { name: 'Locked In', color: '#22d3ee' },
  'endless-frequency': { name: 'The Endless Frequency', color: '#60a5fa' },
  potato: { name: 'Potato', color: '#8b5a2b' },
  collector: { name: 'Rarity Collector', color: '#34d399' },
  'global-headliner': { name: 'Global Headliner', color: '#ec4899' },
  tidekeeper: { name: 'Tidekeeper', color: '#14b8a6' },
  blacksmith: { name: 'Blacksmith', color: '#b45309' },
  'halloween-2026': { name: 'Halloween 2026', color: '#f97316' },
  'multi-millionaire': { name: 'Multi-millionaire', color: '#eab308' },
  willpower: { name: 'Willpower', color: '#22c55e' },
  'this-is-my-year': { name: 'This is my year!', color: '#c084fc' },
  billionaire: { name: 'Billionaire', color: '#a3e635' },
  'teachers-pet': { name: 'Teachers pet', color: '#facc15' },
  'helping-hand': { name: 'Helping hand', color: '#38bdf8' }
};

function isAdministratorUser(user) {
  const username = String(user?.username || '').trim().toLowerCase();
  return Boolean(user?.is_admin || username === 'mr_fernanski' || username === 'testadmin');
}

function hasAdminPanelAccess(user) {
  return isAdministratorUser(user) || getUnlockedTitles(user).includes('admin');
}

async function recordAdminAudit(actor, action, target = '', details = '') {
  const record = {
    actor: String(actor || 'Unknown').slice(0, 32),
    action: String(action || 'Admin action').slice(0, 80),
    target: String(target || '').slice(0, 32),
    details: String(details || '').slice(0, 250),
    createdAt: new Date().toISOString()
  };
  try {
    if (pool) {
      await executeQuery(
        'INSERT INTO admin_audit_log (actor, action, target, details) VALUES ($1, $2, $3, $4)',
        [record.actor, record.action, record.target, record.details]
      );
      return;
    }
    inMemoryStore.adminAudit.unshift(record);
    inMemoryStore.adminAudit.length = Math.min(inMemoryStore.adminAudit.length, 200);
  } catch (error) {
    console.error('Admin audit write error:', error.message || error);
  }
}

function getUnlockedTitles(user) {
  const titles = new Set(normalizeList(user?.titles));
  const rarities = normalizeInventory(user?.inventory).rarities;
  const rarityTotal = Object.values(rarities).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const hasGlobalDrop = GLOBAL_RARITIES.some(rarity => Number(rarities[rarity.key]) > 0);
  const hasHalloweenDrop = ['grim-reaper', 'pumpkin-baxter'].some(key => Number(rarities[key]) > 0);
  const spins = Number(user?.spins) || 0;
  const items = normalizeRecord(user?.items);

  if (isAdministratorUser(user)) titles.add('owner');
  if ((Number(user?.coins) || 0) >= 1000000) titles.add('millionaire');
  if ((Number(user?.coins) || 0) > 10000000) titles.add('multi-millionaire');
  if ((Number(user?.coins) || 0) >= 1000000000) titles.add('billionaire');
  if (user?.portal_unlocked) titles.add('portalmancer');
  if (spins >= 1000) titles.add('locked-in');
  if (spins >= 5000) titles.add('endless-frequency');
  if (spins > 10000) titles.add('willpower');
  if (spins >= 26000) titles.add('this-is-my-year');
  if ((Number(items.old_potato_sticker) || 0) >= 1) titles.add('potato');
  if (rarityTotal >= 10) titles.add('collector');
  if (hasGlobalDrop) titles.add('global-headliner');
  if (user?.sea_realm_unlocked) titles.add('tidekeeper');
  if (user?.forge_realm_unlocked) titles.add('blacksmith');
  if (hasHalloweenDrop) titles.add('halloween-2026');
  if (['mrs-joseph-mcglashan', 'mr-vaughan', 'mrs-bradley', 'mrs-croft'].every(key => Number(rarities[key]) > 0)) titles.add('teachers-pet');
  if (normalizeList(user?.achievements).includes('finn-quest-3')) titles.add('helping-hand');

  return [...titles].filter(title => Object.prototype.hasOwnProperty.call(TITLE_CATALOG, title));
}

function getChatBadge(user) {
  const titles = getUnlockedTitles(user);
  const titleId = user?.active_title && titles.includes(user.active_title)
    ? user.active_title
    : (isAdministratorUser(user) ? 'owner' : titles.includes('admin') ? 'admin' : null);
  const definition = titleId ? TITLE_CATALOG[titleId] : null;
  return { title: definition?.name || null, titleColor: definition?.color || '#7dd3fc' };
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const activeEffectsStore = {};

function normalizeUsername(username) {
  return username ? username.trim().toLowerCase() : '';
}

function removeExpiredEffects(username) {
  const key = normalizeUsername(username);
  const effects = activeEffectsStore[key] || {};
  Object.entries(effects).forEach(([effectType, effect]) => {
    if (Date.now() >= effect.endTime) {
      delete effects[effectType];
    }
  });
  activeEffectsStore[key] = effects;
  return effects;
}

function getUserActiveEffects(username) {
  const key = normalizeUsername(username);
  return removeExpiredEffects(key);
}

function setUserActiveEffect(username, effectType, data) {
  const key = normalizeUsername(username);
  const existing = activeEffectsStore[key] || {};
  const now = Date.now();
  const current = existing[effectType]?.endTime > now ? existing[effectType] : null;
  const remainingMs = current ? current.endTime - now : 0;
  const stackedMultiplier = Math.max(1, Number(current?.multiplier) || 1) * Math.max(1, Number(data.multiplier) || 1);
  const multiplierCap = effectType === 'luck' || effectType === 'deep-luck'
    ? MAX_LUCK_EFFECT_MULTIPLIER
    : Math.max(MAX_STACKED_EFFECT_MULTIPLIER, Number(current?.maxMultiplier) || 0, Number(data.maxMultiplier) || 0);
  existing[effectType] = {
    ...data,
    multiplier: Math.min(multiplierCap, stackedMultiplier),
    maxMultiplier: multiplierCap,
    endTime: now + remainingMs + Math.max(0, Number(data.endTime) - now)
  };
  activeEffectsStore[key] = existing;
  return existing[effectType];
}

function getActiveEffectMultiplier(username, effectType) {
  const effect = getUserActiveEffects(username)[effectType];
  return effect && Date.now() < effect.endTime ? Math.max(1, Number(effect.multiplier) || 1) : 1;
}

function getLuckMultiplier(username, dimension = null) {
  const eventLuckMultiplier = getActiveGameEvent()?.luckMultiplier || 1;
  return Math.min(MAX_TOTAL_LUCK_MULTIPLIER, getActiveEffectMultiplier(username, 'luck')
    * getActiveEffectMultiplier(username, 'deep-luck')
    * (dimension === 'deep-sea' ? 4 : 1)
    * eventLuckMultiplier);
}

function computeSpinMultiplier() {
  return 1;
}

function selectWeightedOption(options, luckMultiplier = 1) {
  const normalizedLuckMultiplier = Math.max(1, Number(luckMultiplier) || 1);
  const weightFor = option => option.chance <= 20
    ? option.chance
    : option.chance / normalizedLuckMultiplier;
  const totalWeight = options.reduce((total, option) => total + weightFor(option), 0);
  const roll = Math.random() * totalWeight;
  let cursor = 0;
  const result = options.find(option => {
    cursor += weightFor(option);
    return roll <= cursor;
  }) || options[0];
  return {
    result,
    totalWeight,
    rollChance: (weightFor(result) / totalWeight) * 100
  };
}

function createDiveSession() {
  const positions = [];
  for (const y of [16, 50, 84]) {
    for (const x of [12, 37, 63, 88]) positions.push({ x, y });
  }
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }
  const nodes = positions.slice(0, 10).map(({ x, y }, index) => ({
    id: `signal-${index}-${crypto.randomBytes(3).toString('hex')}`,
    x: x + (Math.random() - 0.5) * 6,
    y: y + (Math.random() - 0.5) * 6,
    collected: false
  }));
  return { nodes, cooldownUntil: 0 };
}

function getDiveState(session) {
  return {
    nodes: session.nodes,
    remaining: session.nodes.filter(node => !node.collected).length,
    cooldownUntil: session.cooldownUntil
  };
}

async function executeQuery(text, params = []) {
  if (!pool) throw new Error('Database unavailable');
  return pool.query(text, params);
}

function parseJsonField(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeRecord(value, fallback = {}) {
  const parsed = parseJsonField(value, fallback);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
}

function normalizeList(value) {
  const parsed = parseJsonField(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeInventory(value) {
  const inventory = normalizeRecord(value);
  const rarities = normalizeRecord(inventory.rarities);
  delete rarities['kayla-walters'];
  return { ...inventory, rarities };
}

async function findUser(username) {
  if (!username) return null;
  const normalized = username.trim();
  if (pool) {
    const result = await executeQuery('SELECT * FROM users WHERE username = $1', [normalized]);
    if (!result.rows.length) return null;
    const user = result.rows[0];
    const inventory = normalizeInventory(user.inventory);
    const potions = normalizeRecord(user.potions, { luck: 0, 'luck-ii': 0, coin: 0, speed: 0 });
    const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 });
    const titles = getUnlockedTitles({ ...user, inventory });
    return {
      username: user.username,
      password: user.password,
      coins: user.coins,
      spins: user.spins,
      playtime_seconds: Number(user.playtime_seconds) || 0,
      inventory,
      achievements: normalizeList(user.achievements),
      potions,
      items,
      titles,
      redeemed_codes: normalizeList(user.redeemed_codes),
      portal_unlocked: user.portal_unlocked || false,
      active_title: user.active_title || null,
      created_at: user.created_at,
      last_login: user.last_login,
      rules_agreed_at: user.rules_agreed_at || null,
      is_admin: isAdministratorUser(user),
      is_banned: user.is_banned || false,
      ban_reason: user.ban_reason || '',
      sea_realm_unlocked: user.sea_realm_unlocked || false,
      forge_realm_unlocked: user.forge_realm_unlocked || false
    };
  }
  const stored = inMemoryStore.users[normalized] || null;
  if (!stored) return null;
  return {
    ...stored,
      playtime_seconds: Number(stored.playtime_seconds) || 0,
    inventory: normalizeInventory(stored.inventory),
    achievements: normalizeList(stored.achievements),
    potions: normalizeRecord(stored.potions, { luck: 0, 'luck-ii': 0, coin: 0, speed: 0 }),
    items: normalizeRecord(stored.items, { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 }),
    titles: getUnlockedTitles(stored),
    redeemed_codes: normalizeList(stored.redeemed_codes),
    is_admin: isAdministratorUser(stored),
    is_banned: stored.is_banned || false,
    ban_reason: stored.ban_reason || '',
    portal_unlocked: stored.portal_unlocked || false,
    active_title: stored.active_title || null,
    rules_agreed_at: stored.rules_agreed_at || null,
    sea_realm_unlocked: stored.sea_realm_unlocked || false,
    forge_realm_unlocked: stored.forge_realm_unlocked || false
  };
}

async function saveUser(user) {
  const normalized = user.username.trim();
  if (pool) {
    const result = await executeQuery(
      `INSERT INTO users (username, password, coins, spins, inventory, achievements, potions, items, titles, redeemed_codes, active_title, portal_unlocked, sea_realm_unlocked, forge_realm_unlocked, is_admin, created_at, last_login, playtime_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (username) DO NOTHING
       RETURNING username`,
      [
        normalized,
        user.password,
        user.coins,
        user.spins,
        JSON.stringify(user.inventory),
        JSON.stringify(user.achievements),
        JSON.stringify(user.potions || { luck: 0, 'luck-ii': 0, coin: 0, speed: 0 }),
        JSON.stringify(user.items || { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 }),
        JSON.stringify(user.titles || []),
        JSON.stringify(user.redeemed_codes || []),
        user.active_title || null,
        user.portal_unlocked || false,
        user.sea_realm_unlocked || false,
        user.forge_realm_unlocked || false,
        user.is_admin,
        user.created_at || new Date().toISOString(),
        user.last_login || new Date().toISOString(),
        Number(user.playtime_seconds) || 0
      ]
    );
    return result.rowCount === 1;
  }
  if (inMemoryStore.users[normalized]) return false;
  inMemoryStore.users[normalized] = user;
  return true;
}

async function updateUser(username, updates) {
  const normalized = username.trim();
  if (pool) {
    const keys = Object.keys(updates);
    const values = keys.map(key => updates[key]);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const query = `UPDATE users SET ${setClause} WHERE username = $${keys.length + 1}`;
    await executeQuery(query, [...values, normalized]);
    return;
  }
  const existing = inMemoryStore.users[normalized] || {};
  inMemoryStore.users[normalized] = { ...existing, ...updates };
}

async function recordPlayerPlaytime(username, now = Date.now(), flush = false) {
  const key = normalizeUsername(username);
  const lastTick = playtimeLastTick.get(key);
  if (!key || !Number.isFinite(lastTick) || playtimeWritesInFlight.has(key)) return;
  const elapsedSeconds = Math.floor((now - lastTick) / 1000);
  if (elapsedSeconds < 1 || (!flush && elapsedSeconds < 10)) return;
  playtimeWritesInFlight.add(key);
  playtimeLastTick.set(key, lastTick + elapsedSeconds * 1000);
  try {
    const user = await findUser(username);
    if (user) {
      const totalSeconds = (Number(user.playtime_seconds) || 0) + elapsedSeconds;
      await updateUser(username, { playtime_seconds: totalSeconds });
      io.to(`user:${key}`).emit('playtime-update', { seconds: totalSeconds });
    }
  } finally {
    playtimeWritesInFlight.delete(key);
  }
}

async function claimLimitedCode(code, username, maxUses, updates) {
  const accountUsername = username.trim();
  if (!pool) {
    const claims = limitedCodeClaims.get(code) || new Set();
    if (claims.has(accountUsername)) return { status: 'already-used' };
    if (claims.size >= maxUses) return { status: 'exhausted' };
    claims.add(accountUsername);
    limitedCodeClaims.set(code, claims);
    try {
      await updateUser(username, updates);
      return { status: 'claimed', remaining: Math.max(0, maxUses - claims.size) };
    } catch (error) {
      claims.delete(accountUsername);
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [code]);
    const usage = await client.query('SELECT COUNT(*)::int AS uses FROM limited_code_redemptions WHERE code = $1', [code]);
    const priorClaim = await client.query('SELECT 1 FROM limited_code_redemptions WHERE code = $1 AND username = $2', [code, accountUsername]);
    if (priorClaim.rowCount) {
      await client.query('ROLLBACK');
      return { status: 'already-used' };
    }
    if (usage.rows[0].uses >= maxUses) {
      await client.query('ROLLBACK');
      return { status: 'exhausted' };
    }

    await client.query('INSERT INTO limited_code_redemptions (code, username) VALUES ($1, $2)', [code, accountUsername]);
    const keys = Object.keys(updates);
    const values = keys.map(key => updates[key]);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    await client.query(`UPDATE users SET ${setClause} WHERE username = $${keys.length + 1}`, [...values, username.trim()]);
    await client.query('COMMIT');
    return { status: 'claimed', remaining: Math.max(0, maxUses - usage.rows[0].uses - 1) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureDatabase() {
  if (!pool) {
    if (IS_PRODUCTION) {
      throw new Error('Neon database is required in production. Configure NEON_DATABASE_URL or DATABASE_URL.');
    }
    return;
  }
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0,
      spins INTEGER NOT NULL DEFAULT 0,
      inventory JSONB NOT NULL DEFAULT '{}'::jsonb,
      achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      potions JSONB NOT NULL DEFAULT '{"luck":0,"luck-ii":0,"speed":0}'::jsonb,
      items JSONB NOT NULL DEFAULT '{"fragments":0,"clovers":0,"essence":0,"molten_rock":0,"ancient_ore":0,"old_potato_sticker":0,"empty_vial":0,"treasure_chest":0,"event_controller":0}'::jsonb,
      titles JSONB NOT NULL DEFAULT '[]'::jsonb,
      redeemed_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      active_title TEXT,
      portal_unlocked BOOLEAN NOT NULL DEFAULT false,
      sea_realm_unlocked BOOLEAN NOT NULL DEFAULT false,
      forge_realm_unlocked BOOLEAN NOT NULL DEFAULT false,
      is_banned BOOLEAN NOT NULL DEFAULT false,
      ban_reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      playtime_seconds BIGINT NOT NULL DEFAULT 0
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      title TEXT,
      title_color TEXT NOT NULL DEFAULT '#7dd3fc',
      system BOOLEAN NOT NULL DEFAULT false,
      is_global BOOLEAN NOT NULL DEFAULT false,
      is_announcement BOOLEAN NOT NULL DEFAULT false,
      reply_to_username TEXT,
      reply_to_message TEXT,
      attachment_data TEXT,
      is_admin_chat BOOLEAN NOT NULL DEFAULT false
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS inbox_messages (
      id BIGSERIAL PRIMARY KEY,
      sender TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      recipient TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      message TEXT NOT NULL DEFAULT '',
      gift_type TEXT,
      gift_key TEXT,
      gift_amount INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      claimed_at TIMESTAMPTZ
    )
  `);
  await executeQuery('ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ');
  await executeQuery('CREATE INDEX IF NOT EXISTS inbox_messages_recipient_idx ON inbox_messages (recipient, created_at DESC)');
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS limited_code_redemptions (
      code TEXT NOT NULL,
      username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (code, username)
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS halloween_rarity_serials (
      rarity_key TEXT PRIMARY KEY,
      last_serial INTEGER NOT NULL DEFAULT 0
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await executeQuery('CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC)');
  await executeQuery(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS spins INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '{"rarities":{}}'::jsonb,
      ADD COLUMN IF NOT EXISTS achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS potions JSONB NOT NULL DEFAULT '{"luck":0,"luck-ii":0,"speed":0}'::jsonb,
      ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '{"fragments":0,"clovers":0,"essence":0,"molten_rock":0,"ancient_ore":0,"old_potato_sticker":0,"empty_vial":0,"treasure_chest":0,"event_controller":0}'::jsonb,
      ADD COLUMN IF NOT EXISTS titles JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS redeemed_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS active_title TEXT,
      ADD COLUMN IF NOT EXISTS portal_unlocked BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sea_realm_unlocked BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS forge_realm_unlocked BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS ban_reason TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS playtime_seconds BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rules_agreed_at TIMESTAMPTZ
  `);
  await executeQuery(`
    ALTER TABLE chat_messages
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS title_color TEXT NOT NULL DEFAULT '#7dd3fc',
      ADD COLUMN IF NOT EXISTS system BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS reply_to_username TEXT,
      ADD COLUMN IF NOT EXISTS reply_to_message TEXT,
      ADD COLUMN IF NOT EXISTS attachment_data TEXT,
      ADD COLUMN IF NOT EXISTS is_admin_chat BOOLEAN NOT NULL DEFAULT false
  `);
  await executeQuery('CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages (created_at DESC)');
  await executeQuery("UPDATE users SET inventory = inventory #- ARRAY['rarities', 'kayla-walters'] WHERE inventory ? 'rarities' AND (inventory->'rarities') ? 'kayla-walters'");
}

const GAME_EVENTS = {
    'confetti-party': {
      title: 'Confetti Party',
      coinMultiplier: 2,
      bonusCoins: 100,
      durationSeconds: 180,
      panelOnly: true,
      description: 'A burst of color and 2× coins across the game'
    },
    blackhole: {
      title: 'Blackhole',
      coinMultiplier: 1,
      bonusCoins: 0,
      durationSeconds: 10,
      ownerOnly: true,
      description: 'A ten-second singularity grants Light Essence to players online at its close'
    },
  'starlight-surge': {
    title: 'Starlight Surge',
    coinMultiplier: 2,
    bonusCoins: 0,
    luckMultiplier: 2,
    description: '2x coins and 2x luck'
  },
  'meteor-shower': {
    title: 'Meteor Shower',
    coinMultiplier: 3,
    bonusCoins: 250,
    durationSeconds: 240,
    description: '3x coins and +250 bonus coins per roll during three meteor waves'
  },
  'abyssal-resonance': {
    title: 'Abyssal Resonance',
    coinMultiplier: 2,
    bonusCoins: 250,
    luckMultiplier: 3,
    description: '3x luck and +250 bonus coins, amplified in the Sea Realm'
  },
  'prismfall': {
    title: 'Prismfall',
    coinMultiplier: 1.5,
    bonusCoins: 200,
    luckMultiplier: 4,
    durationSeconds: 240,
    ownerOnly: true,
    description: '4x luck and 1.5x coins +200 per roll as prism shards cross the signal field'
  },
  'gravity-well': {
    title: 'Gravity Well',
    coinMultiplier: 4,
    bonusCoins: 250,
    durationSeconds: 240,
    ownerOnly: true,
    description: '4x coins +250 per roll as the gravity field bends the star map'
  }
};

let activeGameEvent = null;
let activeGameEventTimeout = null;
let adminHeadline = { active: false, text: '', label: 'NOTICE', detail: '', color: '#eff6ff', speed: 18 };

function normalizeAdminHeadline(value) {
  const text = String(value?.text || '').trim().slice(0, 220);
  const label = String(value?.label || 'NOTICE').trim().slice(0, 36) || 'NOTICE';
  const detail = String(value?.detail || '').trim().slice(0, 120);
  const requestedColor = String(value?.color || '').trim();
  const color = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : '#eff6ff';
  const speed = Math.min(36, Math.max(10, Math.round(Number(value?.speed) || 18)));
  return { active: Boolean(value?.active && text), text, label, detail, color, speed };
}

async function loadAdminHeadline() {
  let storedValue = null;
  if (pool) {
    const result = await executeQuery('SELECT setting_value FROM app_settings WHERE setting_key = $1', ['admin_headline']);
    storedValue = result.rows[0]?.setting_value || null;
  } else {
    try {
      const settings = JSON.parse(await fs.readFile(LOCAL_SETTINGS_PATH, 'utf8'));
      storedValue = settings.adminHeadline || null;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (storedValue) adminHeadline = normalizeAdminHeadline(storedValue);
}

async function persistAdminHeadline() {
  if (pool) {
    await executeQuery(
      'INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()',
      ['admin_headline', JSON.stringify(adminHeadline)]
    );
    return;
  }

  let settings = {};
  try {
    settings = JSON.parse(await fs.readFile(LOCAL_SETTINGS_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  settings.adminHeadline = adminHeadline;
  const temporaryPath = `${LOCAL_SETTINGS_PATH}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(settings), 'utf8');
  await fs.rename(temporaryPath, LOCAL_SETTINGS_PATH);
}

function endActiveGameEvent() {
  if (!activeGameEvent) return;
  const endedEvent = activeGameEvent;
  activeGameEvent = null;
  clearTimeout(activeGameEventTimeout);
  activeGameEventTimeout = null;
  io.emit('theme-event', {
    eventName: endedEvent.eventName,
    title: endedEvent.title,
    initiatedBy: endedEvent.initiatedBy,
    active: false,
    endedAt: new Date().toISOString()
  });
  if (endedEvent.eventName === 'blackhole') grantBlackholeRewards().catch(error => console.error('Blackhole reward error:', error.message || error));
}

async function grantBlackholeRewards() {
  const sockets = await io.fetchSockets();
  const usernames = new Map();
  sockets.forEach(socket => {
    const username = socket.request?.session?.username;
    if (username) usernames.set(normalizeUsername(username), username);
  });
  for (const username of usernames.values()) {
    const user = await findUser(username);
    if (!user) continue;
    const items = normalizeRecord(user.items);
    items.light_essence = (Number(items.light_essence) || 0) + 1;
    await updateUser(username, { items: JSON.stringify(items) });
    const updatedUser = await findUser(username);
    io.to(`user:${normalizeUsername(username)}`).emit('blackhole-reward', { item: 'Light Essence', amount: 1, user: sanitizeUser(updatedUser) });
  }
}

function getActiveGameEvent() {
  if (activeGameEvent?.expiresAt && Date.now() >= activeGameEvent.expiresAt) {
    endActiveGameEvent();
  }
  return activeGameEvent;
}

function startGameEvent(eventName, initiatedBy, durationOverrideSeconds = null) {
  const config = GAME_EVENTS[eventName];
  if (!config) return null;
  endActiveGameEvent();
  const durationSeconds = Number.isFinite(Number(durationOverrideSeconds)) && Number(durationOverrideSeconds) > 0
    ? Math.min(1800, Math.floor(Number(durationOverrideSeconds)))
    : config.durationSeconds;
  activeGameEvent = {
    eventName,
    title: config.title,
    initiatedBy,
    durationSeconds,
    coinMultiplier: config.coinMultiplier,
    bonusCoins: config.bonusCoins,
    luckMultiplier: config.luckMultiplier || 1,
    description: config.description,
    startedAt: new Date().toISOString(),
    expiresAt: durationSeconds ? Date.now() + durationSeconds * 1000 : null
  };
  io.emit('theme-event', { ...activeGameEvent, active: true });
  if (durationSeconds) {
    activeGameEventTimeout = setTimeout(endActiveGameEvent, durationSeconds * 1000);
    activeGameEventTimeout.unref?.();
  }
  return activeGameEvent;
}

function stopGameEvent(eventName) {
  if (!activeGameEvent || activeGameEvent.eventName !== eventName) return false;
  endActiveGameEvent();
  return true;
}

let connectedUsers = 0;

async function getRecentChatMessages(limit = 60, globalOnly = null) {
  if (pool) {
    const result = await executeQuery(
      `SELECT id, username, message, created_at, title, title_color, system, is_global, is_announcement, reply_to_username, reply_to_message, attachment_data
       FROM chat_messages WHERE is_admin_chat = false${globalOnly === null ? '' : ' AND is_global = $1'}
       ORDER BY created_at DESC LIMIT $${globalOnly === null ? 1 : 2}`,
      globalOnly === null ? [limit] : [globalOnly, limit]
    );
    return result.rows.reverse().map(row => ({
      id: row.id,
      username: row.username,
      message: row.message,
      title: row.title,
      titleColor: row.title_color || '#7dd3fc',
      timestamp: row.created_at,
      system: row.system || false,
      isGlobalDrop: row.is_global || false,
      isAnnouncement: row.is_announcement || false,
      attachment: row.attachment_data ? JSON.parse(row.attachment_data) : null,
      replyTo: row.reply_to_username && row.reply_to_message
        ? { username: row.reply_to_username, message: row.reply_to_message }
        : null
    }));
  }
  return inMemoryStore.chatMessages
    .filter(message => !message.isAdminChat && (globalOnly === null || Boolean(message.isGlobalDrop) === globalOnly))
    .slice(-limit);
}

async function getRecentAdminChatMessages(limit = 100) {
  if (pool) {
    const result = await executeQuery(
      `SELECT id, username, message, created_at, title, title_color, attachment_data
       FROM chat_messages WHERE is_admin_chat = true
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.reverse().map(row => ({
      id: row.id,
      username: row.username,
      message: row.message,
      timestamp: row.created_at,
      title: row.title,
      titleColor: row.title_color || '#7dd3fc',
      attachment: row.attachment_data ? JSON.parse(row.attachment_data) : null
    }));
  }
  return inMemoryStore.adminChatMessages.slice(-limit);
}

async function getGlobalRarityCounts() {
  const users = pool
    ? (await executeQuery('SELECT inventory FROM users')).rows
    : Object.values(inMemoryStore.users);
  const counts = Object.fromEntries(GLOBAL_RARITIES.map(rarity => [rarity.key, 0]));
  users.forEach(user => {
    const rarities = normalizeInventory(user.inventory).rarities;
    GLOBAL_RARITIES.forEach(rarity => {
      counts[rarity.key] += Number(rarities[rarity.key]) || 0;
    });
  });
  return GLOBAL_RARITIES.map(rarity => ({ ...rarity, obtained: counts[rarity.key] }));
}

function normalizeChatReply(replyTo) {
  if (!replyTo || typeof replyTo !== 'object') return null;
  const replyUsername = String(replyTo.username || '').trim().slice(0, 32);
  const replyMessage = String(replyTo.message || '').trim().slice(0, 240);
  return replyUsername && replyMessage ? { username: replyUsername, message: replyMessage } : null;
}

function validateChatAttachment(attachment, canAttach) {
  if (attachment == null) return { attachment: null };
  if (!canAttach) return { error: 'Attachments are only available to administrators.' };
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']);
  const type = String(attachment?.type || '').toLowerCase();
  const data = String(attachment?.data || '');
  if (!allowedTypes.has(type) || !data.startsWith(`data:${type};base64,`)) {
    return { error: 'Choose a supported image, PDF, or text file.' };
  }
  const encoded = data.slice(data.indexOf(',') + 1);
  if (!encoded || encoded.length > 700000 || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) {
    return { error: 'Attachments must be smaller than 480 KB.' };
  }
  return {
    attachment: {
      name: String(attachment.name || 'attachment').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 100),
      type,
      data
    }
  };
}

function containsProfanity(message) {
  const normalized = String(message || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't');
  const blockedWords = ['wtf', 'fuck', 'fucker', 'fucking', 'shit', 'shitty', 'bitch', 'bastard', 'ass', 'asshole', 'arse', 'arsehole', 'damn', 'crap', 'dick', 'pussy', 'cunt', 'motherfucker', 'jackass'];
  return blockedWords.some(word => {
    const spacedWord = word.split('').join('[^a-z0-9]*');
    return new RegExp(`(?:^|[^a-z0-9])${spacedWord}(?:$|[^a-z0-9])`, 'i').test(normalized);
  });
}

function warnForProfanity(username) {
  io.emit('chat-moderation-warning', {
    username: String(username || 'Player').slice(0, 32),
    message: 'Do not do it again.',
    timestamp: new Date().toISOString()
  });
}

async function saveChatMessage(username, message, title = null, titleColor = '#7dd3fc', system = false, isGlobalDrop = false, isAnnouncement = false, replyTo = null, attachment = null, isAdminChat = false) {
  const record = {
    id: null,
    username: username || 'Guest',
    message,
    title,
    titleColor,
    timestamp: new Date().toISOString(),
    system,
    isGlobalDrop,
    isAnnouncement,
    replyTo: normalizeChatReply(replyTo),
    attachment,
    isAdminChat
  };

  if (pool) {
    const result = await executeQuery(
      'INSERT INTO chat_messages (username, message, title, title_color, system, is_global, is_announcement, reply_to_username, reply_to_message, attachment_data, is_admin_chat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
      [record.username, record.message, title, titleColor, system, isGlobalDrop, isAnnouncement, record.replyTo?.username || null, record.replyTo?.message || null, attachment ? JSON.stringify(attachment) : null, isAdminChat]
    );
    record.id = result.rows[0].id;
  } else {
    record.id = crypto.randomUUID();
    const messages = isAdminChat ? inMemoryStore.adminChatMessages : inMemoryStore.chatMessages;
    messages.push(record);
    const maxMessages = isAdminChat ? 100 : 200;
    if (messages.length > maxMessages) {
      messages.shift();
    }
  }

  return record;
}

async function clearChatHistory() {
  if (pool) {
    await executeQuery('TRUNCATE chat_messages');
  }
  inMemoryStore.chatMessages = [];
  inMemoryStore.adminChatMessages = [];
}

function prepareInboxGiftTransfers(sender, recipient, giftType, giftKey, amount) {
  if (!giftType || giftType === 'none') return { senderUpdates: {}, recipientUpdates: {} };
  if (giftType === 'coins') {
    const senderCoins = Number(sender.coins) || 0;
    const recipientCoins = Number(recipient.coins) || 0;
    if (senderCoins < amount) return { error: 'You do not have enough coins to send that gift.' };
    if (recipientCoins + amount > 2147483647) return { error: 'The recipient cannot hold that many coins.' };
    return { senderUpdates: { coins: senderCoins - amount }, recipientUpdates: { coins: recipientCoins + amount } };
  }

  if (giftType === 'item' && INBOX_ITEM_GIFTS.has(giftKey)) {
    const senderItems = normalizeRecord(sender.items);
    const recipientItems = normalizeRecord(recipient.items);
    const senderCount = Number(senderItems[giftKey]) || 0;
    const recipientCount = Number(recipientItems[giftKey]) || 0;
    if (senderCount < amount) return { error: 'You do not have enough of that item to send.' };
    if (recipientCount + amount > 999) return { error: 'The recipient cannot hold any more of that item.' };
    senderItems[giftKey] = senderCount - amount;
    recipientItems[giftKey] = recipientCount + amount;
    return {
      senderUpdates: { items: JSON.stringify(senderItems) },
      recipientUpdates: { items: JSON.stringify(recipientItems) }
    };
  }

  if (giftType === 'potion' && POTION_CATALOG[giftKey]) {
    const senderPotions = normalizeRecord(sender.potions);
    const recipientPotions = normalizeRecord(recipient.potions);
    const senderCount = Number(senderPotions[giftKey]) || 0;
    const recipientCount = Number(recipientPotions[giftKey]) || 0;
    if (senderCount < amount) return { error: 'You do not have enough of that potion to send.' };
    if (recipientCount + amount > 999) return { error: 'The recipient cannot hold any more of that potion.' };
    senderPotions[giftKey] = senderCount - amount;
    recipientPotions[giftKey] = recipientCount + amount;
    return {
      senderUpdates: { potions: JSON.stringify(senderPotions) },
      recipientUpdates: { potions: JSON.stringify(recipientPotions) }
    };
  }

  return { error: 'Choose a valid gift type and item.' };
}

function prepareInboxGiftClaim(recipient, giftType, giftKey, amount) {
  if (giftType === 'coins') {
    const coins = Number(recipient.coins) || 0;
    if (coins + amount > 2147483647) return { error: 'You cannot hold any more coins.' };
    return { updates: { coins: coins + amount } };
  }
  if (giftType === 'item' && INBOX_ITEM_GIFTS.has(giftKey)) {
    const items = normalizeRecord(recipient.items);
    const count = Number(items[giftKey]) || 0;
    if (count + amount > 999) return { error: 'You cannot hold any more of that item.' };
    items[giftKey] = count + amount;
    return { updates: { items: JSON.stringify(items) } };
  }
  if (giftType === 'potion' && POTION_CATALOG[giftKey]) {
    const potions = normalizeRecord(recipient.potions);
    const count = Number(potions[giftKey]) || 0;
    if (count + amount > 999) return { error: 'You cannot hold any more of that potion.' };
    potions[giftKey] = count + amount;
    return { updates: { potions: JSON.stringify(potions) } };
  }
  if (giftType === 'rarity') {
    const rarity = [...CORE_RARITIES, ...DIVE_OPTIONS].find(option => option.key === giftKey && !option.isItem && !option.halloweenOnly);
    if (!rarity) return { error: 'That rarity can no longer be claimed.' };
    const inventory = normalizeInventory(recipient.inventory);
    const count = Number(inventory.rarities[giftKey]) || 0;
    if (count + amount > 999) return { error: 'You cannot hold any more of that rarity.' };
    inventory.rarities[giftKey] = count + amount;
    return { updates: { inventory: JSON.stringify(inventory), titles: JSON.stringify(getUnlockedTitles({ ...recipient, inventory })) } };
  }
  return { error: 'This inbox entry has no claimable gift.' };
}

async function isAdminSocket(socket) {
  const username = socket.request?.session?.username;
  if (!username) return false;
  const user = await findUser(username);
  return user && hasAdminPanelAccess(user);
}

async function broadcastAdminChatMessage(message) {
  const sockets = await io.in('admin-chat').fetchSockets();
  await Promise.all(sockets.map(async socket => {
    if (await isAdminSocket(socket)) {
      socket.emit('admin-chat-message', message);
    } else {
      await socket.leave('admin-chat');
    }
  }));
}

async function notifyChatTargets(message) {
  const targets = new Set(String(message?.message || '').match(/@([A-Za-z0-9][A-Za-z0-9_-]{1,31})/g)?.map(value => value.slice(1).toLowerCase()) || []);
  const sockets = await io.fetchSockets();
  const onlineUsers = new Map();
  sockets.forEach(socket => {
    const username = socket.request?.session?.username;
    if (username) onlineUsers.set(normalizeUsername(username), username);
  });
  const notification = {
    username: message.username,
    message: String(message.message || '').slice(0, 120),
    timestamp: message.timestamp
  };
  targets.forEach(username => {
    const onlineUsername = onlineUsers.get(username);
    if (onlineUsername) io.to(`user:${normalizeUsername(onlineUsername)}`).emit('mention-notification', notification);
  });
  const replyUsername = normalizeUsername(message.replyTo?.username);
  if (replyUsername && onlineUsers.has(replyUsername) && replyUsername !== normalizeUsername(message.username)) {
    io.to(`user:${replyUsername}`).emit('reply-notification', notification);
  }
}

async function broadcastOnlineRoster() {
  const sockets = await io.fetchSockets();
  const players = new Map();
  sockets.forEach(socket => {
    const username = socket.request?.session?.username;
    if (!username) return;
    const key = normalizeUsername(username);
    players.set(key, { username, status: socket.data.activity || 'At the RNG console' });
  });
  io.emit('online-count', players.size);
  io.emit('online-roster', [...players.values()]);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // removed invalid 'validate' option which causes runtime errors
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.originalUrl.split('?')[0] === '/api/spin',
});

const spinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  message: { success: false, error: 'Rolling too quickly. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
const sessionStore = new MemoryStore({
  checkPeriod: 86400000,
  ttl: 365 * 24 * 60 * 60 * 1000
});

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'rng3-next-generation-secret-2026',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  name: 'rng3.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
});

app.use(sessionMiddleware);

// Serve the game shell and client code fresh during active development/deploys.
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Apply rate limiting
app.use(['/api/login', '/api/register'], authLimiter);
app.use('/api/spin', spinLimiter);
app.use('/api', apiLimiter);

let gameShutdown = false;
let gameUpdated = false;
app.use('/api', async (req, res, next) => {
  const apiPath = req.originalUrl.split('?')[0].replace(/^\/api/, '') || '/';
  const maintenancePaths = ['/login', '/register', '/session', '/logout', '/rules-agreement', '/admin/shutdown', '/admin/headline'];
  if (gameUpdated && !['/session', '/logout'].includes(apiPath)) {
    return res.status(503).json({ success: false, updated: true, error: 'Game has been updated. Please refresh your page.' });
  }
  if (gameShutdown && !maintenancePaths.includes(apiPath)) {
    return res.status(503).json({ success: false, shutdown: true, error: 'Update or Fix in progress please wait' });
  }
  if (!req.session?.username || ['/login', '/register', '/session', '/logout'].includes(apiPath)) {
    return next();
  }
  try {
    const user = await findUser(req.session.username);
    if (user?.is_banned) {
      return res.status(403).json({ success: false, banned: true, banReason: user.ban_reason || '' });
    }
    if (user && !user.rules_agreed_at && !['/rules-agreement', '/version', '/health'].includes(apiPath)) {
      return res.status(403).json({
        success: false,
        rulesAgreementRequired: true,
        error: 'Please agree to the Community Guidelines before playing.'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// CORS for development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

function sanitizeUser(user) {
  const inventory = normalizeInventory(user.inventory);
  const potions = normalizeRecord(user.potions, { luck: 0, speed: 0 });
  const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 });
  const titles = getUnlockedTitles(user);
  
  return {
    username: user.username,
    coins: user.coins,
    spins: user.spins,
    playtime_seconds: Number(user.playtime_seconds) || 0,
    rules_agreed_at: user.rules_agreed_at || null,
    inventory,
    achievements: normalizeList(user.achievements),
    potions: potions,
    items: items,
    titles: titles,
    active_title: titles.includes(user.active_title) ? user.active_title : null,
    active_effects: user.username ? getUserActiveEffects(user.username) : {},
    portal_unlocked: user.portal_unlocked || false,
    sea_realm_unlocked: user.sea_realm_unlocked || false,
    forge_realm_unlocked: user.forge_realm_unlocked || false,
    accountAge: user.created_at ? new Date(user.created_at).toLocaleDateString() : '-',
    inventoryValue: calculateInventoryValue(inventory),
    inventoryTotal: Object.values(inventory.rarities).reduce((sum, count) => sum + (Number(count) || 0), 0),
    is_admin: isAdministratorUser(user),
    is_banned: user.is_banned || false,
    ban_reason: user.ban_reason || ''
  };
}

function calculateInventoryValue(inventory) {
  const parsed = normalizeInventory(inventory);
  const rarities = (parsed || {}).rarities || {};
  const valueMap = {
    '17-news': 150,
    '17-news-reborn': 300,
    'daniel-poole': 450,
    'dominik-procter': 450,
    'gabe-muir': 450,
    'inesh-jayasinghe': 550,
    'leo-thacker': 700,
    'sam-whitworth': 700,
    'john-tan': 1050,
    'rison-pandigama': 1250,
    'atticus-lok': 1750,
    'baxter-walter': 2250,
    'mr-fermanski': 3333,
    'ellerslie-schoolcast': 5000,
    'the-ceo': 7000,
    'fisher-baxter': 12000
  };
  return Object.entries(rarities).reduce((sum, [key, count]) => sum + (valueMap[key] || 0) * count, 0);
}

function establishSession(req, username) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) return reject(error);
      req.session.username = username;
      req.session.save(saveError => saveError ? reject(saveError) : resolve());
    });
  });
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.trim().length < 3 || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 chars and password at least 6 chars.' });
  }

  const normalized = username.trim();
  let existing;
  try {
    existing = await findUser(normalized);
  } catch (error) {
    console.error('Register lookup error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Account database is unavailable. Please try again.' });
  }
  if (existing) {
    return res.status(409).json({ success: false, error: 'Username already exists.' });
  }

  const user = {
    username: normalized,
    password: hashPassword(password),
    coins: 0,
    spins: 0,
    playtime_seconds: 0,
    inventory: { rarities: {} },
    achievements: [],
    potions: { luck: 0, 'luck-ii': 0, coin: 0, speed: 0 },
    items: { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 },
    titles: normalized.toLowerCase() === 'mr_fernanski' || normalized === 'testadmin' ? ['owner'] : [],
    portal_unlocked: false,
    sea_realm_unlocked: false,
    forge_realm_unlocked: false,
    is_admin: normalized.toLowerCase() === 'mr_fernanski' || normalized === 'testadmin',
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString()
  };

  try {
    if (!(await saveUser(user))) {
      return res.status(409).json({ success: false, error: 'Username already exists.' });
    }
    await establishSession(req, normalized);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  const normalized = username.trim();
  try {
    const user = await findUser(normalized);
    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ success: false, banned: true, banReason: user.ban_reason || '', error: 'This account is banned.' });
    }

    const lastLogin = new Date().toISOString();
    await updateUser(normalized, { last_login: lastLogin });
    await establishSession(req, normalized);
    res.json({ success: true, user: sanitizeUser({ ...user, last_login: lastLogin }) });
  } catch (error) {
    console.error('Login error:', error.message || error);
    res.status(503).json({ success: false, error: 'Account database is unavailable. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ version: SERVER_VERSION });
});

app.get('/api/session', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.json({ success: false, user: null });
  }
  let user;
  try {
    user = await findUser(req.session.username);
  } catch (error) {
    console.error('Session lookup error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Account database is unavailable. Please try again.' });
  }
  if (!user) {
    return res.json({ success: false, user: null });
  }
  res.json({ success: true, user: sanitizeUser(user) });
});

app.post('/api/rules-agreement', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Please log in to agree to the guidelines.' });
  try {
    let user = await findUser(req.session.username);
    if (!user) return res.status(401).json({ success: false, error: 'Account not found. Please log in again.' });
    if (!user.rules_agreed_at) {
      if (pool) {
        await executeQuery(
          'UPDATE users SET rules_agreed_at = NOW() WHERE username = $1 AND rules_agreed_at IS NULL',
          [req.session.username]
        );
      } else {
        inMemoryStore.users[req.session.username].rules_agreed_at = new Date().toISOString();
      }
      user = await findUser(req.session.username);
    }
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Rules agreement error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to save your agreement. Please try again.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    if (pool) await executeQuery('SELECT 1');
    if (IS_PRODUCTION && !pool) throw new Error('Production database is not configured.');
    res.json({
      success: true,
      status: 'ok',
      database: pool ? (/\.neon\.tech/i.test(DATABASE_URL) ? 'neon' : 'postgres') : 'memory-dev',
      version: '3.0.0',
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check failed:', error.message || error);
    res.status(503).json({ success: false, status: 'degraded', database: 'unavailable' });
  }
});

app.get('/api/inventory', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  let user;
  try {
    user = await findUser(req.session.username);
  } catch (error) {
    console.error('Inventory lookup error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Account database is unavailable. Please try again.' });
  }
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  res.json({ success: true, inventory: user.inventory || { rarities: {} }, inventoryValue: calculateInventoryValue(user.inventory), coins: user.coins });
});

app.get('/api/profile', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const user = await findUser(req.session.username);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  res.json({
    success: true,
    user: sanitizeUser(user)
  });
});

app.post('/api/spin', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  let user;
  try {
    user = await findUser(req.session.username);
  } catch (error) {
    console.error('Spin lookup error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Account database is unavailable. Please try again.' });
  }
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  if (req.body?.autoRoll && (Number(user.spins) || 0) < 100) {
    return res.status(403).json({ success: false, error: 'Auto Roll unlocks after 100 total rolls.' });
  }

  const dimension = String(req.body?.dimension || '').toLowerCase();
  if (dimension === 'deep-sea') {
    return res.status(400).json({ success: false, error: 'Click sonar signals in the Sea Realm to collect rewards.' });
  }
  const luckMultiplier = getLuckMultiplier(req.session.username, dimension);
  const selection = selectWeightedOption(getActiveCoreRarities(), luckMultiplier);
  const result = selection.result;

  let inventory = user.inventory;
  if (typeof inventory === 'string') {
    try {
      inventory = JSON.parse(inventory);
    } catch {
      inventory = null;
    }
  }
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    inventory = {};
  }
  if (!inventory.rarities || typeof inventory.rarities !== 'object' || Array.isArray(inventory.rarities)) {
    inventory.rarities = {};
  }
  const ownedCount = Number(inventory.rarities[result.key]);
  inventory.rarities[result.key] = Number.isFinite(ownedCount) && ownedCount >= 0 ? ownedCount + 1 : 1;
  result.serialNumber = await assignHalloweenSerial(result.key, inventory);

  const event = getActiveGameEvent();
  const multiplier = computeSpinMultiplier() * (event?.coinMultiplier || 1);
  const rawReward = result.reward;
  const eventBonus = event?.bonusCoins || 0;
  const finalReward = Math.round((Math.round(rawReward * multiplier) + eventBonus) * getActiveEffectMultiplier(req.session.username, 'coin'));

  const newSpins = (Number(user.spins) || 0) + 1;
  const newCoins = (Number(user.coins) || 0) + finalReward;
  let currentTitles = user.titles;
  if (typeof currentTitles === 'string') {
    try {
      currentTitles = JSON.parse(currentTitles);
    } catch {
      currentTitles = [];
    }
  }
  const updatedTitles = getUnlockedTitles({
    ...user,
    inventory,
    spins: newSpins,
    coins: newCoins,
    titles: Array.isArray(currentTitles) ? currentTitles : []
  });
  const updatedUser = {
    ...user,
    inventory,
    spins: newSpins,
    coins: newCoins,
    titles: updatedTitles
  };

  try {
    await updateUser(req.session.username, {
      inventory: JSON.stringify(inventory),
      spins: newSpins,
      coins: newCoins,
      titles: JSON.stringify(updatedTitles)
    });

    const globalRevealToken = result.isGlobal ? createGlobalRevealToken(user.username, result) : null;

    const responsePayload = {
      success: true,
      result: {
        ...result,
        rollChance: selection.rollChance,
        multiplier,
        luckMultiplier,
        reward: finalReward,
        eventBonus,
        eventName: event?.title || null,
        globalRevealToken
      },
      user: sanitizeUser(updatedUser)
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Spin persistence error:', error.message || error);
    res.status(503).json({ success: false, error: 'Your roll could not be saved. Please try again.' });
  }
});

app.post('/api/announce-global-reveal', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const key = normalizeUsername(req.session.username);
  const pending = pendingGlobalReveals.get(key);
  const token = String(req.body?.token || '');
  if (!pending || pending.expiresAt < Date.now() || pending.token !== token) {
    pendingGlobalReveals.delete(key);
    return res.status(409).json({ success: false, error: 'That global reveal is no longer available.' });
  }
  pendingGlobalReveals.delete(key);
  try {
    const serialText = pending.serialNumber ? ` · Serial #${String(pending.serialNumber).padStart(6, '0')}` : '';
    const message = `${req.session.username} rolled ${pending.rarityName}${serialText}!`;
    const chatRecord = await saveChatMessage(req.session.username, message, pending.rarityName, pending.color, false, true);
    io.emit('global-chat-message', chatRecord);
    res.json({ success: true });
  } catch (error) {
    console.error('Global reveal announcement error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to announce the global reveal.' });
  }
});

// Code Redemption
app.post('/api/redeem-code', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const normalizedCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!normalizedCode) {
    return res.status(400).json({ success: false, error: 'Code required.' });
  }

  const codeRewards = {
    'THETHREEQUEL': { title: 'veteran' },
    'UPD3ISHERE!!': { coins: 20000, item: { key: 'ancient_ore', amount: 5 }, rewardMessage: '5 Ancient Ore and 20,000 coins' },
    'CRAFTINGISBACK': { coins: 100000, item: { key: 'empty_vial', amount: 1 }, rewardMessage: '1 Empty Vial and 100,000 coins' },
    'LORDFINNHASRETURNED': { coins: 100000, potion: { key: 'coin', amount: 3 }, rewardMessage: '100,000 coins and 3 Coin Potions' },
    'SORRYFORTHEDELAY': { potion: { key: 'coin-ii', amount: 1 }, rewardMessage: '1 Coin Potion II' },
    'UPDATE5ISHERE': { coins: 500000, item: { key: 'fragments', amount: 5 }, rewardMessage: '500,000 coins and 5 Portal Fragments' }
  };

  const reward = codeRewards[normalizedCode];
  if (!reward) {
    return res.status(400).json({ success: false, error: 'Invalid code.' });
  }
  if (reward.expiresAt && Date.now() >= reward.expiresAt) {
    return res.status(400).json({ success: false, error: 'This Halloween code has expired.' });
  }

  try {
    const user = await findUser(req.session.username);
    const titles = typeof user.titles === 'string' ? JSON.parse(user.titles) : (user.titles || []);
    const redeemedCodes = normalizeList(user.redeemed_codes);

    if (redeemedCodes.includes(normalizedCode) || (reward.title && titles.includes(reward.title))) {
      return res.json({ success: false, error: 'Already redeemed.' });
    }

    if (reward.title) titles.push(reward.title);
    redeemedCodes.push(normalizedCode);
    const updates = { redeemed_codes: JSON.stringify(redeemedCodes) };
    if (reward.title) updates.titles = JSON.stringify(titles);
    if (reward.coins) updates.coins = (Number(user.coins) || 0) + reward.coins;
    if (reward.item) {
      const items = normalizeRecord(user.items);
      items[reward.item.key] = (Number(items[reward.item.key]) || 0) + reward.item.amount;
      updates.items = JSON.stringify(items);
    }
    if (reward.potion) {
      const potions = normalizeRecord(user.potions);
      potions[reward.potion.key] = (Number(potions[reward.potion.key]) || 0) + reward.potion.amount;
      updates.potions = JSON.stringify(potions);
    }
    if (reward.maxUses) {
      const claim = await claimLimitedCode(normalizedCode, req.session.username, reward.maxUses, updates);
      if (claim.status !== 'claimed') {
        return res.status(409).json({
          success: false,
          error: claim.status === 'already-used' ? 'Already redeemed.' : 'This limited code has already been fully redeemed.'
        });
      }
      reward.usesRemaining = claim.remaining;
    } else {
      await updateUser(req.session.username, updates);
    }
    
    const updated = await findUser(req.session.username);
    res.json({ success: true, title: reward.title || null, reward: reward.rewardMessage || null, usesRemaining: reward.usesRemaining, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Redeem error:', error);
    res.status(500).json({ success: false, error: 'Redemption failed.' });
  }
});

// Buy Potion
app.post('/api/buy-potion', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { potionType } = req.body || {};
  const quantity = Number(req.body?.quantity ?? 1);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({ success: false, error: 'Choose a quantity from 1 to 99.' });
  }
  const potion = POTION_CATALOG[potionType];
  if (!potion || potion.craftOnly) {
    return res.status(400).json({ success: false, error: 'Invalid potion.' });
  }

  try {
    const user = await findUser(req.session.username);
    const totalCost = potion.cost * quantity;
    const totalVialCost = (potion.vialCost || 0) * quantity;
    if (user.coins < totalCost) {
      return res.json({ success: false, error: 'Not enough coins.' });
    }

    const potions = typeof user.potions === 'string' ? JSON.parse(user.potions) : (user.potions || {});
    const items = normalizeRecord(user.items, { empty_vial: 0 });
    if ((Number(items.empty_vial) || 0) < totalVialCost) {
      return res.json({ success: false, error: `Requires ${totalVialCost} Empty Vial to craft ${potion.name}.` });
    }
    if (totalVialCost) items.empty_vial -= totalVialCost;
    potions[potionType] = (Number(potions[potionType]) || 0) + quantity;

    await updateUser(req.session.username, {
      coins: user.coins - totalCost,
      potions: JSON.stringify(potions),
      ...(totalVialCost ? { items: JSON.stringify(items) } : {})
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, quantity, totalCost, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Buy potion error:', error);
    res.status(500).json({ success: false, error: 'Purchase failed.' });
  }
});

app.get('/api/shop/rotation', (req, res) => {
  if (!req.session?.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  res.json({ success: true, rotation: getShopRotation() });
});

// Buy Shop Item
app.post('/api/buy-shop-item', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { itemName } = req.body || {};
  const quantity = Number(req.body?.quantity ?? 1);
  if (quantity !== 1) {
    return res.status(400).json({ success: false, error: 'Rotating shop items can only be purchased one at a time.' });
  }
  const rotation = getShopRotation();
  if (itemName !== rotation.name) {
    return res.status(409).json({ success: false, error: 'That item is no longer in stock.', rotation });
  }
  const cost = rotation.cost;

  try {
    const user = await findUser(req.session.username);
    if (user.coins < cost) {
      return res.json({ success: false, error: 'Not enough coins.' });
    }

    const items = typeof user.items === 'string' ? JSON.parse(user.items) : (user.items || {});
    
    const itemKey = {
      'Portal Fragment': 'fragments', 'Clover Leaf': 'clovers', 'Sea Essence': 'essence',
      'Molten Rock': 'molten_rock', 'Ancient Ore': 'ancient_ore'
    }[itemName];
    if (!itemKey) return res.status(400).json({ success: false, error: 'That item cannot be purchased.' });
    items[itemKey] = (Number(items[itemKey]) || 0) + 1;

    await updateUser(req.session.username, {
      coins: user.coins - cost,
      items: JSON.stringify(items)
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, quantity, totalCost: cost, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Buy item error:', error);
    res.status(500).json({ success: false, error: 'Purchase failed.' });
  }
});

app.post('/api/use-potion', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const { potionType } = req.body || {};
  const potion = POTION_CATALOG[potionType];
  if (!potion) {
    return res.status(400).json({ success: false, error: 'Invalid potion.' });
  }

  try {
    const user = await findUser(req.session.username);
    const potions = typeof user.potions === 'string' ? JSON.parse(user.potions) : (user.potions || { luck: 0, speed: 0 });
    if ((potions[potionType] || 0) <= 0) {
      return res.json({ success: false, error: 'No potion available.' });
    }

    potions[potionType] -= 1;
    setUserActiveEffect(req.session.username, potion.effectKey, {
      multiplier: potion.multiplier,
      maxMultiplier: potion.maxMultiplier,
      endTime: Date.now() + potion.duration * 1000
    });

    await updateUser(req.session.username, {
      potions: JSON.stringify(potions)
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated), effect: { multiplier: potion.multiplier, duration: potion.duration, effect: potion.effect } });
  } catch (error) {
    console.error('Use potion error:', error);
    res.status(500).json({ success: false, error: 'Unable to use potion.' });
  }
});

app.post('/api/set-active-title', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const { titleId } = req.body || {};
  if (!titleId) {
    return res.status(400).json({ success: false, error: 'Title ID required.' });
  }

  try {
    const user = await findUser(req.session.username);
    const titles = getUnlockedTitles(user);
    if (!titles.includes(titleId)) {
      return res.status(400).json({ success: false, error: 'Title not owned.' });
    }
    await updateUser(req.session.username, { active_title: titleId, titles: JSON.stringify(titles) });
    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Set active title error:', error);
    res.status(500).json({ success: false, error: 'Unable to set title.' });
  }
});

app.post('/api/realms/sea/unlock', async (req, res) => {
  if (!req.session?.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  try {
    const user = await findUser(req.session.username);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    if (!user.portal_unlocked) return res.status(400).json({ success: false, error: 'Unlock the gateway with 10 Portal Fragments first.' });
    if (user.sea_realm_unlocked) return res.json({ success: true, alreadyUnlocked: true, user: sanitizeUser(user) });

    const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0 });
    if ((Number(items.essence) || 0) < 1) {
      return res.status(400).json({ success: false, error: '1 Sea Essence is required to permanently unlock the realm.' });
    }
    items.essence -= 1;
    const titles = normalizeList(user.titles);
    if (!titles.includes('tidekeeper')) titles.push('tidekeeper');

    await updateUser(req.session.username, {
      sea_realm_unlocked: true,
      items: JSON.stringify(items),
      titles: JSON.stringify(titles)
    });
    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Sea Realm unlock error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to unlock the realm. Please try again.' });
  }
});

app.post('/api/realms/forge/unlock', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    if (!user.portal_unlocked) return res.status(400).json({ success: false, error: 'Unlock the gateway with 10 Portal Fragments first.' });
    if (user.forge_realm_unlocked) return res.json({ success: true, alreadyUnlocked: true, user: sanitizeUser(user) });
    const items = normalizeRecord(user.items);
    if ((Number(items.ancient_ore) || 0) < 1 || (Number(items.molten_rock) || 0) < 30) {
      return res.status(400).json({ success: false, error: 'Forge Realm requires 1 Ancient Ore and 30 Molten Rock.' });
    }
    items.ancient_ore -= 1;
    items.molten_rock -= 30;
    await updateUser(req.session.username, { forge_realm_unlocked: true, items: JSON.stringify(items) });
    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Forge Realm unlock error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to unlock the Forge Realm.' });
  }
});

app.post('/api/enter-dimension', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const { dimension } = req.body || {};
  if (!['deep-sea', 'forge-realm'].includes(dimension)) {
    return res.status(400).json({ success: false, error: 'Invalid dimension.' });
  }

  try {
    const user = await findUser(req.session.username);
    const unlocked = dimension === 'deep-sea' ? user?.sea_realm_unlocked : user?.forge_realm_unlocked;
    if (!user?.portal_unlocked || !unlocked) {
      return res.status(403).json({ success: false, error: `Unlock the ${dimension === 'deep-sea' ? 'Sea' : 'Forge'} Realm before entering.` });
    }
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Enter dimension error:', error);
    res.status(500).json({ success: false, error: 'Unable to enter dimension.' });
  }
});

app.post('/api/forge/craft', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user?.forge_realm_unlocked) return res.status(403).json({ success: false, error: 'Forge Realm access is required.' });
    const items = normalizeRecord(user.items);
    const potions = normalizeRecord(user.potions);
    const recipe = String(req.body?.recipe || '');
    if (recipe === 'luck-v') {
      if ((Number(items.empty_vial) || 0) < 1 || (Number(potions.luck) || 0) < 3) {
        return res.status(400).json({ success: false, error: 'Requires 1 Empty Vial and 3 Luck Potion I.' });
      }
      items.empty_vial -= 1;
      potions.luck -= 3;
      potions['luck-v'] = (Number(potions['luck-v']) || 0) + 1;
    } else if (recipe === 'event-controller') {
      if ((Number(items.clovers) || 0) < 10 || (Number(items.old_potato_sticker) || 0) < 3) {
        return res.status(400).json({ success: false, error: 'Requires 10 Clover Leaves and 3 Old Potato Stickers.' });
      }
      items.clovers -= 10;
      items.old_potato_sticker -= 3;
      items.event_controller = (Number(items.event_controller) || 0) + 1;
    } else if (recipe === 'coin-ii') {
      if ((Number(items.fragments) || 0) < 5 || (Number(items.empty_vial) || 0) < 2) {
        return res.status(400).json({ success: false, error: 'Requires 5 Portal Fragments and 2 Empty Vials.' });
      }
      items.fragments -= 5;
      items.empty_vial -= 2;
      potions['coin-ii'] = (Number(potions['coin-ii']) || 0) + 1;
    } else {
      return res.status(400).json({ success: false, error: 'Unknown Forge recipe.' });
    }
    await updateUser(req.session.username, { items: JSON.stringify(items), potions: JSON.stringify(potions) });
    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Forge craft error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to craft that item.' });
  }
});

const FINN_QUESTS = [
  { title: 'First signal', description: 'Complete 100 rolls.', kind: 'spins', target: 100, reward: { coins: 10000, fragments: 3 } },
  { title: 'Steady hands', description: 'Collect 5 Clover Leaves.', kind: 'clovers', target: 5, reward: { coins: 30000, vials: 1 } },
  { title: 'Through the fracture', description: 'Collect 10 Portal Fragments.', kind: 'fragments', target: 10, reward: { coins: 100000, fragments: 5 } }
];
const finnQuestClaimsInFlight = new Set();

function getFinnQuestState(user) {
  const achievements = normalizeList(user?.achievements);
  const completed = FINN_QUESTS.filter((_, index) => achievements.includes(`finn-quest-${index + 1}`)).length;
  const quest = FINN_QUESTS[completed] || null;
  const items = normalizeRecord(user?.items);
  const progress = !quest ? 0 : quest.kind === 'spins'
    ? Number(user?.spins) || 0
    : Number(items[quest.kind]) || 0;
  return { completed, quest: quest ? { ...quest, progress: Math.min(progress, quest.target), ready: progress >= quest.target } : null };
}

app.get('/api/finn/quests', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const user = await findUser(req.session.username);
  if (!user) return res.status(404).json({ success: false, error: 'Player not found.' });
  res.json({ success: true, ...getFinnQuestState(user), user: sanitizeUser(user) });
});

app.post('/api/finn/quests/claim', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const claimKey = normalizeUsername(req.session.username);
  if (finnQuestClaimsInFlight.has(claimKey)) return res.status(409).json({ success: false, error: 'Quest reward is already being claimed.' });
  finnQuestClaimsInFlight.add(claimKey);
  try {
    const user = await findUser(req.session.username);
    if (!user) return res.status(404).json({ success: false, error: 'Player not found.' });
    const state = getFinnQuestState(user);
    if (!state.quest) return res.status(409).json({ success: false, error: 'All of Lord Finn’s quests are complete.' });
    if (!state.quest.ready) return res.status(409).json({ success: false, error: 'Quest requirements are not complete yet.' });
    const stage = state.completed + 1;
    const achievements = normalizeList(user.achievements);
    achievements.push(`finn-quest-${stage}`);
    const items = normalizeRecord(user.items);
    items.fragments = (Number(items.fragments) || 0) + (Number(state.quest.reward.fragments) || 0);
    items.empty_vial = (Number(items.empty_vial) || 0) + (Number(state.quest.reward.vials) || 0);
    const coins = (Number(user.coins) || 0) + state.quest.reward.coins;
    const updatedTitles = getUnlockedTitles({ ...user, coins, items, achievements });
    await updateUser(user.username, {
      achievements: JSON.stringify(achievements),
      items: JSON.stringify(items),
      coins,
      titles: JSON.stringify(updatedTitles)
    });
    const updatedUser = await findUser(user.username);
    res.json({ success: true, completed: stage, ...getFinnQuestState(updatedUser), reward: state.quest.reward, user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Finn quest claim error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to claim this quest right now.' });
  } finally {
    finnQuestClaimsInFlight.delete(claimKey);
  }
});

app.post('/api/forge/use-event-controller', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user?.forge_realm_unlocked) return res.status(403).json({ success: false, error: 'Forge Realm access is required.' });
    const eventName = String(req.body?.eventName || '');
    if (!Object.prototype.hasOwnProperty.call(GAME_EVENTS, eventName)) {
      return res.status(400).json({ success: false, error: 'Choose a valid event.' });
    }
    if (GAME_EVENTS[eventName].ownerOnly) {
      return res.status(403).json({ success: false, error: 'This event can only be started from the Owner Panel.' });
    }
    if (GAME_EVENTS[eventName].panelOnly) {
      return res.status(403).json({ success: false, error: 'This event can only be started from an Admin or Owner Panel.' });
    }
    if (gameShutdown) return res.status(503).json({ success: false, error: 'Events are unavailable during shutdown.' });
    const items = normalizeRecord(user.items);
    if ((Number(items.event_controller) || 0) < 1) return res.status(400).json({ success: false, error: 'You need an Event Controller.' });
    items.event_controller -= 1;
    await updateUser(req.session.username, { items: JSON.stringify(items) });
    const event = startGameEvent(eventName, user.username, 120);
    const updated = await findUser(req.session.username);
    res.json({ success: true, event: { title: event.title, durationSeconds: event.durationSeconds }, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Event Controller error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to activate the Event Controller.' });
  }
});

app.post('/api/sea/dive/start', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user?.sea_realm_unlocked) {
      return res.status(403).json({ success: false, error: 'Unlock the Sea Realm before diving.' });
    }
    const key = normalizeUsername(req.session.username);
    let session = activeDiveSessions.get(key);
    const now = Date.now();
    if (session?.nodes.every(node => node.collected) && now < session.cooldownUntil) {
      return res.status(429).json({ success: false, serverTime: now, retryAfterMs: session.cooldownUntil - now, cooldownUntil: session.cooldownUntil, dive: getDiveState(session), error: 'You must wait two minutes between dives.' });
    }
    if (!session || session.nodes.every(node => node.collected)) {
      session = createDiveSession();
      activeDiveSessions.set(key, session);
    }
    res.json({ success: true, serverTime: Date.now(), dive: getDiveState(session) });
  } catch (error) {
    console.error('Dive start error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to start the dive.' });
  }
});

app.post('/api/sea/dive/collect', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const key = normalizeUsername(req.session.username);
  const session = activeDiveSessions.get(key);
  if (!session) return res.status(409).json({ success: false, error: 'Start a dive before collecting signals.' });
  const node = session.nodes.find(candidate => candidate.id === String(req.body?.nodeId || '') && !candidate.collected);
  if (!node) return res.status(409).json({ success: false, error: 'That signal was already collected or is no longer available.' });

  node.collected = true;
  const username = req.session.username;
  const user = await findUser(username);
  const selection = selectWeightedOption(getActiveDiveOptions(), getLuckMultiplier(username, 'deep-sea'));
  const result = { ...selection.result, rollChance: selection.rollChance };
  const inventory = normalizeInventory(user.inventory);
  const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0 });
  const potions = normalizeRecord(user.potions, { luck: 0, 'luck-ii': 0, coin: 0, speed: 0 });
  if (result.itemType === 'potion') {
    const potionType = ['luck', 'luck-ii', 'coin', 'speed'][Math.floor(Math.random() * 4)];
    potions[potionType] = (Number(potions[potionType]) || 0) + 1;
    result.name = `${POTION_CATALOG[potionType].name} Cache`;
    result.potionType = potionType;
  } else if (result.key === 'treasure-chest') {
    items.treasure_chest = (Number(items.treasure_chest) || 0) + 1;
  } else {
    inventory.rarities[result.key] = (Number(inventory.rarities[result.key]) || 0) + 1;
  }
  result.serialNumber = await assignHalloweenSerial(result.key, inventory);
  const event = getActiveGameEvent();
  const reward = Math.round((Math.round((Number(result.reward) || 0) * (event?.coinMultiplier || 1)) + (event?.bonusCoins || 0)) * getActiveEffectMultiplier(username, 'coin'));
  const coins = Number(user.coins || 0) + reward;
  result.reward = reward;
  const titles = getUnlockedTitles({ ...user, inventory, items, coins });
  await updateUser(username, {
    inventory: JSON.stringify(inventory),
    items: JSON.stringify(items),
    potions: JSON.stringify(potions),
    coins,
    titles: JSON.stringify(titles)
  });
  const updatedUser = await findUser(username);
  if (result.isGlobal) {
    result.globalRevealToken = createGlobalRevealToken(user.username, result);
  }
  if (session.nodes.every(candidate => candidate.collected)) session.cooldownUntil = Date.now() + 120000;
  res.json({ success: true, serverTime: Date.now(), dive: getDiveState(session), result: { ...result, user: sanitizeUser(updatedUser) } });
});

app.post('/api/sea/open-treasure-chest', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user?.sea_realm_unlocked) return res.status(403).json({ success: false, error: 'Sea Realm access is required.' });
    const items = normalizeRecord(user.items, { treasure_chest: 0, old_potato_sticker: 0, empty_vial: 0 });
    if ((Number(items.treasure_chest) || 0) < 1) {
      return res.status(400).json({ success: false, error: 'You do not have a Treasure Chest.' });
    }
    items.treasure_chest -= 1;
    items.old_potato_sticker = (Number(items.old_potato_sticker) || 0) + 1;
    items.empty_vial = (Number(items.empty_vial) || 0) + 1;
    const titles = getUnlockedTitles({ ...user, items });
    await updateUser(req.session.username, { items: JSON.stringify(items), titles: JSON.stringify(titles) });
    const updatedUser = await findUser(req.session.username);
    res.json({ success: true, contents: ['Old Potato Sticker', 'Empty Vial'], user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Treasure chest error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to open the Treasure Chest.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const user = await findUser(req.session.username);
  if (!user || !user.is_admin) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }

  try {
    if (pool) {
      const result = await executeQuery('SELECT * FROM users ORDER BY username ASC');
      const users = result.rows.map(sanitizeUser);
      return res.json({ success: true, users });
    }
    const users = Object.values(inMemoryStore.users).map(sanitizeUser);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, error: 'Unable to load users.' });
  }
});

app.get('/api/admin/inbox-log', async (req, res) => {
    if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    const user = await findUser(req.session.username);
    if (!user || !hasAdminPanelAccess(user)) return res.status(403).json({ success: false, error: 'Admin Panel access required.' });
    try {
      if (pool) {
        const result = await executeQuery(
          `SELECT id, sender, recipient, message, gift_type AS "giftType", gift_key AS "giftKey",
                  gift_amount AS "giftAmount", created_at AS "createdAt"
           FROM inbox_messages ORDER BY created_at DESC, id DESC LIMIT 200`
        );
        return res.json({ success: true, messages: result.rows });
      }
      const messages = [...inMemoryStore.inboxMessages]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 200)
        .map(message => ({
          id: message.id,
          sender: message.sender,
          recipient: message.recipient,
          message: message.message,
          giftType: message.giftType,
          giftKey: message.giftKey,
          giftAmount: message.giftAmount,
          createdAt: message.createdAt
        }));
      res.json({ success: true, messages });
    } catch (error) {
      console.error('Admin inbox log error:', error.message || error);
      res.status(503).json({ success: false, error: 'Unable to load inbox activity.' });
    }
  });

app.get('/api/admin/audit', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const user = await findUser(req.session.username);
  if (!user || !hasAdminPanelAccess(user)) return res.status(403).json({ success: false, error: 'Admin Panel access required.' });
  try {
    if (pool) {
      const result = await executeQuery(
        'SELECT actor, action, target, details, created_at AS "createdAt" FROM admin_audit_log ORDER BY created_at DESC LIMIT 100'
      );
      return res.json({ success: true, records: result.rows });
    }
    res.json({ success: true, records: inMemoryStore.adminAudit.slice(0, 100) });
  } catch (error) {
    console.error('Admin audit load error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to load admin activity.' });
  }
});

app.get('/api/admin/rules-agreements', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user || !hasAdminPanelAccess(user)) {
      return res.status(403).json({ success: false, error: 'Admin Panel access required.' });
    }
    if (pool) {
      const result = await executeQuery(
        'SELECT username, rules_agreed_at AS "agreedAt" FROM users ORDER BY username ASC'
      );
      return res.json({ success: true, records: result.rows });
    }
    const records = Object.values(inMemoryStore.users)
      .map(account => ({ username: account.username, agreedAt: account.rules_agreed_at || null }))
      .sort((left, right) => left.username.localeCompare(right.username));
    res.json({ success: true, records });
  } catch (error) {
    console.error('Rules agreement log error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to load the Rules Agreement Log.' });
  }
});

async function renamePlayerAccount(oldUsername, newUsername) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO users (username, password, coins, spins, inventory, achievements, is_admin, potions, items, titles, redeemed_codes, active_title, portal_unlocked, sea_realm_unlocked, forge_realm_unlocked, is_banned, ban_reason, created_at, last_login, playtime_seconds, rules_agreed_at)
         SELECT $1, password, coins, spins, inventory, achievements, is_admin, potions, items, titles, redeemed_codes, active_title, portal_unlocked, sea_realm_unlocked, forge_realm_unlocked, is_banned, ban_reason, created_at, last_login, playtime_seconds, rules_agreed_at
         FROM users WHERE username = $2 RETURNING username`,
        [newUsername, oldUsername]
      );
      if (!inserted.rowCount) throw new Error('Player account changed before the rename completed.');
      await client.query('UPDATE inbox_messages SET sender = $1 WHERE sender = $2', [newUsername, oldUsername]);
      await client.query('UPDATE inbox_messages SET recipient = $1 WHERE recipient = $2', [newUsername, oldUsername]);
      await client.query('UPDATE limited_code_redemptions SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
      await client.query('UPDATE chat_messages SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
      await client.query('UPDATE chat_messages SET reply_to_username = $1 WHERE reply_to_username = $2', [newUsername, oldUsername]);
      await client.query('DELETE FROM users WHERE username = $1', [oldUsername]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const account = inMemoryStore.users[oldUsername];
    if (!account) throw new Error('Player account not found.');
    delete inMemoryStore.users[oldUsername];
    inMemoryStore.users[newUsername] = { ...account, username: newUsername };
    inMemoryStore.chatMessages.forEach(message => {
      if (message.username === oldUsername) message.username = newUsername;
      if (message.replyTo?.username === oldUsername) message.replyTo.username = newUsername;
    });
    inMemoryStore.inboxMessages.forEach(message => {
      if (message.sender === oldUsername) message.sender = newUsername;
      if (message.recipient === oldUsername) message.recipient = newUsername;
    });
  }

  const oldKey = normalizeUsername(oldUsername);
  const newKey = normalizeUsername(newUsername);
  if (playtimeLastTick.has(oldKey)) {
    playtimeLastTick.set(newKey, playtimeLastTick.get(oldKey));
    playtimeLastTick.delete(oldKey);
  }
  if (activeEffectsStore[oldKey]) {
    activeEffectsStore[newKey] = activeEffectsStore[oldKey];
    delete activeEffectsStore[oldKey];
  }
  if (activeDiveSessions.has(oldKey)) {
    activeDiveSessions.set(newKey, activeDiveSessions.get(oldKey));
    activeDiveSessions.delete(oldKey);
  }
  if (pendingGlobalReveals.has(oldKey)) {
    pendingGlobalReveals.set(newKey, pendingGlobalReveals.get(oldKey));
    pendingGlobalReveals.delete(oldKey);
  }
  limitedCodeClaims.forEach(claimants => {
    if (claimants.delete(oldUsername)) claimants.add(newUsername);
  });

  const sessions = await new Promise(resolve => sessionStore.all((error, records) => resolve(error ? {} : records || {})));
  await Promise.all(Object.entries(sessions).filter(([, storedSession]) => normalizeUsername(storedSession.username) === oldKey).map(([sessionId, storedSession]) => new Promise(resolve => {
    storedSession.username = newUsername;
    sessionStore.set(sessionId, storedSession, () => resolve());
  })));

  const oldRoom = `user:${oldKey}`;
  const newRoom = `user:${newKey}`;
  const sockets = await io.in(oldRoom).fetchSockets();
  await Promise.all(sockets.map(async socket => {
    if (socket.request?.session && normalizeUsername(socket.request.session.username) === oldKey) {
      socket.request.session.username = newUsername;
      await new Promise(resolve => socket.request.session.save(() => resolve()));
    }
    await socket.leave(oldRoom);
    await socket.join(newRoom);
  }));
}

app.post('/api/admin/users/:username', async (req, res) => {
  if (!req.session?.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  try {
    const admin = await findUser(req.session.username);
    if (!admin?.is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required.' });
    }

    const target = await findUser(req.params.username);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    const { type, amount, potion, item, banned, reason, grant } = req.body || {};
    if (type === 'password') {
      const newPassword = String(req.body?.newPassword || '');
      if (newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({ success: false, error: 'New password must be 8–128 characters.' });
      }
      await updateUser(target.username, { password: hashPassword(newPassword) });
      await recordAdminAudit(admin.username, 'Changed player password', target.username);
      return res.json({ success: true, username: target.username });
    }
    if (type === 'username') {
      const targetIsAdmin = target.is_admin || getUnlockedTitles(target).includes('admin');
      const isRenamingSelf = normalizeUsername(target.username) === normalizeUsername(admin.username);
      if (targetIsAdmin && !isRenamingSelf) {
        return res.status(403).json({ success: false, error: 'Admin account usernames cannot be changed here.' });
      }
      const newUsername = String(req.body?.newUsername || '').trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(newUsername)) {
        return res.status(400).json({ success: false, error: 'Use 3–32 letters, numbers, underscores, or hyphens; start with a letter or number.' });
      }
      if (normalizeUsername(newUsername) === normalizeUsername(target.username)) {
        return res.status(400).json({ success: false, error: 'Choose a different username.' });
      }
      const usernameTaken = pool
        ? (await executeQuery('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [newUsername])).rows.length > 0
        : Object.keys(inMemoryStore.users).some(username => normalizeUsername(username) === normalizeUsername(newUsername));
      if (usernameTaken) return res.status(409).json({ success: false, error: 'That username is already taken.' });
      const previousUsername = target.username;
      try {
        await renamePlayerAccount(previousUsername, newUsername);
      } catch (error) {
        console.error('Player username change error:', error.message || error);
        return res.status(503).json({ success: false, error: 'Unable to rename this player and preserve their account history.' });
      }
      if (isRenamingSelf) {
        req.session.username = newUsername;
        await new Promise(resolve => req.session.save(error => {
          if (error) console.error('Owner session rename save error:', error.message || error);
          resolve();
        }));
      }
      await recordAdminAudit(admin.username, 'Changed player username', newUsername, `Previous username: ${previousUsername}`);
      return res.json({ success: true, username: newUsername, user: isRenamingSelf ? sanitizeUser(await findUser(newUsername)) : null });
    }
    let updates;
    if (type === 'ban') {
      if (target.is_admin || normalizeUsername(target.username) === normalizeUsername(admin.username)) {
        return res.status(400).json({ success: false, error: 'Administrator accounts cannot be banned here.' });
      }
      if (typeof banned !== 'boolean') {
        return res.status(400).json({ success: false, error: 'Choose whether this player should be banned.' });
      }
      updates = {
        is_banned: banned,
        ban_reason: banned ? String(reason || '').trim().slice(0, 250) : ''
      };
    } else if (type === 'title') {
      if (normalizeUsername(admin.username) !== 'mr_fernanski') {
        return res.status(403).json({ success: false, error: 'Only Mr Fernanski can grant the Admin title.' });
      }
      if (typeof grant !== 'boolean') return res.status(400).json({ success: false, error: 'Choose whether to grant the Admin title.' });
      const titles = getUnlockedTitles(target).filter(title => title !== 'admin');
      if (grant) titles.push('admin');
      updates = {
        titles: JSON.stringify(titles),
        ...(!grant && target.active_title === 'admin' ? { active_title: null } : {})
      };
    } else if (type === 'forge-realm') {
      if (typeof grant !== 'boolean') return res.status(400).json({ success: false, error: 'Choose whether Forge access should be enabled.' });
      updates = { forge_realm_unlocked: grant };
    } else {
      const quantity = Number(amount);
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        return res.status(400).json({ success: false, error: 'Enter a valid whole-number amount.' });
      }
      if (type === 'coins') {
        if (quantity > 2147483647) {
          return res.status(400).json({ success: false, error: 'Coin balance is too large.' });
        }
        updates = { coins: quantity };
      } else if (type === 'potion' && Object.prototype.hasOwnProperty.call(POTION_CATALOG, potion) && quantity >= 1 && quantity <= 99) {
        const potions = normalizeRecord(target.potions, { luck: 0, 'luck-ii': 0, coin: 0, speed: 0 });
        potions[potion] = Math.min(999, (Number(potions[potion]) || 0) + quantity);
        updates = { potions: JSON.stringify(potions) };
        } else if (type === 'item' && ['fragments', 'clovers', 'essence', 'light_essence', 'molten_rock', 'ancient_ore', 'event_controller', 'old_potato_sticker', 'empty_vial', 'treasure_chest'].includes(item) && quantity >= 1 && quantity <= 99) {
        const items = normalizeRecord(target.items);
        items[item] = Math.min(999, (Number(items[item]) || 0) + quantity);
        updates = { items: JSON.stringify(items) };
      } else {
        return res.status(400).json({ success: false, error: 'Invalid player adjustment.' });
      }
    }

    await updateUser(target.username, updates);
    await recordAdminAudit(admin.username, `Updated player ${type}`, target.username, type === 'ban' ? (banned ? updates.ban_reason : 'Ban removed') : 'Account settings changed');
    const updatedTarget = { ...target, ...updates };
    if (typeof updatedTarget.potions === 'string') updatedTarget.potions = normalizeRecord(updatedTarget.potions);
    if (typeof updatedTarget.items === 'string') updatedTarget.items = normalizeRecord(updatedTarget.items);
    if (type === 'ban') {
      const room = `user:${normalizeUsername(target.username)}`;
      if (banned) {
        const sockets = await io.in(room).fetchSockets();
        sockets.forEach(socket => { socket.data.isBanned = true; });
      }
      io.to(room).emit(banned ? 'player-banned' : 'player-unbanned', { reason: updates.ban_reason });
      if (banned) {
        setTimeout(() => io.in(room).disconnectSockets(true), 500).unref?.();
      }
    }
    res.json({ success: true, user: sanitizeUser(updatedTarget) });
  } catch (error) {
    console.error('Admin player update error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to update player. Check the database and try again.' });
  }
});

app.post('/api/admin/global-drop', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const admin = await findUser(req.session.username);
    if (!admin?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
    const type = String(req.body?.type || '');
    const key = String(req.body?.key || '');
    const amount = Number(req.body?.amount);
    const ownerMessage = String(req.body?.message || '').trim().slice(0, 500);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99) {
      return res.status(400).json({ success: false, error: 'Choose a quantity from 1 to 99.' });
    }

    const rarity = [...CORE_RARITIES, ...DIVE_OPTIONS].find(option => option.key === key && !option.isItem && !option.halloweenOnly);
    const itemKeys = ['fragments', 'clovers', 'essence', 'light_essence', 'molten_rock', 'ancient_ore', 'event_controller', 'old_potato_sticker', 'empty_vial', 'treasure_chest'];
    if (!((type === 'rarity' && rarity) || (type === 'potion' && POTION_CATALOG[key]) || (type === 'item' && itemKeys.includes(key)))) {
      return res.status(400).json({ success: false, error: 'Choose a valid rarity, potion, or item.' });
    }

    const recipients = pool
      ? (await executeQuery('SELECT username FROM users')).rows.map(user => user.username)
      : Object.keys(inMemoryStore.users);

    const itemNames = { fragments: 'Portal Fragment', clovers: 'Clover Leaf', essence: 'Sea Essence', light_essence: 'Light Essence', molten_rock: 'Molten Rock', ancient_ore: 'Ancient Ore', event_controller: 'Event Controller', old_potato_sticker: 'Old Potato Sticker', empty_vial: 'Empty Vial', treasure_chest: 'Treasure Chest' };
    const name = type === 'rarity' ? rarity.name : type === 'potion' ? POTION_CATALOG[key].name : itemNames[key];
    if (pool) {
      await executeQuery(
        `INSERT INTO inbox_messages (sender, recipient, message, gift_type, gift_key, gift_amount)
         SELECT $1, recipient, $2, $3, $4, $5 FROM unnest($6::text[]) AS targets(recipient)`,
        [admin.username, ownerMessage, type, key, amount, recipients]
      );
    } else {
      recipients.forEach(recipient => inMemoryStore.inboxMessages.push({
        id: crypto.randomUUID(), sender: admin.username, recipient, message: ownerMessage,
        giftType: type, giftKey: key, giftAmount: amount, createdAt: new Date().toISOString(), readAt: null, claimedAt: null
      }));
    }
    recipients.forEach(recipient => io.to(`user:${normalizeUsername(recipient)}`).emit('inbox-message', {
      sender: admin.username, recipient, message: ownerMessage, giftType: type, giftKey: key, giftAmount: amount
    }));
    const announcement = `${admin.username} sent ${amount} × ${name} to every inbox. Claim it there.${ownerMessage ? ` ${ownerMessage}` : ''}`;
    const chatRecord = await saveChatMessage(admin.username, announcement, 'OWNER PANEL DROP', '#fbbf24', false, true);
    await recordAdminAudit(admin.username, 'Sent global drop', '', `${amount} × ${name} to ${recipients.length} players`);
    io.emit('global-chat-message', chatRecord);
    io.emit('global-drop', { type, key, amount, name, pendingClaim: true });
    return res.json({ success: true, count: recipients.length, name, amount, pendingClaim: true });
  } catch (error) {
    console.error('Global drop error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Unable to grant the global drop.' });
  }
});

app.get('/api/players/leaderboard', async (req, res) => {
    if (!req.session?.username) return res.status(401).json({ success: false, error: 'Login required.' });
    try {
      const users = pool
        ? (await executeQuery('SELECT * FROM users ORDER BY spins DESC, username ASC')).rows
        : Object.values(inMemoryStore.users);
      const sockets = await io.fetchSockets();
      const online = new Map();
      sockets.forEach(socket => {
        const username = socket.request?.session?.username;
        if (username) online.set(normalizeUsername(username), { username, status: socket.data.activity || 'At the RNG console' });
      });
      const players = users.map(user => {
        const safe = sanitizeUser(user);
        const presence = online.get(normalizeUsername(safe.username));
        return {
          username: safe.username,
          online: Boolean(presence),
          status: presence?.status || 'Offline',
          coins: safe.coins,
          rolls: safe.spins
        };
      }).sort((left, right) => (Number(right.rolls) || 0) - (Number(left.rolls) || 0) || left.username.localeCompare(right.username));
      res.json({ success: true, onlineCount: online.size, players });
    } catch (error) {
      console.error('Leaderboard load error:', error.message || error);
      res.status(503).json({ success: false, error: 'Unable to load players.' });
    }
  });

app.get('/api/mini-admin/overview', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const viewer = await findUser(req.session.username);
    if (!viewer || !hasAdminPanelAccess(viewer)) {
      return res.status(403).json({ success: false, error: 'The Admin title is required.' });
    }
    const users = pool
      ? (await executeQuery('SELECT * FROM users ORDER BY username ASC')).rows
      : Object.values(inMemoryStore.users);
    const sockets = await io.fetchSockets();
    const online = new Map();
    sockets.forEach(socket => {
      const username = socket.request?.session?.username;
      if (username) online.set(normalizeUsername(username), socket.data.activity || 'In the lobby');
    });
    const roster = users.map(user => {
      const safe = sanitizeUser(user);
      return {
        username: safe.username,
        online: online.has(normalizeUsername(safe.username)),
        activity: online.get(normalizeUsername(safe.username)) || 'Offline',
        coins: safe.coins,
        spins: safe.spins,
        inventoryTotal: safe.inventoryTotal,
        isAdmin: Boolean(safe.is_admin || (safe.titles || []).includes('admin')),
        isBanned: Boolean(safe.is_banned),
        banReason: safe.ban_reason || ''
      };
    });
    res.json({ success: true, users: roster, onlineCount: online.size, activeEvent: getActiveGameEvent() });
  } catch (error) {
    console.error('Mini admin overview error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to load player activity.' });
  }
});

app.post('/api/mini-admin/users/:username/ban', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const moderator = await findUser(req.session.username);
    if (!hasAdminPanelAccess(moderator)) return res.status(403).json({ success: false, error: 'The Admin title is required.' });
    const target = await findUser(req.params.username);
    if (!target) return res.status(404).json({ success: false, error: 'Player not found.' });
    if (normalizeUsername(target.username) === normalizeUsername(moderator.username)
      || target.is_admin || getUnlockedTitles(target).includes('admin')) {
      return res.status(403).json({ success: false, error: 'Admins cannot change access for themselves or another admin.' });
    }
    const { banned, reason } = req.body || {};
    if (typeof banned !== 'boolean') return res.status(400).json({ success: false, error: 'Choose whether to ban or unban this player.' });
    const banReason = banned ? String(reason || '').trim().slice(0, 250) : '';
    await updateUser(target.username, { is_banned: banned, ban_reason: banReason });
    const room = `user:${normalizeUsername(target.username)}`;
    io.to(room).emit(banned ? 'player-banned' : 'player-unbanned', { reason: banReason });
    if (banned) setTimeout(() => io.in(room).disconnectSockets(true), 500).unref?.();
    await recordAdminAudit(moderator.username, banned ? 'Banned player' : 'Unbanned player', target.username, banReason);
    res.json({ success: true, username: target.username, isBanned: banned, banReason });
  } catch (error) {
    console.error('Mini admin ban error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to update player access.' });
  }
});

app.post('/api/mini-admin/event', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user || !hasAdminPanelAccess(user)) {
      return res.status(403).json({ success: false, error: 'The Admin title is required.' });
    }
    const eventName = String(req.body?.eventName || '');
    const action = req.body?.action === 'stop' ? 'stop' : 'start';
    if (!['starlight-surge', 'meteor-shower', 'abyssal-resonance', 'confetti-party'].includes(eventName)) {
      return res.status(400).json({ success: false, error: 'This event is not available in the Admin Panel.' });
    }
    if (gameShutdown) return res.status(503).json({ success: false, error: 'Events are unavailable during shutdown.' });
    if (action === 'stop') {
      if (activeGameEvent?.eventName !== eventName || activeGameEvent.initiatedBy !== user.username) {
        return res.status(403).json({ success: false, error: 'You can only end your own active event.' });
      }
      stopGameEvent(eventName);
      await recordAdminAudit(user.username, 'Ended game event', eventName);
      return res.json({ success: true, stopped: true });
    }
    const event = startGameEvent(eventName, user.username);
    await recordAdminAudit(user.username, 'Started game event', eventName);
    res.json({ success: true, event: { title: event.title } });
  } catch (error) {
    console.error('Mini admin event error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to manage this event.' });
  }
});

app.post('/api/mini-admin/announcement', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user || !hasAdminPanelAccess(user)) {
      return res.status(403).json({ success: false, error: 'The Admin title is required.' });
    }
    const title = String(req.body?.title || '').trim().slice(0, 80);
    const content = String(req.body?.content || '').trim().slice(0, 500);
    if (!title || !content) return res.status(400).json({ success: false, error: 'Enter an announcement title and message.' });
    const record = await saveChatMessage(user.username, `${title}: ${content}`, 'Admin Panel', '#fb7185', false, false, true);
    await recordAdminAudit(user.username, 'Sent admin announcement', '', title);
    io.emit('chat-message', record);
    io.emit('admin-announcement', { title, content });
    res.json({ success: true });
  } catch (error) {
    console.error('Mini admin announcement error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to send the announcement.' });
  }
});

// Unlock Portal
app.post('/api/unlock-portal', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  try {
    const user = await findUser(req.session.username);
    const items = typeof user.items === 'string' ? JSON.parse(user.items) : (user.items || {});

    if ((items.fragments || 0) < 10) {
      return res.json({ success: false, error: 'Need 10 Portal Fragments.' });
    }

    items.fragments -= 10;
    const titles = typeof user.titles === 'string' ? JSON.parse(user.titles) : (user.titles || []);
    if (!titles.includes('portalmancer')) {
      titles.push('portalmancer');
    }

    await updateUser(req.session.username, {
      portal_unlocked: true,
      items: JSON.stringify(items),
      titles: JSON.stringify(titles)
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Portal unlock error:', error);
    res.status(500).json({ success: false, error: 'Failed.' });
  }
});

app.post('/api/admin/announcement', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const user = await findUser(req.session.username);
  if (!user || !user.is_admin) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }

  const { title, content } = req.body || {};
  if (!String(title || '').trim() || !String(content || '').trim()) {
    return res.status(400).json({ success: false, error: 'Title and content required.' });
  }

  const announcement = {
    id: Date.now().toString(),
    title: String(title).trim().slice(0, 100),
    content: String(content).trim().slice(0, 1000),
    timestamp: new Date().toISOString(),
    admin: user.username
  };

  const chatMsg = {
    username: 'ADMIN ALERT',
    message: `${announcement.title}: ${announcement.content}`,
    timestamp: announcement.timestamp,
    system: false,
    isAnnouncement: true,
    title: 'ADMIN ANNOUNCEMENT',
    titleColor: '#fb923c'
  };
  const persisted = await saveChatMessage(chatMsg.username, chatMsg.message, chatMsg.title, chatMsg.titleColor, false, false, true);
  io.emit('admin-announcement', announcement);
  io.emit('chat-message', persisted);
  await recordAdminAudit(user.username, 'Sent announcement', '', announcement.title);

  res.json({ success: true, announcement });
});

app.get('/api/admin/shutdown', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
  res.json({ success: true, active: gameShutdown });
});

app.get('/api/admin/headline', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!hasAdminPanelAccess(user)) return res.status(403).json({ success: false, error: 'Admin Panel access required.' });
  res.json({ success: true, headline: adminHeadline });
});

app.post('/api/admin/headline', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!hasAdminPanelAccess(user)) return res.status(403).json({ success: false, error: 'Admin Panel access required.' });
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Headline visibility must be enabled or disabled.' });
  }
  const text = String(req.body?.text || '').trim().slice(0, 220);
  if (req.body.active && !text) {
    return res.status(400).json({ success: false, error: 'Enter headline text before enabling it.' });
  }
  const previousHeadline = adminHeadline;
  adminHeadline = normalizeAdminHeadline({ ...req.body, active: req.body.active, text });
  try {
    await persistAdminHeadline();
  } catch (error) {
    adminHeadline = previousHeadline;
    console.error('Headline persistence error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Headline could not be saved. Please try again.' });
  }
  io.emit('admin-headline', adminHeadline);
  await recordAdminAudit(user.username, 'Updated moving headline', '', adminHeadline.active ? adminHeadline.label : 'Headline turned off');
  res.json({ success: true, headline: adminHeadline });
});

app.post('/api/admin/shutdown', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Shutdown state must be true or false.' });
  }
  gameShutdown = req.body.active;
  await recordAdminAudit(user.username, gameShutdown ? 'Enabled maintenance mode' : 'Resumed game services');
  io.emit('shutdown-state', { active: gameShutdown, message: 'Update or Fix in progress please wait' });
  res.json({ success: true, active: gameShutdown });
});

app.post('/api/admin/change-password', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  const owner = await findUser(req.session.username);
  if (!owner?.is_admin) return res.status(403).json({ success: false, error: 'Owner Panel access required.' });
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (hashPassword(currentPassword) !== owner.password) return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
  if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ success: false, error: 'New password must be 8–128 characters.' });
  await updateUser(owner.username, { password: hashPassword(newPassword) });
  await recordAdminAudit(owner.username, 'Changed owner password');
  res.json({ success: true });
});

app.post('/api/admin/update-shutdown', async (req, res) => {
  const owner = req.session?.username ? await findUser(req.session.username) : null;
  if (!owner?.is_admin) return res.status(403).json({ success: false, error: 'Owner Panel access required.' });
  gameUpdated = true;
  await recordAdminAudit(owner.username, 'Started update shutdown');
  io.emit('game-updated', { message: 'Game has been updated. Please refresh your page.' });
  res.json({ success: true });
});

app.post('/api/admin/owner-command', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const owner = await findUser(req.session.username);
    if (!owner?.is_admin) return res.status(403).json({ success: false, error: 'Owner Panel access required.' });
    const command = String(req.body?.command || '');
    if (command === 'clear-chat') {
      await clearChatHistory();
      io.emit('chat-history', []);
      io.emit('global-chat-history', []);
      await recordAdminAudit(owner.username, 'Cleared chat history');
      return res.json({ success: true, message: 'Player and global chats cleared.' });
    }
    if (command === 'end-active-event') {
      const event = getActiveGameEvent();
      if (!event) return res.status(409).json({ success: false, error: 'No event is currently active.' });
      stopGameEvent(event.eventName);
      await recordAdminAudit(owner.username, 'Ended game event', event.eventName);
      return res.json({ success: true, message: `${event.title} ended.` });
    }
    return res.status(400).json({ success: false, error: 'Unknown Owner Panel command.' });
  } catch (error) {
    console.error('Owner command error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to run that Owner Panel command.' });
  }
});

// Admin broadcast message to all players (short chat message)
app.post('/api/broadcast', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const user = await findUser(req.session.username);
  if (!user || !user.is_admin) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }

  const { message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, error: 'Message required.' });
  }

  const text = String(message).trim().slice(0, 500);
  const chatRecord = await saveChatMessage('BROADCAST', text, 'Broadcast', '#ffd700', true);
  io.emit('chat-message', chatRecord);
  io.emit('system-message', { username: 'System', message: `Broadcast sent by ${req.session.username}`, timestamp: new Date().toISOString(), system: true });
  res.json({ success: true });
});

app.get('/api/chat', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Login required to view chat.' });
  }
  try {
    res.json({ success: true, messages: await getRecentChatMessages(60, false) });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ success: false, error: 'Unable to load chat.' });
  }
});

app.get('/api/global-chat', async (req, res) => {
  if (!req.session?.username) {
    return res.status(401).json({ success: false, error: 'Login required to view chat.' });
  }
  try {
    res.json({
      success: true,
      messages: await getRecentChatMessages(100, true),
      rarities: await getGlobalRarityCounts()
    });
  } catch (error) {
    console.error('Global chat history error:', error);
    res.status(500).json({ success: false, error: 'Unable to load global drops.' });
  }
});

app.get('/api/inbox', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Login required to view your inbox.' });
  const username = req.session.username.trim();
  const folder = req.query.folder === 'sent' ? 'sent' : 'inbox';
  const previewOnly = req.query.preview === '1';
  try {
    let messages;
    let unreadCount = 0;
    if (pool) {
      const ownerColumn = folder === 'sent' ? 'sender' : 'recipient';
      const otherColumn = folder === 'sent' ? 'recipient' : 'sender';
      let result = { rows: [] };
      if (folder === 'inbox' && previewOnly) {
        const unread = await executeQuery('SELECT COUNT(*)::int AS count FROM inbox_messages WHERE recipient = $1 AND read_at IS NULL', [username]);
        unreadCount = unread.rows[0].count;
      } else if (folder === 'inbox') {
        result = await executeQuery(
          `WITH unread AS (
             SELECT COUNT(*)::int AS count FROM inbox_messages WHERE recipient = $1 AND read_at IS NULL
           ), marked AS (
             UPDATE inbox_messages SET read_at = NOW() WHERE recipient = $1 AND read_at IS NULL RETURNING id
           )
           SELECT id, sender, recipient, message, gift_type, gift_key, gift_amount, created_at, read_at, claimed_at,
                  unread.count AS unread_count
           FROM inbox_messages CROSS JOIN unread
           WHERE recipient = $1 ORDER BY created_at DESC LIMIT 100`,
          [username]
        );
        unreadCount = Number(result.rows[0]?.unread_count) || 0;
      } else if (!previewOnly) {
        result = await executeQuery(
          `SELECT id, sender, recipient, message, gift_type, gift_key, gift_amount, created_at, read_at, claimed_at
           FROM inbox_messages WHERE ${ownerColumn} = $1 ORDER BY created_at DESC LIMIT 100`,
          [username]
        );
      }
      messages = result.rows.map(row => ({
        id: row.id,
        sender: row.sender,
        recipient: row.recipient,
        otherUser: row[otherColumn],
        message: row.message,
        giftType: row.gift_type,
        giftKey: row.gift_key,
        giftAmount: row.gift_amount,
        createdAt: row.created_at,
        readAt: row.read_at,
        claimedAt: row.claimed_at
      }));
    } else {
      if (folder === 'inbox') {
        unreadCount = inMemoryStore.inboxMessages.filter(row => row.recipient === username && !row.readAt).length;
      }
      messages = previewOnly ? [] : inMemoryStore.inboxMessages
        .filter(row => row[folder === 'sent' ? 'sender' : 'recipient'] === username)
        .slice(-100)
        .reverse()
        .map(row => {
          if (folder === 'inbox') row.readAt ||= new Date().toISOString();
          return { ...row, otherUser: folder === 'sent' ? row.recipient : row.sender };
        });
    }
    res.json({ success: true, folder, messages, unreadCount });
  } catch (error) {
    console.error('Inbox load error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to load your inbox.' });
  }
});

app.get('/api/inbox/recipients', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Login required.' });
  try {
    const currentUsername = req.session.username.trim();
    const usernames = pool
      ? (await executeQuery('SELECT username FROM users WHERE username <> $1 ORDER BY username LIMIT 500', [currentUsername])).rows.map(row => row.username)
      : Object.keys(inMemoryStore.users).filter(username => username !== currentUsername).sort((left, right) => left.localeCompare(right)).slice(0, 500);
    res.json({ success: true, usernames });
  } catch (error) {
    console.error('Inbox recipient load error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to load player list.' });
  }
});

app.post('/api/inbox', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Login required to send a message.' });
  const senderName = req.session.username.trim();
  const recipientName = String(req.body?.recipient || '').trim().slice(0, 32);
  const message = String(req.body?.message || '').trim().slice(0, 500);
  const rawGiftType = String(req.body?.giftType || 'none').trim();
  const giftType = rawGiftType === 'none' ? null : rawGiftType;
  const giftKey = giftType ? String(req.body?.giftKey || '').trim() : null;
  const giftAmount = giftType ? Number(req.body?.giftAmount) : 0;

  if (!recipientName || normalizeUsername(recipientName) === normalizeUsername(senderName)) {
    return res.status(400).json({ success: false, error: 'Choose another player as the recipient.' });
  }
  if (!message && !giftType) return res.status(400).json({ success: false, error: 'Write a message or include a gift.' });
  if (giftType && !['coins', 'item', 'potion'].includes(giftType)) {
    return res.status(400).json({ success: false, error: 'Choose coins, an item, or a potion as the gift.' });
  }
  const maxGiftAmount = giftType === 'coins' ? 1000000000 : 99;
  if (giftType && (!Number.isSafeInteger(giftAmount) || giftAmount < 1 || giftAmount > maxGiftAmount)) {
    return res.status(400).json({ success: false, error: `Gift quantity must be from 1 to ${maxGiftAmount.toLocaleString()}.` });
  }
  if (giftType === 'item' && !INBOX_ITEM_GIFTS.has(giftKey)) {
    return res.status(400).json({ success: false, error: 'Choose a valid item gift.' });
  }
  if (giftType === 'potion' && !POTION_CATALOG[giftKey]) {
    return res.status(400).json({ success: false, error: 'Choose a valid potion gift.' });
  }

  try {
    let record;
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const accountNames = [senderName, recipientName].sort((left, right) => left.localeCompare(right));
        const accounts = await client.query(
          'SELECT * FROM users WHERE username = ANY($1::text[]) ORDER BY username FOR UPDATE',
          [accountNames]
        );
        const sender = accounts.rows.find(user => user.username === senderName);
        const recipient = accounts.rows.find(user => user.username === recipientName);
        if (!sender || !recipient) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Recipient not found.' });
        }
        const transfer = prepareInboxGiftTransfers(sender, recipient, giftType, giftKey, giftAmount);
        if (transfer.error) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: transfer.error });
        }
        const applyUpdates = async (username, updates) => {
          const keys = Object.keys(updates);
          if (!keys.length) return;
          const values = keys.map(key => updates[key]);
          const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
          await client.query(`UPDATE users SET ${setClause} WHERE username = $${keys.length + 1}`, [...values, username]);
        };
        await applyUpdates(senderName, transfer.senderUpdates);
        const inserted = await client.query(
          `INSERT INTO inbox_messages (sender, recipient, message, gift_type, gift_key, gift_amount)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, sender, recipient, message, gift_type, gift_key, gift_amount, created_at, read_at, claimed_at`,
          [senderName, recipientName, message, giftType, giftKey, giftAmount]
        );
        await client.query('COMMIT');
        const row = inserted.rows[0];
        record = {
          id: row.id, sender: row.sender, recipient: row.recipient, message: row.message,
          giftType: row.gift_type, giftKey: row.gift_key, giftAmount: row.gift_amount,
          createdAt: row.created_at, readAt: row.read_at, claimedAt: row.claimed_at
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      const sender = await findUser(senderName);
      const recipient = await findUser(recipientName);
      if (!sender || !recipient) return res.status(404).json({ success: false, error: 'Recipient not found.' });
      const transfer = prepareInboxGiftTransfers(sender, recipient, giftType, giftKey, giftAmount);
      if (transfer.error) return res.status(400).json({ success: false, error: transfer.error });
      await updateUser(senderName, transfer.senderUpdates);
      record = {
        id: crypto.randomUUID(), sender: senderName, recipient: recipientName, message,
        giftType, giftKey, giftAmount, createdAt: new Date().toISOString(), readAt: null, claimedAt: null
      };
      inMemoryStore.inboxMessages.push(record);
    }

    io.to(`user:${normalizeUsername(recipientName)}`).emit('inbox-message', record);
    const updatedSender = await findUser(senderName);
    res.json({ success: true, message: record, user: sanitizeUser(updatedSender) });
  } catch (error) {
    console.error('Inbox send error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to send your message.' });
  }
});

app.post('/api/inbox/:messageId/claim', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Login required.' });
  const username = req.session.username.trim();
  const messageId = String(req.params.messageId || '').slice(0, 64);
  const claimKey = `${normalizeUsername(username)}:${messageId}`;
  if (inboxClaimsInFlight.has(claimKey)) return res.status(409).json({ success: false, error: 'This gift is already being claimed.' });
  inboxClaimsInFlight.add(claimKey);

  try {
    let updatedUser;
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const messageResult = await client.query(
          'SELECT * FROM inbox_messages WHERE id = $1 AND recipient = $2 FOR UPDATE',
          [messageId, username]
        );
        const message = messageResult.rows[0];
        if (!message) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Inbox message not found.' });
        }
        if (message.claimed_at || !message.gift_type) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, error: 'This inbox entry has no unclaimed gift.' });
        }
        const recipientResult = await client.query('SELECT * FROM users WHERE username = $1 FOR UPDATE', [username]);
        const recipient = recipientResult.rows[0];
        if (!recipient) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Player not found.' });
        }
        const claim = prepareInboxGiftClaim(recipient, message.gift_type, message.gift_key, Number(message.gift_amount));
        if (claim.error) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: claim.error });
        }
        const keys = Object.keys(claim.updates);
        const values = keys.map(key => claim.updates[key]);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        await client.query(`UPDATE users SET ${setClause} WHERE username = $${keys.length + 1}`, [...values, username]);
        await client.query('UPDATE inbox_messages SET claimed_at = NOW() WHERE id = $1', [message.id]);
        await client.query('COMMIT');
        updatedUser = await findUser(username);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      const message = inMemoryStore.inboxMessages.find(entry => String(entry.id) === messageId && entry.recipient === username);
      if (!message) return res.status(404).json({ success: false, error: 'Inbox message not found.' });
      if (message.claimedAt || !message.giftType) return res.status(409).json({ success: false, error: 'This inbox entry has no unclaimed gift.' });
      const recipient = await findUser(username);
      if (!recipient) return res.status(404).json({ success: false, error: 'Player not found.' });
      const claim = prepareInboxGiftClaim(recipient, message.giftType, message.giftKey, Number(message.giftAmount));
      if (claim.error) return res.status(400).json({ success: false, error: claim.error });
      message.claimedAt = new Date().toISOString();
      await updateUser(username, claim.updates);
      updatedUser = await findUser(username);
    }
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Inbox claim error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to claim this gift.' });
  } finally {
    inboxClaimsInFlight.delete(claimKey);
  }
});

app.post('/api/chat', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Login required to chat.' });
  }
  const text = String(req.body?.message || '').trim().slice(0, 500);
  if (!text && !req.body?.attachment) {
    return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
  }
  try {
    const user = await findUser(req.session.username);
    if (containsProfanity(text)) {
      warnForProfanity(req.session.username);
      return res.status(400).json({
        success: false,
        code: 'CHAT_MODERATION',
        error: `${req.session.username}, do not do it again.`
      });
    }
    const attachmentResult = validateChatAttachment(req.body?.attachment, hasAdminPanelAccess(user));
    if (attachmentResult.error) return res.status(400).json({ success: false, error: attachmentResult.error });
    const badge = getChatBadge(user);
    const record = await saveChatMessage(req.session.username, text, badge.title, badge.titleColor, false, false, false, req.body?.replyTo, attachmentResult.attachment);
    io.emit('chat-message', record);
    await notifyChatTargets(record);
    res.json({ success: true, message: record });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ success: false, error: 'Unable to send chat message.' });
  }
});

app.delete('/api/chat/:messageId', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Login required.' });
  try {
    const user = await findUser(req.session.username);
    if (!user || (!user.is_admin && !getUnlockedTitles(user).includes('admin'))) {
      return res.status(403).json({ success: false, error: 'Admin Panel or Owner Panel access required.' });
    }
    const messageId = String(req.params.messageId || '').slice(0, 64);
    let deleted = false;
    if (pool) {
      const result = await executeQuery('DELETE FROM chat_messages WHERE id = $1 RETURNING id', [messageId]);
      deleted = result.rowCount > 0;
    } else {
      const previousLength = inMemoryStore.chatMessages.length;
      inMemoryStore.chatMessages = inMemoryStore.chatMessages.filter(message => String(message.id) !== messageId);
      deleted = inMemoryStore.chatMessages.length < previousLength;
    }
    if (!deleted) return res.status(404).json({ success: false, error: 'Chat message not found.' });
    io.emit('chat-message-deleted', { id: messageId });
    res.json({ success: true, id: messageId });
  } catch (error) {
    console.error('Chat message delete error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to delete that chat message.' });
  }
});

// Socket.IO middleware
io.use((socket, next) => {
  const response = {
    getHeader: () => undefined,
    setHeader: () => {},
    removeHeader: () => {}
  };
  sessionMiddleware(socket.request, response, async error => {
    if (error) return next(error);
    const username = socket.request?.session?.username;
    if (!username) return next();
    try {
      const user = await findUser(username);
      if (user && !user.rules_agreed_at) return next(new Error('rules-agreement-required'));
      next();
    } catch (lookupError) {
      next(lookupError);
    }
  });
});


// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`🔌 RNG 3 Player connected: ${socket.id}`);
  const socketUsername = socket.request?.session?.username;
  const socketUser = socketUsername ? await findUser(socketUsername) : null;
  if (socketUser?.is_banned) {
    socket.emit('player-banned', { reason: socketUser.ban_reason || '' });
    setTimeout(() => socket.disconnect(true), 500).unref?.();
    return;
  }
  socket.data.isAdmin = Boolean(socketUser?.is_admin);
  socket.data.canAdmin = Boolean(socketUser && hasAdminPanelAccess(socketUser));
  socket.data.isBanned = false;
  socket.data.activity = 'At the RNG console';
  if (socketUsername) {
    const playtimeKey = normalizeUsername(socketUsername);
    if (!playtimeLastTick.has(playtimeKey)) playtimeLastTick.set(playtimeKey, Date.now());
    socket.join(`user:${playtimeKey}`);
  }
  if (socket.data.canAdmin) {
    socket.join('admin-chat');
  }
  broadcastOnlineRoster();

  if (gameShutdown && !socket.data.isAdmin) {
    socket.emit('shutdown-state', { active: true, message: 'Update or Fix in progress please wait' });
  }
  if (gameUpdated) socket.emit('game-updated', { message: 'Game has been updated. Please refresh your page.' });
  socket.emit('admin-headline', adminHeadline);

  socket.emit('chat-history', await getRecentChatMessages(60, false));
  socket.emit('global-chat-history', await getRecentChatMessages(100, true));
  if (socket.data.canAdmin) socket.emit('admin-chat-history', await getRecentAdminChatMessages(100));
  const runningEvent = getActiveGameEvent();
  if (runningEvent) {
    socket.emit('theme-event', { ...runningEvent, active: true });
  }
  socket.emit('system-message', {
    username: 'System',
    message: 'Welcome to RNG 3 chat. Be kind and enjoy the roll!',
    timestamp: new Date().toISOString(),
    system: true
  });

  socket.on('disconnect', async () => {
    clearTimeout(socket.data.chatTypingTimeout);
    if (socket.data.chatTyping && socketUsername) {
      socket.broadcast.emit('chat-typing', { username: socketUsername, typing: false });
    }
    console.log(`🔌 RNG 3 Player disconnected: ${socket.id}`);
    if (socketUsername) {
      const playtimeKey = normalizeUsername(socketUsername);
      const remainingSockets = await io.in(`user:${playtimeKey}`).fetchSockets();
      if (!remainingSockets.length) {
        await recordPlayerPlaytime(socketUsername, Date.now(), true);
        playtimeLastTick.delete(playtimeKey);
      }
    }
    broadcastOnlineRoster();
  });

  socket.on('join-game', () => {
    socket.emit('game-joined', {
      message: 'Welcome to RNG 3!',
      version: '3.0.0',
      features: ['New Mechanics', 'Enhanced UI', 'Community Features']
    });
  });

  socket.on('player-activity', async activity => {
    const username = socket.request?.session?.username;
    if (!username || socket.data.isBanned) return;
    const safeActivity = String(activity || '').trim().slice(0, 64);
    if (['At the RNG console', 'Diving in the Sea Realm', 'At the Forge', 'Browsing inventory', 'Using the shop', 'Browsing titles', 'In chat', 'Viewing settings'].includes(safeActivity)) {
      socket.data.activity = safeActivity;
      await recordPlayerPlaytime(username);
      broadcastOnlineRoster();
    }
  });

  socket.on('chat-message', async (data) => {
    const username = socket.request?.session?.username;
    if (!username) {
      socket.emit('system-message', {
        username: 'System',
        message: 'Log in to send chat messages.',
        timestamp: new Date().toISOString(),
        system: true
      });
      return;
    }
    if (gameShutdown || socket.data.isBanned) return;
    clearTimeout(socket.data.chatTypingTimeout);
    if (socket.data.chatTyping && socketUsername) {
      socket.data.chatTyping = false;
      socket.broadcast.emit('chat-typing', { username: socketUsername, typing: false });
    }
    const text = String(data?.message || '').trim().slice(0, 500);
    if (!text && !data?.attachment) return;
    const user = await findUser(username);
    if (containsProfanity(text)) {
      warnForProfanity(username);
      return;
    }
    const attachmentResult = validateChatAttachment(data?.attachment, hasAdminPanelAccess(user));
    if (attachmentResult.error) {
      socket.emit('system-message', { username: 'System', message: attachmentResult.error, timestamp: new Date().toISOString(), system: true });
      return;
    }
    const badge = getChatBadge(user);
    const record = await saveChatMessage(username, text, badge.title, badge.titleColor, false, false, false, data?.replyTo, attachmentResult.attachment);
    io.emit('chat-message', record);
    await notifyChatTargets(record);
  });

  socket.on('admin-chat-message', async data => {
    const username = socket.request?.session?.username;
    if (!username || socket.data.isBanned || !(await isAdminSocket(socket))) return;
    await socket.join('admin-chat');
    const text = String(data?.message || '').trim().slice(0, 500);
    if (!text && !data?.attachment) return;
    if (containsProfanity(text)) {
      warnForProfanity(username);
      return;
    }
    const user = await findUser(username);
    const attachmentResult = validateChatAttachment(data?.attachment, true);
    if (attachmentResult.error) {
      socket.emit('system-message', { username: 'System', message: attachmentResult.error, timestamp: new Date().toISOString(), system: true });
      return;
    }
    const badge = getChatBadge(user);
    const record = await saveChatMessage(username, text, badge.title, badge.titleColor, false, false, false, null, attachmentResult.attachment, true);
    await broadcastAdminChatMessage(record);
  });

  socket.on('admin-chat-history-request', async () => {
    if (!(await isAdminSocket(socket))) return;
    await socket.join('admin-chat');
    socket.emit('admin-chat-history', await getRecentAdminChatMessages(100));
  });

  socket.on('chat-typing', isTyping => {
    const username = socket.request?.session?.username;
    if (!username || socket.data.isBanned || gameShutdown) return;
    clearTimeout(socket.data.chatTypingTimeout);
    socket.data.chatTyping = Boolean(isTyping);
    socket.broadcast.emit('chat-typing', { username, typing: socket.data.chatTyping });
    if (socket.data.chatTyping) {
      socket.data.chatTypingTimeout = setTimeout(() => {
        socket.data.chatTyping = false;
        socket.broadcast.emit('chat-typing', { username, typing: false });
      }, 4000);
      socket.data.chatTypingTimeout.unref?.();
    }
  });

  socket.on('clear-chat', async () => {
    if (!(await isAdminSocket(socket))) {
      socket.emit('system-message', {
        username: 'System',
        message: 'Admin privileges required to clear chat.',
        timestamp: new Date().toISOString(),
        system: true
      });
      return;
    }
    await clearChatHistory();
    io.emit('chat-history', []);
    io.emit('global-chat-history', []);
    io.emit('system-message', {
      username: 'System',
      message: 'Chat history has been cleared by an administrator.',
      timestamp: new Date().toISOString(),
      system: true
    });
  });

  socket.on('admin-event', async (data, acknowledge) => {
    const respond = payload => {
      if (typeof acknowledge === 'function') acknowledge(payload);
    };
    try {
      if (!(await isAdminSocket(socket))) {
        respond({ success: false, error: 'Admin privileges required.' });
        socket.emit('system-message', {
          username: 'System',
          message: 'Admin privileges required to trigger events.',
          timestamp: new Date().toISOString(),
          system: true
        });
        return;
      }
      if (gameShutdown) {
        respond({ success: false, error: 'Events are unavailable during shutdown.' });
        return;
      }
      const eventName = String(data?.eventName || '').trim().toLowerCase();
      const action = data?.action === 'stop' ? 'stop' : 'start';
      if (!Object.prototype.hasOwnProperty.call(GAME_EVENTS, eventName)) {
        respond({ success: false, error: 'Unknown event.' });
        return;
      }
      if (GAME_EVENTS[eventName].ownerOnly && !socket.data.isAdmin) {
        respond({ success: false, error: 'This event is only available to the owner.' });
        return;
      }
      if (action === 'stop') {
        if (!stopGameEvent(eventName)) {
          respond({ success: false, error: 'That event is not active.' });
          return;
        }
        respond({ success: true, stopped: true });
        return;
      }
      const event = startGameEvent(eventName, socket.request?.session?.username || 'Admin');
      respond({ success: true, event: { title: event.title, durationSeconds: event.durationSeconds } });
    } catch (error) {
      console.error('Admin event error:', error.message || error);
      respond({ success: false, error: 'Unable to start the event.' });
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('RNG 3 Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    version: '3.0.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    version: '3.0.0'
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await ensureDatabase();
    await loadAdminHeadline();
    server.listen(PORT, () => {
      console.log(`🚀 RNG 3 Server running on port ${PORT}`);
      console.log(`📅 Version: 3.0.0 - The Next Generation`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Ready for players!`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 RNG 3 Server shutting down gracefully...');
  server.close(() => {
    console.log('✅ RNG 3 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 RNG 3 Server interrupted...');
  server.close(() => {
    console.log('✅ RNG 3 Server closed');
    process.exit(0);
  });
});

module.exports = app;
