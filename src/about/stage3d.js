/*
 * The 3D half of the ABOUT channel: the crew on turntables inside a closed showroom,
 * lit the way an early-2000s console game would (Dreamcast / early PS2).
 * three.js is only downloaded the first time the channel is opened.
 */

const TALL = 1.8; // every character is scaled to this height
const GAP = 1.22; // distance of each character from the centre
const STEP = 0.06; // turntable height
const RADIUS = 0.86; // turntable radius
const ROOM = 7.2; // how far the walls sit from the centre
const SHINE = 0.38; // how much of the reflection the floor lets through
const TAU = Math.PI * 2;
/* what each of the three passes of a frame draws */
const ACTORS = 0,
  FLOOR = 1,
  GLOSS = 2;

/* The locked slot: a silhouette, nothing to read on it. */
const SHADOW = {
  top: "#0c0c10", sleeve: "#0c0c10", legs: "#0c0c10", shoe: "#0c0c10", sole: "#0c0c10",
  skin: "#0c0c10", hair: "#0c0c10", hairW: 1.05, blank: true,
};
/* Mannequins standing in for the characters whose model has not been delivered yet. */
const DUMMY = [
  {
    top: "#1c1c20",
    sleeve: "#1c1c20",
    stripe: "#ece7dc",
    checks: true,
    legs: "#2a2a30",
    shoe: "#16161a",
    lace: "#d8d4cc",
    sole: "#cfcfcf",
    skin: "#d4a48a",
    hair: "#3a2a24",
    hairW: 1,
    quiff: true,
    stubble: true,
    hoops: true,
    brow: -0.4,
  },
  {
    top: "#3d68c4",
    sleeve: "#b7b7bc",
    cuff: "#3d68c4",
    legs: "#8eafd4",
    baggy: true,
    shoe: "#f2f2f2",
    lace: "#c5c8d0",
    sole: "#dedee2",
    skin: "#d4a48a",
    hair: "#4a3428",
    hairW: 1.16,
    curls: true,
    fringe: true,
    glasses: true,
    smile: true,
    beard: true,
    brow: 0.28,
    both: true,
  },
];

/**
 * Builds the scene for `crew`, drawn at W*scale x H*scale; `models` are the file names
 * available in /public/about. Rejects when WebGL is not available.
 */
export async function createStage({ W, H, scale, crew, models, reduce, palette }) {
  const THREE = await import("three");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.setSize(W * scale, H * scale, false);
  renderer.setClearColor(palette.sky, 1);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.sky, 9, 18);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);

  /* soft fill from above, warm key from the front-left, cool rim from behind */
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x2a2a36, 1.15));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(-2.8, 5.5, 5.5);
  const fill = new THREE.DirectionalLight(0xdde6ff, 0.9);
  fill.position.set(2.2, 2.5, 3);
  const rim = new THREE.DirectionalLight(0xa8c0ff, 1.8);
  rim.position.set(2.5, 3.2, -4.5);
  scene.add(key, fill, rim);
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const paintTexture = (size, paint) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    paint(cv.getContext("2d"), size / 2);
    const texture = new THREE.CanvasTexture(cv);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };

  /* closed room: a disc floor and a curved back wall, so nothing leaks past the CRT */
  const floorMap = paintTexture(512, (g, r) => {
    const base = g.createRadialGradient(r, r, r * 0.05, r, r, r);
    base.addColorStop(0, "#2a2a30");
    base.addColorStop(0.55, "#1a1a1e");
    base.addColorStop(1, "#0c0c10");
    g.fillStyle = base;
    g.fillRect(0, 0, r * 2, r * 2);
    g.strokeStyle = "rgba(255,255,255,.05)";
    g.lineWidth = 2;
    for (let i = 1; i <= 8; i++) {
      g.beginPath();
      g.arc(r, r, (r * i) / 8, 0, TAU);
      g.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      g.beginPath();
      g.moveTo(r, r);
      g.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r);
      g.stroke();
    }
    const edge = g.createRadialGradient(r, r, r * 0.72, r, r, r);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,.85)");
    g.fillStyle = edge;
    g.fillRect(0, 0, r * 2, r * 2);
  });
  const wallMap = paintTexture(512, (g, r) => {
    const sky = g.createLinearGradient(0, 0, 0, r * 2);
    sky.addColorStop(0, palette.sky);
    sky.addColorStop(0.55, palette.horizon);
    sky.addColorStop(1, "#1a1a1e");
    g.fillStyle = sky;
    g.fillRect(0, 0, r * 2, r * 2);
    g.fillStyle = "rgba(255,255,255,.03)";
    for (let y = 0; y < r * 2; y += 18) g.fillRect(0, y, r * 2, 1);
  });

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM, 72),
    new THREE.MeshStandardMaterial({
      map: floorMap,
      roughness: 0.35,
      metalness: 0.15,
      envMapIntensity: 0.4,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.layers.set(FLOOR);
  scene.add(floor);

  const gloss = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM, 72),
    new THREE.MeshBasicMaterial({
      color: palette.floor,
      transparent: true,
      opacity: 1 - SHINE,
      depthWrite: false,
    }),
  );
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.y = 0.001;
  gloss.layers.set(GLOSS);
  gloss.renderOrder = 1;
  scene.add(gloss);

  /* half-cylinder backdrop that wraps behind the crew and meets the floor */
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM * 0.98, ROOM * 0.98, 5.2, 48, 1, true, Math.PI * 0.15, Math.PI * 0.7),
    new THREE.MeshLambertMaterial({ map: wallMap, side: THREE.BackSide }),
  );
  wall.position.y = 2.4;
  wall.rotation.y = Math.PI;
  scene.add(wall);

  const world = new THREE.Group(); // everything that shows up in the floor reflection
  scene.add(world);

  const poolTexture = paintTexture(128, (g, r) => {
    const fade = g.createRadialGradient(r, r, 0, r, r, r);
    fade.addColorStop(0, "rgba(255,246,228,1)");
    fade.addColorStop(0.4, "rgba(255,246,228,.35)");
    fade.addColorStop(1, "rgba(255,246,228,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, r * 2, r * 2);
  });
  const discTexture = paintTexture(256, (g, r) => {
    g.fillStyle = "#303038";
    g.beginPath();
    g.arc(r, r, r - 2, 0, TAU);
    g.fill();
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      g.strokeStyle = `rgba(255,255,255,${i % 2 ? 0.08 : 0.035})`;
      g.beginPath();
      g.arc(r, r, 22 + i * 12, 0, TAU);
      g.stroke();
    }
    g.strokeStyle = palette.accent;
    g.lineWidth = 9;
    g.beginPath();
    g.arc(r, r, r - 10, 0, TAU);
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,.55)";
    g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU,
        from = r - (i % 6 ? 24 : 32);
      g.beginPath();
      g.moveTo(r + Math.cos(a) * from, r + Math.sin(a) * from);
      g.lineTo(r + Math.cos(a) * (r - 16), r + Math.sin(a) * (r - 16));
      g.stroke();
    }
    const shadow = g.createRadialGradient(r, r * 0.92, 4, r, r * 0.92, r * 0.55);
    shadow.addColorStop(0, "rgba(0,0,0,.65)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = shadow;
    g.fillRect(0, 0, r * 2, r * 2);
  });

  let loader = null;
  async function gltf(file) {
    if (!loader) {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      loader = new GLTFLoader();
    }
    return loader.loadAsync("/about/" + encodeURIComponent(file));
  }

  /* A delivered character: its own textures and normals, scaled to TALL with its feet on the turntable. */
  async function model(member, lit) {
    const main = await gltf(member.model);
    const body = main.scene,
      clips = [...main.animations];
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const swap = (m) => {
        if (m.map) m.map.anisotropy = 8;
        const hasMetalMap = !!m.metalnessMap;
        const params = {
          map: m.map || null,
          normalMap: m.normalMap || null,
          metalnessMap: m.metalnessMap || null,
          roughnessMap: m.roughnessMap || null,
          color: m.color || 0xffffff,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaTest: m.alphaTest,
          side: m.side,
          vertexColors: m.vertexColors,
          flatShading: false,
          roughness: m.roughness !== undefined ? m.roughness : 0.55,
          /* a metalness map already paints which parts are metal; a bare factor of 1 with no map turns the whole mesh into a black cutout */
          metalness: hasMetalMap ? (m.metalness !== undefined ? m.metalness : 1) : Math.min(m.metalness !== undefined ? m.metalness : 0.05, 0.35),
        };
        if (!hasMetalMap && params.metalness > 0.2 && params.map) {
          params.emissiveMap = params.map;
          params.emissive = new THREE.Color(0xffffff);
          params.emissiveIntensity = 0.55;
        }
        return lit(params);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });

    const pick = (name, words) => {
      if (name) return clips.find((c) => c.name === name) || null;
      for (const word of words) {
        const hit = clips.find((c) => c.name.toLowerCase().includes(word));
        if (hit) return hit;
      }
      return null;
    };
    const idleClip = pick(member.clips.idle, ["idle", "breath", "stand"]) || clips[0] || null;
    let cheerClip = null;
    if (member.selectModel && models.includes(member.selectModel))
      cheerClip = (await gltf(member.selectModel)).animations[0] || null;
    cheerClip =
      cheerClip ||
      pick(member.clips.select, ["select", "cheer", "victory", "win", "wave", "thumb", "jump", "dance"]) ||
      clips.find((c) => c !== idleClip) ||
      null;

    const mixer = idleClip || cheerClip ? new THREE.AnimationMixer(body) : null;
    const idle = idleClip ? mixer.clipAction(idleClip) : null,
      cheer = cheerClip ? mixer.clipAction(cheerClip) : null;
    if (idle) {
      idle.play();
      mixer.update(0);
    }
    if (cheer) {
      cheer.setLoop(THREE.LoopOnce, 1);
      cheer.clampWhenFinished = true;
      mixer.addEventListener("finished", () => {
        cheer.fadeOut(0.25);
        if (idle) idle.reset().fadeIn(0.25).play();
      });
    }

    const root = new THREE.Group();
    root.add(body);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body, true),
      size = box.getSize(new THREE.Vector3());
    body.position.x -= (box.min.x + box.max.x) / 2;
    body.position.y -= box.min.y;
    body.position.z -= (box.min.z + box.max.z) / 2;
    root.scale.setScalar(TALL / (size.y || 1));
    return { root, mixer, idle, cheer };
  }

  function dummy(look, lit) {
    const root = new THREE.Group(),
      paint = {};
    const add = (parent, geometry, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geometry, paint[color] || (paint[color] = lit({ color, roughness: 0.62, metalness: 0.08 })));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };
    const ball = (r) => new THREE.SphereGeometry(r, 36, 24),
      capsule = (r, length) => new THREE.CapsuleGeometry(r, length, 10, 24),
      tube = (top, bottom, height) => new THREE.CylinderGeometry(top, bottom, height, 28);
    const DARK = "#141418";

    const legR = look.baggy ? 0.155 : 0.13;
    for (const s of [-1, 1]) {
      add(root, ball(0.1), look.sole, s * 0.15, 0.03, 0.07, 1.05, 0.32, 2);
      add(root, ball(0.09), look.shoe, s * 0.15, 0.09, 0.05, 1, 0.55, 1.7);
      if (look.lace) add(root, new THREE.BoxGeometry(0.02, 0.012, 0.12), look.lace, s * 0.15, 0.1, 0.14);
      add(root, tube(legR, legR + 0.02, 0.82), look.legs, s * 0.15, 0.52, 0);
    }
    add(root, tube(0.27, 0.29, 0.11), look.legs, 0, 0.9, 0, 1, 1, 0.62);

    const upper = new THREE.Group();
    root.add(upper);
    add(upper, capsule(0.2, 0.28), look.top, 0, 1.25, 0, 1.42, 1, 0.82);
    add(upper, tube(0.3, 0.28, 0.08), look.top, 0, 0.98, 0, 1, 1, 0.6);
    add(upper, tube(0.055, 0.065, 0.08), look.skin, 0, 1.58, 0);
    const arms = [-1, 1].map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.32, 1.46, 0);
      upper.add(arm);
      add(arm, capsule(0.068, 0.48), look.sleeve, 0, -0.28, 0);
      if (look.cuff) add(arm, capsule(0.082, 0.12), look.cuff, 0, -0.1, 0);
      if (look.checks) {
        for (let i = 0; i < 5; i++) {
          add(arm, new THREE.BoxGeometry(0.018, 0.07, 0.04), i % 2 ? look.stripe : "#141418", s * 0.066, -0.1 - i * 0.085, 0);
        }
      }
      add(arm, ball(0.062), look.skin, 0, -0.6, 0.01);
      return arm;
    });

    const head = new THREE.Group();
    head.position.set(0, 1.72, 0);
    upper.add(head);
    add(head, ball(0.145), look.skin, 0, 0, 0, 0.9, 1.12, 0.96);
    if (look.stubble) add(head, ball(0.09), "#b8886e", 0, -0.04, 0.02, 0.95, 0.55, 0.7);
    const hair = add(
      head,
      new THREE.SphereGeometry(0.155, 36, 18, 0, TAU, 0, Math.PI * 0.52),
      look.hair,
      0,
      0.03,
      -0.02,
      0.98 * look.hairW,
      1.05,
      1.02,
    );
    hair.rotation.x = -0.4;
    if (look.quiff) {
      add(head, ball(0.055), look.hair, 0.01, 0.15, 0.07, 1.7, 0.85, 1.15);
      add(head, ball(0.04), look.hair, 0.02, 0.12, 0.1, 1.2, 0.6, 0.8);
    }
    if (look.fringe) add(head, ball(0.05), look.hair, 0, 0.08, 0.1, 1.5, 0.45, 0.7);
    if (look.curls) {
      for (const s of [-1, 1]) add(head, ball(0.07), look.hair, s * 0.12, 0.02, -0.02);
      add(head, ball(0.09), look.hair, 0, 0.02, -0.1);
    }
    if (look.beard) add(head, ball(0.04), look.hair, 0, -0.09, 0.1, 1.3, 0.7, 0.6);
    if (look.glasses) {
      for (const s of [-1, 1]) add(head, new THREE.TorusGeometry(0.042, 0.008, 10, 28), DARK, s * 0.055, 0.02, 0.125);
      add(head, new THREE.BoxGeometry(0.028, 0.008, 0.008), DARK, 0, 0.024, 0.132);
    }
    if (look.hoops) {
      for (const s of [-1, 1]) add(head, new THREE.TorusGeometry(0.018, 0.004, 6, 12), "#c9c3b4", s * 0.135, -0.02, 0.02);
    }
    if (!look.blank) {
      const WHITE = "#f4efe8";
      for (const s of [-1, 1]) {
        add(head, ball(0.02), WHITE, s * 0.05, 0.02, 0.125, 1, 0.75, 0.45);
        add(head, ball(0.011), DARK, s * 0.052, 0.018, 0.138);
      }
      add(head, ball(0.018), look.skin, 0, -0.01, 0.13, 0.7, 0.8, 0.8);
      const brow = look.brow || 0;
      for (const s of [-1, 1]) {
        const b = add(head, new THREE.BoxGeometry(0.04, 0.008, 0.01), look.hair, s * 0.05, 0.055, 0.128);
        b.rotation.z = s * brow;
      }
      if (look.smile) {
        const smile = add(head, new THREE.TorusGeometry(0.032, 0.006, 8, 16, Math.PI), "#8d4a42", 0, -0.055, 0.118);
        smile.rotation.z = Math.PI;
      } else add(head, new THREE.BoxGeometry(0.04, 0.007, 0.008), "#8d4a42", 0, -0.06, 0.128);
    }

    root.scale.setScalar(TALL / 1.93);
    return { root, upper, arms, head, both: !!look.both };
  }

  const chars = [];
  for (let i = 0; i < crew.length; i++) {
    const spin = new THREE.Group();
    spin.position.x = (i - (crew.length - 1) / 2) * GAP * 2;
    world.add(spin);
    const mats = [];
    const lit = (params) => {
      const m = new THREE.MeshStandardMaterial({
        roughness: 0.55,
        metalness: 0.08,
        ...params,
      });
      mats.push({ m, color: m.color.clone(), emissive: m.emissive.clone() });
      return m;
    };
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS * 1.04, STEP, 64, 1, true),
      lit({ color: "#3c3c44", roughness: 0.3, metalness: 0.55 }),
    );
    side.position.y = STEP / 2;
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS, 64),
      lit({ map: discTexture, roughness: 0.35, metalness: 0.4 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = STEP;
    const hop = new THREE.Group();
    spin.add(side, top, hop);

    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({
        map: poolTexture,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(spin.position.x, 0.008, 0);
    pool.layers.set(GLOSS);
    pool.renderOrder = 2;
    scene.add(pool);

    let body = null;
    if (models.includes(crew[i].model)) {
      try {
        body = await model(crew[i], lit);
      } catch (e) {
        console.warn(`ABOUT: could not load ${crew[i].model}, using the mannequin`, e);
      }
    }
    if (!body) body = dummy(crew[i].locked ? SHADOW : DUMMY[i % DUMMY.length], lit);
    hop.add(body.root);
    chars.push({
      ...body,
      x: spin.position.x,
      home: spin.position.x,
      spin,
      hop,
      pool,
      mats,
      level: 0,
      shown: -1,
      rot: 0,
      t: i * 1.7,
      act: null,
    });
  }

  /* Changing character: the one on stage spins and shrinks away, then the next spins up into place. */
  let who = 0,
    swap = null;
  function present(i) {
    if (!swap) return i === who ? { s: 1, spin: 0, show: true } : { s: 0, spin: 0, show: false };
    if (i === swap.from && swap.t < swap.out) {
      const k = swap.t / swap.out;
      return { s: Math.max(0, 1 - k * k), spin: swap.dir * k * Math.PI * 2.6, show: k < 0.97 };
    }
    const start = swap.out * 0.7;
    if (i === swap.to && swap.t >= start) {
      const k = Math.min(1, (swap.t - start) / swap.inn),
        e = 1 - Math.pow(1 - k, 3);
      return { s: e, spin: swap.dir * (1 - e) * Math.PI * 1.7, show: e > 0.02 };
    }
    return { s: 0, spin: 0, show: false };
  }

  function shade(ch) {
    if (Math.abs(ch.level - ch.shown) < 0.004) return;
    ch.shown = ch.level;
    const k = Math.pow(ch.level, 1.8);
    for (const { m, color, emissive } of ch.mats) {
      m.color.copy(color).multiplyScalar(0.28 + 0.72 * k);
      m.emissive.copy(emissive).multiplyScalar(k);
    }
    ch.pool.material.opacity = 0.55 * k;
  }
  function pose(ch, dt) {
    ch.t += dt;
    let lift = 0,
      up = 0;
    if (ch.act) {
      ch.act.t += dt;
      const p = ch.act.t / ch.act.dur;
      if (p >= 1) ch.act = null;
      else {
        if (!reduce) lift = Math.abs(Math.sin(p * TAU)) * 0.28 * (1 - p * 0.4);
        up = Math.min(1, p * 6) * Math.min(1, (1 - p) * 5);
      }
    }
    ch.hop.position.y = STEP + lift;
    if (ch.mixer) ch.mixer.update(dt);
    if (!ch.arms) return;
    const sway = reduce ? 0 : Math.sin(ch.t * 2.2);
    ch.upper.position.y = sway * 0.01;
    ch.head.rotation.y = reduce ? 0 : Math.sin(ch.t * 0.7) * 0.16;
    ch.arms.forEach((arm, n) => {
      const raise = ch.both || n ? up : 0;
      arm.rotation.z = (n ? 1 : -1) * (0.1 + sway * 0.02 + raise * 2.6);
    });
  }

  const eye = new THREE.Vector3(0, 1.05, 5.6),
    aim = new THREE.Vector3(0, 0.85, 0),
    toEye = eye.clone(),
    toAim = aim.clone(),
    probe = new THREE.Vector3();
  function frame(mode) {
    /* select keeps the character right of centre, so the skill sheet on the left stays clear of it */
    if (mode === "select") {
      toEye.set(0, 1.02, 5.05);
      toAim.set(0, 0.95, 0);
    } else if (mode === "chosen") {
      toEye.set(0, 1.02, 4.7);
      toAim.set(0, 0.95, 0);
    } else if (mode === "talk") {
      toEye.set(0, 1.18, 4.15);
      toAim.set(0, 1.05, 0);
    } else {
      toEye.set(0, 1.05, 5.6);
      toAim.set(0, 0.85, 0);
    }
  }
  function flip() {
    world.scale.y *= -1;
    key.position.y *= -1;
    fill.position.y *= -1;
    rim.position.y *= -1;
  }
  function render() {
    renderer.clear();
    camera.layers.set(FLOOR);
    renderer.render(scene, camera);
    renderer.clearDepth();
    camera.layers.set(ACTORS);
    flip();
    renderer.render(scene, camera);
    flip();
    renderer.clearDepth();
    camera.layers.enable(GLOSS);
    renderer.render(scene, camera);
  }

  return {
    canvas: renderer.domElement,
    /** Advances and draws one frame. mode: "title" | "select" | "chosen" | "talk". */
    update(dt, { mode, focus, picked }) {
      const solo = mode !== "title",
        target = mode === "select" ? focus : picked;
      if (mode === "select") {
        const current = swap ? swap.to : who;
        if (target !== current) {
          let delta = target - current;
          const n = chars.length;
          delta = ((delta % n) + n) % n;
          if (delta > n / 2) delta -= n;
          swap = {
            from: current,
            to: target,
            dir: delta >= 0 ? 1 : -1,
            t: 0,
            out: reduce ? 0.01 : 0.5,
            inn: reduce ? 0.01 : 0.42,
          };
        }
        if (swap) {
          swap.t += dt;
          if (swap.t >= swap.out * 0.7 + swap.inn) {
            who = swap.to;
            swap = null;
          }
        }
      } else {
        swap = null;
        who = target;
      }
      frame(mode);
      const k = reduce ? 1 : 1 - Math.exp(-dt * (mode === "chosen" ? 4 : 7)),
        k2 = reduce ? 1 : 1 - Math.exp(-dt * 10);
      eye.lerp(toEye, k);
      aim.lerp(toAim, k);
      camera.position.copy(eye);
      camera.lookAt(aim);
      chars.forEach((ch, i) => {
        ch.spin.position.x += ((solo ? 0 : ch.home) - ch.spin.position.x) * k2;
        ch.pool.position.x = ch.spin.position.x;
        if (mode === "select") {
          const v = present(i);
          ch.hop.scale.setScalar(v.s);
          ch.hop.rotation.y = v.spin;
          ch.hop.visible = v.show;
          ch.spin.visible = ch.pool.visible =
            v.show || (!swap ? i === who : swap.t < swap.out ? i === swap.from : i === swap.to);
          if (v.show) ch.level = 1;
          else ch.level += (0 - ch.level) * k2;
        } else if (solo) {
          const on = i === target;
          ch.hop.scale.setScalar(on ? 1 : 0);
          ch.hop.rotation.y += (0 - ch.hop.rotation.y) * k2;
          ch.hop.visible = on;
          ch.spin.visible = on;
          ch.pool.visible = on && mode !== "talk";
          ch.level += ((on ? 1 : 0) - ch.level) * k2;
        } else {
          ch.hop.scale.setScalar(1);
          ch.hop.rotation.y = 0;
          ch.hop.visible = ch.spin.visible = ch.pool.visible = true;
          ch.level += (0.15 - ch.level) * k2;
        }
        shade(ch);
        if (i === who && mode === "select" && !swap && !reduce) ch.rot += dt * 0.85;
        else {
          ch.rot -= Math.round(ch.rot / TAU) * TAU;
          ch.rot += ((mode === "talk" ? 0.15 : 0) - ch.rot) * k2;
        }
        ch.spin.rotation.y = ch.rot;
        pose(ch, dt);
      });
      render();
    },
    /** Plays the select animation of character `i`; returns its length in seconds. */
    play(i) {
      const ch = chars[i];
      if (ch.cheer) {
        if (ch.idle) ch.idle.fadeOut(0.15);
        ch.cheer.reset().fadeIn(0.15).play();
        return ch.cheer.getClip().duration;
      }
      ch.act = { t: 0, dur: 1.2 };
      return ch.act.dur;
    },
    /** Everyone back to idle, facing front. */
    rest() {
      swap = null;
      who = 0;
      for (const ch of chars) {
        ch.act = null;
        ch.rot = 0;
        ch.spin.position.x = ch.home;
        ch.hop.scale.setScalar(1);
        ch.hop.rotation.y = 0;
        ch.hop.visible = true;
        if (ch.cheer) ch.cheer.stop();
        if (ch.idle) ch.idle.reset().setEffectiveWeight(1).play();
      }
    },
    /** Where a point `height` above character `i`'s floor lands on the TV picture, as [x, y]. */
    at(i, height) {
      probe.set(chars[i].spin.position.x, height, 0).project(camera);
      return [(probe.x * 0.5 + 0.5) * W, (0.5 - probe.y * 0.5) * H];
    },
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      if (scene.environment) scene.environment.dispose();
      renderer.forceContextLoss();
    },
  };
}
