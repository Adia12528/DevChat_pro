import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  getRedirectResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithRedirect,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import './friends.css';
import { friendsAuth, isFirebaseConfigured } from './firebaseClient';
import {
  addContact,
  fetchContacts,
  fetchFriendRequests,
  fetchConversationMessages,
  fetchFriendsProfile,
  getFriendsBackendUrl,
  saveUserSettings,
  searchUsers,
  sendMessage,
  updateFriendsProfile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  updateContactPreferences,
  deleteConversationMessages,
  editMessage,
  reactToMessage,
  deleteMessage
} from './friendsApi';


// Utility functions
const getFriendlyRemaining = (expiresAt) => {
  if (!expiresAt) return 'kept';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'expires now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.round(mins / 66);
  if (hours < 24) return `${hours}h left`;
  const days = Math.round(hours / 24);
  return `${days}d left`;
};

const makeTempMessageId = () => `temp_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

const formatDayLabel = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const formatChatTime = (input) => {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const isEmailOrPhone = (value) => {
  const cleaned = value.trim();
  if (!cleaned) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9]{8,15}$/;
  return emailRegex.test(cleaned) || phoneRegex.test(cleaned);
};

const getReceiptConfig = (msg) => {
  if (!msg?.isMine) return null;
  if (msg.deliveryStatus === 'queued') {
    return { text: 'Q', className: 'queued', title: 'Queued (offline)' };
  }
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

const getListReceipt = (msg) => {
  if (!msg) return null;
  if (msg.deliveryStatus === 'queued') return 'Q';
  if (msg.deliveryStatus === 'pending') return '...';
  if (msg.deliveryStatus === 'read') return '✓✓';
  if (msg.deliveryStatus === 'delivered') return '✓✓';
  return '✓';
};

const mergeMessagesById = (existing = [], incoming = []) => {
  const byId = new Map();
  [...existing, ...incoming].forEach((item) => {
    if (!item?.id) return;
    byId.set(item.id, item);
  });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const sendWithRetry = async ({ token, payload, attempts = 2 }) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await sendMessage(token, payload);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(220 * attempt);
      }
    }
  }
  throw lastError || new Error('Unable to send message');
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

// --- LoginPanel Component ---
const LoginPanel = ({ onGoogleLogin, onPhoneStart, onPhoneConfirm, phoneState, error, onSwitchToClassic }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  return (
    <div className="friends-login" aria-label="Friends auth login">
      <div className="friends-mode-toggle" role="tablist" aria-label="Choose login mode">
        <button
          type="button"
          role="tab"
          className="friends-mode-btn"
          onClick={onSwitchToClassic}
          disabled={!onSwitchToClassic}
        >
          Username + Room
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="friends-mode-btn active"
          disabled
        >
          Friends Login
        </button>
      </div>

      <h3 className="friends-title">Friends Login</h3>
      <p className="friends-subtitle">Use Firebase auth. Your chats sync through backend + socket namespace.</p>

      <div className="friends-row">
        <button type="button" onClick={onGoogleLogin}>Continue with Google</button>
      </div>
      <p className="friends-note">If popups are blocked, sign-in will continue with a secure redirect.</p>

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

// --- FriendsWorkspace Component ---
const FriendsWorkspace = ({ authToken, profile, onLogout, socket, onProfileRefresh }) => {
  // Dev Room modal state
  const [isDevRoomModalOpen, setIsDevRoomModalOpen] = useState(false);
  const [devRoomId, setDevRoomId] = useState(() => window.localStorage.getItem('devRoom_lastRoomId') || '');
  const [devRoomError, setDevRoomError] = useState('');
  const [devRoomLoading, setDevRoomLoading] = useState(false);
    // --- State declarations (contacts must be first if referenced below) ---
    const [contacts, setContacts] = useState([]);
    // Friends modal open state
    const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
    // Per-contact mute/disappear state
    const [contactMuteMap, setContactMuteMap] = useState({}); // { [contactId]: { muteDuration } }
    const [contactDisappearMap, setContactDisappearMap] = useState({}); // { [contactId]: { disappearTimer } }

    // Friends modal and search hooks (must be at top level)
    const [friendsSearch, setFriendsSearch] = useState("");
    const filteredFriends = useMemo(() => {
      const search = friendsSearch.trim().toLowerCase();
      if (!search) return contacts;
      return contacts.filter(
        c => (c.displayName || c.uniqueId || "").toLowerCase().includes(search) ||
             (c.email || "").toLowerCase().includes(search) ||
             (c.phoneNumber || "").toLowerCase().includes(search)
      );
    }, [friendsSearch, contacts]);
  // Notify user of incoming message (sound + desktop notification)
  const notifyIncomingMessage = (contact, message) => {
    // Play notification sound
    playNotificationTone('chime');

    // Show desktop notification if enabled and supported
    if (window.Notification && Notification.permission === 'granted') {
      const title = contact?.displayName || contact?.username || 'New message';
      const body = message?.text || '[New message]';
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: contact?.uniqueId || undefined
      });
    } else if (window.Notification && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  // Remove a queued message by tempId
  const removeQueuedMessage = (tempId) => {
    if (!tempId) return;
    const queue = offlineQueueRef.current.filter((item) => item.tempId !== tempId);
    offlineQueueRef.current = queue;
    persistQueue(queue);
    setOfflineQueueCount(queue.length);
  };

  // Add or update a queued message by tempId
  const upsertQueuedMessage = (queuedItem) => {
    if (!queuedItem?.tempId) return;
    let queue = offlineQueueRef.current.filter((item) => item.tempId !== queuedItem.tempId);
    queue.push(queuedItem);
    offlineQueueRef.current = queue;
    persistQueue(queue);
    setOfflineQueueCount(queue.length);
  };

  const updateOptimisticDeliveryStatus = (contactId, tempId, status) => {
    setMessagesByContact((prev) => {
      const current = prev[contactId] || [];
      return {
        ...prev,
        [contactId]: current.map((msg) =>
          msg.id === tempId ? { ...msg, deliveryStatus: status } : msg
        )
      };
    });
  };

  // Load messages for a contact
  const loadMessages = async (contactId, { reset } = {}) => {
    if (!contactId) return;

    try {
      if (reset) {
        setMessagesByContact((prev) => ({ ...prev, [contactId]: [] }));
      }
      
      const data = await fetchConversationMessages(authToken, contactId, { limit: 50 });
      const incoming = data.messages || [];
      
      setMessagesByContact((prev) => ({
        ...prev,
        [contactId]: mergeMessagesById(prev[contactId] || [], incoming)
      }));

      if (incoming.length > 0) {
        setOldestCursorByContact((prev) => ({ ...prev, [contactId]: incoming[0].createdAt }));
      }
      setHasMoreByContact((prev) => ({ ...prev, [contactId]: incoming.length >= 50 }));
    } catch (e) {
      setError(e.message || 'Failed to load messages');
    }
  };

  const loadContacts = async () => {
    try {
      const data = await fetchContacts(authToken);
      setContacts(data.contacts || []);
    } catch (e) {
      // Optionally handle error, e.g., set an error state
    }
  };

  // Friend requests state
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [requestsError, setRequestsError] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messagesByContact, setMessagesByContact] = useState({});
  const [chatSearchInput, setChatSearchInput] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [addFriendQuery, setAddFriendQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingAddFriend, setIsSearchingAddFriend] = useState(false);
  const [hasSearchedAddFriend, setHasSearchedAddFriend] = useState(false);
  const [addFriendSearchError, setAddFriendSearchError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [typingByContact, setTypingByContact] = useState({});
  const [isMobileLayout, setIsMobileLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [mobilePane, setMobilePane] = useState('list');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [settingsNameDraft, setSettingsNameDraft] = useState(profile.displayName || '');
  const [settingsBioDraft, setSettingsBioDraft] = useState(profile.bio || '');
  const [settingsThemeDraft, setSettingsThemeDraft] = useState('light');
  const [settingsNotificationsDraft, setSettingsNotificationsDraft] = useState(true);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isEmojiTrayOpen, setIsEmojiTrayOpen] = useState(false);
  const [isInputMenuOpen, setIsInputMenuOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isMute, setIsMute] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteDuration, setMuteDuration] = useState(null); // in minutes, or 'always', or null for off
  const [isDisappearing, setIsDisappearing] = useState(false);
  const [showDisappearModal, setShowDisappearModal] = useState(false);
  const [disappearTimer, setDisappearTimer] = useState(null); // in minutes
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [loadingOlderByContact, setLoadingOlderByContact] = useState({});
  const [hasMoreByContact, setHasMoreByContact] = useState({});
  const [oldestCursorByContact, setOldestCursorByContact] = useState({});
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [addBy, setAddBy] = useState('email');


  const typingStopTimerRef = useRef(null);
  const lastNotifyAtRef = useRef({});
  const typingActiveRef = useRef(false);
  const pendingSendTimersRef = useRef({});
  const offlineQueueRef = useRef([]);
  const queueFlushInProgressRef = useRef(false);
  const menuRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const firstUnreadDividerRef = useRef(null);
  const shouldAutoScrollUnreadRef = useRef(false);
  const swipeStartRef = useRef(null);
  // Header menu ref for click-away
  const headerMenuRef = useRef(null);
  // Auto-close header menu on outside click
  useEffect(() => {
    if (!isHeaderMenuOpen) return;
    function handleClick(e) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setIsHeaderMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isHeaderMenuOpen]);


  const quickEmojis = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️','😡','😮','😅','😇','🤔','🙌','🥳','😏','😭','😬'];

  const queueStorageKey = useMemo(
    () => `friends_pending_queue_${profile.uniqueId || 'anonymous'}`,
    [profile.uniqueId]
  );

  // Fix: selectedContact must be defined after contacts and selectedContactId useState
  const selectedContact = useMemo(
    () => contacts.find((c) => c.uniqueId === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  // Fix: Define activeMessages for timelineItems and chat rendering
  const activeMessages = useMemo(() => {
    if (!selectedContactId) return [];
    return messagesByContact[selectedContactId] || [];
  }, [selectedContactId, messagesByContact]);

  // Fix: filteredContacts must be defined as a hook, not inside JSX
  const filteredContacts = useMemo(() => {
    const search = chatSearch.trim().toLowerCase();
    if (!search) return contacts;
    return contacts.filter(
      (c) =>
        (c.displayName && c.displayName.toLowerCase().includes(search)) ||
        (c.uniqueId && c.uniqueId.toLowerCase().includes(search))
    );
  }, [contacts, chatSearch]);

  const persistQueue = (queue) => {
    try {
      window.localStorage.setItem(queueStorageKey, JSON.stringify(queue));
    } catch {
      // Ignore storage quota/private mode issues; queue remains in memory.
    }
  };

  const loadQueueFromStorage = () => {
    try {
      const raw = window.localStorage.getItem(queueStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item?.tempId && item?.toUniqueId && item?.text);
    } catch {
      return [];
    }
  };

  const emitMarkRead = (contactUniqueId) => {
    if (!socket || !contactUniqueId) return;
    socket.emit('friends:mark_read', { withUniqueId: contactUniqueId });
  };

  const sendQueuedItem = async (queuedItem) => {
    const response = await sendWithRetry({
      token: authToken,
      payload: {
        receiverId: queuedItem.toUniqueId,
        message: queuedItem.text,
        disappearPolicy: queuedItem.disappearPolicy,
        clientTempId: queuedItem.tempId
      },
      attempts: 2
    });

    if (response?.message?.id) {
      const confirmed = {
        ...response.message,
        isMine: true,
        deliveryStatus: response.message.deliveryStatus || 'sent'
      };
      setMessagesByContact((prev) => {
        const current = prev[queuedItem.toUniqueId] || [];
        const withoutTemp = current.filter((m) => m.id !== queuedItem.tempId);
        return {
          ...prev,
          [queuedItem.toUniqueId]: mergeMessagesById(withoutTemp, [confirmed])
        };
      });
    } else {
      updateOptimisticDeliveryStatus(queuedItem.toUniqueId, queuedItem.tempId, 'sent');
    }

    removeQueuedMessage(queuedItem.tempId);
  };

  const flushQueuedMessages = async () => {
    if (queueFlushInProgressRef.current) return;
    if (!navigator.onLine) return;
    if (!authToken) return;

    const queue = [...offlineQueueRef.current];
    if (queue.length === 0) return;

    queueFlushInProgressRef.current = true;
    try {
      for (const item of queue) {
        try {
          updateOptimisticDeliveryStatus(item.toUniqueId, item.tempId, 'pending');
          await sendQueuedItem(item);
        } catch {
          updateOptimisticDeliveryStatus(item.toUniqueId, item.tempId, 'queued');
        }
      }
      await loadContacts();
    } finally {
      queueFlushInProgressRef.current = false;
    }
  };

  // Load friend requests
  const loadRequests = async () => {
    try {
      setRequestsError('');
      const data = await fetchFriendRequests(authToken);
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
    } catch (e) {
      setRequestsError(e.message || 'Failed to load requests');
    }
  };

  // Accept/reject request handlers
  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(authToken, requestId);
      await loadRequests();
      await loadContacts();
    } catch (e) {
      setRequestsError(e.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await rejectFriendRequest(authToken, requestId);
      await loadRequests();
    } catch (e) {
      setRequestsError(e.message || 'Failed to reject request');
    }
  };

  const handleRemoveFriend = async (targetUniqueId) => {
    try {
      await removeFriend(authToken, targetUniqueId);
      await loadContacts();
      setSelectedContactId('');
    } catch (e) {
      setError(e.message || 'Failed to remove friend');
    }
  };

  // Handler for searching by unique ID
  const handleSearchById = async () => {
    setHasSearchedAddFriend(true);
    setAddFriendSearchError('');
    setSearchResults([]);
    setIsSearchingAddFriend(true);

    const value = addFriendQuery.trim();
    if (!value) {
      setAddFriendSearchError('Enter a unique ID.');
      setIsSearchingAddFriend(false);
      return;
    }

    try {
      // Use searchUsers if it supports uniqueId, else filter manually
      const data = await searchUsers(authToken, value);
      let users = data.users || [];
      // If not found, try to match uniqueId directly
      if (!users.length) {
        users = data.users?.filter(u => u.uniqueId === value) || [];
      }
      // If still not found, try a direct API call if available (pseudo-code)
      // Optionally, you can add a new API endpoint for lookup by uniqueId
      setSearchResults(users);
      if (users.length === 0) {
        setAddFriendSearchError('User not found with this unique ID');
      }
    } catch (e) {
      setAddFriendSearchError(e.message || 'Search failed');
    } finally {
      setIsSearchingAddFriend(false);
    }
  };



  const [isClearChatConfirmOpen, setIsClearChatConfirmOpen] = useState(false);
  const handleClearChat = () => {
    setIsClearChatConfirmOpen(true);
    setIsHeaderMenuOpen(false);
  };

  const handleConfirmClearChat = async () => {
    if (!selectedContactId) return;
    try {
      await deleteConversationMessages(authToken, selectedContactId);
      setMessagesByContact((prev) => ({ ...prev, [selectedContactId]: [] }));
    } catch (e) {
      setError(e.message || 'Failed to clear chat.');
    }
    setIsClearChatConfirmOpen(false);
  };

  const handleCancelClearChat = () => {
    setIsClearChatConfirmOpen(false);
  };

  const handleToggleMute = () => {
    setShowMuteModal(true);
    setIsHeaderMenuOpen(false);
  };

  const handleCloseMuteModal = () => setShowMuteModal(false);

  const handleSetMuteDuration = (duration) => {
    setMuteDuration(duration);
    setIsMute(duration !== null && duration !== 'off');
    setShowMuteModal(false);
    // TODO: Save mute duration to backend/contact preferences if needed
  };


  const handleToggleDisappearing = () => {
    setShowDisappearModal(true);
    setIsHeaderMenuOpen(false);
  };

  const handleCloseDisappearModal = () => setShowDisappearModal(false);

  const handleSetDisappearTimer = (minutes) => {
    setDisappearTimer(minutes);
    setIsDisappearing(minutes !== null);
    setShowDisappearModal(false);
    // TODO: Save timer to backend/contact preferences if needed
  };

  const handleShowMedia = () => {
    setShowMediaModal(true);
    setIsHeaderMenuOpen(false);
  };

  const handleCloseMediaModal = () => setShowMediaModal(false);

  // Extract media, links, docs from messages
  const mediaMessages = useMemo(() => {
    if (!selectedContactId || !messagesByContact[selectedContactId]) return [];
    return messagesByContact[selectedContactId].filter(
      (msg) => msg.mediaUrl || msg.imageUrl || msg.fileType?.startsWith('image/')
    );
  }, [selectedContactId, messagesByContact]);

  const linkMessages = useMemo(() => {
    if (!selectedContactId || !messagesByContact[selectedContactId]) return [];
    return messagesByContact[selectedContactId].filter(
      (msg) => /https?:\/\//i.test(msg.text || '')
    );
  }, [selectedContactId, messagesByContact]);

  const docMessages = useMemo(() => {
    if (!selectedContactId || !messagesByContact[selectedContactId]) return [];
    return messagesByContact[selectedContactId].filter(
      (msg) => msg.fileType && !msg.fileType.startsWith('image/')
    );
  }, [selectedContactId, messagesByContact]);

  const timelineItems = useMemo(() => {
    const items = [];
    let lastDayKey = '';
    let unreadInserted = false;

    for (const msg of activeMessages) {
      const createdAtDate = new Date(msg.createdAt);
      const dayKey = Number.isNaN(createdAtDate.getTime())
        ? ''
        : `${createdAtDate.getFullYear()}-${createdAtDate.getMonth()}-${createdAtDate.getDate()}`;

      if (dayKey && dayKey !== lastDayKey) {
        items.push({
          type: 'date',
          id: `date-${dayKey}`,
          label: formatDayLabel(msg.createdAt)
        });
        lastDayKey = dayKey;
      }

      if (!unreadInserted && !msg.isMine && !msg.readAt) {
        items.push({
          type: 'unread',
          id: `unread-${msg.id}`,
          label: 'Unread messages'
        });
        unreadInserted = true;
      }

      items.push({ type: 'message', id: msg.id, message: msg });
    }

    return items;
  }, [activeMessages]);

  useEffect(() => {
    loadContacts();
    loadRequests();
  }, []);

  useEffect(() => {
    const loaded = loadQueueFromStorage();
    offlineQueueRef.current = loaded;
    setOfflineQueueCount(loaded.length);
  }, [queueStorageKey]);

  useEffect(() => {
    const onOnline = () => {
      flushQueuedMessages().catch(() => {});
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [authToken, queueStorageKey]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      flushQueuedMessages().catch(() => {});
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, authToken]);

  useEffect(() => {
    if (!authToken) return;
    flushQueuedMessages().catch(() => {});
  }, [authToken, selectedContactId]);

  useEffect(() => {
    setSettingsNameDraft(profile.displayName || '');
    setSettingsBioDraft(profile.bio || '');
    setSettingsThemeDraft(profile.settings?.theme || 'light');
    setSettingsNotificationsDraft(profile.settings?.notifications !== false);
  }, [profile.displayName, profile.bio, profile.settings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChatSearch(chatSearchInput);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [chatSearchInput]);

  useEffect(() => {
    if (!selectedContactId) return;
    shouldAutoScrollUnreadRef.current = true;
    loadMessages(selectedContactId, { reset: true });
    socket?.emit('friends:join_conversation', { withUniqueId: selectedContactId });
    emitMarkRead(selectedContactId);
  }, [selectedContactId, socket]);

  // Real-time socket events for requests
  useEffect(() => {
    if (!socket) return;
    const onNewRequest = () => loadRequests();
    const onRequestAccepted = () => {
      loadRequests();
      loadContacts();
    };
    const onRequestRejected = () => loadRequests();
    socket.on('friends:new_request', onNewRequest);
    socket.on('friends:request_accepted', onRequestAccepted);
    socket.on('friends:request_rejected', onRequestRejected);
    return () => {
      socket.off('friends:new_request', onNewRequest);
      socket.off('friends:request_accepted', onRequestAccepted);
      socket.off('friends:request_rejected', onRequestRejected);
    };
  }, [socket]);

  // Real-time: listen for friend list updates
  useEffect(() => {
    if (!socket) return;
    const onFriendListUpdate = () => {
      loadContacts();
    };
    socket.on('friends:refresh', onFriendListUpdate);
    return () => socket.off('friends:refresh', onFriendListUpdate);
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const onHistory = ({ withUniqueId, messages }) => {
      const incoming = messages || [];
      setMessagesByContact((prev) => ({
        ...prev,
        [withUniqueId]: mergeMessagesById(prev[withUniqueId] || [], incoming)
      }));
      if (incoming[0]?.createdAt) {
        setOldestCursorByContact((prev) => ({ ...prev, [withUniqueId]: incoming[0].createdAt }));
      }
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

      if (clientTempId) {
        removeQueuedMessage(clientTempId);
      }

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

    const onStopTyping = ({ fromUniqueId }) => {
      if (!fromUniqueId) return;
      setTypingByContact((prev) => ({ ...prev, [fromUniqueId]: false }));
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

    const onUserOnline = ({ uniqueId, lastSeen }) => onPresence({ uniqueId, online: true, lastSeen });
    const onUserOffline = ({ uniqueId, lastSeen }) => onPresence({ uniqueId, online: false, lastSeen });

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
    socket.on('friends:stop_typing', onStopTyping);
    socket.on('friends:presence', onPresence);
    socket.on('friends:unread_update', onUnreadUpdate);
    socket.on('friends:error', onSocketError);

    socket.on('new_message', onNewMessage);
    socket.on('read_receipt', onReadUpdate);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);

    return () => {
      socket.off('friends:history', onHistory);
      socket.off('friends:new_message', onNewMessage);
      socket.off('friends:read_update', onReadUpdate);
      socket.off('friends:typing', onTyping);
      socket.off('friends:stop_typing', onStopTyping);
      socket.off('friends:presence', onPresence);
      socket.off('friends:unread_update', onUnreadUpdate);
      socket.off('friends:error', onSocketError);

      socket.off('new_message', onNewMessage);
      socket.off('read_receipt', onReadUpdate);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
    };
  }, [socket, selectedContactId, contacts, authToken]);

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

  useEffect(() => {
    const handleResize = () => {
      setIsMobileLayout(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setMobilePane('list');
    }
  }, [isMobileLayout]);

  useEffect(() => {
    const handleDocClick = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsMenuOpen(false);
      setIsAddModalOpen(false);
      setIsProfileModalOpen(false);
      setIsSettingsModalOpen(false);
      setIsEmojiTrayOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (!selectedContactId || !shouldAutoScrollUnreadRef.current) return;

    const rafId = window.requestAnimationFrame(() => {
      if (firstUnreadDividerRef.current) {
        firstUnreadDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      shouldAutoScrollUnreadRef.current = false;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [selectedContactId, timelineItems]);

  const handleSearch = async () => {
    setHasSearchedAddFriend(true);
    setAddFriendSearchError('');
    setSearchResults([]);
    setIsSearchingAddFriend(true);

    const value = addFriendQuery.trim();
    if (!value) {
      setAddFriendSearchError('Enter an email or phone number.');
      setIsSearchingAddFriend(false);
      return;
    }

    if (!isEmailOrPhone(value)) {
      setAddFriendSearchError('Enter a valid email or phone number.');
      setIsSearchingAddFriend(false);
      return;
    }

    try {
      const data = await searchUsers(authToken, value);
      const users = data.users || [];
      setSearchResults(users);
      if (users.length === 0) {
        setAddFriendSearchError('User not found on this platform');
      }
    } catch (e) {
      setAddFriendSearchError(e.message || 'Search failed');
    } finally {
      setIsSearchingAddFriend(false);
    }
  };

  // Send friend request instead of adding contact immediately
  const handleSendFriendRequest = async (targetUniqueId) => {
    try {
      setError('');
      await sendFriendRequest(authToken, targetUniqueId);
      setAddFriendQuery('');
      setSearchResults([]);
      setHasSearchedAddFriend(false);
      setAddFriendSearchError('');
      setSettingsSavedMessage('Friend request sent. The user must accept to become friends.');
    } catch (e) {
      setError(e.message || 'Unable to send friend request');
    }
  };

  // Theme switching logic
  useEffect(() => {
    const root = document.documentElement;
    if (settingsThemeDraft === 'dark') {
      root.classList.add('friends-dark-theme');
      root.classList.remove('friends-light-theme');
    } else {
      root.classList.add('friends-light-theme');
      root.classList.remove('friends-dark-theme');
    }
  }, [settingsThemeDraft]);

  const handleSaveSettings = async () => {
    try {
      setSettingsError('');
      setSettingsSavedMessage('');
      await saveUserSettings(authToken, {
        theme: settingsThemeDraft,
        notifications: settingsNotificationsDraft
      });
      await updateFriendsProfile(authToken, {
        displayName: settingsNameDraft,
        bio: settingsBioDraft
      });
      await onProfileRefresh();
      // Apply theme immediately on save
      const root = document.documentElement;
      if (settingsThemeDraft === 'dark') {
        root.classList.add('friends-dark-theme');
        root.classList.remove('friends-light-theme');
      } else {
        root.classList.add('friends-light-theme');
        root.classList.remove('friends-dark-theme');
      }
      setSettingsSavedMessage('Settings saved successfully.');
    } catch (e) {
      setSettingsError(e.message || 'Unable to save settings.');
    }
  };

  const handleSendMessage = async () => {
    if (!socket || !selectedContactId || !message.trim()) return;

    const policy = selectedContact?.preferences?.defaultDisappearPolicy || { mode: 'keep' };
    const messageText = message;
    const targetUniqueId = selectedContactId;
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
      const current = prev[targetUniqueId] || [];
      return {
        ...prev,
        [targetUniqueId]: [...current, optimisticMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      };
    });

    setMessage('');
    setIsEmojiTrayOpen(false);
    socket.emit('friends:typing', { toUniqueId: targetUniqueId, isTyping: false });
    socket.emit('stop_typing', { toUniqueId: targetUniqueId });
    typingActiveRef.current = false;

    const queuedItem = {
      tempId,
      toUniqueId: targetUniqueId,
      text: messageText,
      disappearPolicy: policy,
      createdAt: new Date().toISOString()
    };

    if (!navigator.onLine) {
      upsertQueuedMessage(queuedItem);
      updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'queued');
      setError('You are offline. Message queued and will resend automatically.');
      return;
    }

    pendingSendTimersRef.current[tempId] = window.setTimeout(() => {
      delete pendingSendTimersRef.current[tempId];
      upsertQueuedMessage(queuedItem);
      updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'queued');
      setError('Message send timed out. Queued for automatic retry.');
    }, 12000);

    try {
      const response = await sendWithRetry({
        token: authToken,
        payload: {
          receiverId: targetUniqueId,
          message: messageText,
          disappearPolicy: policy,
          clientTempId: tempId
        },
        attempts: 2
      });

      if (pendingSendTimersRef.current[tempId]) {
        window.clearTimeout(pendingSendTimersRef.current[tempId]);
        delete pendingSendTimersRef.current[tempId];
      }

      if (response?.message?.id) {
        const confirmed = {
          ...response.message,
          isMine: true,
          deliveryStatus: response.message.deliveryStatus || 'sent'
        };
        setMessagesByContact((prev) => {
          const current = prev[targetUniqueId] || [];
          const withoutTemp = current.filter((m) => m.id !== tempId);
          return {
            ...prev,
            [targetUniqueId]: mergeMessagesById(withoutTemp, [confirmed])
          };
        });
      } else {
        updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'sent');
      }
      removeQueuedMessage(tempId);
    } catch (apiError) {
      if (pendingSendTimersRef.current[tempId]) {
        window.clearTimeout(pendingSendTimersRef.current[tempId]);
        delete pendingSendTimersRef.current[tempId];
      }
      upsertQueuedMessage(queuedItem);
      updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'queued');
      setError(apiError?.message || 'Message send failed. Queued for automatic retry.');
    }
  };

  const handleMessageInputChange = (value) => {
    setMessage(value);
    if (!socket || !selectedContactId) return;

    const hasText = value.trim().length > 0;
    if (hasText && !typingActiveRef.current) {
      socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: true });
      socket.emit('typing', { toUniqueId: selectedContactId });
      typingActiveRef.current = true;
    }

    if (!hasText && typingActiveRef.current) {
      socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
      socket.emit('stop_typing', { toUniqueId: selectedContactId });
      typingActiveRef.current = false;
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      if (typingActiveRef.current) {
        socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
        socket.emit('stop_typing', { toUniqueId: selectedContactId });
        typingActiveRef.current = false;
      }
    }, 1600);
  };

  const handleMessagesScroll = async (event) => {
    if (!selectedContactId) return;
    const container = event.currentTarget;
    if (container.scrollTop > 60) return;

    if (loadingOlderByContact[selectedContactId]) return;
    if (!hasMoreByContact[selectedContactId]) return;

    const before = oldestCursorByContact[selectedContactId];
    if (!before) return;

    const previousHeight = container.scrollHeight;
    setLoadingOlderByContact((prev) => ({ ...prev, [selectedContactId]: true }));

    try {
      const data = await fetchConversationMessages(authToken, selectedContactId, {
        before,
        limit: 40
      });
      const incoming = data.messages || [];

      setMessagesByContact((prev) => ({
        ...prev,
        [selectedContactId]: mergeMessagesById(incoming, prev[selectedContactId] || [])
      }));

      if (incoming[0]?.createdAt) {
        setOldestCursorByContact((prev) => ({ ...prev, [selectedContactId]: incoming[0].createdAt }));
      }
      setHasMoreByContact((prev) => ({ ...prev, [selectedContactId]: incoming.length >= 40 }));

      window.requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight - previousHeight + container.scrollTop;
      });
    } catch (e) {
      setError(e.message || 'Failed to load older messages.');
    } finally {
      setLoadingOlderByContact((prev) => ({ ...prev, [selectedContactId]: false }));
    }
  };

  const handleSelectContact = (contactUniqueId) => {
    setSelectedContactId(contactUniqueId);
    setIsEmojiTrayOpen(false);
    if (isMobileLayout) {
      setMobilePane('chat');
    }
  };

  const handleOpenAddModal = () => {
    setAddFriendQuery('');
    setSearchResults([]);
    setHasSearchedAddFriend(false);
    setAddFriendSearchError('');
    setIsAddModalOpen(true);
  };

  const contactTyping = selectedContactId ? !!typingByContact[selectedContactId] : false;

  const handleChatTouchStart = (event) => {
    if (!isMobileLayout || mobilePane !== 'chat') return;
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now()
    };
  };

  const handleChatTouchEnd = (event) => {
    if (!isMobileLayout || mobilePane !== 'chat') return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.at;
    const startedFromEdge = start.x <= 48;

    if (startedFromEdge && dx > 70 && Math.abs(dy) < 64 && elapsed < 700) {
      setMobilePane('list');
    }
  };

  return (
    <div className={`friends-shell ${isMobileLayout ? `mobile-${mobilePane}` : ''}`}> 
      {/* Disappearing Message Timer Modal - always rendered at root level */}
      {showDisappearModal && (
        <div className="friends-modal-overlay" style={{zIndex:2000}} onClick={handleCloseDisappearModal}>
          <div
            className="friends-modal friends-disappear-modal"
            style={{
              minWidth: 0,
              width: '92%',
              maxWidth: 340,
              margin: '8vh auto',
              padding: '18px 16px',
              borderRadius: 14,
              boxShadow: '0 2px 16px 0 rgba(0,0,0,0.13)',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{fontSize: '1.1rem', marginBottom: 10, textAlign: 'center'}}>Set Disappearing Messages</h2>
            <div style={{display:'flex',flexDirection:'column',width:'100%',gap:8}}>
              <button onClick={() => handleSetDisappearTimer(1)} className={disappearTimer===1 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>1 min</button>
              <button onClick={() => handleSetDisappearTimer(5)} className={disappearTimer===5 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>5 min</button>
              <button onClick={() => handleSetDisappearTimer(10)} className={disappearTimer===10 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>10 min</button>
              <button onClick={() => handleSetDisappearTimer(30)} className={disappearTimer===30 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>30 min</button>
              <button onClick={() => handleSetDisappearTimer(60)} className={disappearTimer===60 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>1 hour</button>
              <button onClick={() => handleSetDisappearTimer(null)} className={!disappearTimer ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>Off</button>
            </div>
            <button className="friends-modal-close" style={{marginTop:12}} onClick={handleCloseDisappearModal}>Close</button>
          </div>
        </div>
      )}
      {/* Mute Notification Duration Modal - always rendered at root level */}
      {showMuteModal && (
        <div className="friends-modal-overlay" style={{zIndex:2000}} onClick={handleCloseMuteModal}>
          <div
            className="friends-modal friends-mute-modal"
            style={{
              minWidth: 0,
              width: '92%',
              maxWidth: 340,
              margin: '8vh auto',
              padding: '18px 16px',
              borderRadius: 14,
              boxShadow: '0 2px 16px 0 rgba(0,0,0,0.13)',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{fontSize: '1.1rem', marginBottom: 10, textAlign: 'center'}}>Mute Notifications</h2>
            <div style={{display:'flex',flexDirection:'column',width:'100%',gap:8}}>
              <button onClick={() => handleSetMuteDuration(15)} className={muteDuration===15 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>15 min</button>
              <button onClick={() => handleSetMuteDuration(60)} className={muteDuration===60 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>1 hour</button>
              <button onClick={() => handleSetMuteDuration(240)} className={muteDuration===240 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>4 hours</button>
              <button onClick={() => handleSetMuteDuration(1440)} className={muteDuration===1440 ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>1 day</button>
              <button onClick={() => handleSetMuteDuration('always')} className={muteDuration==='always' ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>Always</button>
              <button onClick={() => handleSetMuteDuration(null)} className={!muteDuration ? 'active' : ''} style={{padding:'8px',borderRadius:8,fontSize:15,width:'100%'}}>Off</button>
            </div>
            <button className="friends-modal-close" style={{marginTop:12}} onClick={handleCloseMuteModal}>Close</button>
          </div>
        </div>
      )}
      <aside className="friends-side">

        <header className="friends-side-header">
          <div className="friends-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="friends-menu-button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label="Open dashboard menu"
            >
              ☰
            </button>
            {isMenuOpen ? (
              <div className="friends-menu-dropdown" role="menu" aria-label="Dashboard menu">
                <div className="friends-menu-profile-section">
                  <div className="friends-menu-profile-avatar-enhanced">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt="Profile" />
                    ) : (
                      <span>{(profile.displayName || profile.uniqueId || 'U').slice(0,2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="friends-menu-profile-info-enhanced">
                    <div className="friends-menu-profile-name-row">
                      <span className="friends-menu-profile-name">{profile.displayName || 'User'}</span>
                      {profile.isPremium && <span className="friends-menu-profile-premium" title="Premium User">★</span>}
                    </div>
                    <div className="friends-menu-profile-id">{profile.uniqueId || profile.email || ''}</div>
                    {profile.bio && <div className="friends-menu-profile-bio">{profile.bio}</div>}
                  </div>
                </div>
                <hr className="friends-menu-profile-divider" />
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsRequestsModalOpen(true);
                  }}
                >
                  Requests
                  {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
                    <span className="friends-request-badge-menu">{incomingRequests.length + outgoingRequests.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsFriendsModalOpen(true);
                  }}
                >
                  Friends
                </button>
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                >
                  Profile
                </button>
                {/* Friends Modal rendered outside the menu dropdown */}
                {isFriendsModalOpen && (
                  <div className="friends-modal-backdrop" onClick={() => setIsFriendsModalOpen(false)}>
                    <div className="friends-modal friends-friends-modal" onClick={e => e.stopPropagation()}>
                      <h2>All Friends</h2>

                      <input
                        className="friends-list-search"
                        type="text"
                        placeholder="Search friends..."
                        value={friendsSearch}
                        onChange={e => setFriendsSearch(e.target.value)}
                        style={{
                          marginBottom: 12,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #ccd6dd',
                          width: '100%',
                          background: settingsThemeDraft === 'dark' ? '#23272f' : '#fff',
                          color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
                        }}
                        autoFocus
                      />
                      <div className="friends-list-modal">
                        {filteredFriends.length === 0 ? (
                          <div className="friends-empty">No friends found.</div>
                        ) : (
                          filteredFriends.map((contact) => (
                            <div key={contact.uniqueId} className="friends-list-card">
                              <div className="friends-list-avatar">
                                {contact.photoURL ? (
                                  <img src={contact.photoURL} alt={contact.displayName || contact.uniqueId} />
                                ) : (
                                  <span>{(contact.displayName || contact.uniqueId)[0]?.toUpperCase()}</span>
                                )}
                                <span className={`friends-list-status ${contact.online ? 'online' : 'offline'}`}></span>
                              </div>
                              <div className="friends-list-meta">
                                <strong>{contact.displayName || contact.uniqueId}</strong>
                                <small>{contact.email || contact.phoneNumber || contact.uniqueId}</small>
                              </div>
                              <button
                                className="friends-remove-btn"
                                onClick={() => {
                                  if(window.confirm(`Remove ${contact.displayName || contact.uniqueId}?`)) handleRemoveFriend(contact.uniqueId);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="friends-add-modal-actions">
                        <button type="button" onClick={() => setIsFriendsModalOpen(false)}>Close</button>
                      </div>
                    </div>
                  </div>
                )}
                      
                {/* Dev Room menu item removed. Dev Room button will be outside menu. */}
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                >
                  Settings
                </button>

                {/* Dev Room Modal will be rendered at the root, not here */}
                      {/* Persistent Dev Room button (always visible, outside menu) */}
                      <button
                        type="button"
                        className="friends-devroom-btn"
                        style={{
                          position: 'fixed',
                          bottom: 24,
                          left: 24,
                          zIndex: 2100,
                          padding: window.innerWidth <= 600 ? '10px 16px' : '12px 22px',
                          borderRadius: 12,
                          background: '#1976d2',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: window.innerWidth <= 600 ? 15 : 17,
                          boxShadow: '0 2px 12px 0 rgba(0,0,0,0.13)',
                          border: 'none',
                          cursor: 'pointer',
                          width: window.innerWidth <= 480 ? '90vw' : undefined,
                          left: window.innerWidth <= 480 ? '5vw' : 24,
                          right: undefined,
                          bottom: window.innerWidth <= 480 ? 16 : 24
                        }}
                        onClick={() => setIsDevRoomModalOpen(true)}
                      >
                        Dev Room
                      </button>

                      {/* Dev Room Modal rendered at root level */}
                      {isDevRoomModalOpen && (
                        <div className="friends-modal-backdrop" onClick={() => setIsDevRoomModalOpen(false)}>
                          <div
                            className="friends-modal friends-devroom-modal"
                            style={{ minWidth: 0, width: '92%', maxWidth: 340, margin: '12vh auto', padding: '18px 16px', borderRadius: 14, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.13)', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <h2 style={{ fontSize: '1.1rem', marginBottom: 10, textAlign: 'center' }}>Dev Room Login</h2>
                            <div style={{ width: '100%', marginBottom: 10 }}>
                              <label style={{ fontWeight: 500, fontSize: 14 }}>Username</label>
                              <input
                                type="text"
                                value={profile.displayName || profile.uniqueId || profile.email || ''}
                                readOnly
                                style={{
                                  width: '100%',
                                  marginBottom: 8,
                                  padding: '8px',
                                  borderRadius: 8,
                                  border: '1px solid #ccd6dd',
                                  background: settingsThemeDraft === 'dark' ? '#23272f' : '#f5f5f5',
                                  color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
                                }}
                              />
                            </div>
                            <div style={{ width: '100%', marginBottom: 10 }}>
                              <label style={{ fontWeight: 500, fontSize: 14 }}>Room ID</label>
                              <input
                                type="text"
                                value={devRoomId}
                                onChange={e => setDevRoomId(e.target.value)}
                                placeholder="Enter Room ID"
                                style={{
                                  width: '100%',
                                  marginBottom: 4,
                                  padding: '8px',
                                  borderRadius: 8,
                                  border: '1px solid #ccd6dd',
                                  background: settingsThemeDraft === 'dark' ? '#23272f' : '#fff',
                                  color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
                                }}
                                autoFocus
                              />
                            </div>
                            <div style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                              <input
                                id="devroom-remember"
                                type="checkbox"
                                checked={!!window.localStorage.getItem('devRoom_rememberRoomId')}
                                onChange={e => {
                                  if (e.target.checked) {
                                    window.localStorage.setItem('devRoom_rememberRoomId', '1');
                                    window.localStorage.setItem('devRoom_lastRoomId', devRoomId);
                                  } else {
                                    window.localStorage.removeItem('devRoom_rememberRoomId');
                                    window.localStorage.removeItem('devRoom_lastRoomId');
                                  }
                                }}
                                style={{
                                  marginRight: 6,
                                  background: settingsThemeDraft === 'dark' ? '#23272f' : '#fff',
                                  color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
                                }}
                              />
                              <label htmlFor="devroom-remember" style={{ fontSize: 13, cursor: 'pointer' }}>Remember last Room ID</label>
                            </div>
                            <button
                              style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1976d2', color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 6 }}
                              disabled={devRoomLoading || !devRoomId}
                              onClick={async () => {
                                setDevRoomError('');
                                setDevRoomLoading(true);
                                try {
                                  const username = profile.displayName || profile.uniqueId || profile.email || '';
                                  if (window.localStorage.getItem('devRoom_rememberRoomId')) {
                                    window.localStorage.setItem('devRoom_lastRoomId', devRoomId);
                                  }
                                  // 1. Logout from friends (Firebase)
                                  if (window.friendsAuth && typeof window.friendsAuth.signOut === 'function') {
                                    await window.friendsAuth.signOut();
                                  } else if (typeof signOut === 'function' && friendsAuth) {
                                    await signOut(friendsAuth);
                                  }
                                  // 2. Set credentials for Dev Room
                                  window.localStorage.setItem('devRoom_autoLogin', JSON.stringify({ username, roomId: devRoomId }));
                                  // 3. Redirect to login page for Dev Room
                                  window.location.href = '/login';
                                } catch (err) {
                                  setDevRoomError('Login failed. Please try again.');
                                } finally {
                                  setDevRoomLoading(false);
                                }
                              }}
                            >
                              {devRoomLoading ? 'Logging in...' : 'Enter Dev Room'}
                            </button>
                            {devRoomError && <div style={{ color: '#e53935', fontSize: 14, marginTop: 2 }}>{devRoomError}</div>}
                            <button className="friends-modal-close" style={{ marginTop: 8 }} onClick={() => setIsDevRoomModalOpen(false)}>Close</button>
                          </div>
                        </div>
                      )}
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
                {/* Requests Modal */}
                {isRequestsModalOpen && (
                  <div className="friends-modal-overlay" onClick={() => setIsRequestsModalOpen(false)}>
                    <div className="friends-modal friends-requests-modal" onClick={e => e.stopPropagation()}>
                      <h2>Friend Requests</h2>
                      {requestsError ? <div className="friends-error">{requestsError}</div> : null}
                      {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                        <div className="friends-empty-list">No friend requests</div>
                      ) : null}
                      {incomingRequests.length > 0 && (
                        <div className="friends-incoming-requests">
                          <strong>Incoming</strong>
                          {incomingRequests.map((req) => (
                            <div key={req._id} className="friends-request-card">
                              <span>From: {req.fromUid}</span>
                              <button onClick={() => handleAcceptRequest(req._id)}>Accept</button>
                              <button onClick={() => handleRejectRequest(req._id)}>Reject</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {outgoingRequests.length > 0 && (
                        <div className="friends-outgoing-requests">
                          <strong>Outgoing</strong>
                          {outgoingRequests.map((req) => (
                            <div key={req._id} className="friends-request-card">
                              <span>To: {req.toUid}</span>
                              <span>Status: {req.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="friends-modal-close" onClick={() => setIsRequestsModalOpen(false)}>Close</button>
                    </div>
                  </div>
                )}
          </div>

          <div className="friends-self-meta">
            <strong>Chats</strong>
            <span className="friends-id-badge">{profile.displayName || profile.uniqueId}</span>
          </div>
        </header>

        <div className="friends-sidebar-search-wrap">
          <input
            className="friends-sidebar-search"
            type="search"
            placeholder="Search chats"
            value={chatSearchInput}
            onChange={(e) => setChatSearchInput(e.target.value)}
            aria-label="Search chats"
            style={{
              background: settingsThemeDraft === 'dark' ? '#23272f' : '#fff',
              color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
            }}
          />
        </div>

        <div className="friends-contacts" aria-label="Friends conversations">
          {filteredContacts.length === 0 ? (
            <div className="friends-empty-list">
              {contacts.length === 0 ? 'No chats yet. Tap + to add people.' : 'No chats match your search.'}
            </div>
          ) : null}

          {filteredContacts.map((contact) => {
            const listReceipt = getListReceipt(contact.lastMessage);
            const listReceiptClass = contact.lastMessage?.deliveryStatus === 'queued' ? 'queued' : '';
            const mute = contactMuteMap[contact.uniqueId]?.muteDuration;
            const disappear = contactDisappearMap[contact.uniqueId]?.disappearTimer;
            return (
              <div
                key={contact.uniqueId}
                className={`friends-contact ${selectedContactId === contact.uniqueId ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectContact(contact.uniqueId)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleSelectContact(contact.uniqueId); }}
                style={{ cursor: 'pointer' }}
              >
                <div className="friends-contact-avatar" aria-hidden="true">
                  {(contact.displayName || contact.uniqueId || 'FR').slice(0, 2).toUpperCase()}
                </div>

                <div className="friends-contact-content">
                  <div className="friends-contact-top">
                    <span className="friends-contact-name">{contact.displayName || contact.uniqueId}</span>
                    <span className="friends-contact-time">{formatChatTime(contact.lastMessage?.createdAt || contact.updatedAt)}</span>
                    <span className="friends-contact-icons">
                      {mute && mute !== null && mute !== 'off' && (
                        <span className="friends-contact-mute-icon" title="Muted">
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M3 8v4h4l5 5V3L7 8H3z" fill="#888"/><line x1="2" y1="2" x2="18" y2="18" stroke="#e53935" strokeWidth="2"/></svg>
                        </span>
                      )}
                      {disappear && disappear !== null && (
                        <span className="friends-contact-disappear-icon" title="Disappearing Messages Enabled">
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#8e24aa" strokeWidth="2"/><path d="M10 5v5l3 3" stroke="#8e24aa" strokeWidth="2" strokeLinecap="round"/></svg>
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="friends-contact-bottom">
                    <span className="friends-contact-preview">
                      {contact.lastMessage?.text ? (
                        <>
                          {(contact.lastMessage?.isMine || contact.lastMessage?.fromUniqueId === profile.uniqueId) ? (
                            <>
                              <span className={`friends-list-receipt ${listReceiptClass}`.trim()} aria-hidden="true">{listReceipt}</span>
                              <span className="friends-list-prefix">You:</span>{' '}
                            </>
                          ) : null}
                          {contact.lastMessage.text}
                        </>
                      ) : 'Tap to start chatting'}
                    </span>

                    <span className="friends-contact-signals">
                      {/* Badge for requests */}
                      {incomingRequests.some((req) => req.fromUid === contact.uid) ? (
                        <span className="friends-request-badge">!</span>
                      ) : null}
                      <span className={`friends-presence-dot ${contact.online ? 'online' : 'offline'}`} title={contact.online ? 'Online' : 'Offline'} />
                      {contact.unreadCount > 0 ? <span className="friends-unread-badge">{contact.unreadCount}</span> : null}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section
        className="friends-main"
        onTouchStart={handleChatTouchStart}
        onTouchEnd={handleChatTouchEnd}
      >
        <header className="friends-chat-header">
          {/* Media/Links/Docs Modal */}
          {showMediaModal && (
            <div className="friends-modal-overlay" onClick={handleCloseMediaModal}>
              <div className="friends-modal friends-media-modal" onClick={e => e.stopPropagation()}>
                <h2>Media, Links & Docs</h2>
                <div className="friends-media-sections">
                  <div className="friends-media-section">
                    <h4>Media</h4>
                    {mediaMessages.length === 0 ? <div className="friends-empty-list">No media shared</div> : (
                      <div className="friends-media-list">
                        {mediaMessages.map((msg) => (
                          <div key={msg.id || msg._id} className="friends-media-item">
                            {msg.mediaUrl || msg.imageUrl ? (
                              <img src={msg.mediaUrl || msg.imageUrl} alt="media" style={{maxWidth:'100px',maxHeight:'100px',borderRadius:'8px'}} />
                            ) : null}
                            {msg.fileName && <div className="friends-media-filename">{msg.fileName}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="friends-media-section">
                    <h4>Links</h4>
                    {linkMessages.length === 0 ? <div className="friends-empty-list">No links shared</div> : (
                      <ul className="friends-link-list">
                        {linkMessages.map((msg) => (
                          <li key={msg.id || msg._id} className="friends-link-item">
                            <a href={msg.text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)?.[0] || '#'} target="_blank" rel="noopener noreferrer">
                              {msg.text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)?.[0] || msg.text}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="friends-media-section">
                    <h4>Docs</h4>
                    {docMessages.length === 0 ? <div className="friends-empty-list">No documents shared</div> : (
                      <ul className="friends-doc-list">
                        {docMessages.map((msg) => (
                          <li key={msg.id || msg._id} className="friends-doc-item">
                            <a href={msg.mediaUrl || msg.fileUrl} target="_blank" rel="noopener noreferrer">
                              {msg.fileName || 'Document'}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <button className="friends-modal-close" onClick={handleCloseMediaModal}>Close</button>
              </div>
            </div>
          )}
          {/* Clear Chat Confirmation Modal */}
          {isClearChatConfirmOpen && (
            <div className="friends-modal-overlay" onClick={handleCancelClearChat}>
              <div className="friends-modal friends-clear-chat-modal" onClick={e => e.stopPropagation()}>
                <h3>Clear Chat</h3>
                <p>Are you sure you want to delete all messages in this chat? This cannot be undone.</p>
                <div className="friends-modal-actions">
                  <button className="friends-modal-btn danger" onClick={handleConfirmClearChat}>Clear</button>
                  <button className="friends-modal-btn" onClick={handleCancelClearChat}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="friends-chat-header-main">
            {isMobileLayout && mobilePane === 'chat' ? (
              <button
                type="button"
                className="secondary friends-mobile-back"
                onClick={() => setMobilePane('list')}
              >
                Back
              </button>
            ) : null}

            {selectedContact ? (
              <>
                <div className="friends-contact-avatar" aria-hidden="true">
                  {(selectedContact.displayName || selectedContact.uniqueId || 'FR').slice(0, 2).toUpperCase()}
                </div>
                <div className="friends-chat-header-copy">
                  <strong>{selectedContact.displayName || selectedContact.uniqueId}</strong>
                  {incomingRequests.some((req) => req.fromUid === selectedContact.uid) ? (
                    <span className="friends-request-badge">!</span>
                  ) : null}
                  <small>
                    {contactTyping
                      ? 'User is typing...'
                      : selectedContact.online
                        ? 'online'
                        : (selectedContact.lastSeen ? `last seen ${formatChatTime(selectedContact.lastSeen)}` : selectedContact.uniqueId)}
                  </small>
                </div>
                {/* Header menu (three dots) */}
                <div style={{ marginLeft: 'auto', position: 'relative' }} ref={headerMenuRef}>
                  <button
                    type="button"
                    className="friends-header-menu-btn"
                    aria-label="Chat options"
                    aria-haspopup="true"
                    aria-expanded={isHeaderMenuOpen}
                    tabIndex={0}
                    onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                    style={{ borderRadius: 8, border: 'none', background: 'transparent', padding: 6, cursor: 'pointer', outline: isHeaderMenuOpen ? '2px solid #1976d2' : 'none' }}
                  >
                    &#8942;
                  </button>
                  {isHeaderMenuOpen && (
                    <div
                      className="friends-header-menu-dropdown improved"
                      role="menu"
                      aria-label="Chat options menu"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 36,
                        minWidth: 210,
                        background: '#fff',
                        borderRadius: 12,
                        boxShadow: '0 4px 24px 0 rgba(0,0,0,0.13)',
                        zIndex: 100,
                        padding: 0,
                        border: '1px solid #e0e0e0',
                        overflow: 'hidden',
                        animation: 'fadeIn .18s cubic-bezier(.4,0,.2,1)'
                      }}
                    >
                      <button type="button" role="menuitem" title="Clear all messages in this chat" style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10px 18px',background:'none',border:'none',cursor:'pointer',fontSize:15}} onClick={() => { setIsHeaderMenuOpen(false); handleClearChat(); }} onMouseOver={e=>e.currentTarget.style.background='#f5f5f5'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                        <span aria-hidden="true" style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,minWidth:32}}>
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="4" width="14" height="14" rx="4" fill="#ffebee" stroke="#e53935" strokeWidth="1.2"/><path d="M8 8l6 6M14 8l-6 6" stroke="#e53935" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </span>
                        <span style={{marginTop:6,display:'block',width:'100%',textAlign:'center',whiteSpace:'normal',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'20px',fontWeight:500}}>Clear Chat</span>
                      </button>
                      <div style={{height:1,background:'#ececec',margin:'0 10px'}} />
                      <button type="button" role="menuitem" title="View all media, links, and documents" style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10px 18px',background:'none',border:'none',cursor:'pointer',fontSize:15}} onClick={() => { setIsHeaderMenuOpen(false); handleShowMedia(); }} onMouseOver={e=>e.currentTarget.style.background='#f5f5f5'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                        <span aria-hidden="true" style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,minWidth:32}}>
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="5" width="16" height="12" rx="3" fill="#e3f2fd" stroke="#1976d2" strokeWidth="1.2"/><circle cx="8" cy="11" r="2" fill="#90caf9"/><rect x="11" y="12" width="5" height="3" rx="1.5" fill="#1976d2" opacity=".3"/></svg>
                        </span>
                        <span style={{marginTop:6,display:'block',width:'100%',textAlign:'center',whiteSpace:'normal',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'20px',fontWeight:500}}>Media, Links, Docs</span>
                      </button>
                      <div style={{height:1,background:'#ececec',margin:'0 10px'}} />
                      <button type="button" role="menuitem" title="Set disappearing messages timer" style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10px 18px',background:'none',border:'none',cursor:'pointer',fontSize:15}} onClick={() => { handleToggleDisappearing(); }} onMouseOver={e=>e.currentTarget.style.background='#f5f5f5'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                        <span aria-hidden="true" style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,minWidth:32}}>
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="#f3e5f5" stroke="#8e24aa" strokeWidth="1.2"/><path d="M7 11a4 4 0 018 0c0 2.21-1.79 4-4 4s-4-1.79-4-4z" fill="#8e24aa" opacity=".2"/><path d="M11 7v4l2 2" stroke="#8e24aa" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </span>
                        <span style={{marginTop:6,display:'block',width:'100%',textAlign:'center',whiteSpace:'normal',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'20px',fontWeight:500}}>{disappearTimer ? `Disappearing: ${disappearTimer} min` : 'Set Disappearing Messages'}</span>
                      </button>
                      <div style={{height:1,background:'#ececec',margin:'0 10px'}} />
                      <button type="button" role="menuitem" title="Mute notifications for this chat" style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10px 18px',background:'none',border:'none',cursor:'pointer',fontSize:15}} onClick={() => { handleToggleMute(); }} onMouseOver={e=>e.currentTarget.style.background='#f5f5f5'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                        <span aria-hidden="true" style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,minWidth:32}}>
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="7" width="6" height="8" rx="2" fill="#e8f5e9" stroke="#43a047" strokeWidth="1.2"/><rect x="10" y="9" width="6" height="4" rx="2" fill="#43a047" opacity=".3"/><path d="M16 7l2 2m0 0l-2 2m2-2H14" stroke="#e53935" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        </span>
                        <span style={{marginTop:6,display:'block',width:'100%',textAlign:'center',whiteSpace:'normal',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'20px',fontWeight:500}}>{muteDuration === 'always' ? 'Muted: Always' : muteDuration ? `Muted: ${muteDuration} min` : 'Mute Notifications'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="friends-chat-header-copy">
                <strong>Select a chat</strong>
                <small>Choose a friend from the left sidebar.</small>
              </div>
            )}
          </div>
        </header>

        <div className="friends-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
          {!selectedContact ? (
            <div className="friends-chat-empty">Select a friend from chats to start messaging.</div>
          ) : null}

          {/* --- Context menu state for all messages --- */}
          {(() => {
            const [contextMenu, setContextMenu] = React.useState({ open: false, x: 0, y: 0, msgId: null });
            const [editingMsgId, setEditingMsgId] = React.useState(null);
            const [editText, setEditText] = React.useState('');
            const [emojiPickerMsgId, setEmojiPickerMsgId] = React.useState(null);

            // Handlers for context menu
            const handleContextMenu = (e, msg) => {
              e.preventDefault();
              setContextMenu({ open: true, x: e.clientX, y: e.clientY, msgId: msg.id });
              setEditText(msg.text);
            };
            let touchTimer = null;
            const handleTouchStart = (e, msg) => {
              touchTimer = setTimeout(() => {
                setContextMenu({ open: true, x: e.touches[0].clientX, y: e.touches[0].clientY, msgId: msg.id });
                setEditText(msg.text);
              }, 500);
            };
            const handleTouchEnd = () => {
              if (touchTimer) clearTimeout(touchTimer);
            };

            // Edit, delete, react logic
            const handleEdit = async (msg) => {
              try {
                await editMessage(authToken, msg.id, editText);
                setEditingMsgId(null);
                setContextMenu({ ...contextMenu, open: false });
                setEmojiPickerMsgId(null);
                await loadMessages(selectedContactId, { reset: true });
              } catch (e) {
                setError(e.message || 'Edit failed');
                setContextMenu({ ...contextMenu, open: false });
                setEmojiPickerMsgId(null);
              }
            };
            const handleDelete = async (msg) => {
              if (!window.confirm('Delete this message?')) return;
              try {
                await deleteMessage(authToken, msg.id);
                setContextMenu({ ...contextMenu, open: false });
                setEmojiPickerMsgId(null);
                await loadMessages(selectedContactId, { reset: true });
              } catch (e) {
                setError(e.message || 'Delete failed');
                setContextMenu({ ...contextMenu, open: false });
                setEmojiPickerMsgId(null);
              }
            };
            const handleReact = async (msg, emoji) => {
              try {
                await reactToMessage(authToken, msg.id, emoji);
                setEmojiPickerMsgId(null);
                setContextMenu({ ...contextMenu, open: false });
                await loadMessages(selectedContactId, { reset: true });
              } catch (e) {
                setError(e.message || 'React failed');
                setEmojiPickerMsgId(null);
                setContextMenu({ ...contextMenu, open: false });
              }
            };

            // Render reactions (if any)
            const renderReactions = (msg) => {
              if (!msg.reactions || !Array.isArray(msg.reactions) || msg.reactions.length === 0) return null;
              return (
                <div className="friends-msg-reactions">
                  {msg.reactions.map((r, i) => (
                    <span key={i} className="friends-msg-reaction">{r.emoji} {r.count > 1 ? r.count : ''}</span>
                  ))}
                </div>
              );
            };

            return timelineItems.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.id} className="friends-date-divider" aria-label={`Date: ${item.label}`}>
                    <span>{item.label}</span>
                  </div>
                );
              }
              if (item.type === 'unread') {
                return (
                  <div
                    key={item.id}
                    className="friends-unread-divider"
                    aria-label="Unread messages"
                    ref={firstUnreadDividerRef}
                  >
                    <span>{item.label}</span>
                  </div>
                );
              }
              const msg = item.message;
              const isEditing = editingMsgId === msg.id;
              return (
                <article
                  key={item.id}
                  className={`friends-msg ${msg.isMine ? 'me' : ''}`}
                  onContextMenu={e => handleContextMenu(e, msg)}
                  onTouchStart={e => handleTouchStart(e, msg)}
                  onTouchEnd={handleTouchEnd}
                  style={{ position: 'relative' }}
                >
                  {isEditing ? (
                    <div className="friends-msg-edit-row">
                      <input
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEdit(msg); if (e.key === 'Escape') setEditingMsgId(null); }}
                        autoFocus
                      />
                      <button onClick={() => handleEdit(msg)}>Save</button>
                      <button onClick={() => setEditingMsgId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div>{msg.text}</div>
                  )}
                  {renderReactions(msg)}
                  <div className="friends-msg-meta">
                    <span>{formatChatTime(msg.createdAt)} • {getFriendlyRemaining(msg.expiresAt)}</span>
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
                  {/* Context menu */}
                  {contextMenu.open && contextMenu.msgId === msg.id && (
                    <MsgContextMenu
                      contextMenu={{ ...contextMenu, msg }}
                      onEdit={() => { setEditingMsgId(msg.id); setContextMenu({ ...contextMenu, open: false }); }}
                      onDelete={() => handleDelete(msg)}
                      onReact={() => setEmojiPickerMsgId(msg.id)}
                      isMine={msg.isMine}
                      onClose={() => setContextMenu({ ...contextMenu, open: false })}
                    />
                  )}

                  {/* Emoji picker */}
                  {emojiPickerMsgId === msg.id && (
                    <EmojiPickerFixed
                      contextMenu={contextMenu}
                      onClose={() => setEmojiPickerMsgId(null)}
                      onReact={emoji => handleReact(msg, emoji)}
                    />
                  )}
                </article>
              );
            });
          })()}
        </div>

        {selectedContact && (
          <div className="friends-input-wrap">
            {isEmojiTrayOpen && (
              <div className="friends-emoji-tray" aria-label="Emoji picker">
                {quickEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="friends-emoji-chip"
                    onClick={() => handleMessageInputChange(`${message}${emoji}`)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <div className="friends-input-row">
              <button
                type="button"
                className="friends-emoji-btn"
                aria-label="Toggle emoji picker"
                title="Emoji picker"
                onClick={() => setIsEmojiTrayOpen((prev) => !prev)}
                disabled={!selectedContact}
                tabIndex={selectedContact ? 0 : -1}
              >
                <span role="img" aria-label="Emoji">😊</span>
              </button>
              <input
                placeholder={selectedContact ? 'Type a message' : 'Add or select a friend to start'}
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
            {offlineQueueCount > 0 ? (
              <p className="friends-note" aria-live="polite">
                {offlineQueueCount} message{offlineQueueCount === 1 ? '' : 's'} queued for resend.
              </p>
            ) : null}
          </div>
        )}

        {/* Media/Links/Docs Modal */}
        {showMediaModal && (
          <div className="friends-modal-backdrop" role="presentation" onClick={handleCloseMediaModal}>
            <div className="friends-profile-modal" role="dialog" aria-label="Media, Links, Docs" onClick={e => e.stopPropagation()}>
              <h4>Media, Links, Docs</h4>
              <p>Show shared media, links, and documents here. (To implement: filter messages for attachments/links.)</p>
              <div className="friends-add-modal-actions">
                <button type="button" className="secondary" onClick={handleCloseMediaModal}>Close</button>
              </div>
            </div>
          </div>
        )}
      </section>



      {/* Show + button only in mobile-list area or when no chat is open on desktop */}
      {((isMobileLayout && mobilePane === 'list') || (!isMobileLayout && !selectedContact)) && (
        <button
          type="button"
          className="friends-fab"
          onClick={handleOpenAddModal}
          aria-label="Add people"
        >
          +
        </button>
      )}

      {isAddModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="friends-add-modal"
            role="dialog"
            aria-label="Add people"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Add people</h4>
            <div className="friends-add-tabs">
              <button
                type="button"
                className={addBy === 'email' ? 'active' : ''}
                onClick={() => {
                  setAddBy('email');
                  setAddFriendQuery('');
                  setSearchResults([]);
                  setHasSearchedAddFriend(false);
                  setAddFriendSearchError('');
                }}
              >By Email/Phone</button>
              <button
                type="button"
                className={addBy === 'id' ? 'active' : ''}
                onClick={() => {
                  setAddBy('id');
                  setAddFriendQuery('');
                  setSearchResults([]);
                  setHasSearchedAddFriend(false);
                  setAddFriendSearchError('');
                }}
              >By Unique ID</button>
            </div>
            {addBy === 'email' ? (
              <>
                <p>Add users by email or phone number. Only existing users can be added.</p>
                <input
                  placeholder="example@email.com or +911234567890"
                  value={addFriendQuery}
                  onChange={(e) => setAddFriendQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  autoFocus
                />
                <div className="friends-add-modal-actions left">
                  <button type="button" onClick={handleSearch}>Search</button>
                </div>
              </>
            ) : (
              <>
                <p>Add users by their unique ID. Only existing users can be added.</p>
                <input
                  placeholder="Enter unique ID (case sensitive)"
                  value={addFriendQuery}
                  onChange={(e) => setAddFriendQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchById();
                    }
                  }}
                  autoFocus
                />
                <div className="friends-add-modal-actions left">
                  <button type="button" onClick={handleSearchById}>Search</button>
                </div>
              </>
            )}
            <div className="friends-results-label">Results</div>
            {isSearchingAddFriend ? <div className="friends-empty">Searching...</div> : null}
            {addFriendSearchError ? <div className="friends-empty">{addFriendSearchError}</div> : null}
            <div className="friends-add-results">
              {hasSearchedAddFriend && !addFriendSearchError && searchResults.length === 0 ? (
                <div className="friends-empty">User not found on this platform</div>
              ) : null}
              {searchResults.map((item) => (
                <div key={item.uniqueId} className="friends-search-result-card">
                  <div className="friends-search-result-meta">
                    <strong>{item.displayName || item.uniqueId}</strong>
                    <small>{item.email || item.phoneNumber || item.uniqueId}</small>
                  </div>
                  <button
                    type="button"
                    className="friends-search-result"
                    onClick={() => {
                      handleSendFriendRequest(item.uniqueId);
                      setIsAddModalOpen(false);
                    }}
                  >
                    Send Friend Request
                  </button>
                </div>
              ))}
            </div>
            {/* Suggestions for users who have already joined but are not yet friends */}
            <div className="friends-suggestions-label">Suggestions</div>
            <FriendsSuggestions
              authToken={authToken}
              contacts={contacts}
              socket={socket}
              onSendFriendRequest={handleSendFriendRequest}
              onClose={() => setIsAddModalOpen(false)}
            />
            <div className="friends-add-modal-actions">
              <button
                type="button"
                disabled={!searchResults?.[0]?.uniqueId}
                onClick={() => {
                  const first = searchResults?.[0];
                  if (!first?.uniqueId) return;
                  handleSendFriendRequest(first.uniqueId);
                  setIsAddModalOpen(false);
                }}
              >
                Send Request to First Match
              </button>
              <button type="button" className="secondary" onClick={() => setIsAddModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isProfileModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsProfileModalOpen(false)}>
          <div className="friends-profile-modal" role="dialog" aria-label="Profile" onClick={(e) => e.stopPropagation()}>
            <h4>Profile</h4>
            <p><strong>Name:</strong> {profile.displayName || 'Not set'}</p>
            <p><strong>Unique ID:</strong> {profile.uniqueId}</p>
            <p><strong>Email:</strong> {profile.email || 'Not set'}</p>
            <p><strong>Phone:</strong> {profile.phoneNumber || 'Not set'}</p>
            <p><strong>Avatar:</strong> {profile.photoURL ? 'Available' : 'Not set'}</p>
            <p><strong>Bio:</strong> {profile.bio || 'No bio yet.'}</p>
            <div className="friends-add-modal-actions">
              <button type="button" className="secondary" onClick={() => setIsProfileModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="friends-settings-modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <h4>Settings</h4>
            <p>Update your profile details.</p>

            <div className="friends-row">
              <input
                value={settingsNameDraft}
                onChange={(e) => setSettingsNameDraft(e.target.value)}
                placeholder="Display name"
                style={{
                  background: settingsThemeDraft === 'dark' ? '#23272f' : '#fff',
                  color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
                }}
              />
            </div>

            <div className="friends-row">
              <textarea
                rows={4}
                value={settingsBioDraft}
                onChange={(e) => setSettingsBioDraft(e.target.value)}
                placeholder="Bio"
                style={{
                  background: settingsThemeDraft === 'dark' ? '#23272f' : '#fff',
                  color: settingsThemeDraft === 'dark' ? '#f5f5f5' : '#222'
                }}
              />
            </div>

            <div className="friends-row">
              <select
                value={settingsThemeDraft}
                onChange={(e) => setSettingsThemeDraft(e.target.value)}
                aria-label="Theme setting"
              >
                <option value="light">Light theme</option>
                <option value="dark">Dark theme</option>
              </select>
            </div>

            <div className="friends-row">
              <label>
                <input
                  type="checkbox"
                  checked={settingsNotificationsDraft}
                  onChange={(e) => setSettingsNotificationsDraft(e.target.checked)}
                />{' '}
                Notifications enabled
              </label>
            </div>

            {settingsSavedMessage ? <p className="friends-note">{settingsSavedMessage}</p> : null}
            {settingsError ? <p className="friends-error">{settingsError}</p> : null}

            <div className="friends-add-modal-actions">
              <button type="button" onClick={handleSaveSettings}>Save</button>
              <button type="button" className="secondary" onClick={() => setIsSettingsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

import { useContext } from 'react';


function FriendsSuggestions({ authToken, contacts, socket, onSendFriendRequest, onClose }) {
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  // Helper to fetch suggestions (API fallback)
  const fetchSuggestions = async (isMounted = true) => {
    setLoading(true);
    setError('');
    try {
      const res = await searchUsers(authToken, '');
      let users = res.users || [];
      const contactIds = new Set(contacts.map(c => c.uniqueId));
      const selfId = contacts.find(c => c.isSelf)?.uniqueId || '';
      users = users.filter(u => !contactIds.has(u.uniqueId) && u.uniqueId !== selfId);
      if (isMounted) setSuggested(users);
    } catch (e) {
      if (isMounted) setError('Could not load suggestions');
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchSuggestions(isMounted);
    if (socket) {
      // Listen for real-time new user event
      const onNewUser = () => fetchSuggestions(isMounted);
      socket.on('users:new_user', onNewUser);
      // Listen for all users event (on connect)
      const onAllUsers = (users) => {
        const contactIds = new Set(contacts.map(c => c.uniqueId));
        const selfId = contacts.find(c => c.isSelf)?.uniqueId || '';
        const filtered = (users || []).filter(u => !contactIds.has(u.uniqueId) && u.uniqueId !== selfId);
        if (isMounted) setSuggested(filtered);
        if (isMounted) setLoading(false);
      };
      socket.on('users:all', onAllUsers);
      // Listen for users:refresh event for real-time suggestions
      const onRefresh = () => fetchSuggestions(isMounted);
      socket.on('users:refresh', onRefresh);
      return () => {
        isMounted = false;
        socket.off('users:new_user', onNewUser);
        socket.off('users:all', onAllUsers);
        socket.off('users:refresh', onRefresh);
      };
    }
    return () => { isMounted = false; };
  }, [authToken, contacts, socket]);

  if (loading) {
    return (
      <div className="friends-suggestions-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', minHeight: 120 }}>
        <div className="friends-spinner" style={{ margin: '1rem', width: 40, height: 40, border: '4px solid #ccc', borderTop: '4px solid #1976d2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 16, color: '#555', marginTop: 8 }}>Finding suggestions...</div>
      </div>
    );
  }
  if (error) return <div className="friends-suggestions-error">{error}</div>;
  if (!loading && !suggested.length) return <div className="friends-suggestions-empty">No suggestions available</div>;

  return (
    <div className="friends-suggestions-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', padding: '1rem 0' }}>
      {suggested.map(user => (
        <div className="friends-suggestion-card" key={user.uniqueId} style={{ minWidth: 220, maxWidth: 320, flex: '1 1 220px', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px #0001', margin: 4, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="friends-suggestion-avatar" style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 600, overflow: 'hidden' }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || user.uniqueId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{(user.displayName || user.uniqueId)[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="friends-suggestion-meta" style={{ flex: 1 }}>
            <strong style={{ fontSize: 16 }}>{user.displayName || user.uniqueId}</strong>
            <div style={{ fontSize: 13, color: '#888' }}>{user.email || user.phoneNumber || user.uniqueId}</div>
          </div>
          <button
            className="friends-suggestion-add-btn"
            style={{ padding: '8px 14px', borderRadius: 6, background: '#1976d2', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}
            onClick={() => { onSendFriendRequest(user.uniqueId); onClose(); }}
          >
            Add Friend
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Main FriendsFeature Component ---

function FriendsFeature({ onSwitchToClassic }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [phoneState, setPhoneState] = useState('idle');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const recaptchaRef = useRef(null);

  const refreshProfile = async (token) => {
    const idToken = token || authToken;
    if (!idToken) return;
    setIsLoading(true);
    try {
      const data = await fetchFriendsProfile(idToken);
      setProfile(data.profile);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !friendsAuth) return undefined;

    setIsLoading(true);
    const unsub = onAuthStateChanged(friendsAuth, async (nextUser) => {
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setAuthToken('');
        setProfile(null);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const token = await nextUser.getIdToken(true);
        setAuthToken(token);
        refreshProfile(token); // Fetch profile immediately with fresh token
      } catch (e) {
        setError(e.message || 'Failed to get auth token');
      } finally {
        setIsLoading(false);
      }
    });

    setIsLoading(false);
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
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(friendsAuth, provider);
    } catch (e) {
      const code = e?.code || '';
      const shouldUseRedirect = code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request';

      if (shouldUseRedirect) {
        try {
          await signInWithRedirect(friendsAuth, provider);
          return;
        } catch (redirectError) {
          setError(mapFirebaseAuthError(redirectError));
          setIsLoading(false);
          return;
        }
      }

      setError(mapFirebaseAuthError(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!friendsAuth) return;

    getRedirectResult(friendsAuth).catch((e) => {
      const code = e?.code || '';
      if (code === 'auth/no-auth-event') return;
      setError(mapFirebaseAuthError(e));
    });
  }, []);

  const handlePhoneStart = async (phone) => {
    if (!friendsAuth) {
      setError('Firebase auth is not initialized. Restart frontend and check Firebase config.');
      return;
    }
    setError('');
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneConfirm = async (code) => {
    setError('');
    setIsLoading(true);
    if (!confirmationResult) {
      setError('Send OTP first.');
      setIsLoading(false);
      return;
    }
    try {
      await confirmationResult.confirm(code);
      setPhoneState('verified');
    } catch (e) {
      setError(mapFirebaseAuthError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setError('');
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="friends-login">
        <div className="friends-mode-toggle" role="tablist" aria-label="Choose login mode">
          <button
            type="button"
            role="tab"
            className="friends-mode-btn"
            onClick={onSwitchToClassic}
            disabled={!onSwitchToClassic}
          >
            Username + Room
          </button>
          <button type="button" role="tab" aria-selected="true" className="friends-mode-btn active" disabled>
            Friends Login
          </button>
        </div>

        <h3 className="friends-title">Friends Login</h3>
        <p className="friends-error">Missing Firebase client configuration in frontend env.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="friends-loading" style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="friends-spinner" style={{ margin: '1rem auto', width: 40, height: 40, border: '4px solid #ccc', borderTop: '4px solid #1976d2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div>Loading, please wait...</div>
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
        onSwitchToClassic={onSwitchToClassic}
      />
    );
  }

  return (
    <FriendsWorkspace
      authToken={authToken}
      profile={profile}
      onLogout={handleLogout}
      socket={socket}
      onProfileRefresh={() => refreshProfile()}
    />
  );
}

// --- EmojiPickerFixed Helper Component ---
function EmojiPickerFixed({ contextMenu, onClose, onReact }) {
  // Position the picker near the context menu, but keep it in viewport
  const pickerRef = React.useRef(null);

  React.useEffect(() => {
    if (!pickerRef.current || !contextMenu) return;
    const picker = pickerRef.current;
    const { innerWidth, innerHeight } = window;
    let top = contextMenu.y;
    let left = contextMenu.x;
    const rect = picker.getBoundingClientRect();
    if (top + rect.height > innerHeight) top = innerHeight - rect.height - 8;
    if (left + rect.width > innerWidth) left = innerWidth - rect.width - 8;
    picker.style.top = `${Math.max(0, top)}px`;
    picker.style.left = `${Math.max(0, left)}px`;
  }, [contextMenu]);

  // Click-away to close picker
  React.useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Simple emoji list (can be replaced with a full picker)
  const emojis = ['😀','😂','😍','😎','😢','👍','🙏','🎉','🔥','❤️','😡','😮','😅','😇','🤔','🙌','🥳','😏','😭','😬'];

  return (
    <div
      ref={pickerRef}
      className="friends-emoji-picker-fixed"
      style={{
        position: 'fixed',
        zIndex: 10000,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 10,
        boxShadow: '0 2px 12px #0002',
        padding: 8,
        minWidth: 180,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
      tabIndex={-1}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="friends-emoji-btn"
          style={{ fontSize: 22, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}
          onClick={() => { onReact(emoji); onClose(); }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}


// --- Modern, viewport-aware context menu for messages ---
function MsgContextMenu({ contextMenu, onEdit, onDelete, onReact, isMine, onClose }) {
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuRef.current || !contextMenu) return;
    const menu = menuRef.current;
    const { innerWidth, innerHeight } = window;
    let top = contextMenu.y;
    let left = contextMenu.x;
    const rect = menu.getBoundingClientRect();
    if (top + rect.height > innerHeight) top = innerHeight - rect.height - 8;
    if (left + rect.width > innerWidth) left = innerWidth - rect.width - 8;
    menu.style.top = `${Math.max(0, top)}px`;
    menu.style.left = `${Math.max(0, left)}px`;
  }, [contextMenu]);

  // Click-away to close
  React.useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Find the message object by msgId from contextMenu
  // This assumes you have access to the messages array or a way to get the message by ID
  // We'll use a workaround: pass the message object itself as contextMenu.msg if possible
  const msg = contextMenu.msg || null;
  let canEditOrReact = false;
  if (msg && msg.createdAt) {
    const created = new Date(msg.createdAt).getTime();
    const now = Date.now();
    canEditOrReact = (now - created) < 12 * 60 * 60 * 1000; // 12 hours in ms
  }
  return (
    <div
      ref={menuRef}
      className="friends-msg-menu"
      style={{
        position: 'fixed',
        minWidth: 140,
        padding: 0,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(30,40,60,0.18)',
        border: '1px solid #e0e0e0',
        zIndex: 9999,
        overflow: 'hidden',
        animation: 'fadeInMenu 0.18s',
      }}
      tabIndex={-1}
    >
      {isMine && canEditOrReact && <button onClick={onEdit} style={{borderBottom:'1px solid #f0f0f0'}}>Edit</button>}
      {isMine && canEditOrReact && <button onClick={onDelete} style={{borderBottom:'1px solid #f0f0f0'}}>Delete</button>}
      <button onClick={onReact}>React</button>
      {(!canEditOrReact) && <div style={{padding:'8px',color:'#aaa',fontSize:13}}>Edit/Delete disabled after 12h</div>}
      
    </div>
  );
}

export default FriendsFeature;