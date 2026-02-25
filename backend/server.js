const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

const LOG_LEVELS = Object.freeze({ silent: 0, error: 1, warn: 2, info: 3, debug: 4 });
const configuredLogLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug')).toLowerCase();
const activeLogLevel = LOG_LEVELS[configuredLogLevel] != null ? configuredLogLevel : (process.env.NODE_ENV === 'production' ? 'error' : 'debug');
const shouldLog = (level) => LOG_LEVELS[level] <= LOG_LEVELS[activeLogLevel];
const logDebug = (...args) => {
    if (shouldLog('debug')) console.log(...args);
};

const CALL_EVENTS = Object.freeze({
    OFFER: 'call:offer',
    ANSWER: 'call:answer',
    ICE_CANDIDATE: 'call:ice-candidate',
    REJECT: 'call:reject',
    REJECTED: 'call:rejected',
    END: 'call:end',
    ENDED: 'call:ended'
});

// CORS Configuration - Allow all Vercel deployments and localhost
const frontendOrigin = process.env.FRONTEND_ORIGIN;
const allowedOrigins = [
    'https://devchat-pro-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
    frontendOrigin
].filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    return allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');
};

const getOriginLabel = (origin) => origin || 'no-origin';

const corsOriginHandler = (origin, callback) => {
    if (isAllowedOrigin(origin)) {
        callback(null, true);
    } else {
        console.log('⚠️ CORS blocked origin:', getOriginLabel(origin));
        callback(new Error('Not allowed by CORS'));
    }
};

const corsOptions = {
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// 🛠️ Render Keep-Alive Hack (MUST be after CORS middleware)
app.get('/ping', (req, res) => res.status(200).send('pong'));
app.get('/healthz', (req, res) => {
    res.status(200).json({
        ok: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

const server = http.createServer(app);

// 🔌 Production Socket Configuration with flexible CORS
const io = new Server(server, { 
    cors: { 
        origin: corsOriginHandler,
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
    const signalLog = (...args) => {
        logDebug(...args);
    };

    const findTargetSocketInRoom = (room, targetUsername) => {
        if (!room || !targetUsername || !roomUsers[room]) return null;
        return Object.keys(roomUsers[room]).find(
            sid => roomUsers[room][sid] === targetUsername
        ) || null;
    };

    const getUniqueRoomUsers = (room) => {
        if (!room || !roomUsers[room]) return [];
        return [...new Set(Object.values(roomUsers[room]).filter(Boolean))];
    };

    const emitRoomUserList = (room) => {
        if (!room) return;
        const users = getUniqueRoomUsers(room);
        io.to(room).emit('user_list_updated', { room, users, count: users.length });
    };

    const cleanupRoomIfEmpty = async (room) => {
        if (!room || !roomUsers[room]) return;
        const count = Object.keys(roomUsers[room]).length;
        if (count > 0) return;

        delete roomUsers[room];
        await Message.deleteMany({ room });
        console.log(`🧹 Auto-cleared room ${room} because everyone went offline/logout`);
    };

    const removeSocketFromRoom = async ({ room, username, emitOffline = true }) => {
        if (!room || !roomUsers[room]) return;

        if (roomUsers[room][socket.id]) {
            delete roomUsers[room][socket.id];
        }

        const remainingUsers = getUniqueRoomUsers(room);
        const count = remainingUsers.length;

        io.to(room).emit('user_stopped_typing', username);
        io.to(room).emit('user_left', { room, username, users: remainingUsers, count });
        emitRoomUserList(room);

        if (emitOffline) {
            io.to(room).emit('user_offline', { username });
        }

        if (count === 0) {
            await cleanupRoomIfEmpty(room);
        }
    };

    socket.on('join_room', async (data) => {
        const room = typeof data === 'string' ? data : data.room;
        const username = (typeof data === 'object' ? data.username : '') || 'Anonymous';
        const shouldFetchHistory = typeof data === 'object' ? data.fetchHistory !== false : true;
        const setActiveRoom = typeof data === 'object' ? data.active !== false : true;

        if (!room) return;

        const previousRoom = socket.room;
        if (setActiveRoom && previousRoom && previousRoom !== room) {
            socket.leave(previousRoom);
            removeSocketFromRoom({ room: previousRoom, username, emitOffline: false })
                .catch((err) => console.error('Cleanup error while switching rooms:', err));
        }
        
        socket.join(room);
        socket.username = username;
        if (setActiveRoom) {
            socket.room = room;
            socket.activeRoom = room;
        }
        
        // Initialize room if doesn't exist
        if (!roomUsers[room]) roomUsers[room] = {};
        const isNewJoin = !roomUsers[room][socket.id];
        roomUsers[room][socket.id] = username;

        // Broadcast presence immediately (don't wait for DB history load)
        if (isNewJoin) {
            const users = getUniqueRoomUsers(room);
            io.to(room).emit('user_joined', { room, username, users, count: users.length });
            emitRoomUserList(room);
        } else {
            emitRoomUserList(room);
        }
        
        // Send chat history
        if (shouldFetchHistory) {
            const history = await Message.find({ room }).sort({ time: 1 }).limit(100);
            socket.emit('load_history', history.map(serializeMessage));
        }
    });

    socket.on('leave_room', async (data) => {
        const room = typeof data === 'string' ? data : data?.room || socket.room;
        const username = (typeof data === 'object' ? data.username : '') || socket.username || 'User';
        if (!room) return;

        socket.leave(room);
        await removeSocketFromRoom({ room, username, emitOffline: true });
        if (socket.room === room) {
            socket.room = null;
        }
    });

    socket.on('user_logout', async (data) => {
        const room = data?.room || socket.room;
        const username = data?.username || socket.username || 'User';
        if (!room) return;

        await removeSocketFromRoom({ room, username, emitOffline: true });
    });

    socket.on('send_message', async (data, callback) => {
        if (!data || typeof data !== 'object') {
            callback?.({ error: 'Invalid payload' });
            return;
        }

        const hasText = typeof data.text === 'string' && data.text.trim().length > 0;
        const hasMedia = typeof data.fileUrl === 'string' && data.fileUrl.trim().length > 0;

        if (!data.room || !data.sender) {
            callback?.({ error: 'Missing room or sender' });
            return;
        }

        if (!hasText && !hasMedia) {
            callback?.({ error: 'Empty message' });
            return;
        }

        try {
            const normalizedText = hasText
                ? data.text.trim()
                : (data.type === 'voice' ? 'Voice message' : (data.fileName || 'Attachment'));

            // Preserve the type from client data (text, image, voice, file)
            const newMessage = new Message({ 
                ...data, 
                text: normalizedText,
                type: data.type || 'text' // Use client-provided type or default to 'text'
            });
            const savedMessage = await newMessage.save();
            console.log(`📤 Message saved: ${savedMessage.type} - ${savedMessage.text?.substring(0, 30)}`);
            io.to(data.room).emit("receive_message", serializeMessage(savedMessage));
            io.to(data.room).emit('user_stopped_typing', data.sender);
            callback?.({ success: true });
        } catch (err) {
            console.error('Message save error:', err);
            callback?.({ error: 'Database error' });
        }
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
        const activeRoom = socket.activeRoom || socket.room;
        if (activeRoom) {
            socket.to(activeRoom).emit('user_status_changed', { username, status });
            if (status === 'online') {
                emitRoomUserList(activeRoom);
            }
        }
    });

    socket.on('update_profile', (data) => {
        const { username, avatar, bio } = data;
        // In a real app, save to database
        socket.to(socket.room).emit('profile_updated', { username, avatar, bio });
    });

    // ==========================
    // WebRTC Video/Voice Calling Signaling
    // ==========================

    const resolveCallTargetSocket = (toUsername) => {
        const activeRoom = socket.activeRoom || socket.room;
        if (!activeRoom || !roomUsers[activeRoom] || !toUsername) return null;
        return findTargetSocketInRoom(activeRoom, toUsername);
    };

    const notifyCallerUnavailable = (reason = 'User not found or offline') => {
        socket.emit(CALL_EVENTS.REJECTED, { reason });
    };

    // Forward call offer to target user
    socket.on(CALL_EVENTS.OFFER, (data) => {
        try {
            if (!data?.to || !data?.from || !data?.offer || !data?.callType) {
                notifyCallerUnavailable('Invalid call offer payload');
                return;
            }

            signalLog(`📞 Call offer from ${data.from} to ${data.to} (${data.callType})`);
            const targetSocket = resolveCallTargetSocket(data.to);
            signalLog(`🔎 call:offer target ${data.to}:`, targetSocket ? `socket ${targetSocket}` : 'not found');

            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.OFFER, {
                    from: data.from,
                    callType: data.callType,
                    offer: data.offer
                });
                signalLog(`✅ Call offer forwarded to ${data.to} (socket: ${targetSocket})`);
            } else {
                signalLog(`❌ Target user ${data.to} not found in room ${socket.activeRoom || socket.room}`);
                notifyCallerUnavailable('User not found or offline');
            }
        } catch (err) {
            console.error('❌ Failed to forward call offer:', err);
            notifyCallerUnavailable('Failed to initiate call');
        }
    });

    // Forward call answer to caller
    socket.on(CALL_EVENTS.ANSWER, (data) => {
        try {
            if (!data?.to || !data?.from || !data?.answer) return;
            signalLog(`✅ Call answered: ${data.from} → ${data.to}`);

            const targetSocket = resolveCallTargetSocket(data.to);
            signalLog(`🔎 call:answer target ${data.to}:`, targetSocket ? `socket ${targetSocket}` : 'not found');

            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.ANSWER, {
                    from: data.from,
                    answer: data.answer
                });
                signalLog(`✅ Call answer forwarded to ${data.to}`);
            } else {
                socket.emit(CALL_EVENTS.ENDED, { from: data.to || 'Unknown' });
            }
        } catch (err) {
            console.error('❌ Failed to forward call answer:', err);
        }
    });

    // Forward ICE candidate to peer
    socket.on(CALL_EVENTS.ICE_CANDIDATE, (data) => {
        try {
            if (!data?.to || !data?.candidate) return;
            signalLog(`🧊 ICE candidate: ${socket.username} → ${data.to}`);

            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.ICE_CANDIDATE, {
                    from: socket.username,
                    candidate: data.candidate
                });
            }
        } catch (err) {
            console.error('❌ Failed to forward ICE candidate:', err);
        }
    });

    // Handle call rejection
    socket.on(CALL_EVENTS.REJECT, (data) => {
        try {
            if (!data?.to || !data?.from) return;
            signalLog(`❌ Call rejected: ${data.from} declined call from ${data.to}`);

            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.REJECTED, {
                    from: data.from
                });
            }
        } catch (err) {
            console.error('❌ Failed to forward call rejection:', err);
        }
    });

    // Handle call end
    socket.on(CALL_EVENTS.END, (data) => {
        try {
            if (!data?.to || !data?.from) return;
            signalLog(`📴 Call ended: ${data.from} → ${data.to}`);

            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.ENDED, {
                    from: data.from
                });
            }
        } catch (err) {
            console.error('❌ Failed to forward call end:', err);
        }
    });

    socket.on('user_leaving', (data) => {
        console.log("👋 User explicitly leaving:", data.username);
        if (socket.room && roomUsers[socket.room]) {
            removeSocketFromRoom({ room: socket.room, username: data.username || socket.username || 'User', emitOffline: true })
                .catch((err) => console.error('Cleanup error in user_leaving:', err));
        }
    });

    socket.on('disconnect', () => {
        console.log("❌ Disconnected:", socket.id, "Username:", socket.username, "Room:", socket.room);
        
        // Ensure socket has proper username even if not set
        const username = socket.username || 'User';
        
        const joinedRooms = Object.keys(roomUsers).filter((room) => roomUsers[room] && roomUsers[room][socket.id]);
        joinedRooms.forEach((room) => {
            removeSocketFromRoom({ room, username, emitOffline: true })
                .catch((err) => console.error('Cleanup error on disconnect:', err));
        });
        
        // If user was closing browser without calling user_leaving, clean up typing
        if (socket.username) {
            console.log(`🔴 User ${socket.username} fully disconnected without explicit leave`);
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Production Server on ${PORT}`));