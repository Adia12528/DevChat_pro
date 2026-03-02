// src/utils/settings.js
// Settings management for DevChat Pro

// ==================== DEFAULT SETTINGS ====================
export const DEFAULT_SETTINGS = {
  // Call/Audio settings
  calls: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    videoQuality: 'auto', // 'auto', 'low', 'medium', 'high'
    frameRate: 30,
    bandwidthLimit: 0, // 0 = unlimited
    stereoAudio: false,
    opusDtx: true, // Discontinuous Transmission for reduced bandwidth
  },
  
  // Streaming settings
  streaming: {
    defaultStreamQuality: 'auto', // 'auto', 'low', 'medium', 'high', 'ultra'
    enableDynacast: true,
    enableSimulcast: true,
    preferredCodec: 'vp9', // 'vp8', 'vp9', 'h264'
    adaptiveStream: true,
    maxBitrate: 0, // 0 = auto
    enableRecording: false,
    recordingFormat: 'webm',
  },
  
  // Device preferences
  devices: {
    preferredCameraId: null,
    preferredMicrophoneId: null,
    preferredSpeakerId: null,
  },
  
  // UI settings
  ui: {
    theme: 'dark',
    fontSize: 'medium',
    showTypingIndicator: true,
    showReadReceipts: true,
    compactMode: false,
  },
  
  // Notification settings
  notifications: {
    soundEnabled: true,
    volume: 0.8,
    desktopNotifications: true,
    mentionOnly: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00',
    },
  },
  
  // Privacy settings
  privacy: {
    showLastSeen: true,
    showReadReceipts: true,
    blockStrangers: false,
    saveChatHistory: true,
  },
  
  // Network settings
  network: {
    iceTransportPolicy: 'all', // 'all' or 'relay'
    iceCandidatePoolSize: 10,
    enableIceRestart: true,
    reconnectAttempts: 5,
  },
  
  // Advanced settings
  advanced: {
    enableLogging: false,
    enableStats: true,
    enableVideoEffects: false,
    enableBackgroundBlur: false,
    enableVirtualBackground: false,
  },
};

// ==================== STORAGE KEYS ====================
const STORAGE_KEY = 'devchat_settings';
const THEME_KEY = 'devchat_theme';
const VOLUME_KEY = 'devchat_volume';

// ==================== LOAD SETTINGS ====================
export const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      // Initialize with defaults if nothing saved
      saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    
    // Merge saved settings with defaults (to handle new fields)
    const parsed = JSON.parse(saved);
    return mergeWithDefaults(parsed, DEFAULT_SETTINGS);
  } catch (error) {
    console.warn('Failed to load settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
};

// ==================== SAVE SETTINGS ====================
export const saveSettings = (settings) => {
  try {
    // Validate before saving
    const validated = validateSettings(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch (error) {
    console.warn('Failed to save settings:', error);
    return false;
  }
};

// ==================== MERGE WITH DEFAULTS ====================
export const mergeWithDefaults = (saved, defaults) => {
  const merged = { ...defaults };
  
  // Recursive merge
  const merge = (target, source) => {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        merge(target[key], source[key]);
      } else {
        if (source[key] !== undefined) {
          target[key] = source[key];
        }
      }
    });
  };
  
  merge(merged, saved);
  return merged;
};

// ==================== VALIDATE SETTINGS ====================
export const validateSettings = (settings) => {
  const validated = { ...settings };
  
  // Validate video quality
  const validQualities = ['auto', 'low', 'medium', 'high', 'ultra'];
  if (validated.streaming?.defaultStreamQuality && 
      !validQualities.includes(validated.streaming.defaultStreamQuality)) {
    validated.streaming.defaultStreamQuality = 'auto';
  }
  
  // Validate frame rate
  if (validated.calls?.frameRate) {
    validated.calls.frameRate = Math.min(60, Math.max(15, validated.calls.frameRate));
  }
  
  // Validate volume
  if (validated.notifications?.volume) {
    validated.notifications.volume = Math.min(1, Math.max(0, validated.notifications.volume));
  }
  
  return validated;
};

// ==================== DETECT DEVICES ====================
export const detectDevices = async () => {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return {
        cameras: [],
        microphones: [],
        speakers: [],
        hasPermission: false,
      };
    }
    
    // Request permissions first to get labels
    let hasPermission = false;
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      tempStream.getTracks().forEach(track => track.stop());
      hasPermission = true;
    } catch {
      // No permission yet
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    return {
      cameras: devices
        .filter(d => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
          kind: d.kind,
        })),
      microphones: devices
        .filter(d => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
          kind: d.kind,
        })),
      speakers: devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${index + 1}`,
          kind: d.kind,
        })),
      hasPermission,
    };
  } catch (error) {
    console.warn('Failed to detect devices:', error);
    return {
      cameras: [],
      microphones: [],
      speakers: [],
      hasPermission: false,
      error: error.message,
    };
  }
};

// ==================== GET PREFERRED DEVICE ID ====================
export const getPreferredDeviceId = (type) => {
  const settings = loadSettings();
  switch (type) {
    case 'camera':
      return settings.devices?.preferredCameraId || null;
    case 'microphone':
      return settings.devices?.preferredMicrophoneId || null;
    case 'speaker':
      return settings.devices?.preferredSpeakerId || null;
    default:
      return null;
  }
};

// ==================== SAVE PREFERRED DEVICE ====================
export const savePreferredDevice = (type, deviceId) => {
  const settings = loadSettings();
  
  switch (type) {
    case 'camera':
      settings.devices.preferredCameraId = deviceId;
      break;
    case 'microphone':
      settings.devices.preferredMicrophoneId = deviceId;
      break;
    case 'speaker':
      settings.devices.preferredSpeakerId = deviceId;
      break;
    default:
      return false;
  }
  
  return saveSettings(settings);
};

// ==================== THEME MANAGEMENT ====================
export const loadTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    return 'dark';
  }
};

export const saveTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    return true;
  } catch {
    return false;
  }
};

// ==================== VOLUME MANAGEMENT ====================
export const loadVolume = () => {
  try {
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved ? parseFloat(saved) : 0.8;
  } catch {
    return 0.8;
  }
};

export const saveVolume = (volume) => {
  try {
    const normalized = Math.min(1, Math.max(0, volume));
    localStorage.setItem(VOLUME_KEY, normalized.toString());
    return true;
  } catch {
    return false;
  }
};

// ==================== RESET SETTINGS ====================
export const resetSettings = () => {
  try {
    saveSettings(DEFAULT_SETTINGS);
    saveTheme('dark');
    saveVolume(0.8);
    return true;
  } catch {
    return false;
  }
};

// ==================== EXPORT SETTINGS ====================
export const exportSettings = () => {
  const settings = loadSettings();
  const data = JSON.stringify(settings, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devchat-settings-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// ==================== IMPORT SETTINGS ====================
export const importSettings = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const merged = mergeWithDefaults(imported, DEFAULT_SETTINGS);
        const validated = validateSettings(merged);
        
        if (saveSettings(validated)) {
          resolve(validated);
        } else {
          reject(new Error('Failed to save imported settings'));
        }
      } catch (error) {
        reject(new Error('Invalid settings file: ' + error.message));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// ==================== GET STREAM CONSTRAINTS ====================
export const getStreamConstraints = (type = 'video', quality = 'auto', deviceId = null) => {
  const settings = loadSettings();
  const callSettings = settings.calls;
  
  const audioConstraints = {
    echoCancellation: callSettings.echoCancellation,
    noiseSuppression: callSettings.noiseSuppression,
    autoGainControl: callSettings.autoGainControl,
    channelCount: callSettings.stereoAudio ? 2 : 1,
  };
  
  if (deviceId && deviceId !== 'system') {
    audioConstraints.deviceId = { exact: deviceId };
  }
  
  if (type === 'audio') {
    return { audio: audioConstraints, video: false };
  }
  
  // Video constraints
  let videoConstraints = {};
  const activeQuality = quality === 'auto' ? callSettings.videoQuality : quality;
  
  switch (activeQuality) {
    case 'low':
      videoConstraints = {
        width: { ideal: 640, max: 854 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 15, max: 24 },
      };
      break;
    case 'medium':
      videoConstraints = {
        width: { ideal: 854, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 },
      };
      break;
    case 'high':
      videoConstraints = {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: callSettings.frameRate },
      };
      break;
    case 'ultra':
      videoConstraints = {
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
        frameRate: { ideal: 48, max: 60 },
      };
      break;
    default: // auto
      videoConstraints = {
        width: { ideal: 1280, min: 320, max: 1920 },
        height: { ideal: 720, min: 240, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      };
  }
  
  if (deviceId && deviceId !== 'system') {
    videoConstraints.deviceId = { exact: deviceId };
  }
  
  return {
    audio: audioConstraints,
    video: videoConstraints,
  };
};

// ==================== CHECK IF QUIET HOURS ====================
export const isQuietHours = () => {
  const settings = loadSettings();
  const quietHours = settings.notifications?.quietHours;
  
  if (!quietHours?.enabled) return false;
  
  const now = new Date();
  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);
  
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle overnight quiet hours
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
};

// ==================== GET ADAPTIVE QUALITY ====================
export const getAdaptiveQuality = (bandwidth) => {
  if (!bandwidth) return 'auto';
  
  const downlink = bandwidth.downlink || 0; // Mbps
  const saveData = bandwidth.saveData || false;
  
  if (saveData) return 'low';
  if (downlink < 1.5) return 'low';
  if (downlink < 3) return 'medium';
  if (downlink < 6) return 'high';
  return 'ultra';
};

// ==================== GET ICE SERVERS ====================
export const getICEServers = () => {
  const settings = loadSettings();
  
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:turn.devchat.app:3478',
      username: 'devchat',
      credential: 'devchat2024'
    },
    {
      urls: 'turn:turn.devchat.app:5349',
      username: 'devchat',
      credential: 'devchat2024'
    }
  ];
};

// ==================== GET ICE TRANSPORT POLICY ====================
export const getIceTransportPolicy = () => {
  const settings = loadSettings();
  return settings.network?.iceTransportPolicy || 'all';
};