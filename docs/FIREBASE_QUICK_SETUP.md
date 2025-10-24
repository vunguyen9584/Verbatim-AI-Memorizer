# 🔥 Firebase Quick Setup - Fix "client is offline" Error

## Problem

You're seeing this error:
```
Error ensuring user document: FirebaseError: Failed to get document because the client is offline.
```

This means Firebase is not configured yet. Follow these steps to fix it:

## Quick Fix (5 minutes)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" (or use existing project)
3. Give it a name (e.g., "verbatim-memorizer")
4. Follow the wizard (you can disable Google Analytics for now)

### Step 2: Enable Authentication

1. In your Firebase project, click **Authentication** in sidebar
2. Click "Get started"
3. Enable **Google** provider:
   - Click on "Google"
   - Toggle "Enable"
   - Click "Save"
4. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable" for the FIRST option
   - Toggle "Enable" for **Email link (passwordless sign-in)**
   - Click "Save"

### Step 3: Create Firestore Database

1. Click **Firestore Database** in sidebar
2. Click "Create database"
3. Choose "Start in **test mode**" (for development)
4. Choose a location (closest to you)
5. Click "Enable"

### Step 4: Get Firebase Config

1. Click the ⚙️ gear icon (Settings) in sidebar
2. Go to "Project settings"
3. Scroll down to "Your apps"
4. Click the `</>` (web) icon
5. Register app with a nickname (e.g., "Web App")
6. Copy the `firebaseConfig` object

It will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 5: Create .env File

1. In your project root, create a file named `.env` (copy from `.env.example`)
2. Fill in your Firebase values:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Add your Gemini API key too
GEMINI_API_KEY=your_gemini_key_here
```

### Step 6: Restart Dev Server

1. Stop your dev server (Ctrl+C)
2. Run `npm run dev` again
3. Open http://localhost:3000

## ✅ Success!

You should now see the AuthGate with Google and Email sign-in options!

## Still Having Issues?

### Issue: "Firebase not configured" warning

**Solution**: Make sure your `.env` file has the correct Firebase values and restart dev server.

### Issue: "Unauthorized domain" error

**Solution**: 
1. Go to Firebase Console > Authentication > Settings > Authorized domains
2. Add `localhost` to the list

### Issue: Still seeing "offline" error

**Solution**:
1. Check your internet connection
2. Make sure Firestore database is created
3. Check browser console for more details

## Need More Help?

See the full guide: [docs/Firebase-Setup.md](docs/Firebase-Setup.md)

---

**Note**: The `.env` file is gitignored, so it won't be committed to version control. This keeps your credentials safe! 🔒

