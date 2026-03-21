// ==================== ICE SERVERS ====================
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  {
    urls: 'turn:turn.devchat.app:3478',
    username: 'devchat',
    credential: 'devchat2024'
  },
  {
    urls: 'turn:turn.devchat.app:5349',
    username: 'devchat',
    credential: 'devchat2024'
  }
];

// ==================== ADAPTIVE MEDIA CONSTRAINTS ====================
export const getAdaptiveMediaConstraints = ({ callType, userAgent, connectionInfo }) => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const connectionSpeed = connectionInfo?.downlink || 5;
  const isSlowConnection = connectionSpeed < 1.5;

  if (callType === 'voice') {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: isMobile ? 44100 : 48000,
        channelCount: 1
      },
      video: false
    };
  }

  const videoConstraints = {
    width: { ideal: isSlowConnection ? 640 : isMobile ? 1280 : 1920 },
    height: { ideal: isSlowConnection ? 480 : isMobile ? 720 : 1080 },
    frameRate: { ideal: isSlowConnection ? 15 : 30 }
  };

  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: videoConstraints
  };
};

export const getFallbackMediaConstraints = (callType) => {
  if (callType === 'voice') {
    return {
      audio: true,
      video: false
    };
  }
  return {
    audio: true,
    video: { width: 640, height: 480, frameRate: 15 }
  };
};


// Fix: Remove broken/duplicate getAdaptiveIceTransportPolicy and add a proper async optimizeRtpSenders function
export async function optimizeRtpSenders(pc, { userAgent, connectionInfo }) {
  if (!pc) return;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const connectionSpeed = connectionInfo?.downlink || 5;
  const isSlowConnection = connectionSpeed < 1.5;
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender && sender.track && sender.track.kind === 'video') {
      const params = sender.getParameters ? sender.getParameters() : null;
      if (params && params.encodings) {
        // Clone encodings to avoid modifying read-only fields
        const newEncodings = params.encodings.map(enc => ({ ...enc }));
        if (!newEncodings.length) newEncodings.push({});
        if (isSlowConnection) {
          newEncodings[0].maxBitrate = 300000;
          newEncodings[0].scaleResolutionDownBy = 2.0;
        } else if (isMobile) {
          newEncodings[0].maxBitrate = 800000;
          newEncodings[0].scaleResolutionDownBy = 1.5;
        } else {
          newEncodings[0].maxBitrate = 2000000;
        }
        // Only set allowed fields
        const safeParams = { ...params, encodings: newEncodings };
        try {
          await sender.setParameters(safeParams);
        } catch (e) {
          console.warn('Failed to set sender parameters:', e);
        }
      }
    }
  }
}

export const waitForIceGatheringComplete = (pc, timeoutMs = 3000) => {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    
    const timeout = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onIceGatheringChange);
      resolve();
    }, timeoutMs);
    
    const onIceGatheringChange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        pc.removeEventListener('icegatheringstatechange', onIceGatheringChange);
        resolve();
      }
    };
    
    pc.addEventListener('icegatheringstatechange', onIceGatheringChange);
  });
};

export class CallStatistics {
  constructor() {
    this.stats = {
      packetsLost: 0,
      jitter: 0,
      rtt: 0,
      bitrate: 0,
      resolution: { width: 0, height: 0 },
      frameRate: 0,
      qualityScore: 100,
      qualityLabel: 'Excellent',
      timestamp: Date.now()
    };
    this.previousStats = null;
  }

  async updateStats(pc) {
    if (!pc) return;
    
    try {
      const stats = await pc.getStats();
      let videoStats = null;
      let candidateStats = null;
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          if (report.kind === 'video') {
            videoStats = report;
          }
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidateStats = report;
        }
      });
      
      if (videoStats) {
        this.stats.packetsLost = videoStats.packetsLost || 0;
        this.stats.jitter = videoStats.jitter || 0;
        this.stats.frameRate = videoStats.framesPerSecond || 0;
        
        if (videoStats.frameWidth && videoStats.frameHeight) {
          this.stats.resolution = {
            width: videoStats.frameWidth,
            height: videoStats.frameHeight
          };
        }
      }
      
      if (candidateStats) {
        this.stats.rtt = candidateStats.currentRoundTripTime || 0;
      }
      
      if (this.previousStats && videoStats) {
        const timeDiff = (stats.timestamp - this.previousStats.timestamp) / 1000;
        if (timeDiff > 0 && videoStats.bytesReceived) {
          const bytesDiff = videoStats.bytesReceived - this.previousStats.bytesReceived;
          this.stats.bitrate = (bytesDiff * 8) / timeDiff;
        }
      }
      
      this.previousStats = {
        timestamp: stats.timestamp,
        bytesReceived: videoStats?.bytesReceived
      };
      
      this.updateQualityScore();
      this.stats.timestamp = Date.now();
      
    } catch (err) {
      console.warn('Failed to update call stats:', err);
    }
  }

  updateQualityScore() {
    let score = 100;
    
    if (this.stats.packetsLost > 100) score -= 30;
    else if (this.stats.packetsLost > 50) score -= 20;
    else if (this.stats.packetsLost > 10) score -= 10;
    
    if (this.stats.jitter > 0.05) score -= 15;
    else if (this.stats.jitter > 0.02) score -= 5;
    
    if (this.stats.rtt > 0.3) score -= 25;
    else if (this.stats.rtt > 0.1) score -= 10;
    
    if (this.stats.bitrate < 100000) score -= 30;
    else if (this.stats.bitrate < 300000) score -= 15;
    
    this.stats.qualityScore = Math.max(0, Math.min(100, score));
    
    if (this.stats.qualityScore >= 80) this.stats.qualityLabel = 'Excellent';
    else if (this.stats.qualityScore >= 60) this.stats.qualityLabel = 'Good';
    else if (this.stats.qualityScore >= 40) this.stats.qualityLabel = 'Fair';
    else if (this.stats.qualityScore >= 20) this.stats.qualityLabel = 'Poor';
    else this.stats.qualityLabel = 'Very Poor';
  }

  getStats() {
    return { ...this.stats };
  }

  getQualityScore() {
    return this.stats.qualityScore;
  }

  getQualityLabel() {
    return this.stats.qualityLabel;
  }
}

export class CallRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = null;
    this.stream = null;
  }

  start(stream) {
    this.stream = stream;
    this.chunks = [];
    this.startTime = Date.now();
    
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
    
    this.mediaRecorder.start(1000);
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        const duration = (Date.now() - this.startTime) / 1000;
        
        resolve({
          blob,
          url: URL.createObjectURL(blob),
          duration,
          size: blob.size,
          mimeType: this.mediaRecorder.mimeType
        });
        
        this.chunks = [];
      };
      
      this.mediaRecorder.stop();
    });
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.chunks = [];
  }
}

export class AdaptiveQualityController {
  constructor(pc) {
    this.pc = pc;
    this.running = false;
    this.interval = null;
    this.currentLevel = 'high';
    this.bitrateHistory = [];
    this.packetLossHistory = [];
  }

  start() {
    this.running = true;
    this.interval = setInterval(() => this.adapt(), 5000);
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async adapt() {
    if (!this.pc || !this.running) return;
    
    try {
      const stats = await this.pc.getStats();
      let bitrate = 0;
      let packetsLost = 0;
      let previousStats = this.previousStats;
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          if (previousStats) {
            const timeDiff = (report.timestamp - previousStats.timestamp) / 1000;
            if (timeDiff > 0) {
              const bytesDiff = report.bytesReceived - previousStats.bytesReceived;
              bitrate = (bytesDiff * 8) / timeDiff;
            }
          }
          packetsLost = report.packetsLost || 0;
          this.previousStats = {
            timestamp: report.timestamp,
            bytesReceived: report.bytesReceived
          };
        }
      });
      
      this.bitrateHistory.push(bitrate);
      this.packetLossHistory.push(packetsLost);
      if (this.bitrateHistory.length > 5) this.bitrateHistory.shift();
      if (this.packetLossHistory.length > 5) this.packetLossHistory.shift();
      
      const avgBitrate = this.bitrateHistory.reduce((a, b) => a + b, 0) / this.bitrateHistory.length;
      const avgPacketLoss = this.packetLossHistory.reduce((a, b) => a + b, 0) / this.packetLossHistory.length;
      
      let newLevel = this.currentLevel;
      
      if (avgBitrate < 200000 || avgPacketLoss > 50) {
        newLevel = 'low';
      } else if (avgBitrate < 500000 || avgPacketLoss > 20) {
        newLevel = 'medium';
      } else {
        newLevel = 'high';
      }
      
      if (newLevel !== this.currentLevel) {
        this.currentLevel = newLevel;
        await this.applyQualityLevel();
      }
      
    } catch (err) {
      console.warn('Adaptive quality control error:', err);
    }
  }

  async applyQualityLevel() {
    const senders = this.pc.getSenders();
    
    for (const sender of senders) {
      if (sender.track?.kind === 'video') {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        
        switch (this.currentLevel) {
          case 'low':
            params.encodings[0].maxBitrate = 200000;
            params.encodings[0].scaleResolutionDownBy = 4.0;
            break;
          case 'medium':
            params.encodings[0].maxBitrate = 500000;
            params.encodings[0].scaleResolutionDownBy = 2.0;
            break;
          case 'high':
            params.encodings[0].maxBitrate = 1500000;
            delete params.encodings[0].scaleResolutionDownBy;
            break;
        }
        
        try {
          await sender.setParameters(params);
        } catch (e) {
          console.warn('Failed to apply quality level:', e);
        }
      }
    }
  }
}

export class CallHistory {
  constructor() {
    this.storageKey = 'devchat_call_history';
    this.maxEntries = 100;
    this.history = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (err) {
      console.warn('Failed to save call history:', err);
    }
  }

  addCall(callData) {
    const entry = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      peer: callData.peer,
      type: callData.type,
      duration: callData.duration,
      timestamp: callData.timestamp.toISOString(),
      stats: callData.stats || null
    };
    
    this.history.unshift(entry);
    
    if (this.history.length > this.maxEntries) {
      this.history = this.history.slice(0, this.maxEntries);
    }
    
    this.save();
    return entry;
  }

  getCallHistory() {
    return [...this.history];
  }

  clear() {
    this.history = [];
    this.save();
  }
}

export const getScreenStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    return stream;
  } catch (err) {
    console.error('Screen share error:', err);
    throw err;
  }
};

export const switchToScreenShare = async (pc, screenStream, cameraStream) => {
  const screenVideoTrack = screenStream.getVideoTracks()[0];
  const screenAudioTrack = screenStream.getAudioTracks()[0];
  
  const senders = pc.getSenders();
  
  const videoSender = senders.find(s => s.track?.kind === 'video');
  if (videoSender && screenVideoTrack) {
    await videoSender.replaceTrack(screenVideoTrack);
  }
  
  if (screenAudioTrack) {
    const audioSender = senders.find(s => s.track?.kind === 'audio');
    if (audioSender) {
      await audioSender.replaceTrack(screenAudioTrack);
    }
  }
  
  screenVideoTrack.onended = () => {
    console.log('Screen sharing ended by user');
  };
  
  return screenVideoTrack;
};

export const switchBackToCamera = async (pc, cameraStream) => {
  const cameraVideoTrack = cameraStream.getVideoTracks()[0];
  const cameraAudioTrack = cameraStream.getAudioTracks()[0];
  
  const senders = pc.getSenders();
  
  const videoSender = senders.find(s => s.track?.kind === 'video');
  if (videoSender && cameraVideoTrack) {
    await videoSender.replaceTrack(cameraVideoTrack);
  }
  
  const audioSender = senders.find(s => s.track?.kind === 'audio');
  if (audioSender && cameraAudioTrack) {
    await audioSender.replaceTrack(cameraAudioTrack);
  }
};

export const getQualityIndicator = (stats) => {
  const qualityScore = stats.getQualityScore?.() || 100;
  
  if (qualityScore >= 80) return { icon: '🟢', label: 'Excellent', color: '#4CAF50' };
  if (qualityScore >= 60) return { icon: '🟡', label: 'Good', color: '#FFC107' };
  if (qualityScore >= 40) return { icon: '🟠', label: 'Fair', color: '#FF9800' };
  return { icon: '🔴', label: 'Poor', color: '#F44336' };
};

export class VideoEffectsProcessor {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement?.getContext('2d');
    this.effects = {
      backgroundBlur: 0,
      brightness: 1,
      contrast: 1,
      saturation: 1
    };
    this.running = false;
    this.animationFrame = null;
  }

  start() {
    if (!this.video || !this.canvas || !this.ctx) return;
    this.running = true;
    this.process();
  }

  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  setEffect(name, value) {
    if (name in this.effects) {
      this.effects[name] = value;
    }
  }

  process() {
    if (!this.running) return;
    
    const { videoWidth, videoHeight } = this.video;
    
    if (videoWidth && videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
      
      this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
      
      const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight);
      
      if (this.effects.backgroundBlur > 0) {
        this.ctx.filter = `blur(${this.effects.backgroundBlur}px)`;
        this.ctx.drawImage(this.canvas, 0, 0);
        this.ctx.filter = 'none';
      }
      
      this.ctx.filter = `
        brightness(${this.effects.brightness})
        contrast(${this.effects.contrast})
        saturate(${this.effects.saturation})
      `;
      
      this.ctx.drawImage(this.canvas, 0, 0);
    }
    
    this.animationFrame = requestAnimationFrame(() => this.process());
  }
}