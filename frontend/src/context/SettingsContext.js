import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadSettings, saveSettings, detectDevices } from '../utils/settings';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(loadSettings());
  const [devices, setDevices] = useState({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load devices on mount
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setIsLoading(true);
        const deviceList = await detectDevices();
        setDevices(deviceList || {
          cameras: [],
          microphones: [],
          speakers: []
        });
      } catch (err) {
        console.error('Failed to load devices:', err);
        setError('Could not detect media devices');
      } finally {
        setIsLoading(false);
      }
    };

    loadDevices();

    // Listen for device changes
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      };
    }
  }, []);
  

  // Update settings and save to localStorage
  const updateSettings = useCallback((section, values) => {
    setSettings(prev => {
      const updated = {
        ...prev,
        [section]: { ...prev[section], ...values }
      };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Update multiple sections at once
  const updateBulkSettings = useCallback((updates) => {
    setSettings(prev => {
      const updated = { ...prev };
      Object.entries(updates).forEach(([section, values]) => {
        updated[section] = { ...updated[section], ...values };
      });
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Reset a section to defaults
  const resetSection = useCallback((section) => {
    import('../utils/settings').then(({ DEFAULT_SETTINGS }) => {
      setSettings(prev => {
        const updated = {
          ...prev,
          [section]: DEFAULT_SETTINGS[section]
        };
        saveSettings(updated);
        return updated;
      });
    });
  }, []);

  // Reset all settings to defaults
  const resetAllSettings = useCallback(() => {
    import('../utils/settings').then(({ DEFAULT_SETTINGS }) => {
      setSettings(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS);
    });
  }, []);

  // Export settings as JSON
  const exportSettings = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `devchat-settings-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [settings]);

  // Import settings from JSON
  const importSettings = useCallback((jsonString) => {
    try {
      const imported = JSON.parse(jsonString);
      // Validate structure (basic check)
      if (imported.calls && imported.streaming && imported.devices) {
        setSettings(imported);
        saveSettings(imported);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid settings format' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Get call constraints based on settings
  const getCallConstraints = useCallback((type = 'voice') => {
    const callPrefs = settings.calls;
    const devicePrefs = settings.devices;

    const baseConstraints = {
      audio: {
        echoCancellation: callPrefs.echoCancellation,
        noiseSuppression: callPrefs.noiseSuppression,
        autoGainControl: callPrefs.autoGainControl,
        sampleRate: 48000,
        channelCount: 1
      }
    };

    if (type === 'video') {
      let videoConstraints = {};

      switch (callPrefs.videoQuality) {
        case 'low':
          videoConstraints = {
            width: { ideal: 640, max: 854 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 15, max: 24 }
          };
          break;
        case 'medium':
          videoConstraints = {
            width: { ideal: 854, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 }
          };
          break;
        case 'high':
          videoConstraints = {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: callPrefs.frameRate }
          };
          break;
        default: // auto
          videoConstraints = {
            width: { ideal: 1280, min: 320, max: 1920 },
            height: { ideal: 720, min: 240, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          };
      }

      // Add preferred camera if set
      if (devicePrefs.preferredCamera) {
        videoConstraints.deviceId = { exact: devicePrefs.preferredCamera };
      }

      return {
        ...baseConstraints,
        video: videoConstraints
      };
    }

    // Add preferred microphone if set
    if (devicePrefs.preferredMicrophone) {
      baseConstraints.audio.deviceId = { exact: devicePrefs.preferredMicrophone };
    }

    return { ...baseConstraints, video: false };
  }, [settings]);

  // Get stream constraints based on settings
  const getStreamConstraints = useCallback((source = 'camera') => {
    const streamPrefs = settings.streaming;
    const callPrefs = settings.calls;

    let videoConstraints = {};

    switch (streamPrefs.defaultQuality) {
      case 'low':
        videoConstraints = {
          width: { ideal: 640, max: 854 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 24 }
        };
        break;
      case 'medium':
        videoConstraints = {
          width: { ideal: 854, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 }
        };
        break;
      case 'high':
        videoConstraints = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 48 }
        };
        break;
      case 'ultra':
        videoConstraints = {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 48, max: 60 }
        };
        break;
      default: // auto
        videoConstraints = {
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 360, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        };
    }

    if (source === 'screen') {
      return {
        video: {
          ...videoConstraints,
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      };
    }

    return {
      video: {
        ...videoConstraints,
        deviceId: settings.devices.preferredCamera ? { exact: settings.devices.preferredCamera } : undefined
      },
      audio: {
        echoCancellation: callPrefs.echoCancellation,
        noiseSuppression: callPrefs.noiseSuppression,
        autoGainControl: callPrefs.autoGainControl,
        deviceId: settings.devices.preferredMicrophone ? { exact: settings.devices.preferredMicrophone } : undefined
      }
    };
  }, [settings]);

  const value = {
    settings,
    devices,
    isLoading,
    error,
    updateSettings,
    updateBulkSettings,
    resetSection,
    resetAllSettings,
    exportSettings,
    importSettings,
    getCallConstraints,
    getStreamConstraints
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};