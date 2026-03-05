const express = require('express');
const admin = require('firebase-admin');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TTL_MS = 7 * DAY_MS;
const FRIENDS_MESSAGE_MAX_CHARS = 2000;

const makeUniqueId = () => `friend_${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}`;

const conversationIdFor = (uidA, uidB) => [uidA, uidB].sort().join('__');

const sanitizeMessageText = (text) => {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FRIENDS_MESSAGE_MAX_CHARS);
};

const createSimpleRateLimiter = ({ limit, windowMs }) => {
  const bucket = [];
  return () => {
    const now = Date.now();
    while (bucket.length && now - bucket[0] > windowMs) {
      bucket.shift();
    }
    if (bucket.length >= limit) {
      return false;
    }
    bucket.push(now);
    return true;
  };
};

const parseDisappearingPolicy = (policy = { mode: 'keep' }) => {
  const mode = policy?.mode || 'keep';
  if (mode === 'keep') return null;

  if (mode === 'immediate') {
    return new Date(Date.now() + 5000);
  }

  if (mode === 'preset') {
    const ttlMap = {
      '1h': 60 * 60 * 1000,
      '24h': DAY_MS,
      '3d': 3 * DAY_MS,
      '7d': 7 * DAY_MS
    };
    const ttl = ttlMap[policy?.value] || DAY_MS;
    return new Date(Date.now() + Math.min(ttl, MAX_TTL_MS));
  }

  if (mode === 'custom') {
    const when = new Date(policy?.value).getTime();
    if (!Number.isFinite(when) || when <= Date.now()) return new Date(Date.now() + DAY_MS);
    return new Date(Math.min(when, Date.now() + MAX_TTL_MS));
  }

  return null;
};

const normalizePrivateKey = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')
    .trim();
};

const parseJsonCredential = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseBase64JsonCredential = (value) => {
  if (!value) return null;
  try {
    const decoded = Buffer.from(String(value), 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const getFirebaseServiceAccount = () => {
  const jsonCredential =
    parseJsonCredential(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) ||
    parseJsonCredential(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) ||
    parseBase64JsonCredential(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);

  if (jsonCredential?.project_id && jsonCredential?.client_email && jsonCredential?.private_key) {
    return {
      projectId: jsonCredential.project_id,
      clientEmail: jsonCredential.client_email,
      privateKey: normalizePrivateKey(jsonCredential.private_key)
    };
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  let privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      privateKey = normalizePrivateKey(Buffer.from(String(process.env.FIREBASE_PRIVATE_KEY_BASE64), 'base64').toString('utf8'));
    } catch {
      privateKey = '';
    }
  }

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
};

const firebaseEnabled = () => !!getFirebaseServiceAccount();

const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) return true;

  const serviceAccount = getFirebaseServiceAccount();
  if (!serviceAccount) return false;

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('❌ Firebase Admin init failed for friends feature:', error.message);
    return false;
  }

  return true;
};

const getModels = (mongoose) => {
  const FriendProfileSchema = new mongoose.Schema(
    {
      uid: { type: String, unique: true, index: true },
      uniqueId: { type: String, unique: true, index: true },
      displayName: { type: String, default: '' },
      bio: { type: String, default: '' },
      email: { type: String, default: '' },
      phoneNumber: { type: String, default: '' },
      photoURL: { type: String, default: '' },
      contacts: { type: [String], default: [] },
      contactPrefs: {
        type: Map,
        of: new mongoose.Schema(
          {
            muted: { type: Boolean, default: false },
            notifications: { type: Boolean, default: true },
            notificationSound: { type: String, default: 'soft' },
            defaultDisappearPolicy: {
              type: Object,
              default: { mode: 'keep' }
            }
          },
          { _id: false }
        ),
        default: {}
      }
    },
    { timestamps: true }
  );

  const FriendMessageSchema = new mongoose.Schema(
    {
      conversationId: { type: String, index: true },
      fromUid: { type: String, index: true },
      toUid: { type: String, index: true },
      text: { type: String, required: true },
      disappearPolicy: { type: Object, default: { mode: 'keep' } },
      expiresAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      readAt: { type: Date, default: null }
    },
    { timestamps: true }
  );

  const FriendProfile = mongoose.models.FriendProfile || mongoose.model('FriendProfile', FriendProfileSchema);
  const FriendMessage = mongoose.models.FriendMessage || mongoose.model('FriendMessage', FriendMessageSchema);

  return { FriendProfile, FriendMessage };
};

const toPublicProfile = (profile) => ({
  uniqueId: profile.uniqueId,
  displayName: profile.displayName || '',
  bio: profile.bio || '',
  photoURL: profile.photoURL || '',
  email: profile.email || '',
  phoneNumber: profile.phoneNumber || ''
});

const friendsAuthMiddleware = (enabled) => async (req, res, next) => {
  if (!enabled) {
    return res.status(503).json({
      error: 'Firebase auth is not configured on backend. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY).'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;
    next();
  } catch (error) {
    console.error('❌ friends auth verify failed:', error.message);
    return res.status(401).json({ error: 'Invalid auth token.' });
  }
};

const ensureProfile = async (FriendProfile, firebaseUser) => {
  const uid = firebaseUser.uid;
  let profile = await FriendProfile.findOne({ uid });

  if (!profile) {
    profile = await FriendProfile.create({
      uid,
      uniqueId: makeUniqueId(),
      displayName: firebaseUser.name || firebaseUser.email || firebaseUser.phone_number || 'Friend',
      email: firebaseUser.email || '',
      phoneNumber: firebaseUser.phone_number || '',
      photoURL: firebaseUser.picture || '',
      contacts: []
    });
  } else {
    let changed = false;
    if (!profile.email && firebaseUser.email) {
      profile.email = firebaseUser.email;
      changed = true;
    }
    if (!profile.phoneNumber && firebaseUser.phone_number) {
      profile.phoneNumber = firebaseUser.phone_number;
      changed = true;
    }
    if (!profile.photoURL && firebaseUser.picture) {
      profile.photoURL = firebaseUser.picture;
      changed = true;
    }
    if (changed) {
      await profile.save();
    }
  }

  return profile;
};

const mapMessageForClient = async (FriendProfile, message, viewerUid) => {
  const from = await FriendProfile.findOne({ uid: message.fromUid }).lean();
  const to = await FriendProfile.findOne({ uid: message.toUid }).lean();

  return {
    id: String(message._id),
    text: message.text,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
    disappearPolicy: message.disappearPolicy || { mode: 'keep' },
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
    fromUniqueId: from?.uniqueId || '',
    toUniqueId: to?.uniqueId || '',
    isMine: message.fromUid === viewerUid,
    deliveryStatus:
      message.fromUid === viewerUid
        ? (message.readAt ? 'read' : (message.deliveredAt ? 'delivered' : 'sent'))
        : 'received'
  };
};

const pruneExpired = async (FriendMessage, conversationId) => {
  await FriendMessage.deleteMany({
    conversationId,
    expiresAt: { $ne: null, $lte: new Date() }
  });
};

const getActiveMessageFilter = () => ({
  $or: [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } }
  ]
});

const buildContactWithStats = async ({ FriendMessage, meUid, contact }) => {
  const conversationId = conversationIdFor(meUid, contact.uid);
  const lastMessage = await FriendMessage.findOne({ conversationId, ...getActiveMessageFilter() }).sort({ createdAt: -1 }).lean();
  const unreadCount = await FriendMessage.countDocuments({
    conversationId,
    toUid: meUid,
    readAt: null,
    ...getActiveMessageFilter()
  });

  return {
    ...toPublicProfile(contact),
    unreadCount,
    lastMessage: lastMessage
      ? {
          text: lastMessage.text,
          createdAt: lastMessage.createdAt
        }
      : null,
    lastMessageAt: lastMessage?.createdAt || null
  };
};

const setupFriendsFeature = ({ app, io, mongoose }) => {
  const enabled = initializeFirebaseAdmin();
  const { FriendProfile, FriendMessage } = getModels(mongoose);
  const authRequired = friendsAuthMiddleware(enabled);

  const router = express.Router();
  const onlineByUid = new Map();
  const lastSeenByUid = new Map();

  const setUserOnline = (uid) => {
    const current = onlineByUid.get(uid) || 0;
    onlineByUid.set(uid, current + 1);
  };

  const setUserOffline = (uid) => {
    const current = onlineByUid.get(uid) || 0;
    if (current <= 1) {
      onlineByUid.delete(uid);
      lastSeenByUid.set(uid, new Date().toISOString());
      return;
    }
    onlineByUid.set(uid, current - 1);
  };

  const isUidOnline = (uid) => (onlineByUid.get(uid) || 0) > 0;

  router.get('/profile', authRequired, async (req, res) => {
    try {
      const profile = await ensureProfile(FriendProfile, req.firebaseUser);
      return res.json({ profile: toPublicProfile(profile) });
    } catch (error) {
      console.error('friends profile error', error);
      return res.status(500).json({ error: 'Failed to load profile.' });
    }
  });

  router.put('/profile', authRequired, async (req, res) => {
    try {
      const profile = await ensureProfile(FriendProfile, req.firebaseUser);
      const displayName = String(req.body?.displayName || '').trim();
      const bio = String(req.body?.bio || '').trim();

      if (displayName) profile.displayName = displayName;
      profile.bio = bio;
      await profile.save();

      return res.json({ profile: toPublicProfile(profile) });
    } catch (error) {
      console.error('friends profile update error', error);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  router.get('/contacts', authRequired, async (req, res) => {
    try {
      const profile = await ensureProfile(FriendProfile, req.firebaseUser);
      const contacts = await FriendProfile.find({ uniqueId: { $in: profile.contacts || [] } }).lean();
      const withStats = await Promise.all(
        contacts.map(async (contact) => {
          const stats = await buildContactWithStats({ FriendMessage, meUid: profile.uid, contact });
          const pref = profile.contactPrefs?.get
            ? profile.contactPrefs.get(contact.uniqueId)
            : profile.contactPrefs?.[contact.uniqueId];
          return {
            ...stats,
            online: isUidOnline(contact.uid),
            lastSeen: lastSeenByUid.get(contact.uid) || contact.updatedAt || null,
            preferences: {
              muted: !!pref?.muted,
              notifications: pref?.notifications !== false,
              notificationSound: pref?.notificationSound || 'soft',
              defaultDisappearPolicy: pref?.defaultDisappearPolicy || { mode: 'keep' }
            }
          };
        })
      );
      withStats.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
      return res.json({ contacts: withStats });
    } catch (error) {
      console.error('friends contacts error', error);
      return res.status(500).json({ error: 'Failed to load contacts.' });
    }
  });

  router.get('/search', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const q = String(req.query?.query || '').trim();
      if (!q) return res.json({ users: [] });

      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const users = await FriendProfile.find({
        $and: [
          { uniqueId: { $ne: me.uniqueId } },
          {
            $or: [
              { uniqueId: regex },
              { displayName: regex },
              { email: regex },
              { phoneNumber: regex }
            ]
          }
        ]
      })
        .limit(15)
        .lean();

      return res.json({ users: users.map(toPublicProfile) });
    } catch (error) {
      console.error('friends search error', error);
      return res.status(500).json({ error: 'Failed to search users.' });
    }
  });

  router.post('/contacts', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const targetUniqueId = String(req.body?.targetUniqueId || '').trim();
      if (!targetUniqueId) return res.status(400).json({ error: 'targetUniqueId required.' });

      if (targetUniqueId === me.uniqueId) {
        return res.status(400).json({ error: 'You cannot add yourself.' });
      }

      const target = await FriendProfile.findOne({ uniqueId: targetUniqueId });
      if (!target) return res.status(404).json({ error: 'User not found.' });

      me.contacts = Array.from(new Set([...(me.contacts || []), target.uniqueId]));
      target.contacts = Array.from(new Set([...(target.contacts || []), me.uniqueId]));
      await me.save();
      await target.save();

      return res.json({ added: toPublicProfile(target) });
    } catch (error) {
      console.error('friends add contact error', error);
      return res.status(500).json({ error: 'Failed to add contact.' });
    }
  });

  router.put('/contacts/:targetUniqueId/preferences', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const targetUniqueId = String(req.params.targetUniqueId || '').trim();
      if (!targetUniqueId) return res.status(400).json({ error: 'targetUniqueId required.' });

      if (!Array.isArray(me.contacts) || !me.contacts.includes(targetUniqueId)) {
        return res.status(404).json({ error: 'Contact not found in your friends list.' });
      }

      const muted = !!req.body?.muted;
      const notifications = req.body?.notifications !== false;
      const notificationSound = String(req.body?.notificationSound || 'soft');
      const defaultDisappearPolicy = req.body?.defaultDisappearPolicy && typeof req.body.defaultDisappearPolicy === 'object'
        ? req.body.defaultDisappearPolicy
        : { mode: 'keep' };

      me.contactPrefs.set(targetUniqueId, { muted, notifications, notificationSound, defaultDisappearPolicy });
      me.markModified('contactPrefs');
      await me.save();

      return res.json({
        targetUniqueId,
        preferences: {
          muted,
          notifications,
          notificationSound,
          defaultDisappearPolicy
        }
      });
    } catch (error) {
      console.error('friends update preferences error', error);
      return res.status(500).json({ error: 'Failed to update contact preferences.' });
    }
  });

  router.get('/conversations/:contactUniqueId/messages', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const contact = await FriendProfile.findOne({ uniqueId: req.params.contactUniqueId });
      if (!contact) return res.status(404).json({ error: 'Contact not found.' });

      const conversationId = conversationIdFor(me.uid, contact.uid);
      await pruneExpired(FriendMessage, conversationId);

      const rawMessages = await FriendMessage.find({ conversationId }).sort({ createdAt: 1 }).lean();
      const mapped = await Promise.all(rawMessages.map((msg) => mapMessageForClient(FriendProfile, msg, me.uid)));

      return res.json({ messages: mapped });
    } catch (error) {
      console.error('friends messages error', error);
      return res.status(500).json({ error: 'Failed to load conversation.' });
    }
  });

  app.use('/api/friends', router);

  const friendsNsp = io.of('/friends');

  friendsNsp.use(async (socket, next) => {
    if (!enabled) {
      return next(new Error('Firebase auth backend not configured.'));
    }
    const token = socket.handshake?.auth?.token || '';
    if (!token) return next(new Error('Missing auth token.'));

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      socket.data.firebaseUser = decoded;
      return next();
    } catch (error) {
      return next(new Error('Invalid auth token.'));
    }
  });

  friendsNsp.on('connection', async (socket) => {
    try {
      const firebaseUser = socket.data.firebaseUser;
      const me = await ensureProfile(FriendProfile, firebaseUser);

      socket.data.profile = me;
      socket.join(`user:${me.uid}`);
      setUserOnline(me.uid);
      const allowTypingEvent = createSimpleRateLimiter({ limit: 20, windowMs: 10 * 1000 });
      const allowSendEvent = createSimpleRateLimiter({ limit: 12, windowMs: 10 * 1000 });

      for (const contactUniqueId of me.contacts || []) {
        const contact = await FriendProfile.findOne({ uniqueId: contactUniqueId }).lean();
        if (!contact) continue;
        friendsNsp.to(`user:${contact.uid}`).emit('friends:presence', {
          uniqueId: me.uniqueId,
          online: true,
          lastSeen: lastSeenByUid.get(me.uid) || null
        });
      }

      socket.on('friends:join_conversation', async ({ withUniqueId }) => {
        try {
          const other = await FriendProfile.findOne({ uniqueId: withUniqueId });
          if (!other) {
            socket.emit('friends:error', { message: 'Contact not found.' });
            return;
          }

          const conversationId = conversationIdFor(me.uid, other.uid);
          socket.join(`conversation:${conversationId}`);
          await pruneExpired(FriendMessage, conversationId);

          const rawMessages = await FriendMessage.find({ conversationId }).sort({ createdAt: 1 }).lean();
          const history = await Promise.all(rawMessages.map((msg) => mapMessageForClient(FriendProfile, msg, me.uid)));
          socket.emit('friends:history', {
            withUniqueId,
            messages: history
          });
        } catch (error) {
          console.error('friends:join_conversation failed', error);
          socket.emit('friends:error', { message: 'Failed to open conversation.' });
        }
      });

      socket.on('friends:send_message', async ({ toUniqueId, text, disappearPolicy, clientTempId }, ack) => {
        try {
          if (!allowSendEvent()) {
            if (typeof ack === 'function') ack({ ok: false, error: 'Rate limit exceeded. Please slow down.' });
            return;
          }

          const cleanText = sanitizeMessageText(text);
          if (!cleanText) {
            if (typeof ack === 'function') ack({ ok: false, error: 'Message cannot be empty.' });
            return;
          }

          const recipient = await FriendProfile.findOne({ uniqueId: toUniqueId });
          if (!recipient) {
            socket.emit('friends:error', { message: 'Recipient not found.' });
            if (typeof ack === 'function') ack({ ok: false, error: 'Recipient not found.' });
            return;
          }

          const conversationId = conversationIdFor(me.uid, recipient.uid);
          const expiresAt = parseDisappearingPolicy(disappearPolicy);

          const recipientRoom = friendsNsp.adapter.rooms.get(`user:${recipient.uid}`);
          const deliveredAt = recipientRoom && recipientRoom.size > 0 ? new Date() : null;

          const saved = await FriendMessage.create({
            conversationId,
            fromUid: me.uid,
            toUid: recipient.uid,
            text: cleanText,
            disappearPolicy: disappearPolicy || { mode: 'keep' },
            expiresAt,
            deliveredAt
          });

          const payloadForSender = await mapMessageForClient(FriendProfile, saved, me.uid);
          const payloadForRecipient = await mapMessageForClient(FriendProfile, saved, recipient.uid);

          friendsNsp.to(`conversation:${conversationId}`).emit('friends:new_message', {
            withUniqueId: me.uniqueId,
            message: payloadForRecipient,
            clientTempId: clientTempId || null
          });

          socket.emit('friends:new_message', {
            withUniqueId: recipient.uniqueId,
            message: payloadForSender,
            clientTempId: clientTempId || null
          });

          friendsNsp.to(`user:${recipient.uid}`).emit('friends:new_message', {
            withUniqueId: me.uniqueId,
            message: payloadForRecipient,
            clientTempId: clientTempId || null
          });

          if (typeof ack === 'function') {
            ack({ ok: true, messageId: String(saved._id), clientTempId: clientTempId || null });
          }
        } catch (error) {
          console.error('friends:send_message failed', error);
          socket.emit('friends:error', { message: 'Failed to send message.' });
          if (typeof ack === 'function') ack({ ok: false, error: 'Failed to send message.' });
        }
      });

      socket.on('friends:typing', async ({ toUniqueId, isTyping }) => {
        try {
          if (!allowTypingEvent()) return;
          const recipient = await FriendProfile.findOne({ uniqueId: toUniqueId }).lean();
          if (!recipient) return;
          friendsNsp.to(`user:${recipient.uid}`).emit('friends:typing', {
            fromUniqueId: me.uniqueId,
            isTyping: !!isTyping
          });
        } catch (error) {
          console.error('friends:typing failed', error);
        }
      });

      socket.on('friends:mark_read', async ({ withUniqueId }) => {
        try {
          const other = await FriendProfile.findOne({ uniqueId: withUniqueId });
          if (!other) return;

          const conversationId = conversationIdFor(me.uid, other.uid);
          const now = new Date();
          const unreadMessages = await FriendMessage.find({
            conversationId,
            fromUid: other.uid,
            toUid: me.uid,
            readAt: null,
            ...getActiveMessageFilter()
          }).select('_id');

          if (unreadMessages.length === 0) return;

          const messageIds = unreadMessages.map((m) => String(m._id));

          await FriendMessage.updateMany(
            { _id: { $in: unreadMessages.map((m) => m._id) } },
            {
              $set: {
                readAt: now,
                deliveredAt: now
              }
            }
          );

          socket.emit('friends:read_update', {
            withUniqueId: other.uniqueId,
            messageIds,
            readAt: now.toISOString()
          });

          friendsNsp.to(`user:${other.uid}`).emit('friends:read_update', {
            withUniqueId: me.uniqueId,
            messageIds,
            readAt: now.toISOString()
          });
        } catch (error) {
          console.error('friends:mark_read failed', error);
        }
      });

      socket.on('friends:mark_unread', async ({ withUniqueId }) => {
        try {
          const other = await FriendProfile.findOne({ uniqueId: withUniqueId });
          if (!other) return;

          const conversationId = conversationIdFor(me.uid, other.uid);
          const latestReadFromOther = await FriendMessage.findOne({
            conversationId,
            fromUid: other.uid,
            toUid: me.uid,
            readAt: { $ne: null },
            ...getActiveMessageFilter()
          }).sort({ createdAt: -1 });

          if (!latestReadFromOther) return;

          latestReadFromOther.readAt = null;
          await latestReadFromOther.save();

          socket.emit('friends:unread_update', {
            withUniqueId: other.uniqueId,
            messageId: String(latestReadFromOther._id)
          });
        } catch (error) {
          console.error('friends:mark_unread failed', error);
        }
      });

      socket.on('disconnect', async () => {
        try {
          setUserOffline(me.uid);
          const isOnline = isUidOnline(me.uid);
          const lastSeen = lastSeenByUid.get(me.uid) || null;

          for (const contactUniqueId of me.contacts || []) {
            const contact = await FriendProfile.findOne({ uniqueId: contactUniqueId }).lean();
            if (!contact) continue;
            friendsNsp.to(`user:${contact.uid}`).emit('friends:presence', {
              uniqueId: me.uniqueId,
              online: isOnline,
              lastSeen
            });
          }
        } catch (disconnectError) {
          console.error('friends disconnect presence error', disconnectError);
        }
      });
    } catch (error) {
      console.error('friends namespace init error', error);
      socket.emit('friends:error', { message: 'Failed to initialize friends session.' });
    }
  });

  console.log(`✅ Friends module mounted (firebase ${enabled ? 'enabled' : 'disabled'})`);
};

module.exports = { setupFriendsFeature };
