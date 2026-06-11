/* Mikisun Pixel Guardian V34.0 Core Repair
   Rebuilt stable core: buttons, animation, patrol, battle, settings, save, cloud API.
*/

(() => {
  "use strict";

  const SAVE_KEY = "pixelPetSave";
  const DEX_KEY = "pixelPetDex";
  const SETTINGS_KEY = "pixelPetSettingsV34";
  const SAVE_VERSION = "34.0";

  const $ = id => document.getElementById(id);
  const canvas = $("petCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const bgmAudio = $("bgmAudio");

  const el = {
    powerLed: $("powerLed"),
    screen: $("screen"),
    lv: $("lv"),
    hp: $("hp"),
    age: $("age"),
    exp: $("exp"),
    scanFill: $("scanFill"),
    modeLabel: $("modeLabel"),
    message: $("message"),
    hungerBar: $("hungerBar"),
    moodBar: $("moodBar"),
    energyBar: $("energyBar"),
    cleanBar: $("cleanBar"),
    mobileHungerBar: $("mobileHungerBar"),
    mobileMoodBar: $("mobileMoodBar"),
    mobileEnergyBar: $("mobileEnergyBar"),
    mobileCleanBar: $("mobileCleanBar"),
    settingsBackdrop: $("settingsBackdrop"),
    settingsClose: $("settingsClose"),
    dexBackdrop: $("dexBackdrop"),
    dexClose: $("dexClose"),
    dexSummaryText: $("dexSummaryText"),
    dexGrid: $("dexGrid"),
    cloudStatus: $("cloudStatus"),
    mobileDebugPanel: $("mobileDebugPanel"),
    mobileDebugText: $("mobileDebugText"),
    mobileDebugClose: $("mobileDebugClose"),
    settingAnimations: $("settingAnimations"),
    settingAutoCare: $("settingAutoCare"),
    settingAutoPatrol: $("settingAutoPatrol"),
    settingMotionShake: $("settingMotionShake"),
    settingMotionSensitivity: $("settingMotionSensitivity"),
    settingBgmVolume: $("settingBgmVolume"),
    settingSfxVolume: $("settingSfxVolume"),
    settingFontSize: $("settingFontSize"),
    bgmVolValue: $("bgmVolValue"),
    sfxVolValue: $("sfxVolValue"),
    fontSizeValue: $("fontSizeValue"),
    languageSelect: $("languageSelect"),
    settingsDefault: $("settingsDefault"),
    settingsDone: $("settingsDone")
  };

  let frame = 0;
  let pet = defaultPet();
  let enemy = null;
  let gameMode = "idle";
  let scan = 0;
  let actionLock = false;
  let actionAnim = null;
  let scanAnim = null;
  let battleTickAt = 0;
  let lastTickAt = Date.now();
  let lastSaveAt = 0;
  let lastAutoPatrolAt = Date.now();
  let lastAutoCareAt = Date.now();
  let resetConfirmUntil = 0;

  let audioCtx = null;
  let lastPointerX = null;
  let mouseTravel = 0;
  let lastMotionMag = null;
  let shakeCount = 0;
  let shakeWindowUntil = 0;

  const I18N = {
    "zh-TW": {
      "btn.rename":"命名","btn.dex":"圖鑑","btn.google":"Google登入","btn.cloud":"雲端同步","btn.manualSync":"手動同步",
      "btn.sound":"音效 ON","btn.bgm":"BGM ON","btn.autocare":"AUTO CARE","btn.patrol":"PATROL","btn.rehatch":"重新孵化","btn.system":"SYSTEM",
      "btn.debug":"狀態診斷",
      "mobile.feed":"餵食","mobile.train":"訓練","mobile.clean":"清潔","mobile.sleep":"睡眠","mobile.search":"搜索","mobile.status":"狀態","mobile.close":"關閉",
      "settings.title":"SYSTEM MENU","settings.subtitle":"OPTION","settings.animations":"動畫效果","settings.autoCare":"自動照顧",
      "settings.autoPatrol":"掛機巡邏","settings.motionShake":"手機搖動探索","settings.motionShakeNote":"手機版可快速搖動 2 下進行探索。",
      "settings.motionSensitivity":"搖動靈敏度","settings.motionLow":"低：避免誤觸","settings.motionMedium":"中：標準","settings.motionHigh":"高：較容易觸發",
      "settings.motionSensitivityNote":"如果搖不出來請調高；如果太容易誤觸請調低。",
      "settings.bgmVolume":"BGM 音量","settings.sfxVolume":"音效音量","settings.fontSize":"字體大小","settings.language":"語言",
      "settings.default":"恢復預設","settings.done":"完成","cloud.local":"本機存檔"
    },
    "zh-CN": {},
    "ja": {},
    "en": {}
  };

  I18N["zh-CN"] = { ...I18N["zh-TW"],
    "btn.rename":"命名","btn.dex":"图鉴","btn.google":"Google登录","btn.cloud":"云端同步","btn.rehatch":"重新孵化",
    "mobile.feed":"喂食","mobile.train":"训练","mobile.clean":"清洁","mobile.sleep":"睡眠","mobile.search":"搜索","mobile.status":"状态",
    "settings.title":"SYSTEM MENU","settings.autoCare":"自动照顾","settings.autoPatrol":"挂机巡逻","settings.language":"语言"
  };

  I18N.ja = { ...I18N["zh-TW"],
    "btn.rename":"名前","btn.dex":"図鑑","btn.google":"Googleログイン","btn.cloud":"クラウド同期","btn.manualSync":"手動同期",
    "btn.rehatch":"再孵化","btn.system":"SYSTEM","btn.debug":"状態診断",
    "mobile.feed":"ごはん","mobile.train":"訓練","mobile.clean":"掃除","mobile.sleep":"睡眠","mobile.search":"探索","mobile.status":"状態","mobile.close":"閉じる",
    "settings.animations":"アニメーション","settings.autoCare":"オートケア","settings.autoPatrol":"オートパトロール",
    "settings.motionShake":"スマホ振り探索","settings.bgmVolume":"BGM 音量","settings.sfxVolume":"効果音音量","settings.fontSize":"文字サイズ","settings.language":"言語",
    "settings.default":"初期設定","settings.done":"完了","cloud.local":"ローカルセーブ"
  };

  I18N.en = { ...I18N["zh-TW"],
    "btn.rename":"Rename","btn.dex":"Dex","btn.google":"Google sign in","btn.cloud":"Cloud sync","btn.manualSync":"Manual sync",
    "btn.sound":"SFX ON","btn.bgm":"BGM ON","btn.autocare":"AUTO CARE","btn.patrol":"PATROL","btn.rehatch":"Re-hatch","btn.system":"SYSTEM","btn.debug":"Debug",
    "mobile.feed":"Feed","mobile.train":"Train","mobile.clean":"Clean","mobile.sleep":"Sleep","mobile.search":"Search","mobile.status":"Status","mobile.close":"Close",
    "settings.animations":"Animations","settings.autoCare":"Auto care","settings.autoPatrol":"Auto patrol","settings.motionShake":"Motion shake",
    "settings.bgmVolume":"BGM volume","settings.sfxVolume":"SFX volume","settings.fontSize":"Font size","settings.language":"Language",
    "settings.default":"Default","settings.done":"Done","cloud.local":"Local save"
  };

  const defaultSettings = {
    animations: true,
    autoCare: false,
    autoPatrol: true,
    motionShake: true,
    motionSensitivity: "medium",
    bgmVolume: 38,
    sfxVolume: 70,
    fontSize: 100,
    language: "zh-TW",
    soundEnabled: true,
    bgmEnabled: true
  };

  let settings = loadSettings();

  function now() { return Date.now(); }
  function clamp(v, min=0, max=100) { return Math.max(min, Math.min(max, Number(v) || 0)); }
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function defaultPet(seedFamily = null) {
    const familyId = seedFamily || rand(1, 10);
    const appearanceId = appearanceIdFromFamilyBranchStage(familyId, 0, 0);
    return {
      saveVersion: SAVE_VERSION,
      name: "PICO",
      familyId,
      branchId: 0,
      branchChosen: false,
      stageIndex: 0,
      appearanceId,
      lv: 1,
      exp: 0,
      hp: 30,
      maxHp: 30,
      age: 0,
      hunger: 72,
      mood: 72,
      energy: 72,
      clean: 72,
      asleep: false,
      battleWins: 0,
      cleanActions: 0,
      trainActions: 0,
      feedActions: 0,
      createdAt: now(),
      updatedAt: now(),
      lastTick: now()
    };
  }

  function appearanceIdFromFamilyBranchStage(familyId, branchId, stageIndex) {
    return ((familyId - 1) * 10) + (branchId * 5) + stageIndex + 1;
  }

  function parseAppearanceId(id) {
    const n = Math.max(1, Math.min(100, Number(id) || 1)) - 1;
    return {
      familyId: Math.floor(n / 10) + 1,
      branchId: Math.floor((n % 10) / 5),
      stageIndex: n % 5
    };
  }

  function appearanceLabel(id) {
    const p = parseAppearanceId(id);
    const branch = p.branchId === 0 ? "A" : "B";
    return `F${String(p.familyId).padStart(2,"0")}-${branch}${p.stageIndex + 1}`;
  }

  function loadDex() {
    try {
      const raw = JSON.parse(localStorage.getItem(DEX_KEY) || "[]");
      if (Array.isArray(raw)) return raw.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 100);
    } catch {}
    return [];
  }

  function saveDex(list) {
    const clean = Array.from(new Set(list.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 100))).sort((a,b)=>a-b);
    try { localStorage.setItem(DEX_KEY, JSON.stringify(clean)); } catch {}
    return clean;
  }

  function markDex(id) {
    const list = loadDex();
    if (!list.includes(id)) {
      list.push(id);
      saveDex(list);
    }
  }

  function loadSettings() {
    try {
      return { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")) };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function sanitizePet(p) {
    const base = defaultPet();
    const merged = { ...base, ...(p || {}) };
    merged.lv = Math.max(1, Math.floor(Number(merged.lv) || 1));
    merged.exp = Math.max(0, Math.floor(Number(merged.exp) || 0));
    merged.maxHp = Math.max(20, Math.floor(Number(merged.maxHp) || 30));
    merged.hp = clamp(merged.hp, 0, merged.maxHp);
    merged.age = Math.max(0, Math.floor(Number(merged.age) || 0));
    merged.hunger = clamp(merged.hunger);
    merged.mood = clamp(merged.mood);
    merged.energy = clamp(merged.energy);
    merged.clean = clamp(merged.clean);
    merged.familyId = Math.max(1, Math.min(10, Math.floor(Number(merged.familyId) || 1)));
    merged.branchId = Math.max(0, Math.min(1, Math.floor(Number(merged.branchId) || 0)));
    merged.stageIndex = Math.max(0, Math.min(4, Math.floor(Number(merged.stageIndex) || 0)));
    merged.appearanceId = appearanceIdFromFamilyBranchStage(merged.familyId, merged.branchId, merged.stageIndex);
    merged.name = String(merged.name || "PICO").slice(0, 16);
    merged.saveVersion = SAVE_VERSION;
    return merged;
  }

  function loadPet() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultPet();
      return sanitizePet(JSON.parse(raw));
    } catch {
      return defaultPet();
    }
  }

  function savePet(dispatch=true) {
    try {
      pet.updatedAt = now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(pet));
      markDex(pet.appearanceId);
      lastSaveAt = now();
      if (dispatch) window.dispatchEvent(new CustomEvent("pixel-pet-local-save"));
    } catch {}
  }

  function setMessage(text) {
    if (el.message) el.message.textContent = text;
  }

  function t(key) {
    return (I18N[settings.language] && I18N[settings.language][key]) || I18N["zh-TW"][key] || key;
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(node => {
      const key = node.getAttribute("data-i18n");
      node.textContent = t(key);
    });
    updateButtonsText();
  }

  function updateButtonsText() {
    document.querySelectorAll("[data-action='sound']").forEach(b => b.textContent = settings.soundEnabled ? "音效 ON" : "音效 OFF");
    document.querySelectorAll("[data-action='bgm']").forEach(b => b.textContent = settings.bgmEnabled ? "BGM ON" : "BGM OFF");
    document.querySelectorAll("[data-action='autocare']").forEach(b => b.textContent = settings.autoCare ? "AUTO CARE ON" : "AUTO CARE OFF");
    document.querySelectorAll("[data-action='autopatrol']").forEach(b => b.textContent = settings.autoPatrol ? "PATROL ON" : "PATROL OFF");
  }

  function syncSettingsUi() {
    if (el.settingAnimations) el.settingAnimations.checked = !!settings.animations;
    if (el.settingAutoCare) el.settingAutoCare.checked = !!settings.autoCare;
    if (el.settingAutoPatrol) el.settingAutoPatrol.checked = !!settings.autoPatrol;
    if (el.settingMotionShake) el.settingMotionShake.checked = !!settings.motionShake;
    if (el.settingMotionSensitivity) el.settingMotionSensitivity.value = settings.motionSensitivity;
    if (el.settingBgmVolume) el.settingBgmVolume.value = settings.bgmVolume;
    if (el.settingSfxVolume) el.settingSfxVolume.value = settings.sfxVolume;
    if (el.settingFontSize) el.settingFontSize.value = settings.fontSize;
    if (el.languageSelect) el.languageSelect.value = settings.language;
    if (el.bgmVolValue) el.bgmVolValue.textContent = `${settings.bgmVolume}%`;
    if (el.sfxVolValue) el.sfxVolValue.textContent = `${settings.sfxVolume}%`;
    if (el.fontSizeValue) el.fontSizeValue.textContent = `${settings.fontSize}%`;
    document.documentElement.style.setProperty("--ui-font-scale", String(settings.fontSize / 100));
    applyAudioVolume();
    updateButtonsText();
  }

  function applyAudioVolume() {
    if (!bgmAudio) return;
    bgmAudio.volume = clamp(settings.bgmVolume, 0, 100) / 100;
    bgmAudio.muted = !settings.bgmEnabled || settings.bgmVolume <= 0;
  }

  function initAudio() {
    if (!settings.soundEnabled && !settings.bgmEnabled) return;
    try {
      if (!audioCtx && settings.soundEnabled) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      if (bgmAudio && settings.bgmEnabled) {
        applyAudioVolume();
        bgmAudio.play().catch(()=>{});
      }
    } catch {}
  }

  function tone(freq, duration=0.06, volume=0.04) {
    if (!settings.soundEnabled) return;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const st = audioCtx.currentTime;
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, st);
      gain.gain.exponentialRampToValueAtTime(volume * settings.sfxVolume / 100, st + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(st);
      osc.stop(st + duration + 0.02);
    } catch {}
  }

  function sfx(name) {
    if (name === "click") tone(520, .035, .03);
    if (name === "care") { tone(620,.05,.035); setTimeout(()=>tone(820,.05,.03),50); }
    if (name === "scan") tone(460 + scan * 3,.04,.03);
    if (name === "hit") { tone(780,.04,.035); setTimeout(()=>tone(330,.04,.03),45); }
    if (name === "win") { tone(523,.06,.035); setTimeout(()=>tone(659,.06,.035),80); setTimeout(()=>tone(784,.1,.035),160); }
    if (name === "lose") { tone(392,.08,.035); setTimeout(()=>tone(262,.16,.035),120); }
  }

  function healSleep() {
    pet.energy = clamp(pet.energy + 18);
    pet.hp = clamp(pet.hp + 8, 0, pet.maxHp);
    pet.mood = clamp(pet.mood + 3);
  }

  function gainExp(n) {
    pet.exp += n;
    while (pet.exp >= pet.lv * 18) {
      pet.exp -= pet.lv * 18;
      pet.lv += 1;
      pet.maxHp += 4;
      pet.hp = pet.maxHp;
      if (pet.lv >= 3 && pet.stageIndex < 1) evolveToStage(1);
      if (pet.lv >= 6 && pet.stageIndex < 2) evolveToStage(2);
      if (pet.lv >= 10 && pet.stageIndex < 3) evolveToStage(3);
      if (pet.lv >= 15 && pet.stageIndex < 4) evolveToStage(4);
      setMessage(`${pet.name} 升級到 LV ${pet.lv}！`);
    }
  }

  function evolveToStage(stage) {
    if (!pet.branchChosen && stage >= 2) {
      pet.branchId = Math.random() < 0.5 ? 0 : 1;
      pet.branchChosen = true;
    }
    pet.stageIndex = Math.max(pet.stageIndex, stage);
    pet.appearanceId = appearanceIdFromFamilyBranchStage(pet.familyId, pet.branchId, pet.stageIndex);
    markDex(pet.appearanceId);
    sfx("win");
  }

  function runAction(type) {
    initAudio();
    if (type === "system") return openSettings();
    if (type === "rename") return renamePet();
    if (type === "dex") return openDex();
    if (type === "reset") return resetPetFlow();
    if (type === "sound") return toggleSound();
    if (type === "bgm") return toggleBgm();
    if (type === "autocare") return toggleAutoCare();
    if (type === "autopatrol") return toggleAutoPatrol();
    if (type === "status") return showStatus();
    if (type === "patrol") return manualPatrol();

    if (["feed", "train", "clean", "sleep"].includes(type)) {
      return runCareActionAnimated(type);
    }
  }

  function runCareActionAnimated(type) {
    if (actionLock) {
      setMessage("動作執行中，請稍候。");
      updateUI();
      return;
    }
    if (enemy && gameMode === "battle") {
      setMessage("戰鬥中無法照顧。\n移動滑鼠或等待守護獸攻擊！");
      updateUI();
      return;
    }
    actionLock = true;
    const duration = { feed: 800, train: 950, clean: 850, sleep: 1100 }[type] || 800;
    actionAnim = { type, start: now(), duration };
    document.body.classList.add("lcd-action-animating");
    setMessage(careStartText(type));
    sfx("care");
    updateUI();

    setTimeout(() => {
      finishCareAction(type);
      actionAnim = null;
      actionLock = false;
      document.body.classList.remove("lcd-action-animating");
      savePet();
      updateUI();
    }, duration);
  }

  function careStartText(type) {
    if (type === "feed") return `${pet.name} 正在吃飯...\n動畫完成後才增加飽食。`;
    if (type === "train") return `${pet.name} 開始訓練...\n完成後才結算 EXP。`;
    if (type === "clean") return `清潔中...\n動畫完成後才恢復清潔度。`;
    if (type === "sleep") return `${pet.name} 正在睡覺...\n動畫完成後才恢復體力。`;
    return "動作中...";
  }

  function finishCareAction(type) {
    if (type === "feed") {
      pet.hunger = clamp(pet.hunger + 22);
      pet.mood = clamp(pet.mood + 6);
      pet.hp = clamp(pet.hp + 3, 0, pet.maxHp);
      pet.feedActions++;
      setMessage(`${pet.name} 吃飽了！\n飽食與心情上升。`);
    }
    if (type === "train") {
      if (pet.energy < 12 || pet.hunger < 8) {
        setMessage(`${pet.name} 太累或太餓，訓練效果很低。`);
        pet.mood = clamp(pet.mood - 2);
        gainExp(1);
      } else {
        pet.energy = clamp(pet.energy - 14);
        pet.hunger = clamp(pet.hunger - 8);
        pet.mood = clamp(pet.mood + 2);
        pet.trainActions++;
        gainExp(5 + Math.floor(pet.lv / 2));
        setMessage(`${pet.name} 訓練完成！\nEXP 增加。`);
      }
    }
    if (type === "clean") {
      pet.clean = clamp(pet.clean + 26);
      pet.mood = clamp(pet.mood + 5);
      pet.cleanActions++;
      setMessage("清潔完成！\n清潔度與心情上升。");
    }
    if (type === "sleep") {
      pet.asleep = true;
      healSleep();
      setMessage(`${pet.name} 睡了一覺。\n體力與 HP 恢復。`);
      setTimeout(() => {
        pet.asleep = false;
        setMessage(`${pet.name} 醒來了。\n可以繼續探索。`);
        savePet();
        updateUI();
      }, 2800);
    }
  }

  function manualPatrol() {
    if (enemy) {
      petAttack(3 + pet.lv);
      return;
    }
    pet.energy = clamp(pet.energy - 2);
    scan = clamp(scan + 18 + rand(0, 8), 0, 100);
    scanAnim = { type: "scan", start: now(), duration: 650 };
    sfx("scan");
    if (scan >= 100 || Math.random() < 0.22) {
      startEncounter();
    } else {
      setMessage(`巡邏搜索中...\n遇怪率累積到 ${Math.floor(scan)}%。`);
    }
    savePet();
    updateUI();
  }

  function startEncounter() {
    scan = 0;
    gameMode = "battle";
    enemy = {
      name: ["野生咕咕獸","資料蟲","黑影怪","像素幽靈","迷你巨獸"][rand(0,4)],
      hp: 18 + pet.lv * 6 + rand(0, 8),
      maxHp: 18 + pet.lv * 6 + rand(0, 8),
      atk: 2 + Math.floor(pet.lv / 2) + rand(0, 2),
      x: 35,
      y: 18,
      phase: Math.random() * 10
    };
    enemy.maxHp = enemy.hp;
    battleTickAt = now() + 900;
    scanAnim = { type: "encounter", start: now(), duration: 900 };
    setMessage(`${enemy.name} 出現了！\n守護獸會自動戰鬥，滑鼠移動可輔助攻擊。`);
    sfx("hit");
  }

  function battleLoop() {
    if (!enemy || gameMode !== "battle") return;
    if (now() < battleTickAt) return;
    battleTickAt = now() + 950;

    petAttack(0);
    if (!enemy) return;

    pet.hp = clamp(pet.hp - enemy.atk, 0, pet.maxHp);
    if (pet.hp <= 0) {
      setMessage(`${pet.name} 戰敗了...\n睡覺或餵食可以恢復。`);
      gameMode = "idle";
      enemy = null;
      pet.mood = clamp(pet.mood - 10);
      pet.energy = clamp(pet.energy - 8);
      sfx("lose");
      savePet();
      return;
    }
    savePet(false);
  }

  function petAttack(extra = 0) {
    if (!enemy) return;
    const dmg = 4 + Math.floor(pet.lv * 1.4) + rand(0, 3) + extra;
    enemy.hp -= dmg;
    sfx("hit");
    if (enemy.hp <= 0) {
      pet.battleWins++;
      pet.mood = clamp(pet.mood + 5);
      pet.energy = clamp(pet.energy - 3);
      gainExp(8 + pet.lv + rand(0, 4));
      const capture = Math.random() < 0.07;
      const msg = capture ? "低機率收服成功，圖鑑資料已更新！" : "獲得 EXP。";
      enemy = null;
      gameMode = "idle";
      sfx("win");
      setMessage(`戰鬥勝利！\n${msg}`);
      savePet();
    }
  }

  function runAutoPatrol() {
    if (!settings.autoPatrol || enemy || actionLock || pet.asleep) return;
    const interval = 22000;
    if (now() - lastAutoPatrolAt < interval) return;
    lastAutoPatrolAt = now();
    if (pet.energy < 18 || pet.hunger < 12) {
      setMessage("掛機巡邏暫停：體力或飽食不足。");
      updateUI();
      return;
    }
    scan = clamp(scan + 10 + rand(0, 8), 0, 100);
    scanAnim = { type: "auto", start: now(), duration: 700 };
    pet.energy = clamp(pet.energy - 1.5);
    if (scan >= 100 || Math.random() < 0.16) startEncounter();
    else setMessage(`掛機巡邏中...\n遇怪率 ${Math.floor(scan)}%。`);
    savePet();
    updateUI();
  }

  function runAutoCare() {
    if (!settings.autoCare || enemy || actionLock) return;
    if (now() - lastAutoCareAt < 18000) return;
    lastAutoCareAt = now();
    if (pet.hunger < 35) { pet.hunger = clamp(pet.hunger + 18); setMessage("AUTO CARE：自動餵食。"); }
    else if (pet.clean < 35) { pet.clean = clamp(pet.clean + 20); setMessage("AUTO CARE：自動清潔。"); }
    else if (pet.energy < 30 || pet.hp < pet.maxHp * .45) { healSleep(); setMessage("AUTO CARE：自動休息。"); }
    else return;
    savePet();
    updateUI();
  }

  function tick() {
    const elapsed = Math.max(1, Math.floor((now() - lastTickAt) / 15000));
    lastTickAt = now();
    for (let i = 0; i < elapsed; i++) {
      pet.age += 1;
      pet.hunger = clamp(pet.hunger - 1.4);
      pet.energy = clamp(pet.energy - 1.1);
      pet.clean = clamp(pet.clean - 1.0);
      if (pet.hunger < 25 || pet.clean < 25) pet.mood = clamp(pet.mood - 1.5);
      if (pet.hunger < 10 || pet.energy < 8) pet.hp = clamp(pet.hp - 1, 0, pet.maxHp);
      if (pet.asleep) healSleep();
    }
    savePet(false);
    updateUI();
  }

  function showStatus() {
    const col = loadDex().length;
    setMessage(`${pet.name} / ${appearanceLabel(pet.appearanceId)}\nLV ${pet.lv}  HP ${Math.floor(pet.hp)}/${pet.maxHp}  EXP ${pet.exp}\n勝利 ${pet.battleWins}｜圖鑑 ${col}/100\n巡邏 ${settings.autoPatrol ? "ON" : "OFF"}｜自動照顧 ${settings.autoCare ? "ON" : "OFF"}`);
    updateUI();
  }

  function renamePet() {
    const name = prompt("請輸入守護獸名稱", pet.name);
    if (name === null) return;
    pet.name = String(name || "PICO").trim().slice(0, 16) || "PICO";
    setMessage(`名稱已改為 ${pet.name}。`);
    savePet();
    updateUI();
  }

  function resetPetFlow() {
    const tNow = now();
    if (tNow < resetConfirmUntil) {
      pet = defaultPet();
      enemy = null;
      gameMode = "idle";
      scan = 0;
      markDex(pet.appearanceId);
      setMessage("重新孵化完成！\n新的守護獸誕生了。");
      savePet();
      updateUI();
      resetConfirmUntil = 0;
      return;
    }
    resetConfirmUntil = tNow + 7000;
    setMessage("再次按「重新孵化」確認。\n7 秒內有效。");
    updateUI();
  }

  function toggleSound() {
    settings.soundEnabled = !settings.soundEnabled;
    saveSettings();
    setMessage(settings.soundEnabled ? "音效已開啟。" : "音效已關閉。");
    syncSettingsUi();
    updateUI();
  }

  function toggleBgm() {
    settings.bgmEnabled = !settings.bgmEnabled;
    saveSettings();
    applyAudioVolume();
    if (settings.bgmEnabled && bgmAudio) bgmAudio.play().catch(()=>{});
    else if (bgmAudio) bgmAudio.pause();
    setMessage(settings.bgmEnabled ? "BGM 已開啟。" : "BGM 已關閉。");
    syncSettingsUi();
    updateUI();
  }

  function toggleAutoCare() {
    settings.autoCare = !settings.autoCare;
    saveSettings();
    setMessage(`自動照顧：${settings.autoCare ? "ON" : "OFF"}`);
    syncSettingsUi();
    updateUI();
  }

  function toggleAutoPatrol() {
    settings.autoPatrol = !settings.autoPatrol;
    lastAutoPatrolAt = now();
    saveSettings();
    setMessage(`掛機巡邏：${settings.autoPatrol ? "ON" : "OFF"}\n預設會自動開啟，可在 SYSTEM 關閉。`);
    syncSettingsUi();
    updateUI();
  }

  function openSettings() {
    if (!el.settingsBackdrop) return;
    el.settingsBackdrop.classList.add("open");
    el.settingsBackdrop.setAttribute("aria-hidden", "false");
    syncSettingsUi();
  }

  function closeSettings() {
    if (!el.settingsBackdrop) return;
    el.settingsBackdrop.classList.remove("open");
    el.settingsBackdrop.setAttribute("aria-hidden", "true");
  }

  function openDex() {
    renderDex();
    if (el.dexBackdrop) {
      el.dexBackdrop.classList.add("open");
      el.dexBackdrop.setAttribute("aria-hidden", "false");
    }
  }

  function closeDex() {
    if (el.dexBackdrop) {
      el.dexBackdrop.classList.remove("open");
      el.dexBackdrop.setAttribute("aria-hidden", "true");
    }
  }

  function renderDex() {
    const owned = loadDex();
    const set = new Set(owned);
    if (el.dexSummaryText) el.dexSummaryText.textContent = `已收集 ${owned.length} / 100`;
    if (!el.dexGrid) return;
    el.dexGrid.innerHTML = "";
    for (let id = 1; id <= 100; id++) {
      const item = document.createElement("div");
      item.className = "dex-item" + (set.has(id) ? " unlocked" : " locked") + (id === pet.appearanceId ? " current" : "");
      item.textContent = set.has(id) || id === pet.appearanceId ? appearanceLabel(id) : "???";
      item.title = `No.${id}`;
      el.dexGrid.appendChild(item);
    }
  }

  function bindSystemTabs() {
    const tabs = Array.from(document.querySelectorAll("[data-system-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-system-panel]"));
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.systemTab;
        tabs.forEach(t => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
        panels.forEach(p => p.classList.toggle("active", p.dataset.systemPanel === key));
      });
    });
  }

  function bindSettings() {
    if (el.settingsClose) el.settingsClose.addEventListener("click", closeSettings);
    if (el.settingsDone) el.settingsDone.addEventListener("click", closeSettings);
    if (el.settingsDefault) el.settingsDefault.addEventListener("click", () => {
      settings = { ...defaultSettings };
      saveSettings();
      syncSettingsUi();
      applyI18n();
      setMessage("系統設定已恢復預設。");
      updateUI();
    });

    const bindCheck = (node, key) => {
      if (!node) return;
      node.addEventListener("change", () => {
        settings[key] = !!node.checked;
        saveSettings();
        syncSettingsUi();
        updateUI();
      });
    };
    bindCheck(el.settingAnimations, "animations");
    bindCheck(el.settingAutoCare, "autoCare");
    bindCheck(el.settingAutoPatrol, "autoPatrol");
    bindCheck(el.settingMotionShake, "motionShake");

    if (el.settingMotionSensitivity) el.settingMotionSensitivity.addEventListener("change", () => {
      settings.motionSensitivity = el.settingMotionSensitivity.value;
      saveSettings();
    });

    const bindRange = (node, key, valueNode, suffix="%") => {
      if (!node) return;
      node.addEventListener("input", () => {
        settings[key] = Number(node.value);
        if (valueNode) valueNode.textContent = `${settings[key]}${suffix}`;
        saveSettings();
        syncSettingsUi();
      });
    };
    bindRange(el.settingBgmVolume, "bgmVolume", el.bgmVolValue);
    bindRange(el.settingSfxVolume, "sfxVolume", el.sfxVolValue);
    bindRange(el.settingFontSize, "fontSize", el.fontSizeValue);

    if (el.languageSelect) el.languageSelect.addEventListener("change", () => {
      settings.language = el.languageSelect.value;
      saveSettings();
      applyI18n();
      syncSettingsUi();
    });

    if (el.dexClose) el.dexClose.addEventListener("click", closeDex);
    if (el.mobileDebugClose) el.mobileDebugClose.addEventListener("click", () => {
      if (el.mobileDebugPanel) el.mobileDebugPanel.classList.remove("open");
    });
  }

  function openDebugPanel() {
    if (!el.mobileDebugPanel || !el.mobileDebugText) {
      showStatus();
      return;
    }
    el.mobileDebugText.textContent = JSON.stringify({
      mode: gameMode,
      enemy: enemy ? enemy.name : null,
      pet,
      settings,
      scan
    }, null, 2);
    el.mobileDebugPanel.classList.add("open");
  }

  function bindButtons() {
    document.addEventListener("click", ev => {
      const btn = ev.target.closest("[data-action],[data-mobile-action]");
      if (!btn) return;
      const type = btn.dataset.action || btn.dataset.mobileAction;
      if (!type) return;
      ev.preventDefault();
      ev.stopPropagation();

      if (type === "login") {
        const login = $("googleLoginBtn");
        if (login) login.click();
        return;
      }
      if (type === "sync") {
        const sync = $("cloudSyncBtn");
        if (sync) sync.click();
        return;
      }
      if (type === "debug") return openDebugPanel();

      runAction(type);
    }, true);
  }

  function bindCanvasInput() {
    if (!canvas) return;
    canvas.addEventListener("pointermove", ev => {
      initAudio();
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      if (lastPointerX !== null) {
        mouseTravel += Math.abs(x - lastPointerX);
        if (mouseTravel > rect.width * 0.7) {
          mouseTravel = 0;
          scanAnim = { type: "mouse", start: now(), duration: 550 };
          if (enemy) petAttack(2);
          else {
            scan = clamp(scan + 5, 0, 100);
            if (scan >= 100 || Math.random() < 0.08) startEncounter();
            else setMessage(`滑鼠能量掃描中...\n遇怪率 ${Math.floor(scan)}%。`);
          }
          updateUI();
        }
      }
      lastPointerX = x;
    });
  }

  function motionThreshold() {
    if (settings.motionSensitivity === "high") return 5.5;
    if (settings.motionSensitivity === "low") return 10.5;
    return 7.8;
  }

  function bindMotion() {
    window.addEventListener("devicemotion", ev => {
      if (!settings.motionShake) return;
      const a = ev.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
      if (lastMotionMag === null) {
        lastMotionMag = mag;
        return;
      }
      const delta = Math.abs(mag - lastMotionMag);
      lastMotionMag = mag;
      if (delta < motionThreshold()) return;
      const tNow = now();
      if (tNow > shakeWindowUntil) {
        shakeWindowUntil = tNow + 1400;
        shakeCount = 1;
        scanAnim = { type: "shake", start: now(), duration: 600 };
        setMessage("偵測到搖動。\n再搖一次進行探索！");
        updateUI();
        return;
      }
      shakeCount++;
      if (shakeCount >= 2) {
        shakeCount = 0;
        shakeWindowUntil = 0;
        scanAnim = { type: "shake", start: now(), duration: 700 };
        if (enemy) petAttack(3);
        else manualPatrol();
      }
    }, { passive: true });
  }

  function updateUI() {
    if (el.lv) el.lv.textContent = pet.lv;
    if (el.hp) el.hp.textContent = `${Math.floor(pet.hp)}/${pet.maxHp}`;
    if (el.age) el.age.textContent = pet.age;
    if (el.exp) el.exp.textContent = pet.exp;
    if (el.modeLabel) el.modeLabel.textContent = enemy ? "BATTLE" : pet.asleep ? "SLEEP" : settings.autoPatrol ? "AUTO" : "IDLE";
    if (el.scanFill) el.scanFill.style.width = `${clamp(scan)}%`;
    setBar(el.hungerBar, pet.hunger);
    setBar(el.moodBar, pet.mood);
    setBar(el.energyBar, pet.energy);
    setBar(el.cleanBar, pet.clean);
    setBar(el.mobileHungerBar, pet.hunger);
    setBar(el.mobileMoodBar, pet.mood);
    setBar(el.mobileEnergyBar, pet.energy);
    setBar(el.mobileCleanBar, pet.clean);
    if (el.powerLed) el.powerLed.classList.toggle("on", true);
    updateButtonsText();
  }

  function setBar(node, value) {
    if (node) node.style.width = `${clamp(value)}%`;
  }

  function px(x, y, w=1, h=1) {
    ctx.fillRect(Math.round(x*4), Math.round(y*4), Math.round(w*4), Math.round(h*4));
  }

  function drawScene() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.fillStyle = "#9fb475";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = .15;
    ctx.fillStyle = "#1f2b21";
    for (let y=0; y<32; y+=2) ctx.fillRect(0,y*4,canvas.width,1);
    ctx.globalAlpha = 1;
    drawGround();
    drawPet(13, 19);
    if (enemy) drawEnemy();
    drawActionFx();
    drawScanFx();
    ctx.restore();
  }

  function drawGround() {
    ctx.fillStyle = "#1f2b21";
    for (let x=2; x<46; x+=4) px(x, 29, 2, 1);
  }

  function drawPet(x, y) {
    let ox=0, oy=0, sc=1;
    if (actionAnim) {
      const p = Math.min(1, (now()-actionAnim.start)/actionAnim.duration);
      const wave = Math.sin(p*Math.PI*4);
      if (actionAnim.type === "feed") { oy = -Math.sin(p*Math.PI)*2; sc = 1 + Math.sin(p*Math.PI)*.04; }
      if (actionAnim.type === "train") { ox = wave > 0 ? 1 : -1; oy = Math.sin(p*Math.PI*6) > 0 ? -1 : 0; }
      if (actionAnim.type === "clean") { sc = 1 + Math.sin(p*Math.PI)*.02; }
      if (actionAnim.type === "sleep") { oy = Math.sin(p*Math.PI)*1.2; }
    } else if (!enemy && !pet.asleep) {
      oy = Math.sin(frame/18) > 0 ? 0 : -1;
    }

    ctx.save();
    ctx.translate((x+ox)*4, (y+oy)*4);
    ctx.scale(sc, sc);
    ctx.fillStyle = "#1f2b21";

    // body
    ctx.fillRect(4*4, 2*4, 11*4, 8*4);
    ctx.fillRect(2*4, 5*4, 15*4, 8*4);
    ctx.fillRect(4*4, 13*4, 11*4, 3*4);
    // ears/horns
    ctx.fillRect(3*4, 1*4, 3*4, 3*4);
    ctx.fillRect(13*4, 1*4, 3*4, 3*4);
    // eyes cutout
    ctx.clearRect(6*4, 7*4, 2*4, 2*4);
    ctx.clearRect(12*4, 7*4, 2*4, 2*4);
    ctx.fillRect(9*4, 10*4, 2*4, 1*4);
    // legs
    ctx.fillRect(5*4, 16*4, 3*4, 2*4);
    ctx.fillRect(12*4, 16*4, 3*4, 2*4);

    if (pet.asleep) {
      ctx.font = "bold 12px monospace";
      ctx.fillText("Z", 17*4, 4*4);
      ctx.fillText("z", 20*4, 1*4);
    }
    ctx.restore();

    ctx.fillStyle = "#1f2b21";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(pet.name.slice(0,8), (x+10)*4, 13*4);
  }

  function drawEnemy() {
    if (!enemy) return;
    const ex = 33 + Math.sin(frame/15 + enemy.phase) * 2;
    const ey = 18 + Math.sin(frame/20 + enemy.phase) * 1;
    ctx.fillStyle = "#1f2b21";
    px(ex, ey, 8, 7);
    px(ex-1, ey+2, 10, 4);
    px(ex+1, ey-2, 2, 2);
    px(ex+5, ey-2, 2, 2);
    ctx.clearRect((ex+2)*4, (ey+3)*4, 1*4, 1*4);
    ctx.clearRect((ex+5)*4, (ey+3)*4, 1*4, 1*4);
    ctx.fillStyle = "#1f2b21";
    ctx.fillRect(32*4, 5*4, 13*4, 2*4);
    ctx.clearRect((32+Math.floor(13*(1-enemy.hp/enemy.maxHp)))*4, 5*4, Math.ceil(13*(1-enemy.hp/enemy.maxHp))*4, 2*4);
    ctx.fillStyle = "#1f2b21";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(enemy.name.slice(0,5), 38*4, 4*4);
  }

  function drawActionFx() {
    if (!actionAnim) return;
    const p = Math.min(1, (now()-actionAnim.start)/actionAnim.duration);
    ctx.fillStyle = "#1f2b21";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    if (actionAnim.type === "feed") {
      px(8 + p*14, 15 - Math.sin(p*Math.PI)*4, 3, 3);
      ctx.fillText("+FOOD", 25*4, 8*4);
    }
    if (actionAnim.type === "train") {
      px(21, 10, 8, 1); px(20,9,1,3); px(29,9,1,3);
      ctx.fillText("TRAIN", 25*4, 8*4);
    }
    if (actionAnim.type === "clean") {
      px(5 + p*36, 9, 1, 18);
      for (let i=0;i<5;i++) px(7+i*7, 11+(i+Math.floor(p*10))%4, 1, 1);
      ctx.fillText("CLEAN", 25*4, 8*4);
    }
    if (actionAnim.type === "sleep") {
      ctx.fillText("SLEEP", 25*4, 8*4);
      ctx.fillText("Z", 31*4, 10*4);
      ctx.fillText("z", 35*4, 7*4);
    }
  }

  function drawScanFx() {
    if (!scanAnim) return;
    const p = Math.min(1, (now()-scanAnim.start)/scanAnim.duration);
    const k = Math.floor(p*6);
    ctx.fillStyle = "#1f2b21";
    ctx.globalAlpha = 1 - p*.35;
    px(5-k, 9-k, 38+k*2, 1);
    px(5-k, 28+k, 38+k*2, 1);
    px(5-k, 10-k, 1, 18+k*2);
    px(43+k, 10-k, 1, 18+k*2);
    ctx.globalAlpha = 1;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(scanAnim.type === "shake" ? "SHAKE" : enemy ? "ENCOUNT" : "SCAN", 25*4, 8*4);
    if (p >= 1) scanAnim = null;
  }

  function bootRecovery() {
    document.body.classList.remove("opening-active","title-menu-active","login-loading-active");
    document.querySelectorAll(".opening-intro-backdrop,.title-menu-backdrop,.login-loading-backdrop").forEach(n => {
      n.classList.add("closed");
      n.setAttribute("aria-hidden","true");
      n.style.display = "none";
      n.style.pointerEvents = "none";
    });
  }

  function cloudMessage(text) {
    setMessage(text);
    updateUI();
  }

  function init() {
    bootRecovery();
    pet = loadPet();
    markDex(pet.appearanceId);
    settings.autoPatrol = settings.autoPatrol !== false;
    saveSettings();
    syncSettingsUi();
    applyI18n();
    bindButtons();
    bindSettings();
    bindSystemTabs();
    bindCanvasInput();
    bindMotion();

    setMessage(`${pet.name} 已啟動。\nA餵食 B訓練 C清潔 D睡眠\nE巡邏 F狀態`);
    updateUI();
    savePet(false);

    setInterval(tick, 15000);
    setInterval(() => { runAutoPatrol(); runAutoCare(); }, 1000);
    requestAnimationFrame(loop);
  }

  function loop() {
    try {
      frame++;
      battleLoop();
      drawScene();
    } catch (err) {
      console.error("V34 core loop recovered", err);
      bootRecovery();
    }
    requestAnimationFrame(loop);
  }

  window.PixelPetI18N = { t };
  window.PixelPetGame = {
    getSaveData() {
      savePet(false);
      return {
        pet: { ...pet },
        dexOwned: loadDex(),
        settings: { ...settings },
        updatedAtMs: now()
      };
    },
    getDexData() { return loadDex(); },
    getSummary() {
      return {
        name: pet.name,
        lv: pet.lv,
        exp: pet.exp,
        hp: pet.hp,
        familyId: pet.familyId,
        branchId: pet.branchId,
        branchChosen: pet.branchChosen,
        appearanceId: pet.appearanceId,
        appearanceLabel: appearanceLabel(pet.appearanceId),
        battleWins: pet.battleWins,
        cleanActions: pet.cleanActions,
        updatedAt: pet.updatedAt || now()
      };
    },
    importCloudData(payload) {
      if (!payload || typeof payload !== "object") return false;
      const cloudPet = payload.pet || payload.save || payload;
      if (cloudPet && typeof cloudPet === "object") {
        pet = sanitizePet(cloudPet);
        markDex(pet.appearanceId);
      }
      const cloudDex = payload.dexOwned || payload.dex || [];
      if (Array.isArray(cloudDex)) saveDex([...loadDex(), ...cloudDex]);
      savePet(false);
      setMessage("雲端存檔已載入。");
      updateUI();
      return true;
    },
    setCloudMessage: cloudMessage,
    forceSave: () => savePet(),
    recover() {
      enemy = null;
      gameMode = "idle";
      actionLock = false;
      actionAnim = null;
      scanAnim = null;
      bootRecovery();
      setMessage("核心已回復可操作狀態。");
      updateUI();
    },
    debugState() {
      return { pet, enemy, gameMode, scan, settings };
    },
    SAVE_KEY,
    DEX_KEY,
    version: SAVE_VERSION
  };

  document.addEventListener("pointerdown", initAudio, { once:false, passive:true });
  window.addEventListener("error", bootRecovery);
  window.addEventListener("unhandledrejection", bootRecovery);
  init();
})();
