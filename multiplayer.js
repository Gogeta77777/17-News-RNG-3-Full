let socket;
let socketReady = false;

async function loadChatFallback() {
  if (typeof handleAPI !== 'function') return;
  const response = await handleAPI('/api/chat');
  if (!response.success) return;
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';
  response.messages.forEach((message) => {
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#ffd700');
  });
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
  });

  socket.on('chat-history', (messages = []) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach((message) => {
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#ffd700');
    });
  });

  socket.on('chat-message', (message) => {
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system, message.title || null, message.titleColor || '#ffd700');
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
    // Ensure applyThemeEvent is available (defined in game-logic.js)
    if (typeof applyThemeEvent === 'function') {
      applyThemeEvent(data.eventName, data.initiatedBy || 'Admin');
    } else {
      showPopup(`Event: ${data.eventName} by ${data.initiatedBy || 'Admin'}`, '#FFD700');
    }
  });

  socket.on('announcement_popup', (data) => {
    if (data && data.title && data.content) {
      showPopup(`${data.title}: ${data.content}`, '#FFD700');
    }
  });

  socket.on('disconnect', () => {
    const onlineCount = document.getElementById('online-count');
    if (onlineCount) {
      onlineCount.textContent = `0 users online`;
    }
  });
}

function sendChatToServer(message) {
  const text = String(message || '').trim();
  if (!text) return;
  if (!socket || !socket.connected) {
    if (typeof handleAPI === 'function') {
      handleAPI('/api/chat', { method: 'POST', body: { message: text } }).then((response) => {
        if (!response.success) {
          addChatMessage('System', response.error || 'Unable to send chat.', new Date().toISOString(), true);
        }
      });
      return;
    }
    addChatMessage('System', 'Unable to send chat: disconnected from server.', new Date().toISOString(), true);
    return;
  }
  socket.emit('chat-message', { message: text });
}

function refreshMultiplayerSession() {
  if (!socket) return;
  if (socket.connected) socket.disconnect();
  socket.connect();
  loadChatFallback();
}

function triggerAdminEvent(eventName) {
  if (!socket || !socket.connected) {
    showPopup('Unable to trigger admin event while disconnected.', 'error');
    return;
  }
  socket.emit('admin-event', { eventName });
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
window.triggerAdminEvent = triggerAdminEvent;
window.requestClearChat = requestClearChat;

document.addEventListener('DOMContentLoaded', () => {
  initMultiplayer();
  loadChatFallback();
});
