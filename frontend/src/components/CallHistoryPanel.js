import React, { useState } from 'react';

/**
 * CallHistoryPanel - Displays call history with stats and analytics
 */
const CallHistoryPanel = ({
  callHistory,
  onClose,
  formatDuration,
  getQualityLabelStyle
}) => {
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'longest', 'quality'
  const [filterType, setFilterType] = useState('all'); // 'all', 'video', 'voice'

  if (!callHistory || callHistory.length === 0) {
    return (
      <div className="call-history-panel">
        <div className="panel-header">
          <h3>📞 Call History</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="empty-state">
          <p>No calls yet. Start a call to see history here!</p>
        </div>
      </div>
    );
  }

  // Filter and sort calls
  let filteredCalls = callHistory;
  if (filterType !== 'all') {
    filteredCalls = filteredCalls.filter(call => call.type === filterType);
  }

  if (sortBy === 'recent') {
    filteredCalls = [...filteredCalls].reverse();
  } else if (sortBy === 'longest') {
    filteredCalls = [...filteredCalls].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  } else if (sortBy === 'quality') {
    filteredCalls = [...filteredCalls].sort((a, b) => 
      (b.stats?.qualityScore || 0) - (a.stats?.qualityScore || 0)
    );
  }

  // Calculate stats
  const totalCalls = callHistory.length;
  const totalDuration = callHistory.reduce((sum, call) => sum + (call.duration || 0), 0);
  const avgQuality = callHistory.length > 0
    ? (callHistory.reduce((sum, call) => sum + (call.stats?.qualityScore || 0), 0) / callHistory.length).toFixed(1)
    : 0;

  return (
    <div className="call-history-panel">
      <div className="panel-header">
        <h3>📞 Call History</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Stats Summary */}
      <div className="history-stats">
        <div className="stat-card">
          <span className="stat-number">{totalCalls}</span>
          <span className="stat-label">Total Calls</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{formatDuration(totalDuration)}</span>
          <span className="stat-label">Total Duration</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{avgQuality}</span>
          <span className="stat-label">Avg Quality</span>
        </div>
      </div>

      {/* Filter and Sort Controls */}
      <div className="history-controls">
        <div className="control-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Calls</option>
            <option value="video">Video Only</option>
            <option value="voice">Voice Only</option>
          </select>
        </div>
        <div className="control-group">
          <label>Sort By:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Most Recent</option>
            <option value="longest">Longest Duration</option>
            <option value="quality">Best Quality</option>
          </select>
        </div>
      </div>

      {/* Call List */}
      <div className="history-list">
        {filteredCalls.map((call, index) => {
          const qualityStyle = getQualityLabelStyle(call.stats?.qualityScore || 0);
          const timestamp = new Date(call.timestamp);
          const dateStr = timestamp.toLocaleDateString();
          const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={index} className="history-item">
              <div className="call-icon">
                {call.type === 'video' ? '📹' : '☎️'}
              </div>
              <div className="call-details">
                <div className="call-peer">{call.peer}</div>
                <div className="call-metadata">
                  <span className="call-date">{dateStr} {timeStr}</span>
                  <span className="call-duration">
                    Duration: {formatDuration(call.duration || 0)}
                  </span>
                </div>
              </div>
              <div className="call-stats-mini">
                {call.stats && (
                  <>
                    <span className="quality-badge" style={{ backgroundColor: qualityStyle.color }}>
                      {qualityStyle.label}
                    </span>
                    <span className="latency">
                      {Math.round(call.stats.latency || 0)}ms
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCalls.length === 0 && (
        <div className="empty-state">
          <p>No calls found for the selected filter</p>
        </div>
      )}
    </div>
  );
};

export default CallHistoryPanel;
