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
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState(null);
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

  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const qualityControllerRef = useRef(null);
  const screenStreamRef = useRef(null);

  const { 
    settings, 
    devices, 
    activeDevices, 
    getCallConstraints 
  } = useEnhancedCall(socket, username);

  const createPeerConnection = useCallback((targetUsername) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    const qualityController = new AdaptiveQualityController(pc);
    qualityControllerRef.current = qualityController;
    qualityController.start();

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', {
          to: targetUsername,
          from: username,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);
      // Always use a single MediaStream instance for remoteStream
      setRemoteStream(prevStream => {
        let stream = prevStream;
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else if (!stream) {
          stream = new MediaStream();
        }
        if (event.track && !stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }
        return stream;
      });
    };

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

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        setCallError('Network connection failed');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, username]);

  const startCall = useCallback(async (type, targetUser) => {
    // Prevent call loop: only allow call if idle
    if (callState !== 'idle') {
      console.warn('Call already in progress, not starting another.');
      return;
    }
    try {
      setCallType(type);
      setCallPeer(targetUser);
      setCallState('calling');
      setCallError(null);

      // Force basic constraints for compatibility
      const constraints = { video: true, audio: true };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.error('[CallManager] getUserMedia failed (startCall):', err);
        setCallError('Camera/mic access denied or unavailable');
        setCallState('idle');
        return;
      }
      setLocalStream(stream);

      // Log local stream tracks for debugging
      const localVideoTracks = stream.getVideoTracks();
      const localAudioTracks = stream.getAudioTracks();
      console.log('[CallManager] Local stream video tracks:', localVideoTracks);
      console.log('[CallManager] Local stream audio tracks:', localAudioTracks);
      if (localVideoTracks.length > 0) {
        localVideoTracks.forEach((track, i) => {
          console.log(`[CallManager] Local video track[${i}]: id=${track.id}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
        });
      } else {
        console.warn('[CallManager] No local video tracks found!');
      }

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(targetUser);
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await optimizeRtpSenders(pc, {
        callType: type,
        userAgent: navigator.userAgent
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      socket.emit('call:offer', {
        to: targetUser,
        from: username,
        callType: type,
        offer: pc.localDescription
      });

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

  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    // Set callState to active early to prevent call loop
    setCallState('active');
    try {
      setCallType(incomingCall.callType);
      setCallPeer(incomingCall.from);
      setIncomingCall(null);

      // Force basic constraints for compatibility
      const constraints = { video: true, audio: true };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.error('[CallManager] getUserMedia failed (answerCall):', err);
        setCallError('Camera/mic access denied or unavailable');
        endCall();
        return;
      }
      setLocalStream(stream);

      if (localVideoRef.current && incomingCall.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(incomingCall.from);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      pendingIceCandidatesRef.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      pendingIceCandidatesRef.current = [];

      socket.emit('call:answer', {
        to: incomingCall.from,
        from: username,
        answer: pc.localDescription
      });

      startCallTimer();

    } catch (err) {
      console.error('Failed to answer call:', err);
      setCallError(err.message);
      endCall();
    }
  }, [incomingCall, username, socket, getCallConstraints, createPeerConnection]);

  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (qualityControllerRef.current) {
      qualityControllerRef.current.stop();
      qualityControllerRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (socket && callPeer) {
      socket.emit('call:end', {
        to: callPeer,
        from: username
      });
    }

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

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream, callType]);

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

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!socket) return;

    const handleCallOffer = (data) => {
      if (callState !== 'idle') {
        console.log('[CallManager] Received call:offer while not idle, sending busy. Current callState:', callState);
        socket.emit('call:busy', { to: data.from, from: username });
        // Never show incoming call modal if not idle
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

  if (callState === 'idle' && !incomingCall) return null;

  return (
    <>
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