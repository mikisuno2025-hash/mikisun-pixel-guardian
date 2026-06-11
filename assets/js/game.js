const canvas = document.getElementById("petCanvas");
    const ctx = canvas.getContext("2d");
    const screenEl = document.getElementById("screen");
    const $ = id => document.getElementById(id);

    const SAVE_KEY = "pixelPetSave";
    const SAVE_VERSION = 8;
    const OWNED_APPEARANCE_KEY = "pixelPetDex";
    const MIGRATION_FLAG_KEY = "pixelPetMigrationV30Done";
    const COLLECTION_KEY = "pixelPetAppearanceCollectionV24";

    const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const now = () => performance.now();

    const evolutions = [
      { name: "幼年 I", minLv: 1, hp: 30, stageIndex: 0 },
      { name: "幼年 II", minLv: 3, hp: 40, stageIndex: 1 },
      { name: "成長期", minLv: 5, hp: 52, stageIndex: 2 },
      { name: "成熟期", minLv: 7, hp: 66, stageIndex: 3 },
      { name: "完全體", minLv: 9, hp: 82, stageIndex: 4 }
    ];

    const enemies = [
      { name: "雜訊蟲", icon: "bug", baseHp: 18, atk: 4, exp: 10 },
      { name: "資料史萊姆", icon: "slime", baseHp: 22, atk: 5, exp: 12 },
      { name: "位元蝙蝠", icon: "bat", baseHp: 19, atk: 6, exp: 14 },
      { name: "破圖野豬", icon: "boar", baseHp: 28, atk: 7, exp: 18 }
    ];





    const bodyNames = ["圓球", "尖角", "長耳", "豆芽", "甲殼", "幽浮", "蝙翼", "尾獸", "方塊", "皇冠"];
    const familyNames = ["星芽家族", "雙角家族", "電波家族", "葉羽家族", "月牙家族", "機械家族", "貓耳家族", "螺旋家族", "小翼家族", "晶核家族"];
    const branchNames = ["守護分支", "狂戰分支"];
    const stageLabels = ["幼年I", "幼年II", "成長期", "成熟期", "完全體"];

    function randomIndex(max) {
      if (window.crypto && crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return arr[0] % max;
      }
      return Math.floor(Math.random() * max);
    }

    function loadOwnedAppearances() {
      try {
        const raw = localStorage.getItem(OWNED_APPEARANCE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(n => Number.isInteger(n) && n >= 1 && n <= 100) : [];
      } catch (e) {
        return [];
      }
    }

    function saveOwnedAppearances(list) {
      const clean = Array.from(new Set(list.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 100)));
      try { localStorage.setItem(OWNED_APPEARANCE_KEY, JSON.stringify(clean)); } catch (e) { console.warn("dex save failed", e); }
      return clean;
    }

    function markAppearanceOwned(id) {
      const owned = loadOwnedAppearances();
      if (!owned.includes(id)) owned.push(id);
      return saveOwnedAppearances(owned);
    }

    function appearanceCollectionCount() {
      const owned = loadOwnedAppearances();
      return { owned: owned.length, remaining: Math.max(0, 100 - owned.length) };
    }

    function resetAppearanceCollection() {
      try { localStorage.removeItem(OWNED_APPEARANCE_KEY); } catch (e) { console.warn("dex reset failed", e); }
    }

    function appearanceIdFromFamilyBranchStage(familyId, branchId, stageIndex) {
      return (familyId - 1) * 10 + branchId * 5 + stageIndex + 1;
    }

    function parseAppearanceId(id) {
      const safeId = ((Number(id || 1) - 1) % 100 + 100) % 100 + 1;
      const familyId = Math.floor((safeId - 1) / 10) + 1;
      const offset = (safeId - 1) % 10;
      const branchId = Math.floor(offset / 5);
      const stageIndex = offset % 5;
      return { id: safeId, familyId, branchId, stageIndex };
    }

    function stageIndexForLevel(lv) {
      if (lv >= 9) return 4;
      if (lv >= 7) return 3;
      if (lv >= 5) return 2;
      if (lv >= 3) return 1;
      return 0;
    }

    function randomStarterFamily(previousFamilyId = 0) {
      let pool = Array.from({ length: 10 }, (_, i) => i + 1);
      if (pool.length > 1 && previousFamilyId) {
        pool = pool.filter(id => id !== previousFamilyId);
      }
      return pool[randomIndex(pool.length)];
    }

    function chooseEvolutionBranch() {
      const guardianScore =
        (pet.careScore || 0) +
        (pet.cleanActions || 0) * 2 +
        Math.floor((pet.clean || 0) / 20) +
        Math.floor((pet.mood || 0) / 25);

      const battleScore =
        (pet.battleWins || 0) * 3 +
        (pet.trainCount || 0) * 2 +
        (pet.neglectScore || 0);

      return guardianScore >= battleScore ? 0 : 1;
    }

    function getAppearance(id) {
      const info = parseAppearanceId(id);
      const familySeed = info.familyId - 1;
      const stageIndex = info.stageIndex;

      // 前兩個階段維持較中性的共同外觀；從成長期開始加入分支差異。
      const effectiveBranch = stageIndex < 2 ? 0 : info.branchId;
      const body = (familySeed + (stageIndex >= 2 ? effectiveBranch * 2 : 0) + Math.floor(stageIndex / 2)) % 10;
      const trait = (familySeed * 3 + stageIndex + effectiveBranch * 4) % 10;

      return {
        id: info.id,
        familyId: info.familyId,
        familyName: familyNames[familySeed],
        branchId: info.branchId,
        branchName: branchNames[info.branchId],
        stageIndex,
        stageLabel: stageLabels[stageIndex],
        body,
        trait,
        name: `${familyNames[familySeed]} ${stageLabels[stageIndex]}`
      };
    }

    function appearanceLabel(id) {
      const a = getAppearance(id);
      return `No.${String(a.id).padStart(3, "0")} ${a.familyName} ${a.stageLabel}`;
    }

    function syncPetAppearanceStage() {
      if (!pet) return;
      const targetStage = stageIndexForLevel(pet.lv || 1);

      if (!pet.familyId) {
        const parsed = parseAppearanceId(pet.appearanceId || 1);
        pet.familyId = parsed.familyId;
      }

      if (typeof pet.branchId !== "number") pet.branchId = 0;
      if (typeof pet.branchChosen !== "boolean") pet.branchChosen = false;

      if (targetStage >= 2 && !pet.branchChosen) {
        pet.branchId = chooseEvolutionBranch();
        pet.branchChosen = true;
      }

      pet.appearanceId = appearanceIdFromFamilyBranchStage(pet.familyId, pet.branchId || 0, targetStage);
      markAppearanceOwned(pet.appearanceId);
    }



    function legacyReadJson(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function migrateLegacyStorage() {
      if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;

      const legacySaveKeys = [
        "pixelPetRetroGuardianV33.10",
        "pixelPetRetroGuardianV28",
        "pixelPetRetroGuardianV27",
        "pixelPetRetroGuardianV26",
        "pixelPetRetroGuardianV25",
        "pixelPetRetroGuardianV24"
      ];

      const legacyDexKeys = [
        "pixelPetOwnedAppearancesV33.10",
        "pixelPetOwnedAppearancesV28",
        "pixelPetOwnedAppearancesV27",
        "pixelPetOwnedAppearancesV26",
        "pixelPetOwnedAppearancesV25",
        "pixelPetOwnedAppearancesV24"
      ];

      if (!localStorage.getItem(SAVE_KEY)) {
        for (const key of legacySaveKeys) {
          const oldSave = legacyReadJson(key);
          if (oldSave && typeof oldSave === "object") {
            oldSave.saveVersion = SAVE_VERSION;
            oldSave.migratedFrom = key;
            oldSave.migratedAt = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(oldSave));
            break;
          }
        }
      }

      const mergedDex = new Set(loadOwnedAppearances());
      for (const key of legacyDexKeys) {
        const oldDex = legacyReadJson(key);
        if (Array.isArray(oldDex)) {
          oldDex.forEach(id => {
            const n = Number(id);
            if (Number.isInteger(n) && n >= 1 && n <= 100) mergedDex.add(n);
          });
        }
      }

      if (mergedDex.size > 0) {
        saveOwnedAppearances(Array.from(mergedDex));
      }

      localStorage.setItem(MIGRATION_FLAG_KEY, String(Date.now()));
    }

    const defaultPet = (forcedFamilyId = null) => {
      const familyId = forcedFamilyId || randomStarterFamily(window.__lastFamilyId || 0);
      const appearanceId = appearanceIdFromFamilyBranchStage(familyId, 0, 0);
      window.__lastFamilyId = familyId;
      try { markAppearanceOwned(appearanceId); } catch (e) { console.warn('dex mark failed', e); }
      return {
        saveVersion: SAVE_VERSION,
        name: "PICO",
        familyId,
        branchId: 0,
        branchChosen: false,
        appearanceId,
        careScore: 0,
        cleanActions: 0,
        battleWins: 0,
        trainCount: 0,
        neglectScore: 0,
        lv: 1,
        exp: 0,
        age: 0,
        hp: 30,
        maxHp: 30,
        hunger: 72,
        mood: 70,
        energy: 68,
        clean: 75,
        sick: false,
        asleep: false,
        lastTick: Date.now(),
        bornAt: Date.now(),
        log: `PICO 誕生了！
初始家族 ${appearanceLabel(appearanceId)}`
      };
    };

    migrateLegacyStorage();
    let pet = load();
    window.__PIXEL_BOOT_OK__ = true;
    let frame = 0;
    let flash = 0;
    let rehatchPendingUntil = 0;
    let nextForcedAppearanceId = null;

    let gameMode = "idle"; // idle, transition, encounter, battle, victory, defeat
    let enemy = null;
    let enemyHp = 0;
    let enemyMaxHp = 0;
    let battlePhase = "none";
    let animStart = 0;
    let nextBattleStep = 0;

    let scan = 0;
    let lastPointerX = null;
    let lastPointerTime = 0;
    let lastDirection = 0;
    let lastShakeAt = 0;
    let shakeCooldownUntil = 0;
    let isPointerNearScreen = false;

    // V10：左右往返判定用。
    // 不是滑動就抽，而是完成兩次方向轉折才抽一次。
    let moveBucket = 0;
    let stableDirection = 0;
    let turnCount = 0;
    let lastTurnAt = 0;

    // ===== 8-BIT AUDIO ENGINE =====
    let audioCtx = null;
    let soundEnabled = localStorage.getItem("pixelPetSoundEnabled") !== "false";
    const bgmAudio = document.getElementById("bgmAudio");
    let bgmEnabled = localStorage.getItem("pixelPetBgmEnabledV19") !== "false";
    let animationsEnabled = localStorage.getItem("pixelPetAnimationsEnabled") !== "false";
    let autoCareEnabled = localStorage.getItem("pixelPetAutoCareEnabledV16") !== "false";
    let autoPatrolEnabled = localStorage.getItem("pixelPetAutoPatrolEnabledV16") !== "false";
    let lastAutoCareAt = 0;
    let lastAutoPatrolAt = 0;
    let bgmVolume = Number(localStorage.getItem("pixelPetBgmVolume") ?? "38");
    let sfxVolume = Number(localStorage.getItem("pixelPetSfxVolume") ?? "70");
    let fontSizePercent = Number(localStorage.getItem("pixelPetFontSize") ?? "100");
    let bgmStarted = false;
    let bgmBlockedByBrowser = false;
    if (bgmAudio) {
      bgmAudio.volume = bgmEnabled ? bgmVolume / 100 : 0;
    }

    function applySystemSettings() {
      bgmVolume = clamp(Number(bgmVolume) || 0, 0, 100);
      sfxVolume = clamp(Number(sfxVolume) || 0, 0, 100);
      fontSizePercent = clamp(Number(fontSizePercent) || 100, 85, 130);

      document.body.classList.toggle("no-animations", !animationsEnabled);
      document.documentElement.style.setProperty("--ui-font-scale", String(fontSizePercent / 100));

      if (bgmAudio) {
        bgmAudio.volume = bgmEnabled ? bgmVolume / 100 : 0;
      }

      const animInput = document.getElementById("settingAnimations");
      const autoCareInput = document.getElementById("settingAutoCare");
      const autoPatrolInput = document.getElementById("settingAutoPatrol");
      const bgmSlider = document.getElementById("settingBgmVolume");
      const sfxSlider = document.getElementById("settingSfxVolume");
      const fontSlider = document.getElementById("settingFontSize");

      if (animInput) animInput.checked = animationsEnabled;
      if (autoCareInput) autoCareInput.checked = autoCareEnabled;
      if (autoPatrolInput) autoPatrolInput.checked = autoPatrolEnabled;
      if (bgmSlider) bgmSlider.value = bgmVolume;
      if (sfxSlider) sfxSlider.value = sfxVolume;
      if (fontSlider) fontSlider.value = fontSizePercent;

      const bgmVal = document.getElementById("bgmVolValue");
      const sfxVal = document.getElementById("sfxVolValue");
      const fontVal = document.getElementById("fontSizeValue");
      if (bgmVal) bgmVal.textContent = `${Math.round(bgmVolume)}%`;
      if (sfxVal) sfxVal.textContent = `${Math.round(sfxVolume)}%`;
      if (fontVal) fontVal.textContent = `${Math.round(fontSizePercent)}%`;
    }

    function saveSystemSettings() {
      localStorage.setItem("pixelPetAnimationsEnabled", String(animationsEnabled));
      localStorage.setItem("pixelPetAutoCareEnabledV16", String(autoCareEnabled));
      localStorage.setItem("pixelPetAutoPatrolEnabledV16", String(autoPatrolEnabled));
      localStorage.setItem("pixelPetBgmVolume", String(Math.round(bgmVolume)));
      localStorage.setItem("pixelPetSfxVolume", String(Math.round(sfxVolume)));
      localStorage.setItem("pixelPetFontSize", String(Math.round(fontSizePercent)));
    }

    function playBgm() {
      if (!bgmEnabled || !bgmAudio) return;
      bgmAudio.muted = false;
      bgmAudio.volume = bgmEnabled ? bgmVolume / 100 : 0;

      const p = bgmAudio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          bgmStarted = true;
          bgmBlockedByBrowser = false;
        }).catch(() => {
          bgmStarted = false;
          bgmBlockedByBrowser = true;
          // 這通常是瀏覽器的自動播放限制。
          // 遊戲會持續嘗試，並在第一次互動時自動接續播放。
        });
      } else {
        bgmStarted = true;
        bgmBlockedByBrowser = false;
      }
    }

    function tryAutoStartBgm() {
      if (!bgmEnabled || !bgmAudio || bgmStarted) return;
      playBgm();
    }

    function stopBgm() {
      if (!bgmAudio) return;
      bgmAudio.pause();
      bgmStarted = false;
    }

    function toggleBgm() {
      bgmEnabled = !bgmEnabled;
      localStorage.setItem("pixelPetBgmEnabledV19", String(bgmEnabled));
      if (bgmEnabled) {
        if (bgmAudio) bgmAudio.volume = bgmVolume / 100;
        playBgm();
        setMessage("BGM：ON\\n背景音樂會自動啟動。");
      } else {
        stopBgm();
        setMessage("BGM：OFF\\n背景音樂已靜音。");
      }
      updateUI();
    try { forcePetVisibleFallback(); } catch {}
    }

    function toggleAutoCare() {
      autoCareEnabled = !autoCareEnabled;
      saveSystemSettings();
      applySystemSettings();
      sfx("care");
      setMessage(autoCareEnabled
        ? "AUTO CARE：ON\\n全自動照顧啟動。"
        : "AUTO CARE：OFF\\n改回手動照顧模式。");
      updateUI();
    }

    function toggleAutoPatrol() {
      autoPatrolEnabled = !autoPatrolEnabled;
      lastAutoPatrolAt = now();
      saveSystemSettings();
      applySystemSettings();
      sfx("care");
      setMessage(autoPatrolEnabled
        ? "AUTO PATROL：ON\\n全自動巡邏啟動。"
        : "AUTO PATROL：OFF\\n掛機巡邏已停止。");
      updateUI();
    }

    function initAudio() {
      if (!soundEnabled) return;
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      playBgm();
    }

    function tone(freq, duration = 0.08, type = "square", volume = 0.045, delay = 0) {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      const t = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume * (sfxVolume / 100), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }

    function noise(duration = 0.08, volume = 0.035, delay = 0) {
      if (!soundEnabled) return;
      initAudio();
      if (!audioCtx) return;
      const t = audioCtx.currentTime + delay;
      const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1800, t);
      gain.gain.setValueAtTime(volume * (sfxVolume / 100), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      source.start(t);
      source.stop(t + duration + 0.02);
    }

    function sfx(name) {
      if (!soundEnabled) return;
      if (name === "click") tone(520, 0.035, "square", 0.035);
      if (name === "scan") tone(420 + Math.floor(scan) * 3, 0.025, "square", 0.025);
      if (name === "scanFull") {
        tone(660, 0.06, "square", 0.045);
        tone(880, 0.06, "square", 0.045, 0.06);
        tone(1320, 0.08, "square", 0.04, 0.12);
      }
      if (name === "transition") {
        noise(0.18, 0.028);
        tone(160, 0.05, "square", 0.035);
        tone(520, 0.04, "square", 0.03, 0.08);
        tone(260, 0.05, "square", 0.03, 0.16);
        noise(0.2, 0.024, 0.18);
      }

      if (name === "encounter") {
        tone(180, 0.08, "sawtooth", 0.045);
        tone(260, 0.08, "sawtooth", 0.045, 0.08);
        tone(140, 0.14, "square", 0.05, 0.16);
        noise(0.12, 0.025, 0.08);
      }
      if (name === "petAttack") {
        tone(760, 0.055, "square", 0.045);
        tone(1040, 0.055, "square", 0.045, 0.045);
        tone(1320, 0.05, "square", 0.04, 0.09);
      }
      if (name === "enemyAttack") {
        tone(300, 0.06, "sawtooth", 0.045);
        tone(220, 0.09, "sawtooth", 0.045, 0.06);
        noise(0.06, 0.03, 0.04);
      }
      if (name === "win") {
        tone(523.25, 0.08, "square", 0.045);
        tone(659.25, 0.08, "square", 0.045, 0.09);
        tone(783.99, 0.08, "square", 0.045, 0.18);
        tone(1046.5, 0.16, "square", 0.04, 0.28);
      }
      if (name === "lose") {
        tone(392, 0.12, "square", 0.04);
        tone(330, 0.12, "square", 0.04, 0.12);
        tone(262, 0.22, "square", 0.04, 0.24);
      }
      if (name === "evolve") {
        tone(440, 0.06, "square", 0.04);
        tone(660, 0.06, "square", 0.04, 0.06);
        tone(880, 0.06, "square", 0.04, 0.12);
        tone(1320, 0.12, "square", 0.04, 0.18);
      }
      if (name === "care") {
        tone(620, 0.04, "square", 0.035);
        tone(820, 0.05, "square", 0.03, 0.045);
      }
    }

    function load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return defaultPet();

        const saved = JSON.parse(raw);
        const p = {
          saveVersion: SAVE_VERSION,
          name: "PICO",
          familyId: 1,
          branchId: 0,
          branchChosen: false,
          appearanceId: 1,
          careScore: 0,
          cleanActions: 0,
          battleWins: 0,
          trainCount: 0,
          neglectScore: 0,
          lv: 1,
          exp: 0,
          age: 0,
          hp: 30,
          maxHp: 30,
          hunger: 72,
          mood: 70,
          energy: 68,
          clean: 75,
          sick: false,
          asleep: false,
          lastTick: Date.now(),
          bornAt: Date.now(),
          log: "雲端前本機穩定存檔已載入。",
          ...saved
        };

        p.saveVersion = SAVE_VERSION;

        if (!p.familyId) {
          const parsed = parseAppearanceId(p.appearanceId || 1);
          p.familyId = parsed.familyId;
        }
        if (typeof p.branchId !== "number") p.branchId = 0;
        if (typeof p.branchChosen !== "boolean") p.branchChosen = false;

        pet = p;
        syncPetAppearanceStage();
        offlineDecay(pet);
        return pet;
      } catch {
        return defaultPet();
      }
    }

    function save() {
      pet.saveVersion = SAVE_VERSION;
      pet.lastTick = Date.now();
      pet.updatedAt = Date.now();
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(pet)); } catch (e) { console.warn("local save failed", e); }
    }

    function offlineDecay(p) {
      const minutes = Math.min(240, Math.floor((Date.now() - (p.lastTick || Date.now())) / 60000));
      if (minutes <= 0) return;
      const d = Math.floor(minutes / 4);
      p.hunger = clamp(p.hunger - d * 2);
      p.energy = clamp(p.energy - d);
      p.clean = clamp(p.clean - d * 2);
      p.mood = clamp(p.mood - d);
      p.age = Math.floor((Date.now() - (p.bornAt || Date.now())) / 60000);
      if (p.hunger < 15 || p.clean < 15) p.sick = true;
      if (p.hunger === 0 || p.clean === 0) p.hp = clamp(p.hp - d * 2, 1, p.maxHp);
    }

    function currentEvolution() {
      return evolutions[stageIndexForLevel(pet.lv || 1)] || evolutions[0];
    }

    function setMessage(text) {
      pet.log = text;
      $("message").textContent = text;
    }


    function forcePetVisibleFallback() {
      if (!canvas || !ctx || !pet) return;
      const box = ensureCanvasSize ? ensureCanvasSize() : null;
      const w = (box && box.w) || canvas.clientWidth || 520;
      const h = (box && box.h) || canvas.clientHeight || 320;
      // If the normal draw path produced an empty-looking screen, draw a simple LCD guardian fallback.
      // This does not replace the full pixel art; it only prevents blank mobile canvas.
      try {
        const ap = getAppearance ? getAppearance(pet.appearanceId || 1) : null;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#263528";
        const cx = w / 2;
        const cy = h * 0.52;
        const s = Math.max(22, Math.min(48, w * 0.09));
        ctx.fillRect(cx - s, cy - s, s * 2, s * 1.7);
        ctx.fillRect(cx - s * 0.7, cy - s * 1.6, s * 1.4, s * 0.8);
        ctx.fillRect(cx - s * 1.25, cy - s * 0.2, s * 0.35, s * 0.8);
        ctx.fillRect(cx + s * 0.9, cy - s * 0.2, s * 0.35, s * 0.8);
        ctx.fillStyle = "#b6c98e";
        ctx.fillRect(cx - s * 0.45, cy - s * 1.32, s * 0.25, s * 0.25);
        ctx.fillRect(cx + s * 0.2, cy - s * 1.32, s * 0.25, s * 0.25);
        ctx.fillRect(cx - s * 0.35, cy - s * 0.08, s * 0.7, s * 0.16);
        ctx.fillStyle = "#263528";
        ctx.font = "700 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ap ? ("No." + String(ap.id).padStart(3, "0")) : "GUARDIAN", cx, Math.min(h - 12, cy + s * 1.25));
        ctx.restore();
      } catch (e) {
        console.warn("fallback draw failed", e);
      }
    }

    function updateUI() {
      syncPetAppearanceStage();
      const evo = currentEvolution();
      if (pet && pet.appearanceId) markAppearanceOwned(pet.appearanceId);
      if (pet.maxHp !== evo.hp) {
        const diff = evo.hp - pet.maxHp;
        pet.maxHp = evo.hp;
        pet.hp = clamp(pet.hp + diff, 1, pet.maxHp);
      }

      $("lv").textContent = pet.lv;
      $("hp").textContent = `${Math.round(pet.hp)}/${pet.maxHp}`;
      $("age").textContent = Math.floor((Date.now() - pet.bornAt) / 60000);
      $("exp").textContent = pet.exp;

      $("hungerBar").style.width = `${pet.hunger}%`;
      $("moodBar").style.width = `${pet.mood}%`;
      $("energyBar").style.width = `${pet.energy}%`;
      $("cleanBar").style.width = `${pet.clean}%`;
      $("scanFill").style.width = `${scan}%`;

      const label = gameMode === "battle" ? "FIGHT" : gameMode === "transition" ? "SIGNAL" : gameMode === "encounter" ? "WARN" : gameMode === "victory" ? "WIN" : gameMode === "defeat" ? "LOSE" : `${Math.floor(scan)}%`;
      $("modeLabel").textContent = label;
      screenEl.classList.toggle("transitioning", gameMode === "transition");

      $("message").textContent = pet.log;
      const soundBtn = document.querySelector('button[data-action="sound"]');
      if (soundBtn) soundBtn.innerHTML = soundEnabled ? "音效 ON" : "音效 OFF";
      const bgmBtn = document.querySelector('button[data-action="bgm"]');
      if (bgmBtn) bgmBtn.innerHTML = bgmEnabled ? "BGM ON" : "BGM OFF";
      const autoCareBtn = document.querySelector('button[data-action="autocare"]');
      if (autoCareBtn) autoCareBtn.innerHTML = autoCareEnabled ? "AUTO ON" : "AUTO OFF";
      const autoPatrolBtn = document.querySelector('button[data-action="autopatrol"]');
      if (autoPatrolBtn) autoPatrolBtn.innerHTML = autoPatrolEnabled ? "PATROL ON" : "PATROL OFF";
      applySystemSettings();
      const led = $("powerLed");
      if (led) led.classList.toggle("on", true);
      applyLanguage();
      save();
    }

    function gainExp(amount) {
      const beforeId = pet.appearanceId;
      const beforeStage = stageIndexForLevel(pet.lv || 1);
      pet.exp += amount;
      while (pet.exp >= pet.lv * 18) {
        pet.exp -= pet.lv * 18;
        pet.lv += 1;
        pet.maxHp += 4;
        pet.hp = pet.maxHp;
        pet.mood = clamp(pet.mood + 10);
      }
      const afterStage = stageIndexForLevel(pet.lv || 1);
      const willBranchNow = beforeStage < 2 && afterStage >= 2 && !pet.branchChosen;
      let chosenBranch = pet.branchId || 0;
      if (willBranchNow) {
        chosenBranch = chooseEvolutionBranch();
        pet.branchId = chosenBranch;
        pet.branchChosen = true;
      }
      syncPetAppearanceStage();
      const evolved = afterStage > beforeStage;
      if (evolved) {
        showEvolutionAnimation(beforeId, pet.appearanceId, willBranchNow ? branchNames[chosenBranch] : "");
      }
      return evolved;
    }

    function canEncounter() {
      return gameMode === "idle" && !pet.asleep && pet.energy >= 8 && pet.hp > 2 && now() > shakeCooldownUntil;
    }

    function pointerNearScreen(clientX, clientY) {
      const r = screenEl.getBoundingClientRect();
      const margin = 24;
      return (
        clientX >= r.left - margin &&
        clientX <= r.right + margin &&
        clientY >= r.top - margin &&
        clientY <= r.bottom + margin
      );
    }

    function resetPointerIfStale(t, x) {
      if (lastPointerX === null || t - lastPointerTime > 700) {
        lastPointerX = x;
        lastPointerTime = t;
        lastDirection = 0;
        return true;
      }
      return false;
    }

    function rollEncounterByRoundTrip() {
      if (!canEncounter() || gameMode !== "idle") return;

      lastShakeAt = now();

      // 保底滿了就直接遇怪，並歸零重新計算。
      if (scan >= 100) {
        scan = 0;
        setMessage(`保底條滿格！\n這次保證遇怪，條歸零。`);
        sfx("scanFull");
        updateUI();

        setTimeout(() => {
          if (gameMode === "idle" && !pet.asleep && pet.hp > 2) {
            startTransition();
          }
        }, 220);
        return;
      }

      // V10：一次完整左右往返，只抽 10% 遇怪。
      const encounterRate = 0.10;

      if (Math.random() < encounterRate) {
        scan = 0;
        setMessage(`左右往返完成！\n10% 遭遇成功，保底條歸零。`);
        sfx("scanFull");
        updateUI();

        setTimeout(() => {
          if (gameMode === "idle" && !pet.asleep && pet.hp > 2) {
            startTransition();
          }
        }, 180);
        return;
      }

      // 遭遇失敗才 +1。
      scan = clamp(scan + 1);
      sfx("scan");

      if (scan >= 100) {
        scan = 0;
        setMessage(`遭遇失敗，但保底條滿格！\n這次保證遇怪，條歸零。`);
        sfx("scanFull");
        updateUI();

        setTimeout(() => {
          if (gameMode === "idle" && !pet.asleep && pet.hp > 2) {
            startTransition();
          }
        }, 220);
        return;
      }

      setMessage(`左右往返完成。\n沒有遇到怪物。\n保底條 +1% → ${Math.floor(scan)}%`);
      updateUI();
    }

    function onPointerMove(clientX, clientY) {
      const t = now();
      isPointerNearScreen = pointerNearScreen(clientX, clientY);
      if (!isPointerNearScreen || !canEncounter()) return;

      if (resetPointerIfStale(t, clientX)) {
        moveBucket = 0;
        stableDirection = 0;
        turnCount = 0;
        lastTurnAt = 0;
        return;
      }

      const dx = clientX - lastPointerX;
      lastPointerX = clientX;
      lastPointerTime = t;

      // 太小的抖動忽略，避免滑鼠微震也算。
      if (Math.abs(dx) < 2) return;

      // 累積橫向移動量，慢慢移動也能被判定，不要求單幀大幅度。
      moveBucket += dx;

      // 需要累積到一定距離，才認定為往左或往右。
      const directionThreshold = 26;
      if (Math.abs(moveBucket) < directionThreshold) return;

      const direction = moveBucket > 0 ? 1 : -1;
      moveBucket = 0;

      if (stableDirection === 0) {
        stableDirection = direction;
        setMessage(`方向記錄中...\n完成左右往返才會抽遇怪。\n保底條：${Math.floor(scan)}%`);
        updateUI();
        return;
      }

      // 只有方向轉折才計數。
      if (direction !== stableDirection) {
        const debounceOk = t - lastTurnAt > 120;
        stableDirection = direction;

        if (!debounceOk) return;

        lastTurnAt = t;
        turnCount += 1;
        sfx("scan");

        if (turnCount >= 2) {
          turnCount = 0;
          pet.energy = clamp(pet.energy - 0.35);
          rollEncounterByRoundTrip();
        } else {
          setMessage(`轉折 ${turnCount}/2。\n再折返一次才抽遇怪。\n保底條：${Math.floor(scan)}%`);
          updateUI();
        }
      }
    }

    screenEl.addEventListener("pointerenter", () => { isPointerNearScreen = true; });
    screenEl.addEventListener("pointerleave", () => { setTimeout(() => { isPointerNearScreen = false; }, 450); });
    screenEl.addEventListener("pointerdown", e => {
      initAudio();
      isPointerNearScreen = true;
      lastPointerX = e.clientX;
      lastPointerTime = now();
      moveBucket = 0;
      stableDirection = 0;
      turnCount = 0;
      lastTurnAt = 0;
      try { screenEl.setPointerCapture(e.pointerId); } catch {}
    });

    document.addEventListener("pointermove", e => {
      onPointerMove(e.clientX, e.clientY);
    }, { passive: true });

    screenEl.addEventListener("touchmove", e => {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });


    function rehatchPet() {
      const t = now();

      // V21：不用瀏覽器 confirm，避免 ChatGPT 預覽或手機瀏覽器擋掉彈窗。
      // 第一次按只進入確認狀態，7 秒內再按一次才真正重置。
      if (t > rehatchPendingUntil) {
        rehatchPendingUntil = t + 7000;
        sfx("scan");
        setMessage(`重新孵化確認
7 秒內再按一次按鈕才會執行。
會 LV 歸零、EXP 歸零、重抽初始家族。
分岔進化要重新培養。`);
        updateUI();
        return;
      }

      rehatchPendingUntil = 0;

      const oldFamilyId = Number(pet?.familyId || parseAppearanceId(pet?.appearanceId || 1).familyId || 0);
      const newFamilyId = randomStarterFamily(oldFamilyId);
      pet = defaultPet(newFamilyId);
      gameMode = "idle";
      enemy = null;
      enemyHp = 0;
      enemyMaxHp = 0;
      battlePhase = "none";
      animStart = 0;
      nextBattleStep = 0;
      scan = 0;
      lastPointerX = null;
      lastPointerTime = 0;
      lastDirection = 0;
      lastShakeAt = 0;
      shakeCooldownUntil = 0;
      isPointerNearScreen = false;
      moveBucket = 0;
      stableDirection = 0;
      turnCount = 0;
      lastTurnAt = 0;
      lastAutoCareAt = 0;
      lastAutoPatrolAt = now();
      flash = 18;

      sfx("scanFull");
      const ap = getAppearance(pet.appearanceId);
      setMessage(`重新孵化完成！
LV 回到 1。
新家族：${ap.familyName}
初始外觀：${appearanceLabel(pet.appearanceId)}`);
      updateUI();
      save();
    }

    function action(type) {
      initAudio();
      sfx("click");

      if (type === "reset") {
        rehatchPet();
        return;
      }

      if ((gameMode === "battle" || gameMode === "encounter" || gameMode === "transition")
          && !["sound", "bgm", "system", "autocare", "autopatrol", "status", "dex"].includes(type)) {
        setMessage("對戰進行中！\n照顧按鈕暫停；重新孵化與 SYSTEM 仍可使用。");
        updateUI();
        return;
      }

      if (type !== "sleep" && type !== "status" && type !== "sound" && type !== "bgm" && type !== "system" && type !== "autocare" && type !== "autopatrol" && type !== "dex" && pet.asleep) {
        pet.asleep = false;
        setMessage(`${pet.name} 醒來了。\nZzz 訊號停止。`);
        updateUI();
        return;
      }

      if (type === "feed") {
        pet.hunger = clamp(pet.hunger + 22);
        pet.mood = clamp(pet.mood + 5);
        pet.clean = clamp(pet.clean - 4);
        pet.hp = clamp(pet.hp + 3, 1, pet.maxHp);
        pet.sick = pet.hunger < 10 ? pet.sick : false;
        sfx("care");
        setMessage(`${pet.name} 吃了資料飯糰。\n飽食上升，螢幕有點髒。`);
      }

      if (type === "train") {
        if (pet.energy < 16 || pet.hunger < 12) {
          pet.mood = clamp(pet.mood - 6);
          setMessage(`${pet.name} 沒力訓練。\n先餵食或讓牠睡一下。`);
        } else {
          pet.energy = clamp(pet.energy - 16);
          pet.hunger = clamp(pet.hunger - 10);
          pet.clean = clamp(pet.clean - 7);
          pet.mood = clamp(pet.mood + rand(3, 9));
          const evolved = gainExp(rand(6, 10));
          sfx(evolved ? "evolve" : "care");
          setMessage(evolved
            ? `${pet.name} 訓練成功！\n等級提升，外型進化了！`
            : `${pet.name} 完成訓練。\nEXP 上升。`);
        }
      }

      if (type === "clean") {
        pet.clean = 100;
        pet.mood = clamp(pet.mood + 8);
        pet.sick = false;
        sfx("care");
        setMessage(`螢幕除塵完成。\n${pet.name} 變得亮晶晶。`);
      }

      if (type === "sleep") {
        pet.asleep = !pet.asleep;
        if (pet.asleep) {
          pet.energy = clamp(pet.energy + 24);
          pet.hp = clamp(pet.hp + 6, 1, pet.maxHp);
          sfx("care");
          setMessage(`${pet.name} 進入省電睡眠。\n體力慢慢恢復。`);
        } else {
          setMessage(`${pet.name} 醒來了。\n左右搖螢幕區可探索。`);
        }
      }

      if (type === "patrol") {
        setMessage("不用按對戰。\n左右往返一次抽10%，\n失敗保底 +1%。");
      }

      if (type === "status") {
        const evo = currentEvolution();
        setMessage(`${pet.name} / ${evo.name}\nLV:${pet.lv} HP:${pet.hp}/${pet.maxHp}\n狀態:${pet.sick ? "有點故障" : "良好"}`);
      }

      if (type === "rename") {
        const name = prompt("替守護獸命名：", pet.name);
        if (name && name.trim()) {
          pet.name = name.trim().slice(0, 10).toUpperCase();
          setMessage(`名字更新為 ${pet.name}。\n新的連線已建立。`);
        }
      }

      if (type === "dex") {
        openDex();
      }

      if (type === "sound") {
        soundEnabled = !soundEnabled;
        localStorage.setItem("pixelPetSoundEnabled", String(soundEnabled));
        if (soundEnabled) {
          initAudio();
          sfx("care");
          setMessage("8-bit 音效：ON\n已啟用掌機風音效。");
        } else {
          setMessage("8-bit 音效：OFF\n已切換為靜音模式。");
        }
      }

      if (type === "bgm") {
        toggleBgm();
      }

      if (type === "autocare") {
        toggleAutoCare();
      }

      if (type === "autopatrol") {
        toggleAutoPatrol();
      }

      if (type === "system") {
        openSettings();
      }

      updateUI();
    }


    function startTransition() {
      if (!canEncounter()) return;
      gameMode = "transition";
      flash = 12;
      sfx("transition");
      setMessage("LCD LINK...\n野生訊號接続中...");
      shakeCooldownUntil = now() + 1400;
      lastPointerX = null;
      lastDirection = 0;
      moveBucket = 0;
      stableDirection = 0;
      turnCount = 0;
      lastTurnAt = 0;
      updateUI();

      setTimeout(() => {
        if (gameMode === "transition") {
          gameMode = "idle";
          startEncounter();
        }
      }, 1250);
    }

    function startEncounter() {
      if (pet.asleep || pet.energy < 8 || pet.hp <= 2) {
        gameMode = "idle";
        updateUI();
        return;
      }
      const template = enemies[rand(0, enemies.length - 1)];
      const enemyLv = Math.max(1, pet.lv + rand(-1, 2));
      enemy = {
        ...template,
        lv: enemyLv,
        atk: template.atk + Math.floor(enemyLv * 1.15),
        exp: template.exp + enemyLv * 2
      };
      enemyMaxHp = template.baseHp + enemyLv * 6;
      enemyHp = enemyMaxHp;
      gameMode = "encounter";
      flash = 10;
      pet.asleep = false;
      lastPointerX = null;
      lastDirection = 0;
      moveBucket = 0;
      stableDirection = 0;
      turnCount = 0;
      lastTurnAt = 0;
      shakeCooldownUntil = now() + 1000;
      sfx("encounter");
      setMessage(`野生 ${enemy.name} LV${enemy.lv}\n突然跳出來了！`);
      updateUI();

      setTimeout(() => {
        if (!enemy) return;
        gameMode = "battle";
        nextBattleStep = now() + 450;
        setMessage("自動對戰開始！\n不用按任何按鈕。");
        updateUI();
      }, 900);
    }

    function battleLoop() {
      if (gameMode !== "battle" || !enemy) return;
      if (now() < nextBattleStep) return;
      const petSpeed = pet.mood + pet.energy + rand(0, 30);
      const enemySpeed = 75 + enemy.lv * 8 + rand(0, 30);
      if (petSpeed >= enemySpeed) petAttack();
      else enemyAttack();
    }

    function petAttack() {
      battlePhase = "petAttack";
      animStart = now();
      const dmg = Math.max(2, Math.floor(pet.lv * 4 + pet.mood / 12 + rand(0, 8) - (pet.sick ? 4 : 0)));
      enemyHp = clamp(enemyHp - dmg, 0, enemyMaxHp);
      sfx("petAttack");
      setMessage(`${pet.name} 發射像素脈衝！\n${enemy.name} 受到 ${dmg} 傷害。`);
      nextBattleStep = now() + 1150;
      flash = 4;

      if (enemyHp <= 0) setTimeout(victory, 900);
      else setTimeout(() => { battlePhase = "none"; }, 700);
      updateUI();
    }

    function enemyAttack() {
      battlePhase = "enemyAttack";
      animStart = now();
      const dmg = Math.max(1, Math.floor(enemy.atk + rand(0, 5) - pet.clean / 35));
      pet.hp = clamp(pet.hp - dmg, 1, pet.maxHp);
      pet.mood = clamp(pet.mood - 3);
      sfx("enemyAttack");
      setMessage(`${enemy.name} 撞擊！\n${pet.name} 受到 ${dmg} 傷害。`);
      nextBattleStep = now() + 1150;
      flash = 4;

      if (pet.hp <= 1) setTimeout(defeat, 900);
      else setTimeout(() => { battlePhase = "none"; }, 700);
      updateUI();
    }

    function victory() {
      if (!enemy) return;
      const expGain = enemy.exp;
      pet.battleWins = (pet.battleWins || 0) + 1;
      const evolved = gainExp(expGain);
      pet.mood = clamp(pet.mood + 10);
      pet.energy = clamp(pet.energy - 8);
      pet.hunger = clamp(pet.hunger - 8);
      gameMode = "victory";
      battlePhase = "none";
      flash = 12;
      sfx(evolved ? "evolve" : "win");
      setMessage(evolved
        ? `${enemy.name} 擊破！+${expGain} EXP\n${pet.name} 升級進化了！`
        : `${enemy.name} 擊破！\n獲得 ${expGain} EXP。`);
      enemy = null;
      shakeCooldownUntil = now() + 1600;
      setTimeout(() => {
        if (gameMode === "victory") gameMode = "idle";
        setMessage("探索完成。\n左右搖螢幕區可再次遇怪。");
        updateUI();
      }, 1800);
      updateUI();
    }

    function defeat() {
      if (!enemy) return;
      gameMode = "defeat";
      battlePhase = "none";
      pet.sick = true;
      pet.neglectScore = (pet.neglectScore || 0) + 2;
      pet.energy = clamp(pet.energy - 12);
      pet.mood = clamp(pet.mood - 15);
      sfx("lose");
      setMessage(`${pet.name} 戰敗了...\n請餵食、清潔、睡覺恢復。`);
      enemy = null;
      shakeCooldownUntil = now() + 2200;
      setTimeout(() => {
        if (gameMode === "defeat") gameMode = "idle";
        updateUI();
      }, 1800);
      updateUI();
    }



    function runAutoPatrol() {
      if (!autoPatrolEnabled) return;
      if (gameMode !== "idle") return;
      if (pet.asleep) return;

      const t = now();
      const patrolInterval = 10000; // V17 全自動：10 秒巡邏一次，失敗穩定 +1%。
      if (t - lastAutoPatrolAt < patrolInterval) return;
      lastAutoPatrolAt = t;

      // 狀態不足就暫停這次巡邏，但不自動關閉開關。
      if (pet.hp <= Math.floor(pet.maxHp * 0.35) || pet.energy < 25 || pet.hunger < 18 || pet.clean < 20 || pet.sick) {
        setMessage("AUTO PATROL\n狀態不足，暫停巡邏。\nAUTO CARE 會先恢復狀態，保底條不會下降。");
        runAutoCare(true);
        updateUI();
        return;
      }

      // 掛機巡邏消耗，避免無成本刷怪。
      pet.energy = clamp(pet.energy - 4);
      pet.hunger = clamp(pet.hunger - 2);
      pet.clean = clamp(pet.clean - 2);

      const encounterRate = 0.10;

      if (scan >= 100) {
        scan = 0;
        setMessage("AUTO PATROL\n保底條滿格，保證遇怪！");
        sfx("scanFull");
        updateUI();

        setTimeout(() => {
          if (gameMode === "idle" && !pet.asleep && pet.hp > 2) {
            startTransition();
          }
        }, 220);
        return;
      }

      if (Math.random() < encounterRate) {
        scan = 0;
        setMessage("AUTO PATROL\n巡邏遭遇成功！保底條歸零。");
        sfx("scanFull");
        updateUI();

        setTimeout(() => {
          if (gameMode === "idle" && !pet.asleep && pet.hp > 2) {
            startTransition();
          }
        }, 220);
        return;
      }

      scan = clamp(scan + 1);
      sfx("scan");

      if (scan >= 100) {
        scan = 0;
        setMessage("AUTO PATROL\n巡邏失敗，但保底條滿格！\n保證遇怪。");
        sfx("scanFull");
        updateUI();

        setTimeout(() => {
          if (gameMode === "idle" && !pet.asleep && pet.hp > 2) {
            startTransition();
          }
        }, 220);
        return;
      }

      setMessage(`AUTO PATROL\n巡邏沒有遇怪。\n保底條 +1% → ${Math.floor(scan)}%`);
      updateUI();
    }

    function runAutoCare(force = false) {
      if (!autoCareEnabled) return;
      if (gameMode === "battle" || gameMode === "encounter" || gameMode === "transition") return;

      const t = now();

      // 睡覺中：自動照顧會主動補體力，不再只靠 15 秒自然回復。
      if (pet.asleep) {
        if (!force && t - lastAutoCareAt < 3000) return;

        pet.energy = clamp(pet.energy + 8);
        pet.hp = clamp(pet.hp + 3, 1, pet.maxHp);
        pet.hunger = clamp(pet.hunger - 1);
        lastAutoCareAt = t;

        if (pet.energy >= 88 && pet.hp >= Math.floor(pet.maxHp * 0.72)) {
          pet.asleep = false;
          sfx("care");
          setMessage("AUTO CARE\n體力已恢復，寵物自動起床。");
        } else {
          setMessage(`AUTO REST\n睡眠回復中... 體力 ${Math.floor(pet.energy)}%`);
        }

        updateUI();
        return;
      }

      if (!force && t - lastAutoCareAt < 3500) return;

      // 優先順序：危急休息 > 餵食 > 清潔 > 一般休息。
      // V14：休息門檻提高，避免體力掉太低才開始睡。
      if (pet.hp <= Math.floor(pet.maxHp * 0.46) || pet.energy <= 52) {
        pet.asleep = true;
        pet.energy = clamp(pet.energy + 8);
        pet.hp = clamp(pet.hp + 3, 1, pet.maxHp);
        lastAutoCareAt = t;
        sfx("care");
        setMessage("AUTO CARE\n體力或 HP 偏低，自動休息補充。");
        updateUI();
        return;
      }

      if (pet.hunger <= 42) {
        pet.hunger = clamp(pet.hunger + 28);
        pet.mood = clamp(pet.mood + 3);
        pet.clean = clamp(pet.clean - 3);
        pet.hp = clamp(pet.hp + 2, 1, pet.maxHp);
        lastAutoCareAt = t;
        sfx("care");
        setMessage("AUTO CARE\n飽食偏低，已自動餵食。");
        updateUI();
        return;
      }

      if (pet.clean <= 38 || pet.sick) {
        pet.clean = 100;
        pet.sick = false;
        pet.mood = clamp(pet.mood + 4);
        lastAutoCareAt = t;
        sfx("care");
        setMessage("AUTO CARE\n清潔偏低，已自動清潔。");
        updateUI();
        return;
      }

      if (pet.energy <= 64) {
        pet.asleep = true;
        pet.energy = clamp(pet.energy + 6);
        lastAutoCareAt = t;
        sfx("care");
        setMessage("AUTO CARE\n體力低於安全值，自動進入休息。");
        updateUI();
        return;
      }
    }

    function tick() {
      if (gameMode === "battle" || gameMode === "encounter" || gameMode === "transition") {
        updateUI();
        return;
      }

      if (pet.asleep) {
        pet.energy = clamp(pet.energy + 1);
        pet.hunger = clamp(pet.hunger - 1);
      } else {
        pet.hunger = clamp(pet.hunger - 1);
        pet.energy = clamp(pet.energy - 1);
        pet.clean = clamp(pet.clean - 1);
        if (pet.hunger < 25 || pet.clean < 25) pet.mood = clamp(pet.mood - 1);
        if (pet.hunger < 10 || pet.clean < 10) {
          pet.sick = true;
          pet.neglectScore = (pet.neglectScore || 0) + 1;
        }
        if (pet.hunger === 0 || pet.clean === 0 || pet.sick) pet.hp = clamp(pet.hp - 1, 1, pet.maxHp);
      }

      // V17：scan 已改為「保底條」，不再自然下降。
      // 只有遇怪成功或保底條滿格觸發遇怪時才歸零。
      pet.age = Math.floor((Date.now() - pet.bornAt) / 60000);

      if (pet.hp <= 1) {
        pet.mood = clamp(pet.mood - 3);
        setMessage(`${pet.name} 快當機了！\n請餵食、清潔、睡覺。`);
      }
      updateUI();
    }

    function px(x, y, w = 1, h = 1) {
      ctx.fillRect(x * 4, y * 4, w * 4, h * 4);
    }


    function ensureCanvasSize() {
      if (!canvas) return;
      const box = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      const cssW = Math.max(260, Math.floor((box && box.width) || canvas.clientWidth || 520));
      const cssH = Math.max(180, Math.floor((box && box.height) || canvas.clientHeight || 320));
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const targetW = Math.floor(cssW * ratio);
      const targetH = Math.floor(cssH * ratio);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      if (ctx && ctx.setTransform) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      return { w: cssW, h: cssH, ratio };
    }

    function drawPetAt(offsetX, offsetY, scale = 1) {
      const old = ctx.getTransform();
      ctx.translate(offsetX * 4, offsetY * 4);
      ctx.scale(scale, scale);

      const bob = pet.asleep ? 0 : Math.sin(frame / 14) > 0 ? 1 : 0;
      const blink = Math.floor(frame / 48) % 5 === 0;
      const evo = currentEvolution();
      const ap = getAppearance(pet.appearanceId);
      ctx.fillStyle = "#1f2b21";
      const p = (x,y,w=1,h=1)=>ctx.fillRect(x*4,y*4,w*4,h*4);

      // V27：20 條路線共享 10 種基礎體型，但進化階段由 stageIndex 清楚區分。
      const stageBonus = ap.stageIndex >= 1 ? 1 : 0;
      const bigBonus = ap.stageIndex >= 2 ? 1 : 0;
      const bx = 14;
      const by = 16 + bob - bigBonus;

      function eyePair(y, wide = 0) {
        if (!blink) {
          p(10 - wide, y, 2, 2);
          p(18 + wide, y, 2, 2);
        }
      }

      function baseRound() {
        p(10, by-2, 8, 1); p(7, by-1, 14, 1); p(5, by, 18, 2); p(4, by+2, 20, 7+stageBonus);
        p(5, by+9+stageBonus, 18, 2); p(8, by+11+stageBonus, 12, 1);
      }
      function baseHorn() {
        p(8, by-3, 4, 3); p(17, by-3, 4, 3); p(6, by, 17, 2); p(4, by+2, 21, 8+stageBonus);
        p(6, by+10+stageBonus, 17, 2);
      }
      function baseLongEar() {
        p(6, by-5, 3, 6); p(20, by-5, 3, 6); p(8, by-1, 13, 2); p(5, by+1, 19, 9+stageBonus);
        p(7, by+10+stageBonus, 15, 2);
      }
      function baseSprout() {
        p(14, by-6, 1, 4); p(15, by-6, 3, 1); p(11, by-2, 7, 1); p(7, by-1, 15, 2);
        p(5, by+1, 19, 9+stageBonus); p(8, by+10+stageBonus, 13, 2);
      }
      function baseShell() {
        p(8, by-2, 13, 2); p(5, by, 19, 3); p(3, by+3, 23, 7+stageBonus); p(6, by+10+stageBonus, 17, 2);
        p(7, by+2, 2, 8); p(20, by+2, 2, 8);
      }
      function baseUfo() {
        p(10, by-1, 8, 2); p(5, by+1, 18, 3); p(1, by+4, 26, 4); p(5, by+8, 18, 3+stageBonus);
        p(9, by+11+stageBonus, 10, 1);
      }
      function baseBat() {
        p(11, by-2, 7, 1); p(7, by-1, 15, 2); p(5, by+1, 19, 8+stageBonus);
        p(1, by+3, 4, 4); p(24, by+3, 4, 4); p(8, by+9+stageBonus, 13, 2);
      }
      function baseTailBeast() {
        p(8, by-2, 13, 2); p(5, by, 19, 9+stageBonus); p(7, by+9+stageBonus, 15, 2);
        p(23, by+5, 4, 2); p(26, by+4, 2, 4);
      }
      function baseBlock() {
        p(6, by-2, 18, 2); p(4, by, 22, 11+stageBonus); p(6, by+11+stageBonus, 18, 2);
        p(5, by+1, 2, 2); p(23, by+1, 2, 2);
      }
      function baseCrown() {
        p(9, by-4, 2, 3); p(14, by-5, 2, 4); p(19, by-4, 2, 3);
        p(8, by-1, 14, 2); p(5, by+1, 20, 9+stageBonus); p(7, by+10+stageBonus, 16, 2);
      }

      const bodies = [baseRound, baseHorn, baseLongEar, baseSprout, baseShell, baseUfo, baseBat, baseTailBeast, baseBlock, baseCrown];
      bodies[ap.body]();

      // 臉部位置依體型略調整
      const eyeY = by + (ap.body === 5 ? 5 : 4);
      eyePair(eyeY, ap.body === 8 ? 1 : 0);

      // 10 種外觀特徵，疊在不同體型上
      switch (ap.trait) {
        case 0: // 星芽
          p(14, by-8, 2, 2); p(13, by-7, 4, 1); p(15, by-9, 1, 4);
          p(12, by+7, 2, 1); p(17, by+7, 2, 1);
          break;
        case 1: // 雙角
          p(6, by-4, 2, 4); p(22, by-4, 2, 4); p(7, by-5, 1, 1); p(22, by-5, 1, 1);
          p(13, by+8, 4, 1);
          break;
        case 2: // 電波
          p(3, by-1, 1, 2); p(1, by-3, 2, 1); p(25, by-1, 1, 2); p(27, by-3, 2, 1);
          p(13, by+7, 1, 1); p(16, by+7, 1, 1);
          break;
        case 3: // 葉羽
          p(10, by-5, 3, 1); p(8, by-4, 4, 1); p(17, by-5, 3, 1); p(18, by-4, 4, 1);
          p(2, by+5, 3, 2); p(24, by+5, 3, 2);
          break;
        case 4: // 月牙
          p(13, by-6, 4, 1); p(12, by-5, 2, 1); p(16, by-4, 2, 1);
          p(12, by+8, 6, 1);
          break;
        case 5: // 機械
          p(6, by+2, 3, 1); p(21, by+2, 3, 1); p(7, by+3, 1, 3); p(22, by+3, 1, 3);
          p(14, by+8, 2, 2);
          break;
        case 6: // 貓耳
          p(7, by-3, 3, 3); p(20, by-3, 3, 3); p(8, by-4, 1, 1); p(21, by-4, 1, 1);
          p(12, by+8, 1, 1); p(17, by+8, 1, 1);
          break;
        case 7: // 螺旋
          p(13, by-6, 4, 1); p(16, by-5, 1, 2); p(12, by-4, 5, 1); p(12, by-3, 1, 2);
          p(13, by+8, 4, 1);
          break;
        case 8: // 小翼
          p(1, by+3, 4, 1); p(2, by+4, 3, 1); p(3, by+5, 2, 1);
          p(24, by+3, 4, 1); p(24, by+4, 3, 1); p(24, by+5, 2, 1);
          p(14, by+8, 2, 1);
          break;
        case 9: // 晶核
          p(14, by-7, 2, 1); p(13, by-6, 4, 2); p(14, by-4, 2, 1);
          p(13, by+6, 4, 3); p(14, by+5, 2, 1); p(14, by+9, 2, 1);
          break;
      }


      // 外觀 ID 小刻印：用 1~3 個小點顯示十位/個位變化，避免玩家以為沒變。
      const idMark = ap.id;
      const markA = idMark % 10;
      const markB = Math.floor(idMark / 10);
      for (let i = 0; i < Math.min(5, markA); i++) p(5 + i * 2, by + 15 + bigBonus, 1, 1);
      for (let i = 0; i < Math.min(5, markB); i++) p(17 + i * 2, by + 15 + bigBonus, 1, 1);

      // 進化階段追加部位，讓同一路線也會隨成長明顯改變。
      if (ap.stageIndex >= 1) {
        p(6, by+12, 4, 2); p(20, by+12, 4, 2);
      }
      if (ap.stageIndex >= 2) {
        p(0, by+6, 3, 4); p(27, by+6, 3, 4);
      }
      if (ap.stageIndex >= 3) {
        p(14, by-10, 2, 2); p(11, by+13, 7, 1);
      }
      if (ap.stageIndex >= 4) {
        p(3, by-3, 2, 2); p(24, by-3, 2, 2);
      }

      if (pet.sick) { p(28,9,1,1); p(30,10,2,1); p(29,12,1,1); }
      if (pet.asleep) { p(25,6,3,1); p(27,7,1,1); p(25,8,3,1); }
      ctx.setTransform(old);
    }


    function drawEnemyAt(offsetX, offsetY, icon, shake = 0) {
      const old = ctx.getTransform();
      ctx.translate((offsetX + shake) * 4, offsetY * 4);
      ctx.fillStyle = "#1f2b21";
      const p = (x,y,w=1,h=1)=>ctx.fillRect(x*4,y*4,w*4,h*4);

      if (icon === "bug") {
        p(5,12,10,2); p(3,14,14,8); p(5,22,10,2);
        p(1,15,2,2); p(17,15,2,2); p(1,20,2,2); p(17,20,2,2);
        p(6,16,2,2); p(12,16,2,2); p(8,20,4,1);
      } else if (icon === "slime") {
        p(5,17,10,1); p(3,18,14,2); p(2,20,16,5); p(3,25,14,2);
        p(6,16,3,1); p(12,16,2,1); p(6,21,2,2); p(12,21,2,2); p(8,24,4,1);
      } else if (icon === "bat") {
        p(8,13,4,2); p(6,15,8,5); p(4,20,12,2); p(1,14,5,3); p(0,17,4,2);
        p(14,14,5,3); p(16,17,4,2); p(7,17,2,2); p(11,17,2,2);
      } else {
        p(5,14,12,3); p(3,17,16,8); p(5,25,12,3); p(1,19,2,4); p(19,18,2,5);
        p(7,28,3,2); p(14,28,3,2); p(6,12,3,2); p(15,12,3,2); p(7,20,2,2); p(14,20,2,2);
      }
      ctx.setTransform(old);
    }

    function drawHpBar(x, y, w, hp, maxHp) {
      ctx.fillStyle = "#1f2b21";
      ctx.fillRect(x, y, w, 6);
      ctx.clearRect(x + 1, y + 1, w - 2, 4);
      ctx.fillStyle = "#1f2b21";
      ctx.fillRect(x + 1, y + 1, Math.max(1, Math.floor((w - 2) * (hp / maxHp))), 4);
    }

    function drawAttackFx() {
      if (!battlePhase || battlePhase === "none") return;
      const progress = clamp((now() - animStart) / 650, 0, 1);
      ctx.fillStyle = "#1f2b21";

      if (battlePhase === "petAttack") {
        const x = 58 + progress * 78;
        const y = 62 - Math.sin(progress * Math.PI) * 14;
        ctx.fillRect(x, y, 20, 4);
        ctx.fillRect(x + 8, y - 4, 8, 12);
        if (progress > .72) {
          ctx.fillRect(145, 49, 4, 24); ctx.fillRect(137, 57, 20, 4); ctx.fillRect(140, 52, 14, 14);
        }
      }

      if (battlePhase === "enemyAttack") {
        const x = 134 - progress * 74;
        const y = 62 + Math.sin(progress * Math.PI) * 8;
        ctx.fillRect(x, y, 16, 4);
        ctx.fillRect(x + 5, y - 5, 6, 14);
        if (progress > .72) {
          ctx.fillRect(38, 49, 4, 24); ctx.fillRect(30, 57, 20, 4); ctx.fillRect(33, 52, 14, 14);
        }
      }
    }

    function drawScene() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(31,43,33,.12)";
      for (let x = 0; x < 48; x += 2) px(x, 29, 1, 1);

      if (flash > 0) {
        ctx.fillStyle = flash % 2 ? "rgba(31,43,33,.23)" : "rgba(255,255,255,.13)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flash--;
      }

      if (gameMode === "battle" || gameMode === "encounter" || gameMode === "transition") {
        const enemyShake = battlePhase === "petAttack" && now() - animStart > 430 ? (frame % 2 ? 1 : -1) : 0;
        const petShake = battlePhase === "enemyAttack" && now() - animStart > 430 ? (frame % 2 ? 1 : -1) : 0;

        drawHpBar(20, 12, 50, pet.hp, pet.maxHp);
        if (enemy) drawHpBar(122, 12, 50, enemyHp, enemyMaxHp);

        drawPetAt(1 + petShake, 0, 0.92);
        if (enemy) drawEnemyAt(31, 8, enemy.icon, enemyShake);
        drawAttackFx();

        ctx.fillStyle = "rgba(31,43,33,.25)";
        ctx.fillRect(18, 116, 58, 4);
        ctx.fillRect(120, 116, 55, 4);
      } else {
        drawPetAt(10, 0, 1);
        if (scan > 0) {
          ctx.fillStyle = "#1f2b21";
          const pulse = Math.floor(frame / 8) % 4;
          ctx.fillRect(15*4 - pulse*3, 26*4 - pulse*3, 18*4 + pulse*6, 2);
          ctx.fillRect(15*4 - pulse*3, 32*4 + pulse*3, 18*4 + pulse*6, 2);
          ctx.fillRect(14*4 - pulse*3, 27*4 - pulse*2, 2, 5*4 + pulse*4);
          ctx.fillRect(33*4 + pulse*3, 27*4 - pulse*2, 2, 5*4 + pulse*4);
        }
        ctx.fillStyle = "rgba(31,43,33,.25)";
        px(16, 33, 17, 1);
      }
    }




    function renderDex() {
      const grid = document.getElementById("dexGrid");
      const summary = document.getElementById("dexSummaryText");
      if (!grid) return;

      const owned = loadOwnedAppearances();
      const ownedSet = new Set(owned);
      if (summary) summary.textContent = `已收集 ${owned.length} / 100（10 家族 × 2 分支 × 5 階段）`;

      let routeHtml = "";
      for (let familyId = 1; familyId <= 10; familyId++) {
        routeHtml += `<div class="route-card">
          <div class="route-card-title">
            <span>${familyNames[familyId - 1]}</span>
            <span>FAMILY ${String(familyId).padStart(2,"0")}</span>
          </div>`;

        for (let branchId = 0; branchId <= 1; branchId++) {
          routeHtml += `<div class="route-branch">
            <div class="route-branch-label">${branchNames[branchId]}</div>
            <div class="route-line">`;

          for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
            const id = appearanceIdFromFamilyBranchStage(familyId, branchId, stageIndex);
            const ap = getAppearance(id);
            const unlocked = ownedSet.has(id) || id === pet.appearanceId;
            const current = id === pet.appearanceId;
            routeHtml += `
              <div class="route-node ${unlocked ? '' : 'locked'} ${current ? 'current' : ''} ${branchId === 0 ? 'branch-guardian' : 'branch-battle'}">
                <div>No.${String(id).padStart(3, "0")}</div>
                <div>${ap.stageLabel}</div>
              </div>`;
          }

          routeHtml += `</div></div>`;
        }

        routeHtml += `</div>`;
      }

      grid.innerHTML = routeHtml;
    }

    function openDex() {
      initAudio();
      sfx("click");
      markAppearanceOwned(pet.appearanceId);
      renderDex();
      const backdrop = document.getElementById("dexBackdrop");
      if (backdrop) {
        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");
      }
      const col = appearanceCollectionCount();
      setMessage(`EVOLUTION DEX\n目前已收集 ${col.owned}/100。\n重新孵化可抽新外觀。`);
      updateUI();
    }

    function closeDex() {
      const backdrop = document.getElementById("dexBackdrop");
      if (backdrop) {
        backdrop.classList.remove("open");
        backdrop.setAttribute("aria-hidden", "true");
      }
      sfx("click");
    }

    function bindDex() {
      const closeBtn = document.getElementById("dexClose");
      const backdrop = document.getElementById("dexBackdrop");
      if (closeBtn) closeBtn.addEventListener("click", closeDex);
      if (backdrop) {
        backdrop.addEventListener("click", e => {
          if (e.target === backdrop) closeDex();
        });
      }
    }


    function showEvolutionAnimation(fromId, toId, branchText = "") {
      const overlay = document.getElementById("evoOverlay");
      const evoSub = document.getElementById("evoSub");
      const evoFrom = document.getElementById("evoFrom");
      const evoTo = document.getElementById("evoTo");
      if (!overlay || !evoSub || !evoFrom || !evoTo) return;

      const fromAp = getAppearance(fromId);
      const toAp = getAppearance(toId);
      evoSub.textContent = branchText ? `BRANCH LOCKED : ${branchText}` : "STAGE UP COMPLETE";
      evoFrom.textContent = `${fromAp.familyName} ${fromAp.stageLabel}`;
      evoTo.textContent = `${toAp.familyName} ${toAp.stageLabel}`;
      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden", "false");
      setTimeout(() => {
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
      }, 1700);
    }

    function bindBgmAutoStart() {
      // 立即嘗試，若瀏覽器允許會直接播放。
      setTimeout(tryAutoStartBgm, 80);
      setTimeout(tryAutoStartBgm, 600);
      setTimeout(tryAutoStartBgm, 1600);

      window.addEventListener("load", tryAutoStartBgm);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) tryAutoStartBgm();
      });

      // 如果瀏覽器阻擋無互動播放，這些第一次互動會自動接續啟動，
      // 不需要玩家再去按 BGM ON。
      ["pointerdown", "touchstart", "keydown", "mousemove"].forEach(evt => {
        document.addEventListener(evt, tryAutoStartBgm, { passive: true });
      });
    }

    function openSettings() {
      applyLanguage();
      initAudio();
      sfx("click");
      applySystemSettings();
      const backdrop = document.getElementById("settingsBackdrop");
      if (backdrop) {
        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");
      }
      setMessage("SYSTEM MENU\n設定選單已開啟。");
      updateUI();
    }

    function closeSettings() {
      const backdrop = document.getElementById("settingsBackdrop");
      if (backdrop) {
        backdrop.classList.remove("open");
        backdrop.setAttribute("aria-hidden", "true");
      }
      sfx("click");
      setMessage("SYSTEM MENU\n設定已保存。");
      updateUI();
    }

    function bindSettingsMenu() {
      const backdrop = document.getElementById("settingsBackdrop");
      const closeBtn = document.getElementById("settingsClose");
      const doneBtn = document.getElementById("settingsDone");
      const defaultBtn = document.getElementById("settingsDefault");
      const animInput = document.getElementById("settingAnimations");
      const autoCareInput = document.getElementById("settingAutoCare");
      const autoPatrolInput = document.getElementById("settingAutoPatrol");
      const bgmSlider = document.getElementById("settingBgmVolume");
      const sfxSlider = document.getElementById("settingSfxVolume");
      const fontSlider = document.getElementById("settingFontSize");

      if (closeBtn) closeBtn.addEventListener("click", closeSettings);
      if (doneBtn) doneBtn.addEventListener("click", closeSettings);
      if (backdrop) {
        backdrop.addEventListener("click", e => {
          if (e.target === backdrop) closeSettings();
        });
      }

      if (animInput) {
        animInput.addEventListener("change", () => {
          animationsEnabled = animInput.checked;
          saveSystemSettings();
          applySystemSettings();
          sfx("click");
        });
      }

      if (autoCareInput) {
        autoCareInput.addEventListener("change", () => {
          autoCareEnabled = autoCareInput.checked;
          saveSystemSettings();
          applySystemSettings();
          sfx("care");
          setMessage(autoCareEnabled
            ? "SYSTEM MENU\\n自動照顧已開啟。"
            : "SYSTEM MENU\\n自動照顧已關閉。");
          updateUI();
        });
      }

      if (autoPatrolInput) {
        autoPatrolInput.addEventListener("change", () => {
          autoPatrolEnabled = autoPatrolInput.checked;
          lastAutoPatrolAt = now();
          saveSystemSettings();
          applySystemSettings();
          sfx("care");
          setMessage(autoPatrolEnabled
            ? "SYSTEM MENU\\n掛機巡邏已開啟。"
            : "SYSTEM MENU\\n掛機巡邏已關閉。");
          updateUI();
        });
      }

      if (bgmSlider) {
        bgmSlider.addEventListener("input", () => {
          bgmVolume = Number(bgmSlider.value);
          saveSystemSettings();
          applySystemSettings();
          if (bgmEnabled) playBgm();
        });
      }

      if (sfxSlider) {
        sfxSlider.addEventListener("input", () => {
          sfxVolume = Number(sfxSlider.value);
          saveSystemSettings();
          applySystemSettings();
        });

        sfxSlider.addEventListener("change", () => {
          sfx("care");
        });
      }

      if (fontSlider) {
        fontSlider.addEventListener("input", () => {
          fontSizePercent = Number(fontSlider.value);
          saveSystemSettings();
          applySystemSettings();
        });
      }

      if (defaultBtn) {
        defaultBtn.addEventListener("click", () => {
          animationsEnabled = true;
          autoCareEnabled = true;
          autoPatrolEnabled = true;
          bgmVolume = 38;
          sfxVolume = 70;
          fontSizePercent = 100;
          saveSystemSettings();
          applySystemSettings();
          sfx("care");
          setMessage("SYSTEM MENU\n設定已恢復預設。");
          updateUI();
        });
      }
    }

    document.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => action(btn.dataset.action));
    });



    function runMobileAction(action) {
      try { initAudio(); } catch {}
      if (action === "feed") {
        feedPet();
      } else if (action === "train") {
        trainPet();
      } else if (action === "clean") {
        cleanPet();
      } else if (action === "sleep") {
        sleepPet();
      } else if (action === "status") {
        showStatus();
      } else if (action === "dex") {
        openDex();
      } else if (action === "rename") {
        renamePet();
      } else if (action === "scan") {
        setMessage("請在 LCD 畫面左右滑動或搖晃，累積搜索值。");
      } else if (action === "login") {
        const btn = document.getElementById("googleLoginBtn");
        if (btn) btn.click();
        else setMessage("登入模組尚未載入。");
      } else if (action === "sync") {
        const btn = document.getElementById("cloudSyncBtn");
        if (btn) btn.click();
        else setMessage("雲端同步模組尚未載入。");
      }
      updateUI();
      try { forcePetVisibleFallback(); } catch {}
    }

    function bindMobileNativeControls() {
      if (window.__mobileNativeDelegationBound) return;
      window.__mobileNativeDelegationBound = true;

      const isTouchLike = () => (
        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
      );

      const findButton = target => target && target.closest ? target.closest("[data-mobile-action]") : null;

      document.addEventListener("touchstart", ev => {
        const btn = findButton(ev.target);
        if (!btn) return;
        btn.classList.add("is-pressing");
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
      }, { passive: false, capture: true });

      document.addEventListener("touchcancel", ev => {
        const btn = findButton(ev.target);
        if (btn) btn.classList.remove("is-pressing");
      }, { passive: true, capture: true });

      document.addEventListener("touchend", ev => {
        const btn = findButton(ev.target);
        if (!btn) return;
        btn.classList.remove("is-pressing");
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        runMobileAction(btn.dataset.mobileAction);
      }, { passive: false, capture: true });

      document.addEventListener("click", ev => {
        const btn = findButton(ev.target);
        if (!btn) return;
        // Desktop click support; on touch devices the touchend already handles it.
        ev.preventDefault();
        ev.stopPropagation();
        if (!isTouchLike()) runMobileAction(btn.dataset.mobileAction);
      }, { capture: true });
    }


    setInterval(tick, 15000);
    setInterval(() => { try { forcePetVisibleFallback(); } catch {} }, 1200);

    function loop() {
      frame++;
      battleLoop();
      runAutoPatrol();
      runAutoCare();
      drawScene();
      requestAnimationFrame(loop);
    }


    window.PixelPetGame = {
      getSaveData() {
        try {
          save();
          return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
        } catch (e) {
          return { ...pet };
        }
      },
      getDexData() {
        return loadOwnedAppearances();
      },
      getSummary() {
        const ap = getAppearance(pet.appearanceId);
        return {
          name: pet.name,
          lv: pet.lv,
          exp: pet.exp,
          familyId: pet.familyId,
          branchId: pet.branchId,
          branchChosen: pet.branchChosen,
          appearanceId: pet.appearanceId,
          appearanceLabel: appearanceLabel(pet.appearanceId),
          familyName: ap.familyName,
          stageLabel: ap.stageLabel,
          battleWins: pet.battleWins || 0,
          cleanActions: pet.cleanActions || 0,
          updatedAt: pet.updatedAt || pet.lastTick || Date.now()
        };
      },
      importCloudData(payload) {
        if (!payload || typeof payload !== "object") return false;

        const cloudPet = payload.pet || payload.save || null;
        const cloudDex = payload.dexOwned || payload.dex || [];

        if (cloudPet && typeof cloudPet === "object") {
          pet = {
            ...defaultPet(cloudPet.familyId || 1),
            ...cloudPet,
            saveVersion: SAVE_VERSION
          };
          if (!pet.familyId) {
            const parsed = parseAppearanceId(pet.appearanceId || 1);
            pet.familyId = parsed.familyId;
          }
          if (typeof pet.branchId !== "number") pet.branchId = 0;
          if (typeof pet.branchChosen !== "boolean") pet.branchChosen = false;
          syncPetAppearanceStage();
          save();
        }

        if (Array.isArray(cloudDex)) {
          const merged = new Set(loadOwnedAppearances());
          cloudDex.forEach(id => {
            const n = Number(id);
            if (Number.isInteger(n) && n >= 1 && n <= 100) merged.add(n);
          });
          saveOwnedAppearances(Array.from(merged));
        }

        updateUI();
        return true;
      },
      setCloudMessage(text) {
        if (typeof text === "string" && text.trim()) {
          setMessage(text);
          updateUI();
        }
      },
      saveLocal() {
        save();
      },
      constants: {
        SAVE_VERSION,
        SAVE_KEY,
        OWNED_APPEARANCE_KEY
      }
    };

    bindBgmAutoStart();
    bindDex();
    bindSettingsMenu();
    bindMobileNativeControls();
    applyLanguage();
    applySystemSettings();
    tryAutoStartBgm();
    updateUI();
    loop();
