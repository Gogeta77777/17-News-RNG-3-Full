let socket;

function initMultiplayer() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client library not loaded. Multiplayer chat will not be available.');
    return;
  }

  socket = io();

  socket.on('connect', () => {
    console.log('✅ Connected to RNG 3 multiplayer server');
    socket.emit('join-game');
  });

  socket.on('chat-history', (messages = []) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach((message) => {
      addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system);
    });
  });

  socket.on('chat-message', (message) => {
    addChatMessage(message.username || 'Guest', message.message, message.timestamp, message.system);
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
    applyThemeEvent(data.eventName, data.initiatedBy || 'Admin');
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
  if (!socket || !socket.connected) {
    addChatMessage('System', 'Unable to send chat: disconnected from server.', new Date().toISOString(), true);
    return;
  }
  socket.emit('chat-message', { message });
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
window.triggerAdminEvent = triggerAdminEvent;
window.requestClearChat = requestClearChat;

document.addEventListener('DOMContentLoaded', () => {
  initMultiplayer();
});
