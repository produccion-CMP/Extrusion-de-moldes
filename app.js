'use strict';

const VISTAS = [
  { id: 'catalogo', e: '🧱', n: 'Catálogo' },
  { id: 'nuevo', e: '📄', n: 'Nuevo plano' },
  { id: 'comparar', e: '⚖️', n: 'Comparar' },
  { id: 'ajustes', e: '⚙️', n: 'Ajustes' }
];
const BNAV = VISTAS;
const FRASES = ['Midiendo dados…', 'Leyendo planos…', 'Calculando contracciones…', 'Horneando a 900 °C…', 'Contando huecos…'];
const ST = { config: null, tipos: [], moldes: [], cargado: false, vista: 'catalogo', args: [], filtro: { q: '', familia: '', estado: '' }, geo: {}, visor: null, carga: null };

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


function opcionesPadre(tipoId, sel, excluir) {
  const ms = ST.moldes.filter(m => m.tipoId === tipoId && m.id !== excluir);
  return `<option value="">— Sin versión anterior —</option>` + ms.map(m => `<option value="${esc(m.id)}" ${m.id === sel ? 'selected' : ''}>${esc(etiquetaMolde(m))}</option>`).join('');
}

function camposMeta(m, prefijo, compacto) {
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
    <div class="full" id="${p}NuevoTipo" hidden><p class="sub" style="margin:4px 0 8px">Nuevo tipo de ladrillo: estos parámetros se aplican a todos sus moldes.</p>${camposTipo(ST.tipos.length ? {} : PRESET_TIPO, p + 'NT')}</div>
    ${compacto ? `<details class="mas full"><summary>📎 Más datos (proveedor, fecha, autor, notas)</summary><div class="form" style="margin-top:10px">` : ''}
    <label class="f">🏭 Proveedor<input id="${p}Proveedor" maxlength="80" value="${esc(v('proveedor'))}" placeholder="Bongioanni Stampi"></label>
    <label class="f">📅 Fecha del plano<input id="${p}Fecha" type="date" value="${esc(String(v('fecha')).slice(0, 10))}"></label>
    <label class="f">✍️ Dibujó / autor<input id="${p}Autor" maxlength="60" value="${esc(v('autor'))}"></label>
    <label class="f full">📝 Notas<textarea id="${p}Notas" rows="2" maxlength="2000">${esc(v('notas'))}</textarea></label>
    ${compacto ? '</div></details>' : ''}
    <details class="mas full" ${['contrH', 'contrV', 'contrL', 'largo', 'densidad'].some(k => num(m[k]) !== null) ? 'open' : ''}><summary>⚙️ Parámetros propios de este molde (vacío = usar los del tipo)</summary>
      <div class="form" style="margin-top:10px">
        <label class="f">Contr. horizontal (%)<input id="${p}contrH" type="number" step="0.01" value="${esc(v('contrH'))}" placeholder="${ph('contrH')}"></label>
        <label class="f">Contr. vertical (%)<input id="${p}contrV" type="number" step="0.01" value="${esc(v('contrV'))}" placeholder="${ph('contrV')}"></label>
        <label class="f">Contr. longitudinal (%)<input id="${p}contrL" type="number" step="0.01" value="${esc(v('contrL'))}" placeholder="${ph('contrL')}"></label>
        <label class="f">Largo cocido (mm)<input id="${p}largo" type="number" step="0.1" value="${esc(v('largo'))}" placeholder="${ph('largo')}"></label>
        <label class="f">Densidad (g/cm³)<input id="${p}densidad" type="number" step="0.01" value="${esc(v('densidad'))}" placeholder="${ph('densidad')}"></label>
      </div></details></div>`;
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

function procesando(txt) { return `<div class="procesando"><span class="spin"></span>${esc(txt)}</div>`; }

function aBase64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
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

async function guardarTipoUI(t) {
  if (!t.nombre) { toast('El tipo necesita un nombre', 'warn'); return; }
  loader(true);
  try { toast((await API.enviar({ accion: 'guardarTipo', tipo: t })).msg, 'ok'); await cargar(true); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

async function importarSeed() {
  if (ST.moldes.length && !await confirmar('Ya hay moldes cargados. ¿Importar igual el catálogo inicial (se agregan como nuevos)?', '📥')) return;
  loader(true);
  try {
    const s = await (await fetch('seed.json', { cache: 'no-store' })).json();
    const moldes = s.moldes.map(m => {
      const p = prepararMolde(m.molde, m.geo);
      const t = s.tipos.find(x => x.id === m.molde.tipoId) || {};
      const pr = paramsDe(m.molde, s.tipos);
      try { p.molde.metricas.revision = Revision.analizar(m.geo, p.metricas, Geo.cocer(m.geo, pr), pr, t, umbrales(), {}).resumen; } catch (e) {}
      return { molde: Object.assign({ id: m.molde.id }, p.molde), geo: p.geo };
    });
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

const PRESET_TIPO = { familia: 'Portantes', codigo: 'P12', nombre: 'Portante 12×19×33', nominal: '12 × 19 × 33 cm', anchoObj: 330, altoObj: 120, linea: '', anchoMolde: 344, altoMolde: 125, largo: 190, contrH: 4.2, contrV: 4.8, contrL: 4.2, densidad: 1.8, notas: '' };




function dropHtml(id, chico) {
  return `<label class="drop${chico ? ' chico' : ''}" id="${id}"><span class="e">📄</span><b>Soltá acá el plano del molde</b><small>PDF exportado de AutoCAD o DXF · también podés tocar para elegirlo</small><input type="file" accept=".pdf,.dxf,application/pdf" hidden></label>`;
}

function enlazarDrop(id) {
  const d = $(id);
  if (!d) return;
  d.querySelector('input').onchange = e => { if (e.target.files[0]) iniciarCarga(e.target.files[0]); };
  d.ondragover = e => { e.preventDefault(); d.classList.add('sobre'); };
  d.ondragleave = () => d.classList.remove('sobre');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('sobre'); if (e.dataTransfer.files[0]) iniciarCarga(e.dataTransfer.files[0]); };
}


function toolbarVisor() {
  return `<div class="tb"><div class="seg" id="vPose"><button class="on" data-p="obra">🏗️ En obra</button><button data-p="extr">➡️ Saliendo de la extrusora</button></div>
    <div class="seg" id="vTog"><button class="on" data-t="cotas">Cotas</button><button data-t="verde">Contorno del molde</button><button class="on" data-t="girar">Girar</button></div></div>`;
}

function enlazarToolbar() {
  const c = $('vPose');
  if (c) {
    c.querySelectorAll('button').forEach(b => { b.onclick = () => { c.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); if (ST.visor) ST.visor.pose(b.dataset.p); moverPill(c); }; });
    moverPill(c);
  }
  const t = $('vTog');
  if (t) t.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      b.classList.toggle('on');
      const on = b.classList.contains('on');
      if (!ST.visor) return;
      if (b.dataset.t === 'girar') ST.visor.girar(on); else ST.visor.mostrar(b.dataset.t, on);
    };
  });
}

function montarVisor(host, geoC, mc, geoV, mv, titulo, subtitulo) {
  conVisor(err => {
    if (!host || !host.isConnected) return;
    if (err) { host.innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; return; }
    if (ST.visor) ST.visor.destruir();
    ST.visor = window.Visor3D.montar(host, { marco: geoC.marco, huecos: geoC.huecos, ancho: mc.ancho, alto: mc.alto, largo: mc.largo, verde: geoV ? { marco: geoV.marco, huecos: geoV.huecos, ancho: mv.ancho, alto: mv.alto } : null, titulo: titulo || '', subtitulo: subtitulo || `Ladrillo cocido ${fmt(mc.ancho, 1)} × ${fmt(mc.alto, 1)} × ${fmt(mc.largo)} mm · ${mc.nHuecos} huecos · ${fmt(mc.vacio, 1)} % · ${fmt(mc.peso, 2)} kg` });
    const t = $('vTog');
    if (t) t.querySelectorAll('button').forEach(b => { const on = b.classList.contains('on'); if (b.dataset.t === 'girar') ST.visor.girar(on); else ST.visor.mostrar(b.dataset.t, on); });
    const c = $('vPose');
    const p = c && c.querySelector('button.on');
    if (p && p.dataset.p !== 'obra') ST.visor.pose(p.dataset.p);
  });
}

function detCocido(mc, p) {
  return `<div class="det grande">
    <div class="full2"><span>Medidas del ladrillo cocido</span><b>${fmt(mc.ancho, 1)} × ${fmt(mc.alto, 1)} × ${fmt(mc.largo, 0)} mm</b></div>
    <div><span>Huecos</span><b>${fmt(mc.nHuecos)}</b></div>
    <div><span>Huecos sobre la sección</span><b>${fmt(mc.vacio, 1)} %</b></div>
    <div><span>Peso estimado</span><b>${fmt(mc.peso, 2)} kg</b></div>
    <div><span>Material por ladrillo</span><b>${fmt(mc.volumen)} cm³</b></div>
    <div><span>Pared mínima</span><b>${fmt(mc.paredMin, 2)} mm</b></div>
    <div><span>Tabique mínimo</span><b>${fmt(mc.tabMin, 2)} mm</b></div>
  </div>
  <p class="sub" style="margin-top:10px">Contracción ${fmt(p.contrH, 1)} % horizontal y ${fmt(p.contrV, 1)} % vertical · densidad ${fmt(p.densidad, 2)} g/cm³ · corte en verde ≈ ${fmt(mc.corteVerde, 1)} mm</p>`;
}

function tiposCarga() {
  const C = ST.carga;
  if (C && C.tipoId === '__nuevo') {
    const nt = $('nNTnombre') ? leerTipo('nNT') : (ST.tipos.length ? {} : PRESET_TIPO);
    return ST.tipos.concat([Object.assign({ id: '__nuevo' }, nt)]);
  }
  return ST.tipos;
}

function iniciarCarga(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'dxf'].includes(ext)) { toast('Formato no soportado: usá PDF o DXF', 'bad'); return; }
  ST.carga = { file: f, archivo: { nombre: f.name, size: f.size, mime: f.type || (ext === 'pdf' ? 'application/pdf' : 'application/dxf'), ext }, giro: 0, espejo: false, meta: {}, estado: 'leyendo' };
  if (location.hash.startsWith('#/nuevo')) pintarNuevo(); else location.hash = '#/nuevo';
  procesarCarga();
}

async function procesarCarga() {
  const C = ST.carga;
  try {
    const buf = await C.file.arrayBuffer();
    C.buf = buf;
    if (C.archivo.ext === 'pdf') C.lect = await Geo.leerPdf(buf.slice(0));
    else {
      const txt = new TextDecoder('utf-8').decode(buf);
      if (/^AutoCAD Binary DXF/.test(txt.slice(0, 22))) throw new Error('El DXF es binario: guardalo como DXF ASCII desde AutoCAD');
      C.lect = Geo.leerDxf(txt);
    }
    if (!C.lect.capas.length) throw new Error('El archivo no tiene dibujo vectorial (¿es un PDF escaneado?)');
    C.estado = 'detectando';
    if (ST.carga === C && ST.vista === 'nuevo') pintarNuevo();
    await new Promise(r => setTimeout(r, 40));
    C.base = await Geo.extraer(C.lect, { capas: C.capasSel || null });
    C.capasSel = C.base.capas;
    if (!C.tipoId) {
      const ult = ST.moldes.slice().sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')))[0];
      C.tipoId = ult ? ult.tipoId : (ST.tipos[0] ? ST.tipos[0].id : '__nuevo');
    }
    escalaDesdeTipo();
    recalcularCarga();
    C.estado = 'listo';
  } catch (err) {
    C.estado = 'error';
    C.error = err.message;
  }
  if (ST.carga === C && ST.vista === 'nuevo') pintarNuevo();
}

function escalaDesdeTipo() {
  const C = ST.carga;
  if (C.lect.tipo !== 'pdf' || C.escalaManual) return;
  const t = tiposCarga().find(x => x.id === C.tipoId) || {};
  if (num(t.anchoMolde) && num(t.altoMolde)) { C.anchoMm = num(t.anchoMolde); C.altoMm = num(t.altoMolde); C.escalaFuente = 'las medidas del molde del tipo «' + (t.nombre || 'nuevo') + '»'; return; }
  const ref = ST.moldes.filter(m => m.tipoId === C.tipoId && num(m.anchoV)).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))[0];
  if (ref) { C.anchoMm = +num(ref.anchoV).toFixed(2); C.altoMm = +num(ref.altoV).toFixed(2); C.escalaFuente = 'el molde ' + etiquetaMolde(ref); return; }
  C.anchoMm = PRESET_TIPO.anchoMolde; C.altoMm = PRESET_TIPO.altoMolde; C.escalaFuente = 'la medida estándar del portante (344 × 125 mm)';
}

function recalcularCarga() {
  const C = ST.carga;
  C.ext = Geo.reorientar(C.base, C.giro, C.espejo);
  C.esc = Geo.escalarMm(C.ext, C.anchoMm || null, C.altoMm || null);
  C.geoV = C.esc.geo;
  C.met = Geo.metricas(C.geoV);
  const meta = Object.assign({}, C.meta, { tipoId: C.tipoId });
  C.p = paramsDe(meta, tiposCarga());
  C.coc = Geo.cocer(C.geoV, C.p);
}

function avisoEscala() {
  const C = ST.carga;
  if (C.lect.tipo !== 'pdf') return '';
  const desv = C.altoMm ? (C.met.alto - C.altoMm) / C.altoMm * 100 : 0;
  if (Math.abs(desv) > 1) return `<div class="alerta warn"><span class="e">📏</span><span>Las proporciones del plano no coinciden con ${esc(C.escalaFuente || 'la escala')}: con ${fmt(C.anchoMm, 1)} mm de ancho, el alto da ${fmt(C.met.alto, 1)} mm en vez de ${fmt(C.altoMm, 1)} mm. Elegí el tipo correcto o corregí la medida del molde en «Revisar la lectura del plano».</span></div>`;
  return `<p class="sub" style="margin-top:8px">📏 Escala tomada de ${esc(C.escalaFuente || 'la medida cargada')}: molde de ${fmt(C.met.ancho, 2)} × ${fmt(C.met.alto, 2)} mm.</p>`;
}

function revisionHtml() {
  const C = ST.carga, m = C.met;
  return `<div class="grid g-21">
    <div><div class="prev-geo">${svgSeccion(C.geoV, m, {})}</div>
      <div class="tb" style="margin-top:10px"><button class="btn" id="bRot">↻ Rotar 90°</button><button class="btn" id="bEsp">⇋ Espejar</button></div>
      <div class="tw" style="margin-top:8px"><table><thead><tr><th>Hueco</th><th class="n">Cant.</th><th class="n">Medida en el molde</th></tr></thead><tbody>${m.tipos.map(t => `<tr><td><b>${t.letra}</b></td><td class="n">${t.n}</td><td class="n">${dims2(t.w, t.h)} mm</td></tr>`).join('')}</tbody></table></div></div>
    <div><h3 style="margin-bottom:8px">📏 Medida exterior del molde</h3><div class="form"><label class="f">Ancho (mm)<input id="eAncho" type="number" step="0.01" value="${C.lect.tipo === 'pdf' ? (C.anchoMm || '') : ''}" placeholder="${fmt(m.ancho, 2)}"></label><label class="f">Alto (mm)<input id="eAlto" type="number" step="0.01" value="${C.lect.tipo === 'pdf' ? (C.altoMm || '') : ''}" placeholder="${fmt(m.alto, 2)}"></label></div>
      <p class="sub">${C.lect.tipo === 'pdf' ? 'El PDF no trae la escala; se usan las cotas generales del molde.' : 'El DXF ya viene en milímetros; completalo solo si querés forzar otra medida.'}</p>
      <div class="acciones"><button class="btn" id="bEsc">✔️ Aplicar medida</button></div>
      <h3 style="margin:14px 0 8px">🎨 Capas del dibujo usadas</h3>
      <div class="capas" id="lCapas">${C.lect.capas.slice().sort((a, b) => b.largo - a.largo).map(c => `<label><input type="checkbox" value="${esc(c.key)}" ${C.capasSel && C.capasSel.includes(c.key) ? 'checked' : ''}><span class="sw" style="background:${esc(c.color)}"></span>${esc(c.nombre)}<small>${c.polys.length}</small></label>`).join('')}</div>
      <div class="acciones"><button class="btn" id="bRedetectar">🔍 Volver a detectar</button></div></div></div>`;
}

function enlazarRevision() {
  const C = ST.carga;
  const refrescar = () => { recalcularCarga(); actualizarResultado(true); };
  if ($('bRot')) $('bRot').onclick = () => { C.giro = (C.giro + 90) % 360; refrescar(); };
  if ($('bEsp')) $('bEsp').onclick = () => { C.espejo = !C.espejo; refrescar(); };
  if ($('bEsc')) $('bEsc').onclick = () => { C.anchoMm = num($('eAncho').value); C.altoMm = num($('eAlto').value); C.escalaManual = !!C.anchoMm; if (!C.anchoMm) { C.escalaManual = false; escalaDesdeTipo(); } refrescar(); };
  if ($('bRedetectar')) $('bRedetectar').onclick = () => {
    const sel = [...$('lCapas').querySelectorAll('input:checked')].map(i => i.value);
    if (!sel.length) { toast('Elegí al menos una capa', 'warn'); return; }
    C.capasSel = sel; C.estado = 'detectando'; C.meta = leerMeta('n');
    pintarNuevo();
    procesarCarga();
  };
}

function actualizarResultado(conRevision) {
  const C = ST.carga;
  if (!C || C.estado !== 'listo' || !$('nKpi')) return;
  $('nKpi').innerHTML = detCocido(C.coc.m, C.p);
  $('nAviso').innerHTML = avisoEscala();
  if (conRevision) { $('nRevision').innerHTML = revisionHtml(); enlazarRevision(); }
  montarVisor($('visor'), C.coc.geo, C.coc.m, C.geoV, C.met, tituloCarga());
}

function tituloCarga() {
  const C = ST.carga;
  const cod = $('nCodigo') ? $('nCodigo').value.trim() : '';
  const ver = $('nVersion') ? $('nVersion').value.trim() : '';
  return (cod || C.archivo.nombre) + (ver ? ' · ' + ver : '');
}


async function blobBase64(b) { return aBase64(await b.arrayBuffer()); }

async function grabarArchivos(base, avisar) {
  const out = [];
  if (!ST.visor) return out;
  if (ST.visor.puedeGrabar()) {
    try {
      const v = await ST.visor.grabar(7, 960, 600, p => { if (avisar) avisar(p); });
      out.push({ rol: 'animacion', nombre: base + '_cocido_3D.' + v.ext, mime: v.mime, base64: await blobBase64(v.blob) });
    } catch (e) { toast('No se pudo grabar la animación: ' + e.message, 'warn'); }
  }
  const png = ST.visor.captura();
  out.push({ rol: 'imagen', nombre: base + '_cocido_3D.png', mime: 'image/png', base64: png.split(',')[1] });
  return out;
}


async function grabarAnimacion(m) {
  const btn = $('btnAnim');
  if (!ST.visor) { toast('Esperá a que cargue el 3D', 'warn'); return; }
  btn.disabled = true;
  loader(true);
  try {
    btn.innerHTML = '🎬 Grabando…';
    const archivos = await grabarArchivos(nombreArchivo(etiquetaMolde(m)), p => { btn.innerHTML = `🎬 Grabando… ${p} %`; });
    btn.innerHTML = '☁️ Subiendo…';
    await API.enviar({ accion: 'guardarMolde', molde: { id: m.id, codigo: m.codigo, tipoId: m.tipoId }, archivos });
    toast('Animación guardada en Drive', 'ok');
    await cargar(true);
  } catch (err) { toast(err.message, 'bad'); btn.disabled = false; btn.innerHTML = '🎬 Grabar animación y subir a Drive'; } finally { loader(false); }
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const familiasCfg = () => (ST.config && ST.config.familias && ST.config.familias.length) ? ST.config.familias : CONFIG_DEFECTO.familias;
const umbrales = () => Object.assign({}, Revision.DEF, (ST.config && ST.config.umbrales) || {});

function familiaDeTipo(t) {
  const f = norm(t.familia);
  if (!f) return null;
  return familiasCfg().find(x => norm(x.id) === f || norm(x.nombre) === f || norm(x.nombre).startsWith(f) || f.startsWith(norm(x.nombre).replace(/s$/, ''))) || null;
}

const tipoLabel = t => (t.codigo ? t.codigo + ' · ' : '') + (t.nombre || '');
const tiposDeFamilia = fid => ST.tipos.filter(t => { const f = familiaDeTipo(t); return fid === '__otros' ? !f : f && f.id === fid; }).sort((a, b) => String(a.codigo || a.nombre).localeCompare(String(b.codigo || b.nombre), 'es', { numeric: true }));
const moldesDeTipo = tid => ST.moldes.filter(m => m.tipoId === tid);
const puedeCargar = () => esAdmin() || !(ST.config && ST.config.soloAdminCarga);

function familias() {
  const f = new Map();
  ST.tipos.forEach(t => { const fa = familiaDeTipo(t); const k = fa ? fa.nombre : 'Otros'; if (!f.has(k)) f.set(k, []); f.get(k).push(t); });
  return f;
}

function opcionesTipos(sel, conNuevo) {
  const grupos = familiasCfg().map(f => ({ f, ts: tiposDeFamilia(f.id) })).filter(g => g.ts.length);
  const otros = tiposDeFamilia('__otros');
  if (otros.length) grupos.push({ f: { icono: '📦', nombre: 'Otros' }, ts: otros });
  return grupos.map(g => `<optgroup label="${esc(g.f.icono + ' ' + g.f.nombre)}">${g.ts.map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(tipoLabel(t))}</option>`).join('')}</optgroup>`).join('') + (conNuevo && esAdmin() ? '<option value="__nuevo">＋ Nuevo tipo…</option>' : '');
}

function pintarNav() {
  const v = ['molde', 'familia', 'tipo'].includes(ST.vista) ? 'catalogo' : ST.vista;
  const vis = VISTAS.filter(x => x.id !== 'nuevo' || puedeCargar());
  $('nav').innerHTML = vis.map(x => `<a href="#/${x.id}" class="${x.id === v ? 'on' : ''}" title="${x.n}"><span class="e">${x.e}</span><span class="tx">${x.n}</span></a>`).join('');
  $('bnav').innerHTML = vis.map(x => `<a href="#/${x.id}" class="${x.id === v ? 'on' : ''}"><span class="e">${x.e}</span>${x.n}</a>`).join('');
  const chip = $('chipAdmin');
  if (chip) chip.hidden = !(esAdmin() && !modoLocal());
  requestAnimationFrame(() => requestAnimationFrame(() => moverPill($('nav'))));
}

function migas(items) {
  return `<div class="eyebrow migas">${items.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join(' › ')}</div>`;
}

function camposTipo(t, p) {
  const v = k => (t[k] === undefined || t[k] === null) ? '' : t[k];
  const fam = familiaDeTipo(t);
  const n = (k, l, ph, st) => `<label class="f">${l}<input id="${p}${k}" type="number" step="${st || '0.01'}" value="${esc(v(k))}" placeholder="${ph}"></label>`;
  return `<div class="form">
    <label class="f">Familia<select id="${p}familia">${familiasCfg().map(f => `<option value="${esc(f.nombre)}" ${fam && fam.id === f.id ? 'selected' : ''}>${esc(f.icono + ' ' + f.nombre)}</option>`).join('')}</select></label>
    <label class="f">Código<input id="${p}codigo" maxlength="12" value="${esc(v('codigo'))}" placeholder="P12"></label>
    <label class="f">Nombre<input id="${p}nombre" maxlength="60" value="${esc(v('nombre'))}" placeholder="Portante 12×19×33"></label>
    <label class="f">Medida nominal<input id="${p}nominal" maxlength="40" value="${esc(v('nominal'))}" placeholder="12 × 19 × 33 cm"></label>
    ${n('anchoMolde', 'Ancho del molde (mm)', '344')}${n('altoMolde', 'Alto del molde (mm)', '125')}${n('largo', 'Largo cocido (mm)', '190', '0.1')}
    ${n('contrH', 'Contracción horizontal (%)', '4.2')}${n('contrV', 'Contracción vertical (%)', '4.8')}${n('contrL', 'Contracción longitudinal (%)', '4.2')}
    ${n('densidad', 'Densidad del cocido (g/cm³)', '1.80')}${n('anchoObj', 'Ancho cocido objetivo (mm)', '330', '0.1')}${n('altoObj', 'Alto cocido objetivo (mm)', '120', '0.1')}
    ${n('vacioMin', 'Huecos mínimo (%)', '—', '0.1')}${n('vacioMax', 'Huecos máximo (%)', '—', '0.1')}${n('pesoMax', 'Peso máximo (kg)', '—')}
    <label class="f">Línea / máquina<input id="${p}linea" maxlength="40" value="${esc(v('linea'))}"></label>
    <label class="f">Notas<input id="${p}notas" maxlength="300" value="${esc(v('notas'))}"></label>
  </div>`;
}

function leerTipo(p) {
  const g = k => { const el = $(p + k); return el ? el.value.trim() : ''; };
  const o = {};
  ['familia', 'codigo', 'nombre', 'nominal', 'linea', 'anchoMolde', 'altoMolde', 'largo', 'contrH', 'contrV', 'contrL', 'densidad', 'anchoObj', 'altoObj', 'vacioMin', 'vacioMax', 'pesoMax', 'notas'].forEach(k => { o[k] = g(k); });
  return o;
}

function miniPlano(m) { return Plano.miniatura(m); }

function badgeRev(m) {
  const r = m.metricas && m.metricas.revision;
  if (!r) return '';
  if (r.error) return `<span class="tag t-bad" title="Revisión del plano">⛔ ${r.error} error${r.error > 1 ? 'es' : ''}</span>`;
  if (r.aviso) return `<span class="tag t-warn" title="Revisión del plano">⚠️ ${r.aviso} aviso${r.aviso > 1 ? 's' : ''}</span>`;
  return '<span class="tag t-ok" title="Revisión del plano">✔️ Sin observaciones</span>';
}

function vistaCatalogo() {
  const tarjetas = familiasCfg().map(f => ({ f, ts: tiposDeFamilia(f.id) }));
  const otros = tiposDeFamilia('__otros');
  if (otros.length) tarjetas.push({ f: { id: '__otros', nombre: 'Otros', icono: '📦', descripcion: 'Tipos sin familia asignada' }, ts: otros });
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div><div class="eyebrow">${esc(CONF.PLANTA || 'Planta')}</div><h1>Catálogo de <span>ladrillos</span></h1>
      <p class="sub">Elegí la familia, el tipo y la variante para ver el ladrillo cocido, el plano y la revisión técnica de cada molde.</p></div>
      ${puedeCargar() ? '<div class="acciones"><a class="btn pri" href="#/nuevo">📄 Nuevo plano</a></div>' : ''}</div>
    <div class="grid-fam">${tarjetas.map(({ f, ts }) => {
      const ms = ts.flatMap(t => moldesDeTipo(t.id));
      const ult = ms.slice().sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')))[0];
      return `<a class="fcard" href="#/familia/${encodeURIComponent(f.id)}"><div class="fc-top"><span class="fc-ico">${esc(f.icono || '🧱')}</span><div><b>${esc(f.nombre)}</b><small>${esc(f.descripcion || '')}</small></div></div>
        ${ult ? miniPlano(ult) : '<div class="mini-plano vacio"><span>Sin moldes cargados</span></div>'}
        <div class="fc-k"><span><b>${ts.length}</b> tipo${ts.length === 1 ? '' : 's'}</span><span><b>${ms.length}</b> variante${ms.length === 1 ? '' : 's'}</span>${ts.length ? `<span class="codigos">${ts.slice(0, 6).map(t => esc(t.codigo || t.nombre)).join(' · ')}</span>` : ''}</div></a>`;
    }).join('')}</div>
    ${!ST.moldes.length && esAdmin() ? `<div class="card" style="margin-top:16px"><div class="empty"><b>Catálogo vacío</b><span>Cargá un plano o importá los 4 moldes de ejemplo del portante P12.</span><button class="btn" id="btnSeed">📥 Importar ejemplos</button></div></div>` : ''}
  </section>`;
  if ($('btnSeed')) $('btnSeed').onclick = importarSeed;
}

function vistaFamilia(fid) {
  const f = familiasCfg().find(x => x.id === fid) || (fid === '__otros' ? { id: '__otros', nombre: 'Otros', icono: '📦' } : null);
  if (!f) { location.hash = '#/catalogo'; return; }
  const ts = tiposDeFamilia(fid);
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div>${migas([['Catálogo', '#/catalogo'], [f.nombre]])}<h1>${esc(f.icono || '')} <span>${esc(f.nombre)}</span></h1><p class="sub">${esc(f.descripcion || '')}</p></div>
      ${esAdmin() ? '<div class="acciones"><a class="btn" href="#/ajustes">🏷️ Administrar tipos</a></div>' : ''}</div>
    ${ts.length ? `<div class="grid-tipo">${ts.map(t => {
      const ms = moldesDeTipo(t.id);
      const ult = ms.slice().sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')))[0];
      const vig = ms.filter(m => m.estado === 'Vigente').length;
      return `<a class="tcard" href="#/tipo/${encodeURIComponent(t.id)}"><div class="tc-top"><span class="tc-cod">${esc(t.codigo || '—')}</span><div><b>${esc(t.nombre)}</b><small>${esc(t.nominal || '')}</small></div></div>
        ${ult ? miniPlano(ult) : '<div class="mini-plano vacio"><span>Sin variantes</span></div>'}
        <div class="fc-k"><span><b>${ms.length}</b> variante${ms.length === 1 ? '' : 's'}</span>${vig ? `<span class="tag t-ok">🟢 ${vig} vigente${vig > 1 ? 's' : ''}</span>` : ''}<span>🔥 ${fmt(num(t.contrH), 1)} / ${fmt(num(t.contrV), 1)} %</span></div></a>`;
    }).join('')}</div>` : `<div class="card"><div class="empty"><b>No hay tipos en ${esc(f.nombre)}</b>${esAdmin() ? '<span>Creá los tipos (H8, H12, H18…) en Ajustes.</span><a class="btn pri" href="#/ajustes">🏷️ Crear tipo</a>' : '<span>El administrador todavía no cargó tipos en esta familia.</span>'}</div></div>`}
  </section>`;
}

function cardVariante(m) {
  const r = resumenCocido(m, ST.tipos);
  const e = estadoDe(m.estado);
  const pad = m.padreId ? moldeDe(m.padreId) : null;
  return `<a class="vcard" href="#/molde/${encodeURIComponent(m.id)}">
    ${miniPlano(m)}
    <div class="vc-cuerpo"><div class="mc-top"><div><b>${esc(m.codigo || m.id)}</b><small>${esc(m.version || '')}${m.fecha ? ' · ' + fFecha(m.fecha) : ''}</small></div><span class="tag ${e.cls}">${e.e} ${esc(e.id)}</span></div>
    <div class="mc-k"><div><span>Huecos</span><b>${fmt(r.huecos)}</b></div><div><span>Vacío</span><b>${fmt(r.vacio, 1)}%</b></div><div><span>Peso</span><b>${fmt(r.peso, 2)} kg</b></div></div>
    <div class="vc-pie">${badgeRev(m)}${m.animacionUrl ? '<span class="tag">🎬</span>' : ''}${pad ? `<small class="sub">↳ de ${esc(etiquetaMolde(pad))}</small>` : ''}</div></div></a>`;
}

function vistaTipo(tid) {
  const t = tipoDe(tid);
  if (!t) { location.hash = '#/catalogo'; return; }
  const f = familiaDeTipo(t) || { id: '__otros', nombre: 'Otros', icono: '📦' };
  const ms = moldesDeTipo(t.id);
  const ord = linajes(ms).flat();
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div>${migas([['Catálogo', '#/catalogo'], [f.nombre, '#/familia/' + encodeURIComponent(f.id)], [t.codigo || t.nombre]])}<h1>${esc(t.codigo || '')} <span>${esc(t.nombre)}</span></h1>
      <p class="sub">${esc(t.nominal || '')} · molde ${fmt(num(t.anchoMolde), 1)} × ${fmt(num(t.altoMolde), 1)} mm · contracción ${fmt(num(t.contrH), 1)} / ${fmt(num(t.contrV), 1)} % · largo ${fmt(num(t.largo))} mm · ${fmt(num(t.densidad), 2)} g/cm³</p></div>
      ${puedeCargar() ? `<div class="acciones"><a class="btn pri" href="#/nuevo?tipo=${encodeURIComponent(t.id)}">📄 Cargar variante</a></div>` : ''}</div>
    ${ms.length ? `<div class="grid-var">${ord.map(cardVariante).join('')}</div>` : '<div class="card"><div class="empty"><b>Todavía no hay variantes de este tipo</b><span>Cargá el plano del molde para verlo.</span></div></div>'}
    ${ms.length > 1 ? `<div class="acciones"><a class="btn" href="#/comparar/${encodeURIComponent(ord[0].id)}/${encodeURIComponent(ord[ord.length - 1].id)}">⚖️ Comparar variantes</a></div>` : ''}
  </section>`;
}

function revisionLista(rev) {
  const ic = { error: '⛔', aviso: '⚠️', info: 'ℹ️', ok: '✔️' };
  const r = rev.resumen;
  return `<div class="rev-res"><span class="tag ${r.error ? 't-bad' : 't-ok'}">⛔ ${r.error} error${r.error === 1 ? '' : 'es'}</span><span class="tag ${r.aviso ? 't-warn' : 't-ok'}">⚠️ ${r.aviso} aviso${r.aviso === 1 ? '' : 's'}</span><span class="tag">ℹ️ ${r.info} nota${r.info === 1 ? '' : 's'}</span></div>
    <div class="rev-lista">${rev.items.map(it => `<div class="rev ${it.nivel}"><span class="ri">${it.n ? `<b class="num">${it.n}</b>` : ic[it.nivel]}</span><div><b>${esc(it.titulo)}</b><p>${esc(it.detalle)}</p>${it.sugerencia && it.nivel !== 'ok' ? `<p class="sug">💡 ${esc(it.sugerencia)}</p>` : ''}</div></div>`).join('')}</div>`;
}

function hojaDe(geoC, mc, opts) {
  return Plano.hoja(Object.assign({ geo: geoC, met: mc, largo: mc.largo }, opts));
}

function abrirImpresion(svg, titulo) {
  const w = window.open('', '_blank');
  if (!w) { toast('Permití las ventanas emergentes para imprimir', 'warn'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0}svg{width:420mm;height:297mm;display:block}</style></head><body>${svg}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

async function vistaMolde(id) {
  const m = moldeDe(id);
  if (!m) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty">No existe el molde ${esc(id)}. <a class="btn" href="#/catalogo">Volver</a></div></div></section>`; return; }
  const t = tipoDe(m.tipoId) || {};
  const f = familiaDeTipo(t) || { id: '__otros', nombre: 'Otros' };
  const e = estadoDe(m.estado);
  const ch = cadena(ST.moldes, m.id);
  const padre = m.padreId ? moldeDe(m.padreId) : null;
  const tl = ch.arriba.concat([m], ch.abajo.map(x => x.m));
  const pest = ST.pestana || '3d';
  const archivos = [m.archivoUrl ? `<a class="btn" href="${esc(m.archivoUrl)}" target="_blank" rel="noopener">📄 Plano original</a>` : '', m.animacionUrl ? `<a class="btn" href="${esc(m.animacionUrl)}" target="_blank" rel="noopener">🎬 Animación</a>` : '', m.imagenUrl ? `<a class="btn" href="${esc(m.imagenUrl)}" target="_blank" rel="noopener">🖼️ Imagen</a>` : ''].join('');
  const tabs = [['3d', '🧱 Ladrillo 3D'], ['plano', '📐 Plano y vistas'], ['revision', '🩺 Revisión'], ['medidas', '📋 Medidas'], ['versiones', '🔗 Versiones y archivos']];
  app().innerHTML = `<section class="vista">${bannerLocal()}
    <div class="hero"><div>${migas([['Catálogo', '#/catalogo'], [f.nombre, '#/familia/' + encodeURIComponent(f.id)], [t.codigo || t.nombre || 'Tipo', '#/tipo/' + encodeURIComponent(t.id || '')], [etiquetaMolde(m)]])}
      <h1>${esc(m.codigo || m.id)} <span>${esc(m.version || '')}</span></h1>
      <p class="sub"><span class="tag ${e.cls}">${e.e} ${esc(e.id)}</span> <span id="badgeRev"></span> ${m.proveedor ? '· ' + esc(m.proveedor) : ''} ${m.fecha ? '· plano del ' + fFecha(m.fecha) : ''} ${m.autor ? '· ' + esc(m.autor) : ''}</p></div>
      <div class="acciones">${padre ? `<a class="btn" href="#/comparar/${encodeURIComponent(padre.id)}/${encodeURIComponent(m.id)}">⚖️ Comparar con la anterior</a>` : ''}${esAdmin() ? '<button class="btn" id="btnEditar">✏️ Editar</button><button class="btn" id="btnBorrar" title="Eliminar">🗑️</button>' : ''}</div></div>
    <div class="card" id="mKpi">${procesando('Calculando el ladrillo cocido…')}</div>
    <div class="seg tabs" id="tabs" style="margin-top:16px">${tabs.map(([k, n]) => `<button data-t="${k}" class="${k === pest ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="pane" data-p="3d" ${pest === '3d' ? '' : 'hidden'}>${cardHtml('🧱 Ladrillo cocido en 3D', 'Arrastrá para girarlo · rueda para acercar', toolbarVisor() + '<div class="visor" id="visor"></div>')}</div>
    <div class="pane" data-p="plano" ${pest === 'plano' ? '' : 'hidden'}><div class="card"><div class="card-h"><div class="t"><h3>📐 Plano del ladrillo cocido</h3><span class="sub">Vista frontal, superior y lateral con medidas en mm · los números marcan las observaciones de la revisión</span></div><div class="acciones" style="margin:0"><button class="btn" id="bSvg">⬇️ SVG</button><button class="btn" id="bImp">🖨️ Imprimir / PDF</button><button class="btn" id="btnDxfC">📐 DXF cocido</button><button class="btn" id="btnDxfV">📐 DXF molde</button></div></div><div id="hoja" class="hoja-wrap">${procesando('Dibujando…')}</div></div></div>
    <div class="pane" data-p="revision" ${pest === 'revision' ? '' : 'hidden'}><div class="card"><div class="card-h"><div class="t"><h3>🩺 Revisión técnica del molde</h3><span class="sub">Reglas configurables por el administrador · los números se ubican en el plano</span></div></div><div id="rev">${procesando('Revisando…')}</div><div id="revPlano" class="hoja-wrap" style="margin-top:14px"></div></div></div>
    <div class="pane" data-p="medidas" ${pest === 'medidas' ? '' : 'hidden'}><div id="detalle"></div></div>
    <div class="pane" data-p="versiones" ${pest === 'versiones' ? '' : 'hidden'}><div class="grid g2">
      ${cardHtml('🔗 Versiones de este molde', '', `<div class="timeline">${tl.map(x => `<a href="#/molde/${encodeURIComponent(x.id)}" class="${x.id === m.id ? 'yo' : ''}"><span class="nodo"></span><span class="info"><b>${esc(etiquetaMolde(x))}</b><small>${estadoDe(x.estado).e} ${esc(x.estado || '')} · ${fmt(num(x.huecos))} huecos · ${fmt(num(x.vacio), 1)} %</small></span></a>`).join('')}</div>`)}
      ${cardHtml('☁️ Archivos en Drive', modoLocal() ? 'En modo local no se suben archivos' : (m.animacionUrl ? '' : 'Todavía sin animación'), `<div class="acciones" style="margin-top:0">${archivos}${modoLocal() ? '' : `<button class="btn ${m.animacionUrl ? '' : 'pri'}" id="btnAnim">🎬 ${m.animacionUrl ? 'Volver a grabar animación' : 'Grabar animación y subir a Drive'}</button>`}</div>${m.notas ? `<p style="white-space:pre-wrap;margin-top:12px">📝 ${esc(m.notas)}</p>` : ''}`)}
    </div></div>
  </section>`;
  const tc = $('tabs');
  tc.querySelectorAll('button').forEach(b => { b.onclick = () => { ST.pestana = b.dataset.t; tc.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); moverPill(tc); app().querySelectorAll('.pane').forEach(p => { p.hidden = p.dataset.p !== b.dataset.t; }); }; });
  moverPill(tc);
  enlazarToolbar();
  if ($('btnEditar')) $('btnEditar').onclick = () => editarMolde(m);
  if ($('btnBorrar')) $('btnBorrar').onclick = () => borrarMolde(m);
  if ($('btnAnim')) $('btnAnim').onclick = () => grabarAnimacion(m);
  let geoV;
  try { geoV = await geometriaDe(m.id); } catch (err) { $('mKpi').innerHTML = `<div class="empty">⚠️ ${esc(err.message)}</div>`; return; }
  if (ST.vista !== 'molde' || ST.args[0] !== id) return;
  const mv = Geo.metricas(geoV);
  const C = cocidoDe(m, geoV);
  const mc = C.m;
  const rev = Revision.analizar(geoV, mv, C, C.p, t, umbrales(), { puentes: (m.metricas && m.metricas.puentes) || [] });
  $('badgeRev').innerHTML = badgeRev({ metricas: { revision: rev.resumen } });
  $('mKpi').innerHTML = `<div class="card-h"><div class="t"><h3>📐 El producto final</h3></div></div>${detCocido(mc, C.p)}`;
  $('rev').innerHTML = revisionLista(rev);
  const base = nombreArchivo(etiquetaMolde(m));
  const datos = { titulo: etiquetaMolde(m), tipo: tipoLabel(t), estado: m.estado || '', fecha: m.fecha ? fFecha(m.fecha) : '', peso: mc.peso, contr: `${fmt(C.p.contrH, 1)} / ${fmt(C.p.contrV, 1)} %`, planta: (CONF.PLANTA || 'LADRILLO COCIDO').toUpperCase(), marcas: rev.items, sx: 1 - C.p.contrH / 100, sy: 1 - C.p.contrV / 100 };
  const pintarHoja = img => { const svg = hojaDe(C.geo, mc, Object.assign({ img3d: img }, datos)); $('hoja').innerHTML = svg; $('revPlano').innerHTML = svg; return svg; };
  let svgHoja = pintarHoja(null);
  $('detalle').innerHTML = `<div class="grid g2">
      ${cardHtml('📐 Sección del ladrillo cocido', 'Medidas en mm · línea azul: contorno del molde', svgSeccion(C.geo, mc, { verde: { geo: geoV, ancho: mv.ancho, alto: mv.alto } }) + '<div class="ley"><span><i style="background:var(--c-ladrillo)"></i>Ladrillo cocido</span><span><i style="background:var(--c-verde)"></i>Molde</span></div>')}
      ${cardHtml('🕳️ Huecos', `${mv.nHuecos} huecos en ${mv.tipos.length} medidas`, tablaHuecos(mv, mc))}
    </div>${cardHtml('📋 Todas las medidas', 'Molde (verde) y ladrillo cocido', tablaMedidas(mv, mc, C.p), ' style="margin-top:16px"')}`;
  montarVisor($('visor'), C.geo, mc, geoV, mv, etiquetaMolde(m));
  setTimeout(() => { if (ST.visor && ST.vista === 'molde' && ST.args[0] === id) { const was = ST.pestana; svgHoja = pintarHoja(ST.visor.captura()); ST.pestana = was; } }, 1500);
  const notas = [`${tipoLabel(t)} - ${etiquetaMolde(m)}`, `Contraccion H ${C.p.contrH}% V ${C.p.contrV}% - largo ${C.p.largo} mm - densidad ${C.p.densidad}`, `Seccion ${mc.ancho.toFixed(2)} x ${mc.alto.toFixed(2)} mm - huecos ${mc.nHuecos} - vacio ${mc.vacio.toFixed(2)}% - peso ${mc.peso.toFixed(2)} kg`];
  $('btnDxfC').onclick = () => descargar(base + '_cocido.dxf', Geo.dxfR12(C.geo, 'LADRILLO COCIDO ' + notas[0], notas.slice(1)), 'application/dxf');
  $('btnDxfV').onclick = () => descargar(base + '_molde.dxf', Geo.dxfR12(geoV, 'MOLDE ' + notas[0], [`Seccion ${mv.ancho.toFixed(2)} x ${mv.alto.toFixed(2)} mm - huecos ${mv.nHuecos} - vacio ${mv.vacio.toFixed(2)}%`]), 'application/dxf');
  $('bSvg').onclick = () => descargar(base + '_plano_cocido.svg', svgHoja, 'image/svg+xml');
  $('bImp').onclick = () => abrirImpresion(svgHoja, etiquetaMolde(m));
}

function editarMolde(m) {
  const d = $('dlgEd');
  d.innerHTML = `<form method="dialog" id="fEd"><h3>✏️ Editar ${esc(etiquetaMolde(m))}</h3>${camposMeta(m, 'e')}<div class="acciones"><button class="btn" value="no" formnovalidate>Cancelar</button><button class="btn pri" value="si" id="eGuardar">💾 Guardar</button></div></form>`;
  enlazarMeta('e', m.id);
  $('fEd').onsubmit = async ev => {
    if (ev.submitter && ev.submitter.value === 'no') return;
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

function revisionCarga() {
  const C = ST.carga;
  const t = tiposCarga().find(x => x.id === C.tipoId) || {};
  C.rev = Revision.analizar(C.geoV, C.met, C.coc, C.p, t, umbrales(), { puentes: C.esc.puentes || [], desvioAlto: C.lect.tipo === 'pdf' && C.altoMm ? (C.met.alto - C.altoMm) / C.altoMm : 0 });
  return C.rev;
}

function pintarNuevo() {
  const C = ST.carga;
  if (ST.visor) { ST.visor.destruir(); ST.visor = null; }
  if (!puedeCargar()) { app().innerHTML = `<section class="vista"><div class="card"><div class="empty"><b>Solo el administrador puede cargar planos</b><a class="btn" href="#/ajustes">🔐 Entrar como administrador</a></div></div></section>`; return; }
  if (!C) {
    app().innerHTML = `<section class="vista">${bannerLocal()}<div class="hero"><div><div class="eyebrow">Nuevo plano</div><h1>¿Cómo sale el <span>ladrillo cocido</span>?</h1><p class="sub">Soltá el plano del molde: en segundos ves el ladrillo cocido en 3D, sus vistas y la revisión técnica del molde.</p></div></div><div class="card">${dropHtml('dropNuevo')}</div></section>`;
    enlazarDrop('dropNuevo');
    return;
  }
  const cab = `<div class="hero"><div><div class="eyebrow">Nuevo plano · ${esc(C.archivo.nombre)}</div><h1>Así sale el <span>ladrillo cocido</span></h1>`;
  if (C.estado === 'leyendo' || C.estado === 'detectando') {
    app().innerHTML = `<section class="vista">${cab}<p class="sub">Un momento…</p></div></div><div class="card">${procesando(C.estado === 'leyendo' ? 'Leyendo el plano…' : 'Buscando el marco y los dados del molde…')}</div></section>`;
    return;
  }
  if (C.estado === 'error') {
    app().innerHTML = `<section class="vista">${cab}</div></div><div class="alerta bad"><span class="e">⚠️</span><span>${esc(C.error)}</span></div><div class="card" style="margin-top:16px">${dropHtml('dropNuevo', true)}</div></section>`;
    enlazarDrop('dropNuevo');
    return;
  }
  if (!ST.tipos.length && !esAdmin()) {
    app().innerHTML = `<section class="vista">${cab}</div></div><div class="card"><div class="empty"><b>No hay tipos de ladrillo creados</b><span>El administrador tiene que crear el tipo (por ejemplo P12) antes de guardar planos.</span></div></div></section>`;
    return;
  }
  const t = tiposCarga().find(x => x.id === C.tipoId) || {};
  const rev = revisionCarga();
  app().innerHTML = `<section class="vista">${bannerLocal()}${cab}<p class="sub">${esc(tipoLabel(t) || 'Tipo nuevo')} · ${C.met.nHuecos} huecos detectados en el plano</p></div>
      <div class="acciones"><button class="btn" id="bOtro">📄 Otro plano</button></div></div>
    <div id="nAviso">${avisoEscala()}</div>
    <div class="grid g-21" style="margin-top:12px">
      ${cardHtml('🧱 Ladrillo cocido en 3D', 'Arrastrá para girarlo · rueda para acercar', toolbarVisor() + '<div class="visor" id="visor"></div>')}
      <div class="col">
        ${cardHtml('📐 El producto final', '', `<div id="nKpi">${detCocido(C.coc.m, C.p)}</div>`)}
        ${cardHtml('🩺 Revisión del plano', 'Antes de mandarlo al proveedor', `<div id="nRev">${revisionLista(rev)}</div>`, ' style="margin-top:16px"')}
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>📐 Plano y vistas del ladrillo cocido</h3><span class="sub">Los números marcan las observaciones de la revisión</span></div></div><div id="nHoja" class="hoja-wrap">${hojaDe(C.coc.geo, C.coc.m, datosHojaCarga())}</div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>💾 Guardar en el catálogo</h3><span class="sub">${modoLocal() ? 'Modo local: queda en este navegador' : 'Se suben a Drive el plano, la animación 3D y una imagen, en la carpeta del tipo'}</span></div></div>
      ${camposMeta(C.meta, 'n', true)}
      <div class="acciones"><button class="btn pri brillo" id="bGuardar">💾 Guardar plano y animación</button></div></div>
    <details class="card mas" style="margin-top:16px"><summary>🔍 Revisar la lectura del plano (huecos, escala, orientación y capas)</summary><div id="nRevision" style="margin-top:14px">${revisionHtml()}</div></details>
  </section>`;
  if ($('nTipo')) $('nTipo').value = C.tipoId;
  enlazarToolbar();
  enlazarRevision();
  let tmr = null, armado = false;
  enlazarMeta('n', null, () => {
    if (!armado) return;
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      const nuevoTipo = $('nTipo').value;
      C.meta = leerMeta('n');
      const cambio = nuevoTipo !== C.tipoId;
      C.tipoId = nuevoTipo;
      if (cambio || nuevoTipo === '__nuevo') escalaDesdeTipo();
      recalcularCarga();
      actualizarResultado(cambio || nuevoTipo === '__nuevo');
    }, 350);
  });
  armado = true;
  $('bOtro').onclick = () => { ST.carga = null; pintarNuevo(); };
  $('bGuardar').onclick = guardarNuevo;
  montarVisor($('visor'), C.coc.geo, C.coc.m, C.geoV, C.met, tituloCarga());
}

function datosHojaCarga() {
  const C = ST.carga;
  const t = tiposCarga().find(x => x.id === C.tipoId) || {};
  return { titulo: tituloCarga(), tipo: tipoLabel(t), estado: 'Borrador', fecha: fFecha(hoyLocal()), peso: C.coc.m.peso, contr: `${fmt(C.p.contrH, 1)} / ${fmt(C.p.contrV, 1)} %`, planta: (CONF.PLANTA || 'LADRILLO COCIDO').toUpperCase(), marcas: C.rev ? C.rev.items : [], sx: 1 - C.p.contrH / 100, sy: 1 - C.p.contrV / 100 };
}

const actualizarResultadoBase = actualizarResultado;
actualizarResultado = function (conRevision) {
  const C = ST.carga;
  if (!C || C.estado !== 'listo' || !$('nKpi')) return;
  actualizarResultadoBase(conRevision);
  const rev = revisionCarga();
  if ($('nRev')) $('nRev').innerHTML = revisionLista(rev);
  if ($('nHoja')) $('nHoja').innerHTML = hojaDe(C.coc.geo, C.coc.m, datosHojaCarga());
};

async function guardarNuevo() {
  const C = ST.carga;
  const btn = $('bGuardar');
  const txt0 = btn.innerHTML;
  const paso = t => { btn.innerHTML = t; };
  btn.disabled = true;
  loader(true);
  try {
    const meta = leerMeta('n');
    if (!meta.codigo) throw new Error('Poné un nombre o código al molde');
    const dimsMolde = { anchoMolde: +C.met.ancho.toFixed(2), altoMolde: +C.met.alto.toFixed(2) };
    if (meta.tipoId === '__nuevo') {
      const t = leerTipo('nNT');
      if (!t.nombre) throw new Error('Completá el nombre del tipo de ladrillo');
      if (!num(t.anchoMolde)) Object.assign(t, dimsMolde);
      paso('🏷️ Creando el tipo…');
      meta.tipoId = (await API.enviar({ accion: 'guardarTipo', tipo: t })).id;
    } else {
      const t = tipoDe(meta.tipoId);
      if (t && !num(t.anchoMolde) && esAdmin()) { try { await API.enviar({ accion: 'guardarTipo', tipo: Object.assign({ id: t.id, nombre: t.nombre }, dimsMolde) }); } catch (e) {} }
    }
    const geo = { marco: C.geoV.marco.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]), huecos: C.geoV.huecos.map(h => h.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])) };
    const prep = prepararMolde(meta, geo);
    prep.molde.archivo = C.archivo.nombre;
    const rev = C.rev || revisionCarga();
    prep.molde.metricas.revision = rev.resumen;
    prep.molde.metricas.puentes = (C.esc.puentes || []).filter(s => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > 0.05).slice(0, 40).map(s => s.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]));
    let archivos = [];
    if (!modoLocal()) {
      const base = nombreArchivo((meta.codigo || 'molde') + (meta.version ? '_' + meta.version : ''));
      paso('🎬 Grabando la animación 3D…');
      if (ST.visor) ST.visor.rotular(meta.codigo + (meta.version ? ' · ' + meta.version : ''));
      archivos = await grabarArchivos(base, p => paso(`🎬 Grabando la animación 3D… ${p} %`));
      if (C.archivo.size < 25e6) archivos.unshift({ rol: 'plano', nombre: C.archivo.nombre, mime: C.archivo.mime, base64: aBase64(C.buf) });
      paso('☁️ Subiendo a Drive…');
    }
    const r = await API.enviar({ accion: 'guardarMolde', molde: prep.molde, geo: prep.geo, archivos });
    ST.geo[r.id] = prep.geo;
    toast(r.msg || 'Guardado', 'ok');
    ST.carga = null;
    await cargar(true);
    location.hash = '#/molde/' + encodeURIComponent(r.id);
  } catch (err) {
    toast(err.message, 'bad');
    btn.disabled = false;
    btn.innerHTML = txt0;
  } finally { loader(false); }
}

async function vistaAjustes() {
  const c = conexion();
  const adm = esAdmin();
  const ses = sesionAdmin();
  const u = umbrales();
  const campoU = (k, l, d) => `<label class="f">${l}<input id="u_${k}" type="number" step="${d}" value="${esc(u[k])}"></label>`;
  app().innerHTML = `<section class="vista">
    <div class="hero"><div><div class="eyebrow">Configuración</div><h1>Ajustes y <span>administración</span></h1><p class="sub">${modoLocal() ? 'Modo local: los datos quedan solo en este navegador.' : 'Conectado a la planilla por Apps Script.'}</p></div></div>
    ${modoLocal() ? '' : cardHtml('🔐 Administrador', adm ? `Sesión activa hasta las ${new Date(ses.exp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Con la contraseña de administrador podés crear tipos, editar parámetros y reglas de revisión, editar y borrar moldes', adm ? '<div class="acciones" style="margin-top:0"><button class="btn" id="bSalir">🚪 Cerrar sesión</button></div>' : `<form class="form" id="fLogin" autocomplete="off"><label class="f">Contraseña<input id="lClave" type="password" required></label><div class="acciones" style="margin-top:0;align-self:end"><button class="btn pri" type="submit">🔓 Entrar</button></div></form>${ST.adminConfigurado === false ? '<p class="sub" style="margin-top:8px">⚠️ Todavía no hay contraseña: en Apps Script › Configuración del proyecto › Propiedades del script, agregá <b>ADMIN_PASS</b>.</p>' : ''}`)}
    ${adm ? `
    <div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>🗂️ Familias de ladrillos</h3><span class="sub">Lo primero que se ve en el catálogo</span></div><div class="acciones" style="margin:0"><button class="btn" id="bAddFam">＋ Familia</button><button class="btn pri" id="bGuardarFam">💾 Guardar</button></div></div>
      <div id="lFam">${familiasCfg().map((f, i) => filaFam(f, i)).join('')}</div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>🏷️ Tipos de ladrillo</h3><span class="sub">H8, H12, P12… con medida del molde, contracciones, objetivos y límites para la revisión</span></div><div class="acciones" style="margin:0"><button class="btn pri" id="bNuevoT">＋ Nuevo tipo</button></div></div>
      <div id="nuevoT"></div>
      ${familiasCfg().concat([{ id: '__otros', nombre: 'Otros', icono: '📦' }]).map(f => { const ts = tiposDeFamilia(f.id); return ts.length ? `<h4 class="fam-sub">${esc(f.icono + ' ' + f.nombre)}</h4>` + ts.map(t => { const i = ST.tipos.indexOf(t); return `<details class="mas tipo-ed"><summary><b>${esc(t.codigo || '—')}</b> ${esc(t.nombre)} · ${moldesDeTipo(t.id).length} variante(s) · molde ${fmt(num(t.anchoMolde), 1)} × ${fmt(num(t.altoMolde), 1)} mm</summary><div style="margin-top:10px">${camposTipo(t, 't' + i)}<div class="acciones"><button class="btn" data-borrar="${esc(t.id)}">🗑️ Borrar</button><button class="btn pri" data-guardar="${i}">💾 Guardar</button></div></div></details>`; }).join('') : ''; }).join('') || '<div class="empty">Todavía no hay tipos.</div>'}
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><div class="t"><h3>🩺 Reglas de la revisión técnica</h3><span class="sub">Valores del ladrillo cocido salvo que se indique</span></div><div class="acciones" style="margin:0"><button class="btn pri" id="bGuardarU">💾 Guardar</button></div></div>
      <div class="form">${campoU('paredMin', 'Pared exterior mínima (mm)', '0.1')}${campoU('tabiqueMin', 'Tabique mínimo (mm)', '0.1')}${campoU('huecoMin', 'Lado mínimo de hueco (mm)', '0.5')}${campoU('radioMin', 'Radio mínimo de esquina del dado (mm)', '0.1')}${campoU('tolSimetria', 'Tolerancia de simetría (mm)', '0.05')}${campoU('tolUniforme', 'Diferencia admitida entre tabiques (mm)', '0.05')}${campoU('tolBalance', 'Diferencia admitida entre paredes (mm)', '0.05')}${campoU('tolMedida', 'Tolerancia de medida cocida (± mm)', '0.1')}${campoU('tolEscala', 'Tolerancia de proporción del plano (%)', '0.1')}
      <label class="f full chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="uSoloAdmin" ${ST.config && ST.config.soloAdminCarga ? 'checked' : ''}> Solo el administrador puede cargar planos nuevos</label></div></div>
    ${cardHtml('🧪 Ejemplos y respaldo', '', `<div class="acciones" style="margin-top:0"><button class="btn" id="bSeed2">📥 Importar los 4 moldes de ejemplo (P12)</button><button class="btn" id="bBackup">⬇️ Descargar respaldo</button></div>`, ' style="margin-top:16px"')}` : ''}
    ${cardHtml('🔌 Conexión', 'URL /exec de Apps Script (se guarda en este navegador)', `<div id="infoLinks"></div><form class="form" id="formCx" autocomplete="off"><label class="f w2">URL /exec<input id="cUrl" type="url" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/.../exec"></label><label class="f">Clave de acceso<input id="cKey" type="password" value="${esc(c.key || '')}" placeholder="Opcional"></label><label class="f">👤 Tu nombre<input id="cUsu" maxlength="60" value="${esc(c.usuario || '')}"></label>
      <div class="full acciones" style="margin-top:0"><button class="btn" type="button" id="bLocal">💾 Modo local</button><button class="btn" type="button" id="bCache">🧹 Borrar caché</button><button class="btn pri" type="submit">🔌 Guardar y probar</button></div></form>`, ' style="margin-top:16px"')}
  </section>`;
  if ($('fLogin')) $('fLogin').onsubmit = async e => {
    e.preventDefault();
    loader(true);
    try { toast((await API.login($('lClave').value)).msg, 'ok'); pintarNav(); vistaAjustes(); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
  };
  if ($('bSalir')) $('bSalir').onclick = () => { API.salir(); toast('Sesión cerrada', 'ok'); pintarNav(); vistaAjustes(); };
  if (adm) {
    $('bAddFam').onclick = () => { const n = $('lFam').children.length; $('lFam').insertAdjacentHTML('beforeend', filaFam({ id: '', nombre: '', icono: '🧱', descripcion: '' }, n)); enlazarFam(); };
    enlazarFam();
    $('bGuardarFam').onclick = async () => {
      const fams = [...$('lFam').querySelectorAll('.fam-fila')].map(r => ({ id: r.querySelector('[data-k=id]').value.trim() || norm(r.querySelector('[data-k=nombre]').value).replace(/[^a-z0-9]+/g, '-'), nombre: r.querySelector('[data-k=nombre]').value.trim(), icono: r.querySelector('[data-k=icono]').value.trim() || '🧱', descripcion: r.querySelector('[data-k=descripcion]').value.trim() })).filter(f => f.nombre);
      await guardarCfg({ familias: fams });
    };
    $('bGuardarU').onclick = async () => {
      const um = {};
      Object.keys(Revision.DEF).forEach(k => { const v = num($('u_' + k).value); if (v !== null) um[k] = v; });
      await guardarCfg({ umbrales: um, soloAdminCarga: $('uSoloAdmin').checked });
    };
    $('bNuevoT').onclick = () => {
      $('nuevoT').innerHTML = `<div style="margin:10px 0 16px">${camposTipo(ST.tipos.length ? {} : PRESET_TIPO, 'tn')}<div class="acciones"><button class="btn pri" id="bGuardarTN">💾 Crear tipo</button></div></div>`;
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
    $('bSeed2').onclick = importarSeed;
    $('bBackup').onclick = respaldo;
  }
  $('formCx').onsubmit = async e => {
    e.preventDefault();
    LS.set('mt_url', $('cUrl').value.trim()); LS.set('mt_key', $('cKey').value.trim()); LS.set('mt_usuario', $('cUsu').value.trim());
    ST.geo = {};
    await cargar(true);
    if (ST.cargado) toast(modoLocal() ? 'Modo local' : 'Conexión correcta', 'ok');
  };
  $('cUsu').onchange = e => LS.set('mt_usuario', e.target.value.trim());
  $('bLocal').onclick = async () => { LS.set('mt_url', ''); LS.set('mt_key', ''); ST.geo = {}; await cargar(true); toast('Modo local activado', 'ok'); };
  $('bCache').onclick = () => { Object.keys(localStorage).filter(k => k.startsWith('mt_geo_')).forEach(k => LS.del(k)); ST.geo = {}; toast('Caché borrada', 'ok'); };
  if (!modoLocal()) {
    try {
      const i = await API.info();
      if (i && $('infoLinks')) $('infoLinks').innerHTML = `<div class="acciones" style="margin:0 0 12px"><a class="btn" href="${esc(i.planillaUrl)}" target="_blank" rel="noopener">📊 Abrir la planilla</a><a class="btn" href="${esc(i.carpetaUrl)}" target="_blank" rel="noopener">📁 Abrir la carpeta de planos</a></div>`;
    } catch (e) {}
  }
}

function filaFam(f, i) {
  return `<div class="fam-fila"><input data-k="icono" value="${esc(f.icono || '')}" maxlength="4" aria-label="Ícono" style="width:56px;text-align:center"><input data-k="nombre" value="${esc(f.nombre || '')}" placeholder="Nombre" maxlength="30"><input data-k="descripcion" value="${esc(f.descripcion || '')}" placeholder="Descripción" maxlength="80" style="flex:2"><input data-k="id" type="hidden" value="${esc(f.id || '')}"><button class="btn ghost icon" data-quitar title="Quitar familia">✖</button></div>`;
}

function enlazarFam() { $('lFam').querySelectorAll('[data-quitar]').forEach(b => { b.onclick = () => b.closest('.fam-fila').remove(); }); }

async function guardarCfg(cfg) {
  loader(true);
  try { const r = await API.enviar({ accion: 'guardarConfig', config: cfg }); toast(r.msg, 'ok'); await cargar(true); } catch (err) { toast(err.message, 'bad'); } finally { loader(false); }
}

function aplicar(d) {
  ST.config = Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFECTO)), d.config || {});
  ST.adminConfigurado = d.adminConfigurado;
  const nums = ['contrH', 'contrV', 'contrL', 'largo', 'densidad', 'anchoMolde', 'altoMolde', 'anchoObj', 'altoObj', 'vacioMin', 'vacioMax', 'pesoMax'];
  ST.tipos = (d.tipos || []).map(t => { const o = Object.assign({}, t); nums.forEach(k => { o[k] = num(t[k]); }); return o; });
  ST.moldes = (d.moldes || []).map(m => Object.assign({}, m, { metricas: typeof m.metricas === 'string' ? (() => { try { return JSON.parse(m.metricas); } catch (e) { return null; } })() : m.metricas }));
  ST.cargado = true;
  const enCarga = ST.vista === 'nuevo' && ST.carga && ST.carga.lect;
  if (!enCarga) render();
}

function leerRuta() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const partes = h.split('/').filter(Boolean).map(decodeURIComponent);
  let v = partes[0] || 'catalogo';
  if (v === 'cargar') v = 'nuevo';
  if (v === 'tipos') v = 'ajustes';
  return { v: ['catalogo', 'familia', 'tipo', 'molde', 'nuevo', 'comparar', 'ajustes'].includes(v) ? v : 'catalogo', args: partes.slice(1) };
}

function render() {
  const r = leerRuta();
  if (!(r.v === 'molde' && ST.vista === 'molde' && ST.args[0] === r.args[0])) ST.pestana = '3d';
  ST.vista = r.v; ST.args = r.args;
  pintarNav();
  if (ST.visor) { ST.visor.destruir(); ST.visor = null; }
  if (!ST.cargado && !['ajustes', 'nuevo'].includes(ST.vista)) { app().innerHTML = `<section class="vista"><div class="card">${procesando('Cargando catálogo…')}</div></section>`; return; }
  if (ST.vista === 'catalogo') vistaCatalogo();
  else if (ST.vista === 'familia') vistaFamilia(ST.args[0]);
  else if (ST.vista === 'tipo') vistaTipo(ST.args[0]);
  else if (ST.vista === 'molde') vistaMolde(ST.args[0]);
  else if (ST.vista === 'nuevo') pintarNuevo();
  else if (ST.vista === 'comparar') vistaComparar(ST.args[0], ST.args[1]);
  else vistaAjustes();
}

document.addEventListener('DOMContentLoaded', init);
