import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Hash, Trash2, Zap, Image as ImageIcon } from 'lucide-react';
import './App.css';

const socket = io.connect(process.env.REACT_APP_BACKEND_URL || "http://localhost:5000");

export default function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on("load_history", (data) => setChat(data));
    socket.on("receive_message", (data) => setChat((prev) => [...prev, data]));
    socket.on("chat_cleared", () => setChat([]));
    return () => { socket.off("receive_message"); socket.off("load_history"); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("send_message", { room, sender: username, text: message });
      setMessage("");
    }
  };

  if (!showChat) return (
    <div className="login-screen">
      <motion.div initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} className="login-card">
        <Zap color="#00a884" size={48} fill="#00a884" />
        <h2>DevChat v2</h2>
        <div className="input-group"><User size={18}/><input placeholder="Your Name" onChange={e => setUsername(e.target.value)} /></div>
        <div className="input-group"><Hash size={18}/><input placeholder="Room Name" onChange={e => setRoom(e.target.value)} /></div>
        <button className="join-btn" onClick={() => { socket.emit("join_room", room); setShowChat(true); }}>Enter Room</button>
      </motion.div>
    </div>
  );

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="room-meta"><h3>{room}</h3><span>Online</span></div>
        <button className="clear-btn" onClick={() => socket.emit("clear_chat", room)}><Trash2 size={20}/></button>
      </div>

      <div className="chat-body">
        <AnimatePresence>
          {chat.map((m, i) => (
            <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} key={i} className={`msg-bubble ${m.sender === username ? "me" : "other"}`}>
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
        <div className="input-wrapper">
          <input value={message} placeholder="Type or paste image link..." onChange={e => setMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
          <button className="send-btn" onClick={sendMessage}><Send size={20}/></button>
        </div>
      </div>
    </div>
  );
}