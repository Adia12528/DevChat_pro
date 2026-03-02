// src/services/api/livekit.js
export const getLiveKitToken = async (roomName, username, isHost = false) => {
  try {
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 
      (window.location.hostname !== 'localhost' 
        ? "https://devchat-pro.onrender.com" 
        : "http://localhost:5000");
    
    const response = await fetch(
      `${BACKEND_URL}/api/livekit/token?room=${roomName}&username=${username}&isHost=${isHost}`
    );
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Failed to get LiveKit token:', error);
    return null;
  }
};