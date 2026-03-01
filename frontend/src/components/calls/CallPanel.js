// CallPanel.js - WhatsApp-style call interface
import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, 
  Maximize2, Minimize2, Users, Settings, Volume2, 
  VolumeX, Radio, Disc3, BarChart3, X, ChevronUp,
  Camera, ScreenShare, ScreenShareOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CallPanel = ({
  callType,
  callPeer,
  callDuration,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isCallMinimized,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onToggleMinimize,
  localVideoRef,
  remoteVideoRef,
  formatDuration,
  localStream,
  remoteStream,
  remoteIsScreenSharing
}) => {
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  const [audioOutputDevice, setAudioOutputDevice] = useState('default');
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [participants, setParticipants] = useState([]);
  const localVideoContainerRef = useRef(null);
  const statsIntervalRef = useRef(null);

  // Auto-hide controls
  useEffect(() => {
    const resetTimeout = () => {
      setShowControls(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      const timeout = setTimeout(() => setShowControls(false), 3000);
      setControlsTimeout(timeout);
    };

    resetTimeout();
    return () => {
      if (controlsTimeout) clearTimeout(controlsTimeout);
    };
  }, []);

  // Monitor call stats
  useEffect(() => {
    if (!showStats) return;

    statsIntervalRef.current = setInterval(() => {
      if (remoteStream) {
        const videoTracks = remoteStream.getVideoTracks();
        const audioTracks = remoteStream.getAudioTracks();
        
        setStats({
          video: videoTracks.length > 0,
          audio: audioTracks.length > 0,
          videoSettings: videoTracks[0]?.getSettings(),
          audioSettings: audioTracks[0]?.getSettings(),
          timestamp: new Date().toLocaleTimeString()
        });
      }
    }, 1000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [showStats, remoteStream]);

  // Handle audio output device
  useEffect(() => {
    if (remoteVideoRef.current && audioOutputDevice !== 'default') {
      remoteVideoRef.current.setSinkId?.(audioOutputDevice).catch(console.warn);
    }
  }, [audioOutputDevice, remoteVideoRef]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isCallMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="call-minimized"
        onClick={onToggleMinimize}
      >
        <div className="minimized-content">
          <div className="minimized-indicator">
            {callType === 'video' ? <Video size={16} /> : <Phone size={16} />}
          </div>
          <div className="minimized-info">
            <span className="minimized-peer">{callPeer}</span>
            <span className="minimized-time">{formatTime(callDuration)}</span>
          </div>
        </div>
        <button className="minimized-end-call" onClick={(e) => { e.stopPropagation(); onEndCall(); }}>
          <PhoneOff size={14} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="call-container"
      onMouseMove={() => {
        setShowControls(true);
        if (controlsTimeout) clearTimeout(controlsTimeout);
        const timeout = setTimeout(() => setShowControls(false), 3000);
        setControlsTimeout(timeout);
      }}
    >
      {/* Remote Video (full screen) */}
      <video
        ref={remoteVideoRef}
        className={`remote-video ${remoteIsScreenSharing ? 'screen-share' : ''}`}
        autoPlay
        playsInline
      />

      {/* Local Video (picture-in-picture) */}
      {callType === 'video' && localStream && (
        <div
          ref={localVideoContainerRef}
          className="local-video-container"
          style={{
            width: isScreenSharing ? 200 : 140,
            height: isScreenSharing ? 150 : 105
          }}
        >
          <video
            ref={localVideoRef}
            className="local-video"
            autoPlay
            playsInline
            muted
          />
          {isVideoOff && (
            <div className="local-video-off">
              <Camera size={24} />
            </div>
          )}
          {isScreenSharing && (
            <div className="screen-share-badge">
              <Monitor size={12} />
              <span>Screen</span>
            </div>
          )}
        </div>
      )}

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="call-controls-overlay"
          >
            {/* Top Bar */}
            <div className="call-top-bar">
              <div className="call-info">
                <span className="call-peer">{callPeer}</span>
                <span className="call-duration">{formatTime(callDuration)}</span>
                {remoteIsScreenSharing && (
                  <span className="screen-share-indicator">
                    <Monitor size={14} />
                    Viewing screen
                  </span>
                )}
              </div>
              <div className="call-top-actions">
                <button
                  className="call-action-btn small"
                  onClick={() => setShowStats(!showStats)}
                  title="Call statistics"
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  className="call-action-btn small"
                  onClick={onToggleMinimize}
                  title="Minimize"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="call-bottom-controls">
              <div className="call-controls-group">
                <button
                  className={`call-control-btn ${isMuted ? 'active' : ''}`}
                  onClick={onToggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {callType === 'video' && (
                  <>
                    <button
                      className={`call-control-btn ${isVideoOff ? 'active' : ''}`}
                      onClick={onToggleVideo}
                      title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    >
                      {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>

                    <button
                      className={`call-control-btn ${isScreenSharing ? 'active' : ''}`}
                      onClick={onToggleScreenShare}
                      title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                      disabled={callType !== 'video'}
                    >
                      {isScreenSharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}
                    </button>
                  </>
                )}

                <button
                  className="call-control-btn end-call"
                  onClick={onEndCall}
                  title="End call"
                >
                  <PhoneOff size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Statistics Panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="call-stats-panel"
          >
            <div className="stats-header">
              <h4>Call Statistics</h4>
              <button onClick={() => setShowStats(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="stats-content">
              <div className="stat-row">
                <span>Peer:</span>
                <span>{callPeer}</span>
              </div>
              <div className="stat-row">
                <span>Duration:</span>
                <span>{formatTime(callDuration)}</span>
              </div>
              <div className="stat-row">
                <span>Type:</span>
                <span className="stat-badge">{callType === 'video' ? '📹 Video' : '🎤 Voice'}</span>
              </div>
              {stats && (
                <>
                  <div className="stat-divider" />
                  <div className="stat-row">
                    <span>Video:</span>
                    <span>{stats.video ? '✅ Active' : '❌ Inactive'}</span>
                  </div>
                  <div className="stat-row">
                    <span>Audio:</span>
                    <span>{stats.audio ? '✅ Active' : '❌ Inactive'}</span>
                  </div>
                  {stats.videoSettings && (
                    <>
                      <div className="stat-row">
                        <span>Resolution:</span>
                        <span>{stats.videoSettings.width}×{stats.videoSettings.height}</span>
                      </div>
                      <div className="stat-row">
                        <span>Frame rate:</span>
                        <span>{stats.videoSettings.frameRate || '?'} fps</span>
                      </div>
                    </>
                  )}
                  <div className="stat-row">
                    <span>Last update:</span>
                    <span>{stats.timestamp}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Remote Video Placeholder */}
      {callType === 'video' && (!remoteStream || remoteStream.getVideoTracks().length === 0) && (
        <div className="no-remote-video">
          <Video size={48} />
          <span>Waiting for {callPeer} to turn on video...</span>
        </div>
      )}

      {/* Audio-only Mode */}
      {callType === 'voice' && (
        <div className="voice-call-container">
          <div className="voice-call-avatar">
            <div className="avatar-large">
              {callPeer.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="voice-call-info">
            <h2>{callPeer}</h2>
            <span className="call-duration-large">{formatTime(callDuration)}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CallPanel;