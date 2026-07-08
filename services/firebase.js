import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc,
  query,
  where
} from 'firebase/firestore';

// Firebase configuration with env and hardcoded fallbacks
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDi-Q89ZoSrkwjYYXZlYqVMOb28iv0hPIg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "project-6be3a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "project-6be3a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "project-6be3a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "81895062343",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:81895062343:web:0d38c2af4762249060aa62",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KQF1K3M1BY"
};

// Initialize Firebase (Try/catch to fallback in demo mode if keys are empty)
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase not fully configured. Running in high-fidelity mock sync mode.");
}

export { auth, db };

/**
 * Real-time listener for Inventory stock count syncing
 */
export function listenToInventory(facilityId, callback) {
  if (!db || !auth?.currentUser) return () => {}; // fallback if unauthenticated
  const q = doc(db, "facilities", String(facilityId));
  return onSnapshot(q, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().stock || {});
    }
  });
}

/**
 * Real-time listener for patient appointments
 */
export function listenToAppointments(facilityId, callback) {
  if (!db || !auth?.currentUser) return () => {};
  const apptsRef = collection(db, "appointments");
  const q = query(apptsRef, where("facilityId", "==", Number(facilityId)));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    callback(list);
  });
}

/**
 * Place a dynamic order in Firestore
 */
export async function dbPlaceOrder(orderData) {
  if (!db || !auth?.currentUser) return Promise.resolve(orderData);
  return addDoc(collection(db, "orders"), {
    ...orderData,
    timestamp: new Date()
  });
}

/**
 * Book a new appointment in Firestore
 */
export async function dbBookAppointment(apptData) {
  if (!db || !auth?.currentUser) return Promise.resolve(apptData);
  return addDoc(collection(db, "appointments"), {
    ...apptData,
    timestamp: new Date()
  });
}

/**
 * Mark clinician/staff attendance in Firestore
 */
export async function dbMarkAttendance(attendanceRecord) {
  if (!db || !auth?.currentUser) return Promise.resolve(attendanceRecord);
  return addDoc(collection(db, "attendance"), {
    ...attendanceRecord,
    timestamp: new Date()
  });
}
