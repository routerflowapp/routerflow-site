/* RouterFlow: prévia 3D do Gerador de Peças, com Three.js embutido (vendor/three.min.js, sem internet).
   A cena vem do Python (modelos.cena3d): peças com espessura, o que a router faz na face (furos, rasgos, canais, rebaixos,
   chanfros) com a profundidade, relevo 3D e painéis curvos. Modos montado, explodido e peças deitadas. Arraste gira, roda
   do mouse aproxima, botão direito arrasta, duplo clique volta ao começo. */
"use strict";

// ---------------------------------------------------------------- triangulação (orelhas, com furos ligados por ponte)
const Tri = (() => {
  const area = (d, s, e) => { let a = 0; for (let i = s, j = e - 2; i < e; j = i, i += 2) a += (d[j] - d[i]) * (d[i + 1] + d[j + 1]); return a; };
  function node(i, x, y) { return { i, x, y, prev: null, next: null, steiner: false }; }
  function insert(i, x, y, last) { const p = node(i, x, y); if (!last) { p.prev = p; p.next = p; } else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; } return p; }
  function remove(p) { p.next.prev = p.prev; p.prev.next = p.next; }
  function linked(d, s, e, cw) {
    let last = null;
    if (cw === (area(d, s, e) > 0)) for (let i = s; i < e; i += 2) last = insert(i / 2, d[i], d[i + 1], last);
    else for (let i = e - 2; i >= s; i -= 2) last = insert(i / 2, d[i], d[i + 1], last);
    if (last && eq(last, last.next)) { remove(last); last = last.next; }
    return last;
  }
  const eq = (a, b) => a.x === b.x && a.y === b.y;
  const tarea = (p, q, r) => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const inTri = (ax, ay, bx, by, cx, cy, px, py) => (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);
  function filter(start, end) {
    if (!start) return start; if (!end) end = start;
    let p = start, again;
    do {
      again = false;
      if (!p.steiner && (eq(p, p.next) || tarea(p.prev, p, p.next) === 0)) { remove(p); p = end = p.prev; if (p === p.next) break; again = true; }
      else p = p.next;
    } while (again || p !== end);
    return end;
  }
  function isEar(ear) {
    const a = ear.prev, b = ear, c = ear.next;
    if (tarea(a, b, c) >= 0) return false;
    let p = ear.next.next;
    while (p !== ear.prev) {
      if (inTri(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && tarea(p.prev, p, p.next) >= 0) return false;
      p = p.next;
    }
    return true;
  }
  function earcutLinked(ear, tris, pass) {
    if (!ear) return;
    let stop = ear, guard = 0;
    while (ear.prev !== ear.next && guard++ < 200000) {
      const prev = ear.prev, next = ear.next;
      if (isEar(ear)) { tris.push(prev.i, ear.i, next.i); remove(ear); ear = next.next; stop = next.next; continue; }
      ear = next;
      if (ear === stop) {
        if (!pass) { earcutLinked(filter(ear), tris, 1); }
        else if (pass === 1) { ear = cure(filter(ear), tris); earcutLinked(ear, tris, 2); }
        else if (pass === 2) { split(ear, tris); }
        break;
      }
    }
  }
  function cure(start, tris) {
    let p = start;
    do {
      const a = p.prev, b = p.next.next;
      if (!eq(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) { tris.push(a.i, p.i, b.i); remove(p); remove(p.next); p = start = b; }
      p = p.next;
    } while (p !== start);
    return filter(p);
  }
  function split(start, tris) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && isValidDiag(a, b)) {
          let c = splitPoly(a, b); a = filter(a, a.next); c = filter(c, c.next);
          earcutLinked(a, tris, 0); earcutLinked(c, tris, 0); return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const onSeg = (p, q, r) => q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  function intersects(p1, q1, p2, q2) {
    const o1 = sign(tarea(p1, q1, p2)), o2 = sign(tarea(p1, q1, q2)), o3 = sign(tarea(p2, q2, p1)), o4 = sign(tarea(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && onSeg(p1, p2, q1)) || (o2 === 0 && onSeg(p1, q2, q1)) || (o3 === 0 && onSeg(p2, p1, q2)) || (o4 === 0 && onSeg(p2, q1, q2));
  }
  function intersectsPoly(a, b) { let p = a; do { if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true; p = p.next; } while (p !== a); return false; }
  const locallyInside = (a, b) => (tarea(a.prev, a, a.next) < 0 ? tarea(a, b, a.next) >= 0 && tarea(a, a.prev, b) >= 0 : tarea(a, b, a.prev) < 0 || tarea(a, a.next, b) < 0);
  function middleInside(a, b) { let p = a, inside = false; const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2; do { if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y && (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x)) inside = !inside; p = p.next; } while (p !== a); return inside; }
  const isValidDiag = (a, b) => a.next.i !== b.i && a.prev.i !== b.i && !intersectsPoly(a, b) && locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b);
  function splitPoly(a, b) {
    const a2 = node(a.i, a.x, a.y), b2 = node(b.i, b.x, b.y), an = a.next, bp = b.prev;
    a.next = b; b.prev = a; a2.next = an; an.prev = a2; b2.next = a2; a2.prev = b2; bp.next = b2; b2.prev = bp;
    return b2;
  }
  function eliminateHoles(d, holeIdx, outer) {
    const queue = [];
    for (let i = 0; i < holeIdx.length; i++) {
      const s = holeIdx[i] * 2, e = i < holeIdx.length - 1 ? holeIdx[i + 1] * 2 : d.length;
      const list = linked(d, s, e, false);
      if (list) { if (list === list.next) list.steiner = true; let left = list, p = list; do { if (p.x < left.x || (p.x === left.x && p.y < left.y)) left = p; p = p.next; } while (p !== list); queue.push(left); }
    }
    queue.sort((a, b) => a.x - b.x);
    for (const h of queue) { outer = eliminateHole(h, outer); }
    return outer;
  }
  function eliminateHole(hole, outer) {
    const bridge = findBridge(hole, outer);
    if (!bridge) return outer;
    const b2 = splitPoly(bridge, hole);
    filter(b2, b2.next);
    return filter(bridge, bridge.next);
  }
  function findBridge(hole, outer) {
    let p = outer; const hx = hole.x, hy = hole.y; let qx = -Infinity, m = null;
    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
        if (x <= hx && x > qx) { qx = x; m = p.x < p.next.x ? p : p.next; if (x === hx) return m; }
      }
      p = p.next;
    } while (p !== outer);
    if (!m) return null;
    const stop = m, mx = m.x, my = m.y; let tanMin = Infinity; p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x && inTri(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        const tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x)))) { m = p; tanMin = tan; }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }
  // anel de fora e furos ([[x,y]...]) -> {verts: [x,y,...], tris: [i,j,k,...]}
  function tri(outer, holes = []) {
    const d = [], holeIdx = [];
    for (const [x, y] of outer) d.push(x, y);
    for (const h of holes) { if (h.length < 3) continue; holeIdx.push(d.length / 2); for (const [x, y] of h) d.push(x, y); }
    const outerLen = holeIdx.length ? holeIdx[0] * 2 : d.length;
    let list = linked(d, 0, outerLen, true); const tris = [];
    if (!list || list.next === list.prev) return { verts: d, tris };
    if (holeIdx.length) list = eliminateHoles(d, holeIdx, list);
    earcutLinked(list, tris, 0);
    return { verts: d, tris };
  }
  return { tri };
})();

// ================================================================ prévia 3D com Three.js (vendor/three.min.js, embutido)
// Cada peça vira um sólido de verdade: a face de cima é o contorno menos o que a router abre nela (furos, rasgos, canais,
// rebaixos, chanfros), cada abertura tem parede e fundo na profundidade certa, e a borda da peça desce onde um rasgo ou
// chanfro chega nela. Material com textura (MDF cru, branco, madeira), luz com sombra, arestas, raio-X com uma cor por
// peça, cotas, vistas prontas, girar sozinho e tela cheia. polygon-clipping (vendor) faz as contas de polígono.

const G3_COR = {      // usado também pela legenda e pelo modo antigo
  caixa: [0.93, 0.87, 0.76], frente: [0.80, 0.63, 0.45], fundo: [0.86, 0.82, 0.74], flex: [0.84, 0.72, 0.55],
  furo: [0.22, 0.15, 0.09], canal: [0.55, 0.37, 0.20], rasgo: [0.62, 0.42, 0.22], rebaixo: [0.70, 0.52, 0.32],
  letra: [0.30, 0.19, 0.10], marca: [0.25, 0.35, 0.33], borda: [0.33, 0.24, 0.14],
};
const G3_RAIOX = [0x2f80ed, 0xeb5757, 0x27ae60, 0xf2994a, 0x9b51e0, 0x00a3c4, 0xd4a017, 0x6fcf97, 0xbb6bd9, 0x1d6fa5, 0xe76f51, 0x2a9d8f];
const G3_MAT = { projeto: "Cores do projeto", cru: "MDF cru", branco: "MDF branco", madeira: "Madeira", laca: "Laqueada (cortes pintados)" };
const G3_VISTA = { "3d": [-1.12, 0.42], frente: [-Math.PI / 2, 0.03], lado: [0, 0.03], cima: [-Math.PI / 2, 1.54] };

const g3Pref = (k, d) => { try { const v = localStorage.getItem("rf.g3." + k); return v === null ? d : v; } catch (e) { return d; } };
const g3Set = (k, v) => { try { localStorage.setItem("rf.g3." + k, v); } catch (e) { /* sem armazenamento */ } };

// ---- polígonos (polygon-clipping usa [polígono[anel[ponto]]])
const PC = () => window.polygonClipping;
const g3Circulo = (cx, cy, r, n = 28) => { const a = []; for (let k = 0; k < n; k++) { const t = 2 * Math.PI * k / n; a.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return a; };
const g3Fecha = (ring) => { const r = ring.map((p) => [+p[0], +p[1]]); if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0].slice()); return r; };
const g3Area = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return a / 2; };
function g3Dentro(p, ring) {
  let d = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]) d = !d;
  }
  return d;
}
const g3DentroMP = (p, mp) => mp.some((poly) => g3Dentro(p, poly[0]) && !poly.slice(1).some((h) => g3Dentro(p, h)));
const g3Seguro = (fn, d) => { try { return fn(); } catch (e) { return d; } };

// faixa de uma linha (canal): retângulo por trecho e um círculo em cada junta, unidos
function g3Faixa(pts, w) {
  const r = w / 2, partes = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
    const nx = -(by - ay) / L * r, ny = (bx - ax) / L * r;
    partes.push([[[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny], [ax + nx, ay + ny]]]);
    if (k > 0) partes.push([g3Fecha(g3Circulo(ax, ay, r, 12))]);
  }
  if (!partes.length) return [];
  return g3Seguro(() => PC().union(...partes), partes);
}
// faixa só do lado esquerdo da linha (chanfro: a peça fica à esquerda)
function g3FaixaEsq(pts, w) {
  const partes = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
    const nx = -(by - ay) / L * w, ny = (bx - ax) / L * w;
    partes.push([[[ax, ay], [bx, by], [bx + nx, by + ny], [ax + nx, ay + ny], [ax, ay]]]);
    // na quina que vira para a direita, a fresa V gira em volta do ponto: a face perde um setor de raio w
    if (k > 0) partes.push([g3Fecha(g3Circulo(ax, ay, w, 20))]);
  }
  if (!partes.length) return [];
  return g3Seguro(() => PC().union(...partes), partes);
}

// ---- texturas feitas na hora (sem imagem): veio de madeira e o pontilhado do MDF
function g3Textura(tipo) {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  if (tipo === "madeira") {
    g.fillStyle = "#9a6a3e"; g.fillRect(0, 0, 512, 512);
    // 3.47.0: faixas com tom próprio (como as lâminas do MDP), veio fino e poros: a madeira deixa de parecer lisa
    for (let y = 0; y < 512; y += 64) { const v = (rnd() - 0.5) * 0.16; g.fillStyle = v > 0 ? `rgba(200,150,95,${v})` : `rgba(70,40,18,${-v})`; g.fillRect(0, y, 512, 64); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(55,30,12,${0.05 + rnd() * 0.12})`; g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 9, 0.7); }
    for (let i = 0; i < 140; i++) {
      const y0 = rnd() * 512, a = 0.04 + rnd() * 0.12, cor = rnd() < 0.5 ? "60,35,15" : "190,140,90";
      g.strokeStyle = `rgba(${cor},${a})`; g.lineWidth = 0.6 + rnd() * 2.6; g.beginPath();
      const amp = 2 + rnd() * 7, f = 0.004 + rnd() * 0.01, ph = rnd() * 6;
      for (let x = 0; x <= 512; x += 8) { const y = y0 + Math.sin(x * f * 6.28 + ph) * amp; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  } else if (tipo === "piso") {                                    // 3.47.0: piso da sala em réguas claras de madeira
    for (let y = 0; y < 512; y += 64) for (let x0 = -((y / 64) % 2) * 256; x0 < 512; x0 += 512) {
      const t = 0.92 + rnd() * 0.1; g.fillStyle = `rgb(${Math.round(214 * t)},${Math.round(190 * t)},${Math.round(158 * t)})`; g.fillRect(x0, y, 512, 64);
      for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(120,85,50,${0.04 + rnd() * 0.08})`; g.lineWidth = 0.6 + rnd() * 1.6; const yy = y + 4 + rnd() * 56; g.beginPath(); g.moveTo(x0, yy); g.bezierCurveTo(x0 + 170, yy + (rnd() - 0.5) * 6, x0 + 340, yy + (rnd() - 0.5) * 6, x0 + 512, yy); g.stroke(); }
      g.fillStyle = "rgba(90,65,40,0.35)"; g.fillRect(x0, y, 512, 1.5); g.fillRect(x0, y, 1.5, 64);
    }
  } else if (tipo === "parede") {                                  // 3.47.0: massa fina pintada
    g.fillStyle = "#efeae2"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 7000; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.012 + rnd() * 0.025})` : `rgba(255,255,255,${0.02 + rnd() * 0.05})`; const r0 = 1 + rnd() * 4; g.fillRect(rnd() * 512, rnd() * 512, r0, r0); }
  } else {
    g.fillStyle = tipo === "branco" ? "#efede8" : tipo === "miolo" ? "#a98557" : "#c9a273"; g.fillRect(0, 0, 512, 512);
    const n = tipo === "branco" ? 2500 : 9000;
    for (let i = 0; i < n; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.03 + rnd() * 0.06})` : `rgba(255,255,255,${0.03 + rnd() * 0.08})`; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(1 / (tipo === "madeira" ? 900 : 300), 1 / (tipo === "madeira" ? 900 : 300));
  return t;
}

// ---- montagem da geometria de uma peça (coordenadas da peça: x, y no plano, z de 0 a espessura)
function G3Malha() { this.g = { face: [], lado: [], miolo: [] }; }
G3Malha.prototype.tri = function (grupo, a, b, c, uvs) {
  const arr = this.g[grupo]; arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], ...(uvs || [a[0], a[1], b[0], b[1], c[0], c[1]]));
};
// polígonos (multipolígono) achatados na altura z, olhando para cima (+1) ou para baixo (-1)
G3Malha.prototype.plano = function (grupo, mp, z, lado) {
  for (const poly of mp || []) {
    if (!poly.length || poly[0].length < 4) continue;
    const contorno = poly[0].slice(0, -1).map((p) => new THREE.Vector2(p[0], p[1]));
    const furos = poly.slice(1).map((h) => h.slice(0, -1).map((p) => new THREE.Vector2(p[0], p[1])));
    if (THREE.ShapeUtils.isClockWise(contorno)) contorno.reverse();
    for (const h of furos) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
    const tris = g3Seguro(() => THREE.ShapeUtils.triangulateShape(contorno, furos), []);
    const todos = contorno.concat(...furos);
    for (const [i, j, k] of tris) {
      const A = todos[i], B = todos[j], C = todos[k];
      if (lado > 0) this.tri(grupo, [A.x, A.y, z], [B.x, B.y, z], [C.x, C.y, z]); else this.tri(grupo, [A.x, A.y, z], [C.x, C.y, z], [B.x, B.y, z]);
    }
  }
};
// parede vertical do ponto a ao b (de z0 a z1); a face olha para a esquerda do sentido a -> b
G3Malha.prototype.parede = function (grupo, a, b, z0, z1) {
  if (z1 - z0 < 1e-4) return;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) return;
  const A0 = [a[0], a[1], z0], B0 = [b[0], b[1], z0], A1 = [a[0], a[1], z1], B1 = [b[0], b[1], z1];
  this.tri(grupo, A0, A1, B1, [0, z0, 0, z1, L, z1]); this.tri(grupo, A0, B1, B0, [0, z0, L, z1, L, z0]);
};
G3Malha.prototype.quad = function (grupo, A, B, C, D) { this.tri(grupo, A, B, C); this.tri(grupo, A, C, D); };
G3Malha.prototype.geometria = function () {
  const pos = [], uv = [], geo = new THREE.BufferGeometry(); let ini = 0; const grupos = [];
  for (const [k, gi] of [["face", 0], ["lado", 1], ["miolo", 2]]) {
    const arr = this.g[k], n = arr.length / 15;
    for (let t = 0; t < n; t++) {
      const o = t * 15; pos.push(arr[o], arr[o + 1], arr[o + 2], arr[o + 3], arr[o + 4], arr[o + 5], arr[o + 6], arr[o + 7], arr[o + 8]);
      uv.push(arr[o + 9], arr[o + 10], arr[o + 11], arr[o + 12], arr[o + 13], arr[o + 14]);
    }
    if (n) grupos.push([ini, n * 3, gi]); ini += n * 3;
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  for (const [s, c, m] of grupos) geo.addGroup(s, c, m);
  geo.computeVertexNormals();
  return geo;
};

// anéis de um multipolígono como segmentos [a, b] com o lado de dentro à esquerda (anel de fora anti-horário)
function g3Arestas(mp) {
  const out = [];
  for (const poly of mp || []) poly.forEach((ring, idx) => {
    const r = ring.slice(0, -1); const ccw = g3Area(r) < 0 ? false : true;     // g3Area > 0: anti-horário
    const quer = idx === 0;                                                   // fora anti-horário, furo horário
    const ordem = ccw === quer ? r : r.slice().reverse();
    for (let i = 0; i < ordem.length; i++) out.push([ordem[i], ordem[(i + 1) % ordem.length]]);
  });
  return out;
}

// a peça inteira: face de cima e de baixo com as aberturas, paredes, fundos e bordas
function g3Peca(s) {
  const m = new G3Malha(), e = +s.esp || 18, pc = PC();
  const contorno = g3Fecha(s.pts); if (g3Area(contorno) < 0) contorno.reverse();
  const furosPass = (s.furos || []).filter((h) => h.length >= 3).map((h) => g3Fecha(h));
  const pinta = [];                                                // o que vai só pintado (raso demais ou não deu para cortar)
  const ab = { face: [], verso: [] };                              // aberturas: {mp, prof, perfil, pts, w, chanfro}
  for (const d of s.decal || []) {
    const lado = d.verso ? "verso" : "face", prof = +(d.prof || 0);
    if (d.tipo === "furo") {
      if (prof >= e - 0.05) { furosPass.push(g3Fecha(g3Circulo(d.c[0], d.c[1], d.r))); continue; }
      if (prof < 0.3) { pinta.push(d); continue; }
      ab[lado].push({ mp: [[g3Fecha(g3Circulo(d.c[0], d.c[1], d.r))]], prof, perfil: "reto" });
    } else if (d.tipo === "area") {
      if (prof < 0.3) { pinta.push(d); continue; }
      ab[lado].push({ mp: [[g3Fecha(d.pts), ...(d.furos || []).map(g3Fecha)]], prof, perfil: "reto", letra: d.cor === "letra" });
    } else if (d.tipo === "linha") {
      if (prof < 0.3 || d.perfil === "cava") { if (d.perfil === "cava") ab[lado].push({ cava: true, pts: d.pts, prof, w: d.w }); else pinta.push(d); continue; }
      if (d.chanfro) ab[lado].push({ mp: g3FaixaEsq(d.pts, d.w), prof, perfil: "v", pts: d.pts, w: d.w, chanfro: true });
      else ab[lado].push({ mp: g3Faixa(d.pts, d.w), prof, perfil: d.perfil === "v" || d.perfil === "redonda" ? "v" : "reto", pts: d.pts, w: d.w });
    }
  }
  // a peça (contorno menos os recortes passantes) e o que cada abertura ocupa dentro dela
  let peca = [[contorno]];
  if (furosPass.length) peca = g3Seguro(() => pc.difference(peca, ...furosPass.map((h) => [h])), peca);
  for (const k of ["face", "verso"]) {
    for (const a of ab[k]) if (a.mp) a.mp = g3Seguro(() => pc.intersection(a.mp, peca), []);
    ab[k] = ab[k].filter((a) => a.cava || (a.mp && a.mp.length));
  }
  const bis = s.bisel && s.bisel.topo && s.bisel.base && s.bisel.topo.length === s.bisel.base.length ? s.bisel : null;
  const eb = bis ? Math.max(0.5, e - bis.c) : e;
  // face de cima (z = e) e de baixo (z = 0), menos as aberturas e o relevo
  const regiao = (k) => {
    let base = peca;
    if (k === "face" && bis) base = g3Seguro(() => pc.difference([[g3Fecha(bis.topo)]], ...furosPass.map((h) => [h])), [[g3Fecha(bis.topo)]]);
    const tira = ab[k].filter((a) => a.mp).map((a) => a.mp);
    if (k === "face" && s.relevo) { const r = s.relevo; tira.push([[g3Fecha([[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]])]]); }
    return tira.length ? g3Seguro(() => pc.difference(base, ...tira), base) : base;
  };
  m.plano("face", regiao("face"), e, 1);
  m.plano("face", regiao("verso"), 0, -1);
  // cada abertura: fundo (o mais raso por cima, então cada fundo perde o que uma mais funda tira) e paredes
  for (const k of ["face", "verso"]) {
    const sinal = k === "face" ? 1 : -1, z0 = k === "face" ? e : 0;
    const zf = (p) => z0 - sinal * p;                                          // altura do fundo de uma abertura
    const lista = ab[k].filter((a) => a.mp).sort((a, b) => a.prof - b.prof);
    lista.forEach((a, i) => {
      const fundas = lista.slice(i + 1).filter((b) => b.prof > a.prof + 1e-3).map((b) => b.mp);
      if (a.perfil === "v") {
        // fundo em V: da borda da faixa (na face) até a linha do meio (na profundidade); chanfro: só o lado da peça
        const w = a.chanfro ? a.w : a.w / 2;
        for (let t = 0; t < a.pts.length - 1; t++) {
          const [ax, ay] = a.pts[t], [bx, by] = a.pts[t + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
          const nx = -(by - ay) / L * w, ny = (bx - ax) / L * w, zc = zf(a.prof);
          const lados = a.chanfro ? [1] : [1, -1];
          for (const sg of lados) {
            const P1 = [ax + nx * sg, ay + ny * sg, z0], P2 = [bx + nx * sg, by + ny * sg, z0], C1 = [ax, ay, zc], C2 = [bx, by, zc];
            if ((sg > 0) === (sinal > 0)) m.quad("miolo", C1, C2, P2, P1); else m.quad("miolo", C1, P1, P2, C2);
          }
          // chanfro: na quina que vira para a direita, um cone da ponta da V (no fundo) até o arco na face
          if (a.chanfro && t < a.pts.length - 2) {
            const [cx2, cy2] = a.pts[t + 2], L2 = Math.hypot(cx2 - bx, cy2 - by); if (L2 < 1e-6) continue;
            const a1 = Math.atan2(ny, nx), n2x = -(cy2 - by) / L2, n2y = (cx2 - bx) / L2;
            let da = Math.atan2(n2y, n2x) - a1;
            while (da > Math.PI) da -= 2 * Math.PI;
            while (da <= -Math.PI) da += 2 * Math.PI;
            if (da < -1e-3) {
              const nseg = Math.max(2, Math.ceil(-da / (Math.PI / 16))), C = [bx, by, zc];
              for (let j = 0; j < nseg; j++) {
                const t0 = a1 + da * j / nseg, t1 = a1 + da * (j + 1) / nseg;
                const Pa = [bx + Math.cos(t0) * w, by + Math.sin(t0) * w, z0], Pb = [bx + Math.cos(t1) * w, by + Math.sin(t1) * w, z0];
                if (sinal > 0) m.quad("miolo", C, C, Pb, Pa); else m.quad("miolo", C, Pa, Pb, C);
              }
            }
          }
        }
        return;
      }
      let fundo = fundas.length ? g3Seguro(() => pc.difference(a.mp, ...fundas), a.mp) : a.mp;
      // parede invertida (fresa de cava na parede de uma abertura com fundo): o fundo entra por baixo da face
      const invs = k === "face" ? ab.face.filter((c) => c.cava && c.w > 0 && Math.abs(c.prof - a.prof) < 0.05) : [];
      for (const c of invs) { const fx = g3FaixaEsq(c.pts, c.w); if (fx.length) fundo = g3Seguro(() => pc.union(fundo, fx), fundo); }
      // com a borda chanfrada mais funda que esta abertura, o fundo para onde o chanfro da borda chega nele
      if (bis && k === "face" && a.prof < e - eb - 1e-3) {
        const f = (e - eb - a.prof) / (e - eb), anel = bis.base.map((b, i) => [b[0] + (bis.topo[i][0] - b[0]) * f, b[1] + (bis.topo[i][1] - b[1]) * f]);
        fundo = g3Seguro(() => pc.intersection(fundo, [[g3Fecha(anel)]]), fundo);
      }
      m.plano("miolo", fundo, zf(a.prof), sinal);
      // paredes: em volta da abertura, menos onde ela encosta na borda da peça (ali quem desce é a borda)
      for (const [p, q] of g3Arestas(a.mp)) {
        const meio = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        const fora = [meio[0] + (q[1] - p[1]) / L * 0.05, meio[1] - (q[0] - p[0]) / L * 0.05];   // à direita: fora da abertura
        if (!g3DentroMP(fora, peca)) continue;
        const outra = lista.find((b) => b !== a && b.mp && b.prof >= a.prof - 1e-3 && g3DentroMP(fora, b.mp));
        if (outra) continue;                                                // do outro lado também está aberto (mais fundo)
        // parede invertida: inclinada por baixo da face, da linha (na face) até w para dentro da peça (no fundo)
        const inv = invs.find((c) => {
          for (let t = 0; t < c.pts.length - 1; t++) {
            const A = c.pts[t], B = c.pts[t + 1], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy || 1;
            const d2 = (P) => { const u = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / l2)); return Math.hypot(P[0] - A[0] - dx * u, P[1] - A[1] - dy * u); };
            if (d2(p) < 0.6 && d2(q) < 0.6) return true;
          }
          return false;
        });
        if (inv) {
          const nx = (q[1] - p[1]) / L * inv.w, ny = -(q[0] - p[0]) / L * inv.w, zb = zf(a.prof);
          m.quad("miolo", [p[0], p[1], z0], [q[0], q[1], z0], [q[0] + nx, q[1] + ny, zb], [p[0] + nx, p[1] + ny, zb]);
          continue;
        }
        // do outro lado há uma abertura mais rasa (chanfro na boca de um rebaixo): a parede sobe só até o fundo dela
        const rasa = lista.filter((b) => b !== a && b.mp && b.prof < a.prof && g3DentroMP(fora, b.mp)).reduce((m0, b) => Math.max(m0, b.prof), 0);
        const topo = zf(rasa), baixo = zf(a.prof);
        // a parede olha para dentro da abertura (a esquerda do sentido, como parede() faz)
        if (sinal > 0) m.parede("miolo", p, q, baixo, topo); else m.parede("miolo", p, q, topo, baixo);
      }
    });
  }
  // relevo (painel ondulado): superfície pela grade de profundidades
  if (s.relevo) {
    const r = s.relevo, nx = r.nx, ny = r.ny;
    const pt = (i, j) => [r.x0 + (r.x1 - r.x0) * i / nx, r.y0 + (r.y1 - r.y0) * j / ny, e - r.z[j * (nx + 1) + i]];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) m.quad("face", pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1));
  }
  // borda da peça (e dos recortes passantes): sobe até a face, menos onde uma abertura chega nela
  const alturaEm = (p, k) => {
    let fundo = 0;
    for (const a of ab[k]) if (a.mp && a.prof > fundo && g3DentroMP(p, a.mp)) fundo = a.prof;
    return fundo;
  };
  const cavas = { face: ab.face.filter((a) => a.cava), verso: ab.verso.filter((a) => a.cava) };
  const pertoDe = (p, q, pts) => {
    const d = (x) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x[0] - a[0]) * dx + (x[1] - a[1]) * dy) / l2)); best = Math.min(best, Math.hypot(x[0] - a[0] - dx * t, x[1] - a[1] - dy * t)); } return best; };
    return d(p) < 0.6 && d(q) < 0.6;
  };
  const tg35 = Math.tan(35 * Math.PI / 180);
  const bordas = g3Arestas(peca);
  for (const [p, q] of bordas) {
    // divide a aresta onde as aberturas mudam e sobe cada pedaço até a altura certa
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 1e-6) continue;
    const n = Math.max(1, Math.min(60, Math.ceil(L / 4)));
    const dentro = [-(q[1] - p[1]) / L * 0.08, (q[0] - p[0]) / L * 0.08];       // um fio para dentro da peça
    let ini = 0, atual = null;
    const fecha = (t0, t1, alt) => {
      const a = [p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0], b = [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1];
      // onde uma abertura chega na borda, a borda sobe só até o fundo dela (com bisel, o fundo já está abaixo do bisel)
      const zTop = alt[0] > 0 ? Math.min(bis && !bis.semBorda ? eb : e, e - alt[0]) : (bis && !bis.semBorda ? eb : e), zBot = alt[1];
      const cv = cavas.face.find((c) => pertoDe(a, b, c.pts));
      if (cv && !bis) {                                               // fresa de cava: a borda entra inclinada por baixo da face
        const u = cv.w || cv.prof / tg35, zc = e - cv.prof, ix = -(b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1) * u, iy = (b[0] - a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1) * u;
        m.parede("lado", b, a, zBot, zc);
        m.quad("miolo", [a[0], a[1], zc], [b[0], b[1], zc], [b[0] + ix, b[1] + iy, zc], [a[0] + ix, a[1] + iy, zc]);
        m.quad("miolo", [a[0] + ix, a[1] + iy, zc], [b[0] + ix, b[1] + iy, zc], [b[0], b[1], e], [a[0], a[1], e]);
        return;
      }
      m.parede("lado", b, a, zBot, zTop);
    };
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = [p[0] + (q[0] - p[0]) * t + dentro[0], p[1] + (q[1] - p[1]) * t + dentro[1]];
      const alt = [alturaEm(x, "face"), alturaEm(x, "verso")];
      if (!atual) { atual = alt; ini = i; continue; }
      if (Math.abs(alt[0] - atual[0]) > 1e-3 || Math.abs(alt[1] - atual[1]) > 1e-3) { fecha(ini / n, i / n, atual); atual = alt; ini = i; }
    }
    if (atual) fecha(ini / n, 1, atual);
  }
  // bisel: a borda sobe inclinada da altura eb até o contorno recuado
  // (em pedaços: onde uma abertura mais funda que o bisel chega na borda, ali não há bisel, a cava já tirou o material)
  if (bis) {
    const k = bis.base.length, cb = e - eb;
    const L = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
    for (let i = 0; i < k; i++) {
      const a = bis.base[i], b = bis.base[(i + 1) % k], a2 = bis.topo[i], b2 = bis.topo[(i + 1) % k];
      const n = Math.max(1, Math.min(80, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)));
      for (let j = 0; j < n; j++) {
        const t0 = j / n, t1 = (j + 1) / n, mb = L(a, b, (t0 + t1) / 2), mt = L(a2, b2, (t0 + t1) / 2);
        const pf = alturaEm([(mb[0] + mt[0]) / 2, (mb[1] + mt[1]) / 2], "face");
        if (pf >= cb - 0.01) continue;
        // abertura mais rasa que o bisel (fundo da cava): o bisel sobe só até o fundo dela
        const f = pf > 1e-3 ? (cb - pf) / cb : 1, zt = eb + cb * f;
        const p0 = L(a, b, t0), p1 = L(a, b, t1), q0 = L(p0, L(a2, b2, t0), f), q1 = L(p1, L(a2, b2, t1), f);
        m.quad("lado", [p0[0], p0[1], eb], [p1[0], p1[1], eb], [q1[0], q1[1], zt], [q0[0], q0[1], zt]);
      }
    }
  }
  return { geo: m.geometria(), pinta };
}

// painel curvo (MDF flexível): faixa que segue o caminho em planta
function g3Curva(s) {
  const m = new G3Malha(), e = s.esp;
  // a parede e as espigas (canto curvo encaixado: pedaços que sobem até a face do tampo e descem até a da base)
  for (const p of [{ path: s.path, z0: s.z0, h: s.h, parede: true }].concat(s.abas || [])) {
    const pts = p.path, z0 = p.z0, z1 = p.z0 + p.h;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay) || 1, ox = -(by - ay) / L * e, oy = (bx - ax) / L * e;
      m.parede("face", [bx, by], [ax, ay], z0, z1);
      m.parede("face", [ax + ox, ay + oy], [bx + ox, by + oy], z0, z1);
      m.quad("lado", [ax, ay, z1], [bx, by, z1], [bx + ox, by + oy, z1], [ax + ox, ay + oy, z1]);
      m.quad("lado", [ax, ay, z0], [ax + ox, ay + oy, z0], [bx + ox, by + oy, z0], [bx, by, z0]);
      if (!p.parede) {                    // pontas da espiga
        m.quad("lado", [ax, ay, z0], [ax, ay, z1], [ax + ox, ay + oy, z1], [ax + ox, ay + oy, z0]);
        m.quad("lado", [bx, by, z0], [bx + ox, by + oy, z0], [bx + ox, by + oy, z1], [bx, by, z1]);
      }
    }
  }
  return m.geometria();
}

// casca (revestimento de pé): superfície entre o anel de baixo e o de cima, com a espessura para dentro
function g3Casca(s) {
  const m = new G3Malha(), B = s.base, T = s.topo, e = s.esp, n = Math.min(B.length, T.length);
  const cx = B.reduce((a, q) => a + q[0], 0) / B.length, cy = B.reduce((a, q) => a + q[1], 0) / B.length;
  const dentro = (q) => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1; return [q[0] - dx / l * e, q[1] - dy / l * e, q[2]]; };
  const Bi = B.map(dentro), Ti = T.map(dentro);
  for (let i = 0; i < n - 1; i++) {
    m.quad("face", B[i], B[i + 1], T[i + 1], T[i]);
    m.quad("miolo", Bi[i], Ti[i], Ti[i + 1], Bi[i + 1]);
    m.quad("lado", T[i], T[i + 1], Ti[i + 1], Ti[i]);
    m.quad("lado", B[i], Bi[i], Bi[i + 1], B[i + 1]);
  }
  return m.geometria();
}

// texto das cotas e dos nomes: sprite com o número desenhado
function g3Rotulo(txt, altura, cor = "#1f3a5f") {
  const c = document.createElement("canvas"), g = c.getContext("2d"), fs = 56;
  g.font = `700 ${fs}px Segoe UI, Arial`; const w = Math.ceil(g.measureText(txt).width) + 28;
  c.width = w; c.height = fs + 22;
  g.font = `700 ${fs}px Segoe UI, Arial`; g.fillStyle = "rgba(255,255,255,.92)";
  if (g.roundRect) { g.beginPath(); g.roundRect(0, 0, w, fs + 22, 14); g.fill(); } else g.fillRect(0, 0, w, fs + 22);
  g.fillStyle = cor; g.textBaseline = "middle"; g.fillText(txt, 14, (fs + 22) / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(altura * w / (fs + 22), altura, 1); sp.renderOrder = 10;
  return sp;
}

const ger3d = {
  ok: false, cv: null, box: null, ren: null, scene: null, cam: null, grupo: null, cena: null, modo: "montado",
  yaw: -1.12, pitch: 0.42, dist: 1000, alvo: [0, 0, 0], raio: 300, caixa: null, _enq: false, _raf: 0, _anim: null, _tex: null,

  attach(cv) {
    this.cv = cv; this.ok = false;
    if (!window.THREE) return false;
    try {
      this.ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
    } catch (e) { return false; }
    this.ren.shadowMap.enabled = true; this.ren.shadowMap.type = THREE.PCFSoftShadowMap;
    this.ren.toneMapping = THREE.ACESFilmicToneMapping; this.ren.toneMappingExposure = 1.05;
    this.ren.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(35, 1, 1, 100000); this.cam.up.set(0, 0, 1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8f8270, 0.55); this.scene.add(this.hemi);
    // 3.47.0: luz macia como num render: um estúdio pequeno (caixa cinza e três painéis de luz) vira o reflexo do ambiente
    // (PMREM, sem imagem). As faces ganham brilho suave e as quinas aparecem sem depender só do sol
    try {
      const pm = new THREE.PMREMGenerator(this.ren), rs = new THREE.Scene();
      rs.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x6f747b, side: THREE.BackSide })));
      const painel = (x, y, z, w, h, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); rs.add(m); };
      painel(0, 0, 4.9, 7, 7, 2.6); painel(-4.9, -2.5, 1.2, 3.5, 4, 1.8); painel(4.9, 2, 1.8, 3, 3, 1.1);
      this.scene.environment = pm.fromScene(rs, 0.04).texture; pm.dispose();
      rs.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    } catch (e) { /* sem PMREM: fica só a luz direta */ }
    this.sol = new THREE.DirectionalLight(0xffffff, 1.9); this.sol.castShadow = true; this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0004; this.sol.shadow.normalBias = 0.6; this.scene.add(this.sol); this.scene.add(this.sol.target);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.35); this.scene.add(this.fill);
    this.grupo = new THREE.Group(); this.scene.add(this.grupo);
    this.ok = true;
    this._mouse();
    // 3.32.0: o 3D só desenha enquanto aparece na tela (rolou para baixo, outra tela, janela minimizada: para)
    if (window.IntersectionObserver) new IntersectionObserver((es) => { const v = es.some((x) => x.isIntersecting); const volta = this.visivel === false && v; this.visivel = v; if (volta) this.draw(); }).observe(cv);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.draw(); });
    return true;
  },

  // um canvas só (o WebGL tem limite de contextos): cada tela nova só o coloca na caixa dela
  mount(box) {
    if (!this.cv) {
      const cv = document.createElement("canvas"); cv.className = "g3-cv";
      this.attach(cv);
      if (window.ResizeObserver) new ResizeObserver(() => this.draw()).observe(cv);
      // 3.48.0: Esc também sai da tela cheia feita sem a API do navegador (só a classe)
      document.addEventListener("keydown", (e) => { const b = this.box; if (e.key === "Escape" && b && !document.fullscreenElement && b.classList.contains("g3-cheia")) { b.classList.remove("g3-cheia"); this._cheiaTxt(b); this.draw(); } });
      document.addEventListener("fullscreenchange", () => { const b = this.box; if (b) { b.classList.toggle("g3-cheia", document.fullscreenElement === b); this._cheiaTxt(b); } this.draw(); });
    }
    this.box = box;
    if (this.cv.parentNode !== box) box.appendChild(this.cv);
    if (!box.querySelector(".g3-tools")) this._ferramentas(box);
    this.draw();
    return this.ok;
  },

  // 3.27.0 (enxugar o Gerador): à vista só Abrir portas, a vista pronta, Mais e Tela cheia; Girar, Raio-X, Cotas, Nomes,
  // o que ocultar e o material ficam no menu Mais (com a marca no que está ligado)
  _ferramentas(box) {
    const t = document.createElement("div"); t.className = "g3-tools";
    t.innerHTML = `<button type="button" class="g3-tg" data-g3="abrir" title="Abre e fecha todas as portas e gavetas. Dois cliques numa porta ou gaveta abre só ela" hidden>Abrir portas</button>`
      + `<select class="g3-sel" data-g3="vista" title="Vista pronta">${Object.entries({ "3d": "Vista 3D", frente: "Frente", lado: "Lado", cima: "De cima" }).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`
      + `<button type="button" class="g3-tg" data-g3="mais" title="Girar, Raio-X, Cotas, Nomes, ocultar partes e o material">Mais ▾</button>`
      + `<button type="button" class="g3-tg" data-g3="cheia" title="Usa o monitor inteiro (Esc volta)">Tela cheia</button>`;
    box.appendChild(t);
    // 3.48.0: na tela cheia, um botão Fechar à vista no canto (antes só o Esc ou o mesmo botão Tela cheia voltavam)
    const fe = document.createElement("button"); fe.type = "button"; fe.className = "g3-fechar"; fe.dataset.g3 = "cheia";
    fe.title = "Sai da tela cheia e volta para a tela de antes (Esc também volta)";
    fe.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>Fechar a tela cheia`;
    box.appendChild(fe);
    const nome = document.createElement("div"); nome.className = "g3-nome"; nome.hidden = true; box.appendChild(nome); this.nomeEl = nome;
    [...t.querySelectorAll("[data-g3]"), fe].forEach((b) => {
      const k = b.dataset.g3;
      b.addEventListener(b.tagName === "SELECT" ? "change" : "click", (e) => {
        if (k === "vista") { this.vista(b.value); return; }
        if (k === "abrir") { this.abrirTodas(); return; }
        if (k === "mais") { e.stopPropagation(); this._menuMais(b); return; }
        if (k === "cheia") {
          const semApi = () => { box.classList.toggle("g3-cheia"); this._cheiaTxt(box); };
          if (document.fullscreenElement) document.exitFullscreen();
          else if (box.classList.contains("g3-cheia")) semApi();             // a tela cheia sem a API do navegador
          else if (box.requestFullscreen) box.requestFullscreen().catch(semApi); else semApi();
          setTimeout(() => this.draw(), 80);
        }
      });
    });
  },
  _cheiaTxt(box) {
    const b = box.querySelector('.g3-tg[data-g3="cheia"]'); if (b) b.textContent = box.classList.contains("g3-cheia") ? "Sair da tela cheia" : "Tela cheia";
  },
  _menuMais(b) {
    const liga = (k, padrao) => () => { const on = g3Pref(k, padrao) !== "1"; g3Set(k, on ? "1" : "0"); if (k === "girar") this._loop(); else this._monta(); };
    const r = b.getBoundingClientRect();
    const oc = this.ocultaCat || "", mat = g3Pref("mat", "projeto");
    this.menu(r.left, r.bottom + 4, [
      ["Girar sozinho", liga("girar", "0"), "", false, g3Pref("girar", "0") === "1"],
      ["Raio-X (ver por dentro)", liga("raiox", "0"), "", false, g3Pref("raiox", "0") === "1"],
      ["Cotas", liga("cotas", "1"), "", false, g3Pref("cotas", "1") === "1"],
      ["Nomes das peças", liga("nomes", "0"), "", false, g3Pref("nomes", "0") === "1"],
      ...(this.cena && this.cena.sala ? [["Paredes e piso da sala", liga("sala", "1"), "", false, g3Pref("sala", "1") === "1"]] : []),
      "-",
      ...[["", "Mostrar tudo"], ["portas", "Sem portas e frentes"], ["aereos", "Sem os aéreos"], ["tampo", "Sem o tampo"], ["fundos", "Sem os fundos"]]
        .map(([k, t]) => [t, () => { this.ocultaCat = k; this._aplica(); this.draw(); }, "", false, oc === k]),
      "-",
      ...Object.entries(G3_MAT).map(([k, t]) => [`Material: ${t}`, () => { g3Set("mat", k); this._monta(); }, "", false, mat === k]),
    ]);
  },

  // 4.0 (Acabamento): a luz do ambiente, de dia, à tarde ou à noite (lâmpadas quentes por dentro)
  luz(k) {
    this.luzK = k; if (!this.sol || !this.hemi) return;
    const L = { dia: [0xffffff, 1.9, 0xffffff, 0.55, 0.35, 0xffffff], tarde: [0xffc58a, 1.45, 0xffe2c4, 0.42, 0.3, 0xffd9b0], noite: [0x9fb4ff, 0.35, 0x6d7aa6, 0.2, 0.9, 0xffc98c] }[k] || null; if (!L) return;
    this.sol.color.set(L[0]); this.sol.intensity = L[1]; this.hemi.color.set(L[2]); this.hemi.intensity = L[3]; if (this.fill) { this.fill.intensity = L[4]; this.fill.color.set(L[5]); }
    this.draw();
  },
  vista(k) {
    const v = Array.isArray(k) ? k : (G3_VISTA[k] || G3_VISTA["3d"]);
    const de = [this.yaw, this.pitch], t0 = performance.now();
    this._anim = (agora) => { const u = Math.min(1, (agora - t0) / 380), s = u * u * (3 - 2 * u); this.yaw = de[0] + (v[0] - de[0]) * s; this.pitch = de[1] + (v[1] - de[1]) * s; return u < 1; };
    if (this.caixa) { this.alvo = this.caixa.getCenter(new THREE.Vector3()).toArray(); const r = this.cv ? this.cv.getBoundingClientRect() : null, asp = r && r.height > 0 ? r.width / r.height : 1; this.dist = this.raio * 3.7 * Math.max(1, 1 / Math.max(0.3, asp)); }
    this._loop();
  },

  // 3.26.1 (pedido do usuário: "o mouse igual ao Promob"): rodinha aproxima (no ponto do mouse), rodinha pressionada
  // arrasta a vista, rodinha + botão (esquerdo ou direito) gira. Sem rodinha (notebook): botão esquerdo no vazio gira e
  // Shift + esquerdo arrasta. Clique seleciona (Montador), arrastar o módulo escolhido move, botão direito abre o menu,
  // dois cliques na porta ou na gaveta abre e fecha. Teclas: F6 tudo na tela, F8 ortogonal ou perspectiva, e as do editor.
  _mouse() {
    const cv = this.cv; cv.tabIndex = 0; let d = null;
    const modoDe = (e, hit) => {
      const b = e.buttons;
      if (b & 4) return (b & 1) || (b & 2) ? "girar" : "pan";
      if (b & 2) return "pan";
      const fe = this.ed && this.ed.ferr ? this.ed.ferr() : "esp";
      if (this.ed && hit && hit.mod >= 0 && !e.shiftKey && (b & 1)) {
        if (fe === "m") { if (hit.mod !== this.ed.sel) this.ed.seleciona(hit.mod); return "mover"; }       // M: pega e leva
        if (fe === "p" && this.ed.largura) { if (hit.mod !== this.ed.sel) this.ed.seleciona(hit.mod); return "empurra"; }   // P: puxa o lado mais perto
      }
      if (this.ed && hit && hit.mod >= 0 && hit.mod === this.ed.sel && !e.shiftKey && fe !== "t" && fe !== "d") return "mover";
      return e.shiftKey ? "pan" : "girar";
    };
    cv.addEventListener("mousedown", (e) => {
      e.preventDefault(); try { cv.focus({ preventScroll: true }); } catch (er) { /* sem foco */ }
      this.menuFecha();
      if (d) {                                         // segundo botão junto com o primeiro (rodinha + botão): muda o modo
        if (d.modo === "mover") return;
        Object.assign(d, { modo: modoDe(e, d.hit), x0: e.clientX, y0: e.clientY, yaw: this.yaw, pitch: this.pitch, alvo: this.alvo.slice() });
        return;
      }
      const hit = this._hit(e), alc = e.button === 0 ? this._hitAlca(e) : null;
      d = { x0: e.clientX, y0: e.clientY, yaw: this.yaw, pitch: this.pitch, alvo: this.alvo.slice(), hit, botao: e.button, moveu: false, alt: e.altKey };
      d.modo = alc && this.ed && this.ed.sel != null ? "alca" : modoDe(e, hit);
      if (d.modo === "alca") { d.lado = alc.lado; d.mod = this.ed.sel; d.dir = this.ed.dir(d.mod); d.p0 = alc.ponto; d.plano = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), alc.ponto); d.dL = 0; }
      if (d.modo === "empurra") {                     // o lado do módulo mais perto do clique vira a alça
        const ms = this.pecas.filter((p) => p.mod === hit.mod && p.mesh.visible); const bx = new THREE.Box3(); ms.forEach((p) => bx.expandByObject(p.mesh));
        const dir = this.ed.dir(hit.mod), c = bx.getCenter(new THREE.Vector3()), pt = new THREE.Vector3(...hit.ponto);
        d.modo = "alca"; d.lado = (pt.x - c.x) * dir[0] + (pt.y - c.y) * dir[1] >= 0 ? "dir" : "esq"; d.mod = hit.mod; d.dir = dir; d.p0 = pt;
        d.plano = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), pt); d.dL = 0;
      }
      if (d.modo === "mover") this._iniciaMover(d);
    });
    window.addEventListener("mousemove", (e) => {
      if (!d || !this.cena) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moveu && Math.abs(dx) + Math.abs(dy) < 4) return;
      d.moveu = true;
      if (d.modo === "girar") { this.yaw = d.yaw - dx * 0.008; this.pitch = Math.max(-1.45, Math.min(1.54, d.pitch + dy * 0.008)); }
      else if (d.modo === "pan") { const [ex, ey] = this._eixosTela(); const k = this.dist / 700; this.alvo = [0, 1, 2].map((i) => d.alvo[i] - ex[i] * dx * k + ey[i] * dy * k); }
      else if (d.modo === "mover") { this._mover(d, e); return; }
      else if (d.modo === "alca") {
        const p = new THREE.Vector3(); if (!this._raio(e).ray.intersectPlane(d.plano, p)) return;
        const bruto = (p.x - d.p0.x) * d.dir[0] + (p.y - d.p0.y) * d.dir[1];
        d.dL = this.ed.largura(d.mod, d.lado, d.lado === "dir" ? bruto : -bruto, e);
        this._alc = { mod: d.mod, lado: d.lado, dL: d.dL }; this._marcaSel(); this.draw(); return;
      }
      this.draw();
    });
    window.addEventListener("mouseup", (e) => {
      if (!d || e.buttons) return;                     // ainda há botão apertado (rodinha + botão)
      const fim = d; d = null;
      if (fim.modo === "mover" && fim.moveu) { this._soltaMover(fim); return; }
      if (fim.modo === "alca") { this._alc = null; if (fim.moveu) this.ed.larguraFim(fim.mod, fim.lado, fim.dL || 0); else { this._marcaSel(); this.draw(); } return; }
      if (fim.modo === "mover") { this._arr = null; this._aplica(); }
      if (fim.moveu) return;
      if (fim.botao === 2) { if (this.ed) this.ed.menu(fim.hit ? fim.hit.mod : -1, e.clientX, e.clientY, fim.hit); else this._menuSimples(fim.hit, e.clientX, e.clientY); return; }
      if (fim.botao === 0 && this.ed && this.ed.clique && this.ed.clique(fim.hit, this._ponto3d(e), e)) return;     // 4.0: Q, C, T, D, B
      if (fim.botao === 0 && this.onCota) { const cv = this._hitCota(e); if (cv != null) { this.onCota(cv); return; } }   // 3.32.0: cota clicável
      if (fim.botao === 0 && this.ed) this.ed.seleciona(fim.hit ? fim.hit.mod : -1);
    });
    cv.oncontextmenu = (e) => e.preventDefault();
    cv.addEventListener("auxclick", (e) => e.preventDefault());
    cv.addEventListener("mousemove", (e) => { if (!d) { this._aponta(e); if (this.medTemp) { this.medTemp.b = this._ponto3d(e); this._medidas(); this.draw(); } } });
    cv.addEventListener("mouseleave", () => { if (this.nomeEl) this.nomeEl.hidden = true; });
    cv.onwheel = (e) => {                              // aproxima no ponto do mouse, como o Promob
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.12 : 0.89, nd = Math.max(this.raio * 0.08, Math.min(this.raio * 14, this.dist * f));
      const p = this._pontoTela(e);
      if (p) { const t = 1 - nd / this.dist; this.alvo = [0, 1, 2].map((i) => this.alvo[i] + (p[i] - this.alvo[i]) * t); }
      this.dist = nd; this.draw();
    };
    cv.ondblclick = (e) => {
      const hit = this._hit(e);
      if (hit && hit.mod >= 0 && this.ed && this.ed.entra && this.ed.entra(hit.mod)) return;      // 4.0: dois cliques entram no módulo (Por dentro)
      if (hit && (hit.p.s.abre || hit.p.s.gav)) { this.alterna(hit.p); return; }
      if (hit && hit.mod >= 0 && this.ed) { this.enquadraMod(hit.mod); return; }
      this.enquadrar(true);
    };
    cv.addEventListener("keydown", (e) => this._tecla(e));
  },

  _camAtual() { return this.orto && this.camO ? this.camO : this.cam; },
  _raio(e) {
    const r = this.cv.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this._camAtual()); return rc;
  },
  _hitCota(e) {
    if (!this.cotas) return null;
    const sp = this.cotas.children.filter((o) => o.isSprite);
    const h = this._raio(e).intersectObjects(sp, false)[0];
    return h && h.object.userData.cota != null ? h.object.userData.cota : null;
  },
  // a peça debaixo do mouse: { p (a peça), mod (módulo do Montador ou -1), ponto }
  _hit(e) {
    if (!this.pecas || !this.pecas.length) return null;
    this.grupo.updateMatrixWorld(true);
    const ms = this.pecas.filter((p) => p.mesh.visible).map((p) => p.mesh);
    const h = this._raio(e).intersectObjects(ms, false)[0]; if (!h) return null;
    const p = this.pecas.find((q) => q.mesh === h.object);
    return p ? { p, mod: p.mod, ponto: [h.point.x, h.point.y, h.point.z] } : null;
  },
  // 4.0 (trena e cota solta): o ponto debaixo do mouse numa peça ou, sem peça, no chão
  _ponto3d(e) {
    const h = this._hit(e); if (h) return h.ponto;
    const rc = this._raio(e), p = new THREE.Vector3();
    return rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p) ? [p.x, p.y, p.z] : null;
  },
  // as medidas da trena (some com Esc) e as cotas soltas (ficam no ambiente): [{a, b, tipo "trena" | "cota"}]
  setMedidas(lista, temp) { this.medidas = lista || []; this.medTemp = temp || null; this._medidas(); this.draw(); },
  _medidas() {
    if (this.medG) { this.scene.remove(this.medG); this.medG.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.medG = null; }
    const todas = (this.medidas || []).concat(this.medTemp && this.medTemp.a && this.medTemp.b ? [Object.assign({ temp: true }, this.medTemp)] : []);
    if (!todas.length || !this.scene || this.modo === "pecas") return;
    const G = new THREE.Group(), sz = this.caixa ? this.caixa.getSize(new THREE.Vector3()).length() : 3000, h = Math.max(60, sz * 0.025);
    for (const m of todas) {
      if (!m.a || !m.b) continue;
      const A = new THREE.Vector3(...m.a), B = new THREE.Vector3(...m.b), dist = A.distanceTo(B);
      const cota = m.tipo === "cota", cor = cota ? 0x1f3a5f : 0xc2410c;
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), cota ? new THREE.LineBasicMaterial({ color: cor, depthTest: false, transparent: true }) : new THREE.LineDashedMaterial({ color: cor, dashSize: h * 0.5, gapSize: h * 0.3, depthTest: false, transparent: true }));
      if (!cota) ln.computeLineDistances(); ln.renderOrder = 22; G.add(ln);
      for (const q of [A, B]) { const pt = new THREE.Mesh(new THREE.SphereGeometry(h * 0.18, 12, 8), new THREE.MeshBasicMaterial({ color: cor, depthTest: false, transparent: true })); pt.position.copy(q); pt.renderOrder = 22; G.add(pt); }
      if (dist > 1) { const lb = g3Rotulo(String(Math.round(dist)).replace(/\B(?=(\d{3})+(?!\d))/g, "."), h, cota ? "#1f3a5f" : "#c2410c"); lb.position.copy(A.clone().add(B).multiplyScalar(0.5)); lb.position.z += h * 0.6; lb.renderOrder = 23; G.add(lb); }
    }
    this.scene.add(G); this.medG = G;
  },
  // o ponto da cena no plano que passa pelo alvo, de frente para a câmera (para aproximar onde o mouse está)
  _pontoTela(e) {
    const rc = this._raio(e), cam = this._camAtual(), n = new THREE.Vector3(); cam.getWorldDirection(n);
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(...this.alvo));
    const p = new THREE.Vector3(); return rc.ray.intersectPlane(pl, p) ? [p.x, p.y, p.z] : null;
  },
  _tecla(e) {
    if (e.key === "F6") { e.preventDefault(); this.enquadrar(true); return; }
    if (e.key === "F8") { e.preventDefault(); this.orto = !this.orto; this.draw(); return; }
    if (this.ed && this.ed.tecla(e)) e.preventDefault();
  },

  // nome da peça debaixo do mouse
  _aponta(e) {
    if (!this.nomeEl || !this.grupo) return;
    const r = this.cv.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this._camAtual());
    const hit = rc.intersectObjects(this.grupo.children.filter((o) => o.isMesh && o.visible), false)[0];
    if (hit && hit.object.userData.nome) {
      this.nomeEl.textContent = hit.object.userData.nome; this.nomeEl.hidden = false;
      this.nomeEl.style.left = (e.clientX - r.left + 14) + "px"; this.nomeEl.style.top = (e.clientY - r.top + 12) + "px";
    } else this.nomeEl.hidden = true;
  },

  _eixosTela() {
    const e = this._olho(), f = norm3(sub3(this.alvo, e)), x = norm3(cross3(f, [0, 0, 1])), y = cross3(x, f);
    return [x, y];
  },
  _olho() {
    const cp = Math.cos(this.pitch);
    return [this.alvo[0] + Math.cos(this.yaw) * cp * this.dist, this.alvo[1] + Math.sin(this.yaw) * cp * this.dist, this.alvo[2] + Math.sin(this.pitch) * this.dist];
  },

  show(cena, modo) {
    if (!this.ok || !cena) return;
    // a câmera fica onde o usuário deixou ao mudar uma medida; só reenquadra na primeira vez, ao trocar de modelo ou de
    // modo (quem chama manda enquadrar) ou no botão Enquadrar e no duplo clique
    this.cena = cena; this.modo = modo || this.modo; this._arr = null;
    this._monta();
    if (!this._enq) this.enquadrar(false);
  },

  _materiais() {
    if (!this._tex) this._tex = { madeira: g3Textura("madeira"), cru: g3Textura("cru"), branco: g3Textura("branco"), miolo: g3Textura("miolo") };
    const T = this._tex, std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.68, metalness: 0, envMapIntensity: 0.55, side: THREE.DoubleSide }, o));
    const pinta = { madeira: { map: T.madeira, color: 0xffffff }, cru: { map: T.cru, color: 0xffffff }, branco: { map: T.branco, color: 0xffffff },
      fundo: { map: T.branco, color: 0xe2d8c4 }, flex: { map: T.madeira, color: 0xf4e3cc } };
    const escolha = g3Pref("mat", "projeto");
    // 3.27.0: eletrodomésticos do Montador (só o volume): inox ou branco, não mudam com a escolha do material
    pinta.eletro_inox = { color: 0xc4c9cf, metalness: 0.55, roughness: 0.38 }; pinta.eletro_branco = { color: 0xf2f3f5, roughness: 0.5 }; pinta.eletro_obra = { color: 0xc9c4ba, roughness: 0.95 };
    const porCor = (cor) => {
      if (String(cor).startsWith("eletro_")) return pinta[cor] ? cor : "eletro_inox";
      if (escolha === "cru") return "cru"; if (escolha === "branco" || escolha === "laca") return cor === "fundo" ? "fundo" : "branco"; if (escolha === "madeira") return "madeira";
      return { caixa: "branco", frente: "madeira", fundo: "fundo", flex: "flex" }[cor] || "branco";
    };
    if (this._mcEscolha !== escolha) {                      // trocou o material: os da escolha anterior saem da memória
      for (const ms of Object.values(this._mc || {})) ms.forEach((x) => x.dispose());
      this._mc = {}; this._mcEscolha = escolha;
    }
    const cache = this._mc;
    return (cor, acab) => {
      // 4.0 (Acabamento): a cor do acabamento da peça; madeirado com o veio, pedra lisa e brilhante, unicolor fosco
      if (acab && acab.cor && escolha === "projeto") {
        const ka = "acab:" + acab.cor + ":" + (acab.tipo || "");
        if (!cache[ka]) {
          const c = new THREE.Color(acab.cor), mad = acab.tipo === "madeirado", ped = acab.tipo === "pedra";
          const face = std(mad ? { map: T.madeira, color: c.clone().multiplyScalar(1.75) } : { color: c, roughness: ped ? 0.28 : 0.62, metalness: ped ? 0.06 : 0 });
          const lado = std(mad ? { map: T.madeira, color: c.clone().multiplyScalar(1.55) } : { color: c.clone().multiplyScalar(0.9), roughness: ped ? 0.3 : 0.62 });
          cache[ka] = [face, lado, ped || acab.tipo === "unicolor" ? lado : std({ map: T.miolo, color: 0xffffff, roughness: 0.95 })];
        }
        return cache[ka];
      }
      const k = porCor(cor);
      if (!cache[k]) {
        const face = std(pinta[k]); const lado = std(Object.assign({}, pinta[k], { color: new THREE.Color(pinta[k].color).multiplyScalar(0.9) }));
        // laqueada: a porta é pintada depois de usinada, os cortes ficam da cor da face
        const miolo = k.startsWith("eletro_") ? face : escolha === "laca" ? std(Object.assign({}, pinta[k], { color: new THREE.Color(pinta[k].color).multiplyScalar(0.96) }))
          : std({ map: T.miolo, color: 0xffffff, roughness: 0.95 });
        cache[k] = [face, lado, miolo];
      }
      return cache[k];
    };
  },

  _limpa() {
    for (const o of this.grupo.children.slice()) {
      this.grupo.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.userData.matCompartilhado) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  },

  _monta() {
    if (!this.cena) return;
    this._limpa(); this.pecas = []; const vistos = {};
    const raiox = g3Pref("raiox", "0") === "1", matDe = this._materiais();
    const sol = this.modo === "pecas" ? this.cena.pecas : this.cena.montado;
    let i = 0;
    for (const s of sol || []) {
      const off = this.modo === "explodido" && s.expl ? s.expl : [0, 0, 0];
      let geo, pinta = [];
      if (s.tipo === "curva") { geo = g3Curva(s); }
      else if (s.tipo === "casca") { geo = g3Casca(s); }
      else { const r = g3Seguro(() => g3Peca(s), null); if (!r) continue; geo = r.geo; pinta = r.pinta; }
      let mats;
      if (raiox) {
        const c = G3_RAIOX[i % G3_RAIOX.length];
        const m1 = new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 });
        mats = [m1, m1, m1];
      } else { mats = matDe(s.cor, s.acab); }
      const mesh = new THREE.Mesh(geo, mats);
      mesh.userData.nome = s.nome || ""; mesh.userData.matCompartilhado = !raiox;
      mesh.castShadow = !raiox; mesh.receiveShadow = !raiox;
      const M = new THREE.Matrix4();
      if (s.tipo === "curva" || s.tipo === "casca") M.makeTranslation(off[0], off[1], off[2]);
      else { const o = s.o, u = s.u, v = s.v, n = s.n; M.set(u[0], v[0], n[0], o[0] + off[0], u[1], v[1], n[1], o[1] + off[1], u[2], v[2], n[2], o[2] + off[2], 0, 0, 0, 1); }
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(M); mesh.updateMatrixWorld(true);
      this.grupo.add(mesh);
      const edCor = raiox ? G3_RAIOX[i % G3_RAIOX.length] : 0x3b2a19, edOp = raiox ? 0.95 : 0.32;
      const ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), new THREE.LineBasicMaterial({ color: edCor, transparent: true, opacity: edOp }));
      ed.matrixAutoUpdate = false; ed.matrix.copy(M); this.grupo.add(ed);
      const mm = /^M(\d+)\s/.exec(s.nome || ""), nm = s.nome || "", ord = (vistos[nm] = (vistos[nm] || 0) + 1);
      const peca = { mesh, ed, pm: null, M: M.clone(), s, mod: mm ? +mm[1] - 1 : -1, chave: nm + "#" + ord, k: 0, edCor, edOp, so: this.modo !== "pecas" };
      this.pecas.push(peca);
      // o que é raso demais para cortar (gravação, código da peça): pintado na face
      if (pinta.length && s.tipo === "prisma") {
        const pm = new G3Malha();
        for (const d of pinta) {
          const z = d.verso ? -0.15 : (+s.esp || 18) + 0.15, lado = d.verso ? -1 : 1;
          if (d.tipo === "furo") pm.plano("face", [[g3Fecha(g3Circulo(d.c[0], d.c[1], d.r, 16))]], z, lado);
          else if (d.tipo === "linha") pm.plano("face", g3Faixa(d.pts, Math.max(1, d.w)), z, lado);
          else if (d.tipo === "area") pm.plano("face", [[g3Fecha(d.pts), ...(d.furos || []).map(g3Fecha)]], z, lado);
        }
        const pmesh = new THREE.Mesh(pm.geometria(), new THREE.MeshBasicMaterial({ color: 0x3a2a1c }));
        pmesh.matrixAutoUpdate = false; pmesh.matrix.copy(M); this.grupo.add(pmesh);
        peca.pm = pmesh; pmesh.userData.decal = true;
      }
      i++;
    }
    this._donos();
    this.caixa = new THREE.Box3().setFromObject(this.grupo);
    if (this.caixa.isEmpty()) this.caixa = null;
    // 3.27.2: o Montador vazio enquadra a sala (piso e altura das paredes)
    const sl = this.cena.sala;
    if (!this.caixa && sl && sl.piso && this.modo !== "pecas") {
      const h = Math.max(...(sl.paredes || []).map((p) => p.h), 2400);
      this.caixa = new THREE.Box3(new THREE.Vector3(sl.piso[0], Math.max(sl.piso[1], sl.piso[3] - 2500), 0), new THREE.Vector3(sl.piso[2], sl.piso[3], h * 0.6));
    }
    this._chao(); this._sala(); this._cotas(); this._nomes(); this._medidas();
    this._aplica();
    this.draw();
  },

  // ---------------------------------------------------------------- 3.26.1: abrir portas e gavetas, ocultar, editor do Montador
  // cada peça da caixa da gaveta acompanha a frente da mesma gaveta (a que tem o meio na altura dela, no mesmo módulo)
  _donos() {
    const ctr = (p) => new THREE.Box3().setFromObject(p.mesh).getCenter(new THREE.Vector3());
    const frentes = this.pecas.filter((p) => p.s.gav && /Frente de gaveta/i.test(p.s.nome || ""));
    frentes.forEach((f) => { const b = new THREE.Box3().setFromObject(f.mesh); f.z0 = b.min.z; f.z1 = b.max.z; f.dono = f; });
    this.pecas.filter((p) => p.s.gav && !frentes.includes(p)).forEach((p) => {
      const c = ctr(p); p.dono = frentes.find((f) => f.mod === p.mod && c.z >= f.z0 - 5 && c.z <= f.z1 + 5) || null;
    });
  },
  _alvoAberto(p) {
    if (this.modo === "pecas") return 0;
    const ref = p.s.gav ? p.dono : (p.s.abre ? p : null); if (!ref) return 0;
    const ab = (this.abrirTudo ? 1 : 0) ^ ((this.abertos || new Set()).has(ref.chave) ? 1 : 0);
    return ab ? 1 : 0;
  },
  // a porta gira na dobradiça (a basculante, na de cima); a gaveta corre para a frente
  _abreM(p, k) {
    const s = p.s, ref = p.s.gav ? p.dono : p, rs = ref.s;
    const out = [-rs.n[0], -rs.n[1], -rs.n[2]];                    // a frente do móvel: contra a espessura da frente
    if (s.gav) { const d = 360 * k; return new THREE.Matrix4().makeTranslation(out[0] * d, out[1] * d, out[2] * d); }
    const xs = s.pts.map((q) => q[0]), ys = s.pts.map((q) => q[1]), Lx = Math.max(...xs), Py = Math.max(...ys);
    const o = s.o, u = s.u, v = s.v, lado = s.abre || "esquerda";
    let eixo, H;
    if (lado === "superior") { eixo = u; H = [0, 1, 2].map((i) => o[i] + v[i] * Py); }
    else { eixo = v; H = [0, 1, 2].map((i) => o[i] + u[i] * (lado === "direita" ? Lx : 0)); }
    const ang = (lado === "superior" ? 80 : 100) * Math.PI / 180 * k;
    const meio = [0, 1, 2].map((i) => o[i] + u[i] * Lx / 2 + v[i] * Py / 2);
    const gira = (a) => new THREE.Matrix4().makeTranslation(H[0], H[1], H[2]).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...eixo).normalize(), a)).multiply(new THREE.Matrix4().makeTranslation(-H[0], -H[1], -H[2]));
    const teste = new THREE.Vector3(...meio).applyMatrix4(gira(0.3));
    const sinal = ((teste.x - meio[0]) * out[0] + (teste.y - meio[1]) * out[1] + (teste.z - meio[2]) * out[2]) >= 0 ? 1 : -1;
    return gira(ang * sinal);
  },
  _oculto(p) {
    if ((this.ocultosMod || new Set()).has(p.mod)) return true;
    if (this.camadasOff && this.camadasOff.size && this.ed && this.ed.camada && this.modo !== "pecas" && this.camadasOff.has(this.ed.camada(p))) return true;   // 4.0: Camadas
    if (g3Pref("eletros", "1") === "0" && String(p.s.cor || "").startsWith("eletro_") && p.s.cor !== "eletro_obra") return true;      // 4.0: Apresentar sem os eletrodomésticos
    const c = this.ocultaCat || "", nm = (p.s.nome || "").replace(/^M\d+\s+/, "");
    if (!c || this.modo === "pecas") return false;
    if (c === "portas") return !!p.s.abre || /^Frente de gaveta/i.test(nm);
    if (c === "aereos") return !!(this.ed && this.ed.tipo && this.ed.tipo(p.mod) === "aereo");
    if (c === "tampo") return /^Tampo/i.test(nm);
    if (c === "fundos") return /^Fundo/i.test(nm) && !/gaveta/i.test(nm);
    return false;
  },
  _aplica() {
    for (const p of this.pecas || []) {
      let M = p.M.clone();
      if (p.k > 0.001) M = this._abreM(p, p.k).multiply(M);
      if (this._arr && p.mod === this._arr.mod) M = new THREE.Matrix4().makeTranslation(...this._arr.off).multiply(M);
      const vis = !this._oculto(p);
      for (const o of [p.mesh, p.ed, p.pm]) if (o) { o.matrix.copy(M); o.matrixWorldNeedsUpdate = true; o.visible = vis; }
    }
    const ab = this.box && this.box.querySelector('[data-g3="abrir"]');
    if (ab) { ab.hidden = this.modo === "pecas" || !(this.pecas || []).some((p) => p.s.abre || p.s.gav); ab.classList.toggle("on", !!this.abrirTudo); }
    this._marcaSel();
  },
  // anda as portas e gavetas até o aberto ou fechado (chamado a cada quadro enquanto falta)
  _passoAbre() {
    // 3.27.0: pelo tempo (abre em 0,3 s), não por quadro: em computador fraco cada quadro demora e a porta se arrastava
    const agora = performance.now(), dt = this._tAbre ? Math.min(150, agora - this._tAbre) : 16, d = Math.max(0.05, dt / 300);
    this._tAbre = agora;
    let mais = false;
    for (const p of this.pecas || []) {
      const t = this._alvoAberto(p); if (Math.abs(p.k - t) < 0.001) { p.k = t; continue; }
      p.k += Math.sign(t - p.k) * Math.min(Math.abs(t - p.k), d); mais = true;
    }
    if (mais) this._aplica(); else this._tAbre = 0;
    return mais;
  },
  alterna(p) {
    const ref = p.s.gav ? p.dono : p; if (!ref) return;
    this.abertos = this.abertos || new Set();
    if (this.abertos.has(ref.chave)) this.abertos.delete(ref.chave); else this.abertos.add(ref.chave);
    this._loop();
  },
  abrirTodas(sim) { this.abrirTudo = sim === undefined ? !this.abrirTudo : !!sim; this.abertos = new Set(); this._loop(); const b = this.box && this.box.querySelector('[data-g3="abrir"]'); if (b) b.classList.toggle("on", this.abrirTudo); },
  abreMod(mod) {                                       // abre (ou fecha) as portas e gavetas de um módulo
    const refs = (this.pecas || []).filter((p) => p.mod === mod && (p.s.abre || (p.s.gav && p.dono === p)));
    this.abertos = this.abertos || new Set();
    const algum = refs.some((p) => this._alvoAberto(p) === 1);
    refs.forEach((p) => { const ab = this._alvoAberto(p) === 1; if (ab === algum) { if (this.abertos.has(p.chave)) this.abertos.delete(p.chave); else this.abertos.add(p.chave); } });
    this._loop();
  },
  ocultaMod(mod, sim) { this.ocultosMod = this.ocultosMod || new Set(); if (sim === undefined ? !this.ocultosMod.has(mod) : sim) this.ocultosMod.add(mod); else this.ocultosMod.delete(mod); this._aplica(); this.draw(); },
  mostraTudo() { this.ocultosMod = new Set(); this.ocultaCat = ""; const sl = this.box && this.box.querySelector('[data-g3="ocultar"]'); if (sl) sl.value = ""; this._aplica(); this.draw(); },
  // o módulo escolhido no Montador: linhas azuis e uma caixa em volta
  _marcaSel() {
    const sel = this.ed ? this.ed.sel : null;
    for (const p of this.pecas || []) {
      const on = sel != null && sel >= 0 && p.mod === sel;
      p.ed.material.color.set(on ? 0x2563eb : p.edCor); p.ed.material.opacity = on ? 1 : p.edOp;
    }
    if (this.selBox) { this.scene.remove(this.selBox); this.selBox.geometry.dispose(); this.selBox.material.dispose(); this.selBox = null; }
    if (this.selCotas) { this.scene.remove(this.selCotas); this.selCotas.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.selCotas = null; }
    if (sel == null || sel < 0 || this.semSel) return;          // 4.0: em Por dentro, sem a caixa azul e as alças
    const ms = (this.pecas || []).filter((p) => p.mod === sel && p.mesh.visible);
    if (!ms.length) return;
    this.grupo.updateMatrixWorld(true);
    const b = new THREE.Box3(); ms.forEach((p) => b.expandByObject(p.mesh));
    this.selBox = new THREE.Box3Helper(b.clone().expandByScalar(4), 0x2563eb); this.scene.add(this.selBox);
    this._cotasSel(sel, b);
  },
  // 3.47.0: as cotas do módulo escolhido, como no Promob: até o vizinho ou a ponta da parede de cada lado (na frente do
  // módulo, um pouco acima) e, no aéreo, a altura do chão. Acompanham o arrasto
  _cotasSel(sel, b) {
    if (!this.ed || !this.ed.folgas) return;
    const arr = this._arr && this._arr.mod === sel ? this._arr : null, al = this._alc && this._alc.mod === sel ? this._alc : null;
    const dirv = this.ed.dir(sel), dx = arr ? arr.off[0] * dirv[0] + arr.off[1] * dirv[1] : 0, dz = arr ? arr.off[2] : 0;
    const f = this.ed.folgas(sel, dx, dz, al ? al.dL : 0, al ? al.lado : ""); if (!f) return;
    const u = new THREE.Vector3(dirv[0], dirv[1], 0), nf = new THREE.Vector3(dirv[1], -dirv[0], 0);        // ao longo da parede e para a frente
    const cs = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) cs.push(new THREE.Vector3(x, y, 0));
    let s0 = Math.min(...cs.map((c) => c.dot(u))), s1 = Math.max(...cs.map((c) => c.dot(u)));
    const tf = Math.max(...cs.map((c) => c.dot(nf))) + 40, t0 = Math.min(...cs.map((c) => c.dot(nf)));
    if (al) { if (al.lado === "dir") s1 += al.dL; else s0 -= al.dL; }
    const cena = this.caixa ? this.caixa.getSize(new THREE.Vector3()).length() : b.getSize(new THREE.Vector3()).length();
    const h = Math.max(70, cena * 0.03);                    // o tamanho do número pela cena (pelo módulo saía pequeno)
    const G = new THREE.Group(), cor = 0xd97706;
    const P = (s, t, z) => u.clone().multiplyScalar(s).add(nf.clone().multiplyScalar(t)).setZ(z);
    const linha = (a, c, rot, cl = cor, ct = "#b45309") => {
      const g = new THREE.BufferGeometry().setFromPoints([a, c]);
      G.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: cl, depthTest: false, transparent: true })));
      for (const q of [a, c]) {
        const tq = new THREE.BufferGeometry().setFromPoints([q.clone().setZ(q.z - h * 0.6), q.clone().setZ(q.z + h * 0.6)]);
        G.add(new THREE.Line(tq, new THREE.LineBasicMaterial({ color: cl, depthTest: false, transparent: true })));
      }
      const sp = g3Rotulo(rot, h, ct); sp.position.copy(a.clone().add(c).multiplyScalar(0.5)); sp.position.z += h * 0.9; G.add(sp);
    };
    const zl = b.max.z + h * 1.2;
    linha(P(s0, tf, zl), P(s1, tf, zl), String(f.L), 0x2563eb, "#1d4ed8");          // a largura do módulo, sempre
    if (f.esq > 0.5) linha(P(s0 - f.esq, tf, zl), P(s0, tf, zl), String(f.esq));
    if (f.dir > 0.5) linha(P(s1, tf, zl), P(s1 + f.dir, tf, zl), String(f.dir));
    if (f.chao != null && f.chao > 0.5) linha(P(s0 - 20, tf, 0), P(s0 - 20, tf, b.min.z), String(f.chao));
    // as alças: arrastar muda a largura pelo lado (o Montador encosta no vizinho e na ponta da parede)
    const zm = (b.min.z + b.max.z) / 2, ra = Math.max(22, h * 0.32);
    this.alcas = [];
    for (const [lado, s] of [["esq", s0], ["dir", s1]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(ra, 20, 14), new THREE.MeshBasicMaterial({ color: 0x2563eb, depthTest: false, transparent: true, opacity: 0.95 }));
      m.position.copy(P(s, tf - 40, zm)); m.userData.alca = lado; G.add(m); this.alcas.push(m);
    }
    if (al) {                                                      // o tamanho novo enquanto arrasta
      const q = [P(s0, t0, b.min.z), P(s1, tf - 40, b.max.z)];
      const bx = new THREE.Box3().setFromPoints(q);
      G.add(new THREE.Box3Helper(bx, 0xd97706));
    }
    G.renderOrder = 20; G.children.forEach((o) => { o.renderOrder = 20; });
    this.scene.add(G); this.selCotas = G;
  },
  _hitAlca(e) {
    if (!this.alcas || !this.alcas.length || !this.ed) return null;
    if (this.selCotas) this.selCotas.updateMatrixWorld(true);      // recém-criadas: a posição no mundo só sai no próximo desenho
    const h = this._raio(e).intersectObjects(this.alcas, false)[0];
    return h ? { lado: h.object.userData.alca, ponto: h.object.position.clone() } : null;
  },
  marcaSel() { this._aplica(); this.draw(); },
  enquadraMod(mod) {
    const ms = (this.pecas || []).filter((p) => p.mod === mod && p.mesh.visible); if (!ms.length) return;
    this.grupo.updateMatrixWorld(true);
    const b = new THREE.Box3(); ms.forEach((p) => b.expandByObject(p.mesh));
    const c = b.getCenter(new THREE.Vector3()), r = Math.max(60, b.getSize(new THREE.Vector3()).length() / 2);
    const de = this.alvo.slice(), dd = this.dist, t0 = performance.now(), para = [c.x, c.y, c.z], nd = r * 3.4;
    this._anim = (agora) => { const u = Math.min(1, (agora - t0) / 380), k = u * u * (3 - 2 * u); this.alvo = de.map((x, i) => x + (para[i] - x) * k); this.dist = dd + (nd - dd) * k; return u < 1; };
    this._loop();
  },
  // arrastar o módulo escolhido: no chão, ao longo da parede dele (com Alt, o aéreo sobe e desce)
  _iniciaMover(d) {
    const dir = this.ed.dir(d.hit.mod); d.dir = dir; d.vert = d.alt && this.ed.sobe(d.hit.mod); d.livre = !d.vert && !!(this.ed.livre && this.ed.livre(d.hit.mod));
    const p0 = new THREE.Vector3(...d.hit.ponto); d.p0 = p0;
    const n = d.vert ? new THREE.Vector3(...dir).cross(new THREE.Vector3(0, 0, 1)).normalize() : new THREE.Vector3(0, 0, 1);
    d.plano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p0); d.mm = 0;
  },
  _mover(d, e) {
    const p = new THREE.Vector3(); if (!this._raio(e).ray.intersectPlane(d.plano, p)) return;
    if (d.livre) { d.dX = p.x - d.p0.x; d.dY = p.y - d.p0.y; this._arr = { mod: d.hit.mod, off: [d.dX, d.dY, 0] }; this._aplica(); this.draw(); return; }      // 4.0: a ilha anda no chão
    const bruto = d.vert ? p.z - d.p0.z : (p.x - d.p0.x) * d.dir[0] + (p.y - d.p0.y) * d.dir[1];
    d.mm = this.ed.arrasta(d.hit.mod, bruto, d.vert, e);
    this._arr = { mod: d.hit.mod, off: d.vert ? [0, 0, d.mm] : [d.dir[0] * d.mm, d.dir[1] * d.mm, 0] };
    this._aplica(); this.draw();
  },
  _soltaMover(d) {
    if (d.livre) { if (Math.hypot(d.dX || 0, d.dY || 0) < 0.5) { this._arr = null; this._aplica(); this.draw(); return; } this.ed.soltaLivre(d.hit.mod, d.dX || 0, d.dY || 0); return; }
    if (Math.abs(d.mm) < 0.5) { this._arr = null; this._aplica(); this.draw(); return; }
    this.ed.solta(d.hit.mod, d.mm, d.vert);        // a cena nova chega da prévia; até lá o módulo fica onde foi solto
  },
  // menu do botão direito (sem o Montador): abrir portas, mostrar tudo, enquadrar
  _menuSimples(hit, x, y) {
    const itens = [];
    if (hit && (hit.p.s.abre || hit.p.s.gav)) itens.push([this._alvoAberto(hit.p) ? "Fechar esta" : "Abrir esta", () => this.alterna(hit.p)]);
    itens.push([this.abrirTudo ? "Fechar todas as portas e gavetas" : "Abrir todas as portas e gavetas", () => this.abrirTodas()]);
    if ((this.ocultosMod && this.ocultosMod.size) || this.ocultaCat) itens.push(["Mostrar tudo", () => this.mostraTudo()]);
    itens.push(["Ver tudo na tela", () => this.enquadrar(true), "F6"]);
    this.menu(x, y, itens);
  },
  // menu flutuante: itens [texto, função, atalho, desligado]
  menu(x, y, itens) {
    this.menuFecha(); if (!this.box) return;
    const m = document.createElement("div"); m.className = "g3-menu";
    m.innerHTML = itens.map((it, i) => it === "-" ? `<hr>` : `<button type="button" data-i="${i}" ${it[3] ? "disabled" : ""} class="${it[4] === undefined ? "" : it[4] ? "marca on" : "marca"}"><span>${String(it[0]).replace(/[&<>]/g, "")}</span>${it[2] ? `<kbd>${it[2]}</kbd>` : ""}</button>`).join("");
    this.box.appendChild(m);
    const r = this.box.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x - r.left, r.width - mw - 4)) + "px"; m.style.top = Math.max(4, Math.min(y - r.top, r.height - mh - 4)) + "px";
    m.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { const it = itens[+b.dataset.i]; this.menuFecha(); it[1](); }));
    this._menuEl = m;
    setTimeout(() => { this._menuFora = (ev) => { if (!m.contains(ev.target)) this.menuFecha(); }; document.addEventListener("mousedown", this._menuFora, true); }, 0);
  },
  menuFecha() {
    if (this._menuEl) { this._menuEl.remove(); this._menuEl = null; }
    if (this._menuFora) { document.removeEventListener("mousedown", this._menuFora, true); this._menuFora = null; }
  },

  _chao() {
    if (this.chao) { this.scene.remove(this.chao); this.chao.geometry.dispose(); this.chao.material.dispose(); this.chao = null; }
    if (!this.caixa) return;
    // 3.46.0 (print do usuário: o chão redondo flutuando no meio da sala e a sombra cortada num triângulo escuro): com a sala
    // do Montador, o piso é o dela (sem o chão redondo) e a luz e a sombra cobrem a sala inteira, não só o móvel
    const sl = this.cena && this.cena.sala && this.modo !== "pecas" && g3Pref("sala", "1") === "1" ? this.cena.sala : null;
    const caixa = this.caixa.clone();
    if (sl && sl.piso) {
      const hp = Math.max(0, ...(sl.paredes || []).map((p) => +p.h || 0));
      caixa.expandByPoint(new THREE.Vector3(sl.piso[0], sl.piso[1], 0)); caixa.expandByPoint(new THREE.Vector3(sl.piso[2], sl.piso[3], hp || 2400));
    }
    const c = caixa.getCenter(new THREE.Vector3()), sz = caixa.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z, 200);
    const escuro = document.documentElement.dataset.theme === "dark";
    if (!sl) {
      const g = new THREE.Mesh(new THREE.CircleGeometry(r * 4, 64), new THREE.MeshStandardMaterial({ color: escuro ? 0x2a2f37 : 0xe6e9ee, roughness: 1 }));
      g.position.set(c.x, c.y, this.caixa.min.z - 0.4); g.receiveShadow = true; this.scene.add(g); this.chao = g;
    }
    const d = new THREE.Vector3(-0.95, -0.7, 0.85).normalize();      // luz de lado: marca relevo, frisos e furos
    this.sol.position.copy(c).addScaledVector(d, r * 3); this.sol.target.position.copy(c);
    const sc = this.sol.shadow.camera; sc.left = -r * 1.3; sc.right = r * 1.3; sc.top = r * 1.3; sc.bottom = -r * 1.3; sc.near = 1; sc.far = r * 8; sc.updateProjectionMatrix();
    this.fill.position.copy(c).addScaledVector(new THREE.Vector3(0.8, 0.6, 0.5).normalize(), r * 3);
  },

  // 3.27.0: a sala do Montador: as paredes (vistas só por dentro: de fora some, a câmera vê através) e o piso
  _sala() {
    if (this.salaG) { this.scene.remove(this.salaG); this.salaG.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.salaG = null; }
    const sl = this.cena && this.cena.sala;
    if (!sl || this.modo === "pecas" || g3Pref("sala", "1") !== "1" || (this.camadasOff && this.camadasOff.has("paredes"))) return;
    const G = new THREE.Group(), up = new THREE.Vector3(0, 0, 1);
    if (!this._texSala) this._texSala = { piso: g3Textura("piso"), parede: g3Textura("parede") };
    const texRep = (t, w, h, passo) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(w / passo, h / passo); return c; };   // 3.47.0: na medida da parede
    for (const pa of sl.paredes || []) {
      // 4.0 (Planta): a parede com as aberturas recortadas (porta, janela, passagem); a janela ganha o vidro
      const furos = (pa.furos || []).filter((f) => f.w > 1 && f.h > 1);
      let geo;
      if (furos.length) {
        const sh = new THREE.Shape(); sh.moveTo(-pa.w / 2, -pa.h / 2); sh.lineTo(pa.w / 2, -pa.h / 2); sh.lineTo(pa.w / 2, pa.h / 2); sh.lineTo(-pa.w / 2, pa.h / 2); sh.lineTo(-pa.w / 2, -pa.h / 2);
        for (const f of furos) {
          const x0 = Math.max(-pa.w / 2 + 1, f.x - pa.w / 2), x1 = Math.min(pa.w / 2 - 1, f.x + f.w - pa.w / 2), y0 = Math.max(-pa.h / 2 + 0.5, f.z - pa.h / 2), y1 = Math.min(pa.h / 2 - 1, f.z + f.h - pa.h / 2);
          if (x1 - x0 < 1 || y1 - y0 < 1) continue;
          const hp = new THREE.Path(); hp.moveTo(x0, y0); hp.lineTo(x0, y1); hp.lineTo(x1, y1); hp.lineTo(x1, y0); hp.lineTo(x0, y0); sh.holes.push(hp);
        }
        geo = new THREE.ShapeGeometry(sh);
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + pa.w / 2) / pa.w, (uv.getY(i) + pa.h / 2) / pa.h);
      } else geo = new THREE.PlaneGeometry(pa.w, pa.h);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: sl.cor_parede ? new THREE.Color(sl.cor_parede) : 0xffffff, map: texRep(this._texSala.parede, pa.w, pa.h, 900), roughness: 0.95, envMapIntensity: 0.3, side: THREE.FrontSide }));
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...pa.u), up, new THREE.Vector3(...pa.n));
      M.setPosition(pa.o[0] + pa.u[0] * pa.w / 2, pa.o[1] + pa.u[1] * pa.w / 2, pa.h / 2);
      m.matrixAutoUpdate = false; m.matrix.copy(M); m.receiveShadow = false; G.add(m);      // 3.46.0: sombra só no piso (na parede saía dura e escura)
      for (const f of furos.filter((q) => q.tipo === "janela")) {
        const vd = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), new THREE.MeshStandardMaterial({ color: 0xbfdcf0, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
        const Mv = new THREE.Matrix4().makeBasis(new THREE.Vector3(...pa.u), up, new THREE.Vector3(...pa.n));
        Mv.setPosition(pa.o[0] + pa.u[0] * (f.x + f.w / 2) - pa.n[0] * 40, pa.o[1] + pa.u[1] * (f.x + f.w / 2) - pa.n[1] * 40, f.z + f.h / 2);
        vd.matrixAutoUpdate = false; vd.matrix.copy(Mv); G.add(vd);
        const mold = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(f.w, f.h)), new THREE.LineBasicMaterial({ color: 0x8a96a6 })); mold.matrixAutoUpdate = false; mold.matrix.copy(Mv); G.add(mold);
      }
      const rp = new THREE.Mesh(new THREE.PlaneGeometry(pa.w, 6), new THREE.MeshStandardMaterial({ color: 0xd9d2c6, roughness: 0.9, side: THREE.FrontSide }));
      const M2 = M.clone(); M2.setPosition(pa.o[0] + pa.u[0] * pa.w / 2 + pa.n[0] * 0.5, pa.o[1] + pa.u[1] * pa.w / 2 + pa.n[1] * 0.5, 3);
      rp.matrixAutoUpdate = false; rp.matrix.copy(M2); G.add(rp);
    }
    // 4.0 (Planta): os pontos de obra na parede (tomada, água, esgoto, gás, luz, interruptor), na camada Pontos da obra
    if (!(this.camadasOff && this.camadasOff.has("pontos"))) {
      const COR = { tomada: 0xc2410c, agua: 0x0369a1, esgoto: 0x475569, gas: 0xa16207, luz: 0xca8a04, interruptor: 0x7c3aed };
      for (const q of sl.pontos || []) {
        const pm = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 8, 24), new THREE.MeshStandardMaterial({ color: COR[q.tipo] || 0x1f3a5f, roughness: 0.5 }));
        const ax = new THREE.Vector3(...q.n).normalize(), qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
        pm.quaternion.copy(qq); pm.position.set(q.p[0] + q.n[0] * 4, q.p[1] + q.n[1] * 4, q.p[2]); pm.userData.nome = { tomada: "Tomada", agua: "Água", esgoto: "Esgoto", gas: "Gás", luz: "Ponto de luz", interruptor: "Interruptor" }[q.tipo] || "Ponto"; G.add(pm);
      }
    }
    if (sl.piso) {
      const [x0, y0, x1, y1] = sl.piso;
      const pi = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshStandardMaterial({ color: sl.cor_piso ? new THREE.Color(sl.cor_piso) : 0xffffff, map: texRep(this._texSala.piso, x1 - x0, y1 - y0, 1800), roughness: 0.62, envMapIntensity: 0.45 }));
      pi.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.2); pi.receiveShadow = true; G.add(pi);
    }
    this.scene.add(G); this.salaG = G;
  },
  // o ponto do chão (z = 0) debaixo do mouse: onde soltar o item arrastado do catálogo do Montador
  pontoChao(e) {
    if (!this.ok) return null;
    const p = new THREE.Vector3();
    return this._raio(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p) ? [p.x, p.y] : null;
  },

  _cotas() {
    if (this.cotas) { this.scene.remove(this.cotas); this.cotas.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.cotas = null; }
    if (!this.caixa || g3Pref("cotas", "1") !== "1") return;
    const b = this.caixa, sz = b.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z, 100), off = r * 0.08, h = r * 0.075;
    const g = new THREE.Group(), mat = new THREE.LineBasicMaterial({ color: 0x1f3a5f, depthTest: false, transparent: true });
    const linha = (a, c) => { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...c)]), mat); ln.renderOrder = 9; g.add(ln); };
    const cota = (a, c, t, txt) => {           // a, c: pontas; t: direção do traço de chamada
      const A = a.map((v, i) => v + t[i] * off), C = c.map((v, i) => v + t[i] * off);
      linha(a, A.map((v, i) => v + t[i] * off * 0.3)); linha(c, C.map((v, i) => v + t[i] * off * 0.3)); linha(A, C);
      const lb = g3Rotulo(f(txt), h); lb.position.set((A[0] + C[0]) / 2, (A[1] + C[1]) / 2, (A[2] + C[2]) / 2); lb.userData.cota = txt; g.add(lb);
    };
    const f = (v) => (Math.round(v * 10) / 10).toLocaleString("pt-BR");
    const x0 = b.min.x, x1 = b.max.x, y0 = b.min.y, y1 = b.max.y, z0 = b.min.z, z1 = b.max.z;
    cota([x0, y0, z0], [x1, y0, z0], [0, -1, 0], sz.x);
    cota([x1, y0, z0], [x1, y1, z0], [1, 0, 0], sz.y);
    if (sz.z > 25) cota([x0, y0, z0], [x0, y0, z1], [-1, -1, 0].map((v) => v * 0.7071), sz.z);
    this.scene.add(g); this.cotas = g;
  },

  // nome de cada peça sobre ela (botão Nomes): no explodido, cada peça afastada com o nome dela
  _nomes() {
    if (this.nomes) { this.scene.remove(this.nomes); this.nomes.traverse((o) => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.nomes = null; }
    if (this.legEl) this.legEl.hidden = true;
    if (!this.caixa || g3Pref("nomes", "0") !== "1") return;
    // um número no meio de cada peça (peças iguais, o mesmo número) e a legenda com os nomes ao lado
    const sz = this.caixa.getSize(new THREE.Vector3()), h = Math.max(sz.x, sz.y, sz.z, 100) * 0.03, g = new THREE.Group(), num = new Map();
    for (const m of this.grupo.children) {
      if (!m.isMesh || !m.userData.nome) continue;
      const nome = m.userData.nome; if (!num.has(nome)) num.set(nome, num.size + 1);
      const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
      const lb = g3Rotulo(String(num.get(nome)), h, "#be185d"), ratio = lb.scale.x / lb.scale.y;
      lb.material.sizeAttenuation = false; lb.scale.set(0.027 * ratio, 0.027, 1);     // mesmo tamanho na tela, perto ou longe
      lb.position.copy(c); g.add(lb);
    }
    this.scene.add(g); this.nomes = g;
    if (this.box) {
      // a legenda fica embaixo do desenho, não por cima (na prévia estreita ela tampava as peças)
      if (!this.legEl) { this.legEl = document.createElement("div"); this.legEl.className = "g3-legenda"; }
      if (this.legEl.previousElementSibling !== this.box) this.box.insertAdjacentElement("afterend", this.legEl);
      this.legEl.innerHTML = [...num.entries()].map(([n, k]) => `<span><b>${k}</b>${n.replace(/[&<>]/g, "")}</span>`).join("");
      this.legEl.hidden = false;
    }
  },

  enquadrar(anima) {
    if (!this.caixa) return;
    const c = this.caixa.getCenter(new THREE.Vector3()), sz = this.caixa.getSize(new THREE.Vector3());
    this.alvo = [c.x, c.y, c.z];
    this.raio = Math.max(50, sz.length() / 2);
    // 3.25.1: na coluna estreita (prévia ao lado do desenho, tela em pé) o campo de visão na largura é menor: afasta a câmera
    const r = this.cv ? this.cv.getBoundingClientRect() : null, asp = r && r.height > 0 ? r.width / r.height : 1;
    this.dist = this.raio * 3.7 * Math.max(1, 1 / Math.max(0.3, asp)); this._enq = true;
    if (anima !== undefined) { const v = this.modo === "pecas" ? [-1.35, 1.0] : G3_VISTA["3d"]; this.yaw = v[0]; this.pitch = v[1]; }
    this.draw();
  },

  _loop() {
    cancelAnimationFrame(this._raf);
    const passo = (agora) => {
      if (this.visivel === false || document.hidden) return;        // 3.32.0: fora da tela o 3D para; volta ao aparecer
      let mais = false;
      if (this._anim) { if (!this._anim(agora)) this._anim = null; else mais = true; }
      if (this._passoAbre()) mais = true;
      if (g3Pref("girar", "0") === "1") { this.yaw += 0.0045; mais = true; }
      this._draw();
      if (mais) this._raf = requestAnimationFrame(passo);
    };
    this._raf = requestAnimationFrame(passo);
  },

  draw() {
    if (!this.ok || this.visivel === false) return;
    if (g3Pref("girar", "0") === "1" || this._anim || (this.pecas || []).some((p) => Math.abs(p.k - this._alvoAberto(p)) > 0.001)) { this._loop(); return; }
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._draw());
  },

  _draw() {
    const cv = this.cv; if (!cv || !this.ren) return;
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const dpr = this._dpr1 ? 1 : Math.min(2, window.devicePixelRatio || 1);   // a foto do cartão (360 x 270) não precisa de tela de alta densidade
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { this.ren.setPixelRatio(dpr); this.ren.setSize(w, h, false); }
    const escuro = document.documentElement.dataset.theme === "dark";
    this.scene.background = new THREE.Color(escuro ? 0x1d2127 : 0xf2f4f7);
    const e = this._olho();
    this.cam.aspect = w / h; this.cam.near = Math.max(1, this.dist / 60); this.cam.far = this.dist * 30; this.cam.updateProjectionMatrix();
    this.cam.position.set(e[0], e[1], e[2]); this.cam.lookAt(this.alvo[0], this.alvo[1], this.alvo[2]);
    if (this.orto) {                                   // F8: ortogonal, do mesmo tamanho que a perspectiva no alvo
      if (!this.camO) { this.camO = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100000); this.camO.up.set(0, 0, 1); }
      const hh = this.dist * Math.tan(35 * Math.PI / 360), ww = hh * w / h;
      Object.assign(this.camO, { left: -ww, right: ww, top: hh, bottom: -hh, near: -this.dist * 30, far: this.dist * 30 });
      this.camO.position.set(e[0], e[1], e[2]); this.camO.lookAt(this.alvo[0], this.alvo[1], this.alvo[2]); this.camO.updateProjectionMatrix();
      this.ren.render(this.scene, this.camO); return;
    }
    this.ren.render(this.scene, this.cam);
  },
};
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
window.ger3d = ger3d; window.Tri = Tri;
