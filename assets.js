window.Assets = (() => {
  "use strict";

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  function finalizeTexture(t, repeatMode) {
    t.wrapS = t.wrapT = repeatMode || THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 2;
    t.needsUpdate = true;
    return t;
  }

  function makeCanvasTexture(drawFn, w = 256, h = 256, repeatMode) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    drawFn(g, w, h);
    const t = new THREE.CanvasTexture(c);
    return finalizeTexture(t, repeatMode || THREE.RepeatWrapping);
  }

  function loadTextureTryPaths(fileName, fallbackFn, repeatMode) {
    const tryList = [
      `./assets/${fileName}`,
      `assets/${fileName}`,
      `./${fileName}`,
      `${fileName}`,
    ];

    return new Promise((resolve) => {
      const tryNext = (i) => {
        if (i >= tryList.length) {
          resolve(fallbackFn());
          return;
        }
        loader.load(
          tryList[i],
          (t) => resolve(finalizeTexture(t, repeatMode || THREE.RepeatWrapping)),
          undefined,
          () => tryNext(i + 1)
        );
      };
      tryNext(0);
    });
  }

  async function loadAll() {
    const tasks = {
      floorWood: loadTextureTryPaths(
        "tex_floor_wood_1024.png",
        () => makeCanvasTexture((g, w, h) => {
          g.fillStyle = "#7a5a3a";
          g.fillRect(0, 0, w, h);
          for (let y = 0; y < h; y += 18) {
            g.fillStyle = y % 36 === 0 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.10)";
            g.fillRect(0, y, w, 2);
          }
          for (let x = 0; x < w; x += 28) {
            g.fillStyle = "rgba(0,0,0,.08)";
            g.fillRect(x, 0, 2, h);
          }
        }, 256, 256)
      ),
      carpet: loadTextureTryPaths(
        "tex_carpet_1024.png",
        () => makeCanvasTexture((g, w, h) => {
          g.fillStyle = "#2f2a35";
          g.fillRect(0, 0, w, h);
          g.fillStyle = "rgba(255,255,255,.05)";
          for (let i = 0; i < 180; i++) g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }, 256, 256)
      ),
      ceiling: loadTextureTryPaths(
        "tex_ceiling_1024.png",
        () => makeCanvasTexture((g, w, h) => {
          g.fillStyle = "#c8cdd3";
          g.fillRect(0, 0, w, h);
          g.fillStyle = "rgba(0,0,0,.10)";
          for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 1);
          for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1, h);
        }, 256, 256)
      ),
      door: loadTextureTryPaths(
        "tex_door_1024.png",
        () => makeCanvasTexture((g, w, h) => {
          g.fillStyle = "#6b4a2c";
          g.fillRect(0, 0, w, h);
          g.fillStyle = "rgba(0,0,0,.18)";
          g.fillRect(14, 10, w - 28, h - 20);
          g.fillStyle = "rgba(255,255,255,.10)";
          g.fillRect(18, 14, w - 36, 6);
          g.fillStyle = "#e3d0a2";
          g.beginPath();
          g.arc(w - 48, h / 2, 10, 0, Math.PI * 2);
          g.fill();
        }, 256, 256)
      ),
      windowGlass: loadTextureTryPaths(
        "tex_window_glass_1024.png",
        () => makeCanvasTexture((g, w, h) => {
          g.fillStyle = "rgba(120,180,255,.22)";
          g.fillRect(0, 0, w, h);
          g.strokeStyle = "rgba(255,255,255,.25)";
          g.lineWidth = 6;
          g.strokeRect(10, 10, w - 20, h - 20);
          g.strokeStyle = "rgba(255,255,255,.18)";
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(20, 20);
          g.lineTo(w - 20, h - 20);
          g.stroke();
        }, 256, 256)
      ),
      sky: loadTextureTryPaths(
        "tex_sky_night_2048x1024.png",
        () => makeCanvasTexture((g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "#081025");
          grad.addColorStop(1, "#00010a");
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          g.fillStyle = "rgba(255,255,255,.8)";
          for (let i = 0; i < 160; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = Math.random() * 1.6;
            g.globalAlpha = 0.35 + Math.random() * 0.65;
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
        }, 512, 256)
      ),
      zombieNormal: loadTextureTryPaths("zombie_normal_512.png", () => makeCanvasTexture((g, w, h) => { g.fillStyle = "#2bc08a"; g.fillRect(0, 0, w, h); }, 32, 32)),
      zombieSprinter: loadTextureTryPaths("zombie_sprinter_512.png", () => makeCanvasTexture((g, w, h) => { g.fillStyle = "#58d19b"; g.fillRect(0, 0, w, h); }, 32, 32)),
      zombieTank: loadTextureTryPaths("zombie_tank_512.png", () => makeCanvasTexture((g, w, h) => { g.fillStyle = "#1e8a63"; g.fillRect(0, 0, w, h); }, 32, 32)),
      zombieSpitter: loadTextureTryPaths("zombie_spitter_512.png", () => makeCanvasTexture((g, w, h) => { g.fillStyle = "#3aa0d6"; g.fillRect(0, 0, w, h); }, 32, 32)),
      bulletFx: loadTextureTryPaths(
        "fx_bullet_player_64.png",
        () => makeCanvasTexture((g, w, h) => {
          g.clearRect(0, 0, w, h);
          const cx = w / 2;
          const cy = h / 2;
          const grad = g.createRadialGradient(cx, cy, 2, cx, cy, w / 2);
          grad.addColorStop(0, "rgba(255,255,170,.95)");
          grad.addColorStop(1, "rgba(255,255,170,0)");
          g.fillStyle = grad;
          g.beginPath();
          g.arc(cx, cy, w * 0.45, 0, Math.PI * 2);
          g.fill();
        }, 64, 64, THREE.ClampToEdgeWrapping),
        THREE.ClampToEdgeWrapping
      ),
      tvScreen: loadTextureTryPaths(
        "tex_tv_screen_2048x1024.png",
        () => makeCanvasTexture((g, w, h) => {
          g.fillStyle = "#070a0f";
          g.fillRect(0, 0, w, h);
          g.fillStyle = "rgba(120,200,255,.14)";
          g.fillRect(16, 16, w - 32, h - 32);
          g.strokeStyle = "rgba(255,255,255,.16)";
          g.lineWidth = 10;
          g.strokeRect(18, 18, w - 36, h - 36);
          g.font = "900 42px Arial";
          g.fillStyle = "rgba(255,255,255,.86)";
          g.fillText("StaticQuasar931", 42, h / 2 - 12);
          g.font = "700 30px Arial";
          g.fillStyle = "rgba(255,255,255,.74)";
          g.fillText("Zombie House", 42, h / 2 + 38);
        }, 512, 256)
      ),
    };

    const entries = await Promise.all(
      Object.entries(tasks).map(async ([key, promise]) => [key, await promise])
    );

    return Object.fromEntries(entries);
  }

  return { loadAll, makeCanvasTexture };
})();
 /* assets.js */
