// @ts-ignore
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { db };