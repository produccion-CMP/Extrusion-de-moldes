'use strict';

const Geo = (() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const BEZ_SEG = 24;
  const ARC_SEG_RAD = Math.PI / 90;

  function cargarScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function pdfjs() {
    if (!window.pdfjsLib) await cargarScript(PDFJS + 'pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    return window.pdfjsLib;
  }

  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  function bez(out, p0, p1, p2, p3) {
    for (let i = 1; i <= BEZ_SEG; i++) {
      const t = i / BEZ_SEG, u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      out.push(a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]);
    }
  }

  function colorHex(args) {
    if (!args) return '#000000';
    if (typeof args[0] === 'string') return args[0].toLowerCase();
    const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + h(args[0]) + h(args[1]) + h(args[2]);
  }

  function nuevaCapas() {
    const capas = new Map();
    const agregar = (key, nombre, color, poly, cerrado) => {
      if (poly.length < 4) return;
      let c = capas.get(key);
      if (!c) { c = { key, nombre, color, polys: [], largo: 0 }; capas.set(key, c); }
      c.polys.push({ p: poly, c: !!cerrado });
      for (let i = 2; i < poly.length; i += 2) c.largo += Math.hypot(poly[i] - poly[i - 2], poly[i + 1] - poly[i - 1]);
    };
    return { capas, agregar };
  }

  async function leerPdf(buf, nPag) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: buf }).promise;
    const page = await doc.getPage(nPag || 1);
    const vp = page.getViewport({ scale: 1 });
    const ol = await page.getOperatorList();
    const O = lib.OPS;
    const { capas, agregar } = nuevaCapas();
    const st = [];
    let ctm = [1, 0, 0, 1, 0, 0], lw = 1, sc = '#000000', fc = '#000000';
    const dev = (x, y) => { const p = ap(ctm, x, y); const q = ap(vp.transform, p[0], p[1]); return [q[0], -q[1]]; };
    const escalaLw = () => Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]));
    let subs = [], cur = null, ini = null;
    const cerrar = () => { if (cur && cur.length >= 4) subs.push({ p: cur, c: false }); cur = null; };
    const asegurar = () => { if (!cur) cur = ini ? [ini[0], ini[1]] : [0, 0]; };
    const construir = args => {
      const ops = args[0], co = args[1];
      let j = 0;
      for (const op of ops) {
        if (op === O.moveTo) { cerrar(); ini = dev(co[j], co[j + 1]); cur = [ini[0], ini[1]]; j += 2; }
        else if (op === O.lineTo) { asegurar(); const p = dev(co[j], co[j + 1]); cur.push(p[0], p[1]); j += 2; }
        else if (op === O.curveTo) {
          asegurar(); const p0 = [cur[cur.length - 2], cur[cur.length - 1]];
          bez(cur, p0, dev(co[j], co[j + 1]), dev(co[j + 2], co[j + 3]), dev(co[j + 4], co[j + 5])); j += 6;
        } else if (op === O.curveTo2) {
          asegurar(); const p0 = [cur[cur.length - 2], cur[cur.length - 1]];
          bez(cur, p0, p0, dev(co[j], co[j + 1]), dev(co[j + 2], co[j + 3])); j += 4;
        } else if (op === O.curveTo3) {
          asegurar(); const p0 = [cur[cur.length - 2], cur[cur.length - 1]], p3 = dev(co[j + 2], co[j + 3]);
          bez(cur, p0, dev(co[j], co[j + 1]), p3, p3); j += 4;
        } else if (op === O.closePath) {
          if (cur && ini) { cur.push(ini[0], ini[1]); subs.push({ p: cur, c: true }); cur = null; }
        } else if (op === O.rectangle) {
          cerrar();
          const x = co[j], y = co[j + 1], w = co[j + 2], h = co[j + 3]; j += 4;
          const a = dev(x, y), b = dev(x + w, y), c = dev(x + w, y + h), d = dev(x, y + h);
          subs.push({ p: [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1], a[0], a[1]], c: true });
          ini = a;
        }
      }
    };
    const vaciar = () => { cerrar(); const s = subs; subs = []; ini = null; return s; };
    const pintar = (trazo, relleno, mantener) => {
      const pend = mantener ? subs.concat(cur && cur.length >= 4 ? [{ p: cur, c: false }] : []) : vaciar();
      if (!pend.length) return;
      const w = +(lw * escalaLw()).toFixed(2);
      const col = trazo ? sc : fc;
      const key = (trazo ? 'T' : 'R') + '|' + col + '|' + (trazo ? w : 0);
      const nombre = (trazo ? 'Trazo ' : 'Relleno ') + col + (trazo ? ' · ' + w + ' pt' : '');
      for (const s of pend) agregar(key, nombre, col, s.p, s.c || relleno);
    };
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i], a = ol.argsArray[i];
      switch (fn) {
        case O.save: st.push([ctm.slice(), lw, sc, fc]); break;
        case O.restore: if (st.length) [ctm, lw, sc, fc] = st.pop(); break;
        case O.transform: ctm = mul(ctm, a); break;
        case O.paintFormXObjectBegin: st.push([ctm.slice(), lw, sc, fc]); if (a && a[0]) ctm = mul(ctm, a[0]); break;
        case O.paintFormXObjectEnd: if (st.length) [ctm, lw, sc, fc] = st.pop(); break;
        case O.setLineWidth: lw = a[0] || 0; break;
        case O.setStrokeRGBColor: sc = colorHex(a); break;
        case O.setFillRGBColor: fc = colorHex(a); break;
        case O.setStrokeGray: sc = colorHex([a[0] * 255, a[0] * 255, a[0] * 255]); break;
        case O.setFillGray: fc = colorHex([a[0] * 255, a[0] * 255, a[0] * 255]); break;
        case O.constructPath: construir(a); break;
        case O.stroke: case O.closeStroke: pintar(true, false); break;
        case O.fill: case O.eoFill: pintar(false, true); break;
        case O.fillStroke: case O.eoFillStroke: case O.closeFillStroke: case O.closeEOFillStroke: pintar(true, false, true); pintar(false, true); break;
        case O.endPath: vaciar(); break;
        default: break;
      }
    }
    return { tipo: 'pdf', unidad: 'pt', mmPorUnidad: 25.4 / 72, paginas: doc.numPages, capas: [...capas.values()] };
  }

  function leerDxf(texto) {
    const L = texto.split(/\r?\n/);
    const pares = [];
    for (let i = 0; i + 1 < L.length; i += 2) pares.push([parseInt(L[i].trim(), 10), L[i + 1].trim()]);
    let ins = 4;
    const capasDef = new Map();
    const bloques = new Map();
    const ents = [];
    let i = 0, seccion = null, bloque = null;
    const leerEnt = () => {
      const tipo = pares[i][1];
      const e = { tipo, g: [] };
      i++;
      while (i < pares.length && pares[i][0] !== 0) { e.g.push(pares[i]); i++; }
      return e;
    };
    while (i < pares.length) {
      const [c, v] = pares[i];
      if (c === 0 && v === 'SECTION') { seccion = pares[i + 1][1]; i += 2; continue; }
      if (c === 0 && v === 'ENDSEC') { seccion = null; i++; continue; }
      if (seccion === 'HEADER') {
        if (c === 9 && v === '$INSUNITS') { ins = parseInt(pares[i + 1][1], 10); i += 2; continue; }
        i++; continue;
      }
      if (seccion === 'TABLES') {
        if (c === 0 && v === 'LAYER') {
          const e = leerEnt();
          const nm = val(e, 2);
          if (nm) capasDef.set(nm, { color: parseInt(val(e, 62) || '7', 10), flags: parseInt(val(e, 70) || '0', 10) });
          continue;
        }
        i++; continue;
      }
      if (seccion === 'BLOCKS') {
        if (c === 0 && v === 'BLOCK') { const e = leerEnt(); bloque = { nombre: val(e, 2), bx: num(e, 10), by: num(e, 20), ents: [] }; bloques.set(bloque.nombre, bloque); continue; }
        if (c === 0 && v === 'ENDBLK') { bloque = null; leerEnt(); continue; }
        if (c === 0 && bloque) { bloque.ents.push(leerEnt()); continue; }
        i++; continue;
      }
      if (seccion === 'ENTITIES') {
        if (c === 0) { ents.push(leerEnt()); continue; }
        i++; continue;
      }
      i++;
    }
    const factor = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100 }[ins] || 1;
    const { capas, agregar } = nuevaCapas();
    const procesar = (lista, m, capaPadre, prof) => {
      let k = 0;
      while (k < lista.length) {
        const e = lista[k];
        let capa = val(e, 8) || '0';
        if (capa === '0' && capaPadre) capa = capaPadre;
        const key = 'L|' + capa;
        const nombre = 'Capa ' + capa;
        const def = capasDef.get(capa);
        const ci = parseInt(val(e, 62) || '256', 10);
        const col = aciColor(ci === 256 || ci === 0 ? Math.abs(def ? def.color : 7) : ci);
        const ext = num(e, 230, 1);
        const fx = ext < 0 ? -1 : 1;
        const P = (x, y) => ap(m, x * fx, y);
        if (e.tipo === 'LINE') {
          const a = P(num(e, 10), num(e, 20)), b = P(num(e, 11), num(e, 21));
          agregar(key, nombre, col, [a[0], a[1], b[0], b[1]], false);
        } else if (e.tipo === 'LWPOLYLINE') {
          const vs = [];
          let cur = null;
          for (const [c, v] of e.g) {
            if (c === 10) { cur = { x: +v, y: 0, b: 0 }; vs.push(cur); }
            else if (c === 20 && cur) cur.y = +v;
            else if (c === 42 && cur) cur.b = +v;
          }
          const cerr = (parseInt(val(e, 70) || '0', 10) & 1) === 1;
          agregar(key, nombre, col, polyBulge(vs, cerr, P), cerr);
        } else if (e.tipo === 'POLYLINE') {
          const cerr = (parseInt(val(e, 70) || '0', 10) & 1) === 1;
          const vs = [];
          k++;
          while (k < lista.length && lista[k].tipo === 'VERTEX') { vs.push({ x: num(lista[k], 10), y: num(lista[k], 20), b: num(lista[k], 42) }); k++; }
          agregar(key, nombre, col, polyBulge(vs, cerr, P), cerr);
          continue;
        } else if (e.tipo === 'ARC' || e.tipo === 'CIRCLE') {
          const cx = num(e, 10), cy = num(e, 20), r = num(e, 40);
          let a0 = 0, a1 = 2 * Math.PI;
          if (e.tipo === 'ARC') { a0 = num(e, 50) * Math.PI / 180; a1 = num(e, 51) * Math.PI / 180; while (a1 <= a0) a1 += 2 * Math.PI; }
          const n = Math.max(8, Math.ceil((a1 - a0) / ARC_SEG_RAD));
          const pts = [];
          for (let t = 0; t <= n; t++) { const a = a0 + (a1 - a0) * t / n; const p = P(cx + r * Math.cos(a), cy + r * Math.sin(a)); pts.push(p[0], p[1]); }
          agregar(key, nombre, col, pts, e.tipo === 'CIRCLE');
        } else if (e.tipo === 'ELLIPSE') {
          const cx = num(e, 10), cy = num(e, 20), mx = num(e, 11), my = num(e, 21), ra = num(e, 40, 1);
          let t0 = num(e, 41, 0), t1 = num(e, 42, 2 * Math.PI);
          while (t1 <= t0) t1 += 2 * Math.PI;
          const n = Math.max(16, Math.ceil((t1 - t0) / ARC_SEG_RAD));
          const pts = [];
          for (let t = 0; t <= n; t++) {
            const a = t0 + (t1 - t0) * t / n, ca = Math.cos(a), sa = Math.sin(a);
            const p = P(cx + mx * ca - my * ra * sa, cy + my * ca + mx * ra * sa); pts.push(p[0], p[1]);
          }
          agregar(key, nombre, col, pts, Math.abs(t1 - t0 - 2 * Math.PI) < 1e-6);
        } else if (e.tipo === 'SPLINE') {
          const pts = splinePts(e).flatMap(q => P(q[0], q[1]));
          agregar(key, nombre, col, pts, (parseInt(val(e, 70) || '0', 10) & 1) === 1);
        } else if (e.tipo === 'INSERT' && prof < 6) {
          const b = bloques.get(val(e, 2));
          if (b && !/^\*[DdTt]/.test(b.nombre)) {
            const sx = num(e, 41, 1), sy = num(e, 42, 1), rot = num(e, 50) * Math.PI / 180;
            const c = Math.cos(rot), s = Math.sin(rot);
            const t = mul(m, [c * sx * fx, s * sx, -s * sy, c * sy, num(e, 10) * fx, num(e, 20)]);
            procesar(b.ents, mul(t, [1, 0, 0, 1, -b.bx, -b.by]), capa, prof + 1);
          }
        }
        k++;
      }
    };
    procesar(ents, [factor, 0, 0, factor, 0, 0], null, 0);
    const lista = [...capas.values()];
    for (const c of lista) {
      const d = capasDef.get(c.key.slice(2));
      c.oculta = !!(d && (d.color < 0 || (d.flags & 1)));
      if (c.oculta) c.nombre += ' (apagada)';
    }
    return { tipo: 'dxf', unidad: 'mm', mmPorUnidad: 1, insunits: ins, capas: lista };
  }

  function val(e, c) { const p = e.g.find(x => x[0] === c); return p ? p[1] : null; }
  function num(e, c, d) { const v = val(e, c); return v === null ? (d === undefined ? 0 : d) : parseFloat(v); }

  function aciColor(i) {
    const t = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#000000', 8: '#808080', 9: '#c0c0c0' };
    return t[i] || '#555555';
  }

  function polyBulge(vs, cerr, P) {
    const out = [];
    const n = vs.length;
    if (!n) return out;
    const lim = cerr ? n : n - 1;
    const p0 = P(vs[0].x, vs[0].y);
    out.push(p0[0], p0[1]);
    for (let k = 0; k < lim; k++) {
      const a = vs[k], b = vs[(k + 1) % n];
      if (Math.abs(a.b) > 1e-9) {
        const th = 4 * Math.atan(a.b);
        const dx = b.x - a.x, dy = b.y - a.y, ch = Math.hypot(dx, dy);
        if (ch > 1e-12) {
          const r = ch / (2 * Math.sin(th / 2));
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const h = r * Math.cos(th / 2);
          const nx = -dy / ch, ny = dx / ch;
          const cx = mx + nx * h, cy = my + ny * h;
          const a0 = Math.atan2(a.y - cy, a.x - cx);
          const seg = Math.max(2, Math.ceil(Math.abs(th) / ARC_SEG_RAD));
          for (let s = 1; s < seg; s++) {
            const an = a0 + th * s / seg;
            const p = P(cx + Math.abs(r) * Math.cos(an) * Math.sign(r), cy + Math.abs(r) * Math.sin(an) * Math.sign(r));
            out.push(p[0], p[1]);
          }
        }
      }
      const pb = P(b.x, b.y);
      out.push(pb[0], pb[1]);
    }
    return out;
  }

  function splinePts(e) {
    const deg = parseInt(val(e, 71) || '3', 10);
    const knots = e.g.filter(x => x[0] === 40).map(x => +x[1]);
    const cps = [], fit = [];
    let cur = null;
    for (const [c, v] of e.g) {
      if (c === 10) { cur = [+v, 0]; cps.push(cur); } else if (c === 20 && cur && cps[cps.length - 1] === cur) cur[1] = +v;
    }
    let fc = null;
    for (const [c, v] of e.g) {
      if (c === 11) { fc = [+v, 0]; fit.push(fc); } else if (c === 21 && fc) fc[1] = +v;
    }
    if (cps.length > deg && knots.length === cps.length + deg + 1) {
      const out = [];
      const t0 = knots[deg], t1 = knots[knots.length - deg - 1];
      const N = Math.max(32, cps.length * 12);
      for (let s = 0; s <= N; s++) out.push(deBoor(deg, knots, cps, t0 + (t1 - t0) * Math.min(s / N, 1 - 1e-12)));
      return out;
    }
    return fit.length ? fit : cps;
  }

  function deBoor(p, U, P, t) {
    let k = p;
    while (k < U.length - p - 2 && t >= U[k + 1]) k++;
    const d = [];
    for (let j = 0; j <= p; j++) d.push(P[j + k - p].slice());
    for (let r = 1; r <= p; r++) {
      for (let j = p; j >= r; j--) {
        const den = U[j + 1 + k - r] - U[j + k - p];
        const a = den === 0 ? 0 : (t - U[j + k - p]) / den;
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1]];
      }
    }
    return d[p];
  }

  function bboxCapas(capas) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of capas) for (const s of c.polys) for (let i = 0; i < s.p.length; i += 2) {
      const x = s.p[i], y = s.p[i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1 };
  }

  function rasterizar(capas, bb, maxLado, anchoRel, maxPix) {
    const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    let esc = maxLado / Math.max(w, h);
    if (maxPix && (w * esc) * (h * esc) > maxPix) esc = Math.sqrt(maxPix / (w * h));
    const pad = 4;
    const W = Math.ceil(w * esc) + 2 * pad, H = Math.ceil(h * esc) + 2 * pad;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1.6, anchoRel * Math.max(W, H));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const tx = x => (x - bb.x0) * esc + pad, ty = y => (bb.y1 - y) * esc + pad;
    ctx.beginPath();
    for (const c of capas) for (const s of c.polys) {
      const p = s.p;
      ctx.moveTo(tx(p[0]), ty(p[1]));
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(tx(p[i]), ty(p[i + 1]));
    }
    ctx.stroke();
    const img = ctx.getImageData(0, 0, W, H).data;
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < m.length; i++, j += 4) m[i] = img[j] < 200 ? 1 : 0;
    cv.width = cv.height = 1;
    return { m, W, H, esc, pad, bb, aMundo: (px, py) => [(px - pad) / esc + bb.x0, bb.y1 - (py - pad) / esc] };
  }

  function etiquetar(R) {
    const { m, W, H } = R;
    const lab = new Int32Array(W * H);
    const pila = new Int32Array(W * H);
    const regiones = [null];
    let n = 0;
    const llenar = (s, id) => {
      let top = 0, area = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, toca = false;
      pila[top++] = s; lab[s] = id;
      while (top) {
        const p = pila[--top];
        area++;
        const x = p % W, y = (p - x) / W;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) toca = true;
        if (x > 0 && !m[p - 1] && !lab[p - 1]) { lab[p - 1] = id; pila[top++] = p - 1; }
        if (x < W - 1 && !m[p + 1] && !lab[p + 1]) { lab[p + 1] = id; pila[top++] = p + 1; }
        if (y > 0 && !m[p - W] && !lab[p - W]) { lab[p - W] = id; pila[top++] = p - W; }
        if (y < H - 1 && !m[p + W] && !lab[p + W]) { lab[p + W] = id; pila[top++] = p + W; }
      }
      return { id, area, x0, y0, x1, y1, toca, ini: s };
    };
    for (let p = 0; p < W * H; p++) if (!m[p] && !lab[p]) { n++; regiones.push(llenar(p, n)); }
    for (let k = 1; k < regiones.length; k++) {
      const r = regiones[k];
      let p = r.ini - W;
      while (p >= 0 && (m[p] || lab[p] === r.id)) p -= W;
      r.padre = p >= 0 ? lab[p] : 0;
    }
    return { lab, regiones };
  }

  function elegirObjeto(regs) {
    const hijosDe = new Map();
    for (const q of regs) if (q && q.padre) { if (!hijosDe.has(q.padre)) hijosDe.set(q.padre, []); hijosDe.get(q.padre).push(q); }
    let mejor = null;
    for (const r of regs) {
      if (!r || r.toca) continue;
      const hs = hijosDe.get(r.id) || [];
      const tot0 = r.area + hs.reduce((a, q) => a + q.area, 0);
      const hijos = hs.filter(q => q.area > 0.002 * tot0 && q.x0 > r.x0 && q.x1 < r.x1 && q.y0 > r.y0 && q.y1 < r.y1).map(q => q.area);
      if (hijos.length < 2) continue;
      const suma = hijos.reduce((a, b) => a + b, 0);
      const frac = suma / tot0;
      if (frac < 0.2 || frac > 0.9) continue;
      const ord = hijos.slice().sort((x, y) => x - y);
      let rep = 1, k = 0;
      for (let i = 0; i < ord.length; i++) { while (ord[i] - ord[k] > 0.04 * ord[i]) k++; rep = Math.max(rep, i - k + 1); }
      const sc = suma * (rep >= 3 ? 1 : 0.3);
      if (!mejor || sc > mejor.sc) mejor = { r, hijos: hijos.length, areas: hijos, suma, sc, frac, rep };
    }
    return mejor;
  }

  function cuencas(lab, m, W, H) {
    const q = new Int32Array(W * H);
    let h = 0, t = 0;
    for (let p = 0; p < W * H; p++) if (lab[p]) {
      const x = p % W;
      if ((x > 0 && !lab[p - 1]) || (x < W - 1 && !lab[p + 1]) || (p >= W && !lab[p - W]) || (p < W * H - W && !lab[p + W])) q[t++] = p;
    }
    while (h < t) {
      const p = q[h++], id = lab[p], x = p % W;
      if (x > 0 && !lab[p - 1]) { lab[p - 1] = id; q[t++] = p - 1; }
      if (x < W - 1 && !lab[p + 1]) { lab[p + 1] = id; q[t++] = p + 1; }
      if (p >= W && !lab[p - W]) { lab[p - W] = id; q[t++] = p - W; }
      if (p < W * H - W && !lab[p + W]) { lab[p + W] = id; q[t++] = p + W; }
    }
  }

  function trazar(lab, W, H, id, inicio) {
    const en = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === id;
    const sx = inicio % W, sy = (inicio - sx) / W;
    let x = sx, y = sy, prev = 0;
    const pts = [];
    let guard = 0;
    const lim = 8 * W * H;
    do {
      const s = (en(x - 1, y - 1) ? 1 : 0) | (en(x, y - 1) ? 2 : 0) | (en(x - 1, y) ? 4 : 0) | (en(x, y) ? 8 : 0);
      let d;
      if (s === 1 || s === 5 || s === 13) d = 1;
      else if (s === 8 || s === 10 || s === 11) d = 2;
      else if (s === 4 || s === 12 || s === 14) d = 3;
      else if (s === 2 || s === 3 || s === 7) d = 4;
      else if (s === 6) d = prev === 1 ? 3 : 4;
      else if (s === 9) d = prev === 4 ? 1 : 2;
      else break;
      if (d !== prev) pts.push([x, y]);
      prev = d;
      if (d === 1) y--; else if (d === 2) y++; else if (d === 3) x--; else x++;
    } while ((x !== sx || y !== sy) && ++guard < lim);
    return pts;
  }

  function dpAbierto(pts, i0, i1, tol, keep) {
    const st = [[i0, i1]];
    keep[i0] = keep[i1] = 1;
    while (st.length) {
      const [a, b] = st.pop();
      if (b - a < 2) continue;
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      let md = -1, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const d = L > 1e-12 ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
  }

  function dp(pts, tol) {
    const n = pts.length;
    if (n < 4) return pts.slice();
    let far = 0, dmax = -1;
    for (let i = 1; i < n; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > dmax) { dmax = d; far = i; } }
    const ext = pts.concat([pts[0]]);
    const keep = new Uint8Array(n + 1);
    dpAbierto(ext, 0, far, tol, keep);
    dpAbierto(ext, far, n, tol, keep);
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  function areaF(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return s / 2; }
  const area = p => Math.abs(areaF(p));

  function bbox(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  function puentes(capas, rel) {
    const bb = bboxCapas(capas);
    const size = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
    const tol = 1e-4 * size, gap = (rel || 0.008) * size;
    const E = [];
    for (const c of capas) for (const s of c.polys) {
      const p = s.p, n = p.length;
      if (s.c || n < 4) continue;
      if (Math.hypot(p[0] - p[n - 2], p[1] - p[n - 1]) <= tol) continue;
      E.push([p[0], p[1]], [p[n - 2], p[n - 1]]);
    }
    const todos = [];
    for (const c of capas) for (const s of c.polys) { const p = s.p; for (let i = 0; i < p.length; i += 2) todos.push([p[i], p[i + 1]]); }
    const cel = Math.max(gap, tol * 10);
    const key = (x, y) => Math.floor(x / cel) + ',' + Math.floor(y / cel);
    const grid = new Map();
    todos.forEach((q, i) => { const k = key(q[0], q[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
    const cerca = (x, y, r, fn) => {
      const cx = Math.floor(x / cel), cy = Math.floor(y / cel), rr = Math.ceil(r / cel);
      for (let i = -rr; i <= rr; i++) for (let j = -rr; j <= rr; j++) { const l = grid.get((cx + i) + ',' + (cy + j)); if (l) for (const k of l) fn(k); }
    };
    const idx = new Map();
    todos.forEach((q, i) => idx.set(q, i));
    const colgantes = [];
    for (const e of E) {
      let n = 0;
      cerca(e[0], e[1], tol, k => { const q = todos[k]; if (Math.hypot(q[0] - e[0], q[1] - e[1]) <= tol) n++; });
      if (n <= 1) colgantes.push(e);
    }
    const cand = [];
    for (let i = 0; i < colgantes.length; i++) for (let j = i + 1; j < colgantes.length; j++) {
      const a = colgantes[i], b = colgantes[j], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > tol && d <= gap) cand.push([d, i, j]);
    }
    cand.sort((x, y) => x[0] - y[0]);
    const usado = new Uint8Array(colgantes.length);
    const polys = [];
    for (const [d, i, j] of cand) {
      if (usado[i] || usado[j]) continue;
      usado[i] = usado[j] = 1;
      polys.push({ p: [colgantes[i][0], colgantes[i][1], colgantes[j][0], colgantes[j][1]], c: false });
    }
    return polys.length ? [{ key: '__puentes', polys, largo: 0 }] : [];
  }

  function conPuentes(cb) { return cb.concat(puentes(cb)); }

  function evaluar(cb) {
    const bb = bboxCapas(cb);
    if (!isFinite(bb.x0) || bb.x1 - bb.x0 <= 0 || bb.y1 - bb.y0 <= 0) return null;
    const R = rasterizar(conPuentes(cb), bb, 900, 0.0015, 1.2e6);
    const o = elegirObjeto(etiquetar(R).regiones);
    if (!o) return null;
    const p0 = R.aMundo(o.r.x0, o.r.y1), p1 = R.aMundo(o.r.x1, o.r.y0);
    const ar = o.areas.slice().sort((x, y) => x - y);
    const med = ar.length ? ar[ar.length >> 1] / (R.esc * R.esc) : 0;
    return { cb, hijos: o.hijos, suma: o.suma / (R.esc * R.esc), w: p1[0] - p0[0], h: p1[1] - p0[1], x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], med, largo: cb.reduce((s, c) => s + c.largo, 0) };
  }

  function detectarCapas(lect) {
    const cand = lect.capas.filter(c => c.polys.length >= 1 && !c.oculta).sort((a, b) => b.largo - a.largo).slice(0, 7);
    const mejorDe = lista => lista.filter(e => e && e.hijos >= 2).reduce((m, e) => (!m || e.suma > m.suma * 1.001 || (Math.abs(e.suma - m.suma) <= m.suma * 0.001 && e.cb.length < m.cb.length)) ? e : m, null);
    let base = mejorDe(cand.map(c => evaluar([c])));
    if (!base || base.hijos < 3) {
      const pares = [];
      for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) pares.push(evaluar([cand[i], cand[j]]));
      const p = mejorDe(pares);
      if (p && (!base || p.suma > base.suma)) base = p;
    }
    if (!base) return cand[0] ? [cand[0].key] : [];
    for (const c of cand) {
      if (base.cb.includes(c)) continue;
      const cbb = bboxCapas([c]), mg = 0.02 * Math.max(base.w, base.h);
      if (cbb.x0 < base.x0 - mg || cbb.x1 > base.x1 + mg || cbb.y0 < base.y0 - mg || cbb.y1 > base.y1 + mg) continue;
      const e = evaluar(base.cb.concat([c]));
      if (!e || e.hijos <= base.hijos) continue;
      const mismaCaja = Math.abs(e.w - base.w) <= 0.01 * base.w && Math.abs(e.h - base.h) <= 0.01 * base.h;
      if (mismaCaja && e.suma > base.suma * 1.01) base = e;
    }
    return base.cb.map(c => c.key);
  }

  async function extraer(lect, opts) {
    const o = Object.assign({ capas: null, maxLado: 6000, maxPix: 1.6e7, anchoTrazo: 0.0009, rot: 0, espejo: false }, opts || {});
    const keys = o.capas && o.capas.length ? o.capas : detectarCapas(lect);
    const sel0 = lect.capas.filter(c => keys.includes(c.key));
    if (!sel0.length) throw new Error('No hay trazos en las capas elegidas');
    const brs = puentes(sel0);
    const sel = sel0.concat(brs);
    const bbAll = bboxCapas(sel);
    const R0 = rasterizar(sel, bbAll, 1600, 0.0012, 3e6);
    const E0 = etiquetar(R0);
    const ob = elegirObjeto(E0.regiones);
    const segs = brs.length && ob ? necesarios(sel0, brs[0].polys, bbAll, R0, E0, ob.r.id, lect.capas.filter(c => !keys.includes(c.key))) : [];
    if (!ob) throw new Error('No se encontró un contorno cerrado con dados adentro. Probá con otras capas.');
    const a0 = R0.aMundo(ob.r.x0 - 3, ob.r.y1 + 3), a1 = R0.aMundo(ob.r.x1 + 3, ob.r.y0 - 3);
    const mg = 0.01 * Math.max(a1[0] - a0[0], a1[1] - a0[1]);
    const bb = { x0: a0[0] - mg, y0: a0[1] - mg, x1: a1[0] + mg, y1: a1[1] + mg };
    let best = null;
    for (const f of [1, 2.2, 4]) {
      await new Promise(r => setTimeout(r, 0));
      const res = fino(sel, bb, o.maxLado, o.anchoTrazo * f, o.maxPix);
      if (!res) continue;
      if (!best || res.huecos.length > best.huecos.length) best = res;
    }
    if (!best) throw new Error('No se pudo aislar el molde en alta resolución');
    return normalizar(best.marco, best.huecos, lect, { rot: o.rot, espejo: o.espejo, resol: best.resol, capas: keys, puentes: segs });
  }

  function necesarios(sel0, polys, bb, R0, E0, idMat, otras) {
    const R1 = rasterizar(sel0, bb, 1600, 0.0012, 3e6);
    const { W, H, esc, pad } = R0;
    const px = (x, y) => [(x - bb.x0) * esc + pad, (bb.y1 - y) * esc + pad];
    const lado = (cx, cy, nx, ny) => {
      for (let t = 1; t <= 12; t++) {
        const x = Math.round(cx + nx * t), y = Math.round(cy + ny * t);
        if (x < 0 || y < 0 || x >= W || y >= H) return 0;
        const i = y * W + x;
        if (!R0.m[i]) return E0.lab[i];
      }
      return 0;
    };
    const hueco = (ax, ay, bx, by) => {
      const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
        let lleno = false;
        for (let dy = -2; dy <= 2 && !lleno; dy++) for (let dx = -2; dx <= 2; dx++) if (R1.m[(y + dy) * W + x + dx]) { lleno = true; break; }
        if (!lleno) return true;
      }
      return false;
    };
    const out = [];
    for (const q of polys) {
      const [ax, ay] = px(q.p[0], q.p[1]), [bx, by] = px(q.p[2], q.p[3]);
      if (!hueco(ax, ay, bx, by)) continue;
      const L = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / L, ny = (bx - ax) / L, cx = (ax + bx) / 2, cy = (ay + by) / 2;
      const a0 = lado(cx, cy, nx, ny), b0 = lado(cx, cy, -nx, -ny);
      if (!(a0 && b0 && a0 !== b0 && (a0 === idMat || b0 === idMat))) continue;
      const mx = (q.p[0] + q.p[2]) / 2, my = (q.p[1] + q.p[3]) / 2, r = Math.hypot(q.p[2] - q.p[0], q.p[3] - q.p[1]) * 0.3 + 1e-3 * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
      let otra = null;
      for (const c of otras || []) { if (otra) break; for (const s of c.polys) { const p = s.p; for (let k = 2; k < p.length; k += 2) if (dSegPt(mx, my, p[k - 2], p[k - 1], p[k], p[k + 1]) < r) { otra = c.key; break; } if (otra) break; } }
      out.push(otra ? [[q.p[0], q.p[1]], [q.p[2], q.p[3]], otra] : [[q.p[0], q.p[1]], [q.p[2], q.p[3]]]);
    }
    return out;
  }

  function fino(sel, bb, maxLado, ancho, maxPix) {
    const R = rasterizar(sel, bb, maxLado, ancho, maxPix);

    const { lab, regiones } = etiquetar(R);
    const ob2 = elegirObjeto(regiones);
    if (!ob2) return null;
    const mat = ob2.r;
    const bbaMat = (mat.x1 - mat.x0 + 1) * (mat.y1 - mat.y0 + 1);
    const minA = 0.0008 * bbaMat;
    const huecos = [];
    const vivo = new Uint8Array(regiones.length);
    for (const q of regiones) {
      if (!q) continue;
      if (q === mat) { vivo[q.id] = 1; continue; }
      if (q.toca) { vivo[q.id] = 1; continue; }
      const dentro = q.x0 > mat.x0 && q.x1 < mat.x1 && q.y0 > mat.y0 && q.y1 < mat.y1;
      if (dentro && q.area >= minA) { vivo[q.id] = 1; huecos.push(q); }
      else if (!dentro) vivo[q.id] = 1;
    }
    for (let p = 0; p < lab.length; p++) if (lab[p] && !vivo[lab[p]]) lab[p] = 0;
    cuencas(lab, R.m, R.W, R.H);
    const primero = new Int32Array(regiones.length).fill(-1);
    for (let p = 0; p < lab.length; p++) { const id = lab[p]; if (id && primero[id] < 0) primero[id] = p; }
    const tol = 0.7;
    const aU = q => R.aMundo(q[0], q[1]);
    const marco = dp(trazar(lab, R.W, R.H, mat.id, primero[mat.id]), tol).map(aU);
    const hs = huecos.filter(q => primero[q.id] >= 0).map(q => dp(trazar(lab, R.W, R.H, q.id, primero[q.id]), tol).map(aU)).filter(h => h.length >= 3);
    return { marco, huecos: hs, resol: 1 / R.esc };
  }

  function transformar(pts, f) { return pts.map(p => f(p[0], p[1])); }

  function clipCaja(poly, x0, y0, x1, y1) {
    const cl = (pts, inside, inter) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
        const ia = inside(a), ib = inside(b);
        if (ib) { if (!ia) out.push(inter(a, b)); out.push(b); } else if (ia) out.push(inter(a, b));
      }
      return out;
    };
    const ix = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
    const iy = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
    let p = poly;
    p = cl(p, q => q[0] >= x0, (a, b) => ix(a, b, x0)); if (!p.length) return 0;
    p = cl(p, q => q[0] <= x1, (a, b) => ix(a, b, x1)); if (!p.length) return 0;
    p = cl(p, q => q[1] >= y0, (a, b) => iy(a, b, y0)); if (!p.length) return 0;
    p = cl(p, q => q[1] <= y1, (a, b) => iy(a, b, y1)); if (!p.length) return 0;
    return area(p);
  }

  function normalizar(marco, huecos, lect, o) {
    let F = marco, Hs = huecos, Bs = o.puentes || [];
    let b = bbox(F);
    let rotAuto = 0;
    if (b.h > b.w) {
      rotAuto = 90;
      const r = (x, y) => [y, -x];
      F = transformar(F, r); Hs = Hs.map(h => transformar(h, r)); Bs = Bs.map(h => tB(h, r)); b = bbox(F);
    }
    const s = 0.08 * Math.min(b.w, b.h);
    const lleno = (x0, y0) => clipCaja(F, x0, y0, x0 + s, y0 + s) / (s * s);
    const inf = lleno(b.x0, b.y0) + lleno(b.x1 - s, b.y0), sup = lleno(b.x0, b.y1 - s) + lleno(b.x1 - s, b.y1 - s);
    let giro = (sup < inf - 0.02 ? 180 : 0);
    giro = (giro + (o.rot || 0)) % 360;
    const rotar = (pts, g) => {
      if (g === 0) return pts;
      const f = g === 90 ? (x, y) => [-y, x] : g === 180 ? (x, y) => [-x, -y] : (x, y) => [y, -x];
      return transformar(pts, f);
    };
    F = rotar(F, giro); Hs = Hs.map(h => rotar(h, giro)); Bs = Bs.map(h => rotar(h, giro));
    if (o.espejo) { const m = (x, y) => [-x, y]; F = transformar(F, m); Hs = Hs.map(h => transformar(h, m)); Bs = Bs.map(h => tB(h, m)); }
    b = bbox(F);
    const tr = (x, y) => [x - b.x0, y - b.y0];
    F = transformar(F, tr); Hs = Hs.map(h => transformar(h, tr)); Bs = Bs.map(h => tB(h, tr));
    if (areaF(F) < 0) F.reverse();
    Hs = Hs.map(h => (areaF(h) > 0 ? h.slice().reverse() : h));
    Hs.sort((p, q) => { const a = bbox(p), c = bbox(q); return (Math.round(c.y0) - Math.round(a.y0)) || (a.x0 - c.x0); });
    return { marco: F, huecos: Hs, puentes: Bs, ancho: b.w, alto: b.h, unidad: lect.unidad, mmPorUnidad: lect.mmPorUnidad, resol: o.resol, capas: o.capas, rotAuto, giro };
  }

  function escalarMm(ext, anchoMm, altoMm) {
    let k;
    if (ext.unidad === 'mm' && !anchoMm) k = 1;
    else if (anchoMm) k = anchoMm / ext.ancho;
    else k = ext.mmPorUnidad;
    const f = (x, y) => [+(x * k).toFixed(3), +(y * k).toFixed(3)];
    const geo = { marco: transformar(ext.marco, f), huecos: ext.huecos.map(h => transformar(h, f)) };
    const ancho = ext.ancho * k, alto = ext.alto * k;
    const puentesMm = (ext.puentes || []).map(h => tB(h, f));
    return { geo, k, ancho, alto, puentes: puentesMm, desvioAlto: altoMm ? (alto - altoMm) / altoMm : 0, resolMm: ext.resol * k };
  }

  function simplificar(geo, tol) {
    const s = p => { const q = dp(p, tol); return q.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]); };
    return { marco: s(geo.marco), huecos: geo.huecos.map(s) };
  }

  function tB(h, f) { const r = transformar(h.slice(0, 2), f); if (h[2]) r.push(h[2]); return r; }

  function dSegPt(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  function dPolis(A, B) {
    let m = Infinity;
    for (let i = 0; i < A.length; i++) {
      const p = A[i];
      for (let j = 0, k = B.length - 1; j < B.length; k = j++) { const d = dSegPt(p[0], p[1], B[k][0], B[k][1], B[j][0], B[j][1]); if (d < m) m = d; }
    }
    for (let i = 0; i < B.length; i++) {
      const p = B[i];
      for (let j = 0, k = A.length - 1; j < A.length; k = j++) { const d = dSegPt(p[0], p[1], A[k][0], A[k][1], A[j][0], A[j][1]); if (d < m) m = d; }
    }
    return m;
  }

  function perim(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]); return s; }

  function agrupar(vals, tol) {
    const s = vals.slice().sort((a, b) => a - b);
    const g = [];
    for (const v of s) {
      const u = g[g.length - 1];
      if (u && v - u.max <= tol) { u.vals.push(v); u.max = v; } else g.push({ vals: [v], max: v });
    }
    return g.map(x => ({ v: x.vals.reduce((a, b) => a + b, 0) / x.vals.length, n: x.vals.length })).sort((a, b) => b.n - a.n);
  }

  function rayado(F, b) {
    const banda = 0.03 * Math.min(b.w, b.h);
    const lados = { inf: [], sup: [], izq: [], der: [] };
    const n = F.length;
    for (let i = 0; i < n; i++) {
      const p = F[i], q = F[(i + 1) % n];
      const pasos = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.2));
      for (let k = 0; k < pasos; k++) {
        const x = p[0] + (q[0] - p[0]) * k / pasos, y = p[1] + (q[1] - p[1]) * k / pasos;
        if (y - b.y0 < banda) lados.inf.push([x, y - b.y0]);
        if (b.y1 - y < banda) lados.sup.push([x, b.y1 - y]);
        if (x - b.x0 < banda) lados.izq.push([y, x - b.x0]);
        if (b.x1 - x < banda) lados.der.push([y, b.x1 - x]);
      }
    }
    const out = {};
    for (const k in lados) {
      const L = lados[k].sort((a, c) => a[0] - c[0]);
      const hist = new Map();
      for (const [, d] of L) if (d > 0.3) { const k = Math.round(d / 0.05); hist.set(k, (hist.get(k) || 0) + 1); }
      let moda = 0, mc = 0;
      for (const [k, c] of hist) if (c > mc) { mc = c; moda = k * 0.05; }
      const cerca = L.filter(q => Math.abs(q[1] - moda) <= 0.1).map(q => q[1]);
      const prof = cerca.length >= 5 ? cerca.reduce((a, c) => a + c, 0) / cerca.length : 0;
      let cnt = 0, st = 0;
      if (prof > 0.2) for (const [, d] of L) {
        if (d < 0.3 * prof) { if (st === 2) cnt++; st = 1; }
        else if (d > 1.35 * prof) st = 0;
        else if (d >= 0.7 * prof && st === 1) st = 2;
      }
      out[k] = { prof: prof > 0.2 ? prof : 0, n: prof > 0.2 ? cnt : 0 };
    }
    return out;
  }

  function metricas(geo) {
    const F = geo.marco, Hs = geo.huecos;
    const b = bbox(F);
    const aF = area(F);
    const aH = Hs.map(area);
    const aHt = aH.reduce((s, v) => s + v, 0);
    const bbs = Hs.map(bbox);
    const tipos = [];
    Hs.forEach((h, i) => {
      const w = bbs[i].w, hh = bbs[i].h;
      let t = tipos.find(t => Math.abs(t.w - w) < 0.15 && Math.abs(t.h - hh) < 0.15 && Math.abs(t.a - aH[i]) < 0.01 * t.a + 1);
      if (!t) { t = { w, h: hh, a: aH[i], n: 0, idx: [] }; tipos.push(t); }
      t.n++; t.idx.push(i);
    });
    tipos.sort((p, q) => q.a - p.a);
    tipos.forEach((t, i) => { t.letra = String.fromCharCode(65 + i); });
    const letra = new Array(Hs.length);
    tipos.forEach(t => t.idx.forEach(i => { letra[i] = t.letra; }));
    let paredMin = Infinity;
    const paredLado = { inf: [], sup: [], izq: [], der: [] };
    Hs.forEach((h, i) => {
      const d = dPolis(h, F);
      if (d < paredMin) paredMin = d;
      const q = bbs[i];
      const tol = 0.25 * Math.min(b.w, b.h);
      if (q.y0 - b.y0 < tol) paredLado.inf.push(q.y0 - b.y0);
      if (b.y1 - q.y1 < tol) paredLado.sup.push(b.y1 - q.y1);
      if (q.x0 - b.x0 < tol) paredLado.izq.push(q.x0 - b.x0);
      if (b.x1 - q.x1 < tol) paredLado.der.push(b.x1 - q.x1);
    });
    const tabV = [], tabH = [];
    let tabMin = Infinity;
    for (let i = 0; i < Hs.length; i++) {
      let mejorX = null, mejorY = null;
      for (let j = 0; j < Hs.length; j++) {
        if (i === j) continue;
        const A = bbs[i], B = bbs[j];
        const solY = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0), solX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        if (solY > 0.3 * Math.min(A.h, B.h) && B.x0 >= A.x1 - 0.01) { const g = B.x0 - A.x1; if (!mejorX || g < mejorX.g) mejorX = { g, j }; }
        if (solX > 0.3 * Math.min(A.w, B.w) && B.y0 >= A.y1 - 0.01) { const g = B.y0 - A.y1; if (!mejorY || g < mejorY.g) mejorY = { g, j }; }
      }
      if (mejorX) { tabV.push(mejorX.g); tabMin = Math.min(tabMin, dPolis(Hs[i], Hs[mejorX.j])); }
      if (mejorY) { tabH.push(mejorY.g); tabMin = Math.min(tabMin, dPolis(Hs[i], Hs[mejorY.j])); }
    }
    const moda = a => { const g = agrupar(a, 0.08); return g.length ? g[0].v : null; };
    const ray = rayado(F, b);
    return {
      ancho: b.w, alto: b.h, aMarco: aF, aHuecos: aHt, aLleno: aF - aHt, vacio: aF ? 100 * aHt / aF : 0,
      nHuecos: Hs.length, tipos: tipos.map(t => ({ letra: t.letra, w: t.w, h: t.h, a: t.a, n: t.n })), letra,
      paredMin: isFinite(paredMin) ? paredMin : null,
      pared: { inf: moda(paredLado.inf), sup: moda(paredLado.sup), izq: moda(paredLado.izq), der: moda(paredLado.der) },
      tabMin: isFinite(tabMin) ? tabMin : null, tabV: agrupar(tabV, 0.08), tabH: agrupar(tabH, 0.08),
      perimHuecos: Hs.reduce((s, h) => s + perim(h), 0), perimMarco: perim(F), rayado: ray
    };
  }

  function cocer(geo, p) {
    const sx = 1 - p.contrH / 100, sy = 1 - p.contrV / 100;
    const f = (x, y) => [x * sx, y * sy];
    const g = { marco: transformar(geo.marco, f), huecos: geo.huecos.map(h => transformar(h, f)) };
    const m = metricas(g);
    const L = p.largo;
    const vol = m.aLleno * L / 1000;
    m.largo = L;
    m.corteVerde = L / (1 - p.contrL / 100);
    m.volumen = vol;
    m.peso = vol * p.densidad / 1000;
    m.pesoRango = [vol * (p.densidad - 0.1) / 1000, vol * (p.densidad + 0.1) / 1000];
    m.volBruto = m.ancho * m.alto * L / 1000;
    return { geo: g, m };
  }

  function dxfR12(geo, titulo, extras) {
    const L = [];
    const w = (c, v) => L.push(String(c), String(v));
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$INSUNITS'); w(70, 4); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES'); w(0, 'TABLE'); w(2, 'LAYER'); w(70, 3);
    [['CONTORNO', 7], ['HUECOS', 1], ['TEXTO', 3]].forEach(([n, c]) => { w(0, 'LAYER'); w(2, n); w(70, 0); w(62, c); w(6, 'CONTINUOUS'); });
    w(0, 'ENDTAB'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES');
    const pl = (p, capa) => {
      w(0, 'POLYLINE'); w(8, capa); w(66, 1); w(70, 1);
      for (const [x, y] of p) { w(0, 'VERTEX'); w(8, capa); w(10, x.toFixed(4)); w(20, y.toFixed(4)); }
      w(0, 'SEQEND'); w(8, capa);
    };
    pl(geo.marco, 'CONTORNO');
    geo.huecos.forEach(h => pl(h, 'HUECOS'));
    const b = bbox(geo.marco);
    [titulo].concat(extras || []).forEach((t, i) => { w(0, 'TEXT'); w(8, 'TEXTO'); w(10, b.x0.toFixed(3)); w(20, (b.y0 - 10 - i * 5).toFixed(3)); w(40, i ? 2.5 : 3.5); w(1, String(t).replace(/[^\x20-\x7e]/g, c => ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', '×': 'x', '·': '-', '°': 'o', '²': '2', '³': '3' }[c] || ' '))); });
    w(0, 'ENDSEC'); w(0, 'EOF');
    return L.join('\n');
  }

  function svgPath(geo, flipH) {
    const p = q => q.map((v, i) => (i ? 'L' : 'M') + v[0].toFixed(2) + ' ' + (flipH - v[1]).toFixed(2)).join('') + 'Z';
    return p(geo.marco) + geo.huecos.map(p).join('');
  }

  function reorientar(ext, giro, espejo) {
    const f = giro === 90 ? (x, y) => [-y, x] : giro === 180 ? (x, y) => [-x, -y] : giro === 270 ? (x, y) => [y, -x] : (x, y) => [x, y];
    const g = (x, y) => { const p = f(x, y); return espejo ? [-p[0], p[1]] : p; };
    let F = transformar(ext.marco, g), Hs = ext.huecos.map(h => transformar(h, g)), Bs = (ext.puentes || []).map(h => tB(h, g));
    const b = bbox(F);
    const t = (x, y) => [x - b.x0, y - b.y0];
    F = transformar(F, t); Hs = Hs.map(h => transformar(h, t)); Bs = Bs.map(h => tB(h, t));
    if (areaF(F) < 0) F.reverse();
    Hs = Hs.map(h => (areaF(h) > 0 ? h.slice().reverse() : h));
    Hs.sort((p, q) => { const a = bbox(p), c = bbox(q); return (Math.round(c.y0) - Math.round(a.y0)) || (a.x0 - c.x0); });
    return Object.assign({}, ext, { marco: F, huecos: Hs, puentes: Bs, ancho: b.w, alto: b.h });
  }

  return { dPolis, dSegPt, reorientar, leerPdf, leerDxf, extraer, detectarCapas, escalarMm, simplificar, metricas, cocer, dxfR12, svgPath, bbox, area, dp };
})();
