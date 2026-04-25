(function () {
  "use strict";

  const PLAYER_RADIUS = 0.95;
  const PLAYER_HEIGHT = 3.2;
  const EYE_HEIGHT = 2.65;

  const GRAVITY = 22;
  const SPEED = 5.6;
  const SPRINT = 8.8;
  const JUMP = 9.2;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function make(scene, camera, domElement, world) {
    const lockEl = domElement || document.body;
    const controls = new THREE.PointerLockControls(camera, lockEl);
    const yawObject = controls.getObject ? controls.getObject() : null;
    const pitchObject = camera.parent || camera;

    const feet = new THREE.Vector3(0, 0.02, 0);
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.position.set(feet.x, feet.y + EYE_HEIGHT, feet.z);

    const state = {
      hp: 100,
      hpMax: 100,
      stamina: 100,
      staminaMax: 100,
      staminaRegen: 22,
      sprintDrain: 28,

      vel: new THREE.Vector3(),
      wish: new THREE.Vector3(),
      onGround: true,

      fireDown: false,
      triggerPressed: false,
      lastShotAt: -999,
      recoilPitch: 0,
      recoilYaw: 0,
    };

    const keys = { w:false, a:false, s:false, d:false, shift:false, space:false };

    function bindKeys(onShop, onReload, onPause, onMelee) {
      document.addEventListener("keydown", (e) => {
        if (e.code === "KeyW") keys.w = true;
        if (e.code === "KeyA") keys.a = true;
        if (e.code === "KeyS") keys.s = true;
        if (e.code === "KeyD") keys.d = true;
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = true;
        if (e.code === "Space") { keys.space = true; e.preventDefault(); }

        if (e.code === "KeyF") onShop && onShop();
        if (e.code === "KeyR") onReload && onReload();
        if (e.code === "Escape") onPause && onPause();
        if (e.code === "KeyV") onMelee && onMelee();
      }, { passive: false });

      document.addEventListener("keyup", (e) => {
        if (e.code === "KeyW") keys.w = false;
        if (e.code === "KeyA") keys.a = false;
        if (e.code === "KeyS") keys.s = false;
        if (e.code === "KeyD") keys.d = false;
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = false;
        if (e.code === "Space") keys.space = false;
      });
    }

    function bindMouse() {
      lockEl.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          state.fireDown = true;
          state.triggerPressed = true;
        }
      });

      document.addEventListener("mouseup", (e) => {
        if (e.button === 0) state.fireDown = false;
      });

      window.addEventListener("blur", () => {
        state.fireDown = false;
        state.triggerPressed = false;
      });
    }

    function syncCameraToFeet() {
      camera.position.set(feet.x, feet.y + EYE_HEIGHT, feet.z);
    }

    function computeWishDir() {
      state.wish.set(0, 0, 0);

      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() > 0) forward.normalize();

      right.crossVectors(forward, up);
      if (right.lengthSq() > 0) right.normalize();

      if (keys.w) state.wish.add(forward);
      if (keys.s) state.wish.sub(forward);
      if (keys.d) state.wish.add(right);
      if (keys.a) state.wish.sub(right);

      if (state.wish.lengthSq() > 0) state.wish.normalize();
    }

    function updateRecoil(dt) {
      if (state.recoilPitch > 0) {
        const pitchStep = Math.min(state.recoilPitch, dt * 6.2);
        pitchObject.rotation.x = clamp(pitchObject.rotation.x - pitchStep, -Math.PI * 0.48, Math.PI * 0.48);
        state.recoilPitch -= pitchStep;
      }

      state.recoilYaw = 0;
      if (camera && camera.rotation) camera.rotation.z = 0;
      if (pitchObject && pitchObject.rotation) pitchObject.rotation.z = 0;
      if (yawObject && yawObject.rotation) yawObject.rotation.z = 0;
    }

    function applyRecoil(pitchAmount, yawAmount) {
      state.recoilPitch = Math.min(0.085, state.recoilPitch + Math.max(0, pitchAmount || 0));
      state.recoilYaw = 0;
    }

    function canFire(nowSeconds, fireRate) {
      const minDelay = 1 / Math.max(0.01, fireRate || 1);
      return (nowSeconds - state.lastShotAt) >= minDelay;
    }

    function markFired(nowSeconds, recoilPitch, recoilYaw) {
      state.lastShotAt = nowSeconds;
      applyRecoil(recoilPitch, recoilYaw);
    }

    function isPrimaryDown() {
      return !!state.fireDown;
    }

    function consumeTriggerPress() {
      if (!state.triggerPressed) return false;
      state.triggerPressed = false;
      return true;
    }

    function step(dt, worldRef) {
      const w = worldRef || world;

      dt = Math.min(0.033, Math.max(0.001, dt));

      computeWishDir();

      const canSprint = keys.shift && state.stamina > 0.5 && state.wish.lengthSq() > 0;
      let speed = SPEED;

      if (canSprint) {
        speed = SPRINT;
        state.stamina = Math.max(0, state.stamina - state.sprintDrain * dt);
      } else {
        state.stamina = Math.min(state.staminaMax, state.stamina + state.staminaRegen * dt);
      }

      const accel = state.onGround ? 36 : 18;
      state.vel.x += (state.wish.x * speed - state.vel.x) * Math.min(1, accel * dt);
      state.vel.z += (state.wish.z * speed - state.vel.z) * Math.min(1, accel * dt);

      state.vel.y -= GRAVITY * dt;

      if (keys.space && state.onGround) {
        state.vel.y = JUMP;
        state.onGround = false;
      }

      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const subDt = dt / steps;

        feet.x += state.vel.x * subDt;
        feet.z += state.vel.z * subDt;

        if (w && w.clampToBounds) w.clampToBounds(feet);
        if (w && w.solids) Physics.resolveSolids(feet, PLAYER_RADIUS, PLAYER_HEIGHT, w.solids, 3);
      }

      feet.y += state.vel.y * dt;

      let groundY = 0.02;
      if (w && w.getGroundY) groundY = w.getGroundY(feet.x, feet.y, feet.z);

      if (feet.y <= groundY) {
        feet.y = groundY;
        state.vel.y = 0;
        state.onGround = true;
      } else {
        state.onGround = false;
      }

      if (w && w.ceilings) {
        Physics.resolveCeilings(feet, PLAYER_RADIUS, PLAYER_HEIGHT, w.ceilings, w.holes || []);
      }

      const ground2 = (w && w.getGroundY) ? w.getGroundY(feet.x, feet.y, feet.z) : 0.02;
      if (feet.y <= ground2) {
        feet.y = ground2;
        state.vel.y = 0;
        state.onGround = true;
      }

      updateRecoil(dt);
      syncCameraToFeet();
    }

    function setPositionFeet(x, feetY, z) {
      feet.set(x, feetY, z);
      state.vel.set(0, 0, 0);
      state.onGround = true;
      syncCameraToFeet();
    }

    function getFeetPosition() {
      return feet.clone();
    }

    function getEyePosition() {
      return camera.position.clone();
    }

    function resetLook() {
      if (yawObject && yawObject.rotation) yawObject.rotation.y = 0;
      if (pitchObject && pitchObject.rotation) pitchObject.rotation.x = 0;
      if (camera && camera.rotation) camera.rotation.z = 0;
      if (pitchObject && pitchObject.rotation) pitchObject.rotation.z = 0;
      if (yawObject && yawObject.rotation) yawObject.rotation.z = 0;
      state.recoilPitch = 0;
      state.recoilYaw = 0;
    }

    function resetState() {
      keys.w = keys.a = keys.s = keys.d = keys.shift = keys.space = false;
      state.fireDown = false;
      state.triggerPressed = false;
      state.lastShotAt = -999;
      state.vel.set(0, 0, 0);
      state.wish.set(0, 0, 0);
      state.onGround = true;
      resetLook();
    }

    bindMouse();

    return {
      controls,
      state,
      bindKeys,
      step,
      setPositionFeet,
      getFeetPosition,
      getEyePosition,
      canFire,
      markFired,
      applyRecoil,
      isPrimaryDown,
      consumeTriggerPress,
      resetLook,
      resetState,
      consts: { PLAYER_RADIUS, PLAYER_HEIGHT, EYE_HEIGHT }
    };
  }

  window.Player = { make };
})();
 /* player.js */
