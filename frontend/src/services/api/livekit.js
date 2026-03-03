// LiveKit API service for stream token management

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 
  (window.location.hostname !== 'localhost' 
    ? "https://devchat-pro.onrender.com" 
    : "http://localhost:5000");

export const getLiveKitToken = async (roomName, username, isHost = false) => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/livekit/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}&isHost=${isHost}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Failed to get LiveKit token:', error);
    throw error;
  }
};

export const createStreamRoom = async (roomName, username, options = {}) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/livekit/create-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
        username,
        ...options
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to create stream room:', error);
    throw error;
  }
};

export const endStreamRoom = async (roomName, username) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/livekit/end-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
        username
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to end room: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to end stream room:', error);
    throw error;
  }
};

export const getStreamParticipants = async (roomName) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/livekit/participants?room=${encodeURIComponent(roomName)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get participants: ${response.status}`);
    }
    
    const data = await response.json();
    return data.participants || [];
  } catch (error) {
    console.error('Failed to get stream participants:', error);
    return [];
  }
};