import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, Camera, CheckCircle, XCircle } from 'lucide-react';

const DeviceTestPanel = ({ onClose }) => {
  const [micTested, setMicTested] = useState(false);
  const [micWorking, setMicWorking] = useState(null);
  const [cameraTested, setCameraTested] = useState(false);
  const [cameraWorking, setCameraWorking] = useState(null);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [speakerWorking, setSpeakerWorking] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };
      
      updateLevel();
      setMicWorking(true);
    } catch (error) {
      console.error('Microphone test failed:', error);
      setMicWorking(false);
    } finally {
      setMicTested(true);
    }
  };

  const testCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      mediaStreamRef.current = stream;
      setCameraWorking(true);
    } catch (error) {
      console.error('Camera test failed:', error);
      setCameraWorking(false);
    } finally {
      setCameraTested(true);
    }
  };

  const testSpeaker = () => {
    const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    audio.volume = 0.5;
    audio.play()
      .then(() => {
        setSpeakerWorking(true);
        setTimeout(() => {
          audio.pause();
        }, 3000);
      })
      .catch(() => {
        setSpeakerWorking(false);
      })
      .finally(() => {
        setSpeakerTested(true);
      });
  };

  return (
    <div className="device-test-panel">
      <h3>Test Your Devices</h3>
      
      <div className="device-test-item">
        <div className="test-header">
          <Mic size={20} />
          <span>Microphone</span>
          {micTested && (
            micWorking ? 
              <CheckCircle size={16} className="success" /> : 
              <XCircle size={16} className="error" />
          )}
        </div>
        <button onClick={testMicrophone} disabled={micTested && micWorking}>
          {micTested && micWorking ? 'Tested ✓' : 'Test Microphone'}
        </button>
        {micTested && micWorking && (
          <div className="audio-level">
            <div className="level-bar" style={{ width: `${audioLevel * 100}%` }} />
          </div>
        )}
      </div>

      <div className="device-test-item">
        <div className="test-header">
          <Camera size={20} />
          <span>Camera</span>
          {cameraTested && (
            cameraWorking ? 
              <CheckCircle size={16} className="success" /> : 
              <XCircle size={16} className="error" />
          )}
        </div>
        <button onClick={testCamera} disabled={cameraTested && cameraWorking}>
          {cameraTested && cameraWorking ? 'Tested ✓' : 'Test Camera'}
        </button>
        {cameraTested && cameraWorking && (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted
            className="camera-preview"
          />
        )}
      </div>

      <div className="device-test-item">
        <div className="test-header">
          <Volume2 size={20} />
          <span>Speaker</span>
          {speakerTested && (
            speakerWorking ? 
              <CheckCircle size={16} className="success" /> : 
              <XCircle size={16} className="error" />
          )}
        </div>
        <button onClick={testSpeaker} disabled={speakerTested && speakerWorking}>
          {speakerTested && speakerWorking ? 'Tested ✓' : 'Test Speaker'}
        </button>
      </div>

      <button className="close-test-btn" onClick={onClose}>Close</button>
    </div>
  );
};

export default DeviceTestPanel;