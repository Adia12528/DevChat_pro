import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, MicOff, Camera, CameraOff, Monitor, PhoneOff, 
  MessageSquare, Users, Radio, Settings, Maximize2, Minimize2,
  Send, Smile, Heart, ThumbsUp, PartyPopper
} from 'lucide-react';
import '../../streamStyles.css';

const LivestreamHost = ({ 
  streamInfo, 
  onEndStream, 
  onToggleMute, 
  onToggleVideo,
  onToggleScreenShare,
  onSendComment,
  viewers,
  comments,
  localStream,
  isMuted,
  isVideoOff,
  isScreenSharing
}) => {
  const [showChat, setShowChat] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const videoRef = useRef(null);

  const quickReactions = ['🔥', '❤️', '😂', '😮', '👏', '🎉'];

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleSendComment = () => {
    if (commentInput.trim()) {
      onSendComment(commentInput.trim());
      setCommentInput('');
    }
  };

  const handleReaction = (emoji) => {
    onSendComment(emoji);
  };

  if (isMinimized) {
    return (
      <div className="livestream-minimized" onClick={() => setIsMinimized(false)}>
        <div className="livestream-minimized-content">
          <Radio size={20} className="live-indicator" />
          <span className="livestream-minimized-title">You're live</span>
          <span className="livestream-viewer-count">{viewers} watching</span>
        </div>
        <button className="livestream-minimized-end" onClick={onEndStream}>
          <PhoneOff size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="livestream-host-container">
      {/* Main Video Area */}
      <div className="livestream-video-area">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="livestream-host-video"
        />
        
        {/* Stream Info Overlay */}
        <div className="livestream-host-overlay">
          <div className="livestream-host-info">
            <div className="livestream-status">
              <span className="live-badge">LIVE</span>
              <span className="viewer-count">
                <Users size={14} /> {viewers} watching
              </span>
            </div>
            <div className="livestream-host-details">
              <span className="host-name">{streamInfo?.host || 'You'}</span>
              <span className="stream-title">{streamInfo?.title || 'Live Stream'}</span>
            </div>
          </div>

          {/* Control Bar */}
          <div className="livestream-control-bar">
            <button
              className={`livestream-control-btn ${isMuted ? 'active' : ''}`}
              onClick={onToggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              className={`livestream-control-btn ${isVideoOff ? 'active' : ''}`}
              onClick={onToggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>

            <button
              className={`livestream-control-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={onToggleScreenShare}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <Monitor size={20} />
            </button>

            <button
              className="livestream-control-btn"
              onClick={() => setShowChat(!showChat)}
              title={showChat ? 'Hide chat' : 'Show chat'}
            >
              <MessageSquare size={20} />
            </button>

            <button
              className="livestream-control-btn end-stream-btn"
              onClick={onEndStream}
              title="End stream"
            >
              <PhoneOff size={20} />
            </button>

            <button
              className="livestream-control-btn"
              onClick={() => setIsMinimized(true)}
              title="Minimize"
            >
              <Minimize2 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="livestream-chat-panel">
          <div className="livestream-chat-header">
            <h3>Live Chat</h3>
            <span className="chat-viewer-count">{viewers} watching</span>
          </div>

          <div className="livestream-chat-messages">
            {comments.length === 0 ? (
              <div className="livestream-chat-empty">
                <MessageSquare size={32} />
                <p>No messages yet</p>
                <span>Be the first to say hello!</span>
              </div>
            ) : (
              comments.map((comment, index) => (
                <div key={index} className="livestream-chat-message">
                  <span className="message-author">{comment.from}:</span>
                  <span className="message-text">{comment.text}</span>
                  {comment.type === 'reaction' && (
                    <span className="message-reaction">{comment.text}</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Reactions */}
          <div className="livestream-quick-reactions">
            {quickReactions.map((emoji, index) => (
              <button
                key={index}
                className="reaction-btn"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="livestream-chat-input">
            <button
              className="emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile size={20} />
            </button>
            <input
              type="text"
              placeholder="Send a message..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
            />
            <button
              className="send-btn"
              onClick={handleSendComment}
              disabled={!commentInput.trim()}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LivestreamHost;