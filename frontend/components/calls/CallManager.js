import React from 'react';
import { useCalls } from '../../hooks/useCalls';

/**
 * CallManager - Orchestrates P2P call UI and logic
 * Uses useCalls hook for state and PeerConnectionManager for connection
 */
export function CallManager(props) {
  const calls = useCalls();

  // TODO: Integrate PeerConnectionManager and call UI

  return (
    <div>
      {/* Call UI goes here */}
      <h2>Call Manager</h2>
      {/* Example: Show call state */}
      <div>Call State: {calls.callState}</div>
    </div>
  );
}
