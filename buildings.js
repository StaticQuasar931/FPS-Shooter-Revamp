window.Buildings = (() => {
  "use strict";

  const SOLID_SHRINK = 0.08;

  function v3(x,y,z){ return new THREE.Vector3(x,y,z); }

  function addAABB(solids, minX,minY,minZ, maxX,maxY,maxZ, tag="") {
    solids.push({
      min: v3(minX + SOLID_SHRINK, minY, minZ + SOLID_SHRINK),
      max: v3(maxX - SOLID_SHRINK, maxY, maxZ - SOLID_SHRINK),
      tag
    });
  }

  function addCeilAABB(ceilings, minX,minY,minZ, maxX,maxY,maxZ, tag="") {
    ceilings.push({ min: v3(minX,minY,minZ), max: v3(maxX,maxY,maxZ), tag });
  }

  function addHole(holes, minX,minY,minZ, maxX,maxY,maxZ, tag="") {
    holes.push({ min: v3(minX,minY,minZ), max: v3(maxX,maxY,maxZ), tag });
  }

  function addRamp(ramps, ax,az, bx,bz, y0,y1, width, tag="") {
    ramps.push({ ax,az, bx,bz, y0,y1, width, tag });
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
      maxX:  halfW - 2.1,
      minZ: -halfD + 2.1,
      maxZ:  halfD - 2.1
    };

    const floorY = [];
    for (let s=0; s<HOUSE.stories; s++) floorY[s] = s * HOUSE.floorHeight;

    tex.floorWood.repeat.set(9, 7);
    tex.carpet.repeat.set(9, 7);
    tex.ceiling.repeat.set(9, 7);

    const matFloor0 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.95, metalness: 0.02 });
    const matFloor1 = new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 1.00, metalness: 0.00 });
    const matFloor2 = new THREE.MeshStandardMaterial({ map: tex.floorWood, roughness: 0.95, metalness: 0.02 });

    const matCeil = new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 0.95, metalness: 0.0 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0xdcd7cf, roughness: 0.96, metalness: 0.0 });
    const matTrim = new THREE.MeshStandardMaterial({ color: 0xb9b2a7, roughness: 0.92, metalness: 0.0 });
    const matStone= new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.98, metalness: 0.0 });

    function boxMesh(x,y,z,w,h,d,mat, cast=true, recv=true) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
      m.position.set(x, y + h*0.5, z);
      m.castShadow = cast;
      m.receiveShadow = recv;
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

      boxMesh(0, baseY, -halfD + HOUSE.wallT*0.5, HOUSE.width, HOUSE.wallH, HOUSE.wallT, matWall);
      addAABB(solids, -halfW, baseY, -halfD, halfW, baseY + HOUSE.wallH, -halfD + HOUSE.wallT, "wallN");

      boxMesh(-halfW + HOUSE.wallT*0.5, baseY, 0, HOUSE.wallT, HOUSE.wallH, HOUSE.depth, matWall);
      addAABB(solids, -halfW, baseY, -halfD, -halfW + HOUSE.wallT, baseY + HOUSE.wallH, halfD, "wallW");

      boxMesh( halfW - HOUSE.wallT*0.5, baseY, 0, HOUSE.wallT, HOUSE.wallH, HOUSE.depth, matWall);
      addAABB(solids,  halfW - HOUSE.wallT, baseY, -halfD, halfW, baseY + HOUSE.wallH, halfD, "wallE");

      if (hasEntry) {
        boxMesh(-(entryW*0.5 + sideW*0.5), baseY, halfD - HOUSE.wallT*0.5, sideW, HOUSE.wallH, HOUSE.wallT, matWall);
        addAABB(solids, -(entryW*0.5 + sideW), baseY, halfD - HOUSE.wallT, -(entryW*0.5), baseY + HOUSE.wallH, halfD, "wallS_L");

        boxMesh( (entryW*0.5 + sideW*0.5), baseY, halfD - HOUSE.wallT*0.5, sideW, HOUSE.wallH, HOUSE.wallT, matWall);
        addAABB(solids, (entryW*0.5), baseY, halfD - HOUSE.wallT, (entryW*0.5 + sideW), baseY + HOUSE.wallH, halfD, "wallS_R");
      } else {
        boxMesh(0, baseY, halfD - HOUSE.wallT*0.5, HOUSE.width, HOUSE.wallH, HOUSE.wallT, matWall);
        addAABB(solids, -halfW, baseY, halfD - HOUSE.wallT, halfW, baseY + HOUSE.wallH, halfD, "wallS");
      }
    }

    for (let s=0; s<HOUSE.stories; s++) exteriorWallsForStory(floorY[s], s === 0);

    boxMesh(0, -0.3, halfD + 6, 30, 0.6, 10, matStone);

    function ceilingSlab(y, hole) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.width, 1.0, HOUSE.depth), matCeil);
      m.position.set(0, y + 0.5, 0);
      m.receiveShadow = true;
      scene.add(m);

      addCeilAABB(ceilings, -halfW, y + 0.25, -halfD, halfW, y + 2.0, halfD, "ceiling");

      if (hole) {
        addHole(holes,
          hole.x - hole.w*0.5, y + 0.2, hole.z - hole.d*0.5,
          hole.x + hole.w*0.5, y + 2.2, hole.z + hole.d*0.5,
          "stair_hole"
        );

        const frame = new THREE.Mesh(new THREE.BoxGeometry(hole.w + 1.2, 0.3, hole.d + 1.2), matTrim);
        frame.position.set(hole.x, y + 0.25, hole.z);
        scene.add(frame);
      }
    }

    const stairA = { x: 11, z: 6, w: 12, d: 10 };
    const stairB = { x: -11, z: -8, w: 12, d: 10 };

    ceilingSlab(HOUSE.wallH + floorY[0], stairA);
    ceilingSlab(HOUSE.wallH + floorY[1], stairB);
    ceilingSlab(HOUSE.wallH + floorY[2], null);

    function wallZ(x, y, zCenter, length, thickness, tag) {
      boxMesh(x, y, zCenter, thickness, HOUSE.wallH, length, matWall);
      addAABB(solids, x - thickness*0.5, y, zCenter - length*0.5, x + thickness*0.5, y + HOUSE.wallH, zCenter + length*0.5, tag);
    }

    function wallX(xCenter, y, z, length, thickness, tag) {
      boxMesh(xCenter, y, z, length, HOUSE.wallH, thickness, matWall);
      addAABB(solids, xCenter - length*0.5, y, z - thickness*0.5, xCenter + length*0.5, y + HOUSE.wallH, z + thickness*0.5, tag);
    }

    function wallZWithDoor(x, y, zCenter, totalLen, thickness, doorZ, doorWidth, tag) {
      const half = totalLen * 0.5;
      const leftEnd = doorZ - doorWidth*0.5;
      const rightStart = doorZ + doorWidth*0.5;

      const lenA = leftEnd - (zCenter - half);
      const lenB = (zCenter + half) - rightStart;

      if (lenA > 0.8) wallZ(x, y, (zCenter - half) + lenA*0.5, lenA, thickness, tag+"_A");
      if (lenB > 0.8) wallZ(x, y, rightStart + lenB*0.5, lenB, thickness, tag+"_B");
    }

    function wallXWithDoor(xCenter, y, z, totalLen, thickness, doorX, doorWidth, tag) {
      const half = totalLen * 0.5;
      const leftEnd = doorX - doorWidth*0.5;
      const rightStart = doorX + doorWidth*0.5;

      const lenA = leftEnd - (xCenter - half);
      const lenB = (xCenter + half) - rightStart;

      if (lenA > 0.8) wallX((xCenter - half) + lenA*0.5, y, z, lenA, thickness, tag+"_A");
      if (lenB > 0.8) wallX(rightStart + lenB*0.5, y, z, lenB, thickness, tag+"_B");
    }

    function wallZWithDoors(x, y, zCenter, totalLen, thickness, doors, tag) {
      const list = (doors || []).slice().sort((a,b) => a.z - b.z);
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
      const list = (doors || []).slice().sort((a,b) => a.x - b.x);
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

    // Interior layout: a real central hall with room splits.
    // Goal: never snag on corners, and every room stays reachable.
    const t = HOUSE.wallT;
    const doorW = 4.4;

    const hallX0 = -4.6;
    const hallX1 = 4.6;
    const innerZ0 = -halfD + 3.2;
    const innerZ1 = halfD - 3.2;
    const innerZCenter = (innerZ0 + innerZ1) * 0.5;
    const innerZLen = (innerZ1 - innerZ0);

    const westSplit1 = 12;
    const westSplit2 = -4;

    const eastSplit1 = 10;
    const eastSplit2 = -6;
    const eastMidX = 16;

    for (let s = 0; s < HOUSE.stories; s++) {
      const by = floorY[s];

      // Hall divider walls with multiple door openings.
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

      // West side splits (front/mid/back)
      {
        const x0 = -halfW + t;
        const x1 = hallX0;
        const xC = (x0 + x1) * 0.5;
        const len = (x1 - x0);
        wallXWithDoors(xC, by, westSplit1, len, t, [{ x: -24, w: doorW }], `west_split1_${s}`);
        wallXWithDoors(xC, by, westSplit2, len, t, [{ x: -24, w: doorW }], `west_split2_${s}`);
      }

      // East side splits (front/mid/back)
      {
        const x0 = hallX1;
        const x1 = halfW - t;
        const xC = (x0 + x1) * 0.5;
        const len = (x1 - x0);
        wallXWithDoors(xC, by, eastSplit1, len, t, [{ x: 24, w: doorW }], `east_split1_${s}`);
        wallXWithDoors(xC, by, eastSplit2, len, t, [{ x: 24, w: doorW }], `east_split2_${s}`);
      }

      // East mid partition: stair room (near hall) vs bathroom (near outer wall)
      wallZWithDoors(eastMidX, by, 2, (eastSplit1 - eastSplit2), t, [{ z: 2, w: doorW }], `east_mid_${s}`);
    }

    const doorMat = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.95 });
    const glassMat = new THREE.MeshStandardMaterial({
      map: tex.windowGlass, transparent: true, opacity: 0.7, roughness: 0.2
    });

    function doorAt(x, y, z, rotY) {
      const w = 3.0;
      const h = 6.0;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), doorMat);
      d.position.set(x, y + h*0.5, z);
      d.rotation.y = rotY;
      d.material.side = THREE.DoubleSide;
      d.castShadow = true;
      d.receiveShadow = true;
      scene.add(d);
    }

    function windowAt(x,y,z,rotY){
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

    for (let s=0; s<3; s++){
      const by = s * HOUSE.floorHeight;
      windowAt(-halfW + 0.9, by, -12, Math.PI/2);
      windowAt(-halfW + 0.9, by, 12, Math.PI/2);
      windowAt( halfW - 0.9, by, -12, -Math.PI/2);
      windowAt( halfW - 0.9, by, 12, -Math.PI/2);
      windowAt(-10, by, -halfD + 0.9, 0);
      windowAt( 10, by, -halfD + 0.9, 0);

      // South-side windows (skip center so the front door area stays clear)
      windowAt(-14, by, halfD - 0.9, Math.PI);
      windowAt( 14, by, halfD - 0.9, Math.PI);
    }

    function makeStairRamp(cx, cz, fromStory, toStory, hole) {
      const yBase = floorY[fromStory];
      const yTop = floorY[toStory];

      const run = 14.0;
      const width = 6.4;

      const stepCount = 18;
      const rise = (yTop - yBase) / stepCount;
      const tread = run / stepCount;

      const stairMat = new THREE.MeshStandardMaterial({ color: 0x7a6f63, roughness: 0.9 });

      const zStart = cz + 3.2;
      for (let i = 0; i < stepCount; i++) {
        const h = Math.max(0.10, rise * 0.95);
        const y = yBase + i*rise;
        const z = zStart - i * tread;

        const step = new THREE.Mesh(new THREE.BoxGeometry(width, h, tread * 0.98), stairMat);
        step.position.set(cx, y + h*0.5, z - tread*0.5);
        step.castShadow = true;
        step.receiveShadow = true;
        scene.add(step);
      }

      addRamp(ramps,
        cx, zStart,
        cx, zStart - run,
        yBase + 0.02,
        yTop + 0.02,
        width,
        `ramp_${fromStory}_${toStory}`
      );

      addAABB(solids, cx - width*0.5 - 0.38, yBase, zStart - run + 0.6, cx - width*0.5 - 0.12, yTop + 1.4, zStart + 0.9, "railL");
      addAABB(solids, cx + width*0.5 + 0.12, yBase, zStart - run + 0.6, cx + width*0.5 + 0.38, yTop + 1.4, zStart + 0.9, "railR");

      boxMesh(cx, yTop, zStart - run + 0.3, width + 2.2, 0.6, 4.2, matStone);

      // Rails around the ceiling hole (waist height) so it doesn't feel like a broken ceiling,
      // but never block the actual opening.
      if (hole) {
        const railH0 = yBase;
        const railH1 = yBase + 1.2;
        const rT = 0.35;
        const pad = 0.2;

        addAABB(solids,
          hole.x - hole.w*0.5 + pad, railH0,
          hole.z - hole.d*0.5,
          hole.x + hole.w*0.5 - pad, railH1,
          hole.z - hole.d*0.5 + rT,
          "holeRailN"
        );
        addAABB(solids,
          hole.x - hole.w*0.5 + pad, railH0,
          hole.z + hole.d*0.5 - rT,
          hole.x + hole.w*0.5 - pad, railH1,
          hole.z + hole.d*0.5,
          "holeRailS"
        );
        addAABB(solids,
          hole.x - hole.w*0.5, railH0,
          hole.z - hole.d*0.5 + pad,
          hole.x - hole.w*0.5 + rT, railH1,
          hole.z + hole.d*0.5 - pad,
          "holeRailW"
        );
        addAABB(solids,
          hole.x + hole.w*0.5 - rT, railH0,
          hole.z - hole.d*0.5 + pad,
          hole.x + hole.w*0.5, railH1,
          hole.z + hole.d*0.5 - pad,
          "holeRailE"
        );
      }
    }

    makeStairRamp(stairA.x, stairA.z, 0, 1, stairA);
    makeStairRamp(stairB.x, stairB.z, 1, 2, stairB);

    function propPlane(texKey, x, y, z, w, h, rotY, colW, colD, colH, tag) {
      const tTex = tex && tex[texKey];
      if (!tTex) return;

      const mat = new THREE.MeshStandardMaterial({
        map: tTex,
        transparent: true,
        opacity: 1,
        roughness: 0.95,
        metalness: 0.0,
        alphaTest: 0.15
      });
      mat.side = THREE.DoubleSide;

      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x, y + h * 0.5, z);
      p.rotation.y = rotY;
      p.castShadow = true;
      p.receiveShadow = true;
      scene.add(p);

      if (colW && colD && colH) {
        addAABB(solids, x - colW * 0.5, y, z - colD * 0.5, x + colW * 0.5, y + colH, z + colD * 0.5, tag || texKey);
      }
    }

    // Ground floor props (kept out of the hall and door lines)
    propPlane("propCouch", -26, 0, 18, 8.8, 4.0, Math.PI / 2, 9.5, 3.4, 2.2, "couch");
    propPlane("propTable", -22, 0, 6, 5.2, 3.3, 0, 5.0, 3.0, 1.2, "table");
    propPlane("propCounter", -28, 0, -18, 10.0, 5.0, 0, 14.0, 3.4, 3.0, "counter");
    propPlane("propBookshelf", 28, 0, 18, 6.8, 6.5, Math.PI, 6.0, 1.8, 6.0, "bookshelf");
    propPlane("propLamp", 24, 0, 8, 3.0, 6.0, -Math.PI / 2, 1.5, 1.5, 5.0, "lamp");

    // Second floor props
    propPlane("propBookshelf", -28, floorY[1], 16, 6.8, 6.5, Math.PI / 2, 6.0, 1.8, 6.0, "bookshelf2");
    propPlane("propTable", 24, floorY[1], -12, 5.2, 3.3, Math.PI, 5.0, 3.0, 1.2, "table2");

    // Third floor props
    propPlane("propLamp", -24, floorY[2], 10, 3.0, 6.0, Math.PI / 2, 1.5, 1.5, 5.0, "lamp3");

    // Decorative props as textured planes with simple AABB collisions.
    function propPlane(texKey, x, y, z, w, h, rotY, colW, colD, colH, tag) {
      const tTex = tex && tex[texKey];
      if (!tTex) return;

      const mat = new THREE.MeshStandardMaterial({
        map: tTex,
        transparent: true,
        opacity: 1,
        roughness: 0.95,
        metalness: 0.0,
        alphaTest: 0.15
      });
      mat.side = THREE.DoubleSide;

      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x, y + h * 0.5, z);
      p.rotation.y = rotY || 0;
      p.castShadow = true;
      p.receiveShadow = true;
      scene.add(p);

      if (colW && colD && colH) {
        addAABB(solids, x - colW*0.5, y, z - colD*0.5, x + colW*0.5, y + colH, z + colD*0.5, tag || texKey);
      }
    }

    // Ground floor props (placed away from doorways and the main hall)
    propPlane("propCouch", -26, 0, 18, 8.8, 4.0, Math.PI/2, 9.5, 3.4, 2.2, "couch");
    propPlane("propTable", -22, 0, 6, 5.2, 3.3, 0, 5.0, 3.0, 1.2, "table");
    propPlane("propCounter", -28, 0, -18, 10.0, 5.0, 0, 14.0, 3.4, 3.0, "counter");
    propPlane("propBookshelf", 28, 0, 18, 6.8, 6.5, Math.PI, 6.0, 1.8, 6.0, "bookshelf");
    propPlane("propLamp", 24, 0, 8, 3.0, 6.0, -Math.PI/2, 1.5, 1.5, 5.0, "lamp");

    // Upper floors props
    propPlane("propBookshelf", -28, floorY[1], 16, 6.8, 6.5, Math.PI/2, 6.0, 1.8, 6.0, "bookshelf2");
    propPlane("propTable", 24, floorY[1], -12, 5.2, 3.3, Math.PI, 5.0, 3.0, 1.2, "table2");
    propPlane("propLamp", -24, floorY[2], 10, 3.0, 6.0, Math.PI/2, 1.5, 1.5, 5.0, "lamp3");

    function tvScreen(x,y,z,rotY) {
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
    tvScreen(14, 0, 18, Math.PI);
    tvScreen(20, floorY[1], -20, Math.PI);

    // Room-based spawn points (zombies use these to avoid spawning inside walls).
    function addSpawn(x, z, story, w = 1.0) {
      spawnPoints.push({ x, z, story, w });
    }

    for (let s = 0; s < HOUSE.stories; s++) {
      // Hall
      addSpawn(0, 14, s, 1.5);
      addSpawn(0, 0, s, 1.5);
      addSpawn(0, -14, s, 1.5);

      // West rooms
      addSpawn(-24, 20, s, 1.0);
      addSpawn(-24, 6, s, 1.0);
      addSpawn(-24, -18, s, 1.0);

      // East rooms
      addSpawn(24, 20, s, 1.0);
      addSpawn(10, 6, s, 1.0);
      addSpawn(26, 2, s, 1.0);
      addSpawn(24, -18, s, 1.0);
    }

    return { HOUSE, solids, ceilings, ramps, holes, bounds, floorY, spawnPoints };
  }

  return { build };
})();
