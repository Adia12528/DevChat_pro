import React, { useState, useRef, useEffect } from 'react';
import {
  Radio, Users, MessageSquare, Send, Smile, Maximize2, Minimize2,
  Heart, ThumbsUp, PartyPopper, Volume2, VolumeX
} from 'lucide-react';
import '../../streamStyles.css';

const LivestreamView = ({
  streamInfo,
  onLeaveStream,
  onSendComment,
  onSendReaction,
  comments,
  remoteStream,
  isMuted,
  onToggleMute
}) => {
  const [showChat, setShowChat] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const videoRef = useRef(null);

  const quickReactions = ['🔥', '❤️', '😂', '😮', '👏', '🎉'];

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleSendComment = () => {
    if (commentInput.trim()) {
      onSendComment(commentInput.trim());
      setCommentInput('');
    }
  };

  const handleReaction = (emoji) => {
    onSendReaction(emoji);
  };

  return (
    <div className={`livestream-viewer-container ${isExpanded ? 'expanded' : ''}`}>
      {/* Video Player */}
      <div className="livestream-player-area">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="livestream-player-video"
        />

        {/* Video Overlay Controls */}
        <div className="livestream-player-overlay">
          <div className="livestream-stream-info">
            <span className="live-badge">LIVE</span>
            <span className="stream-host">{streamInfo?.host}</span>
            <span className="viewer-count">
              <Users size={14} /> {streamInfo?.viewers || 0}
            </span>
          </div>

          <div className="livestream-player-controls">
            <button
              className="control-btn"
              onClick={onToggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              className="control-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              className="control-btn"
              onClick={() => setShowChat(!showChat)}
              title={showChat ? 'Hide chat' : 'Show chat'}
            >
              <MessageSquare size={18} />
            </button>

            <button className="control-btn leave-btn" onClick={onLeaveStream}>
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="livestream-viewer-chat">
          <div className="livestream-chat-header">
            <h3>Live Chat</h3>
          </div>

          <div className="livestream-chat-messages">
            {comments.length === 0 ? (
              <div className="livestream-chat-empty">
                <MessageSquare size={32} />
                <p>No messages yet</p>
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

export default LivestreamView;