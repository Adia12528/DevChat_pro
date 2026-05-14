# Friends Login & Calling System Upgrade

## Overview

This upgrade enhances the DevChat Friends login system with enterprise-grade calling and video calling capabilities, comparable to WhatsApp and Wire, while maintaining complete separation from the main DevChat login system.

## Key Features

### 1. **Enhanced Authentication**
- Firebase-based authentication (Google OAuth, Phone OTP)
- Automatic user profile creation and synchronization
- Session management with call status tracking
- Token-based REST API access

### 2. **Call Management**
- **Voice Calls**: Real-time peer-to-peer audio communication
- **Video Calls**: Real-time peer-to-peer video communication
- Call initiation, ringing, answer, rejection, and end states
- Call history with duration and metadata
- Call notifications with real-time updates

### 3. **User Status & Presence**
- Call availability status: `available`, `busy`, `do_not_disturb`
- Real-time presence updates (online/offline)
- Last seen timestamp tracking
- Contact blocking and unblocking

### 4. **Call Session Tracking**
- Complete call history with timestamps
- Call duration calculation
- Call state management (ringing, connected, ended, missed, rejected)
- Call metadata storage for analytics

### 5. **Real-time Communication**
- Socket.IO namespace isolation for friends feature
- WebRTC signaling through Socket.IO
- ICE candidate exchange
- SDP offer/answer exchange

## Backend Architecture

### Database Models

#### FriendProfile Schema
```javascript
{
  uid: String (unique, indexed),
  uniqueId: String (unique, indexed),
  displayName: String,
  bio: String,
  email: String,
  phoneNumber: String,
  photoURL: String,
  contacts: [String],
  contactPrefs: Map,
  settings: { theme, notifications, callNotifications },
  callStatus: String ('available', 'busy', 'do_not_disturb'),
  lastCallAt: Date,
  blockedUsers: [String]
}
```

#### CallSession Schema
```javascript
{
  callId: String (unique, indexed),
  initiatorUid: String (indexed),
  recipientUid: String (indexed),
  callType: String ('voice' or 'video'),
  state: String ('ringing', 'connected', 'ended', 'missed', 'rejected'),
  startedAt: Date,
  endedAt: Date,
  duration: Number (seconds),
  rejectionReason: String,
  isAnswered: Boolean,
  recordingUrl: String,
  metadata: {
    initiatorDeviceId: String,
    recipientDeviceId: String,
    quality: String ('low', 'medium', 'high')
  }
}
```

#### FriendMessage Schema
```javascript
{
  conversationId: String (indexed),
  fromUid: String (indexed),
  toUid: String (indexed),
  clientTempId: String (indexed for idempotency),
  text: String,
  disappearPolicy: Object,
  expiresAt: Date,
  deliveredAt: Date,
  readAt: Date,
  reactions: Array,
  editedAt: Date,
  deleted: Boolean
}
```

### REST API Endpoints

#### Calling Endpoints

**Initiate a Call**
```
POST /api/friends/calls/initiate
Authorization: Bearer <token>
{
  recipientUniqueId: String,
  callType: 'voice' | 'video',
  deviceId: String (optional),
  quality: 'low' | 'medium' | 'high'
}
Response: { ok: true, callId, callSession }
```

**Answer a Call**
```
POST /api/friends/calls/:callId/answer
Authorization: Bearer <token>
{
  deviceId: String (optional),
  sdpOffer: String (optional, for WebRTC)
}
Response: { ok: true, callSession }
```

**Reject a Call**
```
POST /api/friends/calls/:callId/reject
Authorization: Bearer <token>
{
  reason: String (default: 'user_rejected')
}
Response: { ok: true }
```

**End a Call**
```
POST /api/friends/calls/:callId/end
Authorization: Bearer <token>
Response: { ok: true, callSession }
```

**Get Call History**
```
GET /api/friends/calls/history/:limit
Authorization: Bearer <token>
Response: { calls: [CallSession] }
```

#### Blocking Endpoints

**Block a User**
```
POST /api/friends/block
Authorization: Bearer <token>
{
  targetUniqueId: String
}
Response: { ok: true, blocked: true }
```

**Unblock a User**
```
POST /api/friends/unblock
Authorization: Bearer <token>
{
  targetUniqueId: String
}
Response: { ok: true, blocked: false }
```

#### Status Endpoint

**Set Call Availability Status**
```
PUT /api/friends/status
Authorization: Bearer <token>
{
  status: 'available' | 'busy' | 'do_not_disturb'
}
Response: { ok: true, status }
```

### Socket.IO Events

#### Client → Server (Emits)

**Call Signaling**
```javascript
socket.emit('friends:call_offer', {
  callId: String,
  toUniqueId: String,
  sdpOffer: Object,
  iceCandidate: RTCIceCandidate (optional)
});

socket.emit('friends:call_answer', {
  callId: String,
  toUniqueId: String,
  sdpAnswer: Object,
  iceCandidate: RTCIceCandidate (optional)
});

socket.emit('friends:call_ice_candidate', {
  callId: String,
  toUniqueId: String,
  iceCandidate: RTCIceCandidate
});
```

#### Server → Client (Broadcasts)

**Incoming Call**
```javascript
socket.on('friends:call_incoming', {
  callId: String,
  initiatorUniqueId: String,
  initiatorName: String,
  callType: 'voice' | 'video',
  createdAt: Date
});
```

**Call Answered**
```javascript
socket.on('friends:call_answered', {
  callId: String,
  recipientUniqueId: String,
  recipientName: String,
  recipientPhoto: String,
  sdpOffer: Object (optional)
});
```

**Call Rejected**
```javascript
socket.on('friends:call_rejected', {
  callId: String,
  reason: String
});
```

**Call Ended**
```javascript
socket.on('friends:call_ended', {
  callId: String,
  duration: Number,
  endedAt: Date
});
```

**ICE Candidate**
```javascript
socket.on('friends:call_ice_candidate', {
  callId: String,
  fromUniqueId: String,
  iceCandidate: RTCIceCandidate
});
```

**Call Offer**
```javascript
socket.on('friends:call_offer', {
  callId: String,
  fromUniqueId: String,
  sdpOffer: Object
});
```

**Call Answer**
```javascript
socket.on('friends:call_answer', {
  callId: String,
  fromUniqueId: String,
  sdpAnswer: Object
});
```

**Status Updated**
```javascript
socket.on('friends:status_updated', {
  uniqueId: String,
  status: 'available' | 'busy' | 'do_not_disturb'
});
```

## Frontend Implementation

### API Imports

```javascript
import {
  initiateCall,
  answerCall,
  rejectCall,
  endCall,
  getCallHistory,
  blockUser,
  unblockUser,
  setCallStatus
} from './friendsApi';
```

### State Management

```javascript
const [incomingCall, setIncomingCall] = useState(null);
const [activeCall, setActiveCall] = useState(null);
const [callHistory, setCallHistory] = useState([]);
const [callStatus, setCallStatus] = useState('available');
const [blockedUsers, setBlockedUsers] = useState([]);
const [callDuration, setCallDuration] = useState(0);
```

### Event Handlers

```javascript
// Initiate a call
const handleInitiateCall = async (contactUniqueId, callType) => {
  const response = await initiateCall(authToken, contactUniqueId, callType);
  setActiveCall({
    callId: response.callId,
    contactUniqueId,
    callType,
    startedAt: new Date()
  });
};

// Answer incoming call
const handleAnswerCall = async () => {
  await answerCall(authToken, incomingCall.callId);
  setActiveCall({
    callId: incomingCall.callId,
    contactUniqueId: incomingCall.initiatorUniqueId,
    callType: incomingCall.callType,
    startedAt: new Date()
  });
  setIncomingCall(null);
};

// Reject call
const handleRejectCall = async () => {
  await rejectCall(authToken, incomingCall.callId);
  setIncomingCall(null);
};

// End active call
const handleEndCall = async () => {
  await endCall(authToken, activeCall.callId);
  setActiveCall(null);
};

// Block user
const handleBlockUser = async (targetUniqueId) => {
  await blockUser(authToken, targetUniqueId);
  setBlockedUsers([...blockedUsers, targetUniqueId]);
};

// Set call status
const handleSetCallStatus = async (status) => {
  await setCallStatus(authToken, status);
  setCallStatus(status);
};
```

### Socket Events

```javascript
socket.on('friends:call_incoming', ({ callId, initiatorUniqueId, initiatorName, callType }) => {
  setIncomingCall({ callId, initiatorUniqueId, initiatorName, callType });
  playNotificationTone('chime');
});

socket.on('friends:call_answered', ({ callId }) => {
  if (activeCall?.callId === callId) {
    startCallDurationTimer();
  }
});

socket.on('friends:call_rejected', ({ callId, reason }) => {
  if (activeCall?.callId === callId) {
    setActiveCall(null);
  }
});

socket.on('friends:call_ended', ({ callId, duration }) => {
  if (activeCall?.callId === callId) {
    setActiveCall(null);
  }
});
```

## Main DevChat Login - No Changes

The main DevChat login system remains completely unaffected:

- **Separate Authentication**: Friends feature uses Firebase Auth, while main chat uses the existing auth system
- **Isolated Namespace**: Friends use `/friends` Socket.IO namespace, main chat uses different namespaces
- **Independent Routes**: Friends API routes are at `/api/friends/*`, no conflict with main routes
- **Separate Database Collections**: Friends data uses distinct MongoDB collections
- **No Shared State**: Friends session is independent from main DevChat session

## Security Considerations

1. **Token Verification**: All endpoints verify Firebase ID tokens
2. **User Authorization**: Calls can only be initiated between contacts or friends
3. **Blocking Enforcement**: Blocked users cannot initiate calls or send messages
4. **Rate Limiting**: Rate limiters prevent abuse of calling, messaging, and typing events
5. **Message Sanitization**: All message text is sanitized before storage
6. **CORS Configuration**: Properly configured CORS for frontend domain

## Error Handling

All calling operations include comprehensive error handling:

- Invalid call state transitions are rejected
- Blocked users cannot call each other
- Expired or invalid tokens return 401
- Non-existent users/calls return 404
- Rate limiting returns rate limit errors
- All errors include descriptive messages

## Testing

### Backend Testing

```bash
# Test call initiation
POST /api/friends/calls/initiate
Bearer <token>
{
  "recipientUniqueId": "friend_xxx",
  "callType": "voice"
}

# Test call answer
POST /api/friends/calls/:callId/answer
Bearer <token>
{}

# Test call rejection
POST /api/friends/calls/:callId/reject
Bearer <token>
{ "reason": "user_rejected" }

# Test call ending
POST /api/friends/calls/:callId/end
Bearer <token>
{}
```

### Frontend Testing

1. Open Friends feature in two browsers
2. Login with different Firebase accounts
3. Add each other as friends
4. Initiate a voice/video call
5. Answer the call
6. Verify call duration tracking
7. End the call
8. Check call history

## Performance Optimizations

1. **Indexed Queries**: All frequently searched fields are indexed
2. **Lean Queries**: Messages use `.lean()` to exclude unnecessary data
3. **Call Timeouts**: Calls timeout after 60 seconds of ringing
4. **Efficient Presence**: Only contacts see each other's presence
5. **Rate Limiting**: Prevents message/call flooding

## Future Enhancements

1. **Group Calling**: Support for multi-party calls
2. **Call Recording**: Server-side call recording
3. **Screen Sharing**: Share screen during video calls
4. **Transcription**: Real-time call transcription
5. **Analytics**: Call duration and quality analytics
6. **Quality Adaptation**: Automatic quality adjustment based on network

## Migration Guide

No migration needed. The Friends feature is completely new and doesn't affect existing users:

1. Existing DevChat users continue to work as before
2. New Friends feature is opt-in via Firebase Auth
3. No database migration required
4. No breaking changes to main application

## Support

For issues or questions, refer to:
- Backend error logs: Check console for '[FRIENDS]' prefixed messages
- Frontend errors: Check browser console for 'friends:error' events
- Socket.IO connection: Verify `/friends` namespace connection
