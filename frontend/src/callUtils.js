/**
 * Advanced Calling Utilities
 * - Quality optimization
 * - Record ing
 * - Screen sharing
 * - Call statistics
 * - Video effects
 */

// ==================== MEDIA CONSTRAINTS ====================
export const OPTIMAL_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  typingNoiseDetection: true
};

export const OPTIMAL_VIDEO_CONSTRAINTS = {
  video: {
    width: { ideal: 1280, min: 320, max: 1920 },
    height: { ideal: 720, min: 240, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
    aspectRatio: { ideal: 16 / 9 }
  },
  audio: OPTIMAL_AUDIO_CONSTRAINTS
};

export const OPTIMAL_AUDIO_ONLY_CONSTRAINTS = {
  audio: OPTIMAL_AUDIO_CONSTRAINTS,
  video: false
};

// Mobile-optimized constraints
export const MOBILE_VIDEO_CONSTRAINTS = {
  video: {
    width: { ideal: 640, min: 320, max: 1280 },
    height: { ideal: 480, min: 240, max: 720 },
    frameRate: { ideal: 15, max: 30 },
    facingMode: 'user'
  },
  audio: OPTIMAL_AUDIO_CONSTRAINTS
};

// ==================== ICE SERVERS ====================
// Enhanced with free TURN servers for NAT traversal in restrictive networks
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80?transport=udp',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export function detectDeviceProfile(userAgent = '', connectionInfo = {}) {
  const normalizedUA = (userAgent || '').toLowerCase();
  const isAndroid = normalizedUA.includes('android');
  const isIOS = /iphone|ipad|ipod/.test(normalizedUA);
  const isMobile = isAndroid || isIOS;
  const isMac = normalizedUA.includes('mac os') && !isIOS;
  const isWindows = normalizedUA.includes('windows');
  const isLinux = normalizedUA.includes('linux') && !isAndroid;

  const hardwareConcurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
  const deviceMemory = typeof navigator !== 'undefined' ? (navigator.deviceMemory || 4) : 4;
  const effectiveType = (connectionInfo?.effectiveType || '').toLowerCase();
  const saveData = !!connectionInfo?.saveData;

  const isLowBandwidth = saveData || /(^2g$|^3g$|slow-2g)/.test(effectiveType);
  const isMidBandwidth = /(^4g$)/.test(effectiveType);
  const performanceTier = (hardwareConcurrency <= 4 || deviceMemory <= 4 || isLowBandwidth)
    ? 'low'
    : (hardwareConcurrency <= 8 || deviceMemory <= 8 || isMidBandwidth)
      ? 'medium'
      : 'high';

  return {
    isAndroid,
    isIOS,
    isMobile,
    isMac,
    isWindows,
    isLinux,
    hardwareConcurrency,
    deviceMemory,
    effectiveType,
    saveData,
    isLowBandwidth,
    isMidBandwidth,
    performanceTier
  };
}

export function getAdaptiveMediaConstraints({ callType, userAgent, connectionInfo } = {}) {
  const profile = detectDeviceProfile(userAgent, connectionInfo);

  if (profile.isIOS) {
    return callType === 'video'
      ? {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: 640, height: 480, frameRate: 15 }
        }
      : { audio: true, video: false };
  }

  const baseAudio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16
  };

  if (callType !== 'video') {
    return {
      audio: baseAudio,
      video: false
    };
  }

  if (profile.performanceTier === 'low') {
    return {
      audio: baseAudio,
      video: {
        width: { ideal: 640, min: 320, max: 960 },
        height: { ideal: 360, min: 240, max: 540 },
        frameRate: { ideal: 15, max: 24 },
        facingMode: 'user'
      }
    };
  }

  if (profile.performanceTier === 'medium' || profile.isMobile) {
    return {
      audio: baseAudio,
      video: {
        width: { ideal: 960, min: 320, max: 1280 },
        height: { ideal: 540, min: 240, max: 720 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: 'user',
        aspectRatio: { ideal: 16 / 9 }
      }
    };
  }

  return {
    audio: baseAudio,
    video: {
      width: { ideal: 1280, min: 320, max: 1920 },
      height: { ideal: 720, min: 240, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user',
      aspectRatio: { ideal: 16 / 9 }
    }
  };
}

export function getFallbackMediaConstraints(callType) {
  return callType === 'video'
    ? {
        audio: true,
        video: { width: 320, height: 240, frameRate: 12 }
      }
    : {
        audio: true,
        video: false
      };
}

export function getAdaptiveIceTransportPolicy({ userAgent, connectionInfo } = {}) {
  return 'all';
}

export async function optimizeRtpSenders(peerConnection, { callType, userAgent, connectionInfo } = {}) {
  if (!peerConnection || typeof peerConnection.getSenders !== 'function') return;

  const profile = detectDeviceProfile(userAgent, connectionInfo);
  const senders = peerConnection.getSenders();
  const videoBitrate = profile.performanceTier === 'low' ? 350000 : profile.performanceTier === 'medium' ? 800000 : 1600000;
  const videoMaxFramerate = profile.performanceTier === 'low' ? 15 : profile.performanceTier === 'medium' ? 24 : 30;
  const audioBitrate = profile.performanceTier === 'low' ? 24000 : profile.performanceTier === 'medium' ? 40000 : 64000;

  await Promise.all(senders.map(async (sender) => {
    if (!sender?.track || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') return;

    try {
      const parameters = sender.getParameters() || {};
      parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];

      if (sender.track.kind === 'video' && callType === 'video') {
        parameters.degradationPreference = profile.performanceTier === 'high' ? 'maintain-resolution' : 'balanced';
        parameters.encodings[0] = {
          ...parameters.encodings[0],
          maxBitrate: videoBitrate,
          maxFramerate: videoMaxFramerate,
          scaleResolutionDownBy: profile.performanceTier === 'low' ? 1.5 : 1
        };
      }

      if (sender.track.kind === 'audio') {
        parameters.encodings[0] = {
          ...parameters.encodings[0],
          maxBitrate: audioBitrate
        };
      }

      await sender.setParameters(parameters);
    } catch (error) {
      console.warn('Failed to optimize RTP sender:', error?.message || error);
    }
  }));
}

// ==================== CALL STATISTICS TRACKING ====================
export class CallStatistics {
  constructor() {
    this.startTime = Date.now();
    this.audioLevel = 0;
    this.videoFrameRate = 0;
    this.connectionState = 'new';
    this.bandwidth = { upload: 0, download: 0 };
    this.latency = 0;
    this.packetLoss = 0;
    this.jitter = 0;
  }

  getStats() {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    const qualityScore = this.getQualityScore();

    return {
      audioLevel: this.audioLevel,
      videoFrameRate: this.videoFrameRate,
      connectionState: this.connectionState,
      bandwidth: { ...this.bandwidth },
      latency: this.latency,
      packetLoss: this.packetLoss,
      jitter: this.jitter,
      duration,
      qualityScore,
      qualityLabel: this.getQualityLabel()
    };
  }

  async updateStats(peerConnection) {
    try {
      const stats = await peerConnection.getStats();
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          // Audio quality metrics
          this.audioLevel = report.audioLevel || 0;
          this.packetLoss = report.packetsLost || 0;
          this.jitter = report.jitter || 0;
        }
        
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          // Video quality metrics
          this.videoFrameRate = report.framesPerSecond || 0;
          this.packetLoss = report.packetsLost || 0;
        }
        
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          // Connection metrics
          this.latency = report.currentRoundTripTime * 1000; // Convert to ms
          this.bandwidth.download = (report.bytesReceived * 8) / (Date.now() - this.startTime);
          this.bandwidth.upload = (report.bytesSent * 8) / (Date.now() - this.startTime);
        }
      });
    } catch (err) {
      console.error('Error updating call statistics:', err);
    }
  }

  getQualityScore() {
    // Calculate 0-100 quality score
    let score = 100;
    
    // Penalty for latency (ideal < 50ms)
    if (this.latency > 50) score -= Math.min(30, (this.latency - 50) / 10);
    
    // Penalty for packet loss (ideal 0%)
    if (this.packetLoss > 0) score -= this.packetLoss * 10;
    
    // Penalty for low video frame rate
    if (this.videoFrameRate < 15) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }

  getQualityLabel() {
    const score = this.getQualityScore();
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 25) return 'Poor';
    return 'Very Poor';
  }
}

// ==================== CALL RECORDING ====================
export class CallRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  start(stream) {
    try {
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      };

      // Fallback for browsers that don't support opus
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log('🔴 Recording started');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: 'audio/webm'
        });
        this.isRecording = false;
        console.log('⏹️ Recording stopped');
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  downloadRecording(filename = 'call-recording') {
    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// ==================== SCREEN SHARING ====================
export async function getScreenStream(options = {}) {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        ...options.videoOptions
      },
      audio: false
    });

    console.log('📺 Screen sharing started');
    return screenStream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.log('Screen sharing denied by user');
    } else {
      console.error('Error getting screen stream:', err);
    }
    throw err;
  }
}

export async function switchToScreenShare(peerConnection, screenStream, localStream) {
  try {
    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection
      .getSenders()
      .find(s => s.track && s.track.kind === 'video');

    if (sender) {
      await sender.replaceTrack(screenTrack);
      console.log('📺 Switched to screen sharing');

      // Handle when screen sharing stops
      screenTrack.onended = () => {
        console.log('📺 Screen sharing stopped by user');
        return switchBackToCamera(peerConnection, localStream);
      };

      return screenTrack;
    }
  } catch (err) {
    console.error('Error switching to screen share:', err);
    throw err;
  }
}

export async function switchBackToCamera(peerConnection, localStream) {
  try {
    const cameraTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection
      .getSenders()
      .find(s => s.track && s.track.kind === 'video');

    if (sender && cameraTrack) {
      await sender.replaceTrack(cameraTrack);
      console.log('📹 Switched back to camera');
      return cameraTrack;
    }
  } catch (err) {
    console.error('Error switching back to camera:', err);
    throw err;
  }
}

// ==================== VIDEO EFFECTS ====================
export class VideoEffectsProcessor {
  constructor(canvasElement, videoElement) {
    this.canvas = canvasElement;
    this.video = videoElement;
    this.ctx = canvasElement.getContext('2d');
    this.animationId = null;
    this.backgroundBlur = 0;
    this.brightness = 1;
    this.contrast = 1;
    this.saturation = 1;
    this.backgroundImage = null;
  }

  setBackgroundBlur(level) {
    this.backgroundBlur = level; // 0-100
  }

  setBackgroundImage(imageUrl) {
    const img = new Image();
    img.onload = () => {
      this.backgroundImage = img;
    };
    img.src = imageUrl;
  }

  setFilters(brightness, contrast, saturation) {
    this.brightness = brightness;
    this.contrast = contrast;
    this.saturation = saturation;
  }

  applyEffects() {
    if (!this.ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw video with filters
    this.ctx.filter = `brightness(${this.brightness}) contrast(${this.contrast}) saturate(${this.saturation})`;
    this.ctx.drawImage(this.video, 0, 0, width, height);
    this.ctx.filter = 'none';

    // Apply background blur (simplified - real implementation would use segmentation)
    if (this.backgroundBlur > 0) {
      // This is a placeholder - real implementation would use TensorFlow.js for person segmentation
      this.applySimpleBackgroundEffect();
    }

    // Apply custom background
    if (this.backgroundImage) {
      this.applyCustomBackground();
    }
  }

  applySimpleBackgroundEffect() {
    // Simplified blur effect (real apps use ML for person detection)
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const blurRadius = Math.floor(this.backgroundBlur / 10);
    
    if (blurRadius > 0) {
      this.blurImageData(imageData, blurRadius);
      this.ctx.putImageData(imageData, 0, 0);
    }
  }

  applyCustomBackground() {
    // Draw background image with proper scaling
    const width = this.canvas.width;
    const height = this.canvas.height;
    const dx = (this.backgroundImage.width - width) / 2;
    const dy = (this.backgroundImage.height - height) / 2;
    
    this.ctx.drawImage(
      this.backgroundImage,
      dx, dy, width, height,
      0, 0, width, height
    );
  }

  blurImageData(imageData, radius) {
    // Simple box blur implementation
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = j + dx;
            const y = i + dy;

            if (x >= 0 && x < w && y >= 0 && y < h) {
              const idx = (y * w + x) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              count++;
            }
          }
        }

        const idx = (i * w + j) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }
  }

  start() {
    const animate = () => {
      this.applyEffects();
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// ==================== CALL HISTORY ====================
export class CallHistory {
  constructor() {
    this.calls = this.loadFromStorage();
  }

  addCall(call) {
    const callRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      duration: call.duration,
      participant: call.participant,
      type: call.type, // 'voice' or 'video'
      status: call.status, // 'completed', 'missed', 'rejected'
      quality: call.quality, // CallStatistics object
      recording: call.recording // If available
    };

    this.calls.push(callRecord);
    this.saveToStorage();
    return callRecord;
  }

  getCallHistory(limit = 50) {
    return this.calls.slice(-limit).reverse();
  }

  getMissedCalls() {
    return this.calls.filter(c => c.status === 'missed');
  }

  getCallStats() {
    const totalCalls = this.calls.length;
    const totalDuration = this.calls.reduce((sum, c) => sum + c.duration, 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const videoCalls = this.calls.filter(c => c.type === 'video').length;

    return {
      totalCalls,
      totalDuration,
      avgDuration,
      videoCalls: videoCalls,
      voiceCalls: totalCalls - videoCalls
    };
  }

  clearHistory() {
    this.calls = [];
    this.saveToStorage();
  }

  saveToStorage() {
    try {
      localStorage.setItem('callHistory', JSON.stringify(this.calls));
    } catch (err) {
      console.error('Failed to save call history:', err);
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem('callHistory');
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to load call history:', err);
      return [];
    }
  }
}

// ==================== CONNECTION QUALITY ADAPTER ====================
export class AdaptiveQualityController {
  constructor(peerConnection, targetBitrate = 1000000) {
    this.peerConnection = peerConnection;
    this.targetBitrate = targetBitrate;
    this.currentQuality = 'high';
    this.statsInterval = null;
  }

  start() {
    this.statsInterval = setInterval(() => {
      this.adjustQuality();
    }, 2000);
  }

  stop() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
  }

  async adjustQuality() {
    try {
      const stats = await this.peerConnection.getStats();
      let bandwidth = 0;
      let fpsOut = 0;

      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          bandwidth = (report.bytesSent * 8) / 2; // Rough estimate
          fpsOut = report.framesPerSecond || 0;
        }
      });

      // Adjust based on bandwidth
      if (bandwidth < 500000 && this.currentQuality !== 'low') {
        this.setQuality('low');
      } else if (bandwidth < 1000000 && this.currentQuality === 'high') {
        this.setQuality('medium');
      } else if (bandwidth > 1500000 && this.currentQuality === 'low') {
        this.setQuality('high');
      }
    } catch (err) {
      console.error('Error adjusting quality:', err);
    }
  }

  setQuality(level) {
    this.currentQuality = level;
    console.log('📊 Call quality adjusted to:', level);
    // Emit event or update UI
  }
}

// ==================== CALL QUALITY INDICATORS ====================
export function getQualityIndicator(stats) {
  const score = typeof stats === 'number'
    ? stats
    : typeof stats?.getQualityScore === 'function'
      ? stats.getQualityScore()
      : Number(stats?.qualityScore || 0);

  if (score >= 90) {
    return {
      color: '#10b981',
      label: 'Excellent',
      bars: 5,
      icon: '▁▂▃▄▅'
    };
  } else if (score >= 75) {
    return {
      color: '#3b82f6',
      label: 'Good',
      bars: 4,
      icon: '▁▂▃▄'
    };
  } else if (score >= 50) {
    return {
      color: '#f59e0b',
      label: 'Fair',
      bars: 3,
      icon: '▁▂▃'
    };
  } else if (score >= 25) {
    return {
      color: '#ef4444',
      label: 'Poor',
      bars: 2,
      icon: '▁▂'
    };
  } else {
    return {
      color: '#7f1d1d',
      label: 'Very Poor',
      bars: 1,
      icon: '▁'
    };
  }
}

export default {
  OPTIMAL_AUDIO_CONSTRAINTS,
  OPTIMAL_VIDEO_CONSTRAINTS,
  OPTIMAL_AUDIO_ONLY_CONSTRAINTS,
  MOBILE_VIDEO_CONSTRAINTS,
  ICE_SERVERS,
  detectDeviceProfile,
  getAdaptiveMediaConstraints,
  getFallbackMediaConstraints,
  getAdaptiveIceTransportPolicy,
  optimizeRtpSenders,
  CallStatistics,
  CallRecorder,
  VideoEffectsProcessor,
  CallHistory,
  AdaptiveQualityController,
  getScreenStream,
  switchToScreenShare,
  switchBackToCamera,
  getQualityIndicator
};
