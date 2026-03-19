import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCL1Qz5WHfFsEaOeayTcbY4xuAq6Lj516M",
  authDomain: "student-budget-tracker-15e20.firebaseapp.com",
  projectId: "student-budget-tracker-15e20",
  storageBucket: "student-budget-tracker-15e20.firebasestorage.app",
  messagingSenderId: "297150110492",
  appId: "1:297150110492:web:adc4566ef6219f965bb8d9",
  measurementId: "G-1XESTRZZBG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
