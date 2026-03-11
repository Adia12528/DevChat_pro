// --- FRIENDS FEATURE: Edit Message REST endpoint ---
app.put('/api/friends/messages/:id/edit', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer /, '');
        // TODO: Replace with your real auth logic
        // For now, assume sender is in req.body.sender or req.user (if you have auth middleware)
        const sender = req.user?.uniqueId || req.body.sender || null;
        if (!sender) return res.status(401).json({ error: 'Unauthorized: missing sender' });

        const messageId = req.params.id;
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });
        if (message.sender !== sender) return res.status(403).json({ error: 'Forbidden: not your message' });

        if (!message.originalText) message.originalText = message.text;
        message.text = text.trim();
        message.edited = true;
        message.editedAt = new Date();
        const updatedMessage = await message.save();
        res.json(serializeMessage(updatedMessage));
    } catch (err) {
        console.error('Edit message error:', err);
        res.status(500).json({ error: 'Failed to edit message' });
    }
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { AccessToken, WebhookReceiver } = require('livekit-server-sdk');
const { setupFriendsFeature } = require('./friends');
require('dotenv').config();

// 1. INITIALIZE EXPRESS FIRST
const app = express();
// Serve uploaded files statically
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));
// Image upload route
const uploadRouter = require('./upload');
app.use('/api/upload', uploadRouter);

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
    ENDED: 'call:ended',
    SCREEN_SHARE_START: 'call:screen-share-start',
    SCREEN_SHARE_END: 'call:screen-share-end'
});

const LIVESTREAM_EVENTS = Object.freeze({
    START: 'livestream:start',
    STARTED: 'livestream:started',
    AVAILABLE: 'livestream:available',
    JOIN_REQUEST: 'livestream:join-request',
    OFFER: 'livestream:offer',
    ANSWER: 'livestream:answer',
    ICE_CANDIDATE: 'livestream:ice-candidate',
    STOP: 'livestream:stop',
    STOPPED: 'livestream:stopped',
    DECLINE: 'livestream:decline',
    LEAVE: 'livestream:leave',
    VIEWERS_UPDATE: 'livestream:viewers-update',
    SETTINGS_UPDATE: 'livestream:settings-update',
    SETTINGS_UPDATED: 'livestream:settings-updated',
    COMMENT: 'livestream:comment',
    COMMENTED: 'livestream:commented',
    REACTION: 'livestream:reaction',
    REACTED: 'livestream:reacted',
    POLICY_BLOCKED: 'livestream:policy-blocked'
});

const ROOM_EVENTS = Object.freeze({
    REGISTRY_UPDATED: 'room_registry_updated'
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

// 2. APPLY MIDDLEWARE
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// 3. DEFINE ROUTES
app.get('/ping', (req, res) => res.status(200).send('pong'));
app.get('/healthz', (req, res) => {
    res.status(200).json({
        ok: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/cors-debug', (req, res) => {
    res.json({
        message: 'CORS debug endpoint',
        origin: req.headers.origin,
        host: req.headers.host,
        time: new Date().toISOString(),
        env: process.env.NODE_ENV || 'not set',
        allowedOrigins
    });
});

// 🌟 NEW: LiveKit Webhook Receiver (Safely below app initialization)
if (process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
    const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    app.post('/api/livekit/webhook', async (req, res) => {
        try {
            const event = receiver.receive(req.body, req.get('Authorization'));
            console.log('LiveKit Webhook Event:', event.event);
            res.status(200).send();
        } catch (error) {
            console.error('Error validating webhook event:', error);
            res.status(400).send('Invalid webhook signature');
        }
    });
}

// 🌟 NEW: LiveKit Token Generator
app.get('/api/livekit/token', async (req, res) => {
    const roomName = req.query.room;
    const participantName = req.query.username;
    const isHost = req.query.isHost === 'true';

    if (!roomName || !participantName) {
        return res.status(400).json({ error: 'room and username are required' });
    }

    try {
        // Improved: Allow host to rejoin if no other active session exists for this user in the room
        if (isHost) {
            if (!global.livekitHostSessions) global.livekitHostSessions = {};
            const hostKey = `${roomName}::${participantName}`;
            if (!Array.isArray(global.livekitHostSessions[hostKey])) {
                global.livekitHostSessions[hostKey] = [];
            }
            // Remove any stale socket ids (should be handled on disconnect/leave)
            // Check if any socket id in the array is actually connected
            const connectedSockets = (global.livekitHostSessions[hostKey] || []).filter(id => {
                // 'pending' is not a real socket id
                if (id === 'pending') return false;
                // Check if socket exists in io.sockets.sockets
                return io.sockets.sockets.has(id);
            });
            console.log(`[LiveKitHostSession] hostKey=${hostKey} connectedSockets=`, connectedSockets);
            // Only block if a real socket is connected
            if (connectedSockets.length > 0) {
                return res.status(409).json({ error: 'You are already hosting this stream in another session or tab.' });
            }
            // Clean up if only stale/pending
            global.livekitHostSessions[hostKey] = global.livekitHostSessions[hostKey].filter(id => connectedSockets.includes(id));
            // Mark this host session as active (will be cleaned up on disconnect/leave)
            global.livekitHostSessions[hostKey].push('pending');
        }

        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY, 
            process.env.LIVEKIT_API_SECRET, 
            { identity: participantName }
        );

        at.addGrant({ 
            roomJoin: true, 
            room: roomName,
            canPublish: isHost,
            canPublishData: true,
            canSubscribe: true
        });

        const token = await at.toJwt();
        res.json({ token });

        // Optionally, set a timeout to auto-clear the host session after 2 hours
        if (isHost) {
            setTimeout(() => {
                if (global.livekitHostSessions && Array.isArray(global.livekitHostSessions[`${roomName}::${participantName}`])) {
                    global.livekitHostSessions[`${roomName}::${participantName}`] = [];
                }
            }, 2 * 60 * 60 * 1000);
        }
    } catch (error) {
        console.error("Error generating LiveKit token:", error);
        res.status(500).json({ error: "Failed to generate token" });
    }
});

// 4. SERVER & DB SETUP
const server = http.createServer(app);

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

setupFriendsFeature({ app, io, mongoose });

const PORT = process.env.PORT || 5000;

// Secure Database Connection (Removed hardcoded credentials)
const dbURI = process.env.MONGO_URI;
if (!dbURI) {
    console.warn("⚠️ MONGO_URI is not defined in environment variables. Database connection will fail.");
} else {
    mongoose.connect(dbURI)
        .then(() => console.log("💎 MongoDB Connected"))
        .catch(err => console.error("❌ DB Error:", err.message));
}

const MsgSchema = new mongoose.Schema({
    room: { type: String, index: true },
    sender: String,
    clientMessageId: { type: String, default: null },
    text: String,
    type: { type: String, default: 'text' },
    time: { type: Date, default: Date.now },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    originalText: { type: String, default: null },
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

const serializeMessage = (msg) => {
    if (!msg) return null;
    const obj = msg.toObject();
    obj._id = msg._id.toString();
    return obj;
};

// Application State
const roomUsers = {};
const roomPolicies = {};
const blockedUsers = {};
const userReports = [];
const livestreamSessions = new Map();

const toSet = (list = []) => [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];

const ensureRoomPolicy = (room, ownerCandidate) => {
    if (!room || room.includes('_dm_')) return null;
    if (!roomPolicies[room]) {
        roomPolicies[room] = {
            owner: ownerCandidate || null,
            mods: [],
            locked: false,
            inviteOnly: false,
            invited: ownerCandidate ? [ownerCandidate] : []
        };
    }
    if (ownerCandidate && !roomPolicies[room].owner) {
        roomPolicies[room].owner = ownerCandidate;
    }
    roomPolicies[room].mods = toSet(roomPolicies[room].mods);
    roomPolicies[room].invited = toSet(roomPolicies[room].invited);
    return roomPolicies[room];
};

const isRoomOwner = (policy, username) => !!policy && !!username && policy.owner === username;
const isRoomMod = (policy, username) => !!policy && !!username && policy.mods.includes(username);
const hasRoomAdminAccess = (policy, username) => isRoomOwner(policy, username) || isRoomMod(policy, username);

const serializePolicy = (policy, username) => {
    if (!policy) return null;
    return {
        owner: policy.owner,
        mods: [...policy.mods],
        locked: !!policy.locked,
        inviteOnly: !!policy.inviteOnly,
        role: isRoomOwner(policy, username) ? 'owner' : (isRoomMod(policy, username) ? 'mod' : 'member')
    };
};

const hasUserBlocked = (actor, target) => {
    if (!actor || !target) return false;
    return (blockedUsers[actor] || []).includes(target);
};

// 5. SOCKET CONNECTION HANDLER
io.on('connection', (socket) => {
    console.log(`✅ Connected: ${socket.id}`);
    
    const signalLog = (...args) => logDebug(...args);

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

    const getAllConnectedUsers = () => {
        const users = [];
        Object.values(roomUsers).forEach((roomMap) => {
            if (!roomMap) return;
            Object.values(roomMap).forEach((username) => {
                if (username) users.push(username);
            });
        });
        return [...new Set(users)];
    };

    const emitGlobalUserList = () => {
        const users = getAllConnectedUsers();
        io.emit('global_users_updated', { users, count: users.length });
    };

    const emitRoomRegistry = () => {
        const rooms = Object.entries(roomUsers)
            .filter(([roomId, roomMap]) => roomId && roomMap && !roomId.includes('_dm_'))
            .map(([roomId, roomMap]) => {
                const users = [...new Set(Object.values(roomMap || {}).filter(Boolean))];
                return { id: roomId, name: roomId, count: users.length, users };
            })
            .filter((entry) => entry.count > 0)
            .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

        io.emit(ROOM_EVENTS.REGISTRY_UPDATED, { rooms });
    };

    const getSocketIdsByUsername = (targetUsername) => {
        if (!targetUsername) return [];
        const ids = [];
        Object.entries(roomUsers).forEach(([room, roomMap]) => {
            if (!roomMap) return;
            Object.entries(roomMap).forEach(([sid, username]) => {
                if (username === targetUsername) ids.push(sid);
            });
        });
        return [...new Set(ids)];
    };

    const emitRoomUserList = (room) => {
        if (!room) return;
        const users = getUniqueRoomUsers(room);
        io.to(room).emit('user_list_updated', { room, users, count: users.length });
    };

    const emitRoomPolicy = (room) => {
        if (!room || room.includes('_dm_')) return;
        const policy = roomPolicies[room];
        if (!policy) return;
        io.to(room).emit('room_policy_updated', {
            room,
            policy: serializePolicy(policy)
        });
    };

    const cleanupRoomIfEmpty = async (room) => {
        if (!room || !roomUsers[room]) return;
        const count = Object.keys(roomUsers[room]).length;
        if (count > 0) return;

        delete roomUsers[room];

        const connectedUsers = getAllConnectedUsers();
        if (connectedUsers.length === 0) {
            await Message.deleteMany({ room });
            console.log(`🧹 Auto-cleared room ${room} because all users are offline`);
        }
    };

    const removeSocketFromRoom = async ({ room, username, emitOffline = true }) => {
        if (!room || !roomUsers[room]) return;

        if (roomUsers[room][socket.id]) {
            delete roomUsers[room][socket.id];
        }

        // Improved: Clean up host session if this was a host
        if (global.livekitHostSessions) {
            const hostKey = `${room}::${username}`;
            if (Array.isArray(global.livekitHostSessions[hostKey])) {
                const idx = global.livekitHostSessions[hostKey].indexOf(socket.id);
                if (idx !== -1) {
                    global.livekitHostSessions[hostKey].splice(idx, 1);
                }
                // If no more sessions, clean up the key
                if (global.livekitHostSessions[hostKey].length === 0) {
                    delete global.livekitHostSessions[hostKey];
                }
            }
        }

        const remainingUsers = getUniqueRoomUsers(room);
        const count = remainingUsers.length;

        io.to(room).emit('user_stopped_typing', username);
        io.to(room).emit('user_left', { room, username, users: remainingUsers, count });
        emitRoomUserList(room);
        emitGlobalUserList();
        emitRoomRegistry();

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

        if (!room.includes('_dm_')) {
            const policy = ensureRoomPolicy(room, username);
            const userAlreadyInRoom = getUniqueRoomUsers(room).includes(username);
            const isAdmin = hasRoomAdminAccess(policy, username);
            const isInvited = (policy?.invited || []).includes(username);

            if (policy?.inviteOnly && !isAdmin && !isInvited && !userAlreadyInRoom) {
                socket.emit('room_join_denied', { room, reason: 'invite_only' });
                return;
            }

            if (policy?.locked && !isAdmin && !userAlreadyInRoom) {
                socket.emit('room_join_denied', { room, reason: 'locked' });
                return;
            }

            policy.invited = toSet([...(policy.invited || []), username]);
        }

        const previousRoom = socket.room;
        const isSwitchingBetweenGroupRooms =
            setActiveRoom &&
            previousRoom &&
            previousRoom !== room &&
            !previousRoom.includes('_dm_') &&
            !room.includes('_dm_');

        if (isSwitchingBetweenGroupRooms) {
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
        // Improved: If this is a host, register the socket id for cleanup
        if (data && data.isHost) {
            if (!global.livekitHostSessions) global.livekitHostSessions = {};
            const hostKey = `${room}::${username}`;
            if (!Array.isArray(global.livekitHostSessions[hostKey])) {
                global.livekitHostSessions[hostKey] = [];
            }
            // Replace 'pending' with actual socket id
            const idx = global.livekitHostSessions[hostKey].indexOf('pending');
            if (idx !== -1) {
                global.livekitHostSessions[hostKey][idx] = socket.id;
            } else if (!global.livekitHostSessions[hostKey].includes(socket.id)) {
                global.livekitHostSessions[hostKey].push(socket.id);
            }
        }
        if (!roomUsers[room]) roomUsers[room] = {};
        const isNewJoin = !roomUsers[room][socket.id];
        roomUsers[room][socket.id] = username;

        if (isNewJoin) {
            const users = getUniqueRoomUsers(room);
            io.to(room).emit('user_joined', { room, username, users, count: users.length });
            emitRoomUserList(room);
        } else {
            emitRoomUserList(room);
        }
        emitGlobalUserList();
        emitRoomRegistry();

        if (!room.includes('_dm_')) {
            const policy = ensureRoomPolicy(room, username);
            socket.emit('room_policy_updated', {
                room,
                policy: serializePolicy(policy, username)
            });
            emitRoomPolicy(room);
        }
        
        if (shouldFetchHistory) {
            const history = await Message.find({ room }).sort({ time: 1 }).limit(100);
            socket.emit('load_history', history.map(serializeMessage));
        }

        for (const session of livestreamSessions.values()) {
            if (session.room !== room) continue;
            if (session.host === username) continue;
            socket.emit(LIVESTREAM_EVENTS.AVAILABLE, {
                sessionId: session.sessionId,
                host: session.host,
                room: session.room,
                visibility: session.visibility,
                source: session.source,
                time: new Date().toISOString()
            });
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
            if (typeof data.room === 'string' && data.room.includes('_dm_')) {
                const dmParticipants = data.room.split('_dm_').map(n => n?.trim()).filter(Boolean);
                if (dmParticipants.length !== 2 || !dmParticipants.includes(data.sender)) {
                    callback?.({ error: 'Invalid DM room' });
                    return;
                }

                const recipient = dmParticipants.find((p) => p !== data.sender);
                if (hasUserBlocked(data.sender, recipient)) {
                    callback?.({ error: 'You blocked this user' });
                    return;
                }
                if (hasUserBlocked(recipient, data.sender)) {
                    callback?.({ error: 'You cannot message this user' });
                    return;
                }
            }

            const normalizedText = hasText ? data.text.trim() : (data.type === 'voice' ? 'Voice message' : (data.fileName || 'Attachment'));
            const newMessage = new Message({ ...data, text: normalizedText, type: data.type || 'text' });
            const savedMessage = await newMessage.save();
            const serializedMessage = serializeMessage(savedMessage);
            
            io.to(data.room).emit("receive_message", serializedMessage);

            if (typeof data.room === 'string' && data.room.includes('_dm_')) {
                const dmParticipants = data.room.split('_dm_').map(n => n?.trim()).filter(Boolean);
                const roomSocketIds = io.sockets.adapter.rooms.get(data.room) || new Set();
                const deliveredSocketIds = new Set(roomSocketIds);

                dmParticipants.forEach((participant) => {
                    const participantSocketIds = getSocketIdsByUsername(participant);
                    participantSocketIds.forEach((targetSocketId) => {
                        if (deliveredSocketIds.has(targetSocketId)) return;
                        io.to(targetSocketId).emit("receive_message", serializedMessage);
                        deliveredSocketIds.add(targetSocketId);
                    });
                });
            }

            io.to(data.room).emit('user_stopped_typing', data.sender);
            callback?.({ success: true, messageId: serializedMessage._id, clientMessageId: serializedMessage.clientMessageId || null });
        } catch (err) {
            console.error('Message save error:', err);
            callback?.({ error: 'Database error' });
        }
    });

    socket.on('edit_message', async (data) => {
        const { messageId, newText, room, sender } = data;
        if (!newText?.trim()) return;
        
        const message = await Message.findById(messageId);
        if (!message || message.sender !== sender) return;
        
        if (!message.originalText) message.originalText = message.text;
        message.text = newText;
        message.edited = true;
        message.editedAt = new Date();
        
        const updatedMessage = await message.save();
        io.to(room).emit('message_edited', serializeMessage(updatedMessage));
    });

    socket.on('delete_message', async (data) => {
        const { messageId, room, sender } = data;
        const message = await Message.findById(messageId);
        if (!message || message.sender !== sender) return;
        
        await Message.findByIdAndDelete(messageId);
        io.to(room).emit('message_deleted', { messageId: messageId.toString() });
    });

    socket.on('typing', (data) => socket.to(data.room).emit('user_typing', { username: data.username }));
    socket.on('stop_typing', (data) => socket.to(data.room).emit('user_stopped_typing', data.username));

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
        if (message.reactions[emoji].length === 0) delete message.reactions[emoji];
        
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
            socket.to(activeRoom).emit('user_status_changed', { username, status, lastSeen: Date.now() });
            if (status === 'online') emitRoomUserList(activeRoom);
        }
    });

    // --- Calling Logic ---
    const resolveCallTargetSocket = (toUsername) => {
        const activeRoom = socket.activeRoom || socket.room;
        if (!toUsername) return null;

        if (activeRoom && roomUsers[activeRoom]) {
            const inActiveRoom = findTargetSocketInRoom(activeRoom, toUsername);
            if (inActiveRoom) return inActiveRoom;
        }

        const fallbackSockets = getSocketIdsByUsername(toUsername);
        return fallbackSockets.length > 0 ? fallbackSockets[0] : null;
    };

    const notifyCallerUnavailable = (reason = 'User not found or offline') => {
        socket.emit(CALL_EVENTS.REJECTED, { reason });
    };

    const getLivestreamSession = (sessionId) => {
        if (!sessionId) return null;
        return livestreamSessions.get(sessionId) || null;
    };

    const resolveLivestreamTargetSocket = (session, targetUsername) => {
        if (!targetUsername) return null;
        if (session?.room) {
            const inRoom = findTargetSocketInRoom(session.room, targetUsername);
            if (inRoom) return inRoom;
        }
        const fallbackSockets = getSocketIdsByUsername(targetUsername);
        return fallbackSockets.length > 0 ? fallbackSockets[0] : null;
    };

    const emitLivestreamViewerCount = (session) => {
        if (!session?.sessionId) return;
        const payload = {
            sessionId: session.sessionId,
            count: session.viewers.size,
            viewers: [...session.viewers]
        };
        if (session.room) {
            io.to(session.room).emit(LIVESTREAM_EVENTS.VIEWERS_UPDATE, payload);
        } else {
            io.emit(LIVESTREAM_EVENTS.VIEWERS_UPDATE, payload);
        }
    };

    const sanitizeLivestreamSettings = (settings = {}) => ({
        slowMode: !!settings?.slowMode,
        subOnlyMode: !!settings?.subOnlyMode,
        noiseSuppression: settings?.noiseSuppression !== false,
        quality: typeof settings?.quality === 'string' ? settings.quality : '1080p'
    });

    const isLivestreamHost = (session, username) => session?.host && username && session.host === username;

    const emitLivestreamPolicyBlocked = (socketInstance, session, payload = {}) => {
        if (!socketInstance || !session?.sessionId) return;
        socketInstance.emit(LIVESTREAM_EVENTS.POLICY_BLOCKED, {
            sessionId: session.sessionId,
            ...payload
        });
    };

    const stopLivestreamSession = (session, reason = 'stopped') => {
        if (!session?.sessionId) return;
        livestreamSessions.delete(session.sessionId);
        const payload = {
            sessionId: session.sessionId,
            host: session.host,
            room: session.room,
            visibility: session.visibility,
            source: session.source,
            reason
        };
        if (session.room) {
            io.to(session.room).emit(LIVESTREAM_EVENTS.STOPPED, payload);
        } else {
            io.emit(LIVESTREAM_EVENTS.STOPPED, payload);
        }
    };

    socket.on(CALL_EVENTS.OFFER, (data) => {
        try {
            if (!data?.to || !data?.from || !data?.offer || !data?.callType) {
                notifyCallerUnavailable('Invalid call offer payload');
                return;
            }
            signalLog(`📞 Call offer from ${data.from} to ${data.to} (${data.callType})`);
            const targetSocket = resolveCallTargetSocket(data.to);

            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.OFFER, {
                    from: data.from,
                    callType: data.callType,
                    offer: data.offer
                });
            } else {
                notifyCallerUnavailable('User not found or offline');
            }
        } catch (err) {
            console.error('❌ Failed to forward call offer:', err);
            notifyCallerUnavailable('Failed to initiate call');
        }
    });

    socket.on(CALL_EVENTS.ANSWER, (data) => {
        try {
            if (!data?.to || !data?.from || !data?.answer) return;
            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.ANSWER, { from: data.from, answer: data.answer });
            } else {
                socket.emit(CALL_EVENTS.ENDED, { from: data.to || 'Unknown' });
            }
        } catch (err) {
            console.error('❌ Failed to forward call answer:', err);
        }
    });

    socket.on(CALL_EVENTS.ICE_CANDIDATE, (data) => {
        try {
            if (!data?.to || !data?.candidate) return;
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

    socket.on(CALL_EVENTS.REJECT, (data) => {
        try {
            if (!data?.to || !data?.from) return;
            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) io.to(targetSocket).emit(CALL_EVENTS.REJECTED, { from: data.from });
        } catch (err) {
            console.error('❌ Failed to forward call rejection:', err);
        }
    });

    socket.on(CALL_EVENTS.END, (data) => {
        try {
            if (!data?.to || !data?.from) return;
            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) io.to(targetSocket).emit(CALL_EVENTS.ENDED, { from: data.from });
        } catch (err) {
            console.error('❌ Failed to forward call end:', err);
        }
    });

    socket.on(CALL_EVENTS.SCREEN_SHARE_START, (data) => {
        try {
            if (!data?.to || !data?.from) return;
            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.SCREEN_SHARE_START, { from: data.from });
            }
        } catch (err) {
            console.error('❌ Failed to forward screen share start:', err);
        }
    });

    socket.on(CALL_EVENTS.SCREEN_SHARE_END, (data) => {
        try {
            if (!data?.to || !data?.from) return;
            const targetSocket = resolveCallTargetSocket(data.to);
            if (targetSocket) {
                io.to(targetSocket).emit(CALL_EVENTS.SCREEN_SHARE_END, { from: data.from });
            }
        } catch (err) {
            console.error('❌ Failed to forward screen share end:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.START, (data, callback) => {
        try {
            const host = data?.host || socket.username;
            const room = data?.room || socket.room;
            if (!host || !room) {
                callback?.({ success: false, error: 'Missing host or room' });
                return;
            }

            const settings = sanitizeLivestreamSettings(data?.settings || {});

            const sessionId = `${room}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const session = {
                sessionId,
                host,
                room,
                visibility: data?.visibility === 'public' ? 'public' : 'room',
                source: data?.source || 'camera',
                hostSocketId: socket.id,
                viewers: new Set(),
                settings,
                lastCommentAtByUser: new Map()
            };

            livestreamSessions.set(sessionId, session);

            const targets = getUniqueRoomUsers(room).filter((username) => username && username !== host);
            callback?.({ success: true, sessionId, targets });

            socket.to(room).emit(LIVESTREAM_EVENTS.STARTED, {
                sessionId,
                host,
                room,
                visibility: session.visibility,
                source: session.source,
                settings: session.settings,
                time: new Date().toISOString()
            });

            if (session.visibility === 'public') {
                socket.broadcast.emit(LIVESTREAM_EVENTS.AVAILABLE, {
                    sessionId,
                    host,
                    room,
                    visibility: session.visibility,
                    source: session.source,
                    settings: session.settings,
                    time: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('❌ Failed to start livestream:', err);
            callback?.({ success: false, error: 'Failed to start livestream' });
        }
    });

    socket.on(LIVESTREAM_EVENTS.SETTINGS_UPDATE, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session) return;

            const sender = data?.from || socket.username;
            if (!isLivestreamHost(session, sender)) return;

            session.settings = {
                ...session.settings,
                ...sanitizeLivestreamSettings(data?.settings || {})
            };

            io.to(session.room).emit(LIVESTREAM_EVENTS.SETTINGS_UPDATED, {
                sessionId: session.sessionId,
                settings: session.settings,
                updatedBy: sender,
                time: new Date().toISOString()
            });
        } catch (err) {
            console.error('❌ Failed to update livestream settings:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.JOIN_REQUEST, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session || !data?.from) {
                socket.emit(LIVESTREAM_EVENTS.DECLINE, {
                    sessionId: data?.sessionId,
                    reason: 'Livestream unavailable'
                });
                return;
            }

            const hostSocket = resolveLivestreamTargetSocket(session, session.host);
            if (!hostSocket) {
                socket.emit(LIVESTREAM_EVENTS.DECLINE, {
                    sessionId: session.sessionId,
                    reason: 'Host offline'
                });
                return;
            }

            io.to(hostSocket).emit(LIVESTREAM_EVENTS.JOIN_REQUEST, {
                sessionId: session.sessionId,
                from: data.from
            });
        } catch (err) {
            console.error('❌ Failed to process livestream join request:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.OFFER, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session || !data?.to || !data?.offer) return;
            const targetSocket = resolveLivestreamTargetSocket(session, data.to);
            if (!targetSocket) return;

            io.to(targetSocket).emit(LIVESTREAM_EVENTS.OFFER, {
                sessionId: session.sessionId,
                from: data.from,
                offer: data.offer,
                visibility: session.visibility,
                source: session.source,
                room: session.room
            });
        } catch (err) {
            console.error('❌ Failed to forward livestream offer:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.ANSWER, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session || !data?.to || !data?.answer) return;
            const targetSocket = resolveLivestreamTargetSocket(session, data.to);
            if (!targetSocket) return;

            io.to(targetSocket).emit(LIVESTREAM_EVENTS.ANSWER, {
                sessionId: session.sessionId,
                from: data.from,
                answer: data.answer
            });

            if (data.from) {
                session.viewers.add(data.from);
                emitLivestreamViewerCount(session);
            }
        } catch (err) {
            console.error('❌ Failed to forward livestream answer:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.ICE_CANDIDATE, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session || !data?.to || !data?.candidate) return;
            const targetSocket = resolveLivestreamTargetSocket(session, data.to);
            if (!targetSocket) return;

            io.to(targetSocket).emit(LIVESTREAM_EVENTS.ICE_CANDIDATE, {
                sessionId: session.sessionId,
                from: data.from || socket.username,
                candidate: data.candidate
            });
        } catch (err) {
            console.error('❌ Failed to forward livestream ICE candidate:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.COMMENT, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            const text = typeof data?.text === 'string' ? data.text.trim() : '';
            const from = data?.from || socket.username;
            if (!session || !text || !from) return;

            const isHost = isLivestreamHost(session, from);
            if (session.settings?.subOnlyMode && !isHost) {
                emitLivestreamPolicyBlocked(socket, session, {
                    reason: 'sub-only-mode',
                    action: 'comment'
                });
                return;
            }

            if (session.settings?.slowMode && !isHost) {
                const now = Date.now();
                const lastCommentAt = session.lastCommentAtByUser.get(from) || 0;
                const waitMs = 5000 - (now - lastCommentAt);
                if (waitMs > 0) {
                    emitLivestreamPolicyBlocked(socket, session, {
                        reason: 'slow-mode',
                        action: 'comment',
                        waitMs
                    });
                    return;
                }
                session.lastCommentAtByUser.set(from, now);
            }

            io.to(session.room).emit(LIVESTREAM_EVENTS.COMMENTED, {
                id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sessionId: session.sessionId,
                from,
                text,
                time: new Date().toISOString()
            });
        } catch (err) {
            console.error('❌ Failed to broadcast livestream comment:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.REACTION, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            const from = data?.from || socket.username;
            if (!session || !data?.emoji || !from) return;

            if (session.settings?.subOnlyMode && !isLivestreamHost(session, from)) {
                emitLivestreamPolicyBlocked(socket, session, {
                    reason: 'sub-only-mode',
                    action: 'reaction'
                });
                return;
            }

            io.to(session.room).emit(LIVESTREAM_EVENTS.REACTED, {
                id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sessionId: session.sessionId,
                from,
                emoji: data.emoji,
                time: new Date().toISOString()
            });
        } catch (err) {
            console.error('❌ Failed to broadcast livestream reaction:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.LEAVE, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            const from = data?.viewer || data?.from || socket.username;
            if (!session || !from) return;

            if (session.viewers.delete(from)) {
                emitLivestreamViewerCount(session);
                const hostSocket = resolveLivestreamTargetSocket(session, session.host);
                if (hostSocket) {
                    io.to(hostSocket).emit(LIVESTREAM_EVENTS.LEAVE, {
                        sessionId: session.sessionId,
                        from
                    });
                }
            }
        } catch (err) {
            console.error('❌ Failed to process livestream leave:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.DECLINE, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session || !data?.to) return;
            const targetSocket = resolveLivestreamTargetSocket(session, data.to);
            if (!targetSocket) return;

            io.to(targetSocket).emit(LIVESTREAM_EVENTS.DECLINE, {
                sessionId: session.sessionId,
                from: data.from || socket.username,
                reason: data.reason || 'Declined'
            });
        } catch (err) {
            console.error('❌ Failed to forward livestream decline:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.STOP, (data) => {
        try {
            const session = getLivestreamSession(data?.sessionId);
            if (!session) return;
            if (session.host !== (data?.host || socket.username)) return;
            stopLivestreamSession(session, 'stopped');
        } catch (err) {
            console.error('❌ Failed to stop livestream:', err);
        }
    });

    socket.on('user_leaving', (data) => {
        console.log("👋 User explicitly leaving:", data.username);
        if (socket.room && roomUsers[socket.room]) {
            removeSocketFromRoom({ room: socket.room, username: data.username || socket.username || 'User', emitOffline: true })
                .catch((err) => console.error('Cleanup error in user_leaving:', err));
        }
    });

    // 🌟 CLEAN DISCONNECT LOGIC
    socket.on('disconnect', () => {
        console.log("❌ Disconnected:", socket.id, "Username:", socket.username, "Room:", socket.room);
        const username = socket.username || 'User';

        for (const session of livestreamSessions.values()) {
            if (session.hostSocketId === socket.id || session.host === username) {
                stopLivestreamSession(session, 'host-disconnected');
                continue;
            }

            if (username && session.viewers.delete(username)) {
                emitLivestreamViewerCount(session);
                const hostSocket = resolveLivestreamTargetSocket(session, session.host);
                if (hostSocket) {
                    io.to(hostSocket).emit(LIVESTREAM_EVENTS.LEAVE, {
                        sessionId: session.sessionId,
                        from: username
                    });
                }
            }
        }
        
        const joinedRooms = Object.keys(roomUsers).filter((room) => roomUsers[room] && roomUsers[room][socket.id]);
        joinedRooms.forEach((room) => {
            removeSocketFromRoom({ room, username, emitOffline: true })
                .catch((err) => console.error('Cleanup error on disconnect:', err));
        });
    });
});

let activePort = Number(PORT) || 5000;
let retryListenTimer = null;

const startServer = (port) => {
    if (server.listening) return;
    activePort = Number(port) || activePort;
    server.listen(activePort, () => {
        if (retryListenTimer) {
            clearTimeout(retryListenTimer);
            retryListenTimer = null;
        }
        console.log(`🚀 Production Server on ${activePort}`);
    });
};

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        const failedPort = activePort;
        activePort += 1;
        console.warn(`⚠️ Port ${failedPort} is in use. Retrying on ${activePort}...`);
        if (retryListenTimer) {
            clearTimeout(retryListenTimer);
        }
        retryListenTimer = setTimeout(() => {
            retryListenTimer = null;
            startServer(activePort);
        }, 120);
        return;
    }

    console.error('❌ Server startup error:', error);
});

startServer(activePort);