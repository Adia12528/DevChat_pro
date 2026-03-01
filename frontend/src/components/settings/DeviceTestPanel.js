import React, { useState, useRef, useEffect } from 'react';
import { Mic, Volume2, Camera, Play, Square, AlertCircle } from 'lucide-react';

const DeviceTestPanel = ({ 
  deviceType, // 'microphone', 'camera', 'speaker'
  deviceId,
  onTestComplete 
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testLevel, setTestLevel] = useState(0);
  const [error, setError] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const videoRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTest();
    };
  }, []);

  const startTest = async () => {
    try {
      setError(null);
      setIsTesting(true);

      const constraints = {
        audio: deviceType === 'microphone' || deviceType === 'speaker' ? {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } : false,
        video: deviceType === 'camera' ? {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (deviceType === 'microphone') {
        // Setup audio analysis
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setTestLevel(average / 255); // Normalize to 0-1
          animationRef.current = requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
      } else if (deviceType === 'camera') {
        // Show video preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setVideoSrc(stream);
      } else if (deviceType === 'speaker') {
        // Play test tone
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 440;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1);
        
        // Visual feedback
        setTestLevel(0.5);
        setTimeout(() => setTestLevel(0), 1000);
      }

      if (onTestComplete) {
        onTestComplete({ success: true, stream });
      }
    } catch (err) {
      console.error('Test failed:', err);
      setError(err.message || 'Failed to access device');
      setIsTesting(false);
      
      if (onTestComplete) {
        onTestComplete({ success: false, error: err.message });
      }
    }
  };

  const stopTest = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    analyserRef.current = null;
    setTestLevel(0);
    setVideoSrc(null);
    setIsTesting(false);
    setError(null);
  };

  const getLevelBars = () => {
    const bars = [];
    const numBars = 20;
    const activeBars = Math.floor(testLevel * numBars);
    
    for (let i = 0; i < numBars; i++) {
      bars.push(
        <div
          key={i}
          className={`device-test-bar ${i < activeBars ? 'active' : ''}`}
          style={{
            height: `${(i + 1) * 5}px`,
            backgroundColor: i < activeBars ? 'var(--primary)' : 'var(--border)'
          }}
        />
      );
    }
    
    return bars;
  };

  return (
    <div className="device-test-panel">
      <div className="device-test-header">
        <h4>
          {deviceType === 'microphone' && <><Mic size={16} /> Test Microphone</>}
          {deviceType === 'camera' && <><Camera size={16} /> Test Camera</>}
          {deviceType === 'speaker' && <><Volume2 size={16} /> Test Speaker</>}
        </h4>
        {!isTesting ? (
          <button className="device-test-btn" onClick={startTest}>
            <Play size={14} /> Start Test
          </button>
        ) : (
          <button className="device-test-btn stop" onClick={stopTest}>
            <Square size={14} /> Stop
          </button>
        )}
      </div>

      {error && (
        <div className="device-test-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {deviceType === 'camera' && isTesting && (
        <div className="device-test-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
          />
        </div>
      )}

      {(deviceType === 'microphone' || deviceType === 'speaker') && (
        <div className="device-test-meter">
          <div className="device-test-level">
            {getLevelBars()}
          </div>
          <span className="device-test-value">{Math.round(testLevel * 100)}%</span>
        </div>
      )}

      <style jsx>{`
        .device-test-panel {
          background: var(--surface);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin: var(--space-4) 0;
          border: 1px solid var(--border);
        }

        .device-test-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-3);
        }

        .device-test-header h4 {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin: 0;
          font-size: var(--text-sm);
          color: var(--txt);
        }

        .device-test-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-3);
          background: var(--primary-muted);
          color: var(--primary);
          border: 1px solid var(--primary);
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .device-test-btn:hover {
          background: var(--primary);
          color: #000;
        }

        .device-test-btn.stop {
          background: var(--error-muted);
          color: var(--error);
          border-color: var(--error);
        }

        .device-test-btn.stop:hover {
          background: var(--error);
          color: white;
        }

        .device-test-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2);
          background: var(--error-muted);
          color: var(--error);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          margin-bottom: var(--space-3);
        }

        .device-test-video {
          width: 100%;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: #000;
          margin-bottom: var(--space-3);
        }

        .device-test-video video {
          width: 100%;
          height: auto;
          display: block;
        }

        .device-test-meter {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .device-test-level {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 60px;
        }

        .device-test-bar {
          flex: 1;
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          transition: height 0.1s ease, background-color 0.2s ease;
        }

        .device-test-bar.active {
          background-color: var(--primary) !important;
        }

        .device-test-value {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--primary);
          min-width: 45px;
        }

        @media (max-width: 768px) {
          .device-test-level {
            height: 40px;
          }
          
          .device-test-bar {
            width: 3px;
          }
        }
      `}</style>
    </div>
  );
};

export default DeviceTestPanel;