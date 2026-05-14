# Friends Calling System - Developer Implementation Guide

## Quick Start

### 1. Backend Setup

The backend is already configured. Just ensure:

```javascript
// In server.js, the setupFriendsFeature is already called
setupFriendsFeature({ app, io, mongoose });
```

### 2. Frontend Setup

Import the calling APIs and functions:

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

### 3. Initialize Socket Events

The socket events are already connected in FriendsFeature.jsx:

```javascript
socket.on('friends:call_incoming', ({ callId, initiatorUniqueId, ... }) => {
  setIncomingCall({ callId, initiatorUniqueId, ... });
});
```

## Calling Flow Implementation

### Voice Call Flow

```
1. User A clicks "Call" button for User B
   ↓
2. Frontend calls initiateCall(token, B.uniqueId, 'voice')
   ↓
3. Backend creates CallSession with state='ringing'
   ↓
4. Backend emits 'friends:call_incoming' to User B
   ↓
5. User B sees incoming call notification
   ↓
6. User B clicks "Answer"
   ↓
7. Frontend calls answerCall(token, callId)
   ↓
8. Backend updates CallSession state='connected'
   ↓
9. Backend emits 'friends:call_answered' to User A
   ↓
10. Both users establish WebRTC connection
    (SDP offer/answer exchanged via Socket.IO)
    ↓
11. Voice connection established
    ↓
12. Either user clicks "End Call"
    ↓
13. Frontend calls endCall(token, callId)
    ↓
14. Backend updates CallSession state='ended'
    ↓
15. Backend calculates duration and saves
    ↓
16. Backend emits 'friends:call_ended' to both users
```

### Video Call Flow

Same as above, but:
1. callType = 'video' instead of 'voice'
2. Both parties must enable camera/microphone
3. SDP offers include video codecs

## WebRTC Integration (Optional but Recommended)

### Setting Up WebRTC Connection

```javascript
// After call is answered
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
});

// Add local stream
navigator.mediaDevices.getUserMedia({ 
  audio: true, 
  video: callType === 'video' 
}).then(stream => {
  stream.getTracks().forEach(track => {
    peerConnection.addTrack(track, stream);
  });
});

// Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('friends:call_ice_candidate', {
      callId,
      toUniqueId: contactUniqueId,
      iceCandidate: event.candidate
    });
  }
};

// Handle remote stream
peerConnection.ontrack = (event) => {
  remoteVideoElement.srcObject = event.streams[0];
};

// Create offer (if initiator)
if (isInitiator) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('friends:call_offer', {
    callId,
    toUniqueId: contactUniqueId,
    sdpOffer: offer
  });
}

// Handle incoming offer
socket.on('friends:call_offer', async ({ callId, fromUniqueId, sdpOffer }) => {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(sdpOffer)
  );
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('friends:call_answer', {
    callId,
    toUniqueId: fromUniqueId,
    sdpAnswer: answer
  });
});

// Handle ICE candidates
socket.on('friends:call_ice_candidate', ({ callId, iceCandidate }) => {
  peerConnection.addIceCandidate(
    new RTCIceCandidate(iceCandidate)
  );
});
```

## UI Components to Create

### 1. Incoming Call Modal

```jsx
const IncomingCallModal = ({ incomingCall, onAnswer, onReject }) => {
  if (!incomingCall) return null;
  
  return (
    <div className="incoming-call-modal">
      <h2>Incoming {incomingCall.callType} Call</h2>
      <p>{incomingCall.initiatorName}</p>
      <img src={incomingCall.initiatorPhoto} alt={incomingCall.initiatorName} />
      <div className="call-actions">
        <button onClick={onReject} className="btn-reject">Reject</button>
        <button onClick={onAnswer} className="btn-accept">Accept</button>
      </div>
    </div>
  );
};
```

### 2. Active Call Panel

```jsx
const ActiveCallPanel = ({ activeCall, callDuration, onEndCall }) => {
  if (!activeCall) return null;
  
  return (
    <div className="active-call-panel">
      <h3>Call Active</h3>
      <div className="call-duration">{formatDuration(callDuration)}</div>
      <div className="call-video">
        <video ref={localVideoRef} autoPlay muted={true} />
        <video ref={remoteVideoRef} autoPlay />
      </div>
      <button onClick={onEndCall} className="btn-end-call">End Call</button>
    </div>
  );
};
```

### 3. Call History

```jsx
const CallHistory = ({ calls, onDeleteCall }) => {
  return (
    <div className="call-history">
      <h3>Call History</h3>
      {calls.map(call => (
        <div key={call.callId} className="call-item">
          <img src={call.otherProfile?.photoURL} alt={call.otherProfile?.displayName} />
          <div className="call-info">
            <p>{call.otherProfile?.displayName}</p>
            <p className="call-type">{call.callType}</p>
            <p className="call-duration">{formatDuration(call.duration)}</p>
          </div>
          <p className="call-date">{formatDate(call.createdAt)}</p>
        </div>
      ))}
    </div>
  );
};
```

### 4. Call Status Selector

```jsx
const CallStatusSelector = ({ status, onStatusChange }) => {
  return (
    <div className="call-status-selector">
      <select value={status} onChange={(e) => onStatusChange(e.target.value)}>
        <option value="available">Available</option>
        <option value="busy">Busy</option>
        <option value="do_not_disturb">Do Not Disturb</option>
      </select>
    </div>
  );
};
```

## Error Handling Patterns

### Common Errors and Solutions

```javascript
// Error: "You cannot call this user"
// Solution: User has blocked recipient or vice versa
// Handle: Show error message, offer to unblock

// Error: "Call is no longer available"
// Solution: Call has ended or recipient already rejected
// Handle: Clear call state, show notification

// Error: "Rate limit exceeded"
// Solution: Too many calls in short time
// Handle: Show retry message after 10 seconds

// Error: "Firebase auth backend not configured"
// Solution: Backend Firebase credentials missing
// Handle: Show admin alert, check backend logs

// Error: "Missing bearer token"
// Solution: User not authenticated
// Handle: Redirect to login
```

## Performance Tips

1. **Lazy Load Call History**
   ```javascript
   const loadCallHistory = async () => {
     const calls = await getCallHistory(authToken, 20);
     // Only load 20 most recent calls
   };
   ```

2. **Debounce Status Updates**
   ```javascript
   const debouncedSetStatus = debounce(handleSetCallStatus, 500);
   ```

3. **Cleanup Call Connections**
   ```javascript
   useEffect(() => {
     return () => {
       if (peerConnection) {
         peerConnection.close();
       }
     };
   }, []);
   ```

4. **Optimize Re-renders**
   ```javascript
   const MemoizedCallPanel = React.memo(ActiveCallPanel, (prev, next) => {
     return prev.callDuration === next.callDuration;
   });
   ```

## Testing Checklist

### Functionality Tests
- [ ] Voice call initiation works
- [ ] Video call initiation works
- [ ] Call ringing notification appears
- [ ] Call answer works
- [ ] Call rejection works
- [ ] Call ending works
- [ ] Call history saves correctly
- [ ] Duration calculates correctly

### Error Handling Tests
- [ ] Calling blocked user shows error
- [ ] Calling non-friend shows error
- [ ] Offline users cannot be called
- [ ] Network failures are handled gracefully

### Integration Tests
- [ ] Friends feature doesn't affect main login
- [ ] Messages work while calls are active
- [ ] Typing indicators work with calls
- [ ] Presence updates work with calls

### Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

## Debugging Tips

### Check Backend Logs

```bash
# Look for [FRIENDS] logs
tail -f logs/server.log | grep '\[FRIENDS\]'
```

### Check Socket.IO Events

```javascript
// Add to console
window.socketDebug = {
  trackEvents: (socket) => {
    const originalEmit = socket.emit;
    socket.emit = function(...args) {
      console.log('EMIT:', args[0]);
      return originalEmit.apply(this, args);
    };
    
    const originalOn = socket.on;
    socket.on = function(event, ...args) {
      console.log('ON:', event);
      return originalOn.apply(this, [event, ...args]);
    };
  }
};

socketDebug.trackEvents(socket);
```

### Check WebRTC Connections

```javascript
// In browser console
peerConnection.getStats().then(stats => {
  stats.forEach(report => {
    console.log(report);
  });
});
```

## Database Monitoring

### Monitor Call Sessions

```javascript
// MongoDB query
db.callsessions.find({ 
  state: 'connected',
  startedAt: { $gte: new Date(Date.now() - 3600000) }
}).count()
```

### Monitor Call History

```javascript
db.callsessions.aggregate([
  { $match: { state: 'ended' } },
  { $group: {
      _id: null,
      totalCalls: { $sum: 1 },
      avgDuration: { $avg: '$duration' },
      totalDuration: { $sum: '$duration' }
    }
  }
])
```

## Optimization Recommendations

1. **Implement Call Recording**
   - Use LiveKit or similar for server-side recording
   - Store recording URL in CallSession.recordingUrl

2. **Add Call Quality Metrics**
   - Collect bandwidth, latency, packet loss
   - Store in CallSession.metadata

3. **Implement Screen Sharing**
   - Create separate stream for screen
   - Toggle between camera and screen

4. **Add Call Transferring**
   - Allow transferring active calls to other contacts
   - Update CallSession with transfer metadata

5. **Implement Call Conference**
   - Support 3+ party calls
   - Use SFU (Selective Forwarding Unit) approach

## Production Deployment

### Environment Variables Required

```bash
FIREBASE_SERVICE_ACCOUNT_JSON=<firebase-admin-sdk-json>
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_CLIENT_EMAIL=<client-email>
FIREBASE_PRIVATE_KEY=<private-key>
MONGO_URI=<mongodb-connection-string>
LIVEKIT_API_KEY=<livekit-key> (optional)
LIVEKIT_API_SECRET=<livekit-secret> (optional)
```

### Monitoring

```javascript
// Setup monitoring
setInterval(() => {
  db.callsessions.countDocuments({ state: 'ringing' }).then(count => {
    if (count > 100) {
      console.warn(`High number of ringing calls: ${count}`);
      // Alert team
    }
  });
}, 60000);
```

### Rate Limiting

Adjust in code:

```javascript
const createSimpleRateLimiter = ({ limit, windowMs }) => {
  // Increase limit for production
  limit: process.env.NODE_ENV === 'production' ? 50 : 20
};
```

## Troubleshooting

### Issue: Calls not received
- Check Socket.IO connection to `/friends` namespace
- Verify Firebase token is valid
- Check browser console for errors

### Issue: Poor call quality
- Check network bandwidth
- Reduce video resolution
- Check ICE candidate exchange

### Issue: Calls timeout
- Verify CALL_TIMEOUT_MS is appropriate
- Check for network issues
- Check firewall/NAT traversal

### Issue: Database errors
- Verify MongoDB connection
- Check indexes are created
- Monitor collection sizes
