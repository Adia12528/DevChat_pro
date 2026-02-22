import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Wifi, WifiOff } from 'lucide-react';
import './App.css';

// 🔌 Connection Hack: Force WebSocket only
const socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:5000", {
    transports: ['websocket'],
    upgrade: false
});

export default function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHistory = (data) => setChat(data);
    const onMessage = (data) => setChat((prev) => [...prev, data]);
    const onClear = () => setChat([]);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("load_history", onHistory);
    socket.on("receive_message", onMessage);
    socket.on("chat_cleared", onClear);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("load_history", onHistory);
      socket.off("receive_message", onMessage);
      socket.off("chat_cleared", onClear);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const joinRoom = () => {
    if (username && room) {
      socket.emit("join_room", room);
      setShowChat(true);
    }
  };

  const sendMessage = () => {
    if (message.trim() && connected) {
      socket.emit("send_message", { room, sender: username, text: message });
      setMessage("");
    }
  };

  if (!showChat) return (
    <div className="login-screen">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="login-card">
        <Zap color="#00a884" size={48} fill="#00a884" />
        <h2>DevChat Pro</h2>
        <div className="input-group"><User size={18}/><input placeholder="Name" onChange={e => setUsername(e.target.value)} /></div>
        <div className="input-group"><Hash size={18}/><input placeholder="Room ID" onChange={e => setRoom(e.target.value)} /></div>
        <button className="join-btn" onClick={joinRoom}>Join Chat</button>
      </motion.div>
    </div>
  );

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <h3>{room}</h3>
          <span className={connected ? "status-on" : "status-off"}>
            {connected ? <Wifi size={12}/> : <WifiOff size={12}/>} {connected ? "Online" : "Connecting..."}
          </span>
        </div>
        <button className="clear-btn" onClick={() => socket.emit("clear_chat", room)}><Trash2 size={20}/></button>
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
        <div ref={chatEndRef} />
      </div>
      <div className="chat-footer">
        <input 
          disabled={!connected}
          value={message} 
          placeholder={connected ? "Message..." : "Waiting for connection..."} 
          onChange={e => setMessage(e.target.value)} 
          onKeyPress={e => e.key === 'Enter' && sendMessage()} 
        />
        <button className="send-btn" onClick={sendMessage} disabled={!connected}><Send size={20}/></button>
      </div>
    </div>
  );
}