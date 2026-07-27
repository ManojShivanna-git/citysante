import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            'AIzaSyD372o-h7ozAnEYn6MJA1T1mYOoKpqLkps',
  authDomain:        'isanthe.firebaseapp.com',
  projectId:         'isanthe',
  storageBucket:     'isanthe.firebasestorage.app',
  messagingSenderId: '477755975194',
  appId:             '1:477755975194:web:87147a61ce786d582ad3a3',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
