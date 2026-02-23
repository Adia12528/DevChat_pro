# Testing Guide: Call Signaling & Offline User Cleanup

## Overview
This guide helps verify that:
1. **Call signaling** works reliably between DM users
2. **Offline user cleanup** removes disconnected users from presence lists
3. **Status tracking** properly reflects user availability

---

## Prerequisites
- Two browser tabs/instances ready (or two different browsers)
- Backend deployed (Render)
- Frontend deployed (Vercel)
- Both users logged in to different accounts

---

## Test 1: Call Signaling (Voice/Video)

### Setup
1. **User A**: Login to DevChat, open DM with User B
2. **User B**: Login to DevChat, open DM with User A (ensure they see each other in online list)
3. Open browser DevTools (F12) on both tabs to see console logs

### Test Steps

#### Test 1a: Voice Call
1. **User A** clicks the 📞 (voice call) button in the DM header
2. **Expected on User A**:
   - Console: `📞 Initiating call to: [User B]`
   - Call state shows "Calling..."
   - Ringtone starts playing
3. **Expected on User B**:
   - Console: `📞 ✅ RECEIVED Incoming call from: [User A]`
   - **Incoming call modal** appears with User A's avatar
   - "Decline" and "Answer" buttons visible
   - Ringtone starts playing
4. **User B** clicks "Answer"
5. **Expected**:
   - Both see active call UI with media streams
   - Audio should be working (test by speaking)
6. **User A** clicks "End Call"
7. **Expected**: Both return to DM chat view

#### Test 1b: Video Call
1. **User A** clicks the 📹 (video call) button
2. Repeat expectations from 1a, but verify:
   - Video preview appears in modal/call view
   - Both see each other's video streams (if camera permissions granted)

### Debugging if Test 1 Fails

**Symptom**: "Call doesn't appear on receiver's screen"
- Check **backend logs** for:
  - `📞 Call offer from [A] to [B]`
  - `🔎 call:offer target [B]: socket [ID]` (should show a socket ID, not "not found")
  - `📤 Emitting call:incoming to socket ID [ID]`
- Check **frontend (receiver) logs** for:
  - `👤 User joined: [A]` (when A joined the room)
  - `📞 ✅ RECEIVED Incoming call from: [A]` (should appear when call sent)
- If "not found": **Users not in same room**. Check:
  - Both joined DM room `[alphabetically_first]_dm_[alphabetically_second]`
  - Backend shows both in `roomUsers[room]`

**Symptom**: "Call appears but modal doesn't show"
- Verify `incomingCall` state is being set (console should show: `🔔 Setting incomingCall state...`)
- Check CSS/rendering: modal might be off-screen or hidden

---

## Test 2: Offline User Cleanup

### Setup
1. **User A**: Login, open User list/search view
2. **User B**: Login (ensure visible in User A's online list)
3. Open backend logs to monitor

### Test 2a: Graceful Logout
1. **User B** clicks "Logout"
2. **Expected on User B**:
   - Redirected to login page
3. **Expected on User A**:
   - Console: `👤 User left: [User B]`
   - Console: `🔌 User went offline: [User B]`
   - **User B disappears from online user list**
   - If User list is sorted, it's no longer shown (or grayed out)
4. **Backend logs**:
   - Should show `user_leaving` and `disconnect` events with proper cleanup

### Test 2b: Browser Close
1. **User A**: Refresh to ensure fresh state, open User list
2. **User B**: Refresh to ensure fresh state, appears in User A's list
3. **User B**: Close the browser tab entirely
4. **Wait 2-3 seconds** for disconnect to propagate
5. **Expected on User A**:
   - Console: `👤 User left: [User B]`
   - Console: `🔌 User went offline: [User B]`
   - **User B removed from online list within 3 seconds**
6. **Backend logs**:
   - Should show `❌ Disconnected: [socket_id]`
   - Should show `user_left` broadcast with updated roster
   - Should show `user_offline` event

### Test 2c: Network Disconnect
1. **User A**: Open DevTools Network tab, throttle (e.g., offline mode)
2. **User B**: Open DM with User A
3. **User A**: Turn off network (DevTools → offline, or unplug WiFi)
4. **Wait 5-10 seconds** for socket timeout
5. **Expected on User B**:
   - Console shows `👤 User left: [User A]` (eventually)
   - **User A removed from online list after timeout**
6. **Turn User A's network back on** → automatically reconnects

### Test 2d: Status Tracking
1. Ensure both users in same room
2. **User A**: Hide/minimize tab
3. **Expected on User B**:
   - Console: `🔄 User status changed: [User A] → away`
   - **User A's status badge** shown as "away" (if visible in UI)
4. **User A**: Bring tab back to focus
5. **Expected on User B**:
   - Console: `🔄 User status changed: [User A] → online`
   - **User A's status badge** back to "online"

### Debugging if Test 2 Fails

**Symptom**: "Offline users still appear in list"
- Check frontend's `sortedUsers` calculation (line ~775):
  - Should filter out users with `userStatus[u] === 'offline'`
- Check `user_offline` handler is registered and calling `setUserStatus`
- Verify backend's `disconnect` handler is actually being called:
  - Add temporary logs or check server output

**Symptom**: "Status not updating in real-time"
- Check if `user_status_changed` handler is registered (should be added in this fix)
- Verify backend is emitting `user_status_changed` (not `update_status`)
- Check `update_status` events are being sent from frontend (visibility changes)

---

## Console Log Checklist

### For Call Signaling
- [ ] Caller: `📞 Initiating call to: [user]`
- [ ] Sender backend: `📞 Call offer from [A] to [B]`
- [ ] Sender backend: `📤 Emitting call:incoming to socket ID [ID]`
- [ ] Receiver: `📞 ✅ RECEIVED Incoming call from: [A]`
- [ ] Receiver: `🔔 Setting incomingCall state...`

### For Offline Cleanup
- [ ] Logout: `👋 User explicitly leaving: [user]`
- [ ] Disconnect: `❌ Disconnected: [socket_id]`
- [ ] Room broadcast: `👤 User left: [user]`
- [ ] Offline event: `🔌 User went offline: [user]`
- [ ] Receiver: `👤 User left: [user]`
- [ ] Receiver: `🔌 User went offline: [user]`

### For Status
- [ ] Status change: `🔄 User status changed: [user] → [status]`
- [ ] Visibility: `update_status: [status]` sent from frontend

---

## Expected Behavior Summary

| Action | User A Console | User B Console | User B UI |
|--------|---|---|---|
| **A calls B** | "Initiating call" | "RECEIVED Incoming call" | Modal appears |
| **B answers** | "Call answered" | "Answering call" | Streams active |
| **B goes offline** | "User left", "offline" | — | Roster updated |
| **A minimizes tab** | "Status → away" | "Status → away" | Status badge |
| **A maximizes tab** | "Status → online" | "Status → online" | Status badge |

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Call doesn't appear | Verify users in same `_dm_` room. Check backend logs for socket lookup. |
| Offline users remain | Ensure `user_offline` event handler exists. Check `userStatus` state update. |
| Status not syncing | Verify `user_status_changed` listener. Check backend emits after `update_status`. |
| Ringtone not playing | Check browser audio permissions. Verify `playRingtone()` is called. |
| No media stream | Check permissions (camera/microphone). Verify `getUserMedia()` succeeds. |

---

## Deployment Steps After Testing

1. **Local testing passed**: ✓
2. **Verify backend deployed** (Render):
   - Check `/health` endpoint is responding
   - Verify new code is running (check logs for enhanced debug output)
3. **Verify frontend deployed** (Vercel):
   - Hard refresh (Ctrl+Shift+R) to clear old cache
   - Check console for "Build ID" in version logs
4. **Production testing**:
   - Test all scenarios again in production environment
   - Monitor logs for any errors

