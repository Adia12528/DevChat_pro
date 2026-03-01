// frontend/src/utils/settings.js
// Unified settings management for all user preferences

const SETTINGS_KEY = 'devchat_pro_settings';

// Default settings for all features
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  fontStyle: 'default',
  
  // Call Settings
  calls: {
    defaultCamera: 'system',
    defaultMicrophone: 'system',
    defaultSpeaker: 'system',
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    videoQuality: 'auto',
    frameRate: 30,
    bandwidthMode: 'auto',
    screenSharingQuality: '1080p',
    enableStats: false,
    autoRecordCalls: false,
    ringtoneStyle: 'soft',
    ringtoneVolume: 80,
    enableVideoEffects: false,
    backgroundBlur: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    highPassFilter: false,
    audioBitrate: 64,
    stereoAudio: false,
    opusCodec: 'opus',
    messageSentSound: true,
    messageReceivedSound: true,
    callConnectingSound: true,
    keyPressSounds: false,
    shareSystemAudio: false,
    optimizeScreenVideo: true,
  },
  
  // Streaming Settings
  streaming: {
    defaultQuality: 'auto',
    defaultSource: 'camera',
    defaultVisibility: 'room',
    autoPublish: true,
    saveStreams: false,
    autoShowChat: true,
    chatPosition: 'bottom',
    enableEmojiReactions: true,
    enableRaiseHand: true,
    enablePolling: true,
    autoModerate: false,
    profanityFilter: true,
    requireApproval: false,
    slowMode: false,
    slowModeDelay: 10,
    autoRecordStreams: false,
    recordVideo: true,
    recordChat: true,
    recordStorage: 'cloud',
    closedCaptions: false,
    signLanguage: false,
    audioDescriptions: false,
    maxBitrate: 2500,
    maxFramerate: 30,
    adaptiveBitrate: true,
  },
  
  // Device Settings
  devices: {
    preferredCamera: null,
    preferredMicrophone: null,
    preferredSpeaker: null,
    cameras: [],
    microphones: [],
    speakers: [],
  },
  
  // UI Settings
  ui: {
    fontSize: 'medium',
    language: 'en',
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
    highContrast: false,
    reduceMotion: false,
    largeCursor: false,
    screenReader: false,
    keyboardNavigation: true,
    focusIndicator: true,
    showOnlineStatus: true,
    showTypingIndicator: true,
    showReadReceipts: true,
    blockPreviews: false,
    autoDownloadMedia: 'wifi',
    cacheImages: true,
    clearCacheOnExit: false,
  },
  
  // Notifications
  notifications: {
    soundEnabled: true,
    showDoubleTick: true,
    showBlueTick: false,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    mutedRooms: [],
    dmOnlyPriority: false,
    mentionOnly: false,
  },
  
  // Network & Performance
  network: {
    adaptiveBitrate: true,
    maxBitrate: 2500,
    minBitrate: 300,
    prioritizeAudio: true,
    fallbackToAudioOnly: true,
    reconnectAttempts: 5,
    reconnectDelay: 2000,
    enableSimulcast: true,
    enableSVC: true,
  },
  
  // Keyboard Shortcuts
  shortcuts: {
    mute: 'Ctrl+M',
    unmute: 'Ctrl+M',
    videoOn: 'Ctrl+E',
    videoOff: 'Ctrl+E',
    screenShare: 'Ctrl+Shift+S',
    raiseHand: 'Ctrl+H',
    chat: 'Ctrl+K',
    leaveCall: 'Ctrl+Q',
    fullscreen: 'F11',
    toggleStats: 'Ctrl+Shift+I',
  },
};

// Load settings from localStorage
export const loadSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge with defaults to ensure all keys exist
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        calls: { ...DEFAULT_SETTINGS.calls, ...(parsed.calls || {}) },
        streaming: { ...DEFAULT_SETTINGS.streaming, ...(parsed.streaming || {}) },
        devices: { ...DEFAULT_SETTINGS.devices, ...(parsed.devices || {}) },
        ui: { ...DEFAULT_SETTINGS.ui, ...(parsed.ui || {}) },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
        network: { ...DEFAULT_SETTINGS.network, ...(parsed.network || {}) },
        shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(parsed.shortcuts || {}) },
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage
export const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

// Update specific section
export const updateSettings = (section, values) => {
  const current = loadSettings();
  const updated = {
    ...current,
    [section]: { ...current[section], ...values }
  };
  saveSettings(updated);
  return updated;
};

// Detect and save available devices
export const detectDevices = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return {
      cameras: [],
      microphones: [],
      speakers: []
    };
  }
  
  try {
    // Request permissions first to get labels
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .catch(() => {}); // Ignore errors, just to trigger permission request
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    return {
      cameras: devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
        })),
      microphones: devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 4)}`,
        })),
      speakers: devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 4)}`,
        })),
    };
  } catch (error) {
    console.error('Failed to detect devices:', error);
    return {
      cameras: [],
      microphones: [],
      speakers: []
    };
  }
};

// Get formatted device label
export const getDeviceLabel = (deviceId, devices) => {
  const allDevices = [
    ...(devices.cameras || []),
    ...(devices.microphones || []),
    ...(devices.speakers || [])
  ];
  const device = allDevices.find(d => d.deviceId === deviceId);
  return device?.label || 'Unknown Device';
};

// Check if a device is available
export const isDeviceAvailable = (deviceId, devices) => {
  const allDevices = [
    ...(devices.cameras || []),
    ...(devices.microphones || []),
    ...(devices.speakers || [])
  ];
  return allDevices.some(d => d.deviceId === deviceId);
};

// Export all settings as JSON
export const exportSettings = (settings) => {
  const dataStr = JSON.stringify(settings, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = `devchat-settings-${new Date().toISOString().slice(0,10)}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

// Import settings from JSON
export const importSettings = (jsonString) => {
  try {
    const imported = JSON.parse(jsonString);
    // Validate structure
    if (imported.calls && imported.streaming && imported.devices) {
      saveSettings(imported);
      return { success: true };
    }
    return { success: false, error: 'Invalid settings format' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};