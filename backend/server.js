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
    COMMENT: 'livestream:comment',
    COMMENTED: 'livestream:commented',
    REACTION: 'livestream:reaction',
    REACTED: 'livestream:reacted'
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
    clientMessageId: { type: String, default: null },
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
const roomPolicies = {};
const blockedUsers = {};
const userReports = [];
const liveStreams = {};

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
                return {
                    id: roomId,
                    name: roomId,
                    count: users.length,
                    users
                };
            })
            .filter((entry) => entry.count > 0)
            .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

        io.emit(ROOM_EVENTS.REGISTRY_UPDATED, { rooms });
    };

    const getSocketIdsByUsername = (targetUsername) => {
        if (!targetUsername) return [];
        const sockets = new Set();
        Object.values(roomUsers).forEach((roomMap) => {
            if (!roomMap) return;
            Object.entries(roomMap).forEach(([socketId, username]) => {
                if (username === targetUsername) sockets.add(socketId);
            });
        });
        return Array.from(sockets);
    };

    const emitLivestreamViewers = (sessionId) => {
        const session = liveStreams[sessionId];
        if (!session) return;

        const hostSocketIds = getSocketIdsByUsername(session.host);
        hostSocketIds.forEach((hostSocketId) => {
            io.to(hostSocketId).emit(LIVESTREAM_EVENTS.VIEWERS_UPDATE, {
                sessionId,
                viewers: Array.from(session.viewers || []),
                count: (session.viewers || new Set()).size
            });
        });
    };

    const stopLivestreamSession = (sessionId, reason = 'host_stopped') => {
        const session = liveStreams[sessionId];
        if (!session) return;

        io.emit(LIVESTREAM_EVENTS.STOPPED, {
            sessionId,
            host: session.host,
            reason
        });

        delete liveStreams[sessionId];
    };

    const removeViewerFromLiveStreams = (username) => {
        if (!username) return;
        Object.entries(liveStreams).forEach(([sessionId, session]) => {
            if (!session || session.host === username) return;
            if ((session.viewers || new Set()).has(username)) {
                session.viewers.delete(username);
                emitLivestreamViewers(sessionId);
            }
        });
    };

    const emitToLivestreamParticipants = (sessionId, eventName, payload) => {
        const session = liveStreams[sessionId];
        if (!session) return false;

        const participants = new Set([session.host, ...Array.from(session.viewers || [])]);
        participants.forEach((participant) => {
            const socketIds = getSocketIdsByUsername(participant);
            socketIds.forEach((socketId) => {
                io.to(socketId).emit(eventName, payload);
            });
        });

        return true;
    };

    const getVisibleLivestreamSessionsForUser = ({ username, room }) => {
        if (!username) return [];
        return Object.values(liveStreams)
            .filter((session) => {
                if (!session || session.host === username) return false;
                if (session.visibility === 'public') return true;
                return !!room && session.room === room;
            })
            .map((session) => ({
                sessionId: session.id,
                host: session.host,
                room: session.room,
                visibility: session.visibility,
                source: session.source,
                startedAt: session.startedAt
            }));
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
            console.log(`🧹 Auto-cleared room ${room} because all users are offline/logout`);
        } else {
            console.log(`ℹ️ Room ${room} is empty, messages retained because users are still online in other chats`);
        }
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

        const visibleSessions = getVisibleLivestreamSessionsForUser({ username, room });
        visibleSessions.forEach((sessionInfo) => {
            socket.emit(LIVESTREAM_EVENTS.AVAILABLE, sessionInfo);
        });
        
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
            if (typeof data.room === 'string' && data.room.includes('_dm_')) {
                const dmParticipants = data.room
                    .split('_dm_')
                    .map((name) => name?.trim())
                    .filter(Boolean);

                if (dmParticipants.length !== 2 || !dmParticipants.includes(data.sender)) {
                    callback?.({ error: 'Invalid DM room' });
                    return;
                }

                const recipient = dmParticipants.find((participant) => participant !== data.sender);
                if (hasUserBlocked(data.sender, recipient)) {
                    callback?.({ error: 'You blocked this user' });
                    return;
                }

                if (hasUserBlocked(recipient, data.sender)) {
                    callback?.({ error: 'You cannot message this user' });
                    return;
                }
            }

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
            const serializedMessage = serializeMessage(savedMessage);
            io.to(data.room).emit("receive_message", serializedMessage);

            if (typeof data.room === 'string' && data.room.includes('_dm_')) {
                const dmParticipants = data.room
                    .split('_dm_')
                    .map((name) => name?.trim())
                    .filter(Boolean);

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
            socket.to(activeRoom).emit('user_status_changed', { username, status, lastSeen: Date.now() });
            if (status === 'online') {
                emitRoomUserList(activeRoom);
            }
        }
    });

    socket.on('room_policy_request', (data = {}) => {
        const room = data.room || socket.activeRoom || socket.room;
        if (!room || room.includes('_dm_')) return;
        const policy = ensureRoomPolicy(room, socket.username || data.actor || null);
        socket.emit('room_policy_updated', {
            room,
            policy: serializePolicy(policy, socket.username || data.actor || null)
        });
    });

    socket.on('room_set_policy', (data = {}, callback) => {
        const room = data.room;
        const actor = data.actor || socket.username;
        if (!room || room.includes('_dm_')) {
            callback?.({ error: 'Invalid room' });
            return;
        }

        const policy = ensureRoomPolicy(room, actor);
        if (!hasRoomAdminAccess(policy, actor)) {
            callback?.({ error: 'Only owner/mod can update room policy' });
            return;
        }

        if (typeof data.locked === 'boolean') policy.locked = data.locked;
        if (typeof data.inviteOnly === 'boolean') policy.inviteOnly = data.inviteOnly;

        emitRoomPolicy(room);
        callback?.({ success: true, policy: serializePolicy(policy, actor) });
    });

    socket.on('room_invite_user', (data = {}, callback) => {
        const { room, actor, target } = data;
        if (!room || !target || room.includes('_dm_')) {
            callback?.({ error: 'Invalid invite payload' });
            return;
        }

        const policy = ensureRoomPolicy(room, actor || socket.username);
        const actingUser = actor || socket.username;
        if (!hasRoomAdminAccess(policy, actingUser)) {
            callback?.({ error: 'Only owner/mod can invite users' });
            return;
        }

        policy.invited = toSet([...(policy.invited || []), target]);
        emitRoomPolicy(room);

        getSocketIdsByUsername(target).forEach((targetSocketId) => {
            io.to(targetSocketId).emit('room_invited', { room, by: actingUser });
        });

        callback?.({ success: true });
    });

    socket.on('room_grant_mod', (data = {}, callback) => {
        const { room, actor, target } = data;
        if (!room || !target || room.includes('_dm_')) {
            callback?.({ error: 'Invalid mod payload' });
            return;
        }

        const actingUser = actor || socket.username;
        const policy = ensureRoomPolicy(room, actingUser);
        if (!isRoomOwner(policy, actingUser)) {
            callback?.({ error: 'Only owner can promote moderators' });
            return;
        }

        policy.mods = toSet([...(policy.mods || []), target]).filter((u) => u !== policy.owner);
        emitRoomPolicy(room);
        callback?.({ success: true });
    });

    socket.on('room_remove_user', async (data = {}, callback) => {
        const { room, actor, target } = data;
        if (!room || !target || room.includes('_dm_')) {
            callback?.({ error: 'Invalid remove payload' });
            return;
        }

        const actingUser = actor || socket.username;
        const policy = ensureRoomPolicy(room, actingUser);
        if (!hasRoomAdminAccess(policy, actingUser)) {
            callback?.({ error: 'Only owner/mod can remove users' });
            return;
        }

        if (target === policy.owner) {
            callback?.({ error: 'Owner cannot be removed' });
            return;
        }

        const targetSocketIds = getSocketIdsByUsername(target);
        for (const targetSocketId of targetSocketIds) {
            if (roomUsers[room]?.[targetSocketId]) {
                delete roomUsers[room][targetSocketId];
            }
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.leave(room);
                if (targetSocket.room === room) {
                    targetSocket.room = null;
                }
            }
            io.to(targetSocketId).emit('room_removed', { room, by: actingUser });
        }

        io.to(room).emit('user_removed_from_room', { room, target, by: actingUser });
        emitRoomUserList(room);
        emitRoomPolicy(room);
        callback?.({ success: true });
    });

    socket.on('block_user', (data = {}, callback) => {
        const actor = data.actor || socket.username;
        const target = data.target;
        if (!actor || !target || actor === target) {
            callback?.({ error: 'Invalid block request' });
            return;
        }

        blockedUsers[actor] = toSet([...(blockedUsers[actor] || []), target]);
        socket.emit('block_list_updated', { actor, blocked: blockedUsers[actor] });
        callback?.({ success: true });
    });

    socket.on('unblock_user', (data = {}, callback) => {
        const actor = data.actor || socket.username;
        const target = data.target;
        if (!actor || !target) {
            callback?.({ error: 'Invalid unblock request' });
            return;
        }

        blockedUsers[actor] = (blockedUsers[actor] || []).filter((name) => name !== target);
        socket.emit('block_list_updated', { actor, blocked: blockedUsers[actor] });
        callback?.({ success: true });
    });

    socket.on('report_user', (data = {}, callback) => {
        const actor = data.actor || socket.username;
        const target = data.target;
        if (!actor || !target || actor === target) {
            callback?.({ error: 'Invalid report request' });
            return;
        }

        userReports.push({
            actor,
            target,
            room: data.room || socket.activeRoom || socket.room || null,
            reason: data.reason || 'unspecified',
            time: new Date().toISOString()
        });
        callback?.({ success: true });
    });

    socket.on('update_profile', (data) => {
        const { username, avatar, bio } = data;
        // In a real app, save to database
        socket.to(socket.room).emit('profile_updated', { username, avatar, bio });
    });

    // ==========================
    // Livestream Signaling (one-to-many)
    // ==========================

    socket.on(LIVESTREAM_EVENTS.START, (data = {}, callback) => {
        try {
            const host = data.host || socket.username;
            const visibility = data.visibility === 'public' ? 'public' : 'room';
            const source = data.source === 'screen' ? 'screen' : 'camera';
            const room = data.room || socket.activeRoom || socket.room;

            if (!host || !room) {
                callback?.({ error: 'Missing host or room for livestream' });
                return;
            }

            if (room.includes('_dm_')) {
                callback?.({ error: 'Livestream is only supported in group rooms' });
                return;
            }

            const existingSessionId = Object.keys(liveStreams).find((sessionId) => liveStreams[sessionId]?.host === host);
            if (existingSessionId) {
                stopLivestreamSession(existingSessionId, 'host_restarted');
            }

            const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const targetUsers = visibility === 'public'
                ? getAllConnectedUsers().filter((username) => username && username !== host)
                : getUniqueRoomUsers(room).filter((username) => username && username !== host);

            liveStreams[sessionId] = {
                id: sessionId,
                host,
                room,
                visibility,
                source,
                startedAt: new Date().toISOString(),
                viewers: new Set()
            };

            const sentTo = new Set();
            targetUsers.forEach((targetUsername) => {
                const targetSocketIds = getSocketIdsByUsername(targetUsername);
                targetSocketIds.forEach((targetSocketId) => {
                    if (sentTo.has(targetSocketId)) return;
                    sentTo.add(targetSocketId);
                    io.to(targetSocketId).emit(LIVESTREAM_EVENTS.STARTED, {
                        sessionId,
                        host,
                        room,
                        visibility,
                        source
                    });
                });
            });

            emitLivestreamViewers(sessionId);
            callback?.({ success: true, sessionId, host, room, visibility, source, targets: targetUsers });
        } catch (err) {
            console.error('❌ Failed to start livestream:', err);
            callback?.({ error: 'Failed to start livestream' });
        }
    });

    socket.on(LIVESTREAM_EVENTS.OFFER, (data = {}) => {
        try {
            const { sessionId, to, from, offer } = data;
            const session = liveStreams[sessionId];
            if (!session || !to || !from || !offer) return;
            if (session.host !== from) return;

            const targetSocketIds = getSocketIdsByUsername(to);
            targetSocketIds.forEach((targetSocketId) => {
                io.to(targetSocketId).emit(LIVESTREAM_EVENTS.OFFER, {
                    sessionId,
                    from,
                    offer,
                    visibility: session.visibility,
                    source: session.source,
                    room: session.room
                });
            });
        } catch (err) {
            console.error('❌ Failed to forward livestream offer:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.ANSWER, (data = {}) => {
        try {
            const { sessionId, to, from, answer } = data;
            const session = liveStreams[sessionId];
            if (!session || !to || !from || !answer) return;

            const targetSocketIds = getSocketIdsByUsername(to);
            targetSocketIds.forEach((targetSocketId) => {
                io.to(targetSocketId).emit(LIVESTREAM_EVENTS.ANSWER, {
                    sessionId,
                    from,
                    answer
                });
            });

            if (session.host === to) {
                session.viewers = session.viewers || new Set();
                session.viewers.add(from);
                emitLivestreamViewers(sessionId);
            }
        } catch (err) {
            console.error('❌ Failed to forward livestream answer:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.ICE_CANDIDATE, (data = {}) => {
        try {
            const { sessionId, to, from, candidate } = data;
            if (!sessionId || !to || !candidate) return;
            if (!liveStreams[sessionId]) return;

            const targetSocketIds = getSocketIdsByUsername(to);
            targetSocketIds.forEach((targetSocketId) => {
                io.to(targetSocketId).emit(LIVESTREAM_EVENTS.ICE_CANDIDATE, {
                    sessionId,
                    from,
                    candidate
                });
            });
        } catch (err) {
            console.error('❌ Failed to forward livestream ICE candidate:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.DECLINE, (data = {}) => {
        try {
            const { sessionId, to, from } = data;
            if (!sessionId || !to || !from) return;

            const targetSocketIds = getSocketIdsByUsername(to);
            targetSocketIds.forEach((targetSocketId) => {
                io.to(targetSocketId).emit(LIVESTREAM_EVENTS.DECLINE, {
                    sessionId,
                    from
                });
            });
        } catch (err) {
            console.error('❌ Failed to forward livestream decline:', err);
        }
    });

    socket.on(LIVESTREAM_EVENTS.LEAVE, (data = {}) => {
        const sessionId = data.sessionId;
        const viewer = data.viewer || socket.username;
        const session = liveStreams[sessionId];
        if (!session || !viewer) return;

        if ((session.viewers || new Set()).has(viewer)) {
            session.viewers.delete(viewer);
            emitLivestreamViewers(sessionId);
        }
    });

    socket.on(LIVESTREAM_EVENTS.STOP, (data = {}) => {
        const sessionId = data.sessionId;
        const host = data.host || socket.username;
        const session = liveStreams[sessionId];
        if (!session || !host) return;
        if (session.host !== host) return;

        stopLivestreamSession(sessionId, 'host_stopped');
    });

    socket.on(LIVESTREAM_EVENTS.JOIN_REQUEST, (data = {}) => {
        const sessionId = data.sessionId;
        const viewer = data.from || socket.username;
        const session = liveStreams[sessionId];

        if (!session || !viewer || viewer === session.host) return;

        if (session.visibility === 'room') {
            const roomUsersList = getUniqueRoomUsers(session.room);
            if (!roomUsersList.includes(viewer)) return;
        }

        const hostSocketIds = getSocketIdsByUsername(session.host);
        hostSocketIds.forEach((hostSocketId) => {
            io.to(hostSocketId).emit(LIVESTREAM_EVENTS.JOIN_REQUEST, {
                sessionId,
                from: viewer,
                host: session.host,
                room: session.room,
                visibility: session.visibility,
                source: session.source
            });
        });
    });

    socket.on(LIVESTREAM_EVENTS.COMMENT, (data = {}) => {
        const sessionId = data.sessionId;
        const from = data.from || socket.username;
        const text = typeof data.text === 'string' ? data.text.trim() : '';

        if (!sessionId || !from || !text) return;
        if (text.length > 300) return;

        const payload = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sessionId,
            from,
            text,
            time: new Date().toISOString()
        };

        emitToLivestreamParticipants(sessionId, LIVESTREAM_EVENTS.COMMENTED, payload);
    });

    socket.on(LIVESTREAM_EVENTS.REACTION, (data = {}) => {
        const sessionId = data.sessionId;
        const from = data.from || socket.username;
        const emoji = typeof data.emoji === 'string' ? data.emoji.trim() : '';

        if (!sessionId || !from || !emoji || emoji.length > 8) return;

        const payload = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sessionId,
            from,
            emoji,
            time: new Date().toISOString()
        };

        emitToLivestreamParticipants(sessionId, LIVESTREAM_EVENTS.REACTED, payload);
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

        if (socket.username) {
            removeViewerFromLiveStreams(socket.username);
            const hostedSessionId = Object.keys(liveStreams).find((sessionId) => liveStreams[sessionId]?.host === socket.username);
            if (hostedSessionId) {
                stopLivestreamSession(hostedSessionId, 'host_disconnected');
            }
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Production Server on ${PORT}`));