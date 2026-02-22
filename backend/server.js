const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 🛠️ HACK: Keep-Alive Route (use cron-job.org to hit this every 10 mins)
app.get('/ping', (req, res) => res.status(200).send('pong'));

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// 🔌 Production-Ready Socket.io Configuration
const io = new Server(server, { 
    cors: { 
        // 🚀 HARD-CODED YOUR VERCEL URL FOR RELIABILITY
        origin: [
            "https://dev-chat-pro-adia12528s-projects.vercel.app/",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket'], // 🚀 Force WebSocket to prevent polling errors on Vercel
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 5000;
const dbURI = process.env.MONGO_URI || 'mongodb+srv://adia12528_db_user:Adi12528%40as@cluster0.da3qkei.mongodb.net/devchat?retryWrites=true&w=majority';


// 💎 Database Connection with pooling for scalability
mongoose.connect(dbURI)
    .then(() => console.log("💎 DB Connected: Ready for production"))
    .catch(err => console.error("❌ DB Connection Error:", err.message));

const MsgSchema = new mongoose.Schema({
    room: { type: String, index: true },
    sender: String,
    text: String,
    type: { type: String, default: 'text' },
    time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MsgSchema);

io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    socket.on('join_room', async (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
        try {
            const history = await Message.find({ room }).sort({ time: 1 }).limit(100);
            socket.emit('load_history', history);
        } catch (error) {
            console.error("Error loading history:", error);
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
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    socket.on('clear_chat', async (room) => {
        try {
            await Message.deleteMany({ room });
            io.to(room).emit('chat_cleared');
        } catch (error) {
            console.error("Error clearing chat:", error);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`❌ Disconnected (${socket.id}): ${reason}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Core Engine Live on port ${PORT}`);
});