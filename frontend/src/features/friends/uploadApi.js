// File upload API for friends feature
import { getFriendsBackendUrl } from './friendsApi';

export async function uploadFileToBackend(token, file, type = 'file') {
  const url = `${getFriendsBackendUrl()}/api/upload/${type}`;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Upload failed (${response.status})`);
  }
  return response.json();
}
