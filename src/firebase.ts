import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFkxuTc7gz-9r3ZeFwcmT24d4538KsXe4",
  authDomain: "gen-lang-client-0360446923.firebaseapp.com",
  projectId: "gen-lang-client-0360446923",
  storageBucket: "gen-lang-client-0360446923.firebasestorage.app",
  messagingSenderId: "317285932494",
  appId: "1:317285932494:web:36ce8ea025dafc1becdf9f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore using getFirestore with the database name
export const db = getFirestore(app, "ai-studio-4f2cddf6-3c2b-462b-8b38-f64b2dbb361d");

// Test connection and print status to console
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test_connection", "ping"));
    console.log("Firebase Firestore connected successfully!");
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firestore appears offline. Check connectivity and credentials.");
    } else {
      console.log("Firestore initialized. (Ping collection may not exist yet, which is normal).");
    }
  }
}
testConnection();
