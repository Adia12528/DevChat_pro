import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle, Edit2, X, AlertCircle, Smile, Image as ImageIcon, Pin, Download, Moon, Sun, AtSign, Reply, Eye, EyeOff, Menu, FileDown, Smartphone, LogOut } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';
import { formatRelativeTime, playNotificationSound, copyToClipboard, getUserColor, getInitials, getAvatarStyle, detectLinks, extractMentions } from './utils';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🤔', '👏'];
const APP_VERSION = 'v2.7.0-menu-actions'; // Version identifier for deployment verification

console.log('🚀 DevChat Pro Version:', APP_VERSION);
console.log('🔍 Build Date:', new Date().toISOString());
console.log('✅ Context Menu Features: ENABLED');

function App() {
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
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New feature states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
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
  
  // Private chat/DM states
  const [showRoomSidebar, setShowRoomSidebar] = useState(false);
  const [rooms, setRooms] = useState([{ id: room, name: room, type: 'group' }]);
  const [activeRoom, setActiveRoom] = useState(null);
  
  // Profile editing
  const [editingOwnProfile, setEditingOwnProfile] = useState(false);
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  
  // PWA Install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  
  // Menu dropdown state
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuMessage, setContextMenuMessage] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  
  // Media viewer states
  const [imageViewer, setImageViewer] = useState(null); // { url, fileName, sender, time }
  const [voicePlayer, setVoicePlayer] = useState(null); // { url, fileName, sender, time, duration }
  
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
  const contextMenuRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const audioRef = useRef(null);
  const usernameRef = useRef("");
  const roomRef = useRef("");
  const soundEnabledRef = useRef(true);
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [showChat]);

  // PWA Install prompt handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
    const BACKEND_URL = isProduction ? "https://devchat-pro.onrender.com" : "http://localhost:5000";
    
    if (isProduction) fetch(BACKEND_URL + "/ping").catch(() => {});

    const newSocket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        upgrade: true,
        rejectUnauthorized: false
    });
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("✅ Connected to server, id:", newSocket.id);
      setConnected(true);
      if (roomRef.current && usernameRef.current) {
        console.log("🔄 Re-joining room after reconnect:", roomRef.current);
        newSocket.emit("join_room", { room: roomRef.current, username: usernameRef.current });
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
      console.log("💬 Received message:", data);
      
      // Prevent duplicate messages
      if (lastMessageIdRef.current === data._id) return;
      lastMessageIdRef.current = data._id;
      
      setChat((prev) => {
        // Double-check for duplicates in array
        if (prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
      removeTypingUser(data.sender);
      
      if (!isAtBottomRef.current && data.sender !== usernameRef.current) {
        setUnreadCount(c => c + 1);
      }
      
      if (soundEnabledRef.current && data.sender !== usernameRef.current) {
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
      setOnlineUsers(Array.isArray(data.users) ? data.users : []);
    });

    newSocket.on("user_left", (data) => {
      console.log("👤 User left:", data.username);
      if (Array.isArray(data.users)) {
        setOnlineUsers(data.users);
      } else {
        setOnlineUsers((prev) => prev.filter(u => u !== data.username));
      }
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
          return { ...m, readBy: [...(m.readBy || []), data.username] };
        }
        return m;
      }));
    });

    newSocket.on("user_status_changed", (data) => {
      setUserStatus(prev => ({ ...prev, [data.username]: data.status }));
    });

    newSocket.on("profile_updated", (data) => {
      setUserProfiles(prev => ({ ...prev, [data.username]: { avatar: data.avatar, bio: data.bio } }));
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
      
      if (newSocket.connected) {
        newSocket.emit('user_leaving', { username: usernameRef.current, room: roomRef.current });
      }
      newSocket.disconnect();
      
      typingTimersRef.current.forEach(id => clearTimeout(id));
      typingTimersRef.current.clear();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
          const stream = mediaRecorderRef.current.stream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      }
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
    if (!debouncedSearchQuery) return chat;
    return chat.filter(msg => 
      msg.text.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      msg.sender.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [chat, debouncedSearchQuery]);

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
      setTypingUsers(new Set());
      setSearchQuery("");
      setDebouncedSearchQuery("");
      socketRef.current.emit("join_room", { room, username }); 
      socketRef.current.emit("update_status", { username, status: 'online' });
      setShowChat(true); 
    } 
  }, [username, room]);

  const handleMessageChange = useCallback((e) => {
    setMessage(e.target.value);
    const socket = socketRef.current;
    if (!socket || !connected) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1500) {
      socket.emit("typing", { room: roomRef.current, username: usernameRef.current });
      lastTypingEmitRef.current = now;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { room: roomRef.current, username: usernameRef.current });
      typingTimeoutRef.current = null;
    }, 3000);
  }, [connected]);

  const sendMessage = useCallback(() => {
    const text = message.trim();
    if (!text || !connected || !socketRef.current) return;
    
    const mentions = extractMentions(text);
    const messageData = { 
      room: roomRef.current, 
      sender: usernameRef.current, 
      text,
      mentions,
      replyTo: replyingTo?._id || null
    };
    
    socketRef.current.emit("send_message", messageData);
    setMessage("");
    setReplyingTo(null);
    if (typingTimeoutRef.current) { 
      clearTimeout(typingTimeoutRef.current); 
      typingTimeoutRef.current = null; 
    }
    socketRef.current.emit("stop_typing", { room: roomRef.current, username: usernameRef.current });
  }, [message, connected, replyingTo]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage('File too large! Maximum size is 10MB.');
      setTimeout(() => setErrorMessage(''), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 
                          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('File type not supported. Use images, PDFs, or Word documents.');
      setTimeout(() => setErrorMessage(''), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
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
        
        if (!res.ok) throw new Error('Upload failed with status ' + res.status);
        
        const data = await res.json();
        
        if (data.error) throw new Error(data.error.message);
        
        socketRef.current?.emit("send_message", { 
          room: roomRef.current, 
          sender: usernameRef.current, 
          text: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          fileUrl: data.secure_url,
          fileName: file.name,
          fileSize: file.size
        });
        
        setSuccessMessage('File uploaded successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        break; // Success, exit loop
      } catch (error) {
        console.error('Upload attempt failed:', error);
        retries--;
        if (retries === 0) {
          setErrorMessage('Upload failed after 3 attempts. Check your connection.');
          setTimeout(() => setErrorMessage(''), 5000);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
    }
    
    setUploadingFile(false);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    
    e.preventDefault();
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
        e.preventDefault();
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

  const handleContextMenuAction = useCallback((action) => {
    if (!contextMenuMessage) return;
    
    switch(action) {
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
      default:
        break;
    }
    closeContextMenu();
  }, [contextMenuMessage, handleCopyMessage, startEditMessage, deleteMessage, togglePin, closeContextMenu]);

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
      setErrorMessage('Voice recording not supported in this browser.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Check size (5MB max for voice)
        if (audioBlob.size > 5 * 1024 * 1024) {
          setErrorMessage('Voice message too long. Maximum 5MB.');
          setTimeout(() => setErrorMessage(''), 4000);
          return;
        }
        
        setUploadingFile(true);
        setUploadProgress('Uploading voice message...');
        
        // Upload to Cloudinary with retry
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice-message.webm');
        formData.append('upload_preset', 'devchat_uploads');
        
        let retries = 3;
        while (retries > 0) {
          try {
            const res = await fetch('https://api.cloudinary.com/v1_1/da03qqo5g/auto/upload', {
              method: 'POST',
              body: formData
            });
            
            if (!res.ok) throw new Error('Upload failed');
            
            const data = await res.json();
            
            if (data.error) throw new Error(data.error.message);
            
            socketRef.current?.emit("send_message", {
              room: roomRef.current,
              sender: usernameRef.current,
              text: 'Voice message',
              type: 'voice',
              fileUrl: data.secure_url,
              duration: recordingTime
            });
            
            setSuccessMessage('Voice message sent!');
            setTimeout(() => setSuccessMessage(''), 2000);
            break;
          } catch (error) {
            console.error('Voice upload attempt failed:', error);
            retries--;
            if (retries === 0) {
              setErrorMessage('Failed to send voice message. Try again.');
              setTimeout(() => setErrorMessage(''), 4000);
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        setUploadingFile(false);
        setUploadProgress('');
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setErrorMessage('Recording failed. Please try again.');
        setTimeout(() => setErrorMessage(''), 4000);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => {
          // Auto-stop at 2 minutes
          if (t >= 120) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return 120;
          }
          return t + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
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

  const playVoiceMessage = useCallback((audioUrl, msgId) => {
    if (playingVoiceId === msgId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play();
      setPlayingVoiceId(msgId);
      audio.onended = () => setPlayingVoiceId(null);
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
    const dmRoom = [username, targetUser].sort().join('_dm_');
    const existingRoom = rooms.find(r => r.id === dmRoom);
    if (!existingRoom) {
      setRooms(prev => [...prev, { id: dmRoom, name: targetUser, type: 'dm', with: targetUser }]);
    }
    setActiveRoom(dmRoom);
    socketRef.current.emit("join_room", { room: dmRoom, username: usernameRef.current });
    setRoom(dmRoom);
    setShowProfileModal(null);
  }, [username, rooms]);

  const switchRoom = useCallback((roomId) => {
    setActiveRoom(roomId);
    setRoom(roomId);
    socketRef.current.emit("join_room", { room: roomId, username: usernameRef.current });
    setChat([]);
    setShowRoomSidebar(false);
  }, []);

  const saveProfile = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('update_profile', {
        username: usernameRef.current,
        avatar: profileAvatar,
        bio: profileBio
      });
      setEditingOwnProfile(false);
    }
  }, [profileAvatar, profileBio]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ App installed');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }, [deferredPrompt]);

  const handleLogout = useCallback(() => {
    // Confirm logout
    if (window.confirm('Are you sure you want to logout?')) {
      console.log('🚪 Logging out...');
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.emit('update_status', { username: usernameRef.current, status: 'offline' });
        socketRef.current.emit('leave_room', { room: roomRef.current, username: usernameRef.current });
        socketRef.current.disconnect();
      }
      
      // Clear session data (sessionStorage clears automatically on browser close)
      sessionStorage.removeItem('chatUsername');
      sessionStorage.removeItem('chatRoom');
      
      // Reset state
      setUsername('');
      setRoom('');
      setShowChat(false);
      setChat([]);
      setOnlineUsers([]);
      setTypingUsers(new Set());
      setConnected(false);
      setMessage('');
      setSearchQuery('');
      setShowMenuDropdown(false);
      
      console.log('✅ Logged out successfully');
    }
  }, []);

  if (!showChat) return (
    <div className="login-screen">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="login-card">
        <Zap color="#00a884" size={48} fill="#00a884" />
        <h2 className="brand">DevChat <span>Pro+</span></h2>
        <div className="input-group"><User size={18}/><input placeholder="Name" onChange={e => setUsername(e.target.value)} /></div>
        <div className="input-group"><Hash size={18}/><input placeholder="Room ID" onChange={e => setRoom(e.target.value)} /></div>
        <button className="join-btn" onClick={joinRoom}>Enter Chat</button>
      </motion.div>
    </div>
  );

  return (
    <div className="chat-container">
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
        <div className="menu-container">
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
                  className="menu-dropdown"
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
                  
                  {deferredPrompt && (
                    <button 
                      className="menu-item"
                      onClick={() => {
                        handleInstallClick();
                        setShowMenuDropdown(false);
                      }}
                    >
                      <Smartphone size={18}/>
                      <span>Install as App</span>
                    </button>
                  )}
                  
                  <div className="menu-divider"></div>
                  
                  <button 
                    className="menu-item"
                    onClick={() => {
                      setShowRoomSidebar(true);
                      setShowMenuDropdown(false);
                    }}
                  >
                    <Users size={18}/>
                    <span>Conversations</span>
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
                  
                  <div className="menu-footer">Session ends when browser closes</div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        
        <div className="meta">
          <h3>{room} <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: 'normal' }}>{APP_VERSION}</span></h3>
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
        <div className="users-info">
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
          title={soundEnabled ? "Sound on" : "Sound off"}
        >
          🔔
        </button>
        <button className="clear-btn" onClick={() => socketRef.current?.emit("clear_chat", roomRef.current)}><Trash2 size={18}/></button>
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
        <button 
          className="markdown-toggle"
          onClick={() => setShowMarkdown(!showMarkdown)}
          title={showMarkdown ? "Disable markdown" : "Enable markdown"}
        >
          {showMarkdown ? <Eye size={18}/> : <EyeOff size={18}/>}
        </button>
      </div>

      {pinnedMessages.length > 0 && (
        <div className="pinned-messages-bar">
          <Pin size={14} />
          <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {onlineUsers.length > 0 && (
        <div className="users-list">
          {onlineUsers.map((user) => (
            <motion.div 
              key={user} 
              className="user-tag" 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setShowProfileModal(user)}
            >
              <div style={getAvatarStyle(user)}>
                {getInitials(user)}
              </div>
              <span className="user-tag-name">{user}</span>
              {typingUsers.has(user) && <span className="user-typing-dot"></span>}
              <span className={`user-status-dot status-${userStatus[user] || 'online'}`}></span>
            </motion.div>
          ))}
        </div>
      )}

      <div className="chat-body" ref={chatBodyRef}>
        <AnimatePresence>
          {filteredChat.map((m, i) => {
            const msgId = `${i}-${m.time}`;
            const isOwn = m.sender === username;
            const reactions = m.reactions || {};
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                key={i} 
                className={`msg-bubble ${isOwn ? "me" : "other"} ${m.isPinned ? "pinned" : ""}`}
                onContextMenu={(e) => handleContextMenu(e, m)}
                onTouchStart={(e) => handleLongPressStart(e, m)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {m.isPinned && <Pin size={12} className="pin-icon" />}
                {m.sender !== username && <span className="sender-tag">{m.sender}</span>}
                
                {m.replyTo && (
                  <div className="reply-preview">
                    <Reply size={12} />
                    <span>Replying to message</span>
                  </div>
                )}
                
                {m.type === 'image' ? (
                  <div className="image-message-wrapper">
                    <div 
                      className="image-container" 
                      onClick={() => openImageViewer({
                        url: m.fileUrl || m.text,
                        fileName: `image-${new Date(m.time).getTime()}.jpg`,
                        sender: m.sender,
                        time: m.time
                      })}
                      onContextMenu={(e) => {
                        // Allow native right-click on images
                        e.stopPropagation();
                      }}
                    >
                      <img 
                        src={m.fileUrl || m.text} 
                        className="chat-img" 
                        alt="shared"
                        onError={(e) => {
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
                  </div>
                ) : m.type === 'file' ? (
                  <a href={m.fileUrl} download={m.fileName} className="file-link">
                    📎 {m.fileName} ({(m.fileSize / 1024).toFixed(1)} KB)
                  </a>
                ) : m.type === 'voice' ? (
                  <div className="voice-message-wrapper">
                    <div 
                      className="voice-message" 
                      onClick={() => openVoicePlayer({
                        url: m.fileUrl,
                        fileName: `voice-${new Date(m.time).getTime()}.webm`,
                        sender: m.sender,
                        time: m.time,
                        duration: m.duration || 0
                      })}
                    >
                      <button 
                        className="voice-play-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          playVoiceMessage(m.fileUrl, m._id);
                        }}
                        title={playingVoiceId === m._id ? 'Pause' : 'Play'}
                      >
                        {playingVoiceId === m._id ? '⏸️' : '▶️'}
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
                      >
                        {emoji} {users.length}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="msg-footer">
                  <span className="timestamp" title={new Date(m.time).toLocaleString()}>
                    {formatRelativeTime(m.time)}
                  </span>
                  {m.readBy && m.readBy.length > 0 && (
                    <span className="read-receipt" title={`Read by: ${m.readBy.join(', ')}`}>
                      <CheckCircle size={10} /> {m.readBy.length}
                    </span>
                  )}
                </div>
              </motion.div>
            );
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
          onClick={() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" })}
        >
          {unreadCount} new message{unreadCount > 1 ? 's' : ''}
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

      <div className="chat-footer">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept="image/*,application/pdf,.doc,.docx"
        />
        <button
          className="file-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!connected || uploadingFile}
        >
          <ImageIcon size={20} />
        </button>
        <button
          className={`voice-record-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
          disabled={!connected}
          title={isRecording ? `Recording: ${recordingTime}s` : 'Record voice message'}
        >
          {isRecording ? `🔴 ${recordingTime}s` : '🎤'}
        </button>
        <button
          className="emoji-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={!connected}
        >
          <Smile size={20} />
        </button>
        <input 
          disabled={!connected}
          value={message} 
          placeholder={connected ? "Type a message..." : "Connecting to server..."} 
          onChange={handleMessageChange} 
          onKeyPress={e => e.key === 'Enter' && sendMessage()} 
        />
        <button className="send-btn" onClick={sendMessage} disabled={!connected || sendingMessage}>
          {sendingMessage ? <div className="spinner-small"></div> : <Send size={20}/>}
        </button>
      </div>

      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker onEmojiClick={handleEmojiClick} theme={theme} />
        </div>
      )}

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
                  <button 
                    className="btn-dm"
                    onClick={() => createDM(showProfileModal)}
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
                {rooms.map(r => (
                  <button
                    key={r.id}
                    className={`room-item ${activeRoom === r.id ? 'active' : ''}`}
                    onClick={() => switchRoom(r.id)}
                  >
                    <div className="room-icon">
                      {r.type === 'dm' ? '💬' : '#'}
                    </div>
                    <span>{r.name}</span>
                  </button>
                ))}
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
                  <X size={16} />
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
                    {playingVoiceId === 'modal' ? '⏸️' : '▶️'}
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
    </div>
  );
}

// Enable Hot Module Replacement for instant updates during development
if (module.hot) {
  module.hot.accept();
  console.log('🔥 HMR: App component updated');
}

export default App;
