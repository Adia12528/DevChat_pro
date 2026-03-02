// CallManager.js - Manages call state and UI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Monitor, Volume2 } from 'lucide-react';
import { useEnhancedCall } from '../../hooks/useEnhancedcall';
import CallPanel from './CallPanel';
import EnhancedCallControls from './EnhancedCallControls';
import { 
  ICE_SERVERS,
  CallStatistics,
  AdaptiveQualityController,
  getScreenStream,
  switchToScreenShare,
  switchBackToCamera,
  waitForIceGatheringComplete,
  optimizeRtpSenders
} from './CallUtils';

const CallManager = ({ socket, username, room, onlineUsers, selectedUser }) => {
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, active
  const [callType, setCallType] = useState(null); // voice, video
  const [callPeer, setCallPeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callError, setCallError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callQuality, setCallQuality] = useState('excellent');

  // Refs
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const qualityControllerRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Get enhanced call settings
  const { 
    settings, 
    devices, 
    activeDevices, 
    getCallConstraints 
  } = useEnhancedCall(socket, username);

  // ==================== CREATE PEER CONNECTION ====================
  const createPeerConnection = useCallback((targetUsername) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Initialize quality controller
    const qualityController = new AdaptiveQualityController(pc);
    qualityControllerRef.current = qualityController;
    qualityController.start();

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', {
          to: targetUsername,
          from: username,
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);
      
      if (!remoteStream) {
        const stream = new MediaStream();
        setRemoteStream(stream);
      }

      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        remoteStream?.addTrack(event.track);
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        setCallError(null);
        setCallState('active');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setCallError('Connection lost');
        endCall();
      } else if (pc.connectionState === 'closed') {
        endCall();
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        setCallError('Network connection failed');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, username, remoteStream]);

  // ==================== START CALL ====================
  const startCall = useCallback(async (type, targetUser) => {
    try {
      setCallType(type);
      setCallPeer(targetUser);
      setCallState('calling');
      setCallError(null);

      // Get media constraints from settings
      const constraints = getCallConstraints(type);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = createPeerConnection(targetUser);

      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Optimize RTP senders
      await optimizeRtpSenders(pc, {
        callType: type,
        userAgent: navigator.userAgent
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      // Send offer to peer
      socket.emit('call:offer', {
        to: targetUser,
        from: username,
        callType: type,
        offer: pc.localDescription
      });

      // Set timeout for no answer
      setTimeout(() => {
        if (callState === 'calling') {
          setCallError('No answer');
          endCall();
        }
      }, 30000);

    } catch (err) {
      console.error('Failed to start call:', err);
      setCallError(err.message);
      setCallState('idle');
    }
  }, [username, socket, getCallConstraints, createPeerConnection, callState]);

  // ==================== ANSWER CALL ====================
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      setCallType(incomingCall.callType);
      setCallPeer(incomingCall.from);
      setCallState('active');
      setIncomingCall(null);

      // Get media constraints
      const constraints = getCallConstraints(incomingCall.callType);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current && incomingCall.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = createPeerConnection(incomingCall.from);

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Add any pending ICE candidates
      pendingIceCandidatesRef.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      pendingIceCandidatesRef.current = [];

      // Send answer
      socket.emit('call:answer', {
        to: incomingCall.from,
        from: username,
        answer: pc.localDescription
      });

      // Start call timer
      startCallTimer();

    } catch (err) {
      console.error('Failed to answer call:', err);
      setCallError(err.message);
      endCall();
    }
  }, [incomingCall, username, socket, getCallConstraints, createPeerConnection]);

  // ==================== END CALL ====================
  const endCall = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Stop screen share
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Stop quality controller
    if (qualityControllerRef.current) {
      qualityControllerRef.current.stop();
      qualityControllerRef.current = null;
    }

    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Notify peer
    if (socket && callPeer) {
      socket.emit('call:end', {
        to: callPeer,
        from: username
      });
    }

    // Reset state
    setCallState('idle');
    setCallType(null);
    setCallPeer(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setCallDuration(0);
    setCallError(null);
    pendingIceCandidatesRef.current = [];

  }, [localStream, socket, callPeer, username]);

  // ==================== TOGGLE MUTE ====================
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // ==================== TOGGLE VIDEO ====================
  const toggleVideo = useCallback(() => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream, callType]);

  // ==================== TOGGLE SCREEN SHARE ====================
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (isScreenSharing) {
        await switchBackToCamera(peerConnectionRef.current, localStream);
        setIsScreenSharing(false);
      } else {
        const screenStream = await getScreenStream();
        await switchToScreenShare(peerConnectionRef.current, screenStream, localStream);
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = () => {
          switchBackToCamera(peerConnectionRef.current, localStream);
          setIsScreenSharing(false);
        };
      }
    } catch (err) {
      console.error('Screen share error:', err);
      setCallError('Screen share failed');
    }
  }, [isScreenSharing, localStream]);

  // ==================== START CALL TIMER ====================
  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  // ==================== FORMAT DURATION ====================
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== SOCKET EVENT LISTENERS ====================
  useEffect(() => {
    if (!socket) return;

    const handleCallOffer = (data) => {
      if (callState !== 'idle') {
        socket.emit('call:busy', { to: data.from, from: username });
        return;
      }
      setIncomingCall(data);
    };

    const handleCallAnswer = async (data) => {
      try {
        if (peerConnectionRef.current && data.answer) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          
          // Add pending ICE candidates
          pendingIceCandidatesRef.current.forEach(candidate => {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          });
          pendingIceCandidatesRef.current = [];

          setCallState('active');
          startCallTimer();
        }
      } catch (err) {
        console.error('Failed to handle answer:', err);
      }
    };

    const handleIceCandidate = async (data) => {
      try {
        if (!data.candidate) return;
        
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          pendingIceCandidatesRef.current.push(data.candidate);
        }
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    };

    const handleCallEnd = () => {
      endCall();
    };

    const handleCallReject = () => {
      setCallError('Call rejected');
      endCall();
    };

    const handleCallBusy = () => {
      setCallError('User is busy');
      endCall();
    };

    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:end', handleCallEnd);
    socket.on('call:reject', handleCallReject);
    socket.on('call:busy', handleCallBusy);

    return () => {
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:end', handleCallEnd);
      socket.off('call:reject', handleCallReject);
      socket.off('call:busy', handleCallBusy);
    };
  }, [socket, username, callState, endCall, startCallTimer]);

  // Render nothing if no call is active
  if (callState === 'idle' && !incomingCall) return null;

  return (
    <>
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="incoming-call-modal">
          <div className="incoming-call-content">
            <div className="caller-avatar">
              {incomingCall.from.charAt(0).toUpperCase()}
            </div>
            <h3>{incomingCall.from}</h3>
            <p>{incomingCall.callType === 'video' ? '📹 Video call' : '🎤 Voice call'}</p>
            <div className="incoming-call-actions">
              <button 
                className="reject-btn"
                onClick={() => {
                  socket.emit('call:reject', { to: incomingCall.from, from: username });
                  setIncomingCall(null);
                }}
              >
                <PhoneOff size={20} />
                Decline
              </button>
              <button 
                className="accept-btn"
                onClick={answerCall}
              >
                <Phone size={20} />
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Panel */}
      {callState === 'active' && callPeer && (
        <CallPanel
          callType={callType}
          callPeer={callPeer}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isMinimized={isMinimized}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={endCall}
          onToggleMinimize={() => setIsMinimized(!isMinimized)}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          formatDuration={formatDuration}
          localStream={localStream}
          remoteStream={remoteStream}
          callQuality={callQuality}
        />
      )}

      {/* Calling/Ringing Modal */}
      {callState === 'calling' && callPeer && (
        <div className="calling-modal">
          <div className="calling-content">
            <div className="caller-avatar">
              {callPeer.charAt(0).toUpperCase()}
            </div>
            <h3>Calling {callPeer}...</h3>
            <button className="cancel-call-btn" onClick={endCall}>
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CallManager;