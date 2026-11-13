'use strict';

const CONF = Object.assign({ SCRIPT_URL: '', API_KEY: '', PLANTA: '' }, window.APP_CONFIG || {});

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

const conexion = () => ({ url: LS.get('mt_url', '') || CONF.SCRIPT_URL, key: LS.get('mt_key', '') || CONF.API_KEY, usuario: LS.get('mt_usuario', '') });
const modoLocal = () => !conexion().url;

const ESTADOS = [
  { id: 'Vigente', e: '🟢', cls: 't-ok' },
  { id: 'Propuesta', e: '🟠', cls: 't-warn' },
  { id: 'En fabricación', e: '🔵', cls: 't-info' },
  { id: 'Histórico', e: '⚪', cls: 't-mut' }
];
const estadoDe = s => ESTADOS.find(x => x.id === s) || ESTADOS[3];

const nf = {};
function fmt(v, dec = 0) {
  if (v === null || v === undefined || v === '' || !isFinite(v)) return '—';
  const k = 'd' + dec;
  if (!nf[k]) nf[k] = new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return nf[k].format(v);
}
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const fFecha = s => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) + '/' + String(s).slice(0, 4) : '—';
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;

async function remotoGet(params) {
  const { url, key } = conexion();
  const q = Object.entries(Object.assign({ key: key || '', t: Date.now() }, params)).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + q);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error al leer los datos');
  return j.data;
}

async function remotoPost(payload) {
  const { url, key, usuario } = conexion();
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ key, usuario }, payload)) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
  return j.data;
}

const Local = {
  leer() { return LS.get('mt_local', { tipos: [], moldes: [], geos: {} }); },
  guardar(d) { if (!LS.set('mt_local', d)) throw new Error('No hay espacio en el navegador para guardar más moldes. Conectá la planilla en Ajustes.'); },
  nuevoId(lista, pref, ancho) {
    let max = 0;
    lista.forEach(x => { const m = String(x.id).match(new RegExp('^' + pref + '-(\\d+)$')); if (m) max = Math.max(max, +m[1]); });
    return pref + '-' + String(max + 1).padStart(ancho, '0');
  },
  catalogo() { const d = this.leer(); return { tipos: d.tipos, moldes: d.moldes, servidor: new Date().toISOString() }; },
  geometria(id) { const d = this.leer(); if (!d.geos[id]) throw new Error('No hay geometría guardada para ' + id); return { id, geo: d.geos[id] }; },
  guardarTipo(d, t) {
    if (!t.nombre) throw new Error('El tipo necesita un nombre');
    const i = d.tipos.findIndex(x => x.id === t.id);
    const id = i >= 0 ? t.id : (t.id || this.nuevoId(d.tipos, 'T', 3));
    const o = Object.assign({}, i >= 0 ? d.tipos[i] : {}, t, { id, actualizado: new Date().toISOString() });
    if (i >= 0) d.tipos[i] = o; else d.tipos.push(o);
    return { id, msg: 'Tipo guardado' };
  },
  guardarMolde(d, mo, geo) {
    if (!mo.tipoId) throw new Error('Elegí el tipo de ladrillo');
    const i = d.moldes.findIndex(x => x.id === mo.id);
    const id = i >= 0 ? mo.id : (mo.id || this.nuevoId(d.moldes, 'M', 4));
    if (mo.padreId && mo.padreId === id) throw new Error('Un molde no puede ser su propia versión anterior');
    const ahora = new Date().toISOString();
    const o = Object.assign({}, i >= 0 ? d.moldes[i] : { creado: ahora }, mo, { id, actualizado: ahora });
    if (i >= 0) d.moldes[i] = o; else d.moldes.push(o);
    if (geo) d.geos[id] = geo;
    return { id, msg: i >= 0 ? 'Molde actualizado' : 'Molde guardado como ' + id };
  },
  enviar(p) {
    const d = this.leer();
    let r;
    if (p.accion === 'guardarTipo') r = this.guardarTipo(d, p.tipo || {});
    else if (p.accion === 'borrarTipo') {
      const n = d.moldes.filter(m => m.tipoId === p.id).length;
      if (n) throw new Error('No se puede borrar: hay ' + n + ' molde(s) de este tipo');
      d.tipos = d.tipos.filter(t => t.id !== p.id);
      r = { msg: 'Tipo eliminado' };
    } else if (p.accion === 'guardarMolde') {
      const mo = Object.assign({}, p.molde);
      if (p.archivoDatos) mo.archivo = p.archivoDatos.nombre;
      r = this.guardarMolde(d, mo, p.geo);
    } else if (p.accion === 'borrarMolde') {
      const este = d.moldes.find(m => m.id === p.id);
      if (!este) throw new Error('No existe el molde ' + p.id);
      d.moldes.forEach(m => { if (m.padreId === p.id) m.padreId = este.padreId || ''; });
      d.moldes = d.moldes.filter(m => m.id !== p.id);
      delete d.geos[p.id];
      r = { msg: 'Molde eliminado' };
    } else if (p.accion === 'importar') {
      const mT = {}, mM = {};
      (p.tipos || []).forEach(t => { mT[t.id] = this.guardarTipo(d, Object.assign({}, t, { id: '' })).id; });
      (p.moldes || []).forEach(m => {
        const mo = Object.assign({}, m.molde, { id: '', tipoId: mT[m.molde.tipoId] || m.molde.tipoId, padreId: m.molde.padreId ? (mM[m.molde.padreId] || '') : '' });
        mM[m.molde.id] = this.guardarMolde(d, mo, m.geo).id;
      });
      r = { tipos: mT, moldes: mM, msg: 'Importados ' + (p.tipos || []).length + ' tipo(s) y ' + (p.moldes || []).length + ' molde(s)' };
    } else throw new Error('Acción desconocida');
    this.guardar(d);
    return r;
  }
};

const API = {
  async catalogo() { return modoLocal() ? Local.catalogo() : remotoGet({ accion: 'catalogo' }); },
  async geometria(id) {
    const cache = LS.get('mt_geo_' + id, null);
    if (cache && !modoLocal()) return cache;
    const r = modoLocal() ? Local.geometria(id) : await remotoGet({ accion: 'geometria', id });
    if (!modoLocal()) LS.set('mt_geo_' + id, r.geo);
    return r.geo;
  },
  async enviar(p) {
    if (modoLocal()) return Local.enviar(p);
    const r = await remotoPost(p);
    if (p.accion === 'guardarMolde' && p.geo && r.id) LS.set('mt_geo_' + r.id, p.geo);
    if (p.accion === 'borrarMolde') LS.del('mt_geo_' + p.id);
    return r;
  }
};

function paramsDe(molde, tipos) {
  const t = tipos.find(x => x.id === molde.tipoId) || {};
  const pick = k => { const v = num(molde[k]); return v !== null ? v : num(t[k]); };
  const p = { contrH: pick('contrH'), contrV: pick('contrV'), contrL: pick('contrL'), densidad: pick('densidad'), largo: pick('largo') };
  p.contrH = p.contrH === null ? 0 : p.contrH;
  p.contrV = p.contrV === null ? 0 : p.contrV;
  p.contrL = p.contrL === null ? p.contrH : p.contrL;
  p.densidad = p.densidad === null ? 1.8 : p.densidad;
  p.largo = p.largo === null ? 0 : p.largo;
  p.propios = ['contrH', 'contrV', 'contrL', 'densidad', 'largo'].filter(k => num(molde[k]) !== null && num(molde[k]) !== num(t[k]));
  return p;
}

function resumenCocido(molde, tipos) {
  const p = paramsDe(molde, tipos);
  const sx = 1 - p.contrH / 100, sy = 1 - p.contrV / 100;
  const m = molde.metricas || {};
  const llenoV = num(molde.llenoV) !== null ? num(molde.llenoV) : m.aLleno;
  const lleno = llenoV * sx * sy;
  const vol = lleno * p.largo / 1000;
  return {
    p, ancho: num(molde.anchoV) * sx, alto: num(molde.altoV) * sy, largo: p.largo, lleno, vacio: num(molde.vacio), huecos: num(molde.huecos),
    volumen: vol, peso: vol * p.densidad / 1000, corte: p.largo / (1 - p.contrL / 100)
  };
}

function prepararMolde(meta, geoV) {
  const m = Geo.metricas(geoV);
  const met = Object.assign({}, m);
  delete met.letra;
  const mini = Geo.simplificar(geoV, 0.35);
  const H = m.alto;
  return {
    molde: Object.assign({}, meta, {
      anchoV: +m.ancho.toFixed(3), altoV: +m.alto.toFixed(3), huecos: m.nHuecos, vacio: +m.vacio.toFixed(3), llenoV: +m.aLleno.toFixed(1),
      metricas: met, miniatura: Geo.svgPath(mini, H)
    }),
    geo: geoV,
    metricas: m
  };
}

function cadena(moldes, id) {
  const por = new Map(moldes.map(m => [m.id, m]));
  const arriba = [];
  let cur = por.get(id), guard = 0;
  while (cur && cur.padreId && por.has(cur.padreId) && guard++ < 50) { cur = por.get(cur.padreId); arriba.unshift(cur); }
  const abajo = [];
  const rec = (pid, d) => { moldes.filter(m => m.padreId === pid).forEach(h => { abajo.push({ m: h, d }); if (d < 50) rec(h.id, d + 1); }); };
  rec(id, 1);
  return { arriba, abajo };
}

function raiz(moldes, m) {
  const por = new Map(moldes.map(x => [x.id, x]));
  let cur = m, guard = 0;
  while (cur.padreId && por.has(cur.padreId) && guard++ < 50) cur = por.get(cur.padreId);
  return cur;
}
