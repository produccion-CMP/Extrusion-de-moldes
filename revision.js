'use strict';

const Revision = (() => {
  const DEF = { paredMin: 6.0, tabiqueMin: 5.5, huecoMin: 10, radioMin: 1.5, tolSimetria: 0.3, tolUniforme: 0.25, tolBalance: 0.3, tolMedida: 2.0, tolEscala: 0.5 };

  function minPts(A, B) {
    let m = { d: Infinity, p: null };
    const prueba = (P, Q) => {
      for (const p of P) for (let j = 0, k = Q.length - 1; j < Q.length; k = j++) {
        const d = Geo.dSegPt(p[0], p[1], Q[k][0], Q[k][1], Q[j][0], Q[j][1]);
        if (d < m.d) m = { d, p };
      }
    };
    prueba(A, B); prueba(B, A);
    return m;
  }

  function centro(h) { const b = Geo.bbox(h); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }

  function analizar(geoV, mv, coc, p, tipo, umbral, extra) {
    const u = Object.assign({}, DEF, umbral || {});
    const t = tipo || {};
    const ex = extra || {};
    const sx = 1 - p.contrH / 100, sy = 1 - p.contrV / 100;
    const mc = coc.m;
    const items = [];
    const add = (nivel, titulo, detalle, sugerencia, pos) => items.push({ nivel, titulo, detalle, sugerencia, pos: pos || null });
    const f2 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(2).replace('.', ',');

    const puentes = (ex.puentes || []).filter(s => {
      const m = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
      const L = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
      if (L < 0.05) return false;
      const cerca = poly => { for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) if (Geo.dSegPt(m[0], m[1], poly[k][0], poly[k][1], poly[j][0], poly[j][1]) < 0.6) return true; return false; };
      return cerca(geoV.marco) || geoV.huecos.some(cerca);
    });
    if (puentes.length) {
      const L = puentes.map(s => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]));
      const orden = L.map((v, i) => i).sort((a, b) => L[b] - L[a]);
      const mid = s => [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
      const color = k => { const m = /#([0-9a-f]{6})/i.exec(k || ''); const n = { 'ff0000': 'rojo', '00ff00': 'verde', '0000ff': 'azul', 'ffff00': 'amarillo', '00ffff': 'cian', 'ff00ff': 'magenta', 'ffffff': 'blanco', '000000': 'negro' }; return m ? (n[m[1].toLowerCase()] || '#' + m[1]) : (k || 'otra'); };
      const otras = orden.filter(i => puentes[i][2]), abiertas = orden.filter(i => !puentes[i][2]);
      abiertas.slice(0, 6).forEach((i, k) => {
        const m = mid(puentes[i]);
        const resto = k === 0 && abiertas.length > 1 ? ` Hay ${abiertas.length} aberturas en total; se marcan las ${Math.min(6, abiertas.length)} mayores.` : '';
        add(L[i] > 0.5 ? 'error' : 'aviso', `Contorno abierto (${f2(L[i])} mm)`, `El contorno no cierra en X ${f2(m[0])} · Y ${f2(m[1])} mm. La app lo cerró para calcular, pero el plano que recibe el proveedor queda abierto.${resto}`, 'En AutoCAD uní las líneas (JOIN o PEDIT › Unir) y verificá que el marco y cada dado sean polilíneas cerradas.', m);
      });
      otras.slice(0, 6).forEach((i, k) => {
        const m = mid(puentes[i]);
        const resto = k === 0 && otras.length > 1 ? ` Pasa en ${otras.length} lugares.` : '';
        add('aviso', `Tramo del contorno en otra capa (${color(puentes[i][2])})`, `En X ${f2(m[0])} · Y ${f2(m[1])} mm un tramo de ${f2(L[i])} mm del contorno está dibujado con otro color/capa que el resto del molde.${resto}`, 'Pasá ese tramo a la capa del molde (PROPIEDADES › Capa) para que el contorno sea continuo y no se pierda al filtrar capas.', m);
      });
    }

    if (ex.desvioAlto && Math.abs(ex.desvioAlto) * 100 > u.tolEscala) add('aviso', 'Proporciones distintas a la medida del tipo', `Con el ancho del tipo, el alto da ${f2(mv.alto)} mm (${(ex.desvioAlto * 100).toFixed(2)} %).`, 'Revisá que el tipo elegido sea el correcto o corregí la medida del molde.');

    let pm = { d: Infinity, p: null };
    geoV.huecos.forEach(h => { const m = minPts(h, geoV.marco); if (m.d < pm.d) pm = m; });
    const paredC = mc.paredMin;
    if (paredC !== null && paredC < u.paredMin) add('error', 'Pared exterior demasiado fina', `La pared mínima del ladrillo cocido es ${f2(paredC)} mm (mínimo configurado ${f2(u.paredMin)} mm).`, `Separá los dados del marco ${f2((u.paredMin - paredC) / Math.min(sx, sy))} mm o reducí la profundidad del rayado.`, pm.p);
    else if (paredC !== null) add('ok', 'Pared exterior', `Mínima ${f2(paredC)} mm cocida (mínimo ${f2(u.paredMin)} mm).`);

    let tm = { d: Infinity, p: null };
    geoV.huecos.forEach((h, i) => geoV.huecos.forEach((g, j) => { if (j > i) { const m = minPts(h, g); if (m.d < tm.d) tm = m; } }));
    const tabC = mc.tabMin;
    if (tabC !== null && tabC < u.tabiqueMin) add('error', 'Tabique demasiado fino', `El tabique mínimo del cocido es ${f2(tabC)} mm (mínimo ${f2(u.tabiqueMin)} mm). Se quiebra en la extrusión o en el corte.`, `Ensanchá ese tabique ${f2((u.tabiqueMin - tabC) / Math.min(sx, sy))} mm en el molde achicando los dados vecinos.`, tm.p);
    else if (tabC !== null) add('ok', 'Tabiques', `Mínimo ${f2(tabC)} mm cocido (mínimo ${f2(u.tabiqueMin)} mm).`);

    if (paredC !== null && tabC !== null && paredC < tabC - 0.05) add('aviso', 'Pared más fina que los tabiques', `En la cresta del rayado la pared queda en ${f2(paredC)} mm y los tabiques en ${f2(tabC)} mm.`, 'Conviene que la pared exterior sea igual o más gruesa que los tabiques: bajá la profundidad del rayado o alejá los dados del marco.', pm.p);

    const uni = (grupos, nombre) => {
      const g = (grupos || []).filter(x => x.n >= 1);
      if (g.length < 2) return;
      const vals = g.map(x => x.v);
      const rango = Math.max(...vals) - Math.min(...vals);
      if (rango > u.tolUniforme) add('aviso', `${nombre} desparejos`, `Hay ${nombre.toLowerCase()} de ${g.map(x => f2(x.v) + ' mm (×' + x.n + ')').join(', ')} en el molde.`, 'Igualalos: el barro corre más rápido por las secciones anchas y aparecen tensiones, curvado y fisuras de secado.');
    };
    uni(mv.tabV, 'Tabiques verticales');
    uni(mv.tabH, 'Tabiques horizontales');

    const pw = mv.pared || {};
    if (pw.inf && pw.sup && Math.abs(pw.inf - pw.sup) > u.tolBalance) add('aviso', 'Paredes superior e inferior distintas', `Inferior ${f2(pw.inf)} mm · superior ${f2(pw.sup)} mm en el molde.`, 'Paredes desiguales hacen que el ladrillo salga curvado (banana). Igualalas o compensá con frenos en el molde.');
    if (pw.izq && pw.der && Math.abs(pw.izq - pw.der) > u.tolBalance) add('aviso', 'Paredes laterales distintas', `Izquierda ${f2(pw.izq)} mm · derecha ${f2(pw.der)} mm en el molde.`, 'Igualá las paredes laterales para que la columna salga recta.');

    const W = mv.ancho;
    const C = geoV.huecos.map(h => { const b = Geo.bbox(h); return { c: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], w: b.w, h: b.h }; });
    const sinPar = [];
    C.forEach((a, i) => {
      const ok = C.some(b => Math.abs(b.c[0] - (W - a.c[0])) <= u.tolSimetria && Math.abs(b.c[1] - a.c[1]) <= u.tolSimetria && Math.abs(b.w - a.w) <= u.tolSimetria && Math.abs(b.h - a.h) <= u.tolSimetria);
      if (!ok) sinPar.push(i);
    });
    if (sinPar.length) add('aviso', 'Distribución asimétrica', `${sinPar.length} hueco(s) no tienen su par espejado respecto del eje vertical (tolerancia ${f2(u.tolSimetria)} mm).`, 'Una distribución asimétrica desbalancea el flujo: el ladrillo tiende a curvarse hacia el lado con más material. Revisá la posición de esos dados.', C[sinPar[0]].c);
    else add('ok', 'Simetría', 'Los huecos son simétricos respecto del eje vertical.');

    const chicos = mc.tipos.filter(tp => Math.min(tp.w, tp.h) < u.huecoMin);
    if (chicos.length) add('aviso', 'Huecos muy chicos', chicos.map(tp => `${tp.letra}: ${f2(tp.w)} × ${f2(tp.h)} mm (×${tp.n})`).join(' · ') + ` en el cocido (mínimo ${f2(u.huecoMin)} mm).`, 'Los huecos muy chicos se tapan con facilidad y aceleran el desgaste de los dados.');

    const vivos = [];
    geoV.huecos.forEach((h, i) => {
      const b = Geo.bbox(h);
      const A = Geo.area(h);
      if (A / (b.w * b.h) < 0.9) return;
      const r = Math.sqrt(Math.max(0, b.w * b.h - A) / (4 - Math.PI));
      if (r < u.radioMin) vivos.push({ i, r });
    });
    if (vivos.length) add('aviso', 'Esquinas vivas en los dados', `${vivos.length} dado(s) con radio de esquina de ≈ ${f2(Math.min(...vivos.map(v => v.r)))} mm (mínimo ${f2(u.radioMin)} mm).`, 'Las esquinas vivas concentran tensiones y generan fisuras en los encuentros de tabiques. Usá radios de 2 mm o más.', C[vivos[0].i].c);

    const anchoObj = num0(t.anchoObj), altoObj = num0(t.altoObj);
    if (anchoObj) {
      const d = mc.ancho - anchoObj;
      if (Math.abs(d) > u.tolMedida) add('error', 'Ancho cocido fuera de medida', `Da ${f2(mc.ancho)} mm y el objetivo es ${f2(anchoObj)} ± ${f2(u.tolMedida)} mm.`, `Corregí el ancho del molde a ${f2(anchoObj / sx)} mm o revisá la contracción horizontal.`);
      else add('ok', 'Ancho cocido', `${f2(mc.ancho)} mm (objetivo ${f2(anchoObj)} mm).`);
    }
    if (altoObj) {
      const d = mc.alto - altoObj;
      if (Math.abs(d) > u.tolMedida) add('error', 'Alto cocido fuera de medida', `Da ${f2(mc.alto)} mm y el objetivo es ${f2(altoObj)} ± ${f2(u.tolMedida)} mm.`, `Corregí el alto del molde a ${f2(altoObj / sy)} mm o revisá la contracción vertical.`);
      else add('ok', 'Alto cocido', `${f2(mc.alto)} mm (objetivo ${f2(altoObj)} mm).`);
    }
    const vmin = num0(t.vacioMin), vmax = num0(t.vacioMax);
    if (vmin && mc.vacio < vmin) add('aviso', 'Pocos huecos', `${f2(mc.vacio)} % de huecos (mínimo del tipo ${f2(vmin)} %). Más peso y más consumo de arcilla y gas.`, 'Agrandá los dados o sumá huecos.');
    if (vmax && mc.vacio > vmax) add('error', 'Demasiados huecos', `${f2(mc.vacio)} % de huecos (máximo del tipo ${f2(vmax)} %).`, 'Reducí los dados: con tanto vacío baja la resistencia del ladrillo.');
    const pmx = num0(t.pesoMax);
    if (pmx && mc.peso > pmx) add('aviso', 'Peso por encima del máximo', `${f2(mc.peso)} kg (máximo del tipo ${f2(pmx)} kg).`, 'Aumentá el % de huecos o reducí paredes y tabiques que estén sobredimensionados.');

    const r = mv.rayado || {};
    if (!['inf', 'sup', 'izq', 'der'].some(k => r[k] && r[k].n)) add('info', 'Sin rayado', 'No se detectaron ondulaciones en las caras exteriores.', 'El rayado mejora la adherencia del revoque y del mortero.');

    const orden = { error: 0, aviso: 1, info: 2, ok: 3 };
    items.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    let n = 0;
    items.forEach(it => { if (it.pos && it.nivel !== 'ok') it.n = ++n; });
    const res = { error: items.filter(x => x.nivel === 'error').length, aviso: items.filter(x => x.nivel === 'aviso').length, info: items.filter(x => x.nivel === 'info').length };
    return { items, resumen: res };
  }

  function num0(v) { return (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v; }

  return { DEF, analizar };
})();
