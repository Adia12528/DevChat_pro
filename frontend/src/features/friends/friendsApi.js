// Edit a message
export const editMessage = (token, messageId, text) =>
  request(`/api/friends/messages/${encodeURIComponent(messageId)}/edit`, token, {
    method: 'PUT',
    body: JSON.stringify({ text })
  });

// Delete a message
export const deleteMessage = (token, messageId) =>
  request(`/api/friends/messages/${encodeURIComponent(messageId)}`, token, {
    method: 'DELETE'
  });

// React to a message
export const reactToMessage = (token, messageId, emoji) =>
  request(`/api/friends/messages/${encodeURIComponent(messageId)}/react`, token, {
    method: 'POST',
    body: JSON.stringify({ emoji })
  });
// Delete all messages in a conversation for the user
export const deleteConversationMessages = (token, contactUniqueId) =>
  request(`/api/friends/messages/${encodeURIComponent(contactUniqueId)}/delete`, token, {
    method: 'POST'
  });
// Friend request APIs
export const sendFriendRequest = (token, toUniqueId) =>
  request('/api/friends/request', token, {
    method: 'POST',
    body: JSON.stringify({ toUniqueId })
  });

export const fetchFriendRequests = (token) =>
  request('/api/friends/requests', token);

export const acceptFriendRequest = (token, requestId) =>
  request(`/api/friends/request/${requestId}/accept`, token, {
    method: 'POST'
  });

export const rejectFriendRequest = (token, requestId) =>
  request(`/api/friends/request/${requestId}/reject`, token, {
    method: 'POST'
  });

export const removeFriend = (token, targetUniqueId) =>
  request('/api/friends/remove', token, {
    method: 'POST',
    body: JSON.stringify({ targetUniqueId })
  });
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  (window.location.hostname.includes('localhost')
    ? 'http://localhost:5000'
    : 'https://devchat-pro.onrender.com');

const request = async (path, token, options = {}) => {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
};

export const getFriendsBackendUrl = () => BACKEND_URL;

export const fetchFriendsProfile = (token) => request('/api/friends/profile', token);

export const updateFriendsProfile = (token, payload) =>
  request('/api/friends/profile', token, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

export const fetchContacts = (token) => request('/api/friends/list', token);

export const searchUsers = (token, query) =>
  request('/api/friends/search', token, {
    method: 'POST',
    body: JSON.stringify({ query })
  });

export const addContact = (token, friendId) =>
  request('/api/friends/add', token, {
    method: 'POST',
    body: JSON.stringify({ friendId })
  });

export const updateContactPreferences = (token, targetUniqueId, preferences) =>
  request(`/api/friends/contacts/${encodeURIComponent(targetUniqueId)}/preferences`, token, {
    method: 'PUT',
    body: JSON.stringify(preferences)
  });

export const fetchConversationMessages = (token, contactUniqueId, options = {}) => {
  const params = new URLSearchParams();
  if (options.before) params.set('before', options.before);
  if (options.limit) params.set('limit', String(options.limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/friends/messages/${encodeURIComponent(contactUniqueId)}${suffix}`, token);
};

export const sendMessage = (token, payload) =>
  request('/api/friends/send', token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const saveUserSettings = (token, payload) =>
  request('/api/user/settings', token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
