# Cloudinary Setup for DevChat Pro

Currently, file and voice message uploads use Cloudinary placeholders. Here's how to configure it:

## Quick Setup (5 minutes)

1. **Create Free Account**
   - Go to https://cloudinary.com/users/register_free
   - Sign up (free tier: 25GB storage, 25GB bandwidth/month)

2. **Get Your Cloud Name**
   - After login, go to Dashboard
   - Copy your **Cloud Name** (e.g., `dxyz123abc`)

3. **Create Upload Preset**
   - Go to Settings → Upload
   - Scroll to "Upload presets"
   - Click "Add upload preset"
   - Name it: `devchat_uploads`
   - Set **Signing Mode**: "Unsigned"
   - Save

4. **Update Code**
   
   In `frontend/src/App.js`, replace `YOUR_CLOUD_NAME` with your cloud name:
   
   ```javascript
   // Line ~383 (file upload)
   const res = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload', {
   // Change to:
   const res = await fetch('https://api.cloudinary.com/v1_1/dxyz123abc/auto/upload', {
   
   // Line ~510 (voice messages)
   const res = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload', {
   // Change to:
   const res = await fetch('https://api.cloudinary.com/v1_1/dxyz123abc/auto/upload', {
   ```

5. **Rebuild & Deploy**
   ```bash
   npm run build
   git add -A
   git commit -m "config: add Cloudinary credentials"
   git push
   ```

## Alternative: Use Environment Variables (Recommended)

Create `.env` in frontend folder:
```env
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=devchat_uploads
```

Then in code:
```javascript
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME';
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'devchat_uploads';

fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
  // ...
  formData.append('upload_preset', UPLOAD_PRESET);
})
```

## Test Upload
1. Join a room
2. Click 📎 button to upload an image
3. Click 🎤 button to record voice message
4. Check Cloudinary dashboard → Media Library to see uploads

## Troubleshooting

**Error: "Upload preset must be whitelisted"**
- Make sure upload preset is set to **Unsigned**

**Error: "Invalid cloud name"**
- Double-check Cloud Name in dashboard

**Files not showing**
- Check browser console for CORS errors
- Verify `upload_preset` name matches exactly

## Free Tier Limits
- 25 GB storage
- 25 GB bandwidth/month
- Should handle ~5,000 images or ~1,000 voice messages/month
