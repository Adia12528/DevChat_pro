import React, { useState } from 'react';
import { Camera, Video, Monitor, Settings as SettingsIcon } from 'lucide-react';
import SettingsTemplate from './settingsTemplate';
import DeviceTestPanel from './DeviceTestPanel';
import { useSettings } from '../../context/settingsContext';

const VideoSettings = ({ onClose }) => {
  const { settings, devices, updateSettings, resetSection } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings.calls);
  const [activeTest, setActiveTest] = useState(null);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      updateSettings('calls', localSettings);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleReset = () => {
    try {
      resetSection('calls');
      setLocalSettings(settings.calls);
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  return (
    <SettingsTemplate
      title="Video & Camera Settings"
      icon={<Camera size={20} />}
      onClose={onClose}
      onSave={handleSave}
      onReset={handleReset}
    >
      <div className="settings-group">
        <h4>Camera Selection</h4>
        
        <select
          className="settings-select-enhanced"
          value={settings.devices.preferredCamera || ''}
          onChange={(e) => updateSettings('devices', { preferredCamera: e.target.value })}
        >
          <option value="">System Default Camera</option>
          {devices.cameras?.map(cam => (
            <option key={cam.deviceId} value={cam.deviceId}>
              {cam.label}
            </option>
          ))}
        </select>

        <button 
          className="settings-btn-test" 
          onClick={() => setActiveTest('camera')}
          disabled={!devices.cameras?.length}
        >
          <Camera size={14} /> Test Camera
        </button>
      </div>

      {activeTest === 'camera' && (
        <DeviceTestPanel 
          deviceType="camera" 
          deviceId={settings.devices.preferredCamera}
          onTestComplete={() => setActiveTest(null)} 
        />
      )}

      {/* Rest of your JSX remains the same */}
    </SettingsTemplate>
  );
};

export default VideoSettings;