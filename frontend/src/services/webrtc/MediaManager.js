// MediaManager.js - Manages media devices and streams

class MediaManager {
  constructor() {
    this.localStream = null;
    this.screenStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.devices = {
      cameras: [],
      microphones: [],
      speakers: []
    };
  }

  // ==================== DEVICE MANAGEMENT ====================
  async enumerateDevices() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return { cameras: [], microphones: [], speakers: [] };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.devices = {
        cameras: devices.filter(d => d.kind === 'videoinput').map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
          kind: d.kind
        })),
        microphones: devices.filter(d => d.kind === 'audioinput').map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
          kind: d.kind
        })),
        speakers: devices.filter(d => d.kind === 'audiooutput').map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${i + 1}`,
          kind: d.kind
        }))
      };

      return this.devices;
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      return { cameras: [], microphones: [], speakers: [] };
    }
  }

  // ==================== GET USER MEDIA ====================
  async getUserMedia(constraints) {
    try {
      // Stop existing stream if any
      this.stopLocalStream();

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      
      return stream;
    } catch (err) {
      console.error('Failed to get user media:', err);
      throw err;
    }
  }

  // ==================== GET DISPLAY MEDIA ====================
  async getDisplayMedia(options = {}) {
    try {
      // Stop existing screen stream if any
      this.stopScreenStream();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          ...options.video
        },
        audio: options.audio || false
      });

      this.screenStream = stream;
      
      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        this.screenStream = null;
      };

      return stream;
    } catch (err) {
      console.error('Failed to get display media:', err);
      throw err;
    }
  }

  // ==================== GET CONSTRAINTS ====================
  getConstraints(callType, quality = 'auto', deviceIds = {}) {
    const baseConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    };

    // Apply device preferences
    if (deviceIds.microphone && deviceIds.microphone !== 'system') {
      baseConstraints.audio.deviceId = { exact: deviceIds.microphone };
    }

    if (callType === 'audio') {
      return { ...baseConstraints, video: false };
    }

    // Video constraints
    let videoConstraints = {};
    
    switch (quality) {
      case 'low':
        videoConstraints = {
          width: { ideal: 640, max: 854 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 24 },
        };
        break;
      case 'medium':
        videoConstraints = {
          width: { ideal: 854, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        };
        break;
      case 'high':
        videoConstraints = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 48 },
        };
        break;
      case 'ultra':
        videoConstraints = {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 48, max: 60 },
        };
        break;
      default:
        videoConstraints = {
          width: { ideal: 1280, min: 320, max: 1920 },
          height: { ideal: 720, min: 240, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        };
    }

    if (deviceIds.camera && deviceIds.camera !== 'system') {
      videoConstraints.deviceId = { exact: deviceIds.camera };
    }

    return {
      audio: baseConstraints.audio,
      video: videoConstraints
    };
  }

  // ==================== AUDIO ANALYSIS ====================
  async startAudioAnalysis(stream) {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      
      return this.analyser;
    } catch (err) {
      console.error('Failed to start audio analysis:', err);
      throw err;
    }
  }

  getAudioLevel() {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    return average / 255;
  }

  stopAudioAnalysis() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
  }

  // ==================== RECORDING ====================
  startRecording(stream, options = {}) {
    this.recordedChunks = [];
    
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      ...options
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000);
    return this.mediaRecorder;
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { 
          type: this.mediaRecorder.mimeType 
        });
        
        resolve({
          blob,
          url: URL.createObjectURL(blob),
          size: blob.size
        });
        
        this.recordedChunks = [];
      };

      this.mediaRecorder.stop();
    });
  }

  // ==================== TRACK CONTROL ====================
  toggleAudio(enabled) {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  getAudioTracks() {
    return this.localStream?.getAudioTracks() || [];
  }

  getVideoTracks() {
    return this.localStream?.getVideoTracks() || [];
  }

  // ==================== STREAM STOPPING ====================
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        this.localStream.removeTrack(track);
      });
      this.localStream = null;
    }
    this.stopAudioAnalysis();
  }

  stopScreenStream() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        track.stop();
        this.screenStream.removeTrack(track);
      });
      this.screenStream = null;
    }
  }

  stopAllStreams() {
    this.stopLocalStream();
    this.stopScreenStream();
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }

  // ==================== AUDIO OUTPUT ====================
  async setAudioOutput(deviceId) {
    if (!deviceId || deviceId === 'system') return;
    
    const audioElements = document.querySelectorAll('audio, video');
    for (const el of audioElements) {
      if (el.setSinkId) {
        try {
          await el.setSinkId(deviceId);
        } catch (err) {
          console.warn('Failed to set audio output:', err);
        }
      }
    }
  }

  // ==================== CHECK PERMISSIONS ====================
  async checkPermissions(constraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.warn('Permission check failed:', err);
      return false;
    }
  }
}

export default MediaManager;