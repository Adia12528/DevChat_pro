import { useState, useRef, useCallback } from 'react';

/**
 * useCalls - Custom hook for P2P call state and refs
 * Extracted from App.js for modularity
 */
export function useCalls() {
  // Call states
  const [callState, setCallState] = useState(null); // 'idle' | 'calling' | 'ringing' | 'active' | 'ended'
  const [callType, setCallType] = useState(null); // 'voice' | 'video'
  const [callPeer, setCallPeer] = useState(null); // { username, userId }
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null); // { from, callType }
  const [callError, setCallError] = useState(null);

  // Call refs
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const inboundRemoteStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // Utility: Start/stop call timer
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

  // Utility: Format call duration
  const formatCallDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    callState, setCallState,
    callType, setCallType,
    callPeer, setCallPeer,
    isCallMinimized, setIsCallMinimized,
    localStream, setLocalStream,
    remoteStream, setRemoteStream,
    isMuted, setIsMuted,
    isVideoOff, setIsVideoOff,
    isScreenSharing, setIsScreenSharing,
    remoteIsScreenSharing, setRemoteIsScreenSharing,
    callDuration, setCallDuration,
    incomingCall, setIncomingCall,
    callError, setCallError,
    peerConnectionRef,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    inboundRemoteStreamRef,
    callTimerRef,
    callTimeoutRef,
    startCallTimer,
    stopCallTimer,
    formatCallDuration
  };
}
