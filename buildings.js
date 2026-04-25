window.Buildings = (() => {
  "use strict";

  const SOLID_SHRINK = 0.08;

  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

  function addAABB(solids, minX, minY, minZ, maxX, maxY, maxZ, tag = "") {
    solids.push({
      min: v3(minX + SOLID_SHRINK, minY, minZ + SOLID_SHRINK),
      max: v3(maxX - SOLID_SHRINK, maxY, maxZ - SOLID_SHRINK),
      tag
    });
  }

  function addCeilAABB(ceilings, minX, minY, minZ, maxX, maxY, maxZ, tag = "") {
    ceilings.push({ min: v3(minX, minY, minZ), max: v3(maxX, maxY, maxZ), tag });
  }

  function addHole(holes, minX, minY, minZ, maxX, maxY, maxZ, tag = "") {
    holes.push({ min: v3(minX, minY, minZ), max: v3(maxX, maxY, maxZ), tag });
  }

  function addRamp(ramps, ax, az, bx, bz, y0, y1, width, tag = "") {
    ramps.push({ ax, az, bx, bz, y0, y1, width, tag });
  }

  function build(scene, tex) {
    const solids = [];
    const ceilings = [];
    const ramps = [];
    const holes = [];
    const spawnPoints = [];
    const roomLights = [];

    const HOUSE = {
      stories: 3,
      floorHeight: 10,
      width: 86,
      depth: 62,
      wallH: 9.0,
      wallT: 0.80
    };

    const halfW = HOUSE.width * 0.5;
    const halfD = HOUSE.depth * 0.5;
    const t = HOUSE.wallT;

    const bounds = {
      minX: -halfW + 2.1,
      maxX: halfW - 2.1,
      minZ: -halfD + 2.1,
      maxZ: halfD - 2.1
    };

    const floorY = [];
    for (let s = 0; s < HOUSE.stories; s++) floorY[s] = s * HOUSE.floorHeight;

    tex.floorWood.repeat.set(8, 6);
    tex.carpet.repeat.set(8, 6);
    tex.ceiling.repeat.set(8, 6);

    const matFloor0 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.92, metalness: 0.02 });
    const matFloor1 = new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 0.98, metalness: 0.0 });
    const matFloor2 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.93, metalness: 0.02 });
    const matCeil = new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 0.96, metalness: 0.0 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0xdad4c9, roughness: 0.96, metalness: 0.0 });
    const matTrim = new THREE.MeshStandardMaterial({ color: 0xb7ad9f, roughness: 0.88, metalness: 0.02 });
    const matStone = new THREE.MeshStandardMaterial({ color: 0x66686c, roughness: 0.98, metalness: 0.0 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x7b5940, roughness: 0.90, metalness: 0.02 });
    const matDarkWood = new THREE.MeshStandardMaterial({ color: 0x4a3323, roughness: 0.92, metalness: 0.01 });
    const matBlueFabric = new THREE.MeshStandardMaterial({ color: 0x526277, roughness: 0.97, metalness: 0.0 });
    const matGreenFabric = new THREE.MeshStandardMaterial({ color: 0x61715c, roughness: 0.97, metalness: 0.0 });
    const matBed = new THREE.MeshStandardMaterial({ color: 0xd9d9d4, roughness: 0.98, metalness: 0.0 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0xb88056, roughness: 0.91, metalness: 0.03 });
    const matLamp = new THREE.MeshStandardMaterial({ color: 0xefddb1, emissive: 0x281b10, emissiveIntensity: 0.34, roughness: 0.70 });
    const matPlant = new THREE.MeshStandardMaterial({ color: 0x55774b, roughness: 0.95, metalness: 0.0 });
    const matPot = new THREE.MeshStandardMaterial({ color: 0x7a5d49, roughness: 0.94, metalness: 0.0 });

    const hall = { minX: -5.8, maxX: 5.8, minZ: -halfD + 2.8, maxZ: halfD - 2.8 };
    const stair = { x: 24.0, z: 4.0, width: 8.6, depth: 15.2 };
    const stairHole = { x: stair.x, z: stair.z, w: stair.width + 1.8, d: stair.depth + 1.2 };

    function boxMesh(x, y, z, w, h, d, mat, cast = true, receive = true) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h * 0.5, z);
      m.castShadow = cast;
      m.receiveShadow = receive;
      scene.add(m);
      return m;
    }

    function planeMesh(w, h, x, y, z, rotY, mat) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z);
      m.rotation.y = rotY || 0;
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    }

    function cylMesh(x, y, z, rTop, rBottom, h, mat) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 16), mat);
      m.position.set(x, y + h * 0.5, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    }

    function floorSlab(y, mat) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.width, 1.2, HOUSE.depth), mat);
      m.position.set(0, y - 0.6, 0);
      m.receiveShadow = true;
      scene.add(m);
    }

    floorSlab(floorY[0], matFloor0);
    floorSlab(floorY[1], matFloor1);
    floorSlab(floorY[2], matFloor2);

    function outerShell(baseY, frontDoor) {
      const doorW = 11.5;
      const sideW = (HOUSE.width - doorW) * 0.5;

      boxMesh(0, baseY, -halfD + t * 0.5, HOUSE.width, HOUSE.wallH, t, matWall);
      addAABB(solids, -halfW, baseY, -halfD, halfW, baseY + HOUSE.wallH, -halfD + t, "northWall");

      boxMesh(-halfW + t * 0.5, baseY, 0, t, HOUSE.wallH, HOUSE.depth, matWall);
      addAABB(solids, -halfW, baseY, -halfD, -halfW + t, baseY + HOUSE.wallH, halfD, "westWall");

      boxMesh(halfW - t * 0.5, baseY, 0, t, HOUSE.wallH, HOUSE.depth, matWall);
      addAABB(solids, halfW - t, baseY, -halfD, halfW, baseY + HOUSE.wallH, halfD, "eastWall");

      if (frontDoor) {
        boxMesh(-(doorW * 0.5 + sideW * 0.5), baseY, halfD - t * 0.5, sideW, HOUSE.wallH, t, matWall);
        boxMesh((doorW * 0.5 + sideW * 0.5), baseY, halfD - t * 0.5, sideW, HOUSE.wallH, t, matWall);
        addAABB(solids, -halfW, baseY, halfD - t, -doorW * 0.5, baseY + HOUSE.wallH, halfD, "southWallLeft");
        addAABB(solids, doorW * 0.5, baseY, halfD - t, halfW, baseY + HOUSE.wallH, halfD, "southWallRight");
      } else {
        boxMesh(0, baseY, halfD - t * 0.5, HOUSE.width, HOUSE.wallH, t, matWall);
        addAABB(solids, -halfW, baseY, halfD - t, halfW, baseY + HOUSE.wallH, halfD, "southWall");
      }
    }

    for (let s = 0; s < HOUSE.stories; s++) outerShell(floorY[s], s === 0);

    boxMesh(0, -0.3, halfD + 6, 30, 0.6, 10, matStone, false, true);

    function ceilingWithHole(y, hole) {
      addCeilAABB(ceilings, -halfW, y + 0.25, -halfD, halfW, y + 2.0, halfD, "ceiling");

      if (!hole) {
        boxMesh(0, y, 0, HOUSE.width, 1.0, HOUSE.depth, matCeil, false, true);
        return;
      }

      addHole(
        holes,
        hole.x - hole.w * 0.5,
        y + 0.15,
        hole.z - hole.d * 0.5,
        hole.x + hole.w * 0.5,
        y + 2.45,
        hole.z + hole.d * 0.5,
        "stairHole"
      );

      const northDepth = Math.max(0.2, (hole.z - hole.d * 0.5) - (-halfD));
      const southDepth = Math.max(0.2, halfD - (hole.z + hole.d * 0.5));
      const westWidth = Math.max(0.2, (hole.x - hole.w * 0.5) - (-halfW));
      const eastWidth = Math.max(0.2, halfW - (hole.x + hole.w * 0.5));

      boxMesh(0, y, (-halfD + (hole.z - hole.d * 0.5)) * 0.5, HOUSE.width, 1.0, northDepth, matCeil, false, true);
      boxMesh(0, y, (halfD + (hole.z + hole.d * 0.5)) * 0.5, HOUSE.width, 1.0, southDepth, matCeil, false, true);
      boxMesh((-halfW + (hole.x - hole.w * 0.5)) * 0.5, y, hole.z, westWidth, 1.0, hole.d, matCeil, false, true);
      boxMesh((halfW + (hole.x + hole.w * 0.5)) * 0.5, y, hole.z, eastWidth, 1.0, hole.d, matCeil, false, true);

      const frame = 0.26;
      boxMesh(hole.x, y, hole.z - hole.d * 0.5 - frame * 0.5, hole.w + 1.0, 0.22, frame, matTrim, false, true);
      boxMesh(hole.x, y, hole.z + hole.d * 0.5 + frame * 0.5, hole.w + 1.0, 0.22, frame, matTrim, false, true);
      boxMesh(hole.x - hole.w * 0.5 - frame * 0.5, y, hole.z, frame, 0.22, hole.d + 1.0, matTrim, false, true);
      boxMesh(hole.x + hole.w * 0.5 + frame * 0.5, y, hole.z, frame, 0.22, hole.d + 1.0, matTrim, false, true);
    }

    ceilingWithHole(HOUSE.wallH + floorY[0], stairHole);
    ceilingWithHole(HOUSE.wallH + floorY[1], stairHole);
    ceilingWithHole(HOUSE.wallH + floorY[2], null);

    function wallZ(x, y, zCenter, length, thickness, tag) {
      boxMesh(x, y, zCenter, thickness, HOUSE.wallH, length, matWall);
      addAABB(solids, x - thickness * 0.5, y, zCenter - length * 0.5, x + thickness * 0.5, y + HOUSE.wallH, zCenter + length * 0.5, tag);
    }

    function wallX(xCenter, y, z, length, thickness, tag) {
      boxMesh(xCenter, y, z, length, HOUSE.wallH, thickness, matWall);
      addAABB(solids, xCenter - length * 0.5, y, z - thickness * 0.5, xCenter + length * 0.5, y + HOUSE.wallH, z + thickness * 0.5, tag);
    }

    function splitWallZ(x, y, z0, z1, openings, tag) {
      const sorted = (openings || []).slice().sort((a, b) => a.min - b.min);
      let cur = z0;
      for (const open of sorted) {
        if (open.min > cur) wallZ(x, y, (cur + open.min) * 0.5, open.min - cur, t, `${tag}_seg`);
        cur = Math.max(cur, open.max);
      }
      if (z1 > cur) wallZ(x, y, (cur + z1) * 0.5, z1 - cur, t, `${tag}_seg`);
    }

    function splitWallX(y, z, x0, x1, openings, tag) {
      const sorted = (openings || []).slice().sort((a, b) => a.min - b.min);
      let cur = x0;
      for (const open of sorted) {
        if (open.min > cur) wallX((cur + open.min) * 0.5, y, z, open.min - cur, t, `${tag}_seg`);
        cur = Math.max(cur, open.max);
      }
      if (x1 > cur) wallX((cur + x1) * 0.5, y, z, x1 - cur, t, `${tag}_seg`);
    }

    function buildInterior(story) {
      const by = floorY[story];

      splitWallZ(hall.minX, by, hall.minZ, hall.maxZ, [
        { min: 19.5, max: 24.5 },
        { min: 7.2, max: 12.2 },
        { min: -6.0, max: -1.0 },
        { min: -21.0, max: -16.0 }
      ], `hallLeft_${story}`);

      splitWallZ(hall.maxX, by, hall.minZ, hall.maxZ, [
        { min: 18.0, max: 23.0 },
        { min: 1.0, max: 6.2 },
        { min: -11.5, max: -6.0 },
        { min: -23.0, max: -18.0 }
      ], `hallRight_${story}`);

      splitWallX(by, 8.5, -halfW + t, hall.minX, [{ min: -27.0, max: -22.0 }], `westFront_${story}`);
      splitWallX(by, -8.0, -halfW + t, hall.minX, [{ min: -27.0, max: -22.0 }], `westRear_${story}`);

      splitWallX(by, -10.0, hall.maxX, halfW - t, [{ min: 26.0, max: 31.0 }], `eastRear_${story}`);

      splitWallZ(16.0, by, -10.0, 17.0, [{ min: 0.2, max: 5.4 }], `eastSplitA_${story}`);
      splitWallZ(31.6, by, -10.0, 17.0, [{ min: 7.0, max: 12.0 }], `eastSplitB_${story}`);

      splitWallZ(stair.x - stair.width * 0.5 - 1.3, by, -6.5, 13.2, [{ min: 1.8, max: 6.2 }], `stairWest_${story}`);
      splitWallZ(stair.x + stair.width * 0.5 + 1.3, by, -6.5, 13.2, [{ min: 5.5, max: 10.0 }], `stairEast_${story}`);
      splitWallX(by, -6.5, stair.x - stair.width * 0.5 - 1.3, stair.x + stair.width * 0.5 + 1.3, [{ min: 20.8, max: 27.2 }], `stairNorth_${story}`);
      if (story !== 0) {
        splitWallX(by, 13.2, stair.x - stair.width * 0.5 - 1.3, stair.x + stair.width * 0.5 + 1.3, [{ min: 20.8, max: 27.2 }], `stairSouth_${story}`);
      }
    }

    for (let s = 0; s < HOUSE.stories; s++) buildInterior(s);

    const doorMat = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.95, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshStandardMaterial({
      map: tex.windowGlass,
      transparent: true,
      opacity: 0.72,
      roughness: 0.18,
      side: THREE.DoubleSide
    });

    function doorAt(x, y, z, rotY) {
      planeMesh(3.0, 6.0, x, y + 3.0, z, rotY, doorMat);
    }

    function windowAt(x, y, z, rotY) {
      planeMesh(6.2, 3.4, x, y + 5.4, z, rotY, glassMat);
      const trimDepth = 0.2;
      const offsetZ = Math.abs(rotY) < 0.01 ? -0.1 : (Math.abs(rotY - Math.PI) < 0.01 ? 0.1 : 0);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.8, trimDepth), matTrim);
      trim.position.set(x, y + 5.4, z + offsetZ);
      trim.rotation.y = rotY;
      trim.castShadow = true;
      trim.receiveShadow = true;
      scene.add(trim);
    }

    doorAt(0, 0, halfD - 0.9, Math.PI);
    for (let s = 0; s < HOUSE.stories; s++) {
      const by = floorY[s];
      windowAt(-halfW + 0.9, by, -17, Math.PI * 0.5);
      windowAt(-halfW + 0.9, by, 17, Math.PI * 0.5);
      windowAt(halfW - 0.9, by, -17, -Math.PI * 0.5);
      windowAt(halfW - 0.9, by, 17, -Math.PI * 0.5);
      windowAt(-14, by, -halfD + 0.9, 0);
      windowAt(14, by, -halfD + 0.9, 0);
      windowAt(-14, by, halfD - 0.9, Math.PI);
      windowAt(14, by, halfD - 0.9, Math.PI);
    }

    function makeStairRamp(cx, cz, fromStory, toStory) {
      const yBase = floorY[fromStory];
      const yTop = floorY[toStory];
      const run = 12.6;
      const width = 5.8;
      const stepCount = 18;
      const rise = (yTop - yBase) / stepCount;
      const tread = run / stepCount;
      const stairMat = new THREE.MeshStandardMaterial({ color: 0x7a6f63, roughness: 0.88 });

      const zStart = cz + 5.6;
      for (let i = 0; i < stepCount; i++) {
        const h = Math.max(0.10, rise * 0.95);
        const y = yBase + i * rise;
        const z = zStart - i * tread;
        const step = new THREE.Mesh(new THREE.BoxGeometry(width, h, tread * 0.98), stairMat);
        step.position.set(cx, y + h * 0.5, z - tread * 0.5);
        step.castShadow = true;
        step.receiveShadow = true;
        scene.add(step);
      }

      addRamp(ramps, cx, zStart, cx, zStart - run, yBase + 0.02, yTop + 0.02, width, `ramp_${fromStory}_${toStory}`);
      addAABB(solids, cx - width * 0.5 - 0.24, yBase + 1.0, zStart - run + 0.4, cx - width * 0.5 - 0.04, yTop + 0.85, zStart + 0.7, "stairRailL");
      addAABB(solids, cx + width * 0.5 + 0.04, yBase + 1.0, zStart - run + 0.4, cx + width * 0.5 + 0.24, yTop + 0.85, zStart + 0.7, "stairRailR");
      boxMesh(cx, yTop, zStart - run + 0.6, width + 1.2, 0.40, 5.2, matStone);
    }

    makeStairRamp(stair.x, stair.z, 0, 1);
    makeStairRamp(stair.x, stair.z, 1, 2);

    function addSolidForGroup(x, y, z, sx, sy, sz, tag) {
      addAABB(solids, x - sx * 0.5, y, z - sz * 0.5, x + sx * 0.5, y + sy, z + sz * 0.5, tag);
    }

    function couch(x, y, z, rotY, fabricMat) {
      const mat = fabricMat || matBlueFabric;
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.75, 1.3), mat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.15, 0.22), mat);
      base.position.set(0, 0.38, 0);
      back.position.set(0, 0.78, -0.54);
      group.add(base, back);
      for (const xSide of [-1.44, 1.44]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 1.25), mat);
        arm.position.set(xSide, 0.43, 0);
        group.add(arm);
      }
      for (const legPos of [[-1.2, 0.1, -0.42], [1.2, 0.1, -0.42], [-1.2, 0.1, 0.42], [1.2, 0.1, 0.42]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), matDarkWood);
        leg.position.set(legPos[0], legPos[1], legPos[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 3.3, 1.2, 1.65, "couch");
    }

    function coffeeTable(x, y, z, rotY) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 1.15), matWood);
      top.position.set(0, 0.72, 0);
      group.add(top);
      for (const p of [[-0.82, 0.36, -0.42], [0.82, 0.36, -0.42], [-0.82, 0.36, 0.42], [0.82, 0.36, 0.42]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.16), matDarkWood);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 2.2, 0.9, 1.25, "coffeeTable");
    }

    function diningTable(x, y, z, rotY) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 1.45), matWood);
      top.position.set(0, 0.84, 0);
      group.add(top);
      for (const p of [[-0.94, 0.38, -0.56], [0.94, 0.38, -0.56], [-0.94, 0.38, 0.56], [0.94, 0.38, 0.56]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.16), matDarkWood);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 2.6, 0.95, 1.55, "diningTable");
    }

    function chair(x, y, z, rotY) {
      const group = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), matAccent);
      seat.position.set(0, 0.52, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.86, 0.12), matAccent);
      back.position.set(0, 0.95, -0.30);
      group.add(seat, back);
      for (const p of [[-0.24, 0.25, -0.24], [0.24, 0.25, -0.24], [-0.24, 0.25, 0.24], [0.24, 0.25, 0.24]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.50, 0.10), matDarkWood);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 0.9, 1.4, 0.9, "chair");
    }

    function bookshelf(x, y, z, rotY) {
      const group = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.4, 0.42), matDarkWood);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.25, 0.05), matWood);
      back.position.z = -0.17;
      group.add(outer, back);
      for (let i = 0; i < 4; i++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.08, 0.36), matWood);
        shelf.position.set(0, -0.86 + i * 0.58, 0);
        group.add(shelf);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y + 1.2, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 1.6, 2.45, 0.44, "bookshelf");
    }

    function dresser(x, y, z, rotY) {
      const body = boxMesh(x, y, z, 2.2, 1.25, 0.9, matDarkWood);
      body.rotation.y = rotY || 0;
      addSolidForGroup(x, y, z, 2.25, 1.28, 0.95, "dresser");
    }

    function desk(x, y, z, rotY) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.8), matWood);
      top.position.set(0, 0.76, 0);
      group.add(top);
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.7), matDarkWood);
      drawer.position.set(0.55, 0.43, 0);
      group.add(drawer);
      for (const p of [[-0.72, 0.36, -0.26], [-0.72, 0.36, 0.26], [0.10, 0.36, -0.26], [0.10, 0.36, 0.26]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.12), matDarkWood);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 1.85, 0.95, 0.85, "desk");
    }

    function bed(x, y, z, rotY) {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.42, 2.1), matDarkWood);
      frame.position.set(0, 0.22, 0);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 1.9), matBed);
      mattress.position.set(0, 0.60, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.1, 0.18), matAccent);
      head.position.set(0, 0.70, -0.95);
      group.add(frame, mattress, head);
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addSolidForGroup(x, y, z, 3.25, 1.15, 2.15, "bed");
    }

    function counter(x, y, z, rotY, width = 3.8, depth = 1.1) {
      const body = boxMesh(x, y, z, width, 1.15, depth, matDarkWood);
      body.rotation.y = rotY || 0;
      boxMesh(x, y + 1.02, z, width + 0.10, 0.12, depth + 0.08, matWood);
      addSolidForGroup(x, y, z, width, 1.25, depth, "counter");
    }

    function tvScreen(x, y, z, rotY, width = 8.2, height = 4.6) {
      const mat = new THREE.MeshStandardMaterial({
        map: tex.tvScreen,
        emissive: new THREE.Color(0x202040),
        emissiveIntensity: 0.72,
        roughness: 0.35,
        side: THREE.DoubleSide
      });
      planeMesh(width, height, x, y + 4.2, z, rotY, mat);
    }

    function lamp(x, y, z) {
      cylMesh(x, y, z, 0.12, 0.16, 1.7, matDarkWood);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.28, 0.42, 16, 1, true), matLamp);
      shade.position.set(x, y + 1.75, z);
      shade.castShadow = true;
      shade.receiveShadow = true;
      scene.add(shade);
      cylMesh(x, y, z, 0.34, 0.38, 0.08, matDarkWood);
      addSolidForGroup(x, y, z, 0.7, 1.9, 0.7, "lamp");
    }

    function plant(x, y, z) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.38, 14), matPot);
      pot.position.set(x, y + 0.19, z);
      pot.castShadow = true;
      pot.receiveShadow = true;
      scene.add(pot);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), matPlant);
      leaves.position.set(x, y + 0.88, z);
      leaves.scale.set(1.0, 1.25, 1.0);
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      scene.add(leaves);
      addSolidForGroup(x, y, z, 0.7, 1.3, 0.7, "plant");
    }

    function rug(x, y, z, w, d, color) {
      const mat = new THREE.MeshStandardMaterial({ color: color || 0x6d5f52, roughness: 0.98, metalness: 0.0 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat);
      m.position.set(x, y + 0.02, z);
      m.receiveShadow = true;
      scene.add(m);
    }

    function crateStack(x, y, z, count) {
      const c = Math.max(1, count || 1);
      for (let i = 0; i < c; i++) {
        const offX = (i % 2) * 0.7 - 0.35;
        const offZ = (Math.floor(i / 2) % 2) * 0.7 - 0.35;
        boxMesh(x + offX, y + i * 0.72, z + offZ, 0.65, 0.65, 0.65, matWood);
      }
      addSolidForGroup(x, y, z, 1.5, 0.75 + (c - 1) * 0.72, 1.5, "crateStack");
    }

    function consoleTable(x, y, z, rotY) {
      const top = boxMesh(x, y + 0.74, z, 1.8, 0.10, 0.48, matWood);
      top.rotation.y = rotY || 0;
      const legOffsetX = Math.abs(Math.cos(rotY || 0)) > 0.7 ? 0.7 : 0.14;
      const legOffsetZ = Math.abs(Math.cos(rotY || 0)) > 0.7 ? 0.14 : 0.7;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = boxMesh(x + sx * legOffsetX, y, z + sz * legOffsetZ, 0.1, 0.74, 0.1, matDarkWood);
          leg.rotation.y = rotY || 0;
        }
      }
      addSolidForGroup(x, y, z, 1.9, 0.9, 0.62, "console");
    }

    function addRoomLight(x, y, z, color, intensity) {
      roomLights.push([x, y, z, color, intensity]);
    }

    // Floor 1: foyer, living room, dining room, kitchen, stair hall.
    rug(-24.0, floorY[0], 20.0, 11.0, 9.0, 0x6b5c52);
    couch(-28.0, floorY[0], 23.5, Math.PI * 0.5, matBlueFabric);
    couch(-18.5, floorY[0], 21.2, -Math.PI * 0.5, matBlueFabric);
    coffeeTable(-23.3, floorY[0], 21.6, 0);
    tvScreen(-42.0 + 1.2, floorY[0], 21.6, Math.PI * 0.5, 7.4, 4.2);
    bookshelf(-39.2, floorY[0], 12.4, Math.PI * 0.5);
    lamp(-15.8, floorY[0], 24.8);
    plant(-38.5, floorY[0], 25.6);

    rug(-24.0, floorY[0], -18.5, 9.6, 8.0, 0x75624d);
    diningTable(-24.2, floorY[0], -17.8, 0);
    chair(-24.2, floorY[0], -20.1, 0);
    chair(-24.2, floorY[0], -15.5, Math.PI);
    chair(-26.3, floorY[0], -17.8, Math.PI * 0.5);
    chair(-22.1, floorY[0], -17.8, -Math.PI * 0.5);
    consoleTable(-37.5, floorY[0], -18.2, Math.PI * 0.5);
    plant(-15.0, floorY[0], -21.8);

    counter(20.0, floorY[0], -20.5, 0, 8.6, 1.1);
    counter(34.0, floorY[0], -16.0, Math.PI * 0.5, 7.2, 1.1);
    counter(26.0, floorY[0], -24.8, 0, 4.8, 1.1);
    coffeeTable(25.5, floorY[0], -14.0, 0);
    plant(39.0, floorY[0], -23.5);

    consoleTable(0, floorY[0], 18.8, 0);
    plant(8.8, floorY[0], 24.0);
    plant(-8.8, floorY[0], 24.0);
    crateStack(35.4, floorY[0], 10.6, 3);
    bookshelf(38.4, floorY[0], 1.5, -Math.PI * 0.5);

    // Floor 2: bedrooms and lounge.
    rug(-24.0, floorY[1], 20.5, 10.5, 8.0, 0x56606f);
    bed(-28.5, floorY[1], 22.0, Math.PI * 0.5);
    dresser(-15.8, floorY[1], 22.8, -Math.PI * 0.5);
    lamp(-16.0, floorY[1], 16.0);
    plant(-38.2, floorY[1], 24.8);

    rug(-24.0, floorY[1], -18.0, 9.4, 8.2, 0x6e5e64);
    bed(-28.0, floorY[1], -18.0, Math.PI * 0.5);
    desk(-17.0, floorY[1], -17.0, -Math.PI * 0.5);
    chair(-19.0, floorY[1], -17.0, Math.PI * 0.5);
    bookshelf(-38.0, floorY[1], -18.0, Math.PI * 0.5);

    rug(24.0, floorY[1], 20.5, 10.2, 8.0, 0x587163);
    couch(22.0, floorY[1], 23.5, Math.PI, matGreenFabric);
    coffeeTable(22.0, floorY[1], 19.2, 0);
    tvScreen(42.0 - 1.2, floorY[1], 20.2, -Math.PI * 0.5, 6.8, 4.0);
    lamp(33.6, floorY[1], 24.6);

    rug(23.0, floorY[1], -18.0, 9.2, 8.0, 0x625b54);
    desk(24.0, floorY[1], -18.0, 0);
    chair(24.0, floorY[1], -15.9, Math.PI);
    bookshelf(38.2, floorY[1], -18.0, -Math.PI * 0.5);
    crateStack(15.2, floorY[1], -22.2, 2);

    // Floor 3: attic lounge, workshop, storage.
    rug(-24.0, floorY[2], 18.5, 9.6, 7.6, 0x5d5c68);
    couch(-24.0, floorY[2], 21.8, Math.PI, matBlueFabric);
    coffeeTable(-24.0, floorY[2], 17.8, 0);
    bookshelf(-38.0, floorY[2], 18.0, Math.PI * 0.5);
    lamp(-15.8, floorY[2], 22.4);

    rug(-24.0, floorY[2], -18.0, 8.8, 7.6, 0x65584d);
    desk(-24.5, floorY[2], -18.0, 0);
    chair(-24.5, floorY[2], -15.8, Math.PI);
    crateStack(-36.5, floorY[2], -18.0, 4);
    plant(-14.8, floorY[2], -22.2);

    rug(24.0, floorY[2], -18.0, 9.2, 8.4, 0x505861);
    crateStack(20.0, floorY[2], -18.5, 5);
    crateStack(29.0, floorY[2], -16.5, 4);
    bookshelf(38.2, floorY[2], -18.0, -Math.PI * 0.5);
    dresser(16.5, floorY[2], -22.8, 0);

    addRoomLight(-24, floorY[0] + 3.8, 20, 0xffddb3, 0.32);
    addRoomLight(-24, floorY[0] + 3.4, -18, 0xffddb8, 0.24);
    addRoomLight(24, floorY[0] + 3.7, -18, 0xffe4bb, 0.28);
    addRoomLight(24, floorY[0] + 3.8, 6, 0xffddb3, 0.18);

    addRoomLight(-24, floorY[1] + 3.7, 21, 0xffefcf, 0.22);
    addRoomLight(-24, floorY[1] + 3.5, -18, 0xffe2c4, 0.20);
    addRoomLight(24, floorY[1] + 3.7, 20, 0xe7ffd4, 0.22);
    addRoomLight(24, floorY[1] + 3.5, -18, 0xe7e1ff, 0.18);

    addRoomLight(-24, floorY[2] + 3.6, 18, 0xffeacc, 0.18);
    addRoomLight(-24, floorY[2] + 3.5, -18, 0xffddc4, 0.16);
    addRoomLight(24, floorY[2] + 3.4, -18, 0xdde6ff, 0.14);

    function addSpawn(x, z, story, w = 1.0) {
      spawnPoints.push({ x, z, story, w });
    }

    for (let s = 0; s < HOUSE.stories; s++) {
      addSpawn(0, 22, s, 1.3);
      addSpawn(0, 2, s, 1.4);
      addSpawn(0, -18, s, 1.2);
      addSpawn(-24, 20, s, 1.1);
      addSpawn(-24, -18, s, 1.1);
      addSpawn(24, 20, s, 1.0);
      addSpawn(24, -18, s, 1.0);
      addSpawn(32, 6, s, 0.8);
    }

    return { HOUSE, solids, ceilings, ramps, holes, bounds, floorY, spawnPoints, roomLights };
  }

  return { build };
})();
