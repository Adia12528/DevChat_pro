import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff } from 'lucide-react';
import './App.css';

// 🔌 Optimized Socket Connection
const socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:5000", {
    reconnectionAttempts: 5,
    transports: ['websocket']
});

export default function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("load_history", (data) => setChat(data));
    socket.on("receive_message", (data) => setChat((prev) => [...prev, data]));
    socket.on("chat_cleared", () => setChat([]));

    return () => {
        socket.off("connect");
        socket.off("disconnect");
        socket.off("receive_message");
    };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const joinRoom = () => { if (username && room) { socket.emit("join_room", { room }); setShowChat(true); } };
  
  const sendMessage = () => {
    if (message.trim() && isConnected) {
      socket.emit("send_message", { room, sender: username, text: message });
      setMessage("");
    }
  };

  if (!showChat) return (
    <div className="login-screen">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="login-card">
        <Zap color="#00a884" size={48} fill="#00a884" />
        <h2 className="title">DevChat <span>Pro</span></h2>
        <div className="input-group"><User size={18}/><input placeholder="Username" onChange={e => setUsername(e.target.value)} /></div>
        <div className="input-group"><Hash size={18}/><input placeholder="Room ID" onChange={e => setRoom(e.target.value)} /></div>
        <button className="join-btn" onClick={joinRoom}>Start Chatting</button>
      </motion.div>
    </div>
  );

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-meta">
            <h3>{room}</h3>
            <span className={isConnected ? "online" : "offline"}>
                {isConnected ? <Wifi size={12}/> : <WifiOff size={12}/>}
                {isConnected ? "Connected" : "Reconnecting..."}
            </span>
        </div>
        <button className="clear-btn" onClick={() => socket.emit("clear_chat", room)}><Trash2 size={20}/></button>
      </div>

      <div className="chat-body">
        <AnimatePresence initial={false}>
          {chat.map((m, i) => (
            <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                key={m._id || i} 
                className={`msg-bubble ${m.sender === username ? "me" : "other"}`}
            >
              {m.sender !== username && <span className="sender-tag">{m.sender}</span>}
              {m.type === 'image' ? (
                <img src={m.text} alt="shared" className="shared-img" />
              ) : (
                <p>{m.text}</p>
              )}
              <span className="timestamp">{new Date(m.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      <div className="chat-footer">
        <div className={`input-area ${!isConnected ? "disabled" : ""}`}>
          <input 
            disabled={!isConnected}
            value={message} 
            placeholder={isConnected ? "Message..." : "Waiting for connection..."} 
            onChange={e => setMessage(e.target.value)} 
            onKeyPress={e => e.key === 'Enter' && sendMessage()} 
          />
          <button className="send-btn" onClick={sendMessage}><Send size={20}/></button>
        </div>
      </div>
    </div>
  );
}