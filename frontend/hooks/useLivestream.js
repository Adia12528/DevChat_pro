import { useState, useRef, useCallback } from 'react';

/**
 * useLivestream - Custom hook for streaming (LiveKit/livestream) state and refs
 * Extracted from App.js for modularity
 */
export function useLivestream() {
  // Livestream states
  const [liveStreamInfo, setLiveStreamInfo] = useState(null); // { sessionId, host, room, visibility, source, isHost, viewers, hasAudio }
  const [livestreamComments, setLivestreamComments] = useState([]);
  const [livestreamCommentInput, setLivestreamCommentInput] = useState('');
  const [livestreamViewerExpanded, setLivestreamViewerExpanded] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [callError, setCallError] = useState(null);

  // Livestream refs
  const livestreamHostPeersRef = useRef(new Map());
  const livestreamViewerPeerRef = useRef(null);
  const livestreamLocalStreamRef = useRef(null);

  // Utility: Reset livestream state
  const resetLivestream = useCallback(() => {
    setLiveStreamInfo(null);
    setLivestreamComments([]);
    setLivestreamCommentInput('');
    setLivestreamViewerExpanded(false);
    setSuccessMessage('');
    setCallError(null);
    livestreamHostPeersRef.current.clear();
    livestreamViewerPeerRef.current = null;
    livestreamLocalStreamRef.current = null;
  }, []);

  return {
    liveStreamInfo, setLiveStreamInfo,
    livestreamComments, setLivestreamComments,
    livestreamCommentInput, setLivestreamCommentInput,
    livestreamViewerExpanded, setLivestreamViewerExpanded,
    successMessage, setSuccessMessage,
    callError, setCallError,
    livestreamHostPeersRef,
    livestreamViewerPeerRef,
    livestreamLocalStreamRef,
    resetLivestream
  };
}
