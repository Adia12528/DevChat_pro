import React from 'react';
import { AnimatePresence } from 'framer-motion';
import CallSettings from './callSettings';
import AudioSettings from './audioSettings';
import VideoSettings from './VideoSettings';
import StreamSettings from './StreamSettings';
import AppSettings from './AppSettings';
import CallHistoryPanel from '../CallHistoryPanel';

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

      {currentView === 'call-history' && (
        <CallHistoryPanel
          callHistory={callHistory}
          onClose={onClose}
          formatDuration={formatDuration}
          getQualityLabelStyle={getQualityLabelStyle}
        />
      )}
    </AnimatePresence>
  );
};

export default SettingsManager;