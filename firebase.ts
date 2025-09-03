import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

console.log("firebase.ts: Firebase modules loaded.");

// IMPORTANT: Replace this with your own Firebase project configuration.
// You can find this in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyC_wSQRapWtU3Elxg7dsSb_hqIdlWxEydA",
  authDomain: "menumaker-2027f.firebaseapp.com",
  projectId: "menumaker-2027f",
  storageBucket: "menumaker-2027f.firebasestorage.app",
  messagingSenderId: "808575284842",
  appId: "1:808575284842:web:6fe89a6ee1505bc7fabc13",
  measurementId: "G-SP68RL7C43"
};

// Initialize Firebase using the v9+ modular SDK, ensuring it only runs once.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
if (!getApps().length) {
    // This part of the if is now only for the console.log
    console.log("firebase.ts: Firebase app initialized.");
} else {
    console.log("firebase.ts: Firebase app already initialized.");
}


// Initialize Cloud Firestore and get a reference to the service.
const db = getFirestore(app);
const auth = getAuth(app);

console.log("firebase.ts: db and auth services exported.", { db, auth });

export { db, auth };