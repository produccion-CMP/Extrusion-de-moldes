'use strict';

const PZ = { carga: null, visor: null, geo: {}, q: '', maq: '' };

const MATERIALES = [
  { id: 'Acero SAE 1045', d: 7.85 }, { id: 'Acero SAE 1020', d: 7.86 }, { id: 'Acero SAE 4140', d: 7.85 }, { id: 'Acero inoxidable', d: 7.93 },
  { id: 'Acero al manganeso', d: 7.87 }, { id: 'Fundición gris', d: 7.2 }, { id: 'Bronce', d: 8.8 }, { id: 'Aluminio', d: 2.7 },
  { id: 'Nylon / poliamida', d: 1.14 }, { id: 'Teflón (PTFE)', d: 2.2 }, { id: 'Goma', d: 1.3 }, { id: 'Otro', d: null }
];
const METODOS = {
  extrusion: { e: '▭', n: 'Extrusión', d: 'Un perfil con espesor: placas, bridas, chapas' },
  revolucion: { e: '🔄', n: 'Revolución', d: 'Un perfil que gira sobre su eje: ejes, bujes, poleas' },
  vistas: { e: '🧊', n: 'Por vistas', d: 'Frente, planta y lateral: soportes y piezas prismáticas' },
  malla: { e: '📦', n: 'Modelo 3D', d: 'Archivo STEP, IGES, STL u OBJ' }
};
const EJES = [['h', 'Horizontal por el centro'], ['v', 'Vertical por el centro'], ['inf', 'Borde inferior'], ['sup', 'Borde superior'], ['izq', 'Borde izquierdo'], ['der', 'Borde derecho']];
const EXT_3D = ['stl', 'obj', 'step', 'stp', 'iges', 'igs', 'brep'];

const gruposPz = () => (ST.config && ST.config.gruposPiezas && ST.config.gruposPiezas.length) ? ST.config.gruposPiezas : CONFIG_DEFECTO.gruposPiezas;
const grupoDe = id => gruposPz().find(g => g.id === id);
const piezasDe = gid => ST.piezas.filter(p => gid === '__otros' ? !grupoDe(p.grupo) : p.grupo === gid);
const piezaDe = id => ST.piezas.find(p => p.id === id);
const moldeDePieza = p => p && p.moldeId ? ST.moldes.find(m => m.id === p.moldeId) : null;
const piezasDeMolde = mid => ST.piezas.filter(p => p.moldeId === mid);
const etiquetaPieza = p => (p.codigo ? p.codigo + ' · ' : '') + (p.nombre || p.id);
const densidadDe = p => { const v = num(p.densidad); if (v !== null) return v; const m = MATERIALES.find(x => x.id === p.material); return m && m.d ? m.d : 7.85; };
const pesoKg = (vol, d) => vol / 1000 * d / 1000;

function con3D(cb) {
  if (window.Pieza3D) { cb(); return; }
  let hecho = false;
  window.addEventListener('pieza3d-lista', () => { if (!hecho) { hecho = true; cb(); } }, { once: true });
  setTimeout(() => { if (!hecho) { hecho = true; cb(new Error('No se pudo cargar el visor 3D (three.js)')); } }, 15000);
}
const listo3D = () => new Promise((res, rej) => con3D(e => (e ? rej(e) : res())));

function miniPieza(p) {
  return p.miniatura ? `<div class="mini-pieza"><img src="${esc(p.miniatura)}" alt="" loading="lazy"></div>` : `<div class="mini-pieza vacio"><span>${esc((METODOS[p.metodo] || METODOS.malla).e)}</span></div>`;
}

function cardPieza(p) {
  const md = p.medidas || {};
  const e = estadoDe(p.estado);
  return `<a class="vcard pz" href="#/pieza/${encodeURIComponent(p.id)}">${miniPieza(p)}
    <div class="vc-cuerpo"><div class="mc-top"><div><b>${esc(p.codigo || p.id)}</b><small>${esc(p.nombre || '')}</small></div><span class="tag ${e.cls}">${e.e} ${esc(e.id)}</span></div>
    <div class="mc-k"><div><span>Medidas</span><b>${fmt(md.largo, 0)}×${fmt(md.ancho, 0)}×${fmt(md.alto, 0)}</b></div><div><span>Peso</span><b>${fmt(md.peso, 2)} kg</b></div><div><span>Material</span><b class="corto">${esc(p.material || '—')}</b></div></div>
    <div class="vc-pie">${moldeDePieza(p) ? `<span class="tag">🧱 ${esc(etiquetaMolde(moldeDePieza(p)))}</span>` : ''}${p.maquina ? `<span class="tag">🏭 ${esc(p.maquina)}</span>` : ''}${num(p.cantidad) ? `<span class="tag">× ${fmt(num(p.cantidad))}</span>` : ''}${p.animacionUrl ? '<span class="tag">🎬</span>' : ''}<span class="tag t-mut">${esc((METODOS[p.metodo] || {}).n || '')}</span></div></div></a>`;
}

function filtroPz(p) {
  const q = norm(PZ.q);
  if (q && !norm([p.codigo, p.nombre, p.maquina, moldeDePieza(p) ? etiquetaMolde(moldeDePieza(p)) : '', p.material, p.notas, p.id].join(' ')).includes(q)) return false;
  if (PZ.maq && p.maquina !== PZ.maq) return false;
  return true;
}

function vistaPiezas() {
  const gs = gruposPz().map(g => ({ g, ps: piezasDe(g.id) }));
  const otros = piezasDe('__otros');
  if (otros.length) gs.push({ g: { id: '__otros', nombre: 'Otros', icono: '📦', descripcion: 'Piezas sin grupo' }, ps: otros });
  const res = PZ.q ? ST.piezas.filter(filtroPz) : [];
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div><div class="eyebrow">${esc(CONF.PLANTA || 'Planta')}</div><h1>Piezas de <span>moldes y máquinas</span></h1>
      <p class="sub">Del plano de la pieza (PDF, DXF, STEP o STL) a la pieza en 3D, agrupada por tipo.</p></div>
      <div class="acciones">${esAdmin() ? '<button class="btn" id="bGrupoN">＋ Nuevo grupo</button>' : ''}${puedeCargar() ? '<a class="btn pri" href="#/subir?modo=pieza">📤 Subir pieza</a>' : ''}</div></div>
    <div id="grupoN"></div>
    <div class="buscador"><input id="pzQ" type="search" placeholder="🔎 Buscar por código, nombre, máquina o material" value="${esc(PZ.q)}"></div>
    ${PZ.q ? (res.length ? `<div class="grid-var">${res.map(cardPieza).join('')}</div>` : '<div class="card"><div class="empty">No hay piezas que coincidan.</div></div>') : `<div class="grid-fam">${gs.map(({ g, ps }) => {
      const ult = ps.slice().sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')))[0];
      const maqs = [...new Set(ps.map(p => p.maquina).filter(Boolean))];
      return `<a class="fcard" href="#/grupo/${encodeURIComponent(g.id)}"><div class="fc-top"><span class="fc-ico">${esc(g.icono || '⚙️')}</span><div><b>${esc(g.nombre)}</b><small>${esc(g.descripcion || '')}</small></div></div>
        ${ult ? miniPieza(ult) : '<div class="mini-pieza vacio"><span>Sin piezas cargadas</span></div>'}
        <div class="fc-k"><span><b>${ps.length}</b> pieza${ps.length === 1 ? '' : 's'}</span>${g.metodo ? `<span>${esc(METODOS[g.metodo] ? METODOS[g.metodo].e + ' ' + METODOS[g.metodo].n : '')}</span>` : ''}${maqs.length ? `<span class="codigos">${maqs.slice(0, 4).map(esc).join(' · ')}</span>` : ''}</div></a>`;
    }).join('')}</div>`}
  </section>`;
  const q = $('pzQ');
  q.oninput = () => { PZ.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { vistaPiezas(); const n = $('pzQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  if ($('bGrupoN')) $('bGrupoN').onclick = () => {
    $('grupoN').innerHTML = cardHtml('＋ Nuevo grupo de piezas', 'Por ejemplo: Rodamientos, Cuchillas, Hélices', `<div class="fam-fila" id="gNueva">${filaGrupoCampos({ icono: '⚙️', metodo: 'extrusion' })}</div><div class="acciones"><button class="btn" id="bGNx">Cancelar</button><button class="btn pri" id="bGNok">💾 Crear grupo</button></div>`, ' style="margin-bottom:16px"');
    $('bGNx').onclick = () => { $('grupoN').innerHTML = ''; };
    $('bGNok').onclick = async () => {
      const g = leerFilaGrupo($('gNueva'));
      if (!g.nombre) { toast('Poné el nombre del grupo', 'warn'); return; }
      if (gruposPz().some(x => x.id === g.id)) { toast('Ya existe un grupo con ese nombre', 'warn'); return; }
      await guardarCfg({ gruposPiezas: gruposPz().concat([g]) });
    };
  };
}

function vistaGrupo(gid) {
  const g = grupoDe(gid) || (gid === '__otros' ? { id: '__otros', nombre: 'Otros', icono: '📦', descripcion: 'Piezas sin grupo' } : null);
  if (!g) { location.hash = '#/piezas'; return; }
  const todas = piezasDe(gid);
  const maqs = [...new Set(todas.map(p => p.maquina).filter(Boolean))].sort();
  if (PZ.maq && !maqs.includes(PZ.maq)) PZ.maq = '';
  const ps = todas.filter(p => !PZ.maq || p.maquina === PZ.maq).sort((a, b) => String(a.codigo || a.nombre).localeCompare(String(b.codigo || b.nombre), 'es', { numeric: true }));
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div>${migas([['Piezas', '#/piezas'], [g.nombre]])}<h1>${esc(g.icono || '')} <span>${esc(g.nombre)}</span></h1><p class="sub">${esc(g.descripcion || '')}${g.metodo && METODOS[g.metodo] ? ' · se arma por ' + esc(METODOS[g.metodo].n.toLowerCase()) : ''}</p></div>
      <div class="acciones">${esAdmin() && gid !== '__otros' ? '<a class="btn" href="#/ajustes">🗂️ Editar grupos</a>' : ''}${puedeCargar() ? `<a class="btn pri" href="#/nuevapieza?grupo=${encodeURIComponent(gid)}">⚙️ Cargar pieza</a>` : ''}</div></div>
    ${maqs.length > 1 ? `<div class="chips">${['', ...maqs].map(m => `<button class="chip ${PZ.maq === m ? 'on' : ''}" data-m="${esc(m)}">${m ? '🏭 ' + esc(m) : 'Todas las máquinas'}</button>`).join('')}</div>` : ''}
    ${ps.length ? `<div class="grid-var">${ps.map(cardPieza).join('')}</div>` : `<div class="card"><div class="empty"><b>Todavía no hay piezas en ${esc(g.nombre)}</b><span>Cargá el plano de la pieza para verla en 3D.</span>${puedeCargar() ? `<a class="btn pri" href="#/nuevapieza?grupo=${encodeURIComponent(gid)}">⚙️ Cargar pieza</a>` : ''}</div></div>`}
  </section>`;
  app().querySelectorAll('.chip[data-m]').forEach(b => { b.onclick = () => { PZ.maq = b.dataset.m; vistaGrupo(gid); }; });
}

function toolbarPieza() {
  return `<div class="tb"><div class="seg" id="pzVista"><button class="on" data-v="iso">🧊 Isométrica</button><button data-v="frente">Frente</button><button data-v="planta">Planta</button><button data-v="lateral">Lateral</button></div>
    <div class="seg" id="pzTog"><button class="on" data-t="cotas">Cotas</button><button class="on" data-t="aristas">Aristas</button><button data-t="corte">Corte</button><button class="on" data-t="girar">Girar</button></div></div>`;
}

function enlazarToolbarPieza() {
  const v = $('pzVista');
  if (v) {
    v.querySelectorAll('button').forEach(b => { b.onclick = () => { v.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); moverPill(v); if (PZ.visor) PZ.visor.vista(b.dataset.v); const g = $('pzTog') && $('pzTog').querySelector('[data-t=girar]'); if (g) g.classList.remove('on'); }; });
    moverPill(v);
  }
  const t = $('pzTog');
  if (t) t.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      b.classList.toggle('on');
      const on = b.classList.contains('on');
      if (!PZ.visor) return;
      if (b.dataset.t === 'girar') PZ.visor.girar(on); else PZ.visor.mostrar(b.dataset.t, on);
      if (b.dataset.t === 'corte' && on) { const g = t.querySelector('[data-t=girar]'); g.classList.remove('on'); }
    };
  });
}

function aplicarToolbar() {
  const t = $('pzTog');
  if (!t || !PZ.visor) return;
  t.querySelectorAll('button').forEach(b => { const on = b.classList.contains('on'); if (b.dataset.t === 'girar') PZ.visor.girar(on); else if (b.dataset.t !== 'corte' || on) PZ.visor.mostrar(b.dataset.t, on); });
}

function montarPieza(host, geo, titulo, subtitulo) {
  if (PZ.visor) { PZ.visor.destruir(); PZ.visor = null; }
  PZ.visor = window.Pieza3D.montar(host, geo, { titulo, subtitulo });
  aplicarToolbar();
}

function detPieza(md, dens) {
  return `<div class="det grande">
    <div class="full2"><span>Medidas totales (largo × ancho × alto)</span><b>${fmt(md.largo, 1)} × ${fmt(md.ancho, 1)} × ${fmt(md.alto, 1)} mm</b></div>
    <div><span>Volumen</span><b>${fmt(md.volumen / 1000, 1)} cm³</b></div>
    <div><span>Peso</span><b>${fmt(pesoKg(md.volumen, dens), 3)} kg</b></div>
    <div><span>Superficie</span><b>${fmt(md.superficie / 100, 0)} cm²</b></div>
    <div><span>Densidad</span><b>${fmt(dens, 2)} g/cm³</b></div>
  </div>`;
}

async function defPieza(id) {
  if (PZ.geo[id]) return PZ.geo[id];
  const g = await API.geometria(id);
  PZ.geo[id] = g;
  return g;
}

async function vistaPieza(id) {
  const p = piezaDe(id);
  if (!p) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty">No existe la pieza ${esc(id)}. <a class="btn" href="#/piezas">Volver</a></div></div></section>`; return; }
  const g = grupoDe(p.grupo) || { id: '__otros', nombre: 'Otros', icono: '📦' };
  const e = estadoDe(p.estado);
  const dens = densidadDe(p);
  const archivos = [p.archivoUrl ? `<a class="btn" href="${esc(p.archivoUrl)}" target="_blank" rel="noopener">📄 Plano original</a>` : '', p.animacionUrl ? `<a class="btn" href="${esc(p.animacionUrl)}" target="_blank" rel="noopener">🎬 Animación</a>` : '', p.imagenUrl ? `<a class="btn" href="${esc(p.imagenUrl)}" target="_blank" rel="noopener">🖼️ Imagen</a>` : ''].join('');
  const fila = (l, v) => v ? `<tr><td>${l}</td><td>${v}</td></tr>` : '';
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div>${migas([['Piezas', '#/piezas'], [g.nombre, '#/grupo/' + encodeURIComponent(g.id)], [p.codigo || p.id]])}
      <h1>${esc(p.codigo || p.id)} <span>${esc(p.nombre || '')}</span></h1>
      <p class="sub"><span class="tag ${e.cls}">${e.e} ${esc(e.id)}</span> ${p.maquina ? '· 🏭 ' + esc(p.maquina) : ''} ${p.material ? '· ' + esc(p.material) : ''} ${p.version ? '· ' + esc(p.version) : ''}</p></div>
      <div class="acciones">${esAdmin() ? '<button class="btn" id="pzEditar">✏️ Editar</button><button class="btn" id="pzBorrar" title="Eliminar">🗑️</button>' : ''}</div></div>
    <div id="pzEd"></div>
    <div class="grid g-21">
      ${cardHtml('⚙️ Pieza en 3D', 'Arrastrá para girarla · rueda para acercar · «Corte» muestra el interior', toolbarPieza() + '<div class="visor" id="visorPz"></div>')}
      <div class="col">
        ${cardHtml('📐 Medidas', `${esc((METODOS[p.metodo] || {}).n || '')}`, `<div id="pzKpi">${procesando('Armando la pieza…')}</div>`)}
        ${cardHtml('📋 Datos', '', `<table class="tabla-datos"><tbody>${fila('Grupo', esc(g.icono + ' ' + g.nombre))}${fila('Molde', moldeDePieza(p) ? `<a href="#/molde/${encodeURIComponent(p.moldeId)}">${esc(etiquetaMolde(moldeDePieza(p)))}</a>` : '—')}${fila('Máquina / equipo', esc(p.maquina))}${fila('Material', esc(p.material))}${fila('Cantidad por equipo', num(p.cantidad) ? fmt(num(p.cantidad)) : '')}${fila('Versión', esc(p.version))}${fila('Archivo', esc(p.archivo))}${fila('Actualizado', fFecha(p.actualizado))}${fila('Notas', esc(p.notas))}</tbody></table>`, ' style="margin-top:16px"')}
      </div>
    </div>
    ${cardHtml('☁️ Archivos', modoLocal() ? 'En modo local no se suben archivos' : (p.animacionUrl ? '' : 'Todavía sin animación'), `<div class="acciones" style="margin-top:0">${archivos}<button class="btn" id="pzStl">⬇️ STL (impresión 3D)</button><button class="btn" id="pzPng">🖼️ Imagen PNG</button>${modoLocal() ? '' : `<button class="btn ${p.animacionUrl ? '' : 'pri'}" id="pzAnim">🎬 ${p.animacionUrl ? 'Volver a grabar animación' : 'Grabar animación y subir a Drive'}</button>`}</div>`, ' style="margin-top:16px"')}
  </section>`;
  enlazarToolbarPieza();
  if ($('pzEditar')) $('pzEditar').onclick = () => editarPieza(p);
  if ($('pzBorrar')) $('pzBorrar').onclick = () => borrarPieza(p);
  const base = nombreArchivo(etiquetaPieza(p));
  let def;
  try { def = await defPieza(p.id); await listo3D(); } catch (err) { $('pzKpi').innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; return; }
  if (ST.vista !== 'pieza' || ST.args[0] !== id) return;
  let r;
  try { r = await Pieza3D.construir(def); } catch (err) { $('pzKpi').innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; return; }
  if (ST.vista !== 'pieza' || ST.args[0] !== id) { r.geo.dispose(); return; }
  $('pzKpi').innerHTML = detPieza(r.medidas, dens);
  montarPieza($('visorPz'), r.geo, etiquetaPieza(p), subtituloPieza(r.medidas, dens, p.material));
  $('pzStl').onclick = () => descargar(base + '.stl', PZ.visor.stl(), 'model/stl');
  $('pzPng').onclick = () => descargar(base + '.png', PZ.visor.captura());
  if ($('pzAnim')) $('pzAnim').onclick = () => grabarAnimPieza(p);
}

const subtituloPieza = (md, dens, mat) => `${fmt(md.largo, 1)} × ${fmt(md.ancho, 1)} × ${fmt(md.alto, 1)} mm · ${fmt(pesoKg(md.volumen, dens), 2)} kg${mat ? ' · ' + mat : ''}`;

async function archivosVisor(base, avisar) {
  const out = [];
  if (!PZ.visor) return out;
  if (PZ.visor.puedeGrabar()) {
    try {
      const v = await PZ.visor.grabar(7, 960, 600, avisar);
      out.push({ rol: 'animacion', nombre: base + '_3D.' + v.ext, mime: v.mime, base64: await blobBase64(v.blob) });
    } catch (e) { toast('No se pudo grabar la animación: ' + e.message, 'warn'); }
  }
  out.push({ rol: 'imagen', nombre: base + '_3D.png', mime: 'image/png', base64: PZ.visor.captura().split(',')[1] });
  return out;
}

async function grabarAnimPieza(p) {
  const btn = $('pzAnim');
  if (!PZ.visor) { toast('Esperá a que cargue el 3D', 'warn'); return; }
  btn.disabled = true;
  loader(true);
  try {
    const arch = await archivosVisor(nombreArchivo(etiquetaPieza(p)), x => { btn.innerHTML = `🎬 Grabando… ${x} %`; });
    btn.innerHTML = '☁️ Subiendo…';
    await API.enviar({ accion: 'guardarPieza', pieza: { id: p.id, codigo: p.codigo, grupo: p.grupo }, archivos: arch });
    toast('Animación guardada en Drive', 'ok');
    await cargar(true);
  } catch (err) { toast(err.message, 'bad'); btn.disabled = false; btn.innerHTML = '🎬 Grabar animación y subir a Drive'; } finally { loader(false); }
}

function camposPieza(p, pre, gidDef) {
  const v = k => (p[k] === undefined || p[k] === null) ? '' : p[k];
  const mat = MATERIALES.find(m => m.id === p.material) ? p.material : (p.material ? 'Otro' : MATERIALES[0].id);
  return `<div class="form">
    <label class="f">Grupo<select id="${pre}grupo">${gruposPz().map(g => `<option value="${esc(g.id)}" ${(p.grupo || gidDef) === g.id ? 'selected' : ''}>${esc(g.icono + ' ' + g.nombre)}</option>`).join('')}</select></label>
    <label class="f">Código<input id="${pre}codigo" maxlength="30" value="${esc(v('codigo'))}" placeholder="EX-EJE-01"></label>
    <label class="f w2">Nombre<input id="${pre}nombre" maxlength="80" value="${esc(v('nombre'))}" placeholder="Eje de la hélice de la extrusora"></label>
    <label class="f">Máquina / equipo<input id="${pre}maquina" maxlength="50" list="${pre}maqs" value="${esc(v('maquina'))}" placeholder="Extrusora"><datalist id="${pre}maqs">${[...new Set(ST.piezas.map(x => x.maquina).filter(Boolean))].map(m => `<option value="${esc(m)}">`).join('')}</datalist></label>
    <label class="f">Molde al que pertenece<select id="${pre}moldeId"><option value="">— ninguno —</option>${ST.moldes.slice().sort((a, b) => etiquetaMolde(a).localeCompare(etiquetaMolde(b), 'es', { numeric: true })).map(m => `<option value="${esc(m.id)}" ${p.moldeId === m.id ? 'selected' : ''}>${esc(etiquetaMolde(m))}</option>`).join('')}</select></label>
    <label class="f">Material<select id="${pre}material">${MATERIALES.map(m => `<option value="${esc(m.id)}" ${mat === m.id ? 'selected' : ''}>${esc(m.id)}${m.d ? ' · ' + fmt(m.d, 2) : ''}</option>`).join('')}</select></label>
    <label class="f">Densidad (g/cm³)<input id="${pre}densidad" type="number" step="0.01" value="${esc(v('densidad') || (MATERIALES.find(m => m.id === mat) || {}).d || '')}"></label>
    <label class="f">Cantidad por equipo<input id="${pre}cantidad" type="number" step="1" min="0" value="${esc(v('cantidad'))}"></label>
    <label class="f">Estado<select id="${pre}estado">${ESTADOS.map(s => `<option ${(p.estado || 'Vigente') === s.id ? 'selected' : ''}>${esc(s.id)}</option>`).join('')}</select></label>
    <label class="f">Versión<input id="${pre}version" maxlength="30" value="${esc(v('version'))}" placeholder="Rev. A"></label>
    <label class="f full">Notas<input id="${pre}notas" maxlength="400" value="${esc(v('notas'))}" placeholder="Tratamiento térmico, tolerancias, proveedor…"></label>
  </div>`;
}

function leerPieza(pre) {
  const g = k => { const el = $(pre + k); return el ? el.value.trim() : ''; };
  const o = {};
  ['grupo', 'codigo', 'nombre', 'maquina', 'moldeId', 'material', 'densidad', 'cantidad', 'estado', 'version', 'notas'].forEach(k => { o[k] = g(k); });
  return o;
}

function enlazarMaterial(pre, alCambiar) {
  const m = $(pre + 'material'), d = $(pre + 'densidad');
  if (!m) return;
  m.onchange = () => { const x = MATERIALES.find(z => z.id === m.value); if (x && x.d) d.value = x.d; if (alCambiar) alCambiar(); };
  d.oninput = () => { if (alCambiar) alCambiar(); };
}

function editarPieza(p) {
  $('pzEd').innerHTML = cardHtml('✏️ Editar pieza', '', camposPieza(p, 'e') + '<div class="acciones"><button class="btn" id="eNo">Cancelar</button><button class="btn pri" id="eOk">💾 Guardar cambios</button></div>', ' style="margin-bottom:16px"');
  enlazarMaterial('e');
  $('eNo').onclick = () => { $('pzEd').innerHTML = ''; };
  $('eOk').onclick = async () => {
    const o = leerPieza('e');
    if (!o.nombre) { toast('La pieza necesita un nombre', 'warn'); return; }
    const md = Object.assign({}, p.medidas || {});
    if (md.volumen) md.peso = pesoKg(md.volumen, num(o.densidad) || densidadDe(o));
    loader(true);
    try { toast((await API.enviar({ accion: 'guardarPieza', pieza: Object.assign({ id: p.id, medidas: md }, o) })).msg, 'ok'); await cargar(true); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
  };
}

async function borrarPieza(p) {
  if (!await confirmar('¿Borrar la pieza ' + etiquetaPieza(p) + '? Los archivos en Drive no se borran.')) return;
  loader(true);
  try { toast((await API.enviar({ accion: 'borrarPieza', id: p.id })).msg, 'ok'); delete PZ.geo[p.id]; location.hash = '#/grupo/' + encodeURIComponent(p.grupo || '__otros'); await cargar(true); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

function dropPieza(id, chico) {
  return `<label class="drop${chico ? ' chico' : ''}" id="${id}"><span class="e">⚙️</span><b>Soltá acá el plano de la pieza</b><small>PDF o DXF con las vistas de la pieza · o el modelo 3D en STEP, IGES, STL u OBJ</small><input type="file" accept=".pdf,.dxf,.stl,.obj,.step,.stp,.iges,.igs,.brep" hidden></label>`;
}

function enlazarDropPieza(id) {
  const d = $(id);
  if (!d) return;
  d.querySelector('input').onchange = e => { if (e.target.files[0]) iniciarPieza(e.target.files[0]); };
  d.ondragover = e => { e.preventDefault(); d.classList.add('sobre'); };
  d.ondragleave = () => d.classList.remove('sobre');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('sobre'); if (e.dataTransfer.files[0]) iniciarPieza(e.dataTransfer.files[0]); };
}

function grupoInicial() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const g = q.get('grupo');
  return grupoDe(g) ? g : (gruposPz()[0] || {}).id;
}

async function iniciarPieza(f, pre, gidPre) {
  const ext = f.name.toLowerCase().split('.').pop();
  const gid = gidPre && grupoDe(gidPre) ? gidPre : grupoInicial();
  const g = grupoDe(gid) || {};
  const nombre = f.name.replace(/\.[^.]+$/, '');
  if (!ST.clasif || ST.clasif.nombre !== f.name || ST.clasif.file !== f) ST.clasif = { nombre: f.name, file: f, clase: 'pieza', auto: null, motivos: [], grupo: gid };
  PZ.carga = { archivo: { nombre: f.name, mime: f.type || 'application/octet-stream', ext }, estado: 'leyendo', meta: { grupo: gid, nombre, codigo: '', moldeId: typeof SUBIR !== 'undefined' && SUBIR.molde && ST.moldes.some(m => m.id === SUBIR.molde) ? SUBIR.molde : '' }, cambios: {}, perfiles: {}, version: 0 };
  vistaNuevaPieza();
  const C = PZ.carga;
  try {
    const buf = pre ? pre.buf : await f.arrayBuffer();
    C.buf = buf.slice(0);
    if (EXT_3D.includes(ext)) {
      await listo3D();
      const r = await Pieza3D.leerArchivo3D(f.name, buf);
      C.def = { v: 1, metodo: 'malla', malla: r.malla };
      C.metodo = 'malla';
    } else if (ext === 'pdf' || ext === 'dxf') {
      C.lect = pre ? pre.lect : ext === 'pdf' ? await Geo.leerPdf(buf) : Geo.leerDxf(new TextDecoder('utf-8').decode(buf));
      C.capas = Geo.capasPieza(C.lect);
      C.marco = 'auto';
      C.metodo = g.metodo && g.metodo !== 'malla' ? g.metodo : 'extrusion';
      C.escalaN = 1;
      C.proyeccion = 'E';
      C.espesor = '';
      detectarVistas();
    } else throw new Error('Formato no admitido: ' + ext.toUpperCase());
    C.estado = 'listo';
  } catch (err) { C.estado = 'error'; C.error = err.message; }
  if (PZ.carga === C) vistaNuevaPieza();
}

function detectarVistas() {
  const C = PZ.carga;
  C.V = Geo.vistasPieza(C.lect, { capas: C.capas, marco: C.marco });
  C.capas = C.V.capas;
  C.perfiles = {};
  C.cambios = {};
  const r = C.V.roles;
  C.roles = { frente: r.frente || (C.V.vistas[0] || {}).id || '', planta: r.planta || '', lateral: r.lateral || '' };
  C.eje = ejeAuto('frente');
  if (C.metodo === 'vistas' && !C.roles.planta && !C.roles.lateral) C.metodo = 'extrusion';
}

function dentroFormas(formas, x, y) {
  let c = false;
  for (const f of formas) for (const r of [f.outer].concat(f.holes)) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], b = r[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
  }
  return c;
}

function ejeAuto(rol) {
  const C = PZ.carga;
  let P;
  try { P = perfilDe(rol); } catch (e) { return 'h'; }
  if (!P) return 'h';
  const pts = P.formas.flatMap(f => f.outer);
  const x0 = Math.min(...pts.map(q => q[0])), x1 = Math.max(...pts.map(q => q[0])), y0 = Math.min(...pts.map(q => q[1])), y1 = Math.max(...pts.map(q => q[1]));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, N = 36;
  let dh = 0, dv = 0, n = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / N, y = y0 + (y1 - y0) * (j + 0.5) / N;
    const d = dentroFormas(P.formas, x, y);
    if (d) n++;
    if (d !== dentroFormas(P.formas, x, 2 * cy - y)) dh++;
    if (d !== dentroFormas(P.formas, 2 * cx - x, y)) dv++;
  }
  const tol = 0.02 * N * N;
  if (Math.abs(dh - dv) > tol) return dh < dv ? 'h' : 'v';
  return (x1 - x0) >= (y1 - y0) ? 'h' : 'v';
}

const vistaPz = id => PZ.carga && PZ.carga.V ? PZ.carga.V.vistas.find(v => v.id === +id) : null;

function posiciones() {
  const C = PZ.carga, f = vistaPz(C.roles.frente), p = vistaPz(C.roles.planta), l = vistaPz(C.roles.lateral);
  return { posPlanta: f && p ? (p.cy < f.cy ? 'abajo' : 'arriba') : 'abajo', posLateral: f && l ? (l.cx > f.cx ? 'der' : 'izq') : 'der' };
}

function perfilDe(rol) {
  const C = PZ.carga;
  const v = vistaPz(C.roles[rol]);
  if (!v) return null;
  const k = v.id + '|' + (C.metodo === 'revolucion' ? 'r' : 'h') + '|' + JSON.stringify(C.cambios[v.id] || []);
  if (!C.perfiles[k]) C.perfiles[k] = Geo.perfilVista(C.lect, C.capas, v, { cambios: C.cambios[v.id] || [], defectoHueco: C.metodo !== 'revolucion' });
  return C.perfiles[k];
}

function escalaPz() { const C = PZ.carga; return C.lect.mmPorUnidad * (num(C.escalaN) || 1); }

function defCarga() {
  const C = PZ.carga;
  if (C.metodo === 'malla') return Object.assign({}, C.def, { arriba: C.arriba || 'z' });
  const roles = C.metodo === 'vistas' ? ['frente', 'planta', 'lateral'] : ['frente'];
  const vistas = {};
  const red = p => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
  roles.forEach(k => { const P = perfilDe(k); if (P) vistas[k] = { formas: P.formas.map(f => ({ outer: f.outer.map(red), holes: f.holes.map(h => h.map(red)) })) }; });
  let espesor = num(C.espesor) || 0;
  if (C.metodo === 'extrusion' && !espesor) {
    const o = vistaPz(C.roles.lateral) || vistaPz(C.roles.planta) || C.V.vistas.find(v => v.id !== +C.roles.frente);
    if (o) espesor = +((o === vistaPz(C.roles.planta) ? o.h : Math.min(o.w, o.h)) * escalaPz()).toFixed(2);
  }
  return Object.assign({ v: 1, metodo: C.metodo, vistas, escala: escalaPz(), espesor, eje: C.eje, proyeccion: C.proyeccion }, posiciones());
}

function svgDibujo() {
  const C = PZ.carga;
  const sel = C.lect.capas.filter(c => C.capas.includes(c.key));
  const b = C.V.bb, W = b.x1 - b.x0, H = b.y1 - b.y0, pad = 0.03 * Math.max(W, H);
  const sx = x => (x - b.x0 + pad).toFixed(2), sy = y => (b.y1 - y + pad).toFixed(2);
  const sw = (0.0016 * Math.max(W, H)).toFixed(3);
  const paths = sel.map(c => `<path d="${c.polys.map(s => { let d = 'M' + sx(s.p[0]) + ' ' + sy(s.p[1]); for (let i = 2; i < s.p.length; i += 2) d += 'L' + sx(s.p[i]) + ' ' + sy(s.p[i + 1]); return d; }).join('')}" fill="none" stroke="var(--muted)" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`).join('');
  const rolDe = id => Object.keys(C.roles).find(k => +C.roles[k] === id && (k === 'frente' || C.metodo === 'vistas'));
  const col = { frente: 'var(--accent)', planta: 'var(--info)', lateral: 'var(--ok)' };
  const fs = (0.022 * Math.max(W, H)).toFixed(2);
  const cajas = C.V.vistas.map(v => {
    const r = rolDe(v.id);
    const c = r ? col[r] : 'var(--line-strong, #9aa)';
    const nom = r ? (r === 'frente' ? (C.metodo === 'vistas' ? 'Frente' : 'Perfil') : r === 'planta' ? 'Planta' : 'Lateral') : '';
    return `<g class="vz" data-id="${v.id}"><rect x="${sx(v.x0)}" y="${sy(v.y1)}" width="${(v.w).toFixed(2)}" height="${(v.h).toFixed(2)}" fill="${r ? c : 'transparent'}" fill-opacity="${r ? 0.08 : 0}" stroke="${c}" stroke-width="${(2 * sw).toFixed(3)}" stroke-dasharray="${r ? '' : (4 * sw).toFixed(2)}" vector-effect="non-scaling-stroke"/><text x="${sx(v.x0)}" y="${(+sy(v.y1) - 0.6 * fs).toFixed(2)}" font-size="${fs}" font-weight="800" fill="${c}">${v.id}${nom ? ' · ' + nom : ''}</text></g>`;
  }).join('');
  return `<svg class="dibujo-pz" viewBox="0 0 ${(W + 2 * pad).toFixed(2)} ${(H + 2 * pad + 1.2 * fs).toFixed(2)}" preserveAspectRatio="xMidYMid meet"><g transform="translate(0 ${(1.2 * fs).toFixed(2)})">${paths}${cajas}</g></svg>`;
}

function svgPerfil(rol) {
  const C = PZ.carga;
  const P = perfilDe(rol);
  if (!P) return '';
  const v = vistaPz(C.roles[rol]);
  const b = P.bb, W = b.x1 - b.x0, H = b.y1 - b.y0;
  const sx = x => (x - b.x0).toFixed(3), sy = y => (b.y1 - y).toFixed(3);
  const dd = poly => 'M' + poly.map(p => sx(p[0]) + ' ' + sy(p[1])).join('L') + 'Z';
  const formas = P.formas.map(f => `<path d="${dd(f.outer)}${f.holes.map(dd).join('')}" fill-rule="evenodd" class="pf-solido"/>`).join('');
  const regs = P.regiones.map(r => `<path d="${dd(r.poly)}" class="pf-reg ${r.hueco ? 'h' : 's'}" data-x="${r.x}" data-y="${r.y}" data-h="${r.hueco ? 1 : 0}" data-v="${v.id}"><title>${r.hueco ? 'Hueco · tocá para hacerlo macizo' : 'Macizo · tocá para marcarlo como hueco'}</title></path>`).join('');
  const w = P.formas.reduce((a, f) => Math.max(a, Math.max(...f.outer.map(p => p[0])) - Math.min(...f.outer.map(p => p[0]))), 0) * escalaPz();
  const h = P.formas.reduce((a, f) => Math.max(a, Math.max(...f.outer.map(p => p[1])) - Math.min(...f.outer.map(p => p[1]))), 0) * escalaPz();
  return `<figure class="perfil-pz"><figcaption><b>${rol === 'frente' ? (C.metodo === 'vistas' ? 'Frente' : 'Perfil') : rol === 'planta' ? 'Planta' : 'Lateral'}</b> · vista ${v.id} · ${fmt(w, 1)} × ${fmt(h, 1)} mm · ${P.formas.reduce((a, f) => a + f.holes.length, 0)} hueco(s)</figcaption>
    <svg viewBox="0 0 ${W.toFixed(3)} ${H.toFixed(3)}" preserveAspectRatio="xMidYMid meet">${formas}${regs}</svg></figure>`;
}

function vistaNuevaPieza() {
  const C = PZ.carga;
  if (PZ.visor) { PZ.visor.destruir(); PZ.visor = null; }
  if (!puedeCargar()) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty"><b>Solo el administrador puede cargar planos</b><a class="btn" href="#/ajustes">🔐 Entrar como administrador</a></div></div></section>`; return; }
  const cab = t => `<div class="hero"><div>${migas([['Piezas', '#/piezas'], ['Nueva pieza']])}<h1>${t}</h1>`;
  if (!C) {
    app().innerHTML = `<section class="vista">${bannerLocal()}${cab('Del plano a la <span>pieza en 3D</span>')}<p class="sub">Soltá el plano de la pieza. Si es un PDF o DXF, la app busca las vistas (frente, planta, lateral) y arma el sólido; si ya tenés el modelo 3D, lo muestra directo.</p></div></div>
      <div class="card">${dropPieza('dropPz')}</div>
      <div class="grid g3 metodos" style="margin-top:16px">${['revolucion', 'extrusion', 'vistas'].map(k => `<div class="card metodo"><div class="e">${METODOS[k].e}</div><b>${METODOS[k].n}</b><span>${METODOS[k].d}</span></div>`).join('')}</div></section>`;
    enlazarDropPieza('dropPz');
    return;
  }
  if (C.estado === 'leyendo') { app().innerHTML = `<section class="vista">${cab('Leyendo <span>' + esc(C.archivo.nombre) + '</span>')}</div></div><div class="card">${procesando(EXT_3D.includes(C.archivo.ext) ? 'Leyendo el modelo 3D…' : 'Buscando las vistas de la pieza…')}</div></section>`; return; }
  if (C.estado === 'error') {
    app().innerHTML = `<section class="vista">${cab('No se pudo leer <span>' + esc(C.archivo.nombre) + '</span>')}</div></div>${bannerClase('pieza')}<div class="alerta bad"><span class="e">⚠️</span><span>${esc(C.error)}</span></div><div class="card" style="margin-top:16px">${dropPieza('dropPz', true)}</div></section>`;
    enlazarDropPieza('dropPz');
    enlazarBannerClase('pieza');
    return;
  }
  const es2D = C.metodo !== 'malla';
  const opV = (sel, vacio) => (vacio ? `<option value="">— ${vacio} —</option>` : '') + C.V.vistas.map(v => `<option value="${v.id}" ${+sel === v.id ? 'selected' : ''}>Vista ${v.id} · ${fmt(v.w * escalaPz(), 0)} × ${fmt(v.h * escalaPz(), 0)} mm</option>`).join('');
  const controles = es2D ? `
    <div class="seg metodo-seg" id="pzMet">${['revolucion', 'extrusion', 'vistas'].map(k => `<button data-m="${k}" class="${C.metodo === k ? 'on' : ''}">${METODOS[k].e} ${METODOS[k].n}</button>`).join('')}</div>
    <p class="sub" style="margin:8px 0 12px">${esc(METODOS[C.metodo].d)}</p>
    <div class="form">
      <label class="f">${C.metodo === 'vistas' ? 'Vista de frente' : 'Vista del perfil'}<select id="pzRF">${opV(C.roles.frente)}</select></label>
      ${C.metodo === 'vistas' ? `<label class="f">Vista de planta (desde arriba)<select id="pzRP">${opV(C.roles.planta, 'sin planta')}</select></label><label class="f">Vista lateral<select id="pzRL">${opV(C.roles.lateral, 'sin lateral')}</select></label>
      <label class="f">Sistema de proyección<select id="pzProy"><option value="E" ${C.proyeccion === 'E' ? 'selected' : ''}>ISO E · 1.er diedro (IRAM)</option><option value="A" ${C.proyeccion === 'A' ? 'selected' : ''}>ISO A · 3.er diedro</option></select></label>` : ''}
      ${C.metodo === 'revolucion' ? `<label class="f">Eje de giro<select id="pzEje">${EJES.map(([k, n]) => `<option value="${k}" ${C.eje === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      ${C.metodo === 'extrusion' ? `<label class="f">Espesor (mm)<input id="pzEsp" type="number" step="0.1" min="0" value="${esc(C.espesor)}" placeholder="${C.roles.planta || C.roles.lateral ? 'de la otra vista' : '10'}"></label>` : ''}
      <label class="f">Escala del plano 1:<input id="pzEsc" type="number" step="any" min="0" value="${esc(C.escalaN)}"></label>
      <label class="f">o ancho real del ${C.metodo === 'vistas' ? 'frente' : 'perfil'} (mm)<input id="pzAnchoR" type="number" step="0.1" min="0" placeholder="${fmt((vistaPz(C.roles.frente) || { w: 0 }).w * escalaPz(), 1)}"></label>
    </div>` : `<div class="det"><div class="full2"><span>Modelo 3D</span><b>${esc(C.archivo.nombre)}</b></div></div><div class="form" style="margin-top:10px"><label class="f">Qué eje va hacia arriba<select id="pzArriba">${[['z', 'Z (AutoCAD, Inventor, SolidWorks en Z)'], ['y', 'Y (SolidWorks por defecto, Fusion)'], ['x', 'X']].map(([k, n]) => `<option value="${k}" ${(C.arriba || 'z') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div><p class="sub" style="margin-top:8px">Se toma en milímetros, tal como viene del CAD.</p>`;
  app().innerHTML = `<section class="vista">${bannerLocal()}${cab('Así queda la <span>pieza en 3D</span>')}<p class="sub">${esc(C.archivo.nombre)}${es2D ? ` · ${C.V.vistas.length} vista(s) encontradas${C.V.marco ? ' · se ignoró el marco de la lámina' : ''}` : ''}</p></div>
      <div class="acciones"><button class="btn" id="pzOtro">📄 Otro archivo</button></div></div>
    ${bannerClase('pieza')}
    <div class="grid g-21">
      ${cardHtml('⚙️ Pieza en 3D', 'Arrastrá para girarla · «Corte» muestra el interior', toolbarPieza() + '<div class="visor" id="visorPz"></div>')}
      <div class="col">
        ${cardHtml('📐 Medidas', '', `<div id="pzKpi">${procesando('Armando la pieza…')}</div>`)}
        ${cardHtml('🧭 Cómo se arma', '', controles, ' style="margin-top:16px"')}
      </div>
    </div>
    ${es2D ? `<div class="grid g2" style="margin-top:16px">
      ${cardHtml('🗺️ Vistas encontradas en el plano', 'Los recuadros de color son las vistas que se usan', `<div class="hoja-wrap">${svgDibujo()}</div>
        <details class="mas" style="margin-top:10px"><summary>Capas del plano (${C.capas.length} de ${C.lect.capas.length} en uso)</summary><div class="chips" style="margin-top:8px">${C.lect.capas.map(c => `<label class="chip ${C.capas.includes(c.key) ? 'on' : ''}"><input type="checkbox" data-k="${esc(c.key)}" ${C.capas.includes(c.key) ? 'checked' : ''} hidden><i style="background:${esc(c.color)}"></i>${esc(c.nombre)}</label>`).join('')}</div>
        <label class="f" style="margin-top:10px">Marco de la lámina<select id="pzMarco"><option value="auto" ${C.marco === 'auto' ? 'selected' : ''}>Detectar solo</option><option value="si" ${C.marco === 'si' ? 'selected' : ''}>Ignorar el recuadro exterior</option><option value="no" ${C.marco === 'no' ? 'selected' : ''}>No tiene marco</option></select></label></details>`)}
      ${cardHtml('✂️ Huecos y macizos', 'Tocá un área para cambiarla entre hueco (blanco) y macizo (color)', `<div id="pzPerf" class="perfiles"></div>`)}
    </div>` : ''}
    <div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>💾 Guardar en el catálogo</h3><span class="sub">${modoLocal() ? 'Modo local: queda en este navegador' : 'Se suben a Drive el archivo original, la animación 3D y una imagen, en la carpeta del grupo'}</span></div></div>
      ${camposPieza(C.meta, 'pn', C.meta.grupo)}
      <div class="acciones"><button class="btn pri brillo" id="pzGuardar">💾 Guardar pieza y animación</button></div></div>
  </section>`;
  enlazarToolbarPieza();
  $('pzOtro').onclick = () => { PZ.carga = null; location.hash = '#/subir'; };
  enlazarBannerClase('pieza');
  enlazarMaterial('pn', () => pintarKpiCarga());
  ['grupo', 'codigo', 'nombre', 'maquina', 'moldeId', 'material', 'densidad', 'cantidad', 'estado', 'version', 'notas'].forEach(k => { const el = $('pn' + k); if (el) el.addEventListener('change', () => { C.meta = leerPieza('pn'); }); });
  $('pzGuardar').onclick = guardarPiezaNueva;
  if (es2D) enlazarControles();
  else if ($('pzArriba')) $('pzArriba').onchange = e => { C.meta = leerPieza('pn'); C.arriba = e.target.value; rearmar(); };
  rearmar();
}

function enlazarControles() {
  const C = PZ.carga;
  const m = $('pzMet');
  m.querySelectorAll('button').forEach(b => { b.onclick = () => { C.meta = leerPieza('pn'); C.metodo = b.dataset.m; if (C.metodo === 'revolucion') C.eje = ejeAuto('frente'); if (C.metodo === 'vistas' && !C.roles.planta && !C.roles.lateral && C.V.vistas.length > 1) { const r = C.V.roles; C.roles.planta = r.planta || ''; C.roles.lateral = r.lateral || ''; } vistaNuevaPieza(); }; });
  moverPill(m);
  const cambio = (id, fn) => { const el = $(id); if (el) el.onchange = () => { C.meta = leerPieza('pn'); fn(el.value); vistaNuevaPieza(); }; };
  cambio('pzRF', v => { C.roles.frente = +v; C.eje = ejeAuto('frente'); });
  cambio('pzRP', v => { C.roles.planta = v ? +v : ''; });
  cambio('pzRL', v => { C.roles.lateral = v ? +v : ''; });
  cambio('pzProy', v => { C.proyeccion = v; });
  cambio('pzEje', v => { C.eje = v; });
  cambio('pzEsp', v => { C.espesor = v; });
  cambio('pzEsc', v => { C.escalaN = num(v) || 1; });
  cambio('pzAnchoR', v => { const f = vistaPz(C.roles.frente); const r = num(v); if (f && r) C.escalaN = +(r / (f.w * C.lect.mmPorUnidad)).toPrecision(6); });
  cambio('pzMarco', v => { C.marco = v; detectarVistas(); });
  app().querySelectorAll('.chip input[data-k]').forEach(i => {
    i.onchange = () => {
      const k = i.dataset.k;
      const nuevas = i.checked ? C.capas.concat([k]) : C.capas.filter(x => x !== k);
      if (!nuevas.length) { i.checked = true; return; }
      C.meta = leerPieza('pn');
      C.capas = nuevas;
      try { detectarVistas(); } catch (err) { toast(err.message, 'bad'); }
      vistaNuevaPieza();
    };
  });
}

function pintarPerfiles() {
  const C = PZ.carga;
  const host = $('pzPerf');
  if (!host) return;
  const roles = C.metodo === 'vistas' ? ['frente', 'planta', 'lateral'].filter(k => C.roles[k]) : ['frente'];
  host.innerHTML = roles.map(svgPerfil).join('') + (C.metodo === 'revolucion' ? '<p class="sub">En revolución todo empieza macizo: marcá como hueco el agujero central si la vista es un corte.</p>' : '');
  host.querySelectorAll('.pf-reg').forEach(el => {
    el.onclick = () => {
      const vid = +el.dataset.v, x = +el.dataset.x, y = +el.dataset.y, h = el.dataset.h === '1';
      const l = (C.cambios[vid] || []).filter(c => !(Math.abs(c.x - x) < 1e-9 && Math.abs(c.y - y) < 1e-9));
      l.push({ x, y, h: !h });
      C.cambios[vid] = l;
      rearmar();
    };
  });
}

function pintarKpiCarga() {
  const C = PZ.carga;
  if (!C || !C.medidas || !$('pzKpi')) return;
  const o = leerPieza('pn');
  $('pzKpi').innerHTML = detPieza(C.medidas, num(o.densidad) || densidadDe(o));
}

async function rearmar() {
  const C = PZ.carga;
  const ver = ++C.version;
  if ($('pzKpi')) $('pzKpi').innerHTML = procesando('Armando la pieza…');
  await new Promise(r => setTimeout(r, 30));
  try {
    if (C.metodo !== 'malla') pintarPerfiles();
    await listo3D();
    const def = defCarga();
    const r = await Pieza3D.construir(def);
    if (PZ.carga !== C || C.version !== ver || ST.vista !== 'nuevapieza') { r.geo.dispose(); return; }
    C.medidas = r.medidas;
    C.defListo = def;
    pintarKpiCarga();
    const o = leerPieza('pn');
    montarPieza($('visorPz'), r.geo, o.codigo || o.nombre || C.archivo.nombre, subtituloPieza(r.medidas, num(o.densidad) || densidadDe(o), o.material));
  } catch (err) {
    if (PZ.carga !== C || C.version !== ver) return;
    C.medidas = null; C.defListo = null;
    if ($('pzKpi')) $('pzKpi').innerHTML = `<div class="alerta bad"><span class="e">⚠️</span><span>${esc(err.message)}</span></div>`;
  }
}

async function guardarPiezaNueva() {
  const C = PZ.carga;
  const o = leerPieza('pn');
  if (!o.nombre) { toast('Poné el nombre de la pieza', 'warn'); $('pnnombre').focus(); return; }
  if (!C.defListo || !PZ.visor) { toast('Esperá a que se arme la pieza en 3D', 'warn'); return; }
  const btn = $('pzGuardar');
  btn.disabled = true;
  loader(true);
  try {
    const dens = num(o.densidad) || densidadDe(o);
    const md = Object.assign({}, C.medidas, { peso: pesoKg(C.medidas.volumen, dens) });
    Object.keys(md).forEach(k => { if (typeof md[k] === 'number') md[k] = +md[k].toFixed(3); });
    const geo = JSON.stringify(C.defListo);
    if (geo.length > 9e6) throw new Error('El modelo es demasiado grande para guardarlo (' + fmt(geo.length / 1e6, 1) + ' MB). Simplificalo en el CAD y volvé a exportarlo.');
    const base = nombreArchivo(o.codigo || o.nombre);
    PZ.visor.rotular(etiquetaPieza(o), subtituloPieza(C.medidas, dens, o.material));
    const mini = PZ.visor.captura(300, 200, 'image/jpeg', 0.72);
    let archivos = [];
    if (!modoLocal()) {
      archivos = await archivosVisor(base, x => { btn.innerHTML = `🎬 Grabando… ${x} %`; });
      archivos.unshift({ rol: 'plano', nombre: C.archivo.nombre, mime: C.archivo.mime, base64: aBase64(C.buf) });
      btn.innerHTML = '☁️ Subiendo…';
    }
    const pieza = Object.assign({}, o, { metodo: C.metodo, medidas: md, miniatura: mini.length < 45000 ? mini : PZ.visor.captura(200, 134, 'image/jpeg', 0.6) });
    const r = await API.enviar({ accion: 'guardarPieza', pieza, geo: C.defListo, archivos });
    PZ.geo[r.id] = C.defListo;
    toast(r.msg, 'ok');
    PZ.carga = null;
    location.hash = '#/pieza/' + encodeURIComponent(r.id);
    await cargar(true);
  } catch (err) { toast(err.message, 'bad'); btn.disabled = false; btn.innerHTML = '💾 Guardar pieza y animación'; } finally { loader(false); }
}

function filaGrupoCampos(g) {
  return `<input data-k="icono" value="${esc(g.icono || '')}" maxlength="4" aria-label="Ícono" style="width:56px;text-align:center"><input data-k="nombre" value="${esc(g.nombre || '')}" placeholder="Nombre del grupo" maxlength="40"><input data-k="descripcion" value="${esc(g.descripcion || '')}" placeholder="Descripción" maxlength="90" style="flex:2"><select data-k="metodo" title="Cómo se arma el 3D por defecto">${['revolucion', 'extrusion', 'vistas'].map(k => `<option value="${k}" ${g.metodo === k ? 'selected' : ''}>${METODOS[k].e} ${METODOS[k].n}</option>`).join('')}</select><input data-k="id" type="hidden" value="${esc(g.id || '')}">`;
}

function leerFilaGrupo(r) {
  const v = k => r.querySelector(`[data-k=${k}]`).value.trim();
  return { id: v('id') || norm(v('nombre')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), nombre: v('nombre'), icono: v('icono') || '⚙️', descripcion: v('descripcion'), metodo: v('metodo') };
}

function cardGruposPiezas() {
  return `<div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>⚙️ Grupos de piezas de máquinas</h3><span class="sub">Cómo se agrupan las piezas y con qué método se arman por defecto</span></div><div class="acciones" style="margin:0"><button class="btn" id="bAddGP">＋ Grupo</button><button class="btn pri" id="bGuardarGP">💾 Guardar</button></div></div>
    <div id="lGP">${gruposPz().map(g => `<div class="fam-fila">${filaGrupoCampos(g)}<span class="sub">${piezasDe(g.id).length} pz</span><button class="btn ghost icon" data-quitar title="Quitar grupo">✖</button></div>`).join('')}</div></div>`;
}

function enlazarGruposPiezas() {
  const l = $('lGP');
  if (!l) return;
  const quitar = () => l.querySelectorAll('[data-quitar]').forEach(b => { b.onclick = () => b.closest('.fam-fila').remove(); });
  quitar();
  $('bAddGP').onclick = () => { l.insertAdjacentHTML('beforeend', `<div class="fam-fila">${filaGrupoCampos({ icono: '⚙️', metodo: 'extrusion' })}<span class="sub">0 pz</span><button class="btn ghost icon" data-quitar title="Quitar grupo">✖</button></div>`); quitar(); };
  $('bGuardarGP').onclick = async () => {
    const gs = [...l.querySelectorAll('.fam-fila')].map(leerFilaGrupo).filter(g => g.nombre);
    const ids = new Set();
    for (const g of gs) { if (ids.has(g.id)) { toast('Hay dos grupos con el mismo nombre: ' + g.nombre, 'warn'); return; } ids.add(g.id); }
    const huerf = ST.piezas.filter(p => p.grupo && !ids.has(p.grupo)).length;
    if (huerf && !await confirmar(`Hay ${huerf} pieza(s) en grupos que vas a quitar. Van a quedar en «Otros». ¿Seguir?`, '⚙️')) return;
    await guardarCfg({ gruposPiezas: gs });
  };
}
