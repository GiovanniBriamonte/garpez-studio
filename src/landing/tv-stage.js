/*
 * The landing set: the simplified TV from /assets/landing, lit like the
 * standalone prototype. The screen plays one of the studio reels, muted.
 * Pointer tilt is optional; the page decides what a click on the set does.
 */

const MAX = 8;
const SCREEN = [800, 614];
const REELS = ['/tv/01-rai.mp4', '/tv/02-work.mp4'];
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

function drawScreen(ctx, video) {
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
    ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
  }
  ctx.restore();
}

/**
 * Mounts the TV into `stage`. `onActivate` fires for a click on the model,
 * Enter/Space, or a click anywhere if the model failed to load.
 * Returns a cleanup function.
 */
export function mountLandingTv(stage, { reduce = false, onActivate } = {}) {
  let disposed = false;
  let raf = 0;
  let failed = false;
  const cleanups = [];

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
    const [{ GLTFLoader }, { RoomEnvironment }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ]);
    if (disposed) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    video.src = REELS[(Math.random() * REELS.length) | 0];
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

    function fit() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w < 2 || h < 2) return;
      renderer.setSize(w, h, false);
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

    on(stage, 'click', (e) => {
      if (failed || hit(e)) activate();
    });
    on(stage, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      stage.classList.toggle('is-hot', !failed && hit(e));
    });
    on(stage, 'pointerleave', () => stage.classList.remove('is-hot'));

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

    const tick = () => {
      raf = requestAnimationFrame(tick);
      drawScreen(ctx, video);
      tex.needsUpdate = true;
      const zooming = stage.classList.contains('is-zoomed');
      const goalX = !reduce && !zooming ? tx * MAX * 0.8 : 0;
      const goalY = !reduce && !zooming ? ty * MAX : 0;
      rx += (goalX - rx) * 0.08;
      ry += (goalY - ry) * 0.08;
      pivot.rotation.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), 0);
      renderer.render(scene, camera);
    };
    tick();

    cleanups.push(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.classList.remove('is-hot');
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

  return () => {
    disposed = true;
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
