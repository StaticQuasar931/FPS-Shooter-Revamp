window.Assets = (() => {
  "use strict";

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  function makeCanvasTexture(drawFn, w=256, h=256) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    drawFn(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  function loadTextureTryPaths(fileName, fallbackFn) {
    const tryList = [
      `./assets/${fileName}`,
      `assets/${fileName}`,
      `./${fileName}`,
      `${fileName}`,
    ];

    return new Promise((resolve) => {
      const tryNext = (i) => {
        if (i >= tryList.length) { resolve(fallbackFn()); return; }
        loader.load(
          tryList[i],
          (t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.minFilter = THREE.LinearMipmapLinearFilter;
            t.magFilter = THREE.LinearFilter;
            t.anisotropy = 4;
            t.needsUpdate = true;
            resolve(t);
          },
          undefined,
          () => tryNext(i + 1)
        );
      };
      tryNext(0);
    });
  }

  function loadSpriteTryPaths(fileName, fallbackFn) {
    const tryList = [
      `./assets/${fileName}`,
      `assets/${fileName}`,
      `./${fileName}`,
      `${fileName}`,
    ];

    return new Promise((resolve) => {
      const tryNext = (i) => {
        if (i >= tryList.length) { resolve(fallbackFn()); return; }
        loader.load(
          tryList[i],
          (t) => {
            t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
            t.minFilter = THREE.LinearMipmapLinearFilter;
            t.magFilter = THREE.LinearFilter;
            t.anisotropy = 4;
            t.needsUpdate = true;
            resolve(t);
          },
          undefined,
          () => tryNext(i + 1)
        );
      };
      tryNext(0);
    });
  }

  async function loadAll() {
    const tex = {};

    tex.floorWood = await loadTextureTryPaths(
      "tex_floor_wood_1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.fillStyle="#7a5a3a"; g.fillRect(0,0,w,h);
        for (let y=0;y<h;y+=18){ g.fillStyle = y%36===0 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.10)"; g.fillRect(0,y,w,2); }
        for (let x=0;x<w;x+=28){ g.fillStyle="rgba(0,0,0,.08)"; g.fillRect(x,0,2,h); }
      })
    );

    tex.carpet = await loadTextureTryPaths(
      "tex_carpet_1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.fillStyle="#2f2a35"; g.fillRect(0,0,w,h);
        g.fillStyle="rgba(255,255,255,.06)";
        for (let i=0;i<260;i++){ g.fillRect(Math.random()*w, Math.random()*h, 1, 1); }
      })
    );

    tex.ceiling = await loadTextureTryPaths(
      "tex_ceiling_1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.fillStyle="#c8cdd3"; g.fillRect(0,0,w,h);
        g.fillStyle="rgba(0,0,0,.10)";
        for (let y=0;y<h;y+=32){ g.fillRect(0,y,w,1); }
        for (let x=0;x<w;x+=32){ g.fillRect(x,0,1,h); }
      })
    );

    tex.door = await loadTextureTryPaths(
      "tex_door_1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.fillStyle="#6b4a2c"; g.fillRect(0,0,w,h);
        g.fillStyle="rgba(0,0,0,.18)"; g.fillRect(14,10,w-28,h-20);
        g.fillStyle="rgba(255,255,255,.10)"; g.fillRect(18,14,w-36,6);
        g.fillStyle="#e3d0a2"; g.beginPath(); g.arc(w-48,h/2,10,0,Math.PI*2); g.fill();
      })
    );

    tex.windowGlass = await loadTextureTryPaths(
      "tex_window_glass_1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.fillStyle="rgba(120,180,255,.22)"; g.fillRect(0,0,w,h);
        g.strokeStyle="rgba(255,255,255,.25)"; g.lineWidth=6; g.strokeRect(10,10,w-20,h-20);
        g.strokeStyle="rgba(255,255,255,.18)"; g.lineWidth=3; g.beginPath(); g.moveTo(20,20); g.lineTo(w-20,h-20); g.stroke();
      })
    );

    tex.sky = await loadTextureTryPaths(
      "tex_sky_night_2048x1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        const grad = g.createLinearGradient(0,0,0,h);
        grad.addColorStop(0,"#081025"); grad.addColorStop(1,"#00010a");
        g.fillStyle=grad; g.fillRect(0,0,w,h);
        g.fillStyle="rgba(255,255,255,.8)";
        for(let i=0;i<220;i++){
          const x=Math.random()*w,y=Math.random()*h,r=Math.random()*1.6;
          g.globalAlpha=0.35+Math.random()*0.65; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
        }
        g.globalAlpha=1;
      }, 1024, 512)
    );

    tex.zombieNormal = await loadTextureTryPaths("zombie_normal_512.png", () => makeCanvasTexture((g,w,h)=>{ g.fillStyle="#2bc08a"; g.fillRect(0,0,w,h); }, 32, 32));
    tex.zombieSprinter = await loadTextureTryPaths("zombie_sprinter_512.png", () => makeCanvasTexture((g,w,h)=>{ g.fillStyle="#58d19b"; g.fillRect(0,0,w,h); }, 32, 32));
    tex.zombieTank = await loadTextureTryPaths("zombie_tank_512.png", () => makeCanvasTexture((g,w,h)=>{ g.fillStyle="#1e8a63"; g.fillRect(0,0,w,h); }, 32, 32));
    tex.zombieSpitter = await loadTextureTryPaths("zombie_spitter_512.png", () => makeCanvasTexture((g,w,h)=>{ g.fillStyle="#3aa0d6"; g.fillRect(0,0,w,h); }, 32, 32));

    tex.bulletFx = await loadTextureTryPaths(
      "fx_bullet_player_64.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.clearRect(0,0,w,h);
        const cx=w/2, cy=h/2;
        const grad = g.createRadialGradient(cx,cy,2,cx,cy,w/2);
        grad.addColorStop(0,"rgba(255,255,170,.95)");
        grad.addColorStop(1,"rgba(255,255,170,0)");
        g.fillStyle=grad;
        g.beginPath(); g.arc(cx,cy,w*0.45,0,Math.PI*2); g.fill();
      }, 64, 64)
    );

    tex.tvScreen = await loadTextureTryPaths(
      "tex_tv_screen_2048x1024.png",
      () => makeCanvasTexture((g,w,h)=>{
        g.fillStyle="#070a0f"; g.fillRect(0,0,w,h);
        g.fillStyle="rgba(120,200,255,.14)"; g.fillRect(16,16,w-32,h-32);
        g.strokeStyle="rgba(255,255,255,.16)"; g.lineWidth=10; g.strokeRect(18,18,w-36,h-36);
        g.font="900 58px Arial";
        g.fillStyle="rgba(255,255,255,.86)";
        g.fillText("StaticQuasar931", 42, h/2 - 12);
        g.font="700 44px Arial";
        g.fillStyle="rgba(255,255,255,.74)";
        g.fillText("Unblocked Games", 42, h/2 + 52);
      }, 1024, 512)
    );

    // Decorative prop images (used as planes/sprites)
    tex.propCouch = await loadSpriteTryPaths(
      "prop_couch_512.png",
      () => makeCanvasTexture((g,w,h)=>{ g.clearRect(0,0,w,h); }, 64, 64)
    );
    tex.propTable = await loadSpriteTryPaths(
      "prop_table_512.png",
      () => makeCanvasTexture((g,w,h)=>{ g.clearRect(0,0,w,h); }, 64, 64)
    );
    tex.propCounter = await loadSpriteTryPaths(
      "prop_counter_512.png",
      () => makeCanvasTexture((g,w,h)=>{ g.clearRect(0,0,w,h); }, 64, 64)
    );
    tex.propBookshelf = await loadSpriteTryPaths(
      "prop_bookshelf_512.png",
      () => makeCanvasTexture((g,w,h)=>{ g.clearRect(0,0,w,h); }, 64, 64)
    );
    tex.propLamp = await loadSpriteTryPaths(
      "prop_lamp_512.png",
      () => makeCanvasTexture((g,w,h)=>{ g.clearRect(0,0,w,h); }, 64, 64)
    );

    return tex;
  }

  return { loadAll, makeCanvasTexture };
})();
 /* assets.js */
