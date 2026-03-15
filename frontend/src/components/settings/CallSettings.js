import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
// No icons needed
import { useEnhancedCall } from '../../hooks/useEnhancedcall';
import { detectDevices } from '../../utils/settings';

const CallSettings = ({ onClose, callHook }) => {
  const callApi = callHook || useEnhancedCall();
  const {
    settings,
    activeDevices,
    setActiveDevices,
    updateCallSettings,
    savePreferredDevices,
  } = callApi;
  // No local settings or device lists needed for defaults









  // Only close action needed
  const handleClose = () => {
    onClose();
  };



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
    };
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.2)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleClose}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 240, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: 0, marginBottom: 12, fontSize: 20 }}>Call Settings</h2>
        <p style={{ marginBottom: 20 }}>All call settings use system defaults for maximum compatibility.</p>
        <button onClick={handleClose} style={{ padding: '6px 18px', border: 'none', borderRadius: 4, background: '#007bff', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );

  // No portal needed for simplicity
};

export default CallSettings;