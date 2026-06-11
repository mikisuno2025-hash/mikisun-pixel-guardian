import { firebaseConfig, FIREBASE_CONFIG_READY } from "./firebase-config.js";
const statusEl = document.getElementById("cloudStatus");
const loginBtn = document.getElementById("googleLoginBtn");
const syncBtn = document.getElementById("cloudSyncBtn");
let app = null;
let auth = null;
let db = null;
let currentUser = null;
let firebaseApi = null;
let isReady = false;
let autoSaveTimer = null;
function setStatus(text, mode = "") {
if (!statusEl) return;
statusEl.textContent = text;
statusEl.classList.remove("online", "warn", "error");
if (mode) statusEl.classList.add(mode);
}
function gameApi() {
return window.PixelPetGame || null;
}
function waitForGameApi(timeoutMs = 5000) {
return new Promise((resolve, reject) => {
const started = Date.now();
const timer = setInterval(() => {
if (gameApi()) {
clearInterval(timer);
resolve(gameApi());
} else if (Date.now() - started > timeoutMs) {
clearInterval(timer);
reject(new Error("Game API not ready"));
}
}, 80);
});
}
async function initFirebase() {
if (!FIREBASE_CONFIG_READY) {
setStatus("Firebase未設定", "warn");
if (loginBtn) loginBtn.textContent = "設定Firebase";
return false;
}
try {
const [
firebaseApp,
firebaseAuth,
firebaseFirestore
] = await Promise.all([
import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
]);
firebaseApi = {
...firebaseApp,
...firebaseAuth,
...firebaseFirestore
};
app = firebaseApi.initializeApp(firebaseConfig);
auth = firebaseApi.getAuth(app);
db = firebaseApi.getFirestore(app);
firebaseApi.onAuthStateChanged(auth, async user => {
currentUser = user || null;
if (currentUser) {
isReady = true;
setStatus("已登入雲端", "online");
if (loginBtn) loginBtn.textContent = "登出";
await handleInitialCloudMerge();
startAutoSave();
} else {
isReady = false;
setStatus("未登入雲端", "warn");
if (loginBtn) loginBtn.textContent = "Google登入";
stopAutoSave();
}
});
return true;
} catch (error) {
console.error(error);
setStatus("Firebase錯誤", "error");
return false;
}
}
function saveDocRef() {
return firebaseApi.doc(db, "users", currentUser.uid, "saves", "main");
}
async function signInOrOut() {
if (!FIREBASE_CONFIG_READY) {
alert("Firebase 尚未設定。\n請先編輯 assets/js/firebase-config.js。");
return;
}
if (!auth) {
const ok = await initFirebase();
if (!ok) return;
}
if (currentUser) {
await firebaseApi.signOut(auth);
return;
}
const provider = new firebaseApi.GoogleAuthProvider();
await firebaseApi.signInWithPopup(auth, provider);
}
function buildCloudPayload() {
const api = gameApi();
const pet = api.getSaveData();
const dexOwned = api.getDexData();
const summary = api.getSummary();
return {
saveVersion: pet.saveVersion || 1,
pet,
dexOwned,
summary,
updatedAtMs: Date.now(),
updatedAt: firebaseApi.serverTimestamp()
};
}
async function uploadCloudSave(showAlert = false) {
if (!isReady || !currentUser) {
setStatus("尚未登入", "warn");
return false;
}
try {
const payload = buildCloudPayload();
await firebaseApi.setDoc(saveDocRef(), payload, { merge: true });
setStatus("雲端已保存", "online");
if (showAlert) alert("已上傳本機存檔到雲端。");
return true;
} catch (error) {
console.error(error);
setStatus("保存失敗", "error");
if (showAlert) alert("雲端保存失敗，請查看瀏覽器 Console。");
return false;
}
}
async function loadCloudSave(showAlert = false) {
if (!isReady || !currentUser) {
setStatus("尚未登入", "warn");
return false;
}
try {
const snap = await firebaseApi.getDoc(saveDocRef());
if (!snap.exists()) {
setStatus("無雲端存檔", "warn");
return false;
}
const data = snap.data();
const api = gameApi();
api.importCloudData(data);
setStatus("雲端已載入", "online");
if (showAlert) alert("已載入雲端存檔。");
return true;
} catch (error) {
console.error(error);
setStatus("載入失敗", "error");
if (showAlert) alert("雲端載入失敗，請查看瀏覽器 Console。");
return false;
}
}
async function handleInitialCloudMerge() {
await waitForGameApi();
try {
const snap = await firebaseApi.getDoc(saveDocRef());
const local = gameApi().getSaveData();
const localUpdated = Number(local.updatedAt || local.lastTick || 0);
if (!snap.exists()) {
await uploadCloudSave(false);
gameApi().setCloudMessage("Google 登入成功。\n已建立第一份雲端存檔。");
return;
}
const cloud = snap.data();
const cloudUpdated = Number(cloud.updatedAtMs || 0);
if (cloudUpdated > localUpdated) {
const useCloud = confirm("偵測到較新的雲端存檔。\n按「確定」載入雲端存檔。\n按「取消」保留本機並上傳覆蓋雲端。");
if (useCloud) {
await loadCloudSave(false);
gameApi().setCloudMessage("已載入較新的雲端存檔。");
} else {
await uploadCloudSave(false);
gameApi().setCloudMessage("已用本機存檔覆蓋雲端。");
}
} else if (localUpdated > cloudUpdated) {
const uploadLocal = confirm("本機存檔看起來較新。\n按「確定」上傳本機存檔。\n按「取消」載入雲端存檔。");
if (uploadLocal) {
await uploadCloudSave(false);
gameApi().setCloudMessage("已上傳本機存檔到雲端。");
} else {
await loadCloudSave(false);
gameApi().setCloudMessage("已載入雲端存檔。");
}
} else {
gameApi().setCloudMessage("Google 登入成功。\n本機與雲端存檔時間相同。");
}
} catch (error) {
console.error(error);
setStatus("同步確認失敗", "error");
}
}
function startAutoSave() {
stopAutoSave();
autoSaveTimer = setInterval(() => {
uploadCloudSave(false);
}, 30000);
}
function stopAutoSave() {
if (autoSaveTimer) {
clearInterval(autoSaveTimer);
autoSaveTimer = null;
}
}
async function manualSync() {
if (!FIREBASE_CONFIG_READY) {
alert("Firebase 尚未設定。\n請先編輯 assets/js/firebase-config.js。");
return;
}
if (!currentUser) {
await signInOrOut();
return;
}
const upload = confirm("雲端同步\n\n按「確定」：上傳本機存檔到雲端\n按「取消」：載入雲端存檔到本機");
if (upload) {
await uploadCloudSave(true);
} else {
await loadCloudSave(true);
}
}
if (loginBtn) loginBtn.addEventListener("click", signInOrOut);
if (syncBtn) syncBtn.addEventListener("click", manualSync);
window.addEventListener("beforeunload", () => {
if (isReady && currentUser) {
uploadCloudSave(false);
}
});
setStatus(FIREBASE_CONFIG_READY ? "雲端待登入" : "Firebase未設定", FIREBASE_CONFIG_READY ? "warn" : "warn");
initFirebase();
