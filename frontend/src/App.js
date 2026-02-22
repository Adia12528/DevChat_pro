import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff, Users } from 'lucide-react';
import './App.css';

export default function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);

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
    });
    newSocket.on("chat_cleared", () => {
      console.log("🗑️ Chat cleared");
      setChat([]);
    });
    
    // New feature: Users list
    newSocket.on("users_updated", (usersList) => {
      console.log("👥 Users updated:", usersList);
      setUsers(usersList);
    });
    
    // New feature: Typing indicator
    newSocket.on("user_typing", (data) => {
      setTypingUsers(prev => {
        const updated = { ...prev };
        if (data.isTyping) {
          updated[data.username] = true;
        } else {
          delete updated[data.username];
        }
        return updated;
      });
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("load_history");
      newSocket.off("receive_message");
      newSocket.off("chat_cleared");
      newSocket.off("users_updated");
      newSocket.off("user_typing");
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const joinRoom = () => { 
    if (username && room && socketRef.current) { 
      console.log(`🚪 Joining room: ${room} as ${username}`);
      setChat([]); // Clear previous messages
      setUsers([]); // Clear users list
      setTypingUsers({}); // Clear typing indicators
      socketRef.current.emit("join_room", { room, username }); 
      setShowChat(true); 
    } 
  };

  const handleMessageInput = (e) => {
    setMessage(e.target.value);
    
    // Send typing indicator
    if (socketRef.current && room) {
      socketRef.current.emit("typing", {
        room,
        sender: username,
        isTyping: true
      });
      
      // Clear previous timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit("typing", {
          room,
          sender: username,
          isTyping: false
        });
      }, 1000);
    }
  };

  const sendMessage = () => {
    if (message.trim() && connected && socketRef.current) {
      socketRef.current.emit("send_message", { room, sender: username, text: message });
      setMessage("");
      
      // Clear typing indicator
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketRef.current.emit("typing", {
        room,
        sender: username,
        isTyping: false
      });
    }
  };

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
        <div className="users-badge">
          <Users size={14}/> {users.length}
        </div>
        <button className="clear-btn" onClick={() => socketRef.current?.emit("clear_chat", room)}><Trash2 size={20}/></button>
      </div>
      
      <div className="users-list">
        <AnimatePresence>
          {users.map((u, i) => (
            <motion.span key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="user-badge">
              {u}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      
      <div className="chat-body">
        <AnimatePresence>
          {chat.map((m, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`msg-bubble ${m.sender === username ? "me" : "other"}`}>
              {m.sender !== username && <span className="sender-tag">{m.sender}</span>}
              {m.type === 'image' ? <img src={m.text} className="chat-img" alt="shared"/> : <p>{m.text}</p>}
              <span className="timestamp">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        
        <AnimatePresence>
          {Object.keys(typingUsers).length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="typing-indicator">
              <span className="dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
              {Object.keys(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing
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
          onChange={handleMessageInput} 
          onKeyPress={e => e.key === 'Enter' && sendMessage()} 
        />
        <button className="send-btn" onClick={sendMessage} disabled={!connected}><Send size={20}/></button>
      </div>
    </div>
  );
}