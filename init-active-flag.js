import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import * as dotenv from "dotenv";
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initActiveFlag() {
  const collections = ['users', 'members', 'leaderboard'];
  for (const colName of collections) {
    console.log(`Checking ${colName}...`);
    const snap = await getDocs(collection(db, colName));
    for (const d of snap.docs) {
      if (d.data().isActive === undefined) {
        await updateDoc(doc(db, colName, d.id), { isActive: true });
        console.log(`  Set isActive:true for ${colName}/${d.id}`);
      }
    }
  }
  console.log("Done!");
  process.exit(0);
}

initActiveFlag();
