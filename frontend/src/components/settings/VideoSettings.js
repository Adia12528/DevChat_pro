import React, { useState } from 'react';
import { Camera, Video, Monitor, Settings as SettingsIcon } from 'lucide-react';
import SettingsTemplate from './settingsTemplate';
import DeviceTestPanel from './DeviceTestPanel';
import { useSettings } from '../../context/settingsContext';

const VideoSettings = ({ onClose }) => {
  const { settings, devices, updateSettings, resetSection } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings.calls);
  const [activeTest, setActiveTest] = useState(null);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateSettings('calls', localSettings);
    onClose();
  };

  const handleReset = () => {
    resetSection('calls');
    setLocalSettings(settings.calls);
  };

  return (
    <SettingsTemplate
      title="Video & Camera Settings"
      icon={<Camera size={20} />}
      onClose={onClose}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="settings-group">
        <h4>Camera Selection</h4>
        
        <select
          className="settings-select-enhanced"
          value={settings.devices.preferredCamera || ''}
          onChange={(e) => updateSettings('devices', { preferredCamera: e.target.value })}
        >
          <option value="">System Default Camera</option>
          {devices.cameras?.map(cam => (
            <option key={cam.deviceId} value={cam.deviceId}>
              {cam.label}
            </option>
          ))}
        </select>

        <button 
          className="settings-btn-test" 
          onClick={() => setActiveTest('camera')}
          disabled={!devices.cameras?.length}
        >
          <Camera size={14} /> Test Camera
        </button>
      </div>

      {activeTest === 'camera' && (
        <DeviceTestPanel 
          deviceType="camera" 
          deviceId={settings.devices.preferredCamera}
          onTestComplete={() => setActiveTest(null)} 
        />
      )}

      <div className="settings-group">
        <h4>Video Quality</h4>
        
        <div className="settings-row">
          <label>Resolution</label>
          <select
            value={localSettings.videoQuality}
            onChange={(e) => handleChange('videoQuality', e.target.value)}
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="low">Low (640x360) - 360p</option>
            <option value="medium">Medium (854x480) - 480p</option>
            <option value="high">High (1280x720) - 720p</option>
            <option value="ultra">Ultra (1920x1080) - 1080p</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Frame Rate (fps)</label>
          <select
            value={localSettings.frameRate}
            onChange={(e) => handleChange('frameRate', parseInt(e.target.value))}
          >
            <option value="15">15 fps (Low bandwidth)</option>
            <option value="24">24 fps (Standard)</option>
            <option value="30">30 fps (Smooth)</option>
            <option value="48">48 fps (High)</option>
            <option value="60">60 fps (Very High)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Bitrate (kbps)</label>
          <input
            type="range"
            min="300"
            max="6000"
            step="100"
            value={localSettings.bitrate || 1500}
            onChange={(e) => handleChange('bitrate', parseInt(e.target.value))}
          />
          <span className="settings-value">{localSettings.bitrate || 1500} kbps</span>
        </div>
      </div>

      <div className="settings-group">
        <h4>Video Effects</h4>
        
        <div className="settings-row">
          <label>Enable video effects</label>
          <input
            type="checkbox"
            checked={localSettings.enableVideoEffects}
            onChange={(e) => handleChange('enableVideoEffects', e.target.checked)}
          />
        </div>

        {localSettings.enableVideoEffects && (
          <>
            <div className="settings-row">
              <label>Background Blur</label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.backgroundBlur || 0}
                onChange={(e) => handleChange('backgroundBlur', parseInt(e.target.value))}
              />
              <span className="settings-value">{localSettings.backgroundBlur || 0}%</span>
            </div>

            <div className="settings-row">
              <label>Brightness</label>
              <input
                type="range"
                min="50"
                max="150"
                value={localSettings.brightness || 100}
                onChange={(e) => handleChange('brightness', parseInt(e.target.value))}
              />
              <span className="settings-value">{localSettings.brightness || 100}%</span>
            </div>

            <div className="settings-row">
              <label>Contrast</label>
              <input
                type="range"
                min="50"
                max="150"
                value={localSettings.contrast || 100}
                onChange={(e) => handleChange('contrast', parseInt(e.target.value))}
              />
              <span className="settings-value">{localSettings.contrast || 100}%</span>
            </div>

            <div className="settings-row">
              <label>Saturation</label>
              <input
                type="range"
                min="0"
                max="200"
                value={localSettings.saturation || 100}
                onChange={(e) => handleChange('saturation', parseInt(e.target.value))}
              />
              <span className="settings-value">{localSettings.saturation || 100}%</span>
            </div>
          </>
        )}
      </div>

      <div className="settings-group">
        <h4>Screen Sharing</h4>
        
        <div className="settings-row">
          <label>Screen share quality</label>
          <select
            value={localSettings.screenSharingQuality || '1080p'}
            onChange={(e) => handleChange('screenSharingQuality', e.target.value)}
          >
            <option value="720p">720p (Recommended)</option>
            <option value="1080p">1080p (High)</option>
            <option value="4k">4K (Ultra)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Share system audio</label>
          <input
            type="checkbox"
            checked={localSettings.shareSystemAudio || false}
            onChange={(e) => handleChange('shareSystemAudio', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Optimize for video</label>
          <input
            type="checkbox"
            checked={localSettings.optimizeScreenVideo || true}
            onChange={(e) => handleChange('optimizeScreenVideo', e.target.checked)}
          />
        </div>
      </div>

      <style jsx>{`
        .settings-group {
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--divider);
        }

        .settings-group:last-child {
          border-bottom: none;
        }

        .settings-group h4 {
          margin: 0 0 var(--space-3) 0;
          font-size: var(--text-sm);
          color: var(--txt-secondary);
          font-weight: 600;
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2) 0;
          gap: var(--space-3);
        }

        .settings-row label {
          font-size: var(--text-sm);
          color: var(--txt);
          flex: 1;
        }

        .settings-row select {
          width: 200px;
          padding: var(--space-2) var(--space-3);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--txt);
        }

        .settings-row input[type="range"] {
          width: 200px;
        }

        .settings-value {
          min-width: 60px;
          text-align: right;
          color: var(--primary);
          font-weight: 600;
        }

        .settings-select-enhanced {
          width: 100%;
          padding: var(--space-3);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--txt);
          margin-bottom: var(--space-2);
        }

        .settings-btn-test {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--primary-muted);
          color: var(--primary);
          border: 1px solid var(--primary);
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .settings-btn-test:hover:not(:disabled) {
          background: var(--primary);
          color: #000;
        }

        @media (max-width: 768px) {
          .settings-row {
            flex-wrap: wrap;
          }
          
          .settings-row select,
          .settings-row input[type="range"] {
            width: 100%;
          }
        }
      `}</style>
    </SettingsTemplate>
  );
};

export default VideoSettings;