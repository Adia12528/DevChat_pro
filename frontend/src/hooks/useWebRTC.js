import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  ICE_SERVERS,
  getAdaptiveMediaConstraints,
  getFallbackMediaConstraints,
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
    // iceTransportPolicy: getAdaptiveIceTransportPolicy({
    //   userAgent: navigator.userAgent,
    //   connectionInfo: runtimeConnectionInfo
    // })
  }), [runtimeConnectionInfo]);

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

  const createPeerConnection = useCallback((targetUsername) => {
    const pc = new RTCPeerConnection(iceServersConfig);

    const stats = new CallStatistics();
    callStatsRef.current = stats;

    const qualityController = new AdaptiveQualityController(pc);
    qualityControllerRef.current = qualityController;
    qualityController.start();

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && targetUsername) {
        socketRef.current.emit('call:ice-candidate', {
          to: targetUsername,
          candidate: event.candidate
        });
      }
    };

    // Improved ontrack handler for robust remote stream handling (mobile/desktop)
    pc.ontrack = (event) => {
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = new MediaStream();
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
      if (event.track && !stream.getTracks().includes(event.track)) {
        stream.addTrack(event.track);
        // Force update to trigger React re-render
        setRemoteStream(new MediaStream(stream.getTracks()));
        console.log('[WebRTC][ontrack] Added track:', event.track.kind, event.track.id, 'readyState:', event.track.readyState);
        console.log('[WebRTC][ontrack] Remote stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.id}:${t.readyState}`));
      } else {
        console.log('[WebRTC][ontrack] Track already present or missing:', event.track?.kind, event.track?.id);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallError(null);
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
    // Debug: log when peer connection is created
    console.log('[WebRTC] PeerConnection created:', pc);
    return pc;
  }, [iceServersConfig, socketRef]);

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
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(
            getFallbackMediaConstraints(type)
          );
        } catch (err2) {
          setCallError('Could not access camera/microphone. Please check permissions and device availability.');
          setCallState('idle');
          return;
        }
      }

      if (!stream || (!stream.getAudioTracks().length && !stream.getVideoTracks().length)) {
        setCallError('No audio/video devices found. Please connect a microphone or camera.');
        setCallState('idle');
        return;
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
      setCallError('Call setup failed: ' + (err?.message || err));
      setCallState('idle');
    }
  }, [username, socketRef, runtimeConnectionInfo, createPeerConnection]);

  const answerCall = useCallback(async () => {
    // Prevent answering if already in a call
    if (!incomingCall || callState === 'active') {
      console.warn('[WebRTC] Ignoring incoming call: already in a call or no incoming call.');
      return;
    }

    try {
      setCallType(incomingCall.callType);
      setCallPeer({ username: incomingCall.from });
      setCallState('active');

      const constraints = getAdaptiveMediaConstraints({
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(
            getFallbackMediaConstraints(incomingCall.callType)
          );
        } catch (err2) {
          setCallError('Could not access camera/microphone. Please check permissions and device availability.');
          endCall();
          return;
        }
      }

      if (!stream || (!stream.getAudioTracks().length && !stream.getVideoTracks().length)) {
        setCallError('No audio/video devices found. Please connect a microphone or camera.');
        endCall();
        return;
      }

      setLocalStream(stream);
      localStreamRef.current = stream;

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

      socketRef.current.emit('call:answer', {
        to: incomingCall.from,
        from: username,
        answer: pc.localDescription
      });

      setIncomingCall(null);
      startCallTimer();

    } catch (err) {
      setCallError('Call answer failed: ' + (err?.message || err));
      endCall();
    }
  }, [incomingCall, username, socketRef, runtimeConnectionInfo, createPeerConnection, startCallTimer]);

  const handleCallAnswer = useCallback(async (payload) => {
    try {
      if (!payload?.answer || !peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));

      pendingIceCandidatesRef.current.forEach(candidate => {
        peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      });
      pendingIceCandidatesRef.current = [];

      setCallState('active');
      startCallTimer();
    } catch (err) {
      setCallError('Failed to establish call connection.');
      endCall();
    }
  }, [startCallTimer, endCall]);

  const handleIceCandidate = useCallback(async (payload) => {
    try {
      if (!payload?.candidate) return;
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        pendingIceCandidatesRef.current.push(payload.candidate);
      }
    } catch {
      // Ignore malformed/late ICE candidates.
    }
  }, []);

  const rejectIncomingCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) {
      setIncomingCall(null);
      return;
    }
    socketRef.current.emit('call:reject', {
      to: incomingCall.from,
      from: username
    });
    setIncomingCall(null);
    setCallState('idle');
  }, [incomingCall, socketRef, username]);

  const endCall = useCallback((notifyPeer = true) => {
    const targetPeer = callPeer?.username;
    if (
      notifyPeer &&
      socketRef.current &&
      targetPeer &&
      (callState === 'active' || callState === 'calling' || callState === 'ringing')
    ) {
      socketRef.current.emit('call:end', {
        to: targetPeer,
        from: username
      });
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      // Also clear the video element if possible
      if (localVideoRef && localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
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
  }, [stopCallTimer, callPeer, callState, socketRef, username]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

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

  useEffect(() => {
    if (!socketRef.current) return undefined;
    const socket = socketRef.current;

    const onCallOffer = (data = {}) => {
      if (callState !== 'idle') {
        socket.emit('call:busy', { to: data.from, from: username });
        return;
      }
      setCallError(null);
      setCallState('ringing');
      setIncomingCall({
        from: data.from,
        callType: data.callType,
        offer: data.offer
      });
    };

    const onCallAnswer = (data) => {
      handleCallAnswer(data);
    };

    const onCallIce = (data) => {
      handleIceCandidate(data);
    };

    const onCallRejected = () => {
      setCallError('Call rejected.');
      endCall(false);
    };

    const onCallEnded = () => {
      endCall(false);
    };

    const onCallBusy = () => {
      setCallError('User is busy.');
      endCall(false);
    };

    socket.on('call:offer', onCallOffer);
    socket.on('call:answer', onCallAnswer);
    socket.on('call:ice-candidate', onCallIce);
    socket.on('call:reject', onCallRejected);
    socket.on('call:rejected', onCallRejected);
    socket.on('call:end', onCallEnded);
    socket.on('call:ended', onCallEnded);
    socket.on('call:busy', onCallBusy);

    return () => {
      socket.off('call:offer', onCallOffer);
      socket.off('call:answer', onCallAnswer);
      socket.off('call:ice-candidate', onCallIce);
      socket.off('call:reject', onCallRejected);
      socket.off('call:rejected', onCallRejected);
      socket.off('call:end', onCallEnded);
      socket.off('call:ended', onCallEnded);
      socket.off('call:busy', onCallBusy);
    };
  }, [socketRef, callState, username, handleCallAnswer, handleIceCandidate, endCall]);

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
    rejectIncomingCall,
    handleCallAnswer,
    handleIceCandidate,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  };
};
