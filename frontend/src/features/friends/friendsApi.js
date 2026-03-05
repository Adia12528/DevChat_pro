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

export const fetchContacts = (token) => request('/api/friends/contacts', token);

export const searchUsers = (token, query) =>
  request(`/api/friends/search?query=${encodeURIComponent(query)}`, token);

export const addContact = (token, targetUniqueId) =>
  request('/api/friends/contacts', token, {
    method: 'POST',
    body: JSON.stringify({ targetUniqueId })
  });

export const updateContactPreferences = (token, targetUniqueId, preferences) =>
  request(`/api/friends/contacts/${encodeURIComponent(targetUniqueId)}/preferences`, token, {
    method: 'PUT',
    body: JSON.stringify(preferences)
  });

export const fetchConversationMessages = (token, contactUniqueId) =>
  request(`/api/friends/conversations/${encodeURIComponent(contactUniqueId)}/messages`, token);
