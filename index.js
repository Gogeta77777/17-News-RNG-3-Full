/*
  17 News RNG 3 - The Next Generation
  - Modern multiplayer RNG game
  - Enhanced security and performance
  - New features and mechanics
  - Community-driven development
*/

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const fs = require('fs');
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
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
const USE_POSTGRES = Boolean(DATABASE_URL);

if (USE_POSTGRES) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: (process.env.NODE_ENV === 'production' || DATABASE_URL.includes('sslmode=require') || process.env.PGSSLMODE === 'require')
        ? { rejectUnauthorized: false }
        : false
    });
    console.log('✅ PostgreSQL/Neon initialized for RNG 3');
  } catch (error) {
    console.error('⚠️ PostgreSQL initialization failed, falling back to local storage:', error.message || error);
    pool = null;
  }
}

const inMemoryStore = {
  users: {},
  chatMessages: []
};

const STORAGE_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(STORAGE_DIR, 'users.json');
const CHAT_FILE = path.join(STORAGE_DIR, 'chat.json');
const JSON_ENCODING = 'utf8';

function ensureStorageFiles() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2), JSON_ENCODING);
    }
    if (!fs.existsSync(CHAT_FILE)) {
      fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2), JSON_ENCODING);
    }
  } catch (error) {
    console.error('Storage initialization failed:', error);
  }
}

function loadStorageFiles() {
  try {
    const usersRaw = fs.readFileSync(USERS_FILE, JSON_ENCODING);
    inMemoryStore.users = JSON.parse(usersRaw) || {};
  } catch (error) {
    inMemoryStore.users = {};
  }

  try {
    const chatRaw = fs.readFileSync(CHAT_FILE, JSON_ENCODING);
    inMemoryStore.chatMessages = JSON.parse(chatRaw) || [];
  } catch (error) {
    inMemoryStore.chatMessages = [];
  }
}

ensureStorageFiles();
loadStorageFiles();

function persistUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(inMemoryStore.users, null, 2), JSON_ENCODING);
  } catch (error) {
    console.error('Unable to persist users:', error);
  }
}

function persistChatMessages() {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(inMemoryStore.chatMessages, null, 2), JSON_ENCODING);
  } catch (error) {
    console.error('Unable to persist chat messages:', error);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function executeQuery(text, params = []) {
  if (!pool) throw new Error('Database unavailable');
  return pool.query(text, params);
}

async function findUser(username) {
  if (!username) return null;
  const normalized = username.trim();
  if (pool) {
    const result = await executeQuery('SELECT * FROM users WHERE username = $1', [normalized]);
    if (!result.rows.length) return null;
    const user = result.rows[0];
    const inventory = typeof user.inventory === 'string' ? JSON.parse(user.inventory) : (user.inventory || { rarities: {} });
    return {
      username: user.username,
      password: user.password,
      coins: user.coins,
      spins: user.spins,
      inventory,
      achievements: typeof user.achievements === 'string' ? JSON.parse(user.achievements) : (user.achievements || []),
      created_at: user.created_at,
      last_login: user.last_login,
      is_admin: user.is_admin
    };
  }
  const stored = inMemoryStore.users[normalized] || null;
  if (!stored) return null;
  return {
    ...stored,
    inventory: typeof stored.inventory === 'string' ? JSON.parse(stored.inventory) : (stored.inventory || { rarities: {} }),
    achievements: typeof stored.achievements === 'string' ? JSON.parse(stored.achievements) : (stored.achievements || [])
  };
}

async function saveUser(user) {
  const normalized = user.username.trim();
  if (pool) {
    await executeQuery(
      `INSERT INTO users (username, password, coins, spins, inventory, achievements, is_admin, created_at, last_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        normalized,
        user.password,
        user.coins,
        user.spins,
        JSON.stringify(user.inventory),
        JSON.stringify(user.achievements),
        user.is_admin,
        user.created_at || new Date().toISOString(),
        user.last_login || new Date().toISOString()
      ]
    );
    return;
  }
  inMemoryStore.users[normalized] = user;
  persistUsers();
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
  persistUsers();
}

async function ensureDatabase() {
  if (!pool) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0,
      spins INTEGER NOT NULL DEFAULT 0,
      inventory JSONB NOT NULL DEFAULT '{}'::jsonb,
      achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

let connectedUsers = 0;

async function getRecentChatMessages(limit = 60) {
  if (pool) {
    const result = await executeQuery(
      'SELECT username, message, created_at FROM chat_messages ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.reverse().map(row => ({
      username: row.username,
      message: row.message,
      timestamp: row.created_at,
      system: false
    }));
  }
  return inMemoryStore.chatMessages.slice(-limit);
}

async function saveChatMessage(username, message) {
  const record = {
    username: username || 'Guest',
    message,
    timestamp: new Date().toISOString(),
    system: false
  };

  if (pool) {
    await executeQuery(
      'INSERT INTO chat_messages (username, message) VALUES ($1, $2)',
      [record.username, record.message]
    );
  } else {
    inMemoryStore.chatMessages.push(record);
    if (inMemoryStore.chatMessages.length > 200) {
      inMemoryStore.chatMessages.shift();
    }
    persistChatMessages();
  }

  return record;
}

async function clearChatHistory() {
  if (pool) {
    await executeQuery('TRUNCATE chat_messages');
  }
  inMemoryStore.chatMessages = [];
  persistChatMessages();
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
      scriptSrc: ["'self'", "'unsafe-inline'"],
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
  validate: { trustProxy: true }
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

// Serve static files
app.use(express.static(path.join(__dirname)));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Apply rate limiting
app.use(['/api/login', '/api/register'], authLimiter);
app.use('/api', apiLimiter);

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

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

function sanitizeUser(user) {
  return {
    username: user.username,
    coins: user.coins,
    spins: user.spins,
    inventory: user.inventory || { rarities: {} },
    achievements: user.achievements || [],
    accountAge: user.created_at ? new Date(user.created_at).toLocaleDateString() : '-',
    inventoryValue: calculateInventoryValue(user.inventory || { rarities: {} }),
    inventoryTotal: Object.values((user.inventory || {}).rarities || {}).reduce((sum, count) => sum + count, 0),
    is_admin: user.is_admin || false
  };
}

function calculateInventoryValue(inventory) {
  const parsed = typeof inventory === 'string' ? JSON.parse(inventory) : inventory || {};
  const rarities = (parsed || {}).rarities || {};
  const valueMap = {
    '17-news': 150,
    '17-news-reborn': 300,
    'delan-fernando': 1450
  };
  return Object.entries(rarities).reduce((sum, [key, count]) => sum + (valueMap[key] || 0) * count, 0);
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.trim().length < 3 || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 chars and password at least 6 chars.' });
  }

  const normalized = username.trim();
  const existing = await findUser(normalized);
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
    is_admin: normalized.toLowerCase() === 'mr_fernanski',
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString()
  };

  try {
    await saveUser(user);
    req.session.username = normalized;
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
  const user = await findUser(normalized);
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  await updateUser(normalized, { last_login: new Date().toISOString() });
  req.session.username = normalized;
  res.json({ success: true, user: sanitizeUser({ ...user, last_login: new Date().toISOString() }) });
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
  const user = await findUser(req.session.username);
  if (!user) {
    return res.json({ success: false, user: null });
  }
  res.json({ success: true, user: sanitizeUser(user) });
});

app.get('/api/inventory', async (req, res) => {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const user = await findUser(req.session.username);
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

  const user = await findUser(req.session.username);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const roll = Math.random() * 100;
  let cursor = 0;
  let result = null;
  const options = [
    { key: '17-news', name: '17 News', chance: 68, reward: 150 },
    { key: '17-news-reborn', name: '17 News Reborn', chance: 25, reward: 300 },
    { key: 'delan-fernando', name: 'Delan Fernando', chance: 7, reward: 1450 }
  ];

  for (const rarity of options) {
    cursor += rarity.chance;
    if (roll <= cursor) {
      result = rarity;
      break;
    }
  }

  if (!result) {
    result = options[0];
  }

  const inventory = user.inventory || { rarities: {} };
  inventory.rarities = inventory.rarities || {};
  inventory.rarities[result.key] = (inventory.rarities[result.key] || 0) + 1;

  const newSpins = (user.spins || 0) + 1;
  const newCoins = (user.coins || 0) + result.reward;

  try {
    await updateUser(req.session.username, {
      inventory: JSON.stringify(inventory),
      spins: newSpins,
      coins: newCoins
    });

    const updatedUser = await findUser(req.session.username);
    res.json({
      success: true,
      result,
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    console.error('Spin error:', error);
    res.status(500).json({ success: false, error: 'Unable to complete roll.' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found.' });
});

// Socket.IO middleware
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});


// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`🔌 RNG 3 Player connected: ${socket.id}`);
  connectedUsers += 1;
  io.emit('online-count', connectedUsers);

  const history = await getRecentChatMessages(60);
  socket.emit('chat-history', history);
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
    const text = String(data?.message || '').trim().slice(0, 500);
    if (!text) return;
    const username = socket.request?.session?.username || 'Guest';
    const record = await saveChatMessage(username, text);
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

  socket.on('admin-event', async (data) => {
    if (!(await isAdminSocket(socket))) {
      socket.emit('system-message', {
        username: 'System',
        message: 'Admin privileges required to trigger events.',
        timestamp: new Date().toISOString(),
        system: true
      });
      return;
    }
    const eventName = String(data?.eventName || '').trim();
    if (!eventName) return;
    io.emit('theme-event', {
      eventName,
      initiatedBy: socket.request?.session?.username || 'Admin',
      timestamp: new Date().toISOString()
    });
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
