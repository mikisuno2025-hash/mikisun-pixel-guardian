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
let localSaveAutoTimer = null;
let lastCloudSaveAt = 0;
let lastCloudLoadAt = 0;
let lastStatusText = "";

function cloudT(key) {
  try {
    if (window.PixelPetI18N && typeof window.PixelPetI18N.t === "function") {
      return window.PixelPetI18N.t(key);
    }
  } catch {}
  const fallback = {
    "btn.google": "Google登入",
    "btn.logout": "登出",
    "btn.manualSync": "手動同步",
    "cloud.signedOutHint": "未登入：僅使用本機存檔",
    "cloud.signedInHint": "已登入：雲端會自動保存，手動同步只作備用",
    "cloud.status.signedOut": "未登入雲端",
    "cloud.status.signedIn": "已登入雲端｜自動同步中",
    "cloud.status.saved": "雲端已自動保存",
    "cloud.status.loginFirst": "請先登入Google"
  };
  return fallback[key] || key;
}

function setStatus(text, mode = "") {
  lastStatusText = text || "";
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.title = text;
  statusEl.classList.remove("online", "warn", "error");
  if (mode) statusEl.classList.add(mode);
}

function shortTime(ts = Date.now()) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}


function updateCloudLoginUi(user) {
  const signedIn = !!user;
  document.documentElement.dataset.cloudState = signedIn ? "signed-in" : "signed-out";

  const loginText = signedIn ? cloudT("btn.logout") : cloudT("btn.google");
  const syncText = cloudT("btn.manualSync");
  const hintText = signedIn
    ? cloudT("cloud.signedInHint")
    : cloudT("cloud.signedOutHint");

  if (loginBtn) loginBtn.textContent = loginText;
  if (syncBtn) {
    syncBtn.textContent = syncText;
    syncBtn.hidden = !signedIn;
    syncBtn.disabled = !signedIn;
  }

  document.querySelectorAll("[data-mobile-action='login']").forEach(btn => {
    btn.textContent = loginText;
  });

  document.querySelectorAll("[data-mobile-action='sync']").forEach(btn => {
    btn.textContent = syncText;
    btn.hidden = !signedIn;
    btn.disabled = !signedIn;
  });

  document.querySelectorAll("[data-cloud-hint]").forEach(el => {
    el.textContent = hintText;
  });

  window.dispatchEvent(new CustomEvent("pixel-cloud-auth-change", {
    detail: {
      signedIn,
      uid: user ? user.uid : null,
      email: user ? user.email : null,
      displayName: user ? user.displayName : null
    }
  }));
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
    updateCloudLoginUi(null);
    if (loginBtn) loginBtn.textContent = "設定Firebase";
    document.querySelectorAll("[data-mobile-action='login']").forEach(btn => { btn.textContent = "設定Firebase"; });
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

    if (firebaseApi.getRedirectResult) {
      firebaseApi.getRedirectResult(auth).catch(error => {
        console.warn("redirect result error", error);
        if (error) setStatus("登入跳轉確認失敗", "error");
      });
    }

    firebaseApi.onAuthStateChanged(auth, async user => {
      currentUser = user || null;
      if (currentUser) {
        isReady = true;
        setStatus(cloudT("cloud.status.signedIn"), "online");
        updateCloudLoginUi(currentUser);
        await handleInitialCloudMerge();
        startAutoSave();
      } else {
        isReady = false;
        setStatus(cloudT("cloud.status.signedOut"), "warn");
        updateCloudLoginUi(null);
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
  try {
    if (!auth) {
      const ok = await initFirebase();
      if (!ok) return;
    }

    if (currentUser) {
      setStatus("正在登出...", "warn");
      await firebaseApi.signOut(auth);
      return;
    }

    if (!provider) {
      provider = new firebaseApi.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
    }

    setStatus("正在開啟 Google 登入...", "warn");

    try {
      await firebaseApi.signInWithPopup(auth, provider);
    } catch (popupError) {
      console.warn("Google popup sign-in failed, trying redirect", popupError);

      const code = popupError && popupError.code ? String(popupError.code) : "";
      const canRedirect =
        code.includes("popup-blocked") ||
        code.includes("popup-closed-by-user") ||
        code.includes("cancelled-popup-request") ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (canRedirect && firebaseApi.signInWithRedirect) {
        setStatus("改用跳轉登入...", "warn");
        await firebaseApi.signInWithRedirect(auth, provider);
        return;
      }

      throw popupError;
    }
  } catch (error) {
    console.error(error);
    const message = error && error.message ? error.message : String(error);
    setStatus("Google登入失敗", "error");
    alert("Google 登入失敗：
" + message);
  }
}

async function uploadCloudSave(showAlert = false) {
  if (!isReady || !currentUser) {
    setStatus("尚未登入", "warn");
    return false;
  }

  try {
    const payload = buildCloudPayload();
    await firebaseApi.setDoc(saveDocRef(), payload, { merge: true });
    lastCloudSaveAt = Date.now();
    setStatus(`${cloudT("cloud.status.saved")} ${shortTime(lastCloudSaveAt)}`, "online");
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
    lastCloudLoadAt = Date.now();
    setStatus(`雲端已載入 ${shortTime(lastCloudLoadAt)}`, "online");
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
      gameApi().setCloudMessage("Google 登入成功。
沒有雲端存檔，已建立第一份雲端存檔。");
      return;
    }

    const cloudData = snap.data();
    const cloudUpdated = Number(cloudData.updatedAtMs || (cloudData.pet && (cloudData.pet.updatedAt || cloudData.pet.lastTick)) || 0);
    const diff = Math.abs(cloudUpdated - localUpdated);

    if (cloudUpdated && localUpdated && diff < 10000) {
      gameApi().setCloudMessage("Google 登入成功。
本機與雲端存檔時間接近，已保留目前資料並啟用自動同步。");
      setStatus(cloudT("cloud.status.signedIn"), "online");
      return;
    }

    let question = "偵測到本機與雲端都有存檔。

";
    if (cloudUpdated > localUpdated) {
      question += "雲端存檔看起來較新。

";
      question += "按「確定」：載入雲端
按「取消」：保留本機並上傳";
      if (confirm(question)) {
        await loadCloudSave(false);
        gameApi().setCloudMessage("已載入雲端存檔。");
      } else {
        await uploadCloudSave(false);
        gameApi().setCloudMessage("已保留本機存檔並上傳雲端。");
      }
      return;
    }

    if (localUpdated > cloudUpdated) {
      question += "本機存檔看起來較新。

";
      question += "按「確定」：上傳本機
按「取消」：載入雲端";
      if (confirm(question)) {
        await uploadCloudSave(false);
        gameApi().setCloudMessage("已上傳本機存檔到雲端。");
      } else {
        await loadCloudSave(false);
        gameApi().setCloudMessage("已載入雲端存檔。");
      }
      return;
    }

    question += "無法判斷哪份比較新。

按「確定」：保留本機並上傳
按「取消」：載入雲端";
    if (confirm(question)) {
      await uploadCloudSave(false);
      gameApi().setCloudMessage("已保留本機存檔並上傳雲端。");
    } else {
      await loadCloudSave(false);
      gameApi().setCloudMessage("已載入雲端存檔。");
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
  if (localSaveAutoTimer) {
    clearTimeout(localSaveAutoTimer);
    localSaveAutoTimer = null;
  }
}

function scheduleAutoCloudSave() {
  if (!isReady || !currentUser) return;
  if (localSaveAutoTimer) clearTimeout(localSaveAutoTimer);
  localSaveAutoTimer = setTimeout(() => {
    localSaveAutoTimer = null;
    uploadCloudSave(false);
  }, 3500);
}

window.addEventListener("pixel-pet-local-save", () => {
  scheduleAutoCloudSave();
});

async function manualSync() {
  if (!FIREBASE_CONFIG_READY) {
    alert("Firebase 尚未設定。\n請先編輯 assets/js/firebase-config.js。");
    return;
  }
  if (!currentUser) {
    setStatus(cloudT("cloud.status.loginFirst"), "warn");
    alert(cloudT("cloud.status.loginFirst"));
    return;
  }

  const upload = confirm("雲端同步\n\n按「確定」：上傳本機存檔到雲端\n按「取消」：載入雲端存檔到本機");
  if (upload) {
    await uploadCloudSave(true);
  } else {
    await loadCloudSave(true);
  }
}

window.PixelPetCloudAuth = {
  isSignedIn() {
    return !!currentUser;
  },
  currentUser() {
    return currentUser ? {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName
    } : null;
  },
  status() {
    return {
      signedIn: !!currentUser,
      uid: currentUser ? currentUser.uid : null,
      email: currentUser ? currentUser.email : null,
      displayName: currentUser ? currentUser.displayName : null,
      lastCloudSaveAt,
      lastCloudLoadAt,
      lastStatus: lastStatusText
    };
  },
  signInOrOut,
  manualSync,
  uploadCloudSave,
  loadCloudSave
};

if (loginBtn) loginBtn.addEventListener("click", signInOrOut);
if (syncBtn) syncBtn.addEventListener("click", manualSync);

window.addEventListener("beforeunload", () => {
  if (isReady && currentUser) {
    uploadCloudSave(false);
  }
});

updateCloudLoginUi(null);
setStatus(FIREBASE_CONFIG_READY ? cloudT("cloud.status.signedOut") : "Firebase未設定", FIREBASE_CONFIG_READY ? "warn" : "warn");
window.addEventListener("pixel-language-change", () => {
  try {
    updateCloudLoginUi(currentUser);
    if (!currentUser && FIREBASE_CONFIG_READY) setStatus(cloudT("cloud.status.signedOut"), "warn");
  } catch {}
});
initFirebase();
