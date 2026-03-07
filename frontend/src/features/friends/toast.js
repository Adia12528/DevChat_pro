// Minimal toast implementation for FriendsFeature.jsx
import React, { useEffect, useState } from 'react';
import './friends.css';

export function useToast() {
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  const showToast = (message, type = 'info', duration = 2500) => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), duration);
  };

  const Toast = () =>
    toast.visible ? (
      <div className={`friends-toast friends-toast-${toast.type}`}>{toast.message}</div>
    ) : null;

  return { showToast, Toast };
}
