# Friends Firebase + Socket Setup

This setup enables:
- Google sign-in via Firebase Auth
- Real phone OTP via Firebase Auth
- Backend token verification using Firebase Admin SDK
- Friends chat sync across devices using MongoDB + Socket.IO namespace `/friends`

## 1) Frontend env (`frontend/.env`)

Set these values from your Firebase Web App settings:

```bash
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...

# Existing backend URL (already used in app)
REACT_APP_BACKEND_URL=http://localhost:5000
```

## 2) Backend env (`backend/.env`)

Set Firebase Admin service account values:

```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Important:
- Keep `\n` escaped as shown in `.env`; backend converts them to real newlines.
- Do not commit these secrets.

## 3) Firebase Console required steps

1. Enable providers:
- Authentication > Sign-in method > Google: Enabled
- Authentication > Sign-in method > Phone: Enabled

2. Authorized domains:
- Add your frontend host(s), e.g. `localhost`, your Vercel domain, and custom domain.

3. For local Phone OTP testing:
- Optionally add test phone numbers in Firebase Auth settings.

## 4) Install dependencies

From repo root:

```bash
cd frontend && npm install
cd ../backend && npm install
```

New dependencies used:
- Frontend: `firebase`
- Backend: `firebase-admin`

## 5) Run

```bash
# backend
cd backend
npm start

# frontend
cd frontend
npm start
```

## 6) API/Socket summary

### REST
- `GET /api/friends/profile`
- `PUT /api/friends/profile`
- `GET /api/friends/contacts`
- `GET /api/friends/search?query=...`
- `POST /api/friends/contacts`
- `GET /api/friends/conversations/:contactUniqueId/messages`

All require `Authorization: Bearer <firebase_id_token>`.

### Socket namespace
- Namespace: `/friends`
- Handshake auth: `{ token: firebaseIdToken }`
- Events used by frontend:
  - `friends:join_conversation`
  - `friends:history`
  - `friends:send_message`
  - `friends:new_message`
  - `friends:error`

## 7) Disappearing messages

Supported policies:
- keep
- immediate
- preset: `1h`, `24h`, `3d`, `7d`
- custom datetime

Server enforces max expiry window of 7 days.
