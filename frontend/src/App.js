// DevChat Pro - Complete Working Version with Modern UI
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle, 
  Edit2, X, AlertCircle, Smile, Image as ImageIcon, Pin, Download, Moon, Sun, 
  AtSign, Reply, Eye, EyeOff, Menu, FileDown, Smartphone, LogOut, Lock, ChevronLeft, 
  ChevronUp, ChevronRight, PlayCircle, Mic, Camera, Volume2, VolumeX, Play, Pause, 
  FileText, ChevronDown, MessageSquare, Star, Phone, Video, PhoneOff, PhoneMissed, 
  PhoneIncoming, PhoneOutgoing, Maximize2, Minimize2, Monitor, VideoOff, Settings, 
  Share2, Radio, BarChart3, Clock, StopCircle, Disc3, Bell, Activity,
  Headphones, Radio as RadioIcon, Volume, Video as VideoIcon, Mic as MicIcon 
} from 'lucide-react';

// ==================== CONTEXT IMPORTS ====================
import { CallProvider, useCall } from './context/CallContext';
import { SettingsProvider, useSettings } from './context/settingsContext';

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
import CallHistoryPanel from './components/calls/CallHistoryPanel';

// ==================== STREAMING IMPORTS ====================
import ModernStreamPanel from './components/streaming/ModernStreamPanel';

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
import { useWebRTC } from './hooks/useWebRTC';

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
  const [ringtoneStyle, setRingtoneStyle] = useState(localStorage.getItem('ringtoneStyle') || 'soft');
  const [ringtoneVolume, setRingtoneVolume] = useState(() => {
    const stored = Number(localStorage.getItem('ringtoneVolume'));
    return Number.isFinite(stored) ? Math.min(1, Math.max(0.05, stored)) : 0.18;
  });
  const [autoJoinLivestream, setAutoJoinLivestream] = useState(() => localStorage.getItem('autoJoinLivestream') === 'true');
  const [showDoubleTick, setShowDoubleTick] = useState(localStorage.getItem('showDoubleTick') !== 'false');
  const [showBlueTick, setShowBlueTick] = useState(localStorage.getItem('showBlueTick') !== 'false');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 600);
  const [isIOS, setIsIOS] = useState(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  const [isWindows, setIsWindows] = useState(/Windows/i.test(navigator.userAgent));
  
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
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // ==================== UI STATES ====================
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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
  const [showStreamingTab, setShowStreamingTab] = useState(false);
  
  // ==================== NAVIGATION ====================
  const [currentView, setCurrentView] = useState('chat');
  const [navigationStack, setNavigationStack] = useState([]);
  
  // ==================== NOTIFICATIONS ====================
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recentMentions, setRecentMentions] = useState(0);
  const [mentionedMessages, setMentionedMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
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

  // ==================== OUTGOING QUEUE ====================
  const [outgoingQueue, setOutgoingQueue] = useState([]);

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
  const [callState, setCallState] = useState('idle');
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
  const [reconnectInfo, setReconnectInfo] = useState(null);
  const [peerConnectionState, setPeerConnectionState] = useState('new');
  const [iceConnectionState, setIceConnectionState] = useState('new');
  const [signalingState, setSignalingState] = useState('stable');
  const [localPreviewPosition, setLocalPreviewPosition] = useState({ x: 20, y: 20 });
  const [localPreviewSizeIndex, setLocalPreviewSizeIndex] = useState(1);
  const [isDraggingLocalPreview, setIsDraggingLocalPreview] = useState(false);
  
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
  const [videoEffectSettings, setVideoEffectSettings] = useState({
    backgroundBlur: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1
  });
  const [showVideoEffects, setShowVideoEffects] = useState(false);
  const [qualityIndicator, setQualityIndicator] = useState(null);
  
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
  const roomsRef = useRef([]);
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const seenIceCandidateKeysRef = useRef(new Set());
  const qualityControllerRef = useRef(null);
  const callRecorderRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
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
  const videoEffectsCanvasRef = useRef(null);
  const localPreviewDragOffsetRef = useRef({ x: 0, y: 0 });
  const localPreviewMovedRef = useRef(false);
  const subscribedRoomsRef = useRef(new Set());
  const soundEnabledRef = useRef(true);
  const ringtoneRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const ringtoneAudioContextRef = useRef(null);
  const endCallRef = useRef(() => {});
  const idleStateRef = useRef(false);
  const notificationPrefsRef = useRef(notificationPrefs);
  const blockedUsersRef = useRef(blockedUsers);
  const autoJoinLivestreamRef = useRef(autoJoinLivestream);

  // ==================== CUSTOM HOOKS ====================
  const enhancedCall = useEnhancedCall(socketRef.current, username);
  const webrtc = useWebRTC(username, socketRef);

  // ==================== REF UPDATES ====================
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callPeerRef.current = callPeer; }, [callPeer]);
  useEffect(() => { liveStreamInfoRef.current = liveStreamInfo; }, [liveStreamInfo]);
  useEffect(() => { autoJoinLivestreamRef.current = autoJoinLivestream; }, [autoJoinLivestream]);
  useEffect(() => { notificationPrefsRef.current = notificationPrefs; }, [notificationPrefs]);
  useEffect(() => { blockedUsersRef.current = blockedUsers; }, [blockedUsers]);
  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

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

    // Service worker force reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FORCE_RELOAD') {
          window.location.reload(true);
        }
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // ==================== THEME ====================
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Debug CSS variables
    const styles = getComputedStyle(document.documentElement);
    const bgColor = styles.getPropertyValue('--bg').trim();
    if (!bgColor && process.env.NODE_ENV !== 'production') {
      console.error('❌ CSS variables not loaded!');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontStyle);
    localStorage.setItem('fontStyle', fontStyle);
  }, [fontStyle]);

  useEffect(() => {
    localStorage.setItem('ringtoneStyle', ringtoneStyle);
  }, [ringtoneStyle]);

  useEffect(() => {
    localStorage.setItem('ringtoneVolume', String(ringtoneVolume));
  }, [ringtoneVolume]);

  useEffect(() => {
    localStorage.setItem('autoJoinLivestream', autoJoinLivestream ? 'true' : 'false');
  }, [autoJoinLivestream]);

  useEffect(() => {
    localStorage.setItem('showDoubleTick', String(showDoubleTick));
  }, [showDoubleTick]);

  useEffect(() => {
    localStorage.setItem('showBlueTick', String(showBlueTick));
  }, [showBlueTick]);

  useEffect(() => {
    localStorage.setItem('devchatNotificationPrefs', JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);

  useEffect(() => {
    localStorage.setItem('devchatBlockedUsers', JSON.stringify(blockedUsers));
  }, [blockedUsers]);

  useEffect(() => {
    localStorage.setItem('devchatReportedUsers', JSON.stringify(reportedUsers));
  }, [reportedUsers]);

  useEffect(() => {
    localStorage.setItem('devchatRoomDrafts', JSON.stringify(roomDrafts));
  }, [roomDrafts]);

  useEffect(() => {
    localStorage.setItem('devchatTypingTimeoutByRoom', JSON.stringify(typingTimeoutByRoom));
  }, [typingTimeoutByRoom]);

  useEffect(() => {
    if (selectedVideoInputId) {
      localStorage.setItem('devchatPreferredCameraId', selectedVideoInputId);
    }
  }, [selectedVideoInputId]);

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

  // ==================== DEVICE ENUMERATION ====================
  const refreshVideoInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
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
  }, []);

  useEffect(() => {
    refreshVideoInputs();
    navigator.mediaDevices?.addEventListener('devicechange', refreshVideoInputs);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshVideoInputs);
  }, [refreshVideoInputs]);

  // ==================== WITH PREFERRED VIDEO DEVICE ====================
  const withPreferredVideoDevice = useCallback((constraints) => {
    if (!selectedVideoInputId || !constraints || constraints.video === false) return constraints;
    return {
      ...constraints,
      video: {
        ...(typeof constraints.video === 'object' ? constraints.video : {}),
        deviceId: { exact: selectedVideoInputId }
      }
    };
  }, [selectedVideoInputId]);

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

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
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
      if (soundEnabled && data.sender !== usernameRef.current && 
          !notificationPrefs.mutedRooms.includes(data.room) && 
          !isWithinQuietHours()) {
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
      console.log('👤 User joined:', data.username);
      const users = Array.isArray(data.users) ? [...new Set(data.users.filter(Boolean))] : [];
      const targetRoom = data.room || roomRef.current;
      setRoomUserMap(prev => ({ ...prev, [targetRoom]: users }));
      if (targetRoom === roomRef.current) {
        setOnlineUsers(users);
      }
      setUserStatus(prev => {
        const next = { ...prev };
        users.forEach(user => { next[user] = 'online'; });
        return next;
      });
    });

    socket.on('user_left', (data) => {
      console.log('👤 User left:', data.username);
      const targetRoom = data.room || roomRef.current;
      if (Array.isArray(data.users)) {
        const users = [...new Set(data.users.filter(Boolean))];
        setRoomUserMap(prev => ({ ...prev, [targetRoom]: users }));
        if (targetRoom === roomRef.current) {
          setOnlineUsers(users);
        }
      } else {
        setRoomUserMap(prev => {
          const currentUsers = prev[targetRoom] || [];
          const users = currentUsers.filter(u => u !== data.username);
          if (targetRoom === roomRef.current) {
            setOnlineUsers(users);
          }
          return { ...prev, [targetRoom]: users };
        });
      }
      if (typingTimersRef.current.has(data.username)) {
        clearTimeout(typingTimersRef.current.get(data.username));
        typingTimersRef.current.delete(data.username);
      }
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.username);
        return updated;
      });
    });

    socket.on('user_list_updated', (data) => {
      const users = Array.isArray(data.users) ? [...new Set(data.users.filter(Boolean))] : [];
      const targetRoom = data.room || roomRef.current;
      setRoomUserMap(prev => ({ ...prev, [targetRoom]: users }));
      if (targetRoom === roomRef.current) {
        setOnlineUsers(users);
      }
      setUserStatus(prev => {
        const next = { ...prev };
        users.forEach(user => { next[user] = 'online'; });
        return next;
      });
    });

    socket.on('global_users_updated', (data) => {
      const users = Array.isArray(data?.users) ? [...new Set(data.users.filter(Boolean))] : [];
      setGlobalPresenceUsers(users);
      setUserStatus(prev => {
        const next = { ...prev };
        users.forEach(user => { next[user] = 'online'; });
        Object.keys(next).forEach(user => {
          if (!users.includes(user)) next[user] = 'offline';
        });
        return next;
      });
    });

    socket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.filter(u => u !== data.username));
      setRoomUserMap(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(roomKey => {
          next[roomKey] = (next[roomKey] || []).filter(u => u !== data.username);
        });
        return next;
      });
      setUserStatus(prev => ({ ...prev, [data.username]: 'offline' }));
      if (typingTimersRef.current.has(data.username)) {
        clearTimeout(typingTimersRef.current.get(data.username));
        typingTimersRef.current.delete(data.username);
      }
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.username);
        return updated;
      });
    });

    socket.on('user_logout', (data) => {
      setOnlineUsers(prev => prev.filter(u => u !== data.username));
      setRoomUserMap(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(roomKey => {
          next[roomKey] = (next[roomKey] || []).filter(u => u !== data.username);
        });
        return next;
      });
      setUserStatus(prev => ({ ...prev, [data.username]: 'offline' }));
      if (typingTimersRef.current.has(data.username)) {
        clearTimeout(typingTimersRef.current.get(data.username));
        typingTimersRef.current.delete(data.username);
      }
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.username);
        return updated;
      });
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
      }, 5000);
      
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

    socket.on('room_policy_updated', ({ room: policyRoom, policy }) => {
      setRoomPolicies(prev => ({ ...prev, [policyRoom]: policy }));
    });

    socket.on('room_join_denied', ({ room: deniedRoom, reason }) => {
      const reasonLabel = reason === 'invite_only' ? 'invite-only' : 'locked';
      setErrorMessage(`Cannot join ${deniedRoom}: ${reasonLabel}`);
    });

    socket.on('room_invited', ({ room: invitedRoom, by }) => {
      setSuccessMessage(`Invited to ${invitedRoom} by ${by}`);
    });

    socket.on('room_removed', ({ room: removedRoom, by }) => {
      setErrorMessage(`Removed from ${removedRoom} by ${by}`);
    });

    socket.on(ROOM_EVENTS.REGISTRY_UPDATED, (data) => {
      const nextRooms = Array.isArray(data?.rooms)
        ? data.rooms.filter(r => r?.id && !r.id.includes('_dm_'))
        : [];
      setActiveRoomRegistry(nextRooms);
    });

    socket.on('block_list_updated', ({ blocked }) => {
      if (Array.isArray(blocked)) setBlockedUsers(blocked);
    });

    socket.on('profile_updated', (data) => {
      setUserProfiles(prev => ({ ...prev, [data.username]: { avatar: data.avatar, bio: data.bio } }));
    });

    // Call signaling events
    socket.on(CALL_EVENTS.OFFER, (data) => {
      setIncomingCall(data);
      playRingtone();
    });

    socket.on(CALL_EVENTS.ANSWER, (data) => {
      // Handled by useWebRTC
    });

    socket.on(CALL_EVENTS.ICE_CANDIDATE, (data) => {
      // Handled by useWebRTC
    });

    socket.on(CALL_EVENTS.REJECTED, () => {
      setCallError('Call rejected');
      endCall();
    });

    socket.on(CALL_EVENTS.ENDED, () => {
      endCall();
    });

    socket.on(CALL_EVENTS.SCREEN_SHARE_START, () => {
      setRemoteIsScreenSharing(true);
    });

    socket.on(CALL_EVENTS.SCREEN_SHARE_END, () => {
      setRemoteIsScreenSharing(false);
    });

    // Livestream events
    socket.on(LIVESTREAM_EVENTS.STARTED, (data) => {
      setSuccessMessage(`🔴 ${data.host} started a livestream`);
      setNotificationItems(prev => [...prev, {
        id: `live-${data.sessionId}`,
        type: 'livestream',
        sessionId: data.sessionId,
        sender: data.host,
        preview: `${data.host} is live`,
        time: new Date().toISOString()
      }]);
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
      if (autoJoinLivestreamRef.current) {
        joinLivestreamAsViewer({
          sessionId: data.sessionId,
          host: data.from,
          offer: data.offer,
          visibility: data.visibility,
          source: data.source,
          room: data.room
        }).catch(console.error);
      } else {
        setIncomingCall({
          from: data.from,
          callType: 'video',
          offer: data.offer,
          isLivestream: true,
          sessionId: data.sessionId,
          visibility: data.visibility,
          source: data.source
        });
        playRingtone();
      }
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

    // Cleanup function
    return () => {
      socket.disconnect();
      
      // Clear all timers
      typingTimersRef.current.forEach(timer => clearTimeout(timer));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      if (reconnectCountdownRef.current) clearInterval(reconnectCountdownRef.current);
      if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);
      if (remoteTrackTimeoutRef.current) clearTimeout(remoteTrackTimeoutRef.current);
      if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
      stopRingtone();
      stopCallTimer();
    };
  }, [soundEnabled, blockedUsers]);

  // ==================== UTILITY FUNCTIONS ====================
  const getTypingTimeoutForRoom = useCallback((roomId) => {
    if (!roomId) return typingTimeoutByRoom.defaultGroup || 3000;
    if (typingTimeoutByRoom[roomId]) return typingTimeoutByRoom[roomId];
    return roomId.includes('_dm_')
      ? (typingTimeoutByRoom.defaultDm || 1800)
      : (typingTimeoutByRoom.defaultGroup || 3000);
  }, [typingTimeoutByRoom]);

  const isWithinQuietHours = useCallback(() => {
    const prefs = notificationPrefsRef.current;
    if (!prefs.quietHoursEnabled) return false;
    const [startH, startM] = (prefs.quietStart || '22:00').split(':').map(Number);
    const [endH, endM] = (prefs.quietEnd || '07:00').split(':').map(Number);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }, []);

  const shouldNotifyForMessage = useCallback((messagePayload, isDifferentRoom) => {
    if (!messagePayload || messagePayload.sender === usernameRef.current) return false;
    if (!isDifferentRoom) return false;

    const prefs = notificationPrefsRef.current;
    const roomId = messagePayload.room || '';
    if (prefs.mutedRooms.includes(roomId)) return false;

    const isDm = roomId.includes('_dm_');
    const mentionsCurrentUser =
      messagePayload.text?.includes(`@${usernameRef.current}`) ||
      messagePayload.text?.includes('@everyone');

    if (prefs.dmOnlyPriority && !isDm) return false;
    if (prefs.mentionOnly && !mentionsCurrentUser) return false;
    if (isWithinQuietHours() && !mentionsCurrentUser) return false;

    return true;
  }, [isWithinQuietHours]);

  const emitReliableMessage = useCallback((messagePayload, options = {}) => {
    const socket = socketRef.current;
    if (!socket || !connected) {
      setErrorMessage('Not connected');
      return null;
    }

    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const queueItem = {
      id: messageId,
      payload: { ...messagePayload, clientMessageId: messageId },
      status: 'sending',
      attempts: 1,
      createdAt: Date.now(),
      error: null
    };

    setOutgoingQueue(prev => [queueItem, ...prev].slice(0, 50));

    socket.emit('send_message', queueItem.payload, (ack) => {
      if (ack?.success) {
        setOutgoingQueue(prev => prev.map(entry => 
          entry.id === messageId ? { ...entry, status: 'sent', error: null } : entry
        ));
        setTimeout(() => {
          setOutgoingQueue(prev => prev.filter(entry => !(entry.id === messageId && entry.status === 'sent')));
        }, 3000);
        if (options.onSuccess) options.onSuccess(ack);
      } else {
        const errMessage = ack?.error || 'Message failed to send';
        setOutgoingQueue(prev => prev.map(entry => 
          entry.id === messageId ? { ...entry, status: 'failed', error: errMessage } : entry
        ));
        setErrorMessage(errMessage);
      }
    });

    return messageId;
  }, [connected]);

  const retryQueueItem = useCallback((queueId) => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    const target = outgoingQueue.find(entry => entry.id === queueId);
    if (!target) return;

    setOutgoingQueue(prev => prev.map(entry => 
      entry.id === queueId ? { ...entry, status: 'sending', attempts: entry.attempts + 1, error: null } : entry
    ));

    socket.emit('send_message', target.payload, (ack) => {
      if (ack?.success) {
        setOutgoingQueue(prev => prev.map(entry => 
          entry.id === queueId ? { ...entry, status: 'sent', error: null } : entry
        ));
      } else {
        const errMessage = ack?.error || 'Retry failed';
        setOutgoingQueue(prev => prev.map(entry => 
          entry.id === queueId ? { ...entry, status: 'failed', error: errMessage } : entry
        ));
      }
    });
  }, [connected, outgoingQueue]);

  const attachRemoteStreamToElement = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;

    const videoElement = remoteVideoRef.current;
    if (videoElement) {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      videoElement.muted = true;
      videoElement.play().catch(e => console.log('Remote video play blocked:', e));
    }

    const audioElement = remoteAudioRef.current;
    if (audioElement) {
      if (audioElement.srcObject !== stream) {
        audioElement.srcObject = stream;
      }
      audioElement.muted = false;
      audioElement.play().catch(e => console.log('Remote audio play blocked:', e));
    }
  }, []);

  const attachLocalStreamToElement = useCallback(() => {
    const element = localVideoRef.current;
    const stream = localStreamRef.current;
    if (!element || !stream) return;
    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }
  }, []);

  const setRemoteVideoElement = useCallback((node) => {
    remoteVideoRef.current = node;
    if (node) attachRemoteStreamToElement();
  }, [attachRemoteStreamToElement]);

  const setLocalVideoElement = useCallback((node) => {
    localVideoRef.current = node;
    if (node) attachLocalStreamToElement();
  }, [attachLocalStreamToElement]);

  const setRemoteAudioElement = useCallback((node) => {
    remoteAudioRef.current = node;
    if (node) attachRemoteStreamToElement();
  }, [attachRemoteStreamToElement]);

  useEffect(() => {
    attachRemoteStreamToElement();
  }, [remoteStream, callState, isCallMinimized, attachRemoteStreamToElement]);

  useEffect(() => {
    if (callType === 'video') {
      attachLocalStreamToElement();
    }
  }, [localStream, callType, callState, isCallMinimized, attachLocalStreamToElement]);

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
        const unreadIds = chat.filter(m => m.sender !== username && !m.readBy?.includes(username)).map(m => m._id);
        if (unreadIds.length > 0 && socketRef.current) {
          socketRef.current.emit('mark_read', { 
            messageIds: unreadIds, 
            username: usernameRef.current, 
            room: roomRef.current 
          });
        }
      }
    };

    chatBody.addEventListener('scroll', handleScroll);
    return () => chatBody.removeEventListener('scroll', handleScroll);
  }, [chat, username]);

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

  // ==================== MENTION DETECTION ====================
  useEffect(() => {
    if (chat.length === 0) return;

    const mentions = chat.filter(msg => 
      msg.text?.includes(`@${username}`) || msg.text?.includes('@everyone')
    );
    setMentionedMessages(mentions);
    setRecentMentions(mentions.filter(m => m.sender !== username).length);

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

  // ==================== FILTERED CHAT ====================
  const filteredChat = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    const dmQuery = dmSearchQuery.trim().toLowerCase();
    const isDmRoom = (activeRoom || room).includes('_dm_');

    return chat.filter(msg => {
      const msgText = (msg.text || '').toLowerCase();
      const msgSender = (msg.sender || '').toLowerCase();

      if (query && !(msgText.includes(query) || msgSender.includes(query))) {
        return false;
      }

      if (isDmRoom && dmQuery && !msgText.includes(dmQuery) && !msgSender.includes(dmQuery)) {
        return false;
      }

      if (searchFilters.sender && msgSender !== searchFilters.sender.toLowerCase()) {
        return false;
      }

      if (searchFilters.mediaType !== 'all') {
        if (searchFilters.mediaType === 'text' && msg.type && msg.type !== 'text') return false;
        if (searchFilters.mediaType === 'image' && msg.type !== 'image') return false;
        if (searchFilters.mediaType === 'voice' && msg.type !== 'voice') return false;
        if (searchFilters.mediaType === 'file' && msg.type !== 'file') return false;
      }

      if (searchFilters.mentionsOnly) {
        const mentionHit = msgText.includes(`@${username.toLowerCase()}`) || msgText.includes('@everyone');
        if (!mentionHit) return false;
      }

      if (searchFilters.fromDate) {
        const from = new Date(`${searchFilters.fromDate}T00:00:00`);
        if (new Date(msg.time) < from) return false;
      }

      if (searchFilters.toDate) {
        const to = new Date(`${searchFilters.toDate}T23:59:59`);
        if (new Date(msg.time) > to) return false;
      }

      return true;
    });
  }, [chat, debouncedSearchQuery, dmSearchQuery, activeRoom, room, searchFilters, username]);

  const searchResultCount = useMemo(() => filteredChat.length, [filteredChat]);
  const failedQueueItems = useMemo(() => outgoingQueue.filter(e => e.status === 'failed'), [outgoingQueue]);
  const availableSenders = useMemo(() => [...new Set(chat.map(m => m.sender).filter(Boolean))].sort(), [chat]);

  // ==================== CLICK OUTSIDE HANDLERS ====================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
        setContextMenuMessage(null);
      }
    };
    
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleClickOutsideMenu = (e) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setShowMenuDropdown(false);
      }
    };

    if (showMenuDropdown) {
      document.addEventListener('mousedown', handleClickOutsideMenu);
      document.addEventListener('touchstart', handleClickOutsideMenu);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMenu);
      document.removeEventListener('touchstart', handleClickOutsideMenu);
    };
  }, [showMenuDropdown]);

  useEffect(() => {
    if (!showMenuDropdown) {
      setShowStreamingTab(false);
    }
  }, [showMenuDropdown]);

  // ==================== IDLE DETECTION ====================
  useEffect(() => {
    if (!showChat || !connected || !socketRef.current || !usernameRef.current) return;

    let idleTimer = null;
    const idleThresholdMs = 60 * 1000;

    const markIdle = () => {
      if (idleStateRef.current) return;
      idleStateRef.current = true;
      socketRef.current?.emit('update_status', { username: usernameRef.current, status: 'idle' });
    };

    const markActive = () => {
      if (idleStateRef.current) {
        socketRef.current?.emit('update_status', { username: usernameRef.current, status: 'online' });
      }
      idleStateRef.current = false;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(markIdle, idleThresholdMs);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, markActive, { passive: true }));
    markActive();

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, markActive));
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [showChat, connected]);

  // ==================== TYPING DISPLAY ====================
  const typingDisplay = useMemo(() => {
    const arr = Array.from(typingUsers);
    if (arr.length === 0) return '';
    if (arr.length === 1) return `${arr[0]} is typing`;
    if (arr.length === 2) return `${arr[0]} and ${arr[1]} are typing`;
    return `${arr[0]}, ${arr[1]} and ${arr.length - 2} others are typing`;
  }, [typingUsers]);

  // ==================== JOIN ROOM ====================
  const joinRoom = useCallback(() => {
    if (username && room && socketRef.current) {
      console.log(`🚪 Joining room: ${room}`);
      
      sessionStorage.setItem('chatUsername', username);
      sessionStorage.setItem('chatRoom', room);
      
      setChat([]);
      setOnlineUsers([]);
      setRoomUserMap({});
      setActiveRoomRegistry([]);
      setGlobalPresenceUsers([]);
      setTypingUsers(new Set());
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setGroupRoomId(room);
      setRooms([{ id: room, name: room, type: 'group' }]);
      setActiveRoom(room);
      setMessage(roomDrafts[room] || '');
      subscribedRoomsRef.current = new Set([room]);
      socketRef.current.emit("join_room", { room, username, active: true, fetchHistory: true }); 
      socketRef.current.emit("update_status", { username, status: 'online' });
      setShowChat(true); 
    }
  }, [username, room, roomDrafts]);

  // ==================== MESSAGE HANDLING ====================
  const handleMessageChange = useCallback((e) => {
    const value = e.target.value;
    setMessage(value);
    if (roomRef.current) {
      setRoomDrafts(prev => ({ ...prev, [roomRef.current]: value }));
    }

    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }

    const socket = socketRef.current;
    if (!socket || !connected) return;
    
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1500) {
      socket.emit("typing", { room: roomRef.current, username: usernameRef.current });
      lastTypingEmitRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const typingTimeoutMs = getTypingTimeoutForRoom(roomRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { room: roomRef.current, username: usernameRef.current });
      typingTimeoutRef.current = null;
    }, typingTimeoutMs);
  }, [connected, getTypingTimeoutForRoom]);

  const sendMessage = useCallback(() => {
    const text = message.trim();
    if (!text || !connected || !socketRef.current) return;

    const activeRoomId = roomRef.current;
    if (activeRoomId?.includes('_dm_')) {
      const participants = activeRoomId.split('_dm_').filter(Boolean);
      const peer = participants.find(p => p !== usernameRef.current);
      if (peer && blockedUsers.includes(peer)) {
        setErrorMessage('Unblock this user first');
        return;
      }
    }
    
    const mentions = extractMentions(text);
    const messageData = { 
      room: roomRef.current, 
      sender: usernameRef.current, 
      text,
      mentions,
      replyTo: replyingTo?._id || null
    };

    emitReliableMessage(messageData);
    setMessage("");
    setRoomDrafts(prev => ({ ...prev, [roomRef.current]: '' }));
    setReplyingTo(null);
    
    if (typingTimeoutRef.current) { 
      clearTimeout(typingTimeoutRef.current); 
      typingTimeoutRef.current = null; 
    }
    socketRef.current.emit("stop_typing", { room: roomRef.current, username: usernameRef.current });
  }, [message, connected, replyingTo, emitReliableMessage, blockedUsers]);

  // ==================== FILE UPLOAD ====================
  const handleFileUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    console.log(`📁 ${files.length} file(s) selected`);
    
    const validFiles = [];
    const maxSize = 10 * 1024 * 1024;
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedDocTypes = ['application/pdf', 'application/msword', 
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    for (const file of files) {
      if (file.size > maxSize) {
        setErrorMessage(`${file.name} too large! Max 10MB.`);
        continue;
      }
      if ([...allowedImageTypes, ...allowedDocTypes].includes(file.type)) {
        validFiles.push(file);
      } else {
        setErrorMessage(`${file.name} not supported.`);
      }
    }
    
    if (validFiles.length === 0) return;
    
    const imageFiles = validFiles.filter(f => f.type.startsWith('image/'));
    const docFiles = validFiles.filter(f => !f.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const imagePromises = imageFiles.map((file, index) => {
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = (event) => resolve({
            file,
            preview: event.target.result,
            id: Date.now() + index
          });
          reader.readAsDataURL(file);
        });
      });
      
      const loadedImages = await Promise.all(imagePromises);
      setSelectedImages(loadedImages);
      setCurrentImageIndex(0);
      setShowImagePreview(true);
      setImageCaption('');
    }
    
    for (const docFile of docFiles) {
      await uploadFile(docFile, '');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  const uploadFile = useCallback(async (file, caption = '') => {
    setUploadingFile(true);
    setUploadProgress('Preparing...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'devchat_uploads');

    let retries = 3;
    while (retries > 0) {
      try {
        setUploadProgress(`Uploading... (${4 - retries}/3)`);
        const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (!res.ok || data.error) throw new Error(data.error?.message || 'Upload failed');
        
        const messageText = caption || file.name;
        const messageType = file.type.startsWith('image/') ? 'image' : 'file';
        
        emitReliableMessage({ 
          room: roomRef.current, 
          sender: usernameRef.current, 
          text: messageText,
          type: messageType,
          fileUrl: data.secure_url,
          fileName: file.name,
          fileSize: file.size
        });
        
        setSuccessMessage('File uploaded!');
        break;
      } catch (error) {
        console.error(`Upload attempt ${4 - retries} failed:`, error);
        retries--;
        if (retries === 0) {
          setErrorMessage(`Upload failed: ${error.message}`);
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    
    setUploadingFile(false);
    setUploadProgress('');
  }, [emitReliableMessage]);

  const uploadMultipleImages = useCallback(async () => {
    if (selectedImages.length === 0) return;
    
    setUploadingFile(true);
    setShowImagePreview(false);
    
    const totalImages = selectedImages.length;
    let successCount = 0;
    
    for (let i = 0; i < selectedImages.length; i++) {
      const { file } = selectedImages[i];
      setUploadProgress(`Uploading ${i + 1}/${totalImages}...`);
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'devchat_uploads');
        
        const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (res.ok && !data.error) {
          const messageText = (i === 0 && imageCaption) ? imageCaption : file.name;
          
          emitReliableMessage({
            room: roomRef.current,
            sender: usernameRef.current,
            text: messageText,
            type: 'image',
            fileUrl: data.secure_url,
            fileName: file.name,
            fileSize: file.size
          });
          
          successCount++;
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }
    
    if (successCount > 0) {
      setSuccessMessage(`${successCount} image(s) sent!`);
    } else {
      setErrorMessage('Failed to upload images');
    }
    
    setSelectedImages([]);
    setImageCaption('');
    setCurrentImageIndex(0);
    setUploadingFile(false);
    setUploadProgress('');
  }, [selectedImages, imageCaption, emitReliableMessage]);

  const cancelImagePreview = useCallback(() => {
    setShowImagePreview(false);
    setSelectedImages([]);
    setImageCaption('');
    setCurrentImageIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  const removeImage = useCallback((imageId) => {
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
  }, [currentImageIndex]);

  // ==================== DRAG AND DROP ====================
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === chatBodyRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    
    const mockEvent = { target: { files } };
    await handleFileUpload(mockEvent);
  }, [handleFileUpload]);

  // ==================== EMOJI ====================
  const handleEmojiClick = useCallback((emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  }, []);

  // ==================== REACTIONS ====================
  const handleReaction = useCallback((messageId, emoji) => {
    if (!socketRef.current) return;
    const msg = chat.find(m => m._id === messageId);
    const reactions = msg?.reactions || {};
    const userReacted = reactions[emoji]?.includes(username);
    
    if (userReacted) {
      socketRef.current.emit('remove_reaction', { messageId, emoji, username: usernameRef.current, room: roomRef.current });
    } else {
      socketRef.current.emit('add_reaction', { messageId, emoji, username: usernameRef.current, room: roomRef.current });
    }
  }, [chat, username]);

  // ==================== PIN ====================
  const togglePin = useCallback((messageId, isPinned) => {
    if (!socketRef.current) return;
    socketRef.current.emit(isPinned ? 'unpin_message' : 'pin_message', { messageId, room: roomRef.current });
  }, []);

  // ==================== EXPORT CHAT ====================
  const exportChat = useCallback(() => {
    const data = JSON.stringify(chat, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${room}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chat, room]);

  // ==================== SCROLL TO MESSAGE ====================
  const scrollToMessage = useCallback((messageId) => {
    const el = msgRefsMap.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('msg-highlight');
      setTimeout(() => el.classList.remove('msg-highlight'), 1500);
    }
  }, []);

  // ==================== STAR ====================
  const toggleStar = useCallback((msgId) => {
    setStarredMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      localStorage.setItem('devChatStarred', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // ==================== COPY ====================
  const handleCopyMessage = useCallback((text, msgId) => {
    copyToClipboard(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

  // ==================== EDIT ====================
  const startEditMessage = useCallback((msgId, currentText) => {
    setEditingMsgId(msgId);
    setEditingText(currentText);
  }, []);

  const saveEditMessage = useCallback(() => {
    if (!editingText.trim() || !socketRef.current || !editingMsgId) return;
    socketRef.current.emit("edit_message", {
      messageId: editingMsgId,
      newText: editingText,
      room: roomRef.current,
      sender: usernameRef.current,
    });
    setEditingMsgId(null);
    setEditingText("");
  }, [editingMsgId, editingText]);

  // ==================== DELETE ====================
  const deleteMessage = useCallback((msgId) => {
    setDeletingMsgId(msgId);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (socketRef.current && deletingMsgId) {
      socketRef.current.emit("delete_message", {
        messageId: deletingMsgId,
        room: roomRef.current,
        sender: usernameRef.current,
      });
    }
    setShowDeleteConfirm(false);
    setDeletingMsgId(null);
  }, [deletingMsgId]);

  // ==================== CONTEXT MENU ====================
  const handleContextMenu = useCallback((e, message) => {
    const target = e.target;
    const isInteractive = target.tagName === 'A' || target.tagName === 'BUTTON' || 
                         target.closest('a') || target.closest('button');
    
    if (isInteractive) return;
    
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    
    const x = e.clientX || e.touches?.[0]?.clientX || 0;
    const y = e.clientY || e.touches?.[0]?.clientY || 0;
    
    const menuWidth = 280;
    const menuHeight = 350;
    
    let adjustedX = Math.min(Math.max(x, 10), window.innerWidth - menuWidth - 10);
    let adjustedY = Math.min(Math.max(y, 10), window.innerHeight - menuHeight - 10);
    
    setContextMenu({ x: adjustedX, y: adjustedY });
    setContextMenuMessage(message);
  }, []);

  const handleLongPressStart = useCallback((e, message) => {
    const target = e.target;
    const isInteractive = target.tagName === 'A' || target.tagName === 'BUTTON' || 
                         target.closest('a') || target.closest('button');
    
    if (isInteractive) return;
    
    const timer = setTimeout(() => {
      const touch = e.touches?.[0];
      if (touch) {
        if (e.cancelable) e.preventDefault();
        handleContextMenu({ 
          preventDefault: () => {}, 
          stopPropagation: () => {},
          clientX: touch.clientX, 
          clientY: touch.clientY,
          target: e.target
        }, message);
      }
    }, 500);
    
    setLongPressTimer(timer);
  }, [handleContextMenu]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextMenuMessage(null);
  }, []);

  const handleContextMenuAction = useCallback((action) => {
    if (!contextMenuMessage) return;
    
    switch(action) {
      case 'star':
        toggleStar(contextMenuMessage._id);
        break;
      case 'copy':
        handleCopyMessage(contextMenuMessage.text, contextMenuMessage._id);
        break;
      case 'reply':
        setReplyingTo(contextMenuMessage);
        break;
      case 'pin':
        togglePin(contextMenuMessage._id, contextMenuMessage.isPinned);
        break;
      case 'edit':
        startEditMessage(contextMenuMessage._id, contextMenuMessage.text);
        break;
      case 'delete':
        deleteMessage(contextMenuMessage._id);
        break;
      case 'view':
        if (contextMenuMessage.type === 'image' && contextMenuMessage.fileUrl) {
          openImageViewer({
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
      default:
        break;
    }
    closeContextMenu();
  }, [contextMenuMessage, handleCopyMessage, startEditMessage, deleteMessage, togglePin, toggleStar, closeContextMenu, openImageViewer, playVoiceMessage]);

  // ==================== RENDER MESSAGE TEXT ====================
  const renderMessageText = (msg) => {
    if (!showMarkdown) return <p>{msg.text}</p>;
    
    let content = msg.text;
    
    if (msg.mentions?.length > 0) {
      msg.mentions.forEach(mention => {
        content = content.replace(new RegExp(`@${mention}\\b`, 'g'), `**@${mention}**`);
      });
    }
    
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
        {content}
      </ReactMarkdown>
    );
  };

  // ==================== VOICE MESSAGES ====================
  const playVoiceMessage = useCallback(async (audioUrl, msgId) => {
    console.log(`🎵 Play voice: ${msgId}`);
    
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
          setErrorMessage('Failed to play voice');
          setPlayingVoiceId(null);
        };
        
        setPlayingVoiceId(msgId);
        await audio.play();
      } catch (error) {
        console.error('Playback failed:', error);
        setPlayingVoiceId(null);
      }
    }
  }, [playingVoiceId]);

  const startVoiceRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Voice recording not supported');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());

        if (recordingTimeRef.current < 1) {
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }

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
            emitReliableMessage({
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
  }, [emitReliableMessage]);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  const cancelVoiceRecording = useCallback(() => {
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
  }, []);

  const lockRecording = useCallback(() => {
    setRecordingLocked(true);
    setSlideDistance(0);
  }, []);

  const handleRecordingSlide = useCallback((e) => {
    if (recordingLocked) return;
    
    const touch = e.touches ? e.touches[0] : e;
    const currentX = touch.clientX;
    const distance = startX - currentX;
    
    if (distance > 0) {
      setSlideDistance(Math.min(distance, 150));
      if (distance > 120) cancelVoiceRecording();
    }
  }, [recordingLocked, startX, cancelVoiceRecording]);

  const handleRecordingStart = useCallback((e) => {
    const touch = e.touches ? e.touches[0] : e;
    setStartX(touch.clientX);
    startVoiceRecording();
  }, [startVoiceRecording]);

  const handleDesktopRecordingClick = useCallback((e) => {
    if (e.type === 'touchstart' || e.type === 'touchend') return;
    e.preventDefault();
    e.stopPropagation();
    
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  }, [isRecording, startVoiceRecording, stopVoiceRecording]);

  // ==================== DOWNLOAD MEDIA ====================
  const downloadMedia = useCallback((url, fileName) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMessage('Download started');
    setTimeout(() => setSuccessMessage(''), 2000);
  }, []);

  // ==================== MEDIA VIEWERS ====================
  const openImageViewer = useCallback((imageData) => {
    setImageViewer(imageData);
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewer(null);
  }, []);

  const openVoicePlayer = useCallback((voiceData) => {
    setVoicePlayer(voiceData);
  }, []);

  const closeVoicePlayer = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setVoicePlayer(null);
    setPlayingVoiceId(null);
  }, []);

  // ==================== DM FUNCTIONS ====================
  const createDM = useCallback((targetUser) => {
    if (!targetUser || targetUser === usernameRef.current) {
      setErrorMessage('Cannot start DM with yourself');
      return;
    }
    if (blockedUsers.includes(targetUser)) {
      setErrorMessage('Unblock this user first');
      return;
    }
    
    const dmRoom = [username, targetUser].sort().join('_dm_');
    const previousRoomId = roomRef.current;
    
    setRooms(prev => {
      if (prev.some(r => r.id === dmRoom)) return prev;
      return [...prev, { id: dmRoom, name: targetUser, type: 'dm', with: targetUser }];
    });
    
    setActiveRoom(dmRoom);
    setRoom(dmRoom);
    subscribedRoomsRef.current.add(dmRoom);
    
    socketRef.current.emit("join_room", { room: dmRoom, username: usernameRef.current, active: true, fetchHistory: true });
    
    setMessage(roomDrafts[dmRoom] || '');
    setShowRoomSidebar(false);
    setShowProfileModal(null);
  }, [username, rooms, roomDrafts, blockedUsers]);

  const switchRoom = useCallback((roomId) => {
    const previousRoomId = roomRef.current;
    
    setActiveRoom(roomId);
    setRoom(roomId);
    subscribedRoomsRef.current.add(roomId);
    
    socketRef.current.emit("join_room", { room: roomId, username: usernameRef.current, active: true, fetchHistory: true });
    
    if (!roomId.includes('_dm_')) {
      socketRef.current.emit('room_policy_request', { room: roomId, actor: usernameRef.current });
    }
    
    setChat([]);
    setMessage(roomDrafts[roomId] || '');
    const roomUsers = roomUserMap[roomId];
    setOnlineUsers(Array.isArray(roomUsers) ? roomUsers : []);
    setNotificationItems(prev => prev.filter(entry => entry.room !== roomId));
    setShowRoomSidebar(false);
  }, [roomUserMap, roomDrafts]);

  const joinGroupRoomFromPanel = useCallback(() => {
    const nextRoomId = newRoomIdInput.trim();
    if (!nextRoomId) return;

    if (nextRoomId.includes('_dm_')) {
      setErrorMessage('Use Conversations tab for DMs');
      return;
    }

    setRooms(prev => {
      if (prev.some(r => r.id === nextRoomId)) return prev;
      return [{ id: nextRoomId, name: nextRoomId, type: 'group' }, ...prev];
    });

    setGroupRoomId(nextRoomId);
    setNewRoomIdInput('');
    switchRoom(nextRoomId);
  }, [newRoomIdInput, switchRoom]);

  // ==================== BLOCK/REPORT ====================
  const blockUserAction = useCallback((targetUser) => {
    if (!targetUser || targetUser === usernameRef.current) return;
    socketRef.current?.emit('block_user', { actor: usernameRef.current, target: targetUser }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setBlockedUsers(prev => prev.includes(targetUser) ? prev : [...prev, targetUser]);
      setSuccessMessage(`${targetUser} blocked`);
    });
  }, []);

  const unblockUserAction = useCallback((targetUser) => {
    if (!targetUser) return;
    socketRef.current?.emit('unblock_user', { actor: usernameRef.current, target: targetUser }, () => {
      setBlockedUsers(prev => prev.filter(u => u !== targetUser));
      setSuccessMessage(`${targetUser} unblocked`);
    });
  }, []);

  const reportUserAction = useCallback((targetUser) => {
    if (!targetUser || targetUser === usernameRef.current) return;
    socketRef.current?.emit('report_user', {
      actor: usernameRef.current,
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
    });
  }, []);

  // ==================== ROOM ADMIN ====================
  const toggleRoomMute = useCallback((roomId) => {
    setNotificationPrefs(prev => ({
      ...prev,
      mutedRooms: prev.mutedRooms.includes(roomId)
        ? prev.mutedRooms.filter(r => r !== roomId)
        : [...prev.mutedRooms, roomId]
    }));
  }, []);

  const updateCurrentRoomPolicy = useCallback((nextPolicy) => {
    const activeRoomId = roomRef.current;
    if (!activeRoomId || activeRoomId.includes('_dm_')) return;
    socketRef.current?.emit('room_set_policy', {
      room: activeRoomId,
      actor: usernameRef.current,
      ...nextPolicy
    });
  }, []);

  const inviteUserToCurrentRoom = useCallback(() => {
    const target = roomInviteTarget.trim();
    if (!target || !roomRef.current || roomRef.current.includes('_dm_')) return;
    socketRef.current?.emit('room_invite_user', {
      room: roomRef.current,
      actor: usernameRef.current,
      target
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setSuccessMessage(`Invited ${target}`);
      setRoomInviteTarget('');
    });
  }, [roomInviteTarget]);

  const removeUserFromCurrentRoom = useCallback((targetUser) => {
    if (!targetUser || !roomRef.current || roomRef.current.includes('_dm_')) return;
    socketRef.current?.emit('room_remove_user', {
      room: roomRef.current,
      actor: usernameRef.current,
      target: targetUser
    });
  }, []);

  const promoteModInCurrentRoom = useCallback((targetUser) => {
    if (!targetUser || !roomRef.current || roomRef.current.includes('_dm_')) return;
    socketRef.current?.emit('room_grant_mod', {
      room: roomRef.current,
      actor: usernameRef.current,
      target: targetUser
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        return;
      }
      setSuccessMessage(`${targetUser} is now a moderator`);
    });
  }, []);

  // ==================== MARK AS READ ====================
  const markCurrentRoomAsRead = useCallback(() => {
    const unreadIds = chat.filter(m => m.sender !== usernameRef.current && !m.readBy?.includes(usernameRef.current))
      .map(m => m._id);
    if (unreadIds.length > 0 && socketRef.current) {
      socketRef.current.emit('mark_read', { messageIds: unreadIds, username: usernameRef.current, room: roomRef.current });
    }
    setUnreadCount(0);
  }, [chat]);

  // ==================== PWA INSTALL ====================
  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsAppInstalled(true);
    }
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }, [deferredPrompt]);

  // ==================== LOGOUT ====================
  const performLogout = useCallback(() => {
    console.log('🚪 Logging out...');

    if (liveStreamInfoRef.current?.isHost) {
      socketRef.current?.emit(LIVESTREAM_EVENTS.STOP, {
        sessionId: liveStreamInfoRef.current.sessionId,
        host: usernameRef.current
      });
    }

    livestreamHostPeersRef.current.forEach(pc => pc.close());
    livestreamHostPeersRef.current.clear();
    if (livestreamViewerPeerRef.current) livestreamViewerPeerRef.current.close();
    if (livestreamLocalStreamRef.current) {
      livestreamLocalStreamRef.current.getTracks().forEach(t => t.stop());
    }

    if (socketRef.current) {
      socketRef.current.emit('update_status', { username: usernameRef.current, status: 'offline' });
      socketRef.current.emit('user_logout', { username: usernameRef.current, room: roomRef.current });
      socketRef.current.disconnect();
    }
    
    sessionStorage.removeItem('chatUsername');
    sessionStorage.removeItem('chatRoom');
    setUsername('');
    setRoom('');
    setShowChat(false);
    setChat([]);
    setOnlineUsers([]);
    setRoomUserMap({});
    setNotificationItems([]);
    setConnected(false);
    setShowLogoutConfirm(false);
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(true);
    setShowMenuDropdown(false);
  }, []);

  // ==================== WEBRTC FUNCTIONS ====================
  const runtimeConnectionInfo = useMemo(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: conn?.effectiveType,
      downlink: conn?.downlink,
      rtt: conn?.rtt,
      saveData: conn?.saveData
    };
  }, []);

  const iceServersConfig = useMemo(() => ({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: getAdaptiveIceTransportPolicy({ userAgent: navigator.userAgent, connectionInfo: runtimeConnectionInfo })
  }), [runtimeConnectionInfo]);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
  }, []);

  const waitForIceGatheringComplete = useCallback((pc, timeoutMs = 3500) => {
    if (!pc || pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        clearTimeout(timer);
        resolve();
      };
      const onStateChange = () => pc.iceGatheringState === 'complete' && finish();
      const timer = setTimeout(finish, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onStateChange);
    });
  }, []);

  const checkPermissions = useCallback(async (type) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const constraints = type === 'video' ? { video: true, audio: true } : { audio: true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (err) {
      console.error('Permission check failed:', err);
      return false;
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (ringtoneAudioContextRef.current) {
      ringtoneAudioContextRef.current.close().catch(() => {});
      ringtoneAudioContextRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    if (!soundEnabledRef.current || ringtoneStyle === 'off') return;

    stopRingtone();

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const context = new AudioCtx();
    ringtoneAudioContextRef.current = context;

    const volume = Math.min(1, Math.max(0.05, ringtoneVolume));
    const profiles = {
      soft: { sequence: [523.25, 659.25], noteMs: 180, gapMs: 120, repeatMs: 1700, gain: 0.012 },
      chime: { sequence: [392.0, 523.25, 659.25], noteMs: 160, gapMs: 100, repeatMs: 1800, gain: 0.015 },
      pulse: { sequence: [440.0, 440.0], noteMs: 140, gapMs: 140, repeatMs: 1200, gain: 0.01 }
    };

    const profile = profiles[ringtoneStyle] || profiles.soft;

    const playTone = (freq, durMs, delayMs, gainFactor) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime + delayMs / 1000);
      gain.gain.setValueAtTime(0.0001, context.currentTime + delayMs / 1000);
      gain.gain.exponentialRampToValueAtTime(gainFactor * volume, context.currentTime + delayMs / 1000 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (delayMs + durMs) / 1000);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(context.currentTime + delayMs / 1000);
      osc.stop(context.currentTime + (delayMs + durMs) / 1000 + 0.02);
    };

    const playSequence = () => {
      profile.sequence.forEach((freq, idx) => {
        const delay = idx * (profile.noteMs + profile.gapMs);
        playTone(freq, profile.noteMs, delay, profile.gain);
      });
    };

    playSequence();
    ringtoneIntervalRef.current = setInterval(playSequence, profile.repeatMs);
  }, [ringtoneStyle, ringtoneVolume, stopRingtone]);

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const formatCallDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const createPeerConnection = useCallback((targetUsername, options = {}) => {
    debugLog('🔧 Creating peer connection for:', targetUsername);
    
    inboundRemoteStreamRef.current = new MediaStream();
    remoteStreamRef.current = inboundRemoteStreamRef.current;
    setRemoteStream(inboundRemoteStreamRef.current);
    
    const pc = new RTCPeerConnection(iceServersConfig);
    
    const stats = new CallStatistics();
    callStatsRef.current = stats;

    const qualityController = new AdaptiveQualityController(pc);
    qualityControllerRef.current = qualityController;
    qualityController.start();

    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY_SECONDS = 2;

    const clearReconnectTimers = () => {
      if (reconnectCountdownRef.current) clearInterval(reconnectCountdownRef.current);
      if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);
      reconnectCountdownRef.current = null;
      reconnectRetryTimeoutRef.current = null;
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && targetUsername) {
        socketRef.current.emit(CALL_EVENTS.ICE_CANDIDATE, {
          to: targetUsername,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('🎥 Remote track:', event.track.kind);
      
      if (remoteTrackTimeoutRef.current) {
        clearTimeout(remoteTrackTimeoutRef.current);
        remoteTrackTimeoutRef.current = null;
      }
      
      try {
        let stream = inboundRemoteStreamRef.current;
        if (!stream) {
          stream = new MediaStream();
          inboundRemoteStreamRef.current = stream;
        }

        if (event.track && !stream.getTracks().some(t => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }

        if (event.streams?.length > 0) {
          event.streams[0].getTracks().forEach(track => {
            if (!stream.getTracks().some(t => t.id === track.id)) {
              stream.addTrack(track);
            }
          });
        }

        setRemoteStream(stream);
        remoteStreamRef.current = stream;
        attachRemoteStreamToElement();
      } catch (err) {
        console.error('Error handling track:', err);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      debugLog('Connection state:', state);
      setPeerConnectionState(state || 'new');
      
      if (state === 'connected') {
        reconnectAttempts = 0;
        clearReconnectTimers();
        setReconnectInfo(null);
        setCallError(null);
        
        if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
        statsUpdateIntervalRef.current = setInterval(async () => {
          if (callStatsRef.current && peerConnectionRef.current === pc) {
            await callStatsRef.current.updateStats(pc);
            setQualityIndicator(getQualityIndicator(callStatsRef.current));
            setConnectionQuality(callStatsRef.current.getQualityLabel());
          }
        }, 1000);
      } else if (state === 'failed' || state === 'disconnected') {
        debugLog(`Connection ${state} - Attempting recovery`);
        if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);

        if (reconnectRetryTimeoutRef.current) return;
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          debugLog(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
          
          let secondsLeft = RECONNECT_DELAY_SECONDS;
          setReconnectInfo({ attempt: reconnectAttempts, max: MAX_RECONNECT_ATTEMPTS, secondsLeft });
          setCallError(`Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

          reconnectCountdownRef.current = setInterval(() => {
            secondsLeft -= 1;
            setReconnectInfo(prev => prev ? { ...prev, secondsLeft: Math.max(secondsLeft, 0) } : prev);
            if (secondsLeft <= 0 && reconnectCountdownRef.current) {
              clearInterval(reconnectCountdownRef.current);
              reconnectCountdownRef.current = null;
            }
          }, 1000);

          reconnectRetryTimeoutRef.current = setTimeout(() => {
            try {
              if (!socketRef.current || !targetUsername || !pc) return;

              pc.createOffer({ iceRestart: true })
                .then(restartOffer => pc.setLocalDescription(restartOffer).then(() => restartOffer))
                .then(restartOffer => {
                  socketRef.current.emit(CALL_EVENTS.OFFER, {
                    to: targetUsername,
                    from: usernameRef.current,
                    callType: options.callKind || 'video',
                    offer: restartOffer,
                    renegotiate: true
                  });
                })
                .catch(restartErr => {
                  console.error('ICE restart failed:', restartErr);
                  setCallError('Connection failed');
                  endCall();
                });
            } catch (err) {
              console.error('Failed to restart ICE:', err);
              endCall();
            } finally {
              reconnectRetryTimeoutRef.current = null;
            }
          }, RECONNECT_DELAY_SECONDS * 1000);
        } else {
          clearReconnectTimers();
          setReconnectInfo(null);
          setCallError('Connection lost');
          endCall();
        }
      } else if (state === 'closed') {
        if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
        clearReconnectTimers();
        setReconnectInfo(null);
        qualityController.stop();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      debugLog('ICE state:', iceState);
      setIceConnectionState(iceState || 'new');
      if (iceState === 'failed') setCallError('Network connection failed');
    };

    pc.onsignalingstatechange = () => {
      debugLog('Signaling state:', pc.signalingState);
      setSignalingState(pc.signalingState || 'stable');
    };

    pc.onerror = (err) => {
      console.error('Peer connection error:', err);
      setCallError(`Connection error: ${err.message}`);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [iceServersConfig, attachRemoteStreamToElement]);

  const closeLivestreamHostPeer = useCallback((viewerUsername) => {
    const pc = livestreamHostPeersRef.current.get(viewerUsername);
    if (pc) {
      pc.close();
      livestreamHostPeersRef.current.delete(viewerUsername);
    }
  }, []);

  const closeLivestreamViewerPeer = useCallback(() => {
    if (livestreamViewerPeerRef.current) {
      livestreamViewerPeerRef.current.close();
      livestreamViewerPeerRef.current = null;
    }
    if (inboundRemoteStreamRef.current) {
      inboundRemoteStreamRef.current.getTracks().forEach(t => t.stop());
      inboundRemoteStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    setRemoteStream(null);
  }, []);

  const applyLivestreamIncomingTrack = useCallback((event) => {
    const incomingStream = event.streams?.[0];
    if (incomingStream) {
      const normalizedStream = new MediaStream();
      const videoTrack = incomingStream.getVideoTracks()[0];
      const audioTrack = incomingStream.getAudioTracks()[0];
      if (videoTrack) normalizedStream.addTrack(videoTrack);
      if (audioTrack) normalizedStream.addTrack(audioTrack);
      inboundRemoteStreamRef.current = normalizedStream;
      remoteStreamRef.current = normalizedStream;
      setRemoteStream(normalizedStream);
      attachRemoteStreamToElement();
      return;
    }

    if (!inboundRemoteStreamRef.current) {
      inboundRemoteStreamRef.current = new MediaStream();
    }

    const aggregatedStream = inboundRemoteStreamRef.current;
    if (!aggregatedStream.getTracks().some(t => t.id === event.track.id)) {
      aggregatedStream.addTrack(event.track);
    }

    remoteStreamRef.current = aggregatedStream;
    setRemoteStream(new MediaStream(aggregatedStream.getTracks()));
    attachRemoteStreamToElement();
  }, [attachRemoteStreamToElement]);

  const joinLivestreamAsViewer = useCallback(async ({ sessionId, host, offer, visibility = 'room', source = 'camera', room = null, autoJoined = false }) => {
    if (!sessionId || !host || !offer || !socketRef.current) return;

    closeLivestreamViewerPeer();

    const viewerPc = new RTCPeerConnection(iceServersConfig);
    livestreamViewerPeerRef.current = viewerPc;

    viewerPc.ontrack = applyLivestreamIncomingTrack;

    viewerPc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit(LIVESTREAM_EVENTS.ICE_CANDIDATE, {
          sessionId,
          to: host,
          from: usernameRef.current,
          candidate: event.candidate
        });
      }
    };

    viewerPc.addTransceiver('video', { direction: 'recvonly' });
    viewerPc.addTransceiver('audio', { direction: 'recvonly' });

    await viewerPc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await viewerPc.createAnswer();
    await viewerPc.setLocalDescription(answer);
    await waitForIceGatheringComplete(viewerPc, 4000);

    socketRef.current.emit(LIVESTREAM_EVENTS.ANSWER, {
      sessionId,
      to: host,
      from: usernameRef.current,
      answer: viewerPc.localDescription || answer
    });

    viewerPc.onconnectionstatechange = () => {
      if (viewerPc.connectionState === 'failed' || viewerPc.connectionState === 'disconnected') {
        socketRef.current?.emit(LIVESTREAM_EVENTS.JOIN_REQUEST, { sessionId, from: usernameRef.current });
      }
    };

    setLiveStreamInfo({
      sessionId,
      host,
      room,
      visibility,
      source,
      isHost: false,
      autoJoined
    });
    setLivestreamComments([]);
    setLivestreamCommentInput('');
    setCallType('video');
    setCallPeer({ username: `${host} • LIVE`, userId: host });
    setCallState('active');
    startCallTimer();
  }, [applyLivestreamIncomingTrack, closeLivestreamViewerPeer, iceServersConfig, startCallTimer, waitForIceGatheringComplete]);

  const createLivestreamHostPeer = useCallback(async (viewerUsername, sessionId, stream) => {
    if (!viewerUsername || !sessionId || !stream || !socketRef.current) return;

    const pc = new RTCPeerConnection(iceServersConfig);
    livestreamHostPeersRef.current.set(viewerUsername, pc);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit(LIVESTREAM_EVENTS.ICE_CANDIDATE, {
          sessionId,
          to: viewerUsername,
          from: usernameRef.current,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && typeof pc.restartIce === 'function') {
        pc.restartIce();
      }
      if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        closeLivestreamHostPeer(viewerUsername);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc, 4000);

    socketRef.current.emit(LIVESTREAM_EVENTS.OFFER, {
      sessionId,
      to: viewerUsername,
      from: usernameRef.current,
      offer: pc.localDescription || offer
    });
  }, [closeLivestreamHostPeer, iceServersConfig, waitForIceGatheringComplete]);

  const stopHostedLivestream = useCallback((notifyServer = true) => {
    const activeSession = liveStreamInfoRef.current;
    if (!activeSession?.isHost) return;

    if (notifyServer && socketRef.current && activeSession.sessionId) {
      socketRef.current.emit(LIVESTREAM_EVENTS.STOP, {
        sessionId: activeSession.sessionId,
        host: usernameRef.current
      });
    }

    livestreamHostPeersRef.current.forEach(pc => pc.close());
    livestreamHostPeersRef.current.clear();

    if (livestreamLocalStreamRef.current) {
      livestreamLocalStreamRef.current.getTracks().forEach(t => t.stop());
      livestreamLocalStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    inboundRemoteStreamRef.current = null;
    setCallState('idle');
    setCallType(null);
    setCallPeer(null);
    setCallDuration(0);
    stopCallTimer();
    setLiveStreamInfo(null);
    setLivestreamComments([]);
    setLivestreamCommentInput('');
    setSuccessMessage('Livestream stopped');
  }, [stopCallTimer]);

  const buildLivestreamSourceStream = useCallback(async (sourceMode) => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let source = sourceMode === 'screen' ? 'screen' : (sourceMode === 'both' ? 'both' : 'camera');

    if (!navigator.mediaDevices) throw new Error('Media devices not supported');

    if (source === 'both' && !isMobile && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        const cameraConstraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
          callType: 'video',
          userAgent: navigator.userAgent,
          connectionInfo: runtimeConnectionInfo
        }));
        const cameraStream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const composedStream = new MediaStream();
        cameraStream.getTracks().forEach(t => composedStream.addTrack(t));
        displayStream.getTracks().forEach(t => composedStream.addTrack(t));
        refreshVideoInputs();
        return { stream: composedStream, source: 'both' };
      } catch (err) {
        source = 'camera';
      }
    }

    if (source === 'screen') {
      if (isMobile || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        source = 'camera';
      } else {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          const composedStream = new MediaStream();
          displayStream.getVideoTracks().forEach(t => composedStream.addTrack(t));
          if (displayStream.getAudioTracks().length > 0) {
            displayStream.getAudioTracks().forEach(t => composedStream.addTrack(t));
          } else {
            try {
              const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              micStream.getAudioTracks().forEach(t => composedStream.addTrack(t));
            } catch {}
          }
          refreshVideoInputs();
          return { stream: composedStream, source };
        } catch (err) {
          source = 'camera';
        }
      }
    }

    const constraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
      callType: 'video',
      userAgent: navigator.userAgent,
      connectionInfo: runtimeConnectionInfo
    }));

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      refreshVideoInputs();
      return { stream: cameraStream, source: 'camera' };
    } catch {
      const fallbackConstraints = withPreferredVideoDevice(getFallbackMediaConstraints('video'));
      const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      refreshVideoInputs();
      return { stream: fallbackStream, source: 'camera' };
    }
  }, [runtimeConnectionInfo, withPreferredVideoDevice, refreshVideoInputs]);

  const startLivestream = useCallback(async (visibilityMode, sourceMode = 'camera') => {
    if (livestreamLocalStreamRef.current) {
      livestreamLocalStreamRef.current.getTracks().forEach(t => t.stop());
      livestreamLocalStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(t => t.stop());
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    const visibility = visibilityMode === 'public' ? 'public' : 'room';
    const source = sourceMode === 'screen' ? 'screen' : 'camera';
    const activeRoomId = roomRef.current || room;

    if (!socketRef.current || !connected) {
      setCallError('Connecting to chat...');
      return;
    }

    if (!activeRoomId || activeRoomId.includes('_dm_')) {
      setCallError('Livestream is available only in group rooms');
      return;
    }

    if (callStateRef.current === 'active' || callStateRef.current === 'calling' || callStateRef.current === 'ringing') {
      setCallError('End current call first');
      return;
    }

    if (liveStreamInfoRef.current?.isHost) {
      setCallError('You already have an active livestream');
      return;
    }

    try {
      const { stream } = await buildLivestreamSourceStream(source);

      if (source === 'screen') {
        const displayTrack = stream.getVideoTracks()[0];
        if (displayTrack) {
          displayTrack.onended = () => {
            if (liveStreamInfoRef.current?.isHost) stopHostedLivestream(true);
          };
        }
      }

      livestreamLocalStreamRef.current = stream;
      setLocalStream(stream);
      setRemoteStream(stream);
      inboundRemoteStreamRef.current = stream;

      socketRef.current.emit(LIVESTREAM_EVENTS.START, {
        host: usernameRef.current,
        room: activeRoomId,
        visibility,
        source
      }, async (ack) => {
        if (!ack?.success || !ack.sessionId) {
          stream.getTracks().forEach(t => t.stop());
          livestreamLocalStreamRef.current = null;
          setCallError(ack?.error || 'Failed to start livestream');
          return;
        }

        setLiveStreamInfo({
          sessionId: ack.sessionId,
          host: usernameRef.current,
          room: activeRoomId,
          visibility,
          source,
          hasAudio: stream.getAudioTracks().length > 0,
          isHost: true,
          autoJoined: false,
          viewers: [],
          viewerCount: 0
        });

        setCallType('video');
        setCallPeer({ username: `${usernameRef.current} • LIVE`, userId: usernameRef.current });
        setCallState('active');
        startCallTimer();

        const targets = Array.isArray(ack.targets) ? ack.targets : [];
        await Promise.allSettled(targets.map(v => createLivestreamHostPeer(v, ack.sessionId, stream)));

        setSuccessMessage(`🔴 Livestream started (${visibility})`);
      });
    } catch (err) {
      setCallError(err?.message || 'Unable to access camera/microphone');
    }
  }, [room, connected, createLivestreamHostPeer, buildLivestreamSourceStream, stopHostedLivestream, startCallTimer]);

  const sendLivestreamComment = useCallback(() => {
    const activeSession = liveStreamInfoRef.current;
    const text = livestreamCommentInput.trim();
    if (!activeSession?.sessionId || !socketRef.current || !text) return;
    socketRef.current.emit(LIVESTREAM_EVENTS.COMMENT, {
      sessionId: activeSession.sessionId,
      from: usernameRef.current,
      text
    });
    setLivestreamCommentInput('');
  }, [livestreamCommentInput]);

  const sendLivestreamReaction = useCallback((emoji) => {
    const activeSession = liveStreamInfoRef.current;
    if (!activeSession?.sessionId || !socketRef.current || !emoji) return;
    socketRef.current.emit(LIVESTREAM_EVENTS.REACTION, {
      sessionId: activeSession.sessionId,
      from: usernameRef.current,
      emoji
    });
  }, []);

  const requestJoinLivestreamFromNotification = useCallback((notification) => {
    if (!notification?.sessionId || !socketRef.current) return;
    if (liveStreamInfoRef.current?.sessionId === notification.sessionId) {
      setSuccessMessage(`Already in ${notification.sender}'s stream`);
      return;
    }
    socketRef.current.emit(LIVESTREAM_EVENTS.JOIN_REQUEST, {
      sessionId: notification.sessionId,
      from: usernameRef.current
    });
  }, []);

  const startCall = useCallback(async (type, targetUser) => {
    if (!targetUser || !socketRef.current) {
      setCallError('Unable to initiate call');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError('Your browser does not support calls');
      return;
    }

    try {
      pendingIceCandidatesRef.current = [];
      seenIceCandidateKeysRef.current.clear();
      setCallType(type);
      setCallPeer({ username: targetUser, userId: targetUser });
      setCallState('calling');
      setCallError(null);

      const hasPermission = await checkPermissions(type);
      if (!hasPermission) {
        setCallError(`Please grant ${type} permissions`);
        setCallState('idle');
        return;
      }

      const constraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      }));

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaErr) {
        const fallbackConstraints = withPreferredVideoDevice(getFallbackMediaConstraints(type));
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      refreshVideoInputs();

      stream.getTracks().forEach(t => t.enabled = true);
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(targetUser, { callKind: type });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await optimizeRtpSenders(pc, {
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      const shouldRecord = localStorage.getItem('autoRecordCalls') === 'true';
      if (shouldRecord && type === 'voice') {
        try {
          callRecorderRef.current = new CallRecorder();
          callRecorderRef.current.start(stream);
          setIsCallRecording(true);
        } catch (recErr) {
          console.warn('Recording init failed:', recErr);
        }
      }

      let offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const isMobileCaller = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobileCaller) {
        await waitForIceGatheringComplete(pc, 4000);
        offer = pc.localDescription || offer;
      }

      socketRef.current.emit(CALL_EVENTS.OFFER, {
        to: targetUser,
        from: username,
        callType: type,
        offer: offer
      });

      clearCallTimeout();
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          setCallError('No answer');
          endCall();
        }
      }, 30000);

      setTimeout(() => {
        if (callStateRef.current === 'calling') playRingtone();
      }, 200);

    } catch (err) {
      console.error('Error starting call:', err);
      let errorMsg = `Failed to start ${type} call`;
      if (err.name === 'NotAllowedError') errorMsg = `Please allow ${type} access`;
      else if (err.name === 'NotFoundError') errorMsg = `No ${type === 'video' ? 'camera' : 'microphone'} found`;
      else errorMsg = err.message || errorMsg;
      
      setCallError(errorMsg);
      setCallState('idle');
      stopRingtone();
      clearCallTimeout();
    }
  }, [username, createPeerConnection, playRingtone, stopRingtone, checkPermissions, clearCallTimeout, waitForIceGatheringComplete, withPreferredVideoDevice, refreshVideoInputs]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) return;

    if (incomingCall.isLivestream) {
      socketRef.current.emit(LIVESTREAM_EVENTS.DECLINE, {
        sessionId: incomingCall.sessionId,
        to: incomingCall.from,
        from: username
      });
    } else {
      socketRef.current.emit(CALL_EVENTS.REJECT, {
        to: incomingCall.from,
        from: username
      });
    }

    stopRingtone();
    clearCallTimeout();
    setIncomingCall(null);
  }, [incomingCall, username, stopRingtone, clearCallTimeout]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !socketRef.current) return;

    if (incomingCall.isLivestream) {
      stopRingtone();
      try {
        await joinLivestreamAsViewer({
          sessionId: incomingCall.sessionId,
          host: incomingCall.from,
          offer: incomingCall.offer,
          visibility: incomingCall.visibility || 'room',
          source: incomingCall.source || 'camera',
          room: incomingCall.room || null,
          autoJoined: false
        });
        setIncomingCall(null);
      } catch (err) {
        console.error('Failed to join livestream:', err);
        setCallError('Failed to join livestream');
        setIncomingCall(null);
      }
      return;
    }

    stopRingtone();

    try {
      const callerUsername = incomingCall.from;
      console.log('Answering call from:', callerUsername);
      
      pendingIceCandidatesRef.current = [];
      seenIceCandidateKeysRef.current.clear();
      clearCallTimeout();
      
      setCallType(incomingCall.callType);
      setCallPeer({ username: callerUsername, userId: callerUsername });

      const constraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      }));

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaErr) {
        const fallbackConstraints = withPreferredVideoDevice(getFallbackMediaConstraints(incomingCall.callType));
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      refreshVideoInputs();

      stream.getTracks().forEach(t => t.enabled = true);
      setLocalStream(stream);

      if (localVideoRef.current && incomingCall.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const stats = new CallStatistics();
      callStatsRef.current = stats;
      setCallStats(stats.getStats());

      const pc = createPeerConnection(callerUsername, { callKind: incomingCall.callType });
      peerConnectionRef.current = pc;

      const qualityController = new AdaptiveQualityController(pc);
      qualityControllerRef.current = qualityController;
      qualityController.start();

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await optimizeRtpSenders(pc, {
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      if (pendingIceCandidatesRef.current.length > 0) {
        const failedCandidates = [];
        for (const candidate of pendingIceCandidatesRef.current) {
          if (!candidate?.candidate) continue;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (iceError) {
            failedCandidates.push(candidate);
          }
        }
        pendingIceCandidatesRef.current = failedCandidates;
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const shouldRecord = localStorage.getItem('autoRecordCalls') === 'true';
      if (shouldRecord && incomingCall.callType === 'video') {
        try {
          callRecorderRef.current = new CallRecorder();
          callRecorderRef.current.start(stream);
          setIsCallRecording(true);
        } catch (recErr) {
          console.warn('Recording init failed:', recErr);
        }
      }

      socketRef.current.emit(CALL_EVENTS.ANSWER, {
        to: callerUsername,
        from: username,
        answer: answer
      });

      if (remoteTrackTimeoutRef.current) clearTimeout(remoteTrackTimeoutRef.current);
      remoteTrackTimeoutRef.current = setTimeout(() => {
        if (remoteStreamRef.current?.getTracks().length === 0 && peerConnectionRef.current) {
          try { peerConnectionRef.current.restartIce(); } catch {}
        }
      }, 10000);

      if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
      statsUpdateIntervalRef.current = setInterval(async () => {
        if (stats && pc && pc.connectionState === 'connected') {
          await stats.updateStats(pc);
          setCallStats(stats.getStats());
          setQualityIndicator(getQualityIndicator(stats));
          setConnectionQuality(stats.getQualityLabel());
        }
      }, 1000);

      setIncomingCall(null);
      setCallState('active');
      startCallTimer();

    } catch (err) {
      console.error('Error answering call:', err);
      setCallError(err.message || 'Failed to answer call');
      rejectCall();
    }
  }, [incomingCall, username, createPeerConnection, startCallTimer, stopRingtone, rejectCall, clearCallTimeout, runtimeConnectionInfo, withPreferredVideoDevice, refreshVideoInputs, joinLivestreamAsViewer]);

  const endCall = useCallback((notifyPeer = true) => {
    console.log('Ending call');
    clearCallTimeout();

    const activeStream = liveStreamInfoRef.current;

    if (activeStream?.isHost) {
      stopHostedLivestream(notifyPeer);
    } else if (activeStream && !activeStream.isHost && notifyPeer && socketRef.current) {
      socketRef.current.emit(LIVESTREAM_EVENTS.LEAVE, {
        sessionId: activeStream.sessionId,
        viewer: usernameRef.current
      });
    }

    if (!activeStream && notifyPeer && socketRef.current && callPeer) {
      socketRef.current.emit(CALL_EVENTS.END, {
        to: callPeer.username,
        from: username
      });
    }

    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (remoteStream) remoteStream.getTracks().forEach(t => t.stop());

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (livestreamViewerPeerRef.current) {
      livestreamViewerPeerRef.current.close();
      livestreamViewerPeerRef.current = null;
    }

    if (callRecorderRef.current) {
      callRecorderRef.current.stop();
      callRecorderRef.current = null;
      setIsCallRecording(false);
    }

    if (statsUpdateIntervalRef.current) {
      clearInterval(statsUpdateIntervalRef.current);
      statsUpdateIntervalRef.current = null;
    }

    if (qualityControllerRef.current) {
      qualityControllerRef.current.stop?.();
      qualityControllerRef.current = null;
    }

    if (callStatsRef.current && callHistoryRef.current) {
      try {
        const finalStats = callStatsRef.current.getStats();
        callHistoryRef.current.addCall({
          peer: callPeer?.username || 'Unknown',
          type: callType || 'unknown',
          duration: callDuration,
          timestamp: new Date(),
          stats: finalStats
        });
        setCallHistory(callHistoryRef.current.getCallHistory());
      } catch (err) {
        console.warn('Failed to log call:', err);
      }
      callStatsRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    seenIceCandidateKeysRef.current.clear();
    if (reconnectCountdownRef.current) clearInterval(reconnectCountdownRef.current);
    if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);
    if (remoteTrackTimeoutRef.current) clearTimeout(remoteTrackTimeoutRef.current);
    
    setReconnectInfo(null);
    setPeerConnectionState('new');
    setIceConnectionState('new');
    setSignalingState('stable');

    setCallState('idle');
    setCallType(null);
    setCallPeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    inboundRemoteStreamRef.current = null;
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);
    setIsCallMinimized(false);
    setLocalPreviewSizeIndex(1);
    setLocalPreviewPosition({ x: 20, y: 20 });
    localPreviewMovedRef.current = false;
    setIsDraggingLocalPreview(false);
    setCallDuration(0);
    setCallError(null);
    setCallStats(null);
    setQualityIndicator(null);
    setConnectionQuality('excellent');
    setLiveStreamInfo(null);
    setLivestreamComments([]);
    setLivestreamCommentInput('');
    setLivestreamViewerExpanded(false);
    stopCallTimer();
    stopRingtone();
  }, [localStream, remoteStream, callPeer, username, callType, callDuration, stopCallTimer, stopRingtone, clearCallTimeout, stopHostedLivestream]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream, callType]);

  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current || callType !== 'video' || !callPeer) return;

    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
        }

        await switchBackToCamera(peerConnectionRef.current, localStream);

        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }

        setIsScreenSharing(false);
        
        if (socketRef.current) {
          socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_END, {
            to: callPeer.username,
            from: username
          });
        }
      } else {
        const screenStream = await getScreenStream();
        const screenTrack = await switchToScreenShare(peerConnectionRef.current, screenStream, localStream);
        screenStreamRef.current = screenStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);

        if (socketRef.current) {
          socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_START, {
            to: callPeer.username,
            from: username
          });
        }

        if (screenTrack) {
          screenTrack.onended = async () => {
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks().forEach(t => t.stop());
              screenStreamRef.current = null;
            }
            await switchBackToCamera(peerConnectionRef.current, localStream);
            if (localVideoRef.current && localStream) {
              localVideoRef.current.srcObject = localStream;
            }
            setIsScreenSharing(false);
            if (socketRef.current) {
              socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_END, {
                to: callPeer.username,
                from: username
              });
            }
          };
        }
      }
    } catch (err) {
      console.error('Screen share error:', err);
      setCallError('Screen sharing failed');
    }
  }, [isScreenSharing, localStream, callType, callPeer, username]);

  const toggleCallMinimize = useCallback(() => {
    setIsCallMinimized(prev => !prev);
  }, []);

  const getLocalPreviewSize = useCallback((sizeIndex = localPreviewSizeIndex) => {
    const baseSize = LOCAL_PREVIEW_SIZES[sizeIndex] || LOCAL_PREVIEW_SIZES[1];
    if (!isMobileView) return baseSize;
    const maxMobileWidth = Math.max(112, Math.floor(window.innerWidth * 0.5));
    const width = Math.min(baseSize.width, maxMobileWidth);
    return { width, height: Math.round(width * 0.75) };
  }, [isMobileView, localPreviewSizeIndex]);

  const clampLocalPreviewPosition = useCallback((x, y, size = getLocalPreviewSize()) => {
    const padding = isMobileView ? 6 : 8;
    const maxX = Math.max(padding, window.innerWidth - size.width - padding);
    const maxY = Math.max(padding, window.innerHeight - size.height - padding);
    return {
      x: Math.min(Math.max(padding, x), maxX),
      y: Math.min(Math.max(padding, y), maxY)
    };
  }, [getLocalPreviewSize, isMobileView]);

  useEffect(() => {
    if (callState === 'active' && callType === 'video' && !isCallMinimized && !localPreviewMovedRef.current) {
      const previewSize = getLocalPreviewSize(localPreviewSizeIndex);
      const padding = 20;
      const initialX = Math.max(padding, window.innerWidth - previewSize.width - padding);
      setLocalPreviewPosition({ x: initialX, y: 20 });
    }
  }, [callState, callType, isCallMinimized, localPreviewSizeIndex, getLocalPreviewSize]);

  useEffect(() => {
    if (callState !== 'active' || callType !== 'video' || isCallMinimized) return;
    const handleViewportResize = () => {
      const previewSize = getLocalPreviewSize(localPreviewSizeIndex);
      setLocalPreviewPosition(pos => clampLocalPreviewPosition(pos.x, pos.y, previewSize));
    };
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [callState, callType, isCallMinimized, localPreviewSizeIndex, getLocalPreviewSize, clampLocalPreviewPosition]);

  useEffect(() => {
    if (!isDraggingLocalPreview) return;

    const extractPoint = (event) => {
      if (event.touches?.[0]) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      return { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event) => {
      if (event.cancelable) event.preventDefault();
      const point = extractPoint(event);
      const offset = localPreviewDragOffsetRef.current;
      setLocalPreviewPosition(clampLocalPreviewPosition(point.x - offset.x, point.y - offset.y));
    };

    const onPointerUp = () => setIsDraggingLocalPreview(false);

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [isDraggingLocalPreview, clampLocalPreviewPosition]);

  const startLocalPreviewDrag = useCallback((event) => {
    if (callType !== 'video') return;
    if (event.button != null && event.button !== 0) return;
    if (event.target?.closest?.('.local-video-size-btn')) return;
    if (event.cancelable) event.preventDefault();

    const point = event.touches?.[0]
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: event.clientX, y: event.clientY };

    localPreviewDragOffsetRef.current = {
      x: point.x - localPreviewPosition.x,
      y: point.y - localPreviewPosition.y
    };

    localPreviewMovedRef.current = true;
    setIsDraggingLocalPreview(true);
  }, [callType, localPreviewPosition]);

  const resizeLocalPreview = useCallback((direction) => {
    setLocalPreviewSizeIndex(prev => {
      const next = direction === 'up'
        ? Math.min(prev + 1, LOCAL_PREVIEW_SIZES.length - 1)
        : Math.max(prev - 1, 0);
      const nextSize = getLocalPreviewSize(next);
      setLocalPreviewPosition(pos => clampLocalPreviewPosition(pos.x, pos.y, nextSize));
      return next;
    });
  }, [getLocalPreviewSize, clampLocalPreviewPosition]);

  const toggleRecording = useCallback(async () => {
    try {
      if (isCallRecording && callRecorderRef.current) {
        callRecorderRef.current.stop();
        setIsCallRecording(false);
      } else if (localStream) {
        callRecorderRef.current = new CallRecorder();
        callRecorderRef.current.start(localStream);
        setIsCallRecording(true);
      }
    } catch (err) {
      console.error('Recording error:', err);
      setCallError('Failed to toggle recording');
    }
  }, [isCallRecording, localStream]);

  const applyVideoEffect = useCallback((effect, value) => {
    setVideoEffectSettings(prev => ({ ...prev, [effect]: value }));
  }, []);

  const getCallHistoryData = useCallback(() => {
    if (!callHistoryRef.current) callHistoryRef.current = new CallHistory();
    return callHistoryRef.current.getCallHistory();
  }, []);

  const formatDuration = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }, []);

  const getQualityLabelStyle = useCallback((score) => {
    if (score >= 80) return { color: '#4CAF50', label: 'Excellent' };
    if (score >= 60) return { color: '#8BC34A', label: 'Good' };
    if (score >= 40) return { color: '#FFC107', label: 'Fair' };
    if (score >= 20) return { color: '#FF9800', label: 'Poor' };
    return { color: '#F44336', label: 'Very Poor' };
  }, []);

  const localPreviewSize = getLocalPreviewSize(localPreviewSizeIndex);

  // ==================== MEMOIZED VALUES ====================
  const selectedUser = useMemo(() => {
    const currentRoomId = activeRoom || room;
    if (!currentRoomId) return null;

    const currentRoom = rooms.find(r => r.id === currentRoomId);
    if (currentRoom?.type === 'dm') {
      return currentRoom.with || currentRoom.name || null;
    }

    if (currentRoomId.includes('_dm_')) {
      const participants = currentRoomId.split('_dm_');
      return participants.find(p => p && p !== username) || null;
    }

    return null;
  }, [activeRoom, room, rooms, username]);

  const currentRoomId = activeRoom || room;
  const currentRoomInfo = useMemo(() => rooms.find(r => r.id === currentRoomId) || null, [rooms, currentRoomId]);
  const isGroupRoomActive = useMemo(() => !!currentRoomId && !currentRoomId.includes('_dm_'), [currentRoomId]);

  const globalOnlineUsers = useMemo(() => {
    const fromGlobal = globalPresenceUsers.filter(u => typeof u === 'string' && u.trim());
    const fromStatus = Object.entries(userStatus).filter(([, s]) => s === 'online').map(([u]) => u);
    const fromRooms = Object.values(roomUserMap).flat().filter(u => typeof u === 'string' && u.trim());
    return [...new Set([...fromGlobal, ...fromStatus, ...fromRooms])];
  }, [globalPresenceUsers, userStatus, roomUserMap]);

  const isSelectedUserOnline = useMemo(() => {
    if (!selectedUser) return false;
    return globalOnlineUsers.some(u => u === selectedUser);
  }, [globalOnlineUsers, selectedUser]);

  const roomScopedOnlineUsers = useMemo(() => {
    const activeRoomId = activeRoom || room;
    if (!activeRoomId) return [];
    const users = (roomUserMap[activeRoomId] || [])
      .map(u => typeof u === 'string' ? u : u?.username)
      .filter(u => typeof u === 'string' && u.trim());
    return [...new Set(users)];
  }, [activeRoom, room, roomUserMap]);

  const roomSummaries = useMemo(() => {
    const uniqueRooms = new Map();
    if (groupRoomId) uniqueRooms.set(groupRoomId, { id: groupRoomId, name: groupRoomId, type: 'group' });
    rooms.forEach(r => { if (r?.id && !uniqueRooms.has(r.id)) uniqueRooms.set(r.id, r); });
    activeRoomRegistry.forEach(r => { if (r?.id && !uniqueRooms.has(r.id)) uniqueRooms.set(r.id, { id: r.id, name: r.name || r.id, type: 'group' }); });

    return Array.from(uniqueRooms.values()).map(r => {
      const isGroup = r.type !== 'dm';
      const registryEntry = activeRoomRegistry.find(e => e.id === r.id);
      const registryUsers = Array.isArray(registryEntry?.users) ? registryEntry.users : [];
      const members = ((roomUserMap[r.id] || []).length ? roomUserMap[r.id] : registryUsers)
        .map(u => typeof u === 'string' ? u : u?.username)
        .filter(u => u && u.trim());
      const peer = r.with || r.name;
      const peerCount = isGroup
        ? members.filter(u => u !== username).length
        : (members.includes(peer) || userStatus[peer] === 'online' ? 1 : 0);

      return { ...r, isActive: peerCount > 0, peerCount };
    });
  }, [groupRoomId, rooms, roomUserMap, username, userStatus, activeRoomRegistry]);

  const groupRoomSummaries = useMemo(() => roomSummaries.filter(r => r.type !== 'dm'), [roomSummaries]);
  const activeGroupRoomCount = useMemo(() => groupRoomSummaries.filter(r => r.isActive).length, [groupRoomSummaries]);

  const mediaMessages = useMemo(() => {
    return [...chat]
      .filter(m => ['image', 'voice', 'file'].includes(m.type) && (m.fileUrl || m.text))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [chat]);

  const dmMediaMessages = useMemo(() => {
    if (!(activeRoom || room).includes('_dm_')) return [];
    return mediaMessages;
  }, [mediaMessages, activeRoom, room]);

  const threadMessages = useMemo(() => {
    if (!threadRootId) return [];
    return chat.filter(m => m._id === threadRootId || m.replyTo === threadRootId);
  }, [chat, threadRootId]);

  const threadRootCount = useMemo(() => {
    const repliedIds = new Set(chat.map(m => m.replyTo).filter(Boolean));
    return chat.filter(m => repliedIds.has(m._id)).length;
  }, [chat]);

  const currentRoomPolicy = roomPolicies[currentRoomId] || null;
  const canManageCurrentRoom = useMemo(() => {
    if (!currentRoomPolicy) return false;
    return currentRoomPolicy.owner === username || (currentRoomPolicy.mods || []).includes(username);
  }, [currentRoomPolicy, username]);

  const livestreamControlsDisabled = !isGroupRoomActive || callState === 'active' || callState === 'calling' || callState === 'ringing';
  const livestreamSourceLabel = liveStreamInfo?.source === 'screen' ? 'SCREEN' : (liveStreamInfo?.source ? 'CAMERA' : null);
  const livestreamAudioEnabled = !!(liveStreamInfo && (
    liveStreamInfo.isHost
      ? liveStreamInfo.hasAudio
      : (remoteStream && remoteStream.getAudioTracks().length > 0)
  ));
  const isLivestreamViewer = !!(liveStreamInfo && !liveStreamInfo.isHost);
  const remoteVideoFitMode = isLivestreamViewer ? (livestreamViewerExpanded ? 'cover' : 'contain') : 'cover';

  useEffect(() => {
    if (!showChat || !connected || !socketRef.current || !usernameRef.current) return;
    const roomIds = roomsRef.current.map(e => e.id).filter(Boolean);
    roomIds.forEach(roomId => {
      if (!subscribedRoomsRef.current.has(roomId)) {
        socketRef.current.emit('join_room', {
          room: roomId,
          username: usernameRef.current,
          active: roomId === roomRef.current,
          fetchHistory: false
        });
        subscribedRoomsRef.current.add(roomId);
      }
    });
  }, [showChat, connected, rooms, currentRoomId]);

  useEffect(() => {
    if (!connected || !socketRef.current || !currentRoomId || currentRoomId.includes('_dm_')) return;
    socketRef.current.emit('room_policy_request', { room: currentRoomId, actor: usernameRef.current });
  }, [connected, currentRoomId]);

  useEffect(() => {
    const handleShortcuts = (event) => {
      if (!showChat) return;
      const tag = (event.target?.tagName || '').toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('.search-input')?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setSoundEnabled(prev => !prev);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setShowRoomSidebar(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        markCurrentRoomAsRead();
      }
      if (editing) return;

      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        if (groupRoomSummaries.length === 0) return;
        const current = activeRoom || room;
        const index = groupRoomSummaries.findIndex(e => e.id === current);
        const nextIndex = event.key === 'ArrowUp'
          ? (index <= 0 ? groupRoomSummaries.length - 1 : index - 1)
          : (index >= groupRoomSummaries.length - 1 ? 0 : index + 1);
        const target = groupRoomSummaries[nextIndex]?.id;
        if (target) switchRoom(target);
      }
    };

    document.addEventListener('keydown', handleShortcuts);
    return () => document.removeEventListener('keydown', handleShortcuts);
  }, [showChat, groupRoomSummaries, activeRoom, room, switchRoom, markCurrentRoomAsRead]);

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

  // ==================== RENDER LOGIN SCREEN ====================
  if (!showChat) {
    return (
      <div className="login-screen">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="login-card">
          <Zap color="#00a884" size={48} fill="#00a884" />
          <h2 className="brand">DevChat <span>Pro+</span></h2>
          <div className="input-group"><User size={18}/><input placeholder="Your name" value={username} onChange={e => setUsername(e.target.value)} onKeyPress={e => e.key === 'Enter' && joinRoom()} autoFocus /></div>
          <div className="input-group"><Hash size={18}/><input placeholder="Room ID" value={room} onChange={e => setRoom(e.target.value)} onKeyPress={e => e.key === 'Enter' && joinRoom()} /></div>
          <button className="join-btn" onClick={joinRoom} disabled={!username.trim() || !room.trim()}>Enter Chat</button>
        </motion.div>
      </div>
    );
  }

  // ==================== RENDER CHAT UI ====================
  return (
    <div className="chat-container">
      {/* LiveKit Stream */}
      {liveKitToken && (
        <div className="livestream-fullscreen-container">
          {showMobileMenu && isMobileView && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 11000 }}>
              <AnimatePresence>
                <motion.div 
                  className={`menu-dropdown ${selectedUser ? 'menu-dropdown-dm' : ''}`}
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  style={{ margin: '0 auto', maxWidth: 360 }}
                >
                  <div className="menu-header">Main Menu</div>
                  <button className="menu-item" onClick={() => { exportChat(); setShowMobileMenu(false); }}><FileDown size={18}/><span>Export Chat</span></button>
                  <button className="menu-item" onClick={() => { setShowStarredPanel(true); setShowMobileMenu(false); }}><Star size={18}/><span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span></button>
                  <div className="menu-section">
                    <div className="menu-header">📞 Call Settings</div>
                    <button className="menu-item" onClick={() => { setShowCallSettings(true); setShowMobileMenu(false); }}><Phone size={18}/><span>Call Preferences</span></button>
                    <button className="menu-item" onClick={() => { setShowAudioSettings(true); setShowMobileMenu(false); }}><Volume2 size={18}/><span>Audio Devices</span></button>
                    <button className="menu-item" onClick={() => { setShowVideoSettings(true); setShowMobileMenu(false); }}><Camera size={18}/><span>Video & Camera</span></button>
                    <button className="menu-item" onClick={() => { setShowCallHistory(true); setShowMobileMenu(false); }}><Activity size={18}/><span>Call History</span></button>
                  </div>
                  <div className="menu-section">
                    <div className="menu-header">🎥 Streaming</div>
                    <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, true); setShowMobileMenu(false); }}><Radio size={18}/><span>Start Stream</span></button>
                    <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, false); setShowMobileMenu(false); }}><PlayCircle size={18}/><span>Join Stream</span></button>
                    <button className="menu-item" onClick={() => { setShowStreamSettings(true); setShowMobileMenu(false); }}><Settings size={18}/><span>Stream Settings</span></button>
                  </div>
                  <div className="menu-section">
                    <div className="menu-header">⚙️ General</div>
                    <button className="menu-item" onClick={() => { setShowRoomSidebar(true); setShowMobileMenu(false); }}><Users size={18}/><span>Conversations</span></button>
                    <button className="menu-item" onClick={() => { setCurrentView('rooms'); setShowMobileMenu(false); }}><Hash size={18}/><span>Rooms</span></button>
                    <button className="menu-item" onClick={() => { setCurrentView('notifications'); setShowMobileMenu(false); }}><Bell size={18}/><span>Notifications</span></button>
                    <button className="menu-item" onClick={() => { setShowAppSettings(true); setShowMobileMenu(false); }}><Settings size={18}/><span>App Settings</span></button>
                  </div>
                  <div className="menu-section">
                    <div className="menu-header">📊 Info</div>
                    <div className="menu-item menu-info"><Activity size={18}/><div className="menu-info-content"><span>Stats: {conversationStats.totalMessages} msgs</span><small>{conversationStats.totalUsers} users • {conversationStats.avgMessageLength} chars</small></div></div>
                  </div>
                  <div className="menu-section">
                    <button className="menu-item menu-item-danger" onClick={() => { setShowLogoutConfirm(true); setShowMobileMenu(false); }}><LogOut size={18}/><span>Logout</span></button>
                  </div>
                  <div className="menu-footer"><div>Session ends when browser closes</div><div className="menu-version">v{APP_VERSION} • {new Date(BUILD_DATE).toLocaleDateString()}</div></div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
          <div className="livestream-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Radio size={24} color="var(--error)" className="pulse-animation" />
              <h2 style={{ color: 'var(--txt)', margin: 0, fontSize: '18px' }}>{isStreamHost ? "🔴 You are Live" : `Watching: ${currentStreamRoom}`}</h2>
            </div>
            <button onClick={handleLeaveStream} style={{ background: 'var(--error)', padding: '8px 16px', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Leave Stream</button>
          </div>
          <div style={{ height: 'calc(100vh - 60px)', marginTop: '60px' }}>
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
        </div>
      )}

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallPrompt && !showChat && (
          <motion.div className="install-banner" initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }}>
            <div className="install-content"><Zap size={20} color="#00a884" fill="#00a884" /><span>Install DevChat Pro for the best experience!</span></div>
            <div className="install-actions"><button className="install-btn" onClick={handleInstallClick}>Install</button><button className="dismiss-btn" onClick={() => setShowInstallPrompt(false)}><X size={16} /></button></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header */}
      <div className="chat-header">
        <div className="menu-container" ref={menuContainerRef}>
          <button className="menu-toggle" onClick={() => setShowMenuDropdown(!showMenuDropdown)} title="Menu"><Menu size={24}/></button>
          
          <AnimatePresence>
            {showMenuDropdown && (
              <>
                <motion.div className="menu-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMenuDropdown(false)} />
                <motion.div className={`menu-dropdown ${selectedUser ? 'menu-dropdown-dm' : ''}`} initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}>
                  <div className="menu-header">Main Menu</div>
                  <button className="menu-item" onClick={() => { exportChat(); setShowMenuDropdown(false); }}><FileDown size={18}/><span>Export Chat</span></button>
                  <button className="menu-item" onClick={() => { setShowStarredPanel(true); setShowMenuDropdown(false); }}><Star size={18}/><span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span></button>
                  
                  <div className="menu-section">
                    <div className="menu-header">📞 Call Settings</div>
                    <button className="menu-item" onClick={() => { setShowCallSettings(true); setShowMenuDropdown(false); }}><Phone size={18}/><span>Call Preferences</span></button>
                    <button className="menu-item" onClick={() => { setShowAudioSettings(true); setShowMenuDropdown(false); }}><Volume2 size={18}/><span>Audio Devices</span></button>
                    <button className="menu-item" onClick={() => { setShowVideoSettings(true); setShowMenuDropdown(false); }}><Camera size={18}/><span>Video & Camera</span></button>
                    <button className="menu-item" onClick={() => { setShowCallHistory(true); setShowMenuDropdown(false); }}><Activity size={18}/><span>Call History</span></button>
                  </div>

                  <div className="menu-section">
                    <div className="menu-header">🎥 Streaming</div>
                    <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, true); setShowMenuDropdown(false); }}><Radio size={18}/><span>Start Stream</span></button>
                    <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, false); setShowMenuDropdown(false); }}><PlayCircle size={18}/><span>Join Stream</span></button>
                    <button className="menu-item" onClick={() => { setShowStreamSettings(true); setShowMenuDropdown(false); }}><Settings size={18}/><span>Stream Settings</span></button>
                  </div>

                  <div className="menu-section">
                    <div className="menu-header">⚙️ General</div>
                    <button className="menu-item" onClick={() => { setShowRoomSidebar(true); setShowMenuDropdown(false); }}><Users size={18}/><span>Conversations</span></button>
                    <button className="menu-item" onClick={() => { setCurrentView('rooms'); setShowMenuDropdown(false); }}><Hash size={18}/><span>Rooms</span></button>
                    <button className="menu-item" onClick={() => { setCurrentView('notifications'); setShowMenuDropdown(false); }}><Bell size={18}/><span>Notifications</span></button>
                    <button className="menu-item" onClick={() => { setShowAppSettings(true); setShowMenuDropdown(false); }}><Settings size={18}/><span>App Settings</span></button>
                  </div>

                  <div className="menu-section">
                    <div className="menu-header">📊 Info</div>
                    <div className="menu-item menu-info"><Activity size={18}/><div className="menu-info-content"><span>Stats: {conversationStats.totalMessages} msgs</span><small>{conversationStats.totalUsers} users • {conversationStats.avgMessageLength} chars</small></div></div>
                  </div>

                  <div className="menu-section">
                    <button className="menu-item menu-item-danger" onClick={() => { setShowLogoutConfirm(true); setShowMenuDropdown(false); }}><LogOut size={18}/><span>Logout</span></button>
                  </div>

                  <div className="menu-footer"><div>Session ends when browser closes</div><div className="menu-version">v{APP_VERSION} • {new Date(BUILD_DATE).toLocaleDateString()}</div></div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        
        {currentRoomInfo?.type === 'dm' && groupRoomId && (
          <button className="dm-back-btn" onClick={() => switchRoom(groupRoomId)} title="Back to group chat"><ChevronLeft size={16} /><span>Group</span></button>
        )}

        <div className="meta">
          <h3>{currentRoomInfo?.name || room} <span style={{ fontSize: '11px', opacity: 0.4 }}>v{APP_VERSION}</span></h3>
          <div className="room-info">
            <span className={connected ? "status-on" : "status-off"}>{connected ? <Wifi size={12}/> : <WifiOff size={12}/>} {connected ? "Online" : "Disconnected"}</span>
            <span className="meta-divider">·</span>
            <span className="message-count">{chat.length} messages</span>
            {chat.length > 0 && <><span className="meta-divider">·</span><span className="last-activity">Last: {formatRelativeTime(chat[chat.length - 1]?.time)}</span></>}
          </div>
        </div>

        {selectedUser && isSelectedUserOnline && callState !== 'active' && (
          <div className="call-buttons">
            <button className="call-btn voice-call-btn" onClick={() => startCall('voice', selectedUser)} disabled={callState === 'calling' || callState === 'ringing'}><Phone size={18}/></button>
            <button className="call-btn video-call-btn" onClick={() => startCall('video', selectedUser)} disabled={callState === 'calling' || callState === 'ringing'}><Video size={18}/></button>
          </div>
        )}
        
        <div className="users-info" title={`${onlineUsers.length} online`}><Users size={16}/><span className="users-count">{onlineUsers.length}</span></div>
        <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
        <button className={`sound-toggle ${soundEnabled ? 'enabled' : 'disabled'}`} onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Mute" : "Unmute"}>{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
        <button className="clear-btn" onClick={() => setShowClearConfirm(true)} title="Clear all"><Trash2 size={18}/></button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={18}/>
        <input type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
        {searchQuery && <span className={`search-result-count ${searchResultCount === 0 ? 'zero' : ''}`}>{searchResultCount} result{searchResultCount !== 1 ? 's' : ''}</span>}
        <button className="markdown-toggle" onClick={() => setShowMarkdown(!showMarkdown)} title={showMarkdown ? "Disable markdown" : "Enable markdown"}>{showMarkdown ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
        <button className="markdown-toggle" onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} title="Advanced search"><Settings size={16} /></button>
      </div>

      {/* Advanced Search */}
      {showAdvancedSearch && (currentRoomId || '').includes('_dm_') && (
        <div className="search-bar" style={{ marginTop: 6 }}>
          <MessageSquare size={16} />
          <input type="text" placeholder="Search this DM..." value={dmSearchQuery} onChange={(e) => setDmSearchQuery(e.target.value)} className="search-input" />
          {dmSearchQuery && <button className="markdown-toggle" onClick={() => setDmSearchQuery('')}><X size={16} /></button>}
        </div>
      )}

      {showAdvancedSearch && (
        <div className="search-bar" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select className="search-input" style={{ maxWidth: 160 }} value={searchFilters.sender} onChange={(e) => setSearchFilters(prev => ({ ...prev, sender: e.target.value }))}><option value="">All senders</option>{availableSenders.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <select className="search-input" style={{ maxWidth: 140 }} value={searchFilters.mediaType} onChange={(e) => setSearchFilters(prev => ({ ...prev, mediaType: e.target.value }))}><option value="all">All types</option><option value="text">Text</option><option value="image">Images</option><option value="voice">Voice</option><option value="file">Files</option></select>
          <input type="date" className="search-input" style={{ maxWidth: 150 }} value={searchFilters.fromDate} onChange={(e) => setSearchFilters(prev => ({ ...prev, fromDate: e.target.value }))} />
          <input type="date" className="search-input" style={{ maxWidth: 150 }} value={searchFilters.toDate} onChange={(e) => setSearchFilters(prev => ({ ...prev, toDate: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt-muted)', fontSize: 12 }}><input type="checkbox" checked={searchFilters.mentionsOnly} onChange={(e) => setSearchFilters(prev => ({ ...prev, mentionsOnly: e.target.checked }))} /> Mentions only</label>
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
      <div className="chat-body" ref={chatBodyRef} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
        {isDragging && (
          <div className="drag-drop-overlay">
            <div className="drag-drop-content"><ImageIcon size={48} /><h3>Drop images here</h3></div>
          </div>
        )}
        
        <AnimatePresence>
          {filteredChat.flatMap((msg, index) => {
            const isOwn = msg.sender === username;
            const reactions = msg.reactions || {};
            const grouped = index > 0 && isGroupedMessage(msg, filteredChat[index - 1]);
            const showDateSep = index === 0 || needsDateSeparator(msg.time, filteredChat[index - 1]?.time);
            const isGroupedBelow = index < filteredChat.length - 1 && isGroupedMessage(filteredChat[index + 1], msg);
            const clusterPos = !grouped && isGroupedBelow ? 'cluster-top' : grouped && isGroupedBelow ? 'cluster-mid' : grouped && !isGroupedBelow ? 'cluster-bottom' : '';

            return (
              <React.Fragment key={msg._id || index}>
                {showDateSep && <div className="date-separator"><span className="date-separator-text">{formatDateSeparator(msg.time)}</span></div>}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  id={`msg-${msg._id}`} ref={el => { if (el && msg._id) msgRefsMap.current[msg._id] = el; }}
                  className={`msg-bubble ${isOwn ? "me" : "other"} ${msg.isPinned ? "pinned" : ""} ${grouped ? "grouped" : ""} ${clusterPos}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)} onTouchStart={(e) => handleLongPressStart(e, msg)} onTouchEnd={handleLongPressEnd} onTouchMove={handleLongPressEnd} onTouchCancel={handleLongPressEnd}
                >
                  {msg.isPinned && <Pin size={12} className="pin-icon" />}
                  {starredMsgIds.has(msg._id) && <span className="msg-star-badge"><Star size={10} fill="#FFD700" color="#FFD700"/></span>}
                  {!isOwn && <span className="sender-tag">{msg.sender}</span>}
                  
                  {msg.replyTo && (() => {
                    const repliedMsg = chat.find(c => c._id === msg.replyTo);
                    return repliedMsg ? (
                      <div className="reply-preview" onClick={() => scrollToMessage(msg.replyTo)}>
                        <Reply size={12} />
                        <div className="reply-preview-content">
                          <span className="reply-preview-sender">{repliedMsg.sender}</span>
                          <span className="reply-preview-text">{repliedMsg.type === 'image' ? '📷 Photo' : repliedMsg.type === 'voice' ? '🎤 Voice' : repliedMsg.type === 'file' ? `📎 ${repliedMsg.fileName}` : (repliedMsg.text || '').substring(0, 60)}</span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  
                  {msg.type === 'image' ? (
                    <div className="image-message-wrapper">
                      {msg.fileUrl ? (
                        <>
                          <div className="image-container" onClick={() => openImageViewer({ url: msg.fileUrl, fileName: `image-${new Date(msg.time).getTime()}.jpg`, sender: msg.sender, time: msg.time })}>
                            <img src={msg.fileUrl} className="chat-img" alt="shared" />
                            <div className="image-overlay"><Eye size={20} /><span>Click to View</span></div>
                          </div>
                          <button className="media-download-btn" onClick={(e) => { e.stopPropagation(); downloadMedia(msg.fileUrl, `image-${new Date(msg.time).getTime()}.jpg`); }}><Download size={16} /><span>Download</span></button>
                        </>
                      ) : <div className="media-error"><ImageIcon size={24} /><span>📷 Image not available</span></div>}
                    </div>
                  ) : msg.type === 'file' ? (
                    <a href={msg.fileUrl} download={msg.fileName} className="file-card" onClick={e => e.stopPropagation()}>
                      <div className="file-card-icon"><FileText size={20}/></div>
                      <div className="file-card-info"><span className="file-card-name">{msg.fileName || 'File'}</span><span className="file-card-size">{msg.fileSize ? formatFileSize(msg.fileSize) : 'Download'}</span></div>
                      <Download size={16} />
                    </a>
                  ) : msg.type === 'voice' ? (
                    <div className="voice-message-wrapper">
                      {msg.fileUrl ? (
                        <>
                          <div className="voice-message" onClick={() => openVoicePlayer({ url: msg.fileUrl, fileName: `voice-${new Date(msg.time).getTime()}.webm`, sender: msg.sender, time: msg.time, duration: msg.duration || 0 })}>
                            <button className="voice-play-btn" onClick={(e) => { e.stopPropagation(); playVoiceMessage(msg.fileUrl, msg._id); }}>{playingVoiceId === msg._id ? <Pause size={16}/> : <Play size={16}/>}</button>
                            <div className="voice-waveform"><span className="voice-duration">{msg.duration || 0}s</span></div>
                            <Eye size={16} className="voice-view-icon" />
                          </div>
                          <button className="media-download-btn" onClick={(e) => { e.stopPropagation(); downloadMedia(msg.fileUrl, `voice-${new Date(msg.time).getTime()}.webm`); }}><Download size={16} /><span>Download</span></button>
                        </>
                      ) : <div className="media-error">🎤 Voice message not available</div>}
                    </div>
                  ) : renderMessageText(msg)}
                  
                  {msg.edited && <span className="msg-edited">(edited)</span>}
                  
                  {Object.keys(reactions).length > 0 && (
                    <div className="message-reactions">
                      {Object.entries(reactions).map(([emoji, users]) => (
                        <button key={emoji} className={`reaction-item ${users.includes(username) ? 'reacted' : ''}`} onClick={() => handleReaction(msg._id, emoji)}>{emoji} {users.length}</button>
                      ))}
                    </div>
                  )}
                  
                  <div className="msg-footer">
                    <span className="timestamp" title={new Date(msg.time).toLocaleString()}>{formatRelativeTime(msg.time)}</span>
                    {isOwn && showDoubleTick && (() => {
                      const readers = Array.isArray(msg.readBy) ? msg.readBy : [];
                      const seenByOthers = readers.some(r => r !== username);
                      return <span className={`message-ticks ${(seenByOthers && showBlueTick) ? 'blue' : ''}`}>✓✓</span>;
                    })()}
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {typingUsers.size > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="typing-pill">
              <div className="typing-ellipsis"><span></span><span></span><span></span></div>
              <span className="typing-label">{typingDisplay}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Unread Badge */}
      {unreadCount > 0 && !isAtBottom && (
        <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="unread-badge" onClick={() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); setUnreadCount(0); }}>
          <ChevronDown size={16}/> {unreadCount} new
        </motion.button>
      )}

      {/* Reply Bar */}
      {replyingTo && (
        <div className="replying-bar">
          <Reply size={16} />
          <div><strong>Replying to {replyingTo.sender}</strong><p>{replyingTo.text?.substring(0, 50)}...</p></div>
          <button onClick={() => setReplyingTo(null)}><X size={16} /></button>
        </div>
      )}

      {/* Upload Progress */}
      {(uploadingFile || uploadProgress) && (
        <div className="uploading-bar"><div className="spinner-small"></div><span>{uploadProgress || 'Uploading...'}</span></div>
      )}

      {/* Message Input */}
      <div className="chat-footer">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*" multiple />
        <input type="file" ref={cameraInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*" capture="environment" multiple />
        
        <button className="whatsapp-action-btn" onClick={() => fileInputRef.current?.click()} disabled={!connected || uploadingFile} title="Attach images"><ImageIcon size={22} /></button>
        <button className="whatsapp-action-btn" onClick={() => cameraInputRef.current?.click()} disabled={!connected || uploadingFile} title="Take photo"><Camera size={22}/></button>
        
        <div className="whatsapp-input-wrapper">
          <button className="emoji-btn-inline" onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={!connected} title="Emoji"><Smile size={22} /></button>
          <textarea ref={textareaRef} className="whatsapp-input" disabled={!connected} value={message} placeholder={connected ? "Type a message..." : "Connecting..."} onChange={handleMessageChange} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} rows={1} />
          {message.length > 100 && <span className={`char-counter ${message.length > 450 ? 'warn' : ''}`}>{message.length}</span>}
        </div>
        
        {message.trim() ? (
          <button className="whatsapp-send" onClick={sendMessage} disabled={!connected} title="Send"><Send size={20}/></button>
        ) : (
          <button className={`whatsapp-action-btn ${isRecording ? 'recording' : ''}`} onClick={handleDesktopRecordingClick} onTouchStart={handleRecordingStart} onTouchMove={handleRecordingSlide} onTouchEnd={recordingLocked ? undefined : stopVoiceRecording} disabled={!connected} title={isRecording ? `Recording: ${recordingTime}s` : 'Record voice'}>
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
          <motion.div className="voice-recording-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="recording-container">
              {recordingLocked ? (
                <div className="recording-locked"><Lock size={24} /><span className="recording-time">{recordingTime}s</span><button className="cancel-recording-btn" onClick={cancelVoiceRecording}><X size={20} /></button></div>
              ) : (
                <div className="recording-slide">
                  <div className="slide-indicator" style={{ transform: `translateX(-${slideDistance}px)` }}><ChevronLeft size={20} /><span>Slide to cancel</span></div>
                  <span className="recording-time">{recordingTime}s</span>
                  <div className="lock-indicator" onTouchStart={lockRecording}><ChevronUp size={16} /><Lock size={16} /></div>
                </div>
              )}
              <div className="waveform-container">{[...Array(40)].map((_, i) => <div key={i} className="waveform-bar" style={{ height: `${Math.random() * 60 + 20}%` }} />)}</div>
              <button type="button" className="stop-send-btn" onClick={stopVoiceRecording}><Send size={20} /><span>Stop & Send</span></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImagePreview && selectedImages.length > 0 && (
          <motion.div className="image-preview-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="preview-header"><button className="preview-close-btn" onClick={cancelImagePreview}><X size={24} /></button>{selectedImages.length > 1 && <span className="image-counter">{currentImageIndex + 1} / {selectedImages.length}</span>}</div>
            <div className="preview-image-container">
              <img src={selectedImages[currentImageIndex].preview} alt="Preview" />
              {selectedImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && <button className="preview-nav-btn prev" onClick={() => setCurrentImageIndex(i => i - 1)}><ChevronLeft size={32} /></button>}
                  {currentImageIndex < selectedImages.length - 1 && <button className="preview-nav-btn next" onClick={() => setCurrentImageIndex(i => i + 1)}><ChevronRight size={32} /></button>}
                </>
              )}
            </div>
            {selectedImages.length > 1 && (
              <div className="preview-thumbnails">
                {selectedImages.map((img, index) => (
                  <div key={img.id} className={`preview-thumbnail ${index === currentImageIndex ? 'active' : ''}`} onClick={() => setCurrentImageIndex(index)}>
                    <img src={img.preview} alt={`Thumb ${index + 1}`} />
                    <button className="thumbnail-remove-btn" onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="preview-footer">
              <input type="text" className="caption-input" placeholder={selectedImages.length > 1 ? "Add a caption (first image)..." : "Add a caption..."} value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} />
              <button className="preview-send-btn" onClick={uploadMultipleImages} disabled={uploadingFile}>{uploadingFile ? <div className="spinner-small"></div> : <Send size={24} />}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingMsgId && (
          <motion.div className="edit-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingMsgId(null)}>
            <motion.div className="edit-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="edit-modal-header"><h3>Edit Message</h3><button className="modal-close-btn" onClick={() => setEditingMsgId(null)}><X size={20}/></button></div>
              <textarea className="edit-textarea" value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus rows={4} />
              <div className="edit-modal-footer"><button className="btn-cancel" onClick={() => setEditingMsgId(null)}>Cancel</button><button className="btn-save" onClick={saveEditMessage} disabled={!editingText.trim()}>Save</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div className="delete-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)}>
            <motion.div className="delete-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-icon"><AlertCircle size={48} color="#f44336" /></div>
              <h3>Delete Message?</h3>
              <p>This action cannot be undone.</p>
              <div className="delete-modal-footer"><button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button><button className="btn-delete" onClick={confirmDelete}>Delete</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div className="profile-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProfileModal(null)}>
            <motion.div className="profile-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="profile-header">
                <div className="profile-avatar-large" style={getAvatarStyle(showProfileModal)}>{getInitials(showProfileModal)}</div>
                <h2>{showProfileModal}</h2>
                <span className={`profile-status status-${userStatus[showProfileModal] || 'online'}`}>{userStatus[showProfileModal] || 'online'}</span>
                {userLastSeen[showProfileModal] && <span className="profile-status" style={{ opacity: 0.75 }}>last seen {formatRelativeTime(userLastSeen[showProfileModal])}</span>}
              </div>
              <div className="profile-body">
                {userProfiles[showProfileModal]?.bio && <div className="profile-bio"><strong>Bio</strong><p>{userProfiles[showProfileModal].bio}</p></div>}
                <div className="profile-actions">
                  <button className="btn-dm" onClick={() => createDM(showProfileModal)} disabled={blockedUsers.includes(showProfileModal)}><AtSign size={16} /> Message</button>
                  <button className="btn-mention" onClick={() => { setMessage(prev => prev + `@${showProfileModal} `); setShowProfileModal(null); }}>Mention</button>
                  {blockedUsers.includes(showProfileModal) ? (
                    <button className="btn-mention" onClick={() => unblockUserAction(showProfileModal)}>Unblock</button>
                  ) : (
                    <button className="btn-mention" onClick={() => blockUserAction(showProfileModal)}>Block</button>
                  )}
                  <button className="btn-mention" onClick={() => reportUserAction(showProfileModal)}>Report</button>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowProfileModal(null)}><X size={20} /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Sidebar */}
      <AnimatePresence>
        {showRoomSidebar && (
          <motion.div className="room-sidebar-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRoomSidebar(false)}>
            <motion.div className="room-sidebar" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} onClick={(e) => e.stopPropagation()}>
              <div className="sidebar-header"><h3>Conversations</h3><button onClick={() => setShowRoomSidebar(false)}><X size={20} /></button></div>
              <div className="sidebar-rooms">
                {groupRoomId && (
                  <div className="sidebar-section">
                    <div className="sidebar-section-title">Group Chat</div>
                    <button className={`room-item ${(activeRoom || room) === groupRoomId ? 'active' : ''}`} onClick={() => { switchRoom(groupRoomId); setShowRoomSidebar(false); }}><div className="room-icon">#</div><span>{groupRoomId}</span></button>
                  </div>
                )}
                <div className="sidebar-section">
                  <div className="sidebar-section-title">Direct Messages</div>
                  {rooms.filter(r => r.type === 'dm').length === 0 ? (
                    <div className="sidebar-empty">No DM conversations yet</div>
                  ) : (
                    rooms.filter(r => r.type === 'dm').map(r => (
                      <button key={r.id} className={`room-item ${activeRoom === r.id ? 'active' : ''}`} onClick={() => { switchRoom(r.id); setShowRoomSidebar(false); }}><div className="room-icon"><MessageSquare size={16}/></div><span>{r.name}</span></button>
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
                        <div className="sidebar-user-meta"><span className="sidebar-user-dot"></span><span>{user}</span></div>
                        <button className="sidebar-dm-btn" onClick={() => { createDM(user); setShowRoomSidebar(false); }}>DM</button>
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
          <motion.div className="starred-panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStarredPanel(false)}>
            <motion.div className="starred-panel" initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }} onClick={e => e.stopPropagation()}>
              <div className="panel-header-nav"><button onClick={() => setShowStarredPanel(false)} className="panel-back-btn">← Back</button><h3 className="panel-header-title">⭐ Starred Messages</h3><span className="starred-count-badge">{starredMsgIds.size}</span></div>
              <div className="panel-content">
                {chat.filter(m => starredMsgIds.has(m._id)).length === 0 ? (
                  <div className="starred-panel-empty"><Star size={40} color="var(--txt-muted)" /><p>No starred messages yet</p></div>
                ) : (
                  chat.filter(m => starredMsgIds.has(m._id)).map(m => (
                    <div key={m._id} className="starred-panel-item" onClick={() => { scrollToMessage(m._id); setShowStarredPanel(false); }}>
                      <div className="starred-item-meta"><span className="starred-item-sender">{m.sender}</span><span className="starred-item-time">{formatRelativeTime(m.time)}</span></div>
                      <div className="starred-item-preview">{m.type === 'image' ? '📷 Photo' : m.type === 'voice' ? '🎤 Voice' : m.type === 'file' ? `📎 ${m.fileName}` : m.text?.substring(0, 80)}</div>
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
          <motion.div className="starred-panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPinnedPanel(false)}>
            <motion.div className="starred-panel" initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }} onClick={e => e.stopPropagation()}>
              <div className="panel-header-nav"><button onClick={() => setShowPinnedPanel(false)} className="panel-back-btn">← Back</button><h3 className="panel-header-title">📌 Pinned Messages</h3><span className="starred-count-badge">{pinnedMessages.length}</span></div>
              <div className="panel-content">
                {pinnedMessages.map(m => (
                  <div key={m._id} className="starred-panel-item" onClick={() => { scrollToMessage(m._id); setShowPinnedPanel(false); }}>
                    <div className="starred-item-meta"><span className="starred-item-sender">{m.sender}</span><span className="starred-item-time">{formatRelativeTime(m.time)}</span></div>
                    <div className="starred-item-preview">{m.type === 'image' ? '📷 Photo' : m.type === 'voice' ? '🎤 Voice' : m.type === 'file' ? `📎 ${m.fileName}` : m.text?.substring(0, 80)}</div>
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
          <motion.div className="media-viewer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeImageViewer}>
            <div className="media-viewer-header">
              <div className="media-viewer-info"><User size={16} /><span>{imageViewer.sender}</span><span className="media-viewer-time">{formatRelativeTime(imageViewer.time)}</span></div>
              <button className="media-viewer-close" onClick={closeImageViewer}><X size={24} /></button>
            </div>
            <motion.div className="image-viewer-content" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} onClick={(e) => e.stopPropagation()}>
              <img src={imageViewer.url} alt="Full view" />
            </motion.div>
            <div className="media-viewer-actions"><button className="media-action-btn" onClick={() => downloadMedia(imageViewer.url, imageViewer.fileName)}><Download size={20} /> Download</button></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Player Modal */}
      <AnimatePresence>
        {voicePlayer && (
          <motion.div className="media-viewer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeVoicePlayer}>
            <motion.div className="voice-player-modal" initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 50 }} onClick={(e) => e.stopPropagation()}>
              <div className="voice-player-header">
                <div className="media-viewer-info"><User size={16} /><span>{voicePlayer.sender}</span><span className="media-viewer-time">{formatRelativeTime(voicePlayer.time)}</span></div>
                <button className="media-viewer-close" onClick={closeVoicePlayer}><X size={20} /></button>
              </div>
              <div className="voice-player-content">
                <div className="voice-player-waveform"><div className="voice-wave-bars">{[...Array(20)].map((_, i) => <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>)}</div></div>
                <div className="voice-player-controls">
                  <button className="voice-player-play-btn" onClick={() => playVoiceMessage(voicePlayer.url, 'modal')}>{playingVoiceId === 'modal' ? <Pause size={20}/> : <Play size={20}/>}</button>
                  <div className="voice-player-info"><span className="voice-player-duration">{voicePlayer.duration}s</span><span className="voice-player-label">Voice Message</span></div>
                </div>
              </div>
              <div className="media-viewer-actions"><button className="media-action-btn" onClick={() => downloadMedia(voicePlayer.url, voicePlayer.fileName)}><Download size={20} /> Download</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Chat Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div className="delete-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowClearConfirm(false)}>
            <motion.div className="delete-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-icon"><Trash2 size={48} color="var(--error)" /></div>
              <h3>Clear All Messages?</h3>
              <p>This will delete all <strong>{chat.length}</strong> messages for everyone.</p>
              <div className="delete-modal-footer"><button className="btn-cancel" onClick={() => setShowClearConfirm(false)}>Cancel</button><button className="btn-delete" onClick={() => { socketRef.current?.emit('clear_chat', roomRef.current); setShowClearConfirm(false); }}>Clear All</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div className="delete-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLogoutConfirm(false)}>
            <motion.div className="delete-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-icon"><LogOut size={48} color="var(--warning)" /></div>
              <h3>Logout?</h3>
              <p>You'll be signed out as <strong>{username}</strong>.</p>
              <div className="delete-modal-footer"><button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)}>Stay</button><button className="btn-delete" style={{ background: 'var(--warning)' }} onClick={performLogout}>Logout</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && contextMenuMessage && (
          <motion.div ref={contextMenuRef} className="context-menu" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="context-menu-header">Message Actions</div>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('reply')}><Reply size={16} /> Reply</button>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('copy')}><Copy size={16} /> Copy</button>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('pin')}><Pin size={16} /> {contextMenuMessage.isPinned ? 'Unpin' : 'Pin'}</button>
            <button className="context-menu-item" onClick={() => handleContextMenuAction('star')}><Star size={16} fill={starredMsgIds.has(contextMenuMessage._id) ? '#FFD700' : 'none'} /> {starredMsgIds.has(contextMenuMessage._id) ? 'Unstar' : 'Star'}</button>
            {contextMenuMessage.type === 'image' && contextMenuMessage.fileUrl && <button className="context-menu-item" onClick={() => handleContextMenuAction('view')}><ImageIcon size={16} /> View Image</button>}
            {contextMenuMessage.type === 'voice' && contextMenuMessage.fileUrl && <button className="context-menu-item" onClick={() => handleContextMenuAction('play')}><PlayCircle size={16} /> Play Voice</button>}
            <div className="context-menu-divider"></div>
            <div className="context-menu-reactions">{QUICK_REACTIONS.map(emoji => <button key={emoji} className="context-menu-emoji" onClick={() => { handleReaction(contextMenuMessage._id, emoji); closeContextMenu(); }}>{emoji}</button>)}</div>
            {contextMenuMessage.sender === username && (
              <>
                <div className="context-menu-divider"></div>
                <button className="context-menu-item" onClick={() => handleContextMenuAction('edit')}><Edit2 size={16} /> Edit</button>
                <button className="context-menu-item danger" onClick={() => handleContextMenuAction('delete')}><Trash2 size={16} /> Delete</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div className="call-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="incoming-call-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="incoming-call-avatar">{incomingCall.from?.charAt(0).toUpperCase()}</div>
              <h3>{incomingCall.callType === 'video' ? '📹 Video Call' : '🎤 Voice Call'}</h3>
              <div className="incoming-call-name">{incomingCall.from}</div>
              <div className="incoming-call-actions"><button className="incoming-call-btn reject-btn" onClick={rejectCall}><PhoneOff size={24} /><span>Decline</span></button><button className="incoming-call-btn accept-btn" onClick={answerCall}><Phone size={24} /><span>Accept</span></button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calling/Ringing Modal */}
      <AnimatePresence>
        {(callState === 'calling' || callState === 'ringing') && callPeer && (
          <motion.div className="call-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="calling-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="calling-avatar">{callPeer.username?.charAt(0).toUpperCase()}</div>
              <h3>{callState === 'ringing' ? 'Ringing...' : 'Calling...'}</h3>
              <div className="calling-name">{callPeer.username}</div>
              <button className="calling-cancel-btn" onClick={endCall}><PhoneOff size={24} /><span>Cancel</span></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Panel */}
      {callState === 'active' && callPeer && (
        <CallPanel
          callType={callType}
          callPeer={callPeer.username}
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
          formatDuration={formatCallDuration}
          localStream={localStream}
          remoteStream={remoteStream}
          remoteIsScreenSharing={remoteIsScreenSharing}
          connectionQuality={connectionQuality}
        />
      )}

      {/* Livestream Panel */}
      {liveStreamInfo && (
        <ModernStreamPanel
          isHost={liveStreamInfo.isHost}
          streamSource={liveStreamInfo.source}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          viewerCount={viewers}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndStream={stopHostedLivestream}
          onSwitchSource={() => startLivestream(streamVisibility, streamSource === 'camera' ? 'screen' : 'camera')}
          streamTitle="My Awesome Stream"
          streamerName={username}
          streamThumbnail="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1280"
          viewers={[]}
          chatMessages={livestreamComments}
          onSendChat={sendLivestreamComment}
          onReact={sendLivestreamReaction}
          streamQuality="1080p"
          streamDuration={callDuration}
          likes={1234}
          shares={567}
        />
      )}

      {/* Settings Modals */}
      <AnimatePresence>
        {showCallSettings && <CallSettings onClose={() => setShowCallSettings(false)} />}
        {showAudioSettings && <AudioSettings onClose={() => setShowAudioSettings(false)} />}
        {showVideoSettings && <VideoSettings onClose={() => setShowVideoSettings(false)} />}
        {showStreamSettings && (
          <StreamSettings 
            visibility={streamVisibility}
            source={streamSource}
            onVisibilityChange={setStreamVisibility}
            onSourceChange={setStreamSource}
            onStartStream={() => { startLivestream(streamVisibility, streamSource); setShowStreamSettings(false); }}
            onClose={() => setShowStreamSettings(false)}
          />
        )}
        {showAppSettings && <AppSettings onClose={() => setShowAppSettings(false)} />}
      </AnimatePresence>

      {/* Call History Panel */}
      <AnimatePresence>
        {showCallHistory && (
          <CallHistoryPanel
            history={callHistory}
            onClose={() => setShowCallHistory(false)}
            formatDuration={formatDuration}
          />
        )}
      </AnimatePresence>

      {/* Settings Manager */}
      <SettingsManager
        currentView={currentView}
        onClose={() => setCurrentView('chat')}
        callHistory={callHistory}
        formatDuration={formatDuration}
        getQualityLabelStyle={getQualityLabelStyle}
      />

      {/* Toast Messages */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div className="toast toast-error" initial={{ y: -100, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -100, opacity: 0 }}>
            <AlertCircle size={20} /><span>{errorMessage}</span><button onClick={() => setErrorMessage('')}><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successMessage && (
          <motion.div className="toast toast-success" initial={{ y: -100, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -100, opacity: 0 }}>
            <CheckCircle size={20} /><span>{successMessage}</span>
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
    <CallProvider socket={socketRef.current} username={username} room={room} onlineUsers={onlineUsers}>
      <AppContent />
    </CallProvider>
  );
}

if (module.hot) {
  module.hot.accept();
}

export default App;