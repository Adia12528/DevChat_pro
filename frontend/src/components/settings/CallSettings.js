import React, { useState } from 'react';
import { Phone, Volume2, Mic, Camera, Activity, Bell, Clock } from 'lucide-react';
import SettingsTemplate from './settingsTemplate';
import DeviceTestPanel from './DeviceTestPanel';
import { useSettings } from '../../context/settingsContext';

const CallSettings = ({ onClose }) => {
  const { settings, devices, updateSettings, resetSection } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings.calls || {});
  const [activeTest, setActiveTest] = useState(null);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      updateSettings('calls', localSettings);
      onClose();
    } catch (error) {
      console.error('Failed to save call settings:', error);
    }
  };

  const handleReset = () => {
    try {
      resetSection('calls');
      setLocalSettings(settings.calls);
    } catch (error) {
      console.error('Failed to reset call settings:', error);
    }
  };

  const testMicrophone = () => {
    setActiveTest('microphone');
  };

  const testSpeaker = () => {
    setActiveTest('speaker');
  };

  const testCamera = () => {
    setActiveTest('camera');
  };

  return (
    <SettingsTemplate
      title="Call Settings"
      icon={<Phone size={20} />}
      onClose={onClose}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="settings-tabs">
        <button className="settings-tab active">General</button>
        <button className="settings-tab">Audio</button>
        <button className="settings-tab">Video</button>
        <button className="settings-tab">Advanced</button>
      </div>

      {/* General Settings */}
      <div className="settings-group">
        <h4>Ringtone</h4>
        
        <div className="settings-row">
          <label>Ringtone Style</label>
          <select
            value={localSettings.ringtoneStyle || 'soft'}
            onChange={(e) => handleChange('ringtoneStyle', e.target.value)}
          >
            <option value="soft">Soft (Default)</option>
            <option value="chime">Chime</option>
            <option value="pulse">Pulse</option>
            <option value="off">Off</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Ringtone Volume</label>
          <input
            type="range"
            min="0"
            max="100"
            value={localSettings.ringtoneVolume || 80}
            onChange={(e) => handleChange('ringtoneVolume', parseInt(e.target.value))}
          />
          <span className="settings-value">{localSettings.ringtoneVolume || 80}%</span>
        </div>

        <button className="settings-btn-test" onClick={testSpeaker}>
          <Volume2 size={14} /> Test Speaker
        </button>
      </div>

      {activeTest === 'speaker' && (
        <DeviceTestPanel deviceType="speaker" onTestComplete={() => setActiveTest(null)} />
      )}

      {/* Audio Settings */}
      <div className="settings-group">
        <h4>Audio Processing</h4>
        
        <div className="settings-row">
          <label>Echo Cancellation</label>
          <input
            type="checkbox"
            checked={localSettings.echoCancellation !== false}
            onChange={(e) => handleChange('echoCancellation', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Noise Suppression</label>
          <input
            type="checkbox"
            checked={localSettings.noiseSuppression !== false}
            onChange={(e) => handleChange('noiseSuppression', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Auto Gain Control</label>
          <input
            type="checkbox"
            checked={localSettings.autoGainControl !== false}
            onChange={(e) => handleChange('autoGainControl', e.target.checked)}
          />
        </div>
      </div>

      {/* Microphone Selection */}
      <div className="settings-group">
        <h4>Microphone</h4>
        
        <select
          className="settings-select-enhanced"
          value={settings.devices.preferredMicrophone || ''}
          onChange={(e) => updateSettings('devices', { preferredMicrophone: e.target.value })}
        >
          <option value="">System Default Microphone</option>
          {devices.microphones?.map(mic => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label}
            </option>
          ))}
        </select>

        <button 
          className="settings-btn-test" 
          onClick={testMicrophone}
          disabled={!devices.microphones?.length}
        >
          <Mic size={14} /> Test Microphone
        </button>
      </div>

      {activeTest === 'microphone' && (
        <DeviceTestPanel 
          deviceType="microphone" 
          deviceId={settings.devices.preferredMicrophone}
          onTestComplete={() => setActiveTest(null)} 
        />
      )}

      {/* Video Settings */}
      <div className="settings-group">
        <h4>Video Quality</h4>
        
        <div className="settings-row">
          <label>Video Quality</label>
          <select
            value={localSettings.videoQuality || 'auto'}
            onChange={(e) => handleChange('videoQuality', e.target.value)}
          >
            <option value="auto">Auto (Recommended)</option>
            <option value="low">Low (480p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="high">High (1080p)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Frame Rate</label>
          <select
            value={localSettings.frameRate || 30}
            onChange={(e) => handleChange('frameRate', parseInt(e.target.value))}
          >
            <option value="15">15 fps (Low bandwidth)</option>
            <option value="24">24 fps (Standard)</option>
            <option value="30">30 fps (Smooth)</option>
            <option value="60">60 fps (High)</option>
          </select>
        </div>
      </div>

      {/* Camera Selection */}
      <div className="settings-group">
        <h4>Camera</h4>
        
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
          onClick={testCamera}
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

      {/* Advanced Settings */}
      <div className="settings-group">
        <h4>Advanced</h4>
        
        <div className="settings-row">
          <label>Auto-record calls</label>
          <input
            type="checkbox"
            checked={localSettings.autoRecordCalls || false}
            onChange={(e) => handleChange('autoRecordCalls', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Show call statistics</label>
          <input
            type="checkbox"
            checked={localSettings.enableStats || false}
            onChange={(e) => handleChange('enableStats', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Bandwidth mode</label>
          <select
            value={localSettings.bandwidthMode || 'auto'}
            onChange={(e) => handleChange('bandwidthMode', e.target.value)}
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="save-data">Save Data</option>
            <option value="high-quality">High Quality</option>
          </select>
        </div>
      </div>

      <style jsx>{`
        .settings-tabs {
          display: flex;
          gap: var(--space-2);
          padding: var(--space-3) 0;
          border-bottom: 1px solid var(--divider);
          margin-bottom: var(--space-4);
          overflow-x: auto;
        }

        .settings-tab {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          background: transparent;
          color: var(--txt-secondary);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .settings-tab:hover {
          background: var(--primary-muted);
          color: var(--primary);
        }

        .settings-tab.active {
          background: var(--primary);
          color: #000;
        }

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

        .settings-row select,
        .settings-row input[type="text"],
        .settings-row input[type="number"] {
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
          min-width: 45px;
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
          margin-top: var(--space-2);
        }

        .settings-btn-test:hover:not(:disabled) {
          background: var(--primary);
          color: #000;
        }

        .settings-btn-test:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

export default CallSettings;