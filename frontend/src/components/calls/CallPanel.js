import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, 
  Maximize2, Minimize2, Users, Settings, Volume2, 
  VolumeX, MessageSquare, Share2, ScreenShare, 
  ScreenShareOff, Grid, PieChart, Circle, MoreVertical,
  Bluetooth, Wifi, WifiOff, Battery, Clock, X,
  ChevronUp, ChevronDown, Camera, CameraOff,
  Sparkles, BarChart3, Download, Radio,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Modern Call Panel Component
 * Professional video/voice call interface with premium features
 */
const CallPanel = ({
  // Core call props
  callType,
  callPeer,
  callDuration,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isCallMinimized,
  
  // Callbacks
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onToggleMinimize,
  
  // Media refs
  localVideoRef,
  remoteVideoRef,
  
  // Streams
  localStream,
  remoteStream,
  
  // UI state
  remoteIsScreenSharing = false,
  connectionQuality = 'excellent',
  participants = [],
  
  // Camera device management
  cameraDevices = [],
  selectedCameraId = '',
  onCameraChange,
  onRefreshCameraDevices,
  isRefreshingCameras = false,
  cameraStatusToast = null,
  
  // Audio device management
  audioInputDevices = [],
  selectedAudioInputId = '',
  onAudioInputChange,
  audioOutputDevices = [],
  selectedAudioOutputId = '',
  onAudioOutputChange,
  
  // Video quality
  selectedVideoQuality = 'Auto',
  onVideoQualityChange,
  
  // Audio settings
  audioSettings,
  onAudioSettingChange,
  
  // Formatting utility (optional)
  formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}) => {
  // =========================================================================
  // STATE
  // =========================================================================
  const [showControls, setShowControls] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [layout, setLayout] = useState('grid');
  const [videoQuality, setVideoQuality] = useState(selectedVideoQuality || 'Auto');
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Refs for audio analysis
  const audioAnalyserRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  const controlsTimerRef = useRef(null);

  // =========================================================================
  // MEMOIZED VALUES
  // =========================================================================
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

  const getQualityColor = useCallback(() => {
    switch(connectionQuality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FFC107';
      case 'poor': return '#FF9800';
      default: return '#F44336';
    }
  }, [connectionQuality]);

  // =========================================================================
  // EFFECTS
  // =========================================================================

  // 1. Attach remote stream to video element (robust for all devices)
  useEffect(() => {
    if (!remoteVideoRef?.current) return;
    
    const videoEl = remoteVideoRef.current;
    
    if (remoteStream) {
      try {
        // Preferred method: srcObject
        if (videoEl.srcObject !== remoteStream) {
          videoEl.srcObject = remoteStream;
        }
        
        // Ensure video plays
        videoEl.play().catch(e => {
          console.warn('[CallPanel] Remote video play failed:', e);
          // Fallback for iOS Safari
          setTimeout(() => {
            videoEl.play().catch(() => {});
          }, 100);
        });
        
        console.log('[CallPanel] Remote video attached successfully');
      } catch (err) {
        console.error('[CallPanel] Failed to attach remote video:', err);
        
        // Fallback method: createObjectURL
        try {
          const url = URL.createObjectURL(remoteStream);
          videoEl.src = url;
          videoEl.load();
          videoEl.play().catch(() => {});
          console.log('[CallPanel] Used fallback URL attachment');
        } catch (fallbackErr) {
          console.error('[CallPanel] Fallback also failed:', fallbackErr);
        }
      }
    } else {
      // Clear video when no stream
      videoEl.srcObject = null;
      videoEl.removeAttribute('src');
      videoEl.load();
    }
  }, [remoteStream, remoteVideoRef]);

  // 2. Attach remote audio with output device support
  useEffect(() => {
    if (!remoteStream) return;
    
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.muted = false;
    audioEl.style.display = 'none';
    
    try {
      audioEl.srcObject = remoteStream;
      
      // Set output device if supported
      if (selectedAudioOutputId && typeof audioEl.setSinkId === 'function') {
        audioEl.setSinkId(selectedAudioOutputId).catch(err => {
          console.warn('[CallPanel] Failed to set audio output device:', err);
        });
      }
      
      document.body.appendChild(audioEl);
      
      audioEl.play().catch(err => {
        console.warn('[CallPanel] Audio autoplay failed:', err);
        // Try again after user interaction
        const playHandler = () => {
          audioEl.play().catch(() => {});
          document.removeEventListener('click', playHandler);
        };
        document.addEventListener('click', playHandler);
      });
      
      return () => {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
      };
    } catch (err) {
      console.error('[CallPanel] Failed to setup remote audio:', err);
    }
  }, [remoteStream, selectedAudioOutputId]);

  // 3. Auto-hide controls timer
  useEffect(() => {
    if (isPerformanceLite) return; // Skip on low-performance devices
    
    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      controlsTimerRef.current = setTimeout(() => {
        if (!showParticipants && !showSettings && !showChat) {
          setShowControls(false);
        }
      }, 3000);
    };
    
    resetTimer();
    
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [isPerformanceLite, showParticipants, showSettings, showChat]);

  // 4. Audio level meter (if not muted)
  useEffect(() => {
    if (!localStream || isMuted) {
      setAudioLevel(0);
      return;
    }
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      audioAnalyserRef.current = analyser;
      
      const updateLevel = () => {
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length;
          setAudioLevel(avg / 255); // Normalize to 0-1
        }
      };
      
      updateLevel();
      audioLevelIntervalRef.current = setInterval(updateLevel, isPerformanceLite ? 240 : 100);
      
      return () => {
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
        }
        audioContext.close();
        setAudioLevel(0);
      };
    } catch (err) {
      console.warn('[CallPanel] Audio level meter failed:', err);
    }
  }, [localStream, isMuted, isPerformanceLite]);

  // 5. Update video quality when prop changes
  useEffect(() => {
    if (selectedVideoQuality && selectedVideoQuality !== videoQuality) {
      setVideoQuality(selectedVideoQuality);
    }
  }, [selectedVideoQuality, videoQuality]);

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleVideoQualityChange = (qualityValue) => {
    setVideoQuality(qualityValue);
    onVideoQualityChange?.(qualityValue);
  };

  const handleCameraChange = (deviceId) => {
    onCameraChange?.(deviceId);
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // =========================================================================
  // RENDER MINIMIZED VIEW
  // =========================================================================
  if (isCallMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="modern-call-minimized"
        onClick={onToggleMinimize}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '280px',
          height: '80px',
          background: 'rgba(20, 20, 30, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          padding: '8px',
          cursor: 'pointer',
          zIndex: 10000,
          color: '#fff'
        }}
      >
        <div style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', marginRight: '12px' }}>
          {callType === 'video' && remoteStream ? (
            <video 
              ref={remoteVideoRef} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              autoPlay 
              playsInline 
              muted
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              {callPeer?.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getQualityColor(),
            boxShadow: '0 0 8px currentColor'
          }} />
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{callPeer}</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{formatTime(callDuration)}</div>
        </div>
        
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#f44336',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  // =========================================================================
  // RENDER FULLSCREEN VIEW
  // =========================================================================
  return (
    <motion.div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#000',
        zIndex: 9999,
        overflow: 'hidden',
        color: '#fff'
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={() => !isPerformanceLite && setShowControls(true)}
      onMouseLeave={() => !isPerformanceLite && setShowControls(false)}
    >
      {/* Background gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(100, 100, 150, 0.2), transparent 50%)',
        pointerEvents: 'none',
        zIndex: 1
      }} />

      {/* Video Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: callType === 'video' && !remoteIsScreenSharing ? '1fr 200px' : '1fr',
        height: '100%',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Remote Video */}
        <div style={{
          position: 'relative',
          background: '#1a1a1a',
          overflow: 'hidden'
        }}>
          {callType === 'video' && remoteStream ? (
            <video
              ref={remoteVideoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: remoteIsScreenSharing ? 'contain' : 'cover'
              }}
              autoPlay
              playsInline
            />
          ) : (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              width: '100%'
            }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                fontWeight: 'bold',
                margin: '0 auto 20px'
              }}>
                {callPeer?.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>{callPeer}</div>
              <div style={{ fontSize: '14px', opacity: 0.7 }}>{callType === 'voice' ? 'Voice Call' : 'Waiting for video...'}</div>
            </div>
          )}

          {/* Overlay Info - Top Left */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 5,
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <span style={{
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Circle size={8} fill={getQualityColor()} color={getQualityColor()} />
              {callPeer}
            </span>
            {remoteIsScreenSharing && (
              <span style={{
                background: 'rgba(255, 107, 107, 0.3)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid rgba(255, 107, 107, 0.5)'
              }}>
                📺 Screen Share
              </span>
            )}
          </div>

          {/* Overlay Info - Top Right */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 5,
            display: 'flex',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wifi size={14} color={getQualityColor()} />
              <span style={{ fontSize: '12px' }}>{networkStats.bitrate} kbps</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} />
              <span style={{ fontSize: '12px' }}>{networkStats.latency} ms</span>
            </div>
          </div>

          {/* Overlay Info - Bottom Left */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 5
          }}>
            <span style={{
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontFamily: 'monospace',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {formatTime(callDuration)}
            </span>
          </div>
        </div>

        {/* Local Video (for video calls) */}
        {callType === 'video' && !remoteIsScreenSharing && (
          <div style={{
            position: 'relative',
            background: '#222',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden'
          }}>
            <video 
              ref={localVideoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isVideoOff ? 0.5 : 1
              }}
              autoPlay 
              playsInline 
              muted
            />
            
            {isVideoOff && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <CameraOff size={32} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Camera Off</span>
              </div>
            )}

            {/* Audio level indicator */}
            {!isMuted && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                width: '30px',
                height: '100px',
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '15px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${Math.max(5, audioLevel * 100)}%`,
                  background: 'linear-gradient(to top, #4CAF50, #8BC34A)',
                  transition: 'height 0.1s ease'
                }} />
              </div>
            )}

            {/* Local user label */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>You</span>
              {isMuted && <MicOff size={12} />}
            </div>
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '20px 30px',
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* Top Row - Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: getQualityColor(),
                    boxShadow: `0 0 10px ${getQualityColor()}`
                  }} />
                  <span style={{ fontSize: '14px', fontWeight: 500, textTransform: 'capitalize' }}>
                    {connectionQuality} Connection
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '14px', fontFamily: 'monospace' }}>{formatTime(callDuration)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  style={{
                    background: showSettings ? '#667eea' : 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => setShowParticipants(!showParticipants)}
                  style={{
                    background: showParticipants ? '#667eea' : 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Users size={18} />
                </button>
              </div>
            </div>

            {/* Bottom Row - Main Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {/* Mute Button */}
              <button 
                onClick={onToggleMute}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: isMuted ? '#f44336' : 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(8px)',
                  border: '2px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                <span style={{ fontSize: '10px' }}>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {/* Video Toggle (video calls only) */}
              {callType === 'video' && (
                <button 
                  onClick={onToggleVideo}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: isVideoOff ? '#f44336' : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(8px)',
                    border: '2px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                  <span style={{ fontSize: '10px' }}>{isVideoOff ? 'Camera On' : 'Camera Off'}</span>
                </button>
              )}

              {/* Screen Share (video calls only) */}
              {callType === 'video' && (
                <button 
                  onClick={onToggleScreenShare}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: isScreenSharing ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(8px)',
                    border: '2px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {isScreenSharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}
                  <span style={{ fontSize: '10px' }}>Share</span>
                </button>
              )}

              {/* End Call Button */}
              <button 
                onClick={onEndCall}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#f44336',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)'
                }}
              >
                <PhoneOff size={24} />
                <span style={{ fontSize: '10px' }}>End</span>
              </button>

              {/* Minimize Button */}
              <button 
                onClick={onToggleMinimize}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(8px)',
                  border: '2px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <Minimize2 size={24} />
                <span style={{ fontSize: '10px' }}>Minimize</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Sidebar */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '320px',
              background: 'rgba(20, 20, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column'
            }}
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Settings</h3>
              <button 
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {/* Camera Settings */}
              {callType === 'video' && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Camera</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={selectedCameraId || 'default'}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      disabled={isRefreshingCameras}
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '10px',
                        borderRadius: '8px',
                        outline: 'none',
                        fontSize: '13px'
                      }}
                    >
                      <option value="default">System Default</option>
                      {cameraDevices.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label || 'Camera'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={onRefreshCameraDevices}
                      disabled={isRefreshingCameras}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <RefreshCw size={16} className={isRefreshingCameras ? 'spin' : ''} />
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Input Settings */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Microphone</h4>
                <select
                  value={selectedAudioInputId || 'default'}
                  onChange={(e) => onAudioInputChange?.(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '10px',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                >
                  <option value="default">System Default</option>
                  {audioInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Microphone'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audio Output Settings */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Speaker</h4>
                <select
                  value={selectedAudioOutputId || 'default'}
                  onChange={(e) => onAudioOutputChange?.(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '10px',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                >
                  <option value="default">System Default</option>
                  {audioOutputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || 'Speaker'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Video Quality (video calls only) */}
              {callType === 'video' && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Video Quality</h4>
                  <select
                    value={videoQuality}
                    onChange={(e) => handleVideoQualityChange(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      padding: '10px',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '13px'
                    }}
                  >
                    {qualityOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Network Stats */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Network</h4>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '8px',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Quality</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{connectionQuality}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Bitrate</span>
                    <span>{networkStats.bitrate} kbps</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Latency</span>
                    <span>{networkStats.latency} ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Packet Loss</span>
                    <span>{networkStats.packetLoss}%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participants Sidebar */}
      <AnimatePresence>
        {showParticipants && (
          <motion.div 
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '320px',
              background: 'rgba(20, 20, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column'
            }}
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Participants ({participants.length + 1})</h3>
              <button 
                onClick={() => setShowParticipants(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {/* You */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(102, 126, 234, 0.1)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>
                  You
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>You</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>You</div>
                </div>
                {isMuted && <MicOff size={16} style={{ opacity: 0.7 }} />}
              </div>

              {/* Other participants */}
              {participants.map((p, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  marginBottom: '8px',
                  position: 'relative'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4f5bd5, #962fbf)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}>
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      {p.isMuted ? 'Muted' : 'Active'}
                    </div>
                  </div>
                  {p.isMuted && <MicOff size={16} style={{ opacity: 0.7 }} />}
                  {p.isSpeaking && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '4px',
                      height: '70%',
                      background: '#4CAF50',
                      borderRadius: '2px'
                    }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Status Toast */}
      {cameraStatusToast && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          padding: '8px 16px',
          borderRadius: '30px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 30,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {typeof cameraStatusToast === 'object' && cameraStatusToast !== null ? cameraStatusToast.message : cameraStatusToast}
        </div>
      )}

      {/* Performance mode indicator */}
      {isPerformanceLite && (
        <div style={{
          position: 'absolute',
          top: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          zIndex: 5
        }}>
          Performance Mode
        </div>
      )}
    </motion.div>
  );
};

export default CallPanel;