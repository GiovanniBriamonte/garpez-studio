/*
 * The landing set: the simplified TV from /assets/landing, lit like the
 * standalone prototype. The screen plays the Rai reel in a loop, muted.
 * Pointer tilt is optional; the page decides what a click on the set does.
 */

const MAX = 8;
const SCREEN = [800, 614];
const REEL = '/tv/01-rai.mp4';
/* screen opening of the model (CRT_Black_Mask), in canvas units 0..1 */
const OPEN = [
  [0.056, 0.0467], [0.0658, 0.0423], [0.0736, 0.0413], [0.9264, 0.0413], [0.9317, 0.0417],
  [0.9392, 0.0441], [0.9463, 0.0483], [0.9506, 0.0521], [0.958, 0.0617], [0.9621, 0.0704],
  [0.9654, 0.0834], [0.9662, 0.0936], [0.9662, 0.9064], [0.9658, 0.9133], [0.9641, 0.9232],
  [0.9609, 0.9326], [0.958, 0.9383], [0.9506, 0.9479], [0.944, 0.9533], [0.9342, 0.9577],
  [0.9264, 0.9587], [0.0736, 0.9587], [0.0683, 0.9583], [0.0608, 0.9559], [0.0537, 0.9517],
  [0.0494, 0.9479], [0.042, 0.9383], [0.0379, 0.9296], [0.0346, 0.9166], [0.0338, 0.9064],
  [0.0338, 0.0936], [0.0352, 0.08], [0.0391, 0.0674], [0.0455, 0.0566], [0.0494, 0.0521],
  [0.056, 0.0467],
];

/* low-res static, scaled up with hard pixels (same feel as the /tv snow) */
const SNOW = [200, 154];
let snowCv = null;
let snowImg = null;
let snowBuf = null;
function snowFrame() {
  if (!snowCv) {
    snowCv = document.createElement('canvas');
    [snowCv.width, snowCv.height] = SNOW;
    snowImg = snowCv.getContext('2d').createImageData(SNOW[0], SNOW[1]);
    snowBuf = new Uint32Array(snowImg.data.buffer);
  }
  for (let i = 0; i < snowBuf.length; i++) {
    const v = (Math.random() * 255) | 0;
    snowBuf[i] = 0xff000000 | (v << 16) | (v << 8) | v;
  }
  snowCv.getContext('2d').putImageData(snowImg, 0, 0);
  return snowCv;
}

let frameCv = null;
/**
 * Paints the reel into the phosphor. `zap` 0..1 plays the TV's channel change
 * on top: rows slip sideways on a wave plus a few hard bands, then static.
 */
function drawScreen(ctx, video, zap = 0, zapState = null) {
  const [W, H] = SCREEN;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  OPEN.forEach(([u, v], i) => (i ? ctx.lineTo(u * W, v * H) : ctx.moveTo(u * W, v * H)));
  ctx.closePath();
  ctx.clip();
  if (video.readyState >= 2 && video.videoWidth) {
    const k = Math.max(W / video.videoWidth, H / video.videoHeight);
    const w = video.videoWidth * k;
    const h = video.videoHeight * k;
    if (zap <= 0) {
      ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      if (!frameCv) {
        frameCv = document.createElement('canvas');
        [frameCv.width, frameCv.height] = SCREEN;
      }
      const fx = frameCv.getContext('2d');
      fx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
      const t = performance.now();
      const amp = Math.min(1, zap * 1.6);
      for (let y = 0; y < H; y += 4) {
        let o = Math.sin(y * 0.035 + zapState.ph + t * 0.03) * 44 * amp;
        for (const b of zapState.bands) if (y > b.y && y < b.y + b.h) o += b.o * amp;
        o = Math.round(o);
        ctx.drawImage(frameCv, 0, y, W, 4, o, y, W, 4);
        ctx.drawImage(frameCv, 0, y, W, 4, o + (o > 0 ? -W : W), y, W, 4);
      }
    }
  }
  if (zap > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.min(1, zap * zap * 1.1);
    ctx.drawImage(snowFrame(), 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
  }
  ctx.restore();
}

/* odama-style digital glitch, applied to the whole render after tone mapping */
const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmt: { value: 0 },
    uSeed: { value: 0 },
    uRes: { value: [1, 1] },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmt;
    uniform float uSeed;
    uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float a = uAmt;
      /* big row blocks that slip sideways */
      float rows = mix(10.0, 46.0, h(vec2(uSeed, 1.0)));
      float row = floor(uv.y * rows);
      float on = step(1.0 - a * 0.8, h(vec2(row, uSeed)));
      uv.x += (h(vec2(row, uSeed + 3.0)) - 0.5) * 0.28 * a * on;
      /* fine line jitter */
      float line = floor(uv.y * uRes.y / 2.0);
      uv.x += (h(vec2(line, uSeed + 7.0)) - 0.5) * 0.008 * a;
      /* some rows turn into fat pixels */
      float blk = step(0.72, h(vec2(row, uSeed + 11.0))) * on;
      vec2 bs = vec2(mix(10.0, 48.0, h(vec2(row, uSeed + 13.0)))) / uRes;
      uv = mix(uv, (floor(uv / bs) + 0.5) * bs, blk);
      uv.x = fract(uv.x);
      /* RGB split, stronger on displaced rows */
      float sh = a * (0.004 + 0.022 * on);
      vec4 cr = texture2D(tDiffuse, uv + vec2(sh, 0.0));
      vec4 cg = texture2D(tDiffuse, uv);
      vec4 cb = texture2D(tDiffuse, uv - vec2(sh, 0.0));
      vec4 col = vec4(cr.r, cg.g, cb.b, max(max(cr.a, cg.a), cb.a));
      /* grain + scanlines (colors are premultiplied) */
      float n = h(vUv * uRes + uSeed * 13.0);
      col.rgb = mix(col.rgb, vec3(n) * col.a, 0.22 * a);
      col.rgb *= 1.0 - 0.18 * a * step(0.5, fract(vUv.y * uRes.y / 3.0));
      /* bright tear lines */
      float tl = step(0.996 - 0.012 * a, h(vec2(line, uSeed + 21.0)));
      col = mix(col, vec4(1.0), tl * a * 0.85);
      gl_FragColor = col;
    }
  `,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const inOutQuart = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

/**
 * Mounts the TV into `stage`. `onActivate` fires for a click on the model,
 * Enter/Space, or a click anywhere if the model failed to load.
 * Returns `{ destroy, dive }`. `dive(ms)` moves the set to the centre while
 * pushing into the screen until the picture fills the viewport, with the
 * channel change on the screen and a glitch pass on top. It resolves `true`
 * once the viewport is full of static (or `false` if the set never loaded).
 * @param {HTMLElement} stage
 * @param {{ reduce?: boolean, onActivate?: () => void, onHot?: (hot: boolean) => void }} [options]
 * @returns {{ destroy: () => void, dive: (ms?: number) => Promise<boolean> }}
 */
export function mountLandingTv(stage, { reduce = false, onActivate, onHot } = {}) {
  let disposed = false;
  let raf = 0;
  let failed = false;
  const cleanups = [];
  /* set once the scene is up; until then dive() resolves false */
  let startDive = null;

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  const activate = () => onActivate?.();

  on(stage, 'keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    activate();
  });

  (async () => {
    try {
    const THREE = await import('three');
    if (disposed) return;
    const [{ GLTFLoader }, { RoomEnvironment }, { EffectComposer }, { RenderPass }, { OutputPass }, { ShaderPass }] =
      await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/environments/RoomEnvironment.js'),
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
      ]);
    if (disposed) return;

    let renderer;
    try {
      /* preserveDrawingBuffer: the pixel-wave transition copies this canvas */
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      failed = true;
      return;
    }
    if (!renderer.getContext()) {
      failed = true;
      return;
    }

    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const canvas = renderer.domElement;
    canvas.style.opacity = '0';
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(16, 1, 0.05, 20);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.25, 2.4, 1.3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 18;
    key.shadow.blurSamples = 24;
    key.shadow.bias = -0.0005;
    Object.assign(key.shadow.camera, { left: -0.6, right: 0.6, top: 0.6, bottom: -0.6, near: 0.1, far: 5 });
    scene.add(key);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const cv = document.createElement('canvas');
    cv.width = SCREEN[0];
    cv.height = SCREEN[1];
    const ctx = cv.getContext('2d');
    const video = document.createElement('video');
    video.src = REEL;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.play().catch(() => {});
    drawScreen(ctx, video);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = 8;

    const manager = new THREE.LoadingManager();
    const texLoader = new THREE.TextureLoader(manager);
    const faceTex = texLoader.load('/assets/landing/tv-faceplate.jpg');
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.flipY = false;
    faceTex.anisotropy = 8;
    const keyTex = texLoader.load('/assets/landing/tv-keys.png');
    keyTex.colorSpace = THREE.NoColorSpace;
    keyTex.flipY = false;
    const keyRough = texLoader.load('/assets/landing/tv-keys-rough.png');
    keyRough.colorSpace = THREE.NoColorSpace;
    keyRough.flipY = false;

    let tv = null;
    let phosphor = null;
    const size = new THREE.Vector3();
    const loader = new GLTFLoader(manager);
    loader.load(
      '/assets/landing/tv.glb',
      (g) => {
        if (disposed) return;
        tv = g.scene;
        tv.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.name.startsWith('Key_')) {
            if (o.geometry.attributes.uv && !o.geometry.attributes.uv2) {
              o.geometry.setAttribute('uv2', o.geometry.attributes.uv);
            }
            o.material = o.material.clone();
            o.material.map = keyTex;
            o.material.aoMap = keyTex;
            o.material.roughnessMap = keyRough;
            o.material.roughness = 1;
            o.material.needsUpdate = true;
          }
          if (o.name.startsWith('FrontFaceplate')) {
            o.material.map = faceTex;
            o.material.color.set(0xffffff);
            o.material.needsUpdate = true;
          }
          if (o.name.startsWith('CRT_Phosphor')) {
            phosphor = o;
            o.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
            o.castShadow = false;
          }
          if (o.name.startsWith('CRT_Black_Mask')) {
            o.material = new THREE.MeshBasicMaterial({ color: 0x030303 });
          }
          if (o.name.startsWith('CRT_Glass')) o.visible = false;
        });
        const box = new THREE.Box3().setFromObject(tv);
        box.getSize(size);
        tv.position.sub(box.getCenter(new THREE.Vector3()));
        pivot.add(tv);
        pivot.position.y = size.y / 2;
        floor.position.y = 0;
        fit();
      },
      undefined,
      () => {
        failed = true;
      },
    );

    manager.onLoad = () => {
      if (disposed) return;
      if (reduce) canvas.style.opacity = '1';
      else canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, fill: 'forwards', easing: 'ease-out' });
    };
    manager.onError = () => {
      failed = true;
      canvas.style.opacity = '1';
    };

    let dive = null;
    let composer = null;
    let glitch = null;

    function fit() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w < 2 || h < 2) return;
      renderer.setSize(w, h, false);
      if (composer) composer.setSize(w, h);
      /* while diving the camera pose is frozen; only the view offset moves */
      if (dive) return;
      camera.aspect = w / h;
      if (tv) {
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const needH = size.y * 1.32;
        const needW = size.x * (w < 700 ? 1.12 : 1.5);
        const dist = Math.max(
          needH / 2 / Math.tan(vfov / 2),
          needW / 2 / Math.tan(vfov / 2) / camera.aspect,
        ) + size.z / 2;
        camera.position.set(0, size.y * 0.56, dist);
        camera.lookAt(0, size.y * 0.5, 0);
      }
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(() => fit());
    ro.observe(stage);
    fit();

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (e) => {
      if (!tv) return false;
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(tv, true).length > 0;
    };

    let hot = false;
    const setHot = (next) => {
      if (next === hot) return;
      hot = next;
      stage.classList.toggle('is-hot', hot);
      onHot?.(hot);
    };

    on(stage, 'click', (e) => {
      if (failed || hit(e)) activate();
    });
    on(stage, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      setHot(!failed && hit(e));
    });
    on(stage, 'pointerleave', () => setHot(false));

    let tx = 0;
    let ty = 0;
    let rx = 0;
    let ry = 0;
    if (!reduce) {
      on(window, 'pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        ty = (e.clientX / innerWidth) * 2 - 1;
        tx = (e.clientY / innerHeight) * 2 - 1;
      });
      on(document.documentElement, 'pointerleave', () => {
        tx = 0;
        ty = 0;
      });
      on(window, 'blur', () => {
        tx = 0;
        ty = 0;
      });
    }

    /* ---- the dive ---------------------------------------------------- */
    const ref = camera.clone();
    const box = new THREE.Box3();
    const corner = new THREE.Vector3();
    /* phosphor rect in the old (pre-dive) view, in px */
    function screenRect(oldW, oldH) {
      ref.position.copy(camera.position);
      ref.quaternion.copy(camera.quaternion);
      ref.updateMatrixWorld();
      pivot.updateMatrixWorld(true);
      box.setFromObject(phosphor);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        corner.project(ref);
        const px = ((corner.x + 1) / 2) * oldW;
        const py = ((1 - corner.y) / 2) * oldH;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    }

    startDive = (ms) =>
      new Promise((resolve) => {
        if (!tv || !phosphor || dive) {
          resolve(false);
          return;
        }
        const r0 = stage.getBoundingClientRect();
        const oldW = stage.clientWidth;
        const oldH = stage.clientHeight;
        ref.copy(camera);
        ref.aspect = oldW / oldH;
        ref.clearViewOffset();
        ref.updateProjectionMatrix();
        const s0 = screenRect(oldW, oldH);

        /* take over the whole window; the old view now lives inside it */
        stage.classList.add('is-diving');
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        dive = {
          t0: performance.now(),
          dur: ms,
          oldW,
          oldH,
          vw,
          vh,
          from: { x: r0.left + s0.cx, y: r0.top + s0.cy },
          s1: Math.max(vw / s0.w, vh / s0.h) * 1.18,
          seedAt: 0,
          spike: 0,
          zap: { ph: Math.random() * 6, bands: [0, 1, 2, 3].map(() => ({ y: Math.random() * SCREEN[1], h: 20 + Math.random() * 80, o: (Math.random() - 0.5) * 160 })) },
          resolve,
          done: false,
        };
        camera.aspect = oldW / oldH;
        renderer.setSize(vw, vh, false);
        if (!composer) {
          composer = new EffectComposer(renderer);
          composer.addPass(new RenderPass(scene, camera));
          composer.addPass(new OutputPass());
          glitch = new ShaderPass(GlitchShader);
          composer.addPass(glitch);
        }
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(vw, vh);
        const pr = renderer.getPixelRatio();
        glitch.uniforms.uRes.value = [vw * pr, vh * pr];
        applyDive(performance.now());
      });

    /* returns the glitch amount for this frame */
    function applyDive(now) {
      const d = dive;
      const t = Math.min(1, (now - d.t0) / d.dur);
      const ec = inOutCubic(Math.min(1, t / 0.85));
      const es = inOutQuart(t);
      const s = Math.exp(Math.log(d.s1) * es);
      const cur = screenRect(d.oldW, d.oldH);
      const px = d.from.x + (d.vw / 2 - d.from.x) * ec;
      const py = d.from.y + (d.vh / 2 - d.from.y) * ec;
      const left = px - cur.cx * s;
      const top = py - cur.cy * s;
      camera.setViewOffset(d.oldW, d.oldH, -left / s, -top / s, d.vw / s, d.vh / s);

      /* glitch: creeps in, then takes over; stutters with random spikes */
      if (now >= d.seedAt) {
        glitch.uniforms.uSeed.value = Math.random() * 100;
        d.seedAt = now + 45 + Math.random() * 60;
        if (t > 0.12 && Math.random() < 0.22) d.spike = 0.25 + Math.random() * 0.35;
      }
      d.spike *= 0.86;
      const amt = Math.min(1, smooth(0.3, 1, t) ** 1.4 + d.spike);
      glitch.uniforms.uAmt.value = amt;
      d.zapAmt = smooth(0.04, 0.8, t);

      if (t >= 1 && !d.done) {
        d.done = true;
        d.resolve(true);
      }
    }

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const diving = !!dive;
      if (diving) applyDive(now);
      drawScreen(ctx, video, diving ? dive.zapAmt : 0, diving ? dive.zap : null);
      tex.needsUpdate = true;
      const goalX = !reduce && !diving ? tx * MAX * 0.8 : 0;
      const goalY = !reduce && !diving ? ty * MAX : 0;
      rx += (goalX - rx) * (diving ? 0.12 : 0.08);
      ry += (goalY - ry) * (diving ? 0.12 : 0.08);
      pivot.rotation.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), 0);
      if (diving) composer.render();
      else renderer.render(scene, camera);
    };
    tick();

    cleanups.push(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.classList.remove('is-hot', 'is-diving');
      composer?.dispose();
      video.pause();
      video.removeAttribute('src');
      video.load();
      tex.dispose();
      faceTex.dispose();
      keyTex.dispose();
      keyRough.dispose();
      env.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) m.dispose?.();
      });
      renderer.dispose();
      canvas.remove();
    });
    } catch (err) {
      failed = true;
      console.error(err);
    }
  })();

  return {
    destroy() {
      disposed = true;
      for (const fn of cleanups) fn();
      cleanups.length = 0;
    },
    dive(ms = 1100) {
      if (disposed || failed || !startDive) return Promise.resolve(false);
      return startDive(ms);
    },
  };
}
