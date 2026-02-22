import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle, Edit2, X, AlertCircle, Smile, Image as ImageIcon, Pin, Download, Moon, Sun, AtSign, Reply, Eye, EyeOff } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';
import { formatRelativeTime, playNotificationSound, copyToClipboard, getUserColor, getInitials, getAvatarStyle, detectLinks, extractMentions } from './utils';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🤔', '👏'];

export default function App() {
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
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const audioRef = useRef(null);
  const usernameRef = useRef("");
  const roomRef = useRef("");
  const soundEnabledRef = useRef(true);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

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
      setChat((prev) => [...prev, data]);
      removeTypingUser(data.sender);
      
      if (!isAtBottom && data.sender !== usernameRef.current) {
        setUnreadCount(c => c + 1);
      }
      
      if (soundEnabledRef.current && data.sender !== usernameRef.current) {
        try {
          if (!audioContextRef.current)
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          playNotificationSound(audioContextRef.current);
        } catch (_) {}
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

    return () => {
      newSocket.disconnect();
      typingTimersRef.current.forEach(id => clearTimeout(id));
      typingTimersRef.current.clear();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'devchat_uploads'); // You'll need to configure Cloudinary
    
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      socketRef.current.emit("send_message", { 
        room: roomRef.current, 
        sender: usernameRef.current, 
        text: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        fileUrl: data.secure_url,
        fileName: file.name,
        fileSize: file.size
      });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('File upload failed. Please try again.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice-message.webm');
        formData.append('upload_preset', 'devchat_uploads');
        
        try {
          const res = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          
          socketRef.current.emit("send_message", {
            room: roomRef.current,
            sender: usernameRef.current,
            text: 'Voice message',
            type: 'voice',
            fileUrl: data.secure_url,
            duration: recordingTime
          });
        } catch (error) {
          console.error('Voice upload failed:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Microphone access denied');
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
        <button 
          className="sidebar-toggle"
          onClick={() => setShowRoomSidebar(true)}
          title="Show conversations"
        >
          ☰
        </button>
        <div className="meta">
          <h3>{room}</h3>
          <span className={connected ? "status-on" : "status-off"}>
            {connected ? <Wifi size={12}/> : <WifiOff size={12}/>} {connected ? "Online" : "Disconnected"}
          </span>
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
        <button className="export-btn" onClick={exportChat} title="Export chat"><Download size={18}/></button>
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
          {onlineUsers.map((user, i) => (
            <motion.div 
              key={i} 
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
                  <img src={m.fileUrl || m.text} className="chat-img" alt="shared" />
                ) : m.type === 'file' ? (
                  <a href={m.fileUrl} download={m.fileName} className="file-link">
                    📎 {m.fileName} ({(m.fileSize / 1024).toFixed(1)} KB)
                  </a>
                ) : m.type === 'voice' ? (
                  <div className="voice-message">
                    <button 
                      className="voice-play-btn"
                      onClick={() => playVoiceMessage(m.fileUrl, m._id)}
                    >
                      {playingVoiceId === m._id ? '⏸️' : '▶️'}
                    </button>
                    <div className="voice-waveform">
                      <span className="voice-duration">{m.duration || 0}s</span>
                    </div>
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
                  <div className="msg-actions">
                    <div className="quick-reactions">
                      {QUICK_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          className="quick-reaction-btn"
                          onClick={() => handleReaction(m._id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button 
                      className={`copy-btn ${copiedMsgId === msgId ? 'copied' : ''} ${isMobile ? 'mobile-visible' : ''}`}
                      onClick={() => handleCopyMessage(m.text, msgId)}
                      title="Copy message"
                      type="button"
                    >
                      {copiedMsgId === msgId ? <CheckCircle size={isMobile ? 16 : 14}/> : <Copy size={isMobile ? 16 : 14}/>}
                    </button>
                    <button
                      className="reply-btn"
                      onClick={() => setReplyingTo(m)}
                      title="Reply"
                      type="button"
                    >
                      <Reply size={14}/>
                    </button>
                    <button
                      className="pin-btn"
                      onClick={() => togglePin(m._id, m.isPinned)}
                      title={m.isPinned ? "Unpin" : "Pin"}
                      type="button"
                    >
                      <Pin size={14}/>
                    </button>
                    {isOwn && (
                      <>
                        <button 
                          className="edit-btn"
                          onClick={() => startEditMessage(m._id, m.text)}
                          title="Edit message"
                          type="button"
                        >
                          <Edit2 size={14}/>
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteMessage(m._id)}
                          title="Delete message"
                          type="button"
                        >
                          <X size={14}/>
                        </button>
                      </>
                    )}
                  </div>
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
        <button className="send-btn" onClick={sendMessage} disabled={!connected}><Send size={20}/></button>
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
    </div>
  );
}
