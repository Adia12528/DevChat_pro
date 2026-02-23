# 📞 Video/Voice Calling Guide

## Overview

DevChat Pro now includes **FREE peer-to-peer video and voice calling** powered by WebRTC. No third-party services, no subscription fees—just direct browser-to-browser communication.

## ✨ Features

### Call Types
- 🎙️ **Voice Calls** - Crystal-clear audio communication
- 🎥 **Video Calls** - High-quality video with camera/mic controls
- 🖥️ **Screen Sharing** - Share your screen during video calls
- 📱 **Cross-Platform** - Works on Windows, Android, iOS, macOS, Linux

### Call Controls
- 🔇 **Mute/Unmute** - Toggle audio on/off
- 📹 **Camera Toggle** - Enable/disable video feed
- 🖥️ **Screen Share** - Share your screen with the other participant
- ↕️ **Minimize/Maximize** - Picture-in-picture mode while chatting
- ⏱️ **Call Timer** - Real-time call duration display
- ❌ **End Call** - Gracefully terminate the connection

### User Experience
- 📳 **Incoming Call Notifications** - Visual modal with ringtone
- 🔔 **Accept/Decline** - Easy call management
- 🎨 **Professional UI** - Clean, WhatsApp-inspired design
- 📱 **Touch-Optimized** - 44px/48px touch targets for mobile
- 🌓 **Dark/Light Theme** - Matches your app theme
- 🔄 **Connection Status** - Real-time connection indicators

## 🚀 How to Use

### Making a Call

1. **Select a User**: Click on a user from the online users dropdown
2. **Choose Call Type**: 
   - Click 🎙️ **Phone icon** for voice call
   - Click 🎥 **Video icon** for video call
3. **Wait for Answer**: The other user will receive a notification
4. **Start Talking**: Once connected, enjoy your call!

### Receiving a Call

1. **Incoming Notification**: A modal appears with caller info
2. **Accept or Decline**:
   - Click ✅ **Accept** to join the call
   - Click ❌ **Decline** to reject
3. **Grant Permissions**: Allow camera/microphone access when prompted
4. **Connected**: Call interface appears automatically

### During a Call

**Full-Screen Mode** (default):
- Large remote video view
- Small picture-in-picture local video (top-right)
- Control bar at the bottom
- Call info overlay (top-left)

**Minimized Mode**:
- Click **Minimize** button
- Call moves to bottom-right corner
- Continue chatting while on call
- Click **Maximize** to restore full-screen

**Controls Available**:
- 🔇 **Mute** - Silence your microphone
- 📹 **Video Off** - Disable your camera (video calls only)
- 🖥️ **Screen Share** - Share your screen (video calls only)
- ↕️ **Minimize/Maximize** - Toggle view mode
- ❌ **End Call** - Hang up

## 🔧 Technical Details

### WebRTC Architecture

```
┌─────────────┐                         ┌─────────────┐
│   User A    │                         │   User B    │
│  (Browser)  │                         │  (Browser)  │
└──────┬──────┘                         └──────┬──────┘
       │                                        │
       │  1. Call Offer (via Socket.io)       │
       ├───────────────────────────────────────>
       │                                        │
       │  2. Call Answer (via Socket.io)      │
       <───────────────────────────────────────┤
       │                                        │
       │  3. ICE Candidates (STUN)            │
       <═══════════════════════════════════════>
       │                                        │
       │  4. Direct P2P Connection (RTP)      │
       <═══════════════════════════════════════>
       │        Audio/Video Stream             │
```

### Components

**Frontend (App.js)**:
- WebRTC state management (12 states)
- RTCPeerConnection with STUN servers
- MediaStream API for camera/mic access
- Socket.io for signaling
- Call UI components (modals, controls, video interface)

**Backend (server.js)**:
- Socket.io signaling server
- Event handlers:
  - `call:offer` - Forward call offers
  - `call:answer` - Forward call answers
  - `call:ice-candidate` - Exchange ICE candidates
  - `call:reject` - Handle call rejections
  - `call:end` - Handle call termination

**STUN Servers** (FREE):
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`
- `stun:stun.services.mozilla.com`

### Browser Requirements

| Browser          | Voice | Video | Screen Share |
|------------------|-------|-------|--------------|
| Chrome 74+       | ✅    | ✅    | ✅           |
| Firefox 66+      | ✅    | ✅    | ✅           |
| Safari 11+       | ✅    | ✅    | ✅ (13+)     |
| Edge 79+         | ✅    | ✅    | ✅           |
| Opera 62+        | ✅    | ✅    | ✅           |
| Samsung Internet | ✅    | ✅    | ✅           |

**Mobile Support**:
- ✅ Android Chrome
- ✅ iOS Safari (iOS 11+)
- ✅ Samsung Internet

### Permissions Required

**Voice Calls**:
- 🎤 Microphone access

**Video Calls**:
- 🎤 Microphone access
- 📹 Camera access

**Screen Sharing**:
- 🖥️ Screen recording permission

*Permissions are requested only when initiating/answering a call*

## 🛡️ Privacy & Security

- ✅ **Peer-to-Peer**: Direct connection between users
- ✅ **No Recording**: Calls are not recorded or stored
- ✅ **Encrypted**: WebRTC uses DTLS-SRTP encryption
- ✅ **No Third-Party**: All traffic is P2P (except signaling)
- ✅ **Permission-Based**: Users control camera/mic access
- ⚠️ **Network Metadata**: Your IP address is visible to the peer

## 🔥 Advanced Features

### Screen Sharing

1. **During a Video Call**: Click the 🖥️ **Screen Share** button
2. **Select Screen**: Choose window/tab/entire screen
3. **Share**: Your screen is now visible to the peer
4. **Stop**: Click 🖥️ again to switch back to camera

### Picture-in-Picture Mode

1. **Minimize Call**: Click ↕️ **Minimize** during a call
2. **Floating Panel**: Call moves to bottom-right corner
3. **Continue Chatting**: Send messages while on call
4. **Restore**: Click ↕️ **Maximize** to go full-screen

### Call Duration Tracking

- ⏱️ Real-time call timer (MM:SS format)
- Starts when call is answered
- Visible in both full-screen and minimized modes

## 🐛 Troubleshooting

### Call Not Connecting

**Problem**: Call offer sent but no answer received

**Solutions**:
1. Check if recipient is online (green dot)
2. Verify both users granted camera/mic permissions
3. Check firewall settings (might block WebRTC)
4. Try refreshing the page
5. Check browser console for errors

### No Audio/Video

**Problem**: Connected but can't hear/see the other person

**Solutions**:
1. Check if you muted your microphone 🔇
2. Verify camera/mic permissions in browser settings
3. Test your devices in system settings
4. Check if other apps are using camera/mic
5. Try switching devices (Settings → Audio/Video)

### Poor Call Quality

**Problem**: Choppy audio/video or frequent disconnections

**Solutions**:
1. Check your internet connection speed
2. Close bandwidth-heavy apps (downloads, streaming)
3. Move closer to WiFi router
4. Switch to voice-only call (less bandwidth)
5. Reduce video quality if possible

### Permissions Denied

**Problem**: Browser blocked camera/microphone access

**Solutions**:
1. Click 🔒 lock icon in address bar
2. Re-enable camera/microphone permissions
3. Refresh the page
4. Try another browser if issue persists

### Screen Share Not Working

**Problem**: Screen share button not responding

**Solutions**:
1. **Chrome/Edge**: Check if running on HTTPS
2. **Safari**: Requires macOS 13+ or iOS 15.1+
3. **Firefox**: Enable in `about:config` → `media.getDisplayMedia.enabled`
4. Try sharing a specific window instead of entire screen

## 📱 Mobile Considerations

### Android
- ✅ Works in Chrome, Samsung Internet, Edge
- 📱 Requires camera/mic permissions
- 🔋 High battery usage during video calls
- 📶 Best on WiFi or 4G/5G

### iOS
- ✅ Works in Safari (iOS 11+)
- 🎥 Video may pause when app is backgrounded
- 🔇 Audio continues in background
- ⚠️ Push notifications not available (browser limitation)

### Best Practices
- Use headphones for better audio quality
- Ensure adequate lighting for video calls
- Keep device charged (calls drain battery)
- Use WiFi when possible

## 🌐 Network Requirements

### Bandwidth
- **Voice Call**: ~50 KB/s (each direction)
- **Video Call (720p)**: ~500 KB/s (each direction)
- **Screen Share**: ~200-800 KB/s (depending on content)

### Ports
- **WebRTC**: UDP ports 1024-65535
- **STUN**: UDP port 3478
- **Signaling**: WebSocket (Socket.io)

### Firewall Considerations
- Most home/office networks: ✅ Works
- Corporate firewalls: ⚠️ May block WebRTC
- School/University networks: ⚠️ May block P2P
- Public WiFi: ⚠️ May have NAT restrictions

## 🎨 UI Components

### Incoming Call Modal
```
┌──────────────────────────┐
│     👤 [Avatar]          │
│                          │
│    📞 Voice Call         │
│    from JohnDoe          │
│                          │
│  [❌ Decline] [✅ Accept]│
└──────────────────────────┘
```

### Active Call (Full-Screen)
```
┌────────────────────────────────┐
│  JohnDoe    00:23 🟢 Connected │
│                                │
│                                │
│     [Remote Video Full]        │
│                                │
│           ┌─────────┐          │
│           │ [Local] │          │
│           └─────────┘          │
│                                │
│  [🔇] [📹] [🖥️] [❌] [↕️]     │
└────────────────────────────────┘
```

### Minimized Call
```
┌──────────────────────────────┐
│ 📞 JohnDoe  00:23            │
│           [↕️ Maximize] [❌] │
└──────────────────────────────┘
```

## 🔮 Future Enhancements

Planned features for future releases:

- [ ] **Group Calls** - Multi-participant video conferences
- [ ] **Call History** - Log of past calls with timestamps
- [ ] **Call Recording** - Save important conversations
- [ ] **Virtual Backgrounds** - Blur/replace your background
- [ ] **Noise Cancellation** - AI-powered background noise removal
- [ ] **TURN Server** - Better connectivity for restrictive networks
- [ ] **End-to-End Encryption** - Enhanced security with custom keys
- [ ] **Call Statistics** - Real-time quality metrics (latency, packet loss)

## 💡 Tips

**For Best Call Quality**:
1. Use wired headphones/headset
2. Close unnecessary browser tabs
3. Disable browser extensions that might interfere
4. Use a stable internet connection
5. Ensure good lighting for video calls

**For Privacy**:
1. Always check what's visible in your camera
2. Use virtual backgrounds if needed
3. Mute when not speaking
4. Turn off camera when appropriate
5. Be aware your IP is visible to the peer

**For Mobile Users**:
1. Use landscape mode for better video experience
2. Keep device charged
3. Connect to WiFi before starting calls
4. Close background apps
5. Use a phone stand for hands-free calls

## 📚 Additional Resources

- **WebRTC Documentation**: https://webrtc.org/
- **MDN WebRTC API**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- **Socket.io Documentation**: https://socket.io/docs/
- **Browser Compatibility**: https://caniuse.com/rtcpeerconnection

## 🆘 Support

**Issues?**
1. Check browser console for errors
2. Verify permissions granted
3. Test with different browser/device
4. Check network connectivity
5. Review troubleshooting section above

**Still Need Help?**
- Open an issue on GitHub
- Check existing issues for similar problems
- Provide browser version, device type, error messages

---

**Enjoy FREE video and voice calling in DevChat Pro! 🎉**

*No subscriptions. No third-party services. Just pure peer-to-peer communication.*
