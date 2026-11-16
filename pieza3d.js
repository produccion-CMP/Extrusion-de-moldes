import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const OCCT = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';
const SEG_REV = 96;
let csgMod = null;

async function csg() {
  if (!csgMod) csgMod = await import('three-bvh-csg');
  return csgMod;
}

function bb2(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function bbFormas(formas) { return bb2(formas.flatMap(f => f.outer)); }

function areaS(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return s / 2; }

function local(formas, esc, b) {
  const t = p => [(p[0] - b.cx) * esc, (p[1] - b.cy) * esc];
  return formas.map(f => ({ outer: f.outer.map(t), holes: f.holes.map(h => h.map(t)) }));
}

function shapes(formas) {
  return formas.map(f => {
    const o = areaS(f.outer) < 0 ? f.outer.slice().reverse() : f.outer;
    const s = new THREE.Shape(o.map(p => new THREE.Vector2(p[0], p[1])));
    f.holes.forEach(h => s.holes.push(new THREE.Path((areaS(h) > 0 ? h.slice().reverse() : h).map(p => new THREE.Vector2(p[0], p[1])))));
    return s;
  });
}

function extruir(formas, prof) {
  const g = new THREE.ExtrudeGeometry(shapes(formas), { depth: prof, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -prof / 2);
  return g;
}

const MAT = {
  frente: s => new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1),
  planta: s => s > 0 ? new THREE.Matrix4().identity() : new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1),
  lateral: s => s > 0 ? new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1) : new THREE.Matrix4().set(0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)
};

function signos(def) {
  const tercer = def.proyeccion === 'A';
  const sp = (def.posPlanta || 'abajo') === 'abajo' ? 1 : -1;
  const sl = (def.posLateral || 'der') === 'der' ? -1 : 1;
  return { planta: tercer ? -sp : sp, lateral: tercer ? -sl : sl };
}

function clipSemi(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

function ejeRev(eje, b) {
  if (eje === 'v') return { f: p => p[0] - b.cx, rh: p => [p[0] - b.cx, p[1]], vertical: true };
  if (eje === 'izq') return { f: p => p[0] - b.x0, rh: p => [p[0] - b.x0, p[1]], vertical: true };
  if (eje === 'der') return { f: p => b.x1 - p[0], rh: p => [b.x1 - p[0], p[1]], vertical: true };
  if (eje === 'inf') return { f: p => p[1] - b.y0, rh: p => [p[1] - b.y0, p[0]], vertical: false };
  if (eje === 'sup') return { f: p => b.y1 - p[1], rh: p => [b.y1 - p[1], p[0]], vertical: false };
  return { f: p => p[1] - b.cy, rh: p => [p[1] - b.cy, p[0]], vertical: false };
}

function revolucion(formas, eje) {
  const b = bbFormas(formas);
  const E = ejeRev(eje, b);
  const polis = [];
  formas.forEach(f => {
    [f.outer].concat(f.holes).forEach((p, k) => {
      const c = clipSemi(p, E.f);
      if (c.length < 3) return;
      const rh = c.map(q => { const v = E.rh(q); return [Math.max(0, v[0]), v[1]]; });
      if (Math.abs(areaS(rh)) < 1e-6) return;
      polis.push({ rh, hueco: k > 0 });
    });
  });
  if (!polis.length) throw new Error('El perfil no tiene material de un lado del eje elegido');
  const partes = [];
  let vol = 0, sup = 0;
  polis.forEach(({ rh, hueco }) => {
    const ccw = areaS(rh) > 0;
    const pts = ccw ? rh : rh.slice().reverse();
    let mom = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const cr = a[0] * c[1] - c[0] * a[1];
      mom += (a[0] + c[0]) * cr;
      if (a[0] < 1e-9 && c[0] < 1e-9) continue;
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 1e-9) continue;
      sup += 2 * Math.PI * (a[0] + c[0]) / 2 * L;
      const seg = hueco ? [new THREE.Vector2(c[0], c[1]), new THREE.Vector2(a[0], a[1])] : [new THREE.Vector2(a[0], a[1]), new THREE.Vector2(c[0], c[1])];
      const g = new THREE.LatheGeometry(seg, SEG_REV);
      partes.push(g.index ? g.toNonIndexed() : g);
    }
    vol += (hueco ? -1 : 1) * Math.PI * Math.abs(mom) / 3;
  });
  const geo = mergeGeometries(partes.map(g => { g.deleteAttribute('uv'); return g; }));
  partes.forEach(g => g.dispose());
  if (E.vertical) geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  else geo.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  return { geo, volumen: vol, superficie: sup, abierta: true };
}

function medirMalla(geo) {
  const p = geo.attributes.position, ix = geo.index;
  const n = ix ? ix.count : p.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let v = 0, s = 0;
  for (let i = 0; i < n; i += 3) {
    const i0 = ix ? ix.getX(i) : i, i1 = ix ? ix.getX(i + 1) : i + 1, i2 = ix ? ix.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
    v += a.dot(ab.copy(b).cross(c)) / 6;
    s += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
  }
  return { volumen: Math.abs(v), superficie: s };
}

async function construir(def) {
  const esc = def.escala || 1;
  const V = def.vistas || {};
  let geo, med;
  if (def.metodo === 'malla') {
    geo = decodificarMalla(def.malla);
    if (def.arriba === 'y') geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    if (def.arriba === 'x') geo.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    med = medirMalla(geo);
  } else {
    if (!V.frente || !V.frente.formas || !V.frente.formas.length) throw new Error('Falta la vista principal');
    const bF = bbFormas(V.frente.formas);
    const F = local(V.frente.formas, esc, bF);
    if (def.metodo === 'revolucion') {
      const r = revolucion(F, def.eje || 'h');
      geo = r.geo; med = { volumen: r.volumen, superficie: r.superficie };
    } else if (def.metodo === 'vistas' && (V.planta || V.lateral)) {
      const { Brush, Evaluator, INTERSECTION } = await csg();
      const s = signos(def);
      const dims = [bF.w * esc, bF.h * esc];
      if (V.planta) { const b = bbFormas(V.planta.formas); dims.push(b.w * esc, b.h * esc); }
      if (V.lateral) { const b = bbFormas(V.lateral.formas); dims.push(b.w * esc, b.h * esc); }
      const D = 2.4 * Math.max(...dims);
      const brush = (formas, m) => { const g = extruir(formas, D); g.applyMatrix4(m); g.deleteAttribute('uv'); g.computeVertexNormals(); const br = new Brush(g); br.updateMatrixWorld(); return br; };
      const ev = new Evaluator();
      ev.attributes = ['position', 'normal'];
      let acc = brush(F, MAT.frente());
      ['planta', 'lateral'].forEach(k => {
        if (!V[k]) return;
        const b = bbFormas(V[k].formas);
        acc = ev.evaluate(acc, brush(local(V[k].formas, esc, b), MAT[k](s[k])), INTERSECTION);
      });
      geo = acc.geometry.clone();
      med = medirMalla(geo);
    } else {
      let prof = +def.espesor || 0;
      if (!prof && V.planta) prof = bbFormas(V.planta.formas).h * esc;
      if (!prof && V.lateral) prof = bbFormas(V.lateral.formas).w * esc;
      if (!prof) prof = 10;
      geo = extruir(F, prof);
      geo.applyMatrix4(MAT.frente());
      med = medirMalla(geo);
    }
  }
  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  geo.translate(-c.x, -c.y, -geo.boundingBox.min.z);
  if (def.metodo !== 'revolucion') {
    Object.keys(geo.attributes).forEach(k => { if (k !== 'position') geo.deleteAttribute(k); });
    geo = toCreasedNormals(geo, Math.PI / 6);
  }
  geo.computeBoundingBox();
  const s3 = new THREE.Vector3();
  geo.boundingBox.getSize(s3);
  const tri = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  return { geo, medidas: { largo: s3.x, ancho: s3.y, alto: s3.z, volumen: med.volumen, superficie: med.superficie, triangulos: Math.round(tri) } };
}

function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function deB64(t) { const s = atob(t); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

function codificarMalla(geo) {
  const g = geo.index ? geo : mergeVertices(geo, 1e-4);
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const p = g.attributes.position, n = p.count;
  const q = new Uint16Array(n * 3);
  const r = [max.x - min.x || 1, max.y - min.y || 1, max.z - min.z || 1], m = [min.x, min.y, min.z];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) q[i * 3 + k] = Math.round((p.array[i * 3 + k] - m[k]) / r[k] * 65535);
  const ix = g.index.array;
  const largo = n > 65535;
  const I = largo ? Uint32Array.from(ix) : Uint16Array.from(ix);
  return { b: [min.x, min.y, min.z, max.x, max.y, max.z], n, p: b64(new Uint8Array(q.buffer)), i: b64(new Uint8Array(I.buffer)), i32: largo };
}

function decodificarMalla(M) {
  const q = new Uint16Array(deB64(M.p).buffer);
  const raw = deB64(M.i).buffer;
  const I = M.i32 ? new Uint32Array(raw) : new Uint16Array(raw);
  const pos = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = M.b[k] + q[i] / 65535 * (M.b[k + 3] - M.b[k]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  return g;
}

function cargarScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

async function leerArchivo3D(nombre, buf) {
  const ext = nombre.toLowerCase().split('.').pop();
  let geo;
  if (ext === 'stl') {
    geo = new STLLoader().parse(buf);
  } else if (ext === 'obj') {
    const grp = new OBJLoader().parse(new TextDecoder().decode(buf));
    const gs = [];
    grp.traverse(o => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); Object.keys(g.attributes).forEach(k => { if (k !== 'position') g.deleteAttribute(k); }); gs.push(g.index ? g.toNonIndexed() : g); } });
    if (!gs.length) throw new Error('El OBJ no tiene mallas');
    geo = mergeGeometries(gs);
  } else if (['step', 'stp', 'iges', 'igs', 'brep'].includes(ext)) {
    if (!window.occtimportjs) await cargarScript(OCCT + 'occt-import-js.js');
    const occt = await window.occtimportjs({ locateFile: f => OCCT + f });
    const u8 = new Uint8Array(buf);
    const prm = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0015, angularDeflection: 0.35 };
    const r = ext === 'brep' ? occt.ReadBrepFile(u8, prm) : (ext === 'iges' || ext === 'igs') ? occt.ReadIgesFile(u8, prm) : occt.ReadStepFile(u8, prm);
    if (!r || !r.success || !r.meshes.length) throw new Error('No se pudo leer el archivo ' + ext.toUpperCase());
    const gs = r.meshes.map(m => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
      if (m.index) g.setIndex(Array.from(m.index.array));
      return g.index ? g.toNonIndexed() : g;
    });
    geo = mergeGeometries(gs);
  } else throw new Error('Formato no admitido: ' + ext);
  Object.keys(geo.attributes).forEach(k => { if (k !== 'position') geo.deleteAttribute(k); });
  geo = mergeVertices(geo, 1e-4);
  const tri = geo.index.count / 3;
  return { malla: codificarMalla(geo), triangulos: tri };
}

function aristas(geo, grados) {
  geo.computeBoundingSphere();
  const p = geo.attributes.position, ix = geo.index;
  const n = ix ? ix.count : p.count;
  const R = Math.max(1e-9, geo.boundingSphere.radius) * 1e-5;
  const q = i => Math.round(p.getX(i) / R) + ',' + Math.round(p.getY(i) / R) + ',' + Math.round(p.getZ(i) / R);
  const mapa = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    const ids = [ix ? ix.getX(t) : t, ix ? ix.getX(t + 1) : t + 1, ix ? ix.getX(t + 2) : t + 2];
    a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
    const nrm = u.subVectors(b, a).cross(w.subVectors(c, a));
    if (nrm.lengthSq() < 1e-24) continue;
    nrm.normalize();
    const k = ids.map(q);
    for (let e = 0; e < 3; e++) {
      const k1 = k[e], k2 = k[(e + 1) % 3];
      if (k1 === k2) continue;
      const key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      const reg = mapa.get(key);
      if (reg) reg.ns.push(nrm.clone());
      else mapa.set(key, { i: ids[e], j: ids[(e + 1) % 3], ns: [nrm.clone()] });
    }
  }
  const cosLim = Math.cos(grados * Math.PI / 180);
  const out = [];
  for (const r of mapa.values()) {
    if (r.ns.length !== 2 || r.ns[0].dot(r.ns[1]) > cosLim) continue;
    out.push(p.getX(r.i), p.getY(r.i), p.getZ(r.i), p.getX(r.j), p.getY(r.j), p.getZ(r.j));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

function cssVar(n, d) { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }

function montar(host, geo, D) {
  D = D || {};
  host.innerHTML = '';
  host.style.position = 'relative';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.localClippingEnabled = true;
  host.appendChild(renderer.domElement);
  const lr = new CSS2DRenderer();
  Object.assign(lr.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
  host.appendChild(lr.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  geo.computeBoundingBox();
  const sz = new THREE.Vector3();
  geo.boundingBox.getSize(sz);
  const R0 = Math.max(sz.x, sz.y, sz.z) || 1;
  const cam = new THREE.PerspectiveCamera(30, 1, R0 / 100, R0 * 60);
  cam.up.set(0, 0, 1);
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.enableDamping = true;
  let auto = D.autoGiro !== false;
  ctl.addEventListener('start', () => { auto = false; });
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(R0 * 1.2, -R0 * 0.8, R0 * 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -R0 * 1.5, right: R0 * 1.5, top: R0 * 1.5, bottom: -R0 * 1.5, near: R0 / 50, far: R0 * 8 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = R0 * 0.004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.5));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(R0 * 40, R0 * 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.receiveShadow = true;
  scene.add(ground);
  const corte = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const mat = new THREE.MeshStandardMaterial({ color: D.color || 0xc3ccd5, metalness: 0.5, roughness: 0.36, envMapIntensity: 1.25, side: THREE.DoubleSide, clipShadows: true });
  const giro = new THREE.Group();
  scene.add(giro);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  giro.add(mesh);
  const edges = new THREE.LineSegments(aristas(geo, 24), new THREE.LineBasicMaterial({ color: 0x1f2933, transparent: true, opacity: 0.55 }));
  giro.add(edges);
  const dims = new THREE.Group();
  const acc = cssVar('--info', '#2a78d6');
  const dmat = new THREE.LineBasicMaterial({ color: acc });
  const cota = (a, b, off, txt) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), O = new THREE.Vector3(...off);
    const a2 = A.clone().add(O), b2 = B.clone().add(O);
    dims.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([A, a2, B, b2, a2, b2]), dmat));
    const el = document.createElement('div'); el.className = 'v3-lbl'; el.textContent = txt;
    const o = new CSS2DObject(el); o.position.copy(a2.clone().add(b2).multiplyScalar(0.5)); dims.add(o);
  };
  const f1 = v => v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mm';
  const bx = geo.boundingBox, g0 = R0 * 0.12;
  cota([bx.min.x, bx.min.y, 0], [bx.max.x, bx.min.y, 0], [0, -g0, 0], f1(sz.x));
  cota([bx.max.x, bx.min.y, 0], [bx.max.x, bx.max.y, 0], [g0, 0, 0], f1(sz.y));
  cota([bx.max.x, bx.min.y, 0], [bx.max.x, bx.min.y, bx.max.z], [g0, -g0, 0], f1(sz.z));
  giro.add(dims);
  let vista = 'iso';
  const ponerCam = () => {
    const c = new THREE.Vector3(0, 0, sz.z / 2), R = 2.1 * R0;
    const P = { iso: [0.85, -1.1, 0.75], frente: [0, -1.25, 0.001], planta: [0, -0.001, 1.25], lateral: [-1.25, 0, 0.001] }[vista];
    cam.position.set(c.x + P[0] * R, c.y + P[1] * R, c.z + P[2] * R);
    ctl.target.copy(c); ctl.update();
  };
  ponerCam();
  const size = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height); lr.setSize(r.width, r.height);
    cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size); ro.observe(host); size();
  let vivo = true, grabando = false, tPrev = performance.now();
  (function loop() {
    if (!vivo) return;
    requestAnimationFrame(loop);
    const t = performance.now(), dt = Math.min(0.1, (t - tPrev) / 1000);
    tPrev = t;
    if (grabando) return;
    if (auto) giro.rotation.z += (2 * Math.PI / 16) * dt;
    ctl.update();
    renderer.render(scene, cam);
    lr.render(scene, cam);
  })();
  const cargarMuxer = () => window.WebMMuxer ? Promise.resolve() : cargarScript('https://cdn.jsdelivr.net/npm/webm-muxer@5.0.3/build/webm-muxer.js');
  async function grabar(seg, ancho, alto, onProg) {
    if (!(window.VideoEncoder && window.VideoFrame)) throw new Error('Este navegador no puede grabar video');
    await cargarMuxer();
    const W0 = ancho || 960, H0 = alto || 600, fps = 30, n = Math.round((seg || 6) * fps);
    let codec = 'vp09.00.10.08', mk = 'V_VP9';
    const cfg = c => ({ codec: c, width: W0, height: H0, bitrate: 5e6, framerate: fps });
    if (!(await VideoEncoder.isConfigSupported(cfg(codec))).supported) { codec = 'vp8'; mk = 'V_VP8'; }
    if (!(await VideoEncoder.isConfigSupported(cfg(codec))).supported) throw new Error('Sin códec de video');
    const muxer = new WebMMuxer.Muxer({ target: new WebMMuxer.ArrayBufferTarget(), video: { codec: mk, width: W0, height: H0, frameRate: fps } });
    let fallo = null;
    const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { fallo = e; } });
    enc.configure(cfg(codec));
    const r0 = host.getBoundingClientRect(), v0 = vista, rz = giro.rotation.z;
    grabando = true;
    renderer.setPixelRatio(1); renderer.setSize(W0, H0, false);
    cam.aspect = W0 / H0; cam.updateProjectionMatrix();
    dims.visible = false;
    vista = 'iso'; ponerCam();
    const fondo = scene.background;
    scene.background = new THREE.Color(0xeef1f4);
    const lienzo = document.createElement('canvas'); lienzo.width = W0; lienzo.height = H0;
    const g2 = lienzo.getContext('2d');
    try {
      for (let i = 0; i < n; i++) {
        if (fallo) throw fallo;
        giro.rotation.z = 2 * Math.PI * i / n;
        renderer.render(scene, cam);
        g2.drawImage(renderer.domElement, 0, 0, W0, H0);
        if (D.titulo) {
          g2.fillStyle = 'rgba(255,255,255,.9)'; g2.fillRect(0, H0 - 74, W0, 74);
          g2.fillStyle = '#2a78d6'; g2.fillRect(0, H0 - 74, 6, 74);
          g2.fillStyle = '#1f2933'; g2.font = '700 24px "Plus Jakarta Sans", Arial, sans-serif'; g2.fillText(D.titulo, 22, H0 - 42);
          g2.fillStyle = '#5b6570'; g2.font = '500 17px "Plus Jakarta Sans", Arial, sans-serif'; g2.fillText(D.subtitulo || '', 22, H0 - 16);
        }
        const fr = new VideoFrame(lienzo, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(fr, { keyFrame: i % 60 === 0 }); fr.close();
        while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5));
        if (i % 10 === 0) { if (onProg) onProg(Math.round(100 * i / n)); await new Promise(r => setTimeout(r, 0)); }
      }
      await enc.flush();
      muxer.finalize();
    } finally {
      scene.background = fondo; grabando = false; dims.visible = true;
      giro.rotation.z = rz;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      vista = v0; ponerCam();
      renderer.setSize(r0.width, r0.height);
      cam.aspect = r0.width / r0.height; cam.updateProjectionMatrix();
    }
    return { blob: new Blob([muxer.target.buffer], { type: 'video/webm' }), mime: 'video/webm', ext: 'webm' };
  }
  return {
    vista(v) { vista = v; auto = false; giro.rotation.z = 0; ponerCam(); },
    mostrar(k, on) {
      if (k === 'cotas') dims.visible = on;
      if (k === 'aristas') edges.visible = on;
      if (k === 'corte') { auto = false; giro.rotation.z = 0; mat.clippingPlanes = on ? [corte] : []; edges.visible = !on; mat.needsUpdate = true; }
    },
    captura(w, h, tipo, q) {
      if (w && h) {
        const r0 = host.getBoundingClientRect();
        const fondo = scene.background, dv = dims.visible;
        if (tipo === 'image/jpeg') { scene.background = new THREE.Color(0xeef1f4); dims.visible = false; }
        renderer.setPixelRatio(1); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        renderer.render(scene, cam);
        const u = renderer.domElement.toDataURL(tipo || 'image/png', q || 0.8);
        scene.background = fondo; dims.visible = dv;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(r0.width, r0.height); cam.aspect = r0.width / r0.height; cam.updateProjectionMatrix();
        return u;
      }
      renderer.render(scene, cam);
      return renderer.domElement.toDataURL(tipo || 'image/png', q || 0.9);
    },
    grabar,
    puedeGrabar: () => !!(window.VideoEncoder && window.VideoFrame),
    girar(on) { auto = !!on; },
    rotular(t, st) { if (t) D.titulo = t; if (st !== undefined) D.subtitulo = st; },
    stl() { return new STLExporter().parse(mesh, { binary: true }); },
    destruir() { vivo = false; ro.disconnect(); geo.dispose(); mat.dispose(); envTex.dispose(); pm.dispose(); renderer.dispose(); host.innerHTML = ''; }
  };
}

window.Pieza3D = { construir, montar, leerArchivo3D, codificarMalla, decodificarMalla };
window.dispatchEvent(new Event('pieza3d-lista'));
