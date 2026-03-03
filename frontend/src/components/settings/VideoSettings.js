import React, { useState, useEffect } from 'react';
import { X, Camera, Monitor, Settings, RefreshCw } from 'lucide-react';
import { useEnhancedCall } from '../../hooks/useEnhancedcall';
import { detectDevices } from '../../utils/settings';

const VideoSettings = ({ onClose, callHook }) => {
  const callApi = callHook || useEnhancedCall();
  const { 
    settings,
    activeDevices, 
    setActiveDevices,
    updateCallSettings,
    savePreferredDevices 
  } = callApi;

  const [devices, setDevices] = useState({
    cameras: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const [localSettings, setLocalSettings] = useState(settings);
  const videoPreviewRef = React.useRef(null);

  useEffect(() => {
    loadDevices();
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose, previewStream]);

  useEffect(() => {
    if (videoPreviewRef.current && previewStream) {
      videoPreviewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const deviceList = await detectDevices({
        requestPermission: true,
        requestAudio: false,
        requestVideo: true,
      });
      setDevices({
        cameras: deviceList.cameras || []
      });
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraChange = async (deviceId) => {
    setActiveDevices(prev => ({ ...prev, camera: deviceId }));
    
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId !== 'system' ? { exact: deviceId } : undefined
        }
      });
      setPreviewStream(stream);
    } catch (error) {
      console.error('Failed to start camera preview:', error);
    }
  };

  const handleSave = () => {
    updateCallSettings({
      videoQuality: localSettings.videoQuality,
      frameRate: Number(localSettings.frameRate),
    });
    savePreferredDevices();
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>Video Settings</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
        <div className="settings-section">
          <h3>
            <Camera size={18} />
            Camera
          </h3>

          <div className="device-selector">
            <select 
              value={activeDevices.camera || 'system'}
              onChange={(e) => handleCameraChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="system">System Default</option>
              {devices.cameras.map(camera => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </option>
              ))}
            </select>

            <button 
              className="btn-refresh" 
              onClick={loadDevices}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            </button>
          </div>

          {previewStream && (
            <div className="camera-preview">
              <video 
                ref={videoPreviewRef}
                autoPlay 
                playsInline 
                muted
              />
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>
            <Monitor size={18} />
            Video Quality
          </h3>

          <div className="setting-item">
            <label>Resolution</label>
            <select
              value={localSettings.videoQuality}
              onChange={(event) => setLocalSettings((prev) => ({ ...prev, videoQuality: event.target.value }))}
            >
              <option value="auto">Auto</option>
              <option value="low">640x360 (Low)</option>
              <option value="medium">854x480 (Medium)</option>
              <option value="high">1280x720 (HD)</option>
              <option value="ultra">1920x1080 (Full HD)</option>
            </select>
          </div>

          <div className="setting-item">
            <label>Frame Rate</label>
            <select
              value={localSettings.frameRate}
              onChange={(event) => setLocalSettings((prev) => ({ ...prev, frameRate: Number(event.target.value) }))}
            >
              <option value="15">15 fps</option>
              <option value="24">24 fps</option>
              <option value="30">30 fps</option>
              <option value="48">48 fps</option>
              <option value="60">60 fps</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>
            <Settings size={18} />
            Advanced
          </h3>

          <div className="setting-item">
            <label>Hardware Acceleration</label>
            <div className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </div>
          </div>
        </div>

          <div className="settings-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSettings;