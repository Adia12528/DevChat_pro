// DevChat Pro - Complete Refactored App.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle, 
  Edit2, X, AlertCircle, Smile, Image as ImageIcon, Pin, Download, Moon, Sun, 
  AtSign, Reply, Eye, EyeOff, Menu, FileDown, Smartphone, LogOut, Lock, ChevronLeft, 
  ChevronUp, ChevronRight, PlayCircle, Mic, Camera, Volume2, VolumeX, Play, Pause, 
  FileText, ChevronDown, MessageSquare, Star, Phone, Video, PhoneOff, 
  Maximize2, Minimize2, Settings, Share2, Radio, Bell, Activity,
  Headphones, Radio as RadioIcon, Volume, Video as VideoIcon, Mic as MicIcon,
  Monitor, ScreenShare, ScreenShareOff
} from 'lucide-react';

// Context Providers
import { CallProvider, useCall } from './contexts/CallContext';

// Components
import CallPanel from './components/calls/CallPanel';
import { 
  LiveStreamControls, 
  LiveStreamChat, 
  StreamSettings,
  ViewerGrid,
  StreamQualityIndicator 
} from './components/streams/LiveStream';
import MessageBubble from './components/chat/MessageBubble';
import MessageInput from './components/chat/MessageInput';
import ChatHeader from './components/chat/ChatHeader';
import Modals from './components/common/Modals';
import Toasts from './components/common/Toasts';

// Settings Components
import SettingsManager from './components/settings/SettingsManager';
import CallSettings from './components/settings/CallSettings';
import AudioSettings from './components/settings/AudioSettings';
import VideoSettings from './components/settings/VideoSettings';
import StreamSettings from './components/settings/StreamSettings';
import AppSettings from './components/settings/AppSettings';

// Utils
import { APP_VERSION, BUILD_DATE } from './version';
import { 
  formatRelativeTime, 
  formatDateSeparator, 
  needsDateSeparator, 
  isGroupedMessage, 
  formatFileSize, 
  playNotificationSound, 
  copyToClipboard, 
  getUserColor, 
  getInitials, 
  getAvatarStyle, 
  detectLinks, 
  extractMentions 
} from './utils/helpers';

// LiveKit
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';

// ==================== CONSTANTS ====================
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];
const LIVESTREAM_REACTIONS = ['🔥', '👏', '❤️', '😂', '😮', '🎉'];

const CALL_EVENTS = {
  OFFER: 'call:offer',
  ANSWER: 'call:answer',
  ICE_CANDIDATE: 'call:ice-candidate',
  REJECT: 'call:reject',
  REJECTED: 'call:rejected',
  END: 'call:end',
  ENDED: 'call:ended',
  SCREEN_SHARE_START: 'call:screen-share-start',
  SCREEN_SHARE_END: 'call:screen-share-end'
};

const LIVESTREAM_EVENTS = {
  START: 'livestream:start',
  STARTED: 'livestream:started',
  AVAILABLE: 'livestream:available',
  JOIN_REQUEST: 'livestream:join-request',
  OFFER: 'livestream:offer',
  ANSWER: 'livestream:answer',
  ICE_CANDIDATE: 'livestream:ice-candidate',
  STOP: 'livestream:stop',
  STOPPED: 'livestream:stopped',
  DECLINE: 'livestream:decline',
  LEAVE: 'livestream:leave',
  VIEWERS_UPDATE: 'livestream:viewers-update',
  COMMENT: 'livestream:comment',
  COMMENTED: 'livestream:commented',
  REACTION: 'livestream:reaction',
  REACTED: 'livestream:reacted'
};

const ROOM_EVENTS = {
  REGISTRY_UPDATED: 'room_registry_updated'
};

function AppContent() {
  // ==================== CORE STATES ====================
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [showDoubleTick, setShowDoubleTick] = useState(localStorage.getItem('showDoubleTick') !== 'false');
  const [showBlueTick, setShowBlueTick] = useState(localStorage.getItem('showBlueTick') !== 'false');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 600);
  
  // Message states
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [starredMsgIds, setStarredMsgIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('devChatStarred') || '[]')); }
    catch { return new Set(); }
  });
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  
  // UI states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showRoomSidebar, setShowRoomSidebar] = useState(false);
  const [showStarredPanel, setShowStarredPanel] = useState(false);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  
  // File upload states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [recordingLocked, setRecordingLocked] = useState(false);
  
  // Media viewer states
  const [imageViewer, setImageViewer] = useState(null);
  const [voicePlayer, setVoicePlayer] = useState(null);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuMessage, setContextMenuMessage] = useState(null);
  
  // Navigation
  const [currentView, setCurrentView] = useState('chat');
  const [navigationStack, setNavigationStack] = useState([]);
  
  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Room management
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [groupRoomId, setGroupRoomId] = useState('');
  const [roomUserMap, setRoomUserMap] = useState({});
  const [blockedUsers, setBlockedUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('devchatBlockedUsers') || '[]'); }
    catch { return []; }
  });
  
  // Refs
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const searchTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);
  const menuContainerRef = useRef(null);
  const contextMenuRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingTimeRef = useRef(0);
  const audioRef = useRef(null);
  const msgRefsMap = useRef({});
  const usernameRef = useRef('');
  const roomRef = useRef('');
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  
  // Call context
  const {
    callState,
    callType,
    callPeer,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    incomingCall,
    callError,
    callStats,
    isCallRecording,
    connectionQuality,
    setIncomingCall,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    localVideoRef,
    remoteVideoRef
  } = useCall();

  // LiveKit states
  const [liveKitToken, setLiveKitToken] = useState(null);
  const [currentStreamRoom, setCurrentStreamRoom] = useState('');
  const [isStreamHost, setIsStreamHost] = useState(false);
  const [liveStreamInfo, setLiveStreamInfo] = useState(null);
  const [livestreamComments, setLivestreamComments] = useState([]);
  const [livestreamCommentInput, setLivestreamCommentInput] = useState('');
  const [streamVisibility, setStreamVisibility] = useState('public');
  const [streamSource, setStreamSource] = useState('camera');

  // ==================== REF UPDATES ====================
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);

  // ==================== INITIAL SETUP ====================
  useEffect(() => {
    console.log(`%c🚀 DevChat Pro v${APP_VERSION}`, 'color: #00ff88; font-size: 16px;');
    
    // Restore session
    const savedUsername = sessionStorage.getItem('chatUsername');
    const savedRoom = sessionStorage.getItem('chatRoom');
    if (savedUsername && savedRoom) {
      setUsername(savedUsername);
      setRoom(savedRoom);
    }
  }, []);

  // ==================== THEME ====================
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ==================== MOBILE DETECTION ====================
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ==================== SOCKET SETUP ====================
  useEffect(() => {
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 
      (window.location.hostname !== 'localhost' 
        ? "https://devchat-pro.onrender.com" 
        : "http://localhost:5000");

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      withCredentials: true,
      timeout: 20000
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      setConnected(true);
      
      if (roomRef.current && usernameRef.current) {
        socket.emit('join_room', { 
          room: roomRef.current, 
          username: usernameRef.current, 
          fetchHistory: true 
        });
        socket.emit('update_status', { username: usernameRef.current, status: 'online' });
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected');
      setConnected(false);
    });

    // Message events
    socket.on('load_history', (data) => {
      setChat(data);
      setPinnedMessages(data.filter(m => m.isPinned));
    });

    socket.on('receive_message', (data) => {
      if (lastMessageIdRef.current === data._id) return;
      lastMessageIdRef.current = data._id;
      
      if (blockedUsers.includes(data.sender)) return;
      
      setChat(prev => [...prev, data]);
      
      // Clear typing indicator
      if (typingTimersRef.current.has(data.sender)) {
        clearTimeout(typingTimersRef.current.get(data.sender));
        typingTimersRef.current.delete(data.sender);
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(data.sender);
          return updated;
        });
      }
      
      // Handle unread count
      if (!isAtBottomRef.current && data.sender !== usernameRef.current) {
        setUnreadCount(c => c + 1);
      }
      
      // Play sound
      if (soundEnabled && data.sender !== usernameRef.current) {
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          playNotificationSound(audioContextRef.current);
        } catch (e) {
          console.log('Sound failed:', e);
        }
      }
    });

    socket.on('chat_cleared', () => {
      setChat([]);
      setPinnedMessages([]);
    });

    socket.on('message_edited', (updatedMessage) => {
      setChat(prev => prev.map(m => m._id === updatedMessage._id ? updatedMessage : m));
    });

    socket.on('message_deleted', (data) => {
      setChat(prev => prev.filter(m => m._id !== data.messageId));
    });

    socket.on('message_pinned', (message) => {
      setChat(prev => prev.map(m => m._id === message._id ? message : m));
      setPinnedMessages(prev => [...prev, message]);
    });

    socket.on('message_unpinned', (data) => {
      setChat(prev => prev.map(m => m._id === data.messageId ? { ...m, isPinned: false } : m));
      setPinnedMessages(prev => prev.filter(m => m._id !== data.messageId));
    });

    socket.on('reaction_added', (data) => {
      setChat(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    socket.on('reaction_removed', (data) => {
      setChat(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    socket.on('messages_read', (data) => {
      setChat(prev => prev.map(m => {
        if (data.messageIds.includes(m._id)) {
          return { ...m, readBy: [...new Set([...(m.readBy || []), data.username])] };
        }
        return m;
      }));
    });

    // User events
    socket.on('user_joined', (data) => {
      setOnlineUsers(data.users);
      setRoomUserMap(prev => ({ ...prev, [data.room]: data.users }));
    });

    socket.on('user_left', (data) => {
      setOnlineUsers(data.users);
      setRoomUserMap(prev => ({ ...prev, [data.room]: data.users }));
    });

    socket.on('user_typing', (data) => {
      if (data.username === usernameRef.current) return;
      
      setTypingUsers(prev => new Set([...prev, data.username]));
      
      if (typingTimersRef.current.has(data.username)) {
        clearTimeout(typingTimersRef.current.get(data.username));
      }
      
      const timer = setTimeout(() => {
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(data.username);
          return updated;
        });
        typingTimersRef.current.delete(data.username);
      }, 3000);
      
      typingTimersRef.current.set(data.username, timer);
    });

    socket.on('user_stopped_typing', (data) => {
      if (typingTimersRef.current.has(data)) {
        clearTimeout(typingTimersRef.current.get(data));
        typingTimersRef.current.delete(data);
      }
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data);
        return updated;
      });
    });

    socket.on('user_status_changed', (data) => {
      // Handle status change
    });

    // Call signaling events
    socket.on(CALL_EVENTS.OFFER, (data) => {
      setIncomingCall({
        from: data.from,
        callType: data.callType,
        offer: data.offer
      });
    });

    socket.on(CALL_EVENTS.ANSWER, (data) => {
      // Handle in useWebRTC hook
    });

    socket.on(CALL_EVENTS.ICE_CANDIDATE, (data) => {
      // Handle in useWebRTC hook
    });

    socket.on(CALL_EVENTS.REJECTED, () => {
      endCall();
    });

    socket.on(CALL_EVENTS.ENDED, () => {
      endCall();
    });

    socket.on(CALL_EVENTS.SCREEN_SHARE_START, () => {
      // Handle remote screen share start
    });

    socket.on(CALL_EVENTS.SCREEN_SHARE_END, () => {
      // Handle remote screen share end
    });

    // Livestream events
    socket.on(LIVESTREAM_EVENTS.STARTED, (data) => {
      setSuccessMessage(`🔴 ${data.host} started a livestream`);
    });

    socket.on(LIVESTREAM_EVENTS.AVAILABLE, (data) => {
      setNotificationItems(prev => [...prev, {
        id: `live-${data.sessionId}`,
        type: 'livestream',
        sessionId: data.sessionId,
        sender: data.host,
        preview: `${data.host} is live`,
        time: new Date().toISOString()
      }]);
    });

    socket.on(LIVESTREAM_EVENTS.OFFER, (data) => {
      setIncomingCall({
        from: data.from,
        callType: 'video',
        offer: data.offer,
        isLivestream: true,
        sessionId: data.sessionId,
        visibility: data.visibility,
        source: data.source
      });
    });

    socket.on(LIVESTREAM_EVENTS.COMMENTED, (data) => {
      if (liveStreamInfo?.sessionId === data.sessionId) {
        setLivestreamComments(prev => [...prev, {
          id: data.id,
          from: data.from,
          text: data.text,
          time: data.time
        }]);
      }
    });

    socket.on(LIVESTREAM_EVENTS.REACTED, (data) => {
      if (liveStreamInfo?.sessionId === data.sessionId) {
        setLivestreamComments(prev => [...prev, {
          id: data.id,
          type: 'reaction',
          from: data.from,
          emoji: data.emoji,
          time: data.time
        }]);
      }
    });

    socket.on(LIVESTREAM_EVENTS.VIEWERS_UPDATE, (data) => {
      setLiveStreamInfo(prev => prev ? { ...prev, viewerCount: data.count } : prev);
    });

    socket.on(LIVESTREAM_EVENTS.STOPPED, (data) => {
      if (liveStreamInfo?.sessionId === data.sessionId) {
        setLiveStreamInfo(null);
        setLivestreamComments([]);
      }
    });

    socket.on(ROOM_EVENTS.REGISTRY_UPDATED, (data) => {
      // Handle room registry update
    });

    socket.on('block_list_updated', ({ blocked }) => {
      setBlockedUsers(blocked);
    });

    return () => {
      socket.disconnect();
      
      // Cleanup timers
      typingTimersRef.current.forEach(timer => clearTimeout(timer));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [soundEnabled, blockedUsers, liveStreamInfo]);

  // ==================== SCROLL TO BOTTOM ====================
  useEffect(() => {
    if (isAtBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, typingUsers, isAtBottom]);

  // ==================== SEARCH DEBOUNCE ====================
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  // ==================== FILTERED CHAT ====================
  const filteredChat = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) return chat;
    
    return chat.filter(msg => 
      msg.text?.toLowerCase().includes(query) || 
      msg.sender?.toLowerCase().includes(query)
    );
  }, [chat, debouncedSearchQuery]);

  // ==================== TYPING DISPLAY ====================
  const typingDisplay = useMemo(() => {
    const arr = Array.from(typingUsers);
    if (arr.length === 0) return '';
    if (arr.length === 1) return `${arr[0]} is typing`;
    if (arr.length === 2) return `${arr[0]} and ${arr[1]} are typing`;
    return `${arr[0]}, ${arr[1]} and ${arr.length - 2} others are typing`;
  }, [typingUsers]);

  // ==================== SCROLL DETECTION ====================
  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatBody;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
      
      if (atBottom) {
        setUnreadCount(0);
      }
    };

    chatBody.addEventListener('scroll', handleScroll);
    return () => chatBody.removeEventListener('scroll', handleScroll);
  }, []);

  // ==================== JOIN ROOM ====================
  const joinRoom = () => {
    if (username && room && socketRef.current) {
      sessionStorage.setItem('chatUsername', username);
      sessionStorage.setItem('chatRoom', room);
      
      socketRef.current.emit('join_room', { 
        room, 
        username, 
        fetchHistory: true 
      });
      socketRef.current.emit('update_status', { username, status: 'online' });
      
      setGroupRoomId(room);
      setRooms([{ id: room, name: room, type: 'group' }]);
      setActiveRoom(room);
      setShowChat(true);
    }
  };

  // ==================== SEND MESSAGE ====================
  const sendMessage = () => {
    const text = message.trim();
    if (!text || !connected || !socketRef.current) return;

    const mentions = extractMentions(text);
    
    socketRef.current.emit('send_message', {
      room: roomRef.current,
      sender: usernameRef.current,
      text,
      mentions,
      replyTo: replyingTo?._id || null
    });

    setMessage('');
    setReplyingTo(null);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    socketRef.current.emit('stop_typing', { 
      room: roomRef.current, 
      username: usernameRef.current 
    });
  };

  // ==================== HANDLE MESSAGE CHANGE ====================
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-grow textarea
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }

    // Emit typing
    const socket = socketRef.current;
    if (!socket || !connected) return;
    
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1500) {
      socket.emit('typing', { 
        room: roomRef.current, 
        username: usernameRef.current 
      });
      lastTypingEmitRef.current = now;
    }

    // Set stop typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { 
        room: roomRef.current, 
        username: usernameRef.current 
      });
      typingTimeoutRef.current = null;
    }, 3000);
  };

  // ==================== HANDLE EMOJI ====================
  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // ==================== HANDLE REACTION ====================
  const handleReaction = (messageId, emoji) => {
    if (!socketRef.current) return;
    
    const msg = chat.find(m => m._id === messageId);
    const reactions = msg?.reactions || {};
    const userReacted = reactions[emoji]?.includes(username);
    
    if (userReacted) {
      socketRef.current.emit('remove_reaction', { 
        messageId, 
        emoji, 
        username: usernameRef.current,
        room: roomRef.current 
      });
    } else {
      socketRef.current.emit('add_reaction', { 
        messageId, 
        emoji, 
        username: usernameRef.current,
        room: roomRef.current 
      });
    }
  };

  // ==================== TOGGLE PIN ====================
  const togglePin = (messageId, isPinned) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      isPinned ? 'unpin_message' : 'pin_message', 
      { messageId, room: roomRef.current }
    );
  };

  // ==================== TOGGLE STAR ====================
  const toggleStar = (msgId) => {
    setStarredMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      localStorage.setItem('devChatStarred', JSON.stringify([...next]));
      return next;
    });
  };

  // ==================== COPY MESSAGE ====================
  const handleCopyMessage = (text, msgId) => {
    copyToClipboard(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // ==================== EDIT MESSAGE ====================
  const startEditMessage = (msgId, currentText) => {
    setEditingMsgId(msgId);
    setEditingText(currentText);
  };

  const saveEditMessage = () => {
    if (!editingText.trim() || !socketRef.current || !editingMsgId) return;
    
    socketRef.current.emit('edit_message', {
      messageId: editingMsgId,
      newText: editingText,
      room: roomRef.current,
      sender: usernameRef.current
    });
    
    setEditingMsgId(null);
    setEditingText('');
  };

  // ==================== DELETE MESSAGE ====================
  const deleteMessage = (msgId) => {
    setDeletingMsgId(msgId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (socketRef.current && deletingMsgId) {
      socketRef.current.emit('delete_message', {
        messageId: deletingMsgId,
        room: roomRef.current,
        sender: usernameRef.current
      });
    }
    setShowDeleteConfirm(false);
    setDeletingMsgId(null);
  };

  // ==================== SCROLL TO MESSAGE ====================
  const scrollToMessage = (messageId) => {
    const el = msgRefsMap.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('msg-highlight');
      setTimeout(() => el.classList.remove('msg-highlight'), 1500);
    }
  };

  // ==================== CONTEXT MENU ====================
  const handleContextMenu = (e, message) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const x = e.clientX || e.touches?.[0]?.clientX || 0;
    const y = e.clientY || e.touches?.[0]?.clientY || 0;

    setContextMenu({ x, y });
    setContextMenuMessage(message);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setContextMenuMessage(null);
  };

  const handleContextMenuAction = (action) => {
    if (!contextMenuMessage) return;

    switch(action) {
      case 'reply':
        setReplyingTo(contextMenuMessage);
        break;
      case 'copy':
        handleCopyMessage(contextMenuMessage.text, contextMenuMessage._id);
        break;
      case 'pin':
        togglePin(contextMenuMessage._id, contextMenuMessage.isPinned);
        break;
      case 'star':
        toggleStar(contextMenuMessage._id);
        break;
      case 'edit':
        startEditMessage(contextMenuMessage._id, contextMenuMessage.text);
        break;
      case 'delete':
        deleteMessage(contextMenuMessage._id);
        break;
      case 'react':
        // Quick reactions will be shown separately
        break;
      case 'view':
        if (contextMenuMessage.type === 'image' && contextMenuMessage.fileUrl) {
          setImageViewer({
            url: contextMenuMessage.fileUrl,
            fileName: `image-${new Date(contextMenuMessage.time).getTime()}.jpg`,
            sender: contextMenuMessage.sender,
            time: contextMenuMessage.time
          });
        }
        break;
      case 'play':
        if (contextMenuMessage.type === 'voice' && contextMenuMessage.fileUrl) {
          playVoiceMessage(contextMenuMessage.fileUrl, contextMenuMessage._id);
        }
        break;
    }
    closeContextMenu();
  };

  // ==================== VOICE MESSAGES ====================
  const playVoiceMessage = async (audioUrl, msgId) => {
    if (playingVoiceId === msgId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => {
          setErrorMessage('Failed to play voice message');
          setPlayingVoiceId(null);
        };

        setPlayingVoiceId(msgId);
        await audio.play();
      } catch (error) {
        console.error('Playback failed:', error);
        setPlayingVoiceId(null);
      }
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        if (recordingTimeRef.current < 1) {
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }

        // Upload to server
        const formData = new FormData();
        formData.append('file', audioBlob, `voice-${Date.now()}.webm`);
        formData.append('upload_preset', 'devchat_uploads');

        try {
          setUploadingFile(true);
          setUploadProgress('Uploading voice...');

          const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
            method: 'POST',
            body: formData
          });

          const data = await res.json();

          if (data.secure_url) {
            socketRef.current.emit('send_message', {
              room: roomRef.current,
              sender: usernameRef.current,
              text: 'Voice message',
              type: 'voice',
              fileUrl: data.secure_url,
              duration: recordingTimeRef.current
            });
          }
        } catch (error) {
          console.error('Upload failed:', error);
        } finally {
          setUploadingFile(false);
          setUploadProgress('');
          setIsRecording(false);
          setRecordingTime(0);
          recordingTimeRef.current = 0;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => {
          const newTime = t + 1;
          recordingTimeRef.current = newTime;
          if (newTime >= 60) stopVoiceRecording();
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('Recording failed:', error);
      setErrorMessage('Could not access microphone');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
    }
  };

  // ==================== FILE UPLOAD ====================
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const loadedImages = await Promise.all(
        imageFiles.map((file, index) => {
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = (event) => resolve({
              file,
              preview: event.target.result,
              id: Date.now() + index
            });
            reader.readAsDataURL(file);
          });
        })
      );
      
      setSelectedImages(loadedImages);
      setCurrentImageIndex(0);
      setShowImagePreview(true);
    }
  };

  const uploadMultipleImages = async () => {
    if (selectedImages.length === 0) return;

    setUploadingFile(true);
    setShowImagePreview(false);

    for (let i = 0; i < selectedImages.length; i++) {
      const { file } = selectedImages[i];
      setUploadProgress(`Uploading ${i + 1}/${selectedImages.length}...`);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'devchat_uploads');

        const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        if (data.secure_url) {
          socketRef.current.emit('send_message', {
            room: roomRef.current,
            sender: usernameRef.current,
            text: i === 0 && imageCaption ? imageCaption : file.name,
            type: 'image',
            fileUrl: data.secure_url,
            fileName: file.name,
            fileSize: file.size
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    setSelectedImages([]);
    setImageCaption('');
    setUploadingFile(false);
    setUploadProgress('');
  };

  const cancelImagePreview = () => {
    setShowImagePreview(false);
    setSelectedImages([]);
    setImageCaption('');
    setCurrentImageIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // ==================== DOWNLOAD MEDIA ====================
  const downloadMedia = (url, fileName) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== DM FUNCTIONS ====================
  const createDM = (targetUser) => {
    if (!targetUser || targetUser === username) return;
    
    const dmRoom = [username, targetUser].sort().join('_dm_');
    
    setRooms(prev => {
      if (prev.some(r => r.id === dmRoom)) return prev;
      return [...prev, { id: dmRoom, name: targetUser, type: 'dm', with: targetUser }];
    });
    
    setActiveRoom(dmRoom);
    socketRef.current.emit('join_room', { room: dmRoom, username, fetchHistory: true });
  };

  const switchRoom = (roomId) => {
    setActiveRoom(roomId);
    setRoom(roomId);
    
    socketRef.current.emit('join_room', { 
      room: roomId, 
      username, 
      fetchHistory: true 
    });
    
    const roomUsers = roomUserMap[roomId];
    setOnlineUsers(Array.isArray(roomUsers) ? roomUsers : []);
  };

  // ==================== LIVESTREAM FUNCTIONS ====================
  const handleJoinStream = async (roomName, asHost = false) => {
    if (liveKitToken) {
      setErrorMessage('Already in a stream');
      return;
    }

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 
        (window.location.hostname !== 'localhost' 
          ? "https://devchat-pro.onrender.com" 
          : "http://localhost:5000");

      const response = await fetch(
        `${BACKEND_URL}/api/livekit/token?room=${roomName}&username=${username}&isHost=${asHost}`
      );
      const data = await response.json();

      if (data.token) {
        setCurrentStreamRoom(roomName);
        setIsStreamHost(asHost);
        setLiveKitToken(data.token);
      }
    } catch (error) {
      console.error('Stream connection failed:', error);
    }
  };

  const handleLeaveStream = () => {
    setLiveKitToken(null);
    setCurrentStreamRoom('');
    setIsStreamHost(false);
  };

  const startLivestream = async (visibility, source) => {
    if (!socketRef.current || !roomRef.current) return;

    socketRef.current.emit(LIVESTREAM_EVENTS.START, {
      host: username,
      room: roomRef.current,
      visibility,
      source
    }, (ack) => {
      if (ack?.success) {
        setLiveStreamInfo({
          sessionId: ack.sessionId,
          host: username,
          room: roomRef.current,
          visibility,
          source,
          isHost: true,
          viewerCount: 0
        });
      }
    });
  };

  const sendLivestreamComment = () => {
    if (!liveStreamInfo || !livestreamCommentInput.trim() || !socketRef.current) return;

    socketRef.current.emit(LIVESTREAM_EVENTS.COMMENT, {
      sessionId: liveStreamInfo.sessionId,
      from: username,
      text: livestreamCommentInput.trim()
    });

    setLivestreamCommentInput('');
  };

  const sendLivestreamReaction = (emoji) => {
    if (!liveStreamInfo || !socketRef.current) return;

    socketRef.current.emit(LIVESTREAM_EVENTS.REACTION, {
      sessionId: liveStreamInfo.sessionId,
      from: username,
      emoji
    });
  };

  // ==================== EXPORT CHAT ====================
  const exportChat = () => {
    const data = JSON.stringify(chat, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${room}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== LOGOUT ====================
  const performLogout = () => {
    if (socketRef.current) {
      socketRef.current.emit('update_status', { username, status: 'offline' });
      socketRef.current.emit('leave_room', { room, username });
      socketRef.current.disconnect();
    }
    
    sessionStorage.removeItem('chatUsername');
    sessionStorage.removeItem('chatRoom');
    
    setUsername('');
    setRoom('');
    setShowChat(false);
    setChat([]);
    setOnlineUsers([]);
    setConnected(false);
    setShowLogoutConfirm(false);
  };

  // ==================== SELECTED USER FOR CALLS ====================
  const selectedUser = useMemo(() => {
    const currentRoomId = activeRoom || room;
    if (!currentRoomId) return null;

    if (currentRoomId.includes('_dm_')) {
      const participants = currentRoomId.split('_dm_');
      return participants.find(p => p !== username) || null;
    }
    return null;
  }, [activeRoom, room, username]);

  // ==================== RENDER LOGIN SCREEN ====================
  if (!showChat) {
    return (
      <div className="login-screen">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="login-card"
        >
          <Zap color="#00a884" size={48} fill="#00a884" />
          <h2 className="brand">DevChat <span>Pro+</span></h2>
          <div className="input-group">
            <User size={18} />
            <input 
              placeholder="Your name" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && joinRoom()}
              autoFocus 
            />
          </div>
          <div className="input-group">
            <Hash size={18} />
            <input 
              placeholder="Room ID" 
              value={room} 
              onChange={e => setRoom(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && joinRoom()}
            />
          </div>
          <button 
            className="join-btn" 
            onClick={joinRoom} 
            disabled={!username.trim() || !room.trim()}
          >
            Enter Chat
          </button>
        </motion.div>
      </div>
    );
  }

  // ==================== RENDER CHAT ====================
  return (
    <div className="chat-container">
      {/* LiveKit Stream */}
      {liveKitToken && (
        <div className="livestream-fullscreen-container">
          <div className="livestream-header">
            <div className="livestream-header-left">
              <Radio size={24} color="#f44336" className="pulse-animation" />
              <h2>{isStreamHost ? "You are Live" : `Watching: ${currentStreamRoom}`}</h2>
            </div>
            <button onClick={handleLeaveStream} className="leave-stream-btn">
              Leave Stream
            </button>
          </div>
          <LiveKitRoom
            video={isStreamHost}
            audio={isStreamHost}
            token={liveKitToken}
            serverUrl={process.env.REACT_APP_LIVEKIT_URL || "wss://devchat-pro-f8nd2p1j.livekit.cloud"}
            onDisconnected={handleLeaveStream}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      )}

      {/* Main Chat UI */}
      <ChatHeader
        room={room}
        connected={connected}
        onlineUsers={onlineUsers}
        chatCount={chat.length}
        selectedUser={selectedUser}
        onStartVoiceCall={() => startCall('voice', selectedUser)}
        onStartVideoCall={() => startCall('video', selectedUser)}
        onToggleMenu={() => setShowMenuDropdown(!showMenuDropdown)}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onClearChat={() => setShowClearConfirm(true)}
        theme={theme}
        soundEnabled={soundEnabled}
        showMenuDropdown={showMenuDropdown}
        menuContainerRef={menuContainerRef}
        onCloseMenu={() => setShowMenuDropdown(false)}
        onExportChat={exportChat}
        onShowStarred={() => setShowStarredPanel(true)}
        onShowRooms={() => setCurrentView('rooms')}
        onShowNotifications={() => setCurrentView('notifications')}
        onShowSettings={() => setCurrentView('settings')}
        onLogout={() => setShowLogoutConfirm(true)}
        starredCount={starredMsgIds.size}
        notificationCount={notificationItems.length}
        activeGroupRoomCount={0}
        globalOnlineUsers={onlineUsers}
        username={username}
        conversationStats={{
          totalMessages: chat.length,
          totalUsers: new Set(chat.map(m => m.sender)).size,
          avgMessageLength: chat.length > 0 
            ? Math.round(chat.reduce((sum, m) => sum + (m.text?.length || 0), 0) / chat.length)
            : 0
        }}
        recentMentions={chat.filter(m => m.text?.includes(`@${username}`)).length}
        mentionedMessages={chat.filter(m => m.text?.includes(`@${username}`))}
        msgRefsMap={msgRefsMap}
        deferredPrompt={null}
        isAppInstalled={false}
        handleInstallClick={() => {}}
      />

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={18} />
        <input 
          type="text" 
          placeholder="Search messages..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <span className={`search-result-count ${filteredChat.length === 0 ? 'zero' : ''}`}>
            {filteredChat.length} result{filteredChat.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="pinned-messages-bar" onClick={() => setShowPinnedPanel(true)}>
          <Pin size={14} />
          <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
          <ChevronDown size={14} style={{ marginLeft: 'auto' }} />
        </div>
      )}

      {/* Chat Body */}
      <div 
        className="chat-body" 
        ref={chatBodyRef}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) {
            const mockEvent = { target: { files } };
            handleFileUpload(mockEvent);
          }
        }}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="drag-drop-overlay">
            <div className="drag-drop-content">
              <ImageIcon size={48} />
              <h3>Drop images here</h3>
            </div>
          </div>
        )}

        <AnimatePresence>
          {filteredChat.map((msg, index) => {
            const isOwn = msg.sender === username;
            const showDateSep = index === 0 || needsDateSeparator(msg.time, filteredChat[index - 1]?.time);

            return (
              <React.Fragment key={msg._id || index}>
                {showDateSep && (
                  <div className="date-separator">
                    <span className="date-separator-text">{formatDateSeparator(msg.time)}</span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  username={username}
                  starredMsgIds={starredMsgIds}
                  playingVoiceId={playingVoiceId}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                  onLongPressStart={(e) => {
                    const timer = setTimeout(() => handleContextMenu(e, msg), 500);
                    setLongPressTimer(timer);
                  }}
                  onLongPressEnd={() => {
                    if (longPressTimer) clearTimeout(longPressTimer);
                  }}
                  onReaction={handleReaction}
                  onScrollToMessage={scrollToMessage}
                  onToggleStar={toggleStar}
                  onPlayVoice={playVoiceMessage}
                  onDownloadMedia={downloadMedia}
                  onOpenImageViewer={setImageViewer}
                  onOpenVoicePlayer={setVoicePlayer}
                  chat={chat}
                  formatRelativeTime={formatRelativeTime}
                />
              </React.Fragment>
            );
          })}
        </AnimatePresence>

        {/* Typing Indicator */}
        <AnimatePresence>
          {typingUsers.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 6 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -6 }} 
              className="typing-pill"
            >
              <div className="typing-ellipsis">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="typing-label">{typingDisplay}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Unread Badge */}
      {unreadCount > 0 && !isAtBottom && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="unread-badge"
          onClick={() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" })}
        >
          <ChevronDown size={16} /> {unreadCount} new
        </motion.button>
      )}

      {/* Reply Bar */}
      {replyingTo && (
        <div className="replying-bar">
          <Reply size={16} />
          <div>
            <strong>Replying to {replyingTo.sender}</strong>
            <p>{replyingTo.text?.substring(0, 50)}...</p>
          </div>
          <button onClick={() => setReplyingTo(null)}><X size={16} /></button>
        </div>
      )}

      {/* Upload Progress */}
      {(uploadingFile || uploadProgress) && (
        <div className="uploading-bar">
          <div className="spinner-small"></div>
          <span>{uploadProgress || 'Uploading...'}</span>
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        message={message}
        onMessageChange={handleMessageChange}
        onSendMessage={sendMessage}
        connected={connected}
        isRecording={isRecording}
        recordingTime={recordingTime}
        onStartRecording={startVoiceRecording}
        onStopRecording={stopVoiceRecording}
        onCancelRecording={cancelVoiceRecording}
        onEmojiClick={() => setShowEmojiPicker(!showEmojiPicker)}
        onFileClick={() => fileInputRef.current?.click()}
        onCameraClick={() => cameraInputRef.current?.click()}
        textareaRef={textareaRef}
      />

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept="image/*"
        capture="environment"
        multiple
      />

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker onEmojiClick={handleEmojiClick} theme={theme} />
        </div>
      )}

      {/* Active Call Panel */}
      {callState === 'active' && callPeer && (
        <CallPanel
          callType={callType}
          callPeer={callPeer.username}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isCallMinimized={false}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={endCall}
          onToggleMinimize={() => {}}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          formatDuration={(s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`}
          localStream={localStream}
          remoteStream={remoteStream}
          remoteIsScreenSharing={false}
        />
      )}

      {/* Modals */}
      <Modals
        incomingCall={incomingCall}
        onAcceptCall={answerCall}
        onRejectCall={() => setIncomingCall(null)}
        editingMsgId={editingMsgId}
        editingText={editingText}
        onEditChange={setEditingText}
        onEditSave={saveEditMessage}
        onEditCancel={() => setEditingMsgId(null)}
        showDeleteConfirm={showDeleteConfirm}
        onDeleteConfirm={confirmDelete}
        onDeleteCancel={() => setShowDeleteConfirm(false)}
        showClearConfirm={showClearConfirm}
        onClearConfirm={() => {
          socketRef.current?.emit('clear_chat', roomRef.current);
          setShowClearConfirm(false);
        }}
        onClearCancel={() => setShowClearConfirm(false)}
        showLogoutConfirm={showLogoutConfirm}
        onLogoutConfirm={performLogout}
        onLogoutCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Toasts */}
      <Toasts
        error={callError}
        success={null}
        onCloseError={() => {}}
      />

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && contextMenuMessage && (
          <motion.div 
            ref={contextMenuRef}
            className="context-menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            <div className="context-menu-header">Message Actions</div>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('reply')}>
              <Reply size={16} /> Reply
            </button>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('copy')}>
              <Copy size={16} /> Copy
            </button>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('pin')}>
              <Pin size={16} /> {contextMenuMessage.isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('star')}>
              <Star size={16} fill={starredMsgIds.has(contextMenuMessage._id) ? '#FFD700' : 'none'} /> 
              {starredMsgIds.has(contextMenuMessage._id) ? 'Unstar' : 'Star'}
            </button>
            
            {contextMenuMessage.type === 'image' && contextMenuMessage.fileUrl && (
              <button className="context-menu-item" onClick={() => handleContextMenuAction('view')}>
                <ImageIcon size={16} /> View Image
              </button>
            )}
            
            {contextMenuMessage.type === 'voice' && contextMenuMessage.fileUrl && (
              <button className="context-menu-item" onClick={() => handleContextMenuAction('play')}>
                <PlayCircle size={16} /> Play Voice
              </button>
            )}
            
            <div className="context-menu-divider"></div>
            <div className="context-menu-reactions">
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  className="context-menu-emoji"
                  onClick={() => {
                    handleReaction(contextMenuMessage._id, emoji);
                    closeContextMenu();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            
            {contextMenuMessage.sender === username && (
              <>
                <div className="context-menu-divider"></div>
                <button className="context-menu-item" onClick={() => handleContextMenuAction('edit')}>
                  <Edit2 size={16} /> Edit
                </button>
                <button className="context-menu-item danger" onClick={() => handleContextMenuAction('delete')}>
                  <Trash2 size={16} /> Delete
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImagePreview && selectedImages.length > 0 && (
          <motion.div 
            className="image-preview-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <div className="preview-header">
              <button className="preview-close-btn" onClick={cancelImagePreview}>
                <X size={24} />
              </button>
              {selectedImages.length > 1 && (
                <span className="image-counter">
                  {currentImageIndex + 1} / {selectedImages.length}
                </span>
              )}
            </div>
            
            <div className="preview-image-container">
              <img src={selectedImages[currentImageIndex].preview} alt="Preview" />
              
              {selectedImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button 
                      className="preview-nav-btn prev"
                      onClick={() => setCurrentImageIndex(prev => prev - 1)}
                    >
                      <ChevronLeft size={32} />
                    </button>
                  )}
                  {currentImageIndex < selectedImages.length - 1 && (
                    <button 
                      className="preview-nav-btn next"
                      onClick={() => setCurrentImageIndex(prev => prev + 1)}
                    >
                      <ChevronRight size={32} />
                    </button>
                  )}
                </>
              )}
            </div>
            
            <div className="preview-footer">
              <input
                type="text"
                className="caption-input"
                placeholder="Add a caption..."
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
              />
              <button
                className="preview-send-btn"
                onClick={uploadMultipleImages}
                disabled={uploadingFile}
              >
                {uploadingFile ? <div className="spinner-small"></div> : <Send size={24} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {imageViewer && (
          <motion.div
            className="media-viewer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setImageViewer(null)}
          >
            <div className="media-viewer-header">
              <div className="media-viewer-info">
                <User size={16} />
                <span>{imageViewer.sender}</span>
                <span className="media-viewer-time">
                  {formatRelativeTime(imageViewer.time)}
                </span>
              </div>
              <button className="media-viewer-close" onClick={() => setImageViewer(null)}>
                <X size={24} />
              </button>
            </div>
            <motion.div
              className="image-viewer-content"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={imageViewer.url} alt="Full view" />
            </motion.div>
            <div className="media-viewer-actions">
              <button
                className="media-action-btn"
                onClick={() => downloadMedia(imageViewer.url, imageViewer.fileName)}
              >
                <Download size={20} /> Download
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Player Modal */}
      <AnimatePresence>
        {voicePlayer && (
          <motion.div
            className="media-viewer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVoicePlayer(null)}
          >
            <motion.div
              className="voice-player-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="voice-player-header">
                <div className="media-viewer-info">
                  <User size={16} />
                  <span>{voicePlayer.sender}</span>
                  <span className="media-viewer-time">
                    {formatRelativeTime(voicePlayer.time)}
                  </span>
                </div>
                <button className="media-viewer-close" onClick={() => setVoicePlayer(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="voice-player-content">
                <div className="voice-player-waveform">
                  <div className="voice-wave-bars">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="wave-bar"></div>
                    ))}
                  </div>
                </div>
                
                <div className="voice-player-controls">
                  <button
                    className="voice-player-play-btn"
                    onClick={() => playVoiceMessage(voicePlayer.url, 'modal')}
                  >
                    {playingVoiceId === 'modal' ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <div className="voice-player-info">
                    <span className="voice-player-duration">{voicePlayer.duration}s</span>
                    <span className="voice-player-label">Voice Message</span>
                  </div>
                </div>
              </div>

              <div className="media-viewer-actions">
                <button
                  className="media-action-btn"
                  onClick={() => downloadMedia(voicePlayer.url, voicePlayer.fileName)}
                >
                  <Download size={20} /> Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Starred Messages Panel */}
      <AnimatePresence>
        {showStarredPanel && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStarredPanel(false)}
          >
            <motion.div
              className="starred-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => setShowStarredPanel(false)} className="panel-back-btn">← Back</button>
                <h3 className="panel-header-title">⭐ Starred Messages</h3>
                <span className="starred-count-badge">{starredMsgIds.size}</span>
              </div>
              <div className="panel-content">
                {chat.filter(m => starredMsgIds.has(m._id)).length === 0 ? (
                  <div className="starred-panel-empty">
                    <Star size={40} color="#8696a0" />
                    <p>No starred messages yet</p>
                  </div>
                ) : (
                  chat.filter(m => starredMsgIds.has(m._id)).map(m => (
                    <div
                      key={m._id}
                      className="starred-panel-item"
                      onClick={() => {
                        scrollToMessage(m._id);
                        setShowStarredPanel(false);
                      }}
                    >
                      <div className="starred-item-meta">
                        <span className="starred-item-sender">{m.sender}</span>
                        <span className="starred-item-time">{formatRelativeTime(m.time)}</span>
                      </div>
                      <div className="starred-item-preview">
                        {m.type === 'image' ? '📷 Photo' :
                         m.type === 'voice' ? '🎤 Voice' :
                         m.type === 'file' ? `📎 ${m.fileName}` :
                         m.text?.substring(0, 80)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned Messages Panel */}
      <AnimatePresence>
        {showPinnedPanel && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPinnedPanel(false)}
          >
            <motion.div
              className="starred-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => setShowPinnedPanel(false)} className="panel-back-btn">← Back</button>
                <h3 className="panel-header-title">📌 Pinned Messages</h3>
                <span className="starred-count-badge">{pinnedMessages.length}</span>
              </div>
              <div className="panel-content">
                {pinnedMessages.length === 0 ? (
                  <div className="starred-panel-empty">
                    <Pin size={40} color="#8696a0" />
                    <p>No pinned messages</p>
                  </div>
                ) : (
                  pinnedMessages.map(m => (
                    <div
                      key={m._id}
                      className="starred-panel-item"
                      onClick={() => {
                        scrollToMessage(m._id);
                        setShowPinnedPanel(false);
                      }}
                    >
                      <div className="starred-item-meta">
                        <span className="starred-item-sender">{m.sender}</span>
                        <span className="starred-item-time">{formatRelativeTime(m.time)}</span>
                      </div>
                      <div className="starred-item-preview">
                        {m.type === 'image' ? '📷 Photo' :
                         m.type === 'voice' ? '🎤 Voice' :
                         m.type === 'file' ? `📎 ${m.fileName}` :
                         m.text?.substring(0, 80)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Sidebar */}
      <AnimatePresence>
        {showRoomSidebar && (
          <motion.div 
            className="room-sidebar-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setShowRoomSidebar(false)}
          >
            <motion.div 
              className="room-sidebar"
              initial={{ x: -300 }} 
              animate={{ x: 0 }} 
              exit={{ x: -300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sidebar-header">
                <h3>Conversations</h3>
                <button onClick={() => setShowRoomSidebar(false)}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="sidebar-rooms">
                {/* Group Chat */}
                {groupRoomId && (
                  <div className="sidebar-section">
                    <div className="sidebar-section-title">Group Chat</div>
                    <button
                      className={`room-item ${(activeRoom || room) === groupRoomId ? 'active' : ''}`}
                      onClick={() => {
                        switchRoom(groupRoomId);
                        setShowRoomSidebar(false);
                      }}
                    >
                      <div className="room-icon">#</div>
                      <div className="room-details">
                        <div className="room-name">{groupRoomId}</div>
                        <div className="room-meta">{onlineUsers.length} online</div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Direct Messages */}
                <div className="sidebar-section">
                  <div className="sidebar-section-title">Direct Messages</div>
                  {rooms.filter(r => r.type === 'dm').length === 0 ? (
                    <div className="sidebar-empty">No DM conversations yet</div>
                  ) : (
                    rooms.filter(r => r.type === 'dm').map(r => (
                      <button
                        key={r.id}
                        className={`room-item ${activeRoom === r.id ? 'active' : ''}`}
                        onClick={() => {
                          switchRoom(r.id);
                          setShowRoomSidebar(false);
                        }}
                      >
                        <div className="room-icon">
                          <MessageSquare size={16} />
                        </div>
                        <div className="room-details">
                          <div className="room-name">{r.name}</div>
                          <div className="room-meta">
                            {onlineUsers.includes(r.name) ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Online Members */}
                <div className="sidebar-section">
                  <div className="sidebar-section-title">Online Members</div>
                  {onlineUsers.filter(u => u !== username).length === 0 ? (
                    <div className="sidebar-empty">No other members online</div>
                  ) : (
                    onlineUsers
                      .filter(u => u !== username)
                      .map(user => (
                        <div className="sidebar-user-row" key={`online-${user}`}>
                          <div className="sidebar-user-meta">
                            <span className="sidebar-user-dot"></span>
                            <span>{user}</span>
                          </div>
                          <button 
                            className="sidebar-dm-btn" 
                            onClick={() => {
                              createDM(user);
                              setShowRoomSidebar(false);
                            }}
                          >
                            DM
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panels */}
      <SettingsManager
        currentView={currentView}
        onClose={() => setCurrentView('chat')}
        callHistory={[]}
        formatDuration={(s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`}
        getQualityLabelStyle={() => ({ color: '#4CAF50' })}
      />

      {/* Stream Settings Modal */}
      <AnimatePresence>
        {currentView === 'stream-settings' && (
          <StreamSettings
            visibility={streamVisibility}
            source={streamSource}
            onVisibilityChange={setStreamVisibility}
            onSourceChange={setStreamSource}
            onStartStream={() => {
              startLivestream(streamVisibility, streamSource);
              setCurrentView('chat');
            }}
            onClose={() => setCurrentView('chat')}
          />
        )}
      </AnimatePresence>

      {/* Call Settings Modals */}
      <AnimatePresence>
        {currentView === 'call-settings' && (
          <CallSettings onClose={() => setCurrentView('chat')} />
        )}
        {currentView === 'audio-settings' && (
          <AudioSettings onClose={() => setCurrentView('chat')} />
        )}
        {currentView === 'video-settings' && (
          <VideoSettings onClose={() => setCurrentView('chat')} />
        )}
        {currentView === 'app-settings' && (
          <AppSettings onClose={() => setCurrentView('chat')} />
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  const [username, setUsername] = useState('');
  const socketRef = useRef(null);

  return (
    <CallProvider username={username} socketRef={socketRef}>
      <AppContent />
    </CallProvider>
  );
}

export default App;