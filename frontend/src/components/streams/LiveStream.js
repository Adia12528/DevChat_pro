// LiveStream.js - Complete livestreaming components
import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Users, MessageSquare, X, Send, 
  ThumbsUp, Heart, Laugh, Camera, Monitor,
  Mic, MicOff, Video, VideoOff, Settings,
  Maximize2, Minimize2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ==================== LIVESTREAM CONTROLS ====================
export const LiveStreamControls = ({
  isHost,
  streamSource,
  isMuted,
  isVideoOff,
  viewerCount,
  onToggleMute,
  onToggleVideo,
  onEndStream,
  onSwitchSource,
  className
}) => {
  return (
    <div className={`livestream-controls ${className || ''}`}>
      <div className="controls-left">
        <div className="stream-badge">
          <Radio size={16} className={isHost ? 'pulse' : ''} />
          <span>{isHost ? 'LIVE' : 'WATCHING'}</span>
        </div>
        {isHost && (
          <div className="stream-source-badge">
            {streamSource === 'screen' ? <Monitor size={14} /> : <Camera size={14} />}
            <span>{streamSource === 'screen' ? 'Screen' : 'Camera'}</span>
          </div>
        )}
        <div className="viewer-count">
          <Users size={14} />
          <span>{viewerCount}</span>
        </div>
      </div>

      <div className="controls-right">
        {isHost && (
          <>
            <button
              className={`control-btn ${isMuted ? 'active' : ''}`}
              onClick={onToggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className={`control-btn ${isVideoOff ? 'active' : ''}`}
              onClick={onToggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
            <button
              className="control-btn"
              onClick={onSwitchSource}
              title="Switch source"
            >
              {streamSource === 'screen' ? <Camera size={18} /> : <Monitor size={18} />}
            </button>
          </>
        )}
        <button className="control-btn end-stream" onClick={onEndStream}>
          <X size={18} />
          <span>End</span>
        </button>
      </div>
    </div>
  );
};

// ==================== LIVESTREAM CHAT ====================
export const LiveStreamChat = ({
  comments,
  onSendComment,
  onSendReaction,
  className
}) => {
  const [message, setMessage] = useState('');
  const chatEndRef = useRef(null);
  const reactions = ['🔥', '👏', '❤️', '😂', '😮', '🎉'];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSend = () => {
    if (message.trim()) {
      onSendComment(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`livestream-chat ${className || ''}`}>
      <div className="chat-header">
        <MessageSquare size={16} />
        <span>Live Chat</span>
      </div>

      <div className="chat-messages">
        {comments.map((comment, index) => (
          <div key={comment.id || index} className="chat-message">
            <span className="message-sender">{comment.from}:</span>
            {comment.type === 'reaction' ? (
              <span className="message-reaction">{comment.emoji}</span>
            ) : (
              <span className="message-text">{comment.text}</span>
            )}
            <span className="message-time">
              {new Date(comment.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-reactions">
        {reactions.map(emoji => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={() => onSendReaction(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="chat-input">
        <input
          type="text"
          placeholder="Send a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button onClick={handleSend} disabled={!message.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// ==================== STREAM SETTINGS ====================
export const StreamSettings = ({
  visibility,
  source,
  onVisibilityChange,
  onSourceChange,
  onStartStream,
  onClose,
  className
}) => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isWindows = /Windows/i.test(navigator.userAgent);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`stream-settings-modal ${className || ''}`}
    >
      <div className="settings-header">
        <h3>Stream Settings</h3>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="settings-content">
        <div className="setting-group">
          <label>Visibility</label>
          <div className="option-buttons">
            <button
              className={`option-btn ${visibility === 'room' ? 'active' : ''}`}
              onClick={() => onVisibilityChange('room')}
            >
              Room Only
            </button>
            <button
              className={`option-btn ${visibility === 'public' ? 'active' : ''}`}
              onClick={() => onVisibilityChange('public')}
            >
              Public
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label>Source</label>
          <div className="option-buttons">
            <button
              className={`option-btn ${source === 'camera' ? 'active' : ''}`}
              onClick={() => onSourceChange('camera')}
            >
              <Camera size={16} />
              Camera
            </button>
            
            {!isMobile && isWindows && (
              <>
                <button
                  className={`option-btn ${source === 'screen' ? 'active' : ''}`}
                  onClick={() => onSourceChange('screen')}
                >
                  <Monitor size={16} />
                  Screen
                </button>
                <button
                  className={`option-btn ${source === 'both' ? 'active' : ''}`}
                  onClick={() => onSourceChange('both')}
                >
                  <Camera size={16} />
                  <Monitor size={16} />
                  Both
                </button>
              </>
            )}
          </div>
        </div>

        {isMobile && (
          <div className="setting-note">
            <p>📱 On mobile, only camera streaming is available.</p>
          </div>
        )}

        {!isWindows && !isMobile && (
          <div className="setting-note">
            <p>💻 Screen sharing is optimized for Windows. Camera only available on other platforms.</p>
          </div>
        )}

        <button className="start-stream-btn" onClick={onStartStream}>
          <Radio size={20} />
          Start Streaming
        </button>
      </div>
    </motion.div>
  );
};

// ==================== VIEWER GRID ====================
export const ViewerGrid = ({ viewers, onInvite, className }) => {
  return (
    <div className={`viewer-grid ${className || ''}`}>
      <div className="grid-header">
        <Users size={16} />
        <span>Viewers ({viewers.length})</span>
      </div>
      <div className="grid-content">
        {viewers.map(viewer => (
          <div key={viewer} className="viewer-item">
            <div className="viewer-avatar">
              {viewer.charAt(0).toUpperCase()}
            </div>
            <span className="viewer-name">{viewer}</span>
          </div>
        ))}
        {viewers.length === 0 && (
          <div className="empty-viewers">
            No viewers yet. Share your stream!
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== STREAM QUALITY INDICATOR ====================
export const StreamQualityIndicator = ({ quality, bitrate, fps }) => {
  const getQualityColor = () => {
    switch (quality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FFC107';
      case 'poor': return '#FF9800';
      case 'very-poor': return '#F44336';
      default: return '#8696a0';
    }
  };

  return (
    <div className="stream-quality-indicator">
      <div className="quality-dot" style={{ backgroundColor: getQualityColor() }} />
      <span className="quality-label">{quality}</span>
      {bitrate && <span className="quality-bitrate">{Math.round(bitrate / 1000)} kbps</span>}
      {fps && <span className="quality-fps">{fps} fps</span>}
    </div>
  );
};

// ==================== STREAM RECORDING CONTROLS ====================
export const StreamRecordingControls = ({
  isRecording,
  onToggleRecording,
  recordingDuration,
  className
}) => {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`recording-controls ${className || ''}`}>
      <button
        className={`record-btn ${isRecording ? 'recording' : ''}`}
        onClick={onToggleRecording}
      >
        <div className="record-dot" />
        <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
      </button>
      {isRecording && (
        <span className="recording-duration">
          ⏺️ {formatDuration(recordingDuration)}
        </span>
      )}
    </div>
  );
};