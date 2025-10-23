# Performance Optimization Guide

## Issue: Slow Login with 400 Errors

If you're experiencing slow login times with 400 errors from Firestore, here are the optimizations implemented:

## What Was Fixed

### 1. **Non-blocking Profile Sync**
- User authentication now completes immediately
- Profile sync happens in background without blocking login
- App shows authenticated state right away

### 2. **Request Timeouts**
- Added 10-second timeout for profile reads
- Added 5-second timeout for profile writes
- Prevents hanging requests that cause 400 errors

### 3. **Better Error Handling**
- Graceful fallback when Firestore is slow/unavailable
- User can still use app with localStorage
- Clear error messages for debugging

### 4. **Reduced Firestore Calls**
- Only sync profile when necessary
- Avoid redundant reads/writes
- Cache user state locally

## Performance Tips

### For Development

1. **Use Firebase Emulator** (Optional)
   ```bash
   # Install Firebase CLI
   npm install -g firebase-tools
   
   # Start emulator
   firebase emulators:start --only firestore
   ```

2. **Check Network Tab**
   - Look for failed requests (red entries)
   - Check if requests are timing out
   - Monitor Firestore connection status

3. **Firebase Console**
   - Check Firestore usage in Firebase Console
   - Look for any quota limits
   - Monitor authentication metrics

### For Production

1. **Firestore Indexes**
   - Create indexes for common queries
   - Avoid complex queries that require multiple indexes

2. **Security Rules**
   - Keep rules simple and efficient
   - Avoid complex rule logic

3. **Connection Pooling**
   - Firebase handles this automatically
   - But ensure you're not creating multiple app instances

## Troubleshooting 400 Errors

### Common Causes

1. **Network Issues**
   - Check internet connection
   - Try different network (mobile hotspot)
   - Check if firewall is blocking Firebase

2. **Firebase Configuration**
   - Verify all environment variables are correct
   - Check Firebase project settings
   - Ensure domain is authorized

3. **Firestore Rules**
   - Rules might be too restrictive
   - Check Firebase Console > Firestore > Rules

4. **Quota Limits**
   - Check Firebase Console > Usage
   - Free tier has limits on reads/writes

### Debug Steps

1. **Check Browser Console**
   ```javascript
   // Open browser console and check for:
   console.log('Firebase config:', firebaseConfig);
   console.log('Auth state:', auth.currentUser);
   ```

2. **Test Firestore Connection**
   ```javascript
   // In browser console:
   import { doc, getDoc } from 'firebase/firestore';
   const testDoc = doc(db, 'test', 'connection');
   getDoc(testDoc).then(() => console.log('Firestore connected')).catch(console.error);
   ```

3. **Check Network Tab**
   - Look for requests to `firestore.googleapis.com`
   - Check status codes (should be 200, not 400)
   - Look for WebSocket connections

## Monitoring

### Firebase Console Metrics
- Go to Firebase Console > Project > Usage
- Check Firestore reads/writes
- Monitor authentication events

### Browser DevTools
- Network tab: Monitor all Firebase requests
- Console: Check for error messages
- Performance tab: Check for slow operations

## Best Practices

1. **Minimize Firestore Calls**
   - Cache data locally when possible
   - Use batch operations for multiple writes
   - Avoid real-time listeners unless needed

2. **Error Handling**
   - Always handle offline scenarios
   - Provide fallback data
   - Show user-friendly error messages

3. **Performance Monitoring**
   - Use Firebase Performance Monitoring
   - Track custom metrics
   - Monitor user experience

## Quick Fixes

If you're still seeing issues:

1. **Clear Browser Cache**
   - Hard refresh (Ctrl+Shift+R)
   - Clear localStorage
   - Try incognito mode

2. **Check Environment**
   ```bash
   # Verify .env file exists and has correct values
   cat .env
   
   # Restart dev server
   npm run dev
   ```

3. **Test with Minimal Config**
   - Try with just Google auth (no Firestore)
   - Test email auth separately
   - Isolate the issue

## Support

If issues persist:
- Check Firebase Status: https://status.firebase.google.com/
- Firebase Support: https://firebase.google.com/support
- GitHub Issues: Create an issue with error details
