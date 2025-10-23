# Firebase Setup Guide

This guide will help you set up Firebase Authentication and Firestore for the Verbatim AI Memorizer app.

## Prerequisites

- A Google account
- Node.js and npm installed

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

## Step 2: Enable Authentication

1. In your Firebase project, navigate to **Authentication** in the left sidebar
2. Click "Get Started" if it's your first time
3. Enable the following sign-in methods:
   - **Google**: Click on Google provider and toggle "Enable"
   - **Email/Password**: Click on Email/Password provider, toggle "Enable", and also enable **Email link (passwordless sign-in)**

## Step 3: Add Your App to Firebase

1. In Project Settings (gear icon), scroll to "Your apps"
2. Click the web icon (`</>`) to add a web app
3. Register your app with a nickname (e.g., "Verbatim AI Memorizer")
4. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

1. Create a `.env` file in the project root (copy from `.env.example` if available)
2. Add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. Replace the placeholder values with your actual Firebase config values

## Step 5: Configure Authorized Domains

1. In Firebase Console, go to **Authentication > Settings > Authorized domains**
2. Add your app's domains:
   - `localhost` (for development)
   - Your production domain (e.g., `your-app.vercel.app`)

## Step 6: Set Up Firestore Database

1. In Firebase Console, navigate to **Firestore Database**
2. Click "Create database"
3. Choose "Start in test mode" for development (or production mode if you prefer)
4. Select a location for your database

## Step 7: Configure Firestore Security Rules

1. In Firestore Database, go to the **Rules** tab
2. Replace the rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - each user can only read/write their own document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add other collections as needed (lessons, folders, etc.)
    // For now, allow authenticated users to read/write their own data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish" to save the rules

## Step 8: Test Authentication

1. Start your development server: `npm run dev`
2. Open the app in your browser
3. Try signing in with Google
4. Try signing up with email (check your email for the activation link)

## Troubleshooting

### Email link not working
- Verify that Email link (passwordless sign-in) is enabled in Firebase Console
- Check that your domain is added to Authorized domains
- Make sure you're clicking the link on the same device/browser where you initiated sign-up

### Google sign-in popup blocked
- Allow popups in your browser settings
- Try using incognito mode to rule out extensions

### Firestore permission denied
- Verify that your security rules match the configuration above
- Make sure the user is authenticated before trying to write to Firestore

### Environment variables not loading
- Make sure your `.env` file is in the project root
- Restart your dev server after changing `.env`
- Check that variable names start with `VITE_` (required for Vite)

## Production Deployment

When deploying to production:

1. Update Authorized domains in Firebase Console to include your production domain
2. Set environment variables in your hosting platform (Vercel, Netlify, etc.)
3. Update Firestore security rules to production mode if needed
4. Consider setting up Firebase App Check for additional security

## Security Best Practices

- Never commit `.env` to version control (it's in `.gitignore`)
- Use production-mode Firestore rules in production
- Regularly review Firebase Console for security recommendations
- Enable Firebase App Check for production apps
- Monitor Firebase Usage & Billing

## Additional Resources

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

