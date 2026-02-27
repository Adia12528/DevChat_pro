import React, { useState } from 'react';

/**
 * CallPanel - Premium call UI component
 * Displays active call interface with stats, recording, and quality indicators
 */
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
  remoteStream
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
            <div className="call-peer-name">{callPeer}</div>
            <div className="call-timer">{formatDuration(callDuration)}</div>
          </div>
          <div className={`quality-dot ${connectionQuality >= 70 ? 'good' : connectionQuality >= 40 ? 'fair' : 'poor'}`}></div>
        </div>
      </div>
    );
  }

  const qualityStyle = getQualityLabelStyle(connectionQuality);

  return (
    <div className="call-panel-container">
      <div className="call-panel">
        {/* Header */}
        <div className="call-header">
          <div className="call-info">
            <h2 className="call-peer-name">
              {callType === 'video' ? '📹' : '☎️'} {callPeer}
            </h2>
            <div className="call-details">
              <span className="call-duration">{formatDuration(callDuration)}</span>
              <span className="quality-badge" style={{ backgroundColor: qualityStyle.color }}>
                {qualityStyle.label}
              </span>
              {isRecording && <span className="recording-badge">🎙️ Recording</span>}
            </div>
          </div>
          <div className="call-actions">
            <button
              className="call-btn stats-btn"
              onClick={onShowStats}
              title="Show Call Stats"
            >
              📊
            </button>
            <button
              className="call-btn minimize-btn"
              onClick={onToggleMinimize}
              title="Minimize Call"
            >
              ➖
            </button>
          </div>
        </div>

        {/* Video Display */}
        {callType === 'video' && (
          <div className="video-container">
            <div className="video-grid">
              <div className="video-wrapper remote">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="video-element"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="video-label">Remote</div>
              </div>
              <div className="video-wrapper local">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="video-element"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="video-label">You</div>
                {isVideoOff && <div className="video-off-overlay">📹 Camera Off</div>}
              </div>
            </div>
          </div>
        )}

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
              <span className="stat-label">Latency:</span>
              <span className="stat-value">{Math.round(callStats.latency || 0)}ms</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Packets Lost:</span>
              <span className="stat-value">{(callStats.packetLoss || 0).toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Video FPS:</span>
              <span className="stat-value">{Math.round(callStats.videoBitrate || 0)} kbps</span>
            </div>
          </div>
        )}

        {/* Control Bar */}
        <div className="call-controls">
          {/* Basic controls */}
          <button
            className={`call-btn ${isMuted ? 'muted' : ''}`}
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇 Muted' : '🎤 Mute'}
          </button>

          {callType === 'video' && (
            <button
              className={`call-btn ${isVideoOff ? 'video-off' : ''}`}
              onClick={onToggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📹️ Off' : '📹 Video'}
            </button>
          )}

          {callType === 'video' && (
            <button
              className={`call-btn ${isScreenSharing ? 'screen-active' : ''}`}
              onClick={onToggleScreenShare}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              {isScreenSharing ? '🖥️ Sharing' : '🖥️ Share'}
            </button>
          )}

          {/* Recording Button */}
          <button
            className={`call-btn ${isRecording ? 'recording' : ''}`}
            onClick={onToggleRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? '🔴 Recording' : '⭕ Record'}
          </button>

          {/* Effects Button */}
          {callType === 'video' && (
            <button
              className="call-btn"
              onClick={() => setShowEffects(!showEffects)}
              title="Video effects"
            >
              🎨 Effects
            </button>
          )}

          {/* More Options */}
          <button
            className="call-btn"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            title="More options"
          >
            ⋯
          </button>

          {/* End Call */}
          <button
            className="call-btn end-btn"
            onClick={onEndCall}
            title="End call"
          >
            ☐ End
          </button>
        </div>

        {/* Effects Panel */}
        {showEffects && callType === 'video' && (
          <div className="call-effects-panel">
            <h4>Video Effects</h4>
            <div className="effect-group">
              <label>
                <span>Brightness:</span>
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
                <span>Contrast:</span>
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
                <span>Saturation:</span>
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
            <button className="btn-reset-effects" onClick={() => {
              onApplyEffect('brightness', 100);
              onApplyEffect('contrast', 100);
              onApplyEffect('saturation', 100);
              onApplyEffect('blur', false);
            }}>
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
              <span>Network Stats</span>
              <span className="info-text">
                {callStats
                  ? `Latency: ${Math.round(callStats.latency || 0)}ms | Loss: ${(callStats.packetLoss || 0).toFixed(1)}%`
                  : 'Not available'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallPanel;
