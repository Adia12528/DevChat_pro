import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import './friends.css';
import { friendsAuth, isFirebaseConfigured } from './firebaseClient';
import {
  addContact,
  fetchContacts,
  fetchConversationMessages,
  fetchFriendsProfile,
  getFriendsBackendUrl,
  searchUsers,
  updateContactPreferences,
  updateFriendsProfile
} from './friendsApi';

const getFriendlyRemaining = (expiresAt) => {
  if (!expiresAt) return 'kept';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'expires now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.round(hours / 24);
  return `${days}d left`;
};

const makeTempMessageId = () => `temp_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

const getReceiptConfig = (msg) => {
  if (!msg?.isMine) return null;
  if (msg.deliveryStatus === 'pending') {
    return { text: '...', className: 'sent', title: 'Sending' };
  }
  if (msg.deliveryStatus === 'read') {
    const seenAt = msg.readAt ? ` at ${new Date(msg.readAt).toLocaleString()}` : '';
    return { text: '✓✓', className: 'read', title: `Read${seenAt}` };
  }
  if (msg.deliveryStatus === 'delivered') {
    return { text: '✓✓', className: 'delivered', title: 'Delivered' };
  }
  return { text: '✓', className: 'sent', title: 'Sent' };
};

const playNotificationTone = (kind = 'soft') => {
  if (kind === 'none') return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const makeBeep = (frequency, startOffset, duration, gainValue) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + startOffset);
    osc.stop(ctx.currentTime + startOffset + duration);
  };

  if (kind === 'chime') {
    makeBeep(880, 0, 0.2, 0.04);
    makeBeep(1175, 0.18, 0.26, 0.035);
  } else if (kind === 'pop') {
    makeBeep(640, 0, 0.08, 0.045);
  } else {
    makeBeep(720, 0, 0.12, 0.03);
    makeBeep(820, 0.12, 0.1, 0.022);
  }
};

const mapFirebaseAuthError = (error) => {
  const code = error?.code || '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this host';

  if (code === 'auth/unauthorized-domain') {
    return `This domain is not authorized in Firebase Auth: ${hostname}. Add it in Firebase Console -> Authentication -> Settings -> Authorized domains, then retry.`;
  }
  if (code === 'auth/invalid-phone-number') {
    return 'Invalid phone number format. Use E.164 format (e.g. +911234567890).';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completion.';
  }
  if (code === 'auth/captcha-check-failed') {
    return 'reCAPTCHA verification failed. Refresh and try again.';
  }

  return error?.message || 'Authentication failed';
};

const mapFriendsBackendError = (error) => {
  const raw = error?.message || String(error || '');
  if (raw.includes('Firebase auth is not configured on backend')) {
    return 'Friends backend Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY) on the backend host and redeploy.';
  }
  return raw || 'Friends backend request failed';
};

const LoginPanel = ({ onGoogleLogin, onPhoneStart, onPhoneConfirm, phoneState, error }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  return (
    <div className="friends-login" aria-label="Friends auth login">
      <h3 className="friends-title">Friends Login</h3>
      <p className="friends-subtitle">Use Firebase auth. Your chats sync through backend + socket namespace.</p>

      <div className="friends-row">
        <button type="button" onClick={onGoogleLogin}>Continue with Google</button>
      </div>

      <div className="friends-row">
        <input
          placeholder="Phone number (E.164, e.g. +911234567890)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={phoneState === 'sending'}
        />
        <button
          type="button"
          className="secondary"
          onClick={() => onPhoneStart(phone)}
          disabled={!phone.trim() || phoneState === 'sending'}
        >
          {phoneState === 'sending' ? 'Sending...' : 'Send OTP'}
        </button>
      </div>

      <div className="friends-row">
        <input
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          disabled={phoneState !== 'code-sent'}
        />
        <button
          type="button"
          onClick={() => onPhoneConfirm(otp)}
          disabled={phoneState !== 'code-sent' || !otp.trim()}
        >
          Verify OTP
        </button>
      </div>

      <div id="friends-recaptcha-container" />

      {!isFirebaseConfigured ? (
        <p className="friends-error">Firebase client config is missing. Add REACT_APP_FIREBASE_* vars.</p>
      ) : null}
      {error ? <p className="friends-error">{error}</p> : null}
    </div>
  );
};

const FriendsHomePage = ({ profile, onOpenChats, onOpenSettings, onLogout }) => {
  return (
    <div className="friends-login friends-home-page" aria-label="Friends home page">
      <h3 className="friends-title">Welcome, {profile.displayName || 'Friend'}</h3>
      <p className="friends-subtitle">You are logged in. Choose what to open next.</p>

      <div className="friends-home-grid">
        <button type="button" className="friends-home-card" onClick={onOpenChats}>
          <strong>Open Chats</strong>
          <span>Go to your contacts and conversations.</span>
        </button>
        <button type="button" className="friends-home-card secondary" onClick={onOpenSettings}>
          <strong>Open Settings</strong>
          <span>Update profile and preferences before chatting.</span>
        </button>
      </div>

      <div className="friends-row">
        <button type="button" className="secondary" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
};

const FriendsSettingsPage = ({ profile, authToken, onProfileRefresh, onBackHome, onOpenChats, onLogout }) => {
  const [nameDraft, setNameDraft] = useState(profile.displayName || '');
  const [bioDraft, setBioDraft] = useState(profile.bio || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setNameDraft(profile.displayName || '');
    setBioDraft(profile.bio || '');
  }, [profile.displayName, profile.bio]);

  const handleSave = async () => {
    try {
      setError('');
      setSaved('');
      await updateFriendsProfile(authToken, {
        displayName: nameDraft,
        bio: bioDraft
      });
      await onProfileRefresh();
      setSaved('Profile saved successfully.');
    } catch (e) {
      setError(e.message || 'Failed to update profile');
    }
  };

  return (
    <div className="friends-login friends-settings-page" aria-label="Friends settings page">
      <h3 className="friends-title">Friends Settings</h3>
      <p className="friends-subtitle">Manage your profile before entering chats.</p>

      <div className="friends-id-badge">ID: {profile.uniqueId}</div>

      <div className="friends-row">
        <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Display name" />
      </div>
      <div className="friends-row">
        <textarea value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} placeholder="Bio" rows={4} />
      </div>

      <div className="friends-row">
        <button type="button" onClick={handleSave}>Save Profile</button>
        <button type="button" className="secondary" onClick={onOpenChats}>Open Chats</button>
      </div>
      <div className="friends-row">
        <button type="button" className="secondary" onClick={onBackHome}>Back</button>
        <button type="button" className="secondary" onClick={onLogout}>Log out</button>
      </div>

      {saved ? <p className="friends-note">{saved}</p> : null}
      {error ? <p className="friends-error">{error}</p> : null}
    </div>
  );
};

const FriendsWorkspace = ({ authToken, profile, onProfileRefresh, onLogout, socket, onOpenSettings, onBackHome }) => {
  const [nameDraft, setNameDraft] = useState(profile.displayName || '');
  const [bioDraft, setBioDraft] = useState(profile.bio || '');
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messagesByContact, setMessagesByContact] = useState({});
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState('');
  const [disappearMode, setDisappearMode] = useState('__default__');
  const [customExpire, setCustomExpire] = useState('');
  const [error, setError] = useState('');
  const [typingByContact, setTypingByContact] = useState({});

  const typingStopTimerRef = useRef(null);
  const lastNotifyAtRef = useRef({});
  const typingActiveRef = useRef(false);
  const pendingSendTimersRef = useRef({});

  const selectedContact = useMemo(
    () => contacts.find((item) => item.uniqueId === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const activeMessages = useMemo(() => messagesByContact[selectedContactId] || [], [messagesByContact, selectedContactId]);

  const notifyIncomingMessage = (contact, incoming) => {
    if (!contact || !incoming || incoming.isMine) return;
    if (contact.preferences?.muted || contact.preferences?.notifications === false) return;

    const key = contact.uniqueId;
    const now = Date.now();
    if (now - (lastNotifyAtRef.current[key] || 0) < 2500) return;
    lastNotifyAtRef.current[key] = now;

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(contact.displayName || contact.uniqueId, {
          body: incoming.text,
          tag: `friends-${key}`
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    playNotificationTone(contact.preferences?.notificationSound || 'soft');
  };

  const loadContacts = async () => {
    try {
      const data = await fetchContacts(authToken);
      setContacts(data.contacts || []);
      if (!selectedContactId && data.contacts?.[0]?.uniqueId) {
        setSelectedContactId(data.contacts[0].uniqueId);
      }
    } catch (e) {
      setError(e.message || 'Failed to load contacts');
    }
  };

  const loadMessages = async (contactUniqueId) => {
    if (!contactUniqueId) return;
    try {
      const data = await fetchConversationMessages(authToken, contactUniqueId);
      setMessagesByContact((prev) => ({ ...prev, [contactUniqueId]: data.messages || [] }));
    } catch (e) {
      setError(e.message || 'Failed to load messages');
    }
  };

  const emitMarkRead = (contactUniqueId) => {
    if (!socket || !contactUniqueId) return;
    socket.emit('friends:mark_read', { withUniqueId: contactUniqueId });
  };

  useEffect(() => {
    setNameDraft(profile.displayName || '');
    setBioDraft(profile.bio || '');
  }, [profile.displayName, profile.bio]);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (!selectedContactId) return;
    loadMessages(selectedContactId);
    socket?.emit('friends:join_conversation', { withUniqueId: selectedContactId });
    emitMarkRead(selectedContactId);
  }, [selectedContactId, socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const onHistory = ({ withUniqueId, messages }) => {
      setMessagesByContact((prev) => ({ ...prev, [withUniqueId]: messages || [] }));
      if (selectedContactId === withUniqueId) {
        emitMarkRead(withUniqueId);
      }
    };

    const onNewMessage = ({ withUniqueId, message: incoming, clientTempId }) => {
      setMessagesByContact((prev) => {
        const existing = prev[withUniqueId] || [];
        let nextExisting = existing;
        if (clientTempId) {
          nextExisting = existing.filter((m) => m.id !== clientTempId);
          if (pendingSendTimersRef.current[clientTempId]) {
            window.clearTimeout(pendingSendTimersRef.current[clientTempId]);
            delete pendingSendTimersRef.current[clientTempId];
          }
        }
        const deduped = nextExisting.some((m) => m.id === incoming.id)
          ? nextExisting
          : [...nextExisting, incoming].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return { ...prev, [withUniqueId]: deduped };
      });

      if (selectedContactId === withUniqueId && !incoming?.isMine) {
        emitMarkRead(withUniqueId);
      }
      const contact = contacts.find((c) => c.uniqueId === withUniqueId);
      notifyIncomingMessage(contact, incoming);
      loadContacts();
    };

    const onReadUpdate = ({ withUniqueId, messageIds, readAt }) => {
      if (!withUniqueId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      const ids = new Set(messageIds);
      setMessagesByContact((prev) => {
        const existing = prev[withUniqueId] || [];
        if (existing.length === 0) return prev;
        const next = existing.map((msg) => {
          if (!ids.has(msg.id)) return msg;
          return {
            ...msg,
            readAt,
            deliveredAt: msg.deliveredAt || readAt,
            deliveryStatus: 'read'
          };
        });
        return { ...prev, [withUniqueId]: next };
      });
      loadContacts();
    };

    const onTyping = ({ fromUniqueId, isTyping }) => {
      if (!fromUniqueId) return;
      setTypingByContact((prev) => ({ ...prev, [fromUniqueId]: !!isTyping }));
    };

    const onPresence = ({ uniqueId, online, lastSeen }) => {
      if (!uniqueId) return;
      setContacts((prev) => prev.map((contact) => {
        if (contact.uniqueId !== uniqueId) return contact;
        return {
          ...contact,
          online: !!online,
          lastSeen: lastSeen || contact.lastSeen || null
        };
      }));
    };

    const onSocketError = (payload) => {
      setError(payload?.message || 'Friends socket error');
    };

    const onUnreadUpdate = ({ withUniqueId, messageId }) => {
      if (!withUniqueId || !messageId) return;
      setMessagesByContact((prev) => {
        const list = prev[withUniqueId] || [];
        return {
          ...prev,
          [withUniqueId]: list.map((msg) => (msg.id === messageId ? { ...msg, readAt: null, deliveryStatus: msg.isMine ? 'delivered' : 'received' } : msg))
        };
      });
      loadContacts();
    };

    socket.on('friends:history', onHistory);
    socket.on('friends:new_message', onNewMessage);
    socket.on('friends:read_update', onReadUpdate);
    socket.on('friends:typing', onTyping);
    socket.on('friends:presence', onPresence);
    socket.on('friends:unread_update', onUnreadUpdate);
    socket.on('friends:error', onSocketError);

    return () => {
      socket.off('friends:history', onHistory);
      socket.off('friends:new_message', onNewMessage);
      socket.off('friends:read_update', onReadUpdate);
      socket.off('friends:typing', onTyping);
      socket.off('friends:presence', onPresence);
      socket.off('friends:unread_update', onUnreadUpdate);
      socket.off('friends:error', onSocketError);
    };
  }, [socket, selectedContactId, contacts]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      Object.values(pendingSendTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      pendingSendTimersRef.current = {};
    };
  }, []);

  const handleSaveProfile = async () => {
    try {
      setError('');
      await updateFriendsProfile(authToken, {
        displayName: nameDraft,
        bio: bioDraft
      });
      await onProfileRefresh();
    } catch (e) {
      setError(e.message || 'Failed to update profile');
    }
  };

  const handleSearch = async (value) => {
    setQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await searchUsers(authToken, value.trim());
      setSearchResults(data.users || []);
    } catch (e) {
      setError(e.message || 'Search failed');
    }
  };

  const handleAddContact = async (targetUniqueId) => {
    try {
      setError('');
      await addContact(authToken, targetUniqueId);
      setQuery('');
      setSearchResults([]);
      await loadContacts();
      setSelectedContactId(targetUniqueId);
    } catch (e) {
      setError(e.message || 'Unable to add contact');
    }
  };

  const handleSendMessage = () => {
    if (!socket || !selectedContactId || !message.trim()) return;

    const defaultPolicy = selectedContact?.preferences?.defaultDisappearPolicy || { mode: 'keep' };

    const policy =
      disappearMode === '__default__'
        ? defaultPolicy
        : disappearMode === 'keep'
          ? { mode: 'keep' }
          : disappearMode === 'immediate'
            ? { mode: 'immediate' }
            : disappearMode === 'custom'
              ? { mode: 'custom', value: customExpire }
              : { mode: 'preset', value: disappearMode };

    const messageText = message;
    const tempId = makeTempMessageId();
    const optimisticMessage = {
      id: tempId,
      text: messageText,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      disappearPolicy: policy,
      isMine: true,
      deliveryStatus: 'pending'
    };

    setMessagesByContact((prev) => {
      const current = prev[selectedContactId] || [];
      return {
        ...prev,
        [selectedContactId]: [...current, optimisticMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      };
    });

    pendingSendTimersRef.current[tempId] = window.setTimeout(() => {
      setMessagesByContact((prev) => {
        const current = prev[selectedContactId] || [];
        return {
          ...prev,
          [selectedContactId]: current.filter((m) => m.id !== tempId)
        };
      });
      delete pendingSendTimersRef.current[tempId];
      setError('Message send timed out. Please retry.');
    }, 12000);

    socket.emit('friends:send_message', {
      toUniqueId: selectedContactId,
      text: messageText,
      disappearPolicy: policy,
      clientTempId: tempId
    }, (ack) => {
      if (ack?.ok) {
        return;
      }

      if (pendingSendTimersRef.current[tempId]) {
        window.clearTimeout(pendingSendTimersRef.current[tempId]);
        delete pendingSendTimersRef.current[tempId];
      }

      setMessagesByContact((prev) => {
        const current = prev[selectedContactId] || [];
        return {
          ...prev,
          [selectedContactId]: current.filter((m) => m.id !== tempId)
        };
      });
      setError(ack?.error || 'Message failed to send.');
    });

    setMessage('');
    socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
    typingActiveRef.current = false;
  };

  const handleToggleMute = async () => {
    if (!selectedContact) return;
    try {
      setError('');
      await updateContactPreferences(authToken, selectedContact.uniqueId, {
        muted: !(selectedContact.preferences?.muted),
        notifications: selectedContact.preferences?.notifications !== false,
        notificationSound: selectedContact.preferences?.notificationSound || 'soft',
        defaultDisappearPolicy: selectedContact.preferences?.defaultDisappearPolicy || { mode: 'keep' }
      });
      await loadContacts();
    } catch (e) {
      setError(e.message || 'Failed to update mute preference');
    }
  };

  const handleToggleNotifications = async () => {
    if (!selectedContact) return;
    try {
      setError('');
      await updateContactPreferences(authToken, selectedContact.uniqueId, {
        muted: !!selectedContact.preferences?.muted,
        notifications: !(selectedContact.preferences?.notifications !== false),
        notificationSound: selectedContact.preferences?.notificationSound || 'soft',
        defaultDisappearPolicy: selectedContact.preferences?.defaultDisappearPolicy || { mode: 'keep' }
      });
      await loadContacts();
    } catch (e) {
      setError(e.message || 'Failed to update notification preference');
    }
  };

  const handleDefaultDisappearPolicyChange = async (value) => {
    if (!selectedContact) return;

    const nextDefault =
      value === '__keep__'
        ? { mode: 'keep' }
        : value === '__immediate__'
          ? { mode: 'immediate' }
          : value === '__1h__'
            ? { mode: 'preset', value: '1h' }
            : value === '__24h__'
              ? { mode: 'preset', value: '24h' }
              : value === '__3d__'
                ? { mode: 'preset', value: '3d' }
                : value === '__7d__'
                  ? { mode: 'preset', value: '7d' }
                  : { mode: 'keep' };

    try {
      setError('');
      await updateContactPreferences(authToken, selectedContact.uniqueId, {
        muted: !!selectedContact.preferences?.muted,
        notifications: selectedContact.preferences?.notifications !== false,
        notificationSound: selectedContact.preferences?.notificationSound || 'soft',
        defaultDisappearPolicy: nextDefault
      });
      await loadContacts();
    } catch (e) {
      setError(e.message || 'Failed to update default disappearing policy');
    }
  };

  const handleMessageInputChange = (value) => {
    setMessage(value);
    if (!socket || !selectedContactId) return;

    const hasText = value.trim().length > 0;
    if (hasText && !typingActiveRef.current) {
      socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: true });
      typingActiveRef.current = true;
    }

    if (!hasText && typingActiveRef.current) {
      socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
      typingActiveRef.current = false;
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      if (typingActiveRef.current) {
        socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
        typingActiveRef.current = false;
      }
    }, 1600);
  };

  const handleNotificationSoundChange = async (sound) => {
    if (!selectedContact) return;
    try {
      setError('');
      await updateContactPreferences(authToken, selectedContact.uniqueId, {
        muted: !!selectedContact.preferences?.muted,
        notifications: selectedContact.preferences?.notifications !== false,
        notificationSound: sound,
        defaultDisappearPolicy: selectedContact.preferences?.defaultDisappearPolicy || { mode: 'keep' }
      });
      await loadContacts();
      playNotificationTone(sound);
    } catch (e) {
      setError(e.message || 'Failed to update notification sound');
    }
  };

  const handleMarkConversationUnread = () => {
    if (!socket || !selectedContactId) return;
    socket.emit('friends:mark_unread', { withUniqueId: selectedContactId });
  };

  const contactTyping = selectedContactId ? !!typingByContact[selectedContactId] : false;

  return (
    <div className="friends-shell">
      <aside className="friends-side">
        <div className="friends-profile-card">
          <strong>{profile.displayName || 'Friend'}</strong>
          <div className="friends-id-badge">ID: {profile.uniqueId}</div>
          <div className="friends-row"><input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Display name" /></div>
          <div className="friends-row"><textarea value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} placeholder="Bio" rows={3} /></div>
          <div className="friends-row">
            <button type="button" onClick={handleSaveProfile}>Save Profile</button>
            <button type="button" className="secondary" onClick={onLogout}>Log out</button>
          </div>
        </div>

        <div>
          <div className="friends-row">
            <input placeholder="Search by name / ID / email" value={query} onChange={(e) => handleSearch(e.target.value)} />
          </div>
          {searchResults.map((item) => (
            <div key={item.uniqueId} className="friends-row">
              <button type="button" className="secondary" onClick={() => handleAddContact(item.uniqueId)}>
                Add {item.displayName || item.uniqueId}
              </button>
            </div>
          ))}
        </div>

        <div className="friends-contacts">
          {contacts.map((contact) => (
            <button
              key={contact.uniqueId}
              className={`friends-contact ${selectedContactId === contact.uniqueId ? 'active' : ''}`}
              type="button"
              onClick={() => setSelectedContactId(contact.uniqueId)}
            >
              <div className="friends-contact-top">
                <span className="friends-contact-name">
                  {contact.displayName || contact.uniqueId}
                  <span className={`friends-presence-dot ${contact.online ? 'online' : 'offline'}`} title={contact.online ? 'Online' : 'Offline'} />
                </span>
                {contact.unreadCount > 0 ? <span className="friends-unread-badge">{contact.unreadCount}</span> : null}
              </div>
              <small>
                {contact.uniqueId}
                {contact.online ? ' • online' : (contact.lastSeen ? ` • last seen ${new Date(contact.lastSeen).toLocaleTimeString()}` : '')}
              </small>
              <div className="friends-contact-preview">
                {contact.lastMessage?.text ? contact.lastMessage.text : 'No messages yet'}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="friends-main">
        <header className="friends-chat-header">
          {selectedContact ? `Chat with ${selectedContact.displayName || selectedContact.uniqueId}` : 'Choose a friend to start chatting'}
          {contactTyping ? <div className="friends-typing-indicator">Typing...</div> : null}
          <div className="friends-header-actions">
            <button type="button" className="secondary" onClick={onBackHome}>Home</button>
            <button type="button" className="secondary" onClick={onOpenSettings}>Settings</button>
          </div>
          {selectedContact ? (
            <div className="friends-header-actions">
              <button type="button" className="secondary" onClick={handleToggleMute}>
                {selectedContact.preferences?.muted ? 'Unmute' : 'Mute'}
              </button>
              <button type="button" className="secondary" onClick={handleToggleNotifications}>
                {selectedContact.preferences?.notifications === false ? 'Enable Notifications' : 'Disable Notifications'}
              </button>
              <button type="button" className="secondary" onClick={handleMarkConversationUnread}>
                Mark unread
              </button>
              <select
                className="friends-default-disappear"
                value={selectedContact.preferences?.notificationSound || 'soft'}
                onChange={(e) => handleNotificationSoundChange(e.target.value)}
                title="Notification sound"
              >
                <option value="soft">Sound: Soft</option>
                <option value="chime">Sound: Chime</option>
                <option value="pop">Sound: Pop</option>
                <option value="none">Sound: None</option>
              </select>
              <select
                className="friends-default-disappear"
                value={(() => {
                  const p = selectedContact.preferences?.defaultDisappearPolicy;
                  if (!p || p.mode === 'keep') return '__keep__';
                  if (p.mode === 'immediate') return '__immediate__';
                  if (p.mode === 'preset' && p.value === '1h') return '__1h__';
                  if (p.mode === 'preset' && p.value === '24h') return '__24h__';
                  if (p.mode === 'preset' && p.value === '3d') return '__3d__';
                  if (p.mode === 'preset' && p.value === '7d') return '__7d__';
                  return '__keep__';
                })()}
                onChange={(e) => handleDefaultDisappearPolicyChange(e.target.value)}
                title="Default disappearing policy for this contact"
              >
                <option value="__keep__">Default keep</option>
                <option value="__immediate__">Default immediate</option>
                <option value="__1h__">Default 1 hour</option>
                <option value="__24h__">Default 24 hours</option>
                <option value="__3d__">Default 3 days</option>
                <option value="__7d__">Default 7 days</option>
              </select>
            </div>
          ) : null}
        </header>

        <div className="friends-messages">
          {activeMessages.map((msg) => (
            <article key={msg.id} className={`friends-msg ${msg.isMine ? 'me' : ''}`}>
              <div>{msg.text}</div>
              <div className="friends-msg-meta">
                <span>{new Date(msg.createdAt).toLocaleString()} • {getFriendlyRemaining(msg.expiresAt)}</span>
                {msg.isMine ? (() => {
                  const receipt = getReceiptConfig(msg);
                  if (!receipt) return null;
                  return (
                    <span className={`friends-receipt ${receipt.className}`} title={receipt.title} aria-label={receipt.title}>
                      <span key={`${msg.id}-${receipt.className}`} className="friends-receipt-text">{receipt.text}</span>
                    </span>
                  );
                })() : null}
              </div>
            </article>
          ))}
        </div>

        <div className="friends-input-wrap">
          <div className="friends-row">
            <select value={disappearMode} onChange={(e) => setDisappearMode(e.target.value)}>
              <option value="__default__">Use contact default</option>
              <option value="keep">Keep chat</option>
              <option value="immediate">Disappear immediately</option>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="3d">3 days</option>
              <option value="7d">7 days (max)</option>
              <option value="custom">Custom date/time (max 7 days)</option>
            </select>
            {disappearMode === 'custom' ? (
              <input type="datetime-local" value={customExpire} onChange={(e) => setCustomExpire(e.target.value)} />
            ) : null}
          </div>

          <div className="friends-row">
            <input
              placeholder={selectedContact ? 'Type a message...' : 'Add/select a friend to start'}
              value={message}
              onChange={(e) => handleMessageInputChange(e.target.value)}
              disabled={!selectedContact}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button type="button" onClick={handleSendMessage} disabled={!selectedContact || !message.trim()}>
              Send
            </button>
          </div>
          {error ? <p className="friends-error">{error}</p> : null}
        </div>
      </section>
    </div>
  );
};

function FriendsFeature() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [phoneState, setPhoneState] = useState('idle');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [socket, setSocket] = useState(null);
  const [postLoginView, setPostLoginView] = useState('home');

  const recaptchaRef = useRef(null);

  const refreshProfile = async (token) => {
    const idToken = token || authToken;
    if (!idToken) return;
    const data = await fetchFriendsProfile(idToken);
    setProfile(data.profile);
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !friendsAuth) return undefined;

    const unsub = onAuthStateChanged(friendsAuth, async (nextUser) => {
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setAuthToken('');
        setProfile(null);
        setPostLoginView('home');
        return;
      }
      try {
        const token = await nextUser.getIdToken(true);
        setAuthToken(token);
      } catch (e) {
        setError(e.message || 'Failed to get auth token');
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authToken) return;
    refreshProfile(authToken).catch((e) => setError(mapFriendsBackendError(e) || 'Profile sync failed'));
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const nextSocket = io(`${getFriendsBackendUrl()}/friends`, {
      transports: ['websocket', 'polling'],
      auth: { token: authToken }
    });

    nextSocket.on('connect_error', (err) => {
      setError(err?.message || 'Friends socket connection failed');
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [authToken]);

  const handleGoogleLogin = async () => {
    if (!friendsAuth) {
      setError('Firebase auth is not initialized. Restart frontend and check Firebase config.');
      return;
    }
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(friendsAuth, provider);
    } catch (e) {
      setError(mapFirebaseAuthError(e));
    }
  };

  const handlePhoneStart = async (phone) => {
    if (!friendsAuth) {
      setError('Firebase auth is not initialized. Restart frontend and check Firebase config.');
      return;
    }
    setError('');
    try {
      setPhoneState('sending');
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(friendsAuth, 'friends-recaptcha-container', {
          size: 'normal'
        });
      }

      const confirmation = await signInWithPhoneNumber(friendsAuth, phone, recaptchaRef.current);
      setConfirmationResult(confirmation);
      setPhoneState('code-sent');
    } catch (e) {
      setPhoneState('idle');
      setError(mapFirebaseAuthError(e));
    }
  };

  const handlePhoneConfirm = async (code) => {
    setError('');
    if (!confirmationResult) {
      setError('Send OTP first.');
      return;
    }
    try {
      await confirmationResult.confirm(code);
      setPhoneState('verified');
    } catch (e) {
      setError(mapFirebaseAuthError(e));
    }
  };

  const handleLogout = async () => {
    setError('');
    try {
      if (friendsAuth) await signOut(friendsAuth);
      setProfile(null);
      setFirebaseUser(null);
      setAuthToken('');
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } catch (e) {
      setError(e.message || 'Logout failed');
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="friends-login">
        <h3 className="friends-title">Friends Login</h3>
        <p className="friends-error">Missing Firebase client configuration in frontend env.</p>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return (
      <LoginPanel
        onGoogleLogin={handleGoogleLogin}
        onPhoneStart={handlePhoneStart}
        onPhoneConfirm={handlePhoneConfirm}
        phoneState={phoneState}
        error={error}
      />
    );
  }

  if (postLoginView === 'home') {
    return (
      <FriendsHomePage
        profile={profile}
        onOpenChats={() => setPostLoginView('chat')}
        onOpenSettings={() => setPostLoginView('settings')}
        onLogout={handleLogout}
      />
    );
  }

  if (postLoginView === 'settings') {
    return (
      <FriendsSettingsPage
        profile={profile}
        authToken={authToken}
        onProfileRefresh={async () => refreshProfile()}
        onBackHome={() => setPostLoginView('home')}
        onOpenChats={() => setPostLoginView('chat')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <FriendsWorkspace
      authToken={authToken}
      profile={profile}
      onProfileRefresh={async () => refreshProfile()}
      onLogout={handleLogout}
      socket={socket}
      onOpenSettings={() => setPostLoginView('settings')}
      onBackHome={() => setPostLoginView('home')}
    />
  );
}

export default FriendsFeature;
