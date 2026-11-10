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
let onlinePlayerRoster = [];

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

function showReplyNotification(message) {
  const currentUsername = window.getCurrentGameUsername?.();
  if (!currentUsername || !message?.replyTo?.username || message.replyTo.username.toLowerCase() !== currentUsername.toLowerCase()) return;
  document.querySelector('.reply-notification')?.remove();
  const notification = document.createElement('aside');
  notification.className = 'reply-notification';
  notification.setAttribute('role', 'status');
  notification.textContent = `${message.username || 'A player'} replied to your message.`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 6000);
}

function showChatModerationWarning(warning) {
  if (!warning?.username) return;
  document.querySelector('.chat-moderation-warning')?.remove();
  const notice = document.createElement('aside');
  notice.className = 'chat-moderation-warning';
  notice.setAttribute('role', 'alert');
  const icon = document.createElement('span');
  icon.className = 'chat-moderation-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '!';
  const copy = document.createElement('div');
  copy.className = 'chat-moderation-copy';
  const label = document.createElement('small');
  label.textContent = 'COMMUNITY MODERATION';
  const username = document.createElement('strong');
  username.textContent = warning.username;
  const message = document.createElement('span');
  message.textContent = warning.message || 'Do not do it again.';
  copy.append(label, username, message);
  const dismiss = document.createElement('button');
  dismiss.className = 'chat-moderation-dismiss';
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss moderation notice');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => notice.remove(), { once: true });
  notice.append(icon, copy, dismiss);
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 8000);
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
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', message.isGlobalDrop || false, false, message.isAnnouncement || false, message.replyTo || null, message.id, message.attachment || null);
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
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, false, message.isAnnouncement || false, null, message.id);
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
  const showAdmin = view === 'admin';
  document.getElementById('player-chat-view')?.classList.toggle('hidden', showGlobals || showAdmin);
  document.getElementById('global-chat-view')?.classList.toggle('hidden', !showGlobals);
  document.getElementById('admin-chat-view')?.classList.toggle('hidden', !showAdmin);
  document.querySelectorAll('[data-chat-view]').forEach(button => {
    const active = button.dataset.chatView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  resetChatUnread(view);
  if (showGlobals) loadGlobalChatFallback();
  if (showAdmin && socket?.connected) socket.emit('admin-chat-history-request');
}

function renderOnlinePlayers() {
  const list = document.getElementById('online-player-list');
  if (!list) return;
  list.replaceChildren();
  if (!onlinePlayerRoster.length) {
    list.textContent = 'No players are online right now.';
    return;
  }
  onlinePlayerRoster.forEach(player => {
    const row = document.createElement('div');
    row.className = 'player-list-row';
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = player.username;
    const status = document.createElement('span');
    status.textContent = player.status || 'At the RNG console';
    copy.append(name, status);
    const mention = document.createElement('button');
    mention.className = 'btn btn-small';
    mention.type = 'button';
    mention.textContent = '@';
    mention.setAttribute('aria-label', `Mention ${player.username}`);
    mention.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = `${input.value}${input.value && !input.value.endsWith(' ') ? ' ' : ''}@${player.username} `;
        input.focus();
      }
      document.getElementById('online-players-dialog')?.close();
    });
    row.append(copy, mention);
    list.appendChild(row);
  });
}

async function loadLeaderboard() {
  const dialog = document.getElementById('leaderboard-dialog');
  const list = document.getElementById('leaderboard-list');
  if (!dialog || !list) return;
  list.textContent = 'Loading players…';
  dialog.showModal();
  const response = await handleAPI('/api/players/leaderboard');
  if (!response.success) {
    list.textContent = response.error || 'Unable to load players.';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Player</th><th>Status</th><th>Coins</th><th>Rolls</th></tr></thead>';
  const body = document.createElement('tbody');
  response.players.forEach(player => {
    const row = document.createElement('tr');
    [player.username, player.status, Number(player.coins).toLocaleString(), Number(player.rolls).toLocaleString()].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.appendChild(body);
  list.replaceChildren(table);
}

function updateAdminChatVisibility() {
  const user = window.getCurrentGameUser?.();
  const allowed = Boolean(user?.is_admin || user?.titles?.includes('admin') || user?.titles?.includes('owner'));
  document.querySelector('[data-chat-view="admin"]')?.classList.toggle('hidden', !allowed);
  document.querySelectorAll('.chat-attach-btn').forEach(button => button.classList.toggle('hidden', !allowed));
  if (!allowed && getCurrentChatView() === 'admin') setChatView('players');
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
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', message.isGlobalDrop || false, false, message.isAnnouncement || false, message.replyTo || null, message.id, message.attachment || null);
    });
  });

  socket.on('global-chat-history', (messages = []) => {
    const container = document.getElementById('global-chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(message => {
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, false, message.isAnnouncement || false, null, message.id, message.attachment || null);
    });
  });

  socket.on('chat-message', (message) => {
    if (message.isGlobalDrop) {
      if (!isChatViewOpen('globals')) bumpChatUnread('globals');
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, true, message.isAnnouncement || false, null, message.id, message.attachment || null);
      refreshGlobalRarityCounts();
      return;
    }
    if (!isChatViewOpen('players')) bumpChatUnread('players');
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', message.isGlobalDrop || false, message.isGlobalDrop || false, message.isAnnouncement || false, message.replyTo || null, message.id, message.attachment || null);
  });

  socket.on('global-chat-message', message => {
    if (!message) return;
    if (!isChatViewOpen('globals')) bumpChatUnread('globals');
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#7dd3fc', true, true, message.isAnnouncement || false, null, message.id, message.attachment || null);
    refreshGlobalRarityCounts();
  });

  socket.on('inbox-message', message => {
    window.handleIncomingInboxMessage?.(message);
  });

  socket.on('inbox-message', message => {
    window.handleIncomingInboxMessage?.(message);
  });

  socket.on('system-message', (message) => {
    if (!message || !message.message) return;
    addChatMessage('System', message.message, message.timestamp, true);
  });

  socket.on('chat-moderation-warning', showChatModerationWarning);

  socket.on('online-count', (count) => {
    const onlineCount = document.getElementById('online-count');
    if (onlineCount) onlineCount.textContent = String(Number(count) || 0);
  });

  socket.on('online-roster', players => {
    onlinePlayerRoster = Array.isArray(players) ? players : [];
    renderOnlinePlayers();
  });

  socket.on('playtime-update', data => {
    window.updatePlaytimeDisplay?.(data?.seconds);
  });

  socket.on('admin-chat-history', messages => {
    const container = document.getElementById('admin-chat-messages');
    if (!container) return;
    container.replaceChildren();
    (Array.isArray(messages) ? messages : []).forEach(message => appendAdminChatMessage(message));
  });

  socket.on('admin-chat-message', message => appendAdminChatMessage(message));

  socket.on('mention-notification', message => {
    showPopup(message.isEveryone
      ? `${message.username} pinged everyone in chat.`
      : `${message.username} mentioned you in chat: ${message.message}`);
  });

  socket.on('chat-ping-cooldown', data => {
    showPopup(`Please wait ${Number(data?.remainingSeconds) || 30}s before pinging everyone again.`, 'error');
  });

  socket.on('reply-notification', message => {
    showPopup(`${message.username} replied to your message.`);
  });

  socket.on('blackhole-reward', reward => {
    window.updateGameUser?.(reward?.user);
    showPopup(`Blackhole reward: ${reward.amount} ${reward.item}`);
  });

  socket.on('game-updated', data => {
    window.setGameUpdatedScreen?.(true, data?.message);
  });

  socket.on('theme-event', (data) => {
    if (!data || !data.eventName) return;
    if (typeof applyThemeEvent === 'function') {
      applyThemeEvent(data);
    } else {
      showPopup(`${data.title || data.eventName} ${data.active === false ? 'ended' : `activated by ${data.initiatedBy || 'Admin'}`}`, '#38bdf8');
    }
  });

  socket.on('global-drop', data => {
    if (data?.name) showPopup(`Global drop: ${data.amount} × ${data.name} sent to every inbox. Claim it to receive it.`);
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

  socket.on('chat-message-deleted', ({ id } = {}) => {
    if (!id) return;
    document.querySelectorAll('.chat-message').forEach(message => {
      if (message.dataset.messageId === String(id)) message.remove();
    });
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
    if (onlineCount) onlineCount.textContent = '0';
    onlinePlayerRoster = [];
    renderOnlinePlayers();
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
  sendButton?.addEventListener('click', async () => {
    if (sendButton.disabled) return;
    sendButton.disabled = true;
    setLocalChatTyping(false);
    const input = document.getElementById('chat-input');
    const message = input?.value || '';
    try {
      const attachment = await readChatAttachment('chat-attachment');
      if (attachment === false) return;
      sendChatToServer(message, attachment);
      if (input) input.value = '';
      clearChatAttachment('chat-attachment');
    } finally {
      sendButton.disabled = false;
    }
  });
  document.querySelectorAll('[data-chat-attachment-trigger]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.chatAttachmentTrigger)?.click());
  });
  document.querySelectorAll('.chat-attachment-input').forEach(input => {
    input.addEventListener('change', () => {
      const label = document.querySelector(`[data-chat-attachment-name="${input.id}"]`);
      if (label) label.textContent = input.files?.[0]?.name || '';
    });
  });
  document.getElementById('cancel-chat-reply')?.addEventListener('click', clearChatReplyTarget);
  document.getElementById('view-online-btn')?.addEventListener('click', () => {
    renderOnlinePlayers();
    document.getElementById('online-players-dialog')?.showModal();
  });
  document.getElementById('leaderboard-btn')?.addEventListener('click', loadLeaderboard);
  document.getElementById('insert-mention-btn')?.addEventListener('click', () => {
    renderOnlinePlayers();
    document.getElementById('online-players-dialog')?.showModal();
  });
  document.getElementById('ping-everyone-btn')?.addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    if (!input) return;
    input.value = `${input.value}${input.value && !input.value.endsWith(' ') ? ' ' : ''}@everyone `;
    input.focus();
  });
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close());
  });
  document.getElementById('send-admin-chat')?.addEventListener('click', () => sendAdminChatMessage());
  document.getElementById('admin-chat-input')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendAdminChatMessage();
    }
  });
  updateAdminChatVisibility();
  document.querySelector('[data-tab="chat"]')?.addEventListener('click', () => {
    setTimeout(() => resetChatUnread(getCurrentChatView()), 0);
  });
}

function updatePlayerActivity(activity) {
  playerActivity = String(activity || 'At the RNG console').slice(0, 64);
  if (socket?.connected) socket.emit('player-activity', playerActivity);
}

function appendAdminChatMessage(message) {
  if (!message) return;
  addChatMessage(message.username || 'Guest', message.message || '', message.timestamp, false, message.title || null, message.titleColor || '#7dd3fc', false, false, false, null, message.id, message.attachment || null, 'admin-chat-messages');
}

function clearChatAttachment(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.value = '';
  const label = document.querySelector(`[data-chat-attachment-name="${inputId}"]`);
  if (label) label.textContent = '';
}

function readChatAttachment(inputId) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  if (!file) return Promise.resolve(null);
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']);
  if (!allowedTypes.has(file.type)) {
    showPopup('Choose an image, PDF, or text file.', 'error');
    return Promise.resolve(false);
  }
  if (file.size > 480 * 1024) {
    showPopup('Attachments must be smaller than 480 KB.', 'error');
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve({ name: file.name, type: file.type, data: String(reader.result || '') });
    });
    reader.addEventListener('error', () => {
      showPopup('Unable to read that attachment.', 'error');
      resolve(false);
    });
    reader.readAsDataURL(file);
  });
}

async function sendAdminChatMessage() {
  const input = document.getElementById('admin-chat-input');
  const sendButton = document.getElementById('send-admin-chat');
  if (sendButton?.disabled) return;
  if (sendButton) sendButton.disabled = true;
  const message = String(input?.value || '').trim();
  try {
    const attachment = await readChatAttachment('admin-chat-attachment');
    if (attachment === false) return;
    if (!message && !attachment) return;
    if (!socket?.connected) {
      showPopup('Admin chat is disconnected. Reconnect before sending.', 'error');
      return;
    }
    socket.emit('admin-chat-message', { message, attachment });
    if (input) input.value = '';
    clearChatAttachment('admin-chat-attachment');
  } finally {
    if (sendButton) sendButton.disabled = false;
  }
}

function sendChatToServer(message, attachment = null) {
  const text = String(message || '').trim();
  if (!text && !attachment) return;
  if (socket && socket.connected) {
    setLocalChatTyping(false);
  }
  if (!socket || !socket.connected) {
    if (typeof handleAPI === 'function') {
      handleAPI('/api/chat', { method: 'POST', body: { message: text, replyTo: currentChatReply, attachment } }).then((response) => {
        if (!response.success) {
          if (response.code !== 'CHAT_MODERATION') {
            addChatMessage('System', response.error || 'Unable to send chat.', new Date().toISOString(), true);
          }
        } else {
          const sentMessage = response.message;
          if (sentMessage) {
            addChatMessage(sentMessage.username || 'Guest', sentMessage.message, sentMessage.timestamp, sentMessage.system, sentMessage.title || null, sentMessage.titleColor || '#7dd3fc', false, false, sentMessage.isAnnouncement || false, sentMessage.replyTo || null, sentMessage.id, sentMessage.attachment || null);
          }
          clearChatReplyTarget();
        }
      });
      return;
    }
    addChatMessage('System', 'Unable to send chat: disconnected from server.', new Date().toISOString(), true);
    return;
  }
  socket.emit('chat-message', { message: text, replyTo: currentChatReply, attachment });
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
window.updateAdminChatVisibility = updateAdminChatVisibility;
window.triggerAdminEvent = triggerAdminEvent;
window.requestClearChat = requestClearChat;
window.updatePlayerActivity = updatePlayerActivity;

document.addEventListener('DOMContentLoaded', () => {
  initMultiplayer();
  loadChatFallback();
  loadGlobalChatFallback();
});
