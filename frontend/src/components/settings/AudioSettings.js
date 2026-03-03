import React, { useState, useEffect } from 'react';
import { X, Mic, Volume2, Headphones, Speaker, RefreshCw } from 'lucide-react';
import { useEnhancedCall } from '../../hooks/useEnhancedcall';
import { detectDevices } from '../../utils/settings';

const AudioSettings = ({ onClose, callHook }) => {
  const callApi = callHook || useEnhancedCall();
  const { 
    settings, 
    activeDevices, 
    setActiveDevices,
    isTesting,
    audioLevel,
    testMicrophone,
    stopTest,
    savePreferredDevices 
  } = callApi;

  const [devices, setDevices] = useState({
    microphones: [],
    speakers: []
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      stopTest();
    };
  }, [onClose, stopTest]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const deviceList = await detectDevices({
        requestPermission: true,
        requestAudio: true,
        requestVideo: false,
      });
      setDevices({
        microphones: deviceList.microphones || [],
        speakers: deviceList.speakers || []
      });
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrophoneChange = (deviceId) => {
    setActiveDevices(prev => ({ ...prev, microphone: deviceId }));
  };

  const handleSpeakerChange = (deviceId) => {
    setActiveDevices(prev => ({ ...prev, speaker: deviceId }));
  };

  const handleTestMicrophone = () => {
    if (isTesting) {
      stopTest();
    } else {
      testMicrophone();
    }
  };

  const handleSave = () => {
    savePreferredDevices();
    onClose();
  };

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>Audio Settings</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
        <div className="settings-section">
          <h3>
            <Mic size={18} />
            Microphone
          </h3>

          <div className="device-selector">
            <select 
              value={activeDevices.microphone || 'system'}
              onChange={(e) => handleMicrophoneChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="system">System Default</option>
              {devices.microphones.map(mic => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>

            <button 
              className="btn-refresh" 
              onClick={loadDevices}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            </button>
          </div>

          <div className="microphone-test">
            <button 
              className={`test-btn ${isTesting ? 'testing' : ''}`}
              onClick={handleTestMicrophone}
            >
              {isTesting ? 'Stop Test' : 'Test Microphone'}
            </button>
            
            {isTesting && (
              <div className="audio-level-meter">
                <div className="level-bar" style={{ width: `${audioLevel * 100}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3>
            <Volume2 size={18} />
            Audio Processing
          </h3>

          <div className="setting-item">
            <label>Echo Cancellation</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.echoCancellation}
                readOnly
              />
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>Noise Suppression</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.noiseSuppression}
                readOnly
              />
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>Auto Gain Control</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.autoGainControl}
                readOnly
              />
              <span className="toggle-slider"></span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>
            <Headphones size={18} />
            Speaker
          </h3>

          <div className="device-selector">
            <select 
              value={activeDevices.speaker || 'system'}
              onChange={(e) => handleSpeakerChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="system">System Default</option>
              {devices.speakers.map(speaker => (
                <option key={speaker.deviceId} value={speaker.deviceId}>
                  {speaker.label}
                </option>
              ))}
            </select>
          </div>
        </div>

          <div className="settings-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioSettings;