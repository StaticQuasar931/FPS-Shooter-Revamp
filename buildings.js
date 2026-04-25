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
    const matFloor2 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.9, metalness: 0.02 });
    const matCeil = new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 0.95, metalness: 0.0 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0xd9d5cd, roughness: 0.96, metalness: 0.0 });
    const matTrim = new THREE.MeshStandardMaterial({ color: 0xb4ad9f, roughness: 0.88, metalness: 0.02 });
    const matStone = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.98, metalness: 0.0 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x76563b, roughness: 0.90, metalness: 0.02 });
    const matDarkWood = new THREE.MeshStandardMaterial({ color: 0x503725, roughness: 0.92, metalness: 0.01 });
    const matFabric = new THREE.MeshStandardMaterial({ color: 0x4b5a6d, roughness: 0.97, metalness: 0.0 });
    const matLamp = new THREE.MeshStandardMaterial({ color: 0xefddb1, emissive: 0x261d10, emissiveIntensity: 0.32, roughness: 0.72 });

    const hall = { minX: -5.2, maxX: 5.2, minZ: -halfD + 2.8, maxZ: halfD - 2.8 };
    const stair = { x: 17.5, z: 2.0, width: 8.4, depth: 14.0 };

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

      const frame = 0.24;
      boxMesh(hole.x, y, hole.z - hole.d * 0.5 - frame * 0.5, hole.w + 1.0, 0.22, frame, matTrim, false, true);
      boxMesh(hole.x, y, hole.z + hole.d * 0.5 + frame * 0.5, hole.w + 1.0, 0.22, frame, matTrim, false, true);
      boxMesh(hole.x - hole.w * 0.5 - frame * 0.5, y, hole.z, frame, 0.22, hole.d + 1.0, matTrim, false, true);
      boxMesh(hole.x + hole.w * 0.5 + frame * 0.5, y, hole.z, frame, 0.22, hole.d + 1.0, matTrim, false, true);
    }

    const stairHole = { x: stair.x, z: stair.z, w: stair.width + 1.4, d: stair.depth + 1.2 };
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
        { min: 16, max: 21 },
        { min: -3, max: 2 },
        { min: -19, max: -14 }
      ], `hallLeft_${story}`);

      splitWallZ(hall.maxX, by, hall.minZ, hall.maxZ, [
        { min: 15, max: 20 },
        { min: -3, max: 2 },
        { min: -17, max: -12 }
      ], `hallRight_${story}`);

      splitWallX(by, 12, -halfW + t, hall.minX, [{ min: -27, max: -22 }], `westSouth_${story}`);
      splitWallX(by, -6, -halfW + t, hall.minX, [{ min: -27, max: -22 }], `westNorth_${story}`);

      splitWallX(by, 10, hall.maxX, halfW - t, [{ min: 24, max: 29 }], `eastSouth_${story}`);
      splitWallX(by, -7, hall.maxX, halfW - t, [{ min: 24, max: 29 }], `eastNorth_${story}`);

      splitWallZ(26, by, -7, 10, [{ min: 0, max: 5 }], `eastMid_${story}`);

      // Stairwell enclosure with clear hall access.
      splitWallZ(12.7, by, -5.5, 9.5, [{ min: -1.6, max: 3.1 }], `stairWest_${story}`);
      splitWallZ(22.3, by, -5.5, 9.5, [{ min: 2.4, max: 7.0 }], `stairEast_${story}`);
      splitWallX(by, -5.5, 12.7, 22.3, [{ min: 16.0, max: 19.0 }], `stairNorth_${story}`);
      if (story !== 0) splitWallX(by, 9.5, 12.7, 22.3, [{ min: 16.0, max: 19.0 }], `stairSouth_${story}`);
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
      windowAt(-halfW + 0.9, by, -16, Math.PI * 0.5);
      windowAt(-halfW + 0.9, by, 16, Math.PI * 0.5);
      windowAt(halfW - 0.9, by, -16, -Math.PI * 0.5);
      windowAt(halfW - 0.9, by, 16, -Math.PI * 0.5);
      windowAt(-14, by, -halfD + 0.9, 0);
      windowAt(14, by, -halfD + 0.9, 0);
      windowAt(-14, by, halfD - 0.9, Math.PI);
      windowAt(14, by, halfD - 0.9, Math.PI);
    }

    function makeStairRamp(cx, cz, fromStory, toStory) {
      const yBase = floorY[fromStory];
      const yTop = floorY[toStory];
      const run = 12.2;
      const width = 5.8;
      const stepCount = 18;
      const rise = (yTop - yBase) / stepCount;
      const tread = run / stepCount;
      const stairMat = new THREE.MeshStandardMaterial({ color: 0x7a6f63, roughness: 0.88 });

      const zStart = cz + 4.8;
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

      const railBase = yBase + 1.0;
      addAABB(solids, cx - width * 0.5 - 0.24, railBase, zStart - run + 0.5, cx - width * 0.5 - 0.04, yTop + 0.85, zStart + 0.8, "stairRailL");
      addAABB(solids, cx + width * 0.5 + 0.04, railBase, zStart - run + 0.5, cx + width * 0.5 + 0.24, yTop + 0.85, zStart + 0.8, "stairRailR");
      boxMesh(cx, yTop, zStart - run + 0.75, width + 1.2, 0.40, 5.0, matStone);
    }

    makeStairRamp(stair.x, stair.z, 0, 1);
    makeStairRamp(stair.x, stair.z, 1, 2);

    function couch(x, y, z, rotY) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.75, 1.3), matFabric);
      base.position.set(0, 0.38, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.15, 0.22), matFabric);
      back.position.set(0, 0.78, -0.54);
      const armGeo = new THREE.BoxGeometry(0.22, 0.85, 1.25);
      const armL = new THREE.Mesh(armGeo, matFabric);
      const armR = new THREE.Mesh(armGeo, matFabric);
      armL.position.set(-1.44, 0.43, 0);
      armR.position.set(1.44, 0.43, 0);
      group.add(base, back, armL, armR);
      for (const p of [[-1.2, 0.1, -0.42], [1.2, 0.1, -0.42], [-1.2, 0.1, 0.42], [1.2, 0.1, 0.42]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), matDarkWood);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addAABB(solids, x - 1.65, y, z - 0.82, x + 1.65, y + 1.2, z + 0.82, "couch");
    }

    function table(x, y, z, rotY) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 1.25), matWood);
      top.position.set(0, 0.84, 0);
      group.add(top);
      for (const p of [[-0.78, 0.38, -0.44], [0.78, 0.38, -0.44], [-0.78, 0.38, 0.44], [0.78, 0.38, 0.44]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.16), matDarkWood);
        leg.position.set(p[0], p[1], p[2]);
        group.add(leg);
      }
      group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      scene.add(group);
      addAABB(solids, x - 1.0, y, z - 0.65, x + 1.0, y + 0.95, z + 0.65, "table");
    }

    function counter(x, y, z, rotY) {
      const body = boxMesh(x, y, z, 3.8, 1.15, 1.2, matDarkWood);
      body.rotation.y = rotY || 0;
      boxMesh(x, y + 1.02, z, 3.9, 0.12, 1.28, matWood);
      addAABB(solids, x - 1.95, y, z - 0.72, x + 1.95, y + 1.25, z + 0.72, "counter");
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
      addAABB(solids, x - 0.80, y, z - 0.36, x + 0.80, y + 2.45, z + 0.36, "bookshelf");
    }

    function lamp(x, y, z) {
      cylMesh(x, y, z, 0.12, 0.16, 1.7, matDarkWood);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.28, 0.42, 16, 1, true), matLamp);
      shade.position.set(x, y + 1.75, z);
      shade.castShadow = true;
      shade.receiveShadow = true;
      scene.add(shade);
      cylMesh(x, y, z, 0.34, 0.38, 0.08, matDarkWood);
      addAABB(solids, x - 0.38, y, z - 0.38, x + 0.38, y + 1.9, z + 0.38, "lamp");
    }

    function tvScreen(x, y, z, rotY) {
      const mat = new THREE.MeshStandardMaterial({
        map: tex.tvScreen,
        emissive: new THREE.Color(0x202040),
        emissiveIntensity: 0.72,
        roughness: 0.35,
        side: THREE.DoubleSide
      });
      planeMesh(8.2, 4.6, x, y + 4.0, z, rotY, mat);
    }

    // Floor 1: foyer, living room, dining room, kitchen, stair hall.
    couch(-24.0, floorY[0], 23.8, Math.PI);
    table(-24.0, floorY[0], 18.0, 0);
    bookshelf(-37.0, floorY[0], 19.0, Math.PI * 0.5);
    lamp(-17.2, floorY[0], 22.2);
    tvScreen(-24.0, floorY[0], 12.55, 0);
    counter(-30.0, floorY[0], -19.5, 0);
    table(-24.0, floorY[0], -20.0, 0);
    bookshelf(38.0, floorY[0], -18.0, -Math.PI * 0.5);

    // Floor 2: family room west, bedroom south-east, office north-east.
    couch(-24.0, floorY[1], 23.8, Math.PI);
    table(-24.0, floorY[1], 18.0, 0);
    tvScreen(-24.0, floorY[1], 12.55, 0);
    bookshelf(-37.0, floorY[1], 18.0, Math.PI * 0.5);
    couch(24.0, floorY[1], 23.8, Math.PI);
    table(24.0, floorY[1], 18.0, 0);
    lamp(17.5, floorY[1], 22.0);
    bookshelf(38.0, floorY[1], -18.0, -Math.PI * 0.5);

    // Floor 3: attic lounge west, study north-east.
    couch(-24.0, floorY[2], -23.8, 0);
    table(-24.0, floorY[2], -18.0, 0);
    tvScreen(-24.0, floorY[2], -12.55, Math.PI);
    bookshelf(-37.0, floorY[2], -18.0, Math.PI * 0.5);
    lamp(-17.5, floorY[2], -22.0);
    bookshelf(38.0, floorY[2], -18.0, -Math.PI * 0.5);
    table(24.0, floorY[2], -18.0, 0);

    function addSpawn(x, z, story, w = 1.0) {
      spawnPoints.push({ x, z, story, w });
    }

    for (let s = 0; s < HOUSE.stories; s++) {
      addSpawn(0, 20, s, 1.4);
      addSpawn(0, 2, s, 1.4);
      addSpawn(0, -18, s, 1.4);

      addSpawn(-24, 22, s, 1.1);
      addSpawn(-24, -18, s, 1.1);

      addSpawn(24, 22, s, 1.1);
      addSpawn(24, -18, s, 1.1);

      addSpawn(33, 0, s, 0.9);
    }

    return { HOUSE, solids, ceilings, ramps, holes, bounds, floorY, spawnPoints };
  }

  return { build };
})();
