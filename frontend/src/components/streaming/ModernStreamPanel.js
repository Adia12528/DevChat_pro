import React, { useState, useEffect } from 'react';
import { 
  Radio, Users, MessageSquare, Heart, ThumbsUp, 
  Share2, Settings, Mic, MicOff, Camera, CameraOff,
  MonitorUp, ScreenShare, ScreenShareOff, X,
  ChevronUp, ChevronDown, Maximize2, Minimize2,
  Download, Gift, Sparkles, Clock, Wifi, WifiOff,
  Volume2, VolumeX, Play, Pause, SkipForward,
  SkipBack, RotateCcw, RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/index.css';

const ModernStreamPanel = ({
  isHost,
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
  shares = 0
}) => {
  const [showChat, setShowChat] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [layout, setLayout] = useState('cinema');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [reactions, setReactions] = useState([]);

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
    setReactions(prev => [...prev, { emoji, id: Date.now() }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== Date.now()));
    }, 3000);
    onReact?.(emoji);
  };

  return (
    <motion.div 
      className={`modern-stream-container ${layout}`}
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
            {isHost ? (
              <video className="stream-video" autoPlay muted playsInline />
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
                <div className="control-bar-left">
                  <button className="stream-control-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                  <button className="stream-control-btn" onClick={() => setLayout('cinema')}>
                    <MonitorUp size={20} />
                  </button>
                  <button className="stream-control-btn" onClick={() => setLayout('compact')}>
                    <ScreenShare size={20} />
                  </button>
                </div>

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
                  <button className="stream-control-btn" onClick={() => handleReaction('❤️')}>
                    <Heart size={20} />
                  </button>
                  <button className="stream-control-btn" onClick={() => handleReaction('👍')}>
                    <ThumbsUp size={20} />
                  </button>
                  <button className="stream-control-btn" onClick={() => handleReaction('🎉')}>
                    <Sparkles size={20} />
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

      <div className={`stream-sidebar ${showChat ? 'open' : 'collapsed'}`}>
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
            className="stream-settings-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="settings-header">
              <h3>Stream Settings</h3>
              <button onClick={() => setShowSettings(false)}>
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
                      className={`preset ${streamQuality === q ? 'active' : ''}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-group">
                <h4>Audio</h4>
                <div className="setting-item">
                  <span>Microphone</span>
                  <select>
                    <option>Default</option>
                    <option>External Mic</option>
                  </select>
                </div>
                <div className="setting-item">
                  <span>Noise Suppression</span>
                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
              <div className="settings-group">
                <h4>Chat</h4>
                <div className="setting-item">
                  <span>Slow Mode</span>
                  <label className="toggle">
                    <input type="checkbox" />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="setting-item">
                  <span>Sub Only Mode</span>
                  <label className="toggle">
                    <input type="checkbox" />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ModernStreamPanel;