import React from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Monitor, Volume2, VolumeX } from 'lucide-react';

const EnhancedCallControls = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  disabled = false,
  compact = false
}) => {
  if (compact) {
    return (
      <div className="enhanced-call-controls compact">
        <button
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          disabled={disabled}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          className={`control-btn ${isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          disabled={disabled}
          title={isVideoOff ? 'Start Video' : 'Stop Video'}
        >
          {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
        </button>

        <button
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          onClick={onToggleScreenShare}
          disabled={disabled}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Monitor size={18} />
        </button>

        <button
          className="control-btn end-call"
          onClick={onEndCall}
          disabled={disabled}
          title="End Call"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="enhanced-call-controls full">
      <div className="controls-group">
        <button
          className={`control-item ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          disabled={disabled}
        >
          <div className="control-icon">
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </div>
          <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button
          className={`control-item ${isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          disabled={disabled}
        >
          <div className="control-icon">
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </div>
          <span className="control-label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
        </button>

        <button
          className={`control-item ${isScreenSharing ? 'active' : ''}`}
          onClick={onToggleScreenShare}
          disabled={disabled}
        >
          <div className="control-icon">
            <Monitor size={22} />
          </div>
          <span className="control-label">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
        </button>

        <button
          className="control-item end-call"
          onClick={onEndCall}
          disabled={disabled}
        >
          <div className="control-icon">
            <PhoneOff size={22} />
          </div>
          <span className="control-label">End Call</span>
        </button>
      </div>
    </div>
  );
};

export default EnhancedCallControls;