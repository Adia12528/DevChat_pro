import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Users, MessageSquare, Heart, ThumbsUp, 
  Share2, Settings, Mic, MicOff, Camera, CameraOff,
  MonitorUp, ScreenShareOff, X,
  Clock, Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/index.css';

const ModernStreamPanel = ({
  isHost,
  stream,
  streamSource,
  isMuted,
  isVideoOff,
  viewerCount,
  onToggleMute,
  onToggleVideo,
  onEndStream,
  onSwitchSource,
  streamTitle = "Untitled Stream",
  streamerName,
  streamThumbnail,
  viewers = [],
  chatMessages = [],
  onSendChat,
  onReact,
  streamQuality = '1080p',
  streamDuration = 0,
  likes = 0,
  shares = 0,
  onSettingsChange,
  cameraDevices = [],
  selectedCameraId = '',
  microphoneDevices = [],
  selectedMicrophoneId = 'default',
  audioOutputDevices = [],
  selectedAudioOutput = 'default',
  streamSettings
}) => {
  const [showChat, setShowChat] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [layout, setLayout] = useState('cinema');
  const [reactions, setReactions] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(streamSettings?.quality || streamQuality || '1080p');
  const [selectedMicrophone, setSelectedMicrophone] = useState(selectedMicrophoneId || streamSettings?.microphoneId || 'default');
  const [selectedCamera, setSelectedCamera] = useState(selectedCameraId || 'default');
  const [selectedSpeaker, setSelectedSpeaker] = useState(selectedAudioOutput || 'default');
  const [noiseSuppression, setNoiseSuppression] = useState(streamSettings?.noiseSuppression ?? true);
  const [slowMode, setSlowMode] = useState(streamSettings?.slowMode ?? false);
  const [subOnlyMode, setSubOnlyMode] = useState(streamSettings?.subOnlyMode ?? false);
  const [fallbackCameraDevices, setFallbackCameraDevices] = useState([]);
  const [fallbackMicrophoneDevices, setFallbackMicrophoneDevices] = useState([]);
  const [fallbackAudioOutputs, setFallbackAudioOutputs] = useState([]);
  const streamVideoRef = useRef(null);

  useEffect(() => {
    if (!streamVideoRef.current) return;
    if (stream) {
      streamVideoRef.current.srcObject = stream;
      const playPromise = streamVideoRef.current.play?.();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      streamVideoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    setSelectedQuality(streamQuality || '1080p');
  }, [streamQuality]);

  useEffect(() => {
    if (!streamSettings) return;
    setSelectedQuality(streamSettings.quality || streamQuality || '1080p');
    setSelectedMicrophone(streamSettings.microphoneId || selectedMicrophoneId || 'default');
    setNoiseSuppression(streamSettings.noiseSuppression ?? true);
    setSlowMode(streamSettings.slowMode ?? false);
    setSubOnlyMode(streamSettings.subOnlyMode ?? false);
  }, [streamSettings, streamQuality, selectedMicrophoneId]);

  useEffect(() => {
    setSelectedCamera(selectedCameraId || 'default');
  }, [selectedCameraId]);

  useEffect(() => {
    setSelectedSpeaker(selectedAudioOutput || 'default');
  }, [selectedAudioOutput]);

  useEffect(() => {
    setSelectedMicrophone(selectedMicrophoneId || 'default');
  }, [selectedMicrophoneId]);

  useEffect(() => {
    const loadDeviceOptions = async () => {
      if (!showSettings || !navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices
          .filter((device) => device.kind === 'videoinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `External Camera ${index + 1}`
          }));
        const microphones = devices
          .filter((device) => device.kind === 'audioinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `External Microphone ${index + 1}`
          }));
        const outputs = devices
          .filter((device) => device.kind === 'audiooutput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `External Speaker ${index + 1}`
          }));
        setFallbackCameraDevices(cameras);
        setFallbackMicrophoneDevices(microphones);
        setFallbackAudioOutputs(outputs);
      } catch (error) {
        setFallbackCameraDevices([]);
        setFallbackMicrophoneDevices([]);
        setFallbackAudioOutputs([]);
      }
    };

    loadDeviceOptions();
  }, [showSettings]);

  useEffect(() => {
    const mediaElement = streamVideoRef.current;
    if (!mediaElement || typeof mediaElement.setSinkId !== 'function') return;
    mediaElement.setSinkId(selectedSpeaker || 'default').catch(() => {});
  }, [selectedSpeaker, stream]);

  const availableCameraOptions = [
    { deviceId: 'default', label: 'Default Camera' },
    ...(cameraDevices.length > 0 ? cameraDevices : fallbackCameraDevices).filter((device) => !!device?.deviceId)
  ];

  const availableSpeakerOptions = [
    { deviceId: 'default', label: 'Default Speaker' },
    ...(audioOutputDevices.length > 0 ? audioOutputDevices : fallbackAudioOutputs).filter((device) => !!device?.deviceId)
  ];

  const availableMicrophoneOptions = [
    { deviceId: 'default', label: 'Default Microphone' },
    ...(microphoneDevices.length > 0 ? microphoneDevices : fallbackMicrophoneDevices).filter((device) => !!device?.deviceId)
  ];

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      onSendChat?.(chatMessage);
      setChatMessage('');
    }
  };

  const handleReaction = (emoji) => {
    const reactionId = Date.now() + Math.random();
    setReactions(prev => [...prev, { emoji, id: reactionId }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 3000);
    onReact?.(emoji);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  const applySettings = () => {
    onSettingsChange?.({
      quality: selectedQuality,
      microphoneId: selectedMicrophone,
      cameraId: selectedCamera,
      audioOutput: selectedSpeaker,
      noiseSuppression,
      slowMode,
      subOnlyMode
    });
    closeSettings();
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && showSettings) {
        closeSettings();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showSettings]);

  return (
    <motion.div 
      className={`modern-stream-container ${layout} ${isSidebarOpen ? 'with-sidebar' : 'no-sidebar'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="stream-background-gradient" />

      <div className="stream-video-area">
        <div className="stream-video-wrapper">
          <div className="stream-video-feed">
            {stream ? (
              <video ref={streamVideoRef} className="stream-video" autoPlay muted={isHost} playsInline />
            ) : isHost ? (
              <div className="video-placeholder">
                <div className="placeholder-avatar">
                  {streamerName?.charAt(0).toUpperCase() || 'L'}
                </div>
                <div className="placeholder-name">Preparing Stream...</div>
                <div className="placeholder-status">Waiting for media input</div>
              </div>
            ) : (
              <img 
                src={streamThumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1280"} 
                alt="Stream" 
                className="stream-video"
              />
            )}
            
            <div className="stream-overlay top">
              <div className="stream-info-left">
                <div className="stream-badge live">
                  <Radio size={16} />
                  <span>LIVE</span>
                </div>
                <div className="stream-title">{streamTitle}</div>
                <div className="streamer-info">
                  <div className="streamer-avatar">
                    {streamerName?.charAt(0).toUpperCase()}
                  </div>
                  <span className="streamer-name">{streamerName}</span>
                  {isHost && <span className="host-badge">Host</span>}
                </div>
                {isHost && (
                  <div className="stream-privacy-status">
                    <span className={`privacy-pill ${isMuted ? 'off' : 'on'}`}>
                      {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                      {isMuted ? 'Mic Off' : 'Mic On'}
                    </span>
                    <span className={`privacy-pill ${isVideoOff ? 'off' : 'on'}`}>
                      {isVideoOff ? <CameraOff size={12} /> : <Camera size={12} />}
                      {isVideoOff ? 'Camera Off' : 'Camera On'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="stream-info-right">
                <div className="stream-stats">
                  <div className="stat">
                    <Users size={16} />
                    <span>{viewerCount}</span>
                  </div>
                  <div className="stat">
                    <Heart size={16} />
                    <span>{likes}</span>
                  </div>
                  <div className="stat">
                    <Share2 size={16} />
                    <span>{shares}</span>
                  </div>
                </div>
                <div className="stream-quality">
                  <Wifi size={14} />
                  <span>{streamQuality}</span>
                </div>
                <div className="stream-duration">
                  <Clock size={14} />
                  <span>{formatDuration(streamDuration)}</span>
                </div>
              </div>
            </div>

            <div className="reaction-overlay">
              <AnimatePresence>
                {reactions.map(reaction => (
                  <motion.div
                    key={reaction.id}
                    className="reaction-emoji"
                    initial={{ y: 50, opacity: 0, scale: 0.5 }}
                    animate={{ y: -100, opacity: 1, scale: 1.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                  >
                    {reaction.emoji}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {showControls && (
              <motion.div 
                className="stream-control-bar"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
              >
                <div className="control-bar-left" />

                <div className="control-bar-center">
                  {isHost && (
                    <>
                      <button 
                        className={`stream-control-btn ${isMuted ? 'active' : ''}`}
                        onClick={onToggleMute}
                      >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>
                      <button 
                        className={`stream-control-btn ${isVideoOff ? 'active' : ''}`}
                        onClick={onToggleVideo}
                      >
                        {isVideoOff ? <CameraOff size={20} /> : <Camera size={20} />}
                      </button>
                      <button 
                        className={`stream-control-btn ${streamSource === 'screen' ? 'active' : ''}`}
                        onClick={onSwitchSource}
                      >
                        {streamSource === 'screen' ? <ScreenShareOff size={20} /> : <MonitorUp size={20} />}
                      </button>
                    </>
                  )}
                </div>

                <div className="control-bar-right">
                  <button
                    className={`stream-control-btn ${isSidebarOpen ? 'active' : ''}`}
                    onClick={() => {
                      setIsSidebarOpen(prev => {
                        const next = !prev;
                        if (next) setShowChat(true);
                        return next;
                      });
                    }}
                    title={isSidebarOpen ? 'Hide Chat' : 'Show Chat'}
                  >
                    {isSidebarOpen ? <X size={20} /> : <MessageSquare size={20} />}
                  </button>
                  <button className="stream-control-btn" onClick={() => setShowSettings(!showSettings)}>
                    <Settings size={20} />
                  </button>
                  {isHost && (
                    <button className="stream-control-btn end" onClick={onEndStream}>
                      End Stream
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={`stream-sidebar ${isSidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-tabs">
          <button className={`tab ${showChat ? 'active' : ''}`} onClick={() => setShowChat(true)}>
            <MessageSquare size={16} />
            Chat
          </button>
          <button className={`tab ${!showChat ? 'active' : ''}`} onClick={() => setShowChat(false)}>
            <Users size={16} />
            Viewers ({viewers.length})
          </button>
        </div>

        <AnimatePresence mode="wait">
          {showChat ? (
            <motion.div 
              key="chat"
              className="chat-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className="chat-message">
                    <span className="message-sender">{msg.sender}</span>
                    <span className="message-text">{msg.text}</span>
                    <span className="message-time">{msg.time}</span>
                  </div>
                ))}
              </div>
              
              <div className="chat-input-area">
                <div className="quick-reactions">
                  {['👍', '❤️', '😂', '😮', '🔥', '🎉'].map(emoji => (
                    <button 
                      key={emoji} 
                      className="reaction-btn"
                      onClick={() => handleReaction(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Send a message..."
                  />
                  <button onClick={handleSendMessage}>Send</button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="viewers"
              className="viewers-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {viewers.map((viewer, i) => (
                <div key={i} className="viewer-item">
                  <div className="viewer-avatar">
                    {viewer.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="viewer-name">{viewer.name}</span>
                  {viewer.isMod && <span className="mod-badge">Mod</span>}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="stream-settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSettings}
          >
            <motion.div 
              className="stream-settings-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="settings-header">
                <h3>Stream Settings</h3>
                <button onClick={closeSettings} aria-label="Close stream settings">
                  <X size={20} />
                </button>
              </div>
              <div className="settings-content">
                <div className="settings-group">
                  <h4>Video Quality</h4>
                  <div className="quality-presets">
                    {['Auto', '480p', '720p', '1080p', '4K'].map(q => (
                      <button 
                        key={q} 
                        className={`preset ${selectedQuality === q ? 'active' : ''}`}
                        onClick={() => setSelectedQuality(q)}
                        type="button"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-group">
                  <h4>Video Devices</h4>
                  <div className="setting-item">
                    <span>Camera</span>
                    <select value={selectedCamera} onChange={(event) => setSelectedCamera(event.target.value)}>
                      {availableCameraOptions.map((camera, index) => (
                        <option key={`${camera.deviceId}-${index}`} value={camera.deviceId}>{camera.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="settings-group">
                  <h4>Audio</h4>
                  <div className="setting-item">
                    <span>Microphone</span>
                    <select value={selectedMicrophone} onChange={(event) => setSelectedMicrophone(event.target.value)}>
                      {availableMicrophoneOptions.map((microphone, index) => (
                        <option key={`${microphone.deviceId}-${index}`} value={microphone.deviceId}>{microphone.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="setting-item">
                    <span>Audio Output</span>
                    <select value={selectedSpeaker} onChange={(event) => setSelectedSpeaker(event.target.value)}>
                      {availableSpeakerOptions.map((speaker, index) => (
                        <option key={`${speaker.deviceId}-${index}`} value={speaker.deviceId}>{speaker.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="setting-item">
                    <span>Noise Suppression</span>
                    <label className="toggle">
                      <input type="checkbox" checked={noiseSuppression} onChange={(event) => setNoiseSuppression(event.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
                <div className="settings-group">
                  <h4>Chat</h4>
                  <div className="setting-item">
                    <span>Slow Mode</span>
                    <label className="toggle">
                      <input type="checkbox" checked={slowMode} onChange={(event) => setSlowMode(event.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="setting-item">
                    <span>Sub Only Mode</span>
                    <label className="toggle">
                      <input type="checkbox" checked={subOnlyMode} onChange={(event) => setSubOnlyMode(event.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="settings-actions">
                <button className="settings-btn secondary" onClick={closeSettings} type="button">Cancel</button>
                <button className="settings-btn primary" onClick={applySettings} type="button">Save & Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ModernStreamPanel;