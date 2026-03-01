import React, { useState } from 'react';
import { Radio, Globe, Lock, Camera, Monitor, Mic, Video, Settings as SettingsIcon } from 'lucide-react';
import SettingsTemplate from './settingsTemplate';
import { useSettings } from '../../context/settingsContext';

const StreamSettings = ({ onClose }) => {
  const { settings, updateSettings, resetSection } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings.streaming || {});

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      updateSettings('streaming', localSettings);
      onClose();
    } catch (error) {
      console.error('Failed to save stream settings:', error);
    }
  };

  const handleReset = () => {
    try {
      resetSection('streaming');
      setLocalSettings(settings.streaming);
    } catch (error) {
      console.error('Failed to reset stream settings:', error);
    }
  };

  return (
    <SettingsTemplate
      title="Stream Settings"
      icon={<Radio size={20} />}
      onClose={onClose}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="settings-group">
        <h4>Stream Defaults</h4>
        
        <div className="settings-row">
          <label>Default Quality</label>
          <select
            value={localSettings.defaultQuality || 'auto'}
            onChange={(e) => handleChange('defaultQuality', e.target.value)}
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="low">Low (480p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="high">High (1080p)</option>
            <option value="ultra">Ultra (4K)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Default Source</label>
          <select
            value={localSettings.defaultSource || 'camera'}
            onChange={(e) => handleChange('defaultSource', e.target.value)}
          >
            <option value="camera">Camera</option>
            <option value="screen">Screen</option>
            <option value="both">Both (Camera + Screen)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Default Visibility</label>
          <select
            value={localSettings.defaultVisibility || 'room'}
            onChange={(e) => handleChange('defaultVisibility', e.target.value)}
          >
            <option value="room">Room Only</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Auto-publish stream</label>
          <input
            type="checkbox"
            checked={localSettings.autoPublish || false}
            onChange={(e) => handleChange('autoPublish', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Save streams after end</label>
          <input
            type="checkbox"
            checked={localSettings.saveStreams || false}
            onChange={(e) => handleChange('saveStreams', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Stream Quality</h4>
        
        <div className="settings-row">
          <label>Max bitrate (kbps)</label>
          <input
            type="range"
            min="500"
            max="8000"
            step="100"
            value={localSettings.maxBitrate || 2500}
            onChange={(e) => handleChange('maxBitrate', parseInt(e.target.value))}
          />
          <span className="settings-value">{localSettings.maxBitrate || 2500} kbps</span>
        </div>

        <div className="settings-row">
          <label>Max frame rate</label>
          <select
            value={localSettings.maxFramerate || 30}
            onChange={(e) => handleChange('maxFramerate', parseInt(e.target.value))}
          >
            <option value="15">15 fps</option>
            <option value="24">24 fps</option>
            <option value="30">30 fps</option>
            <option value="48">48 fps</option>
            <option value="60">60 fps</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Enable adaptive bitrate</label>
          <input
            type="checkbox"
            checked={localSettings.adaptiveBitrate !== false}
            onChange={(e) => handleChange('adaptiveBitrate', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Chat & Interaction</h4>
        
        <div className="settings-row">
          <label>Auto-show chat</label>
          <input
            type="checkbox"
            checked={localSettings.autoShowChat || true}
            onChange={(e) => handleChange('autoShowChat', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Chat position</label>
          <select
            value={localSettings.chatPosition || 'bottom'}
            onChange={(e) => handleChange('chatPosition', e.target.value)}
          >
            <option value="bottom">Bottom</option>
            <option value="right">Right side</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Enable emoji reactions</label>
          <input
            type="checkbox"
            checked={localSettings.enableEmojiReactions !== false}
            onChange={(e) => handleChange('enableEmojiReactions', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Enable raise hand</label>
          <input
            type="checkbox"
            checked={localSettings.enableRaiseHand || false}
            onChange={(e) => handleChange('enableRaiseHand', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Enable polling</label>
          <input
            type="checkbox"
            checked={localSettings.enablePolling || false}
            onChange={(e) => handleChange('enablePolling', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Moderation</h4>
        
        <div className="settings-row">
          <label>Auto-moderate chat</label>
          <input
            type="checkbox"
            checked={localSettings.autoModerate || false}
            onChange={(e) => handleChange('autoModerate', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Profanity filter</label>
          <input
            type="checkbox"
            checked={localSettings.profanityFilter || true}
            onChange={(e) => handleChange('profanityFilter', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Require approval to chat</label>
          <input
            type="checkbox"
            checked={localSettings.requireApproval || false}
            onChange={(e) => handleChange('requireApproval', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Slow mode (seconds)</label>
          <input
            type="number"
            min="0"
            max="300"
            value={localSettings.slowModeDelay || 0}
            onChange={(e) => handleChange('slowModeDelay', parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Recording</h4>
        
        <div className="settings-row">
          <label>Auto-record streams</label>
          <input
            type="checkbox"
            checked={localSettings.autoRecordStreams || false}
            onChange={(e) => handleChange('autoRecordStreams', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Record video</label>
          <input
            type="checkbox"
            checked={localSettings.recordVideo !== false}
            onChange={(e) => handleChange('recordVideo', e.target.checked)}
            disabled={!localSettings.autoRecordStreams}
          />
        </div>

        <div className="settings-row">
          <label>Record chat</label>
          <input
            type="checkbox"
            checked={localSettings.recordChat !== false}
            onChange={(e) => handleChange('recordChat', e.target.checked)}
            disabled={!localSettings.autoRecordStreams}
          />
        </div>

        <div className="settings-row">
          <label>Storage location</label>
          <select
            value={localSettings.recordStorage || 'cloud'}
            onChange={(e) => handleChange('recordStorage', e.target.value)}
            disabled={!localSettings.autoRecordStreams}
          >
            <option value="cloud">Cloud</option>
            <option value="local">Local</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h4>Accessibility</h4>
        
        <div className="settings-row">
          <label>Closed captions</label>
          <input
            type="checkbox"
            checked={localSettings.closedCaptions || false}
            onChange={(e) => handleChange('closedCaptions', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Sign language view</label>
          <input
            type="checkbox"
            checked={localSettings.signLanguage || false}
            onChange={(e) => handleChange('signLanguage', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Audio descriptions</label>
          <input
            type="checkbox"
            checked={localSettings.audioDescriptions || false}
            onChange={(e) => handleChange('audioDescriptions', e.target.checked)}
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

        .settings-row select,
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
          min-width: 60px;
          text-align: right;
          color: var(--primary);
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .settings-row {
            flex-wrap: wrap;
          }
          
          .settings-row select,
          .settings-row input[type="range"],
          .settings-row input[type="number"] {
            width: 100%;
          }
        }
      `}</style>
    </SettingsTemplate>
  );
};

export default StreamSettings;