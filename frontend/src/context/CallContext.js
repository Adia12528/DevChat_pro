import React, { createContext, useContext } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';

const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children, socket, username, room, onlineUsers }) => {
  const webrtc = useWebRTC(username, socket);
  
  return (
    <CallContext.Provider value={webrtc}>
      {children}
    </CallContext.Provider>
  );
};