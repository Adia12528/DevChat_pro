
# DevChat Pro

## 🚀 Overview

DevChat Pro is a cross-platform, production-ready chat and calling app with:
- WhatsApp-style friends system (requests, contacts, avatars, real-time presence)
- Persistent chat, message history, typing indicators, read receipts
- **FREE peer-to-peer video/voice/screen-share calls** (WebRTC, no third-party fees)
- Device selection for mic/speaker/camera during calls
- Firebase Auth (Google/phone), JWT backend, Socket.io real-time messaging
- Robust error handling, responsive UI, PWA support, and more

## ✨ Key Features
- **Friend Requests:** Send, accept, reject, and remove friends in real time
- **Contacts List:** WhatsApp-style, with avatars, online status, and search
- **Chat UI:** Persistent chat, message history, typing, read receipts
- **Authentication:** Google/phone login, secure JWT backend
- **Realtime Messaging:** Socket.io, presence, notifications
- **Video/Voice Calls:** P2P WebRTC (voice, video, screen share)
- **Device Selection:** Choose mic, speaker, and camera during calls (see below)
- **Error Handling:** All known runtime/build errors fixed; robust error boundaries
- **Production Ready:** All hooks/state correctly scoped; fully tested

## 📞 Calling & Device Selection

- **Start a Call:** Click the phone (voice) or video icon next to a friend.
- **Device Selection:** During a call, open the settings panel to select your microphone, speaker, or camera. The app defaults to the first available system device, but you can change devices at any time—changes apply instantly.
- **Troubleshooting Voice:**
	- If you can't hear or be heard, check your device selection in the call settings.
	- Make sure your browser has permission to use your mic and speakers.
	- The remote audio output is routed to your selected speaker (if supported by your browser/device).
	- If you see a warning in the console about `setSinkId`, your browser/device may not support output device switching.
	- If issues persist, reload the page and rejoin the call.

## How to Use
1. Log in with Google or phone (Firebase Auth)
2. Add friends by email or unique ID
3. Accept/reject friend requests in real time
4. Chat with friends in WhatsApp-style UI
5. Make free P2P calls (voice/video/screen share)
6. Change mic/speaker/camera during calls as needed

See `frontend/src/features/friends/FriendsFeature.jsx` for the main implementation.

---

For full setup, deployment, and feature details, see the main README sections below. For advanced calling and troubleshooting, see `docs/CALLING_GUIDE.md` and `docs/CHANGELOG.md`.

