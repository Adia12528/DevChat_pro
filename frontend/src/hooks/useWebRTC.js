// src/hooks/useWebRTC.js
import { useState, useRef, useCallback, useMemo } from 'react';
import {
  ICE_SERVERS,
  getAdaptiveMediaConstraints,
  getFallbackMediaConstraints,
  getAdaptiveIceTransportPolicy,
  optimizeRtpSenders,
  waitForIceGatheringComplete,
  CallStatistics,
  CallRecorder,
  AdaptiveQualityController,
  CallHistory,
  getScreenStream,
  switchToScreenShare,
  switchBackToCamera
} from '../components/calls/CallUtils';

export const useWebRTC = (username, socketRef) => {
  // States
  const [callState, setCallState] = useState(null);
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
  const [callStats, setCallStats] = useState(null);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('excellent');

  // Refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const callStatsRef = useRef(null);
  const qualityControllerRef = useRef(null);
  const callRecorderRef = useRef(null);
  const screenStreamRef = useRef(null);

  // ==================== UTILITY FUNCTIONS ====================
  const runtimeConnectionInfo = useMemo(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    };
  }, []);

  const iceServersConfig = useMemo(() => ({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: getAdaptiveIceTransportPolicy({
      userAgent: navigator.userAgent,
      connectionInfo: runtimeConnectionInfo
    })
  }), [runtimeConnectionInfo]);

  // ==================== CALL TIMER ====================
  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  // ==================== CREATE PEER CONNECTION ====================
  const createPeerConnection = useCallback((targetUsername) => {
    const pc = new RTCPeerConnection(iceServersConfig);
    
    // Initialize stats
    const stats = new CallStatistics();
    callStatsRef.current = stats;

    // Initialize quality controller
    const qualityController = new AdaptiveQualityController(pc);
    qualityControllerRef.current = qualityController;
    qualityController.start();

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && targetUsername) {
        socketRef.current.emit('call:ice-candidate', {
          to: targetUsername,
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = remoteStreamRef.current || new MediaStream();
      if (event.track) {
        stream.addTrack(event.track);
      }
      setRemoteStream(stream);
      remoteStreamRef.current = stream;
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallError(null);
        // Start stats monitoring
        if (callStatsRef.current) {
          const interval = setInterval(async () => {
            await callStatsRef.current.updateStats(pc);
            setConnectionQuality(callStatsRef.current.getQualityLabel());
          }, 1000);
          return () => clearInterval(interval);
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [iceServersConfig, socketRef]);

  // ==================== START CALL ====================
  const startCall = useCallback(async (type, targetUser) => {
    try {
      setCallType(type);
      setCallPeer({ username: targetUser });
      setCallState('calling');
      setCallError(null);

      const constraints = getAdaptiveMediaConstraints({
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia(
          getFallbackMediaConstraints(type)
        );
      }

      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(targetUser);
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await optimizeRtpSenders(pc, {
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      socketRef.current.emit('call:offer', {
        to: targetUser,
        from: username,
        callType: type,
        offer: pc.localDescription
      });

    } catch (err) {
      setCallError(err.message);
      setCallState('idle');
    }
  }, [username, socketRef, runtimeConnectionInfo, createPeerConnection]);

  // ==================== ANSWER CALL ====================
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      setCallType(incomingCall.callType);
      setCallPeer({ username: incomingCall.from });
      setCallState('active');

      const constraints = getAdaptiveMediaConstraints({
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(incomingCall.from);
      
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Handle pending ICE candidates
      pendingIceCandidatesRef.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      pendingIceCandidatesRef.current = [];

      socketRef.current.emit('call:answer', {
        to: incomingCall.from,
        from: username,
        answer: pc.localDescription
      });

      setIncomingCall(null);
      startCallTimer();

    } catch (err) {
      setCallError(err.message);
      endCall();
    }
  }, [incomingCall, username, socketRef, runtimeConnectionInfo, createPeerConnection, startCallTimer]);

  // ==================== END CALL ====================
  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (qualityControllerRef.current) {
      qualityControllerRef.current.stop();
      qualityControllerRef.current = null;
    }

    stopCallTimer();
    
    setCallState('idle');
    setCallType(null);
    setCallPeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setCallError(null);
  }, [stopCallTimer]);

  // ==================== TOGGLE MUTE ====================
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // ==================== TOGGLE VIDEO ====================
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // ==================== TOGGLE SCREEN SHARE ====================
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (isScreenSharing) {
        await switchBackToCamera(peerConnectionRef.current, localStreamRef.current);
        setIsScreenSharing(false);
      } else {
        const screenStream = await getScreenStream();
        await switchToScreenShare(peerConnectionRef.current, screenStream, localStreamRef.current);
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
      }
    } catch (err) {
      setCallError('Screen share failed: ' + err.message);
    }
  }, [isScreenSharing]);

  return {
    callState,
    callType,
    callPeer,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    incomingCall,
    callError,
    callStats,
    isCallRecording,
    connectionQuality,
    localVideoRef,
    remoteVideoRef,
    setIncomingCall,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  };
};