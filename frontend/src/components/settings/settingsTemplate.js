import React from 'react';
import { X, Save, RotateCcw } from 'lucide-react';

const SettingsTemplate = ({ 
  title, 
  icon, 
  children, 
  onClose, 
  onSave, 
  onReset,
  showReset = true,
  saveLabel = 'Save Changes',
  isLoading = false
}) => {
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            {icon && <span className="settings-modal-icon">{icon}</span>}
            <h3>{title}</h3>
          </div>
          <button className="settings-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="settings-modal-content">
          {children}
        </div>

        <div className="settings-modal-footer">
          {showReset && (
            <button 
              className="settings-btn-reset" 
              onClick={onReset}
              disabled={isLoading}
            >
              <RotateCcw size={16} />
              <span>Reset to Defaults</span>
            </button>
          )}
          <div className="settings-footer-actions">
            <button className="settings-btn-cancel" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button 
              className="settings-btn-save" 
              onClick={onSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner-small" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{saveLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTemplate;