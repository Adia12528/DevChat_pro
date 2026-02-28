import React from 'react';
import { useLivestream } from '../../hooks/useLivestream';

/**
 * LivestreamHost - UI for hosting a livestream
 * Uses useLivestream hook for state
 */
export function LivestreamHost(props) {
  const livestream = useLivestream();

  // TODO: Integrate LiveKitAPI and host UI

  return (
    <div>
      <h2>Livestream Host</h2>
      {/* Example: Show host info */}
      <div>Host: {livestream.liveStreamInfo?.host}</div>
    </div>
  );
}
