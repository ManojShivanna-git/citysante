// Firebase Admin SDK is NOT used in Isanthe Phase 1.
//
// Push notifications are sent via the Expo Push Service (exp.host/--/api/v2/push/send)
// which handles FCM delivery to Android and APNs to iOS automatically.
//
// Direct Firebase Admin is only needed if you want to bypass Expo and send
// FCM messages yourself — not required for Phase 1.
//
// If you add Firebase Auth, Firestore, or direct FCM in Phase 2, initialise here:
//
// import admin from 'firebase-admin'
// if (!admin.apps.length) {
//   admin.initializeApp({ credential: admin.credential.cert({...}) })
// }
// export default admin
