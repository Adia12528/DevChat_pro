import React, { useEffect, useState } from 'react';
import { X, Mic, Volume2, Wifi } from 'lucide-react';
import { useEnhancedCall } from '../../hooks/useEnhancedcall';

const CallSettings = ({ onClose, callHook }) => {
  const callApi = callHook || useEnhancedCall();
  const { settings, updateCallSettings } = callApi;
  const [localSettings, setLocalSettings] = useState(settings || {});

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateCallSettings(localSettings);
    onClose();
  };

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
    };
  }, [onClose]);

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>Call Settings</h2>
          <button className="close-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
        <div className="settings-section">
          <h3>
            <Mic size={18} />
            Audio Settings
          </h3>
          
          <div className="setting-item">
            <label>Echo Cancellation</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={localSettings.echoCancellation}
                onChange={(e) => handleChange('echoCancellation', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>Noise Suppression</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={localSettings.noiseSuppression}
                onChange={(e) => handleChange('noiseSuppression', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>Auto Gain Control</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={localSettings.autoGainControl}
                onChange={(e) => handleChange('autoGainControl', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>Stereo Audio</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={localSettings.stereoAudio}
                onChange={(e) => handleChange('stereoAudio', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>
            <Volume2 size={18} />
            Video Quality
          </h3>

          <div className="setting-item">
            <label>Video Quality</label>
            <select 
              value={localSettings.videoQuality}
              onChange={(e) => handleChange('videoQuality', e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="low">Low (360p)</option>
              <option value="medium">Medium (480p)</option>
              <option value="high">High (720p)</option>
              <option value="ultra">Ultra (1080p)</option>
            </select>
          </div>

          <div className="setting-item">
            <label>Max Frame Rate</label>
            <select 
              value={localSettings.frameRate}
              onChange={(e) => handleChange('frameRate', parseInt(e.target.value))}
            >
              <option value="15">15 fps</option>
              <option value="24">24 fps</option>
              <option value="30">30 fps</option>
              <option value="48">48 fps</option>
              <option value="60">60 fps</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>
            <Wifi size={18} />
            Network
          </h3>

          <div className="setting-item">
            <label>Bandwidth Limit</label>
            <select 
              value={localSettings.bandwidthLimit}
              onChange={(e) => handleChange('bandwidthLimit', parseInt(e.target.value))}
            >
              <option value="0">Unlimited</option>
              <option value="500">500 kbps</option>
              <option value="1000">1 Mbps</option>
              <option value="2000">2 Mbps</option>
              <option value="5000">5 Mbps</option>
            </select>
          </div>
        </div>

          <div className="settings-actions">
            <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
            <button className="btn-primary" onClick={handleSave} type="button">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallSettings;