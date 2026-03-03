// This is a template for creating new settings components
// Copy this file and rename it to create new settings panels

import React, { useState } from 'react';
import { X } from 'lucide-react';

const SettingsTemplate = ({ onClose }) => {
  const [settings, setSettings] = useState({
    // Add your settings fields here
    exampleSetting: true,
    exampleOption: 'option1'
  });

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save settings logic here
    console.log('Saving settings:', settings);
    onClose();
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings Template</h2>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Example Section</h3>
          
          <div className="setting-item">
            <label>Example Toggle</label>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.exampleSetting}
                onChange={(e) => handleChange('exampleSetting', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>Example Select</label>
            <select 
              value={settings.exampleOption}
              onChange={(e) => handleChange('exampleOption', e.target.value)}
            >
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </select>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTemplate;