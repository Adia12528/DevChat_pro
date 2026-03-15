import React from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, ScreenShareOff, Clock, Wifi, Camera, CameraOff } from 'lucide-react';
import { motion } from 'framer-motion';

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
  remoteAudioRef,
  remoteStream,
  // New props for device selection
  audioInputDevices = [],
  audioOutputDevices = [],
  selectedAudioInputId = '',
  selectedAudioOutput = 'default',
  onMicrophoneChange = () => {},
  onSpeakerChange = () => {},
}) => {
  // Only basic controls and default device are shown. No advanced settings.
  if (isCallMinimized) {
    return (
      <motion.div className="modern-call-minimized" onClick={onToggleMinimize}>
        <div className="minimized-preview">
          {callType === 'video' && remoteStream ? (
            <video ref={remoteVideoRef} className="minimized-video" autoPlay playsInline muted />
          ) : (
            <div className="minimized-avatar">{callPeer?.charAt(0).toUpperCase()}</div>
          )}
        </div>
        {/* Remote audio element for minimized view (hidden) */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="minimized-info">
          <span className="minimized-peer">{callPeer}</span>
          <span className="minimized-time">{callDuration}</span>
        </div>
        <div className="minimized-actions">
          <button className="minimized-action" onClick={e => { e.stopPropagation(); onToggleMute(); }}>
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button className="minimized-action end" onClick={e => { e.stopPropagation(); onEndCall(); }}>
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="modern-call-container">
      <div className="video-grid">
        <div className="video-wrapper remote">
          {callType === 'video' && remoteStream ? (
            <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          ) : (
            <div className="video-placeholder">
              <div className="placeholder-avatar">{callPeer?.charAt(0).toUpperCase()}</div>
              <div className="placeholder-name">{callPeer}</div>
              <div className="placeholder-status">Waiting for video...</div>
            </div>
          )}
        </div>
        {/* Remote audio element for remote voice playback (always present, hidden) */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        {callType === 'video' && (
          <div className="video-wrapper local">
            <video ref={localVideoRef} className={`local-video ${isVideoOff ? 'hidden' : ''}`} autoPlay playsInline muted />
            {isVideoOff && (
              <div className="local-video-off">
                <CameraOff size={24} />
                <span>Camera Off</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Device selection controls (responsive) */}
      <div className="modern-call-device-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0', justifyContent: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Mic:
          <select
            value={selectedAudioInputId || ''}
            onChange={e => onMicrophoneChange(e.target.value)}
            style={{ minWidth: 120 }}
          >
            {audioInputDevices.length === 0 && <option value="">Default</option>}
            {audioInputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Speaker:
          <select
            value={selectedAudioOutput || 'default'}
            onChange={e => onSpeakerChange(e.target.value)}
            style={{ minWidth: 120 }}
          >
            {audioOutputDevices.length === 0 && <option value="default">Default</option>}
            {audioOutputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || 'Speaker'}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="modern-call-controls">
        <button className={`main-control ${isMuted ? 'active' : ''}`} onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        {callType === 'video' && (
          <button className={`main-control ${isVideoOff ? 'active' : ''}`} onClick={onToggleVideo} title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}
        {callType === 'video' && (
          <button className={`main-control ${isScreenSharing ? 'active' : ''}`} onClick={onToggleScreenShare} title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
            {isScreenSharing ? <ScreenShareOff size={24} /> : <MonitorUp size={24} />}
          </button>
        )}
        <button className="main-control end-call" onClick={onEndCall} title="End call">
          <PhoneOff size={24} />
        </button>
      </div>
    </motion.div>
  );
};

export default CallPanel;