import React, { useState } from 'react';

const CallPanel = ({
  callType,
  callPeer,
  callDuration,
  callStats,
  isRecording,
  qualityIndicator,
  connectionQuality,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isCallMinimized,
  videoEffectSettings,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onApplyEffect,
  onEndCall,
  onToggleMinimize,
  onShowStats,
  localVideoRef,
  remoteVideoRef,
  formatDuration,
  getQualityLabelStyle,
  localStream,
  remoteStream,
  remoteIsScreenSharing,
  isLivestreamViewer,
  livestreamViewerExpanded,
  onToggleLivestreamExpand
}) => {
  const [showEffects, setShowEffects] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  if (!callPeer || !callType) return null;

  // If minimized, show mini indicator
  if (isCallMinimized) {
    return (
      <div className="call-minimized-indicator" onClick={onToggleMinimize}>
        <div className="call-mini-content">
          <span className="call-type-icon">
            {callType === 'video' ? '📹' : '☎️'}
          </span>
          <div className="call-mini-info">
            <div className="call-mini-name">{callPeer}</div>
            <div className="call-mini-timer">{formatDuration(callDuration)}</div>
          </div>
          <div className={`quality-dot ${
            connectionQuality >= 70 ? 'good' : 
            connectionQuality >= 40 ? 'fair' : 'poor'
          }`}></div>
        </div>
      </div>
    );
  }

  const qualityStyle = getQualityLabelStyle(connectionQuality);

  return (
    <div className="call-interface fullscreen">
      <div className="call-video-container">
        
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="remote-video"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Local Video (only for video calls) */}
        {callType === 'video' && localStream && (
          <div className="local-video-shell">
            <div className="local-video-toolbar">
              <span className="local-video-label">You</span>
              <div className="local-video-size-controls">
                <button className="local-video-size-btn" title="Smaller">−</button>
                <button className="local-video-size-btn" title="Larger">+</button>
              </div>
            </div>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="local-video"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}

        {/* Call Info Overlay */}
        <div className="call-info-overlay">
          <div className="call-info-top">
            <div className="call-peer-name">
              {callType === 'video' ? '📹' : '☎️'} {callPeer}
              {remoteIsScreenSharing && (
                <span className="screen-share-badge">📺 Sharing Screen</span>
              )}
            </div>
            <div className="call-duration">{formatDuration(callDuration)}</div>
          </div>
          
          <div className="call-status-badges">
            {isRecording && (
              <span className="call-status-badge">🔴 Recording</span>
            )}
            {isScreenSharing && (
              <span className="local-screen-share-indicator">
                <span className="screen-share-pulse"></span>
                Sharing Screen
              </span>
            )}
            {connectionQuality && (
              <span className={`quality-badge ${connectionQuality.toLowerCase()}`}>
                {connectionQuality}
              </span>
            )}
          </div>
        </div>

        {/* Audio-only view */}
        {callType === 'voice' && (
          <div className="audio-call-view">
            <div className="avatar-large">☎️</div>
            <div className="audio-call-info">
              <h3>{callPeer}</h3>
              <p className="call-status">Active call</p>
              <div className="audio-waveform">
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Display */}
        {callStats && (
          <div className="call-stats-bar">
            <div className="stat-item">
              <span className="stat-label">Latency</span>
              <span className="stat-value">{Math.round(callStats.latency || 0)}ms</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Packet Loss</span>
              <span className="stat-value">{(callStats.packetLoss || 0).toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Bitrate</span>
              <span className="stat-value">{Math.round(callStats.videoBitrate || 0)} kbps</span>
            </div>
          </div>
        )}

        {/* Control Bar */}
        <div className="call-controls">
          {/* Mute Button */}
          <button
            className={`call-control-btn ${isMuted ? 'active' : ''}`}
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {/* Video Button */}
          {callType === 'video' && (
            <button
              className={`call-control-btn ${isVideoOff ? 'active' : ''}`}
              onClick={onToggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📹❌' : '📹'}
            </button>
          )}

          {/* Screen Share Button */}
          {callType === 'video' && (
            <button
              className={`call-control-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={onToggleScreenShare}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              🖥️
            </button>
          )}

          {/* Recording Button */}
          <button
            className={`call-control-btn ${isRecording ? 'active' : ''}`}
            onClick={onToggleRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? '🔴' : '⏺️'}
          </button>

          {/* Effects Button */}
          {callType === 'video' && (
            <button
              className="call-control-btn"
              onClick={() => setShowEffects(!showEffects)}
              title="Video effects"
            >
              🎨
            </button>
          )}

          {/* More Options */}
          <button
            className="call-control-btn"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            title="More options"
          >
            ⋯
          </button>

          {/* Minimize Button */}
          <button
            className="call-control-btn minimize-btn"
            onClick={onToggleMinimize}
            title="Minimize"
          >
            ➖
          </button>

          {/* End Call Button */}
          <button
            className="call-control-btn end-call-btn"
            onClick={onEndCall}
            title="End call"
          >
            📴
          </button>
        </div>

        {/* Effects Panel */}
        {showEffects && callType === 'video' && (
          <div className="call-effects-panel">
            <h4>Video Effects</h4>
            <div className="effect-group">
              <label>
                <span>Brightness</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={videoEffectSettings?.brightness || 100}
                  onChange={(e) => onApplyEffect('brightness', parseInt(e.target.value))}
                />
                <span>{videoEffectSettings?.brightness || 100}%</span>
              </label>
            </div>
            <div className="effect-group">
              <label>
                <span>Contrast</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={videoEffectSettings?.contrast || 100}
                  onChange={(e) => onApplyEffect('contrast', parseInt(e.target.value))}
                />
                <span>{videoEffectSettings?.contrast || 100}%</span>
              </label>
            </div>
            <div className="effect-group">
              <label>
                <span>Saturation</span>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={videoEffectSettings?.saturation || 100}
                  onChange={(e) => onApplyEffect('saturation', parseInt(e.target.value))}
                />
                <span>{videoEffectSettings?.saturation || 100}%</span>
              </label>
            </div>
            <div className="effect-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={videoEffectSettings?.blur || false}
                  onChange={(e) => onApplyEffect('blur', e.target.checked)}
                />
                Background Blur
              </label>
            </div>
            <button 
              className="btn-reset-effects" 
              onClick={() => {
                onApplyEffect('brightness', 100);
                onApplyEffect('contrast', 100);
                onApplyEffect('saturation', 100);
                onApplyEffect('blur', false);
              }}
            >
              Reset Effects
            </button>
          </div>
        )}

        {/* More Options Panel */}
        {showMoreOptions && (
          <div className="call-options-panel">
            <div className="option-item">
              <span>Auto-record calls</span>
              <input
                type="checkbox"
                checked={localStorage.getItem('autoRecordCalls') === 'true'}
                onChange={(e) => {
                  localStorage.setItem('autoRecordCalls', e.target.checked);
                }}
              />
            </div>
            <div className="option-item">
              <span>Connection Quality</span>
              <span className="info-text">{connectionQuality || 'Unknown'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallPanel;