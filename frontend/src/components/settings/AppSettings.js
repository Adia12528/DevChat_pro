import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Moon, Sun, Palette, Type, Bell, Shield, 
  Download, Upload, RefreshCw, LogOut, Trash2 
} from 'lucide-react';
import { useSettings } from '../../context/settingsContext';
import { exportSettings, importSettings, resetSettings } from '../../utils/settings';

const AppSettings = ({ onClose }) => {
  const { settings, updateSettings } = useSettings();
  const [theme, setTheme] = useState(settings.ui?.theme || 'dark');
  const [fontSize, setFontSize] = useState(settings.ui?.fontSize || 'medium');
  const [compactMode, setCompactMode] = useState(settings.ui?.compactMode || false);
  const [notifications, setNotifications] = useState(settings.notifications || {});
  const [privacy, setPrivacy] = useState(settings.privacy || {});

  useEffect(() => {
    setTheme(settings.ui?.theme || 'dark');
    setFontSize(settings.ui?.fontSize || 'medium');
    setCompactMode(!!settings.ui?.compactMode);
    setNotifications(settings.notifications || {});
    setPrivacy(settings.privacy || {});
  }, [settings]);

  const themes = [
    { id: 'dark', name: 'Dark', icon: <Moon size={16} /> },
    { id: 'light', name: 'Light', icon: <Sun size={16} /> },
    { id: 'ocean', name: 'Ocean', icon: <Palette size={16} /> },
    { id: 'forest', name: 'Forest', icon: <Palette size={16} /> },
    { id: 'sunset', name: 'Sunset', icon: <Palette size={16} /> },
    { id: 'pink', name: 'Pink', icon: <Palette size={16} /> }
  ];

  const fontSizes = [
    { id: 'small', name: 'Small' },
    { id: 'medium', name: 'Medium' },
    { id: 'large', name: 'Large' }
  ];

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleExportSettings = () => {
    exportSettings();
  };

  const handleImportSettings = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const imported = await importSettings(file);
        updateSettings(imported);
        alert('Settings imported successfully!');
      } catch (error) {
        alert('Failed to import settings: ' + error.message);
      }
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      resetSettings();
      window.location.reload();
    }
  };

  const handleSave = () => {
    updateSettings({
      ui: { theme, fontSize, compactMode },
      notifications,
      privacy
    });
    onClose();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const content = (
    <div className="app-settings-overlay" onClick={onClose}>
      <div className="app-settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="app-settings-header">
          <h2>App Settings</h2>
          <button className="app-settings-close-btn" onClick={onClose} aria-label="Close app settings" type="button">
            <X size={20} />
          </button>
        </div>

        <div className="app-settings-content">
          <div className="app-settings-section">
            <h3>
              <Palette size={18} />
              Appearance
            </h3>

            <div className="app-settings-item">
              <label>Theme</label>
              <div className="app-settings-theme-grid">
                {themes.map(t => (
                  <button
                    key={t.id}
                    className={`app-settings-theme-option ${theme === t.id ? 'active' : ''}`}
                    onClick={() => handleThemeChange(t.id)}
                    type="button"
                  >
                    {t.icon}
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="app-settings-item">
              <label>Font Size</label>
              <div className="app-settings-font-size-options">
                {fontSizes.map(f => (
                  <button
                    key={f.id}
                    className={`app-settings-font-option ${fontSize === f.id ? 'active' : ''}`}
                    onClick={() => setFontSize(f.id)}
                    type="button"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="app-settings-item">
              <label>Compact Mode</label>
              <div className="app-settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                />
                <span className="app-settings-toggle-slider"></span>
              </div>
            </div>
          </div>

          <div className="app-settings-section">
            <h3>
              <Bell size={18} />
              Notifications
            </h3>

            <div className="app-settings-item">
              <label>Sound Notifications</label>
              <div className="app-settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.soundEnabled !== false}
                  onChange={(e) => setNotifications(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                />
                <span className="app-settings-toggle-slider"></span>
              </div>
            </div>

            <div className="app-settings-item">
              <label>Desktop Notifications</label>
              <div className="app-settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.desktopNotifications !== false}
                  onChange={(e) => setNotifications(prev => ({ ...prev, desktopNotifications: e.target.checked }))}
                />
                <span className="app-settings-toggle-slider"></span>
              </div>
            </div>

            <div className="app-settings-item">
              <label>Mention Only</label>
              <div className="app-settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.mentionOnly || false}
                  onChange={(e) => setNotifications(prev => ({ ...prev, mentionOnly: e.target.checked }))}
                />
                <span className="app-settings-toggle-slider"></span>
              </div>
            </div>
          </div>

          <div className="app-settings-section">
            <h3>
              <Shield size={18} />
              Privacy
            </h3>

            <div className="app-settings-item">
              <label>Show Last Seen</label>
              <div className="app-settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={privacy.showLastSeen !== false}
                  onChange={(e) => setPrivacy(prev => ({ ...prev, showLastSeen: e.target.checked }))}
                />
                <span className="app-settings-toggle-slider"></span>
              </div>
            </div>

            <div className="app-settings-item">
              <label>Show Read Receipts</label>
              <div className="app-settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={privacy.showReadReceipts !== false}
                  onChange={(e) => setPrivacy(prev => ({ ...prev, showReadReceipts: e.target.checked }))}
                />
                <span className="app-settings-toggle-slider"></span>
              </div>
            </div>
          </div>

          <div className="app-settings-section">
            <h3>
              <Download size={18} />
              Data Management
            </h3>

            <div className="app-settings-data-management">
              <button className="app-settings-data-btn" onClick={handleExportSettings} type="button">
                <Download size={16} />
                Export Settings
              </button>

              <label className="app-settings-data-btn">
                <Upload size={16} />
                Import Settings
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  style={{ display: 'none' }}
                />
              </label>

              <button className="app-settings-data-btn warning" onClick={handleResetSettings} type="button">
                <RefreshCw size={16} />
                Reset to Default
              </button>
            </div>
          </div>

          <div className="app-settings-actions">
            <button className="app-settings-btn-secondary" onClick={onClose} type="button">Cancel</button>
            <button className="app-settings-btn-primary" onClick={handleSave} type="button">Save Changes</button>
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

export default AppSettings;