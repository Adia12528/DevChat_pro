const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 🛠️ Render Keep-Alive Hack
app.get('/ping', (req, res) => res.status(200).send('pong'));

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// 🔌 Production Socket Configuration
const io = new Server(server, { 
    cors: { 
        origin: [
            "https://dev-chat-pro.vercel.app",
            "https://dev-chat-pro-adia12528s-projects.vercel.app",
            "http://localhost:3000",
            "http://localhost:5000"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000
});

const PORT = process.env.PORT || 5000;
// Using your provided MongoDB URI as the fallback
const dbURI = process.env.MONGO_URI || 'mongodb+srv://adia12528_db_user:Adi12528%40as@cluster0.da3qkei.mongodb.net/devchat?retryWrites=true&w=majority';

mongoose.connect(dbURI)
    .then(() => console.log("💎 MongoDB Connected: dev-chat-pro-db"))
    .catch(err => console.error("❌ DB Error:", err.message));

const MsgSchema = new mongoose.Schema({
    room: { type: String, index: true },
    sender: String,
    text: String,
    type: { type: String, default: 'text' },
    time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MsgSchema);

io.on('connection', (socket) => {
    console.log(`✅ Connected: ${socket.id}`);

    socket.on('join_room', async (room) => {
        socket.join(room);
        const history = await Message.find({ room }).sort({ time: 1 }).limit(100);
        socket.emit('load_history', history);
    });

    socket.on('send_message', async (data) => {
        if (!data.text?.trim()) return;
        const isImage = /\.(jpg|jpeg|png|webp|gif)$/.test(data.text.toLowerCase());
        const newMessage = new Message({ ...data, type: isImage ? 'image' : 'text' });
        const savedMessage = await newMessage.save();
        io.to(data.room).emit("receive_message", savedMessage.toObject());
    });

    socket.on('clear_chat', async (room) => {
        await Message.deleteMany({ room });
        io.to(room).emit('chat_cleared');
    });

    socket.on('disconnect', () => console.log("❌ Disconnected"));
});

server.listen(PORT, () => console.log(`🚀 Production Server on ${PORT}`));