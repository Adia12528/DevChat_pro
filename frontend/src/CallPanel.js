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
  // Removed effects and more options state for simplified controls

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
        </div>
      </div>
    );
  }

  // Remove quality style for simplified UI

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
            </div>
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

        {/* No stats bar in simplified UI */}

        {/* Control Bar */}
        <div className="call-controls">
          {/* Mute/Unmute */}
          <button
            className={`call-btn ${isMuted ? 'muted' : ''}`}
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {/* Video On/Off (only for video calls) */}
          {callType === 'video' && (
            <>
              <button
                className={`call-btn ${isVideoOff ? 'video-off' : ''}`}
                onClick={onToggleVideo}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? '📹️' : '📹'}
              </button>
              {/* Share Screen */}
              <button
                className={`call-btn ${isScreenSharing ? 'screen-active' : ''}`}
                onClick={onToggleScreenShare}
                title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
              >
                {isScreenSharing ? '🖥️' : '🖥️'}
              </button>
            </>
          )}

          {/* End Call */}
          <button
            className="call-btn end-btn"
            onClick={onEndCall}
            title="End call"
          >
            ☐
          </button>
        </div>

        {/* No effects panel in simplified UI */}

        {/* No more options panel in simplified UI */}
      </div>
    </div>
  );
};

export default CallPanel;
