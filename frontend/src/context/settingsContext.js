import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '../utils/settings';

const SettingsContext = createContext(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(loadSettings());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const updateCallSettings = (callSettings) => {
    setSettings(prev => ({
      ...prev,
      calls: {
        ...prev.calls,
        ...callSettings
      }
    }));
  };

  const updateStreamingSettings = (streamingSettings) => {
    setSettings(prev => ({
      ...prev,
      streaming: {
        ...prev.streaming,
        ...streamingSettings
      }
    }));
  };

  const updateDeviceSettings = (deviceSettings) => {
    setSettings(prev => ({
      ...prev,
      devices: {
        ...prev.devices,
        ...deviceSettings
      }
    }));
  };

  const updateNotificationSettings = (notificationSettings) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        ...notificationSettings
      }
    }));
  };

  const resetSettings = () => {
    setSettings(loadSettings()); // Reset to defaults
  };

  const value = {
    settings,
    isLoading,
    updateSettings,
    updateCallSettings,
    updateStreamingSettings,
    updateDeviceSettings,
    updateNotificationSettings,
    resetSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};