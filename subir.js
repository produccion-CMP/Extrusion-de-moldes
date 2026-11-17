'use strict';

const CLASES = {
  ladrillo: { e: '🧱', n: 'Ladrillo', d: 'Plano del molde de extrusión: la app arma el ladrillo cocido' },
  pieza: { e: '⚙️', n: 'Pieza', d: 'Pieza del molde (dado, marco, araña, boquilla) o de una máquina' }
};
const KW_LADRILLO = /(matriz|molde|ladrillo|hueco|portante|losa|climablock|bloque|(^|[^a-z])[hp][ ._-]?\d{1,2}([^0-9]|$))/i;
const KW_GRUPO = [
  ['boquilla', /boquilla/i],
  ['arana', /ara[ñn]a|porta[ ._-]?dado/i],
  ['molde', /(^|[^a-z])dados?([^a-z]|$)|n[uú]cleo|portan[uú]cleo|puente|(^|[^a-z])marco|cuchilla|(^|[^a-z])pin([^a-z]|$)/i],
  ['extrusora', /h[eé]lice|camisa|rejilla|extrusora|sinf[ií]n|tornillo/i],
  ['ejes', /(^|[^a-z])eje([^a-z]|$)|[aá]rbol|perno/i],
  ['bujes', /buje|casquillo|anillo/i],
  ['poleas', /polea|pi[nñ][oó]n|engranaje|corona/i],
  ['placas', /placa|brida|tapa|chapa/i],
  ['soportes', /soporte|m[eé]nsula|bastidor/i]
];
const SUBIR = { modo: 'auto', grupo: '', estado: '', error: '', nombre: '', molde: '' };

function grupoPorNombre(txt) {
  for (const [g, re] of KW_GRUPO) if (re.test(txt) && grupoDe(g)) return g;
  return '';
}

function rasgosLadrillo(base, lect) {
  const ext = Geo.reorientar(base, 0, false);
  const esc = Geo.escalarMm(ext, lect.tipo === 'pdf' ? 340 : null, null);
  const m = Geo.metricas(esc.geo);
  const hs = esc.geo.huecos.map(h => { const b = Geo.bbox(h); const a = Math.abs(Geo.area(h)); return { a, llen: b.w * b.h ? a / (b.w * b.h) : 0, w: b.w, h: b.h }; });
  const rect = hs.length ? hs.filter(h => h.llen > 0.88).length / hs.length : 0;
  const rep = (m.tipos || []).filter(t => t.n >= 2).reduce((s, t) => s + t.n, 0) / Math.max(1, m.nHuecos);
  const ray = Object.values(m.rayado || {}).reduce((s, l) => s + (l.n || 0), 0);
  return { n: m.nHuecos, vacio: m.vacio, asp: Math.max(m.ancho, m.alto) / Math.max(1e-6, Math.min(m.ancho, m.alto)), rect, rep, ray };
}

function puntuar(nombre, r) {
  const motivos = [];
  let s = 0;
  const g = grupoPorNombre(nombre);
  if (g) { s -= 4; motivos.push(['pieza', `El nombre del archivo indica «${(grupoDe(g) || {}).nombre}»`]); }
  if (KW_LADRILLO.test(nombre)) { s += 3; motivos.push(['ladrillo', 'El nombre del archivo habla de matriz, molde o tipo de ladrillo']); }
  if (!r) { s -= 5; motivos.push(['pieza', 'No hay un marco cerrado con varios dados adentro']); return { s, motivos, g }; }
  if (r.n >= 8) { s += 1.5; motivos.push(['ladrillo', `${r.n} huecos dentro de un mismo contorno`]); } else motivos.push(['pieza', `Solo ${r.n} hueco(s) dentro del contorno`]);
  if (r.n >= 15) s += 1;
  if (r.rect >= 0.8) { s += 2; motivos.push(['ladrillo', `${Math.round(r.rect * 100)} % de huecos rectangulares, como los dados`]); }
  else if (r.rect < 0.5) { s -= 2; motivos.push(['pieza', `Huecos redondos o irregulares (${Math.round((1 - r.rect) * 100)} %), como agujeros de mecanizado`]); }
  if (r.vacio >= 35 && r.vacio <= 75) { s += 1; motivos.push(['ladrillo', `Vacío de ${Math.round(r.vacio)} %, típico de un ladrillo hueco`]); } else { s -= 1; motivos.push(['pieza', `Vacío de ${Math.round(r.vacio)} %, fuera de lo habitual en un ladrillo`]); }
  if (r.asp >= 1.8 && r.asp <= 4.2) s += 0.5;
  if (r.ray >= 6) { s += 2.5; motivos.push(['ladrillo', `Rayado en las caras (${r.ray} ondas)`]); }
  if (r.rep >= 0.6) { s += 1; motivos.push(['ladrillo', 'Los huecos se repiten en tamaño']); }
  return { s, motivos, g };
}

async function clasificarArchivo(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  const nombre = f.name.replace(/\.[^.]+$/, '');
  if (EXT_3D.includes(ext)) return { clase: 'pieza', conf: 1, motivos: [['pieza', 'Es un modelo 3D (' + ext.toUpperCase() + ')']], grupo: grupoPorNombre(nombre), pre: null };
  if (!['pdf', 'dxf'].includes(ext)) throw new Error('Formato no admitido: usá PDF, DXF, STEP, IGES, STL u OBJ');
  const buf = await f.arrayBuffer();
  const copia = buf.slice(0);
  let lect;
  if (ext === 'pdf') lect = await Geo.leerPdf(buf);
  else {
    const txt = new TextDecoder('utf-8').decode(buf);
    if (/^AutoCAD Binary DXF/.test(txt.slice(0, 22))) throw new Error('El DXF es binario: guardalo como DXF ASCII desde AutoCAD');
    lect = Geo.leerDxf(txt);
  }
  if (!lect.capas.length) throw new Error('El archivo no tiene dibujo vectorial (¿es un PDF escaneado?)');
  let base = null, r = null;
  try { base = await Geo.extraer(lect, { capas: null }); r = rasgosLadrillo(base, lect); } catch (e) { base = null; }
  const p = puntuar(nombre, r);
  const clase = p.s >= 3 ? 'ladrillo' : 'pieza';
  const conf = 1 / (1 + Math.exp(-Math.abs(p.s - 3) / 1.6));
  return { clase, conf, motivos: p.motivos, grupo: p.g, rasgos: r, pre: { buf: copia, lect, base } };
}

function abrirComo(f, clase, cl, grupo) {
  ST.clasif = { nombre: f.name, file: f, clase, auto: cl ? cl.clase : null, conf: cl ? cl.conf : null, motivos: cl ? cl.motivos : [], grupo: grupo || (cl && cl.grupo) || '', pre: cl ? cl.pre : null };
  const pre = cl && cl.pre ? { buf: cl.pre.buf.slice(0), lect: cl.pre.lect, base: cl.pre.base } : null;
  if (clase === 'ladrillo') {
    PZ.carga = null;
    iniciarCarga(f, pre);
  } else {
    ST.carga = null;
    const g = ST.clasif.grupo || (gruposPz()[0] || {}).id;
    if (!location.hash.startsWith('#/nuevapieza')) history.replaceState(null, '', '#/nuevapieza?grupo=' + encodeURIComponent(g));
    ST.vista = 'nuevapieza'; ST.args = []; pintarNav();
    iniciarPieza(f, pre, g);
  }
}

function bannerClase(clase) {
  const K = ST.clasif;
  const actual = clase === 'ladrillo' ? (ST.carga && ST.carga.archivo && ST.carga.archivo.nombre) : (PZ.carga && PZ.carga.archivo && PZ.carga.archivo.nombre);
  if (!K || !K.file || K.nombre !== actual) return '';
  const otra = clase === 'ladrillo' ? 'pieza' : 'ladrillo';
  const det = K.auto ? (K.auto === clase ? `La app lo identificó como <b>${CLASES[clase].e} ${CLASES[clase].n.toLowerCase()}</b> (${Math.round(K.conf * 100)} % de seguridad)` : `La app lo identificó como ${CLASES[K.auto].n.toLowerCase()}, pero elegiste <b>${CLASES[clase].e} ${CLASES[clase].n.toLowerCase()}</b>`) : `Se abrió como <b>${CLASES[clase].e} ${CLASES[clase].n.toLowerCase()}</b>`;
  const mot = (K.motivos || []).filter(m => m[0] === (K.auto || clase)).slice(0, 3).map(m => m[1]).join(' · ');
  const selG = otra === 'pieza' ? `<select id="bcGrupo" class="mini-sel">${gruposPz().map(g => `<option value="${esc(g.id)}" ${K.grupo === g.id ? 'selected' : ''}>${esc(g.icono + ' ' + g.nombre)}</option>`).join('')}</select>` : '';
  return `<div class="alerta clase" id="bannerClase"><span class="e">${CLASES[clase].e}</span><span>${det}.${mot ? `<small>${esc(mot)}</small>` : ''}</span><span class="acc">${selG}<button class="btn" id="bcCambiar">${CLASES[otra].e} No, es ${otra === 'pieza' ? 'una pieza' : 'un ladrillo'}</button></span></div>`;
}

function enlazarBannerClase(clase) {
  const b = $('bcCambiar');
  if (!b) return;
  b.onclick = () => {
    const K = ST.clasif;
    const otra = clase === 'ladrillo' ? 'pieza' : 'ladrillo';
    const g = $('bcGrupo') ? $('bcGrupo').value : K.grupo;
    abrirComo(K.file, otra, K.auto ? { clase: K.auto, conf: K.conf, motivos: K.motivos, grupo: g, pre: K.pre } : null, g);
  };
}

async function subirArchivo(f) {
  SUBIR.nombre = f.name;
  if (SUBIR.modo !== 'auto') { abrirComo(f, SUBIR.modo, null, SUBIR.grupo); return; }
  SUBIR.estado = 'clasificando'; SUBIR.error = '';
  vistaSubir();
  try {
    const cl = await clasificarArchivo(f);
    if (ST.vista !== 'subir' || SUBIR.nombre !== f.name) return;
    SUBIR.estado = '';
    abrirComo(f, cl.clase, cl, cl.grupo);
  } catch (err) {
    SUBIR.estado = 'error'; SUBIR.error = err.message;
    if (ST.vista === 'subir') vistaSubir();
  }
}

function vistaSubir() {
  if (!puedeCargar()) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty"><b>Solo el administrador puede cargar planos</b><a class="btn" href="#/ajustes">🔐 Entrar como administrador</a></div></div></section>`; return; }
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  SUBIR.modo = q.get('modo') && CLASES[q.get('modo')] ? q.get('modo') : 'auto';
  SUBIR.grupo = q.get('grupo') && grupoDe(q.get('grupo')) ? q.get('grupo') : '';
  SUBIR.molde = q.get('molde') || '';
  if (!SUBIR.grupo) SUBIR.grupo = (gruposPz()[0] || {}).id || '';
  const opc = [['auto', '🤖', 'Detectar solo', 'La app mira el dibujo y el nombre del archivo'], ['ladrillo', CLASES.ladrillo.e, 'Ladrillo', CLASES.ladrillo.d], ['pieza', CLASES.pieza.e, 'Pieza', CLASES.pieza.d]];
  const cuerpo = SUBIR.estado === 'clasificando' ? procesando('Mirando el plano: ¿ladrillo o pieza?…')
    : `${SUBIR.estado === 'error' ? `<div class="alerta bad" style="margin-bottom:12px"><span class="e">⚠️</span><span>${esc(SUBIR.error)}</span></div>` : ''}
      <label class="drop" id="dropSubir"><span class="e">📤</span><b>Soltá acá el plano</b><small>PDF o DXF de AutoCAD · o el modelo 3D en STEP, IGES, STL u OBJ</small><input type="file" accept=".pdf,.dxf,.stl,.obj,.step,.stp,.iges,.igs,.brep" hidden></label>`;
  app().innerHTML = `<section class="vista">${bannerLocal()}<div class="hero"><div><div class="eyebrow">Subir plano</div><h1>Un solo lugar para <span>todos los planos</span></h1><p class="sub">Ladrillos y piezas de moldes o máquinas. La app identifica qué es y lo lleva a su sección; si se equivoca, lo cambiás con un toque.</p></div></div>
    <div class="card"><div class="card-h"><div class="t"><h3>¿Qué estás subiendo?</h3></div></div>
      <div class="clases" id="subModo">${opc.map(([k, e, n, d]) => `<button class="clase-op ${SUBIR.modo === k ? 'on' : ''}" data-m="${k}"><span class="e">${e}</span><b>${n}</b><small>${esc(d)}</small></button>`).join('')}</div>
      <div class="form" id="subGrupoF" ${SUBIR.modo === 'pieza' ? '' : 'hidden'} style="margin-top:12px"><label class="f">Grupo de la pieza<select id="subGrupo">${gruposPz().map(g => `<option value="${esc(g.id)}" ${SUBIR.grupo === g.id ? 'selected' : ''}>${esc(g.icono + ' ' + g.nombre)}</option>`).join('')}</select></label></div>
      <div style="margin-top:14px">${cuerpo}</div>
    </div>
    <div class="grid g3 metodos" style="margin-top:16px">
      <div class="card metodo"><div class="e">🧱</div><b>Ladrillo</b><span>Muchos dados rectangulares dentro de un marco, con rayado en las caras → ladrillo cocido en 3D, revisión y plano A3</span></div>
      <div class="card metodo"><div class="e">🧩</div><b>Pieza de molde</b><span>Dado, marco, núcleo, araña o boquilla → sólido 3D por extrusión, revolución o vistas, agrupado y enlazado a su molde</span></div>
      <div class="card metodo"><div class="e">⚙️</div><b>Pieza de máquina</b><span>Ejes, bujes, poleas, placas, soportes o piezas de la extrusora → sólido 3D y peso según el material</span></div>
    </div></section>`;
  const urlSubir = () => { const p = new URLSearchParams(); if (SUBIR.modo !== 'auto') p.set('modo', SUBIR.modo); if (SUBIR.modo === 'pieza' && SUBIR.grupo) p.set('grupo', SUBIR.grupo); if (SUBIR.molde) p.set('molde', SUBIR.molde); history.replaceState(null, '', '#/subir' + (p.toString() ? '?' + p : '')); };
  document.querySelectorAll('#subModo button').forEach(b => { b.onclick = () => { SUBIR.modo = b.dataset.m; SUBIR.estado = ''; urlSubir(); vistaSubir(); }; });
  if ($('subGrupo')) $('subGrupo').onchange = e => { SUBIR.grupo = e.target.value; urlSubir(); };
  const d = $('dropSubir');
  if (!d) return;
  d.querySelector('input').onchange = e => { if (e.target.files[0]) subirArchivo(e.target.files[0]); };
  d.ondragover = e => { e.preventDefault(); d.classList.add('sobre'); };
  d.ondragleave = () => d.classList.remove('sobre');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('sobre'); if (e.dataTransfer.files[0]) subirArchivo(e.dataTransfer.files[0]); };
}
