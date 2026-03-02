// PeerConnectionManager.js - Manages WebRTC peer connections
import { 
  ICE_SERVERS,
  getAdaptiveIceTransportPolicy,
  waitForIceGatheringComplete,
  CallStatistics,
  AdaptiveQualityController
} from '../../components/calls/CallUtils';

import MediaManager from './MediaManager';

class PeerConnectionManager {
  constructor(socket, username) {
    this.socket = socket;
    this.username = username;
    this.peerConnections = new Map(); // username -> RTCPeerConnection
    this.mediaManager = new MediaManager();
    this.callStats = new Map(); // username -> CallStatistics
    this.qualityControllers = new Map(); // username -> AdaptiveQualityController
    this.pendingCandidates = new Map(); // username -> RTCIceCandidate[]
  }

  // ==================== CREATE PEER CONNECTION ====================
  createPeerConnection(targetUsername, options = {}) {
    // Check if connection already exists
    if (this.peerConnections.has(targetUsername)) {
      console.warn(`Peer connection to ${targetUsername} already exists`);
      return this.peerConnections.get(targetUsername);
    }

    const iceTransportPolicy = getAdaptiveIceTransportPolicy({
      userAgent: navigator.userAgent
    });

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      iceTransportPolicy
    });

    // Initialize quality controller
    const qualityController = new AdaptiveQualityController(pc);
    this.qualityControllers.set(targetUsername, qualityController);
    qualityController.start();

    // Initialize call statistics
    const stats = new CallStatistics();
    this.callStats.set(targetUsername, stats);

    // Set up event handlers
    this.setupPeerConnectionEvents(pc, targetUsername);

    this.peerConnections.set(targetUsername, pc);
    return pc;
  }

  // ==================== SETUP EVENTS ====================
  setupPeerConnectionEvents(pc, targetUsername) {
    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        console.log(`Sending ICE candidate to ${targetUsername}`);
        this.socket.emit('call:ice-candidate', {
          to: targetUsername,
          from: this.username,
          candidate: event.candidate
        });
      }
    };

    // Track handler
    pc.ontrack = (event) => {
      console.log(`Received track from ${targetUsername}:`, event.track.kind);
      
      if (this.onTrackCallback) {
        this.onTrackCallback(event, targetUsername);
      }
    };

    // Connection state change
    pc.onconnectionstatechange = () => {
      console.log(`Connection state to ${targetUsername}:`, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        this.startStatsMonitoring(targetUsername, pc);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleConnectionFailure(targetUsername);
      } else if (pc.connectionState === 'closed') {
        this.cleanupPeerConnection(targetUsername);
      }

      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(pc.connectionState, targetUsername);
      }
    };

    // ICE connection state change
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state to ${targetUsername}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        this.handleIceFailure(targetUsername);
      }
    };

    // Signaling state change
    pc.onsignalingstatechange = () => {
      console.log(`Signaling state to ${targetUsername}:`, pc.signalingState);
    };

    // Negotiation needed
    pc.onnegotiationneeded = async () => {
      console.log(`Negotiation needed with ${targetUsername}`);
      
      if (this.onNegotiationNeededCallback) {
        await this.onNegotiationNeededCallback(targetUsername);
      }
    };
  }

  // ==================== ADD TRACKS ====================
  addTracks(targetUsername, stream) {
    const pc = this.peerConnections.get(targetUsername);
    if (!pc) {
      console.error(`No peer connection to ${targetUsername}`);
      return;
    }

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
      console.log(`Added ${track.kind} track to ${targetUsername}`);
    });
  }

  // ==================== CREATE OFFER ====================
  async createOffer(targetUsername) {
    const pc = this.peerConnections.get(targetUsername);
    if (!pc) {
      throw new Error(`No peer connection to ${targetUsername}`);
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      
      return pc.localDescription;
    } catch (err) {
      console.error('Failed to create offer:', err);
      throw err;
    }
  }

  // ==================== HANDLE OFFER ====================
  async handleOffer(targetUsername, offer) {
    const pc = this.peerConnections.get(targetUsername);
    if (!pc) {
      throw new Error(`No peer connection to ${targetUsername}`);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Add any pending ICE candidates
      const pending = this.pendingCandidates.get(targetUsername) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates.delete(targetUsername);
    } catch (err) {
      console.error('Failed to handle offer:', err);
      throw err;
    }
  }

  // ==================== CREATE ANSWER ====================
  async createAnswer(targetUsername) {
    const pc = this.peerConnections.get(targetUsername);
    if (!pc) {
      throw new Error(`No peer connection to ${targetUsername}`);
    }

    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGatheringComplete(pc);
      
      return pc.localDescription;
    } catch (err) {
      console.error('Failed to create answer:', err);
      throw err;
    }
  }

  // ==================== HANDLE ANSWER ====================
  async handleAnswer(targetUsername, answer) {
    const pc = this.peerConnections.get(targetUsername);
    if (!pc) {
      throw new Error(`No peer connection to ${targetUsername}`);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Add any pending ICE candidates
      const pending = this.pendingCandidates.get(targetUsername) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates.delete(targetUsername);
    } catch (err) {
      console.error('Failed to handle answer:', err);
      throw err;
    }
  }

  // ==================== ADD ICE CANDIDATE ====================
  async addIceCandidate(targetUsername, candidate) {
    const pc = this.peerConnections.get(targetUsername);
    
    if (!pc) {
      console.warn(`No peer connection to ${targetUsername}, queuing candidate`);
      const pending = this.pendingCandidates.get(targetUsername) || [];
      pending.push(candidate);
      this.pendingCandidates.set(targetUsername, pending);
      return;
    }

    if (!pc.remoteDescription) {
      console.warn(`No remote description for ${targetUsername}, queuing candidate`);
      const pending = this.pendingCandidates.get(targetUsername) || [];
      pending.push(candidate);
      this.pendingCandidates.set(targetUsername, pending);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`Failed to add ICE candidate for ${targetUsername}:`, err);
    }
  }

  // ==================== REPLACE TRACK ====================
  async replaceTrack(targetUsername, kind, newTrack) {
    const pc = this.peerConnections.get(targetUsername);
    if (!pc) return;

    const sender = pc.getSenders().find(s => s.track?.kind === kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
      console.log(`Replaced ${kind} track for ${targetUsername}`);
    }
  }

  // ==================== START STATS MONITORING ====================
  startStatsMonitoring(targetUsername, pc) {
    const stats = this.callStats.get(targetUsername);
    if (!stats) return;

    const interval = setInterval(async () => {
      await stats.updateStats(pc);
      
      if (this.onStatsUpdateCallback) {
        this.onStatsUpdateCallback(stats.getStats(), targetUsername);
      }
    }, 1000);

    // Store interval for cleanup
    if (!this.statsIntervals) this.statsIntervals = new Map();
    this.statsIntervals.set(targetUsername, interval);
  }

  // ==================== HANDLE CONNECTION FAILURE ====================
  handleConnectionFailure(targetUsername) {
    console.log(`Connection failure with ${targetUsername}, attempting restart...`);
    
    const pc = this.peerConnections.get(targetUsername);
    if (pc && pc.connectionState !== 'closed') {
      // Attempt ICE restart
      pc.restartIce();
    }
  }

  // ==================== HANDLE ICE FAILURE ====================
  handleIceFailure(targetUsername) {
    console.log(`ICE failure with ${targetUsername}`);
    
    if (this.onIceFailureCallback) {
      this.onIceFailureCallback(targetUsername);
    }
  }

  // ==================== GET CONNECTION ====================
  getConnection(targetUsername) {
    return this.peerConnections.get(targetUsername);
  }

  // ==================== GET ALL CONNECTIONS ====================
  getAllConnections() {
    return Array.from(this.peerConnections.entries());
  }

  // ==================== CLOSE CONNECTION ====================
  closeConnection(targetUsername) {
    this.cleanupPeerConnection(targetUsername);
  }

  // ==================== CLOSE ALL CONNECTIONS ====================
  closeAllConnections() {
    for (const [username, pc] of this.peerConnections) {
      this.cleanupPeerConnection(username);
    }
  }

  // ==================== CLEANUP PEER CONNECTION ====================
  cleanupPeerConnection(targetUsername) {
    // Close peer connection
    const pc = this.peerConnections.get(targetUsername);
    if (pc) {
      pc.close();
      this.peerConnections.delete(targetUsername);
    }

    // Clear stats interval
    const statsInterval = this.statsIntervals?.get(targetUsername);
    if (statsInterval) {
      clearInterval(statsInterval);
      this.statsIntervals?.delete(targetUsername);
    }

    // Stop quality controller
    const qualityController = this.qualityControllers.get(targetUsername);
    if (qualityController) {
      qualityController.stop();
      this.qualityControllers.delete(targetUsername);
    }

    // Clear call stats
    this.callStats.delete(targetUsername);
    
    // Clear pending candidates
    this.pendingCandidates.delete(targetUsername);

    console.log(`Cleaned up connection to ${targetUsername}`);
  }

  // ==================== SET CALLBACKS ====================
  onTrack(callback) {
    this.onTrackCallback = callback;
  }

  onConnectionStateChange(callback) {
    this.onConnectionStateChangeCallback = callback;
  }

  onNegotiationNeeded(callback) {
    this.onNegotiationNeededCallback = callback;
  }

  onStatsUpdate(callback) {
    this.onStatsUpdateCallback = callback;
  }

  onIceFailure(callback) {
    this.onIceFailureCallback = callback;
  }
}

export default PeerConnectionManager;