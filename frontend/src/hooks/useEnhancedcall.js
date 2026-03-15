import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings, detectDevices } from '../utils/settings';

export const useEnhancedCall = (socket, username) => {
  const [settings, setSettings] = useState(loadSettings());
  const [devices, setDevices] = useState([]);
  const [activeDevices, setActiveDevices] = useState({
    camera: null,
    microphone: null,
    speaker: null,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Load devices on mount
  useEffect(() => {
    const loadDevices = async () => {
      const deviceList = await detectDevices();
      setDevices(deviceList);

      setActiveDevices((previous) => ({
        camera: previous?.camera || settings.devices.preferredCameraId || 'system',
        microphone: previous?.microphone || settings.devices.preferredMicrophoneId || 'system',
        speaker: previous?.speaker || settings.devices.preferredSpeakerId || 'system',
      }));
    };
    
    loadDevices();
    
    navigator.mediaDevices?.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadDevices);
    };
  }, [settings.devices]);

  // Test microphone
  const testMicrophone = useCallback(async () => {
    try {
      setIsTesting(true);
      
      const constraints = {
        audio: {
          deviceId: activeDevices.microphone !== 'system' 
            ? { exact: activeDevices.microphone } 
            : undefined,
          echoCancellation: settings.calls.echoCancellation,
          noiseSuppression: settings.calls.noiseSuppression,
          autoGainControl: settings.calls.autoGainControl,
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average / 255);
        requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      
    } catch (error) {
      console.error('Microphone test failed:', error);
    }
  }, [activeDevices.microphone, settings.calls]);

  // Stop testing
  const stopTest = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setIsTesting(false);
  }, []);

  // Update settings
  const updateCallSettings = useCallback((newSettings) => {
    const updated = {
      ...settings,
      calls: { ...settings.calls, ...newSettings }
    };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  // Save preferred devices
  const savePreferredDevices = useCallback(() => {
    const preferredCameraId = activeDevices.camera && activeDevices.camera !== 'system'
      ? activeDevices.camera
      : '';
    const preferredMicrophoneId = activeDevices.microphone && activeDevices.microphone !== 'system'
      ? activeDevices.microphone
      : '';
    const preferredSpeakerId = activeDevices.speaker && activeDevices.speaker !== 'system'
      ? activeDevices.speaker
      : 'default';

    const updated = {
      ...settings,
      devices: {
        ...settings.devices,
        preferredCameraId,
        preferredMicrophoneId,
        preferredSpeakerId,
      }
    };

    try {
      localStorage.setItem('devchatPreferredCameraId', preferredCameraId);
      localStorage.setItem('devchatPreferredMicrophoneId', preferredMicrophoneId);
      localStorage.setItem('devchatPreferredAudioOutput', preferredSpeakerId || 'default');
    } catch {}

    setSettings(updated);
    saveSettings(updated);
  }, [settings, activeDevices]);

  // Get optimal call constraints based on settings
  const getCallConstraints = useCallback((type) => {
    const baseConstraints = {
      audio: {
        echoCancellation: settings.calls.echoCancellation,
        noiseSuppression: settings.calls.noiseSuppression,
        autoGainControl: settings.calls.autoGainControl,
        deviceId: activeDevices.microphone !== 'system' 
          ? { ideal: activeDevices.microphone } 
          : undefined,
      }
    };

    if (type === 'video') {
      let videoConstraints = {};
      
      if (settings.calls.videoQuality === 'low') {
        videoConstraints = {
          width: { ideal: 640, max: 854 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 24 },
        };
      } else if (settings.calls.videoQuality === 'medium') {
        videoConstraints = {
          width: { ideal: 854, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        };
      } else if (settings.calls.videoQuality === 'high') {
        videoConstraints = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: settings.calls.frameRate },
        };
      } else {
        videoConstraints = {
          width: { ideal: 1280, min: 320, max: 1920 },
          height: { ideal: 720, min: 240, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        };
      }

      return {
        ...baseConstraints,
        video: {
          ...videoConstraints,
          deviceId: activeDevices.camera !== 'system'
            ? { ideal: activeDevices.camera }
            : undefined,
        }
      };
    }

    return { ...baseConstraints, video: false };
  }, [settings.calls, activeDevices]);

  return {
    settings: settings.calls,
    devices,
    activeDevices,
    setActiveDevices,
    isTesting,
    audioLevel,
    testMicrophone,
    stopTest,
    updateCallSettings,
    savePreferredDevices,
    getCallConstraints,
  };
};