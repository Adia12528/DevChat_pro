import React, { useEffect, useState } from 'react';
import { searchUsers } from './friendsApi';

// Shows a list of users who are not yet friends, updates in real time if possible
const FriendsSuggestions = ({ authToken, contacts, onSendFriendRequest, onClose }) => {
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Helper: get uniqueIds of current friends
  const friendIds = contacts.map(c => c.uniqueId);
  // Try to get current user's id (if present in contacts as self)
  const selfId = contacts.find(c => c.isSelf)?.uniqueId || null;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    // Fetch all users (empty query returns all, or use a special API if available)
    searchUsers(authToken, '').then(data => {
      if (!isMounted) return;
      let users = data.users || [];
      // Exclude current friends and self
      users = users.filter(u => !friendIds.includes(u.uniqueId) && (!selfId || u.uniqueId !== selfId));
      setSuggestedUsers(users);
      setLoading(false);
    }).catch(e => {
      if (!isMounted) return;
      setError(e.message || 'Failed to load suggestions');
      setLoading(false);
    });
    // If contacts change (friend added/removed), suggestions update automatically
    return () => { isMounted = false; };
  }, [authToken, contacts, selfId]);

  if (loading) return <div className="friends-empty">Loading suggestions...</div>;
  if (error) return <div className="friends-empty">{error}</div>;
  if (!suggestedUsers.length) return <div className="friends-empty">No suggestions available.</div>;

  return (
    <div className="friends-suggestions-list">
      {suggestedUsers.map(user => (
        <div key={user.uniqueId} className="friends-suggestion-card">
          <div className="friends-suggestion-meta">
            <strong>{user.displayName || user.uniqueId}</strong>
            <small>{user.email || user.phoneNumber || user.uniqueId}</small>
          </div>
          <button
            type="button"
            className="friends-suggestion-add"
            onClick={() => {
              onSendFriendRequest(user.uniqueId);
              onClose();
            }}
          >
            Add Friend
          </button>
        </div>
      ))}
    </div>
  );
};

export default FriendsSuggestions;
