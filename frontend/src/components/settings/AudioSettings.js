import React, { useState } from 'react';
import { Mic, Volume2, Headphones, Bell, Music } from 'lucide-react';
import SettingsTemplate from './settingsTemplate';
import DeviceTestPanel from './DeviceTestPanel';
import { useSettings } from '../../context/settingsContext';

const AudioSettings = ({ onClose }) => {
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
      console.error('Failed to save audio settings:', error);
    }
  };

  const handleReset = () => {
    try {
      resetSection('calls');
      setLocalSettings(settings.calls);
    } catch (error) {
      console.error('Failed to reset audio settings:', error);
    }
  };

  return (
    <SettingsTemplate
      title="Audio Settings"
      icon={<Volume2 size={20} />}
      onClose={onClose}
      onSave={handleSave}
      onReset={handleReset}
    >
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
          onClick={() => setActiveTest('microphone')}
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

      <div className="settings-group">
        <h4>Speaker / Output</h4>
        
        <select
          className="settings-select-enhanced"
          value={settings.devices.preferredSpeaker || ''}
          onChange={(e) => updateSettings('devices', { preferredSpeaker: e.target.value })}
        >
          <option value="">System Default Speaker</option>
          {devices.speakers?.map(spk => (
            <option key={spk.deviceId} value={spk.deviceId}>
              {spk.label}
            </option>
          ))}
        </select>

        <button 
          className="settings-btn-test" 
          onClick={() => setActiveTest('speaker')}
        >
          <Volume2 size={14} /> Test Speaker
        </button>
      </div>

      {activeTest === 'speaker' && (
        <DeviceTestPanel deviceType="speaker" onTestComplete={() => setActiveTest(null)} />
      )}

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

        <div className="settings-row">
          <label>High-pass filter</label>
          <input
            type="checkbox"
            checked={localSettings.highPassFilter || false}
            onChange={(e) => handleChange('highPassFilter', e.target.checked)}
          />
        </div>
      </div>

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
            <option value="classic">Classic Phone</option>
            <option value="modern">Modern</option>
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

        <button className="settings-btn-test" onClick={() => setActiveTest('speaker')}>
          <Bell size={14} /> Preview Ringtone
        </button>
      </div>

      <div className="settings-group">
        <h4>Sound Effects</h4>
        
        <div className="settings-row">
          <label>Message sent sound</label>
          <input
            type="checkbox"
            checked={localSettings.messageSentSound !== false}
            onChange={(e) => handleChange('messageSentSound', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Message received sound</label>
          <input
            type="checkbox"
            checked={localSettings.messageReceivedSound !== false}
            onChange={(e) => handleChange('messageReceivedSound', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Call connecting sound</label>
          <input
            type="checkbox"
            checked={localSettings.callConnectingSound !== false}
            onChange={(e) => handleChange('callConnectingSound', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Key press sounds</label>
          <input
            type="checkbox"
            checked={localSettings.keyPressSounds || false}
            onChange={(e) => handleChange('keyPressSounds', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Advanced Audio</h4>
        
        <div className="settings-row">
          <label>Audio bitrate (kbps)</label>
          <select
            value={localSettings.audioBitrate || 64}
            onChange={(e) => handleChange('audioBitrate', parseInt(e.target.value))}
          >
            <option value="32">32 kbps (Low)</option>
            <option value="64">64 kbps (Standard)</option>
            <option value="128">128 kbps (High)</option>
            <option value="256">256 kbps (Very High)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Stereo audio</label>
          <input
            type="checkbox"
            checked={localSettings.stereoAudio || false}
            onChange={(e) => handleChange('stereoAudio', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Opus codec</label>
          <select
            value={localSettings.opusCodec || 'opus'}
            onChange={(e) => handleChange('opusCodec', e.target.value)}
          >
            <option value="opus">Opus (Default)</option>
            <option value="pcmu">PCMU</option>
            <option value="pcma">PCMA</option>
          </select>
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

export default AudioSettings;