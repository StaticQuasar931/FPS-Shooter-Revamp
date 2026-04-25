(function () {
  "use strict";

  const el = {
    startOverlay: document.getElementById("startOverlay"),
    startBtn: document.getElementById("startBtn"),

    pauseOverlay: document.getElementById("pauseOverlay"),
    resumeBtn: document.getElementById("resumeBtn"),
    shopBtn: document.getElementById("shopBtn"),
    restartBtn: document.getElementById("restartBtn"),

    shopOverlay: document.getElementById("shopOverlay"),
    shopClose: document.getElementById("shopClose"),
    shopRefill: document.getElementById("shopRefill"),
    shopBody: document.getElementById("shopBody"),
    shopCoins: document.getElementById("shopCoins"),

    waveLeft: document.getElementById("waveLeft"),
    waveRight: document.getElementById("waveRight"),
    waveFill: document.getElementById("waveFill"),
    waveMsg: document.getElementById("waveMsg"),

    uiWave: document.getElementById("uiWave"),
    uiAlive: document.getElementById("uiAlive"),
    uiKills: document.getElementById("uiKills"),
    uiCoins: document.getElementById("uiCoins"),

    uiWeaponArt: document.getElementById("uiWeaponArt"),
    uiWeapon: document.getElementById("uiWeapon"),
    uiAmmo: document.getElementById("uiAmmo"),
    uiAmmoMax: document.getElementById("uiAmmoMax"),
    uiReserve: document.getElementById("uiReserve"),
    uiDmg: document.getElementById("uiDmg"),
    uiRate: document.getElementById("uiRate"),
    uiUpgradeInfo: document.getElementById("uiUpgradeInfo"),

    hpText: document.getElementById("hpText"),
    hpFill: document.getElementById("hpFill"),
    stamText: document.getElementById("stamText"),
    stamFill: document.getElementById("stamFill"),

    weaponCard: document.getElementById("weaponCard"),
    crosshair: document.getElementById("crosshair"),
  };

  let waveMsgTimer = null;
  let kickTimer = null;

  function showStart(v) {
    if (!el.startOverlay) return;
    el.startOverlay.style.display = v ? "grid" : "none";
    el.startOverlay.style.pointerEvents = v ? "auto" : "none";
  }

  function showPause(v) {
    if (!el.pauseOverlay) return;
    el.pauseOverlay.style.display = v ? "grid" : "none";
  }

  function showShop(v) {
    if (!el.shopOverlay) return;
    el.shopOverlay.style.display = v ? "grid" : "none";
  }

  function setMsg(title, text) {
    if (!el.pauseOverlay) return;
    const h2 = el.pauseOverlay.querySelector("h2");
    const p = el.pauseOverlay.querySelector("p");
    if (h2) h2.textContent = title || "";
    if (p) p.textContent = text || "";
  }

  function setWaveMsg(text, ms) {
    if (!el.waveMsg) return;
    el.waveMsg.textContent = text || "";
    if (waveMsgTimer) clearTimeout(waveMsgTimer);
    if (ms && ms > 0) {
      waveMsgTimer = setTimeout(() => {
        if (el.waveMsg && el.waveMsg.textContent === text) el.waveMsg.textContent = "";
      }, ms);
    }
  }

  function flashCrosshair(kind) {
    if (!el.crosshair) return;
    const prev = el.crosshair.style.filter;

    if (kind === "hit") {
      el.crosshair.style.filter = "drop-shadow(0 0 10px rgba(255,255,255,0.95))";
    } else if (kind === "kill") {
      el.crosshair.style.filter = "drop-shadow(0 0 12px rgba(120,255,220,0.98))";
    } else if (kind === "damage") {
      el.crosshair.style.filter = "drop-shadow(0 0 12px rgba(255,120,120,0.98))";
    } else {
      el.crosshair.style.filter = "drop-shadow(0 0 8px rgba(255,255,255,0.75))";
    }

    setTimeout(() => {
      if (el.crosshair) el.crosshair.style.filter = prev || "";
    }, 90);
  }

  function flashDamage() {
    flashCrosshair("damage");
    setWaveMsg("You got hit!", 450);
  }

  function setGunImage(iconFile) {
    if (!el.uiWeaponArt) return;
    if (!iconFile) {
      el.uiWeaponArt.removeAttribute("src");
      el.uiWeaponArt.style.opacity = "0";
      return;
    }
    el.uiWeaponArt.src = `assets/${iconFile}`;
    el.uiWeaponArt.style.opacity = "1";
  }

  function kickGun() {
    if (!el.weaponCard) return;
    if (kickTimer) clearTimeout(kickTimer);
    el.weaponCard.classList.add("kick");
    kickTimer = setTimeout(() => {
      if (el.weaponCard) el.weaponCard.classList.remove("kick");
    }, 90);
  }

  function updateHUD(game) {
    if (!game) return;

    if (el.uiWave) el.uiWave.textContent = String(game.wave ? game.wave.number : 1);
    if (el.uiAlive) el.uiAlive.textContent = String(game.zombies ? game.zombies.getAliveCount() : 0);
    if (el.uiKills) el.uiKills.textContent = String(game.stats ? game.stats.kills : 0);
    if (el.uiCoins) el.uiCoins.textContent = String(game.stats ? game.stats.coins : 0);
    if (el.shopCoins) el.shopCoins.textContent = String(game.stats ? game.stats.coins : 0);

    const w = game.weapon || {};
    if (el.uiWeapon) el.uiWeapon.textContent = String(w.name || "Weapon");
    if (el.uiAmmo) el.uiAmmo.textContent = String(w.ammo ?? 0);
    if (el.uiAmmoMax) el.uiAmmoMax.textContent = String(w.magSize ?? 0);
    if (el.uiReserve) el.uiReserve.textContent = String(w.reserve ?? 0);
    if (el.uiDmg) el.uiDmg.textContent = String(Math.round(w.damage ?? 0));
    if (el.uiRate) el.uiRate.textContent = (w.fireRate ? Number(w.fireRate).toFixed(1) : "0.0");

    if (el.uiUpgradeInfo && game.upgrades) {
      const damageLv = game.upgrades.damage ? game.upgrades.damage.level : 0;
      const fireRateLv = game.upgrades.fireRate ? game.upgrades.fireRate.level : 0;
      const maxAmmoLv = game.upgrades.maxAmmo ? game.upgrades.maxAmmo.level : 0;
      el.uiUpgradeInfo.textContent = `Lv Dmg ${damageLv} | Rate ${fireRateLv} | Ammo ${maxAmmoLv}`;
    }

    const p = game.player ? game.player.state : null;
    if (p) {
      const hp = Math.max(0, p.hp || 0);
      const hpMax = Math.max(1, p.hpMax || 100);
      const st = Math.max(0, p.stamina || 0);
      const stMax = Math.max(1, p.staminaMax || 100);

      if (el.hpText) el.hpText.textContent = `${Math.round(hp)} / ${Math.round(hpMax)}`;
      if (el.hpFill) el.hpFill.style.width = `${Math.round((hp / hpMax) * 100)}%`;

      if (el.stamText) el.stamText.textContent = `${Math.round(st)} / ${Math.round(stMax)}`;
      if (el.stamFill) el.stamFill.style.width = `${Math.round((st / stMax) * 100)}%`;
    }

    if (game.wave && el.waveLeft && el.waveFill) {
      const done = game.wave.killsDone || 0;
      const need = Math.max(1, game.wave.killsNeeded || 1);
      const pct = Math.max(0, Math.min(1, done / need));
      const alive = game.zombies ? game.zombies.getAliveCount() : 0;
      const reward = game.wave.rewardBonus || 0;
      el.waveLeft.textContent = `Wave ${game.wave.number}`;
      el.waveFill.style.width = `${Math.round(pct * 100)}%`;

      if (el.waveRight) {
        if (game.wave.active) {
          el.waveRight.textContent = `Kills ${done}/${need} | Alive ${alive} | Reward +${reward}`;
        } else {
          const nextIn = Math.max(0, (game.wave.cooldown || 0) - (game.wave.cooldownT || 0));
          el.waveRight.textContent = `Next wave ${nextIn.toFixed(1)}s`;
        }
      }
    }
  }

  window.UI = {
    el,
    showStart,
    showPause,
    showShop,
    setMsg,
    setWaveMsg,
    setGunImage,
    kickGun,
    updateHUD,
    flashCrosshair,
    flashDamage,
  };
})();
