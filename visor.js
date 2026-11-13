import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

function cssVar(n, d) { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }

function montar(host, D) {
  const W = D.ancho, H = D.alto, L = D.largo;
  host.innerHTML = '';
  host.style.position = 'relative';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const lr = new CSS2DRenderer();
  Object.assign(lr.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
  host.appendChild(lr.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 10000);
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7a6a, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(380, 560, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const ext = Math.max(W, H, L) * 1.4;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 3000 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe9d6, 0.6); fill.position.set(-400, 200, -300); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const shape = new THREE.Shape(D.marco.map(p => new THREE.Vector2(p[0] - W / 2, p[1] - H / 2)));
  D.huecos.forEach(h => shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0] - W / 2, p[1] - H / 2)))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -L / 2);
  geo.computeVertexNormals();
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#bfbfbf'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) { const v = 150 + Math.random() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.03, 0.03); return t;
  })();
  const mat = new THREE.MeshStandardMaterial({ color: D.color || 0xc0603a, roughness: 0.88, metalness: 0, bumpMap: tex, bumpScale: 0.35 });
  const brick = new THREE.Group();
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; brick.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), new THREE.LineBasicMaterial({ color: 0x5a2a17, transparent: true, opacity: 0.5 }));
  brick.add(edges);
  let verde = null;
  if (D.verde) {
    const Wv = D.verde.ancho, Hv = D.verde.alto;
    const g = new THREE.Group();
    const lm = new THREE.LineBasicMaterial({ color: 0x2a78d6 });
    [D.verde.marco].concat(D.verde.huecos).forEach(p => g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p.map(q => new THREE.Vector3(q[0] - Wv / 2, q[1] - Hv / 2, L / 2 + 0.4))), lm)));
    g.visible = false;
    brick.add(g);
    verde = g;
  }
  const dims = new THREE.Group();
  const acc = cssVar('--info', '#2a78d6');
  const dmat = new THREE.LineBasicMaterial({ color: acc });
  const cono = new THREE.MeshBasicMaterial({ color: acc });
  function cota(a, b, off, texto) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), O = new THREE.Vector3(...off);
    const a2 = A.clone().add(O), b2 = B.clone().add(O);
    dims.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([A, a2, B, b2, a2, b2]), dmat));
    const dir = b2.clone().sub(a2).normalize(), s = 6;
    [[a2, dir], [b2, dir.clone().negate()]].forEach(([p, d]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, s, 12), cono);
      c.position.copy(p.clone().add(d.clone().multiplyScalar(s / 2)));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate());
      dims.add(c);
    });
    const el = document.createElement('div');
    el.className = 'v3-lbl';
    el.textContent = texto;
    const o = new CSS2DObject(el);
    o.position.copy(a2.clone().add(b2).multiplyScalar(0.5));
    dims.add(o);
  }
  const f1 = v => v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mm';
  cota([-W / 2, -H / 2, L / 2], [W / 2, -H / 2, L / 2], [0, -22, 0], f1(W));
  cota([W / 2, -H / 2, L / 2], [W / 2, H / 2, L / 2], [22, 0, 0], f1(H));
  cota([W / 2, -H / 2, L / 2], [W / 2, -H / 2, -L / 2], [22, -22, 0], f1(L));
  brick.add(dims);
  scene.add(brick);

  let pose = 'obra', vista = 'iso';
  function aplicarPose() {
    if (pose === 'obra') { brick.rotation.set(-Math.PI / 2, 0, 0); brick.position.set(0, L / 2, 0); }
    else { brick.rotation.set(0, 0, 0); brick.position.set(0, H / 2, 0); }
    brick.updateMatrixWorld(true);
  }
  function ponerCam() {
    const alto = pose === 'obra' ? L : H;
    const c = new THREE.Vector3(0, alto / 2, 0);
    const R = 1.8 * Math.max(W, H, L);
    const P = pose === 'obra'
      ? { iso: [0.75, 0.62, -0.95], front: [0, 1.15, -0.001], top: [0, 0.02, -1.15], side: [1.15, 0.02, 0] }[vista]
      : { iso: [0.75, 0.55, 1.0], front: [0, 0, 1.15], top: [0, 1.15, 0.001], side: [1.15, 0, 0] }[vista];
    cam.position.set(c.x + P[0] * R, c.y + P[1] * R, c.z + P[2] * R);
    ctl.target.copy(c);
    ctl.update();
  }
  aplicarPose(); ponerCam();
  function size() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height); lr.setSize(r.width, r.height);
    cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(size); ro.observe(host); size();
  let vivo = true;
  (function loop() { if (!vivo) return; requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam); lr.render(scene, cam); })();
  return {
    pose(p) { pose = p; aplicarPose(); ponerCam(); },
    vista(v) { vista = v; ponerCam(); },
    mostrar(k, on) { if (k === 'cotas') dims.visible = on; if (k === 'aristas') edges.visible = on; if (k === 'verde' && verde) verde.visible = on; },
    captura() { renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png'); },
    destruir() {
      vivo = false; ro.disconnect();
      geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose();
      host.innerHTML = '';
    }
  };
}

window.Visor3D = { montar };
window.dispatchEvent(new Event('visor3d-listo'));
