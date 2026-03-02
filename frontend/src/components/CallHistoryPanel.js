// CallHistoryPanel.js
import React from 'react';
import { Phone, Video, Clock, Download, X } from 'lucide-react';

const CallHistoryPanel = ({ history = [], onClose, formatDuration }) => {
  return (
    <div className="call-history-panel">
      <div className="panel-header">
        <h3>Call History</h3>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      <div className="panel-content">
        {history.length === 0 ? (
          <div className="empty-state">
            <Phone size={40} />
            <p>No call history yet</p>
          </div>
        ) : (
          history.map((call, index) => (
            <div key={index} className="call-history-item">
              <div className="call-icon">
                {call.type === 'video' ? <Video size={16} /> : <Phone size={16} />}
              </div>
              <div className="call-details">
                <div className="call-peer">{call.peer}</div>
                <div className="call-meta">
                  <Clock size={12} />
                  <span>{new Date(call.timestamp).toLocaleString()}</span>
                  <span>•</span>
                  <span>{formatDuration(call.duration)}</span>
                </div>
              </div>
              <button className="call-export">
                <Download size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CallHistoryPanel;