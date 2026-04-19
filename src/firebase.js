import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCMhOSSv__M8FofahzUCeWnnw8MTczYzGk",
  authDomain: "kull-note.firebaseapp.com",
  projectId: "kull-note",
  storageBucket: "kull-note.firebasestorage.app",
  messagingSenderId: "324274117628",
  appId: "1:324274117628:web:62b4cdb7f8472031c87079",
  measurementId: "G-TJ1863BPZE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
