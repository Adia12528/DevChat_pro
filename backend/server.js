const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5000;
const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/devchat_pro';

mongoose.connect(dbURI).then(() => console.log("💎 DB Synced")).catch(err => console.log(err));

const MsgSchema = new mongoose.Schema({
    room: { type: String, index: true },
    sender: String,
    text: String,
    type: { type: String, default: 'text' }, // 'text' or 'image'
    time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MsgSchema);

io.on('connection', (socket) => {
    socket.on('join_room', async (room) => {
        socket.join(room);
        const history = await Message.find({ room }).sort({ time: 1 }).limit(100);
        socket.emit('load_history', history);
    });

    socket.on('send_message', async (data) => {
        if (!data.text.trim()) return;
        
        // Simple Image Detection
        const isImage = /\.(jpg|jpeg|png|webp|gif)$/.test(data.text.toLowerCase());
        
        const newMessage = new Message({
            ...data,
            type: isImage ? 'image' : 'text',
            time: new Date()
        });
        
        await newMessage.save();
        io.to(data.room).emit("receive_message", newMessage);
    });

    socket.on('clear_chat', async (room) => {
        await Message.deleteMany({ room });
        io.to(room).emit('chat_cleared');
    });
});

server.listen(PORT, () => console.log(`🚀 Engine Live: ${PORT}`));