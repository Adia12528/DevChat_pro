// frontend/src/hooks/useEnhancedStreaming.js
import { useState, useEffect, useCallback } from 'react';
import { loadSettings, saveSettings } from '../utils/settings';

export const useEnhancedStreaming = (socket, username, room) => {
  const [settings, setSettings] = useState(loadSettings());
  const [streamQuality, setStreamQuality] = useState('auto');
  const [bandwidth, setBandwidth] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [streamStats, setStreamStats] = useState({
    bitrate: 0,
    fps: 0,
    resolution: '1280x720',
    packetLoss: 0,
  });

  // Monitor network conditions
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = navigator.connection || 
                        navigator.mozConnection || 
                        navigator.webkitConnection;
      
      if (connection) {
        const updateBandwidth = () => {
          setBandwidth({
            type: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData,
          });
        };
        
        updateBandwidth();
        connection.addEventListener('change', updateBandwidth);
        
        return () => {
          connection.removeEventListener('change', updateBandwidth);
        };
      }
    }
  }, []);

  // Auto-adjust quality based on network
  useEffect(() => {
    if (settings.streaming.defaultStreamQuality === 'auto' && bandwidth) {
      if (bandwidth.saveData || bandwidth.downlink < 1.5) {
        setStreamQuality('low');
      } else if (bandwidth.downlink < 3) {
        setStreamQuality('medium');
      } else if (bandwidth.downlink < 6) {
        setStreamQuality('high');
      } else {
        setStreamQuality('ultra');
      }
    }
  }, [bandwidth, settings.streaming.defaultStreamQuality]);

  // Get optimal stream constraints
  const getStreamConstraints = useCallback((source) => {
    let videoConstraints = {};

    switch (streamQuality) {
      case 'low':
        videoConstraints = {
          width: { ideal: 640, max: 854 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 24 },
          bitrate: 500000, // 500 kbps
        };
        break;
      case 'medium':
        videoConstraints = {
          width: { ideal: 854, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          bitrate: 1500000, // 1.5 mbps
        };
        break;
      case 'high':
        videoConstraints = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 48 },
          bitrate: 3000000, // 3 mbps
        };
        break;
      case 'ultra':
        videoConstraints = {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 48, max: 60 },
          bitrate: 6000000, // 6 mbps
        };
        break;
      default:
        videoConstraints = {
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 360, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        };
    }

    if (source === 'screen') {
      return {
        video: {
          ...videoConstraints,
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: false,
      };
    }

    return {
      video: videoConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    };
  }, [streamQuality]);

  // Get LiveKit options
  const getLiveKitOptions = useCallback(() => {
    return {
      videoCaptureDefaults: {
        resolution: streamQuality === 'ultra' ? 'full-hd' : 'hd',
      },
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        videoSimulcastLayers: streamQuality === 'ultra' 
          ? ['h', 'q'] 
          : ['h'],
        videoCodec: 'vp9',
        dtx: true,
        red: true,
      },
    };
  }, [streamQuality]);

  // Update streaming settings
  const updateStreamingSettings = useCallback((newSettings) => {
    const updated = {
      ...settings,
      streaming: { ...settings.streaming, ...newSettings }
    };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  return {
    settings: settings.streaming,
    streamQuality,
    bandwidth,
    viewers,
    streamStats,
    getStreamConstraints,
    getLiveKitOptions,
    updateStreamingSettings,
    setViewers,
    setStreamStats,
  };
};