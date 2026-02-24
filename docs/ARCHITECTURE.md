# 🏗️ Enterprise Calling System Architecture

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEVCHAT PRO - CALLING SYSTEM                    │
└─────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────────┐
                            │    App.js Main   │
                            │   React Component│
                            └────────┬─────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼────────┐  ┌────▼────────┐  ┌──▼──────────────┐
            │  Call Logic    │  │ State Mgmt  │  │   Refs Storage  │
            │ - startCall    │  │ - callState │  │ - peerConnection
            │ - answerCall   │  │ - callType  │  │ - localStream
            │ - endCall      │  │ - callPeer  │  │ - remoteStream
            │ - toggleVideo  │  │ - callStats │  │ - callRecorder
            │ - toggleMute   │  │ - callHist  │  │ - statsMonitor
            │ - toggleRecord │  │ - quality   │  │ - qualityCtrl
            └────────────────┘  └─────────────┘  └─────────────────┘


                    ┌──────────────────────────────────────┐
                    │ UI Layer - Components                │
                    ├──────────────────────────────────────┤
                    │                                      │
           ┌────────▼──────┐  ┌──────────────┐  ┌────────▼────────┐
           │ CallPanel.js  │  │ CallHistory  │  │ Call Stats Bar  │
           │               │  │ Panel.js     │  │ & Indicators    │
           │ - Video Grid  │  │              │  │                 │
           │ - Controls    │  │ - Filter     │  │ - Latency       │
           │ - Effects UI  │  │ - Sort       │  │ - Packet Loss   │
           │ - Recording   │  │ - Stats      │  │ - Video FPS     │
           └────────────────┘  └──────────────┘  └─────────────────┘


        ┌──────────────────────────────────────────────────────────┐
        │ callUtils.js - Premium Features Library (400+ lines)    │
        ├──────────────────────────────────────────────────────────┤
        │                                                          │
        │  ┌─────────────────┐  ┌──────────────────┐             │
        │  │ Call Statistics │  │ Call Recorder    │             │
        │  │                 │  │                  │             │
        │  │ Metrics:        │  │ - Audio capture  │             │
        │  │ - Latency       │  │ - WebM format    │             │
        │  │ - Packet Loss   │  │ - Auto-download  │             │
        │  │ - Video FPS     │  │ - Browser compat │             │
        │  │ - Audio Level   │  │                  │             │
        │  │ - Jitter        │  │                  │             │
        │  │ - Quality Score │  │                  │             │
        │  └─────────────────┘  └──────────────────┘             │
        │                                                          │
        │  ┌─────────────────┐  ┌──────────────────┐             │
        │  │ Video Effects   │  │ Adaptive Quality │             │
        │  │ Processor       │  │ Controller       │             │
        │  │                 │  │                  │             │
        │  │ - Brightness    │  │ - Bandwidth Mon. │             │
        │  │ - Contrast      │  │ - Auto-adjust    │             │
        │  │ - Saturation    │  │ - Quality Levels │             │
        │  │ - Blur          │  │ - Fallback Mode  │             │
        │  │ - Canvas Filter │  │                  │             │
        │  └─────────────────┘  └──────────────────┘             │
        │                                                          │
        │  ┌─────────────────┐  ┌──────────────────┐             │
        │  │ Call History    │  │ Screen Sharing   │             │
        │  │ Manager         │  │ Helpers          │             │
        │  │                 │  │                  │             │
        │  │ - localStorage  │  │ - getDisplayMedi │             │
        │  │ - Persistence   │  │ - switchToScreen │             │
        │  │ - Aggregation   │  │ - switchToCamera │             │
        │  │ - Stats logging │  │ - Track replace  │             │
        │  └─────────────────┘  └──────────────────┘             │
        │                                                          │
        └──────────────────────────────────────────────────────────┘


        ┌──────────────────────────────────────────────────────────┐
        │ WebRTC Layer - Browser APIs                             │
        ├──────────────────────────────────────────────────────────┤
        │                                                          │
        │  getUserMedia()  →  getDisplayMedia()  →  RTCPeerConn  │
        │    (camera/mic)      (screen share)      (signaling)   │
        │                                                          │
        │  STUN Servers (6):                                      │
        │  - google.com:19302                                     │
        │  - stunprotocol.org:3478                               │
        │  (and 4 more for redundancy)                           │
        │                                                          │
        └──────────────────────────────────────────────────────────┘


        ┌──────────────────────────────────────────────────────────┐
        │ Network Layer - Socket.io Signaling                     │
        ├──────────────────────────────────────────────────────────┤
        │                                                          │
        │  call:offer  ──────▶ Peer ────────▶ call:answer         │
        │  call:answer ◀───── Peer ◀────────  call:offer          │
        │  call:ice-candidate ──▶ Peer ◀── call:ice-candidate    │
        │  call:end ──────────▶ Peer End Call                    │
        │                                                          │
        └──────────────────────────────────────────────────────────┘


        ┌──────────────────────────────────────────────────────────┐
        │ Data Persistence                                        │
        ├──────────────────────────────────────────────────────────┤
        │                                                          │
        │  localStorage:                                         │
        │  - callHistory (JSON array of calls)                   │
        │  - autoRecordCalls (boolean flag)                      │
        │                                                          │
        │  Browser downloads:                                    │
        │  - Recording files (WebM audio)                        │
        │                                                          │
        └──────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Call Initiation Sequence

```
User Clicks          App.js         callUtils      WebRTC APIs    Socket.io
"Start Call"          │              │               │              │
    │                 │              │               │              │
    ├────startCall()──▶│              │               │              │
    │                 │              │               │              │
    │                 ├─detect device│               │              │
    │                 │              │               │              │
    │                 ├─constraints──▶│ Apply         │              │
    │                 │              │  constraints  │              │
    │                 │                              │              │
    │                 ├─getUserMedia──────────────────▶              │
    │                 │◀──────────stream──────────────┤              │
    │                 │              │               │              │
    │                 ├─init stats──▶│ Start         │              │
    │                 │              │  monitoring   │              │
    │                 │              │               │              │
    │                 ├─init recorder─▶ Create       │              │
    │                 │              │   recorder    │              │
    │                 │              │               │              │
    │                 ├─createPeerConnection─────────▶              │
    │                 │◀──────────────pc──────────────┤              │
    │                 │                              │              │
    │                 ├─addTrack(stream)──────────────▶              │
    │                 │                              │              │
    │                 ├─createOffer──────────────────▶              │
    │                 │                              │              │
    │                 ├─setLocalDescription──────────▶              │
    │                 │                              │              │
    │                 └─emit 'call:offer'──────────────────────────▶
    │                                                  │              │
    └────Call Initiated──────────────────────────────────────────────
```

### Quality Monitoring Loop

```
[Every 1 second]
    │
    ├─→ RTCStats Report ──────────▶ CallStatistics.update()
    │   From RTPInboundStats        │
    │   From RTPOutboundStats       │ Analyze metrics:
    │   From CandidatePairStats     ├─ latency
    │                               ├─ jitter
    │                               ├─ packetLoss
    │                               ├─ videoBitrate
    │                               └─ audioLevel
    │
    ├─→ Calculate Quality Score (0-100)
    │   │
    │   ├─ weight(latency): 0-40ms = 100%, 200ms+ = 0%
    │   ├─ weight(packetLoss): 0% = 100%, 5%+ = 0%
    │   └─ weight(jitter): 0-20ms = 100%, 100ms+ = 0%
    │
    ├─→ Update UI
    │   ├─ setQualityIndicator() → Quality badge
    │   ├─ setConnectionQuality() → Stats color
    │   └─ render CallPanel
    │
    └─→ AdaptiveQualityController.adjust()
        │
        ├─ IF bandwidth < 500kbps:
        │  └─ Reduce to Low quality (320x240)
        │
        ├─ ELSE IF bandwidth < 1.5Mbps:
        │  └─ Reduce to Medium quality (640x480)
        │
        └─ ELSE:
           └─ Use High quality (1280x720)
```

---

## Component Interaction Diagram

```
                        App.js (Main)
                           │
            ┌──────────────┼──────────────┐
            │              │              │
         State          Call Logic      Refs
            │              │              │
            │              ├─ startCall   ├─ peerConnectionRef
            │              ├─ answerCall  ├─ localStreamRef
            │              ├─ endCall     ├─ remoteStreamRef
            │              ├─ toggleVideo ├─ callRecorderRef
            │              ├─ toggleMute  ├─ callHistoryRef
            │              ├─ toggleRecord├─ qualityCtrlRef
            │              └─ ...         └─ ...
            │
            ├─ callState
            ├─ callType
            ├─ callStats
            ├─ callHistory
            └─ quality
                │
                ├────────┬───────────────────┬───────────┐
                │        │                   │           │
            Render     callUtils.js       UI Components  │
            │        (Premium Library)      │           │
            │        │                      │           │
            │        ├─ CallStatistics   ┌──▼─────┐    │
            │        ├─ CallRecorder     │ Call   │    │
            │        ├─ Effects          │ Panel  │    │
            │        ├─ CallHistory      └────────┘    │
            │        ├─ Quality Control                 │
            │        └─ Screen Share   ┌──────────────┐ │
            │                          │Call History  │ │
            │                          │Panel         │ │
            │                          └──────────────┘ │
            │                                           │
            └───────────────────────────────────────────
```

---

## File Relationships

```
App.js (Main Component)
│
├─ imports: callUtils.js (400+ lines)
│   ├─ CallStatistics
│   ├─ CallRecorder
│   ├─ VideoEffectsProcessor
│   ├─ CallHistory
│   ├─ AdaptiveQualityController
│   └─ Helper functions
│
├─ imports: CallPanel.js (300+ lines)
│   ├─ Receives props from App.js state
│   ├─ Handles video rendering
│   └─ Renders call controls
│
├─ imports: CallHistoryPanel.js (200+ lines)
│   ├─ Displays call history
│   ├─ Sorts & filters calls
│   └─ Shows statistics
│
└─ imports: callStyles.css (600+ lines)
    ├─ CallPanel styling
    ├─ CallHistoryPanel styling
    ├─ Animations & effects
    └─ Responsive design

Socket.io (Signaling)
│
├─ emit: call:offer
├─ emit: call:answer
├─ emit: call:ice-candidate
├─ emit: call:end
├─ emit: call:reject
│
└─ on: (same events from peer)

WebRTC APIs
│
├─ getUserMedia() ─→ Access camera/mic
├─ getDisplayMedia() ─→ Screen share
├─ RTCPeerConnection ─→ Data transport
├─ RTCSessionDescription ─→ Offer/Answer
├─ RTCIceCandidate ─→ Network info
└─ getStats() ─→ Quality metrics
```

---

## State Management Flow

```
┌─────────────────────────────────────┐
│ Initial State (idle)                │
│ callState: null                     │
│ callStats: null                     │
│ callHistory: []                     │
└────────────────┬────────────────────┘
                 │
          User clicks call
                 │
        ┌────────▼─────────┐
        │ callState:calling│
        │ Show dialer UI   │
        └────────┬─────────┘
                 │
      Peer answered
                 │
        ┌────────▼─────────┐
        │callState:active  │
        │Show call panel   │
        │Start stats       │
        │Start recorder    │
        └────────┬─────────┘
                 │
       Monitoring (every 1s)
                 │
        ┌────────▼──────────┐
        │ callStats updates │
        │ quality indicator │
        └────────┬──────────┘
                 │
          User ends call
                 │
        ┌────────▼──────────┐
        │ callState:idle    │
        │ Save to history   │
        │ Stop recorder     │
        │ Clear stats       │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │ History persisted │
        │ in localStorage   │
        └───────────────────┘
```

---

## Performance Metrics

```
Build Output:
┌──────────────────────────────────┐
│ JavaScript: 450.42 KB (gzipped)  │
│ CSS: 17.95 KB (gzipped)          │
│ Total: 468 KB                    │
└──────────────────────────────────┘

Runtime Performance:
┌──────────────────────────────────┐
│ Stats Update Frequency: 1000ms   │
│ Target FPS (Desktop): 30fps      │
│ Target FPS (Mobile): 24fps       │
│ Video Bitrate (HD): 2.5 Mbps     │
│ Video Bitrate (Std): 1.5 Mbps    │
│ Video Bitrate (Low): 500 kbps    │
└──────────────────────────────────┘

Memory Usage (estimated):
┌──────────────────────────────────┐
│ CallStatistics: ~5KB             │
│ CallRecorder: ~10KB              │
│ CallHistory: 1-5KB per call      │
│ Quality Controller: ~3KB         │
│ Stream data: Device dependent    │
└──────────────────────────────────┘
```

---

**Architecture Version**: 1.0  
**Date Created**: February 23, 2025  
**Status**: ✅ Complete
