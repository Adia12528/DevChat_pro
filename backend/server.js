const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Critical: Loads your .env file

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    transports: ['websocket', 'polling'] 
});

const PORT = process.env.PORT || 5000;

/** * 🛠️ CONNECTION LOGIC
 * If process.env.MONGO_URI is missing, it falls back to local MongoDB.
 * This prevents the "URI must include hostname" crash.
 */
const dbURI = process.env.MONGO_URI || 'mongodb+srv://adia12528_db_user:Adi12528%40as@cluster0.da3qkei.mongodb.net/devchat?retryWrites=true&w=majority';

console.log("📡 Attempting to connect to database...");

mongoose.connect(dbURI)
    .then(() => console.log("💎 Database Synced Successfully"))
    .catch(err => {
        console.error("❌ MongoDB Connection Error!");
        console.error("Reason:", err.message);
        console.log("👉 Tip: Check if your .env file exists and contains MONGO_URI");
    });

// 📊 Scalable Schema
const MsgSchema = new mongoose.Schema({
    room: { type: String, required: true, index: true }, 
    sender: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, default: 'text' },
    time: { type: Date, default: Date.now, index: -1 }
});
const Message = mongoose.model('Message', MsgSchema);

// 🔌 Socket Events
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', async (room) => {
        socket.join(room);
        try {
            const history = await Message.find({ room })
                .sort({ time: -1 })
                .limit(50);
            socket.emit('load_history', history.reverse());
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    });

    socket.on('send_message', async (data) => {
        if (!data.text || !data.text.trim()) return;
        
        const isImage = /\.(jpg|jpeg|png|webp|gif)$/.test(data.text.toLowerCase());
        
        try {
            const newMessage = new Message({
                ...data,
                type: isImage ? 'image' : 'text',
                time: new Date()
            });
            await newMessage.save();
            io.to(data.room).emit("receive_message", newMessage);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    socket.on('clear_chat', async (room) => {
        try {
            await Message.deleteMany({ room });
            io.to(room).emit('chat_cleared');
        } catch (err) {
            console.error("Error clearing chat:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log("User disconnected");
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});