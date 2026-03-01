// frontend/src/components/calls/EnhancedCallControls.js
import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Settings, Volume2, Activity, Camera, Radio } from 'lucide-react';

const EnhancedCallControls = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onOpenSettings,
  bandwidth,
  streamQuality,
  audioLevel,
  isRecording,
}) => {
  const [showQuality, setShowQuality] = useState(false);

  return (
    <div className="enhanced-call-controls">
      {/* Main Controls */}
      <div className="controls-main">
        <button
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute (Ctrl+M)' : 'Mute (Ctrl+M)'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          {audioLevel > 0 && !isMuted && (
            <div className="audio-level" style={{ height: `${audioLevel * 20}px` }} />
          )}
        </button>

        <button
          className={`control-btn ${isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOff ? 'Turn on video (Ctrl+E)' : 'Turn off video (Ctrl+E)'}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        <button
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          onClick={onToggleScreenShare}
          title="Share screen (Ctrl+Shift+S)"
        >
          <Monitor size={20} />
        </button>

        <button
          className="control-btn settings-btn"
          onClick={onOpenSettings}
          title="Call settings"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Quality & Stats */}
      <div className="controls-quality">
        <button
          className="quality-indicator"
          onClick={() => setShowQuality(!showQuality)}
          title="Connection quality"
        >
          <Activity size={16} />
          <span className={`quality-dot ${bandwidth?.downlink > 5 ? 'good' : bandwidth?.downlink > 2 ? 'fair' : 'poor'}`} />
        </button>

        {showQuality && (
          <div className="quality-popup">
            <div className="quality-item">
              <span>Network:</span>
              <span className="quality-value">{bandwidth?.type || 'unknown'}</span>
            </div>
            <div className="quality-item">
              <span>Speed:</span>
              <span className="quality-value">{bandwidth?.downlink || 0} Mbps</span>
            </div>
            <div className="quality-item">
              <span>Quality:</span>
              <span className="quality-value quality-badge">{streamQuality}</span>
            </div>
            <div className="quality-item">
              <span>Recording:</span>
              <span className={`quality-value ${isRecording ? 'recording' : ''}`}>
                {isRecording ? '🔴 Live' : 'Off'}
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .enhanced-call-controls {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-3) var(--space-4);
          background: var(--glass-bg-strong);
          backdrop-filter: blur(20px);
          border-radius: var(--radius-full);
          border: 1px solid var(--glass-border);
        }

        .controls-main {
          display: flex;
          gap: var(--space-2);
        }

        .control-btn {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .control-btn.active {
          background: var(--primary);
          color: #000;
          border-color: var(--primary);
        }

        .audio-level {
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          background: var(--primary);
          border-radius: 2px;
          transition: height 0.1s ease;
        }

        .controls-quality {
          position: relative;
        }

        .quality-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: rgba(0, 0, 0, 0.3);
          border-radius: var(--radius-full);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
        }

        .quality-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .quality-dot.good {
          background: #4caf50;
          box-shadow: 0 0 10px #4caf50;
        }

        .quality-dot.fair {
          background: #ff9800;
          box-shadow: 0 0 10px #ff9800;
        }

        .quality-dot.poor {
          background: #f44336;
          box-shadow: 0 0 10px #f44336;
        }

        .quality-popup {
          position: absolute;
          bottom: 100%;
          right: 0;
          margin-bottom: var(--space-2);
          background: var(--glass-bg-strong);
          backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          min-width: 200px;
          animation: slideUp var(--transition-fast);
        }

        .quality-item {
          display: flex;
          justify-content: space-between;
          padding: var(--space-1) 0;
          font-size: var(--text-sm);
          color: white;
        }

        .quality-value {
          font-weight: 600;
        }

        .quality-badge {
          text-transform: capitalize;
          color: var(--primary);
        }

        .quality-value.recording {
          color: #f44336;
          animation: pulse 1.5s infinite;
        }

        @media (max-width: 768px) {
          .enhanced-call-controls {
            padding: var(--space-2);
            gap: var(--space-2);
          }

          .control-btn {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedCallControls;