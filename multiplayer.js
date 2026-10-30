let socket;
let socketReady = false;
let playerActivity = 'At the RNG console';
let activityHeartbeat = null;
let chatUnreadCounts = { players: 0, globals: 0 };
let chatTypingUsers = new Map();
let chatTypingTimers = new Map();
let localChatTypingState = false;
let localChatTypingHeartbeat = null;
let currentChatReply = null;

function getCurrentChatView() {
  const activeButton = document.querySelector('[data-chat-view].active');
  return activeButton?.dataset.chatView || 'players';
}

function isChatViewOpen(view) {
  const chatTab = document.getElementById('chat-tab');
  return Boolean(chatTab?.classList.contains('active') && !chatTab.classList.contains('hidden') && getCurrentChatView() === view);
}

function updateChatTabBadge(view, count) {
  const button = document.querySelector(`[data-chat-view="${view}"]`);
  if (!button) return;
  let badge = button.querySelector('.chat-tab-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'chat-tab-badge';
    button.appendChild(badge);
  }
  const numeric = Number(count) || 0;
  if (numeric > 0) {
    badge.textContent = numeric > 99 ? '99+' : String(numeric);
    badge.hidden = false;
  } else {
    badge.textContent = '';
    badge.hidden = true;
  }
}

function bumpChatUnread(view) {
  if (isChatViewOpen(view)) return;
  chatUnreadCounts[view] = (chatUnreadCounts[view] || 0) + 1;
  updateChatTabBadge(view, chatUnreadCounts[view]);
}

function resetChatUnread(view) {
  chatUnreadCounts[view] = 0;
  updateChatTabBadge(view, 0);
}

function updateTypingIndicator() {
  const indicator = document.getElementById('chat-typing-indicator');
  if (!indicator) return;
  const names = [...chatTypingUsers.keys()];
  if (!names.length) {
    indicator.classList.add('hidden');
    indicator.textContent = '';
    return;
  }
  const label = names.length === 1
    ? `${names[0]} is typing...`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more are typing...`;
  indicator.textContent = label;
  indicator.classList.remove('hidden');
}

function setLocalChatTyping(isTyping) {
  if (!socket?.connected) {
    isTyping = false;
  }
  if (socket?.connected && (isTyping || localChatTypingState !== isTyping)) {
    socket.emit('chat-typing', isTyping);
  }
  localChatTypingState = isTyping;
  clearInterval(localChatTypingHeartbeat);
  localChatTypingHeartbeat = null;
  if (isTyping) {
    localChatTypingHeartbeat = setInterval(() => {
      if (socket?.connected && localChatTypingState) socket.emit('chat-typing', true);
    }, 2000);
  }
}

function clearChatReplyTarget() {
  currentChatReply = null;
  const preview = document.getElementById('chat-reply-preview');
  preview?.classList.add('hidden');
  const author = document.getElementById('chat-reply-author');
  const quote = document.getElementById('chat-reply-quote');
  if (author) author.textContent = '';
  if (quote) quote.textContent = '';
}

function setChatReplyTarget(reply) {
  if (!reply?.username || !reply?.message) return;
  currentChatReply = {
    username: String(reply.username).slice(0, 32),
    message: String(reply.message).slice(0, 240)
  };
  const author = document.getElementById('chat-reply-author');
  const quote = document.getElementById('chat-reply-quote');
  const preview = document.getElementById('chat-reply-preview');
  if (author) author.textContent = `Replying to ${currentChatReply.username}`;
  if (quote) quote.textContent = currentChatReply.message;
  preview?.classList.remove('hidden');
  document.getElementById('chat-input')?.focus();
}

async function loadChatFallback() {
  if (typeof handleAPI !== 'function') return;
  const response = await handleAPI('/api/chat');
  if (!response.success) return;
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';
  response.messages.filter(message => !message.isGlobalDrop).forEach((message) => {
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', message.isGlobalDrop || false, false, message.isAnnouncement || false, message.replyTo || null);
  });
}

async function loadGlobalChatFallback() {
  if (typeof handleAPI !== 'function') return;
  const response = await handleAPI('/api/global-chat');
  if (!response.success) return;
  const container = document.getElementById('global-chat-messages');
  if (container) {
    container.innerHTML = '';
    response.messages.forEach(message => {
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, false, message.isAnnouncement || false);
    });
  }
  window.renderGlobalRarityCounts?.(response.rarities || []);
}

async function refreshGlobalRarityCounts() {
  if (typeof handleAPI !== 'function') return;
  const response = await handleAPI('/api/global-chat');
  if (response.success) window.renderGlobalRarityCounts?.(response.rarities || []);
}

function setChatView(view) {
  const showGlobals = view === 'globals';
  document.getElementById('player-chat-view')?.classList.toggle('hidden', showGlobals);
  document.getElementById('global-chat-view')?.classList.toggle('hidden', !showGlobals);
  document.querySelectorAll('[data-chat-view]').forEach(button => {
    const active = button.dataset.chatView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  resetChatUnread(view);
  if (showGlobals) loadGlobalChatFallback();
}

function initMultiplayer() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client library not loaded. Multiplayer chat will not be available.');
    return;
  }

  socket = io();
  socketReady = true;

  socket.on('connect', () => {
    console.log('✅ Connected to RNG 3 multiplayer server');
    socket.emit('join-game');
    socket.emit('player-activity', playerActivity);
  });

  socket.on('chat-history', (messages = []) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.filter(message => !message.isGlobalDrop).forEach((message) => {
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', message.isGlobalDrop || false, false, message.isAnnouncement || false, message.replyTo || null);
    });
  });

  socket.on('global-chat-history', (messages = []) => {
    const container = document.getElementById('global-chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(message => {
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, false, message.isAnnouncement || false);
    });
  });

  socket.on('chat-message', (message) => {
    if (message.isGlobalDrop) {
      if (!isChatViewOpen('globals')) bumpChatUnread('globals');
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, true, message.isAnnouncement || false);
      refreshGlobalRarityCounts();
      return;
    }
    if (!isChatViewOpen('players')) bumpChatUnread('players');
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', message.isGlobalDrop || false, message.isGlobalDrop || false, message.isAnnouncement || false, message.replyTo || null);
  });

  socket.on('global-chat-message', message => {
    if (!message) return;
    if (!isChatViewOpen('globals')) bumpChatUnread('globals');
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, true, message.isAnnouncement || false);
    refreshGlobalRarityCounts();
  });

  socket.on('system-message', (message) => {
    if (!message || !message.message) return;
    addChatMessage('System', message.message, message.timestamp, true);
  });

  socket.on('online-count', (count) => {
    const onlineCount = document.getElementById('online-count');
    if (onlineCount) {
      onlineCount.textContent = `${count} users online`;
    }
  });

  socket.on('theme-event', (data) => {
    if (!data || !data.eventName) return;
    if (typeof applyThemeEvent === 'function') {
      applyThemeEvent(data);
    } else {
      showPopup(`${data.title || data.eventName} ${data.active === false ? 'ended' : `activated by ${data.initiatedBy || 'Admin'}`}`, '#38bdf8');
    }
  });

  socket.on('global-drop', async (data) => {
    const response = await handleAPI('/api/session');
    if (response.success && response.user && typeof updateUI === 'function') updateUI(response.user);
    if (data?.name) showPopup(`Global drop: ${data.amount} × ${data.name} added to every account.`);
  });

  socket.on('admin-headline', (data) => {
    applyAdminHeadline(data || {});
  });

  socket.on('announcement_popup', (data) => {
    if (data && data.title && data.content) showAdminAnnouncementBanner(data);
  });

  socket.on('admin-announcement', (data) => {
    showAdminAnnouncementBanner(data);
  });

  socket.on('shutdown-state', (data) => {
    setShutdownScreen(Boolean(data?.active), data?.message);
  });

  socket.on('player-banned', (data) => {
    showBanScreen(data?.reason);
  });

  socket.on('chat-typing', ({ username, typing } = {}) => {
    if (!username) return;
    clearTimeout(chatTypingTimers.get(username));
    if (typing) {
      chatTypingUsers.set(username, Date.now());
      chatTypingTimers.set(username, setTimeout(() => {
        chatTypingUsers.delete(username);
        chatTypingTimers.delete(username);
        updateTypingIndicator();
      }, 4500));
    } else {
      chatTypingUsers.delete(username);
      chatTypingTimers.delete(username);
    }
    updateTypingIndicator();
  });

  socket.on('disconnect', () => {
    clearInterval(localChatTypingHeartbeat);
    localChatTypingHeartbeat = null;
    localChatTypingState = false;
    chatTypingTimers.forEach(timer => clearTimeout(timer));
    chatTypingTimers.clear();
    chatTypingUsers.clear();
    updateTypingIndicator();
    const onlineCount = document.getElementById('online-count');
    if (onlineCount) {
      onlineCount.textContent = `0 users online`;
    }
  });

  clearInterval(activityHeartbeat);
  activityHeartbeat = setInterval(() => {
    if (socket?.connected) socket.emit('player-activity', playerActivity);
  }, 15000);

  document.querySelectorAll('[data-chat-view]').forEach(button => {
    if (button.dataset.bound) return;
    button.addEventListener('click', () => setChatView(button.dataset.chatView));
    button.dataset.bound = 'true';
  });

  const chatInput = document.getElementById('chat-input');
  chatInput?.addEventListener('focus', () => setLocalChatTyping(true));
  chatInput?.addEventListener('input', () => {
    if (document.activeElement === chatInput) setLocalChatTyping(true);
  });
  chatInput?.addEventListener('blur', () => {
    setLocalChatTyping(false);
  });

  const sendButton = document.getElementById('send-chat');
  sendButton?.addEventListener('click', () => setLocalChatTyping(false));
  document.getElementById('cancel-chat-reply')?.addEventListener('click', clearChatReplyTarget);
  document.querySelector('[data-tab="chat"]')?.addEventListener('click', () => {
    setTimeout(() => resetChatUnread(getCurrentChatView()), 0);
  });
}

function updatePlayerActivity(activity) {
  playerActivity = String(activity || 'At the RNG console').slice(0, 64);
  if (socket?.connected) socket.emit('player-activity', playerActivity);
}

function sendChatToServer(message) {
  const text = String(message || '').trim();
  if (!text) return;
  if (socket && socket.connected) {
    setLocalChatTyping(false);
  }
  if (!socket || !socket.connected) {
    if (typeof handleAPI === 'function') {
      handleAPI('/api/chat', { method: 'POST', body: { message: text, replyTo: currentChatReply } }).then((response) => {
        if (!response.success) {
          addChatMessage('System', response.error || 'Unable to send chat.', new Date().toISOString(), true);
        } else {
          clearChatReplyTarget();
        }
      });
      return;
    }
    addChatMessage('System', 'Unable to send chat: disconnected from server.', new Date().toISOString(), true);
    return;
  }
  socket.emit('chat-message', { message: text, replyTo: currentChatReply });
  clearChatReplyTarget();
}

function refreshMultiplayerSession() {
  if (!socket) return;
  if (socket.connected) socket.disconnect();
  socket.connect();
  loadChatFallback();
}

function triggerAdminEvent(eventName, action = 'start') {
  if (!socket || !socket.connected) {
    showPopup('Unable to trigger admin event while disconnected.', 'error');
    return;
  }
  socket.emit('admin-event', { eventName, action }, (response) => {
    if (!response?.success) {
      showPopup(response?.error || 'Unable to start event.', 'error');
    }
  });
}

function requestClearChat() {
  if (!socket || !socket.connected) {
    showPopup('Unable to clear chat: disconnected from server.', 'error');
    return;
  }
  socket.emit('clear-chat');
}

window.initMultiplayer = initMultiplayer;
window.sendChatToServer = sendChatToServer;
window.refreshMultiplayerSession = refreshMultiplayerSession;
window.loadChatFallback = loadChatFallback;
window.loadGlobalChatFallback = loadGlobalChatFallback;
window.setChatReplyTarget = setChatReplyTarget;
window.triggerAdminEvent = triggerAdminEvent;
window.requestClearChat = requestClearChat;
window.updatePlayerActivity = updatePlayerActivity;

document.addEventListener('DOMContentLoaded', () => {
  initMultiplayer();
  loadChatFallback();
  loadGlobalChatFallback();
});
