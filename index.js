/*
  17 News RNG 3 - The Next Generation
  - Modern multiplayer RNG game
  - Enhanced security and performance
  - New features and mechanics
  - Community-driven development
*/

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
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

const TITLE_CATALOG = {
  owner: { name: 'Owner', color: '#fbbf24' },
  veteran: { name: 'Veteran', color: '#38bdf8' },
  millionaire: { name: 'Millionaire', color: '#4ade80' },
  portalmancer: { name: 'Portalmancer', color: '#a78bfa' },
  'signal-cartographer': { name: 'Signal Cartographer', color: '#22d3ee' },
  'endless-frequency': { name: 'The Endless Frequency', color: '#60a5fa' },
  collector: { name: 'Rarity Collector', color: '#34d399' },
  'global-headliner': { name: 'Global Headliner', color: '#fb7185' },
  tidekeeper: { name: 'Tidekeeper', color: '#2dd4bf' }
};

function isAdministratorUser(user) {
  const username = String(user?.username || '').trim().toLowerCase();
  return Boolean(user?.is_admin || username === 'mr_fernanski' || username === 'testadmin');
}

function getUnlockedTitles(user) {
  const titles = new Set(normalizeList(user?.titles));
  const rarities = normalizeInventory(user?.inventory).rarities;
  const rarityTotal = Object.values(rarities).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const hasGlobalDrop = ['mr-fermanski', 'ellerslie-schoolcast', 'the-ceo'].some(key => Number(rarities[key]) > 0);
  const spins = Number(user?.spins) || 0;

  if (isAdministratorUser(user)) titles.add('owner');
  if ((Number(user?.coins) || 0) >= 1000000) titles.add('millionaire');
  if (user?.portal_unlocked) titles.add('portalmancer');
  if (spins >= 250) titles.add('signal-cartographer');
  if (spins >= 5000) titles.add('endless-frequency');
  if (rarityTotal >= 10) titles.add('collector');
  if (hasGlobalDrop) titles.add('global-headliner');
  if (user?.sea_realm_unlocked) titles.add('tidekeeper');

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
  existing[effectType] = data;
  activeEffectsStore[key] = existing;
  return existing[effectType];
}

function getActiveEffectMultiplier(username, effectType) {
  const effect = getUserActiveEffects(username)[effectType];
  return effect && Date.now() < effect.endTime ? Math.max(1, Number(effect.multiplier) || 1) : 1;
}

function getLuckMultiplier(username, dimension = null) {
  return getActiveEffectMultiplier(username, 'luck') * (dimension === 'deep-sea' ? 2 : 1);
}

function computeSpinMultiplier() {
  return 1;
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
    const potions = normalizeRecord(user.potions, { luck: 0, speed: 0 });
    const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0 });
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
      portal_unlocked: user.portal_unlocked || false,
      active_title: user.active_title || null,
      created_at: user.created_at,
      last_login: user.last_login,
      is_admin: isAdministratorUser(user),
      is_banned: user.is_banned || false,
      ban_reason: user.ban_reason || '',
      sea_realm_unlocked: user.sea_realm_unlocked || false
    };
  }
  const stored = inMemoryStore.users[normalized] || null;
  if (!stored) return null;
  return {
    ...stored,
    inventory: normalizeInventory(stored.inventory),
    achievements: normalizeList(stored.achievements),
    potions: normalizeRecord(stored.potions, { luck: 0, speed: 0 }),
    items: normalizeRecord(stored.items, { fragments: 0, clovers: 0, essence: 0 }),
    titles: getUnlockedTitles(stored),
    is_admin: isAdministratorUser(stored),
    is_banned: stored.is_banned || false,
    ban_reason: stored.ban_reason || '',
    portal_unlocked: stored.portal_unlocked || false,
    active_title: stored.active_title || null,
    sea_realm_unlocked: stored.sea_realm_unlocked || false
  };
}

async function saveUser(user) {
  const normalized = user.username.trim();
  if (pool) {
    const result = await executeQuery(
      `INSERT INTO users (username, password, coins, spins, inventory, achievements, potions, items, titles, active_title, portal_unlocked, sea_realm_unlocked, is_admin, created_at, last_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (username) DO NOTHING
       RETURNING username`,
      [
        normalized,
        user.password,
        user.coins,
        user.spins,
        JSON.stringify(user.inventory),
        JSON.stringify(user.achievements),
        JSON.stringify(user.potions || { luck: 0, speed: 0 }),
        JSON.stringify(user.items || { fragments: 0, clovers: 0, essence: 0 }),
        JSON.stringify(user.titles || []),
        user.active_title || null,
        user.portal_unlocked || false,
        user.sea_realm_unlocked || false,
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
      potions JSONB NOT NULL DEFAULT '{"luck":0,"speed":0}'::jsonb,
      items JSONB NOT NULL DEFAULT '{"fragments":0,"clovers":0,"essence":0}'::jsonb,
      titles JSONB NOT NULL DEFAULT '[]'::jsonb,
      active_title TEXT,
      portal_unlocked BOOLEAN NOT NULL DEFAULT false,
      sea_realm_unlocked BOOLEAN NOT NULL DEFAULT false,
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
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS spins INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '{"rarities":{}}'::jsonb,
      ADD COLUMN IF NOT EXISTS achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS potions JSONB NOT NULL DEFAULT '{"luck":0,"speed":0}'::jsonb,
      ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '{"fragments":0,"clovers":0,"essence":0}'::jsonb,
      ADD COLUMN IF NOT EXISTS titles JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS active_title TEXT,
      ADD COLUMN IF NOT EXISTS portal_unlocked BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sea_realm_unlocked BOOLEAN NOT NULL DEFAULT false,
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
    durationSeconds: 120,
    coinMultiplier: 2,
    bonusCoins: 0
  },
  'meteor-shower': {
    title: 'Meteor Shower',
    durationSeconds: 90,
    coinMultiplier: 1,
    bonusCoins: 250
  }
};

let activeGameEvent = null;
let activeGameEventTimeout = null;
let adminHeadline = { active: false, text: '' };

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
  if (activeGameEvent && Date.now() >= activeGameEvent.expiresAt) {
    endActiveGameEvent();
  }
  return activeGameEvent;
}

function startGameEvent(eventName, initiatedBy) {
  const config = GAME_EVENTS[eventName];
  if (!config) return null;
  endActiveGameEvent();
  activeGameEvent = {
    eventName,
    title: config.title,
    initiatedBy,
    durationSeconds: config.durationSeconds,
    coinMultiplier: config.coinMultiplier,
    bonusCoins: config.bonusCoins,
    startedAt: new Date().toISOString(),
    expiresAt: Date.now() + config.durationSeconds * 1000
  };
  io.emit('theme-event', { ...activeGameEvent, active: true });
  activeGameEventTimeout = setTimeout(endActiveGameEvent, config.durationSeconds * 1000);
  activeGameEventTimeout.unref?.();
  return activeGameEvent;
}

function stopGameEvent(eventName) {
  if (!activeGameEvent || activeGameEvent.eventName !== eventName) return false;
  endActiveGameEvent();
  return true;
}

let connectedUsers = 0;

async function getRecentChatMessages(limit = 60) {
  if (pool) {
    const result = await executeQuery(
      'SELECT username, message, created_at, title, title_color, system, is_global, is_announcement FROM chat_messages ORDER BY created_at DESC LIMIT $1',
      [limit]
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
  return inMemoryStore.chatMessages.slice(-limit);
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
  const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0 });
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
    'the-ceo': 7000
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
    potions: { luck: 0, speed: 0 },
    items: { fragments: 0, clovers: 0, essence: 0 },
    titles: normalized.toLowerCase() === 'mr_fernanski' || normalized === 'testadmin' ? ['owner'] : [],
    portal_unlocked: false,
    sea_realm_unlocked: false,
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

  const dimension = String(req.body?.dimension || '').toLowerCase();
  const luckMultiplier = getLuckMultiplier(req.session.username, dimension);
  let cursor = 0;
  let result = null;
  const options = [
    { key: '17-news', name: '17 News', chance: 66.2, reward: 150, color: '#0f172a' },
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
    { key: 'the-ceo', name: 'The CEO', chance: 0.05, reward: 7000, isGlobal: true, color: '#000000', glowColor: '#f8fafc' }
  ];

  const totalWeight = options.reduce((total, rarity) => total + rarity.chance * (rarity.chance < 20 ? luckMultiplier : 1), 0);
  const roll = Math.random() * totalWeight;
  for (const rarity of options) {
    cursor += rarity.chance * (rarity.chance < 20 ? luckMultiplier : 1);
    if (roll <= cursor) {
      result = rarity;
      break;
    }
  }

  if (!result) {
    result = options[0];
  }

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

    const responsePayload = {
      success: true,
      result: {
        ...result,
        multiplier,
        luckMultiplier,
        reward: finalReward,
        eventBonus,
        eventName: event?.title || null
      },
      user: sanitizeUser(updatedUser)
    };

    if (result.isGlobal) {
      try {
        const globalMessage = `${user.username} rolled ${result.name}!`;
        const chatRecord = await saveChatMessage(user.username, globalMessage, result.name, result.glowColor || result.color, false, true);
        io.emit('chat-message', chatRecord);
      } catch (error) {
        console.error('Unable to announce global drop:', error);
      }
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Spin persistence error:', error.message || error);
    res.status(503).json({ success: false, error: 'Your roll could not be saved. Please try again.' });
  }
});

// Code Redemption
app.post('/api/redeem-code', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { code } = req.body || {};
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: 'Code required.' });
  }

  const codeRewards = {
    'THETHREEQUEL': { title: 'veteran' }
  };

  const reward = codeRewards[code.toUpperCase()];
  if (!reward) {
    return res.status(400).json({ success: false, error: 'Invalid code.' });
  }

  try {
    const user = await findUser(req.session.username);
    const titles = typeof user.titles === 'string' ? JSON.parse(user.titles) : (user.titles || []);
    
    if (titles.includes(reward.title)) {
      return res.json({ success: false, error: 'Already redeemed.' });
    }

    titles.push(reward.title);
    await updateUser(req.session.username, { titles: JSON.stringify(titles) });
    
    const updated = await findUser(req.session.username);
    res.json({ success: true, title: reward.title, user: sanitizeUser(updated) });
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
  const potionCosts = { luck: 5000, speed: 3500 };

  if (!potionCosts[potionType]) {
    return res.status(400).json({ success: false, error: 'Invalid potion.' });
  }

  try {
    const user = await findUser(req.session.username);
    if (user.coins < potionCosts[potionType]) {
      return res.json({ success: false, error: 'Not enough coins.' });
    }

    const potions = typeof user.potions === 'string' ? JSON.parse(user.potions) : (user.potions || {});
    potions[potionType] = (potions[potionType] || 0) + 1;

    await updateUser(req.session.username, {
      coins: user.coins - potionCosts[potionType],
      potions: JSON.stringify(potions)
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Buy potion error:', error);
    res.status(500).json({ success: false, error: 'Purchase failed.' });
  }
});

// Buy Shop Item
app.post('/api/buy-shop-item', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const { itemName } = req.body || {};
  const itemCosts = {
    'Portal Fragment': 15000,
    'Clover Leaf': 500,
    'Sea Essence': 300000
  };

  const cost = itemCosts[itemName];
  if (!cost) {
    return res.status(400).json({ success: false, error: 'Invalid item.' });
  }

  try {
    const user = await findUser(req.session.username);
    if (user.coins < cost) {
      return res.json({ success: false, error: 'Not enough coins.' });
    }

    const items = typeof user.items === 'string' ? JSON.parse(user.items) : (user.items || {});
    
    if (itemName === 'Portal Fragment') items.fragments = (items.fragments || 0) + 1;
    else if (itemName === 'Clover Leaf') items.clovers = (items.clovers || 0) + 1;
    else if (itemName === 'Sea Essence') items.essence = (items.essence || 0) + 1;

    await updateUser(req.session.username, {
      coins: user.coins - cost,
      items: JSON.stringify(items)
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated) });
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
  if (!['luck', 'speed'].includes(potionType)) {
    return res.status(400).json({ success: false, error: 'Invalid potion.' });
  }

  try {
    const user = await findUser(req.session.username);
    const potions = typeof user.potions === 'string' ? JSON.parse(user.potions) : (user.potions || { luck: 0, speed: 0 });
    if ((potions[potionType] || 0) <= 0) {
      return res.json({ success: false, error: 'No potion available.' });
    }

    potions[potionType] -= 1;
    const potionConfig = potionType === 'luck' ? { multiplier: 2, duration: 120 } : { multiplier: 2, duration: 90 };
    setUserActiveEffect(req.session.username, potionType, {
      multiplier: potionConfig.multiplier,
      endTime: Date.now() + potionConfig.duration * 1000
    });

    await updateUser(req.session.username, {
      potions: JSON.stringify(potions)
    });

    const updated = await findUser(req.session.username);
    res.json({ success: true, user: sanitizeUser(updated), effect: potionConfig });
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

    const items = normalizeRecord(user.items, { fragments: 0, clovers: 0, essence: 0 });
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

app.post('/api/enter-dimension', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const { dimension } = req.body || {};
  if (dimension !== 'deep-sea') {
    return res.status(400).json({ success: false, error: 'Invalid dimension.' });
  }

  try {
    const user = await findUser(req.session.username);
    if (!user.portal_unlocked || !user.sea_realm_unlocked) {
      return res.status(403).json({ success: false, error: 'Unlock the Sea Realm once with Sea Essence before entering.' });
    }
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Enter dimension error:', error);
    res.status(500).json({ success: false, error: 'Unable to enter dimension.' });
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

    const { type, amount, potion, item, banned, reason } = req.body || {};
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
      } else if (type === 'potion' && ['luck', 'speed'].includes(potion) && quantity >= 1 && quantity <= 99) {
        const potions = normalizeRecord(target.potions, { luck: 0, speed: 0 });
        potions[potion] = Math.min(999, (Number(potions[potion]) || 0) + quantity);
        updates = { potions: JSON.stringify(potions) };
      } else if (type === 'item' && ['fragments', 'clovers', 'essence'].includes(item) && quantity >= 1 && quantity <= 99) {
        const items = normalizeRecord(target.items, { fragments: 0, clovers: 0, essence: 0 });
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
  adminHeadline = { active: req.body.active, text };
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
    res.json({ success: true, messages: await getRecentChatMessages(60) });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ success: false, error: 'Unable to load chat.' });
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

  const history = await getRecentChatMessages(60);
  socket.emit('chat-history', history);
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
