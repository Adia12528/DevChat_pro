import React from 'react';
import { AnimatePresence } from 'framer-motion';
import CallSettings from './callSettings';        // Capital C, Capital S
import AudioSettings from './AudioSettings';      // Capital A, Capital S
import VideoSettings from './VideoSettings';      // Capital V, Capital S
import StreamSettings from './StreamSettings';    // Capital S, Capital S
import AppSettings from './AppSettings';          // Capital A, Capital S
import CallHistoryPanel from '../CallHistoryPanel'; // Capital C, Capital H, Capital P

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