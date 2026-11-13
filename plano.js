'use strict';

const Plano = (() => {
  const T = 2.6;
  const f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const f2 = v => v.toFixed(2).replace('.', ',');
  const xe = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function flecha(x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 1.8, w = 0.55;
    const p = (x, y, s) => { const bx = x - s * L * Math.cos(a), by = y - s * L * Math.sin(a); return `${x.toFixed(2)},${y.toFixed(2)} ${(bx - w * Math.sin(a)).toFixed(2)},${(by + w * Math.cos(a)).toFixed(2)} ${(bx + w * Math.sin(a)).toFixed(2)},${(by - w * Math.cos(a)).toFixed(2)}`; };
    return `<polygon class="fl" points="${p(x2, y2, 1)}"/><polygon class="fl" points="${p(x1, y1, -1)}"/>`;
  }

  function cotaH(x1, x2, yRef, y, txt, chico) {
    const tx = chico ? T * 0.8 : T;
    return `<g class="ct"><line x1="${x1}" y1="${yRef}" x2="${x1}" y2="${y + (y < yRef ? -1 : 1)}"/><line x1="${x2}" y1="${yRef}" x2="${x2}" y2="${y + (y < yRef ? -1 : 1)}"/><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>${flecha(x1, y, x2, y)}<text x="${((x1 + x2) / 2).toFixed(2)}" y="${(y - 0.8).toFixed(2)}" font-size="${tx}">${txt}</text></g>`;
  }

  function cotaV(y1, y2, xRef, x, txt, chico) {
    const tx = chico ? T * 0.8 : T;
    const xm = (x - 0.8).toFixed(2), ym = ((y1 + y2) / 2).toFixed(2);
    return `<g class="ct"><line x1="${xRef}" y1="${y1}" x2="${x + (x < xRef ? -1 : 1)}" y2="${y1}"/><line x1="${xRef}" y1="${y2}" x2="${x + (x < xRef ? -1 : 1)}" y2="${y2}"/><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>${flecha(x, y1, x, y2)}<text x="${xm}" y="${ym}" font-size="${tx}" transform="rotate(-90 ${xm} ${ym})">${txt}</text></g>`;
  }

  function cadena(vals, minSep) {
    const v = vals.slice().sort((a, b) => a - b);
    const out = [v[0]];
    for (const x of v.slice(1)) if (x - out[out.length - 1] > (minSep || 0.05)) out.push(x);
    return out;
  }

  function lineasCara(marco, eje, borde, lim, tol) {
    const vals = [];
    for (const [x, y] of marco) {
      const d = eje === 'x' ? Math.abs(y - borde) : Math.abs(x - borde);
      if (d <= lim) vals.push(eje === 'x' ? x : y);
    }
    return cadena(vals, tol || 0.35);
  }

  function hoja(o) {
    const g = o.geo, m = o.met, L = o.largo;
    const W = m.ancho, H = m.alto;
    const s = Math.min(250 / W, 222 / (H + L), 125 / L);
    const ox = 22, oy = 26;
    const fx = x => ox + x * s, fy = y => oy + (H - y) * s;
    const path = poly => poly.map((p, i) => (i ? 'L' : 'M') + fx(p[0]).toFixed(2) + ' ' + fy(p[1]).toFixed(2)).join('') + 'Z';
    let v = '';
    v += `<path class="sec" d="${path(g.marco)}${g.huecos.map(path).join('')}"/>`;
    v += `<line class="eje" x1="${fx(W / 2)}" y1="${oy - 5}" x2="${fx(W / 2)}" y2="${fy(0) + 5}"/><line class="eje" x1="${ox - 5}" y1="${fy(H / 2)}" x2="${fx(W) + 5}" y2="${fy(H / 2)}"/>`;
    const bbs = g.huecos.map(h => Geo.bbox(h));
    if (bbs.length) {
      const yTop = Math.max(...bbs.map(b => b.y1));
      const fila = bbs.filter(b => b.y1 > yTop - 1).sort((a, b) => a.x0 - b.x0);
      const xs = cadena([0, W].concat(...fila.map(b => [b.x0, b.x1])));
      for (let i = 0; i < xs.length - 1; i++) v += cotaH(fx(xs[i]), fx(xs[i + 1]), fy(H), fy(H) - 6, f2(xs[i + 1] - xs[i]), true);
      const xMin = Math.min(...bbs.map(b => b.x0));
      const col = bbs.filter(b => b.x0 < xMin + 1).sort((a, b) => a.y0 - b.y0);
      const ys = cadena([0, H].concat(...col.map(b => [b.y0, b.y1])));
      for (let i = 0; i < ys.length - 1; i++) v += cotaV(fy(ys[i]), fy(ys[i + 1]), fx(0), fx(0) - 6, f2(ys[i + 1] - ys[i]), true);
    }
    v += cotaH(fx(0), fx(W), fy(H), fy(H) - 13, f1(W));
    v += cotaV(fy(0), fy(H), fx(W), fx(W) + 7, f1(H));
    (o.marcas || []).forEach(k => {
      if (!k.pos) return;
      const cx = fx(k.pos[0] * o.sx), cy = fy(k.pos[1] * o.sy);
      v += `<g class="mk ${k.nivel}"><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="3.2"/><text x="${cx.toFixed(2)}" y="${(cy + 1.1).toFixed(2)}">${k.n}</text></g>`;
    });
    v += `<text class="tv" x="${ox}" y="${fy(0) + 9}">VISTA FRONTAL · SECCIÓN DE HUECOS</text>`;

    const oyS = fy(0) + 18;
    const gy = y => oyS + y * s;
    v += `<rect class="cara" x="${fx(0)}" y="${gy(0)}" width="${(W * s).toFixed(2)}" height="${(L * s).toFixed(2)}"/>`;
    const prof = Math.max(0.8, ...['sup'].map(k => (m.rayado && m.rayado[k] ? m.rayado[k].prof : 0)));
    lineasCara(g.marco, 'x', H, prof * 1.15).filter(x => x > 0.2 && x < W - 0.2).forEach(x => { v += `<line class="ar" x1="${fx(x).toFixed(2)}" y1="${gy(0)}" x2="${fx(x).toFixed(2)}" y2="${gy(L).toFixed(2)}"/>`; });
    v += cotaH(fx(0), fx(W), gy(L), gy(L) + 7, f1(W));
    v += cotaV(gy(0), gy(L), fx(W), fx(W) + 7, f1(L));
    v += `<text class="tv" x="${ox}" y="${gy(L) + 15}">VISTA SUPERIOR · CARA ${f1(W)} × ${f1(L)}</text>`;

    const oxL = fx(W) + 26;
    const lx = z => oxL + z * s;
    v += `<rect class="cara" x="${oxL}" y="${fy(H)}" width="${(L * s).toFixed(2)}" height="${(H * s).toFixed(2)}"/>`;
    const profL = Math.max(0.8, m.rayado && m.rayado.der ? m.rayado.der.prof : 0);
    lineasCara(g.marco, 'y', W, profL * 1.15).filter(y => y > 0.2 && y < H - 0.2).forEach(y => { v += `<line class="ar" x1="${oxL}" y1="${fy(y).toFixed(2)}" x2="${lx(L).toFixed(2)}" y2="${fy(y).toFixed(2)}"/>`; });
    v += cotaH(oxL, lx(L), fy(H), fy(H) - 7, f1(L));
    v += cotaV(fy(0), fy(H), lx(L), lx(L) + 7, f1(H));
    v += `<text class="tv" x="${oxL}" y="${fy(0) + 9}">VISTA LATERAL · CARA ${f1(H)} × ${f1(L)}</text>`;

    const bx = 287, by = 207, bw = 125, bh = 82;
    if (o.img3d) v += `<image href="${o.img3d}" x="${oxL}" y="${fy(0) + 14}" width="${Math.min(bw, 410 - oxL)}" height="${(by - 4) - (fy(0) + 14)}" preserveAspectRatio="xMidYMid meet"/>`;
    const filas = [
      ['Tipo', o.tipo || ''], ['Molde', o.titulo || ''], ['Estado', o.estado || ''],
      ['Sección cocida', `${f2(W)} × ${f2(H)} mm`], ['Largo cocido', `${f1(L)} mm`],
      ['Huecos', `${m.nHuecos} · ${f1(m.vacio)} %`], ['Peso estimado', o.peso ? f2(o.peso) + ' kg' : '—'],
      ['Contracción H / V', o.contr || ''], ['Escala', '1:' + (1 / s).toFixed(2).replace('.', ',')], ['Fecha', o.fecha || '']
    ];
    v += `<rect class="rot" x="${bx}" y="${by}" width="${bw}" height="${bh}"/>`;
    v += `<rect class="rot-h" x="${bx}" y="${by}" width="${bw}" height="9"/><text class="rt" x="${bx + 3}" y="${by + 6.3}">${xe(o.planta || 'LADRILLO COCIDO')}</text>`;
    filas.forEach((r, i) => {
      const y = by + 9 + 7.3 * (i + 1) - 2.3;
      v += `<line class="rl" x1="${bx}" y1="${(by + 9 + 7.3 * (i + 1)).toFixed(2)}" x2="${bx + bw}" y2="${(by + 9 + 7.3 * (i + 1)).toFixed(2)}"/><text class="rk" x="${bx + 2.5}" y="${y.toFixed(2)}">${xe(r[0])}</text><text class="rv" x="${bx + 38}" y="${y.toFixed(2)}">${xe(r[1])}</text>`;
    });
    const css = `.sec{fill:#f3d9cc;fill-rule:evenodd;stroke:#24211d;stroke-width:.35}.eje{stroke:#b13ea8;stroke-width:.18;stroke-dasharray:6 1.2 1 1.2}.cara{fill:#f3d9cc;stroke:#24211d;stroke-width:.35}.ar{stroke:#7a5a48;stroke-width:.12}
      .ct line{stroke:#2a62b8;stroke-width:.16}.fl{fill:#2a62b8}.ct text{fill:#2a62b8;font-family:Arial,sans-serif;text-anchor:middle}
      .tv{font:700 3.2px Arial,sans-serif;fill:#24211d}.mk circle{stroke-width:.4;fill:#fff}.mk text{font:700 3px Arial,sans-serif;text-anchor:middle}.mk.error circle{stroke:#d03a2f}.mk.error text{fill:#d03a2f}.mk.aviso circle{stroke:#d98a00}.mk.aviso text{fill:#b37000}.mk.info circle{stroke:#2a62b8}.mk.info text{fill:#2a62b8}
      .rot{fill:#fff;stroke:#24211d;stroke-width:.35}.rot-h{fill:#24211d}.rt{font:700 3.4px Arial,sans-serif;fill:#fff}.rl{stroke:#c9c1b6;stroke-width:.15}.rk{font:600 2.8px Arial,sans-serif;fill:#6f6860}.rv{font:700 3px Arial,sans-serif;fill:#24211d}.marco-h{fill:#fff;stroke:#24211d;stroke-width:.5}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="hoja" viewBox="0 0 420 297" preserveAspectRatio="xMidYMid meet"><style>${css}</style><rect class="marco-h" x="5" y="5" width="410" height="287"/>${v}</svg>`;
  }

  function miniatura(m) {
    const W = +m.anchoV, H = +m.altoV;
    if (!m.miniatura || !W) return '<div class="mini-plano vacio"></div>';
    const mg = 0.06 * W;
    return `<svg class="mini-plano" viewBox="${(-mg).toFixed(1)} ${(-mg * 0.9).toFixed(1)} ${(W + 2 * mg).toFixed(1)} ${(H + 2.2 * mg).toFixed(1)}"><path d="${xe(m.miniatura)}"/><g class="mc"><line x1="0" y1="${H + mg * 0.7}" x2="${W}" y2="${H + mg * 0.7}"/><text x="${W / 2}" y="${H + mg * 0.55}">${f1(W)}</text></g></svg>`;
  }

  return { hoja, miniatura };
})();
