// DevChat Pro - Complete Working Version with Modern UI
import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { 
  Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle, 
  Edit2, X, AlertCircle, Smile, Image as ImageIcon, Pin, Download, Moon, Sun, 
  AtSign, Reply, Eye, EyeOff, Menu, FileDown, LogOut, Lock, ChevronLeft, 
  ChevronUp, ChevronRight, PlayCircle, Mic, Camera, Volume2, VolumeX, Play, Pause, 
  FileText, ChevronDown, MessageSquare, Star, Phone, Video, PhoneOff, Settings, 
  Radio, Bell, Activity, Volume
} from 'lucide-react';

// ==================== CONTEXT IMPORTS ====================
import { CallProvider, useCall } from './context/CallContext';
import { SettingsProvider, useSettings } from './context/settingsContext';

// ==================== COMPONENT IMPORTS ====================

// ==================== STREAMING IMPORTS ====================

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
  getInitials, 
  getAvatarStyle, 
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
import FriendsFeature from './features/friends/FriendsFeature';

const ModernStreamPanel = React.lazy(() => import('./components/streaming/ModernStreamPanel'));
const LiveKitStage = React.lazy(() => import('./components/streaming/LiveKitStage'));
const MarkdownMessageRenderer = React.lazy(() => import('./components/MarkdownMessageRenderer'));
const SettingsManager = React.lazy(() => import('./components/settings/SettingsManager'));
const CallSettings = React.lazy(() => import('./components/settings/CallSettings'));
const AudioSettings = React.lazy(() => import('./components/settings/AudioSettings'));
const VideoSettings = React.lazy(() => import('./components/settings/VideoSettings'));
const StreamSettings = React.lazy(() => import('./components/settings/StreamSettings'));
const AppSettings = React.lazy(() => import('./components/settings/AppSettings'));
const CallPanel = React.lazy(() => import('./components/calls/CallPanel'));
const CallHistoryPanel = React.lazy(() => import('./components/calls/CallHistoryPanel'));
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

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
  SETTINGS_UPDATE: 'livestream:settings-update',
  SETTINGS_UPDATED: 'livestream:settings-updated',
  COMMENT: 'livestream:comment',
  COMMENTED: 'livestream:commented',
  REACTION: 'livestream:reaction',
  REACTED: 'livestream:reacted',
  POLICY_BLOCKED: 'livestream:policy-blocked'
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
  const { settings: appSettings, updateSettings } = useSettings();

  // ==================== CORE STATES ====================
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [entryMode, setEntryMode] = useState(() => sessionStorage.getItem('devchatEntryMode') || 'classic');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => appSettings?.notifications?.soundEnabled ?? true);
  const [theme, setTheme] = useState(() => appSettings?.ui?.theme || localStorage.getItem('theme') || 'dark');
  const [fontStyle, setFontStyle] = useState(localStorage.getItem('fontStyle') || 'default');
  const [ringtoneStyle, setRingtoneStyle] = useState(localStorage.getItem('ringtoneStyle') || 'soft');
  const [ringtoneVolume, setRingtoneVolume] = useState(() => {
    const stored = Number(localStorage.getItem('ringtoneVolume'));
    return Number.isFinite(stored) ? Math.min(1, Math.max(0.05, stored)) : 0.18;
  });
  const [autoJoinLivestream, setAutoJoinLivestream] = useState(() => localStorage.getItem('autoJoinLivestream') === 'true');
  const [showDoubleTick, setShowDoubleTick] = useState(localStorage.getItem('showDoubleTick') !== 'false');
  const [showBlueTick, setShowBlueTick] = useState(localStorage.getItem('showBlueTick') !== 'false');
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [isIOS, setIsIOS] = useState(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  const [isWindows, setIsWindows] = useState(/Windows/i.test(navigator.userAgent));
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [showLogoutSplash, setShowLogoutSplash] = useState(false);

  const showLastSeenEnabled = appSettings?.privacy?.showLastSeen !== false;
  const showReadReceiptsEnabled = appSettings?.privacy?.showReadReceipts !== false;
  
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
  const [menuDropdownStyle, setMenuDropdownStyle] = useState(null);
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
  const [roomSidebarView, setRoomSidebarView] = useState('conversations');
  
  // ==================== NAVIGATION ====================
  const [currentView, setCurrentView] = useState('chat');
  const [navigationStack, setNavigationStack] = useState([]);
  
  // ==================== NOTIFICATIONS ====================
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('devchatNotificationItems') || '[]');
      return Array.isArray(parsed) ? parsed.slice(-100) : [];
    } catch {
      return [];
    }
  });
  const [lastNotificationsReadAt, setLastNotificationsReadAt] = useState(() => {
    const raw = Number(localStorage.getItem('devchatNotificationsReadAt') || '0');
    return Number.isFinite(raw) ? raw : 0;
  });
  const [notificationUnreadOnly, setNotificationUnreadOnly] = useState(() => localStorage.getItem('devchatNotificationUnreadOnly') === '1');
  const [hasNewNotificationPulse, setHasNewNotificationPulse] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [chatRenderLimit, setChatRenderLimit] = useState(() => (window.innerWidth < 768 ? 100 : 200));
  const [autoLoadOlderTriggered, setAutoLoadOlderTriggered] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [recentMentions, setRecentMentions] = useState(0);
  const [mentionedMessages, setMentionedMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [inCallCameraToast, setInCallCameraToast] = useState(null);
  const [isRefreshingInCallCameras, setIsRefreshingInCallCameras] = useState(false);
  
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

  const unreadNotificationCount = useMemo(() => {
    return notificationItems.reduce((count, item) => {
      const itemTime = Date.parse(item?.time || '');
      if (!Number.isFinite(itemTime)) return count;
      return itemTime > lastNotificationsReadAt ? count + 1 : count;
    }, 0);
  }, [notificationItems, lastNotificationsReadAt]);

  const markNotificationsAsRead = useCallback(() => {
    setLastNotificationsReadAt(Date.now());
    setHasNewNotificationPulse(false);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotificationItems([]);
    setLastNotificationsReadAt(Date.now());
    setHasNewNotificationPulse(false);
  }, []);

  const markNotificationItemAsRead = useCallback((notification) => {
    const itemTime = Date.parse(notification?.time || '');
    if (!Number.isFinite(itemTime)) {
      setLastNotificationsReadAt(Date.now());
      return;
    }
    setLastNotificationsReadAt(prev => Math.max(prev, itemTime));
  }, []);

  const previousUnreadNotificationCountRef = useRef(0);

  useEffect(() => {
    const previousUnread = previousUnreadNotificationCountRef.current;
    if (unreadNotificationCount > previousUnread) {
      setHasNewNotificationPulse(true);
    }
    if (unreadNotificationCount === 0) {
      setHasNewNotificationPulse(false);
    }
    previousUnreadNotificationCountRef.current = unreadNotificationCount;
  }, [unreadNotificationCount]);

  const acknowledgeNotificationPulse = useCallback(() => {
    setHasNewNotificationPulse(false);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('devchatNotificationItems', JSON.stringify(notificationItems.slice(-100)));
    } catch {}
  }, [notificationItems]);

  useEffect(() => {
    try {
      localStorage.setItem('devchatNotificationsReadAt', String(lastNotificationsReadAt || 0));
    } catch {}
  }, [lastNotificationsReadAt]);

  useEffect(() => {
    try {
      localStorage.setItem('devchatNotificationUnreadOnly', notificationUnreadOnly ? '1' : '0');
    } catch {}
  }, [notificationUnreadOnly]);
  
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
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(() =>
    localStorage.getItem('devchatPreferredMicrophoneId') || ''
  );
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [audioOutputDevice, setAudioOutputDevice] = useState(() =>
    localStorage.getItem('devchatPreferredAudioOutput') || 'default'
  );

  const normalizeDevicePreferenceId = useCallback((value) => {
    if (!value || value === 'default' || value === 'system') return '';
    return value;
  }, []);
  
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
  const [streamPanelSettings, setStreamPanelSettings] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('devchatStreamPanelSettings') || '{}');
      return {
        quality: parsed.quality || '1080p',
        microphoneId: parsed.microphoneId || localStorage.getItem('devchatPreferredMicrophoneId') || 'default',
        noiseSuppression: parsed.noiseSuppression ?? true,
        slowMode: parsed.slowMode ?? false,
        subOnlyMode: parsed.subOnlyMode ?? false
      };
    } catch {
      return {
        quality: '1080p',
        microphoneId: localStorage.getItem('devchatPreferredMicrophoneId') || 'default',
        noiseSuppression: true,
        slowMode: false,
        subOnlyMode: false
      };
    }
  });
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
  const loadOlderScrollStateRef = useRef(null);
  const lastAutoLoadOlderAtRef = useRef(0);
  const loadOlderFeedbackTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const searchTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);
  const menuContainerRef = useRef(null);
  const menuToggleRef = useRef(null);
  const menuDropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
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
  const livestreamViewerReconnectTimeoutRef = useRef(null);
  const livestreamHostDisconnectTimeoutsRef = useRef(new Map());
  const livestreamLocalStreamRef = useRef(null);
  const livestreamStartTimeoutRef = useRef(null);
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
  const soundToggleLockRef = useRef(0);
  const callTimingRef = useRef(null);
  const endCallRef = useRef(() => {});
  const idleStateRef = useRef(false);
  const isMutedRef = useRef(false);
  const appSettingsRef = useRef(appSettings);
  const notificationPrefsRef = useRef(notificationPrefs);
  const blockedUsersRef = useRef(blockedUsers);
  const autoJoinLivestreamRef = useRef(autoJoinLivestream);

  // ==================== CUSTOM HOOKS ====================
  const enhancedCall = useEnhancedCall(socketRef.current, username);
  const enhancedCallActiveDevices = enhancedCall?.activeDevices;
  const enhancedCallSettings = enhancedCall?.settings;
  const setEnhancedCallActiveDevices = enhancedCall?.setActiveDevices;
  const updateEnhancedCallSettings = enhancedCall?.updateCallSettings;
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
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { autoJoinLivestreamRef.current = autoJoinLivestream; }, [autoJoinLivestream]);
  useEffect(() => { appSettingsRef.current = appSettings; }, [appSettings]);
  useEffect(() => { notificationPrefsRef.current = notificationPrefs; }, [notificationPrefs]);
  useEffect(() => { blockedUsersRef.current = blockedUsers; }, [blockedUsers]);

  useEffect(() => {
    const activeLocalStream = localStreamRef.current || localStream;
    if (activeLocalStream) {
      activeLocalStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }

    const viewerLocalStream = livestreamLocalStreamRef.current;
    if (viewerLocalStream && viewerLocalStream !== activeLocalStream) {
      viewerLocalStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [localStream, isMuted]);

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
    const nextTheme = appSettings?.ui?.theme || 'dark';
    if (theme !== nextTheme) {
      setTheme(nextTheme);
    }
  }, [appSettings?.ui?.theme]);

  useEffect(() => {
    const contextSoundEnabled = appSettings?.notifications?.soundEnabled;
    if (typeof contextSoundEnabled === 'boolean') {
      setSoundEnabled((prev) => (prev === contextSoundEnabled ? prev : contextSoundEnabled));
    }
  }, [appSettings?.notifications?.soundEnabled]);

  useEffect(() => {
    const mentionOnlySetting = !!appSettings?.notifications?.mentionOnly;
    if (notificationPrefs.mentionOnly !== mentionOnlySetting) {
      setNotificationPrefs(prev => ({ ...prev, mentionOnly: mentionOnlySetting }));
    }
  }, [appSettings?.notifications?.mentionOnly, notificationPrefs.mentionOnly]);

  useEffect(() => {
    const quietHours = appSettings?.notifications?.quietHours || {};
    const quietHoursEnabled = !!quietHours.enabled;
    const quietStart = quietHours.start || '22:00';
    const quietEnd = quietHours.end || '07:00';

    if (
      notificationPrefs.quietHoursEnabled !== quietHoursEnabled ||
      notificationPrefs.quietStart !== quietStart ||
      notificationPrefs.quietEnd !== quietEnd
    ) {
      setNotificationPrefs(prev => ({
        ...prev,
        quietHoursEnabled,
        quietStart,
        quietEnd
      }));
    }
  }, [
    appSettings?.notifications?.quietHours?.enabled,
    appSettings?.notifications?.quietHours?.start,
    appSettings?.notifications?.quietHours?.end,
    notificationPrefs.quietHoursEnabled,
    notificationPrefs.quietStart,
    notificationPrefs.quietEnd
  ]);

  useEffect(() => {
    if (!showReadReceiptsEnabled) {
      setShowDoubleTick(false);
      setShowBlueTick(false);
    }
  }, [showReadReceiptsEnabled]);

  useEffect(() => {
    const fontSize = appSettings?.ui?.fontSize || 'medium';
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [appSettings?.ui?.fontSize]);

  useEffect(() => {
    const compactMode = !!appSettings?.ui?.compactMode;
    document.body.classList.toggle('compact-mode', compactMode);
    return () => document.body.classList.remove('compact-mode');
  }, [appSettings?.ui?.compactMode]);

  useEffect(() => {
    const contextSoundEnabled = appSettings?.notifications?.soundEnabled ?? true;
    if (contextSoundEnabled !== soundEnabled) {
      updateSettings({
        notifications: {
          ...(appSettings?.notifications || {}),
          soundEnabled
        }
      });
    }
  }, [soundEnabled, appSettings?.notifications, updateSettings]);

  useEffect(() => {
    const contextMentionOnly = !!appSettings?.notifications?.mentionOnly;
    if (contextMentionOnly !== notificationPrefs.mentionOnly) {
      updateSettings({
        notifications: {
          ...(appSettings?.notifications || {}),
          mentionOnly: notificationPrefs.mentionOnly
        }
      });
    }
  }, [notificationPrefs.mentionOnly, appSettings?.notifications, updateSettings]);

  useEffect(() => {
    const contextQuietHours = appSettings?.notifications?.quietHours || {};
    const contextEnabled = !!contextQuietHours.enabled;
    const contextStart = contextQuietHours.start || '22:00';
    const contextEnd = contextQuietHours.end || '07:00';

    if (
      contextEnabled !== notificationPrefs.quietHoursEnabled ||
      contextStart !== notificationPrefs.quietStart ||
      contextEnd !== notificationPrefs.quietEnd
    ) {
      updateSettings({
        notifications: {
          ...(appSettings?.notifications || {}),
          quietHours: {
            enabled: notificationPrefs.quietHoursEnabled,
            start: notificationPrefs.quietStart,
            end: notificationPrefs.quietEnd
          }
        }
      });
    }
  }, [
    notificationPrefs.quietHoursEnabled,
    notificationPrefs.quietStart,
    notificationPrefs.quietEnd,
    appSettings?.notifications,
    updateSettings
  ]);

  useEffect(() => {
    const desktopNotificationsEnabled = appSettings?.notifications?.desktopNotifications !== false;
    if (!desktopNotificationsEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [appSettings?.notifications?.desktopNotifications]);

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
    const splashTimer = setTimeout(() => setShowStartupSplash(false), 3300);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (!showLogoutSplash) return undefined;
    const logoutSplashTimer = setTimeout(() => setShowLogoutSplash(false), 2800);
    return () => clearTimeout(logoutSplashTimer);
  }, [showLogoutSplash]);

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
    localStorage.setItem('devchatStreamPanelSettings', JSON.stringify(streamPanelSettings));
  }, [streamPanelSettings]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 2600);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(''), 4200);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    if (!inCallCameraToast) return;
    const timer = setTimeout(() => setInCallCameraToast(null), 2200);
    return () => clearTimeout(timer);
  }, [inCallCameraToast]);

  useEffect(() => {
    localStorage.setItem('devchatPreferredCameraId', selectedVideoInputId || '');
  }, [selectedVideoInputId]);

  useEffect(() => {
    localStorage.setItem('devchatPreferredMicrophoneId', selectedAudioInputId || '');
  }, [selectedAudioInputId]);

  useEffect(() => {
    localStorage.setItem('devchatPreferredAudioOutput', audioOutputDevice || 'default');
  }, [audioOutputDevice]);

  useEffect(() => {
    const nextCameraId = normalizeDevicePreferenceId(enhancedCallActiveDevices?.camera);
    const nextMicrophoneId = normalizeDevicePreferenceId(enhancedCallActiveDevices?.microphone);
    const nextSpeakerId = enhancedCallActiveDevices?.speaker && enhancedCallActiveDevices.speaker !== 'system'
      ? enhancedCallActiveDevices.speaker
      : 'default';

    if (typeof nextCameraId === 'string' && nextCameraId !== selectedVideoInputId) {
      setSelectedVideoInputId(nextCameraId);
    }

    if (typeof nextMicrophoneId === 'string' && nextMicrophoneId !== selectedAudioInputId) {
      setSelectedAudioInputId(nextMicrophoneId);
      setStreamPanelSettings((prev) => {
        const nextMicSetting = nextMicrophoneId || 'default';
        return prev.microphoneId === nextMicSetting ? prev : { ...prev, microphoneId: nextMicSetting };
      });
    }

    if (typeof nextSpeakerId === 'string' && nextSpeakerId !== audioOutputDevice) {
      setAudioOutputDevice(nextSpeakerId);
    }

    if (typeof enhancedCallSettings?.noiseSuppression === 'boolean') {
      setStreamPanelSettings((prev) => (
        prev.noiseSuppression === enhancedCallSettings.noiseSuppression
          ? prev
          : { ...prev, noiseSuppression: enhancedCallSettings.noiseSuppression }
      ));
    }

    if (typeof enhancedCallSettings?.videoQuality === 'string') {
      const nextStreamQuality = (() => {
        switch (enhancedCallSettings.videoQuality) {
          case 'low':
            return '480p';
          case 'medium':
            return '720p';
          case 'high':
            return '1080p';
          case 'ultra':
            return '4K';
          case 'auto':
          default:
            return 'Auto';
        }
      })();
      if (nextStreamQuality) {
        setStreamPanelSettings((prev) => (
          prev.quality === nextStreamQuality ? prev : { ...prev, quality: nextStreamQuality }
        ));
      }
    }
  }, [
    enhancedCallActiveDevices?.camera,
    enhancedCallActiveDevices?.microphone,
    enhancedCallActiveDevices?.speaker,
    enhancedCallSettings?.noiseSuppression,
    enhancedCallSettings?.videoQuality,
    normalizeDevicePreferenceId,
    selectedVideoInputId,
    selectedAudioInputId,
    audioOutputDevice
  ]);

  // ==================== MOBILE DETECTION ====================
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const handleViewportChange = () => {
      const keyboardOpen =
        window.innerWidth < 768 &&
        window.innerHeight - viewport.height > 120;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
    };

    handleViewportChange();
    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);

    return () => {
      document.body.classList.remove('keyboard-open');
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // ==================== TAB TITLE ====================
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) DevChat Pro` : 'DevChat Pro';
  }, [unreadCount]);

  // ==================== DEVICE ENUMERATION ====================
  const refreshVideoInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { ok: false, skipped: true, cameraCount: 0 };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `External Camera ${i + 1}`
        }));
      const microphones = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `External Microphone ${i + 1}`
        }));
      const speakers = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `External Speaker ${i + 1}`
        }));
      setVideoInputDevices(cameras);
      setAudioInputDevices(microphones);
      setAudioOutputDevices(speakers);

      if (selectedVideoInputId && !cameras.some(device => device.deviceId === selectedVideoInputId)) {
        setSelectedVideoInputId('');
      }

      if (selectedAudioInputId && !microphones.some(device => device.deviceId === selectedAudioInputId)) {
        setSelectedAudioInputId('');
        setStreamPanelSettings(prev => ({ ...prev, microphoneId: 'default' }));
      }

      return { ok: true, skipped: false, cameraCount: cameras.length };
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
      return { ok: false, skipped: false, cameraCount: 0 };
    }
  }, [selectedAudioInputId, selectedVideoInputId]);

  useEffect(() => {
    navigator.mediaDevices?.addEventListener('devicechange', refreshVideoInputs);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshVideoInputs);
  }, [refreshVideoInputs]);

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

  // ==================== WITH PREFERRED VIDEO DEVICE ====================
  const withPreferredVideoDevice = useCallback((constraints) => {
    if (!selectedVideoInputId || !constraints || constraints.video === false) return constraints;
    return {
      ...constraints,
      video: {
        ...(typeof constraints.video === 'object' ? constraints.video : {}),
        deviceId: { ideal: selectedVideoInputId }
      }
    };
  }, [selectedVideoInputId]);

  const withPreferredAudioDevice = useCallback((constraints) => {
    if (!constraints || constraints.audio === false) return constraints;

    const preferredId = selectedAudioInputId || streamPanelSettings?.microphoneId;
    const hasPreferredDevice = preferredId && preferredId !== 'default';

    const mergedAudio = {
      ...(typeof constraints.audio === 'object' ? constraints.audio : {}),
      echoCancellation: true,
      noiseSuppression: streamPanelSettings?.noiseSuppression ?? true,
      autoGainControl: true,
      ...(hasPreferredDevice ? { deviceId: { ideal: preferredId } } : {})
    };

    return {
      ...constraints,
      audio: mergedAudio
    };
  }, [selectedAudioInputId, streamPanelSettings?.microphoneId, streamPanelSettings?.noiseSuppression]);

  const getCallMediaConstraints = useCallback((callKind) => {
    const adaptiveConstraints = withPreferredAudioDevice(withPreferredVideoDevice(getAdaptiveMediaConstraints({
      callType: callKind,
      userAgent: navigator.userAgent,
      connectionInfo: runtimeConnectionInfo
    })));

    const preferredConstraintsRaw = enhancedCall.getCallConstraints?.(callKind);
    const sanitizeTrackConstraints = (trackConstraints) => {
      if (!trackConstraints || typeof trackConstraints !== 'object') return trackConstraints;
      const normalized = { ...trackConstraints };
      const deviceId = normalized.deviceId;

      if (deviceId === 'system' || deviceId === 'default') {
        delete normalized.deviceId;
      } else if (typeof deviceId === 'object' && deviceId) {
        if (typeof deviceId.exact === 'string' && deviceId.exact.trim()) {
          normalized.deviceId = { ideal: deviceId.exact };
        }
      } else if (typeof deviceId === 'string' && deviceId.trim()) {
        normalized.deviceId = { ideal: deviceId };
      }

      return normalized;
    };

    const preferredConstraints = preferredConstraintsRaw
      ? {
          ...preferredConstraintsRaw,
          audio: sanitizeTrackConstraints(preferredConstraintsRaw.audio),
          video: sanitizeTrackConstraints(preferredConstraintsRaw.video)
        }
      : preferredConstraintsRaw;

    if (!preferredConstraints) {
      return adaptiveConstraints;
    }

    const mergedAudio = callKind === 'video'
      ? {
          ...(typeof adaptiveConstraints.audio === 'object' ? adaptiveConstraints.audio : {}),
          ...(typeof preferredConstraints.audio === 'object' ? preferredConstraints.audio : {})
        }
      : (typeof preferredConstraints.audio === 'object' ? preferredConstraints.audio : adaptiveConstraints.audio);

    const mergedVideo = callKind === 'video'
      ? {
          ...(typeof adaptiveConstraints.video === 'object' ? adaptiveConstraints.video : {}),
          ...(typeof preferredConstraints.video === 'object' ? preferredConstraints.video : {})
        }
      : false;

    return {
      ...adaptiveConstraints,
      ...preferredConstraints,
      audio: mergedAudio,
      video: mergedVideo
    };
  }, [enhancedCall, runtimeConnectionInfo, withPreferredAudioDevice, withPreferredVideoDevice]);

  const acquireCallMediaStream = useCallback(async (callKind) => {
    const baseConstraints = getCallMediaConstraints(callKind);
    const attempts = [baseConstraints];

    if (callKind === 'video') {
      const relaxedVideo = typeof baseConstraints.video === 'object'
        ? (() => {
            const next = { ...baseConstraints.video };
            delete next.deviceId;
            return next;
          })()
        : true;

      attempts.push({
        ...baseConstraints,
        video: relaxedVideo
      });

      attempts.push({
        audio: baseConstraints.audio === false ? true : (baseConstraints.audio || true),
        video: true
      });
    }

    attempts.push(withPreferredAudioDevice(withPreferredVideoDevice(getFallbackMediaConstraints(callKind))));
    attempts.push(getFallbackMediaConstraints(callKind));

    let lastError = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (callKind !== 'video' || stream.getVideoTracks().length > 0) {
          return stream;
        }
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to access media devices');
  }, [getCallMediaConstraints, withPreferredAudioDevice, withPreferredVideoDevice]);

  const getStreamQualityVideoConstraints = useCallback((quality) => {
    const qualityProfiles = {
      'Auto': null,
      '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
      '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
      '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } },
      '4K': { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30, max: 60 } }
    };

    return qualityProfiles[quality] || null;
  }, []);

  const mapStreamQualityToCallVideoQuality = useCallback((quality) => {
    switch (quality) {
      case '480p':
        return 'low';
      case '720p':
        return 'medium';
      case '1080p':
        return 'high';
      case '4K':
        return 'ultra';
      case 'Auto':
      default:
        return 'auto';
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('devchatEntryMode', entryMode);
  }, [entryMode]);

  const applyStreamQualityToActiveTrack = useCallback(async (quality) => {
    const profile = getStreamQualityVideoConstraints(quality);

    const currentLocalStream = localStreamRef.current;
    const activeVideoTrack = currentLocalStream?.getVideoTracks?.()[0];
    if (!activeVideoTrack || typeof activeVideoTrack.applyConstraints !== 'function') return;

    try {
      if (!profile) {
        await activeVideoTrack.applyConstraints({});
        setSuccessMessage('Auto video quality enabled');
      } else {
        await activeVideoTrack.applyConstraints(profile);
        setSuccessMessage('Stream quality updated');
      }
    } catch (error) {
      console.warn('Failed to apply stream quality immediately:', error);
      setErrorMessage('Could not apply selected quality right now. It will apply next start.');
    }
  }, [getStreamQualityVideoConstraints]);

  const handleInCallVideoQualityChange = useCallback((quality) => {
    if (!quality || typeof quality !== 'string') return;

    setStreamPanelSettings((prev) => (prev.quality === quality ? prev : { ...prev, quality }));
    applyStreamQualityToActiveTrack(quality);

    const mappedCallQuality = mapStreamQualityToCallVideoQuality(quality);
    if (mappedCallQuality && enhancedCallSettings?.videoQuality !== mappedCallQuality) {
      updateEnhancedCallSettings?.({ videoQuality: mappedCallQuality });
    }
  }, [
    applyStreamQualityToActiveTrack,
    mapStreamQualityToCallVideoQuality,
    enhancedCallSettings?.videoQuality,
    updateEnhancedCallSettings
  ]);

  const applyAudioProcessingToActiveTrack = useCallback(async (overrides = {}) => {
    const currentLocalStream = localStreamRef.current;
    const activeAudioTrack = currentLocalStream?.getAudioTracks?.()[0];
    if (!activeAudioTrack || typeof activeAudioTrack.applyConstraints !== 'function') return;

    const echoCancellation = typeof overrides.echoCancellation === 'boolean'
      ? overrides.echoCancellation
      : (enhancedCallSettings?.echoCancellation ?? true);
    const noiseSuppression = typeof overrides.noiseSuppression === 'boolean'
      ? overrides.noiseSuppression
      : (enhancedCallSettings?.noiseSuppression ?? true);
    const autoGainControl = typeof overrides.autoGainControl === 'boolean'
      ? overrides.autoGainControl
      : (enhancedCallSettings?.autoGainControl ?? true);

    try {
      await activeAudioTrack.applyConstraints({
        echoCancellation: !!echoCancellation,
        noiseSuppression: !!noiseSuppression,
        autoGainControl: !!autoGainControl
      });
    } catch (error) {
      console.warn('Failed to apply audio processing immediately:', error);
    }
  }, [
    enhancedCallSettings?.echoCancellation,
    enhancedCallSettings?.noiseSuppression,
    enhancedCallSettings?.autoGainControl
  ]);

  const handleInCallAudioSettingChange = useCallback((settingKey, enabled) => {
    if (!settingKey || typeof enabled !== 'boolean') return;
    if (!['noiseSuppression', 'echoCancellation', 'autoGainControl'].includes(settingKey)) return;

    if (settingKey === 'noiseSuppression') {
      setStreamPanelSettings((prev) => (
        prev.noiseSuppression === enabled ? prev : { ...prev, noiseSuppression: enabled }
      ));
    }

    if (enhancedCallSettings?.[settingKey] !== enabled) {
      updateEnhancedCallSettings?.({ [settingKey]: enabled });
    }

    applyAudioProcessingToActiveTrack({ [settingKey]: enabled });
    const settingLabel = settingKey === 'noiseSuppression'
      ? 'Noise suppression'
      : settingKey === 'echoCancellation'
        ? 'Echo cancellation'
        : 'Auto gain control';
    setSuccessMessage(`${settingLabel} ${enabled ? 'enabled' : 'disabled'}`);
  }, [
    enhancedCallSettings,
    updateEnhancedCallSettings,
    applyAudioProcessingToActiveTrack
  ]);

  const applyCameraSelectionToActiveStream = useCallback(async (cameraId) => {
    const hasActiveVideoSession =
      callStateRef.current === 'active' ||
      Boolean(liveStreamInfoRef.current?.isHost);

    if (!hasActiveVideoSession || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, skipped: true };
    }

    const currentLocalStream = localStreamRef.current;
    if (!currentLocalStream) {
      return { ok: false, skipped: true };
    }

    try {
      const preferredId = cameraId && cameraId !== 'default' ? cameraId : '';
      const qualityConstraints = getStreamQualityVideoConstraints(streamPanelSettings?.quality);

      const candidateVideoConstraints = preferredId
        ? [
            { ...(qualityConstraints || {}), deviceId: { exact: preferredId } },
            { ...(qualityConstraints || {}), deviceId: { ideal: preferredId } },
            qualityConstraints || true,
            { deviceId: { exact: preferredId } },
            { deviceId: { ideal: preferredId } },
            true
          ]
        : [qualityConstraints || true, true];

      let replacementStream = null;
      let captureError = null;

      for (const videoConstraints of candidateVideoConstraints) {
        try {
          replacementStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false
          });
          if (replacementStream?.getVideoTracks?.().length) {
            break;
          }
        } catch (err) {
          captureError = err;
        }
      }

      if (!replacementStream) {
        throw captureError || new Error('Unable to access selected camera');
      }

      const replacementVideoTrack = replacementStream.getVideoTracks()[0];
      if (!replacementVideoTrack) {
        replacementStream.getTracks().forEach(track => track.stop());
        return { ok: false, skipped: true };
      }

      const oldVideoTracks = currentLocalStream.getVideoTracks();
      oldVideoTracks.forEach(track => {
        currentLocalStream.removeTrack(track);
        track.stop();
      });
      currentLocalStream.addTrack(replacementVideoTrack);

      const viewerLocalStream = livestreamLocalStreamRef.current;
      if (viewerLocalStream && viewerLocalStream !== currentLocalStream) {
        viewerLocalStream.getVideoTracks().forEach(track => {
          viewerLocalStream.removeTrack(track);
          track.stop();
        });
        viewerLocalStream.addTrack(replacementVideoTrack.clone());
      }

      const replaceOnPeerConnection = async (peerConnection) => {
        if (!peerConnection) return;
        const videoSenders = peerConnection.getSenders().filter(sender => sender.track?.kind === 'video');
        for (const videoSender of videoSenders) {
          await videoSender.replaceTrack(replacementVideoTrack);
        }
      };

      await replaceOnPeerConnection(peerConnectionRef.current);
      await Promise.allSettled(
        Array.from(livestreamHostPeersRef.current.values()).map(replaceOnPeerConnection)
      );

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = currentLocalStream;
      }

      setLocalStream(currentLocalStream);
      setSuccessMessage('Camera switched successfully');
      return { ok: true };
    } catch (error) {
      console.warn('Failed to switch camera immediately:', error);
      setErrorMessage('Could not switch camera right now. It will apply next start.');
      return { ok: false, skipped: false };
    }
  }, [getStreamQualityVideoConstraints, streamPanelSettings?.quality]);

  const applyMicrophoneSelectionToActiveStream = useCallback(async (microphoneId, noiseSuppressionEnabled = true) => {
    const hasActiveAudioSession =
      callStateRef.current === 'active' ||
      Boolean(liveStreamInfoRef.current?.isHost);

    if (!hasActiveAudioSession || !navigator.mediaDevices?.getUserMedia) return;

    const currentLocalStream = localStreamRef.current;
    if (!currentLocalStream) return;

    try {
      const preferredId = microphoneId && microphoneId !== 'default' ? microphoneId : '';
      const replacementStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(preferredId ? { deviceId: { exact: preferredId } } : {}),
          echoCancellation: true,
          noiseSuppression: !!noiseSuppressionEnabled,
          autoGainControl: true
        },
        video: false
      });

      const replacementAudioTrack = replacementStream.getAudioTracks()[0];
      if (!replacementAudioTrack) {
        replacementStream.getTracks().forEach(track => track.stop());
        return;
      }

      replacementAudioTrack.enabled = !isMutedRef.current;

      const oldAudioTracks = currentLocalStream.getAudioTracks();
      oldAudioTracks.forEach(track => {
        currentLocalStream.removeTrack(track);
        track.stop();
      });
      currentLocalStream.addTrack(replacementAudioTrack);

      const viewerLocalStream = livestreamLocalStreamRef.current;
      if (viewerLocalStream && viewerLocalStream !== currentLocalStream) {
        viewerLocalStream.getAudioTracks().forEach(track => {
          viewerLocalStream.removeTrack(track);
          track.stop();
        });
        const viewerAudioTrack = replacementAudioTrack.clone();
        viewerAudioTrack.enabled = !isMutedRef.current;
        viewerLocalStream.addTrack(viewerAudioTrack);
      }

      const replaceOnPeerConnection = async (peerConnection) => {
        if (!peerConnection) return;
        const audioSender = peerConnection.getSenders().find(sender => sender.track?.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(replacementAudioTrack);
        }
      };

      await replaceOnPeerConnection(peerConnectionRef.current);
      await Promise.allSettled(
        Array.from(livestreamHostPeersRef.current.values()).map(replaceOnPeerConnection)
      );

      setLocalStream(currentLocalStream);
      setSuccessMessage('Microphone switched successfully');
    } catch (error) {
      console.warn('Failed to switch microphone immediately:', error);
      setErrorMessage('Could not switch microphone right now. It will apply next start.');
    }
  }, []);

  const handleInCallCameraChange = useCallback(async (cameraId) => {
    const normalizedCameraId = cameraId === 'default' ? '' : cameraId;
    setSelectedVideoInputId(normalizedCameraId);
    setEnhancedCallActiveDevices?.((prev) => ({
      ...(prev || {}),
      camera: normalizedCameraId || 'system'
    }));
    const result = await applyCameraSelectionToActiveStream(cameraId);
    if (!result || result.skipped) return;

    setInCallCameraToast({
      type: result.ok ? 'success' : 'error',
      message: result.ok ? 'Camera switched' : 'Camera switch failed'
    });
  }, [applyCameraSelectionToActiveStream, setEnhancedCallActiveDevices]);

  const handleInCallCameraRefresh = useCallback(async () => {
    if (isRefreshingInCallCameras) return;

    setIsRefreshingInCallCameras(true);
    setInCallCameraToast({ type: 'info', message: 'Refreshing cameras...' });

    try {
      const result = await refreshVideoInputs();

      if (result?.ok) {
        const count = Number(result.cameraCount) || 0;
        setInCallCameraToast({
          type: 'success',
          message: count > 0 ? `Found ${count} camera${count === 1 ? '' : 's'}` : 'No cameras detected'
        });
        return;
      }

      if (!result?.skipped) {
        setInCallCameraToast({ type: 'error', message: 'Failed to refresh cameras' });
      }
    } finally {
      setIsRefreshingInCallCameras(false);
    }
  }, [isRefreshingInCallCameras, refreshVideoInputs]);

  const switchLivestreamSource = useCallback(async () => {
    const activeSession = liveStreamInfoRef.current;
    if (!activeSession?.isHost) return;

    const currentLocalStream = localStreamRef.current;
    if (!currentLocalStream) {
      setErrorMessage('No active stream found to switch source.');
      return;
    }

    const nextSource = activeSession.source === 'screen' ? 'camera' : 'screen';

    try {
      let replacementVideoTrack = null;
      let transientStream = null;

      if (nextSource === 'screen') {
        if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
          setErrorMessage('Screen sharing is not supported on this device/browser.');
          return;
        }

        transientStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        replacementVideoTrack = transientStream.getVideoTracks()[0] || null;

        if (replacementVideoTrack) {
          replacementVideoTrack.onended = () => {
            if (liveStreamInfoRef.current?.isHost && liveStreamInfoRef.current?.source === 'screen') {
              switchLivestreamSource().catch(() => {});
            }
          };
        }
      } else {
        const qualityConstraints = getStreamQualityVideoConstraints(streamPanelSettings?.quality);
        const preferredCameraId = selectedVideoInputId && selectedVideoInputId !== 'default' ? selectedVideoInputId : '';

        const candidateVideoConstraints = preferredCameraId
          ? [
              { ...(qualityConstraints || {}), deviceId: { exact: preferredCameraId } },
              { ...(qualityConstraints || {}), deviceId: { ideal: preferredCameraId } },
              qualityConstraints || true,
              { deviceId: { exact: preferredCameraId } },
              { deviceId: { ideal: preferredCameraId } },
              true
            ]
          : [qualityConstraints || true, true];

        let captureError = null;
        for (const videoConstraints of candidateVideoConstraints) {
          try {
            transientStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
            replacementVideoTrack = transientStream.getVideoTracks()[0] || null;
            if (replacementVideoTrack) break;
          } catch (error) {
            captureError = error;
          }
        }

        if (!replacementVideoTrack) {
          throw captureError || new Error('Unable to access selected camera');
        }
      }

      if (!replacementVideoTrack) {
        throw new Error('Unable to capture video source');
      }

      currentLocalStream.getVideoTracks().forEach(track => {
        currentLocalStream.removeTrack(track);
        track.stop();
      });
      currentLocalStream.addTrack(replacementVideoTrack);

      const replaceOnPeerConnection = async (peerConnection) => {
        if (!peerConnection) return;
        const videoSenders = peerConnection.getSenders().filter(sender => sender.track?.kind === 'video');
        for (const sender of videoSenders) {
          await sender.replaceTrack(replacementVideoTrack);
        }
      };

      await replaceOnPeerConnection(peerConnectionRef.current);
      await Promise.allSettled(
        Array.from(livestreamHostPeersRef.current.values()).map(replaceOnPeerConnection)
      );

      livestreamLocalStreamRef.current = currentLocalStream;
      setLocalStream(currentLocalStream);
      setRemoteStream(currentLocalStream);

      setLiveStreamInfo(prev => {
        if (!prev) return prev;
        return { ...prev, source: nextSource };
      });
      setStreamSource(nextSource);

      setSuccessMessage(nextSource === 'screen' ? 'Switched to screen share' : 'Switched to camera');
      if (transientStream && transientStream !== currentLocalStream) {
        transientStream.getAudioTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.warn('Failed to switch livestream source:', error);
      setErrorMessage('Could not switch source right now. Please try again.');
    }
  }, [getStreamQualityVideoConstraints, selectedVideoInputId, streamPanelSettings?.quality]);

  const handleStreamSettingsChange = useCallback((settings = {}) => {
    const mergedSettings = { ...streamPanelSettings, ...settings };
    setStreamPanelSettings(mergedSettings);

    if (typeof settings.quality === 'string' && settings.quality.trim()) {
      applyStreamQualityToActiveTrack(settings.quality);
    }

    if (typeof settings.noiseSuppression === 'boolean') {
      applyAudioProcessingToActiveTrack({ noiseSuppression: settings.noiseSuppression });
    }

    if (typeof settings.cameraId === 'string') {
      const normalizedCameraId = settings.cameraId === 'default' ? '' : settings.cameraId;
      setSelectedVideoInputId(normalizedCameraId);
      setEnhancedCallActiveDevices?.((prev) => ({
        ...(prev || {}),
        camera: normalizedCameraId || 'system'
      }));
      applyCameraSelectionToActiveStream(settings.cameraId);
    }

    const nextMicrophoneId = typeof settings.microphoneId === 'string'
      ? settings.microphoneId
      : (typeof settings.microphone === 'string' ? settings.microphone : null);

    if (nextMicrophoneId) {
      const normalizedMicId = nextMicrophoneId === 'default' ? '' : nextMicrophoneId;
      setSelectedAudioInputId(normalizedMicId);
      setEnhancedCallActiveDevices?.((prev) => ({
        ...(prev || {}),
        microphone: normalizedMicId || 'system'
      }));
      applyMicrophoneSelectionToActiveStream(nextMicrophoneId, settings.noiseSuppression ?? streamPanelSettings.noiseSuppression);
    }

    if (typeof settings.audioOutput === 'string' && settings.audioOutput.trim()) {
      setAudioOutputDevice(settings.audioOutput);
      setEnhancedCallActiveDevices?.((prev) => ({
        ...(prev || {}),
        speaker: settings.audioOutput === 'default' ? 'system' : settings.audioOutput
      }));
    }

    const activeSession = liveStreamInfoRef.current;
    if (
      activeSession?.isHost &&
      activeSession?.sessionId &&
      !String(activeSession.sessionId).startsWith('pending-') &&
      socketRef.current
    ) {
      socketRef.current.emit(LIVESTREAM_EVENTS.SETTINGS_UPDATE, {
        sessionId: activeSession.sessionId,
        from: usernameRef.current,
        settings: {
          quality: mergedSettings.quality,
          noiseSuppression: !!mergedSettings.noiseSuppression,
          slowMode: !!mergedSettings.slowMode,
          subOnlyMode: !!mergedSettings.subOnlyMode
        }
      });
    }
  }, [
    applyAudioProcessingToActiveTrack,
    applyCameraSelectionToActiveStream,
    applyMicrophoneSelectionToActiveStream,
    applyStreamQualityToActiveTrack,
    streamPanelSettings,
    streamPanelSettings.noiseSuppression,
    setEnhancedCallActiveDevices
  ]);

  useEffect(() => {
    const applyAudioOutput = async () => {
      const mediaElements = Array.from(document.querySelectorAll('audio, video'));
      if (!mediaElements.length) return;

      for (const mediaElement of mediaElements) {
        if (typeof mediaElement.setSinkId !== 'function') continue;
        try {
          await mediaElement.setSinkId(audioOutputDevice || 'default');
        } catch (error) {
          console.warn('Failed to set audio output device:', error);
        }
      }
    };

    applyAudioOutput();
  }, [audioOutputDevice, callState, liveStreamInfo, remoteStream]);

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
      
      if (blockedUsersRef.current.includes(data.sender)) return;

      const incomingRoom = data.room || roomRef.current;
      const isDifferentRoom = incomingRoom && incomingRoom !== roomRef.current;
      
      if (!isDifferentRoom) {
        setChat(prev => [...prev, data]);
      }
      
      // Clear typing indicator
      if (!isDifferentRoom && typingTimersRef.current.has(data.sender)) {
        clearTimeout(typingTimersRef.current.get(data.sender));
        typingTimersRef.current.delete(data.sender);
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(data.sender);
          return updated;
        });
      }
      
      // Handle unread count
      if (!isDifferentRoom && !isAtBottomRef.current && data.sender !== usernameRef.current) {
        setUnreadCount(c => c + 1);
      }
      
      // Play sound
      if (shouldPlaySoundForIncomingMessage(data)) {
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          playNotificationSound(audioContextRef.current);
        } catch (e) {
          console.log('Sound failed:', e);
        }
      }

      if (shouldNotifyForMessage(data, isDifferentRoom)) {
        setNotificationItems(prev => {
          const itemId = data._id || `${data.sender}-${data.time}-${data.room}`;
          const nextItem = {
            id: `msg-${itemId}`,
            type: 'message',
            sender: data.sender,
            room: data.room,
            preview: data.text || 'New message',
            time: data.time || new Date().toISOString()
          };
          return [...prev.filter(item => item.id !== nextItem.id), nextItem].slice(-60);
        });

        if (!document.hasFocus()) {
          showDesktopNotificationForMessage(data);
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
        ? data.rooms.filter(r => r?.id && !r.id.includes('_dm_') && Number(r.count || 0) > 0)
        : [];
      nextRooms.sort((a, b) => {
        const countDiff = Number(b?.count || 0) - Number(a?.count || 0);
        if (countDiff !== 0) return countDiff;
        const nameA = String(a?.name || a?.id || '');
        const nameB = String(b?.name || b?.id || '');
        return nameA.localeCompare(nameB);
      });
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
      const incomingAt = nowMs();
      callTimingRef.current = {
        role: 'callee',
        peer: data?.from,
        incomingOfferAt: incomingAt,
        firstRemoteTrackAt: null,
        firstRemoteTrackKind: null,
        answerSentAt: null
      };
      logCallTiming('Incoming offer', { from: data?.from, incomingOfferAt: incomingAt });
      setIncomingCall(data);
      playRingtone();
    });

    socket.on(CALL_EVENTS.ANSWER, async (data) => {
      if (!data?.answer) return;

      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (!pc.currentRemoteDescription && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }

        if (pendingIceCandidatesRef.current.length > 0) {
          const queuedCandidates = pendingIceCandidatesRef.current.filter(candidate => candidate?.candidate);
          pendingIceCandidatesRef.current = [];
          const results = await Promise.allSettled(
            queuedCandidates.map(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)))
          );
          pendingIceCandidatesRef.current = queuedCandidates.filter((candidate, index) => results[index]?.status === 'rejected');
        }

        if (callStateRef.current === 'calling' || callStateRef.current === 'ringing') {
          const timing = callTimingRef.current;
          if (timing?.role === 'caller' && !timing.answerReceivedAt) {
            const answerReceivedAt = nowMs();
            timing.answerReceivedAt = answerReceivedAt;
            callTimingRef.current = timing;
            logCallTiming('Answer received', {
              peer: timing.peer || data?.from,
              offerToAnswer: timing.offerSentAt ? (answerReceivedAt - timing.offerSentAt) : undefined
            });
          }

          setCallState('active');
          startCallTimer();
          stopRingtone();
          clearCallTimeout();
        }
      } catch (err) {
        console.error('Failed to apply call answer:', err);
        setCallError('Failed to establish call connection');
      }
    });

    socket.on(CALL_EVENTS.ICE_CANDIDATE, async (data) => {
      const candidate = data?.candidate;
      if (!candidate) return;

      const candidateKey = `${candidate.candidate || ''}|${candidate.sdpMid || ''}|${candidate.sdpMLineIndex ?? ''}`;
      if (seenIceCandidateKeysRef.current.has(candidateKey)) return;
      seenIceCandidateKeysRef.current.add(candidateKey);

      const pc = peerConnectionRef.current;
      if (!pc) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      if (!pc.remoteDescription && !pc.currentRemoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
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

      if (
        data?.host === usernameRef.current &&
        data?.sessionId &&
        livestreamLocalStreamRef.current &&
        liveStreamInfoRef.current?.isStarting
      ) {
        if (livestreamStartTimeoutRef.current) {
          clearTimeout(livestreamStartTimeoutRef.current);
          livestreamStartTimeoutRef.current = null;
        }

        const hostStream = livestreamLocalStreamRef.current;
        setLiveStreamInfo({
          sessionId: data.sessionId,
          host: usernameRef.current,
          room: data.room || roomRef.current || room,
          visibility: data.visibility || 'room',
          source: data.source || streamSource,
          hasAudio: hostStream.getAudioTracks().length > 0,
          isHost: true,
          isStarting: false,
          autoJoined: false,
          viewers: [],
          viewerCount: 0
        });

        setCallType('video');
        setCallPeer({ username: `${usernameRef.current} • LIVE`, userId: usernameRef.current });
        setCallState('active');
        startCallTimer();
      }

      setNotificationItems(prev => [...prev.filter(item => item.id !== `live-${data.sessionId}`), {
        id: `live-${data.sessionId}`,
        type: 'livestream',
        sessionId: data.sessionId,
        sender: data.host,
        room: data.room,
        preview: `${data.host} is live`,
        time: new Date().toISOString()
      }]);

      if (!document.hasFocus() && shouldNotifyForLivestreamEvent(data)) {
        showDesktopNotificationForLivestream(data);
      }
    });

    socket.on(LIVESTREAM_EVENTS.AVAILABLE, (data) => {
      setNotificationItems(prev => [...prev.filter(item => item.id !== `live-${data.sessionId}`), {
        id: `live-${data.sessionId}`,
        type: 'livestream',
        sessionId: data.sessionId,
        sender: data.host,
        room: data.room,
        preview: `${data.host} is live`,
        time: new Date().toISOString()
      }]);

      if (!document.hasFocus() && shouldNotifyForLivestreamEvent(data)) {
        showDesktopNotificationForLivestream(data);
      }
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

    socket.on(LIVESTREAM_EVENTS.JOIN_REQUEST, async (data) => {
      if (!data?.sessionId || !data?.from) return;
      const activeSession = liveStreamInfoRef.current;
      if (!activeSession?.isHost || activeSession.sessionId !== data.sessionId) return;

      const hostStream = livestreamLocalStreamRef.current || localStreamRef.current;
      if (!hostStream) return;

      try {
        await createLivestreamHostPeer(data.from, data.sessionId, hostStream);
      } catch (err) {
        console.error('Failed to create livestream host peer:', err);
      }
    });

    socket.on(LIVESTREAM_EVENTS.ANSWER, async (data) => {
      if (!data?.from || !data?.answer) return;
      const hostPeer = livestreamHostPeersRef.current.get(data.from);
      if (!hostPeer) return;
      try {
        if (!hostPeer.remoteDescription) {
          await hostPeer.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      } catch (err) {
        console.error('Failed to apply livestream answer:', err);
      }
    });

    socket.on(LIVESTREAM_EVENTS.ICE_CANDIDATE, async (data) => {
      if (!data?.candidate) return;

      try {
        const activeSession = liveStreamInfoRef.current;
        if (activeSession?.isHost) {
          const hostPeer = livestreamHostPeersRef.current.get(data.from);
          if (hostPeer?.remoteDescription) {
            await hostPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } else {
          const viewerPeer = livestreamViewerPeerRef.current;
          if (viewerPeer?.remoteDescription) {
            await viewerPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      } catch (err) {
        console.error('Failed to add livestream ICE candidate:', err);
      }
    });

    socket.on(LIVESTREAM_EVENTS.COMMENTED, (data) => {
      if (liveStreamInfoRef.current?.sessionId === data.sessionId) {
        setLivestreamComments(prev => [...prev, {
          id: data.id,
          from: data.from,
          text: data.text,
          time: data.time
        }]);
      }
    });

    socket.on(LIVESTREAM_EVENTS.REACTED, (data) => {
      if (liveStreamInfoRef.current?.sessionId === data.sessionId) {
        setLivestreamComments(prev => [...prev, {
          id: data.id,
          type: 'reaction',
          from: data.from,
          emoji: data.emoji,
          time: data.time
        }]);
      }
    });

    socket.on(LIVESTREAM_EVENTS.SETTINGS_UPDATED, (data) => {
      if (!data?.sessionId || liveStreamInfoRef.current?.sessionId !== data.sessionId) return;
      if (data?.settings && typeof data.settings === 'object') {
        setStreamPanelSettings(prev => ({ ...prev, ...data.settings }));
      }
    });

    socket.on(LIVESTREAM_EVENTS.POLICY_BLOCKED, (data) => {
      if (!data?.sessionId || liveStreamInfoRef.current?.sessionId !== data.sessionId) return;
      if (data.reason === 'slow-mode') {
        setErrorMessage('Slow mode is enabled. Please wait before sending another message.');
        return;
      }
      if (data.reason === 'sub-only-mode') {
        setErrorMessage('This stream is in sub-only mode.');
      }
    });

    socket.on(LIVESTREAM_EVENTS.VIEWERS_UPDATE, (data) => {
      setViewers(data.count || 0);
    });

    socket.on(LIVESTREAM_EVENTS.STOPPED, (data) => {
      if (liveStreamInfoRef.current?.sessionId === data.sessionId) {
        setLiveStreamInfo(null);
        setLivestreamComments([]);
        setShowStreamSettings(false);
        setShowStreamingTab(false);
        setSuccessMessage('Livestream stopped');
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
      if (livestreamViewerReconnectTimeoutRef.current) clearTimeout(livestreamViewerReconnectTimeoutRef.current);
      livestreamHostDisconnectTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      livestreamHostDisconnectTimeoutsRef.current.clear();
      if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
      stopRingtone();
      stopCallTimer();
    };
  }, []);

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

    const callState = callStateRef.current;
    const isRealtimeMediaActive = Boolean(liveStreamInfoRef.current) || callState === 'active' || callState === 'calling' || callState === 'ringing';
    if (!isDifferentRoom && !isRealtimeMediaActive) return false;

    const prefs = notificationPrefsRef.current;
    const settings = appSettingsRef.current;
    const desktopNotificationsEnabled = settings?.notifications?.desktopNotifications !== false;
    if (!desktopNotificationsEnabled) return false;

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

  const shouldPlaySoundForIncomingMessage = useCallback((messagePayload) => {
    if (!messagePayload || messagePayload.sender === usernameRef.current) return false;

    const prefs = notificationPrefsRef.current;
    const roomId = messagePayload.room || '';
    const isDm = roomId.includes('_dm_');
    const mentionsCurrentUser =
      messagePayload.text?.includes(`@${usernameRef.current}`) ||
      messagePayload.text?.includes('@everyone');

    if (prefs.mutedRooms.includes(roomId)) return false;
    if (prefs.dmOnlyPriority && !isDm) return false;
    if (prefs.mentionOnly && !mentionsCurrentUser) return false;
    if (isWithinQuietHours() && !mentionsCurrentUser) return false;

    return soundEnabledRef.current;
  }, [isWithinQuietHours]);

  const showDesktopNotificationForMessage = useCallback((messagePayload) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const roomLabel = messagePayload.room || roomRef.current || 'chat';
    const body = messagePayload.text || 'New message';
    const notification = new Notification(`${messagePayload.sender} · ${roomLabel}`, {
      body,
      tag: `devchat-${roomLabel}`,
      renotify: false,
      silent: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  }, []);

  const shouldNotifyForLivestreamEvent = useCallback((streamPayload) => {
    if (!streamPayload) return false;
    if (streamPayload.host === usernameRef.current) return false;

    const settings = appSettingsRef.current;
    const desktopNotificationsEnabled = settings?.notifications?.desktopNotifications !== false;
    if (!desktopNotificationsEnabled) return false;

    const prefs = notificationPrefsRef.current;
    const roomId = streamPayload.room || '';
    if (prefs.mutedRooms.includes(roomId)) return false;
    if (isWithinQuietHours()) return false;

    return true;
  }, [isWithinQuietHours]);

  const showDesktopNotificationForLivestream = useCallback((streamPayload) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const host = streamPayload.host || streamPayload.sender || 'Someone';
    const roomLabel = streamPayload.room || roomRef.current || 'chat';
    const notification = new Notification(`🔴 ${host} is live`, {
      body: `Room: ${roomLabel}`,
      tag: `devchat-live-${streamPayload.sessionId || host}`,
      renotify: false,
      silent: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 6000);
  }, []);

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
    const currentRoomId = activeRoom || room;
    const isDmRoom = currentRoomId.includes('_dm_');

    return chat.filter(msg => {
      if (msg.room && currentRoomId && msg.room !== currentRoomId) {
        return false;
      }

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

  const chatMessageById = useMemo(() => {
    const idMap = new Map();
    chat.forEach((item) => {
      if (item?._id) {
        idMap.set(item._id, item);
      }
    });
    return idMap;
  }, [chat]);

  const searchResultCount = useMemo(() => filteredChat.length, [filteredChat]);
  const chatLoadStep = isMobileView ? 100 : 200;
  const hasActiveSearchFilters = useMemo(() => {
    return (
      debouncedSearchQuery.trim().length > 0 ||
      dmSearchQuery.trim().length > 0 ||
      searchFilters.sender !== '' ||
      searchFilters.mediaType !== 'all' ||
      searchFilters.mentionsOnly ||
      searchFilters.fromDate !== '' ||
      searchFilters.toDate !== ''
    );
  }, [debouncedSearchQuery, dmSearchQuery, searchFilters]);
  const renderedChat = useMemo(() => {
    if (hasActiveSearchFilters) return filteredChat;
    return filteredChat.slice(Math.max(0, filteredChat.length - chatRenderLimit));
  }, [filteredChat, chatRenderLimit, hasActiveSearchFilters]);
  const hasOlderHiddenMessages = useMemo(() => {
    if (hasActiveSearchFilters) return false;
    return filteredChat.length > renderedChat.length;
  }, [filteredChat.length, renderedChat.length, hasActiveSearchFilters]);
  const handleLoadOlderMessages = useCallback(() => {
    setIsLoadingOlder(true);
    const chatBody = chatBodyRef.current;
    if (chatBody) {
      loadOlderScrollStateRef.current = {
        previousHeight: chatBody.scrollHeight,
        previousTop: chatBody.scrollTop
      };
    } else {
      if (loadOlderFeedbackTimeoutRef.current) {
        clearTimeout(loadOlderFeedbackTimeoutRef.current);
      }
      loadOlderFeedbackTimeoutRef.current = setTimeout(() => {
        setIsLoadingOlder(false);
      }, 220);
    }
    setChatRenderLimit((prev) => prev + chatLoadStep);
  }, [chatLoadStep]);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody || !hasOlderHiddenMessages) return;

    const onAutoLoadNearTop = () => {
      if (chatBody.scrollTop > 100) return;
      const now = Date.now();
      if (now - lastAutoLoadOlderAtRef.current < 700) return;
      lastAutoLoadOlderAtRef.current = now;
      setAutoLoadOlderTriggered(true);
      handleLoadOlderMessages();
    };

    chatBody.addEventListener('scroll', onAutoLoadNearTop);
    return () => chatBody.removeEventListener('scroll', onAutoLoadNearTop);
  }, [hasOlderHiddenMessages, handleLoadOlderMessages]);

  const failedQueueItems = useMemo(() => outgoingQueue.filter(e => e.status === 'failed'), [outgoingQueue]);
  const filteredNotificationItems = useMemo(() => {
    const sorted = notificationItems.slice().sort((a, b) => Date.parse(b?.time || 0) - Date.parse(a?.time || 0));
    if (!notificationUnreadOnly) return sorted;
    return sorted.filter((item) => {
      const itemTime = Date.parse(item?.time || '');
      return Number.isFinite(itemTime) && itemTime > lastNotificationsReadAt;
    });
  }, [notificationItems, notificationUnreadOnly, lastNotificationsReadAt]);
  const availableSenders = useMemo(() => [...new Set(chat.map(m => m.sender).filter(Boolean))].sort(), [chat]);

  const retryAllFailedQueueItems = useCallback(() => {
    failedQueueItems.forEach((item, index) => {
      setTimeout(() => retryQueueItem(item.id), index * 150);
    });
  }, [failedQueueItems, retryQueueItem]);

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
      document.addEventListener('pointerdown', handleClickOutsideMenu);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutsideMenu);
    };
  }, [showMenuDropdown]);

  useEffect(() => {
    const handleClickOutsideMobileMenu = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('pointerdown', handleClickOutsideMobileMenu);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutsideMobileMenu);
    };
  }, [showMobileMenu]);

  useEffect(() => {
    const shouldLockScroll = isMobileView && (showMenuDropdown || showMobileMenu);
    const previousOverflow = document.body.style.overflow;
    if (shouldLockScroll) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileView, showMenuDropdown, showMobileMenu]);

  useEffect(() => {
    if (!isMobileView || !liveKitToken) {
      setShowMobileMenu(false);
    }
  }, [isMobileView, liveKitToken]);

  useEffect(() => {
    if (!showMenuDropdown) {
      setShowStreamingTab(false);
      setMenuDropdownStyle(null);
    }
  }, [showMenuDropdown]);

  const updateMenuDropdownPosition = useCallback(() => {
    if (!showMenuDropdown || isMobileView) {
      setMenuDropdownStyle(null);
      return;
    }

    const triggerEl = menuToggleRef.current;
    const dropdownEl = menuDropdownRef.current;
    if (!triggerEl || !dropdownEl) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const edge = 8;
    const triggerRect = triggerEl.getBoundingClientRect();

    const currentRoomId = activeRoom || room;
    const isDmContext = !!currentRoomId && currentRoomId.includes('_dm_');
    const preferredWidth = 320;
    const measuredWidth = dropdownEl.offsetWidth || preferredWidth;
    const width = Math.min(measuredWidth, Math.max(240, viewportWidth - edge * 2));

    let left = isDmContext
      ? triggerRect.right - width
      : triggerRect.left;
    left = Math.max(edge, Math.min(left, viewportWidth - width - edge));

    const gap = 8;
    const minMenuHeight = 180;
    const naturalHeight = dropdownEl.scrollHeight || 420;
    const spaceBelow = viewportHeight - triggerRect.bottom - edge;
    const spaceAbove = triggerRect.top - edge;

    const preferUp = spaceBelow < minMenuHeight && spaceAbove > spaceBelow;
    let top;
    let maxHeight;

    if (preferUp) {
      maxHeight = Math.max(minMenuHeight, spaceAbove - gap);
      const resolvedHeight = Math.min(naturalHeight, maxHeight);
      top = Math.max(edge, triggerRect.top - resolvedHeight - gap);
    } else {
      top = Math.min(viewportHeight - edge - minMenuHeight, triggerRect.bottom + gap);
      maxHeight = Math.max(minMenuHeight, viewportHeight - top - edge);
    }

    setMenuDropdownStyle({
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      right: 'auto',
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(maxHeight)}px`
    });
  }, [showMenuDropdown, isMobileView, activeRoom, room]);

  useEffect(() => {
    if (!showMenuDropdown || isMobileView) return undefined;

    const frame = requestAnimationFrame(updateMenuDropdownPosition);
    const handleViewportChange = () => updateMenuDropdownPosition();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showMenuDropdown, isMobileView, updateMenuDropdownPosition]);

  useEffect(() => {
    if (!(showCallSettings || showAudioSettings || showVideoSettings || showStreamSettings || showAppSettings)) {
      return;
    }
    setShowMenuDropdown(false);
    setShowMobileMenu(false);
    setShowStreamingTab(false);
  }, [showCallSettings, showAudioSettings, showVideoSettings, showStreamSettings, showAppSettings]);

  useEffect(() => {
    setShowStreamingTab(!!liveStreamInfo);
  }, [liveStreamInfo]);

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
    const msg = chatMessageById.get(messageId);
    const reactions = msg?.reactions || {};
    const userReacted = reactions[emoji]?.includes(username);
    
    if (userReacted) {
      socketRef.current.emit('remove_reaction', { messageId, emoji, username: usernameRef.current, room: roomRef.current });
    } else {
      socketRef.current.emit('add_reaction', { messageId, emoji, username: usernameRef.current, room: roomRef.current });
    }
  }, [chatMessageById, username]);

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
        setThreadRootId(contextMenuMessage.replyTo || contextMenuMessage._id);
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
  }, [contextMenuMessage, handleCopyMessage, startEditMessage, deleteMessage, togglePin, toggleStar, closeContextMenu]);

  // ==================== RENDER MESSAGE TEXT ====================
  const renderMessageText = useCallback((msg) => {
    if (!showMarkdown) return <p>{msg.text}</p>;
    
    let content = msg.text;
    
    if (msg.mentions?.length > 0) {
      msg.mentions.forEach(mention => {
        content = content.replace(new RegExp(`@${mention}\\b`, 'g'), `**@${mention}**`);
      });
    }
    
    return (
      <Suspense fallback={<p>{msg.text}</p>}>
        <MarkdownMessageRenderer content={content} />
      </Suspense>
    );
  }, [showMarkdown]);

  // ==================== VOICE MESSAGES ====================
  const isExpectedPlayInterruption = useCallback((error) => {
    const message = (error && error.message) ? String(error.message) : '';
    return error?.name === 'AbortError' || message.includes('play() request was interrupted by a call to pause()');
  }, []);

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
        if (!isExpectedPlayInterruption(error)) {
          console.error('Playback failed:', error);
        }
        setPlayingVoiceId(null);
      }
    }
  }, [isExpectedPlayInterruption, playingVoiceId]);

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
    roomRef.current = dmRoom;
    subscribedRoomsRef.current.add(dmRoom);
    
    socketRef.current.emit("join_room", { room: dmRoom, username: usernameRef.current, active: true, fetchHistory: true });
    
    const dmUsers = roomUserMap[dmRoom];
    setOnlineUsers(Array.isArray(dmUsers) ? dmUsers : []);
    setMessage(roomDrafts[dmRoom] || '');
    setShowRoomSidebar(false);
    setShowProfileModal(null);
  }, [username, rooms, roomDrafts, blockedUsers, roomUserMap]);

  const switchRoom = useCallback((roomId) => {
    const previousRoomId = roomRef.current;

    if (roomId && !roomId.includes('_dm_')) {
      setGroupRoomId(roomId);
    }
    
    setActiveRoom(roomId);
    setRoom(roomId);
    roomRef.current = roomId;
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

  const openSidebarView = useCallback((view = 'conversations') => {
    setRoomSidebarView(view);
    setShowRoomSidebar(true);
    if (view === 'notifications') {
      markNotificationsAsRead();
    }
  }, [markNotificationsAsRead]);

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
    livestreamHostDisconnectTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    livestreamHostDisconnectTimeoutsRef.current.clear();
    if (livestreamViewerReconnectTimeoutRef.current) {
      clearTimeout(livestreamViewerReconnectTimeoutRef.current);
      livestreamViewerReconnectTimeoutRef.current = null;
    }
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
    setShowLogoutSplash(true);
    setChat([]);
    setOnlineUsers([]);
    setRoomUserMap({});
    setNotificationItems([]);
    setLastNotificationsReadAt(0);
    setNotificationUnreadOnly(false);
    setConnected(false);
    setShowLogoutConfirm(false);
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(true);
    setShowMenuDropdown(false);
  }, []);

  // ==================== WEBRTC FUNCTIONS ====================
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
  }, []);

  const nowMs = useCallback(() => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }, []);

  const logCallTiming = useCallback((label, payload = {}) => {
    try {
      const details = Object.entries(payload)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          if (typeof value === 'number') return `${key}=${value.toFixed(1)}ms`;
          return `${key}=${String(value)}`;
        })
        .join(' | ');
      console.log(`⏱️ [CallSetup] ${label}${details ? ` | ${details}` : ''}`);
    } catch {
      console.log(`⏱️ [CallSetup] ${label}`);
    }
  }, []);

  const debugLog = useCallback((...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CallDebug]', ...args);
    }
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

      const timing = callTimingRef.current;
      if (timing && !timing.firstRemoteTrackAt) {
        const firstRemoteTrackAt = nowMs();
        timing.firstRemoteTrackAt = firstRemoteTrackAt;
        timing.firstRemoteTrackKind = event.track?.kind || 'unknown';
        callTimingRef.current = timing;

        logCallTiming('First remote track', {
          role: timing.role,
          peer: timing.peer || targetUsername,
          track: timing.firstRemoteTrackKind,
          offerToFirstMedia: timing.offerSentAt ? (firstRemoteTrackAt - timing.offerSentAt) : undefined,
          answerToFirstMedia: timing.answerReceivedAt
            ? (firstRemoteTrackAt - timing.answerReceivedAt)
            : (timing.answerSentAt ? (firstRemoteTrackAt - timing.answerSentAt) : undefined),
          incomingOfferToFirstMedia: timing.incomingOfferAt ? (firstRemoteTrackAt - timing.incomingOfferAt) : undefined
        });
      }
      
      if (remoteTrackTimeoutRef.current) {
        clearTimeout(remoteTrackTimeoutRef.current);
        remoteTrackTimeoutRef.current = null;
      }
      
      try {
        const primaryStream = event.streams?.[0];
        if (primaryStream && primaryStream.getTracks().length > 0) {
          inboundRemoteStreamRef.current = primaryStream;
          remoteStreamRef.current = primaryStream;
          setRemoteStream(primaryStream);

          if (event.track?.kind === 'video') {
            event.track.onunmute = () => {
              attachRemoteStreamToElement();
            };
          }

          attachRemoteStreamToElement();
          return;
        }

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

        if (event.track?.kind === 'video') {
          event.track.onunmute = () => {
            attachRemoteStreamToElement();
          };
        }

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
  }, [iceServersConfig, attachRemoteStreamToElement, logCallTiming, nowMs]);

  const closeLivestreamHostPeer = useCallback((viewerUsername) => {
    const disconnectTimer = livestreamHostDisconnectTimeoutsRef.current.get(viewerUsername);
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      livestreamHostDisconnectTimeoutsRef.current.delete(viewerUsername);
    }

    const pc = livestreamHostPeersRef.current.get(viewerUsername);
    if (pc) {
      pc.close();
      livestreamHostPeersRef.current.delete(viewerUsername);
    }
  }, []);

  const clearLivestreamViewerReconnectTimeout = useCallback(() => {
    if (livestreamViewerReconnectTimeoutRef.current) {
      clearTimeout(livestreamViewerReconnectTimeoutRef.current);
      livestreamViewerReconnectTimeoutRef.current = null;
    }
  }, []);

  const closeLivestreamViewerPeer = useCallback(() => {
    clearLivestreamViewerReconnectTimeout();

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
  }, [clearLivestreamViewerReconnectTimeout]);

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
      const state = viewerPc.connectionState;
      if (state === 'connected') {
        clearLivestreamViewerReconnectTimeout();
        return;
      }

      if (state === 'failed' || state === 'disconnected') {
        clearLivestreamViewerReconnectTimeout();
        livestreamViewerReconnectTimeoutRef.current = setTimeout(() => {
          const currentSessionId = liveStreamInfoRef.current?.sessionId;
          if (currentSessionId === sessionId && livestreamViewerPeerRef.current === viewerPc) {
            socketRef.current?.emit(LIVESTREAM_EVENTS.JOIN_REQUEST, { sessionId, from: usernameRef.current });
          }
          livestreamViewerReconnectTimeoutRef.current = null;
        }, 8000);
      }

      if (state === 'closed') {
        clearLivestreamViewerReconnectTimeout();
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
  }, [applyLivestreamIncomingTrack, closeLivestreamViewerPeer, clearLivestreamViewerReconnectTimeout, iceServersConfig, startCallTimer, waitForIceGatheringComplete]);

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
      const state = pc.connectionState;
      const existingTimer = livestreamHostDisconnectTimeoutsRef.current.get(viewerUsername);

      if (state === 'connected' && existingTimer) {
        clearTimeout(existingTimer);
        livestreamHostDisconnectTimeoutsRef.current.delete(viewerUsername);
      }

      if (state === 'failed' && typeof pc.restartIce === 'function') {
        pc.restartIce();
      }

      if (state === 'disconnected') {
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const disconnectTimer = setTimeout(() => {
          const trackedPeer = livestreamHostPeersRef.current.get(viewerUsername);
          if (trackedPeer === pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
            closeLivestreamHostPeer(viewerUsername);
          }
          livestreamHostDisconnectTimeoutsRef.current.delete(viewerUsername);
        }, 8000);
        livestreamHostDisconnectTimeoutsRef.current.set(viewerUsername, disconnectTimer);
      }

      if (state === 'closed') {
        if (existingTimer) {
          clearTimeout(existingTimer);
          livestreamHostDisconnectTimeoutsRef.current.delete(viewerUsername);
        }
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

    livestreamHostDisconnectTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    livestreamHostDisconnectTimeoutsRef.current.clear();

    clearLivestreamViewerReconnectTimeout();

    if (livestreamStartTimeoutRef.current) {
      clearTimeout(livestreamStartTimeoutRef.current);
      livestreamStartTimeoutRef.current = null;
    }

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
    setShowStreamSettings(false);
    setShowStreamingTab(false);
    stopCallTimer();
    setLiveStreamInfo(null);
    setLivestreamComments([]);
    setLivestreamCommentInput('');
    setSuccessMessage('Livestream stopped');
  }, [clearLivestreamViewerReconnectTimeout, stopCallTimer]);

  const buildLivestreamSourceStream = useCallback(async (sourceMode) => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let source = sourceMode === 'screen' ? 'screen' : (sourceMode === 'both' ? 'both' : 'camera');

    if (!navigator.mediaDevices) throw new Error('Media devices not supported');

    if (source === 'both' && !isMobile && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        const cameraConstraints = getCallMediaConstraints('video');
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
              const preferredAudio = withPreferredAudioDevice({
                audio: enhancedCall.getCallConstraints?.('voice')?.audio || true
              }).audio;
              const micStream = await navigator.mediaDevices.getUserMedia({
                audio: preferredAudio || true,
                video: false
              });
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

    const constraints = getCallMediaConstraints('video');

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      refreshVideoInputs();
      return { stream: cameraStream, source: 'camera' };
    } catch {
      const fallbackConstraints = withPreferredAudioDevice(withPreferredVideoDevice(getFallbackMediaConstraints('video')));
      const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      refreshVideoInputs();
      return { stream: fallbackStream, source: 'camera' };
    }
  }, [enhancedCall, getCallMediaConstraints, refreshVideoInputs, withPreferredAudioDevice, withPreferredVideoDevice]);

  const startLivestream = useCallback(async (visibilityMode, sourceMode = 'camera') => {
    const rollbackLivestreamStart = (message) => {
      if (livestreamStartTimeoutRef.current) {
        clearTimeout(livestreamStartTimeoutRef.current);
        livestreamStartTimeoutRef.current = null;
      }

      if (livestreamLocalStreamRef.current) {
        livestreamLocalStreamRef.current.getTracks().forEach(t => t.stop());
        livestreamLocalStreamRef.current = null;
      }

      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(t => t.stop());
        remoteStreamRef.current = null;
      }

      setLocalStream(null);
      setRemoteStream(null);
      inboundRemoteStreamRef.current = null;
      setLiveStreamInfo(null);
      setCallState('idle');
      setCallType(null);
      setCallPeer(null);
      stopCallTimer();

      if (message) {
        setCallError(message);
        setErrorMessage(message);
      }
    };

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
      setErrorMessage('Connecting to chat...');
      return;
    }

    if (!activeRoomId || activeRoomId.includes('_dm_')) {
      setCallError('Livestream is available only in group rooms');
      setErrorMessage('Livestream is available only in group rooms');
      return;
    }

    if (callStateRef.current === 'active' || callStateRef.current === 'calling' || callStateRef.current === 'ringing') {
      setErrorMessage('End current call first');
      setCallError('End current call first');
      return;
    }

    if (liveStreamInfoRef.current?.isHost) {
      setCallError('You already have an active livestream');
      setErrorMessage('You already have an active livestream');
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
      setSuccessMessage('Starting livestream...');
      setErrorMessage('');

      const pendingSessionId = `pending-${Date.now()}`;
      setLiveStreamInfo({
        sessionId: pendingSessionId,
        host: usernameRef.current,
        room: activeRoomId,
        visibility,
        source,
        hasAudio: stream.getAudioTracks().length > 0,
        isHost: true,
        isStarting: true,
        autoJoined: false,
        viewers: [],
        viewerCount: 0
      });

      setCallType('video');
      setCallPeer({ username: `${usernameRef.current} • LIVE`, userId: usernameRef.current });
      setCallState('active');
      startCallTimer();

      if (livestreamStartTimeoutRef.current) {
        clearTimeout(livestreamStartTimeoutRef.current);
      }

      livestreamStartTimeoutRef.current = setTimeout(() => {
        if (liveStreamInfoRef.current?.isStarting) {
          rollbackLivestreamStart('Start stream timed out. Please try again.');
        }
        livestreamStartTimeoutRef.current = null;
      }, 15000);

      socketRef.current.emit(LIVESTREAM_EVENTS.START, {
        host: usernameRef.current,
        room: activeRoomId,
        visibility,
        source,
        settings: {
          quality: streamPanelSettings.quality,
          noiseSuppression: !!streamPanelSettings.noiseSuppression,
          slowMode: !!streamPanelSettings.slowMode,
          subOnlyMode: !!streamPanelSettings.subOnlyMode
        }
      }, async (ack) => {
        if (!ack?.success || !ack.sessionId) {
          rollbackLivestreamStart(ack?.error || 'Failed to start livestream');
          return;
        }

        if (livestreamStartTimeoutRef.current) {
          clearTimeout(livestreamStartTimeoutRef.current);
          livestreamStartTimeoutRef.current = null;
        }

        setLiveStreamInfo({
          sessionId: ack.sessionId,
          host: usernameRef.current,
          room: activeRoomId,
          visibility,
          source,
          hasAudio: stream.getAudioTracks().length > 0,
          isHost: true,
          isStarting: false,
          autoJoined: false,
          viewers: [],
          viewerCount: 0
        });

        const targets = Array.isArray(ack.targets) ? ack.targets : [];
        await Promise.allSettled(targets.map(v => createLivestreamHostPeer(v, ack.sessionId, stream)));

        setSuccessMessage(`🔴 Livestream started (${visibility})`);
      });
    } catch (err) {
      rollbackLivestreamStart(err?.message || 'Unable to access camera/microphone');
    }
  }, [
    room,
    connected,
    createLivestreamHostPeer,
    buildLivestreamSourceStream,
    stopHostedLivestream,
    startCallTimer,
    stopCallTimer,
    streamPanelSettings.noiseSuppression,
    streamPanelSettings.quality,
    streamPanelSettings.slowMode,
    streamPanelSettings.subOnlyMode
  ]);

  const sendLivestreamComment = useCallback((textOverride = '') => {
    const activeSession = liveStreamInfoRef.current;
    const hasOverride = typeof textOverride === 'string' && textOverride.trim().length > 0;
    const text = hasOverride ? textOverride.trim() : livestreamCommentInput.trim();
    if (!activeSession?.sessionId || !socketRef.current || !text) return;
    socketRef.current.emit(LIVESTREAM_EVENTS.COMMENT, {
      sessionId: activeSession.sessionId,
      from: usernameRef.current,
      text
    });
    if (!hasOverride) {
      setLivestreamCommentInput('');
    }
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

  const handleJoinStream = useCallback((roomId, startAsHost = false) => {
    if (startAsHost) {
      startLivestream(streamVisibility, streamSource);
      return;
    }

    const activeRoomId = roomId || roomRef.current || room;
    const livestreamNotifications = notificationItems
      .filter(item => item?.type === 'livestream' && item?.sessionId)
      .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

    const sameRoomNotification = livestreamNotifications.find(item => !activeRoomId || item.room === activeRoomId);
    const fallbackNotification = livestreamNotifications[0];
    const targetNotification = sameRoomNotification || fallbackNotification;

    if (!targetNotification) {
      setErrorMessage('No active livestream found. Ask someone to start streaming first.');
      return;
    }

    requestJoinLivestreamFromNotification(targetNotification);
    setSuccessMessage(`Joining ${targetNotification.sender}'s livestream...`);
  }, [notificationItems, requestJoinLivestreamFromNotification, room, startLivestream, streamSource, streamVisibility]);

  const startCall = useCallback(async (type, targetUser) => {
    if (!targetUser || !socketRef.current) {
      setCallError('Unable to initiate call');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError('Your browser does not support calls');
      return;
    }

    let stream = null;
    let pc = null;

    try {
      pendingIceCandidatesRef.current = [];
      seenIceCandidateKeysRef.current.clear();
      setCallType(type);
      setCallPeer({ username: targetUser, userId: targetUser });
      setCallState('calling');
      setCallError(null);

      stream = await acquireCallMediaStream(type);
      refreshVideoInputs();

      stream.getTracks().forEach(t => t.enabled = true);
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      pc = createPeerConnection(targetUser, { callKind: type });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      optimizeRtpSenders(pc, {
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      }).catch((err) => {
        console.warn('RTP optimization fallback:', err);
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

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit(CALL_EVENTS.OFFER, {
        to: targetUser,
        from: username,
        callType: type,
        offer: pc.localDescription || offer
      });

      const offerSentAt = nowMs();
      callTimingRef.current = {
        role: 'caller',
        peer: targetUser,
        offerSentAt,
        answerReceivedAt: null,
        firstRemoteTrackAt: null,
        firstRemoteTrackKind: null
      };
      logCallTiming('Offer sent', { to: targetUser, offerSentAt });

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
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (pc) {
        pc.close();
      }
      if (peerConnectionRef.current === pc) {
        peerConnectionRef.current = null;
      }
      setLocalStream(null);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setCallPeer(null);
      setCallType(null);
      callTimingRef.current = null;
      setCallState('idle');
      stopRingtone();
      clearCallTimeout();
    }
  }, [username, acquireCallMediaStream, createPeerConnection, playRingtone, stopRingtone, clearCallTimeout, waitForIceGatheringComplete, refreshVideoInputs, logCallTiming, nowMs]);

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

    let stream = null;
    let pc = null;

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

      stream = await acquireCallMediaStream(incomingCall.callType);
      refreshVideoInputs();

      stream.getTracks().forEach(t => t.enabled = true);
      setLocalStream(stream);

      if (localVideoRef.current && incomingCall.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const stats = new CallStatistics();
      callStatsRef.current = stats;
      setCallStats(stats.getStats());

      pc = createPeerConnection(callerUsername, { callKind: incomingCall.callType });
      peerConnectionRef.current = pc;

      const qualityController = new AdaptiveQualityController(pc);
      qualityControllerRef.current = qualityController;
      qualityController.start();

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      optimizeRtpSenders(pc, {
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      }).catch((err) => {
        console.warn('RTP optimization fallback:', err);
      });

      if (pendingIceCandidatesRef.current.length > 0) {
        const queuedCandidates = pendingIceCandidatesRef.current.filter(candidate => candidate?.candidate);
        pendingIceCandidatesRef.current = [];
        const results = await Promise.allSettled(
          queuedCandidates.map(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)))
        );
        pendingIceCandidatesRef.current = queuedCandidates.filter((candidate, index) => results[index]?.status === 'rejected');
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
        answer: pc.localDescription || answer
      });

      const timing = callTimingRef.current;
      if (timing?.role === 'callee') {
        const answerSentAt = nowMs();
        timing.answerSentAt = answerSentAt;
        callTimingRef.current = timing;
        logCallTiming('Answer sent', {
          to: callerUsername,
          incomingOfferToAnswer: timing.incomingOfferAt ? (answerSentAt - timing.incomingOfferAt) : undefined
        });
      }

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
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (pc) {
        pc.close();
      }
      if (peerConnectionRef.current === pc) {
        peerConnectionRef.current = null;
      }
      setLocalStream(null);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setCallState('idle');
      setCallType(null);
      setCallPeer(null);
      callTimingRef.current = null;
      rejectCall();
    }
  }, [incomingCall, username, acquireCallMediaStream, createPeerConnection, startCallTimer, stopRingtone, rejectCall, clearCallTimeout, runtimeConnectionInfo, refreshVideoInputs, joinLivestreamAsViewer, logCallTiming, nowMs]);

  const releaseAllMediaAccess = useCallback(() => {
    const streamsToStop = [
      localStreamRef.current,
      remoteStreamRef.current,
      livestreamLocalStreamRef.current,
      inboundRemoteStreamRef.current,
      screenStreamRef.current,
      screenShareStreamRef.current,
      localStream,
      remoteStream
    ].filter(Boolean);

    const visitedTracks = new Set();
    streamsToStop.forEach((stream) => {
      stream.getTracks?.().forEach((track) => {
        if (!track || visitedTracks.has(track)) return;
        visitedTracks.add(track);
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
    });

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    livestreamLocalStreamRef.current = null;
    inboundRemoteStreamRef.current = null;
    screenStreamRef.current = null;
    screenShareStreamRef.current = null;
  }, [localStream, remoteStream]);

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

    releaseAllMediaAccess();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (livestreamViewerPeerRef.current) {
      livestreamViewerPeerRef.current.close();
      livestreamViewerPeerRef.current = null;
    }
    clearLivestreamViewerReconnectTimeout();

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
    callTimingRef.current = null;
    stopCallTimer();
    stopRingtone();
  }, [callPeer, username, callType, callDuration, stopCallTimer, stopRingtone, clearCallTimeout, stopHostedLivestream, clearLivestreamViewerReconnectTimeout, releaseAllMediaAccess]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const previousCallStateRef = useRef('idle');
  useEffect(() => {
    const prevState = previousCallStateRef.current;
    if (callState === 'idle' && prevState !== 'idle') {
      releaseAllMediaAccess();
    }
    previousCallStateRef.current = callState;
  }, [callState, releaseAllMediaAccess]);

  const toggleMute = useCallback(() => {
    const activeLocalStream = localStreamRef.current || livestreamLocalStreamRef.current || localStream;
    if (!activeLocalStream) return;

    const audioTracks = activeLocalStream.getAudioTracks();
    if (!audioTracks.length) return;

    const shouldMute = audioTracks.some(track => track.enabled);
    const nextTrackEnabled = !shouldMute;

    audioTracks.forEach(track => {
      track.enabled = nextTrackEnabled;
    });

    const viewerLocalStream = livestreamLocalStreamRef.current;
    if (viewerLocalStream && viewerLocalStream !== activeLocalStream) {
      viewerLocalStream.getAudioTracks().forEach(track => {
        track.enabled = nextTrackEnabled;
      });
    }

    setIsMuted(shouldMute);
  }, [localStream]);

  const toggleDashboardSound = useCallback(() => {
    const now = Date.now();
    if (now - soundToggleLockRef.current < 120) return;
    soundToggleLockRef.current = now;
    setSoundEnabled(prev => !prev);
  }, []);

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
  const isDmRoomActive = useMemo(() => !!currentRoomId && currentRoomId.includes('_dm_'), [currentRoomId]);
  const isGroupRoomActive = useMemo(() => !!currentRoomId && !currentRoomId.includes('_dm_'), [currentRoomId]);
  const dmBackTargetRoomId = useMemo(() => {
    if (groupRoomId && !groupRoomId.includes('_dm_')) {
      return groupRoomId;
    }

    const registryGroupRoom = activeRoomRegistry.find((entry) => entry?.id && !entry.id.includes('_dm_'))?.id;
    if (registryGroupRoom) {
      return registryGroupRoom;
    }

    const localGroupRoom = rooms.find((entry) => entry?.id && entry.type !== 'dm' && !entry.id.includes('_dm_'))?.id;
    return localGroupRoom || '';
  }, [groupRoomId, activeRoomRegistry, rooms]);

  const globalOnlineUsers = useMemo(() => {
    const fromGlobal = globalPresenceUsers.filter(u => typeof u === 'string' && u.trim());
    const fromStatus = Object.entries(userStatus).filter(([, s]) => s === 'online').map(([u]) => u);
    const fromRooms = Object.values(roomUserMap).flat().filter(u => typeof u === 'string' && u.trim());
    return [...new Set([...fromGlobal, ...fromStatus, ...fromRooms])];
  }, [globalPresenceUsers, userStatus, roomUserMap]);

  const isSelectedUserOnline = useMemo(() => {
    if (!selectedUser) return false;
    const selected = selectedUser.trim().toLowerCase();
    return globalOnlineUsers.some(u => typeof u === 'string' && u.trim().toLowerCase() === selected);
  }, [globalOnlineUsers, selectedUser]);

  const roomScopedOnlineUsers = useMemo(() => {
    const activeRoomId = activeRoom || room;
    if (!activeRoomId) return [];
    const users = (roomUserMap[activeRoomId] || [])
      .map(u => typeof u === 'string' ? u : u?.username)
      .filter(u => typeof u === 'string' && u.trim());
    return [...new Set(users)];
  }, [activeRoom, room, roomUserMap]);

  const conversationOnlineUsers = useMemo(() => {
    const activeRoomId = activeRoom || room;
    const groupContextRoomId = activeRoomId && !activeRoomId.includes('_dm_')
      ? activeRoomId
      : (groupRoomId || activeRoomRegistry[0]?.id || '');

    if (!groupContextRoomId) return [];

    const mapUsers = (roomUserMap[groupContextRoomId] || [])
      .map((entry) => typeof entry === 'string' ? entry : entry?.username)
      .filter((entry) => typeof entry === 'string' && entry.trim());

    const registryUsers = (activeRoomRegistry.find((entry) => entry.id === groupContextRoomId)?.users || [])
      .map((entry) => typeof entry === 'string' ? entry : entry?.username)
      .filter((entry) => typeof entry === 'string' && entry.trim());

    return [...new Set([...mapUsers, ...registryUsers])];
  }, [activeRoom, room, groupRoomId, roomUserMap, activeRoomRegistry]);

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

  const threadRootMessage = useMemo(() => {
    if (!threadRootId) return null;
    return chatMessageById.get(threadRootId) || null;
  }, [chatMessageById, threadRootId]);

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
    if (!connected || failedQueueItems.length === 0) return;
    const retryTimer = setTimeout(() => {
      retryAllFailedQueueItems();
    }, 600);
    return () => clearTimeout(retryTimer);
  }, [connected, failedQueueItems.length, retryAllFailedQueueItems]);

  useEffect(() => {
    setThreadRootId(null);
  }, [currentRoomId]);

  useEffect(() => {
    setChatRenderLimit(chatLoadStep);
    setAutoLoadOlderTriggered(false);
    setIsLoadingOlder(false);
    if (loadOlderFeedbackTimeoutRef.current) {
      clearTimeout(loadOlderFeedbackTimeoutRef.current);
      loadOlderFeedbackTimeoutRef.current = null;
    }
  }, [currentRoomId, hasActiveSearchFilters, chatLoadStep]);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    const scrollState = loadOlderScrollStateRef.current;
    if (!chatBody || !scrollState) return;

    const restoreTimer = requestAnimationFrame(() => {
      const heightDelta = chatBody.scrollHeight - scrollState.previousHeight;
      chatBody.scrollTop = scrollState.previousTop + Math.max(0, heightDelta);
      loadOlderScrollStateRef.current = null;
      if (loadOlderFeedbackTimeoutRef.current) {
        clearTimeout(loadOlderFeedbackTimeoutRef.current);
      }
      loadOlderFeedbackTimeoutRef.current = setTimeout(() => {
        setIsLoadingOlder(false);
      }, 220);
    });

    return () => cancelAnimationFrame(restoreTimer);
  }, [renderedChat.length]);

  useEffect(() => {
    return () => {
      if (loadOlderFeedbackTimeoutRef.current) {
        clearTimeout(loadOlderFeedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleShortcuts = (event) => {
      if (!showChat) return;
      const tag = (event.target?.tagName || '').toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
      if (editing) return;

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

  const handleBackNavigation = useCallback(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      return true;
    }
    if (showMobileMenu) {
      setShowMobileMenu(false);
      return true;
    }
    if (showMenuDropdown) {
      setShowMenuDropdown(false);
      return true;
    }
    if (showCallSettings) {
      setShowCallSettings(false);
      return true;
    }
    if (showAudioSettings) {
      setShowAudioSettings(false);
      return true;
    }
    if (showVideoSettings) {
      setShowVideoSettings(false);
      return true;
    }
    if (showStreamSettings) {
      setShowStreamSettings(false);
      return true;
    }
    if (showAppSettings) {
      setShowAppSettings(false);
      return true;
    }
    if (showCallHistory) {
      setShowCallHistory(false);
      return true;
    }
    if (showStarredPanel) {
      setShowStarredPanel(false);
      return true;
    }
    if (showPinnedPanel) {
      setShowPinnedPanel(false);
      return true;
    }
    if (showClearConfirm) {
      setShowClearConfirm(false);
      return true;
    }
    if (showLogoutConfirm) {
      setShowLogoutConfirm(false);
      return true;
    }
    if (editingMsgId) {
      setEditingMsgId(null);
      return true;
    }
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
      return true;
    }
    if (threadRootId) {
      setThreadRootId(null);
      return true;
    }
    if (replyingTo) {
      setReplyingTo(null);
      return true;
    }
    if (contextMenu) {
      setContextMenu(null);
      setContextMenuMessage(null);
      return true;
    }
    if (showAdvancedSearch) {
      setShowAdvancedSearch(false);
      return true;
    }
    if (showQuickReplies) {
      setShowQuickReplies(false);
      return true;
    }
    if (showProfileModal) {
      setShowProfileModal(null);
      return true;
    }
    if (showRoomSidebar) {
      setShowRoomSidebar(false);
      return true;
    }
    if (imageViewer) {
      setImageViewer(null);
      return true;
    }
    if (voicePlayer) {
      setVoicePlayer(null);
      setPlayingVoiceId(null);
      if (audioRef.current) audioRef.current.pause();
      return true;
    }
    if (isRecording) {
      cancelVoiceRecording();
      return true;
    }
    if (incomingCall) {
      rejectCall();
      return true;
    }
    if (liveStreamInfo || callState === 'active' || callState === 'calling' || callState === 'ringing') {
      endCall();
      return true;
    }
    if (currentView !== 'chat') {
      setCurrentView('chat');
      return true;
    }
    return false;
  }, [
    showEmojiPicker,
    showMobileMenu,
    showMenuDropdown,
    showCallSettings,
    showAudioSettings,
    showVideoSettings,
    showStreamSettings,
    showAppSettings,
    showCallHistory,
    showStarredPanel,
    showPinnedPanel,
    showClearConfirm,
    showLogoutConfirm,
    editingMsgId,
    showDeleteConfirm,
    threadRootId,
    replyingTo,
    contextMenu,
    showAdvancedSearch,
    showQuickReplies,
    showProfileModal,
    showRoomSidebar,
    imageViewer,
    voicePlayer,
    isRecording,
    incomingCall,
    liveStreamInfo,
    callState,
    currentView,
    cancelVoiceRecording,
    rejectCall,
    endCall
  ]);

  const canUseBackNavigation = useMemo(() => (
    showEmojiPicker ||
    showMobileMenu ||
    showMenuDropdown ||
    showCallSettings ||
    showAudioSettings ||
    showVideoSettings ||
    showStreamSettings ||
    showAppSettings ||
    showCallHistory ||
    showStarredPanel ||
    showPinnedPanel ||
    showClearConfirm ||
    showLogoutConfirm ||
    !!editingMsgId ||
    showDeleteConfirm ||
    !!threadRootId ||
    !!replyingTo ||
    !!contextMenu ||
    showAdvancedSearch ||
    showQuickReplies ||
    !!showProfileModal ||
    showRoomSidebar ||
    !!imageViewer ||
    !!voicePlayer ||
    isRecording ||
    !!incomingCall ||
    !!liveStreamInfo ||
    callState === 'active' ||
    callState === 'calling' ||
    callState === 'ringing' ||
    currentView !== 'chat'
  ), [
    showEmojiPicker,
    showMobileMenu,
    showMenuDropdown,
    showCallSettings,
    showAudioSettings,
    showVideoSettings,
    showStreamSettings,
    showAppSettings,
    showCallHistory,
    showStarredPanel,
    showPinnedPanel,
    showClearConfirm,
    showLogoutConfirm,
    editingMsgId,
    showDeleteConfirm,
    threadRootId,
    replyingTo,
    contextMenu,
    showAdvancedSearch,
    showQuickReplies,
    showProfileModal,
    showRoomSidebar,
    imageViewer,
    voicePlayer,
    isRecording,
    incomingCall,
    liveStreamInfo,
    callState,
    currentView
  ]);

  const memoizedChatNodes = useMemo(() => {
    return renderedChat.flatMap((msg, index) => {
      const isOwn = msg.sender === username;
      const reactions = msg.reactions || {};
      const grouped = index > 0 && isGroupedMessage(msg, renderedChat[index - 1]);
      const showDateSep = index === 0 || needsDateSeparator(msg.time, renderedChat[index - 1]?.time);
      const isGroupedBelow = index < renderedChat.length - 1 && isGroupedMessage(renderedChat[index + 1], msg);
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
              const repliedMsg = chatMessageById.get(msg.replyTo);
              return repliedMsg ? (
                <div className="reply-preview" onClick={() => setThreadRootId(msg.replyTo)}>
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
              {isOwn && showReadReceiptsEnabled && showDoubleTick && (() => {
                const readers = Array.isArray(msg.readBy) ? msg.readBy : [];
                const seenByOthers = readers.some(r => r !== username);
                return <span className={`message-ticks ${(seenByOthers && showBlueTick) ? 'blue' : ''}`}>✓✓</span>;
              })()}
            </div>
          </motion.div>
        </React.Fragment>
      );
    });
  }, [
    renderedChat,
    username,
    starredMsgIds,
    chatMessageById,
    handleContextMenu,
    handleLongPressStart,
    handleLongPressEnd,
    setThreadRootId,
    openImageViewer,
    downloadMedia,
    openVoicePlayer,
    playVoiceMessage,
    playingVoiceId,
    renderMessageText,
    handleReaction,
    showReadReceiptsEnabled,
    showDoubleTick,
    showBlueTick
  ]);

  // ==================== ESC KEY HANDLER ====================
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      handleBackNavigation();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [handleBackNavigation]);

  if (showStartupSplash) {
    return (
      <div className="startup-splash" role="dialog" aria-label="Welcome animation">
        <motion.div
          className="startup-splash-inner"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="startup-topline">Welcome to</div>
          <h1 className="startup-title">DevChat Pro+</h1>

          <div className="namaste-container" aria-hidden="true">
            <svg className="hands-canvas" viewBox="0 0 200 200">
              <g className="left-hand">
                <path d="M 100 200 L 100 40 C 95 25, 85 30, 82 45 C 78 65, 72 90, 65 110 C 55 145, 40 180, 25 200 Z" />
                <path d="M 100 125 C 85 120, 75 100, 78 85 C 80 75, 85 75, 90 90 C 94 100, 97 105, 100 110" />
              </g>

              <g className="right-hand">
                <path d="M 100 200 L 100 40 C 105 25, 115 30, 118 45 C 122 65, 128 90, 135 110 C 145 145, 160 180, 175 200 Z" />
                <path d="M 100 125 C 115 120, 125 100, 122 85 C 120 75, 115 75, 110 90 C 106 100, 103 105, 100 110" />
              </g>
            </svg>

            <div className="text-wrapper">
              <div className="namaste-text">NAMASTE</div>
              <div className="glow-line" />
            </div>
          </div>

          <p className="startup-subtitle">Respectful start. Better conversations.</p>
          <button className="startup-skip-btn" onClick={() => setShowStartupSplash(false)}>
            Skip Intro
          </button>
        </motion.div>
      </div>
    );
  }

  if (showLogoutSplash) {
    return (
      <div className="logout-splash" role="status" aria-live="polite" aria-label="Logout farewell animation">
        <motion.div
          className="logout-splash-inner"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="thankyou-container" aria-hidden="true">
            <svg className="logout-hand-canvas" viewBox="0 0 200 200">
              <path d="M 115 200 C 120 160, 125 130, 125 115 L 140 70 C 145 60, 135 55, 130 65 L 115 105 L 125 45 C 128 35, 115 35, 112 45 L 102 100 L 100 25 C 100 15, 85 15, 85 25 L 88 100 L 70 45 C 68 35, 52 40, 58 52 L 78 110 C 65 115, 55 125, 45 130 C 35 135, 45 150, 55 145 C 65 140, 75 160, 85 200 Z" />
              <path d="M 85 200 C 90 150, 105 135, 78 110" fill="none" />
              <path d="M 78 120 C 100 125, 110 120, 120 110" fill="none" />
              <path d="M 82 140 C 105 145, 115 135, 125 120" fill="none" />
            </svg>

            <div className="logout-text-wrapper">
              <div className="thankyou-text">THANK YOU</div>
              <div className="thankyou-glow-line" />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==================== RENDER LOGIN SCREEN ====================
  if (!showChat) {
    return (
      <div className="login-screen">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="login-card">
          <div className="entry-mode-toggle" role="tablist" aria-label="Choose chat mode">
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === 'classic'}
              className={`entry-mode-btn ${entryMode === 'classic' ? 'active' : ''}`}
              onClick={() => setEntryMode('classic')}
            >
              Username + Room
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === 'friends'}
              className={`entry-mode-btn ${entryMode === 'friends' ? 'active' : ''}`}
              onClick={() => setEntryMode('friends')}
            >
              Friends Login
            </button>
          </div>

          {entryMode === 'classic' ? (
            <>
              <Zap color="#00a884" size={48} fill="#00a884" />
              <h2 className="brand">DevChat <span>Pro+</span></h2>
              <div className="input-group"><User size={18}/><input placeholder="Your name" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); joinRoom(); } }} autoFocus /></div>
              <div className="input-group"><Hash size={18}/><input placeholder="Room ID" value={room} onChange={e => setRoom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); joinRoom(); } }} /></div>
              <button className="join-btn" onClick={joinRoom} disabled={!username.trim() || !room.trim()}>Enter Chat</button>
            </>
          ) : (
            <FriendsFeature />
          )}
        </motion.div>
      </div>
    );
  }

  // ==================== RENDER CHAT UI ====================
  return (
    <div className="chat-container">
      {canUseBackNavigation && (
        <button
          className="global-back-btn"
          onClick={handleBackNavigation}
          aria-label="Go back"
          title="Back"
        >
          <ChevronLeft size={18} />
          <span>Back</span>
        </button>
      )}

      {/* LiveKit Stream */}
      {liveKitToken && (
        <div className="livestream-fullscreen-container">
          {showMobileMenu && isMobileView && (
            <>
              <AnimatePresence>
                <motion.div
                  className="menu-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMobileMenu(false)}
                />
                <motion.div 
                  ref={mobileMenuRef}
                  className={`menu-dropdown ${selectedUser ? 'menu-dropdown-dm' : ''} mobile-menu-sheet`}
                  initial={isMobileView ? { opacity: 0, y: 24 } : { opacity: 0, scale: 0.95, y: -10 }}
                  animate={isMobileView ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={isMobileView ? { opacity: 0, y: 24 } : { opacity: 0, scale: 0.95, y: -10 }}
                >
                  <div className="menu-header">Main Menu</div>
                  <div className="mobile-menu-scroll">
                    <button className="menu-item" onClick={() => { exportChat(); setShowMobileMenu(false); }}><FileDown size={18}/><span>Export Chat</span></button>
                    <button className="menu-item" onClick={() => { setShowStarredPanel(true); setShowMobileMenu(false); }}><Star size={18}/><span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span></button>
                    <div className="menu-section">
                      <div className="menu-header">📞 Call Settings</div>
                      <button className="menu-item" type="button" onClick={() => { setShowCallSettings(true); setShowMobileMenu(false); }}><Phone size={18}/><span>Call Preferences</span></button>
                      <button className="menu-item" type="button" onClick={() => { setShowAudioSettings(true); setShowMobileMenu(false); }}><Volume2 size={18}/><span>Audio Devices</span></button>
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
                      <button className="menu-item" onClick={() => { openSidebarView('conversations'); setShowMobileMenu(false); }}><Users size={18}/><span>Conversations</span></button>
                      <button className="menu-item" onClick={() => { openSidebarView('rooms'); setShowMobileMenu(false); }}><Hash size={18}/><span>Rooms</span></button>
                      <button className="menu-item" onClick={() => { openSidebarView('notifications'); setShowMobileMenu(false); }}><Bell size={18}/><span>Notifications {unreadNotificationCount > 0 && <span className="menu-badge new">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</span></button>
                      <button className="menu-item" type="button" onClick={() => { setShowAppSettings(true); setShowMobileMenu(false); }}><Settings size={18}/><span>App Settings</span></button>
                    </div>
                    <div className="menu-section">
                      <div className="menu-header">📊 Info</div>
                      <div className="menu-item menu-info"><Activity size={18}/><div className="menu-info-content"><span>Stats: {conversationStats.totalMessages} msgs</span><small>{conversationStats.totalUsers} users • {conversationStats.avgMessageLength} chars</small></div></div>
                    </div>
                    <div className="menu-section">
                      <button className="menu-item menu-item-danger" onClick={() => { setShowLogoutConfirm(true); setShowMobileMenu(false); }}><LogOut size={18}/><span>Logout</span></button>
                    </div>
                  </div>
                  <div className="menu-footer"><div>Session ends when browser closes</div><div className="menu-version">v{APP_VERSION} • {new Date(BUILD_DATE).toLocaleDateString()}</div></div>
                </motion.div>
              </AnimatePresence>
            </>
          )}
          <div className="livestream-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Radio size={24} color="var(--error)" className="pulse-animation" />
              <h2 style={{ color: 'var(--txt)', margin: 0, fontSize: '18px' }}>{isStreamHost ? "🔴 You are Live" : `Watching: ${currentStreamRoom}`}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isMobileView && (
                <button
                  className={`menu-toggle ${unreadNotificationCount > 0 ? 'has-notification' : ''}`}
                  onClick={() => {
                    setShowMenuDropdown(false);
                    setShowMobileMenu((prev) => !prev);
                    acknowledgeNotificationPulse();
                  }}
                  title="Open stream menu"
                  aria-label="Open stream menu"
                >
                  <Menu size={20} />
                  {unreadNotificationCount > 0 && <span className={`menu-toggle-dot ${hasNewNotificationPulse ? 'pulse' : ''}`} aria-hidden="true" />}
                </button>
              )}
              <button onClick={handleLeaveStream} style={{ background: 'var(--error)', padding: '8px 16px', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Leave Stream</button>
            </div>
          </div>
          <div style={{ height: 'calc(100vh - 60px)', marginTop: '60px' }}>
            <Suspense fallback={<div style={{ color: 'var(--txt)', padding: '16px' }}>Loading stream...</div>}>
              <LiveKitStage
                isHost={isStreamHost}
                token={liveKitToken}
                serverUrl={process.env.REACT_APP_LIVEKIT_URL || "wss://devchat-pro-f8nd2p1j.livekit.cloud"}
                onDisconnected={handleLeaveStream}
              />
            </Suspense>
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
          <button
            ref={menuToggleRef}
            className={`menu-toggle ${unreadNotificationCount > 0 ? 'has-notification' : ''}`}
            onClick={() => {
              setShowMobileMenu(false);
              setShowMenuDropdown((prev) => !prev);
              acknowledgeNotificationPulse();
            }}
            title="Menu"
          ><Menu size={24}/>{unreadNotificationCount > 0 && <span className={`menu-toggle-dot ${hasNewNotificationPulse ? 'pulse' : ''}`} aria-hidden="true" />}</button>
          
          <AnimatePresence>
            {showMenuDropdown && (
              <>
                <motion.div className="menu-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMenuDropdown(false)} />
                <motion.div
                  ref={menuDropdownRef}
                  className={`menu-dropdown ${selectedUser ? 'menu-dropdown-dm' : ''} ${isMobileView ? 'mobile-menu-sheet' : ''}`}
                  initial={isMobileView ? { opacity: 0, y: 24 } : { opacity: 0, scale: 0.95, y: -10 }}
                  animate={isMobileView ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={isMobileView ? { opacity: 0, y: 24 } : { opacity: 0, scale: 0.95, y: -10 }}
                  style={!isMobileView ? menuDropdownStyle : undefined}
                >
                  <div className="menu-header">Main Menu</div>
                  <button className="menu-item" onClick={() => { exportChat(); setShowMenuDropdown(false); }}><FileDown size={18}/><span>Export Chat</span></button>
                  <button className="menu-item" onClick={() => { setShowStarredPanel(true); setShowMenuDropdown(false); }}><Star size={18}/><span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span></button>
                  
                  <div className="menu-section">
                    <div className="menu-header">📞 Call Settings</div>
                    <button className="menu-item" type="button" onClick={() => { setShowCallSettings(true); setShowMenuDropdown(false); }}><Phone size={18}/><span>Call Preferences</span></button>
                    <button className="menu-item" type="button" onClick={() => { setShowAudioSettings(true); setShowMenuDropdown(false); }}><Volume2 size={18}/><span>Audio Devices</span></button>
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
                    <button className="menu-item" onClick={() => { openSidebarView('conversations'); setShowMenuDropdown(false); }}><Users size={18}/><span>Conversations</span></button>
                    <button className="menu-item" onClick={() => { openSidebarView('rooms'); setShowMenuDropdown(false); }}><Hash size={18}/><span>Rooms</span></button>
                    <button className="menu-item" onClick={() => { openSidebarView('notifications'); setShowMenuDropdown(false); }}><Bell size={18}/><span>Notifications {unreadNotificationCount > 0 && <span className="menu-badge new">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</span></button>
                    <button className="menu-item" type="button" onClick={() => { setShowAppSettings(true); setShowMenuDropdown(false); }}><Settings size={18}/><span>App Settings</span></button>
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
        
        {isDmRoomActive && dmBackTargetRoomId && (
          <button className="dm-back-btn" onClick={() => switchRoom(dmBackTargetRoomId)} title="Back to group chat"><ChevronLeft size={16} /><span>Group</span></button>
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

        {selectedUser && callState !== 'active' && (
          <div className="call-buttons">
            <button className="call-btn voice-call-btn" onClick={() => startCall('voice', selectedUser)} disabled={callState === 'calling' || callState === 'ringing' || !connected} title={isSelectedUserOnline ? `Voice call ${selectedUser}` : `Call ${selectedUser} (status unknown/offline)`}><Phone size={18}/></button>
            <button className="call-btn video-call-btn" onClick={() => startCall('video', selectedUser)} disabled={callState === 'calling' || callState === 'ringing' || !connected} title={isSelectedUserOnline ? `Video call ${selectedUser}` : `Call ${selectedUser} (status unknown/offline)`}><Video size={18}/></button>
          </div>
        )}
        
        <div className="users-info" title={`${onlineUsers.length} online`}><Users size={16}/><span className="users-count">{onlineUsers.length}</span></div>
        <button
          className="theme-toggle"
          type="button"
          onClick={() => {
            const nextTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(nextTheme);
            updateSettings({
              ui: {
                ...(appSettings?.ui || {}),
                theme: nextTheme,
              },
            });
          }}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
        </button>
        <button className={`sound-toggle ${soundEnabled ? 'enabled' : 'disabled'}`} type="button" onClick={toggleDashboardSound} title={soundEnabled ? "Mute" : "Unmute"}>{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
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

      {reconnectInfo && !connected && (
        <div className="reconnect-banner">
          Reconnecting {reconnectInfo.attempt}/{reconnectInfo.max} · retry in {Math.max(0, reconnectInfo.secondsLeft)}s
        </div>
      )}

      {failedQueueItems.length > 0 && (
        <div className="queue-banner">
          <span>{failedQueueItems.length} message{failedQueueItems.length > 1 ? 's' : ''} failed to send.</span>
          <button className="sidebar-mini-btn" onClick={retryAllFailedQueueItems} disabled={!connected}>Retry all</button>
        </div>
      )}

      {/* Chat Body */}
      <div className="chat-body" ref={chatBodyRef} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
        {isDragging && (
          <div className="drag-drop-overlay">
            <div className="drag-drop-content"><ImageIcon size={48} /><h3>Drop images here</h3></div>
          </div>
        )}

        {threadRootId && threadMessages.length > 0 && (
          <div className="thread-panel">
            <div className="thread-panel-header">
              <div>
                <strong>Thread</strong>
                <span>{threadMessages.length} message{threadMessages.length > 1 ? 's' : ''}</span>
              </div>
              <button type="button" className="thread-panel-close" onClick={() => setThreadRootId(null)} aria-label="Close thread">
                <X size={16} />
              </button>
            </div>
            {threadRootMessage && (
              <div className="thread-panel-root">
                <span className="thread-panel-sender">{threadRootMessage.sender}</span>
                <p>{threadRootMessage.text || (threadRootMessage.type === 'image' ? '📷 Photo' : threadRootMessage.type === 'voice' ? '🎤 Voice message' : threadRootMessage.type === 'file' ? `📎 ${threadRootMessage.fileName || 'File'}` : 'Message')}</p>
              </div>
            )}
            <div className="thread-panel-list">
              {threadMessages.map((item, itemIndex) => (
                <button key={item._id || itemIndex} type="button" className={`thread-panel-item ${item._id === threadRootId ? 'root' : ''}`} onClick={() => scrollToMessage(item._id)}>
                  <span className="thread-panel-sender">{item.sender}</span>
                  <span className="thread-panel-text">{item.text || (item.type === 'image' ? '📷 Photo' : item.type === 'voice' ? '🎤 Voice message' : item.type === 'file' ? `📎 ${item.fileName || 'File'}` : 'Message')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {isLoadingOlder && <div className="load-older-hint">Loading older…</div>}

        {hasOlderHiddenMessages && (isMobileView || !autoLoadOlderTriggered) && (
          <button
            type="button"
            className="load-older-btn"
            onClick={handleLoadOlderMessages}
            disabled={isLoadingOlder}
          >
            {isLoadingOlder ? 'Loading older…' : `Load older messages (${filteredChat.length - renderedChat.length} hidden)`}
          </button>
        )}

        <AnimatePresence>
          {memoizedChatNodes}
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
          <button onClick={() => { setReplyingTo(null); setThreadRootId(null); }}><X size={16} /></button>
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
          <textarea ref={textareaRef} className="whatsapp-input" disabled={!connected} value={message} placeholder={connected ? "Type a message..." : "Connecting..."} onChange={handleMessageChange} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) { e.preventDefault(); sendMessage(); } }} rows={1} />
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
          <Suspense fallback={<div style={{ minWidth: 260, minHeight: 240 }} />}>
            <EmojiPicker onEmojiClick={handleEmojiClick} theme={theme} />
          </Suspense>
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
              <div className="delete-modal-icon"><AlertCircle size={48} color="var(--error)" /></div>
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
                {showLastSeenEnabled && userLastSeen[showProfileModal] && <span className="profile-status" style={{ opacity: 0.75 }}>last seen {formatRelativeTime(userLastSeen[showProfileModal])}</span>}
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
              <div className="sidebar-tabs">
                <button className={`sidebar-tab ${roomSidebarView === 'conversations' ? 'active' : ''}`} onClick={() => setRoomSidebarView('conversations')}>Conversations</button>
                <button className={`sidebar-tab ${roomSidebarView === 'rooms' ? 'active' : ''}`} onClick={() => setRoomSidebarView('rooms')}>Rooms</button>
                <button className={`sidebar-tab ${roomSidebarView === 'notifications' ? 'active' : ''}`} onClick={() => { setRoomSidebarView('notifications'); markNotificationsAsRead(); }}>Notifications{unreadNotificationCount > 0 && <span className="sidebar-tab-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</button>
              </div>
              <div className="sidebar-rooms">
                {roomSidebarView === 'conversations' && (
                  <>
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
                      {conversationOnlineUsers.filter(u => u !== username).length === 0 ? (
                        <div className="sidebar-empty">No other members online</div>
                      ) : (
                        conversationOnlineUsers.filter(u => u !== username).map(user => (
                          <div className="sidebar-user-row" key={user}>
                            <div className="sidebar-user-meta"><span className="sidebar-user-dot"></span><span>{user}</span></div>
                            <button className="sidebar-dm-btn" onClick={() => { createDM(user); setShowRoomSidebar(false); }}>DM</button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {roomSidebarView === 'rooms' && (
                  <>
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">Join or Create Room</div>
                      <div className="sidebar-inline-form">
                        <input
                          className="sidebar-input"
                          value={newRoomIdInput}
                          onChange={(e) => setNewRoomIdInput(e.target.value)}
                          placeholder="Room ID"
                          onKeyDown={(e) => e.key === 'Enter' && joinGroupRoomFromPanel()}
                        />
                        <button className="sidebar-action-btn" onClick={joinGroupRoomFromPanel}>Join</button>
                      </div>
                    </div>
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">Active Rooms</div>
                      {activeRoomRegistry.filter(entry => Number(entry?.count || 0) > 0).length === 0 ? (
                        <div className="sidebar-empty">No active rooms available</div>
                      ) : (
                        activeRoomRegistry
                          .filter(entry => Number(entry?.count || 0) > 0)
                          .sort((a, b) => {
                            const countDiff = Number(b?.count || 0) - Number(a?.count || 0);
                            if (countDiff !== 0) return countDiff;
                            const nameA = String(a?.name || a?.id || '');
                            const nameB = String(b?.name || b?.id || '');
                            return nameA.localeCompare(nameB);
                          })
                          .map((entry, index) => (
                          <button key={entry.id} className={`room-item ${(activeRoom || room) === entry.id ? 'active' : ''}`} onClick={() => { switchRoom(entry.id); setShowRoomSidebar(false); }}>
                            <div className="room-icon">#</div>
                            <span>{entry.name || entry.id}</span>
                            <span className="sidebar-room-meta">{entry.count || 0}{index === 0 ? ' · Most active' : ''}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}

                {roomSidebarView === 'notifications' && (
                  <div className="sidebar-section">
                    <div className="sidebar-section-title sidebar-notifications-header">
                      <span>Recent Notifications</span>
                      <div className="sidebar-notification-actions">
                        <button className="sidebar-mini-btn" onClick={markNotificationsAsRead} disabled={unreadNotificationCount === 0}>Mark all read</button>
                        <button className="sidebar-mini-btn danger" onClick={clearNotifications} disabled={notificationItems.length === 0}>Clear all</button>
                      </div>
                    </div>
                    <label className="sidebar-unread-only">
                      <input type="checkbox" checked={notificationUnreadOnly} onChange={(e) => setNotificationUnreadOnly(e.target.checked)} />
                      Unread only
                    </label>
                    {filteredNotificationItems.length === 0 ? (
                      <div className="sidebar-empty">No notifications yet</div>
                    ) : (
                      <div className="sidebar-notification-list">
                        {filteredNotificationItems.map((item) => {
                          const itemTime = Date.parse(item?.time || '');
                          const isUnread = Number.isFinite(itemTime) ? itemTime > lastNotificationsReadAt : false;
                          return (
                          <div className={`sidebar-notification-item ${isUnread ? 'unread' : ''}`} key={item.id || `${item.type}-${item.time}`}>
                            <div className="sidebar-notification-meta">
                              <strong>{item.sender || item.type || 'Update'}</strong>
                              <span>{item.preview || item.room || item.type}</span>
                            </div>
                            {item.type === 'livestream' ? (
                              <button className="sidebar-action-btn" onClick={() => { markNotificationItemAsRead(item); requestJoinLivestreamFromNotification(item); setShowRoomSidebar(false); }}>Join</button>
                            ) : item.room ? (
                              <button className="sidebar-action-btn" onClick={() => { markNotificationItemAsRead(item); switchRoom(item.room); setShowRoomSidebar(false); }}>Open</button>
                            ) : null}
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )}
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
              <div className="delete-modal-footer"><button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)}>Stay</button><button className="btn-delete btn-logout-warning" onClick={performLogout}>Logout</button></div>
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
      {callState === 'active' && callPeer && !liveStreamInfo && (
        <Suspense fallback={<div style={{ color: 'var(--txt)', padding: '12px' }}>Loading call panel...</div>}>
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
            localVideoRef={setLocalVideoElement}
            remoteVideoRef={setRemoteVideoElement}
            formatDuration={formatCallDuration}
            localStream={localStream}
            remoteStream={remoteStream}
            remoteIsScreenSharing={remoteIsScreenSharing}
            connectionQuality={connectionQuality}
            cameraDevices={videoInputDevices}
            selectedCameraId={selectedVideoInputId}
            onCameraChange={handleInCallCameraChange}
            onRefreshCameraDevices={handleInCallCameraRefresh}
            isRefreshingCameras={isRefreshingInCallCameras}
            cameraStatusToast={inCallCameraToast}
            selectedVideoQuality={streamPanelSettings.quality}
            onVideoQualityChange={handleInCallVideoQualityChange}
            audioSettings={{
              noiseSuppression: enhancedCallSettings?.noiseSuppression !== false,
              echoCancellation: enhancedCallSettings?.echoCancellation !== false,
              autoGainControl: enhancedCallSettings?.autoGainControl !== false,
            }}
            onAudioSettingChange={handleInCallAudioSettingChange}
          />
        </Suspense>
      )}

      {/* Livestream Panel */}
      {liveStreamInfo && (
        <Suspense fallback={<div style={{ color: 'var(--txt)', padding: '12px' }}>Loading stream panel...</div>}>
          <ModernStreamPanel
            isHost={liveStreamInfo.isHost}
            stream={liveStreamInfo.isHost ? localStream : remoteStream}
            streamSource={liveStreamInfo.source}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            viewerCount={viewers}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onEndStream={stopHostedLivestream}
            onSwitchSource={switchLivestreamSource}
            streamTitle={`${liveStreamInfo?.room || room || 'Room'} Live Stream`}
            streamerName={liveStreamInfo?.host || username}
            streamThumbnail="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1280"
            viewers={liveStreamInfo?.viewers || []}
            chatMessages={livestreamComments.map(c => ({ sender: c.from, text: c.text || c.emoji, time: formatRelativeTime(c.time) }))}
            onSendChat={sendLivestreamComment}
            onReact={sendLivestreamReaction}
            streamQuality={streamPanelSettings.quality}
            streamDuration={callDuration}
            likes={livestreamComments.filter(c => c.type === 'reaction').length}
            shares={liveStreamInfo?.viewerCount || viewers || 0}
            cameraDevices={videoInputDevices}
            selectedCameraId={selectedVideoInputId}
            microphoneDevices={audioInputDevices}
            selectedMicrophoneId={selectedAudioInputId || streamPanelSettings.microphoneId || 'default'}
            audioOutputDevices={audioOutputDevices}
            selectedAudioOutput={audioOutputDevice}
            streamSettings={streamPanelSettings}
            onSettingsChange={handleStreamSettingsChange}
          />
        </Suspense>
      )}

      {/* Settings Modals */}
      <AnimatePresence>
        {showCallSettings && (
          <Suspense fallback={null}>
            <CallSettings onClose={() => setShowCallSettings(false)} callHook={enhancedCall} />
          </Suspense>
        )}
        {showAudioSettings && (
          <Suspense fallback={null}>
            <AudioSettings onClose={() => setShowAudioSettings(false)} callHook={enhancedCall} />
          </Suspense>
        )}
        {showVideoSettings && (
          <Suspense fallback={null}>
            <VideoSettings onClose={() => setShowVideoSettings(false)} callHook={enhancedCall} />
          </Suspense>
        )}
        {showStreamSettings && (
          <Suspense fallback={null}>
            <StreamSettings 
              visibility={streamVisibility}
              source={streamSource}
              onVisibilityChange={setStreamVisibility}
              onSourceChange={setStreamSource}
              onSettingsChange={handleStreamSettingsChange}
              onStartStream={() => { startLivestream(streamVisibility, streamSource); setShowStreamSettings(false); }}
              onClose={() => setShowStreamSettings(false)}
              isMobile={isMobileView}
              isWindows={/Win/i.test(navigator.platform || navigator.userAgent || '')}
            />
          </Suspense>
        )}
        {showAppSettings && (
          <Suspense fallback={null}>
            <AppSettings onClose={() => setShowAppSettings(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Call History Panel */}
      <AnimatePresence>
        {showCallHistory && (
          <Suspense fallback={null}>
            <CallHistoryPanel
              history={callHistory}
              onClose={() => setShowCallHistory(false)}
              formatDuration={formatDuration}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Settings Manager */}
      <Suspense fallback={null}>
        <SettingsManager
          currentView={currentView}
          onClose={() => setCurrentView('chat')}
          callHistory={callHistory}
          formatDuration={formatDuration}
          getQualityLabelStyle={getQualityLabelStyle}
        />
      </Suspense>

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
    <SettingsProvider>
      <CallProvider socket={socketRef.current} username={username} room={room} onlineUsers={onlineUsers}>
        <AppContent />
      </CallProvider>
    </SettingsProvider>
  );
}

if (module.hot) {
  module.hot.accept();
}

export default App;