import React from 'react';
import { useLivestream } from '../../hooks/useLivestream';

/**
 * LivestreamView - UI for viewing a livestream
 * Uses useLivestream hook for state
 */
export function LivestreamView(props) {
  const livestream = useLivestream();

  // TODO: Integrate LiveKitAPI and viewer UI

  return (
    <div>
      <h2>Livestream Viewer</h2>
      {/* Example: Show viewer info */}
      <div>Session: {livestream.liveStreamInfo?.sessionId}</div>
    </div>
  );
}
