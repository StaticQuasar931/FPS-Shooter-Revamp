(() => {
  "use strict";

  function showBootError(err) {
    const box = document.getElementById("bootError");
    if (box) {
      box.style.display = "block";
      box.textContent = [
        "BOOT ERROR:",
        String(err && err.message ? err.message : err),
        "",
        "Fix:",
        "- Make sure all JS files exist next to index.html",
        "- Make sure assets are in ./assets/",
      ].join("\n");
    }
    console.error(err);
  }

  function hasGlobalBinding(name) {
    try { return Function(`return (typeof ${name} !== "undefined");`)(); }
    catch { return false; }
  }

  function assertGlobal(name) {
    const hasProp = typeof window[name] !== "undefined";
    const hasBind = hasGlobalBinding(name);
    if (!hasProp && !hasBind) throw new Error(`Missing global: ${name}`);
  }

  function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  function boot() {
    try {
      assertGlobal("THREE");
      assertGlobal("Assets");
      assertGlobal("Physics");
      assertGlobal("UI");
      assertGlobal("Buildings");
      assertGlobal("World");
      assertGlobal("Player");
      assertGlobal("Zombies");

      const ui = window.UI;
      if (!ui || !ui.el) throw new Error("UI not initialized correctly (UI.el missing).");

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding;

      renderer.domElement.style.touchAction = "none";
      renderer.domElement.tabIndex = 0;
      document.body.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x05060a, 40, 220);

      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 700);
      const clock = new THREE.Clock();

      const game = {
        renderer, scene, camera, clock,
        tex: null,
        world: null,
        player: null,
        zombies: null,
        ui,

        ready: false,
        started: false,
        paused: true,
        shopOpen: false,

        stats: { kills: 0, coins: 0, coinsPerKill: 8 },
        unlocks: { shotgun: false },

        weaponKey: "pistol",
        weapons: {},
        weapon: null,
        upgrades: null,

        fx: null,

        wave: {
          number: 1,
          killsNeeded: 12,
          killsDone: 0,
          active: false,
          cooldown: 2.0,
          cooldownT: 0,
          spawnBudget: 10,
          spawned: 0,
          spawnT: 0,
          spawnInterval: 0.9,
          aliveCap: 12,
          guaranteedTanks: 0,
          spawnedTanks: 0,
          rewardBonus: 0,
          clearBonus: 10,
          difficulty: 1,
        }
      };

      const tempBaseDir = new THREE.Vector3();
      const tempDir = new THREE.Vector3();
      const tempOrigin = new THREE.Vector3();
      const tempEnd = new THREE.Vector3();
      const tempHitPos = new THREE.Vector3();

      const weaponDefs = {
        pistol: {
          key: "pistol",
          name: "Pistol",
          icon: "ui_weapon_pistol_256.png",
          baseDamage: 20,
          baseRate: 5.8,
          baseMag: 12,
          baseReserve: 36,
          baseReload: 1.15,
          baseSpread: 0.010,
          pellets: 1,
          recoilPitch: 0.028,
          recoilYaw: 0.010,
        },
        shotgun: {
          key: "shotgun",
          name: "Shotgun",
          icon: "ui_weapon_shotgun_256.png",
          baseDamage: 10,
          baseRate: 1.12,
          baseMag: 6,
          baseReserve: 24,
          baseReload: 1.28,
          baseSpread: 0.085,
          pellets: 7,
          recoilPitch: 0.056,
          recoilYaw: 0.018,
        },
      };

      function createEffects() {
        const tracerPool = [];
        const flashPool = [];
        const tracerMax = 12;
        const flashMax = 10;

        function makeTracer() {
          const positions = new Float32Array(6);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          const material = new THREE.LineBasicMaterial({
            color: 0xffffb0,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          const line = new THREE.Line(geometry, material);
          line.visible = false;
          scene.add(line);
          return { mesh: line, positions, life: 0, maxLife: 0 };
        }

        function makeFlash() {
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({
              map: null,
              transparent: true,
              depthWrite: false,
              opacity: 0,
            })
          );
          mesh.visible = false;
          scene.add(mesh);
          return { mesh, life: 0, maxLife: 0 };
        }

        function borrowTracer() {
          for (const t of tracerPool) if (t.life <= 0) return t;
          if (tracerPool.length >= tracerMax) return tracerPool[0];
          const tracer = makeTracer();
          tracerPool.push(tracer);
          return tracer;
        }

        function borrowFlash() {
          for (const f of flashPool) if (f.life <= 0) return f;
          if (flashPool.length >= flashMax) return flashPool[0];
          const flash = makeFlash();
          flashPool.push(flash);
          return flash;
        }

        function showTracer(ax, ay, az, bx, by, bz, life, opacity) {
          const tracer = borrowTracer();
          tracer.positions[0] = ax;
          tracer.positions[1] = ay;
          tracer.positions[2] = az;
          tracer.positions[3] = bx;
          tracer.positions[4] = by;
          tracer.positions[5] = bz;
          tracer.mesh.geometry.attributes.position.needsUpdate = true;
          tracer.mesh.material.opacity = opacity;
          tracer.mesh.visible = true;
          tracer.life = life;
          tracer.maxLife = life;
        }

        function showFlash(position, size, life) {
          if (!game.tex || !game.tex.bulletFx) return;
          const flash = borrowFlash();
          flash.mesh.material.map = game.tex.bulletFx;
          flash.mesh.material.opacity = 1;
          flash.mesh.scale.set(size, size, size);
          flash.mesh.position.copy(position);
          flash.mesh.visible = true;
          flash.life = life;
          flash.maxLife = life;
        }

        function update(dt) {
          for (const tracer of tracerPool) {
            if (tracer.life <= 0) {
              tracer.mesh.visible = false;
              continue;
            }
            tracer.life = Math.max(0, tracer.life - dt);
            tracer.mesh.material.opacity = (tracer.maxLife > 0) ? (tracer.life / tracer.maxLife) * 0.95 : 0;
            tracer.mesh.visible = tracer.life > 0;
          }

          for (const flash of flashPool) {
            if (flash.life <= 0) {
              flash.mesh.visible = false;
              continue;
            }
            flash.life = Math.max(0, flash.life - dt);
            flash.mesh.material.opacity = (flash.maxLife > 0) ? (flash.life / flash.maxLife) : 0;
            flash.mesh.quaternion.copy(camera.quaternion);
            flash.mesh.visible = flash.life > 0;
          }
        }

        return { showTracer, showFlash, update };
      }

      function makeWeaponState(def) {
        return {
          key: def.key,
          name: def.name,
          icon: def.icon,
          pellets: def.pellets,
          damage: def.baseDamage,
          fireRate: def.baseRate,
          magSize: def.baseMag,
          reserveMax: def.baseReserve,
          reloadTime: def.baseReload,
          spread: def.baseSpread,
          recoilPitch: def.recoilPitch,
          recoilYaw: def.recoilYaw,
          ammo: def.baseMag,
          reserve: def.baseReserve,
          reloading: false,
          reloadT: 0,
        };
      }

      const upgrades = {
        damage: { level: 0, max: 8, baseCost: 60, mult: 1.34, per: 3 },
        fireRate: { level: 0, max: 7, baseCost: 70, mult: 1.39, per: 0.32 },
        maxAmmo: { level: 0, max: 7, baseCost: 80, mult: 1.42, perMag: 2, perReserve: 10 },
        hpMax: { level: 0, max: 8, baseCost: 75, mult: 1.45, per: 10 },
        staminaMax: { level: 0, max: 8, baseCost: 65, mult: 1.40, per: 10 },
        staminaRegen: { level: 0, max: 6, baseCost: 70, mult: 1.40, per: 3 },
        coinsPerKill: { level: 0, max: 8, baseCost: 80, mult: 1.45, per: 1 },
      };
      game.upgrades = upgrades;

      const shopCats = [
        { title: "Weapon Upgrades", items: [
          { key:"damage", name:"Damage", desc:"More damage per shot." },
          { key:"fireRate", name:"Fire Rate", desc:"Shoot faster with less downtime." },
          { key:"maxAmmo", name:"Max Ammo", desc:"Bigger magazine and reserve." },
        ]},
        { title: "Survival + Economy", items: [
          { key:"hpMax", name:"Max HP", desc:"Higher max HP." },
          { key:"staminaMax", name:"Stamina Max", desc:"Longer sprint." },
          { key:"staminaRegen", name:"Stamina Regen", desc:"Refills faster." },
          { key:"coinsPerKill", name:"Coins Per Kill", desc:"More coins per zombie." },
        ]}
      ];

      function recalcWeapons() {
        for (const def of Object.values(weaponDefs)) {
          const w = game.weapons[def.key];
          if (!w) continue;

          w.name = def.name;
          w.icon = def.icon;
          w.pellets = def.pellets;
          w.damage = def.baseDamage + upgrades.damage.level * upgrades.damage.per;
          w.fireRate = def.baseRate + upgrades.fireRate.level * upgrades.fireRate.per;
          w.magSize = def.baseMag + upgrades.maxAmmo.level * upgrades.maxAmmo.perMag;
          w.reserveMax = def.baseReserve + upgrades.maxAmmo.level * upgrades.maxAmmo.perReserve;
          w.reloadTime = def.baseReload;
          w.spread = Math.max(0.004, def.baseSpread * (1 - upgrades.fireRate.level * 0.015));
          w.recoilPitch = def.recoilPitch;
          w.recoilYaw = def.recoilYaw;
          w.ammo = Math.min(w.ammo, w.magSize);
          w.reserve = Math.min(w.reserve, w.reserveMax);
        }
      }

      function setWeapon(key, msg) {
        if (!game.weapons[key]) return;
        if (key === "shotgun" && !game.unlocks.shotgun) return;
        game.weaponKey = key;
        game.weapon = game.weapons[key];
        if (game.ui && game.ui.setGunImage) game.ui.setGunImage(game.weapon.icon);
        if (msg) game.ui.setWaveMsg(msg, 1100);
      }

      function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
      window.addEventListener("resize", onResize);

      function setPaused(v, reasonText) {
        game.paused = !!v;

        if (!game.started) {
          game.ui.showPause(false);
          return;
        }

        if (game.shopOpen) {
          game.ui.showPause(false);
          return;
        }

        game.ui.showPause(game.paused);

        if (game.paused) {
          game.ui.setMsg("Paused", reasonText || "Click Resume to continue.");
          if (game.player && game.player.controls) {
            try { game.player.controls.unlock(); } catch {}
          }
        } else {
          game.ui.showPause(false);
          game.ui.setMsg("", "");
        }
      }

      function tryLockCursorFromGesture() {
        if (!game.player || !game.player.controls) return;
        try { game.player.controls.lock(); } catch {}
      }

      function openShop() {
        if (!game.started) return;
        game.shopOpen = true;
        game.paused = true;
        game.ui.showPause(false);
        game.ui.showShop(true);
        game.ui.setMsg("", "");

        if (game.player && game.player.controls) {
          try { game.player.controls.unlock(); } catch {}
        }
        renderShop();
      }

      function closeShop() {
        if (!game.started) return;
        game.shopOpen = false;
        game.ui.showShop(false);
        setPaused(false);
        game.ui.setWaveMsg("Click the game to lock your mouse.", 1200);
      }

      function toggleShop() {
        if (!game.started) return;
        if (game.shopOpen) closeShop();
        else openShop();
      }

      function installFocusHandlers() {
        document.addEventListener("visibilitychange", () => {
          if (!game.started) return;
          if (document.hidden) setPaused(true, "You tabbed out. Click Resume to continue.");
        });

        window.addEventListener("blur", () => {
          if (!game.started) return;
          setPaused(true, "Window lost focus. Click Resume to continue.");
        });

        document.addEventListener("pointerlockchange", () => {
          if (!game.started) return;
          const locked = !!document.pointerLockElement;
          if (!locked && !game.paused && !game.shopOpen) {
            setPaused(true, "Mouse unlocked. Click Resume, then click the game.");
          }
        });

        document.addEventListener("pointerlockerror", () => {
          if (!game.started) return;
          game.ui.setWaveMsg("Pointer lock failed. Click the game area.", 1600);
        });
      }

      function startReload() {
        const w = game.weapon;
        if (!w) return;
        if (w.reloading) return;
        if (w.ammo >= w.magSize) return;
        if (w.reserve <= 0) return;
        w.reloading = true;
        w.reloadT = 0;
        game.ui.setWaveMsg("Reloading...", 450);
      }

      function updateReload(dt) {
        const w = game.weapon;
        if (!w || !w.reloading) return;
        w.reloadT += dt;
        if (w.reloadT >= w.reloadTime) {
          const need = w.magSize - w.ammo;
          const take = Math.min(need, w.reserve);
          w.reserve -= take;
          w.ammo += take;
          w.reloading = false;
          w.reloadT = 0;
          game.ui.setWaveMsg("Reloaded", 350);
        }
      }

      function coinBonusForType(type) {
        if (type === "sprinter") return 2;
        if (type === "spitter") return 3;
        if (type === "tank") return 6;
        return 0;
      }

      function onZombieKilled(type) {
        game.stats.kills += 1;
        game.wave.killsDone += 1;

        const gain = Math.max(
          1,
          game.stats.coinsPerKill + coinBonusForType(type) + (game.wave.rewardBonus || 0)
        );
        game.stats.coins += gain;

        game.ui.flashCrosshair("kill");
        game.ui.setWaveMsg(`KILL +${gain} coins`, 550);
        if (game.shopOpen) renderShop();
      }

      function spawnTracer(from, to) {
        game.fx.showTracer(from.x, from.y, from.z, to.x, to.y, to.z, 0.10, 0.95);
      }

      function spawnFlash(position, size, life) {
        game.fx.showFlash(position, size, life);
      }

      function spawnBullet() {
        if (!game.started || game.paused || game.shopOpen) return false;
        const w = game.weapon;
        if (!w || !game.player || !game.zombies) return false;
        if (w.reloading) return false;

        const now = performance.now() / 1000;
        if (!game.player.canFire(now, w.fireRate)) return false;

        if (w.ammo <= 0) {
          game.ui.setWaveMsg("Out of ammo. Press R to reload.", 800);
          return false;
        }

        game.player.markFired(now, w.recoilPitch, w.recoilYaw);
        w.ammo--;
        if (game.ui && game.ui.kickGun) game.ui.kickGun();

        camera.getWorldDirection(tempBaseDir);
        tempBaseDir.normalize();
        tempOrigin.copy(game.player.getEyePosition());

        let bestHit = null;
        let bestDist = Infinity;

        const pellets = Math.max(1, w.pellets || 1);
        for (let i = 0; i < pellets; i++) {
          tempDir.copy(tempBaseDir);
          tempDir.x += (Math.random() - 0.5) * w.spread;
          tempDir.y += (Math.random() - 0.5) * w.spread;
          tempDir.z += (Math.random() - 0.5) * w.spread;
          tempDir.normalize();

          const hitRes = game.zombies.damageFromBullet(tempOrigin, tempDir, 85, w.damage, game.world);
          const tracerDist = (hitRes && hitRes.hit) ? hitRes.dist : 26;
          tempEnd.copy(tempDir).multiplyScalar(tracerDist).add(tempOrigin);

          const wantTracer = (pellets === 1) || (i === 0) || (i === Math.floor(pellets / 2)) || (i === pellets - 1);
          if (wantTracer) spawnTracer(tempOrigin, tempEnd);

          if (hitRes && hitRes.hit) {
            if (hitRes.dist < bestDist) {
              bestDist = hitRes.dist;
              bestHit = { hit: true, killed: !!hitRes.killed, dist: hitRes.dist, type: hitRes.type, dir: tempDir.clone() };
            }
            if (hitRes.killed) onZombieKilled(hitRes.type || "normal");
          }
        }

        tempHitPos.copy(tempBaseDir).multiplyScalar(0.55).add(tempOrigin);
        spawnFlash(tempHitPos, 0.88, 0.09);

        if (bestHit && bestHit.hit) {
          tempHitPos.copy(bestHit.dir).multiplyScalar(bestHit.dist).add(tempOrigin);
          spawnFlash(tempHitPos, 0.75, 0.11);
          game.ui.flashCrosshair(bestHit.killed ? "kill" : "hit");
          if (!bestHit.killed) game.ui.setWaveMsg("HIT", 250);
        }

        return true;
      }

      function computeWave(waveNum) {
        const tier = Math.floor((waveNum - 1) / 5);
        const killsNeeded = 10 + waveNum * 4 + tier * 3;
        const aliveCap = Math.min(22, 10 + waveNum + tier);
        const spawnInterval = clamp(0.95 - waveNum * 0.03, 0.35, 0.95);
        const guaranteedTanks = Math.max(0, Math.floor(waveNum / 5));
        const rewardBonus = tier * 2;
        const clearBonus = 12 + waveNum * 2 + tier * 8;
        const difficulty = 1 + waveNum * 0.08;
        return { killsNeeded, spawnBudget: killsNeeded, aliveCap, spawnInterval, guaranteedTanks, rewardBonus, clearBonus, difficulty };
      }

      function startWave() {
        game.wave.active = true;
        const waveData = computeWave(game.wave.number);
        game.wave.killsNeeded = waveData.killsNeeded;
        game.wave.spawnBudget = waveData.spawnBudget;
        game.wave.killsDone = 0;
        game.wave.spawned = 0;
        game.wave.spawnT = 0;
        game.wave.spawnInterval = waveData.spawnInterval;
        game.wave.aliveCap = waveData.aliveCap;
        game.wave.guaranteedTanks = waveData.guaranteedTanks;
        game.wave.spawnedTanks = 0;
        game.wave.rewardBonus = waveData.rewardBonus;
        game.wave.clearBonus = waveData.clearBonus;
        game.wave.difficulty = waveData.difficulty;

        if (game.wave.number === 4 && !game.unlocks.shotgun) {
          game.unlocks.shotgun = true;
          game.ui.setWaveMsg("Shotgun unlocked. Press 2 to switch.", 1400);
        } else if (game.wave.guaranteedTanks > 0) {
          game.ui.setWaveMsg(`Wave ${game.wave.number} started. Tanks incoming.`, 1400);
        } else {
          game.ui.setWaveMsg(`Wave ${game.wave.number} started`, 1200);
        }
      }

      function endWave() {
        game.wave.active = false;
        game.wave.cooldownT = 0;
        game.stats.coins += game.wave.clearBonus;
        game.ui.setWaveMsg(`Wave ${game.wave.number} cleared! +${game.wave.clearBonus} coins`, 1400);
        if (game.shopOpen) renderShop();
        game.wave.number++;
      }

      function chooseZombieType() {
        const remainingSpawns = game.wave.spawnBudget - game.wave.spawned;
        const remainingGuaranteedTanks = Math.max(0, game.wave.guaranteedTanks - game.wave.spawnedTanks);
        if (remainingGuaranteedTanks > 0 && remainingSpawns <= remainingGuaranteedTanks) {
          return "tank";
        }

        const eff = game.wave.number;
        let normalW = Math.max(0.18, 1.10 - eff * 0.05);
        let sprinterW = Math.min(0.38, Math.max(0.06, (eff - 1) * 0.055));
        let spitterW = Math.min(0.32, Math.max(0, (eff - 3) * 0.05));
        let tankW = Math.min(0.24, Math.max(0, (eff - 4) * 0.04));
        const sum = normalW + sprinterW + spitterW + tankW;
        const roll = Math.random() * sum;

        if (roll < normalW) return "normal";
        if (roll < normalW + sprinterW) return "sprinter";
        if (roll < normalW + sprinterW + spitterW) return "spitter";
        return "tank";
      }

      function waveSpawnTick(dt) {
        if (!game.wave.active) {
          game.wave.cooldownT += dt;
          if (game.wave.cooldownT >= game.wave.cooldown) startWave();
          return;
        }

        if (game.wave.killsDone >= game.wave.killsNeeded) {
          if (game.zombies.getAliveCount() === 0) endWave();
          return;
        }

        if (game.zombies.getAliveCount() >= game.wave.aliveCap) return;
        if (game.wave.spawned >= game.wave.spawnBudget) return;

        game.wave.spawnT += dt;
        if (game.wave.spawnT < game.wave.spawnInterval) return;

        game.wave.spawnT = 0;
        const type = chooseZombieType();
        const pFeet = game.player.getFeetPosition();
        const sp = game.zombies.pickSpawnPoint(pFeet, game.wave.number);
        const zombie = game.zombies.spawn(type, sp.x, sp.y, sp.z, game.wave.number);
        if (!zombie) return;

        game.wave.spawned++;
        if (type === "tank") game.wave.spawnedTanks++;
      }

      function costFor(key) {
        const u = upgrades[key];
        return Math.floor(u.baseCost * Math.pow(u.mult, u.level));
      }

      function applyUpgrade(key) {
        const u = upgrades[key];
        if (!u || u.level >= u.max) return;
        const cost = costFor(key);
        if (game.stats.coins < cost) return;

        game.stats.coins -= cost;
        u.level++;

        const p = game.player.state;

        if (key === "damage" || key === "fireRate" || key === "maxAmmo") {
          const prevAmmoState = {};
          for (const [weaponKey, weaponState] of Object.entries(game.weapons)) {
            prevAmmoState[weaponKey] = {
              magSize: weaponState.magSize,
              reserveMax: weaponState.reserveMax,
            };
          }
          recalcWeapons();
          if (key === "maxAmmo") {
            for (const [weaponKey, w] of Object.entries(game.weapons)) {
              const prev = prevAmmoState[weaponKey] || { magSize: w.magSize, reserveMax: w.reserveMax };
              const magDiff = Math.max(0, w.magSize - prev.magSize);
              const reserveDiff = Math.max(0, w.reserveMax - prev.reserveMax);
              w.ammo = Math.min(w.magSize, w.ammo + magDiff);
              w.reserve = Math.min(w.reserveMax, w.reserve + reserveDiff);
            }
          }
        }

        if (key === "hpMax") {
          p.hpMax = 100 + upgrades.hpMax.level * upgrades.hpMax.per;
          p.hp = Math.min(p.hpMax, p.hp + 12);
        }
        if (key === "staminaMax") {
          p.staminaMax = 100 + upgrades.staminaMax.level * upgrades.staminaMax.per;
          p.stamina = Math.min(p.staminaMax, p.stamina + 12);
        }
        if (key === "staminaRegen") {
          p.staminaRegen = 22 + upgrades.staminaRegen.level * upgrades.staminaRegen.per;
        }
        if (key === "coinsPerKill") {
          game.stats.coinsPerKill = 8 + upgrades.coinsPerKill.level * upgrades.coinsPerKill.per;
        }

        renderShop();
      }

      function renderShop() {
        if (game.ui.el.shopCoins) game.ui.el.shopCoins.textContent = game.stats.coins;
        if (!game.ui.el.shopBody) return;
        game.ui.el.shopBody.innerHTML = "";

        for (const cat of shopCats) {
          const card = document.createElement("div");
          card.className = "card";
          const h = document.createElement("h3");
          h.textContent = cat.title;
          card.appendChild(h);

          for (const it of cat.items) {
            const u = upgrades[it.key];
            const atMax = u.level >= u.max;
            const c = costFor(it.key);

            const row = document.createElement("div");
            row.className = "item";

            const meta = document.createElement("div");
            meta.className = "meta";
            meta.innerHTML = `<b>${it.name} (Lv ${u.level}/${u.max})</b><small>${it.desc}</small>`;
            row.appendChild(meta);

            const btn = document.createElement("button");
            btn.className = "buy";
            btn.textContent = atMax ? "MAX" : `Buy (${c})`;
            btn.disabled = atMax || game.stats.coins < c;
            btn.onclick = () => applyUpgrade(it.key);
            row.appendChild(btn);

            card.appendChild(row);
          }

          game.ui.el.shopBody.appendChild(card);
        }

        game.ui.updateHUD(game);
      }

      function hookUIButtons() {
        const { startBtn, resumeBtn, shopBtn, shopClose, shopRefill } = game.ui.el;

        startBtn.addEventListener("click", () => {
          if (!game.ready) return;
          game.started = true;
          game.shopOpen = false;
          game.ui.showStart(false);
          game.ui.showShop(false);
          setPaused(false);
          game.ui.setWaveMsg("WASD move. Click to lock mouse. Survive the wave.", 1500);
          tryLockCursorFromGesture();
        });

        resumeBtn.addEventListener("click", () => {
          if (!game.started) return;
          setPaused(false);
          game.ui.setWaveMsg("Click the game to lock your mouse.", 1200);
          tryLockCursorFromGesture();
        });

        shopBtn.addEventListener("click", () => {
          if (!game.started) return;
          openShop();
        });

        shopClose.addEventListener("click", () => closeShop());

        shopRefill.addEventListener("click", () => {
          if (!game.weapon) return;
          const missing = Math.max(0, (game.weapon.reserveMax || 0) - (game.weapon.reserve || 0));
          if (missing <= 0) {
            game.ui.setWaveMsg("Reserve already full.", 650);
            return;
          }

          const fill = Math.min(missing, Math.max(game.weapon.magSize * 3, 36));
          const cost = Math.max(25, Math.floor(fill * 1.4));
          if (game.stats.coins < cost) {
            game.ui.setWaveMsg("Not enough coins for refill.", 650);
            return;
          }

          game.stats.coins -= cost;
          game.weapon.reserve = Math.min((game.weapon.reserve || 0) + fill, game.weapon.reserveMax || 99999);
          game.ui.setWaveMsg(`Ammo refilled (-${cost})`, 650);
          renderShop();
        });

        renderer.domElement.addEventListener("pointerdown", () => {
          if (!game.started || game.shopOpen) return;
          if (!game.paused) tryLockCursorFromGesture();
          spawnBullet();
        });
      }

      function hookPlayerKeys() {
        game.player.bindKeys(
          () => toggleShop(),
          () => startReload(),
          () => {
            if (!game.started) return;
            if (game.shopOpen) { closeShop(); return; }
            setPaused(!game.paused, "Paused. Click Resume to continue.");
          }
        );

        document.addEventListener("keydown", (e) => {
          if (!game.started || game.shopOpen) return;
          if (e.code === "Digit1") {
            setWeapon("pistol", "Pistol equipped");
          } else if (e.code === "Digit2") {
            if (!game.unlocks.shotgun) {
              game.ui.setWaveMsg("Shotgun not unlocked yet.", 650);
              return;
            }
            setWeapon("shotgun", "Shotgun equipped");
          }
        });
      }

      function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(0.033, Math.max(0.001, game.clock.getDelta()));

        if (game.started && !game.paused && !game.shopOpen) {
          game.player.step(dt, game.world);
          updateReload(dt);
          waveSpawnTick(dt);
          if (game.player.isPrimaryDown()) spawnBullet();
          game.zombies.update(dt, game);
          game.fx.update(dt);

          if (game.player.state.hp <= 0) {
            game.player.state.hp = 0;
            setPaused(true, "GAME OVER. Refresh to restart.");
            game.ui.setWaveMsg("GAME OVER", 1200);
          }
        } else if (game.fx) {
          game.fx.update(dt);
        }

        game.ui.updateHUD(game);
        renderer.render(scene, camera);
      }

      async function init() {
        installFocusHandlers();
        hookUIButtons();

        for (const def of Object.values(weaponDefs)) {
          game.weapons[def.key] = makeWeaponState(def);
        }
        recalcWeapons();
        setWeapon("pistol");

        game.ui.showStart(true);
        game.ui.showPause(false);
        game.ui.showShop(false);
        game.ui.setMsg("", "");
        game.ui.setWaveMsg("Loading textures and building...", 900);

        game.tex = await Assets.loadAll();
        game.fx = createEffects();

        game.world = World.create(scene, game.tex);
        game.player = Player.make(scene, camera, renderer.domElement, game.world);
        game.zombies = Zombies.createManager(scene, game.world, game.tex, camera);

        hookPlayerKeys();

        const house = game.world.HOUSE;
        const startZ = house.depth * 0.5 - 7.5;
        const startFeetY = game.world.getGroundY(0, 0.02, startZ);
        game.player.setPositionFeet(0, startFeetY, startZ);

        game.stats.coins = 50;
        game.stats.coinsPerKill = 8;

        game.wave.number = 1;
        game.wave.active = false;
        game.wave.cooldownT = 0;
        game.wave.killsDone = 0;
        game.wave.killsNeeded = computeWave(game.wave.number).killsNeeded;

        game.ready = true;
        game.ui.el.startBtn.disabled = false;
        game.ui.el.startBtn.textContent = "Click to Start";
        game.ui.setGunImage(game.weapon.icon);
        game.ui.updateHUD(game);

        setPaused(true, "Loaded. Click Start.");
        animate();
      }

      init().catch(showBootError);
    } catch (err) {
      showBootError(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
