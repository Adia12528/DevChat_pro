import React, { useState, useEffect, useRef, useMemo } from 'react';

import { 
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, 
  Maximize2, Minimize2, Users, Settings, Volume2, 
  VolumeX, MessageSquare, Share2, ScreenShare, 
  ScreenShareOff, Grid, PieChart, Circle, MoreVertical,
  Bluetooth, Wifi, WifiOff, Battery, Clock, X,
  ChevronUp, ChevronDown, Camera, CameraOff,
  Sparkles, BarChart3, Download, Radio
  , RefreshCw
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
  remoteIsScreenSharing,
  connectionQuality = 'excellent',
  participants = [],
  cameraDevices = [],
  selectedCameraId = '',
  onCameraChange,
  onRefreshCameraDevices,
  isRefreshingCameras = false,
  cameraStatusToast = null,
  selectedVideoQuality = 'Auto',
  onVideoQualityChange,
  audioSettings,
  onAudioSettingChange,
}) => {

  // Ensure local and remote video elements always update srcObject
  useEffect(() => {
    if (localVideoRef && localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (remoteVideoRef && remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, remoteVideoRef]);
  // Ref for remote audio element
  const remoteAudioRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [layout, setLayout] = useState('grid');
  const [videoQuality, setVideoQuality] = useState(selectedVideoQuality || 'Auto');
  const [audioLevel, setAudioLevel] = useState(0);
  const audioAnalyserRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);

  const isPerformanceLite = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const lowCoreDevice = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency <= 4
      : false;
    return Boolean(prefersReducedMotion || lowCoreDevice);
  }, []);

  const networkStats = useMemo(() => {
    switch (connectionQuality) {
      case 'excellent':
        return { bitrate: 2200, packetLoss: 0.1, latency: 22 };
      case 'good':
        return { bitrate: 1600, packetLoss: 0.4, latency: 38 };
      case 'fair':
        return { bitrate: 1050, packetLoss: 0.9, latency: 56 };
      case 'poor':
        return { bitrate: 620, packetLoss: 1.8, latency: 95 };
      default:
        return { bitrate: 450, packetLoss: 2.5, latency: 130 };
    }
  }, [connectionQuality]);

  const qualityOptions = useMemo(() => ([
    { label: 'Auto', value: 'Auto' },
    { label: 'HD', value: '720p' },
    { label: 'Full HD', value: '1080p' },
    { label: '4K', value: '4K' }
  ]), []);

  useEffect(() => {
    if (selectedVideoQuality && selectedVideoQuality !== videoQuality) {
      setVideoQuality(selectedVideoQuality);
    }
  }, [selectedVideoQuality, videoQuality]);

  const videoQualityLabel = useMemo(() => {
    const active = qualityOptions.find((option) => option.value === videoQuality);
    return active?.label || 'Auto';
  }, [qualityOptions, videoQuality]);

  const handleVideoQualitySelect = (qualityValue) => {
    setVideoQuality(qualityValue);
    onVideoQualityChange?.(qualityValue);
  };

  useEffect(() => {
    if (localStream && !isMuted) {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);
      analyser.fftSize = 256;
      audioAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
        }
      };
      
      updateAudioLevel();
      audioLevelIntervalRef.current = setInterval(updateAudioLevel, isPerformanceLite ? 240 : 140);
      
      return () => {
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
          audioLevelIntervalRef.current = null;
        }
        setAudioLevel(0);
        audioContext.close();
      };
    }
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, [localStream, isMuted, isPerformanceLite]);

  useEffect(() => () => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
  }, []);

  const getQualityColor = () => {
    switch(connectionQuality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FFC107';
      case 'poor': return '#FF9800';
      default: return '#F44336';
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Ensure remote audio is always played (fixes mobile voice issue)
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

  if (isCallMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="modern-call-minimized"
        onClick={onToggleMinimize}
      >
        <div className="minimized-preview">
          {callType === 'video' && remoteStream ? (
            <video 
              ref={remoteVideoRef} 
              className="minimized-video"
              autoPlay 
              playsInline 
              muted
            />
          ) : (
            <div className="minimized-avatar">
              {callPeer?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="minimized-status">
            <div className="status-dot" style={{ backgroundColor: getQualityColor() }} />
          </div>
        </div>
        <div className="minimized-info">
          <span className="minimized-peer">{callPeer}</span>
          <span className="minimized-time">{formatTime(callDuration)}</span>
        </div>
        <div className="minimized-actions">
          <button className="minimized-action" onClick={(e) => { e.stopPropagation(); onToggleMute(); }}>
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button className="minimized-action end" onClick={(e) => { e.stopPropagation(); onEndCall(); }}>
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Hidden audio element for remote audio playback (mobile fix) */}
      {remoteStream && (
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />
      )}
    <motion.div 
      className={`modern-call-container ${isPerformanceLite ? 'performance-lite' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="call-background-gradient" />

      <div className={`video-grid ${layout}`}>
        <div className="video-wrapper remote">
          {callType === 'video' && remoteStream ? (
            <video 
              ref={remoteVideoRef}
              className={`remote-video ${remoteIsScreenSharing ? 'screen-share' : ''}`}
              autoPlay 
              playsInline
            />
          ) : (
            <div className="video-placeholder">
              <div className="placeholder-avatar">
                {callPeer?.charAt(0).toUpperCase()}
              </div>
              <div className="placeholder-name">{callPeer}</div>
              <div className="placeholder-status">Waiting for video...</div>
            </div>
          )}
          
          <div className="video-overlay top-left">
            <span className="user-badge">
              <Circle size={8} fill={getQualityColor()} color={getQualityColor()} />
              {callPeer}
              {remoteIsScreenSharing && <span className="screen-badge">📺 Sharing Screen</span>}
            </span>
          </div>

          <div className="video-overlay top-right stats">
            <div className="stat-item">
              <Wifi size={14} color={getQualityColor()} />
              <span>{networkStats.bitrate} kbps</span>
            </div>
            <div className="stat-item">
              <Clock size={14} />
              <span>{networkStats.latency} ms</span>
            </div>
          </div>

          <div className="video-overlay bottom-left">
            <span className="duration-badge">
              {formatTime(callDuration)}
            </span>
          </div>
        </div>

        {callType === 'video' && (
          <div className="video-wrapper local">
            <video 
              ref={localVideoRef}
              className={`local-video ${isVideoOff ? 'hidden' : ''}`}
              autoPlay 
              playsInline 
              muted
            />
            {isVideoOff && (
              <div className="local-video-off">
                <CameraOff size={24} />
                <span>Camera Off</span>
              </div>
            )}
            
            {!isMuted && (
              <div className="audio-level">
                <div className="audio-level-bar" style={{ height: `${audioLevel * 100}%` }} />
              </div>
            )}

            <div className="video-overlay bottom">
              <span className="user-badge local">
                You
                {isMuted && <MicOff size={12} />}
              </span>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            className="modern-call-controls"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            <div className="controls-top">
              <div className="call-info-left">
                <div className="call-quality">
                  <div className="quality-dot" style={{ backgroundColor: getQualityColor() }} />
                  <span>{connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)} Connection</span>
                </div>
                <div className="call-timer">
                  <Clock size={16} />
                  <span>{formatTime(callDuration)}</span>
                </div>
              </div>

              <div className="call-info-right">
                <button className="control-btn icon" onClick={() => setLayout('grid')} title="Grid Layout">
                  <Grid size={18} />
                </button>
                <button className="control-btn icon" onClick={() => setLayout('spotlight')} title="Spotlight">
                  <PieChart size={18} />
                </button>
                <button className="control-btn icon" onClick={() => setShowParticipants(!showParticipants)} title="Participants">
                  <Users size={18} />
                  {participants.length > 0 && (
                    <span className="badge">{participants.length}</span>
                  )}
                </button>
                <button className="control-btn icon" onClick={() => setShowChat(!showChat)} title="Chat">
                  <MessageSquare size={18} />
                </button>
                <button className="control-btn icon" onClick={() => setShowSettings(!showSettings)} title="Settings">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="controls-center">
              <div className="main-controls-group">
                <button 
                  className={`main-control ${isMuted ? 'active' : ''}`}
                  onClick={onToggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <div className="control-icon">
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </div>
                  <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                {callType === 'video' && (
                  <button 
                    className={`main-control ${isVideoOff ? 'active' : ''}`}
                    onClick={onToggleVideo}
                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    <div className="control-icon">
                      {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </div>
                    <span className="control-label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
                  </button>
                )}

                {callType === 'video' && (
                  <button 
                    className={`main-control ${isScreenSharing ? 'active' : ''}`}
                    onClick={onToggleScreenShare}
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                  >
                    <div className="control-icon">
                      {isScreenSharing ? <ScreenShareOff size={24} /> : <MonitorUp size={24} />}
                    </div>
                    <span className="control-label">{isScreenSharing ? 'Stop Share' : 'Share'}</span>
                  </button>
                )}

                <button 
                  className="main-control end-call"
                  onClick={onEndCall}
                  title="End call"
                >
                  <div className="control-icon">
                    <PhoneOff size={24} />
                  </div>
                  <span className="control-label">Leave</span>
                </button>
              </div>
            </div>

            <div className="controls-bottom">
              <div className="bottom-left">
                <div className="device-status">
                  <span className={`device-indicator ${isMuted ? 'muted' : ''}`}>
                    {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                    {isMuted ? 'Muted' : 'Live'}
                  </span>
                  {callType === 'video' && (
                    <span className={`device-indicator ${isVideoOff ? 'off' : ''}`}>
                      {isVideoOff ? <CameraOff size={14} /> : <Camera size={14} />}
                      {isVideoOff ? 'Camera Off' : 'Camera On'}
                    </span>
                  )}
                </div>
              </div>

              <div className="bottom-center">
                <button className="control-btn small" onClick={onToggleMinimize} title="Minimize">
                  <Minimize2 size={16} />
                </button>
              </div>

              <div className="bottom-right">
                <div className="connection-badge">
                  <Wifi size={14} color={getQualityColor()} />
                  <span>{videoQualityLabel}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showParticipants && (
          <motion.div 
            className="call-sidebar participants-panel"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div className="sidebar-header">
              <h3>Participants ({participants.length})</h3>
              <button onClick={() => setShowParticipants(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="sidebar-content">
              {participants.map((p, i) => (
                <div key={i} className="participant-item">
                  <div className="participant-avatar">
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">{p.name}</span>
                    {p.isMuted && <MicOff size={14} className="muted-icon" />}
                  </div>
                  {p.isSpeaking && <div className="speaking-indicator" />}
                </div>
              ))}
              <div className="participant-item you">
                <div className="participant-avatar">You</div>
                <div className="participant-info">
                  <span className="participant-name">You</span>
                  {isMuted && <MicOff size={14} className="muted-icon" />}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {showChat && (
          <motion.div 
            className="call-sidebar chat-panel"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div className="sidebar-header">
              <h3>Chat</h3>
              <button onClick={() => setShowChat(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="sidebar-content chat-content">
              <div className="chat-messages">
                <div className="chat-placeholder">No messages yet</div>
              </div>
              <div className="chat-input">
                <input type="text" placeholder="Type a message..." />
                <button>Send</button>
              </div>
            </div>
          </motion.div>
        )}

        {showSettings && (
          <motion.div 
            className="call-sidebar settings-panel"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div className="sidebar-header">
              <h3>Settings</h3>
              <button onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="sidebar-content">
              <div className="settings-section">
                <h4>Video Quality</h4>
                <div className="quality-options">
                  {qualityOptions.map(({ label, value }) => (
                    <button 
                      key={value}
                      className={`quality-option ${videoQuality === value ? 'active' : ''}`}
                      onClick={() => handleVideoQualitySelect(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {callType === 'video' && (
                <div className="settings-section">
                  <h4>Camera Device</h4>
                  {cameraStatusToast?.message && (
                    <div className={`call-camera-toast ${cameraStatusToast.type === 'error' ? 'error' : cameraStatusToast.type === 'info' ? 'info' : 'success'}`} role="status" aria-live="polite">
                      {cameraStatusToast.message}
                    </div>
                  )}
                  <div className="call-camera-selector">
                    <select
                      value={selectedCameraId || 'default'}
                      onChange={(event) => onCameraChange?.(event.target.value)}
                    >
                      <option value="default">System Default</option>
                      {cameraDevices.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="call-camera-refresh"
                      onClick={() => onRefreshCameraDevices?.()}
                      title="Refresh cameras"
                      aria-label="Refresh cameras"
                    >
                      <RefreshCw size={14} className={isRefreshingCameras ? 'spin' : ''} />
                    </button>
                  </div>
                </div>
              )}
              <div className="settings-section">
                <h4>Audio</h4>
                <div className="setting-item">
                  <span>Noise Cancellation</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={audioSettings?.noiseSuppression !== false}
                      onChange={(event) => onAudioSettingChange?.('noiseSuppression', event.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="setting-item">
                  <span>Echo Cancellation</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={audioSettings?.echoCancellation !== false}
                      onChange={(event) => onAudioSettingChange?.('echoCancellation', event.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="setting-item">
                  <span>Auto Gain Control</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={audioSettings?.autoGainControl !== false}
                      onChange={(event) => onAudioSettingChange?.('autoGainControl', event.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
              <div className="settings-section">
                <h4>Layout</h4>
                <div className="layout-options">
                  <button className={`layout-option ${layout === 'grid' ? 'active' : ''}`} onClick={() => setLayout('grid')}>
                    <Grid size={20} />
                    <span>Grid</span>
                  </button>
                  <button className={`layout-option ${layout === 'spotlight' ? 'active' : ''}`} onClick={() => setLayout('spotlight')}>
                    <PieChart size={20} />
                    <span>Spotlight</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
};

export default CallPanel;