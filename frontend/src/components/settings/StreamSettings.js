import React, { useEffect, useState } from 'react';
import { X, Radio, Monitor, Camera, Globe, Lock } from 'lucide-react';

const StreamSettings = ({ 
  visibility, 
  source, 
  onVisibilityChange, 
  onSourceChange, 
  onSettingsChange,
  onStartStream, 
  onClose,
  isMobile = false,
  isWindows = false
}) => {
  const [streamQuality, setStreamQuality] = useState('1080p');

  const handleStartStream = () => {
    onSettingsChange?.({ quality: streamQuality });
    onStartStream();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onEscape);
    };
  }, [onClose]);

  return (
    <div className="stream-setup-overlay" onClick={onClose}>
      <div className="stream-setup-modal" onClick={(event) => event.stopPropagation()}>
        <div className="stream-setup-header">
          <h3>Stream Settings</h3>
          <button onClick={onClose} aria-label="Close stream settings">
            <X size={20} />
          </button>
        </div>

        <div className="stream-setup-content">
          <div className="stream-setup-group">
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

          <div className="stream-setup-group">
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

          <div className="stream-setup-group">
            <label>Stream Quality</label>
            <select
              className="quality-select"
              value={streamQuality}
              onChange={(e) => setStreamQuality(e.target.value)}
            >
              <option value="Auto">Auto</option>
              <option value="480p">480p (SD)</option>
              <option value="720p">720p (HD)</option>
              <option value="1080p">1080p (Full HD)</option>
              <option value="4K">4K (Ultra HD)</option>
            </select>
          </div>

          <button
            className="stream-settings-start"
            onClick={handleStartStream}
          >
            <Radio size={20} />
            Start Streaming
          </button>
        </div>
      </div>
    </div>
  );
};

export default StreamSettings;