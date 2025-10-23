# Authentication Deployment Checklist

Use this checklist to deploy the authentication feature to production.

## Pre-Deployment

### 1. Firebase Project Setup

- [ ] Create Firebase project (or use existing)
- [ ] Enable Authentication methods:
  - [ ] Google Sign-in
  - [ ] Email/Password (with Email link enabled)
- [ ] Create Firestore database
- [ ] Set up Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Lessons and folders - owned by user
    match /lessons/{lessonId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    match /folders/{folderId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

- [ ] Add your domain to Authorized domains in Authentication settings
- [ ] Configure email templates in Authentication > Templates

### 2. Environment Variables

Create `.env` file with your Firebase configuration:

```env
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Local Testing

- [ ] Test Google sign-in flow
  - [ ] First-time sign-in creates user profile
  - [ ] Subsequent sign-ins work without issues
  - [ ] Sign-out works correctly
  
- [ ] Test Email link sign-up flow
  - [ ] Form validation works
  - [ ] Email link is sent
  - [ ] Click link completes sign-in (same device)
  - [ ] Click link prompts for email (different device)
  - [ ] User profile created with correct data
  
- [ ] Test authentication gate
  - [ ] Unauthenticated users cannot access app
  - [ ] Authenticated users can access all features
  - [ ] Auth state persists on page refresh
  
- [ ] Test in both languages (EN/VI)
  - [ ] All auth strings translated correctly
  - [ ] Form validation messages in correct language

### 4. Code Quality

- [ ] No linter errors: `npm run lint` (if configured)
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in browser
- [ ] All TODO items completed

## Deployment

### Option 1: Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel project settings
4. Deploy
5. Add Vercel domain to Firebase Authorized domains

### Option 2: Netlify

1. Push code to GitHub
2. Connect repository to Netlify
3. Add environment variables in Netlify build settings
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Deploy
7. Add Netlify domain to Firebase Authorized domains

### Option 3: Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize hosting: `firebase init hosting`
4. Build: `npm run build`
5. Deploy: `firebase deploy --only hosting`
6. Domain already authorized (same project)

## Post-Deployment

### 1. Smoke Tests

- [ ] Visit production URL
- [ ] Test Google sign-in on production
- [ ] Test Email sign-up on production
- [ ] Verify email link works in production
- [ ] Test sign-out
- [ ] Test all learning modes
- [ ] Test lesson/folder management
- [ ] Test language switching

### 2. Security Review

- [ ] Firebase security rules are in production mode
- [ ] Environment variables not exposed in client
- [ ] HTTPS enforced on production domain
- [ ] Firebase App Check enabled (optional but recommended)

### 3. Monitoring Setup

- [ ] Enable Firebase Analytics (optional)
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Monitor Firebase Authentication usage
- [ ] Monitor Firestore usage and costs

### 4. Documentation

- [ ] Update README with production URL
- [ ] Document any environment-specific configurations
- [ ] Share Firebase Setup guide with team
- [ ] Update API documentation if applicable

## Rollback Plan

If issues arise in production:

1. **Quick rollback**: Revert to previous deployment
2. **Auth issues**: Disable problematic auth method in Firebase Console
3. **Data issues**: Firestore has automatic backups (if enabled)
4. **Complete rollback**: Deploy previous working version

## Known Issues & Workarounds

### Issue: Email link not working on mobile
**Workaround**: User can copy link and paste in same browser, or enter email when prompted

### Issue: Popup blocked for Google sign-in
**Workaround**: User must allow popups for the domain

### Issue: Session persists after sign-out
**Workaround**: Clear browser cache/cookies

## Performance Optimization

Consider these optimizations for production:

- [ ] Enable Firebase App Check
- [ ] Set up Firestore indexes for common queries
- [ ] Enable compression on hosting
- [ ] Use CDN for static assets
- [ ] Implement code splitting (dynamic imports)
- [ ] Lazy load auth components

## Maintenance

Regular tasks:

- **Weekly**: Review Firebase Console for errors
- **Monthly**: Check Firebase usage and billing
- **Quarterly**: Review and update security rules
- **As needed**: Update Firebase SDK versions

## Support

For issues or questions:

- Firebase Support: https://firebase.google.com/support
- Documentation: See `docs/` folder
- Project Issues: GitHub Issues (if applicable)

