import { auth } from "./firebase-config.js";
import { apiRequest } from "./api-client.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

async function syncUser(user, fullNameOverride = "") {
  const payload = await apiRequest("/api/users/sync", {
    method: "POST",
    body: {
      firebaseUid: user.uid,
      fullName: fullNameOverride || user.displayName || user.email?.split("@")[0] || "Student",
      email: user.email || ""
    }
  });

  window.currentUser = payload.user;
  return payload.user;
}

function setAuthMessage(message) {
  const loginMessage = document.getElementById("loginMessage");
  const signupMessage = document.getElementById("signupMessage");

  if (loginMessage) loginMessage.innerText = message;
  if (signupMessage) signupMessage.innerText = message;
}

function showPublicUI() {
  document.getElementById("publicNavbar")?.classList.remove("hidden");
  document.getElementById("homePage")?.classList.remove("hidden");
  document.getElementById("aboutPage")?.classList.add("hidden");
  document.getElementById("loginPage")?.classList.add("hidden");
  document.getElementById("signupPage")?.classList.add("hidden");
  document.getElementById("studentDashboard")?.classList.add("hidden");
  document.getElementById("adminDashboard")?.classList.add("hidden");
}

async function showStudentUI(userData) {
  document.getElementById("publicNavbar")?.classList.add("hidden");
  document.getElementById("homePage")?.classList.add("hidden");
  document.getElementById("aboutPage")?.classList.add("hidden");
  document.getElementById("loginPage")?.classList.add("hidden");
  document.getElementById("signupPage")?.classList.add("hidden");
  document.getElementById("adminDashboard")?.classList.add("hidden");
  document.getElementById("studentDashboard")?.classList.remove("hidden");
  showStudentSection("studentHome");

  document.getElementById("studentWelcome").innerText = `Hello, ${userData.fullName}`;
  document.getElementById("profileName").innerText = userData.fullName;
  document.getElementById("profileEmail").innerText = userData.email;
  document.getElementById("profileRole").innerText = userData.role;

  if (window.initRealTimeData) {
    await window.initRealTimeData();
  }
}

async function showAdminUI(userData) {
  document.getElementById("publicNavbar")?.classList.add("hidden");
  document.getElementById("homePage")?.classList.add("hidden");
  document.getElementById("aboutPage")?.classList.add("hidden");
  document.getElementById("loginPage")?.classList.add("hidden");
  document.getElementById("signupPage")?.classList.add("hidden");
  document.getElementById("studentDashboard")?.classList.add("hidden");
  document.getElementById("adminDashboard")?.classList.remove("hidden");
  document.getElementById("adminWelcome").innerText = `Hello, ${userData.fullName}`;
  showAdminSection("adminHome");

  if (window.loadAllUsers) await window.loadAllUsers();
  if (window.loadAllSystemRecords) await window.loadAllSystemRecords();
}

function bindAuthButtons() {
  const signupButton = document.getElementById("signupButton");
  const loginButton = document.getElementById("loginButton");

  if (signupButton && !signupButton.dataset.bound) {
    signupButton.dataset.bound = "true";
    signupButton.addEventListener("click", () => window.registerUser());
  }

  if (loginButton && !loginButton.dataset.bound) {
    loginButton.dataset.bound = "true";
    loginButton.addEventListener("click", () => window.loginUser());
  }
}

window.registerUser = async function () {
  const fullName = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const msgEl = document.getElementById("signupMessage");

  if (!fullName || !email || !password) {
    msgEl.innerText = "Please fill in your name, email, and password.";
    return;
  }

  try {
    msgEl.innerText = "Creating account...";
    await setPersistence(auth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await syncUser(credential.user, fullName);
    msgEl.innerText = "";
  } catch (error) {
    msgEl.innerText = error.message;
  }
};

window.loginUser = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msgEl = document.getElementById("loginMessage");

  if (!email || !password) {
    msgEl.innerText = "Please enter both email and password.";
    return;
  }

  try {
    msgEl.innerText = "Logging in...";
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await syncUser(credential.user);
    msgEl.innerText = "";
  } catch (error) {
    msgEl.innerText = error.message;
  }
};

window.logoutUser = async function () {
  if (window.resetStudentUI) {
    window.resetStudentUI();
  }

  window.currentUser = null;
  await signOut(auth);
  showPublicUI();
};

window.deleteAccount = async function () {
  alert("Delete account is not included in the simplified version.");
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.currentUser = null;
    setAuthMessage("");
    showPublicUI();
    return;
  }

  try {
    const dbUser = await syncUser(user);
    setAuthMessage("");

    if (dbUser.role === "admin") {
      await showAdminUI(dbUser);
      return;
    }

    await showStudentUI(dbUser);
  } catch (error) {
    setAuthMessage(error.message || "Unable to load user profile.");
    showPublicUI();
  }
});

bindAuthButtons();
document.addEventListener("DOMContentLoaded", bindAuthButtons);
