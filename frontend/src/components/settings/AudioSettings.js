import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEnhancedCall } from '../../hooks/useEnhancedcall';
import { detectDevices } from '../../utils/settings';

const AudioSettings = ({ onClose, callHook }) => {
  const callApi = callHook || useEnhancedCall();
  const { 
    settings, 
    activeDevices, 
    setActiveDevices,
    updateCallSettings,
    isTesting,
    audioLevel,
    testMicrophone,
    stopTest,
    savePreferredDevices 
  } = callApi;

  // No device lists or local audio settings needed for defaults





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
      stopTest();
    };
  }, [onClose, stopTest]);







  const handleSave = () => {
    // Always use system defaults, no settings to save
    onClose();
  };

  const content = (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" style={{ zIndex: 26001 }} onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>Audio Settings</h2>
          <button className="close-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <p>All audio input/output and processing settings are now set to use system defaults for maximum compatibility.</p>
          </div>
          <div className="settings-actions">
            <button className="btn-primary" onClick={handleSave} type="button">OK</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(content, document.body);
};

export default AudioSettings;