import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users, Search, Copy, CheckCircle } from 'lucide-react';
import './App.css';
import { formatRelativeTime, playNotificationSound, copyToClipboard } from './utils';

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
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);

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

    newSocket.on("user_typing", (data) => {
      setTypingUsers((prev) => new Set([...prev, data.username]));
    });

    newSocket.on("user_stopped_typing", (username) => {
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(username);
        return updated;
      });
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
      newSocket.disconnect();
    };
  }, []);

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
    setMessage(e.target.value);
    
    if (socketRef.current && connected) {
      socketRef.current.emit("typing", { room, username });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit("stop_typing", { room, username });
      }, 1000);
    }
  }, [connected, room, username]);

  const sendMessage = useCallback(() => {
    if (message.trim() && connected && socketRef.current) {
      socketRef.current.emit("send_message", { room, sender: username, text: message });
      setMessage("");
      socketRef.current.emit("stop_typing", { room, username });
    }
  }, [message, connected, room, username]);

  const handleCopyMessage = useCallback((text, msgId) => {
    copyToClipboard(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

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
          <Users size={16}/> {onlineUsers.length}
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
            <motion.span key={i} className="user-tag" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              {user}
            </motion.span>
          ))}
        </div>
      )}

      <div className="chat-body">
        <AnimatePresence>
          {filteredChat.map((m, i) => {
            const msgId = `${i}-${m.time}`;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                key={i} 
                className={`msg-bubble ${m.sender === username ? "me" : "other"}`}
              >
                {m.sender !== username && <span className="sender-tag">{m.sender}</span>}
                {m.type === 'image' ? <img src={m.text} className="chat-img" alt="shared"/> : <p>{m.text}</p>}
                <div className="msg-footer">
                  <span className="timestamp" title={new Date(m.time).toLocaleString()}>
                    {formatRelativeTime(m.time)}
                  </span>
                  <button 
                    className={`copy-btn ${copiedMsgId === msgId ? 'copied' : ''}`}
                    onClick={() => handleCopyMessage(m.text, msgId)}
                    title="Copy message"
                  >
                    {copiedMsgId === msgId ? <CheckCircle size={14}/> : <Copy size={14}/>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {typingUsers.size > 0 && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="typing-indicator">
              <span className="typing-text">{Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing</span>
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
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
    </div>
  );
}