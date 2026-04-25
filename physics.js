window.Physics = (() => {
  "use strict";

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function aabbOverlapY(feetY, height, boxMinY, boxMaxY) {
    const pMin = feetY;
    const pMax = feetY + height;
    return !(pMax <= boxMinY || pMin >= boxMaxY);
  }

  function cylinderResolveXZ(feetPos, radius, height, aabb) {
    if (!aabbOverlapY(feetPos.y, height, aabb.min.y, aabb.max.y)) return null;

    const cx = clamp(feetPos.x, aabb.min.x, aabb.max.x);
    const cz = clamp(feetPos.z, aabb.min.z, aabb.max.z);
    const dx = feetPos.x - cx;
    const dz = feetPos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) return null;

    const d = Math.sqrt(d2) || 0.0001;
    const push = radius - d;
    return { nx: dx / d, nz: dz / d, push };
  }

  function resolveSolids(feetPos, radius, height, solids, passes) {
    const iters = passes || 3;
    if (!solids || !solids.length) return;
    for (let p = 0; p < iters; p++) {
      let moved = false;
      for (const s of solids) {
        const hit = cylinderResolveXZ(feetPos, radius, height, s);
        if (!hit) continue;
        feetPos.x += hit.nx * hit.push;
        feetPos.z += hit.nz * hit.push;
        moved = true;
      }
      if (!moved) break;
    }
  }

  function pointInBox(p, box) {
    return p.x >= box.min.x && p.x <= box.max.x &&
           p.y >= box.min.y && p.y <= box.max.y &&
           p.z >= box.min.z && p.z <= box.max.z;
  }

  function sampleRampHeight(x, z, ramps) {
    if (!ramps || !ramps.length) return null;

    for (const r of ramps) {
      const ax = r.ax, az = r.az, bx = r.bx, bz = r.bz;
      const abx = bx - ax, abz = bz - az;
      const apx = x - ax, apz = z - az;
      const denom = (abx * abx + abz * abz) || 1e-6;
      const t = clamp((apx * abx + apz * abz) / denom, 0, 1);

      const cx = ax + abx * t;
      const cz = az + abz * t;
      const dx = x - cx;
      const dz = z - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= r.width * 0.5) {
        return r.y0 + (r.y1 - r.y0) * t;
      }
    }
    return null;
  }

  function resolveCeilings(feetPos, radius, height, ceilings, holes) {
    if (!ceilings || !ceilings.length) return;

    const headY = feetPos.y + height;
    const headP = { x: feetPos.x, y: headY, z: feetPos.z };

    if (holes && holes.length) {
      for (const h of holes) {
        if (
          headP.x >= h.min.x - radius && headP.x <= h.max.x + radius &&
          headP.y >= h.min.y && headP.y <= h.max.y &&
          headP.z >= h.min.z - radius && headP.z <= h.max.z + radius
        ) return;
      }
    }

    for (const c of ceilings) {
      if (feetPos.x < c.min.x || feetPos.x > c.max.x || feetPos.z < c.min.z || feetPos.z > c.max.z) continue;
      if (headY > c.min.y && headY < c.max.y) {
        const targetFeetY = c.min.y - height - 0.001;
        if (feetPos.y > targetFeetY) feetPos.y = targetFeetY;
      }
    }
  }

  function rayHitAABB(origin, dir, boxMin, boxMax) {
    let tmin = -Infinity;
    let tmax = Infinity;

    const axes = ["x", "y", "z"];
    for (const ax of axes) {
      const d = dir[ax];
      const o = origin[ax];

      if (Math.abs(d) < 1e-9) {
        if (o < boxMin[ax] || o > boxMax[ax]) return null;
        continue;
      }

      const inv = 1 / d;
      let t1 = (boxMin[ax] - o) * inv;
      let t2 = (boxMax[ax] - o) * inv;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmax < tmin) return null;
    }

    if (tmax < 0) return null;
    return Math.max(0, tmin);
  }

  function raycastAABBs(origin, dir, aabbs, maxDist) {
    if (!aabbs || !aabbs.length) return null;
    const md = (typeof maxDist === "number") ? maxDist : Infinity;

    let bestT = null;
    let bestBox = null;

    for (const b of aabbs) {
      const t = rayHitAABB(origin, dir, b.min, b.max);
      if (t === null) continue;
      if (t > md) continue;
      if (bestT === null || t < bestT) { bestT = t; bestBox = b; }
    }

    if (bestT === null) return null;
    return { t: bestT, box: bestBox };
  }

  return {
    clamp,
    resolveSolids,
    resolveCeilings,
    sampleRampHeight,
    pointInBox,
    rayHitAABB,
    raycastAABBs,
  };
})();
 /* physics.js */
