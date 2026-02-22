import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle, Edit2, X, AlertCircle } from 'lucide-react';
import './App.css';
import { formatRelativeTime, playNotificationSound, copyToClipboard, getUserColor, getInitials, getAvatarStyle } from './utils';

export default function App() {
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
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const searchTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);

  // Detect mobile and handle resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear all typing timers on unmount
  useEffect(() => {
    return () => {
      typingTimersRef.current.forEach((id) => clearTimeout(id));
      typingTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    // Initialize socket connection with fallback
    const isProduction = window.location.hostname !== 'localhost';
    const BACKEND_URL = isProduction ? "https://devchat-pro.onrender.com" : "http://localhost:5000";
    
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
      console.log("✅ Connected to server");
      setConnected(true);
    });
    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      setConnected(false);
    });
    newSocket.on("connect_error", (error) => {
      console.error("⚠️ Connection error:", error);
      setConnected(false);
    });
    newSocket.on("error", (error) => {
      console.error("⚠️ Socket error:", error);
      setConnected(false);
    });
    newSocket.on("reconnect_attempt", () => {
      console.log("🔄 Attempting to reconnect...");
    });
    newSocket.on("reconnect", () => {
      console.log("✅ Reconnected successfully");
      setConnected(true);
    });
    newSocket.on("load_history", (data) => {
      console.log("📥 Loaded history:", data);
      setChat(Array.isArray(data) ? data : []);
    });
    newSocket.on("receive_message", (data) => {
      console.log("💬 Received message:", data);
      setChat((prev) => [...prev, data]);
      
      // Play notification sound if enabled and not from self (debounced)
      if (soundEnabled && data.sender !== username) {
        try {
          // Reuse audio context for better performance
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          playNotificationSound(audioContextRef.current);
        } catch (err) {
          console.log("Sound notification skipped");
        }
      }
    });
    newSocket.on("chat_cleared", () => {
      console.log("🗑️ Chat cleared");
      setChat([]);
    });

    newSocket.on("user_joined", (data) => {
      console.log("👤 User joined:", data.username);
      setOnlineUsers(data.users || []);
    });

    newSocket.on("user_left", (data) => {
      console.log("👤 User left:", data.username);
      setOnlineUsers((prev) => prev.filter(u => u !== data.username));
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
      if (data.username === username) return; // don't show self typing
      console.log("🎹 User typing:", data.username);
      setTypingUsers((prev) => new Set([...prev, data.username]));
      startTypingTimer(data.username);
    });

    newSocket.on("user_stopped_typing", (stoppedUser) => {
      if (stoppedUser === username) return; // ignore self cleanup
      console.log("⏹️ User stopped typing:", stoppedUser);
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

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("error");
      newSocket.off("reconnect_attempt");
      newSocket.off("reconnect");
      newSocket.off("load_history");
      newSocket.off("receive_message");
      newSocket.off("chat_cleared");
      newSocket.off("user_joined");
      newSocket.off("user_left");
      newSocket.off("user_typing");
      newSocket.off("user_stopped_typing");
      newSocket.off("message_edited");
      newSocket.off("message_deleted");
      
      // Clean up typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Emit stop typing before disconnecting
      newSocket.emit("stop_typing", { room: socketRef.current?.room, username });
      
      newSocket.disconnect();
    };
  }, [username]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, typingUsers]);

  // Debounced search for better performance
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  // Memoized filtered chat to avoid re-filtering on every render
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
      setShowChat(true); 
    } 
  }, [username, room]);

  const handleMessageChange = useCallback((e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    
    if (socketRef.current && connected) {
      // Only emit typing if not already typing (prevent spam)
      if (!typingTimeoutRef.current) {
        console.log("📝 User started typing");
        socketRef.current.emit("typing", { room, username });
      }
      
      // Clear old timeout and set new one
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Set longer timeout (3 seconds) for more natural typing
      typingTimeoutRef.current = setTimeout(() => {
        console.log("⏹️ User stopped typing (timeout)");
        if (socketRef.current) {
          socketRef.current.emit("stop_typing", { room, username });
        }
        typingTimeoutRef.current = null; // Reset flag
      }, 3000);
    }
  }, [connected, room, username]);

  const sendMessage = useCallback(() => {
    if (message.trim() && connected && socketRef.current) {
      console.log("💬 Sending message, clearing typing...");
      socketRef.current.emit("send_message", { room, sender: username, text: message });
      setMessage("");
      
      // Clear typing timeout immediately
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Emit stop typing
      socketRef.current.emit("stop_typing", { room, username });
    }
  }, [message, connected, room, username]);

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
    if (editingText.trim() && socketRef.current && editingMsgId) {
      socketRef.current.emit("edit_message", { 
        messageId: editingMsgId, 
        newText: editingText,
        room,
        sender: username
      });
      setEditingMsgId(null);
      setEditingText("");
    }
  }, [editingMsgId, editingText, room, username]);

  const deleteMessage = useCallback((msgId) => {
    setDeletingMsgId(msgId);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (socketRef.current && deletingMsgId) {
      console.log("🗑️ Deleting message:", deletingMsgId);
      socketRef.current.emit("delete_message", { 
        messageId: deletingMsgId,
        room,
        sender: username
      });
    }
    setShowDeleteConfirm(false);
    setDeletingMsgId(null);
  }, [deletingMsgId, room, username]);

  if (!showChat) return (
    <div className="login-screen">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="login-card">
        <Zap color="#00a884" size={48} fill="#00a884" />
        <h2 className="brand">DevChat <span>Pro</span></h2>
        <div className="input-group"><User size={18}/><input placeholder="Name" onChange={e => setUsername(e.target.value)} /></div>
        <div className="input-group"><Hash size={18}/><input placeholder="Room ID" onChange={e => setRoom(e.target.value)} /></div>
        <button className="join-btn" onClick={joinRoom}>Enter Chat</button>
      </motion.div>
    </div>
  );

  return (
    <div className="chat-container">
      <div className="chat-header">
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
          className={`sound-toggle ${soundEnabled ? 'enabled' : 'disabled'}`}
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Sound on" : "Sound off"}
        >
          🔔
        </button>
        <button className="clear-btn" onClick={() => socketRef.current?.emit("clear_chat", room)}><Trash2 size={20}/></button>
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
      </div>

      {onlineUsers.length > 0 && (
        <div className="users-list">
          {onlineUsers.map((user, i) => (
            <motion.div key={i} className="user-tag" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={getAvatarStyle(user)}>
                {getInitials(user)}
              </div>
              <span className="user-tag-name">{user}</span>
              {typingUsers.has(user) && <span className="user-typing-dot"></span>}
            </motion.div>
          ))}
        </div>
      )}

      <div className="chat-body">
        <AnimatePresence>
          {filteredChat.map((m, i) => {
            const msgId = `${i}-${m.time}`;
            const isOwn = m.sender === username;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                key={i} 
                className={`msg-bubble ${isOwn ? "me" : "other"}`}
              >
                {m.sender !== username && <span className="sender-tag">{m.sender}</span>}
                {m.type === 'image' ? <img src={m.text} className="chat-img" alt="shared"/> : <p>{m.text}</p>}
                {m.edited && <span className="msg-edited">(edited)</span>}
                <div className="msg-footer">
                  <span className="timestamp" title={new Date(m.time).toLocaleString()}>
                    {formatRelativeTime(m.time)}
                  </span>
                  <div className="msg-actions">
                    <button 
                      className={`copy-btn ${copiedMsgId === msgId ? 'copied' : ''} ${isMobile ? 'mobile-visible' : ''}`}
                      onClick={() => handleCopyMessage(m.text, msgId)}
                      title="Copy message"
                      type="button"
                    >
                      {copiedMsgId === msgId ? <CheckCircle size={isMobile ? 16 : 14}/> : <Copy size={isMobile ? 16 : 14}/>}
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
      <div className="chat-footer">
        <input 
          disabled={!connected}
          value={message} 
          placeholder={connected ? "Type a message..." : "Connecting to server..."} 
          onChange={handleMessageChange} 
          onKeyPress={e => e.key === 'Enter' && sendMessage()} 
        />
        <button className="send-btn" onClick={sendMessage} disabled={!connected}><Send size={20}/></button>
      </div>

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
    </div>
  );
}