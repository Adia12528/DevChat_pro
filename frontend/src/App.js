// DevChat Pro - Auto-versioning enabled
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
  Zoomable, Share2, Radio, BarChart3, Clock, StopCircle, Disc3, Bell, Activity,
  Headphones, Radio as RadioIcon, Volume, Video as VideoIcon, Mic as MicIcon 
} from 'lucide-react';
import SettingsManager from './components/settings/SettingsManager';
import { useSettings } from './context/settingsContext';
import EmojiPicker from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { APP_VERSION, BUILD_DATE } from './version';
import { formatRelativeTime, formatDateSeparator, needsDateSeparator, isGroupedMessage, formatFileSize, playNotificationSound, copyToClipboard, getUserColor, getInitials, getAvatarStyle, detectLinks, extractMentions } from './utils';
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
} from './callUtils';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];
const LIVESTREAM_REACTIONS = ['🔥', '👏', '❤️', '😂', '😮', '🎉'];

const CALL_EVENTS = Object.freeze({
  OFFER: 'call:offer',
  ANSWER: 'call:answer',
  ICE_CANDIDATE: 'call:ice-candidate',
  REJECT: 'call:reject',
  REJECTED: 'call:rejected',
  END: 'call:end',
  ENDED: 'call:ended',
  SCREEN_SHARE_START: 'call:screen-share-start',
  SCREEN_SHARE_END: 'call:screen-share-end'
});

const LIVESTREAM_EVENTS = Object.freeze({
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
});

const ROOM_EVENTS = Object.freeze({
  REGISTRY_UPDATED: 'room_registry_updated'
});

const LOCAL_PREVIEW_SIZES = [
  { width: 140, height: 105 },
  { width: 200, height: 150 },
  { width: 260, height: 195 }
];

function App() {
    // Debug: Check if CSS variables are loaded
    React.useEffect(() => {
      const styles = getComputedStyle(document.documentElement);
      const bgColor = styles.getPropertyValue('--bg').trim();
      console.log('CSS Variables - Background color:', bgColor);
      if (!bgColor) {
        console.error('CSS variables not loaded! Check your imports.');
      }
    }, []);
  // Mobile menu state (must be inside component)
  const [showMobileMenu, setShowMobileMenu] = useState(false);
                  // Listen for FORCE_RELOAD message from service worker to force update
                  useEffect(() => {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data && event.data.type === 'FORCE_RELOAD') {
                          window.location.reload(true);
                        }
                      });
                    }
                  }, []);
                // Detect iOS for screen sharing support
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
              // Stream visibility state
              const [streamVisibility, setStreamVisibility] = useState('public');
              // Stream source state for livestream (camera/screen)
              const [streamSource, setStreamSource] = useState('camera');
            // Error message state
            const [errorMessage, setErrorMessage] = useState('');
          // Success and error message states
          const [successMessage, setSuccessMessage] = useState('');

          // Screen share stream ref
          const screenShareStreamRef = useRef(null);
        // Reported users state (localStorage-backed)
        const [reportedUsers, setReportedUsers] = useState(() => {
          try {
            return JSON.parse(localStorage.getItem('devchatReportedUsers') || '[]');
          } catch {
            return [];
          }
        });
      // Blocked users state (localStorage-backed)
      const [blockedUsers, setBlockedUsers] = useState(() => {
        try {
          return JSON.parse(localStorage.getItem('devchatBlockedUsers') || '[]');
        } catch {
          return [];
        }
      });
    // Device detection for streaming controls
    const isWindows = /Windows/i.test(navigator.userAgent);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // ...existing code...
      const [liveKitToken, setLiveKitToken] = useState(null);
      const [currentStreamRoom, setCurrentStreamRoom] = useState("");
      const [isStreamHost, setIsStreamHost] = useState(false);
  // Existing state
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDoubleTick, setShowDoubleTick] = useState(localStorage.getItem('showDoubleTick') !== 'false');
  const [showBlueTick, setShowBlueTick] = useState(localStorage.getItem('showBlueTick') !== 'false');
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 600);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // 🌟 NEW: Unified Stream Connection Logic
    // Prevent multiple stream sessions per device/tab
    const handleJoinStream = async (roomName, asHost = false) => {
      if (liveKitToken) {
        if (currentStreamRoom === roomName) {
          setErrorMessage("You are already in this stream session.");
          setTimeout(() => setErrorMessage(''), 2500);
        } else {
          setErrorMessage("You are already in another stream session. Please leave it first.");
          setTimeout(() => setErrorMessage(''), 2500);
        }
        console.warn("[LiveKit] Already in a stream session. Ignoring join request.");
        return;
      }
      try {
        const isProduction = window.location.hostname !== 'localhost';
        const BACKEND_URL = isProduction ? "https://devchat-pro.onrender.com" : "http://localhost:5000";
        console.log(`[LiveKit] ${asHost ? 'Host' : 'Viewer'} joining stream:`, roomName, username);
        const response = await fetch(`${BACKEND_URL}/api/livekit/token?room=${roomName}&username=${username}&isHost=${asHost}`);
        const data = await response.json();
        if (data.token) {
          setCurrentStreamRoom(roomName);
          setIsStreamHost(asHost);
          setLiveKitToken(data.token);
          setSuccessMessage(asHost ? "🔴 Stream Started!" : "✅ Joined Stream");
          setTimeout(() => setSuccessMessage(''), 2000);
        } else {
          setErrorMessage("Failed to get LiveKit token");
          setTimeout(() => setErrorMessage(''), 3000);
        }
      } catch (error) {
        console.error("Failed to connect to stream:", error);
        setErrorMessage("Failed to connect to livestream");
        setTimeout(() => setErrorMessage(''), 3000);
      }
    };

    const handleLeaveStream = () => {
      if (!liveKitToken) {
        console.warn("[LiveKit] Not in a stream session. Ignoring leave request.");
        return;
      }
      console.log(`[LiveKit] Leaving stream:`, currentStreamRoom, username, isStreamHost ? 'Host' : 'Viewer');
      setLiveKitToken(null);
      setCurrentStreamRoom("");
      setIsStreamHost(false);
      setSuccessMessage("Stream Ended");
      setTimeout(() => setSuccessMessage(''), 2000);
    };

  // New feature states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  // (successMessage, errorMessage) state already declared above
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [fontStyle, setFontStyle] = useState(localStorage.getItem('fontStyle') || 'default');
  const [ringtoneStyle, setRingtoneStyle] = useState(localStorage.getItem('ringtoneStyle') || 'soft');
  const [ringtoneVolume, setRingtoneVolume] = useState(() => {
    const storedVolume = Number(localStorage.getItem('ringtoneVolume'));
    return Number.isFinite(storedVolume) ? Math.min(1, Math.max(0.05, storedVolume)) : 0.18;
  });
  const [autoJoinLivestream, setAutoJoinLivestream] = useState(() => localStorage.getItem('autoJoinLivestream') === 'true');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userProfiles, setUserProfiles] = useState({});
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [userStatus, setUserStatus] = useState({});
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showMarkdown, setShowMarkdown] = useState(true);
  
  // Voice message states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [recordingLocked, setRecordingLocked] = useState(false);
  const [slideDistance, setSlideDistance] = useState(0);
  const [startX, setStartX] = useState(0);
  
  // Image preview states
  const [imageCaption, setImageCaption] = useState('');
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]); // Multiple images: [{file, preview, id}]
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // For gallery navigation
  const [isDragging, setIsDragging] = useState(false); // Drag and drop state
  
  // Navigation & UI State (Breadcrumb/Back button system)
  const [navigationStack, setNavigationStack] = useState([]); // Track navigation history
  const [currentView, setCurrentView] = useState('chat'); // 'chat', 'starred', 'pinned', 'history', 'rooms', 'users', 'notifications', 'settings'
  
  // Private chat/DM states
  const [showRoomSidebar, setShowRoomSidebar] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [groupRoomId, setGroupRoomId] = useState('');
  const [newRoomIdInput, setNewRoomIdInput] = useState('');
  const [roomUserMap, setRoomUserMap] = useState({});
  const [activeRoomRegistry, setActiveRoomRegistry] = useState([]);
  const [globalPresenceUsers, setGlobalPresenceUsers] = useState([]);
  const [notificationItems, setNotificationItems] = useState([]);
  const [videoInputDevices, setVideoInputDevices] = useState([]);
  const [selectedVideoInputId, setSelectedVideoInputId] = useState(() => localStorage.getItem('devchatPreferredCameraId') || '');
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
  const [outgoingQueue, setOutgoingQueue] = useState([]);
  const [roomDrafts, setRoomDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('devchatRoomDrafts') || '{}');
    } catch {
      return {};
    }
  });
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    sender: '',
    fromDate: '',
    toDate: '',
    mediaType: 'all',
    mentionsOnly: false
  });
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
  const [roomPolicies, setRoomPolicies] = useState({});
  const [roomInviteTarget, setRoomInviteTarget] = useState('');
  const [showRoomAdminTools, setShowRoomAdminTools] = useState(false);
  
  // Starred messages (localStorage-backed, per session)
  const [starredMsgIds, setStarredMsgIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('devChatStarred') || '[]')); }
    catch { return new Set(); }
  });
  const [showStarredPanel, setShowStarredPanel] = useState(false);

  // Read receipts & last seen
  const [userLastSeen, setUserLastSeen] = useState({}); // { username: timestamp }
  const [reactionCounts, setReactionCounts] = useState({}); // { msgId: { emoji: count } }
  
  // Quick reply templates
  const [quickReplyTemplates, setQuickReplyTemplates] = useState([
    'Got it! 👍',
    'Thanks for the info!',
    'Let me look into it 🔍',
    'I agree 💯',
    'Not sure, let me check 🤔',
    'ASAP! ⚡'
  ]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [threadRootId, setThreadRootId] = useState(null);
  
  // Mention notifications
  const [mentionedMessages, setMentionedMessages] = useState([]);
  const [recentMentions, setRecentMentions] = useState(0);

  // Conversation stats
  const [conversationStats, setConversationStats] = useState({
    totalMessages: 0,
    totalUsers: 0,
    avgMessageLength: 0,
    mostActiveMember: null
  });

  // PWA Install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  
  // Menu dropdown state
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showStreamingTab, setShowStreamingTab] = useState(false);
  
  // Confirmation modals
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Pinned messages panel
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  
  // Message refs for scroll-to-reply
  const msgRefsMap = useRef({});
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuMessage, setContextMenuMessage] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  
  // Media viewer states
  const [imageViewer, setImageViewer] = useState(null); // { url, fileName, sender, time }
  const [voicePlayer, setVoicePlayer] = useState(null); // { url, fileName, sender, time, duration }
  
  // WebRTC Video/Voice Call States
  const [callState, setCallState] = useState(null); // 'idle' | 'calling' | 'ringing' | 'active' | 'ended'
  const [callType, setCallType] = useState(null); // 'voice' | 'video'
  const [callPeer, setCallPeer] = useState(null); // { username, userId }
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null); // { from, callType }
  const [callError, setCallError] = useState(null);
  const [liveStreamInfo, setLiveStreamInfo] = useState(null); // { sessionId, host, room, visibility, source, isHost, viewers, hasAudio }
  const [livestreamComments, setLivestreamComments] = useState([]);
  const [livestreamCommentInput, setLivestreamCommentInput] = useState('');
  const [livestreamViewerExpanded, setLivestreamViewerExpanded] = useState(false);
  const [reconnectInfo, setReconnectInfo] = useState(null); // { attempt, max, secondsLeft }
  const [, setPeerConnectionState] = useState('new');
  const [, setIceConnectionState] = useState('new');
  const [, setSignalingState] = useState('stable');
  const [localPreviewPosition, setLocalPreviewPosition] = useState({ x: 20, y: 20 });
  const [localPreviewSizeIndex, setLocalPreviewSizeIndex] = useState(1);
  const [isDraggingLocalPreview, setIsDraggingLocalPreview] = useState(false);
  
  // PREMIUM: Advanced Call Features
  const [callStats, setCallStats] = useState(null);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [showVideoEffects, setShowVideoEffects] = useState(false);
  const [videoEffectSettings, setVideoEffectSettings] = useState({
    backgroundBlur: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1
  });
  const [callHistory, setCallHistory] = useState([]);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [qualityIndicator, setQualityIndicator] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('excellent'); // excellent, good, 
  // fair, poor
  // Add these with your other navigation states
  const [showCallSettings, setShowCallSettings] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [showStreamQuality, setShowStreamQuality] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  
  // Refs
  const chatEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const searchTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null); // Separate ref for camera
  const textareaRef = useRef(null);    // Auto-growing textarea
  const contextMenuRef = useRef(null);
  const menuContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // WebRTC Refs
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const inboundRemoteStreamRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const ringtoneAudioContextRef = useRef(null);
  const callTimerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const recordingTimeRef = useRef(0);
  const audioRef = useRef(null);
  const usernameRef = useRef("");
  const roomRef = useRef("");
  const roomsRef = useRef([]);
  const subscribedRoomsRef = useRef(new Set());
  const soundEnabledRef = useRef(true);
  const pendingIceCandidatesRef = useRef([]);
  const seenIceCandidateKeysRef = useRef(new Set());
  const notificationPrefsRef = useRef(notificationPrefs);
  const blockedUsersRef = useRef(blockedUsers);
  const idleStateRef = useRef(false);
  const endCallRef = useRef(() => {});
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const reconnectCountdownRef = useRef(null);
  const reconnectRetryTimeoutRef = useRef(null);
  const remoteTrackTimeoutRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callStateRef = useRef(null);
  const callPeerRef = useRef(null);
  const liveStreamInfoRef = useRef(null);
  const autoJoinLivestreamRef = useRef(autoJoinLivestream);
  const localPreviewDragOffsetRef = useRef({ x: 0, y: 0 });
  const localPreviewMovedRef = useRef(false);
  const livestreamHostPeersRef = useRef(new Map());
  const livestreamViewerPeerRef = useRef(null);
  const livestreamLocalStreamRef = useRef(null);
  
  // PREMIUM: Advanced call features refs
  const callRecorderRef = useRef(null);
  const callStatsRef = useRef(null);
  const qualityControllerRef = useRef(null);
  const statsUpdateIntervalRef = useRef(null);
  const videoEffectsCanvasRef = useRef(null);
  const callHistoryRef = useRef(null);
  const screenStreamRef = useRef(null);
  const LOG_LEVELS = Object.freeze({ silent: 0, error: 1, warn: 2, info: 3, debug: 4 });
  const configuredLogLevel = (process.env.REACT_APP_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug')).toLowerCase();
  const activeLogLevel = LOG_LEVELS[configuredLogLevel] != null ? configuredLogLevel : (process.env.NODE_ENV === 'production' ? 'error' : 'debug');
  const shouldLog = (level) => LOG_LEVELS[level] <= LOG_LEVELS[activeLogLevel];
  const debugLog = (...args) => {
    if (shouldLog('debug')) console.log(...args);
  };

  const attachRemoteStreamToElement = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;

    const videoElement = remoteVideoRef.current;
    if (videoElement) {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      // Keep video muted so autoplay is reliable; audio is handled by remoteAudioRef.
      videoElement.muted = true;
      videoElement.defaultMuted = true;
      videoElement.play().catch((e) => debugLog('⚠️ Remote video autoplay blocked:', e));
    }

    const audioElement = remoteAudioRef.current;
    if (audioElement) {
      if (audioElement.srcObject !== stream) {
        audioElement.srcObject = stream;
      }
      audioElement.muted = false;
      audioElement.play().catch((e) => debugLog('⚠️ Remote audio autoplay blocked:', e));
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
    if (node) {
      attachRemoteStreamToElement();
    }
  }, [attachRemoteStreamToElement]);

  const setLocalVideoElement = useCallback((node) => {
    localVideoRef.current = node;
    if (node) {
      attachLocalStreamToElement();
    }
  }, [attachLocalStreamToElement]);

  const setRemoteAudioElement = useCallback((node) => {
    remoteAudioRef.current = node;
    if (node) {
      attachRemoteStreamToElement();
    }
  }, [attachRemoteStreamToElement]);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callPeerRef.current = callPeer; }, [callPeer]);
  useEffect(() => { liveStreamInfoRef.current = liveStreamInfo; }, [liveStreamInfo]);
  useEffect(() => { autoJoinLivestreamRef.current = autoJoinLivestream; }, [autoJoinLivestream]);
  useEffect(() => { notificationPrefsRef.current = notificationPrefs; }, [notificationPrefs]);
  useEffect(() => { blockedUsersRef.current = blockedUsers; }, [blockedUsers]);

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
      setLocalPreviewPosition((position) => clampLocalPreviewPosition(position.x, position.y, previewSize));
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [callState, callType, isCallMinimized, localPreviewSizeIndex, getLocalPreviewSize, clampLocalPreviewPosition]);

  useEffect(() => {
    if (!isDraggingLocalPreview) return;

    const extractPoint = (event) => {
      if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
      return { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event) => {
      if (event.cancelable) event.preventDefault();
      const point = extractPoint(event);
      const offset = localPreviewDragOffsetRef.current;
      const nextX = point.x - offset.x;
      const nextY = point.y - offset.y;
      setLocalPreviewPosition(clampLocalPreviewPosition(nextX, nextY));
    };

    const onPointerUp = () => {
      setIsDraggingLocalPreview(false);
    };

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

  // Attach remote stream whenever stream changes or call UI mounts/toggles
  useEffect(() => {
    attachRemoteStreamToElement();
  }, [remoteStream, callState, isCallMinimized, attachRemoteStreamToElement]);

  useEffect(() => {
    // Debounce stream attachment to prevent AbortError
    const attach = () => {
      const videoEl = remoteVideoRef.current;
      if (!videoEl || !remoteStream) return;
      if (videoEl.srcObject !== remoteStream) {
        videoEl.srcObject = remoteStream;
      }
      videoEl.muted = false;
      videoEl.play().catch((e) => console.log('⚠️ Remote video play failed:', e));
      const audioEl = remoteAudioRef.current;
      if (audioEl && audioEl.srcObject !== remoteStream) {
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((e) => console.log('⚠️ Remote audio play failed:', e));
      }
      if (videoEl.srcObject) {
        console.log('📹 Remote video element now has stream');
      }
    };
    const timeout = setTimeout(attach, 300);
    return () => clearTimeout(timeout);
  }, [remoteStream]);

  // Attach local stream whenever stream changes or local video element mounts
  useEffect(() => {
    if (callType === 'video') {
      attachLocalStreamToElement();
    }
  }, [localStream, callType, callState, isCallMinimized, attachLocalStreamToElement]);

  // Navigation helper functions
  const navigateTo = useCallback((view, params = {}) => {
  setNavigationStack(prev => [...prev, { view: currentView, params: {} }]);
  setCurrentView(view);
  
  // Handle settings modals
  setShowCallSettings(view === 'call-settings');
  setShowAudioSettings(view === 'audio-settings');
  setShowVideoSettings(view === 'video-settings');
  setShowStreamSettings(view === 'stream-settings');
  setShowStreamQuality(view === 'stream-quality');
  setShowAppSettings(view === 'app-settings');
  setShowMenuDropdown(false);
}, [currentView]);

  const goBack = useCallback(() => {
    if (navigationStack.length > 0) {
      const newStack = [...navigationStack];
      const previous = newStack.pop();
      setNavigationStack(newStack);
      setCurrentView(previous.view);
    } else {
      setCurrentView('chat');
      setShowStarredPanel(false);
      setShowPinnedPanel(false);
      setShowCallHistory(false);
      setShowRoomSidebar(false);
    }
    setShowMenuDropdown(false);
  }, [navigationStack]);

  const goToDashboard = useCallback(() => {
    setNavigationStack([]);
    setCurrentView('chat');
    setShowMenuDropdown(false);
    setShowStarredPanel(false);
    setShowPinnedPanel(false);
    setShowCallHistory(false);
    setShowRoomSidebar(false);
  }, []);

  // Update tab title with unread count
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) DevChat Pro` : 'DevChat Pro';
    return () => { document.title = 'DevChat Pro'; };
  }, [unreadCount]);

  // Initialize premium calling features
  useEffect(() => {
    console.log('🎯 Initializing premium calling features');
    try {
      if (!callHistoryRef.current) {
        console.log('📚 Initializing call history');
        callHistoryRef.current = new CallHistory();
        const history = callHistoryRef.current.getCallHistory();
        setCallHistory(history);
      }
    } catch (err) {
      console.warn('⚠️ Failed to initialize call history:', err);
    }
  }, []);

  // Escape key closes all modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (showEmojiPicker) { setShowEmojiPicker(false); return; }
      if (showMenuDropdown) { setShowMenuDropdown(false); return; }
      if (showStarredPanel) { setShowStarredPanel(false); return; }
      if (showPinnedPanel) { setShowPinnedPanel(false); return; }
      if (showClearConfirm) { setShowClearConfirm(false); return; }
      if (showLogoutConfirm) { setShowLogoutConfirm(false); return; }
      if (editingMsgId) { setEditingMsgId(null); return; }
      if (showDeleteConfirm) { setShowDeleteConfirm(false); return; }
      if (replyingTo) { setReplyingTo(null); return; }
      if (contextMenu) { setContextMenu(null); setContextMenuMessage(null); return; }
      if (imageViewer) { setImageViewer(null); return; }
      if (voicePlayer) { setVoicePlayer(null); setPlayingVoiceId(null); if (audioRef.current) audioRef.current.pause(); return; }
      if (isRecording) { cancelVoiceRecording(); }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showEmojiPicker, showMenuDropdown, showStarredPanel, showPinnedPanel, showClearConfirm, showLogoutConfirm, editingMsgId, showDeleteConfirm, replyingTo, contextMenu, imageViewer, voicePlayer, isRecording]);

  // Version logging
  useEffect(() => {
    console.log(`%c🚀 DevChat Pro v${APP_VERSION}`, 'color: #00ff88; font-size: 16px; font-weight: bold;');
    console.log(`%cBuild Date: ${new Date(BUILD_DATE).toLocaleString()}`, 'color: #00ccff; font-size: 12px;');
  }, []);

  // Theme effect
  // In App.js, find your theme useEffect and replace/update it:

// Theme effect with debug
useEffect(() => {
  // Set theme on HTML element
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Debug: Check if CSS variables are applied
  const styles = getComputedStyle(document.documentElement);
  const bgColor = styles.getPropertyValue('--bg').trim();
  const primaryColor = styles.getPropertyValue('--primary').trim();
  
  console.log('🎨 CSS Variables Check:', {
    '--bg': bgColor || '❌ NOT LOADED',
    '--primary': primaryColor || '❌ NOT LOADED',
    '--txt': styles.getPropertyValue('--txt').trim() || '❌ NOT LOADED'
  });
  
  if (!bgColor) {
    console.error('❌ CSS variables not loaded! Check imports in index.js');
    // Show visible error in development only
    if (process.env.NODE_ENV !== 'production') {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ff4444;
        color: white;
        padding: 15px;
        text-align: center;
        z-index: 99999;
        font-weight: bold;
        font-size: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      errorDiv.textContent = '⚠️ CSS not loaded! Check console for details.';
      document.body.prepend(errorDiv);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.remove();
        }
      }, 5000);
    }
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
    if (selectedVideoInputId) {
      localStorage.setItem('devchatPreferredCameraId', selectedVideoInputId);
    } else {
      localStorage.removeItem('devchatPreferredCameraId');
    }
  }, [selectedVideoInputId]);

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

  const refreshVideoInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`
        }));

      setVideoInputDevices(cameras);

      if (selectedVideoInputId && !cameras.some((camera) => camera.deviceId === selectedVideoInputId)) {
        setSelectedVideoInputId('');
      }
    } catch (err) {
      console.warn('⚠️ Failed to enumerate cameras:', err?.message || err);
    }
  }, [selectedVideoInputId]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;

    refreshVideoInputs();

    const onDeviceChange = () => {
      refreshVideoInputs();
    };

    navigator.mediaDevices.addEventListener?.('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [refreshVideoInputs]);

  const withPreferredVideoDevice = useCallback((constraints) => {
    if (!selectedVideoInputId || !constraints || constraints.video === false) return constraints;

    const nextConstraints = { ...constraints };
    const existingVideo = typeof nextConstraints.video === 'object' && nextConstraints.video !== null
      ? nextConstraints.video
      : {};

    nextConstraints.video = {
      ...existingVideo,
      deviceId: { exact: selectedVideoInputId }
    };

    return nextConstraints;
  }, [selectedVideoInputId]);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mention detection, read receipts & conversation stats
  useEffect(() => {
    if (chat.length === 0) return;

    // Detect mentions and track notification count
    const mentions = chat.filter(msg => 
      msg.text.includes(`@${username}`) || msg.text.includes('@everyone')
    );
    setMentionedMessages(mentions);
    setRecentMentions(mentions.filter(m => m.sender !== username).length);

    // Calculate conversation stats
    const totalMessages = chat.length;
    const uniqueUsers = new Set(chat.map(m => m.sender)).size;
    const avgLength = totalMessages > 0 ? chat.reduce((sum, m) => sum + (m.text?.length || 0), 0) / totalMessages : 0;
    const senderCounts = {};
    chat.forEach(m => senderCounts[m.sender] = (senderCounts[m.sender] || 0) + 1);
    const mostActive = Object.entries(senderCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    setConversationStats({
      totalMessages,
      totalUsers: uniqueUsers,
      avgMessageLength: Math.round(avgLength),
      mostActiveMember: mostActive
    });

    // Update last seen for each user
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

    // Build user profiles with message counts
    setUserProfiles(prev => {
      const profiles = { ...prev };
      Object.entries(senderCounts).forEach(([sender, count]) => {
        if (!profiles[sender]) {
          profiles[sender] = {
            joinedAt: chat.find(m => m.sender === sender)?.time || now,
            messageCount: count,
            lastSeen: now,
            role: sender === username ? 'you' : 'member',
            isBot: sender.toLowerCase().includes('bot') ? true : false
          };
        } else {
          profiles[sender].messageCount = count;
          profiles[sender].lastSeen = now;
        }
      });
      return profiles;
    });
  }, [chat, username]);

  // Session management - restore from sessionStorage on mount
  useEffect(() => {
    const savedUsername = sessionStorage.getItem('chatUsername');
    const savedRoom = sessionStorage.getItem('chatRoom');
    
    if (savedUsername && savedRoom) {
      console.log('🔄 Restoring session from sessionStorage');
      setUsername(savedUsername);
      setRoom(savedRoom);
      // Note: Socket connection happens in the socket useEffect
    }
    
    // Clear session on browser/tab close (sessionStorage handles this automatically)
    const handleBeforeUnload = (e) => {
      if (socketRef.current && showChat) {
        socketRef.current.emit('update_status', { 
          username: usernameRef.current, 
          status: 'offline' 
        });
        socketRef.current.emit('leave_room', {
          room: roomRef.current,
          username: usernameRef.current
        });
        socketRef.current.emit('user_logout', {
          username: usernameRef.current,
          room: roomRef.current
        });
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [showChat]);

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
    const startMinutes = (startH * 60) + startM;
    const endMinutes = (endH * 60) + endM;

    if (startMinutes === endMinutes) return true;
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
      messagePayload.text?.includes('@everyone') ||
      (Array.isArray(messagePayload.mentions) && messagePayload.mentions.includes(usernameRef.current));

    if (prefs.dmOnlyPriority && !isDm) return false;
    if (prefs.mentionOnly && !mentionsCurrentUser) return false;
    if (isWithinQuietHours() && !mentionsCurrentUser) return false;

    return true;
  }, [isWithinQuietHours]);

  const emitReliableMessage = useCallback((messagePayload, options = {}) => {
    const socket = socketRef.current;
    if (!socket || !connected) {
      setErrorMessage('Not connected');
      setTimeout(() => setErrorMessage(''), 2500);
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

    setOutgoingQueue((prev) => [queueItem, ...prev].slice(0, 50));

    socket.emit('send_message', queueItem.payload, (ack) => {
      if (ack?.success) {
        setOutgoingQueue((prev) => prev.map((entry) => (
          entry.id === messageId ? { ...entry, status: 'sent', error: null } : entry
        )));
        setTimeout(() => {
          setOutgoingQueue((prev) => prev.filter((entry) => !(entry.id === messageId && entry.status === 'sent')));
        }, 3000);
        if (typeof options.onSuccess === 'function') {
          options.onSuccess(ack);
        }
        return;
      }

      const errMessage = ack?.error || 'Message failed to send';
      setOutgoingQueue((prev) => prev.map((entry) => (
        entry.id === messageId ? { ...entry, status: 'failed', error: errMessage } : entry
      )));
      setErrorMessage(errMessage);
      setTimeout(() => setErrorMessage(''), 3000);
    });

    return messageId;
  }, [connected]);

  const retryQueueItem = useCallback((queueId) => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    const target = outgoingQueue.find((entry) => entry.id === queueId);
    if (!target) return;

    setOutgoingQueue((prev) => prev.map((entry) => (
      entry.id === queueId ? { ...entry, status: 'sending', attempts: entry.attempts + 1, error: null } : entry
    )));

    socket.emit('send_message', target.payload, (ack) => {
      if (ack?.success) {
        setOutgoingQueue((prev) => prev.map((entry) => (
          entry.id === queueId ? { ...entry, status: 'sent', error: null } : entry
        )));
        return;
      }

      const errMessage = ack?.error || 'Retry failed';
      setOutgoingQueue((prev) => prev.map((entry) => (
        entry.id === queueId ? { ...entry, status: 'failed', error: errMessage } : entry
      )));
    });
  }, [connected, outgoingQueue]);

  // PWA Install prompt handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
      setIsAppInstalled(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsAppInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Scroll detection for unread badge
  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatBody;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
      if (atBottom) {
        setUnreadCount(0);
        // Mark messages as read
        const unreadIds = chat.filter(m => m.sender !== username && !m.readBy?.includes(username)).map(m => m._id);
        if (unreadIds.length > 0 && socketRef.current) {
          socketRef.current.emit('mark_read', { messageIds: unreadIds, username: usernameRef.current, room: roomRef.current });
        }
      }
    };

    chatBody.addEventListener('scroll', handleScroll);
    return () => chatBody.removeEventListener('scroll', handleScroll);
  }, [chat, username]);

  // Socket setup
  useEffect(() => {
    const isProduction = window.location.hostname !== 'localhost';
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (isProduction ? "https://devchat-pro.onrender.com" : "http://localhost:5000");

    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      rememberUpgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        upgrade: true,
      withCredentials: true,
      timeout: 20000
    });
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("✅ Connected to server, id:", newSocket.id);
      setConnected(true);
      if (roomRef.current && usernameRef.current) {
        console.log("🔄 Re-joining room after reconnect:", roomRef.current);
        newSocket.emit("join_room", { room: roomRef.current, username: usernameRef.current, active: true, fetchHistory: true });
        const allRooms = Array.from(subscribedRoomsRef.current);
        allRooms
          .filter((joinedRoom) => joinedRoom && joinedRoom !== roomRef.current)
          .forEach((joinedRoom) => {
            newSocket.emit("join_room", { room: joinedRoom, username: usernameRef.current, active: false, fetchHistory: false });
          });
        newSocket.emit("update_status", { username: usernameRef.current, status: 'online' });
      }
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      setConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("⚠️ Connection error:", error.message);
      setConnected(false);
    });

    newSocket.io.on("reconnect_attempt", (attempt) => {
      console.log("🔄 Reconnect attempt #" + attempt);
    });

    newSocket.on("load_history", (data) => {
      console.log("📥 Loaded history:", data);
      const messages = Array.isArray(data) ? data : [];
      setChat(messages);
      setPinnedMessages(messages.filter(m => m.isPinned));
    });

    const removeTypingUser = (user) => {
      const timers = typingTimersRef.current;
      if (timers.has(user)) {
        clearTimeout(timers.get(user));
        timers.delete(user);
      }
      setTypingUsers((prev) => {
        if (!prev.has(user)) return prev;
        const updated = new Set(prev);
        updated.delete(user);
        return updated;
      });
    };

    newSocket.on("receive_message", (data) => {
      console.log("💬 Received message:", {
        type: data.type,
        sender: data.sender,
        hasFileUrl: !!data.fileUrl,
        text: data.text?.substring(0, 30)
      });
      
      // Prevent duplicate messages
      if (lastMessageIdRef.current === data._id) return;
      lastMessageIdRef.current = data._id;

      if (blockedUsersRef.current.includes(data.sender)) {
        return;
      }

      if (data.clientMessageId) {
        setOutgoingQueue((prev) => prev.map((entry) => (
          entry.id === data.clientMessageId ? { ...entry, status: 'sent', error: null } : entry
        )));
      }

      const messageRoom = data.room;
      const activeRoomId = roomRef.current;
      const isDifferentRoom = messageRoom && activeRoomId && messageRoom !== activeRoomId;

      if (isDifferentRoom) {
        const shouldNotify = shouldNotifyForMessage(data, isDifferentRoom);
        if (shouldNotify) {
        const source = messageRoom.includes('_dm_') ? 'DM' : 'Group';
        const previewText =
          data.type === 'image' ? '📷 Photo' :
          data.type === 'voice' ? '🎤 Voice message' :
          data.type === 'file' ? `📎 ${data.fileName || 'File'}` :
          (data.text || '').trim() || 'New message';

        setNotificationItems((prev) => {
          if (prev.some((entry) => entry.id === data._id)) return prev;
          return [
            {
              id: data._id,
              room: messageRoom,
              sender: data.sender,
              source,
              preview: previewText,
              time: data.time || new Date().toISOString()
            },
            ...prev
          ].slice(0, 100);
        });

        if (soundEnabledRef.current) {
          try {
            if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            playNotificationSound(audioContextRef.current);
          } catch (e) {
            console.log('Sound playback failed:', e);
          }
        }
        }

        removeTypingUser(data.sender);
        return;
      }
      
      setChat((prev) => {
        // Double-check for duplicates in array
        if (prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
      removeTypingUser(data.sender);
      
      if (!isAtBottomRef.current && data.sender !== usernameRef.current) {
        setUnreadCount(c => c + 1);
      }
      
      if (soundEnabledRef.current && data.sender !== usernameRef.current && !notificationPrefsRef.current.mutedRooms.includes(messageRoom) && !isWithinQuietHours()) {
        try {
          if (!audioContextRef.current)
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          playNotificationSound(audioContextRef.current);
        } catch (e) {
          console.log('Sound playback failed:', e);
        }
      }
    });

    newSocket.on("chat_cleared", () => {
      console.log("🗑️ Chat cleared");
      setChat([]);
      setPinnedMessages([]);
    });

    newSocket.on("user_joined", (data) => {
      console.log("👤 User joined:", data.username);
      const users = Array.isArray(data.users) ? [...new Set(data.users.filter(Boolean))] : [];
      const targetRoom = data.room || roomRef.current;
      setRoomUserMap((prev) => ({ ...prev, [targetRoom]: users }));
      if (targetRoom === roomRef.current) {
        setOnlineUsers(users);
      }
      setUserStatus((prev) => {
        const next = { ...prev };
        users.forEach((user) => {
          next[user] = 'online';
        });
        return next;
      });
    });

    newSocket.on("user_left", (data) => {
      console.log("👤 User left:", data.username);
      const targetRoom = data.room || roomRef.current;
      if (Array.isArray(data.users)) {
        const users = [...new Set(data.users.filter(Boolean))];
        setRoomUserMap((prev) => ({ ...prev, [targetRoom]: users }));
        if (targetRoom === roomRef.current) {
          setOnlineUsers(users);
        }
      } else {
        setRoomUserMap((prev) => {
          const currentRoomUsers = prev[targetRoom] || [];
          const users = currentRoomUsers.filter((user) => user !== data.username);
          if (targetRoom === roomRef.current) {
            setOnlineUsers(users);
          }
          return { ...prev, [targetRoom]: users };
        });
      }
      removeTypingUser(data.username);
    });

    // Handle user list updates from server
    newSocket.on("user_list_updated", (data) => {
      console.log("📋 User list updated:", data.users);
      const activeUsers = Array.isArray(data.users) ? [...new Set(data.users.filter(Boolean))] : [];
      const targetRoom = data.room || roomRef.current;
      setRoomUserMap((prev) => ({ ...prev, [targetRoom]: activeUsers }));
      if (targetRoom === roomRef.current) {
        setOnlineUsers(activeUsers);
      }
      setUserStatus((prev) => {
        const next = { ...prev };
        activeUsers.forEach((user) => {
          next[user] = 'online';
        });
        return next;
      });
    });

    newSocket.on("global_users_updated", (data) => {
      const activeUsers = Array.isArray(data?.users) ? [...new Set(data.users.filter(Boolean))] : [];
      setGlobalPresenceUsers(activeUsers);
      setUserStatus((prev) => {
        const next = { ...prev };
        activeUsers.forEach((user) => {
          next[user] = 'online';
        });
        Object.keys(next).forEach((user) => {
          if (!activeUsers.includes(user)) {
            next[user] = 'offline';
          }
        });
        return next;
      });
    });

    // Handle when user goes offline/disconnects
    newSocket.on("user_offline", (data) => {
      console.log("🔌 User went offline:", data.username);
      setOnlineUsers((prev) => prev.filter(u => u !== data.username));
      setRoomUserMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((roomKey) => {
          next[roomKey] = (next[roomKey] || []).filter((user) => user !== data.username);
        });
        return next;
      });
      setUserStatus(prev => ({ ...prev, [data.username]: 'offline' }));
      removeTypingUser(data.username);
    });

    // Handle logout event
    newSocket.on("user_logout", (data) => {
      console.log("🚪 User logged out:", data.username);
      setOnlineUsers((prev) => prev.filter(u => u !== data.username));
      setRoomUserMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((roomKey) => {
          next[roomKey] = (next[roomKey] || []).filter((user) => user !== data.username);
        });
        return next;
      });
      setUserStatus(prev => ({ ...prev, [data.username]: 'offline' }));
      removeTypingUser(data.username);
    });

    const startTypingTimer = (user) => {
      const timers = typingTimersRef.current;
      if (timers.has(user)) clearTimeout(timers.get(user));
      const id = setTimeout(() => {
        setTypingUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(user);
          return updated;
        });
        timers.delete(user);
      }, 5000);
      timers.set(user, id);
    };

    const clearTypingTimer = (user) => {
      const timers = typingTimersRef.current;
      if (!timers.has(user)) return;
      clearTimeout(timers.get(user));
      timers.delete(user);
    };

    newSocket.on("user_typing", (data) => {
      if (data.username === usernameRef.current) return;
      setTypingUsers((prev) => new Set([...prev, data.username]));
      startTypingTimer(data.username);
    });

    newSocket.on("user_stopped_typing", (stoppedUser) => {
      if (stoppedUser === usernameRef.current) return;
      clearTypingTimer(stoppedUser);
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(stoppedUser);
        return updated;
      });
    });

    newSocket.on("message_edited", (updatedMessage) => {
      console.log("✏️ Message edited:", updatedMessage);
      setChat((prev) => prev.map(m => m._id === updatedMessage._id ? updatedMessage : m));
    });

    newSocket.on("message_deleted", (data) => {
      console.log("🗑️ Message deleted:", data.messageId);
      setChat((prev) => prev.filter(m => m._id !== data.messageId));
    });

    // New event handlers
    newSocket.on("reaction_added", (data) => {
      setChat(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    newSocket.on("reaction_removed", (data) => {
      setChat(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    newSocket.on("message_pinned", (message) => {
      setChat(prev => prev.map(m => m._id === message._id ? message : m));
      setPinnedMessages(prev => [...prev, message]);
    });

    newSocket.on("message_unpinned", (data) => {
      setChat(prev => prev.map(m => m._id === data.messageId ? { ...m, isPinned: false } : m));
      setPinnedMessages(prev => prev.filter(m => m._id !== data.messageId));
    });

    newSocket.on("messages_read", (data) => {
      setChat(prev => prev.map(m => {
        if (data.messageIds.includes(m._id)) {
          return { ...m, readBy: [...new Set([...(m.readBy || []), data.username])] };
        }
        return m;
      }));
    });

    newSocket.on("user_status_changed", (data) => {
      setUserStatus(prev => ({ ...prev, [data.username]: data.status }));
      if (data.lastSeen) {
        setUserLastSeen(prev => ({ ...prev, [data.username]: data.lastSeen }));
      }
    });

    newSocket.on('room_policy_updated', ({ room: policyRoom, policy }) => {
      if (!policyRoom || !policy) return;
      setRoomPolicies((prev) => ({ ...prev, [policyRoom]: policy }));
    });

    newSocket.on('room_join_denied', ({ room: deniedRoom, reason }) => {
      const reasonLabel = reason === 'invite_only'
        ? 'This room is invite-only.'
        : 'This room is locked.';
      setErrorMessage(`Could not join ${deniedRoom}: ${reasonLabel}`);
      setTimeout(() => setErrorMessage(''), 3200);
    });

    newSocket.on('room_invited', ({ room: invitedRoom, by }) => {
      setSuccessMessage(`Invited to ${invitedRoom} by ${by}`);
      setTimeout(() => setSuccessMessage(''), 2600);
    });

    newSocket.on('room_removed', ({ room: removedRoom, by }) => {
      setErrorMessage(`Removed from ${removedRoom} by ${by}`);
      setTimeout(() => setErrorMessage(''), 3200);
    });

    newSocket.on('block_list_updated', ({ blocked }) => {
      if (!Array.isArray(blocked)) return;
      setBlockedUsers(blocked);
    });

    newSocket.on("profile_updated", (data) => {
      setUserProfiles(prev => ({ ...prev, [data.username]: { avatar: data.avatar, bio: data.bio } }));
    });

    // WebRTC Signaling Events

    const handleIncomingCall = async (data) => {
      if (
        data?.renegotiate &&
        callStateRef.current === 'active' &&
        peerConnectionRef.current &&
        callPeerRef.current?.username === data.from &&
        data.offer
      ) {
        try {
          debugLog('🔁 [RENEGOTIATE] Received ICE-restart offer from active peer:', data.from);
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const renegotiatedAnswer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(renegotiatedAnswer);

          socketRef.current?.emit(CALL_EVENTS.ANSWER, {
            to: data.from,
            from: usernameRef.current,
            answer: renegotiatedAnswer,
            renegotiate: true
          });

          if (pendingIceCandidatesRef.current.length > 0) {
            const stillPending = [];
            for (const candidate of pendingIceCandidatesRef.current) {
              if (!candidate || !candidate.candidate) continue;
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (iceError) {
                stillPending.push(candidate);
              }
            }
            pendingIceCandidatesRef.current = stillPending;
          }

          debugLog('✅ [RENEGOTIATE] Answered ICE-restart offer');
          return;
        } catch (err) {
          console.error('❌ [RENEGOTIATE] Failed handling restart offer:', err);
        }
      }

      debugLog("📞 ✅ RECEIVED Incoming call from:", data.from, "Type:", data.callType, "Offer:", !!data.offer);
      debugLog("🔔 Setting incomingCall state and playing ringtone");
      setIncomingCall({ from: data.from, callType: data.callType, offer: data.offer });
      playRingtone();
    };

    newSocket.on(CALL_EVENTS.OFFER, handleIncomingCall);

    const handleCallAnswered = async (data) => {
      debugLog("✅ [CALLER] Call answered by:", data.from);
      stopRingtone();
      try {
        if (peerConnectionRef.current && data.answer) {
          // CRITICAL FIX: Stop ringtone when call is answered
          debugLog("🛑 [CALLER] STOPPING RINGTONE - call answered");
          if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
          }

          debugLog("📋 [CALLER] Setting answer as remote description");
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));

          if (pendingIceCandidatesRef.current.length > 0) {
            debugLog(`🧊 [CALLER] Flushing ${pendingIceCandidatesRef.current.length} queued ICE candidate(s)`);
            const stillPending = [];
            for (const candidate of pendingIceCandidatesRef.current) {
              if (!candidate || !candidate.candidate) {
                console.warn('⚠️ [CALLER] Skipping invalid ICE candidate payload');
                continue;
              }
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (iceError) {
                console.warn('⚠️ [CALLER] Failed to apply queued ICE candidate, keeping for retry:', iceError?.message || iceError);
                stillPending.push(candidate);
              }
            }
            pendingIceCandidatesRef.current = stillPending;
          }

          debugLog("✅ [CALLER] Remote description set from answer");
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          setCallState('active');
          startCallTimer();
          debugLog("🎉 [CALLER] Call state set to ACTIVE");
        } else {
          console.warn("⚠️ [CALLER] Missing peerConnection or answer:", { 
            hasPeerConnection: !!peerConnectionRef.current,
            hasAnswer: !!data.answer 
          });
        }
      } catch (err) {
        console.error("❌ [CALLER] Error setting remote description:", err);
        setCallError("Failed to establish connection");
      }
    };

    newSocket.on(CALL_EVENTS.ANSWER, handleCallAnswered);

    newSocket.on(CALL_EVENTS.REJECTED, (data) => {
      debugLog("❌ Call rejected by:", data.from);
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (remoteTrackTimeoutRef.current) {
        clearTimeout(remoteTrackTimeoutRef.current);
        remoteTrackTimeoutRef.current = null;
      }
      setCallError("Call was rejected");
      endCallRef.current(false);
    });

    newSocket.on(CALL_EVENTS.ENDED, (data) => {
      debugLog("📴 Call ended by:", data.from);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      endCallRef.current(false);
    });

    newSocket.on(CALL_EVENTS.ICE_CANDIDATE, async (data) => {
      debugLog("🧊 [ICE-CANDIDATE] Received from:", data.from);
      try {
        const pc = peerConnectionRef.current;
        if (!data.candidate || !data.candidate.candidate) {
          console.warn("⚠️ [ICE] Missing candidate payload");
          return;
        }

        if (pc && pc.remoteDescription) {
          debugLog("➕ [ICE] Adding ICE candidate", {
            candidate: data.candidate.candidate?.substring(0, 50),
            type: data.candidate.type
          });
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          debugLog("✅ [ICE] ICE candidate added");
        } else {
          pendingIceCandidatesRef.current.push(data.candidate);
          debugLog("⏳ [ICE] Queued candidate until remote description is ready", {
            hasPeerConnection: !!pc,
            queueSize: pendingIceCandidatesRef.current.length
          });
        }
      } catch (err) {
        console.error("⚠️ [ICE] Error adding ICE candidate (may be normal):", err.message);
      }
    });

    newSocket.on("call:peer-disconnected", () => {
      debugLog("⚠️ Peer disconnected");
      setCallError("Connection lost");
      endCallRef.current(false);
    });

    // Handle screen share state notifications
    newSocket.on(CALL_EVENTS.SCREEN_SHARE_START, (data) => {
      console.log("📺 [SCREEN_SHARE] Remote peer started screen sharing:", data.from);
      setRemoteIsScreenSharing(true);
    });

    newSocket.on(CALL_EVENTS.SCREEN_SHARE_END, (data) => {
      console.log("📹 [SCREEN_SHARE] Remote peer stopped screen sharing:", data.from);
      setRemoteIsScreenSharing(false);
    });

    newSocket.on(LIVESTREAM_EVENTS.STARTED, (data) => {
      if (!data?.sessionId || !data?.host) return;
      const visibilityLabel = data.visibility === 'public' ? 'public' : 'room';
      const sourceLabel = data.source === 'screen' ? 'screen' : 'camera';
      setSuccessMessage(`🔴 ${data.host} started a ${sourceLabel} ${visibilityLabel} livestream`);
      setTimeout(() => setSuccessMessage(''), 3000);

      setNotificationItems((prev) => {
        if (prev.some((entry) => entry.type === 'livestream' && entry.sessionId === data.sessionId)) return prev;
        return [
          {
            id: `live-${data.sessionId}`,
            type: 'livestream',
            sessionId: data.sessionId,
            room: data.room || roomRef.current,
            sender: data.host,
            source: 'LIVE',
            visibility: data.visibility || 'room',
            streamSource: data.source || 'camera',
            preview: `${data.host} is live now (${sourceLabel} • ${visibilityLabel})`,
            time: data.startedAt || new Date().toISOString()
          },
          ...prev
        ].slice(0, 100);
      });
    });

    newSocket.on(LIVESTREAM_EVENTS.AVAILABLE, (data) => {
      if (!data?.sessionId || !data?.host) return;
      const visibilityLabel = data.visibility === 'public' ? 'public' : 'room';
      const sourceLabel = data.source === 'screen' ? 'screen' : 'camera';

      setNotificationItems((prev) => {
        if (prev.some((entry) => entry.type === 'livestream' && entry.sessionId === data.sessionId)) return prev;
        return [
          {
            id: `live-${data.sessionId}`,
            type: 'livestream',
            sessionId: data.sessionId,
            room: data.room || roomRef.current,
            sender: data.host,
            source: 'LIVE',
            visibility: data.visibility || 'room',
            streamSource: data.source || 'camera',
            preview: `${data.host} is still live (${sourceLabel} • ${visibilityLabel})`,
            time: data.startedAt || new Date().toISOString()
          },
          ...prev
        ].slice(0, 100);
      });
    });

    newSocket.on(LIVESTREAM_EVENTS.OFFER, (data) => {
      if (!data?.offer || !data?.from || !data?.sessionId) return;

      if (callStateRef.current === 'active' || callStateRef.current === 'calling' || callStateRef.current === 'ringing') {
        newSocket.emit(LIVESTREAM_EVENTS.DECLINE, {
          sessionId: data.sessionId,
          to: data.from,
          from: usernameRef.current
        });
        return;
      }

      const livestreamInvite = {
        from: data.from,
        callType: 'video',
        offer: data.offer,
        isLivestream: true,
        sessionId: data.sessionId,
        visibility: data.visibility || 'room',
        source: data.source || 'camera',
        room: data.room || null
      };

      if (autoJoinLivestreamRef.current) {
        (async () => {
          try {
            await joinLivestreamAsViewer({
              sessionId: livestreamInvite.sessionId,
              host: livestreamInvite.from,
              offer: livestreamInvite.offer,
              visibility: livestreamInvite.visibility || 'room',
              source: livestreamInvite.source || 'camera',
              room: livestreamInvite.room || null,
              autoJoined: true
            });
            setSuccessMessage(`✅ Auto-joined livestream from ${livestreamInvite.from}`);
            setTimeout(() => setSuccessMessage(''), 2400);
          } catch (err) {
            console.error('❌ Failed to auto-join livestream:', err);
            setCallError('Failed to auto-join livestream');
            setIncomingCall(livestreamInvite);
            playRingtone();
          }
        })();
        return;
      }

      setIncomingCall(livestreamInvite);
      playRingtone();
    });

    newSocket.on(ROOM_EVENTS.REGISTRY_UPDATED, (data) => {
      const nextRooms = Array.isArray(data?.rooms)
        ? data.rooms.filter((roomEntry) => roomEntry?.id && !roomEntry.id.includes('_dm_'))
        : [];
      setActiveRoomRegistry(nextRooms);
    });

    newSocket.on(LIVESTREAM_EVENTS.ANSWER, async (data) => {
      try {
        if (!data?.sessionId || !data?.from || !data?.answer) return;
        const hostPeer = livestreamHostPeersRef.current.get(data.from);
        if (!hostPeer) return;
        // Only set remote description if signaling state is not 'stable'
        if (hostPeer.signalingState !== 'stable') {
          await hostPeer.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else {
          console.warn('⚠️ Skipping setRemoteDescription: signalingState is stable');
        }
      } catch (err) {
        console.error('❌ Failed to apply livestream answer:', err);
      }
    });

    newSocket.on(LIVESTREAM_EVENTS.ICE_CANDIDATE, async (data) => {
      try {
        if (!data?.candidate || !data?.from || !data?.sessionId) return;

        const isHostSession = liveStreamInfoRef.current?.isHost && liveStreamInfoRef.current?.sessionId === data.sessionId;
        if (isHostSession) {
          const hostPeer = livestreamHostPeersRef.current.get(data.from);
          if (hostPeer && hostPeer.remoteDescription) {
            await hostPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
          return;
        }

        const viewerPeer = livestreamViewerPeerRef.current;
        if (viewerPeer && viewerPeer.remoteDescription) {
          await viewerPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.warn('⚠️ Failed to apply livestream ICE candidate:', err?.message || err);
      }
    });

    newSocket.on(LIVESTREAM_EVENTS.VIEWERS_UPDATE, (data) => {
      if (!data?.sessionId) return;
      setLiveStreamInfo((prev) => {
        if (!prev || prev.sessionId !== data.sessionId || !prev.isHost) return prev;
        return {
          ...prev,
          viewers: Array.isArray(data.viewers) ? data.viewers : [],
          viewerCount: Number.isFinite(data.count) ? data.count : (Array.isArray(data.viewers) ? data.viewers.length : 0)
        };
      });
    });

    newSocket.on(LIVESTREAM_EVENTS.JOIN_REQUEST, (data) => {
      if (!data?.sessionId || !data?.from) return;
      const activeSession = liveStreamInfoRef.current;
      if (!activeSession?.isHost || activeSession.sessionId !== data.sessionId) return;

      const hostStream = livestreamLocalStreamRef.current;
      if (!hostStream) return;

      createLivestreamHostPeer(data.from, data.sessionId, hostStream).catch((err) => {
        console.error('❌ Failed to connect late livestream viewer:', err);
      });
    });

    newSocket.on(LIVESTREAM_EVENTS.COMMENTED, (data) => {
      if (!data?.sessionId || !data?.from || !data?.text) return;
      if (liveStreamInfoRef.current?.sessionId !== data.sessionId) return;

      setLivestreamComments((prev) => [...prev, {
        id: data.id || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'comment',
        from: data.from,
        text: data.text,
        time: data.time || new Date().toISOString()
      }].slice(-80));
    });

    newSocket.on(LIVESTREAM_EVENTS.REACTED, (data) => {
      if (!data?.sessionId || !data?.from || !data?.emoji) return;
      if (liveStreamInfoRef.current?.sessionId !== data.sessionId) return;

      setLivestreamComments((prev) => [...prev, {
        id: data.id || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'reaction',
        from: data.from,
        emoji: data.emoji,
        time: data.time || new Date().toISOString()
      }].slice(-80));
    });

    newSocket.on(LIVESTREAM_EVENTS.DECLINE, (data) => {
      if (!data?.from) return;
      closeLivestreamHostPeer(data.from);
    });

    newSocket.on(LIVESTREAM_EVENTS.STOPPED, (data) => {
      if (!data?.sessionId) return;

      setNotificationItems((prev) => prev.filter((entry) => entry.sessionId !== data.sessionId));

      const activeSession = liveStreamInfoRef.current;
      if (activeSession?.sessionId !== data.sessionId) return;

      // Only viewers should clean up their peer/stream on STOPPED event
      if (!activeSession?.isHost) {
        const viewerPeer = livestreamViewerPeerRef.current;
        if (viewerPeer) {
          try {
            viewerPeer.close();
          } catch {
            // ignore close errors
          }
          livestreamViewerPeerRef.current = null;
        }
        setRemoteStream(null);
        setCallState('idle');
        setCallType(null);
        setCallPeer(null);
        setCallDuration(0);
        stopCallTimer();
        setLiveStreamInfo(null);
        setLivestreamComments([]);
        setLivestreamCommentInput('');
        setSuccessMessage(`🔴 Livestream ended (${data.reason || 'stopped'})`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    });

    // Handle proper disconnect when user closes tab/browser
    const handleBeforeUnload = () => {
      if (newSocket.connected) {
        newSocket.emit('user_leaving', { username: usernameRef.current, room: roomRef.current });
        newSocket.disconnect();
      }
    };

    // Handle visibility changes (tab switching, minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (newSocket.connected) {
          newSocket.emit('update_status', { username: usernameRef.current, status: 'away' });
        }
      } else {
        if (newSocket.connected) {
          newSocket.emit('update_status', { username: usernameRef.current, status: 'online' });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Cleanup socket connection
      if (newSocket.connected) {
        try {
          newSocket.emit('user_leaving', { username: usernameRef.current, room: roomRef.current });
          newSocket.disconnect();
        } catch (err) {
          console.warn('⚠️ Error during socket cleanup:', err);
        }
      }

      // End active calls
      if (callStateRef.current === 'active' || callStateRef.current === 'calling' || callStateRef.current === 'ringing') {
        endCallRef.current(false);
      }
      
      // Stop ringtone
      stopRingtone();

      // Clear call timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Comprehensive media cleanup
      console.log('🧹 [CLEANUP] Starting comprehensive media cleanup');
      
      // Stop local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          try {
            console.log('🛑 [CLEANUP] Stopping local track:', track.kind);
            track.stop();
          } catch (err) {
            console.warn('⚠️ [CLEANUP] Error stopping local track:', err);
          }
        });
        localStreamRef.current = null;
      }

      // Stop remote stream tracks
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => {
          try {
            console.log('🛑 [CLEANUP] Stopping remote track:', track.kind);
            track.stop();
          } catch (err) {
            console.warn('⚠️ [CLEANUP] Error stopping remote track:', err);
          }
        });
        remoteStreamRef.current = null;
      }
      inboundRemoteStreamRef.current = null;

      // Close peer connection
      if (peerConnectionRef.current) {
        try {
          console.log('🔌 [CLEANUP] Closing peer connection');
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        } catch (err) {
          console.warn('⚠️ [CLEANUP] Error closing peer connection:', err);
        }
      }

      // Stop quality controller
      if (qualityControllerRef.current) {
        try {
          qualityControllerRef.current.stop();
          qualityControllerRef.current = null;
        } catch (err) {
          console.warn('⚠️ [CLEANUP] Error stopping quality controller:', err);
        }
      }

      // Stop call recorder
      if (callRecorderRef.current) {
        try {
          callRecorderRef.current.stop();
          callRecorderRef.current = null;
        } catch (err) {
          console.warn('⚠️ [CLEANUP] Error stopping call recorder:', err);
        }
      }

      // Clear intervals
      if (statsUpdateIntervalRef.current) {
        clearInterval(statsUpdateIntervalRef.current);
        statsUpdateIntervalRef.current = null;
      }

      // Clear typing timers
      typingTimersRef.current.forEach(id => {
        try {
          clearTimeout(id);
        } catch (err) {
          console.warn('⚠️ [CLEANUP] Error clearing typing timer:', err);
        }
      });
      typingTimersRef.current.clear();
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Clear recording interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        } catch (err) {
          console.warn('⚠️ [CLEANUP] Error closing audio context:', err);
        }
      }

      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          console.log('⏹️ [CLEANUP] Stopping media recorder');
          mediaRecorderRef.current.stop();
          const stream = mediaRecorderRef.current.stream;
          if (stream) {
            stream.getTracks().forEach(track => {
              try {
                track.stop();
              } catch (err) {
                console.warn('⚠️ [CLEANUP] Error stopping recorder track:', err);
              }
            });
          }
          mediaRecorderRef.current = null;
        } catch (err) {
          console.warn('⚠️ [CLEANUP] Error stopping media recorder:', err);
        }
      }

      // Clear screen sharing
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.warn('⚠️ [CLEANUP] Error stopping screen share track:', err);
          }
        });
        screenShareStreamRef.current = null;
      }

      // Clear pending ICE candidates
      pendingIceCandidatesRef.current = [];
      seenIceCandidateKeysRef.current.clear();

      livestreamHostPeersRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore close errors
        }
      });
      livestreamHostPeersRef.current.clear();

      if (livestreamViewerPeerRef.current) {
        try {
          livestreamViewerPeerRef.current.close();
        } catch {
          // ignore close errors
        }
        livestreamViewerPeerRef.current = null;
      }

      if (livestreamLocalStreamRef.current) {
        livestreamLocalStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore stop errors
          }
        });
        livestreamLocalStreamRef.current = null;
      }

      // Clear reconnect timers
      if (reconnectCountdownRef.current) {
        clearInterval(reconnectCountdownRef.current);
        reconnectCountdownRef.current = null;
      }
      if (reconnectRetryTimeoutRef.current) {
        clearTimeout(reconnectRetryTimeoutRef.current);
        reconnectRetryTimeoutRef.current = null;
      }

      console.log('✅ [CLEANUP] Cleanup completed');
    };
  }, []);

  useEffect(() => { 
    if (isAtBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
    }
  }, [chat, typingUsers, isAtBottom]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  const filteredChat = useMemo(() => {
    const roomId = roomRef.current || room;
    const isDmRoom = typeof roomId === 'string' && roomId.includes('_dm_');
    const query = debouncedSearchQuery.trim().toLowerCase();
    const dmQuery = dmSearchQuery.trim().toLowerCase();

    return chat.filter((msg) => {
      const msgText = (msg.text || '').toLowerCase();
      const msgSender = (msg.sender || '').toLowerCase();

      if (query && !(msgText.includes(query) || msgSender.includes(query))) {
        return false;
      }

      if (isDmRoom && dmQuery && !msgText.includes(dmQuery) && !msgSender.includes(dmQuery)) {
        return false;
      }

      if (searchFilters.sender.trim() && msgSender !== searchFilters.sender.trim().toLowerCase()) {
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
  }, [chat, debouncedSearchQuery, room, dmSearchQuery, searchFilters, username]);

  const searchResultCount = useMemo(() => {
    if (!debouncedSearchQuery) return 0;
    return filteredChat.length;
  }, [debouncedSearchQuery, filteredChat]);

  const failedQueueItems = useMemo(() => {
    return outgoingQueue.filter((entry) => entry.status === 'failed');
  }, [outgoingQueue]);

  const availableSenders = useMemo(() => {
    return [...new Set(chat.map((msg) => msg.sender).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [chat]);

  // Close context menu when clicking outside
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

  useEffect(() => {
    if (!showChat || !room) return;
    if (!room.includes('_dm_')) {
      setGroupRoomId(room);
      setRooms(prev => {
        const hasGroup = prev.some(r => r.id === room);
        if (hasGroup) return prev;
        return [{ id: room, name: room, type: 'group' }, ...prev];
      });
      if (!activeRoom) {
        setActiveRoom(room);
      }
    }
  }, [room, showChat, activeRoom]);

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
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));
    markActive();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActive));
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [showChat, connected]);

  const typingDisplay = useMemo(() => {
    const arr = Array.from(typingUsers);
    if (arr.length === 0) return "";
    if (arr.length === 1) return `${arr[0]} is typing`;
    if (arr.length === 2) return `${arr[0]} and ${arr[1]} are typing`;
    return `${arr[0]}, ${arr[1]} and ${arr.length - 2} others are typing`;
  }, [typingUsers]);

  const joinRoom = useCallback(() => { 
    if (username && room && socketRef.current) { 
      console.log(`🚪 Joining room: ${room}`);
      
      // Store session in sessionStorage (clears on browser close)
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

  const handleMessageChange = useCallback((e) => {
    const nextValue = e.target.value;
    setMessage(nextValue);
    if (roomRef.current) {
      setRoomDrafts((prev) => ({ ...prev, [roomRef.current]: nextValue }));
    }
    // Auto-grow textarea
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; }
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
      const peer = participants.find((participant) => participant !== usernameRef.current);
      if (peer && blockedUsers.includes(peer)) {
        setErrorMessage('Unblock this user before sending messages');
        setTimeout(() => setErrorMessage(''), 2500);
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
    setRoomDrafts((prev) => ({ ...prev, [roomRef.current]: '' }));
    setReplyingTo(null);
    if (typingTimeoutRef.current) { 
      clearTimeout(typingTimeoutRef.current); 
      typingTimeoutRef.current = null; 
    }
    socketRef.current.emit("stop_typing", { room: roomRef.current, username: usernameRef.current });
  }, [message, connected, replyingTo, emitReliableMessage, blockedUsers]);

  const handleFileUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log(`📁 ${files.length} file(s) selected`);
    
    // Filter and validate files
    const validFiles = [];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedDocTypes = ['application/pdf', 'application/msword', 
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    for (const file of files) {
      if (file.size > maxSize) {
        setErrorMessage(`${file.name} is too large! Maximum size is 10MB.`);
        setTimeout(() => setErrorMessage(''), 4000);
        continue;
      }
      
      if ([...allowedImageTypes, ...allowedDocTypes].includes(file.type)) {
        validFiles.push(file);
      } else {
        setErrorMessage(`${file.name} is not a supported file type.`);
        setTimeout(() => setErrorMessage(''), 4000);
      }
    }
    
    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }
    
    // Separate images from documents
    const imageFiles = validFiles.filter(f => f.type.startsWith('image/'));
    const docFiles = validFiles.filter(f => !f.type.startsWith('image/'));
    
    // Handle images with preview
    if (imageFiles.length > 0) {
      const imagePromises = imageFiles.map((file, index) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({
              file: file,
              preview: event.target.result,
              id: Date.now() + index
            });
          };
          reader.readAsDataURL(file);
        });
      });
      
      const loadedImages = await Promise.all(imagePromises);
      setSelectedImages(loadedImages);
      setCurrentImageIndex(0);
      setShowImagePreview(true);
      setImageCaption('');
      console.log(`🖼️ Loaded ${loadedImages.length} images for preview`);
    }
    
    // Handle documents directly
    for (const docFile of docFiles) {
      await uploadFile(docFile, '');
    }
    
    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);
  
  // Handle drag and drop
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the chat body entirely
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
    
    // Simulate file input event
    const mockEvent = {
      target: {
        files: files
      }
    };
    await handleFileUpload(mockEvent);
  }, [handleFileUpload]);
  
  // Remove image from selection
  const removeImage = useCallback((imageId) => {
    setSelectedImages(prev => {
      const filtered = prev.filter(img => img.id !== imageId);
      if (filtered.length === 0) {
        setShowImagePreview(false);
        return [];
      }
      // Adjust current index if needed
      if (currentImageIndex >= filtered.length) {
        setCurrentImageIndex(filtered.length - 1);
      }
      return filtered;
    });
  }, [currentImageIndex]);
  
  // Upload single file (called for non-images or individual uploads)
  const uploadFile = useCallback(async (file, caption = '') => {
    setUploadingFile(true);
    setUploadProgress('Preparing...');
    setShowImagePreview(false);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'devchat_uploads');

    let retries = 3;
    while (retries > 0) {
      try {
        setUploadProgress(`Uploading... (${4 - retries}/3)`);
        console.log(`🔄 Upload attempt ${4 - retries} of 3`);
        const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          console.error('❌ Cloudinary error response:', data);
          throw new Error(data.error?.message || `Upload failed with status ${res.status}`);
        }
        
        if (data.error) {
          console.error('❌ Cloudinary returned error:', data.error);
          throw new Error(data.error.message);
        }
        
        console.log(`✅ File uploaded successfully: ${data.secure_url}`);
        
        const messageText = caption || file.name;
        const messageType = file.type.startsWith('image/') ? 'image' : 'file';
        
        console.log(`📤 Sending ${messageType} message:`, {
          type: messageType,
          fileUrl: data.secure_url,
          fileName: file.name
        });
        
        emitReliableMessage({ 
          room: roomRef.current, 
          sender: usernameRef.current, 
          text: messageText,
          type: messageType,
          fileUrl: data.secure_url,
          fileName: file.name,
          fileSize: file.size
        });
        
        setSuccessMessage('File uploaded successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        setImageCaption('');
        break;
      } catch (error) {
        console.error(`❌ Upload attempt ${4 - retries} failed:`, error.message);
        retries--;
        if (retries === 0) {
          setErrorMessage(`Upload failed: ${error.message}. Check your connection and try again.`);
          setTimeout(() => setErrorMessage(''), 5000);
        } else {
          console.log(`🔄 Retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    setUploadingFile(false);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [emitReliableMessage]);
  
  // Upload multiple images at once
  const uploadMultipleImages = useCallback(async () => {
    if (selectedImages.length === 0) return;
    
    setUploadingFile(true);
    setShowImagePreview(false);
    
    const totalImages = selectedImages.length;
    let successCount = 0;
    
    for (let i = 0; i < selectedImages.length; i++) {
      const { file } = selectedImages[i];
      setUploadProgress(`Uploading image ${i + 1} of ${totalImages}...`);
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'devchat_uploads');
        
        const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        
        if (!res.ok || data.error) {
          console.error(`❌ Failed to upload ${file.name}:`, data.error);
          continue;
        }
        
        // Send message for each image (use caption only on first image if provided)
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
        console.log(`✅ Uploaded ${i + 1}/${totalImages}: ${file.name}`);
      } catch (error) {
        console.error(`❌ Error uploading ${file.name}:`, error.message);
      }
    }
    
    if (successCount > 0) {
      setSuccessMessage(`${successCount} image(s) sent successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage('Failed to upload images. Please try again.');
      setTimeout(() => setErrorMessage(''), 4000);
    }
    
    // Clear state
    setSelectedImages([]);
    setImageCaption('');
    setCurrentImageIndex(0);
    setUploadingFile(false);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [selectedImages, imageCaption, emitReliableMessage]);
  
  const cancelImagePreview = useCallback(() => {
    setShowImagePreview(false);
    setSelectedImages([]);
    setImageCaption('');
    setCurrentImageIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  const handleEmojiClick = useCallback((emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  }, []);

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

  const togglePin = useCallback((messageId, isPinned) => {
    if (!socketRef.current) return;
    socketRef.current.emit(isPinned ? 'unpin_message' : 'pin_message', { messageId, room: roomRef.current });
  }, []);

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

  // Scroll to a specific message by ID (used for scroll-to-reply)
  const scrollToMessage = useCallback((messageId) => {
    const el = msgRefsMap.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('msg-highlight');
      setTimeout(() => el.classList.remove('msg-highlight'), 1500);
    }
  }, []);

  const toggleStar = useCallback((msgId) => {
    setStarredMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      try { localStorage.setItem('devChatStarred', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const handleCopyMessage = useCallback((text, msgId) => {
    copyToClipboard(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

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

  const deleteMessage = useCallback((msgId) => {
    setDeletingMsgId(msgId);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (socketRef.current && deletingMsgId)
      socketRef.current.emit("delete_message", {
        messageId: deletingMsgId,
        room: roomRef.current,
        sender: usernameRef.current,
      });
    setShowDeleteConfirm(false);
    setDeletingMsgId(null);
  }, [deletingMsgId]);

  // Context menu handlers
  const handleContextMenu = useCallback((e, message) => {
    // Don't show context menu if clicking on interactive elements
    const target = e.target;
    const isInteractive = target.tagName === 'A' || 
                         target.tagName === 'BUTTON' || 
                         target.closest('a') || 
                         target.closest('button');
    
    if (isInteractive) return;
    
    // Only preventDefault if event is cancelable
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();
    
    const x = e.clientX || e.touches?.[0]?.clientX || 0;
    const y = e.clientY || e.touches?.[0]?.clientY || 0;
    
    // Calculate menu dimensions (approximate)
    const menuWidth = 280;
    const menuHeight = 350;
    
    // Adjust position to keep menu within viewport
    let adjustedX = x;
    let adjustedY = y;
    
    // Check right boundary
    if (x + menuWidth > window.innerWidth) {
      adjustedX = window.innerWidth - menuWidth - 10;
    }
    
    // Check bottom boundary
    if (y + menuHeight > window.innerHeight) {
      adjustedY = window.innerHeight - menuHeight - 10;
    }
    
    // Check left boundary
    if (adjustedX < 10) {
      adjustedX = 10;
    }
    
    // Check top boundary
    if (adjustedY < 10) {
      adjustedY = 10;
    }
    
    setContextMenu({ x: adjustedX, y: adjustedY });
    setContextMenuMessage(message);
  }, []);

  const handleLongPressStart = useCallback((e, message) => {
    // Don't trigger long press on interactive elements
    const target = e.target;
    const isInteractive = target.tagName === 'A' || 
                         target.tagName === 'BUTTON' || 
                         target.closest('a') || 
                         target.closest('button');
    
    if (isInteractive) return;
    
    const timer = setTimeout(() => {
      const touch = e.touches?.[0];
      if (touch) {
        // Only preventDefault if event is cancelable to avoid console warnings
        if (e.cancelable) {
          e.preventDefault();
        }
        handleContextMenu({ 
          preventDefault: () => {}, 
          stopPropagation: () => {},
          clientX: touch.clientX, 
          clientY: touch.clientY,
          target: e.target
        }, message);
      }
    }, 500); // 500ms for long press
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

  // Playback and viewer functions (moved before handleContextMenuAction to avoid initialization error)
  const playVoiceMessage = useCallback(async (audioUrl, msgId) => {
    console.log(`🎵 Play voice message requested: ${msgId}`);
    
    if (playingVoiceId === msgId) {
      // Pause currently playing audio
      audioRef.current?.pause();
      console.log('⏸️ Voice paused');
      setPlayingVoiceId(null);
    } else {
      try {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        console.log('🎧 Creating new audio:', audioUrl);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        // Set up event handlers before playing
        audio.onended = () => {
          console.log('✅ Voice playback ended');
          setPlayingVoiceId(null);
        };
        
        audio.onerror = (error) => {
          console.error('❌ Audio playback error:', error);
          setErrorMessage('Failed to play voice message. File may be corrupted.');
          setTimeout(() => setErrorMessage(''), 4000);
          setPlayingVoiceId(null);
        };
        
        // Play returns a promise - handle it properly
        setPlayingVoiceId(msgId);
        await audio.play();
        console.log('▶️ Voice playing');
      } catch (error) {
        console.error('❌ Failed to play voice:', error);
        setErrorMessage('Unable to play voice message. Try again or check your browser settings.');
        setTimeout(() => setErrorMessage(''), 4000);
        setPlayingVoiceId(null);
        audioRef.current = null;
      }
    }
  }, [playingVoiceId]);

  // Open image viewer
  const openImageViewer = useCallback((imageData) => {
    setImageViewer(imageData);
  }, []);

  // Close image viewer
  const closeImageViewer = useCallback(() => {
    setImageViewer(null);
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
      case 'react':
        // Handle reactions
        break;
      case 'view':
        // Open image viewer for image messages
        if (contextMenuMessage.type === 'image' && contextMenuMessage.fileUrl) {
          console.log('🖼️ Opening image from context menu:', contextMenuMessage.fileUrl);
          openImageViewer({
            url: contextMenuMessage.fileUrl,
            fileName: `image-${new Date(contextMenuMessage.time).getTime()}.jpg`,
            sender: contextMenuMessage.sender,
            time: contextMenuMessage.time
          });
        }
        break;
      case 'play':
        // Play voice message
        if (contextMenuMessage.type === 'voice' && contextMenuMessage.fileUrl) {
          console.log('🔊 Playing voice from context menu:', contextMenuMessage.fileUrl);
          playVoiceMessage(contextMenuMessage.fileUrl, contextMenuMessage._id);
        }
        break;
      default:
        break;
    }
    closeContextMenu();
  }, [contextMenuMessage, handleCopyMessage, startEditMessage, deleteMessage, togglePin, toggleStar, closeContextMenu, openImageViewer, playVoiceMessage]);

  const renderMessageText = (msg) => {
    if (!showMarkdown) return <p>{msg.text}</p>;
    
    const links = detectLinks(msg.text);
    let content = msg.text;
    
    // Highlight mentions
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

  // Voice message functions
  const startVoiceRecording = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Voice recording not supported in this browser. Please use Chrome, Safari, or Firefox.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    
    console.log('🎙️ Requesting microphone access...');
    setUploadProgress('Requesting microphone access...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Determine best audio format for the device
      let mimeType = 'audio/webm';
      let fileExtension = 'webm';
      
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        fileExtension = 'webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        fileExtension = 'mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
        fileExtension = 'ogg';
      }
      
      console.log(`🎤 Using audio format: ${mimeType}`);
      
      setUploadProgress('');
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Store mimeType and extension for later use
      mediaRecorder.customMimeType = mimeType;
      mediaRecorder.customExtension = fileExtension;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Use the correct mimeType that was set during recording
        const actualMimeType = mediaRecorder.customMimeType || 'audio/webm';
        const fileExt = mediaRecorder.customExtension || 'webm';
        
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        stream.getTracks().forEach(track => track.stop());
        
        // Get the actual recording time from ref (avoids stale closure)
        const actualRecordingTime = recordingTimeRef.current;
        console.log(`📦 Created audio blob: ${(audioBlob.size / 1024).toFixed(2)} KB, type: ${actualMimeType}, duration: ${actualRecordingTime}s`);
        
        // Check if cancelled (very short recording)
        if (actualRecordingTime < 1) {
          console.log('⏹️ Recording cancelled (too short)');
          setIsRecording(false);
          setRecordingTime(0);
          recordingTimeRef.current = 0;
          setRecordingLocked(false);
          setSlideDistance(0);
          return;
        }
        
        // Check size (5MB max for voice)
        if (audioBlob.size > 5 * 1024 * 1024) {
          setErrorMessage('Voice message too long. Maximum 5MB.');
          setTimeout(() => setErrorMessage(''), 4000);
          return;
        }
        
        // Validate blob has content
        if (audioBlob.size === 0) {
          setErrorMessage('Recording failed - no audio captured. Please try again.');
          setTimeout(() => setErrorMessage(''), 4000);
          setIsRecording(false);
          setRecordingTime(0);
          setRecordingLocked(false);
          setSlideDistance(0);
          return;
        }
        
        setUploadingFile(true);
        setUploadProgress('Uploading voice message...');
        
        // Upload to Cloudinary with retry
        const formData = new FormData();
        formData.append('file', audioBlob, `voice-message.${fileExt}`);
        formData.append('upload_preset', 'devchat_uploads');
        formData.append('resource_type', 'auto'); // Let Cloudinary auto-detect audio format
        
        console.log(`⬆️ Uploading voice: ${(audioBlob.size / 1024).toFixed(2)} KB as voice-message.${fileExt}, type: ${actualMimeType}`);
        
        let retries = 3;
        while (retries > 0) {
          try {
            const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
              method: 'POST',
              body: formData
            });
            
            const data = await res.json();
            
            if (!res.ok) {
              console.error('❌ Cloudinary error response:', data);
              throw new Error(data.error?.message || `Upload failed with status ${res.status}`);
            }
            
            if (data.error) {
              console.error('❌ Cloudinary returned error:', data.error);
              throw new Error(data.error.message);
            }
            
            console.log(`📤 Sending voice message:`, {
              type: 'voice',
              fileUrl: data.secure_url,
              duration: actualRecordingTime
            });
            
            emitReliableMessage({
              room: roomRef.current,
              sender: usernameRef.current,
              text: 'Voice message',
              type: 'voice',
              fileUrl: data.secure_url,
              duration: actualRecordingTime
            });
            
            setSuccessMessage('Voice message sent!');
            setTimeout(() => setSuccessMessage(''), 2000);
            break;
          } catch (error) {
            console.error(`❌ Voice upload attempt ${4 - retries} failed:`, error.message);
            retries--;
            if (retries === 0) {
              setErrorMessage(`Failed to send voice message: ${error.message}. Please try again.`);
              setTimeout(() => setErrorMessage(''), 5000);
            } else {
              console.log(`🔄 Retrying... (${retries} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        setUploadingFile(false);
        setUploadProgress('');
        setRecordingTime(0);
        recordingTimeRef.current = 0;
        setRecordingLocked(false);
        setSlideDistance(0);
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setErrorMessage('Recording failed. Please try again.');
        setTimeout(() => setErrorMessage(''), 4000);
        setIsRecording(false);
        setRecordingTime(0);
        recordingTimeRef.current = 0;
        setRecordingLocked(false);
        setSlideDistance(0);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      setRecordingLocked(false);
      setSlideDistance(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => {
          const newTime = t + 1;
          recordingTimeRef.current = newTime; // Keep ref in sync
          // Auto-stop at 2 minutes
          if (newTime >= 120) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return 120;
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setUploadProgress('');
      
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Microphone access denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No microphone found. Please connect a microphone.');
      } else {
        setErrorMessage('Failed to start recording: ' + error.message);
      }
      setTimeout(() => setErrorMessage(''), 5000);
    }
  }, [recordingTime]);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);
  
  const cancelVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      // Stop without saving
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
      
      // Cancel if slid too far (more than 120px)
      if (distance > 120) {
        cancelVoiceRecording();
      }
    }
  }, [recordingLocked, startX, cancelVoiceRecording]);
  
  const handleRecordingStart = useCallback((e) => {
    const touch = e.touches ? e.touches[0] : e;
    setStartX(touch.clientX);
    startVoiceRecording();
  }, [startVoiceRecording]);
  
  // Desktop click handler - toggle recording on/off
  const handleDesktopRecordingClick = useCallback((e) => {
    // Prevent if this is a touch event (mobile)
    if (e.type === 'touchstart' || e.type === 'touchend') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (isRecording) {
      // Stop recording
      stopVoiceRecording();
    } else {
      // Start recording
      startVoiceRecording();
    }
  }, [isRecording, startVoiceRecording, stopVoiceRecording]);

  // Download media file
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

  // Open voice player modal
  const openVoicePlayer = useCallback((voiceData) => {
    setVoicePlayer(voiceData);
  }, []);

  // Close voice player modal
  const closeVoicePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setVoicePlayer(null);
    setPlayingVoiceId(null);
  }, []);

  // DM functions
  const createDM = useCallback((targetUser) => {
    if (!targetUser || targetUser === usernameRef.current) {
      setErrorMessage('You can only start a DM with another user');
      setTimeout(() => setErrorMessage(''), 2500);
      return;
    }
    if (blockedUsers.includes(targetUser)) {
      setErrorMessage('Unblock this user before starting a DM');
      setTimeout(() => setErrorMessage(''), 2500);
      return;
    }
    const dmRoom = [username, targetUser].sort().join('_dm_');
    const previousRoomId = roomRef.current;
    const existingRoom = rooms.find(r => r.id === dmRoom);
    if (!existingRoom) {
      setRooms(prev => [...prev, { id: dmRoom, name: targetUser, type: 'dm', with: targetUser }]);
    }
    setActiveRoom(dmRoom);
    subscribedRoomsRef.current.add(dmRoom);
    if (previousRoomId && previousRoomId !== dmRoom) {
      subscribedRoomsRef.current.add(previousRoomId);
    }
    socketRef.current.emit("join_room", { room: dmRoom, username: usernameRef.current, active: true, fetchHistory: true });
    if (previousRoomId && previousRoomId !== dmRoom) {
      socketRef.current.emit("join_room", { room: previousRoomId, username: usernameRef.current, active: false, fetchHistory: false });
    }
    setRoom(dmRoom);
    setMessage(roomDrafts[dmRoom] || '');
    setShowRoomSidebar(false);
    setShowMenuDropdown(false);
    setShowProfileModal(null);
  }, [username, rooms, roomDrafts, blockedUsers]);

  const switchRoom = useCallback((roomId) => {
    const previousRoomId = roomRef.current;
    setActiveRoom(roomId);
    setRoom(roomId);
    subscribedRoomsRef.current.add(roomId);
    if (previousRoomId && previousRoomId !== roomId) {
      subscribedRoomsRef.current.add(previousRoomId);
    }
    socketRef.current.emit("join_room", { room: roomId, username: usernameRef.current, active: true, fetchHistory: true });
    if (previousRoomId && previousRoomId !== roomId) {
      socketRef.current.emit("join_room", { room: previousRoomId, username: usernameRef.current, active: false, fetchHistory: false });
    }
    if (!roomId.includes('_dm_')) {
      socketRef.current.emit('room_policy_request', { room: roomId, actor: usernameRef.current });
    }
    setChat([]);
    setMessage(roomDrafts[roomId] || '');
    const roomUsers = roomUserMap[roomId];
    setOnlineUsers(Array.isArray(roomUsers) ? roomUsers : []);
    setNotificationItems((prev) => prev.filter((entry) => entry.room !== roomId));
    setShowRoomSidebar(false);
    setShowMenuDropdown(false);
  }, [roomUserMap, roomDrafts]);

  const joinGroupRoomFromPanel = useCallback(() => {
    const nextRoomId = newRoomIdInput.trim();
    if (!nextRoomId) return;

    if (nextRoomId.includes('_dm_')) {
      setErrorMessage('Use Conversations tab for DM chats. Enter a group Room ID here.');
      setTimeout(() => setErrorMessage(''), 2600);
      return;
    }

    setRooms((prev) => {
      if (prev.some((roomEntry) => roomEntry.id === nextRoomId)) {
        return prev;
      }
      return [{ id: nextRoomId, name: nextRoomId, type: 'group' }, ...prev];
    });

    setGroupRoomId(nextRoomId);
    setNewRoomIdInput('');
    switchRoom(nextRoomId);
    goBack();
  }, [newRoomIdInput, switchRoom, goBack]);

  const toggleRoomMute = useCallback((roomId) => {
    if (!roomId) return;
    setNotificationPrefs((prev) => {
      const isMuted = prev.mutedRooms.includes(roomId);
      return {
        ...prev,
        mutedRooms: isMuted
          ? prev.mutedRooms.filter((entry) => entry !== roomId)
          : [...prev.mutedRooms, roomId]
      };
    });
  }, []);

  const blockUserAction = useCallback((targetUser) => {
    if (!targetUser || targetUser === usernameRef.current) return;
    socketRef.current?.emit('block_user', { actor: usernameRef.current, target: targetUser }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        setTimeout(() => setErrorMessage(''), 2600);
        return;
      }
      setBlockedUsers((prev) => (prev.includes(targetUser) ? prev : [...prev, targetUser]));
      setSuccessMessage(`${targetUser} blocked`);
      setTimeout(() => setSuccessMessage(''), 2200);
    });
  }, []);

  const unblockUserAction = useCallback((targetUser) => {
    if (!targetUser) return;
    socketRef.current?.emit('unblock_user', { actor: usernameRef.current, target: targetUser }, () => {
      setBlockedUsers((prev) => prev.filter((entry) => entry !== targetUser));
      setSuccessMessage(`${targetUser} unblocked`);
      setTimeout(() => setSuccessMessage(''), 2200);
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
        setTimeout(() => setErrorMessage(''), 2600);
        return;
      }
      setReportedUsers((prev) => (prev.includes(targetUser) ? prev : [...prev, targetUser]));
      setSuccessMessage(`Reported ${targetUser}`);
      setTimeout(() => setSuccessMessage(''), 2200);
    });
  }, []);

  const updateCurrentRoomPolicy = useCallback((nextPolicy) => {
    const activeRoomId = roomRef.current;
    if (!activeRoomId || activeRoomId.includes('_dm_')) return;
    socketRef.current?.emit('room_set_policy', {
      room: activeRoomId,
      actor: usernameRef.current,
      ...nextPolicy
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        setTimeout(() => setErrorMessage(''), 2600);
      }
    });
  }, []);

  const inviteUserToCurrentRoom = useCallback(() => {
    const activeRoomId = roomRef.current;
    const target = roomInviteTarget.trim();
    if (!target || !activeRoomId || activeRoomId.includes('_dm_')) return;
    socketRef.current?.emit('room_invite_user', {
      room: activeRoomId,
      actor: usernameRef.current,
      target
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        setTimeout(() => setErrorMessage(''), 2600);
        return;
      }
      setSuccessMessage(`Invited ${target}`);
      setRoomInviteTarget('');
      setTimeout(() => setSuccessMessage(''), 2200);
    });
  }, [roomInviteTarget]);

  const removeUserFromCurrentRoom = useCallback((targetUser) => {
    const activeRoomId = roomRef.current;
    if (!targetUser || !activeRoomId || activeRoomId.includes('_dm_')) return;
    socketRef.current?.emit('room_remove_user', {
      room: activeRoomId,
      actor: usernameRef.current,
      target: targetUser
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        setTimeout(() => setErrorMessage(''), 2600);
      }
    });
  }, []);

  const promoteModInCurrentRoom = useCallback((targetUser) => {
    const activeRoomId = roomRef.current;
    if (!targetUser || !activeRoomId || activeRoomId.includes('_dm_')) return;
    socketRef.current?.emit('room_grant_mod', {
      room: activeRoomId,
      actor: usernameRef.current,
      target: targetUser
    }, (ack) => {
      if (ack?.error) {
        setErrorMessage(ack.error);
        setTimeout(() => setErrorMessage(''), 2600);
        return;
      }
      setSuccessMessage(`${targetUser} is now a moderator`);
      setTimeout(() => setSuccessMessage(''), 2200);
    });
  }, []);

  const markCurrentRoomAsRead = useCallback(() => {
    const unreadIds = chat.filter((m) => m.sender !== usernameRef.current && !m.readBy?.includes(usernameRef.current)).map((m) => m._id);
    if (unreadIds.length > 0 && socketRef.current) {
      socketRef.current.emit('mark_read', { messageIds: unreadIds, username: usernameRef.current, room: roomRef.current });
    }
    setUnreadCount(0);
  }, [chat]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ App installed');
      setIsAppInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }, [deferredPrompt]);

  const performLogout = useCallback(() => {
    console.log('🚪 Logging out...');

    const activeStream = liveStreamInfoRef.current;
    if (socketRef.current && activeStream?.isHost) {
      socketRef.current.emit(LIVESTREAM_EVENTS.STOP, {
        sessionId: activeStream.sessionId,
        host: usernameRef.current
      });
    } else if (socketRef.current && activeStream && !activeStream.isHost) {
      socketRef.current.emit(LIVESTREAM_EVENTS.LEAVE, {
        sessionId: activeStream.sessionId,
        viewer: usernameRef.current
      });
    }

    livestreamHostPeersRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore close errors
      }
    });
    livestreamHostPeersRef.current.clear();

    if (livestreamViewerPeerRef.current) {
      try {
        livestreamViewerPeerRef.current.close();
      } catch {
        // ignore close errors
      }
      livestreamViewerPeerRef.current = null;
    }

    if (livestreamLocalStreamRef.current) {
      livestreamLocalStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore stop errors
        }
      });
      livestreamLocalStreamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('update_status', { username: usernameRef.current, status: 'offline' });
      socketRef.current.emit('user_logout', { username: usernameRef.current, room: roomRef.current });
      socketRef.current.emit('leave_room', { room: roomRef.current, username: usernameRef.current });
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
    setActiveRoomRegistry([]);
    setGlobalPresenceUsers([]);
    setNotificationItems([]);
    subscribedRoomsRef.current = new Set();
    setTypingUsers(new Set());
    setConnected(false);
    setLiveStreamInfo(null);
    setMessage('');
    setSearchQuery('');
    setShowMenuDropdown(false);
    setShowLogoutConfirm(false);
    console.log('✅ Logged out successfully');
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(true);
    setShowMenuDropdown(false);
  }, []);

  // ==========================
  // WebRTC Video/Voice Calling Functions
  // ==========================

  const runtimeConnectionInfo = useMemo(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    };
  }, []);

  // ICE servers configuration
  const iceServersConfig = useMemo(() => {
    const iceTransportPolicy = getAdaptiveIceTransportPolicy({
      userAgent: navigator.userAgent,
      connectionInfo: runtimeConnectionInfo
    });
    return {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      iceTransportPolicy
    };
  }, [runtimeConnectionInfo]);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const waitForIceGatheringComplete = useCallback((pc, timeoutMs = 3500) => {
    if (!pc || pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        clearTimeout(timer);
        resolve();
      };

      const onStateChange = () => {
        if (pc.iceGatheringState === 'complete') {
          finish();
        }
      };

      const timer = setTimeout(finish, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onStateChange);
    });
  }, []);

  const checkPermissions = useCallback(async (type) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }

      const constraints = type === 'video'
        ? { video: true, audio: true }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
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
      try {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      } catch {}
    }

    if (ringtoneAudioContextRef.current) {
      const context = ringtoneAudioContextRef.current;
      ringtoneAudioContextRef.current = null;
      context.close().catch(() => {});
    }
  }, []);

  const playRingtone = useCallback(() => {
    if (!soundEnabledRef.current || ringtoneStyle === 'off') return;

    stopRingtone();

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const context = new AudioCtx();
    ringtoneAudioContextRef.current = context;

    const normalizedVolume = Math.min(1, Math.max(0.05, ringtoneVolume));
    const profiles = {
      soft: {
        sequence: [523.25, 659.25],
        noteMs: 180,
        gapMs: 120,
        repeatMs: 1700,
        gain: 0.012
      },
      chime: {
        sequence: [392.0, 523.25, 659.25],
        noteMs: 160,
        gapMs: 100,
        repeatMs: 1800,
        gain: 0.015
      },
      pulse: {
        sequence: [440.0, 440.0],
        noteMs: 140,
        gapMs: 140,
        repeatMs: 1200,
        gain: 0.01
      }
    };

    const profile = profiles[ringtoneStyle] || profiles.soft;

    const playTone = (frequency, durationMs, startDelayMs, gainFactor) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + startDelayMs / 1000);

      const startAt = context.currentTime + startDelayMs / 1000;
      const endAt = startAt + durationMs / 1000;
      const peakGain = gainFactor * normalizedVolume;

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(peakGain, 0.0002), startAt + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    };

    const playSequence = () => {
      profile.sequence.forEach((frequency, index) => {
        const startDelayMs = index * (profile.noteMs + profile.gapMs);
        playTone(frequency, profile.noteMs, startDelayMs, profile.gain);
      });
    };

    playSequence();
    ringtoneIntervalRef.current = setInterval(playSequence, profile.repeatMs);
  }, [ringtoneStyle, ringtoneVolume, stopRingtone]);

  // Start call timer
  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  // Stop call timer
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  // Format call duration
  const formatCallDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize peer connection with premium features
  const createPeerConnection = useCallback((targetUsername, options = {}) => {
    debugLog('🔧 Creating PREMIUM peer connection for:', targetUsername);
    const callKind = options.callKind || 'video';
    inboundRemoteStreamRef.current = new MediaStream();
    remoteStreamRef.current = inboundRemoteStreamRef.current;
    setRemoteStream(inboundRemoteStreamRef.current);
    
    const pc = new RTCPeerConnection(iceServersConfig);
    
    // PREMIUM: Initialize call statistics
    const stats = new CallStatistics();
    callStatsRef.current = stats;

    // PREMIUM: Initialize adaptive quality controller
    const qualityController = new AdaptiveQualityController(pc);
    qualityControllerRef.current = qualityController;
    qualityController.start();

    // Track reconnection attempts
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY_SECONDS = 2;

    const clearReconnectTimers = () => {
      if (reconnectCountdownRef.current) {
        clearInterval(reconnectCountdownRef.current);
        reconnectCountdownRef.current = null;
      }
      if (reconnectRetryTimeoutRef.current) {
        clearTimeout(reconnectRetryTimeoutRef.current);
        reconnectRetryTimeoutRef.current = null;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && targetUsername) {
        debugLog('🧊 Sending ICE candidate to:', targetUsername);
        socketRef.current.emit(CALL_EVENTS.ICE_CANDIDATE, {
          to: targetUsername,
          candidate: event.candidate
        });
      } else if (event.candidate) {
        debugLog('⚠️ Can\'t send ICE candidate - no target or socket');
      }
    };

    // Handle remote stream with premium audio processing
    pc.ontrack = (event) => {
      console.log('🎥 ONTRACK fired:', event.track.kind, 'streams:', event.streams?.length || 0);
      debugLog('🎥 [ONTRACK] Remote track received!', {
        kind: event.track.kind,
        enabled: event.track.enabled,
        state: event.track.readyState,
        streamId: event.streams?.length > 0 ? event.streams[0].id : 'NO_STREAM'
      });

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

        if (event.track) {
          const exists = stream.getTracks().some((track) => track.id === event.track.id);
          if (!exists) {
            stream.addTrack(event.track);
          }

          event.track.onunmute = () => {
            debugLog(`🔊 [ONTRACK] Track unmuted: ${event.track.kind}`);
            attachRemoteStreamToElement();
          };

          event.track.onended = () => {
            debugLog(`🛑 [ONTRACK] Track ended: ${event.track.kind}`);
          };
        }

        if (event.streams?.length > 0) {
          event.streams[0].getTracks().forEach((track) => {
            const exists = stream.getTracks().some((existingTrack) => existingTrack.id === track.id);
            if (!exists) {
              stream.addTrack(track);
            }
          });
        }

        debugLog('📡 [ONTRACK] Aggregated remote stream tracks:', {
          audio: stream.getAudioTracks().length,
          video: stream.getVideoTracks().length
        });

        setRemoteStream(stream);
        remoteStreamRef.current = stream;
        attachRemoteStreamToElement();
      } catch (err) {
        console.error('❌ [ONTRACK] Error handling track:', err);
      }
    };

    // Handle connection state with error recovery and reconnection logic
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      debugLog('🔗 Connection state:', state);
      setPeerConnectionState(state || 'new');
      
      if (state === 'connected') {
        debugLog('✅ [CONNECTION] Connected - Starting quality monitoring');
        reconnectAttempts = 0; // Reset reconnect attempts on success
        clearReconnectTimers();
        setReconnectInfo(null);
        setCallError(null);
        
        // Start periodic stats updates
        if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
        statsUpdateIntervalRef.current = setInterval(async () => {
          if (callStatsRef.current && peerConnectionRef.current === pc) {
            await callStatsRef.current.updateStats(pc);
            const quality = callStatsRef.current.getQualityScore();
            setQualityIndicator(getQualityIndicator(callStatsRef.current));
            setConnectionQuality(callStatsRef.current.getQualityLabel());
          }
        }, 1000);
      } else if (state === 'failed' || state === 'disconnected') {
        debugLog(`❌ [CONNECTION] Connection ${state.toUpperCase()} - Attempting recovery`);
        if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);

        if (reconnectRetryTimeoutRef.current) {
          debugLog('⏳ [RECONNECT] Retry already scheduled, waiting...');
          return;
        }
        
        // Attempt reconnection with ICE restart
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          debugLog(`🔄 [RECONNECT] Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
          try {
            let secondsLeft = RECONNECT_DELAY_SECONDS;
            setReconnectInfo({
              attempt: reconnectAttempts,
              max: MAX_RECONNECT_ATTEMPTS,
              secondsLeft
            });
            setCallError(`Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

            reconnectCountdownRef.current = setInterval(() => {
              secondsLeft -= 1;
              setReconnectInfo(prev => prev ? {
                ...prev,
                secondsLeft: Math.max(secondsLeft, 0)
              } : prev);

              if (secondsLeft <= 0 && reconnectCountdownRef.current) {
                clearInterval(reconnectCountdownRef.current);
                reconnectCountdownRef.current = null;
              }
            }, 1000);

            reconnectRetryTimeoutRef.current = setTimeout(() => {
              try {
                if (!socketRef.current || !targetUsername || !pc) {
                  throw new Error('Missing socket, peer target, or peer connection');
                }

                debugLog('🔁 [RECONNECT] Creating ICE-restart offer');
                pc.createOffer({ iceRestart: true })
                  .then((restartOffer) => pc.setLocalDescription(restartOffer).then(() => restartOffer))
                  .then((restartOffer) => {
                    socketRef.current.emit(CALL_EVENTS.OFFER, {
                      to: targetUsername,
                      from: usernameRef.current,
                      callType: callKind,
                      offer: restartOffer,
                      renegotiate: true
                    });
                    debugLog('✅ [RECONNECT] ICE-restart offer sent');
                  })
                  .catch((restartErr) => {
                    console.error('❌ [RECONNECT] Failed ICE-restart offer:', restartErr);
                    setCallError('Connection failed. Unable to recover.');
                    endCall();
                  });
              } catch (err) {
                console.error('❌ [RECONNECT] Failed to restart ICE:', err);
                setCallError('Connection failed. Unable to recover.');
                endCall();
              } finally {
                reconnectRetryTimeoutRef.current = null;
              }
            }, RECONNECT_DELAY_SECONDS * 1000);
          } catch (err) {
            console.error('❌ [RECONNECT] Failed to restart ICE:', err);
            setCallError('Connection failed. Unable to recover.');
            endCall();
          }
        } else {
          debugLog('❌ [RECONNECT] Max reconnection attempts exceeded');
          clearReconnectTimers();
          setReconnectInfo(null);
          setCallError('Connection lost. Call ended.');
          endCall();
        }
      } else if (state === 'closed') {
        debugLog('🛑 [CONNECTION] Connection closed');
        if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
        clearReconnectTimers();
        setReconnectInfo(null);
        if (qualityController) qualityController.stop();
      }
    };

    // Monitor ICE connection state with detailed logging
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      debugLog('🧊 ICE state:', iceState);
      setIceConnectionState(iceState || 'new');
      
      if (iceState === 'failed') {
        console.error('❌ ICE failed – check STUN/TURN servers or firewall');
        setCallError('Network connection failed. Please check your firewall and try again.');
      }
    };

    pc.onsignalingstatechange = () => {
      debugLog('🚦 Signaling state:', pc.signalingState);
      setSignalingState(pc.signalingState || 'stable');
    };

    // Handle errors
    pc.onerror = (err) => {
      console.error('❌ [PEER_CONNECTION] Error:', err);
      setCallError(`Connection error: ${err.message || 'Unknown error'}`);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [iceServersConfig, attachRemoteStreamToElement]);

  const closeLivestreamHostPeer = useCallback((viewerUsername) => {
    if (!viewerUsername) return;
    const pc = livestreamHostPeersRef.current.get(viewerUsername);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore close errors
      }
      livestreamHostPeersRef.current.delete(viewerUsername);
    }
  }, []);

  const closeLivestreamViewerPeer = useCallback(() => {
    if (livestreamViewerPeerRef.current) {
      try {
        livestreamViewerPeerRef.current.ontrack = null;
        livestreamViewerPeerRef.current.onicecandidate = null;
        livestreamViewerPeerRef.current.close();
      } catch {
        // ignore close errors
      }
      livestreamViewerPeerRef.current = null;
    }

    if (inboundRemoteStreamRef.current) {
      inboundRemoteStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      });
    }

    inboundRemoteStreamRef.current = null;
    remoteStreamRef.current = null;
    setRemoteStream(null);
  }, []);

  const applyLivestreamIncomingTrack = useCallback((event) => {
    const incomingStream = event.streams?.[0];

    if (incomingStream) {
      const normalizedStream = new MediaStream();
      const firstVideoTrack = incomingStream.getVideoTracks()[0];
      const firstAudioTrack = incomingStream.getAudioTracks()[0];

      if (firstVideoTrack) normalizedStream.addTrack(firstVideoTrack);
      if (firstAudioTrack) normalizedStream.addTrack(firstAudioTrack);

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
    const existingTrack = event.track.kind === 'video'
      ? aggregatedStream.getVideoTracks()[0]
      : aggregatedStream.getAudioTracks()[0];

    if (existingTrack && existingTrack.id !== event.track.id) {
      aggregatedStream.removeTrack(existingTrack);
    }

    const alreadyPresent = aggregatedStream.getTracks().some((track) => track.id === event.track.id);
    if (!alreadyPresent) {
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
      if (!event.candidate || !socketRef.current) return;
      console.log('[LIVESTREAM VIEWER] Sending ICE candidate:', event.candidate);
      socketRef.current.emit(LIVESTREAM_EVENTS.ICE_CANDIDATE, {
        sessionId,
        to: host,
        from: usernameRef.current,
        candidate: event.candidate
      });
    };

    viewerPc.addTransceiver('video', { direction: 'recvonly' });
    viewerPc.addTransceiver('audio', { direction: 'recvonly' });

    await viewerPc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await viewerPc.createAnswer();
    await viewerPc.setLocalDescription(answer);

    // Wait for ICE gathering before sending answer
    await waitForIceGatheringComplete(viewerPc, 4000);

    socketRef.current.emit(LIVESTREAM_EVENTS.ANSWER, {
      sessionId,
      to: host,
      from: usernameRef.current,
      answer: viewerPc.localDescription || answer
    });

    // Add reconnection logic for viewer
    viewerPc.onconnectionstatechange = () => {
      console.log('[LIVESTREAM VIEWER] Connection state:', viewerPc.connectionState);
      if (viewerPc.connectionState === 'failed' || viewerPc.connectionState === 'disconnected') {
        // Attempt to rejoin
        if (socketRef.current) {
          console.log('[LIVESTREAM VIEWER] Connection failed/disconnected, attempting to rejoin...');
          socketRef.current.emit(LIVESTREAM_EVENTS.JOIN_REQUEST, { sessionId, from: usernameRef.current });
        }
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
    // Defensive: Remove old peer and tracks before adding new ones
    try {
      const oldPeer = livestreamHostPeersRef.current.get(viewerUsername);
      if (oldPeer) {
        if (typeof oldPeer.getSenders === 'function') {
          oldPeer.getSenders().forEach(sender => {
            try { oldPeer.removeTrack(sender); } catch {}
          });
        }
        try { oldPeer.close(); } catch {}
        livestreamHostPeersRef.current.delete(viewerUsername);
      }
    } catch {}

    if (!viewerUsername || !sessionId || !stream || !socketRef.current) return;

    // DO NOT stop or modify the host's stream/tracks here!
    const pc = new RTCPeerConnection(iceServersConfig);
    livestreamHostPeersRef.current.set(viewerUsername, pc);

    // Always add both audio and video tracks if available, and use replaceTrack if peer already has senders
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    // Add video track
    if (videoTracks.length > 0) {
      videoTracks.forEach((track) => {
        try {
          pc.addTrack(track, stream);
        } catch (err) {
          // Defensive: fallback to replaceTrack if addTrack fails
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) try { sender.replaceTrack(track); } catch {}
        }
      });
    }
    // Add audio track
    if (audioTracks.length > 0) {
      audioTracks.forEach((track) => {
        try {
          pc.addTrack(track, stream);
        } catch (err) {
          // Defensive: fallback to replaceTrack if addTrack fails
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
          if (sender) try { sender.replaceTrack(track); } catch {}
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) return;
      console.log('[LIVESTREAM HOST] Sending ICE candidate:', event.candidate);
      socketRef.current.emit(LIVESTREAM_EVENTS.ICE_CANDIDATE, {
        sessionId,
        to: viewerUsername,
        from: usernameRef.current,
        candidate: event.candidate
      });
    };

    // Add ICE restart and reconnection logic for host peer
    pc.onconnectionstatechange = () => {
      console.log('[LIVESTREAM HOST] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        // Attempt ICE restart
        if (typeof pc.restartIce === 'function') {
          console.log('[LIVESTREAM HOST] ICE failed, attempting restart...');
          pc.restartIce();
        }
      }
      if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        closeLivestreamHostPeer(viewerUsername);
      }
    };

    // Wait for ICE gathering before sending offer
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

    livestreamHostPeersRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore close errors
      }
    });
    livestreamHostPeersRef.current.clear();

    if (livestreamLocalStreamRef.current) {
      livestreamLocalStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore stop errors
        }
      });
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
    setTimeout(() => setSuccessMessage(''), 2500);
  }, [stopCallTimer]);

  const buildLivestreamSourceStream = useCallback(async (sourceMode) => {

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    let source = sourceMode === 'screen' ? 'screen' : (sourceMode === 'both' ? 'both' : 'camera');

    // Defensive: Always check for mediaDevices
    if (!navigator.mediaDevices) {
      alert('Your browser does not support media devices.');
      throw new Error('Media devices not supported');
    }

    // 'Both' streaming: Windows only, combine camera and screen tracks
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
        // Add camera tracks
        cameraStream.getVideoTracks().forEach(track => composedStream.addTrack(track));
        cameraStream.getAudioTracks().forEach(track => composedStream.addTrack(track));
        // Add screen tracks
        displayStream.getVideoTracks().forEach(track => composedStream.addTrack(track));
        displayStream.getAudioTracks().forEach(track => composedStream.addTrack(track));
        refreshVideoInputs();
        return { stream: composedStream, source: 'both' };
      } catch (err) {
        alert('Both streaming failed. Falling back to camera.');
        source = 'camera';
      }
    }

    if (source === 'screen') {
      // On mobile, getDisplayMedia is not supported
      if (isMobile || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        alert('Screen sharing is not supported on your device. Falling back to camera.');
        source = 'camera';
      } else {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });

          // Defensive: Ensure at least one video track
          if (!displayStream.getVideoTracks().length) {
            alert('No video track found in screen share.');
            throw new Error('No video track in screen share');
          }

          const composedStream = new MediaStream();
          displayStream.getVideoTracks().forEach((track) => composedStream.addTrack(track));

          const displayAudioTracks = displayStream.getAudioTracks();
          if (displayAudioTracks.length > 0) {
            displayAudioTracks.forEach((track) => composedStream.addTrack(track));
          } else {
            try {
              const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              micStream.getAudioTracks().forEach((track) => composedStream.addTrack(track));
            } catch {
              // If microphone is denied, continue with video-only screen stream.
            }
          }

          refreshVideoInputs();
          return { stream: composedStream, source };
        } catch (err) {
          alert('Screen sharing failed. Falling back to camera.');
          source = 'camera';
        }
      }
    }

    // Always fallback to camera if screen/both is not possible
    const constraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
      callType: 'video',
      userAgent: navigator.userAgent,
      connectionInfo: runtimeConnectionInfo
    }));

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      // Defensive: Ensure at least one video track
      if (!cameraStream.getVideoTracks().length) {
        alert('No camera video track found. Please check your camera.');
        throw new Error('No camera video track');
      }
      refreshVideoInputs();
      return { stream: cameraStream, source: 'camera' };
    } catch {
      const fallbackConstraints = withPreferredVideoDevice(getFallbackMediaConstraints('video'));
      let fallbackStream;
      try {
        fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      } catch {
        fallbackStream = await navigator.mediaDevices.getUserMedia(getFallbackMediaConstraints('video'));
      }
      if (!fallbackStream.getVideoTracks().length) {
        alert('No camera video track found in fallback.');
        throw new Error('No camera video track in fallback');
      }
      refreshVideoInputs();
      return { stream: fallbackStream, source: 'camera' };
    }
  }, [runtimeConnectionInfo, withPreferredVideoDevice, refreshVideoInputs]);

  const startLivestream = useCallback(async (visibilityMode, sourceMode = 'camera') => {
    // Defensive: Prevent duplicate or stale streams
    if (livestreamLocalStreamRef.current) {
      livestreamLocalStreamRef.current.getTracks().forEach(track => { try { track.stop(); } catch {} });
      livestreamLocalStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => { try { track.stop(); } catch {} });
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }
    const visibility = visibilityMode === 'public' ? 'public' : 'room';
    const source = sourceMode === 'screen' ? 'screen' : 'camera';
    let activeRoomId = roomRef.current || room;

    // Auto-join room if not connected or not in a valid group room
    if (!socketRef.current || !connected) {
      setCallError('Connecting to chat...');
      // Attempt to connect
      if (socketRef.current) {
        socketRef.current.connect();
      }
      return;
    }

    if (!activeRoomId || activeRoomId.includes('_dm_')) {
      setCallError('Livestream is available only in group rooms');
      return;
    }

    // Auto-join room if not already joined
    if (socketRef.current && activeRoomId && !rooms.includes(activeRoomId)) {
      socketRef.current.emit('join_room', { room: activeRoomId, username: usernameRef.current, active: true, fetchHistory: true }, () => {
        // After join completes, retry streaming
        setTimeout(() => {
          startLivestream(visibilityMode, sourceMode);
        }, 300);
      });
      setCallError('Joining room... Please wait...');
      return;
    }

    if (callStateRef.current === 'active' || callStateRef.current === 'calling' || callStateRef.current === 'ringing') {
      setCallError('End the current call before starting a livestream');
      return;
    }

    if (liveStreamInfoRef.current?.isHost) {
      setCallError('You already have an active livestream');
      return;
    }

    try {
      const { stream } = await buildLivestreamSourceStream(source);

      // Attach onended handler for screen sharing
      if (source === 'screen') {
        const displayTrack = stream.getVideoTracks()[0];
        if (displayTrack) {
          displayTrack.onended = () => {
            if (liveStreamInfoRef.current?.isHost) {
              stopHostedLivestream(true);
            }
          };
        }
      }

      livestreamLocalStreamRef.current = stream;
      setLocalStream(stream);
      setRemoteStream(stream);
      inboundRemoteStreamRef.current = stream;

      // If already hosting, update all peer connections with new tracks using replaceTrack for seamless switching
      if (liveStreamInfoRef.current?.isHost) {
        livestreamHostPeersRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          // Replace tracks instead of removing/adding for smoother transitions
          senders.forEach(sender => {
            if (sender.track && sender.track.kind === 'video' && videoTrack) {
              try { sender.replaceTrack(videoTrack); } catch {}
            }
            if (sender.track && sender.track.kind === 'audio' && audioTrack) {
              try { sender.replaceTrack(audioTrack); } catch {}
            }
          });
        });
      }

      // Reconnection logic for unstable networks (mobile)
      window.addEventListener('offline', () => {
        setCallError('Network connection lost. Trying to reconnect...');
      });
      window.addEventListener('online', () => {
        setCallError(null);
        // Optionally, trigger a reconnection or refresh
      });

      // User feedback for room/public
      if (visibility === 'public') {
        setSuccessMessage('You are joining a public livestream.');
      } else {
        setSuccessMessage('You are joining a room-only livestream.');
      }
      setTimeout(() => setSuccessMessage(''), 2000);

      socketRef.current.emit(LIVESTREAM_EVENTS.START, {
        host: usernameRef.current,
        room: activeRoomId,
        visibility,
        source
      }, async (ack) => {
        if (!ack?.success || !ack.sessionId) {
          stream.getTracks().forEach((track) => track.stop());
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
        setLocalStream(stream);
        setRemoteStream(stream);
        inboundRemoteStreamRef.current = stream;
        setCallType('video');
        setCallPeer({ username: `${usernameRef.current} • LIVE`, userId: usernameRef.current });
        setCallState('active');
        startCallTimer();
        setLivestreamComments([]);
        setLivestreamCommentInput('');

        const targets = Array.isArray(ack.targets) ? ack.targets : [];
        await Promise.allSettled(targets.map((viewerUsername) => createLivestreamHostPeer(viewerUsername, ack.sessionId, stream)));

        const sourceLabel = source === 'screen' ? 'screen' : 'camera';
        setSuccessMessage(`🔴 ${sourceLabel} livestream started (${visibility === 'public' ? 'public' : 'room-only'})`);
        setTimeout(() => setSuccessMessage(''), 3000);
      });
    } catch (err) {
      setCallError(err?.message || 'Unable to access camera/microphone for livestream');
    }
  }, [room, connected, createLivestreamHostPeer, buildLivestreamSourceStream, stopHostedLivestream, startCallTimer]);

  const sendLivestreamComment = useCallback(() => {
    const activeSession = liveStreamInfoRef.current;
    const socket = socketRef.current;
    const text = livestreamCommentInput.trim();

    if (!activeSession?.sessionId || !socket || !text) return;

    socket.emit(LIVESTREAM_EVENTS.COMMENT, {
      sessionId: activeSession.sessionId,
      from: usernameRef.current,
      text
    });
    setLivestreamCommentInput('');
  }, [livestreamCommentInput]);

  const sendLivestreamReaction = useCallback((emoji) => {
    const activeSession = liveStreamInfoRef.current;
    const socket = socketRef.current;

    if (!activeSession?.sessionId || !socket || !emoji) return;

    socket.emit(LIVESTREAM_EVENTS.REACTION, {
      sessionId: activeSession.sessionId,
      from: usernameRef.current,
      emoji
    });
  }, []);

  const requestJoinLivestreamFromNotification = useCallback((notification) => {
    if (!notification?.sessionId || !socketRef.current) return;

    const activeSession = liveStreamInfoRef.current;
    if (activeSession?.sessionId === notification.sessionId) {
      setSuccessMessage(`✅ Already in ${notification.sender}'s livestream`);
      setTimeout(() => setSuccessMessage(''), 1800);
      return;
    }

    socketRef.current.emit(LIVESTREAM_EVENTS.JOIN_REQUEST, {
      sessionId: notification.sessionId,
      from: usernameRef.current
    });

    setSuccessMessage(`🔄 Joining ${notification.sender}'s livestream...`);
    setTimeout(() => setSuccessMessage(''), 2200);
  }, []);

  // Start a call (voice or video) with PREMIUM features
  const startCall = useCallback(async (type, targetUser) => {
    if (!targetUser || !socketRef.current) {
      setCallError('Unable to initiate call - missing user or connection');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCallError('Your browser does not support audio/video calls');
      return;
    }

    try {
      debugLog('📞 [CALLER] Starting PREMIUM', type, 'call to:', targetUser);
      pendingIceCandidatesRef.current = [];
      seenIceCandidateKeysRef.current.clear();
      setCallType(type);
      setCallPeer({ username: targetUser, userId: targetUser });
      setCallState('calling');
      setCallError(null);

      const hasPermission = await checkPermissions(type);
      if (!hasPermission) {
        setCallError(`Please grant ${type} call permissions in your browser settings`);
        setCallState('idle');
        return;
      }

      const constraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      }));

      debugLog('🎙️ [CALLER] Requesting media with optimal constraints');
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaErr) {
        // Fallback to lower quality if optimal fails
        console.warn('⚠️ [CALLER] Optimal constraints failed, trying fallback...');
        const fallbackConstraints = withPreferredVideoDevice(getFallbackMediaConstraints(type));
        try {
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia(getFallbackMediaConstraints(type));
        }
      }
      refreshVideoInputs();

      debugLog('📹 [CALLER] Got media stream:', {
        audio: stream.getAudioTracks().length,
        video: stream.getVideoTracks().length
      });
      // Ensure all tracks are enabled
      stream.getTracks().forEach((track) => {
        track.enabled = true;
      });
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection with premium features
      const pc = createPeerConnection(targetUser, { callKind: type });

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        debugLog('🎚️ [CALLER] Adding track:', track.kind);
        pc.addTrack(track, stream);
      });

      await optimizeRtpSenders(pc, {
        callType: type,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      // PREMIUM: Start recording if enabled
      const shouldRecord = localStorage.getItem('autoRecordCalls') === 'true';
      if (shouldRecord && type === 'voice') {
        try {
          callRecorderRef.current = new CallRecorder();
          callRecorderRef.current.start(stream);
          setIsCallRecording(true);
        } catch (recErr) {
          console.warn('⚠️ Recording initialization failed:', recErr);
        }
      }

      // Create offer with error handling
      let offer;
      try {
        offer = await pc.createOffer();
        debugLog('🎤 [CALLER] Created offer');
        await pc.setLocalDescription(offer);
        debugLog('🎤 [CALLER] Set local description');

        const isMobileCaller = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (isMobileCaller) {
          debugLog('⏳ [CALLER] Mobile detected, waiting for ICE gathering completion before sending offer');
          await waitForIceGatheringComplete(pc, 4000);
          offer = pc.localDescription || offer;
        }
      } catch (offerErr) {
        throw new Error(`Failed to create call offer: ${offerErr.message}`);
      }

      // Send call offer via socket
      debugLog('📤 [CALLER] Sending call:offer to:', targetUser);
      socketRef.current.emit(CALL_EVENTS.OFFER, {
        to: targetUser,
        from: username,
        callType: type,
        offer: offer
      });

      clearCallTimeout();
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          debugLog('⏰ Call connection timeout');
          setCallError('No answer from this user. They may be offline or busy.');
          endCallRef.current(true);
        }
      }, 30000);

      setTimeout(() => {
        if (callStateRef.current === 'calling') {
          debugLog('🔔 [CALLER] Playing ringtone');
          playRingtone();
        }
      }, 200);

    } catch (err) {
      console.error('❌ Error starting call:', err);
      let errorMsg = `Failed to start ${type} call`;
      
      if (err.name === 'NotAllowedError') {
        errorMsg = `Please allow ${type} access in browser settings`;
      } else if (err.name === 'NotFoundError') {
        errorMsg = `No ${type === 'video' ? 'camera' : 'microphone'} found on this device`;
      } else if (err.name === 'NotReadableError') {
        errorMsg = `${type === 'video' ? 'Camera' : 'Microphone'} is already in use by another app`;
      } else if (err.name === 'SecurityError') {
        errorMsg = 'Call is not allowed in insecure context (HTTPS required)';
      } else {
        errorMsg = err.message || errorMsg;
      }
      
      setCallError(errorMsg);
      setCallState('idle');
      stopRingtone();
      clearCallTimeout();
    }
  }, [username, createPeerConnection, playRingtone, stopRingtone, checkPermissions, clearCallTimeout, waitForIceGatheringComplete, withPreferredVideoDevice, refreshVideoInputs]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) return;

    if (incomingCall.isLivestream) {
      socketRef.current.emit(LIVESTREAM_EVENTS.DECLINE, {
        sessionId: incomingCall.sessionId,
        to: incomingCall.from,
        from: username
      });
      stopRingtone();
      clearCallTimeout();
      setIncomingCall(null);
      return;
    }

    console.log('❌ Rejecting call from:', incomingCall.from);
    socketRef.current.emit(CALL_EVENTS.REJECT, {
      to: incomingCall.from,
      from: username
    });

    stopRingtone();
    clearCallTimeout();
    setIncomingCall(null);
  }, [incomingCall, username, stopRingtone, clearCallTimeout]);

  // Answer incoming call with premium features and robust error handling
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
        console.error('❌ Failed to join livestream:', err);
        setCallError('Failed to join livestream');
        setIncomingCall(null);
      }
      return;
    }

    stopRingtone();

    try {
      const callerUsername = incomingCall.from;
      console.log('📞 [RECEIVER] Answering', incomingCall.callType, 'call from:', callerUsername);
      pendingIceCandidatesRef.current = [];
      seenIceCandidateKeysRef.current.clear();
      clearCallTimeout();
      
      setCallType(incomingCall.callType);
      setCallPeer({ username: callerUsername, userId: callerUsername });
      
      // FORCE STOP RINGTONE
      console.log('🛑 [RECEIVER] Force-stopping ringtone');
      stopRingtone();
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }

      const constraints = withPreferredVideoDevice(getAdaptiveMediaConstraints({
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      }));

      console.log('📹 [RECEIVER] Requesting media with adaptive constraints');
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaErr) {
        // Fallback to lower quality if optimal fails
        console.warn('⚠️ [RECEIVER] Optimal constraints failed, trying fallback...');
        const fallbackConstraints = withPreferredVideoDevice(getFallbackMediaConstraints(incomingCall.callType));
        try {
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia(getFallbackMediaConstraints(incomingCall.callType));
        }
      }
      refreshVideoInputs();

      console.log('📹 [RECEIVER] Got media stream:', { audio: !!stream.getAudioTracks().length, video: !!stream.getVideoTracks().length });
      // Ensure all tracks are enabled
      stream.getTracks().forEach((track) => {
        track.enabled = true;
      });
      setLocalStream(stream);

      if (localVideoRef.current && incomingCall.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize call statistics
      console.log('📊 [RECEIVER] Initializing call statistics');
      const stats = new CallStatistics();
      callStatsRef.current = stats;
      setCallStats(stats.getStats());

      // Create peer connection with quality control
      console.log('🔧 [RECEIVER] Creating peer connection for caller:', callerUsername);
      const pc = createPeerConnection(callerUsername, { callKind: incomingCall.callType });
      peerConnectionRef.current = pc;

      // Initialize adaptive quality controller
      console.log('⚙️ [RECEIVER] Initializing adaptive quality controller');
      const qualityController = new AdaptiveQualityController(pc);
      qualityControllerRef.current = qualityController;
      qualityController.start();

      // CRITICAL: Set remote description FIRST (before adding local tracks)
      console.log('🎧 [RECEIVER] Setting remote description from offer');
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        console.log('✅ [RECEIVER] Remote description set');
      } catch (descErr) {
        throw new Error(`Failed to set remote description: ${descErr.message}`);
      }

      // THEN add local stream tracks (after remote description is set)
      console.log('➕ [RECEIVER] Adding local tracks to peer connection');
      stream.getTracks().forEach(track => {
        console.log('📌 [RECEIVER] Adding track:', track.kind, track.id);
        pc.addTrack(track, stream);
      });

      if (stream.getTracks().length === 0) {
        throw new Error('No media tracks available');
      }

      await optimizeRtpSenders(pc, {
        callType: incomingCall.callType,
        userAgent: navigator.userAgent,
        connectionInfo: runtimeConnectionInfo
      });

      // Handle pending ICE candidates
      if (pendingIceCandidatesRef.current.length > 0) {
        console.log(`🧊 [RECEIVER] Flushing ${pendingIceCandidatesRef.current.length} queued ICE candidate(s)`);
        const failedCandidates = [];
        for (const candidate of pendingIceCandidatesRef.current) {
          if (!candidate || !candidate.candidate) {
            console.warn('⚠️ [RECEIVER] Skipping invalid ICE candidate payload');
            continue;
          }
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (iceError) {
            console.warn('⚠️ [RECEIVER] Failed to apply queued ICE candidate:', iceError?.message || iceError);
            failedCandidates.push(candidate);
          }
        }
        // Keep failed candidates for retry
        pendingIceCandidatesRef.current = failedCandidates;
      }

      // Create answer with error handling
      console.log('🎤 [RECEIVER] Creating answer');
      let answer;
      try {
        answer = await pc.createAnswer();
        console.log('🎤 [RECEIVER] Setting local description with answer');
        await pc.setLocalDescription(answer);
        console.log('✅ [RECEIVER] Local description set');
      } catch (answerErr) {
        throw new Error(`Failed to create answer: ${answerErr.message}`);
      }

      // Initialize call recorder if auto-record is enabled
      const shouldRecord = localStorage.getItem('autoRecordCalls') === 'true';
      if (shouldRecord && incomingCall.callType === 'video') {
        try {
          console.log('🎙️ [RECEIVER] Auto-record enabled, initializing recorder');
          callRecorderRef.current = new CallRecorder();
          callRecorderRef.current.start(stream);
          setIsCallRecording(true);
        } catch (recErr) {
          console.warn('⚠️ [RECEIVER] Recording initialization failed:', recErr);
        }
      }

      // Send answer back to caller
      console.log('📤 [RECEIVER] Sending call:answer to:', callerUsername);
      try {
        socketRef.current.emit(CALL_EVENTS.ANSWER, {
          to: callerUsername,
          from: username,
          answer: answer
        });
        console.log('✅ [RECEIVER] Call:answer sent');
      } catch (sendErr) {
        console.error('❌ [RECEIVER] Failed to send answer:', sendErr);
        throw new Error('Failed to send call answer');
      }

      if (remoteTrackTimeoutRef.current) {
        clearTimeout(remoteTrackTimeoutRef.current);
      }
      remoteTrackTimeoutRef.current = setTimeout(() => {
        const remoteTrackCount = remoteStreamRef.current?.getTracks?.().length || 0;
        if (remoteTrackCount === 0 && peerConnectionRef.current) {
          console.warn('⚠️ No remote tracks after 10s, restarting ICE');
          try {
            peerConnectionRef.current.restartIce();
          } catch (restartErr) {
            console.warn('⚠️ restartIce failed after remote track timeout:', restartErr);
          }
        }
      }, 10000);

      // Start periodic stats update
      if (statsUpdateIntervalRef.current) clearInterval(statsUpdateIntervalRef.current);
      const intervalId = setInterval(async () => {
        if (stats && typeof stats.updateStats === 'function' && pc && pc.connectionState === 'connected') {
          try {
            await stats.updateStats(pc);
            const latestStats = stats.getStats();
            setCallStats(latestStats);
            setQualityIndicator(getQualityIndicator(stats));
            setConnectionQuality(latestStats.qualityLabel);
          } catch (statsErr) {
            console.warn('⚠️ [RECEIVER] Stats update failed:', statsErr);
          }
        }
      }, 1000);
      statsUpdateIntervalRef.current = intervalId;

      setIncomingCall(null);
      setCallState('active');
      console.log('⏱️ [RECEIVER] Starting call timer');
      startCallTimer();

    } catch (err) {
      console.error('❌ Error answering call:', err);
      let errorMsg = 'Failed to answer call';
      
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Please allow camera/microphone access in browser settings';
      } else if (err.name === 'NotFoundError') {
        errorMsg = `No ${incomingCall?.callType === 'video' ? 'camera' : 'microphone'} found on this device`;
      } else if (err.name === 'NotReadableError') {
        errorMsg = `${incomingCall?.callType === 'video' ? 'Camera' : 'Microphone'} is already in use by another app`;
      } else if (err.name === 'SecurityError') {
        errorMsg = 'Call is not allowed in insecure context (HTTPS required)';
      } else {
        errorMsg = err.message || errorMsg;
      }
      
      setCallError(errorMsg);
      rejectCall();
    }
  }, [incomingCall, username, createPeerConnection, startCallTimer, stopRingtone, rejectCall, clearCallTimeout, runtimeConnectionInfo, withPreferredVideoDevice, refreshVideoInputs, joinLivestreamAsViewer]);

  // End call with premium cleanup
  const endCall = useCallback((notifyPeer = true) => {
    console.log('📴 Ending call');
    clearCallTimeout();

    const activeStream = liveStreamInfoRef.current;

    if (activeStream?.isHost) {
      stopHostedLivestream(notifyPeer);
    }

    if (activeStream && !activeStream.isHost && notifyPeer && socketRef.current) {
      socketRef.current.emit(LIVESTREAM_EVENTS.LEAVE, {
        sessionId: activeStream.sessionId,
        viewer: usernameRef.current
      });
    }

    // Notify peer
    if (!activeStream && notifyPeer && socketRef.current && callPeer) {
      socketRef.current.emit(CALL_EVENTS.END, {
        to: callPeer.username,
        from: username
      });
    }

    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (livestreamViewerPeerRef.current) {
      try {
        livestreamViewerPeerRef.current.close();
      } catch {
        // ignore close errors
      }
      livestreamViewerPeerRef.current = null;
    }

    // Stop and save call recording
    if (callRecorderRef.current) {
      console.log('💾 Saving recording');
      callRecorderRef.current.stop();
      callRecorderRef.current = null;
      setIsCallRecording(false);
    }

    // Stop quality monitoring
    if (statsUpdateIntervalRef.current) {
      console.log('⏸️ Stopping stats monitoring');
      clearInterval(statsUpdateIntervalRef.current);
      statsUpdateIntervalRef.current = null;
    }

    // Stop quality controller
    if (qualityControllerRef.current) {
      console.log('⏸️ Stopping quality controller');
      qualityControllerRef.current.stop?.();
      qualityControllerRef.current = null;
    }

    // Log call to history
    if (callStatsRef.current && callHistoryRef.current) {
      try {
        const finalStats = callStatsRef.current.getStats();
        console.log('📝 Logging call to history:', { duration: callDuration, quality: finalStats.qualityScore });
        callHistoryRef.current.addCall({
          peer: callPeer?.username || 'Unknown',
          type: callType || 'unknown',
          duration: callDuration,
          timestamp: new Date(),
          stats: finalStats
        });
        const history = callHistoryRef.current.getCallHistory();
        setCallHistory(history);
      } catch (err) {
        console.warn('⚠️ Failed to log call to history:', err);
      }
      callStatsRef.current = null;
    }

    // Stop screen stream if active
    if (screenStreamRef.current) {
      console.log('🛑 Stopping screen stream');
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    seenIceCandidateKeysRef.current.clear();
    if (reconnectCountdownRef.current) {
      clearInterval(reconnectCountdownRef.current);
      reconnectCountdownRef.current = null;
    }
    if (reconnectRetryTimeoutRef.current) {
      clearTimeout(reconnectRetryTimeoutRef.current);
      reconnectRetryTimeoutRef.current = null;
    }
    if (remoteTrackTimeoutRef.current) {
      clearTimeout(remoteTrackTimeoutRef.current);
      remoteTrackTimeoutRef.current = null;
    }
    setReconnectInfo(null);
    setPeerConnectionState('new');
    setIceConnectionState('new');
    setSignalingState('stable');

    // Reset state
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
  }, [localStream, remoteStream, callPeer, username, callType, callDuration, isCallRecording, stopCallTimer, stopRingtone, clearCallTimeout, stopHostedLivestream]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream, callType]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current || callType !== 'video' || !callPeer) return;

    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        await switchBackToCamera(peerConnectionRef.current, localStream);

        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }

        setIsScreenSharing(false);
        
        // Notify peer that screen sharing stopped
        if (socketRef.current) {
          console.log('📤 [SCREEN_SHARE] Notifying peer - screen share STOPPED');
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

        // Notify peer that screen sharing started
        if (socketRef.current) {
          console.log('📤 [SCREEN_SHARE] Notifying peer - screen share STARTED');
          socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_START, {
            to: callPeer.username,
            from: username
          });
        }

        // Stop screen share when user stops it from browser
        if (screenTrack) {
          screenTrack.onended = async () => {
            try {
              if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
              }
              await switchBackToCamera(peerConnectionRef.current, localStream);
              if (localVideoRef.current && localStream) {
                localVideoRef.current.srcObject = localStream;
              }
              setIsScreenSharing(false);
              
              // Notify peer that screen sharing stopped (via browser stop button)
              if (socketRef.current) {
                console.log('📤 [SCREEN_SHARE] Browser stopped screen share, notifying peer');
                socketRef.current.emit(CALL_EVENTS.SCREEN_SHARE_END, {
                  to: callPeer.username,
                  from: username
                });
              }
            } catch (error) {
              console.warn('⚠️ Failed to restore camera after screen-share end:', error);
            }
          };
        }
      }
    } catch (err) {
      console.error('Screen share error:', err);
      if (err?.name === 'NotSupportedError') {
        setCallError('Screen sharing is not supported on this mobile browser. Try latest Chrome on Android or desktop.');
      } else if (err?.name === 'NotAllowedError') {
        setCallError('Screen share permission denied. Please allow screen sharing and try again.');
      } else {
        setCallError('Screen sharing failed');
      }
    }
  }, [isScreenSharing, localStream, callType, callPeer, username]);

  // Toggle call minimize
  const toggleCallMinimize = useCallback(() => {
    setIsCallMinimized(prev => !prev);
  }, []);

  const startLocalPreviewDrag = useCallback((event) => {
    if (callType !== 'video') return;
    if (event.button != null && event.button !== 0) return;
    if (event.target && typeof event.target.closest === 'function' && event.target.closest('.local-video-size-btn')) return;
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
  }, [callType, localPreviewPosition.x, localPreviewPosition.y]);

  const resizeLocalPreview = useCallback((direction) => {
    setLocalPreviewSizeIndex((prev) => {
      const next = direction === 'up'
        ? Math.min(prev + 1, LOCAL_PREVIEW_SIZES.length - 1)
        : Math.max(prev - 1, 0);

      const nextSize = getLocalPreviewSize(next);

      setLocalPreviewPosition((position) => ({
        ...clampLocalPreviewPosition(position.x, position.y, nextSize)
      }));

      return next;
    });
  }, [getLocalPreviewSize, clampLocalPreviewPosition]);

  const localPreviewSize = getLocalPreviewSize(localPreviewSizeIndex);

  // Toggle call recording
  const toggleRecording = useCallback(async () => {
    try {
      if (isCallRecording && callRecorderRef.current) {
        console.log('🛑 Stopping call recording');
        callRecorderRef.current.stop();
        setIsCallRecording(false);
        setCallError(null);
      } else if (localStream) {
        console.log('🎙️ Starting call recording');
        callRecorderRef.current = new CallRecorder();
        callRecorderRef.current.start(localStream);
        setIsCallRecording(true);
      }
    } catch (err) {
      console.error('❌ Recording error:', err);
      setCallError('Failed to toggle recording');
    }
  }, [isCallRecording, localStream]);

  // Apply video effect
  const applyVideoEffect = useCallback((effect, value) => {
    try {
      console.log('🎨 Applying video effect:', effect, '=', value);
      setVideoEffectSettings(prev => ({
        ...prev,
        [effect]: value
      }));
    } catch (err) {
      console.error('❌ Effect error:', err);
      setCallError('Failed to apply effect');
    }
  }, []);

  // Get call history
  const getCallHistoryData = useCallback(() => {
    if (!callHistoryRef.current) {
      callHistoryRef.current = new CallHistory();
    }
    const history = callHistoryRef.current.getCallHistory();
    return history;
  }, []);

  // Format call duration
  const formatDuration = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, []);

  // Get quality label style
  const getQualityLabelStyle = useCallback((qualityScore) => {
    if (qualityScore >= 80) return { color: '#4CAF50', label: 'Excellent' };
    if (qualityScore >= 60) return { color: '#8BC34A', label: 'Good' };
    if (qualityScore >= 40) return { color: '#FFC107', label: 'Fair' };
    if (qualityScore >= 20) return { color: '#FF9800', label: 'Poor' };
    return { color: '#F44336', label: 'Very Poor' };
  }, []);

  const selectedUser = useMemo(() => {
    const currentRoomId = activeRoom || room;
    if (!currentRoomId) return null;

    const currentRoom = rooms.find(r => r.id === currentRoomId);
    if (currentRoom?.type === 'dm') {
      return currentRoom.with || currentRoom.name || null;
    }

    if (currentRoomId.includes('_dm_')) {
      const participants = currentRoomId.split('_dm_');
      return participants.find(participant => participant && participant !== username) || null;
    }

    return null;
  }, [activeRoom, room, rooms, username]);

  const currentRoomId = activeRoom || room;
  const currentRoomInfo = useMemo(() => {
    return rooms.find(r => r.id === currentRoomId) || null;
  }, [rooms, currentRoomId]);

  const isGroupRoomActive = useMemo(() => {
    return !!currentRoomId && !currentRoomId.includes('_dm_');
  }, [currentRoomId]);

  const livestreamControlsDisabled = !isGroupRoomActive || callState === 'active' || callState === 'calling' || callState === 'ringing';
  const livestreamSourceLabel = liveStreamInfo?.source === 'screen' ? 'SCREEN' : (liveStreamInfo?.source ? 'CAMERA' : null);
  const livestreamAudioEnabled = !!(liveStreamInfo && (
    liveStreamInfo.isHost
      ? liveStreamInfo.hasAudio
      : (remoteStream && remoteStream.getAudioTracks && remoteStream.getAudioTracks().length > 0)
  ));
  const isLivestreamViewer = !!(liveStreamInfo && !liveStreamInfo.isHost);
  const remoteVideoFitMode = isLivestreamViewer ? (livestreamViewerExpanded ? 'cover' : 'contain') : 'cover';

  useEffect(() => {
    if (!showChat || !connected || !socketRef.current || !usernameRef.current) return;

    const roomIds = roomsRef.current.map((entry) => entry.id).filter(Boolean);
    roomIds.forEach((roomId) => {
      if (subscribedRoomsRef.current.has(roomId)) return;
      socketRef.current.emit('join_room', {
        room: roomId,
        username: usernameRef.current,
        active: roomId === roomRef.current,
        fetchHistory: false
      });
      subscribedRoomsRef.current.add(roomId);
    });
  }, [showChat, connected, rooms, currentRoomId]);

  useEffect(() => {
    if (!connected || !socketRef.current || !currentRoomId || currentRoomId.includes('_dm_')) return;
    socketRef.current.emit('room_policy_request', { room: currentRoomId, actor: usernameRef.current });
  }, [connected, currentRoomId]);

  const mediaMessages = useMemo(() => {
    return [...chat]
      .filter(m => ['image', 'voice', 'file'].includes(m.type) && (m.fileUrl || m.text))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [chat]);

  const dmMediaMessages = useMemo(() => {
    const roomId = activeRoom || room;
    if (!roomId || !roomId.includes('_dm_')) return [];
    return mediaMessages;
  }, [mediaMessages, activeRoom, room]);

  const threadMessages = useMemo(() => {
    if (!threadRootId) return [];
    return chat.filter((msg) => msg._id === threadRootId || msg.replyTo === threadRootId);
  }, [chat, threadRootId]);

  const threadRootCount = useMemo(() => {
    const repliedMessageIds = new Set(chat.map((msg) => msg.replyTo).filter(Boolean));
    return chat.filter((msg) => repliedMessageIds.has(msg._id)).length;
  }, [chat]);

  const currentRoomPolicy = roomPolicies[currentRoomId] || null;
  const canManageCurrentRoom = useMemo(() => {
    if (!currentRoomPolicy) return false;
    return currentRoomPolicy.owner === username || (currentRoomPolicy.mods || []).includes(username);
  }, [currentRoomPolicy, username]);

  const globalOnlineUsers = useMemo(() => {
    const fromGlobal = globalPresenceUsers
      .filter((user) => typeof user === 'string' && user.trim().length > 0);

    const fromStatus = Object.entries(userStatus)
      .filter(([, status]) => status === 'online')
      .map(([user]) => user);

    const fromRooms = Object.values(roomUserMap)
      .flat()
      .filter((user) => typeof user === 'string' && user.trim().length > 0);

    return [...new Set([...fromGlobal, ...fromStatus, ...fromRooms])];
  }, [globalPresenceUsers, userStatus, roomUserMap]);

  const isSelectedUserOnline = useMemo(() => {
    if (!selectedUser) return false;
    return globalOnlineUsers.some((user) => {
      if (typeof user === 'string') return user === selectedUser;
      return user?.username === selectedUser;
    });
  }, [globalOnlineUsers, selectedUser]);

  const normalizedOnlineUsers = useMemo(() => {
    return globalOnlineUsers
      .map((entry) => (typeof entry === 'string' ? entry : entry?.username))
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }, [globalOnlineUsers]);

  const roomScopedOnlineUsers = useMemo(() => {
    const activeRoomId = activeRoom || room;
    if (!activeRoomId) return [];

    const users = (roomUserMap[activeRoomId] || [])
      .map((entry) => (typeof entry === 'string' ? entry : entry?.username))
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0);

    return [...new Set(users)];
  }, [activeRoom, room, roomUserMap]);

  const roomSummaries = useMemo(() => {
    const uniqueRooms = new Map();

    if (groupRoomId) {
      uniqueRooms.set(groupRoomId, {
        id: groupRoomId,
        name: groupRoomId,
        type: 'group'
      });
    }

    rooms.forEach((roomEntry) => {
      if (!roomEntry?.id) return;
      if (!uniqueRooms.has(roomEntry.id)) {
        uniqueRooms.set(roomEntry.id, roomEntry);
      }
    });

    activeRoomRegistry.forEach((roomEntry) => {
      if (!roomEntry?.id || uniqueRooms.has(roomEntry.id)) return;
      uniqueRooms.set(roomEntry.id, {
        id: roomEntry.id,
        name: roomEntry.name || roomEntry.id,
        type: 'group'
      });
    });

    return Array.from(uniqueRooms.values()).map((roomEntry) => {
      const isGroupRoom = roomEntry.type !== 'dm';
      const registryEntry = activeRoomRegistry.find((entry) => entry.id === roomEntry.id);
      const registryUsers = Array.isArray(registryEntry?.users) ? registryEntry.users : [];
      const roomMembers = ((roomUserMap[roomEntry.id] || []).length > 0 ? roomUserMap[roomEntry.id] : registryUsers)
        .map((entry) => (typeof entry === 'string' ? entry : entry?.username))
        .filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
      const peerName = roomEntry.with || roomEntry.name;
      const roomPeerCount = isGroupRoom
        ? roomMembers.filter((onlineUser) => onlineUser !== username).length
        : (roomMembers.includes(peerName) || userStatus[peerName] === 'online' ? 1 : 0);

      return {
        ...roomEntry,
        isActive: roomPeerCount > 0,
        peerCount: roomPeerCount
      };
    });
  }, [groupRoomId, rooms, roomUserMap, username, userStatus, activeRoomRegistry]);

  const groupRoomSummaries = useMemo(() => {
    return roomSummaries.filter((roomEntry) => roomEntry.type !== 'dm');
  }, [roomSummaries]);

  const activeGroupRoomCount = useMemo(() => {
    return groupRoomSummaries.filter((roomEntry) => roomEntry.isActive).length;
  }, [groupRoomSummaries]);

  useEffect(() => {
    const handleShortcuts = (event) => {
      if (!showChat) return;
      const tag = (event.target?.tagName || '').toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.focus();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setSoundEnabled((prev) => !prev);
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
        const index = groupRoomSummaries.findIndex((entry) => entry.id === current);
        const nextIndex = event.key === 'ArrowUp'
          ? (index <= 0 ? groupRoomSummaries.length - 1 : index - 1)
          : (index >= groupRoomSummaries.length - 1 ? 0 : index + 1);
        const targetRoom = groupRoomSummaries[nextIndex]?.id;
        if (targetRoom) switchRoom(targetRoom);
      }
    };

    document.addEventListener('keydown', handleShortcuts);
    return () => document.removeEventListener('keydown', handleShortcuts);
  }, [showChat, groupRoomSummaries, activeRoom, room, switchRoom, markCurrentRoomAsRead]);

  if (!showChat) return (
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

  return (
    <div className="chat-container">
      {/* 🌟 NEW: LiveKit UI Engine */}
      {liveKitToken && (
        <div className="livestream-fullscreen-container" style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'var(--bg)' }}>
          {/* Mobile menu dropdown above header on mobile */}
          {showMenuDropdown && isMobileView && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 11000 }}>
              <AnimatePresence>
                <motion.div 
                  className={`menu-dropdown ${selectedUser ? 'menu-dropdown-dm' : ''}`}
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ margin: '0 auto', maxWidth: 360 }}
                >
                  {/* ...menu dropdown content... */}
                  {/* Copy from the main menu dropdown rendering below */}
                  <div className="menu-header">Actions</div>
                  <button className="menu-item" onClick={() => { exportChat(); setShowMenuDropdown(false); }}><FileDown size={18}/><span>Export Chat</span></button>
                  <button className="menu-item" onClick={() => { navigateTo('starred'); setShowMenuDropdown(false); }}><Star size={18}/><span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span></button>
                  <button className="menu-item" onClick={() => { if (deferredPrompt) { handleInstallClick(); setShowMenuDropdown(false); } }} disabled={!deferredPrompt} style={{ cursor: deferredPrompt ? 'pointer' : 'default', opacity: deferredPrompt ? 1 : 0.6 }}><Smartphone size={18}/><span>{isAppInstalled ? '✓ App Installed' : deferredPrompt ? 'Install as App' : 'Install (Desktop Only)'}</span></button>
                  <div className="menu-divider"></div>
                  <button className="menu-item" onClick={() => { setShowRoomSidebar(true); setShowMenuDropdown(false); }}><Users size={18}/><span>Conversations {roomScopedOnlineUsers.filter((user) => user !== username).length > 0 && <span className="menu-badge">{roomScopedOnlineUsers.filter((user) => user !== username).length}</span>}</span></button>
                  <button className="menu-item" onClick={() => { navigateTo('rooms'); setShowMenuDropdown(false); }}><Hash size={18}/><span>Rooms {activeGroupRoomCount > 0 && <span className="menu-badge">{activeGroupRoomCount}</span>}</span></button>
                  <button className="menu-item" onClick={() => { navigateTo('media'); setShowMenuDropdown(false); }}><ImageIcon size={18}/><span>Media {mediaMessages.length > 0 && <span className="menu-badge">{mediaMessages.length}</span>}</span></button>
                  <button className="menu-item" onClick={() => { navigateTo('notifications'); setShowMenuDropdown(false); }}><Bell size={18}/><span>Notifications {notificationItems.length > 0 && <span className="menu-badge">{notificationItems.length}</span>}</span></button>
                  <div className="menu-divider"></div>
                  <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, true); setShowMenuDropdown(false); }} title="Start streaming with LiveKit"><Disc3 size={18}/><span>Start Stream</span></button>
                  <button className="menu-item" onClick={() => { handleJoinStream(`${room}-stream`, false); setShowMenuDropdown(false); }} title="Join a LiveKit stream"><PlayCircle size={18}/><span>Join Stream</span></button>
                  <button className="menu-item" onClick={() => setShowQuickReplies(!showQuickReplies)} title="Quick reply templates"><MessageSquare size={18}/><span>Quick Replies</span></button>
                  <button className="menu-item" onClick={() => { navigateTo('settings'); setShowMenuDropdown(false); }}><Settings size={18}/><span>Settings</span></button>
                  {recentMentions > 0 && (<button className="menu-item" onClick={() => { setChat(prev => { const firstMention = mentionedMessages[0]; if (firstMention && msgRefsMap.current[firstMention._id]) { msgRefsMap.current[firstMention._id].scrollIntoView({ behavior: 'smooth', block: 'center' }); } return prev; }); setShowMenuDropdown(false); }} title={`You have ${recentMentions} mention${recentMentions !== 1 ? 's' : ''}`}><AtSign size={18}/><span>Mentions {recentMentions > 0 && <span className="menu-badge">{recentMentions}</span>}</span></button>)}
                  <button className="menu-item" onClick={() => setShowMenuDropdown(false)} title="Conversation statistics"><Hash size={18}/><span>Stats: {conversationStats.totalMessages} msgs, {conversationStats.totalUsers} users</span></button>
                  <div className="menu-divider"></div>
                  <button className="menu-item menu-item-danger" onClick={handleLogout} title="Logout and end session"><LogOut size={18}/><span>Logout</span></button>
                  <div className="menu-footer"><div>Session ends when browser closes</div><div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>v{APP_VERSION} • {new Date(BUILD_DATE).toLocaleDateString()}</div></div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
          {/* Livestream header below menu dropdown */}
          <div className="livestream-header" style={{ position: 'absolute', top: 0, width: '100%', zIndex: 10000, display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'var(--header)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={24} color="var(--error)" className="pulse-animation" />
                  <h2 style={{ color: 'var(--txt)', margin: 0, fontSize: '18px' }}>
                      {isStreamHost ? "🔴 You are Live" : `Watching: ${currentStreamRoom}`}
                  </h2>
              </div>
              <button onClick={handleLeaveStream} style={{ background: 'var(--error)', padding: '8px 16px', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  Leave Stream
              </button>
          </div>

          <div style={{ height: 'calc(100vh - 60px)', marginTop: '60px' }}>
              <LiveKitRoom
                video={isStreamHost}
                audio={isStreamHost}
                token={liveKitToken}
                serverUrl={process.env.REACT_APP_LIVEKIT_URL || "wss://devchat-pro-f8nd2p1j.livekit.cloud"}
                data-lk-theme="default"
                onDisconnected={handleLeaveStream}
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
          </div>
        </div>
      )}
      {/* Streaming error/success toast */}
      {(callError || successMessage) && (
        <div className="stream-toast" style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: callError ? '#ff4d4f' : '#00a884',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontWeight: 600,
          fontSize: '16px',
          minWidth: '220px',
          textAlign: 'center',
        }}>
          {callError || successMessage}
        </div>
      )}
      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallPrompt && !showChat && (
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

      <div className="chat-header">
        <div className="menu-container" ref={menuContainerRef}>
          <button 
            className="menu-toggle"
            onClick={() => setShowMenuDropdown(!showMenuDropdown)}
            title="Menu"
          >
            <Menu size={20}/>
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
                  transition={{ duration: 0.2 }}
                >
                  <div className="menu-header">Actions</div>
                  
                  <button 
                    className="menu-item"
                    onClick={() => {
                      exportChat();
                      setShowMenuDropdown(false);
                    }}
                  >
                    <FileDown size={18}/>
                    <span>Export Chat</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => { navigateTo('starred'); setShowMenuDropdown(false); }}
                  >
                    <Star size={18}/>
                    <span>Starred Messages {starredMsgIds.size > 0 && <span className="menu-badge">{starredMsgIds.size}</span>}</span>
                  </button>
                  
                  <button 
                    className="menu-item"
                    onClick={() => {
                      if (deferredPrompt) {
                        handleInstallClick();
                        setShowMenuDropdown(false);
                      }
                    }}
                    disabled={!deferredPrompt}
                    style={{
                      cursor: deferredPrompt ? 'pointer' : 'default',
                      opacity: deferredPrompt ? 1 : 0.6
                    }}
                  >
                    <Smartphone size={18}/>
                    <span>
                      {isAppInstalled 
                        ? '✓ App Installed' 
                        : deferredPrompt 
                          ? 'Install as App' 
                          : 'Install (Desktop Only)'}
                    </span>
                  </button>
                  
                  <div className="menu-divider"></div>
                  
                  <button 
                    className="menu-item"
                    onClick={() => {
                      setShowRoomSidebar(true);
                      setShowMenuDropdown(false);
                    }}
                  >
                    <Users size={18}/>
                    <span>Conversations {roomScopedOnlineUsers.filter((user) => user !== username).length > 0 && <span className="menu-badge">{roomScopedOnlineUsers.filter((user) => user !== username).length}</span>}</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      navigateTo('rooms');
                      setShowMenuDropdown(false);
                    }}
                  >
                    <Hash size={18}/>
                    <span>Rooms {activeGroupRoomCount > 0 && <span className="menu-badge">{activeGroupRoomCount}</span>}</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      navigateTo('media');
                      setShowMenuDropdown(false);
                    }}
                  >
                    <ImageIcon size={18}/>
                    <span>Media {mediaMessages.length > 0 && <span className="menu-badge">{mediaMessages.length}</span>}</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      navigateTo('notifications');
                      setShowMenuDropdown(false);
                    }}
                  >
                    <Bell size={18}/>
                    <span>Notifications {notificationItems.length > 0 && <span className="menu-badge">{notificationItems.length}</span>}</span>
                  </button>

                  <div className="menu-divider"></div>


                  <button
                    className="menu-item"
                    onClick={() => {
                      handleJoinStream(`${room}-stream`, true);
                      setShowMenuDropdown(false);
                    }}
                    title="Start streaming with LiveKit"
                  >
                    <Disc3 size={18}/>
                    <span>Start Stream</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      handleJoinStream(`${room}-stream`, false);
                      setShowMenuDropdown(false);
                    }}
                    title="Join a LiveKit stream"
                  >
                    <PlayCircle size={18}/>
                    <span>Join Stream</span>
                  </button>

                  <button 
                    className="menu-item"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    title="Quick reply templates"
                  >
                    <MessageSquare size={18}/>
                    <span>Quick Replies</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      navigateTo('settings');
                      setShowMenuDropdown(false);
                    }}
                  >
                    <Settings size={18}/>
                    <span>Settings</span>
                  </button>

                  {recentMentions > 0 && (
                    <button 
                      className="menu-item"
                      onClick={() => {
                        setChat(prev => {
                          const firstMention = mentionedMessages[0];
                          if (firstMention && msgRefsMap.current[firstMention._id]) {
                            msgRefsMap.current[firstMention._id].scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                          return prev;
                        });
                        setShowMenuDropdown(false);
                      }}
                      title={`You have ${recentMentions} mention${recentMentions !== 1 ? 's' : ''}`}
                    >
                      <AtSign size={18}/>
                      <span>Mentions {recentMentions > 0 && <span className="menu-badge">{recentMentions}</span>}</span>
                    </button>
                  )}

                  <button 
                    className="menu-item"
                    onClick={() => setShowMenuDropdown(false)}
                    title="Conversation statistics"
                  >
                    <Hash size={18}/>
                    <span>
                      Stats: {conversationStats.totalMessages} msgs, {conversationStats.totalUsers} users
                    </span>
                  </button>
                  
                  <div className="menu-divider"></div>
                  
                  <button 
                    className="menu-item menu-item-danger"
                    onClick={handleLogout}
                    title="Logout and end session"
                  >
                    <LogOut size={18}/>
                    <span>Logout</span>
                  </button>
                  
                  <div className="menu-footer">
                    <div>Session ends when browser closes</div>
                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                      v{APP_VERSION} • {new Date(BUILD_DATE).toLocaleDateString()}
                    </div>
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
          <h3>{currentRoomInfo?.name || room} <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: 'normal' }}>{APP_VERSION}</span></h3>
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

        {/* ...existing code... */}
        
        {/* Call Buttons - Only show when a user is selected in DM */}
        {selectedUser && isSelectedUserOnline && callState !== 'active' && (
          <div className="call-buttons">
            <button 
              className="call-btn voice-call-btn"
              onClick={() => startCall('voice', selectedUser)}
              title={`Voice call ${selectedUser}`}
              disabled={callState === 'calling' || callState === 'ringing'}
            >
              <Phone size={18}/>
            </button>
            <button 
              className="call-btn video-call-btn"
              onClick={() => startCall('video', selectedUser)}
              title={`Video call ${selectedUser}`}
              disabled={callState === 'calling' || callState === 'ringing'}
            >
              <Video size={18}/>
            </button>
          </div>
        )}
        
        <div className="users-info" title={`${onlineUsers.length} member${onlineUsers.length !== 1 ? 's' : ''} online`}>
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
          title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
        >
          {soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
        </button>
        <button className="clear-btn" onClick={() => setShowClearConfirm(true)} title="Clear all messages"><Trash2 size={18}/></button>
      </div>

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
          onClick={() => setShowAdvancedSearch((prev) => !prev)}
          title={showAdvancedSearch ? "Hide advanced search" : "Show advanced search"}
        >
          <Settings size={16} />
        </button>
      </div>

      {showAdvancedSearch && (currentRoomId || '').includes('_dm_') && (
        <div className="search-bar" style={{ marginTop: 6 }}>
          <MessageSquare size={16} />
          <input
            type="text"
            placeholder="Search only this DM..."
            value={dmSearchQuery}
            onChange={(e) => setDmSearchQuery(e.target.value)}
            className="search-input"
          />
          {dmSearchQuery && (
            <button className="markdown-toggle" onClick={() => setDmSearchQuery('')} title="Clear DM search">
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
          onChange={(e) => setSearchFilters((prev) => ({ ...prev, sender: e.target.value }))}
          title="Filter by sender"
        >
          <option value="">All senders</option>
          {availableSenders.map((senderName) => (
            <option key={`sender-filter-${senderName}`} value={senderName}>{senderName}</option>
          ))}
        </select>

        <select
          className="search-input"
          style={{ maxWidth: 140 }}
          value={searchFilters.mediaType}
          onChange={(e) => setSearchFilters((prev) => ({ ...prev, mediaType: e.target.value }))}
          title="Filter by message type"
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
          onChange={(e) => setSearchFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
          title="From date"
        />
        <input
          type="date"
          className="search-input"
          style={{ maxWidth: 150 }}
          value={searchFilters.toDate}
          onChange={(e) => setSearchFilters((prev) => ({ ...prev, toDate: e.target.value }))}
          title="To date"
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt-muted, #8696a0)', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={searchFilters.mentionsOnly}
            onChange={(e) => setSearchFilters((prev) => ({ ...prev, mentionsOnly: e.target.checked }))}
          />
          Mentions only
        </label>
      </div>
      )}

      {pinnedMessages.length > 0 && (
        <div className="pinned-messages-bar" onClick={() => navigateTo('pinned')} style={{cursor:'pointer'}}>
          <Pin size={14} />
          <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
          <ChevronDown size={14} style={{marginLeft:'auto', transform: currentView === 'pinned' ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}} />
        </div>
      )}
      <AnimatePresence>
        {currentView === 'pinned' && pinnedMessages.length > 0 && (
          <motion.div
            className="pinned-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {pinnedMessages.map((pm, idx) => (
              <div
                key={pm._id || idx}
                className="pinned-panel-item"
                onClick={() => { scrollToMessage(pm._id); goBack(); }}
              >
                <Pin size={12} />
                <span className="pinned-panel-text">
                  {pm.type === 'image' ? '📷 Photo' : pm.type === 'voice' ? '🎤 Voice' : (pm.text || '').substring(0, 60)}
                </span>
                <span className="pinned-panel-sender">{pm.sender}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="chat-body" 
        ref={chatBodyRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and drop overlay */}
        {isDragging && (
          <div className="drag-drop-overlay">
            <div className="drag-drop-content">
              <ImageIcon size={48} />
              <h3>Drop images here</h3>
              <p>Support for multiple images</p>
            </div>
          </div>
        )}
        
        <AnimatePresence>
          {filteredChat.flatMap((m, i) => {
            const isOwn = m.sender === username;
            const reactions = m.reactions || {};
            const grouped = i > 0 && isGroupedMessage(m, filteredChat[i - 1]);
            const showDateSep = i === 0 || needsDateSeparator(m.time, filteredChat[i - 1]?.time);
            const isGroupedBelow = i < filteredChat.length - 1 && isGroupedMessage(filteredChat[i + 1], m);
            const clusterPos = !grouped && isGroupedBelow ? 'cluster-top'
              : grouped && isGroupedBelow ? 'cluster-mid'
              : grouped && !isGroupedBelow ? 'cluster-bottom' : '';

            const bubble = (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                key={`msg-${m._id || i}`}
                id={`msg-${m._id}`}
                ref={el => { if (el && m._id) msgRefsMap.current[m._id] = el; }}
                className={`msg-bubble ${isOwn ? "me" : "other"} ${m.isPinned ? "pinned" : ""} ${grouped ? "grouped" : ""} ${clusterPos}`}
                onContextMenu={(e) => handleContextMenu(e, m)}
                onTouchStart={(e) => handleLongPressStart(e, m)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {m.isPinned && <Pin size={12} className="pin-icon" />}
                {starredMsgIds.has(m._id) && <span className="msg-star-badge"><Star size={10} fill="#FFD700" color="#FFD700"/></span>}
                {m.sender !== username && <span className="sender-tag">{m.sender}</span>}
                
                {m.replyTo && (() => {
                  const repliedMsg = chat.find(c => c._id === m.replyTo);
                  return (
                    <div
                      className="reply-preview"
                      onClick={() => scrollToMessage(m.replyTo)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Reply size={12} />
                      <div className="reply-preview-content">
                        <span className="reply-preview-sender">{repliedMsg?.sender || 'Unknown'}</span>
                        <span className="reply-preview-text">
                          {repliedMsg?.type === 'image' ? '📷 Photo' :
                           repliedMsg?.type === 'voice' ? '🎤 Voice message' :
                           repliedMsg?.type === 'file' ? `📎 ${repliedMsg?.fileName || 'File'}` :
                           ((repliedMsg?.text || '').substring(0, 60) + ((repliedMsg?.text || '').length > 60 ? '...' : ''))}
                        </span>
                      </div>
                    </div>
                  );
                })()
                }
                
                {m.type === 'image' ? (
                  <div className="image-message-wrapper">
                    {(m.fileUrl || m.text) ? (
                      <>
                        <div 
                          className="image-container" 
                          onClick={() => {
                            const imageUrl = m.fileUrl || m.text;
                            console.log('🖼️ Opening image viewer:', imageUrl);
                            openImageViewer({
                              url: imageUrl,
                              fileName: `image-${new Date(m.time).getTime()}.jpg`,
                              sender: m.sender,
                              time: m.time
                            });
                          }}
                          onContextMenu={(e) => {
                            // Allow native right-click on images
                            e.stopPropagation();
                          }}
                        >
                          <img 
                            src={m.fileUrl || m.text} 
                            className="chat-img" 
                            alt="shared image"
                            onLoad={() => {
                              console.log('✅ Image loaded:', m.fileUrl || m.text);
                            }}
                            onError={(e) => {
                              console.error('❌ Image failed to load:', m.fileUrl || m.text);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="image-error" style={{display: 'none'}}>
                            <ImageIcon size={32} />
                            <span>Image failed to load</span>
                          </div>
                          <div className="image-overlay">
                            <Eye size={20} />
                            <span>Click to View</span>
                          </div>
                        </div>
                        <button 
                          className="media-download-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadMedia(m.fileUrl || m.text, `image-${new Date(m.time).getTime()}.jpg`);
                          }}
                          title="Download image"
                        >
                          <Download size={16} />
                          <span>Download</span>
                        </button>
                      </>
                    ) : (
                      <div className="media-error">
                        <ImageIcon size={24} />
                        <span>📷 Image not available (no URL)</span>
                      </div>
                    )}
                  </div>
                ) : m.type === 'file' ? (
                  <a href={m.fileUrl} download={m.fileName} className="file-card" onClick={e => e.stopPropagation()}>
                    <div className="file-card-icon"><FileText size={20}/></div>
                    <div className="file-card-info">
                      <span className="file-card-name">{m.fileName || 'File'}</span>
                      <span className="file-card-size">{m.fileSize ? formatFileSize(m.fileSize) : 'Download'}</span>
                    </div>
                    <Download size={16} />
                  </a>
                ) : m.type === 'voice' ? (
                  <div className="voice-message-wrapper">
                    {m.fileUrl ? (
                      <>
                        <div 
                          className="voice-message" 
                          onClick={() => {
                            console.log('🎤 Opening voice player:', m.fileUrl);
                            openVoicePlayer({
                              url: m.fileUrl,
                              fileName: `voice-${new Date(m.time).getTime()}.webm`,
                              sender: m.sender,
                              time: m.time,
                              duration: m.duration || 0
                            });
                          }}
                        >
                          <button 
                            className="voice-play-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!m.fileUrl) {
                                console.error('❌ No fileUrl for voice message');
                                return;
                              }
                              console.log('🔊 Playing voice from chat:', m.fileUrl);
                              playVoiceMessage(m.fileUrl, m._id);
                            }}
                            title={playingVoiceId === m._id ? 'Pause' : 'Play'}
                          >
                            {playingVoiceId === m._id ? <Pause size={16}/> : <Play size={16}/>}
                          </button>
                          <div className="voice-waveform">
                            <span className="voice-duration">{m.duration || 0}s</span>
                          </div>
                          <Eye size={16} className="voice-view-icon" title="Open player" />
                        </div>
                        <button 
                          className="media-download-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadMedia(m.fileUrl, `voice-${new Date(m.time).getTime()}.webm`);
                          }}
                          title="Download voice message"
                        >
                          <Download size={16} />
                          <span>Download</span>
                        </button>
                      </>
                    ) : (
                      <div className="media-error">
                        🎤 Voice message not available (no URL)
                      </div>
                    )}
                  </div>
                ) : renderMessageText(m)}
                
                {m.edited && <span className="msg-edited">(edited)</span>}
                
                {Object.keys(reactions).length > 0 && (
                  <div className="message-reactions">
                    {Object.entries(reactions).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        className={`reaction-item ${users.includes(username) ? 'reacted' : ''}`}
                        onClick={() => handleReaction(m._id, emoji)}
                        data-tooltip={users.length > 0 ? users.join(', ') : undefined}
                      >
                        {emoji} {users.length}
                      </button>
                    ))}
                  </div>
                )}
                
                {Object.entries(reactions).reduce((total, [_, users]) => total + users.length, 0) > 0 && (
                  <div className="reaction-summary">
                    {Object.entries(reactions).map(([emoji, users]) => {
                      const userList = users.join(', ');
                      const count = users.length;
                      return (
                        <span key={emoji} className="reaction-count" title={userList}>
                          {emoji} {count > 1 ? `+${count - 1}` : ''}
                        </span>
                      );
                    }).slice(0, 3)}
                  </div>
                )}
                
                <div className="msg-footer">
                  <span className="timestamp" title={new Date(m.time).toLocaleString()}>
                    {formatRelativeTime(m.time)}
                  </span>

                  {isOwn && m.clientMessageId && (() => {
                    const queueEntry = outgoingQueue.find((entry) => entry.id === m.clientMessageId);
                    if (!queueEntry) return null;
                    const stateLabel = queueEntry.status;
                    return (
                      <span
                        className="read-receipt"
                        title={queueEntry.error || stateLabel}
                        style={{ color: queueEntry.status === 'failed' ? '#ff6b6b' : 'inherit' }}
                      >
                        {stateLabel}
                      </span>
                    );
                  })()}

                  {isOwn && showDoubleTick && (() => {
                    const readers = Array.isArray(m.readBy) ? m.readBy : [];
                    const seenByOthers = readers.some((readerName) => readerName && readerName !== username);

                    return (
                      <span
                        className={`message-ticks ${(seenByOthers && showBlueTick) ? 'blue' : ''}`}
                        title={seenByOthers ? 'Seen' : 'Delivered'}
                      >
                        ✓✓
                      </span>
                    );
                  })()}

                  {isOwn && !showDoubleTick && Array.isArray(m.readBy) && m.readBy.filter((readerName) => readerName !== username).length > 0 && (
                    <span className="read-receipt" title={`Read by: ${m.readBy.filter((readerName) => readerName !== username).join(', ')}`}>
                      <CheckCircle size={11} /> {m.readBy.filter((readerName) => readerName !== username).length}
                    </span>
                  )}
                </div>
              </motion.div>
            );
            const items = [];
            if (showDateSep) {
              items.push(
                <div key={`sep-${m.time || i}`} className="date-separator">
                  <span className="date-separator-text">{formatDateSeparator(m.time)}</span>
                </div>
              );
            }
            items.push(bubble);
            return items;
          })}
        </AnimatePresence>

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
              <span className="typing-label">{typingDisplay}...</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {unreadCount > 0 && !isAtBottom && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="unread-badge"
          onClick={() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); setUnreadCount(0); }}
        >
          <ChevronDown size={16}/> {unreadCount} new message{unreadCount > 1 ? 's' : ''}
        </motion.button>
      )}

      {replyingTo && (
        <div className="replying-bar">
          <Reply size={16} />
          <div>
            <strong>Replying to {replyingTo.sender}</strong>
            <p>{replyingTo.text.substring(0, 50)}...</p>
          </div>
          <button onClick={() => setReplyingTo(null)}><X size={16} /></button>
        </div>
      )}

      {(uploadingFile || uploadProgress) && (
        <div className="uploading-bar">
          <div className="spinner-small"></div>
          <span>{uploadProgress || 'Uploading file...'}</span>
        </div>
      )}

      {failedQueueItems.length > 0 && (
        <div className="uploading-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 12 }}>⚠️ {failedQueueItems.length} message{failedQueueItems.length > 1 ? 's' : ''} failed</span>
          <button className="media-panel-btn" onClick={() => failedQueueItems.forEach((entry) => retryQueueItem(entry.id))}>
            Retry all
          </button>
        </div>
      )}

      {/* Quick replies panel */}
      <AnimatePresence>
        {showQuickReplies && (
          <motion.div 
            className="quick-replies-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="quick-replies-content">
              {quickReplyTemplates.map((template, idx) => (
                <button
                  key={idx}
                  className="quick-reply-btn"
                  onClick={() => {
                    setMessage(template);
                    setShowQuickReplies(false);
                    textareaRef.current?.focus();
                  }}
                  title={template}
                >
                  {template}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chat-footer">
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept="image/*,application/pdf,.doc,.docx"
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
        
        {/* Left action buttons */}
        <button
          className="file-upload-btn whatsapp-action-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!connected || uploadingFile}
          title="Attach images"
        >
          <ImageIcon size={22} />
        </button>
        
        <button
          className="camera-btn whatsapp-action-btn"
          onClick={() => cameraInputRef.current?.click()}
          disabled={!connected || uploadingFile}
          title="Take photo"
        >
          <Camera size={22}/>
        </button>
        
        {/* Main input container - WhatsApp style */}
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
            placeholder={connected ? "Type a message... (Shift+Enter for new line)" : "Connecting..."} 
            onChange={handleMessageChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
          />
          {message.length > 100 && (
            <span className={`char-counter ${message.length > 450 ? 'warn' : ''}`}>{message.length}</span>
          )}
        </div>
        
        {/* Right action button - transforms based on message */}
        {message.trim() ? (
          <button 
            className="send-btn whatsapp-send" 
            onClick={sendMessage} 
            disabled={!connected || sendingMessage}
            title="Send message"
          >
            {sendingMessage ? <div className="spinner-small"></div> : <Send size={20}/>}
          </button>
        ) : (
          <button
            className={`voice-record-btn whatsapp-action-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleDesktopRecordingClick}
            onTouchStart={handleRecordingStart}
            onTouchMove={handleRecordingSlide}
            onTouchEnd={recordingLocked ? undefined : stopVoiceRecording}
            disabled={!connected}
            title={isRecording ? `Recording: ${recordingTime}s (click to stop)` : 'Click to record voice message'}
          >
            {isRecording ? <><span className="rec-dot"></span><span className="rec-time">{recordingTime}s</span></> : <Mic size={22}/>}
          </button>
        )}
      </div>

      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker onEmojiClick={handleEmojiClick} theme={theme} />
        </div>
      )}

      {/* Voice Recording Overlay - WhatsApp Style */}
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
                  <button 
                    className="cancel-recording-btn"
                    onClick={cancelVoiceRecording}
                  >
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
                  <div className="lock-indicator">
                    <ChevronUp size={16} />
                    <Lock size={16} />
                  </div>
                </div>
              )}
              
              {/* Waveform visualization */}
              <div className="waveform-container">
                {[...Array(40)].map((_, i) => (
                  <div 
                    key={i} 
                    className="waveform-bar"
                    style={{
                      animationDelay: `${i * 0.05}s`,
                      height: `${Math.random() * 60 + 20}%`
                    }}
                  />
                ))}
              </div>
              
              {/* Stop & Send button for desktop */}
              <button 
                type="button"
                className="stop-send-btn"
                onClick={stopVoiceRecording}
                title="Stop & Send"
              >
                <Send size={20} />
                <span>Stop & Send</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal - Enhanced WhatsApp Style */}
      <AnimatePresence>
        {showImagePreview && selectedImages.length > 0 && (
          <motion.div 
            className="image-preview-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <div className="preview-header">
              <button 
                className="preview-close-btn"
                onClick={cancelImagePreview}
              >
                <X size={24} />
              </button>
              {selectedImages.length > 1 && (
                <span className="image-counter">
                  {currentImageIndex + 1} / {selectedImages.length}
                </span>
              )}
            </div>
            
            {/* Main image display */}
            <div className="preview-image-container">
              <img 
                src={selectedImages[currentImageIndex].preview} 
                alt="Preview" 
                key={selectedImages[currentImageIndex].id}
              />
              
              {/* Navigation arrows for multiple images */}
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
            
            {/* Thumbnails for multiple images */}
            {selectedImages.length > 1 && (
              <div className="preview-thumbnails">
                {selectedImages.map((img, index) => (
                  <div 
                    key={img.id}
                    className={`preview-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img src={img.preview} alt={`Thumbnail ${index + 1}`} />
                    <button 
                      className="thumbnail-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Caption and send */}
            <div className="preview-footer">
              <div className="caption-input-wrapper">
                <input
                  type="text"
                  className="caption-input"
                  placeholder={selectedImages.length > 1 ? "Add a caption (applies to first image)..." : "Add a caption..."}
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  maxLength={200}
                />
              </div>
              <button
                className="preview-send-btn"
                onClick={uploadMultipleImages}
                disabled={uploadingFile}
                title={`Send ${selectedImages.length} image(s)`}
              >
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
            role="dialog"
            aria-labelledby="edit-modal-title"
            aria-modal="true"
          >
            <motion.div 
              className="edit-modal"
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="edit-modal-header">
                <h3 id="edit-modal-title">Edit Message</h3>
                <button 
                  className="modal-close-btn"
                  onClick={() => setEditingMsgId(null)}
                  type="button"
                >
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
                <button 
                  className="btn-cancel"
                  onClick={() => setEditingMsgId(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button 
                  className="btn-save"
                  onClick={saveEditMessage}
                  disabled={!editingText.trim()}
                  type="button"
                >
                  Save
                </button>
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
                <button 
                  className="btn-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                  type="button"
                >
                  Keep
                </button>
                <button 
                  className="btn-delete"
                  onClick={confirmDelete}
                  type="button"
                >
                  Delete
                </button>
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
            role="dialog"
            aria-labelledby="profile-modal-title"
            aria-modal="true"
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
                <h2 id="profile-modal-title">{showProfileModal}</h2>
                <span className={`profile-status status-${userStatus[showProfileModal] || 'online'}`}>
                  {userStatus[showProfileModal] || 'online'}
                </span>
                {userLastSeen[showProfileModal] && (
                  <span className="profile-status" style={{ opacity: 0.75 }}>
                    last seen {formatRelativeTime(userLastSeen[showProfileModal])}
                  </span>
                )}
              </div>
              <div className="profile-body">
                {userProfiles[showProfileModal]?.bio && (
                  <div className="profile-bio">
                    <strong>Bio</strong>
                    <p>{userProfiles[showProfileModal].bio}</p>
                  </div>
                )}
                <div className="profile-actions">
                  <button 
                    className="btn-dm"
                    onClick={() => createDM(showProfileModal)}
                    disabled={blockedUsers.includes(showProfileModal)}
                  >
                    <AtSign size={16} /> Send Message
                  </button>
                  <button 
                    className="btn-mention"
                    onClick={() => {
                      setMessage(prev => prev + `@${showProfileModal} `);
                      setShowProfileModal(null);
                    }}
                  >
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
              <button 
                className="modal-close-btn"
                onClick={() => setShowProfileModal(null)}
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Sidebar for DMs */}
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
                      onClick={() => switchRoom(groupRoomId)}
                    >
                      <div className="room-icon">#</div>
                      <span>{groupRoomId}</span>
                    </button>
                  </div>
                )}

                <div className="sidebar-section">
                  <div className="sidebar-section-title">Your Conversations</div>
                {rooms.map(r => (
                  <button
                    key={r.id}
                    className={`room-item ${activeRoom === r.id ? 'active' : ''}`}
                    onClick={() => switchRoom(r.id)}
                  >
                    <div className="room-icon">
                      {r.type === 'dm' ? <MessageSquare size={16}/> : '#'}
                    </div>
                    <span>{r.name}</span>
                  </button>
                ))}
                </div>

                <div className="sidebar-section">
                  <div className="sidebar-section-title">Online Members</div>
                  {roomScopedOnlineUsers.filter(u => u !== username).length === 0 ? (
                    <div className="sidebar-empty">No other members online</div>
                  ) : (
                    roomScopedOnlineUsers
                      .filter(u => u !== username)
                      .map((user) => (
                        <div className="sidebar-user-row" key={`online-${user}`}>
                          <div className="sidebar-user-meta">
                            <span className="sidebar-user-dot"></span>
                            <span>{user}</span>
                          </div>
                          <button className="sidebar-dm-btn" onClick={() => createDM(user)}>
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

      {/* Error Toast */}
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
            <button onClick={() => setErrorMessage('')}>
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
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
            <div className="context-menu-header">
              Message Actions
            </div>
            <button
              className="context-menu-item"
              onClick={() => handleContextMenuAction('reply')}
            >
              <Reply size={16} />
              <span>Reply</span>
            </button>
            <button
              className="context-menu-item"
              onClick={() => handleContextMenuAction('copy')}
            >
              <Copy size={16} />
              <span>Copy</span>
            </button>
            <button
              className="context-menu-item"
              onClick={() => handleContextMenuAction('pin')}
            >
              <Pin size={16} />
              <span>{contextMenuMessage.isPinned ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              className="context-menu-item"
              onClick={() => handleContextMenuAction('star')}
            >
              <Star size={16} fill={starredMsgIds.has(contextMenuMessage?._id) ? '#FFD700' : 'none'} color="#FFD700" />
              <span>{starredMsgIds.has(contextMenuMessage?._id) ? 'Unstar' : 'Star'}</span>
            </button>
            
            {/* Media-specific actions */}
            {contextMenuMessage.type === 'image' && contextMenuMessage.fileUrl && (
              <button
                className="context-menu-item"
                onClick={() => handleContextMenuAction('view')}
              >
                <ImageIcon size={16} />
                <span>View Image</span>
              </button>
            )}
            {contextMenuMessage.type === 'voice' && contextMenuMessage.fileUrl && (
              <button
                className="context-menu-item"
                onClick={() => handleContextMenuAction('play')}
              >
                <PlayCircle size={16} />
                <span>Play Voice</span>
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
                <button
                  className="context-menu-item"
                  onClick={() => handleContextMenuAction('edit')}
                >
                  <Edit2 size={16} />
                  <span>Edit</span>
                </button>
                <button
                  className="context-menu-item danger"
                  onClick={() => handleContextMenuAction('delete')}
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </>
            )}
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
                <span className="media-viewer-time">
                  {formatRelativeTime(imageViewer.time)}
                </span>
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
              <button
                className="media-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadMedia(imageViewer.url, imageViewer.fileName);
                }}
              >
                <Download size={20} />
                <span>Download</span>
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
                  <span className="media-viewer-time">
                    {formatRelativeTime(voicePlayer.time)}
                  </span>
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
                <button
                  className="media-action-btn"
                  onClick={() => downloadMedia(voicePlayer.url, voicePlayer.fileName)}
                >
                  <Download size={20} />
                  <span>Download</span>
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
                <Trash2 size={48} color="var(--error, #f44336)" />
              </div>
              <h3>Clear All Messages?</h3>
              <p>This will permanently delete all <strong>{chat.length}</strong> messages in <strong>{room}</strong> for everyone. This action cannot be undone.</p>
              <div className="delete-modal-footer">
                <button className="btn-cancel" onClick={() => setShowClearConfirm(false)} type="button">Cancel</button>
                <button
                  className="btn-delete"
                  onClick={() => { socketRef.current?.emit("clear_chat", roomRef.current); setShowClearConfirm(false); }}
                  type="button"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Starred Messages Panel */}
      <AnimatePresence>
        {currentView === 'starred' && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goBack()}
          >
            <motion.div
              className="starred-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => goBack()} className="panel-back-btn" title="Go back">← Back</button>
                <h3 className="panel-header-title">⭐ Starred Messages</h3>
                <div className="panel-header-actions">
                  <span className="starred-count-badge">{starredMsgIds.size}</span>
                </div>
              </div>
              <div className="panel-content">
                {chat.filter(m => starredMsgIds.has(m._id)).length === 0 ? (
                  <div className="starred-panel-empty">
                    <Star size={40} color="var(--txt-muted, #8696a0)" />
                    <p>No starred messages yet</p>
                    <span>Long-press any message and tap Star</span>
                  </div>
                ) : (
                  chat.filter(m => starredMsgIds.has(m._id)).map(m => (
                    <div
                      key={m._id}
                      className="starred-panel-item"
                      onClick={() => { scrollToMessage(m._id); goBack(); }}
                    >
                      <div className="starred-item-meta">
                        <span className="starred-item-sender">{m.sender}</span>
                        <span className="starred-item-time">{formatRelativeTime(m.time)}</span>
                        <button
                          className="starred-item-remove"
                          onClick={e => { e.stopPropagation(); toggleStar(m._id); }}
                          title="Remove star"
                        >
                          <Star size={14} fill="#FFD700" color="#FFD700"/>
                        </button>
                      </div>
                      <div className="starred-item-preview">
                        {m.type === 'image' ? '📷 Photo' :
                         m.type === 'voice' ? '🎤 Voice message' :
                         m.type === 'file' ? `📎 ${m.fileName}` :
                         (m.text || '').substring(0, 80) + ((m.text || '').length > 80 ? '…' : '')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Panel */}
      <AnimatePresence>
        {currentView === 'media' && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goBack()}
          >
            <motion.div
              className="starred-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => goBack()} className="panel-back-btn" title="Go back">← Back</button>
                <h3 className="panel-header-title">{(currentRoomId || '').includes('_dm_') ? '🖼️ DM Media Gallery' : '🖼️ Shared Media'}</h3>
                <div className="panel-header-actions">
                  <span className="starred-count-badge">{((currentRoomId || '').includes('_dm_') ? dmMediaMessages : mediaMessages).length}</span>
                </div>
              </div>
              <div className="panel-content media-panel-content">
                {((currentRoomId || '').includes('_dm_') ? dmMediaMessages : mediaMessages).length === 0 ? (
                  <div className="starred-panel-empty">
                    <ImageIcon size={40} color="var(--txt-muted, #8696a0)" />
                    <p>No shared media yet</p>
                    <span>Images, voice notes and files will appear here</span>
                  </div>
                ) : (
                  ((currentRoomId || '').includes('_dm_') ? dmMediaMessages : mediaMessages).map((m) => (
                    <div key={`media-${m._id}`} className="media-panel-item">
                      <div className="media-panel-meta">
                        <span className="media-type-badge">{m.type.toUpperCase()}</span>
                        <span className="media-panel-sender">{m.sender}</span>
                        <span className="media-panel-time">{formatRelativeTime(m.time)}</span>
                      </div>

                      <div className="media-panel-preview">
                        {m.type === 'image' ? (
                          <img src={m.fileUrl || m.text} alt="shared media" className="media-panel-thumb" />
                        ) : (
                          <div className="media-panel-generic">
                            {m.type === 'voice' ? '🎤 Voice message' : `📎 ${m.fileName || 'File attachment'}`}
                          </div>
                        )}
                      </div>

                      <div className="media-panel-actions">
                        {m.type === 'image' && (
                          <button
                            className="media-panel-btn"
                            onClick={() => openImageViewer({
                              url: m.fileUrl || m.text,
                              fileName: m.fileName || `image-${new Date(m.time).getTime()}.jpg`,
                              sender: m.sender,
                              time: m.time
                            })}
                          >
                            View
                          </button>
                        )}
                        {m.type === 'voice' && (
                          <button
                            className="media-panel-btn"
                            onClick={() => openVoicePlayer({
                              url: m.fileUrl,
                              fileName: m.fileName || `voice-${new Date(m.time).getTime()}.webm`,
                              sender: m.sender,
                              time: m.time,
                              duration: m.duration || 0
                            })}
                          >
                            Play
                          </button>
                        )}
                        <button
                          className="media-panel-btn"
                          onClick={() => downloadMedia(m.fileUrl || m.text, m.fileName || `${m.type}-${new Date(m.time).getTime()}`)}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentView === 'threads' && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goBack()}
          >
            <motion.div
              className="starred-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => goBack()} className="panel-back-btn" title="Go back">← Back</button>
                <h3 className="panel-header-title">🧵 Threads</h3>
                <div className="panel-header-actions">
                  <span className="starred-count-badge">{threadRootId ? threadMessages.length : threadRootCount}</span>
                </div>
              </div>

              <div className="panel-content">
                {!threadRootId ? (
                  threadRootCount === 0 ? (
                    <div className="starred-panel-empty">
                      <Reply size={40} color="var(--txt-muted, #8696a0)" />
                      <p>No threads yet</p>
                      <span>Reply to a message to start a thread</span>
                    </div>
                  ) : (
                    chat
                      .filter((candidate) => chat.some((m) => m.replyTo === candidate._id))
                      .map((root) => {
                        const replies = chat.filter((m) => m.replyTo === root._id);
                        return (
                          <button
                            key={`thread-root-${root._id}`}
                            className="starred-panel-item"
                            onClick={() => setThreadRootId(root._id)}
                          >
                            <div className="starred-item-meta">
                              <span className="starred-item-sender">{root.sender}</span>
                              <span className="starred-item-time">{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
                            </div>
                            <div className="starred-item-preview">{(root.text || '').substring(0, 120)}</div>
                          </button>
                        );
                      })
                  )
                ) : (
                  <>
                    <button className="media-panel-btn" onClick={() => setThreadRootId(null)}>← All threads</button>
                    {threadMessages.map((msg) => (
                      <button
                        key={`thread-msg-${msg._id}`}
                        className="starred-panel-item"
                        onClick={() => {
                          scrollToMessage(msg._id);
                          goBack();
                        }}
                      >
                        <div className="starred-item-meta">
                          <span className="starred-item-sender">{msg.sender}</span>
                          <span className="starred-item-time">{formatRelativeTime(msg.time)}</span>
                        </div>
                        <div className="starred-item-preview">{(msg.text || '').substring(0, 140)}</div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {currentView === 'rooms' && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goBack()}
          >
            <motion.div
              className="starred-panel settings-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => goBack()} className="panel-back-btn" title="Go back">← Back</button>
                <h3 className="panel-header-title"># Rooms</h3>
                <div className="panel-header-actions">
                  <span className="starred-count-badge">{activeGroupRoomCount}</span>
                </div>
              </div>

              <div className="panel-content">
                <div className="rooms-join-row">
                  <input
                    className="rooms-join-input"
                    placeholder="Enter Room ID"
                    value={newRoomIdInput}
                    onChange={(event) => setNewRoomIdInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        joinGroupRoomFromPanel();
                      }
                    }}
                  />
                  <button
                    className="rooms-join-btn"
                    onClick={joinGroupRoomFromPanel}
                    disabled={!newRoomIdInput.trim()}
                  >
                    Join
                  </button>
                </div>

                {(!!currentRoomId || (canManageCurrentRoom && !(currentRoomId || '').includes('_dm_'))) && (
                  <div className="rooms-join-row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Advanced room options</span>
                    <button className="media-panel-btn" onClick={() => setShowRoomAdminTools((prev) => !prev)}>
                      {showRoomAdminTools ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}

                {showRoomAdminTools && !!currentRoomId && (
                  <div className="rooms-join-row" style={{ alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, opacity: 0.8 }}>Typing timeout for this room (ms)</label>
                    <input
                      className="rooms-join-input"
                      type="number"
                      min={500}
                      max={10000}
                      step={100}
                      value={typingTimeoutByRoom[currentRoomId] || getTypingTimeoutForRoom(currentRoomId)}
                      onChange={(event) => {
                        const value = Number(event.target.value) || getTypingTimeoutForRoom(currentRoomId);
                        setTypingTimeoutByRoom((prev) => ({ ...prev, [currentRoomId]: value }));
                      }}
                    />
                  </div>
                )}

                {showRoomAdminTools && canManageCurrentRoom && !(currentRoomId || '').includes('_dm_') && (
                  <div className="rooms-join-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="media-panel-btn"
                        onClick={() => updateCurrentRoomPolicy({ locked: !currentRoomPolicy?.locked })}
                      >
                        {currentRoomPolicy?.locked ? 'Unlock room' : 'Lock room'}
                      </button>
                      <button
                        className="media-panel-btn"
                        onClick={() => updateCurrentRoomPolicy({ inviteOnly: !currentRoomPolicy?.inviteOnly })}
                      >
                        {currentRoomPolicy?.inviteOnly ? 'Disable invite-only' : 'Enable invite-only'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="rooms-join-input"
                        placeholder="Invite username"
                        value={roomInviteTarget}
                        onChange={(event) => setRoomInviteTarget(event.target.value)}
                      />
                      <button className="rooms-join-btn" onClick={inviteUserToCurrentRoom} disabled={!roomInviteTarget.trim()}>
                        Invite
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {onlineUsers.filter((userEntry) => userEntry !== username).map((userEntry) => (
                        <div key={`moderation-${userEntry}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, opacity: 0.85 }}>{userEntry}</span>
                          <button className="media-panel-btn" onClick={() => promoteModInCurrentRoom(userEntry)}>Mod</button>
                          <button className="media-panel-btn" onClick={() => removeUserFromCurrentRoom(userEntry)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {groupRoomSummaries.length === 0 ? (
                  <div className="starred-panel-empty">
                    <Hash size={40} color="var(--txt-muted, #8696a0)" />
                    <p>No rooms yet</p>
                    <span>Join a group room using Room ID</span>
                  </div>
                ) : (
                  groupRoomSummaries.map((roomEntry) => (
                    <div key={`room-summary-${roomEntry.id}`} className={`starred-panel-item room-summary-item ${(activeRoom || room) === roomEntry.id ? 'active' : ''}`}>
                      <button
                        style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}
                        onClick={() => {
                          switchRoom(roomEntry.id);
                          goBack();
                        }}
                      >
                        <div className="starred-item-meta">
                          <span className="starred-item-sender">Group</span>
                          <span className={`room-status-badge ${roomEntry.isActive ? 'active' : 'inactive'}`}>
                            {roomEntry.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="starred-item-preview">
                          {roomEntry.name}
                          {roomEntry.peerCount > 0 ? ` • ${roomEntry.peerCount} online` : ''}
                          {notificationPrefs.mutedRooms.includes(roomEntry.id) ? ' • muted' : ''}
                        </div>
                      </button>
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="media-panel-btn" onClick={() => toggleRoomMute(roomEntry.id)}>
                          {notificationPrefs.mutedRooms.includes(roomEntry.id) ? 'Unmute' : 'Mute'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {currentView === 'notifications' && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goBack()}
          >
            <motion.div
              className="starred-panel settings-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => goBack()} className="panel-back-btn" title="Go back">← Back</button>
                <h3 className="panel-header-title">🔔 Notifications</h3>
                <div className="panel-header-actions">
                  <span className="starred-count-badge">{notificationItems.length}</span>
                </div>
              </div>

              <div className="panel-content">
                {notificationItems.length > 0 && (
                  <div className="notifications-toolbar">
                    <button
                      className="media-panel-btn"
                      onClick={() => setNotificationItems([])}
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {notificationItems.length === 0 ? (
                  <div className="starred-panel-empty">
                    <Bell size={40} color="var(--txt-muted, #8696a0)" />
                    <p>No notifications</p>
                    <span>Messages from other chats will appear here</span>
                  </div>
                ) : (
                  notificationItems.map((notification) => (
                    <button
                      key={`notification-${notification.id}`}
                      className="starred-panel-item notification-item"
                      onClick={() => {
                        if (notification.type === 'livestream') {
                          setNotificationItems((prev) => prev.filter((entry) => entry.id !== notification.id));
                          requestJoinLivestreamFromNotification(notification);
                          goBack();
                          return;
                        }

                        setRooms((prev) => {
                          if (prev.some((roomEntry) => roomEntry.id === notification.room)) return prev;
                          if (notification.room.includes('_dm_')) {
                            const participants = notification.room.split('_dm_');
                            const peer = participants.find((participant) => participant && participant !== usernameRef.current) || notification.sender;
                            return [...prev, { id: notification.room, name: peer, type: 'dm', with: peer }];
                          }
                          return [...prev, { id: notification.room, name: notification.room, type: 'group' }];
                        });

                        setNotificationItems((prev) => prev.filter((entry) => entry.id !== notification.id));
                        switchRoom(notification.room);
                        goBack();
                      }}
                    >
                      <div className="starred-item-meta">
                        <span className="starred-item-sender">{notification.sender}</span>
                        <span className={`notification-source ${notification.source === 'DM' ? 'dm' : notification.source === 'LIVE' ? 'live' : 'group'}`}>{notification.source}</span>
                        <span className="starred-item-time">{formatRelativeTime(notification.time)}</span>
                      </div>
                      <div className="starred-item-preview">
                        {notification.preview}
                        {notification.type === 'livestream' && (
                          <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--primary, #00a884)' }}>
                            Tap to join live stream
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {currentView === 'settings' && (
          <motion.div
            className="starred-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goBack()}
          >
            <motion.div
              className="starred-panel settings-panel"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="panel-header-nav">
                <button onClick={() => goBack()} className="panel-back-btn" title="Go back">← Back</button>
                <h3 className="panel-header-title">⚙️ Settings</h3>
                <div className="panel-header-actions" />
              </div>

              <div className="panel-content settings-content">

                <div className="settings-section">
                  <h4>Stream Settings</h4>
                  <div className="settings-row">
                    <label htmlFor="stream-visibility">Visibility</label>
                    <select
                      id="stream-visibility"
                      className="settings-select"
                      value={streamVisibility || 'room'}
                      onChange={e => setStreamVisibility(e.target.value)}
                    >
                      <option value="room">Room Only</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <label htmlFor="stream-source">Source</label>
                    <select
                      id="stream-source"
                      className="settings-select"
                      value={streamSource || 'camera'}
                      onChange={e => setStreamSource(e.target.value)}
                    >
                      <option value="camera">Camera</option>
                      {/* Only show screen/both if not iOS and not mobile view */}
                      {!isMobileView && !isIOS && isWindows && <option value="screen">Screen</option>}
                      {!isMobileView && !isIOS && isWindows && <option value="both">Both (Camera + Screen)</option>}
                    </select>
                  </div>
                  <button
                    className="settings-btn"
                    onClick={() => startLivestream(streamVisibility, streamSource)}
                    disabled={livestreamControlsDisabled || !!liveStreamInfo?.isHost}
                  >
                    Start Stream
                  </button>
                  {liveStreamInfo?.isHost && (
                    <button
                      className="settings-btn settings-btn-danger"
                      onClick={() => stopHostedLivestream(true)}
                    >
                      Stop Stream
                    </button>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                    <span>Camera only is available on mobile. Screen and Both are available on Windows.</span>
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Camera Source</h4>
                  <div className="settings-row">
                    <label htmlFor="camera-source-select">Video input</label>
                    <select
                      id="camera-source-select"
                      className="settings-select"
                      value={selectedVideoInputId}
                      onChange={(event) => setSelectedVideoInputId(event.target.value)}
                    >
                      <option value="">System default camera</option>
                      {videoInputDevices.map((cameraDevice) => (
                        <option key={cameraDevice.deviceId} value={cameraDevice.deviceId}>
                          {cameraDevice.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="settings-btn"
                    onClick={refreshVideoInputs}
                  >
                    Refresh camera list
                  </button>
                </div>

                <div className="settings-section">
                  <h4>Theme</h4>
                  <div className="settings-theme-grid">
                    {[
                      { id: 'dark', label: 'Dark' },
                      { id: 'light', label: 'Light' },
                      { id: 'ocean', label: 'Ocean' },
                      { id: 'forest', label: 'Forest' },
                      { id: 'sunset', label: 'Sunset' },
                      { id: 'pink', label: 'Pink' }
                    ].map((themeOption) => (
                      <button
                        key={themeOption.id}
                        className={`settings-chip ${theme === themeOption.id ? 'active' : ''}`}
                        onClick={() => setTheme(themeOption.id)}
                      >
                        {themeOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Font</h4>
                  <div className="settings-theme-grid">
                    {[
                      { id: 'default', label: 'Default' },
                      { id: 'rounded', label: 'Rounded' },
                      { id: 'serif', label: 'Serif' },
                      { id: 'mono', label: 'Mono' }
                    ].map((fontOption) => (
                      <button
                        key={fontOption.id}
                        className={`settings-chip ${fontStyle === fontOption.id ? 'active' : ''}`}
                        onClick={() => setFontStyle(fontOption.id)}
                      >
                        {fontOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Views</h4>
                  <button
                    className="settings-btn"
                    onClick={() => navigateTo('threads')}
                  >
                    Open Threads {threadRootCount > 0 ? `(${threadRootCount})` : ''}
                  </button>
                </div>

                <div className="settings-section">
                  <h4>Call Settings</h4>
                  <button
                    className="settings-btn"
                    onClick={() => endCall()}
                    style={{ marginTop: 8 }}
                  >
                    Reset Call Settings
                  </button>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                    This will reset all call state, device selection, and clear call errors.
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Notifications</h4>
                  <div className="settings-row">
                    <label htmlFor="notif-sound">Message sounds</label>
                    <input
                      id="notif-sound"
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="setting-double-tick">Show double tick (delivered)</label>
                    <input
                      id="setting-double-tick"
                      type="checkbox"
                      checked={showDoubleTick}
                      onChange={(e) => setShowDoubleTick(e.target.checked)}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="setting-blue-tick">Blue tick when read</label>
                    <input
                      id="setting-blue-tick"
                      type="checkbox"
                      checked={showBlueTick}
                      disabled={!showDoubleTick}
                      onChange={(e) => setShowBlueTick(e.target.checked)}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="setting-dm-priority">DM-only priority notifications</label>
                    <input
                      id="setting-dm-priority"
                      type="checkbox"
                      checked={notificationPrefs.dmOnlyPriority}
                      onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, dmOnlyPriority: e.target.checked }))}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="setting-mentions-only">Mentions-only notifications</label>
                    <input
                      id="setting-mentions-only"
                      type="checkbox"
                      checked={notificationPrefs.mentionOnly}
                      onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, mentionOnly: e.target.checked }))}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="setting-quiet-hours">Quiet hours</label>
                    <input
                      id="setting-quiet-hours"
                      type="checkbox"
                      checked={notificationPrefs.quietHoursEnabled}
                      onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, quietHoursEnabled: e.target.checked }))}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="setting-auto-join-livestream">Auto-join livestream invites</label>
                    <input
                      id="setting-auto-join-livestream"
                      type="checkbox"
                      checked={autoJoinLivestream}
                      onChange={(e) => setAutoJoinLivestream(e.target.checked)}
                    />
                  </div>
                  {notificationPrefs.quietHoursEnabled && (
                    <div className="settings-row" style={{ gap: 8 }}>
                      <label>From</label>
                      <input
                        type="time"
                        value={notificationPrefs.quietStart}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, quietStart: e.target.value }))}
                      />
                      <label>To</label>
                      <input
                        type="time"
                        value={notificationPrefs.quietEnd}
                        onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, quietEnd: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="tick-legend" aria-label="Tick legend preview">
                    <span className="tick-legend-title">Preview:</span>
                    {!showDoubleTick ? (
                      <span className="tick-legend-muted">Message ticks are hidden</span>
                    ) : (
                      <>
                        <span className="tick-legend-item">
                          <span className="message-ticks">✓✓</span>
                          Delivered
                        </span>
                        {showBlueTick && (
                          <span className="tick-legend-item">
                            <span className="message-ticks blue">✓✓</span>
                            Read
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Typing Timeout</h4>
                  <div className="settings-row">
                    <label htmlFor="typing-group-timeout">Group timeout (ms)</label>
                    <input
                      id="typing-group-timeout"
                      type="number"
                      min={500}
                      max={10000}
                      step={100}
                      value={typingTimeoutByRoom.defaultGroup}
                      onChange={(e) => setTypingTimeoutByRoom((prev) => ({ ...prev, defaultGroup: Number(e.target.value) || 3000 }))}
                    />
                  </div>
                  <div className="settings-row">
                    <label htmlFor="typing-dm-timeout">DM timeout (ms)</label>
                    <input
                      id="typing-dm-timeout"
                      type="number"
                      min={500}
                      max={10000}
                      step={100}
                      value={typingTimeoutByRoom.defaultDm}
                      onChange={(e) => setTypingTimeoutByRoom((prev) => ({ ...prev, defaultDm: Number(e.target.value) || 1800 }))}
                    />
                  </div>
                </div>

                {blockedUsers.length > 0 && (
                  <div className="settings-section">
                    <h4>Blocked Users</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {blockedUsers.map((blockedUser) => (
                        <button key={`blocked-${blockedUser}`} className="settings-chip" onClick={() => unblockUserAction(blockedUser)}>
                          {blockedUser} · Unblock
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modals */}
      <AnimatePresence>
        {showCallSettings && (
          <CallSettings onClose={() => setShowCallSettings(false)} />
        )}
      </AnimatePresence>

      // ...SettingsManager removed to avoid duplication and modal conflicts...

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
                <User size={40} />
              </div>
              <h3>
                {incomingCall.isLivestream ? (
                  <>
                    {incomingCall.source === 'screen' ? (
                      <Monitor size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                    ) : (
                      <Camera size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                    )}
                    {incomingCall.source === 'screen' ? 'Screen Stream Invite' : 'Camera Stream Invite'}
                  </>
                ) : incomingCall.callType === 'video' ? (
                  <>
                    <Video size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                    Video Call
                  </>
                ) : (
                  <>
                    <Phone size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                    Voice Call
                  </>
                )}
              </h3>
              <div className="incoming-call-name">
                {incomingCall.isLivestream
                  ? `${incomingCall.from} is live (${incomingCall.source === 'screen' ? 'Screen' : 'Camera'} • ${incomingCall.visibility === 'public' ? 'Public' : 'Room'})`
                  : incomingCall.from}
              </div>
              <div className="incoming-call-actions">
                <button className="incoming-call-btn reject-btn" onClick={rejectCall}>
                  <PhoneOff size={24} />
                  <span>Decline</span>
                </button>
                <button className="incoming-call-btn accept-btn" onClick={answerCall}>
                  <Phone size={24} />
                  <span>{incomingCall.isLivestream ? 'Join Stream' : 'Accept'}</span>
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
              <div className="calling-avatar">
                <User size={40} />
              </div>
              <h3>
                {callState === 'ringing'
                  ? (callType === 'video' ? 'Video Ringing...' : 'Ringing...')
                  : (callType === 'video' ? 'Video Calling...' : 'Calling...')}
              </h3>
              <div className="calling-name">
                {callPeer.username}
              </div>
              <button className="calling-cancel-btn" onClick={endCall}>
                <PhoneOff size={24} />
                <span>Cancel</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Interface */}
      <AnimatePresence>
        {callState === 'active' && callPeer && (
          <motion.div
            className={`call-interface ${isCallMinimized ? 'minimized' : 'fullscreen'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isCallMinimized ? (
              <div className="call-minimized-panel">
                <div className="call-minimized-info">
                  {callType === 'video' ? <Video size={18} /> : <Phone size={18} />}
                  <span>{callPeer.username}</span>
                  <span className="call-minimized-duration">{formatCallDuration(callDuration)}</span>
                </div>
                <div className="call-minimized-controls">
                  <button 
                    className="call-minimized-btn"
                    onClick={toggleCallMinimize}
                    title="Maximize"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button 
                    className="call-minimized-btn end-btn"
                    onClick={endCall}
                    title="End call"
                  >
                    <PhoneOff size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="call-video-container">
                <audio ref={setRemoteAudioElement} autoPlay playsInline style={{ display: 'none' }} />
                {isLivestreamViewer && (
                  <button
                    className="livestream-viewer-expand-btn"
                    onClick={() => setLivestreamViewerExpanded((prev) => !prev)}
                    title={livestreamViewerExpanded ? 'Show full frame' : 'Expand video'}
                  >
                    {livestreamViewerExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                )}
                {/* Remote Video */}
                <video
                  key={remoteStream ? `remote-${remoteStream.id}` : 'remote-no-stream'}
                  ref={setRemoteVideoElement}
                  autoPlay
                  playsInline
                  className="remote-video"
                  style={{ width: '100%', height: '100%', objectFit: remoteVideoFitMode }}
                />

                {/* Local Video (only for video calls) */}
                {callType === 'video' && localStream && !liveStreamInfo?.isHost && (
                  <div
                    className={`local-video-shell ${isDraggingLocalPreview ? 'dragging' : ''}`}
                    onTouchStart={startLocalPreviewDrag}
                    style={{
                      position: 'absolute',
                      left: `${localPreviewPosition.x}px`,
                      top: `${localPreviewPosition.y}px`,
                      width: `${localPreviewSize.width}px`,
                      height: `${localPreviewSize.height}px`
                    }}
                  >
                    <div
                      className="local-video-toolbar"
                      onMouseDown={startLocalPreviewDrag}
                      onTouchStart={startLocalPreviewDrag}
                      title="Drag to move"
                    >
                      <span className="local-video-label">You</span>
                      <div className="local-video-size-controls">
                        <button
                          type="button"
                          className="local-video-size-btn"
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={() => resizeLocalPreview('down')}
                          disabled={localPreviewSizeIndex === 0}
                          title="Smaller"
                        >
                          <Minimize2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="local-video-size-btn"
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={() => resizeLocalPreview('up')}
                          disabled={localPreviewSizeIndex === LOCAL_PREVIEW_SIZES.length - 1}
                          title="Bigger"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>
                    </div>
                    <video
                      key={localStream ? `local-${localStream.id}` : 'local-no-stream'}
                      ref={setLocalVideoElement}
                      autoPlay
                      playsInline
                      muted
                      className="local-video"
                    />
                  </div>
                )}

                {/* Call Info Overlay */}
                <div className="call-info-overlay">
                  <div className="call-info-top">
                    <div className="call-peer-name">
                      {callPeer.username}
                      {remoteIsScreenSharing && (
                        <span className="screen-share-badge">📺 Sharing Screen</span>
                      )}
                    </div>
                    {isScreenSharing && (
                      <div className="local-screen-share-indicator">
                        <span className="screen-share-pulse"></span>
                        You are sharing your screen
                      </div>
                    )}
                  </div>
                  <div className="call-duration">{formatCallDuration(callDuration)}</div>
                  <div className="call-status-badges">
                    <span className={`call-status-badge ${reconnectInfo ? 'warning' : ''}`}>
                      {reconnectInfo
                        ? `Reconnecting (${reconnectInfo.attempt}/${reconnectInfo.max})`
                        : (callState === 'active' ? 'Connected' : 'Connecting')}
                    </span>
                    {livestreamSourceLabel && (
                      <span className="call-status-badge">SOURCE: {livestreamSourceLabel}</span>
                    )}
                    {liveStreamInfo && (
                      <span className={`call-status-badge ${livestreamAudioEnabled ? '' : 'warning'}`}>
                        AUDIO: {livestreamAudioEnabled ? 'ON' : 'OFF'}
                      </span>
                    )}
                    {liveStreamInfo && !liveStreamInfo.isHost && liveStreamInfo.autoJoined && (
                      <span className="call-status-badge">AUTO</span>
                    )}
                    {reconnectInfo && Number.isFinite(reconnectInfo.secondsLeft) && (
                      <span className="reconnect-countdown-badge">
                        Retry in {reconnectInfo.secondsLeft}s
                      </span>
                    )}
                    {connectionQuality && (
                      <span className={`quality-badge quality-${connectionQuality.toLowerCase()}`}>
                        {connectionQuality}
                      </span>
                    )}
                  </div>
                </div>

                {/* Call Controls */}
                {liveStreamInfo && (
                  <div className="livestream-comments-panel enhanced-responsive">
                    <div className="livestream-comments-list">
                      {livestreamComments.length === 0 ? (
                        <div className="livestream-comments-empty">Audience comments will appear here</div>
                      ) : (
                        livestreamComments.slice(-6).map((entry) => (
                          <div key={entry.id} className={`livestream-comment-item ${entry.type === 'reaction' ? 'reaction' : ''}`}>
                            <span className="livestream-comment-avatar" style={getAvatarStyle(entry.from)}>{getInitials(entry.from)}</span>
                            <span className="livestream-comment-author">{entry.from}</span>
                            {entry.type === 'reaction' ? (
                              <span className="livestream-comment-text livestream-reaction-badge">{entry.emoji}</span>
                            ) : (
                              <span className="livestream-comment-text">{entry.text}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="livestream-comment-actions">
                      <div className="livestream-reaction-buttons" role="group" aria-label="Quick reactions">
                        {LIVESTREAM_REACTIONS.map((emoji) => (
                          <button
                            key={`live-reaction-${emoji}`}
                            type="button"
                            className="livestream-reaction-btn"
                            onClick={() => sendLivestreamReaction(emoji)}
                            title={`React ${emoji}`}
                            aria-label={`React ${emoji}`}
                            tabIndex={0}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="livestream-comment-input-row">
                        <input
                          type="text"
                          className="livestream-comment-input"
                          value={livestreamCommentInput}
                          onChange={(event) => setLivestreamCommentInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              sendLivestreamComment();
                            }
                          }}
                          maxLength={300}
                          placeholder="Comment while watching..."
                          aria-label="Comment while watching"
                        />
                        <button
                          type="button"
                          className="livestream-comment-send"
                          onClick={sendLivestreamComment}
                          disabled={!livestreamCommentInput.trim()}
                          title="Send comment"
                          aria-label="Send comment"
                          tabIndex={0}
                        >
                          <Send size={16} />
                        </button>
                        <button
                          type="button"
                          className="livestream-emoji-picker-btn"
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          title="Pick emoji"
                          aria-label="Pick emoji"
                        >
                          <Smile size={18} />
                        </button>
                        {showEmojiPicker && (
                          <div className="livestream-emoji-picker-popup">
                            <EmojiPicker
                              onEmojiClick={(emojiObj) => {
                                setLivestreamCommentInput((prev) => prev + emojiObj.emoji);
                                setShowEmojiPicker(false);
                              }}
                              theme="dark"
                              width={320}
                              height={350}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile: Modern Top-Right Menu for Streaming Controls */}
                <div className="stream-mobile-menu-container">
                  <button
                    className="stream-mobile-menu-btn"
                    aria-label="Open stream controls"
                    onClick={() => setShowMobileMenu((prev) => !prev)}
                  >
                    <Menu size={32} />
                  </button>
                  {showMobileMenu && (
                    <div className="stream-mobile-menu-dropdown">
                      <button
                        className={`stream-mobile-menu-item${isMuted ? ' active' : ''}`}
                        onClick={() => { toggleMute(); setShowMobileMenu(false); }}
                      >
                        {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />} {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      {callType === 'video' && (
                        <button
                          className={`stream-mobile-menu-item${isVideoOff ? ' active' : ''}`}
                          onClick={() => { toggleVideo(); setShowMobileMenu(false); }}
                        >
                          {isVideoOff ? <VideoOff size={22} /> : <Camera size={22} />} {isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                        </button>
                      )}
                      {callType === 'video' && (
                        <button
                          className={`stream-mobile-menu-item${isScreenSharing ? ' active' : ''}`}
                          onClick={() => { toggleScreenShare(); setShowMobileMenu(false); }}
                        >
                          <Monitor size={22} /> {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                        </button>
                      )}
                      <button
                        className="stream-mobile-menu-item end"
                        onClick={() => { endCall(); setShowMobileMenu(false); }}
                      >
                        <PhoneOff size={22} /> End Call
                      </button>
                      <button
                        className="stream-mobile-menu-item minimize"
                        onClick={() => { toggleCallMinimize(); setShowMobileMenu(false); }}
                      >
                        <Minimize2 size={22} /> Minimize
                      </button>
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {callError && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(244, 67, 54, 0.9)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    zIndex: 30,
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {callError}
                  </div>
                )}
              </div>
            )}
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
                <LogOut size={48} color="var(--warning, #ff9800)" />
              </div>
              <h3>Logout?</h3>
              <p>You'll be signed out as <strong>{username}</strong> and your session will end. Messages are still saved.</p>
              <div className="delete-modal-footer">
                <button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)} type="button">Stay</button>
                <button
                  className="btn-delete"
                  style={{ background: 'var(--warning, #ff9800)' }}
                  onClick={performLogout}
                  type="button"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Enable Hot Module Replacement for instant updates during development
if (module.hot) {
  module.hot.accept();
  console.log('🔥 HMR: App component updated');
}
v
export default App;
