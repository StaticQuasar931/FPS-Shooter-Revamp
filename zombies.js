(() => {
  "use strict";

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  const TYPE_DEFS = {
    normal: {
      color: 0x7cff7c,
      hp: 92,
      hpScale: 0.075,
      speed: 2.5,
      speedScale: 0.013,
      dmg: 10,
      reach: 1.15,
      bodyH: 1.18,
      bodyR: 0.30,
      headR: 0.23,
    },
    sprinter: {
      color: 0x77d9ff,
      hp: 54,
      hpScale: 0.055,
      speed: 3.9,
      speedScale: 0.018,
      dmg: 8,
      reach: 1.05,
      bodyH: 1.06,
      bodyR: 0.27,
      headR: 0.20,
    },
    tank: {
      color: 0xffb36b,
      hp: 200,
      hpScale: 0.10,
      speed: 1.7,
      speedScale: 0.009,
      dmg: 17,
      reach: 1.28,
      bodyH: 1.48,
      bodyR: 0.39,
      headR: 0.29,
    },
    spitter: {
      color: 0xd7a3ff,
      hp: 86,
      hpScale: 0.065,
      speed: 2.15,
      speedScale: 0.012,
      dmg: 7,
      reach: 1.10,
      bodyH: 1.16,
      bodyR: 0.29,
      headR: 0.22,
      ranged: true,
      rangedDamage: 10,
      rangedSpeed: 16,
      rangedCooldown: 2.3,
      preferredMin: 7,
      preferredMax: 18,
    },
  };

  const tempCenter = new THREE.Vector3();
  const tempToCenter = new THREE.Vector3();
  const tempClosest = new THREE.Vector3();
  const tempFrom = new THREE.Vector3();
  const tempTo = new THREE.Vector3();
  const tempDir = new THREE.Vector3();
  const tempHead = new THREE.Vector3();
  const tempPlayerEye = new THREE.Vector3();
  const tempBodyHit = new THREE.Vector3();

  function makeZombieMesh(type) {
    const def = TYPE_DEFS[type] || TYPE_DEFS.normal;
    const baseMat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.92,
      metalness: 0.0,
      emissive: 0x000000,
    });

    const group = new THREE.Group();
    const parts = [];

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(def.bodyR, def.bodyR * 1.06, def.bodyH, 14),
      baseMat.clone()
    );
    body.position.y = def.bodyH * 0.56;
    parts.push(body);
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(def.headR, 14, 12),
      baseMat.clone()
    );
    head.position.y = def.bodyH + def.headR * 0.9;
    parts.push(head);
    group.add(head);

    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    const armL = new THREE.Mesh(armGeo, baseMat.clone());
    const armR = new THREE.Mesh(armGeo, baseMat.clone());
    armL.position.set(-def.bodyR - 0.08, def.bodyH * 0.65, 0);
    armR.position.set(def.bodyR + 0.08, def.bodyH * 0.65, 0);
    armL.rotation.z = 0.25;
    armR.rotation.z = -0.25;
    parts.push(armL, armR);
    group.add(armL, armR);

    group.userData.hitRadius = (type === "tank") ? 0.60 : 0.46;
    group.userData.hitHeight = (type === "tank") ? 1.90 : 1.56;
    group.userData.parts = parts;

    return group;
  }

  function makeZombieStats(type, wave) {
    const def = TYPE_DEFS[type] || TYPE_DEFS.normal;
    const difficulty = Math.max(1, wave || 1);
    const scaleHp = 1 + (difficulty - 1) * def.hpScale;
    const scaleSpeed = 1 + (difficulty - 1) * def.speedScale;

    return {
      hp: Math.round(def.hp * scaleHp),
      speed: def.speed * scaleSpeed,
      dmg: def.dmg + Math.floor((difficulty - 1) * 0.25),
      reach: def.reach,
      ranged: !!def.ranged,
      rangedDamage: def.rangedDamage || 0,
      rangedSpeed: def.rangedSpeed || 0,
      rangedCooldown: Math.max(0.9, (def.rangedCooldown || 1.8) - (difficulty - 1) * 0.015),
      preferredMin: def.preferredMin || 0,
      preferredMax: def.preferredMax || 0,
    };
  }

  function createManager(scene, world, tex, camera) {
    const list = [];
    const pool = {
      normal: [],
      sprinter: [],
      tank: [],
      spitter: [],
    };
    const spitPool = [];
    const activeSpit = [];

    function getAliveCount() {
      return list.length;
    }

    function pickSpawnPoint(playerFeet, waveNum) {
      const px = playerFeet.x;
      const pz = playerFeet.z;

      const b = (world && (world.BOUNDS || world.bounds)) || { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
      const house = world && world.HOUSE ? world.HOUSE : { floorHeight: 10, stories: 3 };
      const playerStory = Math.max(0, Math.min(house.stories - 1, Math.floor((playerFeet.y + 1.0) / house.floorHeight)));
      const wantOtherStory = Math.random() < 0.30;
      const story = wantOtherStory ? Math.floor(Math.random() * house.stories) : playerStory;
      const preferNear = Math.random() < 0.72;

      function overlapsSolids(x, feetY, z, radius, height) {
        if (!world || !world.solids) return false;
        const minX = x - radius, maxX = x + radius;
        const minY = feetY + 0.05, maxY = feetY + height;
        const minZ = z - radius, maxZ = z + radius;
        for (const s of world.solids) {
          const sx0 = s.min.x, sx1 = s.max.x;
          const sy0 = s.min.y, sy1 = s.max.y;
          const sz0 = s.min.z, sz1 = s.max.z;
          if (maxX < sx0 || minX > sx1) continue;
          if (maxZ < sz0 || minZ > sz1) continue;
          if (maxY < sy0 || minY > sy1) continue;
          return true;
        }
        return false;
      }

      let best = null;
      const spawnList = (world && world.spawnPoints && world.spawnPoints.length) ? world.spawnPoints : null;

      for (let attempt = 0; attempt < 42; attempt++) {
        let x;
        let z;
        let storyPick = story;

        if (spawnList) {
          const candidates = spawnList.filter(p => p.story === storyPick);
          const poolList = candidates.length ? candidates : spawnList;

          let sumW = 0;
          for (const p of poolList) sumW += (p.w || 1.0);
          let r = Math.random() * Math.max(0.0001, sumW);
          let pick = poolList[poolList.length - 1];
          for (const p of poolList) {
            r -= (p.w || 1.0);
            if (r <= 0) { pick = p; break; }
          }

          storyPick = pick.story;
          x = pick.x + (Math.random() - 0.5) * 6.0;
          z = pick.z + (Math.random() - 0.5) * 6.0;

          if (preferNear) {
            const ringA = Math.random() * Math.PI * 2;
            const ringR = 14 + Math.random() * 14;
            x = x * 0.55 + (px + Math.cos(ringA) * ringR) * 0.45;
            z = z * 0.55 + (pz + Math.sin(ringA) * ringR) * 0.45;
          }
        } else if (preferNear) {
          const rMin = 14;
          const rMax = 26;
          const a = Math.random() * Math.PI * 2;
          const r = rMin + Math.random() * (rMax - rMin);
          x = px + Math.cos(a) * r;
          z = pz + Math.sin(a) * r;
        } else {
          x = b.minX + 2 + Math.random() * (b.maxX - b.minX - 4);
          z = b.minZ + 2 + Math.random() * (b.maxZ - b.minZ - 4);
        }

        x = clamp(x, b.minX + 2, b.maxX - 2);
        z = clamp(z, b.minZ + 2, b.maxZ - 2);

        const storyFeet = (world && world.floorY) ? (world.floorY[storyPick] + 0.02) : playerFeet.y;
        const y = (world && world.getGroundY) ? world.getGroundY(x, storyFeet, z) : 0.02;

        const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
        if (d2 < 5.5 * 5.5) continue;

        if (overlapsSolids(x, y, z, 0.62, 1.65)) continue;

        best = { x, y, z };
        break;
      }

      if (!best) {
        const x = clamp(px + (Math.random() - 0.5) * 22, b.minX + 2, b.maxX - 2);
        const z = clamp(pz + (Math.random() - 0.5) * 22, b.minZ + 2, b.maxZ - 2);
        const y = (world && world.getGroundY) ? world.getGroundY(x, playerFeet.y, z) : 0.02;
        best = { x, y, z };
      }

      return best;
    }

    function acquireZombie(type) {
      const bucket = pool[type] || pool.normal;
      let zObj = bucket.pop();
      if (zObj) return zObj;

      const mesh = makeZombieMesh(type);
      mesh.visible = false;
      scene.add(mesh);

      return {
        type,
        mesh,
        parts: mesh.userData.parts || [],
        hp: 1,
        hpMax: 1,
        speed: 1,
        dmg: 1,
        reach: 1,
        radius: mesh.userData.hitRadius || 0.46,
        height: mesh.userData.hitHeight || 1.56,
        alive: false,
        t: 0,
        flashT: 0,
        meleeCooldown: 0,
        rangedCooldown: 0,
        pushT: 0,
        pushA: Math.random() * Math.PI * 2,
        stuckT: 0,
      };
    }

    function releaseZombie(zObj) {
      zObj.alive = false;
      zObj.mesh.visible = false;
      zObj.flashT = 0;
      zObj.meleeCooldown = 0;
      zObj.rangedCooldown = 0;
      zObj.pushT = 0;
      zObj.stuckT = 0;
      applyFlash(zObj, 0);
      (pool[zObj.type] || pool.normal).push(zObj);
    }

    function spawn(type, x, y, z, waveNum) {
      const key = TYPE_DEFS[type] ? type : "normal";
      const stats = makeZombieStats(key, waveNum);
      const zObj = acquireZombie(key);

      zObj.type = key;
      zObj.mesh.position.set(x, y, z);
      zObj.mesh.visible = true;
      zObj.hp = stats.hp;
      zObj.hpMax = stats.hp;
      zObj.speed = stats.speed;
      zObj.dmg = stats.dmg;
      zObj.reach = stats.reach;
      zObj.ranged = stats.ranged;
      zObj.rangedDamage = stats.rangedDamage;
      zObj.rangedSpeed = stats.rangedSpeed;
      zObj.rangedCooldownDelay = stats.rangedCooldown;
      zObj.preferredMin = stats.preferredMin;
      zObj.preferredMax = stats.preferredMax;
      zObj.alive = true;
      zObj.t = 0;
      zObj.flashT = 0;
      zObj.meleeCooldown = 0;
      zObj.rangedCooldown = 0.8 + Math.random() * 0.6;
      zObj.pushT = 0;
      zObj.pushA = Math.random() * Math.PI * 2;
      zObj.stuckT = 0;

      list.push(zObj);
      return zObj;
    }

    function applyFlash(zObj, intensity) {
      const glow = clamp(intensity, 0, 1) * 1.15;
      for (const part of zObj.parts) {
        if (!part.material || !part.material.emissive) continue;
        part.material.emissive.setRGB(glow, glow * 0.92, glow * 0.92);
      }
    }

    function hasLineOfSight(from, to, maxDist) {
      tempDir.copy(to).sub(from);
      const dist = tempDir.length();
      if (dist <= 0.0001) return true;
      tempDir.multiplyScalar(1 / dist);
      const hit = (window.Physics && Physics.raycastAABBs && world && world.solids)
        ? Physics.raycastAABBs(from, tempDir, world.solids, Math.min(maxDist || dist, dist))
        : null;
      return !hit;
    }

    function acquireSpitProjectile() {
      let projectile = spitPool.pop();
      if (projectile) return projectile;

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xa3ff7c, transparent: true, opacity: 0.95 })
      );
      mesh.scale.set(1.35, 1.35, 1.35);
      mesh.visible = false;
      scene.add(mesh);

      return {
        mesh,
        active: false,
        damage: 0,
        speed: 0,
        life: 0,
        radius: 0.28,
        velocity: new THREE.Vector3(),
      };
    }

    function releaseProjectile(projectile) {
      projectile.active = false;
      projectile.mesh.visible = false;
      projectile.life = 0;
      projectile.velocity.set(0, 0, 0);
      spitPool.push(projectile);
    }

    function spawnSpit(zObj, playerFeet) {
      if (!zObj.ranged) return;
      tempHead.set(
        zObj.mesh.position.x,
        zObj.mesh.position.y + zObj.height * 0.72,
        zObj.mesh.position.z
      );
      tempPlayerEye.set(playerFeet.x, playerFeet.y + 1.9, playerFeet.z);
      if (!hasLineOfSight(tempHead, tempPlayerEye, zObj.preferredMax + 4)) return;

      const projectile = acquireSpitProjectile();
      projectile.active = true;
      projectile.damage = zObj.rangedDamage;
      projectile.speed = zObj.rangedSpeed;
      projectile.life = 2.2;
      projectile.mesh.visible = true;
      projectile.mesh.position.copy(tempHead);
      projectile.velocity.copy(tempPlayerEye).sub(tempHead).normalize().multiplyScalar(projectile.speed);
      activeSpit.push(projectile);
    }

    function damageFromBullet(origin, dir, maxDist, dmg, worldRef) {
      let best = null;
      let bestT = maxDist;

      const wallHit = (window.Physics && Physics.raycastAABBs && worldRef && worldRef.solids)
        ? Physics.raycastAABBs(origin, dir, worldRef.solids, maxDist)
        : null;
      if (wallHit) bestT = Math.min(bestT, wallHit.t);

      for (const z of list) {
        if (!z.alive) continue;

        tempCenter.set(
          z.mesh.position.x,
          z.mesh.position.y + z.height * 0.55,
          z.mesh.position.z
        );

        tempToCenter.copy(tempCenter).sub(origin);
        const t = tempToCenter.dot(dir);
        if (t < 0 || t > bestT) continue;

        tempClosest.copy(dir).multiplyScalar(t).add(origin);
        const d = tempClosest.distanceTo(tempCenter);
        const minY = z.mesh.position.y + 0.10;
        const maxY = z.mesh.position.y + z.height + 0.16;
        if (d > z.radius || tempClosest.y < minY || tempClosest.y > maxY) continue;

        best = z;
        bestT = t;
      }

      if (!best) return { hit:false, blocked: !!wallHit };

      best.hp -= dmg;
      best.flashT = 0.12;
      applyFlash(best, 1);

      let killed = false;
      if (best.hp <= 0) {
        killed = true;
        best.alive = false;
      }

      return { hit:true, killed, type: best.type, dist: bestT };
    }

    function updateProjectiles(dt, game) {
      if (!game || !game.player) return;
      const playerFeet = game.player.getFeetPosition();

      for (let i = activeSpit.length - 1; i >= 0; i--) {
        const projectile = activeSpit[i];
        if (!projectile.active) {
          activeSpit.splice(i, 1);
          continue;
        }

        projectile.life -= dt;
        if (projectile.life <= 0) {
          activeSpit.splice(i, 1);
          releaseProjectile(projectile);
          continue;
        }

        tempFrom.copy(projectile.mesh.position);
        tempDir.copy(projectile.velocity).multiplyScalar(dt);
        tempTo.copy(tempFrom).add(tempDir);

        const stepLen = tempDir.length();
        if (stepLen > 0.0001 && window.Physics && Physics.raycastAABBs && world && world.solids) {
          tempDir.normalize();
          const hitWall = Physics.raycastAABBs(tempFrom, tempDir, world.solids, stepLen);
          if (hitWall) {
            activeSpit.splice(i, 1);
            releaseProjectile(projectile);
            continue;
          }
        }

        projectile.mesh.position.copy(tempTo);

        const playerCenterY = playerFeet.y + 1.3;
        const dx = projectile.mesh.position.x - playerFeet.x;
        const dy = projectile.mesh.position.y - playerCenterY;
        const dz = projectile.mesh.position.z - playerFeet.z;
        const hitDistSq = dx * dx + dy * dy + dz * dz;
        if (hitDistSq <= projectile.radius * projectile.radius + 0.65) {
          game.player.state.hp = Math.max(0, (game.player.state.hp || 0) - projectile.damage);
          if (game.ui && game.ui.flashDamage) game.ui.flashDamage();
          activeSpit.splice(i, 1);
          releaseProjectile(projectile);
        }
      }
    }

    function update(dt, game) {
      if (!game || !game.player) return;

      const pFeet = game.player.getFeetPosition();
      const px = pFeet.x;
      const pz = pFeet.z;

      for (let i = list.length - 1; i >= 0; i--) {
        const z = list[i];
        if (!z.alive) {
          list.splice(i, 1);
          releaseZombie(z);
          continue;
        }

        z.t += dt;
        if (z.flashT > 0) {
          z.flashT = Math.max(0, z.flashT - dt);
          applyFlash(z, z.flashT / 0.09);
        } else {
          applyFlash(z, 0);
        }

        z.meleeCooldown = Math.max(0, z.meleeCooldown - dt);
        z.rangedCooldown = Math.max(0, z.rangedCooldown - dt);
        if (z.pushT > 0) z.pushT = Math.max(0, z.pushT - dt);

        const feet = z.mesh.position;
        const oldX = feet.x;
        const oldZ = feet.z;
        const dx = px - feet.x;
        const dz = pz - feet.z;
        const dist = Math.sqrt(dx * dx + dz * dz) + 0.000001;
        const verticalGap = Math.abs((pFeet.y + 1.0) - (feet.y + z.height * 0.5));

        let wishX = dx / dist;
        let wishZ = dz / dist;

        if (z.type === "spitter" && dist >= z.preferredMin && dist <= z.preferredMax) {
          const side = Math.sin(z.t * 2.2 + z.pushA);
          wishX = -dz / dist * side * 0.65;
          wishZ = dx / dist * side * 0.65;
        } else if (z.type === "spitter" && dist < z.preferredMin) {
          wishX *= -0.75;
          wishZ *= -0.75;
        } else if (z.type === "tank") {
          wishX *= 0.9;
          wishZ *= 0.9;
        }

        if (z.pushT > 0) {
          const s = Math.sin(z.pushA);
          const c = Math.cos(z.pushA);
          wishX = wishX * 0.55 + c * 0.45;
          wishZ = wishZ * 0.55 + s * 0.45;
        }

        const wishLen = Math.sqrt(wishX * wishX + wishZ * wishZ) || 1;
        wishX /= wishLen;
        wishZ /= wishLen;

        z.mesh.rotation.y = Math.atan2(dx, dz);

        const shouldMove = !(z.type === "spitter" && dist >= z.preferredMin && dist <= z.preferredMax && z.rangedCooldown < 0.45);
        const steps = 2;
        for (let step = 0; step < steps; step++) {
          const subDt = dt / steps;
          if (shouldMove && dist > 0.75) {
            feet.x += wishX * z.speed * subDt;
            feet.z += wishZ * z.speed * subDt;
          }
          if (world && world.clampToBounds) world.clampToBounds(feet);
          if (world && world.solids && window.Physics && Physics.resolveSolids) {
            Physics.resolveSolids(feet, z.radius * 0.85, z.height, world.solids, 2);
          }
        }

        const floorY = (world && world.getGroundY) ? world.getGroundY(feet.x, feet.y, feet.z) : 0.02;
        feet.y = floorY;

        if (world && world.ceilings && window.Physics && Physics.resolveCeilings) {
          Physics.resolveCeilings(feet, z.radius * 0.85, z.height, world.ceilings, world.holes || []);
          const y2 = world.getGroundY ? world.getGroundY(feet.x, feet.y, feet.z) : 0.02;
          if (feet.y < y2) feet.y = y2;
        }

        const moved = Math.hypot(feet.x - oldX, feet.z - oldZ);
        if (moved < 0.004) z.stuckT += dt;
        else z.stuckT = Math.max(0, z.stuckT - dt * 0.75);

        if (z.stuckT > 0.60) {
          z.stuckT = 0;
          z.pushT = 0.65;
          z.pushA = Math.random() * Math.PI * 2;
        }

        if (z.type === "spitter" && verticalGap < 2.4 && dist >= z.preferredMin * 0.9 && dist <= z.preferredMax + 2 && z.rangedCooldown <= 0) {
          spawnSpit(z, pFeet);
          z.rangedCooldown = z.rangedCooldownDelay;
        }

        if (verticalGap < 2.2 && dist <= z.reach && z.meleeCooldown <= 0) {
          z.meleeCooldown = (z.type === "tank") ? 0.85 : 0.65;
          game.player.state.hp = Math.max(0, (game.player.state.hp || 0) - z.dmg);
          if (game.ui && game.ui.flashDamage) game.ui.flashDamage();
        }
      }

      updateProjectiles(dt, game);
    }

    function reset() {
      for (let i = list.length - 1; i >= 0; i--) {
        releaseZombie(list[i]);
      }
      list.length = 0;

      for (let i = activeSpit.length - 1; i >= 0; i--) {
        releaseProjectile(activeSpit[i]);
      }
      activeSpit.length = 0;
    }

    return {
      list,
      getAliveCount,
      pickSpawnPoint,
      spawn,
      update,
      damageFromBullet,
      reset,
    };
  }

  window.Zombies = { createManager };
})();
