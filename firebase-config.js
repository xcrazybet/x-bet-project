// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA72Yo_YGqno9PX25p3yQBvyflcaM-NqEM",
  authDomain: "x-bet-prod-jd.firebaseapp.com",
  projectId: "x-bet-prod-jd",
  storageBucket: "x-bet-prod-jd.firebasestorage.app",
  messagingSenderId: "499334334535",
  appId: "1:499334334535:web:bebc1bf817e24d9e3c4962",
  measurementId: "G-PTV4XMYQ6P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

console.log("🔥 Firebase initialized successfully");
