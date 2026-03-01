import React from 'react';
import { Pin, Star, Reply, Eye, Download, Play, Pause } from 'lucide-react';

export const MessageBubble = ({
  message,
  isOwn,
  username,
  starredMsgIds,
  playingVoiceId,
  onContextMenu,
  onLongPressStart,
  onLongPressEnd,
  onReaction,
  onScrollToMessage,
  onToggleStar,
  onPlayVoice,
  onDownloadMedia,
  onOpenImageViewer,
  onOpenVoicePlayer,
  chat,
  formatRelativeTime
}) => {
  const reactions = message.reactions || {};

  return (
    <div
      id={`msg-${message._id}`}
      className={`msg-bubble ${isOwn ? "me" : "other"} ${message.isPinned ? "pinned" : ""}`}
      onContextMenu={onContextMenu}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onTouchMove={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
    >
      {message.isPinned && <Pin size={12} className="pin-icon" />}
      {starredMsgIds.has(message._id) && (
        <span className="msg-star-badge">
          <Star size={10} fill="#FFD700" color="#FFD700"/>
        </span>
      )}
      
      {!isOwn && <span className="sender-tag">{message.sender}</span>}
      
      {/* Reply Preview */}
      {message.replyTo && (
        <ReplyPreview
          messageId={message.replyTo}
          chat={chat}
          onScroll={onScrollToMessage}
        />
      )}
      
      {/* Message Content */}
      <MessageContent
        message={message}
        playingVoiceId={playingVoiceId}
        onPlayVoice={onPlayVoice}
        onDownloadMedia={onDownloadMedia}
        onOpenImageViewer={onOpenImageViewer}
        onOpenVoicePlayer={onOpenVoicePlayer}
      />
      
      {message.edited && <span className="msg-edited">(edited)</span>}
      
      {/* Reactions */}
      {Object.keys(reactions).length > 0 && (
        <div className="message-reactions">
          {Object.entries(reactions).map(([emoji, users]) => (
            <button
              key={emoji}
              className={`reaction-item ${users.includes(username) ? 'reacted' : ''}`}
              onClick={() => onReaction(message._id, emoji)}
            >
              {emoji} {users.length}
            </button>
          ))}
        </div>
      )}
      
      {/* Footer */}
      <div className="msg-footer">
        <span className="timestamp" title={new Date(message.time).toLocaleString()}>
          {formatRelativeTime(message.time)}
        </span>
        
        {/* Read receipts */}
        {isOwn && <ReadReceipts message={message} username={username} />}
      </div>
    </div>
  );
};

const ReplyPreview = ({ messageId, chat, onScroll }) => {
  const repliedMsg = chat.find(c => c._id === messageId);
  if (!repliedMsg) return null;

  return (
    <div className="reply-preview" onClick={() => onScroll(messageId)}>
      <Reply size={12} />
      <div className="reply-preview-content">
        <span className="reply-preview-sender">{repliedMsg.sender}</span>
        <span className="reply-preview-text">
          {repliedMsg.type === 'image' ? '📷 Photo' :
           repliedMsg.type === 'voice' ? '🎤 Voice' :
           repliedMsg.type === 'file' ? `📎 ${repliedMsg.fileName}` :
           repliedMsg.text?.substring(0, 60)}
        </span>
      </div>
    </div>
  );
};

const MessageContent = ({ message, playingVoiceId, onPlayVoice, onDownloadMedia, onOpenImageViewer, onOpenVoicePlayer }) => {
  if (message.type === 'image') {
    return (
      <div className="image-message-wrapper">
        <div className="image-container" onClick={() => onOpenImageViewer({
          url: message.fileUrl,
          fileName: `image-${new Date(message.time).getTime()}.jpg`,
          sender: message.sender,
          time: message.time
        })}>
          <img src={message.fileUrl} className="chat-img" alt="shared" />
          <div className="image-overlay">
            <Eye size={20} />
            <span>Click to View</span>
          </div>
        </div>
        <button className="media-download-btn" onClick={() => onDownloadMedia(message.fileUrl, `image-${new Date(message.time).getTime()}.jpg`)}>
          <Download size={16} />
        </button>
      </div>
    );
  }

  if (message.type === 'voice') {
    return (
      <div className="voice-message-wrapper">
        <div className="voice-message" onClick={() => onOpenVoicePlayer({
          url: message.fileUrl,
          fileName: `voice-${new Date(message.time).getTime()}.webm`,
          sender: message.sender,
          time: message.time,
          duration: message.duration
        })}>
          <button className="voice-play-btn" onClick={(e) => {
            e.stopPropagation();
            onPlayVoice(message.fileUrl, message._id);
          }}>
            {playingVoiceId === message._id ? <Pause size={16}/> : <Play size={16}/>}
          </button>
          <div className="voice-waveform">
            <span className="voice-duration">{message.duration || 0}s</span>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'file') {
    return (
      <a href={message.fileUrl} download={message.fileName} className="file-card">
        <div className="file-card-icon"><FileText size={20}/></div>
        <div className="file-card-info">
          <span className="file-card-name">{message.fileName}</span>
          <span className="file-card-size">{message.fileSize ? formatFileSize(message.fileSize) : 'Download'}</span>
        </div>
        <Download size={16} />
      </a>
    );
  }

  return <p>{message.text}</p>;
};

const ReadReceipts = ({ message, username }) => {
  const readers = Array.isArray(message.readBy) ? message.readBy : [];
  const seenByOthers = readers.some(r => r !== username);

  return (
    <>
      {seenByOthers && (
        <span className="message-ticks blue" title="Seen">✓✓</span>
      )}
      {!seenByOthers && readers.length > 0 && (
        <span className="message-ticks" title="Delivered">✓✓</span>
      )}
    </>
  );
};