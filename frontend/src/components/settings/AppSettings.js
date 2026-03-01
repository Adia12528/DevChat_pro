import React, { useState } from 'react';
import { Settings, Moon, Sun, Type, Bell, Globe, Lock, Eye, EyeOff } from 'lucide-react';
import SettingsTemplate from './settingsTemplate';
import { useSettings } from '../../context/settingsContext';

const AppSettings = ({ onClose }) => {
  const { settings, updateSettings, resetAllSettings, exportSettings, importSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings.ui || {});
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState(null);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateSettings('ui', localSettings);
    onClose();
  };

  const handleResetAll = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      resetAllSettings();
      setLocalSettings(settings.ui);
    }
  };

  const handleExport = () => {
    exportSettings();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = importSettings(event.target.result);
      if (result.success) {
        setImportError(null);
        setLocalSettings(settings.ui);
        alert('Settings imported successfully!');
      } else {
        setImportError(result.error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <SettingsTemplate
      title="App Settings"
      icon={<Settings size={20} />}
      onClose={onClose}
      onSave={handleSave}
      onReset={handleResetAll}
      saveLabel="Save Settings"
    >
      <div className="settings-group">
        <h4>Theme</h4>
        
        <div className="settings-theme-grid">
          {[
            { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
            { id: 'light', label: 'Light', icon: <Sun size={16} /> },
            { id: 'ocean', label: 'Ocean', icon: '🌊' },
            { id: 'forest', label: 'Forest', icon: '🌲' },
            { id: 'sunset', label: 'Sunset', icon: '🌅' },
            { id: 'pink', label: 'Pink', icon: '🌸' }
          ].map((themeOption) => (
            <button
              key={themeOption.id}
              className={`settings-chip ${settings.theme === themeOption.id ? 'active' : ''}`}
              onClick={() => updateSettings('theme', themeOption.id)}
            >
              <span className="settings-chip-icon">{themeOption.icon}</span>
              <span>{themeOption.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h4>Font</h4>
        
        <div className="settings-theme-grid">
          {[
            { id: 'default', label: 'Default', icon: 'Aa' },
            { id: 'rounded', label: 'Rounded', icon: 'Aa' },
            { id: 'serif', label: 'Serif', icon: 'Aa' },
            { id: 'mono', label: 'Mono', icon: 'Aa' }
          ].map((fontOption) => (
            <button
              key={fontOption.id}
              className={`settings-chip ${settings.fontStyle === fontOption.id ? 'active' : ''}`}
              onClick={() => updateSettings('fontStyle', fontOption.id)}
            >
              <span className="settings-chip-icon">{fontOption.icon}</span>
              <span>{fontOption.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-row">
          <label>Font size</label>
          <select
            value={localSettings.fontSize || 'medium'}
            onChange={(e) => handleChange('fontSize', e.target.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra Large</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h4>Language & Region</h4>
        
        <div className="settings-row">
          <label>Language</label>
          <select
            value={localSettings.language || 'en'}
            onChange={(e) => handleChange('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="ru">Русский</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Time format</label>
          <select
            value={localSettings.timeFormat || '12h'}
            onChange={(e) => handleChange('timeFormat', e.target.value)}
          >
            <option value="12h">12-hour (12:34 PM)</option>
            <option value="24h">24-hour (12:34)</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Date format</label>
          <select
            value={localSettings.dateFormat || 'MM/DD/YYYY'}
            onChange={(e) => handleChange('dateFormat', e.target.value)}
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h4>Accessibility</h4>
        
        <div className="settings-row">
          <label>High contrast mode</label>
          <input
            type="checkbox"
            checked={localSettings.highContrast}
            onChange={(e) => handleChange('highContrast', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Reduce motion</label>
          <input
            type="checkbox"
            checked={localSettings.reduceMotion}
            onChange={(e) => handleChange('reduceMotion', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Large cursor</label>
          <input
            type="checkbox"
            checked={localSettings.largeCursor}
            onChange={(e) => handleChange('largeCursor', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Screen reader support</label>
          <input
            type="checkbox"
            checked={localSettings.screenReader}
            onChange={(e) => handleChange('screenReader', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Keyboard navigation</label>
          <input
            type="checkbox"
            checked={localSettings.keyboardNavigation !== false}
            onChange={(e) => handleChange('keyboardNavigation', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Focus indicator</label>
          <input
            type="checkbox"
            checked={localSettings.focusIndicator !== false}
            onChange={(e) => handleChange('focusIndicator', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Privacy</h4>
        
        <div className="settings-row">
          <label>Show online status</label>
          <input
            type="checkbox"
            checked={localSettings.showOnlineStatus !== false}
            onChange={(e) => handleChange('showOnlineStatus', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Show typing indicator</label>
          <input
            type="checkbox"
            checked={localSettings.showTypingIndicator !== false}
            onChange={(e) => handleChange('showTypingIndicator', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Show read receipts</label>
          <input
            type="checkbox"
            checked={localSettings.showReadReceipts !== false}
            onChange={(e) => handleChange('showReadReceipts', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Block message previews</label>
          <input
            type="checkbox"
            checked={localSettings.blockPreviews || false}
            onChange={(e) => handleChange('blockPreviews', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h4>Data & Storage</h4>
        
        <div className="settings-row">
          <label>Auto-download media</label>
          <select
            value={localSettings.autoDownloadMedia || 'wifi'}
            onChange={(e) => handleChange('autoDownloadMedia', e.target.value)}
          >
            <option value="always">Always</option>
            <option value="wifi">Wi-Fi only</option>
            <option value="never">Never</option>
          </select>
        </div>

        <div className="settings-row">
          <label>Cache images</label>
          <input
            type="checkbox"
            checked={localSettings.cacheImages !== false}
            onChange={(e) => handleChange('cacheImages', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <label>Clear cache on exit</label>
          <input
            type="checkbox"
            checked={localSettings.clearCacheOnExit || false}
            onChange={(e) => handleChange('clearCacheOnExit', e.target.checked)}
          />
        </div>

        <button className="settings-btn settings-btn-warning">
          Clear All Cache
        </button>
      </div>

      <div className="settings-group">
        <h4>Backup & Restore</h4>
        
        <div className="settings-row">
          <label>Export settings</label>
          <button className="settings-btn" onClick={handleExport}>
            Export to JSON
          </button>
        </div>

        <div className="settings-row">
          <label>Import settings</label>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
            id="import-settings"
          />
          <button 
            className="settings-btn" 
            onClick={() => document.getElementById('import-settings').click()}
          >
            Choose File
          </button>
        </div>

        {importError && (
          <div className="settings-error">
            Error importing: {importError}
          </div>
        )}
      </div>

      <style jsx>{`
        .settings-group {
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--divider);
        }

        .settings-group:last-child {
          border-bottom: none;
        }

        .settings-group h4 {
          margin: 0 0 var(--space-3) 0;
          font-size: var(--text-sm);
          color: var(--txt-secondary);
          font-weight: 600;
        }

        .settings-theme-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .settings-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-3) var(--space-2);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--txt);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-size: var(--text-xs);
        }

        .settings-chip:hover {
          border-color: var(--primary);
          background: var(--primary-muted);
        }

        .settings-chip.active {
          border-color: var(--primary);
          background: var(--primary-muted);
          color: var(--primary);
        }

        .settings-chip-icon {
          font-size: 20px;
          margin-bottom: 4px;
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2) 0;
          gap: var(--space-3);
        }

        .settings-row label {
          font-size: var(--text-sm);
          color: var(--txt);
          flex: 1;
        }

        .settings-row select {
          width: 200px;
          padding: var(--space-2) var(--space-3);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--txt);
        }

        .settings-btn {
          padding: var(--space-2) var(--space-4);
          background: var(--primary-muted);
          color: var(--primary);
          border: 1px solid var(--primary);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .settings-btn:hover {
          background: var(--primary);
          color: #000;
        }

        .settings-btn-warning {
          background: var(--warning-muted);
          color: var(--warning);
          border-color: var(--warning);
        }

        .settings-btn-warning:hover {
          background: var(--warning);
          color: #000;
        }

        .settings-error {
          margin-top: var(--space-2);
          padding: var(--space-2);
          background: var(--error-muted);
          color: var(--error);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
        }

        @media (max-width: 768px) {
          .settings-theme-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          
          .settings-row {
            flex-wrap: wrap;
          }
          
          .settings-row select {
            width: 100%;
          }
        }
      `}</style>
    </SettingsTemplate>
  );
};

export default AppSettings;