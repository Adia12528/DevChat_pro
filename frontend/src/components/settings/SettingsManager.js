import React from 'react';
import { AnimatePresence } from 'framer-motion';
import CallSettings from './CallSettings';
import AudioSettings from './AudioSettings';
import VideoSettings from './VideoSettings';
import StreamSettings from './StreamSettings';
import AppSettings from './AppSettings';

const SettingsManager = ({ 
  currentView, 
  onClose,
  callHistory,
  formatDuration,
  getQualityLabelStyle
}) => {
  return (
    <AnimatePresence>
      {currentView === 'call-settings' && (
        <CallSettings onClose={onClose} />
      )}

      {currentView === 'audio-settings' && (
        <AudioSettings onClose={onClose} />
      )}

      {currentView === 'video-settings' && (
        <VideoSettings onClose={onClose} />
      )}

      {currentView === 'stream-settings' && (
        <StreamSettings onClose={onClose} />
      )}

      {currentView === 'app-settings' && (
        <AppSettings onClose={onClose} />
      )}
    </AnimatePresence>
  );
};

export default SettingsManager;