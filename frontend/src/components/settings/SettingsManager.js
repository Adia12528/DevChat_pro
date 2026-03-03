import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        <motion.div
          className="settings-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="settings-modal"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CallSettings onClose={onClose} />
          </motion.div>
        </motion.div>
      )}

      {currentView === 'audio-settings' && (
        <motion.div
          className="settings-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="settings-modal"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <AudioSettings onClose={onClose} />
          </motion.div>
        </motion.div>
      )}

      {currentView === 'video-settings' && (
        <motion.div
          className="settings-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="settings-modal"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <VideoSettings onClose={onClose} />
          </motion.div>
        </motion.div>
      )}

      {currentView === 'stream-settings' && (
        <motion.div
          className="settings-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="settings-modal"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <StreamSettings onClose={onClose} />
          </motion.div>
        </motion.div>
      )}

      {currentView === 'app-settings' && (
        <motion.div
          className="settings-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="settings-modal"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <AppSettings onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsManager;