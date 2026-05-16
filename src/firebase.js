import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBWJuVwuPaEG_BZkHBWovFQWqogW7bHtDY",
  authDomain: "ideaflow-81aee.firebaseapp.com",
  databaseURL: "https://ideaflow-81aee-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ideaflow-81aee",
  storageBucket: "ideaflow-81aee.firebasestorage.app",
  messagingSenderId: "707034217510",
  appId: "1:707034217510:web:004d5c6bf68a9f2669bae7",
  measurementId: "G-CC3XLBBKJ0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getDatabase(app);
