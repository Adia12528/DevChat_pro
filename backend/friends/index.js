const express = require('express');
// ...existing code...
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
      },
      settings: {
        theme: { type: String, default: 'light' },
        notifications: { type: Boolean, default: true }
      }
    },
    { timestamps: true }
  );

  const FriendMessageSchema = new mongoose.Schema(
    {
      conversationId: { type: String, index: true },
      fromUid: { type: String, index: true },
      toUid: { type: String, index: true },
      clientTempId: { type: String, default: null, index: true },
      text: { type: String, required: true },
      disappearPolicy: { type: Object, default: { mode: 'keep' } },
      expiresAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      readAt: { type: Date, default: null },
      reactions: {
        type: [
          {
            user: { type: String, required: true }, // uid
            emoji: { type: String, required: true }
          }
        ],
        default: []
      },
      editedAt: { type: Date, default: null },
      deleted: { type: Boolean, default: false }
    },
    { timestamps: true }
  );

  // Idempotency key for client retries: same sender->recipient with same temp id resolves to one message.
  FriendMessageSchema.index(
    { fromUid: 1, toUid: 1, clientTempId: 1 },
    { unique: true, sparse: true, name: 'friends_unique_temp_send' }
  );

  const FriendProfile = mongoose.models.FriendProfile || mongoose.model('FriendProfile', FriendProfileSchema);
  const FriendMessage = mongoose.models.FriendMessage || mongoose.model('FriendMessage', FriendMessageSchema);
    const FriendRequestSchema = new mongoose.Schema(
      {
        fromUid: { type: String, required: true, index: true },
        toUid: { type: String, required: true, index: true },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      },
      { timestamps: true }
    );
    const FriendRequest = mongoose.models.FriendRequest || mongoose.model('FriendRequest', FriendRequestSchema);
    // Add FriendRequest to returned models
    return { FriendProfile, FriendMessage, FriendRequest };

  return { FriendProfile, FriendMessage };
};

const toPublicProfile = (profile) => ({
  uniqueId: profile.uniqueId,
  displayName: profile.displayName || '',
  bio: profile.bio || '',
  photoURL: profile.photoURL || '',
  email: profile.email || '',
  phoneNumber: profile.phoneNumber || '',
  settings: {
    theme: profile.settings?.theme || 'light',
    notifications: profile.settings?.notifications !== false
  }
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
    // Emit a global event for new user registration
    if (typeof global !== 'undefined' && global.friendsNsp) {
      global.friendsNsp.emit('users:new_user', {
        uid: profile.uid,
        uniqueId: profile.uniqueId,
        displayName: profile.displayName,
        photoURL: profile.photoURL
      });
    }
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
    clientTempId: message.clientTempId || null,
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

const findExistingByClientTempId = async (FriendMessage, { fromUid, toUid, clientTempId }) => {
  const tempId = String(clientTempId || '').trim();
  if (!tempId) return null;
  return FriendMessage.findOne({
    fromUid,
    toUid,
    clientTempId: tempId
  });
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
  if (!enabled) {
    console.warn('[FRIENDS] Firebase Admin not enabled. Friends API will NOT be available.');
  } else {
    console.log('[FRIENDS] Firebase Admin enabled. Mounting /api/friends routes.');
  }
  const { FriendProfile, FriendMessage } = getModels(mongoose);
  const { FriendRequest } = getModels(mongoose);
  const authRequired = friendsAuthMiddleware(enabled);

  // Router must be initialized after dependencies
  const router = express.Router();

  // Delete a single message by ID
  router.delete('/messages/:messageId', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const messageId = req.params.messageId;
      if (!messageId) return res.status(400).json({ error: 'messageId required.' });
      const msg = await FriendMessage.findById(messageId);
      if (!msg) return res.status(404).json({ error: 'Message not found.' });
      if (msg.fromUid !== me.uid) return res.status(403).json({ error: 'Not authorized to delete this message.' });
      // Restrict deleting to within 12 hours of creation
      const created = new Date(msg.createdAt).getTime();
      const now = Date.now();
      if ((now - created) > 12 * 60 * 60 * 1000) {
        return res.status(403).json({ error: 'Deleting is only allowed within 12 hours of sending.' });
      }
      await msg.deleteOne();
      return res.json({ ok: true });
    } catch (error) {
      console.error('friends delete message error', error);
      return res.status(500).json({ error: 'Failed to delete message.' });
    }
  });

  // Edit a message
  router.put('/messages/:messageId/edit', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const messageId = req.params.messageId;
      const newText = sanitizeMessageText(req.body?.text || '');
      if (!messageId) return res.status(400).json({ error: 'messageId required.' });
      if (!newText) return res.status(400).json({ error: 'Message text required.' });
      const msg = await FriendMessage.findById(messageId);
      if (!msg) return res.status(404).json({ error: 'Message not found.' });
      if (msg.fromUid !== me.uid) return res.status(403).json({ error: 'Not authorized to edit this message.' });
      // Restrict editing to within 12 hours of creation
      const created = new Date(msg.createdAt).getTime();
      const now = Date.now();
      if ((now - created) > 12 * 60 * 60 * 1000) {
        return res.status(403).json({ error: 'Editing is only allowed within 12 hours of sending.' });
      }
      msg.text = newText;
      msg.editedAt = new Date();
      await msg.save();
      return res.json({ ok: true, message: await mapMessageForClient(FriendProfile, msg, me.uid) });
    } catch (error) {
      console.error('friends edit message error', error);
      return res.status(500).json({ error: 'Failed to edit message.' });
    }
  });

  // ...existing code for other routes...

  // Mount the router on /api/friends
  app.use('/api/friends', router);
  // Do not return the router


  // React to a message
  router.post('/messages/:messageId/react', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const messageId = req.params.messageId;
      const emoji = String(req.body?.emoji || '').trim();
      if (!messageId) return res.status(400).json({ error: 'messageId required.' });
      if (!emoji) return res.status(400).json({ error: 'Emoji required.' });
      const msg = await FriendMessage.findById(messageId);
      if (!msg) return res.status(404).json({ error: 'Message not found.' });
      // Remove previous reaction by this user (if any)
      msg.reactions = (msg.reactions || []).filter(r => r.user !== me.uid);
      // Add new reaction
      msg.reactions.push({ user: me.uid, emoji });
      await msg.save();
      return res.json({ ok: true, message: await mapMessageForClient(FriendProfile, msg, me.uid) });
    } catch (error) {
      console.error('friends react message error', error);
      return res.status(500).json({ error: 'Failed to react to message.' });
    }
  });
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

  // Clear all messages in a conversation between the authenticated user and a contact
  router.post('/messages/:contactUniqueId/delete', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const contactUniqueId = req.params.contactUniqueId;
      if (!contactUniqueId) return res.status(400).json({ error: 'contactUniqueId required.' });
      const contact = await FriendProfile.findOne({ uniqueId: contactUniqueId });
      if (!contact) return res.status(404).json({ error: 'Contact not found.' });
      const conversationId = conversationIdFor(me.uid, contact.uid);
      await FriendMessage.deleteMany({ conversationId });
      return res.json({ ok: true });
    } catch (error) {
      console.error('friends clear chat error', error);
      return res.status(500).json({ error: 'Failed to clear chat.' });
    }
  });

  // --- Friend Request API ---
  router.post('/request', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const toUniqueId = String(req.body?.toUniqueId || req.body?.targetUniqueId || '').trim();
      if (!toUniqueId) return res.status(400).json({ error: 'targetUniqueId required.' });
      if (toUniqueId === me.uniqueId) return res.status(400).json({ error: 'Cannot send request to yourself.' });
      const toProfile = await FriendProfile.findOne({ uniqueId: toUniqueId });
      if (!toProfile) return res.status(404).json({ error: 'User not found.' });
      // Check for existing request
      const existing = await FriendRequest.findOne({ fromUid: me.uid, toUid: toProfile.uid, status: 'pending' });
      if (existing) return res.status(409).json({ error: 'Request already sent.' });
      // Check if already friends
      if (me.contacts.includes(toProfile.uniqueId)) return res.status(409).json({ error: 'Already friends.' });
      const request = await FriendRequest.create({ fromUid: me.uid, toUid: toProfile.uid });
      // Emit real-time event to recipient
      friendsNsp.to(`user:${toProfile.uid}`).emit('friends:new_request', {
        requestId: String(request._id),
        fromUniqueId: me.uniqueId,
        createdAt: request.createdAt
      });
      return res.json({ ok: true, request });
    } catch (error) {
      console.error('friends request error', error);
      return res.status(500).json({ error: 'Failed to send request.' });
    }
  });

  router.get('/requests', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      // Incoming requests
      const incoming = await FriendRequest.find({ toUid: me.uid, status: 'pending' }).lean();
      // Outgoing requests
      const outgoing = await FriendRequest.find({ fromUid: me.uid, status: 'pending' }).lean();
      return res.json({ incoming, outgoing });
    } catch (error) {
      console.error('friends requests error', error);
      return res.status(500).json({ error: 'Failed to load requests.' });
    }
  });

  router.post('/request/:requestId/accept', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const requestId = req.params.requestId;
      const request = await FriendRequest.findById(requestId);
      if (!request || request.status !== 'pending') return res.status(404).json({ error: 'Request not found.' });
      if (request.toUid !== me.uid) return res.status(403).json({ error: 'Not authorized.' });
      // Update request
      request.status = 'accepted';
      request.updatedAt = new Date();
      await request.save();
      // Add each other as contacts
      const fromProfile = await FriendProfile.findOne({ uid: request.fromUid });
      if (!fromProfile) return res.status(404).json({ error: 'Sender not found.' });
      me.contacts = Array.from(new Set([...(me.contacts || []), fromProfile.uniqueId]));
      fromProfile.contacts = Array.from(new Set([...(fromProfile.contacts || []), me.uniqueId]));
      await me.save();
      await fromProfile.save();
      // Emit real-time event to sender
      friendsNsp.to(`user:${fromProfile.uid}`).emit('friends:request_accepted', {
        requestId: String(request._id),
        toUniqueId: me.uniqueId,
        createdAt: request.createdAt
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('friends accept request error', error);
      return res.status(500).json({ error: 'Failed to accept request.' });
    }
  });

  router.post('/request/:requestId/reject', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const requestId = req.params.requestId;
      const request = await FriendRequest.findById(requestId);
      if (!request || request.status !== 'pending') return res.status(404).json({ error: 'Request not found.' });
      if (request.toUid !== me.uid) return res.status(403).json({ error: 'Not authorized.' });
      request.status = 'rejected';
      request.updatedAt = new Date();
      await request.save();
      // Emit real-time event to sender
      friendsNsp.to(`user:${request.fromUid}`).emit('friends:request_rejected', {
        requestId: String(request._id),
        toUniqueId: me.uniqueId,
        createdAt: request.createdAt
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('friends reject request error', error);
      return res.status(500).json({ error: 'Failed to reject request.' });
    }
  });

  // Remove friend endpoint
  router.post('/remove', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const targetUniqueId = String(req.body?.targetUniqueId || '').trim();
      if (!targetUniqueId) return res.status(400).json({ error: 'targetUniqueId required.' });
      if (!me.contacts.includes(targetUniqueId)) return res.status(404).json({ error: 'Not a friend.' });
      const target = await FriendProfile.findOne({ uniqueId: targetUniqueId });
      if (!target) return res.status(404).json({ error: 'User not found.' });
      me.contacts = me.contacts.filter((id) => id !== targetUniqueId);
      target.contacts = target.contacts.filter((id) => id !== me.uniqueId);
      await me.save();
      await target.save();
      // Emit real-time event
      friendsNsp.to(`user:${target.uid}`).emit('friends:removed', {
        fromUniqueId: me.uniqueId
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error('friends remove error', error);
      return res.status(500).json({ error: 'Failed to remove friend.' });
    }
  });
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

  const listContactsHandler = async (req, res) => {
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
  };

  router.get('/contacts', authRequired, listContactsHandler);
  router.get('/list', authRequired, listContactsHandler);

  const searchHandler = async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const q = String(req.body?.query || req.query?.query || '').trim();
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
  };

  router.get('/search', authRequired, searchHandler);
  router.post('/search', authRequired, searchHandler);

  const addContactHandler = async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const targetUniqueId = String(req.body?.targetUniqueId || req.body?.friendId || '').trim();
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
  };

  router.post('/contacts', authRequired, addContactHandler);
  router.post('/add', authRequired, addContactHandler);

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

  const getMessagesHandler = async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const contactUniqueId = req.params.contactUniqueId || req.params.friendId;
      const contact = await FriendProfile.findOne({ uniqueId: contactUniqueId });
      if (!contact) return res.status(404).json({ error: 'Contact not found.' });

      const conversationId = conversationIdFor(me.uid, contact.uid);
      await pruneExpired(FriendMessage, conversationId);

      const before = req.query?.before ? new Date(req.query.before) : null;
      const hasBefore = before && !Number.isNaN(before.getTime());
      const limitValue = Number.parseInt(String(req.query?.limit || '40'), 10);
      const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 40;

      const query = {
        conversationId,
        ...getActiveMessageFilter(),
        ...(hasBefore ? { createdAt: { $lt: before } } : {})
      };

      const rawMessages = await FriendMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      const mapped = await Promise.all(rawMessages.map((msg) => mapMessageForClient(FriendProfile, msg, me.uid)));

      return res.json({ messages: mapped.reverse() });
    } catch (error) {
      console.error('friends messages error', error);
      return res.status(500).json({ error: 'Failed to load conversation.' });
    }
  };

  router.get('/conversations/:contactUniqueId/messages', authRequired, getMessagesHandler);
  router.get('/messages/:friendId', authRequired, getMessagesHandler);

  router.post('/send', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const receiverId = String(req.body?.receiverId || req.body?.toUniqueId || '').trim();
      const text = sanitizeMessageText(req.body?.message || req.body?.text || '');
      const disappearPolicy = req.body?.disappearPolicy || { mode: 'keep' };
      const clientTempId = String(req.body?.clientTempId || '').trim() || null;

      if (!receiverId) return res.status(400).json({ error: 'receiverId required.' });
      if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

      const recipient = await FriendProfile.findOne({ uniqueId: receiverId });
      if (!recipient) return res.status(404).json({ error: 'Recipient not found.' });

      const existing = await findExistingByClientTempId(FriendMessage, {
        fromUid: me.uid,
        toUid: recipient.uid,
        clientTempId
      });
      if (existing) {
        const payloadForSenderExisting = await mapMessageForClient(FriendProfile, existing, me.uid);
        return res.json({ ok: true, duplicate: true, message: payloadForSenderExisting });
      }

      const conversationId = conversationIdFor(me.uid, recipient.uid);
      const expiresAt = parseDisappearingPolicy(disappearPolicy);
      const recipientRoom = friendsNsp.adapter.rooms.get(`user:${recipient.uid}`);
      const deliveredAt = recipientRoom && recipientRoom.size > 0 ? new Date() : null;

      const saved = await FriendMessage.create({
        conversationId,
        fromUid: me.uid,
        toUid: recipient.uid,
        clientTempId,
        text,
        disappearPolicy,
        expiresAt,
        deliveredAt
      });

      const payloadForSender = await mapMessageForClient(FriendProfile, saved, me.uid);
      const payloadForRecipient = await mapMessageForClient(FriendProfile, saved, recipient.uid);

      const senderPacket = {
        withUniqueId: recipient.uniqueId,
        message: payloadForSender,
        clientTempId
      };
      const recipientPacket = {
        withUniqueId: me.uniqueId,
        message: payloadForRecipient,
        clientTempId
      };

      friendsNsp.to(`user:${me.uid}`).emit('friends:new_message', senderPacket);
      friendsNsp.to(`user:${me.uid}`).emit('new_message', senderPacket);
      friendsNsp.to(`conversation:${conversationId}`).emit('friends:new_message', recipientPacket);
      friendsNsp.to(`conversation:${conversationId}`).emit('new_message', recipientPacket);
      friendsNsp.to(`user:${recipient.uid}`).emit('friends:new_message', recipientPacket);
      friendsNsp.to(`user:${recipient.uid}`).emit('new_message', recipientPacket);

      return res.json({
        ok: true,
        message: payloadForSender
      });
    } catch (error) {
      console.error('friends send error', error);
      return res.status(500).json({ error: 'Failed to send message.' });
    }
  });

  const userRouter = express.Router();
  userRouter.post('/settings', authRequired, async (req, res) => {
    try {
      const me = await ensureProfile(FriendProfile, req.firebaseUser);
      const requestedTheme = String(req.body?.theme || 'light').toLowerCase();
      const theme = requestedTheme === 'dark' ? 'dark' : 'light';
      const notifications = req.body?.notifications !== false;

      me.settings = {
        ...(me.settings || {}),
        theme,
        notifications
      };
      me.markModified('settings');
      await me.save();

      return res.json({ ok: true, settings: me.settings });
    } catch (error) {
      console.error('friends settings update error', error);
      return res.status(500).json({ error: 'Failed to save settings.' });
    }
  });


  app.use('/api/user', userRouter);
  app.use('/api/friends', router);
  console.log('[FRIENDS] /api/friends route mounted.');

  const friendsNsp = io.of('/friends');
  // Make friendsNsp globally accessible for ensureProfile
  global.friendsNsp = friendsNsp;

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

      // Emit all available users (excluding current friends and self) to this client
      const allUsers = await FriendProfile.find({
        uniqueId: { $nin: [me.uniqueId, ...(me.contacts || [])] }
      }).lean();
      socket.emit('users:all', allUsers.map(u => ({
        uid: u.uid,
        uniqueId: u.uniqueId,
        displayName: u.displayName,
        photoURL: u.photoURL,
        email: u.email,
        phoneNumber: u.phoneNumber
      })));

      for (const contactUniqueId of me.contacts || []) {
        const contact = await FriendProfile.findOne({ uniqueId: contactUniqueId }).lean();
        if (!contact) continue;
        const presencePayload = {
          uniqueId: me.uniqueId,
          online: true,
          lastSeen: lastSeenByUid.get(me.uid) || null
        };
        friendsNsp.to(`user:${contact.uid}`).emit('friends:presence', presencePayload);
        friendsNsp.to(`user:${contact.uid}`).emit('user_online', presencePayload);
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

      const emitTypingState = async ({ toUniqueId, isTyping }) => {
        if (!allowTypingEvent()) return;
        const recipient = await FriendProfile.findOne({ uniqueId: toUniqueId }).lean();
        if (!recipient) return;
        const typingPayload = {
          fromUniqueId: me.uniqueId,
          isTyping: !!isTyping
        };
        friendsNsp.to(`user:${recipient.uid}`).emit('friends:typing', typingPayload);
        friendsNsp.to(`user:${recipient.uid}`).emit(typingPayload.isTyping ? 'typing' : 'stop_typing', typingPayload);
      };

      const emitMessagePackets = ({ conversationId, recipientUid, senderUniqueId, recipientUniqueId, payloadForSender, payloadForRecipient, clientTempId }) => {
        const senderPacket = {
          withUniqueId: recipientUniqueId,
          message: payloadForSender,
          clientTempId: clientTempId || null
        };
        const recipientPacket = {
          withUniqueId: senderUniqueId,
          message: payloadForRecipient,
          clientTempId: clientTempId || null
        };

        socket.emit('friends:new_message', senderPacket);
        socket.emit('new_message', senderPacket);

        friendsNsp.to(`conversation:${conversationId}`).emit('friends:new_message', recipientPacket);
        friendsNsp.to(`conversation:${conversationId}`).emit('new_message', recipientPacket);

        friendsNsp.to(`user:${recipientUid}`).emit('friends:new_message', recipientPacket);
        friendsNsp.to(`user:${recipientUid}`).emit('new_message', recipientPacket);
      };

      const sendMessageCore = async ({ toUniqueId, text, disappearPolicy, clientTempId }, ack) => {
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

          const normalizedTempId = String(clientTempId || '').trim() || null;
          const existing = await findExistingByClientTempId(FriendMessage, {
            fromUid: me.uid,
            toUid: recipient.uid,
            clientTempId: normalizedTempId
          });
          if (existing) {
            const payloadForSenderExisting = await mapMessageForClient(FriendProfile, existing, me.uid);
            const payloadForRecipientExisting = await mapMessageForClient(FriendProfile, existing, recipient.uid);
            const existingConversationId = conversationIdFor(me.uid, recipient.uid);

            emitMessagePackets({
              conversationId: existingConversationId,
              recipientUid: recipient.uid,
              senderUniqueId: me.uniqueId,
              recipientUniqueId: recipient.uniqueId,
              payloadForSender: payloadForSenderExisting,
              payloadForRecipient: payloadForRecipientExisting,
              clientTempId: normalizedTempId
            });

            if (typeof ack === 'function') {
              ack({ ok: true, duplicate: true, messageId: String(existing._id), clientTempId: normalizedTempId });
            }
            return;
          }

          const conversationId = conversationIdFor(me.uid, recipient.uid);
          const expiresAt = parseDisappearingPolicy(disappearPolicy);

          const recipientRoom = friendsNsp.adapter.rooms.get(`user:${recipient.uid}`);
          const deliveredAt = recipientRoom && recipientRoom.size > 0 ? new Date() : null;

          let saved;
          try {
            saved = await FriendMessage.create({
              conversationId,
              fromUid: me.uid,
              toUid: recipient.uid,
              clientTempId: normalizedTempId,
              text: cleanText,
              disappearPolicy: disappearPolicy || { mode: 'keep' },
              expiresAt,
              deliveredAt
            });
          } catch (createError) {
            if (createError?.code === 11000 && normalizedTempId) {
              saved = await findExistingByClientTempId(FriendMessage, {
                fromUid: me.uid,
                toUid: recipient.uid,
                clientTempId: normalizedTempId
              });
            } else {
              throw createError;
            }
          }

          if (!saved) {
            throw new Error('Unable to persist message');
          }

          const payloadForSender = await mapMessageForClient(FriendProfile, saved, me.uid);
          const payloadForRecipient = await mapMessageForClient(FriendProfile, saved, recipient.uid);

          emitMessagePackets({
            conversationId,
            recipientUid: recipient.uid,
            senderUniqueId: me.uniqueId,
            recipientUniqueId: recipient.uniqueId,
            payloadForSender,
            payloadForRecipient,
            clientTempId: normalizedTempId
          });

          if (typeof ack === 'function') {
            ack({ ok: true, messageId: String(saved._id), clientTempId: normalizedTempId });
          }
        } catch (error) {
          console.error('friends:send_message failed', error);
          socket.emit('friends:error', { message: 'Failed to send message.' });
          if (typeof ack === 'function') ack({ ok: false, error: 'Failed to send message.' });
        }
      };

      socket.on('friends:send_message', async (payload, ack) => {
        await sendMessageCore(payload || {}, ack);
      });

      socket.on('send_message', async (payload, ack) => {
        if (payload?.text) {
          await sendMessageCore(payload, ack);
          return;
        }
        if (typeof ack === 'function') ack({ ok: true });
      });

      socket.on('friends:typing', async ({ toUniqueId, isTyping }) => {
        try {
          await emitTypingState({ toUniqueId, isTyping });
        } catch (error) {
          console.error('friends:typing failed', error);
        }
      });

      socket.on('typing', async ({ toUniqueId }) => {
        try {
          await emitTypingState({ toUniqueId, isTyping: true });
        } catch (error) {
          console.error('typing failed', error);
        }
      });

      socket.on('stop_typing', async ({ toUniqueId }) => {
        try {
          await emitTypingState({ toUniqueId, isTyping: false });
        } catch (error) {
          console.error('stop_typing failed', error);
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
          socket.emit('read_receipt', {
            withUniqueId: other.uniqueId,
            messageIds,
            readAt: now.toISOString()
          });

          friendsNsp.to(`user:${other.uid}`).emit('friends:read_update', {
            withUniqueId: me.uniqueId,
            messageIds,
            readAt: now.toISOString()
          });
          friendsNsp.to(`user:${other.uid}`).emit('read_receipt', {
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
            const presencePayload = {
              uniqueId: me.uniqueId,
              online: isOnline,
              lastSeen
            };
            friendsNsp.to(`user:${contact.uid}`).emit('friends:presence', presencePayload);
            friendsNsp.to(`user:${contact.uid}`).emit(isOnline ? 'user_online' : 'user_offline', presencePayload);
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

module.exports = {
  setupFriendsFeature,
  __testables: {
    getModels,
    findExistingByClientTempId
  }
};
