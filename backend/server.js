const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS Configuration - Allow all Vercel deployments and localhost
const allowedOrigins = [
    'https://devchat-pro-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000'
];

const corsOptions = {
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, postman, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list or is a Vercel preview URL
        if (allowedOrigins.includes(origin) || origin.includes('.vercel.app')) {
            callback(null, true);
        } else {
            console.log('⚠️ CORS origin:', origin);
            callback(null, true); // Allow for now, can restrict later
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// 🛠️ Render Keep-Alive Hack (MUST be after CORS middleware)
app.get('/ping', (req, res) => res.status(200).send('pong'));

const server = http.createServer(app);

// 🔌 Production Socket Configuration with flexible CORS
const io = new Server(server, { 
    cors: { 
        origin: function(origin, callback) {
            if (!origin) return callback(null, true);
            // Allow all Vercel preview and production URLs
            if (allowedOrigins.includes(origin) || origin.includes('.vercel.app')) {
                callback(null, true);
            } else {
                console.log('⚠️ Socket CORS origin:', origin);
                callback(null, true); // Allow for now
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
    allowEIO3: true
});

const PORT = process.env.PORT || 5000;
// Using your provided MongoDB URI as the fallback
const dbURI = process.env.MONGO_URI || 'mongodb+srv://adia12528_db_user:Adi12528%40as@cluster0.da3qkei.mongodb.net/devchat?retryWrites=true&w=majority';
console.log("📍 Using DB URI:", dbURI.replace(/:.+@/, ':****@'));

mongoose.connect(dbURI)
    .then(() => console.log("💎 MongoDB Connected: dev-chat-pro-db"))
    .catch(err => console.error("❌ DB Error:", err.message));

const MsgSchema = new mongoose.Schema({
    room: { type: String, index: true },
    sender: String,
    text: String,
    type: { type: String, default: 'text' },
    time: { type: Date, default: Date.now },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    originalText: { type: String, default: null },
    // New fields for enhanced features
    reactions: { type: Object, default: {} },
    isPinned: { type: Boolean, default: false },
    readBy: { type: [String], default: [] },
    mentions: { type: [String], default: [] },
    replyTo: { type: String, default: null },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    duration: { type: Number, default: null }
});
const Message = mongoose.model('Message', MsgSchema);

// Normalize Mongoose docs to plain objects with string _id
const serializeMessage = (msg) => {
    if (!msg) return null;
    const obj = msg.toObject();
    obj._id = msg._id.toString();
    return obj;
};

// Track users in rooms
const roomUsers = {};

io.on('connection', (socket) => {
    console.log(`✅ Connected: ${socket.id}`);

    socket.on('join_room', async (data) => {
        const room = typeof data === 'string' ? data : data.room;
        const username = (typeof data === 'object' ? data.username : '') || 'Anonymous';
        
        socket.join(room);
        socket.username = username;
        socket.room = room;
        
        // Initialize room if doesn't exist
        if (!roomUsers[room]) roomUsers[room] = {};
        roomUsers[room][socket.id] = username;
        
        // Send chat history
        const history = await Message.find({ room }).sort({ time: 1 }).limit(100);
        socket.emit('load_history', history.map(serializeMessage));
        
        // Broadcast user joined with refreshed roster
        io.to(room).emit('user_joined', { username, users: Object.values(roomUsers[room]), count: Object.keys(roomUsers[room]).length });
    });

    socket.on('send_message', async (data) => {
        if (!data.text?.trim()) return;
        // Preserve the type from client data (text, image, voice, file)
        const newMessage = new Message({ 
            ...data, 
            type: data.type || 'text' // Use client-provided type or default to 'text'
        });
        const savedMessage = await newMessage.save();
        console.log(`📤 Message saved: ${savedMessage.type} - ${savedMessage.text?.substring(0, 30)}`);
        io.to(data.room).emit("receive_message", serializeMessage(savedMessage));
        io.to(data.room).emit('user_stopped_typing', data.sender);
    });

    socket.on('edit_message', async (data) => {
        const { messageId, newText, room, sender } = data;
        if (!newText?.trim()) return;
        
        const message = await Message.findById(messageId);
        if (!message || message.sender !== sender) return; // Only sender can edit
        
        if (!message.originalText) message.originalText = message.text; // Store original only once
        message.text = newText;
        message.edited = true;
        message.editedAt = new Date();
        
        const updatedMessage = await message.save();
        io.to(room).emit('message_edited', serializeMessage(updatedMessage));
    });

    socket.on('delete_message', async (data) => {
        const { messageId, room, sender } = data;
        
        const message = await Message.findById(messageId);
        if (!message || message.sender !== sender) return; // Only sender can delete
        
        await Message.findByIdAndDelete(messageId);
        io.to(room).emit('message_deleted', { messageId: messageId.toString() });
    });

    socket.on('typing', (data) => {
        // Only broadcast to other users in the room, NOT to the sender
        socket.to(data.room).emit('user_typing', { username: data.username });
    });

    socket.on('stop_typing', (data) => {
        // Broadcast stop_typing to other users only
        socket.to(data.room).emit('user_stopped_typing', data.username);
    });

    socket.on('clear_chat', async (room) => {
        await Message.deleteMany({ room });
        io.to(room).emit('chat_cleared');
    });

    socket.on('add_reaction', async (data) => {
        const { messageId, emoji, username, room } = data;
        const message = await Message.findById(messageId);
        if (!message) return;
        
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[emoji]) message.reactions[emoji] = [];
        if (!message.reactions[emoji].includes(username)) {
            message.reactions[emoji].push(username);
        }
        
        await message.save();
        io.to(room).emit('reaction_added', { messageId, reactions: message.reactions });
    });

    socket.on('remove_reaction', async (data) => {
        const { messageId, emoji, username, room } = data;
        const message = await Message.findById(messageId);
        if (!message || !message.reactions || !message.reactions[emoji]) return;
        
        message.reactions[emoji] = message.reactions[emoji].filter(u => u !== username);
        if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
        }
        
        await message.save();
        io.to(room).emit('reaction_removed', { messageId, reactions: message.reactions });
    });

    socket.on('pin_message', async (data) => {
        const { messageId, room } = data;
        const message = await Message.findById(messageId);
        if (!message) return;
        
        message.isPinned = true;
        await message.save();
        io.to(room).emit('message_pinned', serializeMessage(message));
    });

    socket.on('unpin_message', async (data) => {
        const { messageId, room } = data;
        const message = await Message.findById(messageId);
        if (!message) return;
        
        message.isPinned = false;
        await message.save();
        io.to(room).emit('message_unpinned', { messageId });
    });

    socket.on('mark_read', async (data) => {
        const { messageIds, username, room } = data;
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: username } }
        );
        io.to(room).emit('messages_read', { messageIds, username });
    });

    socket.on('update_status', (data) => {
        const { username, status } = data;
        socket.to(socket.room).emit('user_status_changed', { username, status });
    });

    socket.on('update_profile', (data) => {
        const { username, avatar, bio } = data;
        // In a real app, save to database
        socket.to(socket.room).emit('profile_updated', { username, avatar, bio });
    });

    // ==========================
    // WebRTC Video/Voice Calling Signaling
    // ==========================

    // Forward call offer to target user
    socket.on('call:offer', (data) => {
        console.log(`📞 Call offer from ${data.from} to ${data.to} (${data.callType})`);
        
        // Find target user's socket
        if (socket.room && roomUsers[socket.room]) {
            const targetSocket = Object.keys(roomUsers[socket.room]).find(
                sid => roomUsers[socket.room][sid].username === data.to
            );
            
            if (targetSocket) {
                io.to(targetSocket).emit('call:incoming', {
                    from: data.from,
                    callType: data.callType,
                    offer: data.offer
                });
                console.log(`✅ Call offer forwarded to ${data.to}`);
            } else {
                socket.emit('call:rejected', { reason: 'User not found or offline' });
                console.log(`❌ Target user ${data.to} not found`);
            }
        }
    });

    // Forward call answer to caller
    socket.on('call:answer', (data) => {
        console.log(`✅ Call answered: ${data.from} → ${data.to}`);
        
        if (socket.room && roomUsers[socket.room]) {
            const targetSocket = Object.keys(roomUsers[socket.room]).find(
                sid => roomUsers[socket.room][sid].username === data.to
            );
            
            if (targetSocket) {
                io.to(targetSocket).emit('call:answered', {
                    from: data.from,
                    answer: data.answer
                });
                console.log(`✅ Call answer forwarded to ${data.to}`);
            }
        }
    });

    // Forward ICE candidate to peer
    socket.on('call:ice-candidate', (data) => {
        console.log(`🧊 ICE candidate: ${socket.username} → ${data.to}`);
        
        if (socket.room && roomUsers[socket.room]) {
            const targetSocket = Object.keys(roomUsers[socket.room]).find(
                sid => roomUsers[socket.room][sid].username === data.to
            );
            
            if (targetSocket) {
                io.to(targetSocket).emit('call:ice-candidate', {
                    from: socket.username,
                    candidate: data.candidate
                });
            }
        }
    });

    // Handle call rejection
    socket.on('call:reject', (data) => {
        console.log(`❌ Call rejected: ${data.from} declined call from ${data.to}`);
        
        if (socket.room && roomUsers[socket.room]) {
            const targetSocket = Object.keys(roomUsers[socket.room]).find(
                sid => roomUsers[socket.room][sid].username === data.to
            );
            
            if (targetSocket) {
                io.to(targetSocket).emit('call:rejected', {
                    from: data.from
                });
            }
        }
    });

    // Handle call end
    socket.on('call:end', (data) => {
        console.log(`📴 Call ended: ${data.from} → ${data.to}`);
        
        if (socket.room && roomUsers[socket.room]) {
            const targetSocket = Object.keys(roomUsers[socket.room]).find(
                sid => roomUsers[socket.room][sid].username === data.to
            );
            
            if (targetSocket) {
                io.to(targetSocket).emit('call:ended', {
                    from: data.from
                });
            }
        }
    });

    socket.on('user_leaving', (data) => {
        console.log("👋 User explicitly leaving:", data.username);
        if (socket.room && roomUsers[socket.room]) {
            delete roomUsers[socket.room][socket.id];
            const users = Object.values(roomUsers[socket.room]);
            io.to(socket.room).emit('user_left', { username: data.username, users, count: users.length });
            if (users.length === 0) delete roomUsers[socket.room];
        }
    });

    socket.on('disconnect', () => {
        console.log("❌ Disconnected:", socket.id);
        if (socket.room && roomUsers[socket.room]) {
            delete roomUsers[socket.room][socket.id];
            const count = Object.keys(roomUsers[socket.room]).length;
            
            // Clear typing indicator when user disconnects
            io.to(socket.room).emit('user_stopped_typing', socket.username);
            
            // Notify others that user left with refreshed roster
            io.to(socket.room).emit('user_left', { username: socket.username, users: Object.values(roomUsers[socket.room]), count });
            if (count === 0) delete roomUsers[socket.room];
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Production Server on ${PORT}`));