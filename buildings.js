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
    const bounds = {
      minX: -halfW + 2.1,
      maxX: halfW - 2.1,
      minZ: -halfD + 2.1,
      maxZ: halfD - 2.1
    };

    const floorY = [];
    for (let s = 0; s < HOUSE.stories; s++) floorY[s] = s * HOUSE.floorHeight;

    tex.floorWood.repeat.set(9, 7);
    tex.carpet.repeat.set(9, 7);
    tex.ceiling.repeat.set(9, 7);

    const matFloor0 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.95, metalness: 0.02 });
    const matFloor1 = new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 1.0, metalness: 0.0 });
    const matFloor2 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.95, metalness: 0.02 });
    const matCeil = new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 0.95, metalness: 0.0 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0xdcd7cf, roughness: 0.96, metalness: 0.0 });
    const matTrim = new THREE.MeshStandardMaterial({ color: 0xb9b2a7, roughness: 0.92, metalness: 0.0 });
    const matStone = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.98, metalness: 0.0 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x72533a, roughness: 0.9, metalness: 0.02 });
    const matDarkWood = new THREE.MeshStandardMaterial({ color: 0x4d3624, roughness: 0.92, metalness: 0.01 });
    const matFabric = new THREE.MeshStandardMaterial({ color: 0x48586f, roughness: 0.97, metalness: 0.0 });
    const matLamp = new THREE.MeshStandardMaterial({ color: 0xe8d7a3, emissive: 0x261d10, emissiveIntensity: 0.35, roughness: 0.7 });

    function boxMesh(x, y, z, w, h, d, mat, cast = true, receive = true) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h * 0.5, z);
      m.castShadow = cast;
      m.receiveShadow = receive;
      scene.add(m);
      return m;
    }

    function cylMesh(x, y, z, rTop, rBottom, h, mat, cast = true, receive = true) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 16), mat);
      m.position.set(x, y + h * 0.5, z);
      m.castShadow = cast;
      m.receiveShadow = receive;
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

    function exteriorWallsForStory(baseY, hasEntry) {
      const entryW = 12.0;
      const sideW = (HOUSE.width - entryW) * 0.5;

      boxMesh(0, baseY, -halfD + HOUSE.wallT * 0.5, HOUSE.width, HOUSE.wallH, HOUSE.wallT, matWall);
      addAABB(solids, -halfW, baseY, -halfD, halfW, baseY + HOUSE.wallH, -halfD + HOUSE.wallT, "wallN");

      boxMesh(-halfW + HOUSE.wallT * 0.5, baseY, 0, HOUSE.wallT, HOUSE.wallH, HOUSE.depth, matWall);
      addAABB(solids, -halfW, baseY, -halfD, -halfW + HOUSE.wallT, baseY + HOUSE.wallH, halfD, "wallW");

      boxMesh(halfW - HOUSE.wallT * 0.5, baseY, 0, HOUSE.wallT, HOUSE.wallH, HOUSE.depth, matWall);
      addAABB(solids, halfW - HOUSE.wallT, baseY, -halfD, halfW, baseY + HOUSE.wallH, halfD, "wallE");

      if (hasEntry) {
        boxMesh(-(entryW * 0.5 + sideW * 0.5), baseY, halfD - HOUSE.wallT * 0.5, sideW, HOUSE.wallH, HOUSE.wallT, matWall);
        addAABB(solids, -(entryW * 0.5 + sideW), baseY, halfD - HOUSE.wallT, -(entryW * 0.5), baseY + HOUSE.wallH, halfD, "wallS_L");

        boxMesh((entryW * 0.5 + sideW * 0.5), baseY, halfD - HOUSE.wallT * 0.5, sideW, HOUSE.wallH, HOUSE.wallT, matWall);
        addAABB(solids, entryW * 0.5, baseY, halfD - HOUSE.wallT, entryW * 0.5 + sideW, baseY + HOUSE.wallH, halfD, "wallS_R");
      } else {
        boxMesh(0, baseY, halfD - HOUSE.wallT * 0.5, HOUSE.width, HOUSE.wallH, HOUSE.wallT, matWall);
        addAABB(solids, -halfW, baseY, halfD - HOUSE.wallT, halfW, baseY + HOUSE.wallH, halfD, "wallS");
      }
    }

    for (let s = 0; s < HOUSE.stories; s++) exteriorWallsForStory(floorY[s], s === 0);

    boxMesh(0, -0.3, halfD + 6, 30, 0.6, 10, matStone);

    function ceilingWithHole(y, hole) {
      addCeilAABB(ceilings, -halfW, y + 0.25, -halfD, halfW, y + 2.0, halfD, "ceiling");

      if (!hole) {
        const full = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.width, 1.0, HOUSE.depth), matCeil);
        full.position.set(0, y + 0.5, 0);
        full.receiveShadow = true;
        scene.add(full);
        return;
      }

      addHole(
        holes,
        hole.x - hole.w * 0.5,
        y + 0.15,
        hole.z - hole.d * 0.5,
        hole.x + hole.w * 0.5,
        y + 2.4,
        hole.z + hole.d * 0.5,
        "stair_hole"
      );

      const northDepth = Math.max(0.1, (hole.z - hole.d * 0.5) - (-halfD));
      const southDepth = Math.max(0.1, halfD - (hole.z + hole.d * 0.5));
      const westWidth = Math.max(0.1, (hole.x - hole.w * 0.5) - (-halfW));
      const eastWidth = Math.max(0.1, halfW - (hole.x + hole.w * 0.5));

      if (northDepth > 0.12) boxMesh(0, y, (-halfD + (hole.z - hole.d * 0.5)) * 0.5, HOUSE.width, 1.0, northDepth, matCeil, false, true);
      if (southDepth > 0.12) boxMesh(0, y, (halfD + (hole.z + hole.d * 0.5)) * 0.5, HOUSE.width, 1.0, southDepth, matCeil, false, true);
      if (westWidth > 0.12) boxMesh((-halfW + (hole.x - hole.w * 0.5)) * 0.5, y, hole.z, westWidth, 1.0, hole.d, matCeil, false, true);
      if (eastWidth > 0.12) boxMesh((halfW + (hole.x + hole.w * 0.5)) * 0.5, y, hole.z, eastWidth, 1.0, hole.d, matCeil, false, true);

      const frameThick = 0.25;
      boxMesh(hole.x, y, hole.z - hole.d * 0.5 - frameThick * 0.5, hole.w + 1.0, 0.22, frameThick, matTrim, false, true);
      boxMesh(hole.x, y, hole.z + hole.d * 0.5 + frameThick * 0.5, hole.w + 1.0, 0.22, frameThick, matTrim, false, true);
      boxMesh(hole.x - hole.w * 0.5 - frameThick * 0.5, y, hole.z, frameThick, 0.22, hole.d + 1.0, matTrim, false, true);
      boxMesh(hole.x + hole.w * 0.5 + frameThick * 0.5, y, hole.z, frameThick, 0.22, hole.d + 1.0, matTrim, false, true);
    }

    const stairA = { x: 10.5, z: 2.0, w: 8.2, d: 14.0 };
    const stairB = { x: 10.5, z: 2.0, w: 8.2, d: 14.0 };

    ceilingWithHole(HOUSE.wallH + floorY[0], stairA);
    ceilingWithHole(HOUSE.wallH + floorY[1], stairB);
    ceilingWithHole(HOUSE.wallH + floorY[2], null);

    function wallZ(x, y, zCenter, length, thickness, tag) {
      boxMesh(x, y, zCenter, thickness, HOUSE.wallH, length, matWall);
      addAABB(solids, x - thickness * 0.5, y, zCenter - length * 0.5, x + thickness * 0.5, y + HOUSE.wallH, zCenter + length * 0.5, tag);
    }

    function wallX(xCenter, y, z, length, thickness, tag) {
      boxMesh(xCenter, y, z, length, HOUSE.wallH, thickness, matWall);
      addAABB(solids, xCenter - length * 0.5, y, z - thickness * 0.5, xCenter + length * 0.5, y + HOUSE.wallH, z + thickness * 0.5, tag);
    }

    function wallZWithDoors(x, y, zCenter, totalLen, thickness, doors, tag) {
      const list = (doors || []).slice().sort((a, b) => a.z - b.z);
      const half = totalLen * 0.5;
      const start = zCenter - half;
      const end = zCenter + half;
      let cur = start;

      for (const d of list) {
        const a = Math.max(start, d.z - d.w * 0.5);
        const b = Math.min(end, d.z + d.w * 0.5);
        const lenA = a - cur;
        if (lenA > 0.8) wallZ(x, y, cur + lenA * 0.5, lenA, thickness, tag + "_seg");
        cur = Math.max(cur, b);
      }
      const lenB = end - cur;
      if (lenB > 0.8) wallZ(x, y, cur + lenB * 0.5, lenB, thickness, tag + "_seg");
    }

    function wallXWithDoors(xCenter, y, z, totalLen, thickness, doors, tag) {
      const list = (doors || []).slice().sort((a, b) => a.x - b.x);
      const half = totalLen * 0.5;
      const start = xCenter - half;
      const end = xCenter + half;
      let cur = start;

      for (const d of list) {
        const a = Math.max(start, d.x - d.w * 0.5);
        const b = Math.min(end, d.x + d.w * 0.5);
        const lenA = a - cur;
        if (lenA > 0.8) wallX(cur + lenA * 0.5, y, z, lenA, thickness, tag + "_seg");
        cur = Math.max(cur, b);
      }
      const lenB = end - cur;
      if (lenB > 0.8) wallX(cur + lenB * 0.5, y, z, lenB, thickness, tag + "_seg");
    }

    const t = HOUSE.wallT;
    const doorW = 4.6;
    const hallX0 = -4.6;
    const hallX1 = 4.6;
    const innerZ0 = -halfD + 3.2;
    const innerZ1 = halfD - 3.2;
    const innerZCenter = (innerZ0 + innerZ1) * 0.5;
    const innerZLen = innerZ1 - innerZ0;
    const westSplit1 = 12;
    const westSplit2 = -4;
    const eastSplit1 = 10;
    const eastSplit2 = -6;
    const eastMidX = 16;

    for (let s = 0; s < HOUSE.stories; s++) {
      const by = floorY[s];

      wallZWithDoors(hallX0, by, innerZCenter, innerZLen, t, [
        { z: 18, w: doorW },
        { z: 4, w: doorW },
        { z: -8, w: doorW },
        { z: -18, w: doorW },
      ], `hall_w_${s}`);

      wallZWithDoors(hallX1, by, innerZCenter, innerZLen, t, [
        { z: 18, w: doorW },
        { z: 6, w: doorW },
        { z: -14, w: doorW },
      ], `hall_e_${s}`);

      const westLen = hallX0 - (-halfW + t);
      wallXWithDoors((-halfW + t + hallX0) * 0.5, by, westSplit1, westLen, t, [{ x: -24, w: doorW }], `west_split1_${s}`);
      wallXWithDoors((-halfW + t + hallX0) * 0.5, by, westSplit2, westLen, t, [{ x: -24, w: doorW }], `west_split2_${s}`);

      const eastLen = (halfW - t) - hallX1;
      wallXWithDoors((hallX1 + halfW - t) * 0.5, by, eastSplit1, eastLen, t, [{ x: 24, w: doorW }], `east_split1_${s}`);
      wallXWithDoors((hallX1 + halfW - t) * 0.5, by, eastSplit2, eastLen, t, [{ x: 24, w: doorW }], `east_split2_${s}`);

      wallZWithDoors(eastMidX, by, 2, eastSplit1 - eastSplit2, t, [{ z: 2, w: doorW }], `east_mid_${s}`);
    }

    const doorMat = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.95 });
    const glassMat = new THREE.MeshStandardMaterial({
      map: tex.windowGlass,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2
    });

    function doorAt(x, y, z, rotY) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.0), doorMat);
      d.position.set(x, y + 3.0, z);
      d.rotation.y = rotY;
      d.material.side = THREE.DoubleSide;
      d.castShadow = true;
      d.receiveShadow = true;
      scene.add(d);
    }

    function windowAt(x, y, z, rotY) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.4), glassMat);
      w.position.set(x, y + 5.4, z);
      w.rotation.y = rotY;
      w.material.side = THREE.DoubleSide;
      scene.add(w);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.8, 0.2), matTrim);
      trim.position.set(x, y + 5.4, z + (Math.abs(rotY) < 0.01 ? -0.1 : (Math.abs(rotY - Math.PI) < 0.01 ? 0.1 : 0)));
      trim.rotation.y = rotY;
      trim.castShadow = true;
      trim.receiveShadow = true;
      scene.add(trim);
    }

    doorAt(0, 0, halfD - 0.9, Math.PI);

    for (let s = 0; s < HOUSE.stories; s++) {
      const by = s * HOUSE.floorHeight;
      windowAt(-halfW + 0.9, by, -12, Math.PI / 2);
      windowAt(-halfW + 0.9, by, 12, Math.PI / 2);
      windowAt(halfW - 0.9, by, -12, -Math.PI / 2);
      windowAt(halfW - 0.9, by, 12, -Math.PI / 2);
      windowAt(-10, by, -halfD + 0.9, 0);
      windowAt(10, by, -halfD + 0.9, 0);
      windowAt(-14, by, halfD - 0.9, Math.PI);
      windowAt(14, by, halfD - 0.9, Math.PI);
    }

    function makeStairRamp(cx, cz, fromStory, toStory, hole) {
      const yBase = floorY[fromStory];
      const yTop = floorY[toStory];
      const run = 12.4;
      const width = 6.2;
      const stepCount = 18;
      const rise = (yTop - yBase) / stepCount;
      const tread = run / stepCount;
      const stairMat = new THREE.MeshStandardMaterial({ color: 0x7a6f63, roughness: 0.9 });

      const zStart = cz + 4.9;
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

      const railHeight = yBase + 1.0;
      addAABB(solids, cx - width * 0.5 - 0.24, railHeight, zStart - run + 0.3, cx - width * 0.5 - 0.02, yTop + 0.9, zStart + 0.7, "railL");
      addAABB(solids, cx + width * 0.5 + 0.02, railHeight, zStart - run + 0.3, cx + width * 0.5 + 0.24, yTop + 0.9, zStart + 0.7, "railR");

      boxMesh(cx, yTop, zStart - run + 0.75, width + 1.4, 0.42, 5.6, matStone);

      if (hole) {
        addAABB(solids, hole.x - hole.w * 0.5, yBase, hole.z - hole.d * 0.5, hole.x - hole.w * 0.5 + 0.28, yBase + 1.0, hole.z + hole.d * 0.5, "holeRailW");
        addAABB(solids, hole.x + hole.w * 0.5 - 0.28, yBase, hole.z - hole.d * 0.5, hole.x + hole.w * 0.5, yBase + 1.0, hole.z + hole.d * 0.5, "holeRailE");
        addAABB(solids, hole.x - hole.w * 0.5 + 0.3, yBase, hole.z + hole.d * 0.5 - 0.28, hole.x + hole.w * 0.5 - 0.3, yBase + 1.0, hole.z + hole.d * 0.5, "holeRailS");
      }
    }

    makeStairRamp(stairA.x, stairA.z, 0, 1, stairA);
    makeStairRamp(stairB.x, stairB.z, 1, 2, stairB);

    function couch(x, y, z, rotY) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.75, 1.3), matFabric);
      base.position.set(0, 0.38, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.15, 0.22), matFabric);
      back.position.set(0, 0.78, -0.54);
      const armGeo = new THREE.BoxGeometry(0.22, 0.85, 1.25);
      const armL = new THREE.Mesh(armGeo, matFabric);
      armL.position.set(-1.44, 0.43, 0);
      const armR = armL.clone();
      armR.position.x = 1.44;
      const legs = [
        [-1.2, 0.1, -0.42], [1.2, 0.1, -0.42], [-1.2, 0.1, 0.42], [1.2, 0.1, 0.42]
      ];
      for (const part of [base, back, armL, armR]) {
        part.castShadow = true;
        part.receiveShadow = true;
        group.add(part);
      }
      for (const leg of legs) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), matDarkWood);
        m.position.set(leg[0], leg[1], leg[2]);
        m.castShadow = true;
        group.add(m);
      }
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
      const legPos = [[-0.78, 0.38, -0.44], [0.78, 0.38, -0.44], [-0.78, 0.38, 0.44], [0.78, 0.38, 0.44]];
      for (const p of legPos) {
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
      const screenGeo = new THREE.PlaneGeometry(8.2, 4.6);
      const screenMat = new THREE.MeshStandardMaterial({
        map: tex.tvScreen,
        emissive: new THREE.Color(0x202040),
        emissiveIntensity: 0.75,
        roughness: 0.35
      });
      const s = new THREE.Mesh(screenGeo, screenMat);
      s.position.set(x, y + 4.0, z);
      s.rotation.y = rotY;
      scene.add(s);
    }

    couch(-24, floorY[0], 24.1, Math.PI);
    table(-24, floorY[0], 18.2, 0);
    bookshelf(-37.0, floorY[0], 19.0, Math.PI * 0.5);
    counter(-28, floorY[0], -20.5, 0);
    lamp(-17.0, floorY[0], 22.0);

    bookshelf(-37.0, floorY[1], 16.0, Math.PI * 0.5);
    couch(24.0, floorY[1], 24.0, Math.PI);
    table(24.0, floorY[1], 18.4, 0);
    lamp(17.5, floorY[1], 22.0);

    couch(-24.0, floorY[2], -24.0, 0);
    table(-24.0, floorY[2], -18.2, 0);
    bookshelf(-37.0, floorY[2], -18.0, Math.PI * 0.5);
    lamp(-17.5, floorY[2], -22.0);

    tvScreen(-24.0, floorY[0], 12.55, 0);
    tvScreen(24.0, floorY[1], 10.55, 0);
    tvScreen(-24.0, floorY[2], -12.55, Math.PI);

    function addSpawn(x, z, story, w = 1.0) {
      spawnPoints.push({ x, z, story, w });
    }

    for (let s = 0; s < HOUSE.stories; s++) {
      addSpawn(0, 14, s, 1.5);
      addSpawn(0, 0, s, 1.5);
      addSpawn(0, -14, s, 1.5);
      addSpawn(-24, 20, s, 1.0);
      addSpawn(-24, 6, s, 1.0);
      addSpawn(-24, -18, s, 1.0);
      addSpawn(24, 20, s, 1.0);
      addSpawn(10, 6, s, 1.0);
      addSpawn(26, 2, s, 1.0);
      addSpawn(24, -18, s, 1.0);
    }

    return { HOUSE, solids, ceilings, ramps, holes, bounds, floorY, spawnPoints };
  }

  return { build };
})();
