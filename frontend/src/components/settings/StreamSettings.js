import React, { useState } from 'react';
import { X, Radio, Monitor, Camera, Globe, Lock, Settings } from 'lucide-react';

const StreamSettings = ({ 
  visibility, 
  source, 
  onVisibilityChange, 
  onSourceChange, 
  onStartStream, 
  onClose,
  isMobile = false,
  isWindows = false
}) => {
  const [streamTitle, setStreamTitle] = useState('');
  const [streamQuality, setStreamQuality] = useState('1080p');
  const [enableChat, setEnableChat] = useState(true);
  const [enableReactions, setEnableReactions] = useState(true);

  const handleStartStream = () => {
    onStartStream(streamTitle);
  };

  return (
    <div className="stream-settings-modal">
      <div className="stream-settings-header">
        <h3>Stream Settings</h3>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="stream-settings-content">
        <div className="stream-settings-group">
          <label>Stream Title</label>
          <input
            type="text"
            className="stream-title-input"
            placeholder="Enter stream title..."
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="stream-settings-group">
          <label>Visibility</label>
          <div className="stream-settings-options">
            <button
              className={`stream-settings-option ${visibility === 'public' ? 'active' : ''}`}
              onClick={() => onVisibilityChange('public')}
            >
              <Globe size={24} />
              <span>Public</span>
              <small>Anyone can join</small>
            </button>
            <button
              className={`stream-settings-option ${visibility === 'room' ? 'active' : ''}`}
              onClick={() => onVisibilityChange('room')}
            >
              <Lock size={24} />
              <span>Room Only</span>
              <small>Only room members</small>
            </button>
          </div>
        </div>

        <div className="stream-settings-group">
          <label>Stream Source</label>
          <div className="stream-settings-options">
            <button
              className={`stream-settings-option ${source === 'camera' ? 'active' : ''}`}
              onClick={() => onSourceChange('camera')}
            >
              <Camera size={24} />
              <span>Camera</span>
              <small>Use webcam</small>
            </button>
            
            {!isMobile && isWindows && (
              <>
                <button
                  className={`stream-settings-option ${source === 'screen' ? 'active' : ''}`}
                  onClick={() => onSourceChange('screen')}
                >
                  <Monitor size={24} />
                  <span>Screen</span>
                  <small>Share screen</small>
                </button>
                <button
                  className={`stream-settings-option ${source === 'both' ? 'active' : ''}`}
                  onClick={() => onSourceChange('both')}
                >
                  <Radio size={24} />
                  <span>Both</span>
                  <small>Camera + Screen</small>
                </button>
              </>
            )}
          </div>
        </div>

        {isMobile && (
          <div className="stream-settings-note">
            <p>📱 On mobile, only camera streaming is available. Screen sharing is supported on Windows desktop.</p>
          </div>
        )}

        {!isWindows && !isMobile && (
          <div className="stream-settings-note">
            <p>💻 Screen sharing is optimized for Windows. Camera only available on other platforms.</p>
          </div>
        )}

        <div className="stream-settings-group">
          <label>Stream Quality</label>
          <select 
            className="quality-select"
            value={streamQuality}
            onChange={(e) => setStreamQuality(e.target.value)}
          >
            <option value="480p">480p (SD)</option>
            <option value="720p">720p (HD)</option>
            <option value="1080p">1080p (Full HD)</option>
            <option value="4k">4K (Ultra HD)</option>
          </select>
        </div>

        <div className="stream-settings-group">
          <label>Chat Settings</label>
          <div className="setting-item">
            <span>Enable Live Chat</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={enableChat}
                onChange={(e) => setEnableChat(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="setting-item">
            <span>Enable Reactions</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={enableReactions}
                onChange={(e) => setEnableReactions(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <button 
          className="stream-settings-start"
          onClick={handleStartStream}
          disabled={!streamTitle.trim()}
        >
          <Radio size={20} />
          Start Streaming
        </button>
      </div>
    </div>
  );
};

export default StreamSettings;