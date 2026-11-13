'use strict';

const VISTAS = [
  { id: 'catalogo', e: '🧱', n: 'Catálogo' },
  { id: 'cargar', e: '➕', n: 'Cargar molde' },
  { id: 'comparar', e: '⚖️', n: 'Comparar' },
  { id: 'tipos', e: '🏷️', n: 'Tipos' },
  { id: 'ajustes', e: '⚙️', n: 'Ajustes' }
];
const BNAV = [
  { id: 'catalogo', e: '🧱', n: 'Catálogo' },
  { id: 'cargar', e: '➕', n: 'Cargar' },
  { id: 'comparar', e: '⚖️', n: 'Comparar' },
  { id: 'tipos', e: '🏷️', n: 'Tipos' },
  { id: 'ajustes', e: '⚙️', n: 'Ajustes' }
];
const FRASES = ['Midiendo dados…', 'Leyendo planos…', 'Calculando contracciones…', 'Horneando a 900 °C…', 'Contando huecos…'];
const ST = { tipos: [], moldes: [], cargado: false, vista: 'catalogo', args: [], filtro: { q: '', familia: '', estado: '' }, geo: {}, visor: null, carga: null };

const app = () => $('app');

function toast(msg, tipo) {
  const t = document.createElement('div');
  const ic = { ok: '✅', bad: '❌', warn: '⚠️' }[tipo] || 'ℹ️';
  t.className = 'toast ' + (tipo || '');
  t.innerHTML = `<span class="ic">${ic}</span><span>${esc(msg)}</span>`;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('sale'); setTimeout(() => t.remove(), 320); }, tipo === 'bad' ? 6500 : 3800);
}

function confirmar(texto, ico) {
  return new Promise(res => {
    const d = $('dlg');
    $('dlgTexto').textContent = texto;
    d.querySelector('.dlg-ico').textContent = ico || '🗑️';
    d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'si');
    d.showModal();
  });
}

function loader(on) { $('toploader').classList.toggle('on', !!on); }

function estadoRed(tipo, txt) {
  const r = $('red');
  r.className = 'estado-red' + (tipo === 'off' ? ' off' : tipo === 'cache' ? ' cache' : '');
  r.querySelector('span').textContent = txt;
}

function moverPill(cont) {
  if (!cont) return;
  let pill = cont.querySelector(':scope > .pill');
  if (!pill) { pill = document.createElement('span'); pill.className = 'pill'; cont.prepend(pill); }
  const on = cont.querySelector(':scope > .on');
  if (!on) { pill.style.width = '0'; return; }
  pill.style.left = on.offsetLeft + 'px';
  pill.style.width = on.offsetWidth + 'px';
}

function pintarNav() {
  const v = ST.vista === 'molde' ? 'catalogo' : ST.vista;
  $('nav').innerHTML = VISTAS.map(x => `<a href="#/${x.id}" class="${x.id === v ? 'on' : ''}" title="${x.n}"><span class="e">${x.e}</span><span class="tx">${x.n}</span></a>`).join('');
  $('bnav').innerHTML = BNAV.map(x => `<a href="#/${x.id}" class="${x.id === v ? 'on' : ''}"><span class="e">${x.e}</span>${x.n}</a>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => moverPill($('nav'))));
}

function temaActual() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function alternarTema() {
  const n = temaActual() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', n);
  LS.set('mt_tema', n);
  $('btnTema').textContent = n === 'dark' ? '☀️' : '🌙';
  render();
}

function descargar(nombre, contenido, mime) {
  const url = typeof contenido === 'string' && contenido.startsWith('data:') ? contenido : URL.createObjectURL(new Blob([contenido], { type: mime || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  if (!url.startsWith('data:')) setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const nombreArchivo = s => String(s || 'molde').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 80);

function kpiHtml(e, l, v, u, d) {
  return `<div class="kpi kacc"><div class="l"><span class="e">${e}</span>${l}</div><div class="v">${v}${u ? `<small>${u}</small>` : ''}</div><div class="d">${d || '&nbsp;'}</div></div>`;
}

function cardHtml(titulo, sub, cuerpo, extra, acciones) {
  return `<div class="card"${extra || ''}><div class="card-h"><div class="t"><h3>${titulo}</h3>${sub ? `<span class="sub">${sub}</span>` : ''}</div>${acciones || ''}</div>${cuerpo}</div>`;
}

const tipoDe = id => ST.tipos.find(t => t.id === id);
const moldeDe = id => ST.moldes.find(m => m.id === id);
const etiquetaMolde = m => (m.codigo || m.id) + (m.version ? ' · ' + m.version : '');
const dims2 = (a, b) => fmt(a, 2) + ' × ' + fmt(b, 2);

function svgMini(m) {
  if (!m.miniatura || !num(m.anchoV)) return '<div class="mini" style="aspect-ratio:2.75"></div>';
  return `<svg class="mini" viewBox="-2 -2 ${(num(m.anchoV) + 4).toFixed(1)} ${(num(m.altoV) + 4).toFixed(1)}" preserveAspectRatio="xMidYMid meet"><path d="${esc(m.miniatura)}"/></svg>`;
}

function flecha(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 2.4, w = 0.9;
  const p = (x, y, s) => { const bx = x - s * L * Math.cos(a), by = y - s * L * Math.sin(a); return `${x},${y} ${bx - w * Math.sin(a)},${by + w * Math.cos(a)} ${bx + w * Math.sin(a)},${by - w * Math.cos(a)}`; };
  return `<polygon points="${p(x2, y2, 1)}"/><polygon points="${p(x1, y1, -1)}"/>`;
}

function cotaH(x1, x2, yRef, y, txt) {
  return `<g class="cota"><line x1="${x1}" y1="${yRef}" x2="${x1}" y2="${y + 1.5}"/><line x1="${x2}" y1="${yRef}" x2="${x2}" y2="${y + 1.5}"/><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>${flecha(x1, y, x2, y)}<text x="${(x1 + x2) / 2}" y="${y - 1.4}">${txt}</text></g>`;
}

function cotaV(y1, y2, xRef, x, txt) {
  return `<g class="cota"><line x1="${xRef}" y1="${y1}" x2="${x + 1.5}" y2="${y1}"/><line x1="${xRef}" y1="${y2}" x2="${x + 1.5}" y2="${y2}"/><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>${flecha(x, y1, x, y2)}<text x="${x + 1.8}" y="${(y1 + y2) / 2}" transform="rotate(-90 ${x + 1.8} ${(y1 + y2) / 2})">${txt}</text></g>`;
}

function svgSeccion(geo, met, opt) {
  const o = Object.assign({ letras: true, cotas: true, verde: null }, opt || {});
  const W = met.ancho, H = met.alto;
  const mg = 16;
  const pathOf = g => Geo.svgPath(g, H);
  let s = `<svg class="seccion" viewBox="${-mg} ${-mg} ${W + 2 * mg} ${H + 2 * mg + 4}" preserveAspectRatio="xMidYMid meet">`;
  if (o.verde) {
    const dx = (W - o.verde.ancho) / 2, dy = (H - o.verde.alto) / 2;
    s += `<path class="ver" transform="translate(${dx} ${dy})" d="${Geo.svgPath(o.verde.geo, o.verde.alto)}"/>`;
  }
  s += `<path class="mat" d="${pathOf(geo)}"/>`;
  if (o.letras && met.letra) {
    geo.huecos.forEach((h, i) => { const b = Geo.bbox(h); s += `<text class="letra" x="${((b.x0 + b.x1) / 2).toFixed(2)}" y="${(H - (b.y0 + b.y1) / 2).toFixed(2)}">${met.letra[i] || ''}</text>`; });
  }
  if (o.cotas) {
    s += cotaH(0, W, H + 0.5, H + 9, fmt(W, 2));
    s += cotaV(0, H, W + 0.5, W + 9, fmt(H, 2));
  }
  return s + '</svg>';
}

function svgComparar(A, B) {
  const W = Math.max(A.m.ancho, B.m.ancho), H = Math.max(A.m.alto, B.m.alto), mg = 8;
  const off = X => `translate(${((W - X.m.ancho) / 2).toFixed(3)} ${((H - X.m.alto) / 2).toFixed(3)})`;
  return `<svg class="seccion" viewBox="${-mg} ${-mg} ${W + 2 * mg} ${H + 2 * mg}"><path class="cmpA" transform="${off(A)}" d="${Geo.svgPath(A.geo, A.m.alto)}"/><path class="cmpB" transform="${off(B)}" d="${Geo.svgPath(B.geo, B.m.alto)}"/></svg>`;
}

async function geometriaDe(id) {
  if (!ST.geo[id]) ST.geo[id] = await API.geometria(id);
  return ST.geo[id];
}

function cocidoDe(m, geoV) {
  const p = paramsDe(m, ST.tipos);
  const c = Geo.cocer(geoV, p);
  return { p, geo: c.geo, m: c.m };
}

function familias() {
  const f = new Map();
  ST.tipos.forEach(t => { const k = t.familia || 'Sin familia'; if (!f.has(k)) f.set(k, []); f.get(k).push(t); });
  return f;
}

function cardMolde(m, rama) {
  const r = resumenCocido(m, ST.tipos);
  const e = estadoDe(m.estado);
  return `<a class="mcard" href="#/molde/${encodeURIComponent(m.id)}">
    <div class="mc-top"><div><b>${esc(m.codigo || m.id)}</b><small>${esc(m.version || '')}${m.fecha ? ' · ' + fFecha(m.fecha) : ''}</small>${rama ? `<small class="propio">⑂ rama de ${esc(etiquetaMolde(rama))}</small>` : ''}</div><span class="tag ${e.cls}">${e.e} ${esc(e.id)}</span></div>
    ${svgMini(m)}
    <div class="mc-k"><div><span>Huecos</span><b>${fmt(r.huecos)}</b></div><div><span>Vacío</span><b>${fmt(r.vacio, 1)}%</b></div><div><span>Peso</span><b>${fmt(r.peso, 2)}</b></div></div>
    <small class="sub">${dims2(r.ancho, r.alto)} × ${fmt(r.largo)} mm cocido</small></a>`;
}

function linajes(moldesTipo) {
  const ids = new Set(moldesTipo.map(m => m.id));
  const raices = moldesTipo.filter(m => !m.padreId || !ids.has(m.padreId)).sort((a, b) => String(a.fecha || a.creado).localeCompare(String(b.fecha || b.creado)));
  return raices.map(r => {
    const orden = [r];
    const rec = id => moldesTipo.filter(m => m.padreId === id).sort((a, b) => String(a.fecha || a.creado).localeCompare(String(b.fecha || b.creado))).forEach(h => { orden.push(h); rec(h.id); });
    rec(r.id);
    return orden;
  });
}

function filtrar(m) {
  const f = ST.filtro;
  if (f.estado && m.estado !== f.estado) return false;
  if (f.q) {
    const t = tipoDe(m.tipoId) || {};
    const txt = [m.id, m.codigo, m.version, m.proveedor, m.autor, m.notas, t.nombre, t.nominal].join(' ').toLowerCase();
    if (!txt.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

function bannerLocal() {
  return modoLocal() ? `<div class="banner-local">💾 <span>Modo local: los datos quedan solo en este navegador. Para compartir el catálogo, conectá la planilla en <a href="#/ajustes">Ajustes</a>.</span></div>` : '';
}

function vistaCatalogo() {
  const vig = ST.moldes.filter(m => m.estado === 'Vigente').length, pro = ST.moldes.filter(m => m.estado === 'Propuesta').length;
  const fams = familias();
  const chipsFam = [''].concat([...fams.keys()]).map(f => `<button type="button" class="chip ${ST.filtro.familia === f ? 'on' : ''}" data-fam="${esc(f)}">${f ? esc(f) : 'Todas'}</button>`).join('');
  const chipsEst = [''].concat(ESTADOS.map(e => e.id)).map(s => `<button type="button" class="chip ${ST.filtro.estado === s ? 'on' : ''}" data-est="${esc(s)}">${s ? estadoDe(s).e + ' ' + esc(s) : 'Todos'}</button>`).join('');
  let cuerpo = '';
  if (!ST.tipos.length) {
    cuerpo = `<div class="card"><div class="empty"><span style="font-size:2.4rem">🧱</span><b>Todavía no hay tipos de ladrillo ni moldes</b><span>Importá el catálogo inicial con los 4 moldes del portante 12×19×33 o cargá tu primer plano.</span>
      <div class="acciones"><button class="btn pri" id="btnSeed">📥 Importar catálogo inicial</button><a class="btn" href="#/cargar">➕ Cargar molde</a></div></div></div>`;
  } else {
    for (const [fam, tipos] of fams) {
      if (ST.filtro.familia && ST.filtro.familia !== fam) continue;
      const bloques = tipos.map(t => {
        const ms = ST.moldes.filter(m => m.tipoId === t.id);
        const vis = ms.filter(filtrar);
        if ((ST.filtro.q || ST.filtro.estado) && !vis.length) return '';
        const visIds = new Set(vis.map(m => m.id));
        const lin = linajes(ms).map(l => l.filter(m => visIds.has(m.id))).filter(l => l.length);
        const params = `<div class="tipo-params"><span class="tag">↔ ${fmt(num(t.contrH), 1)}%</span><span class="tag">↕ ${fmt(num(t.contrV), 1)}%</span><span class="tag">⤢ ${fmt(num(t.contrL), 1)}%</span><span class="tag">📏 ${fmt(num(t.largo))} mm</span><span class="tag">⚖️ ${fmt(num(t.densidad), 2)} g/cm³</span></div>`;
        const filas = lin.length ? lin.map(l => `<div class="linaje">${l.map((m, i) => {
          if (!i) return cardMolde(m);
          const directo = m.padreId === l[i - 1].id;
          const pad = moldeDe(m.padreId);
          return `<span class="flecha-v" title="${directo ? 'Versión siguiente' : 'Rama'}">${directo ? '→' : '⑂'}</span>` + cardMolde(m, directo ? null : pad);
        }).join('')}</div>`).join('') : `<div class="empty">Sin moldes cargados. <a class="btn" href="#/cargar?tipo=${encodeURIComponent(t.id)}">➕ Cargar el primero</a></div>`;
        return cardHtml(`🏷️ ${esc(t.nombre)}`, `${esc(t.nominal || '')}${t.linea ? ' · ' + esc(t.linea) : ''} · ${ms.length} molde${ms.length === 1 ? '' : 's'}`, filas, ' style="margin-top:12px"', params);
      }).join('');
      if (bloques.trim()) cuerpo += `<div class="fam-h"><h2>${esc(fam)}</h2><span class="cnt">${tipos.length} tipo${tipos.length === 1 ? '' : 's'}</span></div>${bloques}`;
    }
    if (!cuerpo) cuerpo = '<div class="card"><div class="empty">No hay moldes que coincidan con el filtro.</div></div>';
  }
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div><div class="eyebrow">${esc(CONF.PLANTA || 'Planta')}</div><h1>Catálogo de <span>matrices</span></h1>
      <p class="sub">Cada molde con su ladrillo cocido, agrupado por tipo y enlazado con sus versiones.</p></div>
      <div class="acciones"><a class="btn pri" href="#/cargar">➕ Cargar molde</a></div></div>
    <div class="kpis">${kpiHtml('🏷️', 'Tipos', fmt(ST.tipos.length))}${kpiHtml('🧱', 'Moldes', fmt(ST.moldes.length))}${kpiHtml('🟢', 'Vigentes', fmt(vig))}${kpiHtml('🟠', 'Propuestas', fmt(pro))}</div>
    <div class="card" style="margin-top:16px"><div class="filtros" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <input id="fq" type="search" placeholder="🔎 Buscar código, versión, proveedor…" value="${esc(ST.filtro.q)}" style="flex:1;min-width:200px">
      <div class="chips" id="cFam">${chipsFam}</div><div class="chips" id="cEst">${chipsEst}</div></div></div>
    ${cuerpo}</section>`;
  $('fq').oninput = e => { ST.filtro.q = e.target.value; const pos = e.target.selectionStart; vistaCatalogo(); const n = $('fq'); n.focus(); n.setSelectionRange(pos, pos); };
  $('cFam').querySelectorAll('[data-fam]').forEach(b => { b.onclick = () => { ST.filtro.familia = b.dataset.fam; vistaCatalogo(); }; });
  $('cEst').querySelectorAll('[data-est]').forEach(b => { b.onclick = () => { ST.filtro.estado = b.dataset.est; vistaCatalogo(); }; });
  if ($('btnSeed')) $('btnSeed').onclick = importarSeed;
}

function filaMed(l, v, c, u) { return `<tr><td>${l}</td><td class="n">${v}</td><td class="n">${c}</td><td>${u || ''}</td></tr>`; }

function tablaMedidas(mv, mc, p) {
  const r2 = v => fmt(v, 2);
  const par = (a, b) => (a === null || a === undefined) ? '—' : r2(a);
  const tv = (x, i) => x[i] ? r2(x[i].v) + ` <small class="sub">×${x[i].n}</small>` : '—';
  const ray = (x, k) => x.rayado && x.rayado[k] && x.rayado[k].n ? `${r2(x.rayado[k].prof)} <small class="sub">· ${x.rayado[k].n}</small>` : '—';
  return `<div class="tw"><table><thead><tr><th>Medida</th><th class="n">Molde (verde)</th><th class="n">Ladrillo cocido</th><th></th></tr></thead><tbody>
    ${filaMed('Ancho exterior', r2(mv.ancho), r2(mc.ancho), 'mm')}
    ${filaMed('Alto exterior', r2(mv.alto), r2(mc.alto), 'mm')}
    ${filaMed('Largo', r2(mc.corteVerde) + ' <small class="sub">corte</small>', r2(mc.largo), 'mm')}
    ${filaMed('Pared inferior / superior', par(mv.pared.inf) + ' / ' + par(mv.pared.sup), par(mc.pared.inf) + ' / ' + par(mc.pared.sup), 'mm al fondo del rayado')}
    ${filaMed('Pared izquierda / derecha', par(mv.pared.izq) + ' / ' + par(mv.pared.der), par(mc.pared.izq) + ' / ' + par(mc.pared.der), 'mm')}
    ${filaMed('Pared mínima', par(mv.paredMin), par(mc.paredMin), 'mm (en la cresta)')}
    ${filaMed('Tabique vertical (más frecuente)', tv(mv.tabV, 0), tv(mc.tabV, 0), 'mm')}
    ${filaMed('Tabique horizontal (más frecuente)', tv(mv.tabH, 0), tv(mc.tabH, 0), 'mm')}
    ${filaMed('Tabique mínimo', par(mv.tabMin), par(mc.tabMin), 'mm')}
    ${filaMed('Rayado inferior · prof. / ondulaciones', ray(mv, 'inf'), ray(mc, 'inf'), 'mm')}
    ${filaMed('Rayado superior', ray(mv, 'sup'), ray(mc, 'sup'), 'mm')}
    ${filaMed('Rayado lateral izq. / der.', ray(mv, 'izq') + ' / ' + ray(mv, 'der'), ray(mc, 'izq') + ' / ' + ray(mc, 'der'), 'mm')}
    ${filaMed('Sección bruta', fmt(mv.aMarco), fmt(mc.aMarco), 'mm²')}
    ${filaMed('Sección de huecos', fmt(mv.aHuecos), fmt(mc.aHuecos), 'mm²')}
    ${filaMed('Sección neta (material)', fmt(mv.aLleno), fmt(mc.aLleno), 'mm²')}
    ${filaMed('% de huecos', fmt(mv.vacio, 2), fmt(mc.vacio, 2), '%')}
    ${filaMed('Perímetro de huecos', fmt(mv.perimHuecos), fmt(mc.perimHuecos), 'mm')}
    ${filaMed('Volumen de material', '—', fmt(mc.volumen), 'cm³')}
    ${filaMed('Peso estimado', '—', `<b>${fmt(mc.peso, 2)}</b> <small class="sub">(${fmt(mc.pesoRango[0], 2)}–${fmt(mc.pesoRango[1], 2)})</small>`, `kg con ${fmt(p.densidad, 2)} g/cm³ (±0,1)`)}
    </tbody></table></div>`;
}

function tablaHuecos(mv, mc) {
  return `<div class="tw"><table><thead><tr><th>Tipo</th><th class="n">Cant.</th><th class="n">Molde (verde)</th><th class="n">Cocido</th><th class="n">Área cocida</th></tr></thead><tbody>${mv.tipos.map((t, i) => {
    const c = mc.tipos.find(x => x.letra === t.letra) || mc.tipos[i] || {};
    return `<tr><td><b>${t.letra}</b></td><td class="n">${t.n}</td><td class="n">${dims2(t.w, t.h)}</td><td class="n">${c.w ? dims2(c.w, c.h) : '—'}</td><td class="n">${fmt(c.a)} mm²</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function conVisor(cb) {
  if (window.Visor3D) { cb(); return; }
  let hecho = false;
  window.addEventListener('visor3d-listo', () => { if (!hecho) { hecho = true; cb(); } }, { once: true });
  setTimeout(() => { if (!hecho) { hecho = true; cb(new Error('No se pudo cargar el visor 3D (three.js)')); } }, 12000);
}

function montarVisor(host, geoC, mc, geoV, mv) {
  conVisor(err => {
    if (!host.isConnected) return;
    if (err) { host.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; return; }
    if (ST.visor) ST.visor.destruir();
    ST.visor = window.Visor3D.montar(host, { marco: geoC.marco, huecos: geoC.huecos, ancho: mc.ancho, alto: mc.alto, largo: mc.largo, verde: geoV ? { marco: geoV.marco, huecos: geoV.huecos, ancho: mv.ancho, alto: mv.alto } : null });
  });
}

function toolbarVisor() {
  return `<div class="tb"><div class="seg" id="vPose"><button class="on" data-p="obra">🏗️ Obra</button><button data-p="extr">➡️ Extrusora</button></div>
    <div class="seg" id="vVista"><button class="on" data-v="iso">Iso</button><button data-v="front">Sección</button><button data-v="top">Planta</button><button data-v="side">Lateral</button></div>
    <div class="seg" id="vTog"><button class="on" data-t="cotas">Cotas</button><button class="on" data-t="aristas">Aristas</button><button data-t="verde">Molde</button></div></div>`;
}

function enlazarToolbar() {
  const seg = (id, fn) => { const c = $(id); if (!c) return; c.querySelectorAll('button').forEach(b => { b.onclick = () => { fn(b, c); moverPill(c); }; }); moverPill(c); };
  seg('vPose', (b, c) => { c.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); if (ST.visor) ST.visor.pose(b.dataset.p); });
  seg('vVista', (b, c) => { c.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); if (ST.visor) ST.visor.vista(b.dataset.v); });
  const t = $('vTog');
  if (t) t.querySelectorAll('button').forEach(b => { b.onclick = () => { b.classList.toggle('on'); if (ST.visor) ST.visor.mostrar(b.dataset.t, b.classList.contains('on')); }; });
}

async function vistaMolde(id) {
  const m = moldeDe(id);
  if (!m) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty">No existe el molde ${esc(id)}. <a class="btn" href="#/catalogo">Volver al catálogo</a></div></div></section>`; return; }
  const t = tipoDe(m.tipoId) || {};
  const e = estadoDe(m.estado);
  const r = resumenCocido(m, ST.tipos);
  const ch = cadena(ST.moldes, m.id);
  const padre = m.padreId ? moldeDe(m.padreId) : null;
  const tl = ch.arriba.concat([m], ch.abajo.map(x => x.m));
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div><div class="eyebrow"><a href="#/catalogo">Catálogo</a> · ${esc(t.familia || '')} · ${esc(t.nombre || 'Sin tipo')}</div>
      <h1>${esc(m.codigo || m.id)} <span>${esc(m.version || '')}</span></h1>
      <p class="sub"><span class="tag ${e.cls}">${e.e} ${esc(e.id)}</span> ${m.proveedor ? '· ' + esc(m.proveedor) : ''} ${m.fecha ? '· plano del ' + fFecha(m.fecha) : ''} ${m.autor ? '· ' + esc(m.autor) : ''}</p></div>
      <div class="acciones">${padre ? `<a class="btn" href="#/comparar/${encodeURIComponent(padre.id)}/${encodeURIComponent(m.id)}">⚖️ Comparar con anterior</a>` : ''}<button class="btn" id="btnEditar">✏️ Editar</button><button class="btn" id="btnBorrar">🗑️</button></div></div>
    <div class="kpis">${kpiHtml('📐', 'Sección cocida', dims2(r.ancho, r.alto), 'mm', 'Molde ' + dims2(num(m.anchoV), num(m.altoV)))}${kpiHtml('📏', 'Largo cocido', fmt(r.largo), 'mm', 'Corte en verde ≈ ' + fmt(r.corte, 1) + ' mm')}${kpiHtml('🕳️', 'Huecos', fmt(r.huecos), '', fmt(r.vacio, 1) + ' % de la sección')}${kpiHtml('⚖️', 'Peso estimado', fmt(r.peso, 2), 'kg', fmt(r.p.densidad, 2) + ' g/cm³')}${kpiHtml('🔥', 'Contracción', fmt(r.p.contrH, 1) + ' / ' + fmt(r.p.contrV, 1), '%', 'horizontal / vertical')}</div>
    <div class="grid g-21" style="margin-top:16px">
      ${cardHtml('🧱 Ladrillo cocido en 3D', 'Arrastrá para rotar · rueda para acercar', toolbarVisor() + '<div class="visor" id="visor"><div class="procesando"><span class="spin"></span>Cargando geometría…</div></div>', '', `<div class="acciones" style="margin:0"><button class="btn ghost" id="btnPng" title="Descargar imagen">🖼️ PNG</button></div>`)}
      <div class="col">${cardHtml('🔗 Versiones', `${tl.length} en la línea`, `<div class="timeline">${tl.map(x => `<a href="#/molde/${encodeURIComponent(x.id)}" class="${x.id === m.id ? 'yo' : ''}"><span class="nodo"></span><span class="info"><b>${esc(etiquetaMolde(x))}</b><small>${estadoDe(x.estado).e} ${esc(x.estado || '')} · ${fmt(num(x.huecos))} huecos · ${fmt(num(x.vacio), 1)}%</small></span></a>`).join('')}</div>`)}
        ${cardHtml('⚙️ Parámetros aplicados', r.p.propios.length ? 'Los marcados son propios de este molde' : 'Heredados del tipo', `<div class="det">${[['contrH', 'Contr. horizontal', '%', 1], ['contrV', 'Contr. vertical', '%', 1], ['contrL', 'Contr. longitudinal', '%', 1], ['largo', 'Largo cocido', 'mm', 0], ['densidad', 'Densidad', 'g/cm³', 2]].map(([k, l, u, d]) => `<div><span>${l}</span><b class="${r.p.propios.includes(k) ? 'propio' : ''}">${fmt(r.p[k], d)} ${u}</b></div>`).join('')}</div>
          <div class="acciones"><button class="btn" id="btnDxfC">📐 DXF cocido</button><button class="btn" id="btnDxfV">📐 DXF molde</button>${m.archivoUrl ? `<a class="btn" href="${esc(m.archivoUrl)}" target="_blank" rel="noopener">📄 Plano original</a>` : ''}</div>`, ' style="margin-top:16px"')}</div>
    </div>
    <div id="detalle"><div class="card" style="margin-top:16px"><div class="procesando"><span class="spin"></span>Calculando el ladrillo cocido…</div></div></div>
    ${m.notas ? cardHtml('📝 Notas', '', `<p style="white-space:pre-wrap">${esc(m.notas)}</p>`, ' style="margin-top:16px"') : ''}
  </section>`;
  enlazarToolbar();
  $('btnEditar').onclick = () => editarMolde(m);
  $('btnBorrar').onclick = () => borrarMolde(m);
  let geoV;
  try { geoV = await geometriaDe(m.id); } catch (err) { $('detalle').innerHTML = `<div class="card" style="margin-top:16px"><div class="empty">⚠️ ${esc(err.message)}</div></div>`; $('visor').innerHTML = ''; return; }
  if (ST.vista !== 'molde' || ST.args[0] !== id) return;
  const mv = Geo.metricas(geoV);
  const C = cocidoDe(m, geoV);
  const mc = C.m;
  $('detalle').innerHTML = `<div class="grid g2" style="margin-top:16px">
      ${cardHtml('📐 Sección del ladrillo cocido', 'Medidas en mm · línea azul: contorno del molde', svgSeccion(C.geo, mc, { verde: { geo: geoV, ancho: mv.ancho, alto: mv.alto } }) + '<div class="ley"><span><i style="background:var(--c-ladrillo)"></i>Ladrillo cocido</span><span><i style="background:var(--c-verde)"></i>Molde (verde)</span></div>')}
      ${cardHtml('🕳️ Huecos por tipo', `${mv.nHuecos} huecos en ${mv.tipos.length} medidas`, tablaHuecos(mv, mc))}
    </div>
    ${cardHtml('📋 Medidas del molde y del ladrillo cocido', 'Calculadas desde la geometría del plano', tablaMedidas(mv, mc, C.p), ' style="margin-top:16px"')}`;
  montarVisor($('visor'), C.geo, mc, geoV, mv);
  const base = nombreArchivo(etiquetaMolde(m));
  const notas = [`${t.nombre || ''} - ${etiquetaMolde(m)}`, `Contraccion H ${C.p.contrH}% V ${C.p.contrV}% - largo ${C.p.largo} mm - densidad ${C.p.densidad}`, `Seccion ${mc.ancho.toFixed(2)} x ${mc.alto.toFixed(2)} mm - huecos ${mc.nHuecos} - vacio ${mc.vacio.toFixed(2)}% - peso ${mc.peso.toFixed(2)} kg`];
  $('btnDxfC').onclick = () => descargar(base + '_cocido.dxf', Geo.dxfR12(C.geo, 'LADRILLO COCIDO ' + notas[0], notas.slice(1)), 'application/dxf');
  $('btnDxfV').onclick = () => descargar(base + '_molde.dxf', Geo.dxfR12(geoV, 'MOLDE (VERDE) ' + notas[0], [`Seccion ${mv.ancho.toFixed(2)} x ${mv.alto.toFixed(2)} mm - huecos ${mv.nHuecos} - vacio ${mv.vacio.toFixed(2)}%`]), 'application/dxf');
  $('btnPng').onclick = () => { if (ST.visor) descargar(base + '_3D.png', ST.visor.captura()); };
}

function opcionesTipos(sel, conNuevo) {
  return ST.tipos.map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc((t.familia ? t.familia + ' · ' : '') + t.nombre)}</option>`).join('') + (conNuevo ? '<option value="__nuevo">＋ Nuevo tipo…</option>' : '');
}

function opcionesPadre(tipoId, sel, excluir) {
  const ms = ST.moldes.filter(m => m.tipoId === tipoId && m.id !== excluir);
  return `<option value="">— Sin versión anterior —</option>` + ms.map(m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(etiquetaMolde(m))}</option>`).join('');
}

function camposMeta(m, prefijo) {
  const p = prefijo || 'm';
  const tid = m.tipoId || (ST.tipos[0] || {}).id || '';
  const t = tipoDe(tid) || {};
  const ph = k => num(t[k]) !== null ? String(num(t[k])) : '';
  const v = k => (m[k] === undefined || m[k] === null) ? '' : m[k];
  const ult = ST.moldes.filter(x => x.tipoId === tid).sort((a, b) => (String(b.fecha || '') + String(b.creado || '')).localeCompare(String(a.fecha || '') + String(a.creado || '')) || String(b.id).localeCompare(String(a.id)))[0];
  const padreSel = m.padreId === undefined && !m.id && ult ? ult.id : m.padreId;
  return `<div class="form">
    <label class="f">🏷️ Tipo de ladrillo<select id="${p}Tipo" required>${opcionesTipos(tid, true)}</select></label>
    <label class="f">🔢 Código<input id="${p}Codigo" maxlength="60" required value="${esc(v('codigo'))}" placeholder="MPA-06-PR-002-A/1"></label>
    <label class="f">🧬 Versión<input id="${p}Version" maxlength="60" value="${esc(v('version'))}" placeholder="P.12 v3"></label>
    <label class="f">🔗 Versión anterior<select id="${p}Padre">${opcionesPadre(tid, padreSel, m.id)}</select></label>
    <label class="f">🚦 Estado<select id="${p}Estado">${ESTADOS.map(e => `<option ${e.id === (m.estado || 'Propuesta') ? 'selected' : ''}>${e.id}</option>`).join('')}</select></label>
    <label class="f">🏭 Proveedor<input id="${p}Proveedor" maxlength="80" value="${esc(v('proveedor'))}" placeholder="Bongioanni Stampi"></label>
    <label class="f">📅 Fecha del plano<input id="${p}Fecha" type="date" value="${esc(String(v('fecha')).slice(0, 10))}"></label>
    <label class="f">✍️ Dibujó / autor<input id="${p}Autor" maxlength="60" value="${esc(v('autor'))}"></label>
    <label class="f full">📝 Notas<textarea id="${p}Notas" rows="2" maxlength="2000">${esc(v('notas'))}</textarea></label>
    <div class="full" id="${p}NuevoTipo" hidden>${camposTipo({}, p + 'NT')}</div>
    <details class="mas full" ${['contrH', 'contrV', 'contrL', 'largo', 'densidad'].some(k => num(m[k]) !== null) ? 'open' : ''}><summary>⚙️ Parámetros propios de este molde (vacío = usar los del tipo)</summary>
      <div class="form" style="margin-top:10px">
        <label class="f">Contr. horizontal (%)<input id="${p}contrH" type="number" step="0.01" value="${esc(v('contrH'))}" placeholder="${ph('contrH')}"></label>
        <label class="f">Contr. vertical (%)<input id="${p}contrV" type="number" step="0.01" value="${esc(v('contrV'))}" placeholder="${ph('contrV')}"></label>
        <label class="f">Contr. longitudinal (%)<input id="${p}contrL" type="number" step="0.01" value="${esc(v('contrL'))}" placeholder="${ph('contrL')}"></label>
        <label class="f">Largo cocido (mm)<input id="${p}largo" type="number" step="0.1" value="${esc(v('largo'))}" placeholder="${ph('largo')}"></label>
        <label class="f">Densidad (g/cm³)<input id="${p}densidad" type="number" step="0.01" value="${esc(v('densidad'))}" placeholder="${ph('densidad')}"></label>
      </div></details></div>`;
}

function camposTipo(t, p) {
  const v = k => (t[k] === undefined || t[k] === null) ? '' : t[k];
  return `<div class="form">
    <label class="f">Familia<input id="${p}familia" maxlength="40" value="${esc(v('familia'))}" placeholder="Portante" list="lFam"></label>
    <label class="f">Nombre<input id="${p}nombre" maxlength="60" value="${esc(v('nombre'))}" placeholder="Portante 12×19×33"></label>
    <label class="f">Medida nominal<input id="${p}nominal" maxlength="40" value="${esc(v('nominal'))}" placeholder="12 × 19 × 33 cm"></label>
    <label class="f">Línea / máquina<input id="${p}linea" maxlength="40" value="${esc(v('linea'))}" placeholder="Extrusora 1"></label>
    <label class="f">Largo cocido (mm)<input id="${p}largo" type="number" step="0.1" value="${esc(v('largo'))}" placeholder="190"></label>
    <label class="f">Contr. horizontal (%)<input id="${p}contrH" type="number" step="0.01" value="${esc(v('contrH'))}" placeholder="4.2"></label>
    <label class="f">Contr. vertical (%)<input id="${p}contrV" type="number" step="0.01" value="${esc(v('contrV'))}" placeholder="4.8"></label>
    <label class="f">Contr. longitudinal (%)<input id="${p}contrL" type="number" step="0.01" value="${esc(v('contrL'))}" placeholder="4.2"></label>
    <label class="f">Densidad cocido (g/cm³)<input id="${p}densidad" type="number" step="0.01" value="${esc(v('densidad'))}" placeholder="1.80"></label>
    <label class="f full">Notas<input id="${p}notas" maxlength="300" value="${esc(v('notas'))}"></label>
  </div><datalist id="lFam">${[...familias().keys()].map(f => `<option value="${esc(f)}">`).join('')}</datalist>`;
}

function leerTipo(p) {
  const g = k => { const el = $(p + k); return el ? el.value.trim() : ''; };
  return { familia: g('familia'), nombre: g('nombre'), nominal: g('nominal'), linea: g('linea'), largo: g('largo'), contrH: g('contrH'), contrV: g('contrV'), contrL: g('contrL'), densidad: g('densidad'), notas: g('notas') };
}

function leerMeta(p) {
  const g = k => { const el = $(p + k); return el ? el.value.trim() : ''; };
  return { tipoId: g('Tipo'), codigo: g('Codigo'), version: g('Version'), padreId: g('Padre'), estado: g('Estado'), proveedor: g('Proveedor'), fecha: g('Fecha'), autor: g('Autor'), notas: g('Notas'), contrH: g('contrH'), contrV: g('contrV'), contrL: g('contrL'), largo: g('largo'), densidad: g('densidad') };
}

function enlazarMeta(p, idActual, alCambiar) {
  const sel = $(p + 'Tipo');
  const act = () => {
    const nuevo = sel.value === '__nuevo';
    $(p + 'NuevoTipo').hidden = !nuevo;
    if (!nuevo) {
      $(p + 'Padre').innerHTML = opcionesPadre(sel.value, $(p + 'Padre').value, idActual);
      const t = tipoDe(sel.value) || {};
      ['contrH', 'contrV', 'contrL', 'largo', 'densidad'].forEach(k => { const el = $(p + k); if (el) el.placeholder = num(t[k]) !== null ? String(num(t[k])) : ''; });
    }
    if (alCambiar) alCambiar();
  };
  sel.onchange = act;
  ['contrH', 'contrV', 'contrL', 'largo', 'densidad'].forEach(k => { const el = $(p + k); if (el && alCambiar) el.oninput = alCambiar; });
  const nt = $(p + 'NuevoTipo');
  if (nt && alCambiar) nt.oninput = alCambiar;
  act();
}

async function asegurarTipo(meta, p) {
  if (meta.tipoId !== '__nuevo') return meta.tipoId;
  const t = leerTipo(p + 'NT');
  if (!t.nombre) throw new Error('Completá el nombre del nuevo tipo');
  const r = await API.enviar({ accion: 'guardarTipo', tipo: t });
  return r.id;
}

function editarMolde(m) {
  const d = $('dlgEd');
  d.innerHTML = `<form method="dialog" id="fEd"><h3>✏️ Editar ${esc(etiquetaMolde(m))}</h3>${camposMeta(m, 'e')}<div class="acciones"><button class="btn" value="no" formnovalidate>Cancelar</button><button class="btn pri" value="si" id="eGuardar">💾 Guardar</button></div></form>`;
  enlazarMeta('e', m.id);
  $('fEd').onsubmit = async ev => {
    if (d.returnValue === 'no' || (ev.submitter && ev.submitter.value === 'no')) return;
    ev.preventDefault();
    loader(true);
    try {
      const meta = leerMeta('e');
      meta.tipoId = await asegurarTipo(meta, 'e');
      if (!meta.codigo) throw new Error('El código es obligatorio');
      const r = await API.enviar({ accion: 'guardarMolde', molde: Object.assign({ id: m.id }, meta) });
      toast(r.msg || 'Guardado', 'ok');
      d.close();
      await cargar(true);
    } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
  };
  d.showModal();
}

async function borrarMolde(m) {
  const hijos = ST.moldes.filter(x => x.padreId === m.id).length;
  if (!await confirmar(`¿Eliminar ${etiquetaMolde(m)}?${hijos ? ` Sus ${hijos} versión(es) posteriores quedarán enlazadas a la versión anterior.` : ''}`)) return;
  loader(true);
  try {
    const r = await API.enviar({ accion: 'borrarMolde', id: m.id });
    delete ST.geo[m.id];
    toast(r.msg, 'ok');
    location.hash = '#/catalogo';
    await cargar(true);
  } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

function vistaCargar() {
  const C = ST.carga || (ST.carga = { paso: 1, giro: 0, espejo: false, meta: {} });
  const q = new URLSearchParams((location.hash.split('?')[1]) || '');
  if (q.get('tipo') && !C.meta.tipoId) C.meta.tipoId = q.get('tipo');
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div><div class="eyebrow">Nuevo molde</div><h1>Cargar <span>plano</span></h1><p class="sub">Subí el PDF o el DXF exportado de AutoCAD. La app detecta el marco y los dados, calcula el ladrillo cocido y lo guarda en el catálogo.</p></div></div>
    <div class="card"><div class="paso"><span class="nro">1</span><h3>Plano del molde</h3></div>
      <label class="drop" id="drop"><span class="e">📄</span><b>${C.archivo ? esc(C.archivo.nombre) : 'Arrastrá el archivo o tocá para elegirlo'}</b><small>${C.archivo ? fmt(C.archivo.size / 1024) + ' KB · ' + (C.lect ? C.lect.tipo.toUpperCase() + ' · ' + C.lect.capas.length + ' capas/estilos' : '') : 'PDF vectorial (exportado de AutoCAD) o DXF ASCII'}</small><input type="file" id="fArch" accept=".pdf,.dxf,application/pdf" hidden></label>
      <div id="estadoCarga"></div></div>
    <div id="paso2"></div>
  </section>`;
  const drop = $('drop');
  $('fArch').onchange = e => { if (e.target.files[0]) leerArchivo(e.target.files[0]); };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('sobre'); };
  drop.ondragleave = () => drop.classList.remove('sobre');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('sobre'); if (e.dataTransfer.files[0]) leerArchivo(e.dataTransfer.files[0]); };
  if (C.ext) pintarPaso2();
}

function procesando(txt) { return `<div class="procesando"><span class="spin"></span>${esc(txt)}</div>`; }

async function leerArchivo(f) {
  const C = ST.carga = { paso: 1, giro: 0, espejo: false, meta: (ST.carga && ST.carga.meta) || {} };
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'dxf'].includes(ext)) { toast('Formato no soportado: usá PDF o DXF', 'bad'); return; }
  C.archivo = { nombre: f.name, size: f.size, mime: f.type || (ext === 'pdf' ? 'application/pdf' : 'application/dxf') };
  vistaCargar();
  $('estadoCarga').innerHTML = procesando('Leyendo el plano…');
  try {
    const buf = await f.arrayBuffer();
    C.buf = buf;
    if (ext === 'pdf') C.lect = await Geo.leerPdf(buf.slice(0));
    else {
      const txt = new TextDecoder('utf-8').decode(buf);
      if (/^AutoCAD Binary DXF/.test(txt.slice(0, 22))) throw new Error('El DXF es binario: exportalo como DXF ASCII');
      C.lect = Geo.leerDxf(txt);
    }
    if (!C.lect.capas.length) throw new Error('El archivo no tiene trazos vectoriales (¿es un PDF escaneado?)');
    await detectar();
  } catch (err) {
    $('estadoCarga').innerHTML = `<div class="alerta bad" style="margin-top:12px"><span class="e">⚠️</span><span>${esc(err.message)}</span></div>`;
  }
}

async function detectar() {
  const C = ST.carga;
  $('estadoCarga').innerHTML = procesando('Buscando el marco y los dados…');
  $('paso2').innerHTML = '';
  await new Promise(r => setTimeout(r, 30));
  try {
    C.base = await Geo.extraer(C.lect, { capas: C.capasSel || null });
    C.capasSel = C.base.capas;
    if (C.lect.tipo === 'pdf' && !C.anchoMm) {
      const t = tipoDe(C.meta.tipoId) || ST.tipos[0];
      const ref = t ? ST.moldes.filter(m => m.tipoId === t.id && num(m.anchoV)).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))[0] : null;
      if (ref) { C.anchoMm = +num(ref.anchoV).toFixed(2); C.altoMm = +num(ref.altoV).toFixed(2); C.escalaRef = etiquetaMolde(ref); }
    }
    $('estadoCarga').innerHTML = '';
    recalcular();
    pintarPaso2();
  } catch (err) {
    $('estadoCarga').innerHTML = `<div class="alerta bad" style="margin-top:12px"><span class="e">⚠️</span><span>${esc(err.message)}</span></div>`;
    C.ext = null;
    pintarCapasSolo();
  }
}

function recalcular() {
  const C = ST.carga;
  C.ext = Geo.reorientar(C.base, C.giro, C.espejo);
  const pdf = C.lect.tipo === 'pdf';
  const esc0 = Geo.escalarMm(C.ext, pdf ? (C.anchoMm || null) : (C.anchoMm || null), C.altoMm || null);
  C.esc = esc0;
  C.geoV = esc0.geo;
  C.met = Geo.metricas(C.geoV);
}

function htmlCapas() {
  const C = ST.carga;
  return `<div class="capas" id="lCapas">${C.lect.capas.slice().sort((a, b) => b.largo - a.largo).map(c => `<label><input type="checkbox" value="${esc(c.key)}" ${C.capasSel && C.capasSel.includes(c.key) ? 'checked' : ''}><span class="sw" style="background:${esc(c.color)}"></span>${esc(c.nombre)}<small>${c.polys.length}</small></label>`).join('')}</div>
    <div class="acciones"><button class="btn" id="btnRedetectar">🔍 Volver a detectar</button></div>`;
}

function pintarCapasSolo() {
  $('paso2').innerHTML = cardHtml('🎨 Capas del plano', 'Elegí las capas o colores donde está dibujado el molde', htmlCapas(), ' style="margin-top:16px"');
  enlazarCapas();
}

function enlazarCapas() {
  $('btnRedetectar').onclick = () => {
    const sel = [...$('lCapas').querySelectorAll('input:checked')].map(i => i.value);
    if (!sel.length) { toast('Elegí al menos una capa', 'warn'); return; }
    ST.carga.capasSel = sel;
    detectar();
  };
}

function pintarPaso2() {
  const C = ST.carga;
  const m = C.met, pdf = C.lect.tipo === 'pdf';
  const desv = C.altoMm ? (m.alto - C.altoMm) / C.altoMm * 100 : null;
  const avisoEsc = pdf && !C.anchoMm ? '<div class="alerta warn" style="margin-top:10px"><span class="e">📏</span><span>El PDF no trae la escala: cargá el ancho y el alto reales del molde (las cotas generales del plano).</span></div>' : '';
  const avisoAlto = desv !== null && Math.abs(desv) > 0.5 ? `<div class="alerta warn" style="margin-top:10px"><span class="e">⚠️</span><span>Con ese ancho, el alto medido da ${fmt(m.alto, 2)} mm (${desv > 0 ? '+' : ''}${fmt(desv, 2)} %). Revisá las cotas o la orientación.</span></div>` : '';
  $('paso2').innerHTML = `<div class="grid g-21" style="margin-top:16px">
    ${cardHtml('<span class="nro" style="margin-right:6px">2</span> Geometría detectada', `${m.nHuecos} huecos · ${m.tipos.length} medidas · resolución ${fmt(C.esc.resolMm, 3)} mm`, `<div class="prev-geo">${svgSeccion(C.geoV, m, {})}</div>
      <div class="tb" style="margin-top:10px"><button class="btn" id="bRot">↻ Rotar 90°</button><button class="btn" id="bEsp">⇋ Espejar</button></div>
      <div class="det"><div><span>Ancho</span><b>${fmt(m.ancho, 2)} mm</b></div><div><span>Alto</span><b>${fmt(m.alto, 2)} mm</b></div><div><span>% huecos</span><b>${fmt(m.vacio, 2)} %</b></div><div><span>Lleno</span><b>${fmt(m.aLleno)} mm²</b></div><div><span>Pared mín.</span><b>${fmt(m.paredMin, 2)} mm</b></div><div><span>Tabique mín.</span><b>${fmt(m.tabMin, 2)} mm</b></div></div>
      <details class="mas"><summary>🕳️ Huecos por tipo</summary><div class="tw" style="margin-top:8px"><table><thead><tr><th>Tipo</th><th class="n">Cant.</th><th class="n">Medida</th><th class="n">Área</th></tr></thead><tbody>${m.tipos.map(t => `<tr><td><b>${t.letra}</b></td><td class="n">${t.n}</td><td class="n">${dims2(t.w, t.h)}</td><td class="n">${fmt(t.a)} mm²</td></tr>`).join('')}</tbody></table></div></details>`)}
    <div class="col">
      ${cardHtml('📏 Escala', pdf ? 'Medidas exteriores reales del molde' : 'El DXF ya viene en milímetros', `<div class="form"><label class="f">Ancho (mm)<input id="eAncho" type="number" step="0.01" value="${C.anchoMm || ''}" placeholder="${pdf ? '344' : fmt(m.ancho, 2)}"></label><label class="f">Alto (mm)<input id="eAlto" type="number" step="0.01" value="${C.altoMm || ''}" placeholder="${pdf ? '125' : fmt(m.alto, 2)}"></label></div>${C.escalaRef && pdf ? `<p class="sub" style="margin-top:6px">Tomado de ${esc(C.escalaRef)}. Cambialo si el plano es de otra medida.</p>` : ''}${avisoEsc}${avisoAlto}<div class="acciones"><button class="btn" id="bEsc">✔️ Aplicar escala</button></div>`)}
      ${cardHtml('🎨 Capas usadas', 'Detectadas automáticamente', htmlCapas(), ' style="margin-top:16px"')}
    </div></div>
    <div class="card" style="margin-top:16px"><div class="paso"><span class="nro">3</span><h3>Datos del molde y enlace</h3></div>${camposMeta(C.meta, 'c')}
      <div class="paso" style="margin-top:18px"><span class="nro">4</span><h3>Ladrillo cocido</h3></div><div id="cPrev"></div>
      ${modoLocal() ? '' : `<label class="chk" style="margin-top:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="cSubir" checked> Guardar el plano original en Drive (carpeta «Matrices CEVIL - Planos»)</label>`}
      <div class="acciones"><button class="btn" id="bCancelar">🧹 Empezar de nuevo</button><button class="btn pri brillo" id="bGuardar" ${pdf && !C.anchoMm ? 'disabled' : ''}>💾 Guardar en el catálogo</button></div></div>`;
  $('bRot').onclick = () => { C.giro = (C.giro + 90) % 360; recalcular(); guardarMetaTemp(); pintarPaso2(); };
  $('bEsp').onclick = () => { C.espejo = !C.espejo; recalcular(); guardarMetaTemp(); pintarPaso2(); };
  $('bEsc').onclick = () => { C.anchoMm = num($('eAncho').value); C.altoMm = num($('eAlto').value); C.escalaRef = null; recalcular(); guardarMetaTemp(); pintarPaso2(); };
  enlazarCapas();
  enlazarMeta('c', null, previaCocido);
  $('cCodigo').oninput = guardarMetaTemp;
  $('bCancelar').onclick = () => { ST.carga = null; vistaCargar(); };
  $('bGuardar').onclick = guardarCarga;
}

function guardarMetaTemp() {
  if (!$('cTipo')) return;
  const C = ST.carga;
  C.meta = Object.assign(C.meta || {}, leerMeta('c'));
}

function previaCocido() {
  const C = ST.carga;
  if (!C || !C.geoV || !$('cPrev')) return;
  guardarMetaTemp();
  const meta = C.meta;
  let tipos = ST.tipos;
  if (meta.tipoId === '__nuevo') tipos = ST.tipos.concat([Object.assign({ id: '__nuevo' }, leerTipo('cNT'))]);
  const p = paramsDe(meta, tipos);
  if (!p.largo) { $('cPrev').innerHTML = '<div class="alerta warn"><span class="e">📏</span><span>Falta el largo cocido del tipo para calcular volumen y peso.</span></div>'; return; }
  const c = Geo.cocer(C.geoV, p);
  $('cPrev').innerHTML = `<div class="kpis">${kpiHtml('📐', 'Sección cocida', dims2(c.m.ancho, c.m.alto), 'mm')}${kpiHtml('📏', 'Largo', fmt(p.largo), 'mm', 'corte en verde ≈ ' + fmt(c.m.corteVerde, 1))}${kpiHtml('🕳️', 'Huecos', fmt(c.m.nHuecos), '', fmt(c.m.vacio, 1) + ' %')}${kpiHtml('⚖️', 'Peso', fmt(c.m.peso, 2), 'kg', fmt(p.densidad, 2) + ' g/cm³')}${kpiHtml('🔥', 'Contracción', fmt(p.contrH, 1) + ' / ' + fmt(p.contrV, 1), '%')}</div>`;
}

function aBase64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

async function guardarCarga() {
  const C = ST.carga;
  const btn = $('bGuardar');
  btn.disabled = true;
  loader(true);
  try {
    const meta = leerMeta('c');
    if (!meta.codigo) throw new Error('Completá el código del molde');
    meta.tipoId = await asegurarTipo(meta, 'c');
    const geo = { marco: C.geoV.marco.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]), huecos: C.geoV.huecos.map(h => h.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])) };
    const prep = prepararMolde(meta, geo);
    const sub = $('cSubir') && $('cSubir').checked && C.buf && C.archivo.size < 25e6;
    prep.molde.archivo = C.archivo.nombre;
    const r = await API.enviar({ accion: 'guardarMolde', molde: prep.molde, geo: prep.geo, archivoDatos: sub ? { nombre: C.archivo.nombre, mime: C.archivo.mime, base64: aBase64(C.buf) } : null });
    ST.geo[r.id] = prep.geo;
    toast(r.msg || 'Guardado', 'ok');
    ST.carga = null;
    await cargar(true);
    location.hash = '#/molde/' + encodeURIComponent(r.id);
  } catch (err) { toast(err.message, 'bad'); btn.disabled = false; } finally { loader(false); }
}

function opcionesMoldes(sel) {
  return familiasOrden().map(t => `<optgroup label="${esc((t.familia ? t.familia + ' · ' : '') + t.nombre)}">${ST.moldes.filter(m => m.tipoId === t.id).map(m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(etiquetaMolde(m))}</option>`).join('')}</optgroup>`).join('');
}

function familiasOrden() { return ST.tipos.slice().sort((a, b) => String(a.familia + a.nombre).localeCompare(String(b.familia + b.nombre))); }

async function vistaComparar(a, b) {
  if (ST.moldes.length < 2) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty">Hacen falta al menos dos moldes para comparar.</div></div></section>`; return; }
  const mb = moldeDe(b) || ST.moldes[ST.moldes.length - 1];
  const ma = moldeDe(a) || (mb.padreId && moldeDe(mb.padreId)) || ST.moldes.find(m => m.id !== mb.id);
  app().innerHTML = `<section class="vista">
    <div class="hero"><div><div class="eyebrow">Versiones</div><h1>Comparar <span>moldes</span></h1><p class="sub">Cada ladrillo cocido con sus propios parámetros de contracción, largo y densidad.</p></div></div>
    <div class="card"><div class="form"><label class="f">🅰️ Molde A<select id="selA">${opcionesMoldes(ma.id)}</select></label><label class="f">🅱️ Molde B<select id="selB">${opcionesMoldes(mb.id)}</select></label></div></div>
    <div id="cmp"><div class="card" style="margin-top:16px">${procesando('Cargando geometrías…')}</div></div></section>`;
  const ir = () => { location.hash = `#/comparar/${encodeURIComponent($('selA').value)}/${encodeURIComponent($('selB').value)}`; };
  $('selA').onchange = ir; $('selB').onchange = ir;
  let gA, gB;
  try { [gA, gB] = await Promise.all([geometriaDe(ma.id), geometriaDe(mb.id)]); } catch (err) { $('cmp').innerHTML = `<div class="card" style="margin-top:16px"><div class="empty">⚠️ ${esc(err.message)}</div></div>`; return; }
  if (ST.vista !== 'comparar') return;
  const A = cocidoDe(ma, gA), B = cocidoDe(mb, gB);
  const fila = (l, va, vb, dec, u, mejor) => {
    const d = (va === null || vb === null || va === undefined || vb === undefined) ? null : vb - va;
    const pc = d !== null && va ? 100 * d / va : null;
    const cls = d === null || Math.abs(d) < Math.pow(10, -dec) / 2 ? '' : (mejor === 'menos' ? (d < 0 ? 'dif-dn' : 'dif-up') : mejor === 'mas' ? (d > 0 ? 'dif-dn' : 'dif-up') : '');
    const dz = d !== null && Math.abs(d) < Math.pow(10, -dec) / 2 ? 0 : d;
    const pz = pc !== null && Math.abs(pc) < 0.05 ? 0 : pc;
    return `<tr><td>${l}</td><td class="n">${fmt(va, dec)}</td><td class="n">${fmt(vb, dec)}</td><td class="n ${cls}">${dz === null ? '—' : (dz > 0 ? '+' : '') + fmt(dz, dec)}</td><td class="n ${cls}">${pz === null ? '—' : (pz > 0 ? '+' : '') + fmt(pz, 1) + ' %'}</td><td>${u}</td></tr>`;
  };
  const t0 = x => x[0] ? x[0].v : null;
  const filas = [
    fila('Ancho cocido', A.m.ancho, B.m.ancho, 2, 'mm'), fila('Alto cocido', A.m.alto, B.m.alto, 2, 'mm'), fila('Largo', A.m.largo, B.m.largo, 1, 'mm'),
    fila('Cantidad de huecos', A.m.nHuecos, B.m.nHuecos, 0, ''), fila('% de huecos', A.m.vacio, B.m.vacio, 2, '%'),
    fila('Sección neta (material)', A.m.aLleno, B.m.aLleno, 0, 'mm²'), fila('Volumen de material', A.m.volumen, B.m.volumen, 0, 'cm³'), fila('Peso estimado', A.m.peso, B.m.peso, 2, 'kg', 'menos'),
    fila('Pared mínima', A.m.paredMin, B.m.paredMin, 2, 'mm', 'mas'), fila('Tabique mínimo', A.m.tabMin, B.m.tabMin, 2, 'mm', 'mas'),
    fila('Tabique vertical', t0(A.m.tabV), t0(B.m.tabV), 2, 'mm'), fila('Tabique horizontal', t0(A.m.tabH), t0(B.m.tabH), 2, 'mm'),
    fila('Perímetro de huecos', A.m.perimHuecos, B.m.perimHuecos, 0, 'mm'),
    fila('Ondulaciones (sup + inf)', (A.m.rayado.sup.n + A.m.rayado.inf.n), (B.m.rayado.sup.n + B.m.rayado.inf.n), 0, '')
  ].join('');
  const tiposTxt = X => X.m.tipos.map(t => `<b>${t.n}</b> × ${dims2(t.w, t.h)}`).join('<br>');
  $('cmp').innerHTML = `<div class="grid g2" style="margin-top:16px">
    ${cardHtml('📐 Secciones cocidas superpuestas', 'Centradas en el mismo eje', svgComparar(A, B) + `<div class="ley"><span><i style="background:var(--c-ladrillo)"></i>A · ${esc(etiquetaMolde(ma))}</span><span><i style="background:var(--c-verde)"></i>B · ${esc(etiquetaMolde(mb))}</span></div>`)}
    ${cardHtml('🕳️ Huecos cocidos', '', `<div class="tw"><table><thead><tr><th>A · ${esc(etiquetaMolde(ma))}</th><th>B · ${esc(etiquetaMolde(mb))}</th></tr></thead><tbody><tr><td>${tiposTxt(A)}</td><td>${tiposTxt(B)}</td></tr></tbody></table></div>`)}
  </div>
  ${cardHtml('📊 Diferencias del ladrillo cocido', 'B − A · verde: mejora (menos peso, más pared o tabique) · naranja: empeora', `<div class="tw"><table><thead><tr><th>Medida</th><th class="n">A</th><th class="n">B</th><th class="n">Δ</th><th class="n">Δ %</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`, ' style="margin-top:16px"')}`;
}

function vistaTipos() {
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div><div class="eyebrow">Parámetros de planta</div><h1>Tipos de <span>ladrillo</span></h1><p class="sub">Contracción de secado + cocción, largo cocido y densidad. Todos los moldes del tipo se recalculan solos al cambiarlos.</p></div>
      <div class="acciones"><button class="btn pri" id="bNuevoT">＋ Nuevo tipo</button></div></div>
    <div id="nuevoT"></div>
    ${ST.tipos.map((t, i) => cardHtml(`🏷️ ${esc(t.nombre)}`, `${esc(t.familia || '')} · ${ST.moldes.filter(m => m.tipoId === t.id).length} molde(s) · ${esc(t.id)}`, camposTipo(t, 't' + i) + `<div class="acciones"><button class="btn" data-borrar="${esc(t.id)}">🗑️ Borrar</button><button class="btn pri" data-guardar="${i}">💾 Guardar</button></div>`, ' style="margin-top:16px"')).join('') || '<div class="card"><div class="empty">Todavía no hay tipos.</div></div>'}
  </section>`;
  $('bNuevoT').onclick = () => {
    $('nuevoT').innerHTML = cardHtml('＋ Nuevo tipo', '', camposTipo({}, 'tn') + '<div class="acciones"><button class="btn pri" id="bGuardarTN">💾 Crear</button></div>');
    $('bGuardarTN').onclick = () => guardarTipoUI(leerTipo('tn'));
  };
  app().querySelectorAll('[data-guardar]').forEach(b => { b.onclick = () => { const i = +b.dataset.guardar; guardarTipoUI(Object.assign({ id: ST.tipos[i].id }, leerTipo('t' + i))); }; });
  app().querySelectorAll('[data-borrar]').forEach(b => {
    b.onclick = async () => {
      if (!await confirmar('¿Borrar el tipo ' + (tipoDe(b.dataset.borrar) || {}).nombre + '?')) return;
      loader(true);
      try { toast((await API.enviar({ accion: 'borrarTipo', id: b.dataset.borrar })).msg, 'ok'); await cargar(true); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
    };
  });
}

async function guardarTipoUI(t) {
  if (!t.nombre) { toast('El tipo necesita un nombre', 'warn'); return; }
  loader(true);
  try { toast((await API.enviar({ accion: 'guardarTipo', tipo: t })).msg, 'ok'); await cargar(true); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

function vistaAjustes() {
  const c = conexion();
  app().innerHTML = `<section class="vista">
    <div class="hero"><div><div class="eyebrow">Configuración</div><h1>Ajustes y <span>conexión</span></h1><p class="sub">${modoLocal() ? 'Ahora trabajás en modo local (solo este navegador).' : 'Conectado a la planilla por Apps Script.'}</p></div></div>
    ${cardHtml('🔌 Conexión con la planilla', 'URL /exec de la aplicación web de Apps Script y clave (se guardan solo en este navegador)', `<form class="form" id="formCx" autocomplete="off"><label class="f w2">URL /exec<input id="cUrl" type="url" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/.../exec"></label><label class="f">Clave<input id="cKey" type="password" value="${esc(c.key || '')}" placeholder="Opcional"></label><label class="f">👤 Tu nombre<input id="cUsu" maxlength="60" value="${esc(c.usuario || '')}"></label>
      <div class="full acciones" style="margin-top:0"><button class="btn" type="button" id="bLocal">💾 Usar modo local</button><button class="btn pri" type="submit">🔌 Guardar y probar</button></div></form>`)}
    ${cardHtml('📥 Catálogo inicial', 'Tipo «Portante 12×19×33» y sus 4 moldes: original Bongioanni MPA-06, Rev. B, P.12 y P.12 con extremos partidos', `<div class="acciones"><button class="btn pri" id="bSeed2">📥 Importar</button></div>`, ' style="margin-top:16px"')}
    ${cardHtml('🗄️ Respaldo', 'Descarga todos los tipos, moldes y geometrías en un archivo JSON', `<div class="acciones"><button class="btn" id="bBackup">⬇️ Descargar respaldo</button><button class="btn" id="bCache">🧹 Borrar caché local de geometrías</button></div>`, ' style="margin-top:16px"')}
  </section>`;
  $('formCx').onsubmit = async e => {
    e.preventDefault();
    LS.set('mt_url', $('cUrl').value.trim()); LS.set('mt_key', $('cKey').value.trim()); LS.set('mt_usuario', $('cUsu').value.trim());
    ST.geo = {};
    await cargar(true);
    if (ST.cargado) toast(modoLocal() ? 'Modo local' : 'Conexión correcta', 'ok');
  };
  $('cUsu').onchange = e => LS.set('mt_usuario', e.target.value.trim());
  $('bLocal').onclick = async () => { LS.set('mt_url', ''); LS.set('mt_key', ''); ST.geo = {}; await cargar(true); toast('Modo local activado', 'ok'); };
  $('bSeed2').onclick = importarSeed;
  $('bBackup').onclick = respaldo;
  $('bCache').onclick = () => { Object.keys(localStorage).filter(k => k.startsWith('mt_geo_')).forEach(k => LS.del(k)); ST.geo = {}; toast('Caché borrada', 'ok'); };
}

async function importarSeed() {
  if (ST.moldes.length && !await confirmar('Ya hay moldes cargados. ¿Importar igual el catálogo inicial (se agregan como nuevos)?', '📥')) return;
  loader(true);
  try {
    const s = await (await fetch('seed.json', { cache: 'no-store' })).json();
    const moldes = s.moldes.map(m => { const p = prepararMolde(m.molde, m.geo); return { molde: Object.assign({ id: m.molde.id }, p.molde), geo: p.geo }; });
    const r = await API.enviar({ accion: 'importar', tipos: s.tipos, moldes });
    toast(r.msg, 'ok');
    await cargar(true);
    location.hash = '#/catalogo';
  } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

async function respaldo() {
  loader(true);
  try {
    const geos = {};
    for (const m of ST.moldes) geos[m.id] = await geometriaDe(m.id);
    descargar('matrices_respaldo_' + hoyLocal() + '.json', JSON.stringify({ fecha: new Date().toISOString(), tipos: ST.tipos, moldes: ST.moldes, geos }), 'application/json');
  } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

function leerRuta() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const partes = h.split('/').filter(Boolean).map(decodeURIComponent);
  const v = partes[0] || 'catalogo';
  return { v: ['catalogo', 'molde', 'cargar', 'comparar', 'tipos', 'ajustes'].includes(v) ? v : 'catalogo', args: partes.slice(1) };
}

function render() {
  const r = leerRuta();
  ST.vista = r.v; ST.args = r.args;
  pintarNav();
  if (ST.visor) { ST.visor.destruir(); ST.visor = null; }
  if (!ST.cargado && ST.vista !== 'ajustes') { app().innerHTML = `<section class="vista"><div class="card">${procesando('Cargando catálogo…')}</div></section>`; return; }
  if (ST.vista === 'catalogo') vistaCatalogo();
  else if (ST.vista === 'molde') vistaMolde(ST.args[0]);
  else if (ST.vista === 'cargar') vistaCargar();
  else if (ST.vista === 'comparar') vistaComparar(ST.args[0], ST.args[1]);
  else if (ST.vista === 'tipos') vistaTipos();
  else vistaAjustes();
}

function ocultarSplash() {
  const s = $('splash');
  if (s && !s.classList.contains('fuera')) { s.classList.add('fuera'); clearInterval(ocultarSplash._t); }
}

async function cargar(forzar) {
  if (!forzar && !modoLocal()) {
    const cache = LS.get('mt_cache', null);
    if (cache) { aplicar(cache); estadoRed('cache', 'Datos guardados'); ocultarSplash(); }
  }
  loader(true);
  if (!modoLocal()) estadoRed('cache', 'Actualizando');
  try {
    const d = await API.catalogo();
    if (!modoLocal()) LS.set('mt_cache', d);
    aplicar(d);
    estadoRed(modoLocal() ? 'cache' : 'ok', modoLocal() ? 'Modo local' : 'Conectado');
  } catch (err) {
    estadoRed(ST.cargado ? 'cache' : 'off', ST.cargado ? 'Datos guardados' : 'Sin conexión');
    toast(err.message, 'bad');
    if (!ST.cargado) { ST.cargado = true; render(); }
  } finally {
    loader(false);
    ocultarSplash();
  }
}

function aplicar(d) {
  ST.tipos = (d.tipos || []).map(t => Object.assign({}, t, { contrH: num(t.contrH), contrV: num(t.contrV), contrL: num(t.contrL), largo: num(t.largo), densidad: num(t.densidad) }));
  ST.moldes = (d.moldes || []).map(m => Object.assign({}, m, { metricas: typeof m.metricas === 'string' ? (() => { try { return JSON.parse(m.metricas); } catch (e) { return null; } })() : m.metricas }));
  ST.cargado = true;
  const enCarga = ST.vista === 'cargar' && ST.carga && ST.carga.ext;
  if (!enCarga) render();
}

function init() {
  $('btnTema').textContent = temaActual() === 'dark' ? '☀️' : '🌙';
  $('btnTema').onclick = alternarTema;
  $('btnRefrescar').onclick = () => { ST.geo = {}; cargar(true); };
  let i = 0;
  ocultarSplash._t = setInterval(() => { $('splashTxt').textContent = FRASES[++i % FRASES.length]; }, 900);
  window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('resize', () => { moverPill($('nav')); document.querySelectorAll('main .seg').forEach(moverPill); });
  if (!location.hash) history.replaceState(null, '', '#/catalogo');
  render();
  cargar(false);
}

document.addEventListener('DOMContentLoaded', init);
