// DevChat Pro - Complete Refactored App.js with all original functionality
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

// ==================== CONTEXT IMPORTS ====================
import { CallProvider, useCall } from './context/CallContext';
import { useSettings } from './context/settingsContext';

// ==================== COMPONENT IMPORTS ====================
import SettingsManager from './components/settings/SettingsManager';
import CallSettings from './components/settings/CallSettings';
import AudioSettings from './components/settings/AudioSettings';
import VideoSettings from './components/settings/VideoSettings';
import StreamSettings from './components/settings/StreamSettings';
import AppSettings from './components/settings/AppSettings';
import CallPanel from './components/calls/CallPanel';
import CallManager from './components/calls/CallManager';
import EnhancedCallControls from './components/calls/EnhancedCallControls';
import CallHistoryPanel from './components/CallHistoryPanel';

// ==================== STREAMING IMPORTS ====================
import LivestreamHost from './components/streaming/LivestreamHost';
import LivestreamView from './components/streaming/LivestreamView';

// ==================== UTILITY IMPORTS ====================
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

// ==================== WEBRTC UTILITIES ====================
import { 
  ICE_SERVERS,
  getAdaptiveMediaConstraints,
  getFallbackMediaConstraints,
  getAdaptiveIceTransportPolicy,
  optimizeRtpSenders,
  waitForIceGatheringComplete,
  CallStatistics,
  CallRecorder,
  VideoEffectsProcessor,
  CallHistory,
  AdaptiveQualityController,
  getScreenStream,
  switchToScreenShare,
  switchBackToCamera,
  getQualityIndicator
} from './components/calls/CallUtils';

// ==================== HOOK IMPORTS ====================
import { useEnhancedCall } from './hooks/useEnhancedcall';
import { useEnhancedStreaming } from './hooks/useEnhancedStreaming';

// ==================== THIRD PARTY ====================
import EmojiPicker from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

const LOCAL_PREVIEW_SIZES = [
  { width: 140, height: 105 },
  { width: 200, height: 150 },
  { width: 260, height: 195 }
];

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
  const [fontStyle, setFontStyle] = useState(localStorage.getItem('fontStyle') || 'default');
  const [showDoubleTick, setShowDoubleTick] = useState(localStorage.getItem('showDoubleTick') !== 'false');
  const [showBlueTick, setShowBlueTick] = useState(localStorage.getItem('showBlueTick') !== 'false');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 600);
  
  // ==================== MESSAGE STATES ====================
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [starredMsgIds, setStarredMsgIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('devChatStarred') || '[]')); }
    catch { return new Set(); }
  });
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  
  // ==================== UI STATES ====================
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showRoomSidebar, setShowRoomSidebar] = useState(false);
  const [showStarredPanel, setShowStarredPanel] = useState(false);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  
  // ==================== NAVIGATION ====================
  const [currentView, setCurrentView] = useState('chat');
  const [navigationStack, setNavigationStack] = useState([]);
  
  // ==================== NOTIFICATIONS ====================
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recentMentions, setRecentMentions] = useState(0);
  const [mentionedMessages, setMentionedMessages] = useState([]);
  
  // ==================== ROOM MANAGEMENT ====================
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [groupRoomId, setGroupRoomId] = useState('');
  const [newRoomIdInput, setNewRoomIdInput] = useState('');
  const [roomUserMap, setRoomUserMap] = useState({});
  const [activeRoomRegistry, setActiveRoomRegistry] = useState([]);
  const [globalPresenceUsers, setGlobalPresenceUsers] = useState([]);
  const [roomPolicies, setRoomPolicies] = useState({});
  const [roomInviteTarget, setRoomInviteTarget] = useState('');
  const [showRoomAdminTools, setShowRoomAdminTools] = useState(false);
  
  // ==================== USER MANAGEMENT ====================
  const [blockedUsers, setBlockedUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('devchatBlockedUsers') || '[]'); }
    catch { return []; }
  });
  const [reportedUsers, setReportedUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('devchatReportedUsers') || '[]'); }
    catch { return []; }
  });
  const [userProfiles, setUserProfiles] = useState({});
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [userStatus, setUserStatus] = useState({});
  const [userLastSeen, setUserLastSeen] = useState({});
  
  // ==================== DEVICE MANAGEMENT ====================
  const [videoInputDevices, setVideoInputDevices] = useState([]);
  const [selectedVideoInputId, setSelectedVideoInputId] = useState(() => 
    localStorage.getItem('devchatPreferredCameraId') || ''
  );
  const [audioOutputDevice, setAudioOutputDevice] = useState('default');
  
  // ==================== NOTIFICATION PREFERENCES ====================
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('devchatNotificationPrefs') || '{}');
      return {
        mutedRooms: Array.isArray(parsed.mutedRooms) ? parsed.mutedRooms : [],
        dmOnlyPriority: !!parsed.dmOnlyPriority,
        mentionOnly: !!parsed.mentionOnly,
        quietHoursEnabled: !!parsed.quietHoursEnabled,
        quietStart: parsed.quietStart || '22:00',
        quietEnd: parsed.quietEnd || '07:00'
      };
    } catch {
      return {
        mutedRooms: [],
        dmOnlyPriority: false,
        mentionOnly: false,
        quietHoursEnabled: false,
        quietStart: '22:00',
        quietEnd: '07:00'
      };
    }
  });

  // ==================== TYPING TIMEOUT ====================
  const [typingTimeoutByRoom, setTypingTimeoutByRoom] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('devchatTypingTimeoutByRoom') || '{}');
      return {
        defaultGroup: Number(parsed.defaultGroup) || 3000,
        defaultDm: Number(parsed.defaultDm) || 1800,
        ...parsed
      };
    } catch {
      return { defaultGroup: 3000, defaultDm: 1800 };
    }
  });

  // ==================== DRAFTS ====================
  const [roomDrafts, setRoomDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('devchatRoomDrafts') || '{}');
    } catch {
      return {};
    }
  });

  // ==================== SEARCH FILTERS ====================
  const [searchFilters, setSearchFilters] = useState({
    sender: '',
    fromDate: '',
    toDate: '',
    mediaType: 'all',
    mentionsOnly: false
  });
  const [dmSearchQuery, setDmSearchQuery] = useState('');

  // ==================== CONVERSATION STATS ====================
  const [conversationStats, setConversationStats] = useState({
    totalMessages: 0,
    totalUsers: 0,
    avgMessageLength: 0,
    mostActiveMember: null
  });

  // ==================== FILE UPLOAD STATES ====================
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // ==================== VOICE RECORDING STATES ====================
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [recordingLocked, setRecordingLocked] = useState(false);
  const [slideDistance, setSlideDistance] = useState(0);
  const [startX, setStartX] = useState(0);
  
  // ==================== MEDIA VIEWER STATES ====================
  const [imageViewer, setImageViewer] = useState(null);
  const [voicePlayer, setVoicePlayer] = useState(null);
  
  // ==================== CONTEXT MENU ====================
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuMessage, setContextMenuMessage] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  
  // ==================== CALL STATES ====================
  const [callState, setCallState] = useState(null);
  const [callType, setCallType] = useState(null);
  const [callPeer, setCallPeer] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callError, setCallError] = useState(null);
  const [callStats, setCallStats] = useState(null);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('excellent');
  const [callHistory, setCallHistory] = useState([]);
  
  // ==================== LIVESTREAM STATES ====================
  const [liveKitToken, setLiveKitToken] = useState(null);
  const [currentStreamRoom, setCurrentStreamRoom] = useState('');
  const [isStreamHost, setIsStreamHost] = useState(false);
  const [liveStreamInfo, setLiveStreamInfo] = useState(null);
  const [livestreamComments, setLivestreamComments] = useState([]);
  const [livestreamCommentInput, setLivestreamCommentInput] = useState('');
  const [livestreamViewerExpanded, setLivestreamViewerExpanded] = useState(false);
  const [streamVisibility, setStreamVisibility] = useState('public');
  const [streamSource, setStreamSource] = useState('camera');
  const [viewers, setViewers] = useState(0);
  const [streamStats, setStreamStats] = useState({
    bitrate: 0,
    fps: 0,
    resolution: '1280x720',
    packetLoss: 0
  });

  // ==================== SETTINGS STATES ====================
  const [showCallSettings, setShowCallSettings] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [showStreamQuality, setShowStreamQuality] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  
  // ==================== PWA ====================
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // ==================== QUICK REPLIES ====================
  const [quickReplyTemplates, setQuickReplyTemplates] = useState([
    'Got it! 👍',
    'Thanks for the info!',
    'Let me look into it 🔍',
    'I agree 💯',
    'Not sure, let me check 🤔',
    'ASAP! ⚡'
  ]);

  // ==================== THREADS ====================
  const [threadRootId, setThreadRootId] = useState(null);

  // ==================== REFS ====================
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
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const qualityControllerRef = useRef(null);
  const callRecorderRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const inboundRemoteStreamRef = useRef(null);
  const callStateRef = useRef(null);
  const callPeerRef = useRef(null);
  const liveStreamInfoRef = useRef(null);
  const livestreamHostPeersRef = useRef(new Map());
  const livestreamViewerPeerRef = useRef(null);
  const livestreamLocalStreamRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const reconnectCountdownRef = useRef(null);
  const reconnectRetryTimeoutRef = useRef(null);
  const remoteTrackTimeoutRef = useRef(null);
  const statsUpdateIntervalRef = useRef(null);
  const callStatsRef = useRef(null);
  const callHistoryRef = useRef(null);
  const localPreviewDragOffsetRef = useRef({ x: 0, y: 0 });
  const localPreviewMovedRef = useRef(false);
  const subscribedRoomsRef = useRef(new Set());
  const soundEnabledRef = useRef(true);
  const ringtoneRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const ringtoneAudioContextRef = useRef(null);

  // ==================== CUSTOM HOOKS ====================
  const enhancedCall = useEnhancedCall(socketRef.current, username);
  const enhancedStreaming = useEnhancedStreaming(socketRef.current, username, room);

  // ==================== REF UPDATES ====================
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callPeerRef.current = callPeer; }, [callPeer]);
  useEffect(() => { liveStreamInfoRef.current = liveStreamInfo; }, [liveStreamInfo]);

  // ==================== INITIAL SETUP ====================
  useEffect(() => {
    console.log(`%c🚀 DevChat Pro v${APP_VERSION}`, 'color: #00ff88; font-size: 16px;');
    console.log(`%cBuild Date: ${new Date(BUILD_DATE).toLocaleString()}`, 'color: #00ccff;');
    
    // Restore session
    const savedUsername = sessionStorage.getItem('chatUsername');
    const savedRoom = sessionStorage.getItem('chatRoom');
    if (savedUsername && savedRoom) {
      setUsername(savedUsername);
      setRoom(savedRoom);
    }

    // PWA install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsAppInstalled(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // ==================== THEME ====================
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontStyle);
    localStorage.setItem('fontStyle', fontStyle);
  }, [fontStyle]);

  // ==================== MOBILE DETECTION ====================
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ==================== TAB TITLE ====================
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) DevChat Pro` : 'DevChat Pro';
  }, [unreadCount]);

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
      setUserStatus(prev => ({ ...prev, [data.username]: data.status }));
      if (data.lastSeen) {
        setUserLastSeen(prev => ({ ...prev, [data.username]: data.lastSeen }));
      }
    });

    socket.on('global_users_updated', (data) => {
      setGlobalPresenceUsers(data.users || []);
    });

    socket.on(ROOM_EVENTS.REGISTRY_UPDATED, (data) => {
      setActiveRoomRegistry(data.rooms || []);
    });

    socket.on('room_policy_updated', ({ room: policyRoom, policy }) => {
      setRoomPolicies(prev => ({ ...prev, [policyRoom]: policy }));
    });

    socket.on('block_list_updated', ({ blocked }) => {
      setBlockedUsers(blocked);
    });

    socket.on('profile_updated', (data) => {
      setUserProfiles(prev => ({ ...prev, [data.username]: { avatar: data.avatar, bio: data.bio } }));
    });

    // Call signaling events
    socket.on(CALL_EVENTS.OFFER, (data) => {
      setIncomingCall(data);
    });

    socket.on(CALL_EVENTS.ANSWER, (data) => {
      // Handle in CallManager
    });

    socket.on(CALL_EVENTS.ICE_CANDIDATE, (data) => {
      // Handle in CallManager
    });

    socket.on(CALL_EVENTS.REJECTED, () => {
      endCall();
    });

    socket.on(CALL_EVENTS.ENDED, () => {
      endCall();
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
      setViewers(data.count || 0);
    });

    socket.on(LIVESTREAM_EVENTS.STOPPED, (data) => {
      if (liveStreamInfo?.sessionId === data.sessionId) {
        setLiveStreamInfo(null);
        setLivestreamComments([]);
      }
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

  // ==================== MENTION DETECTION ====================
  useEffect(() => {
    if (chat.length === 0) return;

    const mentions = chat.filter(msg => 
      msg.text?.includes(`@${username}`) || msg.text?.includes('@everyone')
    );
    setMentionedMessages(mentions);
    setRecentMentions(mentions.filter(m => m.sender !== username).length);

    // Update conversation stats
    const totalMessages = chat.length;
    const uniqueUsers = new Set(chat.map(m => m.sender)).size;
    const avgLength = totalMessages > 0 
      ? chat.reduce((sum, m) => sum + (m.text?.length || 0), 0) / totalMessages 
      : 0;
    
    setConversationStats({
      totalMessages,
      totalUsers: uniqueUsers,
      avgMessageLength: Math.round(avgLength),
      mostActiveMember: null
    });

    // Update user profiles
    const now = Date.now();
    setUserLastSeen(prev => {
      const updated = { ...prev };
      chat.forEach(msg => {
        if (msg.sender && !updated[msg.sender]) {
          updated[msg.sender] = now;
        }
      });
      return updated;
    });
  }, [chat, username]);

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
      setMessage(roomDrafts[room] || '');
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
    setRoomDrafts(prev => ({ ...prev, [roomRef.current]: '' }));
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
    setRoomDrafts(prev => ({ ...prev, [roomRef.current]: value }));

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
    const typingTimeoutMs = roomRef.current?.includes('_dm_') ? 1800 : 3000;
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { 
        room: roomRef.current, 
        username: usernameRef.current 
      });
      typingTimeoutRef.current = null;
    }, typingTimeoutMs);
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

  const handleLongPressStart = (e, message) => {
    const timer = setTimeout(() => handleContextMenu(e, message), 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // ==================== RENDER MESSAGE TEXT ====================
  const renderMessageText = (msg) => {
    if (!showMarkdown) return <p>{msg.text}</p>;
    
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({node, children, ...props}) {
            return <a {...props} target="_blank" rel="noopener noreferrer" className="message-link">{children}</a>;
          }
        }}
      >
        {msg.text}
      </ReactMarkdown>
    );
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
      setRecordingLocked(false);
      setSlideDistance(0);
    }
  };

  const lockRecording = () => {
    setRecordingLocked(true);
    setSlideDistance(0);
  };

  const handleRecordingSlide = (e) => {
    if (recordingLocked) return;
    
    const touch = e.touches ? e.touches[0] : e;
    const currentX = touch.clientX;
    const distance = startX - currentX;
    
    if (distance > 0) {
      setSlideDistance(Math.min(distance, 150));
      
      if (distance > 120) {
        cancelVoiceRecording();
      }
    }
  };

  const handleRecordingStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    setStartX(touch.clientX);
    startVoiceRecording();
  };

  const handleDesktopRecordingClick = (e) => {
    if (e.type === 'touchstart' || e.type === 'touchend') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
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

    // Handle non-image files directly
    const docFiles = files.filter(f => !f.type.startsWith('image/'));
    for (const docFile of docFiles) {
      await uploadFile(docFile, '');
    }
  };

  const uploadFile = async (file, caption = '') => {
    setUploadingFile(true);
    setUploadProgress('Uploading...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'devchat_uploads');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.secure_url) {
        const messageType = file.type.startsWith('image/') ? 'image' : 'file';
        
        socketRef.current.emit('send_message', {
          room: roomRef.current,
          sender: usernameRef.current,
          text: caption || file.name,
          type: messageType,
          fileUrl: data.secure_url,
          fileName: file.name,
          fileSize: file.size
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setErrorMessage('Upload failed');
    } finally {
      setUploadingFile(false);
      setUploadProgress('');
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

  const removeImage = (imageId) => {
    setSelectedImages(prev => {
      const filtered = prev.filter(img => img.id !== imageId);
      if (filtered.length === 0) {
        setShowImagePreview(false);
        return [];
      }
      if (currentImageIndex >= filtered.length) {
        setCurrentImageIndex(filtered.length - 1);
      }
      return filtered;
    });
  };

  // ==================== DOWNLOAD MEDIA ====================
  const downloadMedia = (url, fileName) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMessage('Download started');
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  // ==================== OPEN MEDIA VIEWERS ====================
  const openImageViewer = (imageData) => {
    setImageViewer(imageData);
  };

  const closeImageViewer = () => {
    setImageViewer(null);
  };

  const openVoicePlayer = (voiceData) => {
    setVoicePlayer(voiceData);
  };

  const closeVoicePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setVoicePlayer(null);
    setPlayingVoiceId(null);
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
    setRoom(dmRoom);
    socketRef.current.emit('join_room', { room: dmRoom, username, fetchHistory: true });
    setMessage(roomDrafts[dmRoom] || '');
    setShowRoomSidebar(false);
    setShowProfileModal(null);
  };

  const switchRoom = (roomId) => {
    const previousRoomId = roomRef.current;
    
    setActiveRoom(roomId);
    setRoom(roomId);
    
    socketRef.current.emit('join_room', { 
      room: roomId, 
      username, 
      fetchHistory: true 
    });
    
    if (previousRoomId && previousRoomId !== roomId) {
      socketRef.current.emit('join_room', {
        room: previousRoomId,
        username,
        fetchHistory: false,
        active: false
      });
    }
    
    const roomUsers = roomUserMap[roomId];
    setOnlineUsers(Array.isArray(roomUsers) ? roomUsers : []);
    setMessage(roomDrafts[roomId] || '');
    setShowRoomSidebar(false);
  };

  const joinGroupRoomFromPanel = () => {
    const nextRoomId = newRoomIdInput.trim();
    if (!nextRoomId) return;

    setRooms(prev => {
      if (prev.some(r => r.id === nextRoomId)) return prev;
      return [{ id: nextRoomId, name: nextRoomId, type: 'group' }, ...prev];
    });

    setGroupRoomId(nextRoomId);
    setNewRoomIdInput('');
    switchRoom(nextRoomId);
  };

  // ==================== BLOCK/REPORT USERS ====================
  const blockUserAction = (targetUser) => {
    if (!targetUser || targetUser === username) return;
    
    socketRef.current?.emit('block_user', { actor: username, target: targetUser }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setBlockedUsers(prev => prev.includes(targetUser) ? prev : [...prev, targetUser]);
      setSuccessMessage(`${targetUser} blocked`);
      setTimeout(() => setSuccessMessage(''), 2000);
    });
  };

  const unblockUserAction = (targetUser) => {
    if (!targetUser) return;
    
    socketRef.current?.emit('unblock_user', { actor: username, target: targetUser }, () => {
      setBlockedUsers(prev => prev.filter(u => u !== targetUser));
      setSuccessMessage(`${targetUser} unblocked`);
      setTimeout(() => setSuccessMessage(''), 2000);
    });
  };

  const reportUserAction = (targetUser) => {
    if (!targetUser || targetUser === username) return;
    
    socketRef.current?.emit('report_user', {
      actor: username,
      target: targetUser,
      room: roomRef.current,
      reason: 'manual_report'
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setReportedUsers(prev => prev.includes(targetUser) ? prev : [...prev, targetUser]);
      setSuccessMessage(`Reported ${targetUser}`);
      setTimeout(() => setSuccessMessage(''), 2000);
    });
  };

  // ==================== ROOM ADMIN FUNCTIONS ====================
  const toggleRoomMute = (roomId) => {
    setNotificationPrefs(prev => ({
      ...prev,
      mutedRooms: prev.mutedRooms.includes(roomId)
        ? prev.mutedRooms.filter(r => r !== roomId)
        : [...prev.mutedRooms, roomId]
    }));
  };

  const updateCurrentRoomPolicy = (nextPolicy) => {
    const activeRoomId = roomRef.current;
    if (!activeRoomId || activeRoomId.includes('_dm_')) return;
    
    socketRef.current?.emit('room_set_policy', {
      room: activeRoomId,
      actor: username,
      ...nextPolicy
    });
  };

  const inviteUserToCurrentRoom = () => {
    const target = roomInviteTarget.trim();
    if (!target || !roomRef.current || roomRef.current.includes('_dm_')) return;
    
    socketRef.current?.emit('room_invite_user', {
      room: roomRef.current,
      actor: username,
      target
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setSuccessMessage(`Invited ${target}`);
      setRoomInviteTarget('');
      setTimeout(() => setSuccessMessage(''), 2000);
    });
  };

  const removeUserFromCurrentRoom = (targetUser) => {
    if (!targetUser || !roomRef.current || roomRef.current.includes('_dm_')) return;
    
    socketRef.current?.emit('room_remove_user', {
      room: roomRef.current,
      actor: username,
      target: targetUser
    });
  };

  const promoteModInCurrentRoom = (targetUser) => {
    if (!targetUser || !roomRef.current || roomRef.current.includes('_dm_')) return;
    
    socketRef.current?.emit('room_grant_mod', {
      room: roomRef.current,
      actor: username,
      target: targetUser
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setSuccessMessage(`${targetUser} is now a moderator`);
      setTimeout(() => setSuccessMessage(''), 2000);
    });
  };

  // ==================== MARK AS READ ====================
  const markCurrentRoomAsRead = () => {
    const unreadIds = chat.filter(m => m.sender !== username && !m.readBy?.includes(username))
      .map(m => m._id);
    
    if (unreadIds.length > 0 && socketRef.current) {
      socketRef.current.emit('mark_read', { 
        messageIds: unreadIds, 
        username, 
        room: roomRef.current 
      });
    }
    setUnreadCount(0);
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

  // ==================== PWA INSTALL ====================
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ App installed');
      setIsAppInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
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
        setSuccessMessage(asHost ? "🔴 Stream Started!" : "✅ Joined Stream");
        setTimeout(() => setSuccessMessage(''), 2000);
      }
    } catch (error) {
      console.error('Stream connection failed:', error);
      setErrorMessage('Failed to connect to stream');
    }
  };

  const handleLeaveStream = () => {
    setLiveKitToken(null);
    setCurrentStreamRoom('');
    setIsStreamHost(false);
    setSuccessMessage('Stream Ended');
    setTimeout(() => setSuccessMessage(''), 2000);
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
        setSuccessMessage(`🔴 Livestream started (${visibility})`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    });
  };

  const stopHostedLivestream = (notifyServer = true) => {
    if (!liveStreamInfo?.isHost) return;

    if (notifyServer && socketRef.current) {
      socketRef.current.emit(LIVESTREAM_EVENTS.STOP, {
        sessionId: liveStreamInfo.sessionId,
        host: username
      });
    }

    setLiveStreamInfo(null);
    setLivestreamComments([]);
    setSuccessMessage('Livestream stopped');
    setTimeout(() => setSuccessMessage(''), 2000);
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

  const requestJoinLivestreamFromNotification = (notification) => {
    if (!notification?.sessionId || !socketRef.current) return;

    socketRef.current.emit(LIVESTREAM_EVENTS.JOIN_REQUEST, {
      sessionId: notification.sessionId,
      from: username
    });

    setSuccessMessage(`🔄 Joining ${notification.sender}'s livestream...`);
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  // ==================== CALL FUNCTIONS ====================
  const startCall = async (type, targetUser) => {
    try {
      setCallType(type);
      setCallPeer(targetUser);
      setCallState('calling');
      setCallError(null);

      const constraints = getAdaptiveMediaConstraints({
        callType: type,
        userAgent: navigator.userAgent
      });

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit(CALL_EVENTS.ICE_CANDIDATE, {
            to: targetUser,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = remoteStreamRef.current || new MediaStream();
        if (event.track) {
          stream.addTrack(event.track);
        }
        setRemoteStream(stream);
        remoteStreamRef.current = stream;
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('active');
          startCallTimer();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      socketRef.current.emit(CALL_EVENTS.OFFER, {
        to: targetUser,
        from: username,
        callType: type,
        offer: pc.localDescription
      });

      callTimeoutRef.current = setTimeout(() => {
        if (callState === 'calling') {
          setCallError('No answer');
          endCall();
        }
      }, 30000);

    } catch (err) {
      console.error('Failed to start call:', err);
      setCallError(err.message);
      setCallState('idle');
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      setCallType(incomingCall.callType);
      setCallPeer(incomingCall.from);
      setCallState('active');
      setIncomingCall(null);
      stopRingtone();

      const constraints = getAdaptiveMediaConstraints({
        callType: incomingCall.callType,
        userAgent: navigator.userAgent
      });

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      if (localVideoRef.current && incomingCall.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit(CALL_EVENTS.ICE_CANDIDATE, {
            to: incomingCall.from,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = remoteStreamRef.current || new MediaStream();
        if (event.track) {
          stream.addTrack(event.track);
        }
        setRemoteStream(stream);
        remoteStreamRef.current = stream;
      };

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      pendingIceCandidatesRef.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      pendingIceCandidatesRef.current = [];

      socketRef.current.emit(CALL_EVENTS.ANSWER, {
        to: incomingCall.from,
        from: username,
        answer: pc.localDescription
      });

      startCallTimer();

    } catch (err) {
      console.error('Failed to answer call:', err);
      setCallError(err.message);
      endCall();
    }
  };

  const endCall = (notifyPeer = true) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (notifyPeer && socketRef.current && callPeer) {
      socketRef.current.emit(CALL_EVENTS.END, {
        to: callPeer,
        from: username
      });
    }

    stopCallTimer();
    stopRingtone();
    pendingIceCandidatesRef.current = [];

    setCallState('idle');
    setCallType(null);
    setCallPeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);
    setCallDuration(0);
    setCallError(null);
  };

  const startCallTimer = () => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (isScreenSharing) {
        await switchBackToCamera(peerConnectionRef.current, localStream);
        setIsScreenSharing(false);
        
        if (socketRef.current && callPeer) {
          socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_END, {
            to: callPeer,
            from: username
          });
        }
      } else {
        const screenStream = await getScreenStream();
        await switchToScreenShare(peerConnectionRef.current, screenStream, localStream);
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        if (socketRef.current && callPeer) {
          socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_START, {
            to: callPeer,
            from: username
          });
        }

        screenStream.getVideoTracks()[0].onended = () => {
          switchBackToCamera(peerConnectionRef.current, localStream);
          setIsScreenSharing(false);
          
          if (socketRef.current && callPeer) {
            socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_END, {
              to: callPeer,
              from: username
            });
          }
        };
      }
    } catch (err) {
      console.error('Screen share error:', err);
      setCallError('Screen share failed');
    }
  };

  const rejectCall = () => {
    if (!incomingCall || !socketRef.current) return;

    socketRef.current.emit(CALL_EVENTS.REJECT, {
      to: incomingCall.from,
      from: username
    });

    stopRingtone();
    setIncomingCall(null);
  };

  const toggleCallMinimize = () => {
    setIsCallMinimized(!isCallMinimized);
  };

  const playRingtone = () => {
    if (!soundEnabled) return;

    stopRingtone();

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    ringtoneAudioContextRef.current = context;

    const playTone = () => {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      
      osc.connect(gain);
      gain.connect(context.destination);
      
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    };

    playTone();
    ringtoneIntervalRef.current = setInterval(playTone, 2000);
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (ringtoneAudioContextRef.current) {
      ringtoneAudioContextRef.current.close();
      ringtoneAudioContextRef.current = null;
    }
  };

  // ==================== DEVICE MANAGEMENT ====================
  const refreshVideoInputs = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`
        }));
      setVideoInputDevices(cameras);
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
    }
  };

  useEffect(() => {
    refreshVideoInputs();
    navigator.mediaDevices?.addEventListener('devicechange', refreshVideoInputs);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshVideoInputs);
  }, []);

  // ==================== ESC KEY HANDLER ====================
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      
      if (showEmojiPicker) setShowEmojiPicker(false);
      else if (showMenuDropdown) setShowMenuDropdown(false);
      else if (showStarredPanel) setShowStarredPanel(false);
      else if (showPinnedPanel) setShowPinnedPanel(false);
      else if (showClearConfirm) setShowClearConfirm(false);
      else if (showLogoutConfirm) setShowLogoutConfirm(false);
      else if (editingMsgId) setEditingMsgId(null);
      else if (showDeleteConfirm) setShowDeleteConfirm(false);
      else if (replyingTo) setReplyingTo(null);
      else if (contextMenu) { setContextMenu(null); setContextMenuMessage(null); }
      else if (imageViewer) setImageViewer(null);
      else if (voicePlayer) { setVoicePlayer(null); setPlayingVoiceId(null); if (audioRef.current) audioRef.current.pause(); }
      else if (isRecording) cancelVoiceRecording();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showEmojiPicker, showMenuDropdown, showStarredPanel, showPinnedPanel, showClearConfirm, 
      showLogoutConfirm, editingMsgId, showDeleteConfirm, replyingTo, contextMenu, imageViewer, 
      voicePlayer, isRecording]);

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

  const isSelectedUserOnline = useMemo(() => {
    if (!selectedUser) return false;
    return onlineUsers.includes(selectedUser);
  }, [selectedUser, onlineUsers]);

  const currentRoomInfo = useMemo(() => {
    return rooms.find(r => r.id === (activeRoom || room)) || null;
  }, [rooms, activeRoom, room]);

  const isGroupRoomActive = useMemo(() => {
    return !(activeRoom || room).includes('_dm_');
  }, [activeRoom, room]);

  const globalOnlineUsers = useMemo(() => {
    return [...new Set([...onlineUsers, ...Object.keys(userStatus).filter(u => userStatus[u] === 'online')])];
  }, [onlineUsers, userStatus]);

  const groupRoomSummaries = useMemo(() => {
    return rooms.filter(r => r.type !== 'dm').map(r => ({
      ...r,
      isActive: roomUserMap[r.id]?.length > 0
    }));
  }, [rooms, roomUserMap]);

  const activeGroupRoomCount = useMemo(() => {
    return groupRoomSummaries.filter(r => r.isActive).length;
  }, [groupRoomSummaries]);

  const availableSenders = useMemo(() => {
    return [...new Set(chat.map(m => m.sender).filter(Boolean))].sort();
  }, [chat]);

  const searchResultCount = useMemo(() => {
    return filteredChat.length;
  }, [filteredChat]);

  // ==================== TOAST MESSAGES ====================
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div 
            className="install-banner"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
          >
            <div className="install-content">
              <Zap size={20} color="#00a884" fill="#00a884" />
              <span>Install DevChat Pro for the best experience!</span>
            </div>
            <div className="install-actions">
              <button className="install-btn" onClick={handleInstallClick}>
                Install
              </button>
              <button className="dismiss-btn" onClick={() => setShowInstallPrompt(false)}>
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header */}
      <div className="chat-header">
        <div className="menu-container" ref={menuContainerRef}>
          <button 
            className="menu-toggle"
            onClick={() => setShowMenuDropdown(!showMenuDropdown)}
            title="Menu"
          >
            <Menu size={24}/>
          </button>
          
          <AnimatePresence>
            {showMenuDropdown && (
              <>
                <motion.div 
                  className="menu-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMenuDropdown(false)}
                />
                <motion.div 
                  className={`menu-dropdown ${selectedUser ? 'menu-dropdown-dm' : ''}`}
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                >
                  <div className="menu-header">Main Menu</div>
                  
                  {/* Chat Actions */}
                  <button className="menu-item" onClick={() => { exportChat(); setShowMenuDropdown(false); }}>
                    <FileDown size={18}/><span>Export Chat</span>
                  </button>
                  <button className="menu-item" onClick={() => { setShowStarredPanel(true); setShowMenuDropdown(false); }}>
                    <Star size={18}/><span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span>
                  </button>

                  {/* Call Settings */}
                  <div className="menu-section">
                    <div className="menu-header">📞 Call Settings</div>
                    <button className="menu-item" onClick={() => { setShowCallSettings(true); setShowMenuDropdown(false); }}>
                      <Phone size={18}/><span>Call Preferences</span>
                    </button>
                    <button className="menu-item" onClick={() => { setShowAudioSettings(true); setShowMenuDropdown(false); }}>
                      <Volume2 size={18}/><span>Audio Devices</span>
                    </button>
                    <button className="menu-item" onClick={() => { setShowVideoSettings(true); setShowMenuDropdown(false); }}>
                      <Camera size={18}/><span>Video & Camera</span>
                    </button>
                    <button className="menu-item" onClick={() => { setShowCallHistory(true); setShowMenuDropdown(false); }}>
                      <Activity size={18}/><span>Call History</span>
                    </button>
                  </div>

                  {/* Streaming Settings */}
                  <div className="menu-section">
                    <div className="menu-header">🎥 Streaming</div>
                    <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, true); setShowMenuDropdown(false); }}>
                      <Radio size={18}/><span>Start Stream</span>
                    </button>
                    <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, false); setShowMenuDropdown(false); }}>
                      <PlayCircle size={18}/><span>Join Stream</span>
                    </button>
                    <button className="menu-item" onClick={() => { setShowStreamSettings(true); setShowMenuDropdown(false); }}>
                      <Settings size={18}/><span>Stream Settings</span>
                    </button>
                  </div>

                  {/* General */}
                  <div className="menu-section">
                    <div className="menu-header">⚙️ General</div>
                    <button className="menu-item" onClick={() => { setShowRoomSidebar(true); setShowMenuDropdown(false); }}>
                      <Users size={18}/><span>Conversations</span>
                      {globalOnlineUsers?.filter(u => u !== username).length > 0 && (
                        <span className="menu-badge">{globalOnlineUsers.filter(u => u !== username).length}</span>
                      )}
                    </button>
                    <button className="menu-item" onClick={() => { setCurrentView('rooms'); setShowMenuDropdown(false); }}>
                      <Hash size={18}/><span>Rooms</span>
                      {activeGroupRoomCount > 0 && <span className="menu-badge">{activeGroupRoomCount}</span>}
                    </button>
                    <button className="menu-item" onClick={() => { setCurrentView('notifications'); setShowMenuDropdown(false); }}>
                      <Bell size={18}/><span>Notifications</span>
                      {notificationItems.length > 0 && <span className="menu-badge">{notificationItems.length}</span>}
                    </button>
                    <button className="menu-item" onClick={() => { setShowAppSettings(true); setShowMenuDropdown(false); }}>
                      <Settings size={18}/><span>App Settings</span>
                    </button>
                    <button className="menu-item" onClick={() => setShowQuickReplies(!showQuickReplies)}>
                      <MessageSquare size={18}/><span>Quick Replies</span>
                    </button>
                  </div>

                  {/* Info */}
                  <div className="menu-section">
                    <div className="menu-header">📊 Info</div>
                    <div className="menu-item menu-info">
                      <Activity size={18}/>
                      <div className="menu-info-content">
                        <span>Stats: {conversationStats.totalMessages} msgs</span>
                        <small>{conversationStats.totalUsers} users • {conversationStats.avgMessageLength} avg chars</small>
                      </div>
                    </div>
                    {recentMentions > 0 && (
                      <button className="menu-item" onClick={() => { 
                        const firstMention = mentionedMessages[0];
                        if (firstMention && msgRefsMap.current[firstMention._id]) {
                          msgRefsMap.current[firstMention._id].scrollIntoView({ behavior: 'smooth' });
                        }
                        setShowMenuDropdown(false); 
                      }}>
                        <AtSign size={18}/>
                        <span>Mentions</span>
                        <span className="menu-badge">{recentMentions}</span>
                      </button>
                    )}
                  </div>

                  {/* PWA Install */}
                  <div className="menu-section">
                    <button 
                      className="menu-item"
                      onClick={() => { if (deferredPrompt) { handleInstallClick(); setShowMenuDropdown(false); } }}
                      disabled={!deferredPrompt}
                      style={{ opacity: deferredPrompt ? 1 : 0.6 }}
                    >
                      <Smartphone size={18}/>
                      <span>{isAppInstalled ? '✓ App Installed' : deferredPrompt ? 'Install as App' : 'Install (Desktop Only)'}</span>
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="menu-section">
                    <button className="menu-item menu-item-danger" onClick={() => setShowLogoutConfirm(true)}>
                      <LogOut size={18}/>
                      <span>Logout</span>
                    </button>
                  </div>

                  <div className="menu-footer">
                    <div>Session ends when browser closes</div>
                    <div className="menu-version">v{APP_VERSION} • {new Date(BUILD_DATE).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        
        {currentRoomInfo?.type === 'dm' && groupRoomId && (
          <button
            className="dm-back-btn"
            onClick={() => switchRoom(groupRoomId)}
            title="Back to group chat"
          >
            <ChevronLeft size={16} />
            <span>Group</span>
          </button>
        )}

        <div className="meta">
          <h3>{currentRoomInfo?.name || room} <span style={{ fontSize: '11px', opacity: 0.4 }}>v{APP_VERSION}</span></h3>
          <div className="room-info">
            <span className={connected ? "status-on" : "status-off"}>
              {connected ? <Wifi size={12}/> : <WifiOff size={12}/>} {connected ? "Online" : "Disconnected"}
            </span>
            <span className="meta-divider">·</span>
            <span className="message-count">{chat.length} messages</span>
            {chat.length > 0 && (
              <>
                <span className="meta-divider">·</span>
                <span className="last-activity">Last: {formatRelativeTime(chat[chat.length - 1]?.time)}</span>
              </>
            )}
          </div>
        </div>

        {/* Call Buttons */}
        {selectedUser && isSelectedUserOnline && callState !== 'active' && (
          <div className="call-buttons">
            <button 
              className="call-btn voice-call-btn"
              onClick={() => startCall('voice', selectedUser)}
              disabled={callState === 'calling' || callState === 'ringing'}
            >
              <Phone size={18}/>
            </button>
            <button 
              className="call-btn video-call-btn"
              onClick={() => startCall('video', selectedUser)}
              disabled={callState === 'calling' || callState === 'ringing'}
            >
              <Video size={18}/>
            </button>
          </div>
        )}
        
        <div className="users-info" title={`${onlineUsers.length} online`}>
          <Users size={16}/>
          <span className="users-count">{onlineUsers.length}</span>
        </div>
        <button 
          className="theme-toggle"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
        </button>
        <button 
          className={`sound-toggle ${soundEnabled ? 'enabled' : 'disabled'}`}
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Mute" : "Unmute"}
        >
          {soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
        </button>
        <button className="clear-btn" onClick={() => setShowClearConfirm(true)} title="Clear all"><Trash2 size={18}/></button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={18}/>
        <input 
          type="text" 
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <span className={`search-result-count ${searchResultCount === 0 ? 'zero' : ''}`}>
            {searchResultCount} result{searchResultCount !== 1 ? 's' : ''}
          </span>
        )}
        <button 
          className="markdown-toggle"
          onClick={() => setShowMarkdown(!showMarkdown)}
          title={showMarkdown ? "Disable markdown" : "Enable markdown"}
        >
          {showMarkdown ? <Eye size={18}/> : <EyeOff size={18}/>}
        </button>
        <button
          className="markdown-toggle"
          onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          title="Advanced search"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Advanced Search */}
      {showAdvancedSearch && (activeRoom || '').includes('_dm_') && (
        <div className="search-bar" style={{ marginTop: 6 }}>
          <MessageSquare size={16} />
          <input
            type="text"
            placeholder="Search this DM..."
            value={dmSearchQuery}
            onChange={(e) => setDmSearchQuery(e.target.value)}
            className="search-input"
          />
          {dmSearchQuery && (
            <button className="markdown-toggle" onClick={() => setDmSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {showAdvancedSearch && (
        <div className="search-bar" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            className="search-input"
            style={{ maxWidth: 160 }}
            value={searchFilters.sender}
            onChange={(e) => setSearchFilters(prev => ({ ...prev, sender: e.target.value }))}
          >
            <option value="">All senders</option>
            {availableSenders.map(sender => (
              <option key={sender} value={sender}>{sender}</option>
            ))}
          </select>

          <select
            className="search-input"
            style={{ maxWidth: 140 }}
            value={searchFilters.mediaType}
            onChange={(e) => setSearchFilters(prev => ({ ...prev, mediaType: e.target.value }))}
          >
            <option value="all">All types</option>
            <option value="text">Text</option>
            <option value="image">Images</option>
            <option value="voice">Voice</option>
            <option value="file">Files</option>
          </select>

          <input
            type="date"
            className="search-input"
            style={{ maxWidth: 150 }}
            value={searchFilters.fromDate}
            onChange={(e) => setSearchFilters(prev => ({ ...prev, fromDate: e.target.value }))}
          />
          <input
            type="date"
            className="search-input"
            style={{ maxWidth: 150 }}
            value={searchFilters.toDate}
            onChange={(e) => setSearchFilters(prev => ({ ...prev, toDate: e.target.value }))}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt-muted)', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={searchFilters.mentionsOnly}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, mentionsOnly: e.target.checked }))}
            />
            Mentions only
          </label>
        </div>
      )}

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="pinned-messages-bar" onClick={() => setShowPinnedPanel(true)} style={{cursor:'pointer'}}>
          <Pin size={14} />
          <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
          <ChevronDown size={14} style={{marginLeft:'auto', transform: showPinnedPanel ? 'rotate(180deg)' : 'none'}} />
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
            const reactions = msg.reactions || {};
            const grouped = index > 0 && isGroupedMessage(msg, filteredChat[index - 1]);
            const showDateSep = index === 0 || needsDateSeparator(msg.time, filteredChat[index - 1]?.time);
            const isGroupedBelow = index < filteredChat.length - 1 && isGroupedMessage(filteredChat[index + 1], msg);
            const clusterPos = !grouped && isGroupedBelow ? 'cluster-top'
              : grouped && isGroupedBelow ? 'cluster-mid'
              : grouped && !isGroupedBelow ? 'cluster-bottom' : '';

            return (
              <React.Fragment key={msg._id || index}>
                {showDateSep && (
                  <div className="date-separator">
                    <span className="date-separator-text">{formatDateSeparator(msg.time)}</span>
                  </div>
                )}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  id={`msg-${msg._id}`}
                  ref={el => { if (el && msg._id) msgRefsMap.current[msg._id] = el; }}
                  className={`msg-bubble ${isOwn ? "me" : "other"} ${msg.isPinned ? "pinned" : ""} ${grouped ? "grouped" : ""} ${clusterPos}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                  onTouchStart={(e) => handleLongPressStart(e, msg)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                >
                  {msg.isPinned && <Pin size={12} className="pin-icon" />}
                  {starredMsgIds.has(msg._id) && (
                    <span className="msg-star-badge"><Star size={10} fill="#FFD700" color="#FFD700"/></span>
                  )}
                  {!isOwn && <span className="sender-tag">{msg.sender}</span>}
                  
                  {/* Reply Preview */}
                  {msg.replyTo && (() => {
                    const repliedMsg = chat.find(c => c._id === msg.replyTo);
                    return repliedMsg ? (
                      <div className="reply-preview" onClick={() => scrollToMessage(msg.replyTo)}>
                        <Reply size={12} />
                        <div className="reply-preview-content">
                          <span className="reply-preview-sender">{repliedMsg.sender}</span>
                          <span className="reply-preview-text">
                            {repliedMsg.type === 'image' ? '📷 Photo' :
                             repliedMsg.type === 'voice' ? '🎤 Voice' :
                             repliedMsg.type === 'file' ? `📎 ${repliedMsg.fileName}` :
                             (repliedMsg.text || '').substring(0, 60)}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* Message Content */}
                  {msg.type === 'image' ? (
                    <div className="image-message-wrapper">
                      {msg.fileUrl ? (
                        <>
                          <div 
                            className="image-container" 
                            onClick={() => openImageViewer({
                              url: msg.fileUrl,
                              fileName: `image-${new Date(msg.time).getTime()}.jpg`,
                              sender: msg.sender,
                              time: msg.time
                            })}
                          >
                            <img src={msg.fileUrl} className="chat-img" alt="shared" />
                            <div className="image-overlay">
                              <Eye size={20} />
                              <span>Click to View</span>
                            </div>
                          </div>
                          <button 
                            className="media-download-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadMedia(msg.fileUrl, `image-${new Date(msg.time).getTime()}.jpg`);
                            }}
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </button>
                        </>
                      ) : (
                        <div className="media-error">
                          <ImageIcon size={24} />
                          <span>📷 Image not available</span>
                        </div>
                      )}
                    </div>
                  ) : msg.type === 'file' ? (
                    <a href={msg.fileUrl} download={msg.fileName} className="file-card">
                      <div className="file-card-icon"><FileText size={20}/></div>
                      <div className="file-card-info">
                        <span className="file-card-name">{msg.fileName || 'File'}</span>
                        <span className="file-card-size">{msg.fileSize ? formatFileSize(msg.fileSize) : 'Download'}</span>
                      </div>
                      <Download size={16} />
                    </a>
                  ) : msg.type === 'voice' ? (
                    <div className="voice-message-wrapper">
                      {msg.fileUrl ? (
                        <>
                          <div 
                            className="voice-message" 
                            onClick={() => openVoicePlayer({
                              url: msg.fileUrl,
                              fileName: `voice-${new Date(msg.time).getTime()}.webm`,
                              sender: msg.sender,
                              time: msg.time,
                              duration: msg.duration || 0
                            })}
                          >
                            <button 
                              className="voice-play-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                playVoiceMessage(msg.fileUrl, msg._id);
                              }}
                            >
                              {playingVoiceId === msg._id ? <Pause size={16}/> : <Play size={16}/>}
                            </button>
                            <div className="voice-waveform">
                              <span className="voice-duration">{msg.duration || 0}s</span>
                            </div>
                            <Eye size={16} className="voice-view-icon" />
                          </div>
                          <button 
                            className="media-download-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadMedia(msg.fileUrl, `voice-${new Date(msg.time).getTime()}.webm`);
                            }}
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </button>
                        </>
                      ) : (
                        <div className="media-error">🎤 Voice message not available</div>
                      )}
                    </div>
                  ) : (
                    renderMessageText(msg)
                  )}
                  
                  {msg.edited && <span className="msg-edited">(edited)</span>}
                  
                  {/* Reactions */}
                  {Object.keys(reactions).length > 0 && (
                    <div className="message-reactions">
                      {Object.entries(reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          className={`reaction-item ${users.includes(username) ? 'reacted' : ''}`}
                          onClick={() => handleReaction(msg._id, emoji)}
                        >
                          {emoji} {users.length}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Message Footer */}
                  <div className="msg-footer">
                    <span className="timestamp" title={new Date(msg.time).toLocaleString()}>
                      {formatRelativeTime(msg.time)}
                    </span>

                    {/* Read Receipts */}
                    {isOwn && showDoubleTick && (() => {
                      const readers = Array.isArray(msg.readBy) ? msg.readBy : [];
                      const seenByOthers = readers.some(r => r !== username);
                      return (
                        <span className={`message-ticks ${(seenByOthers && showBlueTick) ? 'blue' : ''}`}>
                          ✓✓
                        </span>
                      );
                    })()}
                  </div>
                </motion.div>
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
          onClick={() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); setUnreadCount(0); }}
        >
          <ChevronDown size={16}/> {unreadCount} new
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
      <div className="chat-footer">
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
        
        <button
          className="whatsapp-action-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!connected || uploadingFile}
          title="Attach images"
        >
          <ImageIcon size={22} />
        </button>
        
        <button
          className="whatsapp-action-btn"
          onClick={() => cameraInputRef.current?.click()}
          disabled={!connected || uploadingFile}
          title="Take photo"
        >
          <Camera size={22}/>
        </button>
        
        <div className="whatsapp-input-wrapper">
          <button
            className="emoji-btn-inline"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={!connected}
            title="Emoji"
          >
            <Smile size={22} />
          </button>
          
          <textarea 
            ref={textareaRef}
            className="whatsapp-input"
            disabled={!connected}
            value={message} 
            placeholder={connected ? "Type a message..." : "Connecting..."} 
            onChange={handleMessageChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
          />
          {message.length > 100 && (
            <span className={`char-counter ${message.length > 450 ? 'warn' : ''}`}>{message.length}</span>
          )}
        </div>
        
        {message.trim() ? (
          <button 
            className="whatsapp-send" 
            onClick={sendMessage} 
            disabled={!connected}
            title="Send"
          >
            <Send size={20}/>
          </button>
        ) : (
          <button
            className={`whatsapp-action-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleDesktopRecordingClick}
            onTouchStart={handleRecordingStart}
            onTouchMove={handleRecordingSlide}
            onTouchEnd={recordingLocked ? undefined : stopVoiceRecording}
            disabled={!connected}
            title={isRecording ? `Recording: ${recordingTime}s` : 'Record voice'}
          >
            {isRecording ? <><span className="rec-dot"></span><span className="rec-time">{recordingTime}s</span></> : <Mic size={22}/>}
          </button>
        )}
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker onEmojiClick={handleEmojiClick} theme={theme} />
        </div>
      )}

      {/* Voice Recording Overlay */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            className="voice-recording-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <div className="recording-container">
              {recordingLocked ? (
                <div className="recording-locked">
                  <Lock size={24} />
                  <span className="recording-time">{recordingTime}s</span>
                  <button className="cancel-recording-btn" onClick={cancelVoiceRecording}>
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div className="recording-slide">
                  <div className="slide-indicator" style={{ transform: `translateX(-${slideDistance}px)` }}>
                    <ChevronLeft size={20} />
                    <span>Slide to cancel</span>
                  </div>
                  <span className="recording-time">{recordingTime}s</span>
                  <div className="lock-indicator" onTouchStart={lockRecording}>
                    <ChevronUp size={16} />
                    <Lock size={16} />
                  </div>
                </div>
              )}
              
              <div className="waveform-container">
                {[...Array(40)].map((_, i) => (
                  <div key={i} className="waveform-bar" style={{ height: `${Math.random() * 60 + 20}%` }} />
                ))}
              </div>
              
              <button type="button" className="stop-send-btn" onClick={stopVoiceRecording}>
                <Send size={20} />
                <span>Stop & Send</span>
              </button>
            </div>
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
                <span className="image-counter">{currentImageIndex + 1} / {selectedImages.length}</span>
              )}
            </div>
            
            <div className="preview-image-container">
              <img src={selectedImages[currentImageIndex].preview} alt="Preview" />
              
              {selectedImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button className="preview-nav-btn prev" onClick={() => setCurrentImageIndex(i => i - 1)}>
                      <ChevronLeft size={32} />
                    </button>
                  )}
                  {currentImageIndex < selectedImages.length - 1 && (
                    <button className="preview-nav-btn next" onClick={() => setCurrentImageIndex(i => i + 1)}>
                      <ChevronRight size={32} />
                    </button>
                  )}
                </>
              )}
            </div>
            
            {selectedImages.length > 1 && (
              <div className="preview-thumbnails">
                {selectedImages.map((img, index) => (
                  <div 
                    key={img.id}
                    className={`preview-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img src={img.preview} alt={`Thumb ${index + 1}`} />
                    <button className="thumbnail-remove-btn" onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="preview-footer">
              <input
                type="text"
                className="caption-input"
                placeholder={selectedImages.length > 1 ? "Add a caption (first image)..." : "Add a caption..."}
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
              />
              <button className="preview-send-btn" onClick={uploadMultipleImages} disabled={uploadingFile}>
                {uploadingFile ? <div className="spinner-small"></div> : <Send size={24} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingMsgId && (
          <motion.div 
            className="edit-modal-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setEditingMsgId(null)}
          >
            <motion.div 
              className="edit-modal"
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="edit-modal-header">
                <h3>Edit Message</h3>
                <button className="modal-close-btn" onClick={() => setEditingMsgId(null)}>
                  <X size={20}/>
                </button>
              </div>
              <textarea 
                className="edit-textarea"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                autoFocus
                rows={4}
              />
              <div className="edit-modal-footer">
                <button className="btn-cancel" onClick={() => setEditingMsgId(null)}>Cancel</button>
                <button className="btn-save" onClick={saveEditMessage} disabled={!editingText.trim()}>Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            className="delete-modal-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div 
              className="delete-modal"
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="delete-modal-icon">
                <AlertCircle size={48} color="#f44336" />
              </div>
              <h3>Delete Message?</h3>
              <p>This action cannot be undone.</p>
              <div className="delete-modal-footer">
                <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="btn-delete" onClick={confirmDelete}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div 
            className="profile-modal-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setShowProfileModal(null)}
          >
            <motion.div 
              className="profile-modal"
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-header">
                <div className="profile-avatar-large" style={getAvatarStyle(showProfileModal)}>
                  {getInitials(showProfileModal)}
                </div>
                <h2>{showProfileModal}</h2>
                <span className={`profile-status status-${userStatus[showProfileModal] || 'online'}`}>
                  {userStatus[showProfileModal] || 'online'}
                </span>
              </div>
              <div className="profile-body">
                {userProfiles[showProfileModal]?.bio && (
                  <div className="profile-bio">
                    <strong>Bio</strong>
                    <p>{userProfiles[showProfileModal].bio}</p>
                  </div>
                )}
                <div className="profile-actions">
                  <button className="btn-dm" onClick={() => createDM(showProfileModal)}>
                    <AtSign size={16} /> Message
                  </button>
                  <button className="btn-mention" onClick={() => {
                    setMessage(prev => prev + `@${showProfileModal} `);
                    setShowProfileModal(null);
                  }}>
                    Mention
                  </button>
                  {blockedUsers.includes(showProfileModal) ? (
                    <button className="btn-mention" onClick={() => unblockUserAction(showProfileModal)}>
                      Unblock
                    </button>
                  ) : (
                    <button className="btn-mention" onClick={() => blockUserAction(showProfileModal)}>
                      Block
                    </button>
                  )}
                  <button className="btn-mention" onClick={() => reportUserAction(showProfileModal)}>
                    Report
                  </button>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowProfileModal(null)}>
                <X size={20} />
              </button>
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
                {groupRoomId && (
                  <div className="sidebar-section">
                    <div className="sidebar-section-title">Group Chat</div>
                    <button
                      className={`room-item ${(activeRoom || room) === groupRoomId ? 'active' : ''}`}
                      onClick={() => { switchRoom(groupRoomId); setShowRoomSidebar(false); }}
                    >
                      <div className="room-icon">#</div>
                      <span>{groupRoomId}</span>
                    </button>
                  </div>
                )}

                <div className="sidebar-section">
                  <div className="sidebar-section-title">Direct Messages</div>
                  {rooms.filter(r => r.type === 'dm').length === 0 ? (
                    <div className="sidebar-empty">No DM conversations yet</div>
                  ) : (
                    rooms.filter(r => r.type === 'dm').map(r => (
                      <button
                        key={r.id}
                        className={`room-item ${activeRoom === r.id ? 'active' : ''}`}
                        onClick={() => { switchRoom(r.id); setShowRoomSidebar(false); }}
                      >
                        <div className="room-icon"><MessageSquare size={16}/></div>
                        <span>{r.name}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="sidebar-section">
                  <div className="sidebar-section-title">Online Members</div>
                  {onlineUsers.filter(u => u !== username).length === 0 ? (
                    <div className="sidebar-empty">No other members online</div>
                  ) : (
                    onlineUsers.filter(u => u !== username).map(user => (
                      <div className="sidebar-user-row" key={user}>
                        <div className="sidebar-user-meta">
                          <span className="sidebar-user-dot"></span>
                          <span>{user}</span>
                        </div>
                        <button className="sidebar-dm-btn" onClick={() => { createDM(user); setShowRoomSidebar(false); }}>
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
                    <Star size={40} color="var(--txt-muted)" />
                    <p>No starred messages yet</p>
                  </div>
                ) : (
                  chat.filter(m => starredMsgIds.has(m._id)).map(m => (
                    <div
                      key={m._id}
                      className="starred-panel-item"
                      onClick={() => { scrollToMessage(m._id); setShowStarredPanel(false); }}
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
        {showPinnedPanel && pinnedMessages.length > 0 && (
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
                {pinnedMessages.map(m => (
                  <div
                    key={m._id}
                    className="starred-panel-item"
                    onClick={() => { scrollToMessage(m._id); setShowPinnedPanel(false); }}
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
                ))}
              </div>
            </motion.div>
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
            onClick={closeImageViewer}
          >
            <div className="media-viewer-header">
              <div className="media-viewer-info">
                <User size={16} />
                <span>{imageViewer.sender}</span>
                <span className="media-viewer-time">{formatRelativeTime(imageViewer.time)}</span>
              </div>
              <button className="media-viewer-close" onClick={closeImageViewer}>
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
              <button className="media-action-btn" onClick={() => downloadMedia(imageViewer.url, imageViewer.fileName)}>
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
            onClick={closeVoicePlayer}
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
                  <span className="media-viewer-time">{formatRelativeTime(voicePlayer.time)}</span>
                </div>
                <button className="media-viewer-close" onClick={closeVoicePlayer}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="voice-player-content">
                <div className="voice-player-waveform">
                  <div className="voice-wave-bars">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                </div>
                
                <div className="voice-player-controls">
                  <button
                    className="voice-player-play-btn"
                    onClick={() => playVoiceMessage(voicePlayer.url, 'modal')}
                  >
                    {playingVoiceId === 'modal' ? <Pause size={20}/> : <Play size={20}/>}
                  </button>
                  <div className="voice-player-info">
                    <span className="voice-player-duration">{voicePlayer.duration}s</span>
                    <span className="voice-player-label">Voice Message</span>
                  </div>
                </div>
              </div>

              <div className="media-viewer-actions">
                <button className="media-action-btn" onClick={() => downloadMedia(voicePlayer.url, voicePlayer.fileName)}>
                  <Download size={20} /> Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Chat Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            className="delete-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              className="delete-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="delete-modal-icon">
                <Trash2 size={48} color="var(--error)" />
              </div>
              <h3>Clear All Messages?</h3>
              <p>This will delete all <strong>{chat.length}</strong> messages for everyone.</p>
              <div className="delete-modal-footer">
                <button className="btn-cancel" onClick={() => setShowClearConfirm(false)}>Cancel</button>
                <button className="btn-delete" onClick={() => { 
                  socketRef.current?.emit('clear_chat', roomRef.current); 
                  setShowClearConfirm(false); 
                }}>Clear All</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            className="delete-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              className="delete-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="delete-modal-icon">
                <LogOut size={48} color="var(--warning)" />
              </div>
              <h3>Logout?</h3>
              <p>You'll be signed out as <strong>{username}</strong>.</p>
              <div className="delete-modal-footer">
                <button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)}>Stay</button>
                <button className="btn-delete" style={{ background: 'var(--warning)' }} onClick={() => {
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
                }}>Logout</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && contextMenuMessage && (
          <motion.div 
            ref={contextMenuRef}
            className="context-menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ left: contextMenu.x, top: contextMenu.y }}
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

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            className="call-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="incoming-call-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="incoming-call-avatar">
                {incomingCall.from.charAt(0).toUpperCase()}
              </div>
              <h3>{incomingCall.callType === 'video' ? '📹 Video Call' : '🎤 Voice Call'}</h3>
              <div className="incoming-call-name">{incomingCall.from}</div>
              <div className="incoming-call-actions">
                <button className="incoming-call-btn reject-btn" onClick={rejectCall}>
                  <PhoneOff size={24} />
                  <span>Decline</span>
                </button>
                <button className="incoming-call-btn accept-btn" onClick={answerCall}>
                  <Phone size={24} />
                  <span>Accept</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calling/Ringing Modal */}
      <AnimatePresence>
        {(callState === 'calling' || callState === 'ringing') && callPeer && (
          <motion.div
            className="call-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="calling-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="calling-avatar">{callPeer.charAt(0).toUpperCase()}</div>
              <h3>{callState === 'ringing' ? 'Ringing...' : 'Calling...'}</h3>
              <div className="calling-name">{callPeer}</div>
              <button className="calling-cancel-btn" onClick={endCall}>
                <PhoneOff size={24} />
                <span>Cancel</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Panel */}
      {callState === 'active' && callPeer && (
        <CallPanel
          callType={callType}
          callPeer={callPeer}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isCallMinimized={isCallMinimized}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={endCall}
          onToggleMinimize={toggleCallMinimize}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          formatDuration={(s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`}
          localStream={localStream}
          remoteStream={remoteStream}
          remoteIsScreenSharing={remoteIsScreenSharing}
        />
      )}

      {/* Settings Modals */}
      <AnimatePresence>
        {showCallSettings && (
          <CallSettings onClose={() => setShowCallSettings(false)} />
        )}
        {showAudioSettings && (
          <AudioSettings onClose={() => setShowAudioSettings(false)} />
        )}
        {showVideoSettings && (
          <VideoSettings onClose={() => setShowVideoSettings(false)} />
        )}
        {showStreamSettings && (
          <StreamSettings 
            visibility={streamVisibility}
            source={streamSource}
            onVisibilityChange={setStreamVisibility}
            onSourceChange={setStreamSource}
            onStartStream={() => {
              startLivestream(streamVisibility, streamSource);
              setShowStreamSettings(false);
            }}
            onClose={() => setShowStreamSettings(false)}
          />
        )}
        {showAppSettings && (
          <AppSettings onClose={() => setShowAppSettings(false)} />
        )}
      </AnimatePresence>

      {/* Call History Panel */}
      <AnimatePresence>
        {showCallHistory && (
          <CallHistoryPanel
            history={callHistory}
            onClose={() => setShowCallHistory(false)}
            formatDuration={(s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`}
          />
        )}
      </AnimatePresence>

      {/* Settings Manager */}
      <SettingsManager
        currentView={currentView}
        onClose={() => setCurrentView('chat')}
        callHistory={callHistory}
        formatDuration={(s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`}
        getQualityLabelStyle={() => ({ color: '#4CAF50' })}
      />

      {/* Toast Messages */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            className="toast toast-error"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
          >
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage('')}><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            className="toast toast-success"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
          >
            <CheckCircle size={20} />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== MAIN APP COMPONENT ====================
function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);

  return (
    <CallProvider 
      socket={socketRef.current} 
      username={username} 
      room={room}
      onlineUsers={onlineUsers}
    >
      <AppContent />
    </CallProvider>
  );
}

export default App;