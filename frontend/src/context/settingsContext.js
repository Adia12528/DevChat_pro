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

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      };
    }
  }, []);

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

  const value = {
    settings,
    devices,
    isLoading,
    error,
    updateSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
