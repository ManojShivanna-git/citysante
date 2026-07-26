import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Values from google-services.json / Firebase Console → Project Settings
export const firebaseConfig = {
  apiKey:            'AIzaSyAAlE4_lgxtKDPEm56wbt86kpsNXS05U8g',
  authDomain:        'isanthe.firebaseapp.com',
  projectId:         'isanthe',
  storageBucket:     'isanthe.firebasestorage.app',
  messagingSenderId: '477755975194',
  appId:             '1:477755975194:android:3973394df0c5f0122ad3a3',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const auth = getAuth(app)
export default app
