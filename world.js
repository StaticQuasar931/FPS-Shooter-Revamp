window.World = (() => {
  "use strict";

  function create(scene, tex) {
    scene.background = new THREE.Color(0x05060a);

    const hemi = new THREE.HemisphereLight(0xd7eeff, 0x14141c, 0.50);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xbfd4ff, 0.72);
    dir.position.set(35, 70, 25);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    dir.shadow.camera.near = 10;
    dir.shadow.camera.far = 180;
    dir.shadow.camera.left = -70;
    dir.shadow.camera.right = 70;
    dir.shadow.camera.top = 70;
    dir.shadow.camera.bottom = -70;
    scene.add(dir);

    const moonFill = new THREE.DirectionalLight(0x7da7ff, 0.18);
    moonFill.position.set(-18, 24, -12);
    scene.add(moonFill);

    const skyGeo = new THREE.SphereGeometry(320, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    const b = Buildings.build(scene, tex);

    for (const [x, y, z, color, intensity] of (b.roomLights || [])) {
      const point = new THREE.PointLight(color, intensity, 18, 2);
      point.position.set(x, y, z);
      scene.add(point);
    }

    function getGroundY(x, feetY, z) {
      const story = Math.max(0, Math.min(b.HOUSE.stories - 1, Math.floor((feetY + 1.0) / b.HOUSE.floorHeight)));
      let y = b.floorY[story] + 0.02;

      const ry = Physics.sampleRampHeight(x, z, b.ramps);
      if (ry !== null) y = Math.max(y, ry + 0.02);

      return y;
    }

    function sampleFloorY(x, z) {
      return getGroundY(x, 0.02, z);
    }

    function clampToBounds(p) {
      p.x = Math.max(b.bounds.minX, Math.min(b.bounds.maxX, p.x));
      p.z = Math.max(b.bounds.minZ, Math.min(b.bounds.maxZ, p.z));
    }

    return {
      bounds: b.bounds,
      BOUNDS: b.bounds,
      solids: b.solids,
      ceilings: b.ceilings,
      ramps: b.ramps,
      holes: b.holes,
      floorY: b.floorY,
      spawnPoints: b.spawnPoints || [],
      HOUSE: b.HOUSE,

      getGroundY,
      sampleFloorY,
      clampToBounds
    };
  }

  return { create };
})();
