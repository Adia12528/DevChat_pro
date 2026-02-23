# Cloudinary Setup for DevChat Pro

**✅ Cloud Name Already Configured:** `da03qqo5g`

## ⚡ Quick Setup (2 minutes)

You **DO NOT need the API Secret** for unsigned uploads (current setup).

### Step 1: Create Upload Preset

1. **Login to Cloudinary**
   - Go to https://cloudinary.com/console
   - Login with your account (`da03qqo5g`)

2. **Create Upload Preset**
   - Go to **Settings** → **Upload** tab
   - Scroll to **"Upload presets"** section
   - Click **"Add upload preset"** button
   - Configure:
     - **Preset name**: `devchat_uploads`
     - **Signing Mode**: **Unsigned** ⚠️ IMPORTANT
     - **Folder**: `devchat` (optional, keeps files organized)
     - **Use filename**: `true` (optional)
     - **Allowed formats**: `jpg,png,gif,webm,mp3,wav,pdf` (optional)
   - Click **Save**

### Step 2: Test Upload

1. **Rebuild Frontend**
   ```powershell
   cd frontend
   npm run build
   ```

2. **Commit & Push**
   ```powershell
   git add -A
   git commit -m "config: configure Cloudinary with da03qqo5g"
   git push
   ```

3. **Test After Deploy** (~90 seconds)
   - Open your app
   - Try uploading a file → Should work!
   - Try recording a voice message → Should work!

---

## 🔐 Security Note

**Current Setup: Unsigned Uploads**
- ✅ Only cloud name in code (no secrets exposed)
- ✅ Safe for frontend apps
- ✅ Cloudinary preset controls what can be uploaded
- ⚠️ Limited to preset restrictions only

**Why You DON'T Need API Secret:**
- Unsigned uploads use upload presets
- Preset acts as the security layer
- No sensitive credentials in frontend code

---

## 📊 Your Cloudinary Credentials

```
Cloud Name: da03qqo5g
API Key: 648475135154976
API Secret: (NOT needed for unsigned uploads)
```

**Where each is used:**
- **Cloud Name**: Embedded in `App.js` (lines 431 & 594) ✅ Already configured
- **API Key**: NOT USED in current setup
- **API Secret**: NOT USED in current setup

---

## 🚀 Alternative: Server-Side Upload (Optional, More Secure)

If you want **server-side signed uploads** (better for production):

### Backend Setup

1. **Install Cloudinary SDK**
   ```powershell
   cd backend
   npm install cloudinary
   ```

2. **Create backend/.env**
   ```env
   CLOUDINARY_CLOUD_NAME=da03qqo5g
   CLOUDINARY_API_KEY=648475135154976
   CLOUDINARY_API_SECRET=your_secret_here
   ```

3. **Add to server.js**
   ```javascript
   const cloudinary = require('cloudinary').v2;
   
   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET
   });
   
   // Create signed upload endpoint
   app.post('/api/upload-signature', (req, res) => {
     const timestamp = Math.round(new Date().getTime() / 1000);
     const signature = cloudinary.utils.api_sign_request(
       {
         timestamp: timestamp,
         folder: 'devchat'
       },
       process.env.CLOUDINARY_API_SECRET
     );
     
     res.json({
       signature,
       timestamp,
       cloudName: process.env.CLOUDINARY_CLOUD_NAME,
       apiKey: process.env.CLOUDINARY_API_KEY
     });
   });
   ```

4. **Update Frontend** (replace unsigned upload with signed):
   ```javascript
   // Get signature from backend
   const signRes = await fetch('http://localhost:5000/api/upload-signature');
   const { signature, timestamp, cloudName, apiKey } = await signRes.json();
   
   formData.append('signature', signature);
   formData.append('timestamp', timestamp);
   formData.append('api_key', apiKey);
   
   const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
     method: 'POST',
     body: formData
   });
   ```

**Benefits:**
- ✅ No upload presets needed
- ✅ Full control over uploads (file size, format, transformations)
- ✅ Can validate uploads server-side
- ✅ Better security (secrets never exposed)

---

## 🧪 Testing Your Setup

### After Creating Upload Preset

1. **Rebuild & Deploy**
   ```powershell
   cd frontend
   npm run build
   ```

2. **Commit Changes**
   ```powershell
   git add -A
   git commit -m "config: configure Cloudinary with da03qqo5g"
   git push
   ```

3. **Wait for Vercel Deploy** (~90 seconds)

4. **Test File Upload**
   - Open your deployed app
   - Join a room
   - Click 📎 attachment button
   - Select an image → Upload
   - Should see upload progress
   - Image appears in chat

5. **Test Voice Message**
   - Click 🎤 microphone button
   - Record voice message
   - Click stop
   - Should see "Uploading..." then play button appears

6. **Verify in Cloudinary**
   - Go to https://cloudinary.com/console/media_library
   - Should see uploaded files (in `devchat` folder if configured)

---

## 🐛 Troubleshooting

### Error: "Upload preset must be whitelisted"
**Solution**: Make sure upload preset `devchat_uploads` is set to **Unsigned** mode

### Error: "Invalid cloud name"
**Solution**: Verify cloud name is exactly `da03qqo5g` (no typos)

### Error: "Upload failed"
**Check:**
1. Upload preset exists and is named exactly `devchat_uploads`
2. Upload preset is set to **Unsigned**
3. Browser console for detailed error message
4. Cloudinary dashboard → Settings → Security → Check no IP restrictions

### Files Not Showing in Media Library
**Possible causes:**
- Upload succeeded but files in different folder
- Check "All folders" view in Media Library
- Verify preset folder setting

### CORS Errors
**Should NOT happen** - Cloudinary allows cross-origin uploads by default. If you see CORS errors:
- Check browser console for exact error
- Verify you're hitting `https://api.cloudinary.com` (not `http://`)

---

## 📊 Free Tier Limits

**Cloudinary Free Plan:**
- ✅ 25 GB storage
- ✅ 25 GB bandwidth/month
- ✅ ~5,000 images or ~1,000 voice messages/month
- ✅ Unlimited transformations

**When You'll Need to Upgrade:**
- Heavy file uploads (100+ files/day)
- Large video files
- High-traffic production app

---

## ✅ Next Steps

1. **Create `devchat_uploads` preset in Cloudinary** (2 minutes)
2. **Rebuild & push** (done above)
3. **Test uploads after deploy** (90 seconds)
4. **Start chatting with file & voice support!** 🎉
