import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseEnv).every(Boolean);

const firebaseConfig = {
  apiKey: firebaseEnv.apiKey || 'not-configured',
  authDomain: firebaseEnv.authDomain || 'not-configured.firebaseapp.com',
  projectId: firebaseEnv.projectId || 'not-configured',
  storageBucket: firebaseEnv.storageBucket || 'not-configured.appspot.com',
  messagingSenderId: firebaseEnv.messagingSenderId || 'not-configured',
  appId: firebaseEnv.appId || 'not-configured',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

const accountCreationApp = initializeApp(firebaseConfig, 'account-creation');
const accountCreationAuth = getAuth(accountCreationApp);

// Este proyecto todavía no tiene pantallas de login/registro conectadas a
// Firebase Authentication (el login actual es una simulación local). Para
// que las reglas de seguridad de Firestore funcionen sin bloquear la app,
// iniciamos sesión de forma anónima automáticamente. Esto identifica al
// dispositivo ante Firebase (lo que activa "isSignedIn()" en las reglas)
// sin pedirle nada al usuario. Cuando conectes un login real, puedes
// quitar esto y usar signInWithEmailAndPassword, etc.
export const authReady: Promise<void> = new Promise((resolve, reject) => {
  if (!firebaseConfigured) {
    resolve();
    return;
  }

  const timeout = window.setTimeout(resolve, 5000);
  setPersistence(auth, browserLocalPersistence).finally(() => {
    onAuthStateChanged(auth, (currentUser) => {
      window.clearTimeout(timeout);
      resolve();
    });
  });
});

export async function loginWithFirebase(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithFirebase(name: string, email: string, password: string) {
  const credentials = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credentials.user, { displayName: name });
  return credentials;
}

export async function createManagedAccount(email: string, password: string) {
  const credentials = await createUserWithEmailAndPassword(accountCreationAuth, email, password);
  await signOut(accountCreationAuth);
  return credentials.user.uid;
}

export async function logoutFromFirebase() {
  await signOut(auth);
}
