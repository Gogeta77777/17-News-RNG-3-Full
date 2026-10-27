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
  chatMessages: []
};

const ROTATING_SHOP_ITEMS = [
  { name: 'Portal Fragment', cost: 15000, rarity: 'epic' },
  { name: 'Clover Leaf', cost: 500, rarity: 'common' },
  { name: 'Sea Essence', cost: 300000, rarity: 'legendary' },
  { name: 'Molten Rock', cost: 1000, rarity: 'common' },
  { name: 'Ancient Ore', cost: 100000, rarity: 'legendary' }
];
const SHOP_ROTATION_INTERVAL_MS = 10 * 60 * 1000;
const HALLOWEEN_END_AT = Date.UTC(2026, 10, 2);
const LOCAL_SETTINGS_PATH = path.join(os.tmpdir(), '17-news-rng-3-settings.json');
const CORE_RARITIES = [
  { key: '17-news', name: '17 News', chance: 66.13, reward: 150, color: '#0f172a' },
  { key: '17-news-reborn', name: '17 News Reborn', chance: 20, reward: 300, color: '#38bdf8' },
  { key: 'daniel-poole', name: 'Daniel Poole', chance: 4, reward: 450, color: '#166534' },
  { key: 'dominik-procter', name: 'Dominik Procter', chance: 3, reward: 450, color: '#0d9488' },
  { key: 'gabe-muir', name: 'Gabe Muir', chance: 2, reward: 450, color: '#115e59' },
  { key: 'inesh-jayasinghe', name: 'Inesh Jayasinghe', chance: 1.5, reward: 550, color: '#7c3aed' },
  { key: 'leo-thacker', name: 'Leo Thacker', chance: 0.8, reward: 700, color: '#2dd4bf' },
  { key: 'sam-whitworth', name: 'Sam Whitworth', chance: 0.7, reward: 700, color: '#f97316' },
  { key: 'john-tan', name: 'John Tan', chance: 0.6, reward: 1050, color: '#f87171' },
  { key: 'rison-pandigama', name: 'Rison Pandigama', chance: 0.4, reward: 1250, color: '#c084fc' },
  { key: 'atticus-lok', name: 'Atticus Lok', chance: 0.3, reward: 1750, color: '#ddd6fe' },
  { key: 'baxter-walter', name: 'Baxter Walter', chance: 0.2, reward: 2250, color: '#facc15' },
  { key: 'mr-fermanski', name: 'Mr Fernanski', chance: 0.15, reward: 3333, isGlobal: true, color: '#f59e0b', glowColor: '#ef4444' },
  { key: 'ellerslie-schoolcast', name: 'Ellerslie Schoolcast', chance: 0.1, reward: 5000, isGlobal: true, color: '#1e3a8a', glowColor: '#38bdf8' },
  { key: 'the-ceo', name: 'The CEO', chance: 0.05, reward: 7000, isGlobal: true, color: '#000000', glowColor: '#f8fafc' },
  { key: 'mrs-joseph-mcglashan', name: 'Mrs Joseph Mcglashan', chance: 0.07, reward: 9500, isGlobal: true, color: '#16a34a', glowColor: '#4ade80' }
];
const HALLOWEEN_RARITIES = [
  { key: 'pumpkin-baxter', name: 'Pumpkin Baxter', chance: 0.1, reward: 12000, color: '#f97316', glowColor: '#fdba74', halloweenOnly: true, isGlobal: true },
  { key: 'grim-reaper', name: 'Grim Reaper', chance: 0.01, reward: 50000, color: '#7c3aed', glowColor: '#c4b5fd', halloweenOnly: true, isGlobal: true }
];
const halloweenRaritySerials = new Map();
const limitedCodeClaims = new Map();

function isHalloweenUpdateActive(now = Date.now()) {
  return now < HALLOWEEN_END_AT;
}

function getActiveCoreRarities() {
  return isHalloweenUpdateActive() ? [...CORE_RARITIES, ...HALLOWEEN_RARITIES] : CORE_RARITIES;
}

const DIVE_OPTIONS = [
  ...CORE_RARITIES.map(rarity => rarity.key === '17-news' ? { ...rarity, chance: 64.08 } : rarity),
  { key: 'treasure-chest', name: 'Treasure Chest', chance: 0.5, reward: 350, isItem: true, color: '#fbbf24' },
  { key: 'potion-cache', name: 'Potion Cache', chance: 1.5, reward: 0, isItem: true, itemType: 'potion', color: '#a3e635' },
  { key: 'fisher-baxter', name: 'Fisher Baxter', chance: 0.05, reward: 12000, color: '#7dd3fc', glowColor: '#dbeafe', diveOnly: true, isGlobal: true },
  { key: 'sharky', name: 'Sharky', chance: 0.5, reward: 4500, color: '#0ea5e9', glowColor: '#7dd3fc', diveOnly: true }
];

function getActiveDiveOptions() {
  return isHalloweenUpdateActive() ? [...DIVE_OPTIONS, ...HALLOWEEN_RARITIES] : DIVE_OPTIONS;
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
  owner: { name: 'Owner', color: '#fbbf24' },
  admin: { name: 'Admin', color: '#fb7185' },
  veteran: { name: 'Veteran', color: '#38bdf8' },
  millionaire: { name: 'Millionaire', color: '#4ade80' },
  portalmancer: { name: 'Portalmancer', color: '#a78bfa' },
  'locked-in': { name: 'Locked In', color: '#22d3ee' },
  'endless-frequency': { name: 'The Endless Frequency', color: '#60a5fa' },
  potato: { name: 'Potato', color: '#8b5a2b' },
  collector: { name: 'Rarity Collector', color: '#34d399' },
  'global-headliner': { name: 'Global Headliner', color: '#fb7185' },
  tidekeeper: { name: 'Tidekeeper', color: '#2dd4bf' },
  blacksmith: { name: 'Blacksmith', color: '#fb923c' },
  'halloween-2026': { name: 'Halloween 2026', color: '#f97316' }
};

function isAdministratorUser(user) {
  const username = String(user?.username || '').trim().toLowerCase();
  return Boolean(user?.is_admin || username === 'mr_fernanski' || username === 'testadmin');
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
  if (user?.portal_unlocked) titles.add('portalmancer');
  if (spins >= 1000) titles.add('locked-in');
  if (spins >= 5000) titles.add('endless-frequency');
  if ((Number(items.old_potato_sticker) || 0) >= 1) titles.add('potato');
  if (rarityTotal >= 10) titles.add('collector');
  if (hasGlobalDrop) titles.add('global-headliner');
  if (user?.sea_realm_unlocked) titles.add('tidekeeper');
  if (user?.forge_realm_unlocked) titles.add('blacksmith');
  if (hasHalloweenDrop) titles.add('halloween-2026');

  return [...titles].filter(title => Object.prototype.hasOwnProperty.call(TITLE_CATALOG, title));
}

function getChatBadge(user) {
  const titles = getUnlockedTitles(user);
  const titleId = user?.active_title && titles.includes(user.active_title)
    ? user.active_title
    : (isAdministratorUser(user) ? 'owner' : null);
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
  existing[effectType] = {
    ...data,
    multiplier: Math.max(1, Number(current?.multiplier) || 1) * Math.max(1, Number(data.multiplier) || 1),
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
  return getActiveEffectMultiplier(username, 'luck')
    * getActiveEffectMultiplier(username, 'deep-luck')
    * (dimension === 'deep-sea' ? 4 : 1)
    * eventLuckMultiplier;
}

function computeSpinMultiplier() {
  return 1;
}

function selectWeightedOption(options, luckMultiplier = 1) {
  const weightFor = option => option.chance * (option.chance < 20 ? luckMultiplier : 1);
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
  const now = Date.now();
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
  return { nodes, cooldownUntil: now + 120000 };
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
    const potions = normalizeRecord(user.potions, { luck: 0, 'luck-ii': 0, speed: 0 });
    const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 });
    const titles = getUnlockedTitles({ ...user, inventory });
    return {
      username: user.username,
      password: user.password,
      coins: user.coins,
      spins: user.spins,
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
    inventory: normalizeInventory(stored.inventory),
    achievements: normalizeList(stored.achievements),
    potions: normalizeRecord(stored.potions, { luck: 0, 'luck-ii': 0, speed: 0 }),
    items: normalizeRecord(stored.items, { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 }),
    titles: getUnlockedTitles(stored),
    redeemed_codes: normalizeList(stored.redeemed_codes),
    is_admin: isAdministratorUser(stored),
    is_banned: stored.is_banned || false,
    ban_reason: stored.ban_reason || '',
    portal_unlocked: stored.portal_unlocked || false,
    active_title: stored.active_title || null,
    sea_realm_unlocked: stored.sea_realm_unlocked || false,
    forge_realm_unlocked: stored.forge_realm_unlocked || false
  };
}

async function saveUser(user) {
  const normalized = user.username.trim();
  if (pool) {
    const result = await executeQuery(
      `INSERT INTO users (username, password, coins, spins, inventory, achievements, potions, items, titles, redeemed_codes, active_title, portal_unlocked, sea_realm_unlocked, forge_realm_unlocked, is_admin, created_at, last_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (username) DO NOTHING
       RETURNING username`,
      [
        normalized,
        user.password,
        user.coins,
        user.spins,
        JSON.stringify(user.inventory),
        JSON.stringify(user.achievements),
        JSON.stringify(user.potions || { luck: 0, 'luck-ii': 0, speed: 0 }),
        JSON.stringify(user.items || { fragments: 0, clovers: 0, essence: 0, molten_rock: 0, ancient_ore: 0, old_potato_sticker: 0, empty_vial: 0, treasure_chest: 0, event_controller: 0 }),
        JSON.stringify(user.titles || []),
        JSON.stringify(user.redeemed_codes || []),
        user.active_title || null,
        user.portal_unlocked || false,
        user.sea_realm_unlocked || false,
        user.forge_realm_unlocked || false,
        user.is_admin,
        user.created_at || new Date().toISOString(),
        user.last_login || new Date().toISOString()
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
      last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      is_announcement BOOLEAN NOT NULL DEFAULT false
    )
  `);
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
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await executeQuery(`
    ALTER TABLE chat_messages
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS title_color TEXT NOT NULL DEFAULT '#7dd3fc',
      ADD COLUMN IF NOT EXISTS system BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT false
  `);
  await executeQuery('CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages (created_at DESC)');
  await executeQuery("UPDATE users SET inventory = inventory #- ARRAY['rarities', 'kayla-walters'] WHERE inventory ? 'rarities' AND (inventory->'rarities') ? 'kayla-walters'");
}

const GAME_EVENTS = {
  'starlight-surge': {
    title: 'Starlight Surge',
    coinMultiplier: 2,
    bonusCoins: 0,
    luckMultiplier: 2,
    description: '2x coins and 2x luck'
  },
  'meteor-shower': {
    title: 'Meteor Shower',
    coinMultiplier: 2,
    bonusCoins: 300,
    description: '2x coins and +300 bonus coins per roll'
  },
  'abyssal-resonance': {
    title: 'Abyssal Resonance',
    coinMultiplier: 2,
    bonusCoins: 250,
    luckMultiplier: 3,
    description: '3x luck and +250 bonus coins, amplified in the Sea Realm'
  }
};

let activeGameEvent = null;
let activeGameEventTimeout = null;
let adminHeadline = { active: false, text: '' };

function normalizeAdminHeadline(value) {
  const text = String(value?.text || '').trim().slice(0, 220);
  return { active: Boolean(value?.active && text), text };
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
      `SELECT username, message, created_at, title, title_color, system, is_global, is_announcement
       FROM chat_messages ${globalOnly === null ? '' : 'WHERE is_global = $1'}
       ORDER BY created_at DESC LIMIT $${globalOnly === null ? 1 : 2}`,
      globalOnly === null ? [limit] : [globalOnly, limit]
    );
    return result.rows.reverse().map(row => ({
      username: row.username,
      message: row.message,
      title: row.title,
      titleColor: row.title_color || '#7dd3fc',
      timestamp: row.created_at,
      system: row.system || false,
      isGlobalDrop: row.is_global || false,
      isAnnouncement: row.is_announcement || false
    }));
  }
  return inMemoryStore.chatMessages
    .filter(message => globalOnly === null || Boolean(message.isGlobalDrop) === globalOnly)
    .slice(-limit);
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

async function saveChatMessage(username, message, title = null, titleColor = '#7dd3fc', system = false, isGlobalDrop = false, isAnnouncement = false) {
  const record = {
    username: username || 'Guest',
    message,
    title,
    titleColor,
    timestamp: new Date().toISOString(),
    system,
    isGlobalDrop,
    isAnnouncement
  };

  if (pool) {
    await executeQuery(
      'INSERT INTO chat_messages (username, message, title, title_color, system, is_global, is_announcement) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [record.username, record.message, title, titleColor, system, isGlobalDrop, isAnnouncement]
    );
  } else {
    inMemoryStore.chatMessages.push(record);
    if (inMemoryStore.chatMessages.length > 200) {
      inMemoryStore.chatMessages.shift();
    }
  }

  return record;
}

async function clearChatHistory() {
  if (pool) {
    await executeQuery('TRUNCATE chat_messages');
  }
  inMemoryStore.chatMessages = [];
}

async function isAdminSocket(socket) {
  const username = socket.request?.session?.username;
  if (!username) return false;
  const user = await findUser(username);
  return user && user.is_admin;
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
app.use('/api', apiLimiter);

let gameShutdown = false;
app.use('/api', async (req, res, next) => {
  const apiPath = req.originalUrl.split('?')[0].replace(/^\/api/, '') || '/';
  const maintenancePaths = ['/login', '/register', '/session', '/logout', '/admin/shutdown', '/admin/headline'];
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
    inventory: { rarities: {} },
    achievements: [],
    potions: { luck: 0, 'luck-ii': 0, speed: 0 },
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
  const finalReward = Math.round(rawReward * multiplier) + eventBonus;

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
    'MRFERNANSKIHALLOW2026': { coins: 1000000, item: { key: 'event_controller', amount: 3 }, rewardMessage: '1,000,000 coins and 3 Event Controllers', maxUses: 2, expiresAt: HALLOWEEN_END_AT }
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

app.post('/api/forge/use-event-controller', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user?.forge_realm_unlocked) return res.status(403).json({ success: false, error: 'Forge Realm access is required.' });
    const eventName = String(req.body?.eventName || '');
    if (!Object.prototype.hasOwnProperty.call(GAME_EVENTS, eventName)) {
      return res.status(400).json({ success: false, error: 'Choose a valid event.' });
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
      return res.status(429).json({ success: false, cooldownUntil: session.cooldownUntil, dive: getDiveState(session), error: 'You must wait two minutes between dives.' });
    }
    if (!session || session.nodes.every(node => node.collected)) {
      session = createDiveSession();
      activeDiveSessions.set(key, session);
    }
    res.json({ success: true, dive: getDiveState(session) });
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
  const potions = normalizeRecord(user.potions, { luck: 0, 'luck-ii': 0, speed: 0 });
  if (result.itemType === 'potion') {
    const potionType = ['luck', 'luck-ii', 'speed'][Math.floor(Math.random() * 3)];
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
  const reward = Math.round((Number(result.reward) || 0) * (event?.coinMultiplier || 1)) + (event?.bonusCoins || 0);
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
  res.json({ success: true, dive: getDiveState(session), result: { ...result, user: sanitizeUser(updatedUser) } });
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
        const potions = normalizeRecord(target.potions, { luck: 0, 'luck-ii': 0, speed: 0 });
        potions[potion] = Math.min(999, (Number(potions[potion]) || 0) + quantity);
        updates = { potions: JSON.stringify(potions) };
      } else if (type === 'item' && ['fragments', 'clovers', 'essence', 'molten_rock', 'ancient_ore', 'event_controller', 'old_potato_sticker', 'empty_vial', 'treasure_chest'].includes(item) && quantity >= 1 && quantity <= 99) {
        const items = normalizeRecord(target.items);
        items[item] = Math.min(999, (Number(items[item]) || 0) + quantity);
        updates = { items: JSON.stringify(items) };
      } else {
        return res.status(400).json({ success: false, error: 'Invalid player adjustment.' });
      }
    }

    await updateUser(target.username, updates);
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
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99) {
      return res.status(400).json({ success: false, error: 'Choose a quantity from 1 to 99.' });
    }

    const rarity = [...CORE_RARITIES, ...HALLOWEEN_RARITIES, ...DIVE_OPTIONS].find(option => option.key === key && !option.isItem);
    const itemKeys = ['fragments', 'clovers', 'essence', 'molten_rock', 'ancient_ore', 'event_controller', 'old_potato_sticker', 'empty_vial', 'treasure_chest'];
    if (!((type === 'rarity' && rarity) || (type === 'potion' && POTION_CATALOG[key]) || (type === 'item' && itemKeys.includes(key)))) {
      return res.status(400).json({ success: false, error: 'Choose a valid rarity, potion, or item.' });
    }

    const targets = pool
      ? (await executeQuery('SELECT * FROM users')).rows
      : Object.values(inMemoryStore.users);
    for (const target of targets) {
      const updates = {};
      if (type === 'rarity') {
        const inventory = normalizeInventory(target.inventory);
        inventory.rarities[key] = Math.min(999, (Number(inventory.rarities[key]) || 0) + amount);
        updates.inventory = JSON.stringify(inventory);
        updates.titles = JSON.stringify(getUnlockedTitles({ ...target, inventory }));
      } else if (type === 'potion') {
        const potions = normalizeRecord(target.potions);
        potions[key] = Math.min(999, (Number(potions[key]) || 0) + amount);
        updates.potions = JSON.stringify(potions);
      } else {
        const items = normalizeRecord(target.items);
        items[key] = Math.min(999, (Number(items[key]) || 0) + amount);
        updates.items = JSON.stringify(items);
        updates.titles = JSON.stringify(getUnlockedTitles({ ...target, items }));
      }
      await updateUser(target.username, updates);
    }

    const itemNames = { fragments: 'Portal Fragment', clovers: 'Clover Leaf', essence: 'Sea Essence', molten_rock: 'Molten Rock', ancient_ore: 'Ancient Ore', event_controller: 'Event Controller', old_potato_sticker: 'Old Potato Sticker', empty_vial: 'Empty Vial', treasure_chest: 'Treasure Chest' };
    const name = type === 'rarity' ? rarity.name : type === 'potion' ? POTION_CATALOG[key].name : itemNames[key];
    const announcement = `Admin ${admin.username} granted ${amount} × ${name} to every player.`;
    const chatRecord = await saveChatMessage('System', announcement, 'GLOBAL DROP', '#fbbf24', true, true);
    io.emit('global-chat-message', chatRecord);
    io.emit('global-drop', { type, key, amount, name });
    return res.json({ success: true, count: targets.length, name, amount });
  } catch (error) {
    console.error('Global drop error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Unable to grant the global drop.' });
  }
});

app.get('/api/mini-admin/overview', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const viewer = await findUser(req.session.username);
    if (!viewer || (!viewer.is_admin && !getUnlockedTitles(viewer).includes('admin'))) {
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
        inventoryTotal: safe.inventoryTotal
      };
    });
    res.json({ success: true, users: roster, onlineCount: online.size, activeEvent: getActiveGameEvent() });
  } catch (error) {
    console.error('Mini admin overview error:', error.message || error);
    res.status(503).json({ success: false, error: 'Unable to load player activity.' });
  }
});

app.post('/api/mini-admin/event', async (req, res) => {
  if (!req.session?.username) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const user = await findUser(req.session.username);
    if (!user || (!user.is_admin && !getUnlockedTitles(user).includes('admin'))) {
      return res.status(403).json({ success: false, error: 'The Admin title is required.' });
    }
    const eventName = String(req.body?.eventName || '');
    const action = req.body?.action === 'stop' ? 'stop' : 'start';
    if (!['starlight-surge', 'abyssal-resonance'].includes(eventName)) {
      return res.status(400).json({ success: false, error: 'This event is not available in Mini Operations.' });
    }
    if (gameShutdown) return res.status(503).json({ success: false, error: 'Events are unavailable during shutdown.' });
    if (action === 'stop') {
      if (activeGameEvent?.eventName !== eventName || activeGameEvent.initiatedBy !== user.username) {
        return res.status(403).json({ success: false, error: 'You can only end your own active event.' });
      }
      stopGameEvent(eventName);
      return res.json({ success: true, stopped: true });
    }
    const event = startGameEvent(eventName, user.username);
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
    if (!user || (!user.is_admin && !getUnlockedTitles(user).includes('admin'))) {
      return res.status(403).json({ success: false, error: 'The Admin title is required.' });
    }
    const title = String(req.body?.title || '').trim().slice(0, 80);
    const content = String(req.body?.content || '').trim().slice(0, 500);
    if (!title || !content) return res.status(400).json({ success: false, error: 'Enter an announcement title and message.' });
    const record = await saveChatMessage(user.username, `${title}: ${content}`, 'Mini Operations', '#fb7185', false, false, true);
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

  res.json({ success: true, announcement });
});

app.get('/api/admin/shutdown', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
  res.json({ success: true, active: gameShutdown });
});

app.get('/api/admin/headline', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
  res.json({ success: true, headline: adminHeadline });
});

app.post('/api/admin/headline', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Headline visibility must be enabled or disabled.' });
  }
  const text = String(req.body?.text || '').trim().slice(0, 220);
  if (req.body.active && !text) {
    return res.status(400).json({ success: false, error: 'Enter headline text before enabling it.' });
  }
  const previousHeadline = adminHeadline;
  adminHeadline = { active: req.body.active, text };
  try {
    await persistAdminHeadline();
  } catch (error) {
    adminHeadline = previousHeadline;
    console.error('Headline persistence error:', error.message || error);
    return res.status(503).json({ success: false, error: 'Headline could not be saved. Please try again.' });
  }
  io.emit('admin-headline', adminHeadline);
  res.json({ success: true, headline: adminHeadline });
});

app.post('/api/admin/shutdown', async (req, res) => {
  const user = req.session?.username ? await findUser(req.session.username) : null;
  if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access required.' });
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Shutdown state must be true or false.' });
  }
  gameShutdown = req.body.active;
  io.emit('shutdown-state', { active: gameShutdown, message: 'Update or Fix in progress please wait' });
  res.json({ success: true, active: gameShutdown });
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

app.post('/api/chat', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Login required to chat.' });
  }
  const text = String(req.body?.message || '').trim().slice(0, 500);
  if (!text) {
    return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
  }
  try {
    const user = await findUser(req.session.username);
    const badge = getChatBadge(user);
    const record = await saveChatMessage(req.session.username, text, badge.title, badge.titleColor, false);
    io.emit('chat-message', record);
    res.json({ success: true, message: record });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ success: false, error: 'Unable to send chat message.' });
  }
});

// Socket.IO middleware
io.use((socket, next) => {
  const response = {
    getHeader: () => undefined,
    setHeader: () => {},
    removeHeader: () => {}
  };
  sessionMiddleware(socket.request, response, next);
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
  socket.data.isBanned = false;
  if (socketUsername) socket.join(`user:${normalizeUsername(socketUsername)}`);
  connectedUsers += 1;
  io.emit('online-count', connectedUsers);

  if (gameShutdown && !socket.data.isAdmin) {
    socket.emit('shutdown-state', { active: true, message: 'Update or Fix in progress please wait' });
  }
  socket.emit('admin-headline', adminHeadline);

  socket.emit('chat-history', await getRecentChatMessages(60, false));
  socket.emit('global-chat-history', await getRecentChatMessages(100, true));
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

  socket.on('disconnect', () => {
    console.log(`🔌 RNG 3 Player disconnected: ${socket.id}`);
    connectedUsers = Math.max(0, connectedUsers - 1);
    io.emit('online-count', connectedUsers);
  });

  socket.on('join-game', () => {
    socket.emit('game-joined', {
      message: 'Welcome to RNG 3!',
      version: '3.0.0',
      features: ['New Mechanics', 'Enhanced UI', 'Community Features']
    });
  });

  socket.on('player-activity', activity => {
    if (!socket.request?.session?.username || socket.data.isBanned) return;
    const safeActivity = String(activity || '').trim().slice(0, 64);
    if (['At the RNG console', 'Diving in the Sea Realm', 'At the Forge', 'Browsing inventory', 'Using the shop', 'Browsing titles', 'In chat', 'Viewing settings'].includes(safeActivity)) {
      socket.data.activity = safeActivity;
    }
  });

  socket.on('chat-message', async (data) => {
    if (gameShutdown || socket.data.isBanned) return;
    const text = String(data?.message || '').trim().slice(0, 500);
    if (!text) return;
    const username = socket.request?.session?.username || 'Guest';
    const user = username !== 'Guest' ? await findUser(username) : null;
    const badge = getChatBadge(user);
    const record = await saveChatMessage(username, text, badge.title, badge.titleColor, false);
    io.emit('chat-message', record);
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
