import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdMfitam8d7UwVfP2I3jbuDIYvW-lAB-c",
  authDomain: "youth-tasks.firebaseapp.com",
  projectId: "youth-tasks",
  storageBucket: "youth-tasks.firebasestorage.app",
  messagingSenderId: "824413713361",
  appId: "1:824413713361:web:6c84c4ce1efab73b3c66f0",
  measurementId: "G-PKMFQ4Z1PZ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, addDoc, deleteDoc, doc, updateDoc, setDoc,
  getDoc, getDocs, onSnapshot, serverTimestamp, query, orderBy, where, writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
