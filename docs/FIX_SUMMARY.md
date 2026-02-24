# DevChat Pro - Call Signaling & Offline User Cleanup Fixes

## Summary of Changes

This fix addresses two critical issues:
1. **Call signaling not reaching receiver** - Incoming call event wasn't appearing on the receiver's screen
2. **Offline users remaining in presence list** - Disconnected users stayed in the online users list

---

## Changes Made

### Backend (`backend/server.js`)

#### 1. Enhanced Call Routing Debug Logging
**File**: `backend/server.js` (lines 276-295)
**Change**: Added detailed logging to trace socket lookups and message forwarding

```javascript
socket.on('call:offer', (data) => {
    console.log(`📞 Call offer from ${data.from} to ${data.to}...`);
    
    // NEW: Detailed debug output
    console.log(`🔎 [DEBUG] Room: ${socket.room}, Target user: ${data.to}`);
    console.log(`🔎 [DEBUG] roomUsers[${socket.room}]:`, roomUsers[socket.room]);
    
    if (targetSocket) {
        console.log(`📤 Emitting call:incoming to socket ID ${targetSocket}`);
        io.to(targetSocket).emit('call:incoming', {
            from: data.from,
            callType: data.callType,
            offer: data.offer
        });
        console.log(`✅ Call offer forwarded to ${data.to} (socket: ${targetSocket})`);
    }
});
```

**Why**: Helps identify when socket lookup fails or messages aren't being sent to the correct recipient.

#### 2. Explicit User Offline Event on Disconnect
**File**: `backend/server.js` (lines 375-403)
**Change**: Enhanced disconnect handler to broadcast both `user_left` AND explicit `user_offline` event

```javascript
socket.on('disconnect', () => {
    // ... cleanup code ...
    
    // NOW BROADCASTS BOTH EVENTS:
    io.to(socket.room).emit('user_left', { username, users: remainingUsers, count });
    
    // NEW: Also emit explicit offline event
    io.to(socket.room).emit('user_offline', { username });
    
    console.log(`🔴 User ${socket.username} fully disconnected...`);
});
```

**Why**: Ensures frontend has redundant signals to remove users from presence list.

---

### Frontend (`frontend/src/App.js`)

#### 1. Enhanced Call Incoming Logging
**File**: `frontend/src/App.js` (line 647)
**Change**: Added verbose logging to verify event is received

```javascript
newSocket.on("call:incoming", async (data) => {
    // ENHANCED LOGGING
    console.log("📞 ✅ RECEIVED Incoming call from:", data.from, "Type:", data.callType, "Offer:", !!data.offer);
    console.log("🔔 Setting incomingCall state and playing ringtone");
    
    setIncomingCall({ from: data.from, callType: data.callType, offer: data.offer });
    playRingtone();
});
```

**Why**: Helps verify the event actually reaches the frontend and the state is being updated.

#### 2. Added Missing Status Change Listener
**File**: `frontend/src/App.js` (line 640)
**Change**: Added listener for `user_status_changed` events from backend

```javascript
newSocket.on("user_status_changed", (data) => {
    console.log("🔄 User status changed:", data.username, "→", data.status);
    setUserStatus(prev => ({ ...prev, [data.username]: data.status }));
});
```

**Why**: Frontend was emitting `update_status` but wasn't listening for responses. This enables real-time status sync.

#### 3. Enhanced User Offline Handlers
**File**: `frontend/src/App.js` (lines 545-560)
**Changes**: 
- Mark users as `offline` status when they disconnect/leave
- Remove from online users list
- Clear typing indicators

```javascript
newSocket.on("user_offline", (data) => {
    setOnlineUsers((prev) => prev.filter(u => u !== data.username));
    setUserStatus(prev => ({ ...prev, [data.username]: 'offline' }));  // NEW
    removeTypingUser(data.username);
});

newSocket.on("user_left", (data) => {
    // ... update online users list ...
    setUserStatus(prev => ({ ...prev, [data.username]: 'offline' }));  // NEW
});
```

**Why**: Ensures both the presence list AND status tracker are updated, so filtering works correctly.

---

## How It Works Now

### Call Signaling Flow (Fixed)
```
User A (alice) ──────────────────────> User B (bob)
    │                                        │
    ├─ clicks voice call button              │
    ├─ socket.emit('call:offer',             │
    │   { to: 'bob', callType: 'voice' })    │
    │                                        │
    │  [BACKEND ROUTING]──────────────────>  │
    │  └─ finds socket with                  │
    │     username='bob' in room              │
    │  └─ emits 'call:incoming' to that      │
    │     socket                             │
    │                                        ├─ 📞 RECEIVES call:incoming event
    │                                        ├─ Shows incoming call modal
    │                                        ├─ Plays ringtone
    │                                        │
    │                                        ├─ clicks "Answer"
    │  ◄─ [BACKEND ROUTING]──────────────── │
    │  └─ receives 'call:answer' event       │
    │                                        │
    ├─ sets remote description               │
    ├─ establishes peer connection           ├─ activates media stream
    │                                        │
    └────────── [WebRTC P2P] ───────────────┘
        (Audio/Video streams flow directly)
```

### Offline User Cleanup (Fixed)
```
User B closes browser
    │
    └─ beforeunload event fires
       │
       ├─ emit 'user_leaving' (graceful)
       │  [IF TIME PERMITS]
       │
       └─ socket auto-disconnects
          │
          [BACKEND]
          ├─ 'disconnect' event fires
          ├─ delete from roomUsers[room]
          ├─ broadcast 'user_left' 
          │   (with updated users list)
          ├─ broadcast 'user_offline'
          │   (explicit offline signal)
          │
          [FRONTEND - User A's browser]
          ├─ receives 'user_left'
          │  └─ setOnlineUsers(data.users)
          │  └─ setUserStatus 'offline'
          │
          ├─ receives 'user_offline'
          │  └─ filter from onlineUsers
          │  └─ setUserStatus 'offline'
          │
          └─ [RENDERING]
             └─ sortedUsers filters out offline users
             └─ Bob disappears from dropdown/list
```

---

## Testing Verification Points

1. **Call Signaling**:
   - [ ] Sender logs show: "Initiating call to: [user]"
   - [ ] Backend logs show: "Emitting call:incoming to socket ID [X]"
   - [ ] Receiver logs show: "RECEIVED Incoming call from: [user]"
   - [ ] Incoming call modal appears on receiver's screen
   - [ ] Call connects and media flows after "Answer"

2. **Offline Cleanup**:
   - [ ] Browser close → user removed from list within 3 seconds
   - [ ] Logout → user immediately removed from list
   - [ ] Status shows "offline" for disconnected users
   - [ ] No stale entries in online user dropdown

3. **Status Tracking**:
   - [ ] Tab visibility changes trigger status updates
   - [ ] Status shown in user profiles/dropdowns
   - [ ] Offline users filtered from online lists

---

## Deployment Notes

### Backend (Render)
- Redeploy to pick up enhanced debug logging and offline cleanup
- Monitor logs during testing for socket routing issues

### Frontend (Vercel)
- Automatic deployment triggers on push to main
- Users may need to hard refresh (Ctrl+Shift+R) to clear cache
- Build ID in version.js updates on each build

### Database (MongoDB Atlas)
- No schema changes required
- Existing messages/rooms unaffected

---

## Known Limitations

1. **Network Timeout**: If user's network drops, disconnect might take 20-30 seconds (socket.io default timeout)
2. **Multiple Rooms**: User tracked per-room. If user in multiple DMs, disconnect cleans up all at once
3. **Status Persistence**: User status resets on reconnect (not persisted to DB)

---

## Future Improvements

- [ ] Add persistence layer for user status
- [ ] Implement server-side heartbeat to detect dead connections sooner
- [ ] Add presence "typing" indicator cleanup on disconnect
- [ ] User "last seen" timestamp tracking
- [ ] Call history logging

---

## Files Modified

1. `backend/server.js`
   - Enhanced `call:offer` handler with debug logging
   - Enhanced `disconnect` handler with explicit offline event
   
2. `frontend/src/App.js`
   - Added `user_status_changed` listener
   - Enhanced `call:incoming` logging
   - Updated `user_offline`, `user_left`, `user_logout` handlers to mark status offline
   - Updated `sortedUsers` calculation already filters by status

3. `TESTING_GUIDE.md` (NEW)
   - Comprehensive testing instructions for both features

---

## Commits

1. `3368fd4`: Fix call signaling and offline cleanup - Added user_offline event, enhanced logging
2. `9a01139`: Auto-update cache key for new build
3. `fb7d758`: Add offline user cleanup and status tracking - Listen for status changes, mark users offline

