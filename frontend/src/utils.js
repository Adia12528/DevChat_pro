// Format date for chat date separators (Today / Yesterday / full date)
export const formatDateSeparator = (timestamp) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

// Check if two messages should have a date separator between them
export const needsDateSeparator = (timestamp, prevTimestamp) => {
  if (!prevTimestamp) return true;
  return new Date(timestamp).toDateString() !== new Date(prevTimestamp).toDateString();
};

// Check if a message should be visually grouped with previous (same sender, within 2 mins)
export const isGroupedMessage = (msg, prevMsg) => {
  if (!prevMsg) return false;
  if (msg.sender !== prevMsg.sender) return false;
  if (msg.type !== prevMsg.type && (msg.type || prevMsg.type)) return false;
  const diff = new Date(msg.time) - new Date(prevMsg.time);
  return diff < 2 * 60 * 1000; // within 2 minutes
};

// Format file size nicely
export const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Relative time formatter (e.g., "5 mins ago")
export const formatRelativeTime = (timestamp) => {
  const now = new Date();
  const msgTime = new Date(timestamp);
  const diff = now - msgTime;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return msgTime.toLocaleDateString();
};

// Generate consistent color for user based on username
export const getUserColor = (username) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#76D7C4'
  ];
  
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Generate avatar initials
export const getInitials = (username) => {
  return username
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Create avatar component styles
export const getAvatarStyle = (username) => ({
  background: getUserColor(username),
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  flexShrink: 0
});

// Play notification sound (reuse AudioContext to avoid browser limits)
export const playNotificationSound = (audioContext) => {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.frequency.value = 800;
  oscillator.type = "sine";

  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};

// Copy text to clipboard
export const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    console.log("✅ Copied to clipboard");
  }).catch(err => {
    console.error("❌ Failed to copy:", err);
  });
};

// Detect URLs in text
export const detectLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// Extract mentions from text
export const extractMentions = (text) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
};
