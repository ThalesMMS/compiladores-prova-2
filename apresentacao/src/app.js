/* ===================== utilidades ===================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;
const nextId = (p = 'id') => `${p}${++uid}`;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(c));
  return e;
}
function sv(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(c));
  return e;
}
const CH = 7.25; // largura de um caractere monoespaçado a 12px

/* Controles de passo a passo reutilizados por todos os simuladores. */
function makeStepper(host, count, render, opts = {}) {
  if (count <= 0) { host.append(el('p', { class: 'stepinfo' }, 'Nada para mostrar.')); return { go() {}, k: 0, stop() {} }; }
  let k = opts.start ?? 0;
  let timer = null;
  const info = el('span', { class: 'stepinfo' });
  const first = el('button', { class: 'btn', type: 'button', title: 'Início', 'aria-label': 'Voltar ao início' }, '⏮');
  const prev = el('button', { class: 'btn', type: 'button', 'aria-label': 'Passo anterior' }, '◀ Voltar');
  const next = el('button', { class: 'btn primary', type: 'button', 'aria-label': 'Próximo passo' }, 'Avançar ▶');
  const last = el('button', { class: 'btn', type: 'button', title: 'Fim', 'aria-label': 'Ir ao fim' }, '⏭');
  const play = el('button', { class: 'btn', type: 'button' }, '▷ Animar');
  const bar = el('div', { class: 'toolbar' }, first, prev, next, last, play, info);
  host.append(bar);
  const stop = () => { if (timer) { clearInterval(timer); timer = null; play.textContent = '▷ Animar'; } };
  const go = (i) => {
    k = Math.max(0, Math.min(count - 1, i));
    info.textContent = `passo ${k + 1} de ${count}`;
    first.disabled = prev.disabled = k === 0;
    next.disabled = last.disabled = k === count - 1;
    render(k);
  };
  first.onclick = () => { stop(); go(0); };
  prev.onclick = () => { stop(); go(k - 1); };
  next.onclick = () => { stop(); go(k + 1); };
  last.onclick = () => { stop(); go(count - 1); };
  play.onclick = () => {
    if (timer) return stop();
    if (k === count - 1) go(0);
    play.textContent = '❚❚ Pausar';
    timer = setInterval(() => { if (k >= count - 1) stop(); else go(k + 1); }, opts.ms || 1100);
  };
  go(k);
  return { go, get k() { return k; }, stop };
}

function seg(options, value, onChange) {
  const wrap = el('div', { class: 'seg', role: 'group' });
  const btns = options.map(([v, label]) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(v === value) }, label);
    b.onclick = () => { btns.forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onChange(v); };
    wrap.append(b);
    return b;
  });
  return wrap;
}

/* Centraliza no quadro rolável o nó em foco (estado atual, nó novo ou visitado). */
function scrollToFocus(box) {
  const f = box.querySelector('.tn.focus, .tn.new, .dg-node.cur');
  if (!f || box.scrollWidth <= box.clientWidth + 2) return;
  const cr = box.getBoundingClientRect();
  const fr = f.getBoundingClientRect();
  box.scrollLeft += fr.left + fr.width / 2 - (cr.left + cr.width / 2);
}

/* ===================== exemplos de gramática ===================== */
const EXAMPLES = {
  ex1: { grammar: 'CN -> CN tick tock | tick tock', opts: {}, input: 'tick tock tick tock' },
  ex2: { grammar: 'Start -> S\nS -> A a\nA -> B C | B C f\nB -> b\nC -> c', opts: { termOrder: ['a', 'b', 'c', 'f'] }, input: 'b c f a' },
  cmd: {
    grammar: 'Cmd -> Lhs = Rhs | Rhs\nLhs -> * Rhs | id\nRhs -> Lhs',
    opts: { termOrder: ['id', '=', '*'], startName: 'Start' },
    paths: ['', 'Cmd', 'Lhs', 'Rhs', '*', 'id', 'Lhs =', '* Rhs', '* Lhs', 'Lhs = Rhs', 'Lhs = Lhs', 'Lhs = id', 'Lhs = *', 'Lhs = * Rhs'],
    input: 'id = * * id',
  },
  robo: { grammar: 'S -> ↓ S | ↓ B ↑ S | ε\nB -> ↓ B ↑ B | ε', opts: { startName: 'Goal' }, input: '↓ ↑ ↓' },
  ex4: { grammar: 'Start -> A | B\nA -> ( A ) | a\nB -> ( B } | b', opts: { termOrder: ['(', ')', '}', 'a', 'b'] }, input: '( ( a ) )' },
  expr: { grammar: 'E -> E + T | E - T | T\nT -> ( E ) | intLit | floatLit', opts: {} },
  posf: { grammar: 'E -> E + T | T\nT -> T * F | F\nF -> intLit', opts: {} },
  bin: { grammar: 'Number -> Sign List\nSign -> + | -\nList -> List Bit | Bit\nBit -> 0 | 1', opts: {} },
};
const modelCache = new Map();
function buildModel(spec) {
  const G = LR.parseGrammar(spec.grammar, spec.opts);
  const C0 = LR.buildCollection(G, 'lr0');
  const C1 = LR.buildCollection(G, 'lr1', spec.paths ? { statePaths: spec.paths } : {});
  const CL = LR.mergeLALR(C1);
  const tables = {
    lr0: LR.buildTable(C0, 'lr0'), slr: LR.buildTable(C0, 'slr'), lr1: LR.buildTable(C1, 'lr1'), lalr: LR.buildTable(CL, 'lalr'),
  };
  return { spec, G, C: { lr0: C0, slr: C0, lr1: C1, lalr: CL }, T: tables };
}
function model(key) {
  if (!modelCache.has(key)) modelCache.set(key, buildModel(EXAMPLES[key]));
  return modelCache.get(key);
}
const METHOD_NAME = { lr0: 'LR(0)', slr: 'SLR(1)', lr1: 'LR(1)', lalr: 'LALR(1)' };
const ccName = (C, i) => `CC${LR.stateLabel(C, i)}`;
const rawItem = (G, it) => {
  const t = LR.prodText(G, G.prods[it.p], it.d);
  return it.la == null ? t : `[${t}, ${it.la}]`;
};

/* ===================== autômato (SVG) ===================== */
function basisPath(pts) {
  let d = '';
  let x0, y0, x1, y1;
  let n = 0;
  const bez = (x, y) => {
    d += `C${(2 * x0 + x1) / 3},${(2 * y0 + y1) / 3} ${(x0 + 2 * x1) / 3},${(y0 + 2 * y1) / 3} ${(x0 + 4 * x1 + x) / 6},${(y0 + 4 * y1 + y) / 6}`;
  };
  for (const { x, y } of pts) {
    if (n === 0) { d += `M${x},${y}`; n = 1; }
    else if (n === 1) n = 2;
    else if (n === 2) { n = 3; d += `L${(5 * x0 + x1) / 6},${(5 * y0 + y1) / 6}`; bez(x, y); }
    else bez(x, y);
    x0 = x1; x1 = x; y0 = y1; y1 = y;
  }
  if (n === 3) { bez(x1, y1); d += `L${x1},${y1}`; } else if (n === 2) d += `L${x1},${y1}`;
  return d;
}

function nodeLines(C, i, mode) {
  const G = C.G;
  const groups = LR.groupItems(C, C.states[i].items);
  const shown = mode === 'kernel' ? groups.filter((g) => g.kernel) : groups;
  return shown.map((g) => {
    const complete = g.d === G.prods[g.p].rhs.length;
    return { text: LR.itemText(C, g), kernel: g.kernel, cls: complete ? (g.p === 0 ? 'accept' : 'complete') : (g.kernel ? '' : 'closure') };
  });
}

function layoutGraph(nodes, edges, rankdir) {
  if (window.dagre) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir, nodesep: 22, ranksep: 54, edgesep: 14, marginx: 16, marginy: 16 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach((n) => g.setNode(String(n.id), { width: n.w, height: n.h }));
    edges.forEach((e) => g.setEdge(String(e.from), String(e.to), { label: e.label, width: e.label.length * CH + 10, height: 18, labelpos: 'c' }));
    dagre.layout(g);
    const pos = {};
    nodes.forEach((n) => { const p = g.node(String(n.id)); pos[n.id] = { x: p.x, y: p.y }; });
    const ep = edges.map((e) => { const d = g.edge(String(e.from), String(e.to)); return { points: d.points, lx: d.x, ly: d.y }; });
    const gr = g.graph();
    return { pos, ep, W: gr.width, H: gr.height };
  }
  // Alternativa sem biblioteca: colunas por distância (BFS) a partir do estado 0.
  const dist = { [nodes[0].id]: 0 };
  const q = [nodes[0].id];
  while (q.length) {
    const v = q.shift();
    for (const e of edges) if (e.from === v && dist[e.to] === undefined) { dist[e.to] = dist[v] + 1; q.push(e.to); }
  }
  const ranks = [];
  nodes.forEach((n) => { const r = dist[n.id] ?? 0; (ranks[r] ||= []).push(n); });
  const pos = {};
  let x = 16;
  let H = 0;
  ranks.forEach((col) => {
    const w = Math.max(...col.map((n) => n.w));
    let y = 16;
    col.forEach((n) => { pos[n.id] = { x: x + w / 2, y: y + n.h / 2 }; y += n.h + 26; });
    H = Math.max(H, y);
    x += w + 90;
  });
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const ep = edges.map((e) => {
    const a = pos[e.from];
    const b = pos[e.to];
    const na = byId[e.from];
    if (e.from === e.to) {
      const top = a.y - na.h / 2;
      const pts = [{ x: a.x - 14, y: top }, { x: a.x - 18, y: top - 26 }, { x: a.x + 18, y: top - 26 }, { x: a.x + 14, y: top }];
      return { points: pts, lx: a.x, ly: top - 30 };
    }
    const fw = b.x > a.x;
    const s = { x: a.x + (fw ? na.w / 2 : 0), y: a.y + (fw ? 0 : na.h / 2) };
    const t = { x: b.x - (fw ? byId[e.to].w / 2 : 0), y: b.y + (fw ? 0 : byId[e.to].h / 2) };
    const m = { x: (s.x + t.x) / 2, y: fw ? (s.y + t.y) / 2 : Math.max(s.y, t.y) + 40 };
    return { points: [s, m, t], lx: m.x, ly: m.y };
  });
  return { pos, ep, W: x, H: H + 40 };
}

/* Desenha o autômato. opts: mode, rankdir, selected, visible(Set), visibleEdges(Set "i|X"), current {state, edge}, onSelect */
function drawAutomaton(host, C, opts = {}) {
  const mode = opts.mode || 'full';
  const nodes = C.states.map((st, i) => {
    const lines = mode === 'label' ? [] : nodeLines(C, i, mode);
    const title = ccName(C, i);
    const w = Math.max(title.length * 8 + 20, ...lines.map((l) => l.text.length * CH + 20), 56);
    const kernelCount = lines.filter((l) => l.kernel).length;
    const h = 24 + lines.length * 16 + (lines.length ? 8 : 4) + (kernelCount && kernelCount < lines.length ? 4 : 0);
    return { id: i, w, h, lines, title, acc: C.states[i].items.some((it) => it.p === 0 && it.d === 1) };
  });
  const edges = [];
  C.trans.forEach((t, i) => Object.entries(t).forEach(([X, j]) => edges.push({ from: i, to: j, label: X, nt: C.G.isNT(X) })));
  const L = layoutGraph(nodes, edges, opts.rankdir || 'LR');
  const mid = nextId('m');
  const svg = sv('svg', { viewBox: `0 0 ${L.W} ${L.H}`, width: L.W, height: L.H, role: 'img', 'aria-label': 'Autômato LR' });
  svg.append(sv('defs', {},
    sv('marker', { id: mid, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, sv('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrowhead' })),
    sv('marker', { id: mid + 'c', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, sv('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrowhead cur' })),
  ));
  const eg = sv('g');
  edges.forEach((e, k) => {
    const visible = !opts.visibleEdges || opts.visibleEdges.has(`${e.from}|${e.label}`);
    const cur = opts.current && opts.current.edge && opts.current.edge[0] === e.from && opts.current.edge[1] === e.label;
    const g = sv('g', { class: `dg-edge${e.nt ? ' nt' : ''}${visible ? '' : ' ghost'}${cur ? ' cur' : ''}` });
    g.append(sv('path', { d: basisPath(L.ep[k].points), 'marker-end': `url(#${cur ? mid + 'c' : mid})` }));
    const lw = e.label.length * CH + 8;
    g.append(sv('rect', { x: L.ep[k].lx - lw / 2, y: L.ep[k].ly - 9, width: lw, height: 18, rx: 4 }));
    g.append(sv('text', { x: L.ep[k].lx, y: L.ep[k].ly + 4, 'text-anchor': 'middle' }, e.label));
    eg.append(g);
  });
  svg.append(eg);
  nodes.forEach((n) => {
    const p = L.pos[n.id];
    const x = p.x - n.w / 2;
    const y = p.y - n.h / 2;
    const visible = !opts.visible || opts.visible.has(n.id);
    const cls = ['dg-node'];
    if (opts.onSelect) cls.push('click');
    if (!visible) cls.push('ghost');
    if (opts.selected === n.id) cls.push('sel');
    if (opts.current && opts.current.state === n.id) cls.push('cur');
    if (n.acc) cls.push('acc');
    const g = sv('g', { class: cls.join(' '), tabindex: opts.onSelect ? 0 : null, role: opts.onSelect ? 'button' : null, 'aria-label': n.title });
    g.append(sv('rect', { class: 'box', x, y, width: n.w, height: n.h, rx: 8 }));
    g.append(sv('rect', { class: 'hd', x: x + 1, y: y + 1, width: n.w - 2, height: 21, rx: 7 }));
    g.append(sv('text', { class: 'title', x: x + 10, y: y + 16 }, n.title));
    let yy = y + 24 + 13;
    let sepDone = false;
    n.lines.forEach((l) => {
      if (!l.kernel && !sepDone && n.lines.some((q) => q.kernel)) {
        g.append(sv('line', { class: 'sep', x1: x + 6, x2: x + n.w - 6, y1: yy - 11, y2: yy - 11 }));
        yy += 4;
        sepDone = true;
      }
      g.append(sv('text', { x: x + 10, y: yy, class: l.cls || null }, l.text));
      yy += 16;
    });
    if (opts.onSelect) {
      g.addEventListener('click', () => opts.onSelect(n.id));
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); opts.onSelect(n.id); } });
    }
    svg.append(g);
  });
  host.replaceChildren(svg);
  if (host.classList.contains('diagram')) scrollToFocus(host);
  return svg;
}

function automatonBox(C, opts = {}) {
  const wrap = el('div');
  let mode = opts.mode || 'full';
  let fit = false;
  const diag = el('div', { class: 'diagram' });
  const detail = el('div');
  let selected = opts.selected ?? null;
  const redraw = () => {
    drawAutomaton(diag, C, { ...opts, mode, selected, onSelect: (i) => { selected = i; redraw(); showDetail(i); opts.onSelect && opts.onSelect(i); } });
  };
  const showDetail = (i) => detail.replaceChildren(stateDetail(C, i, opts.table));
  const tools = el('div', { class: 'toolbar' },
    seg([['full', 'Itens completos'], ['kernel', 'Só o núcleo']], mode, (v) => { mode = v; redraw(); }),
    el('button', { class: 'btn', type: 'button', onclick: (ev) => { fit = !fit; diag.classList.toggle('fit', fit); ev.currentTarget.textContent = fit ? 'Tamanho real' : 'Ajustar à largura'; } }, 'Ajustar à largura'),
    el('span', { class: 'stepinfo' }, `${C.states.length} estados · toque num estado para ver os detalhes`));
  wrap.append(tools, diag, detail);
  redraw();
  if (selected != null) showDetail(selected);
  return { el: wrap, redraw, select: (i) => { selected = i; redraw(); showDetail(i); } };
}

function itemListEl(C, items, opts = {}) {
  const groups = LR.groupItems(C, items);
  const ul = el('ul', { class: 'itemlist' });
  let sep = false;
  groups.forEach((g) => {
    const li = el('li', {}, LR.itemText(C, g));
    if (!g.kernel && !sep && groups.some((q) => q.kernel)) { li.classList.add('sepk'); sep = true; }
    if (opts.hl && opts.hl(g)) li.classList.add('hl');
    ul.append(li);
  });
  return ul;
}

function stateDetail(C, i, T) {
  const G = C.G;
  const st = C.states[i];
  const card = el('div', { class: 'statecard', style: 'margin-top:10px' });
  card.append(el('h4', {}, ccName(C, i)));
  let origin = '';
  if (i === 0) origin = `closure({${rawItem(G, st.kernel[0])}}) — estado inicial`;
  else if (st.via) origin = `goto(${ccName(C, st.via.from)}, ${st.via.sym})`;
  else if (st.members) origin = st.members.length > 1 ? `fusão LALR dos estados LR(1) ${st.members.map((m) => 'CC' + m).join(' e ')} (mesmo núcleo)` : `estado LR(1) CC${st.members[0]} (nenhum outro com o mesmo núcleo)`;
  card.append(el('p', { class: 'stepinfo' }, `Origem: ${origin}`));
  card.append(el('div', { class: 'scroll-x' }, itemListEl(C, st.items)));
  const tr = Object.entries(C.trans[i]);
  if (tr.length) card.append(el('p', { style: 'margin:8px 0 0;font-size:.9rem' }, 'Transições: ', tr.map(([X, j]) => `${X} → ${ccName(C, j)}`).join(' · ')));
  else card.append(el('p', { style: 'margin:8px 0 0;font-size:.9rem' }, 'Sem transições saindo deste estado.'));
  if (T) {
    const acts = [];
    for (const t of G.terms) { const cell = T.action[i][t]; if (cell) acts.push(`${t}: ${cell.map((e) => LR.actionText(e, C)).join(' / ')}`); }
    card.append(el('p', { style: 'margin:4px 0 0;font-size:.9rem' }, `Linha da tabela: ${acts.join(' · ') || 'só erros'}`));
  }
  return card;
}

/* ===================== tabela Ações/Goto ===================== */
function cellWhy(T, s, sym) {
  const { C, G, method } = T;
  const name = ccName(C, s);
  if (G.isNT(sym)) {
    const j = T.go[s][sym];
    if (j === undefined) return `<p>Goto[${name}, ${esc(sym)}] vazio: nenhum item de ${name} tem o ponto antes de ${esc(sym)}.</p>`;
    return `<p><b>g${esc(LR.stateLabel(C, j))}</b>: transição por não terminal. goto(${name}, ${esc(sym)}) = ${ccName(C, j)}. É consultado logo depois de uma redução para ${esc(sym)}.</p>`;
  }
  const cell = T.action[s][sym];
  if (!cell) return `<p>Célula vazia = <b>erro</b>. Nenhum item de ${name} desloca <code>${esc(sym)}</code> e nenhum item completo tem <code>${esc(sym)}</code> como lookahead${method === 'slr' ? ' (no FOLLOW)' : ''}.</p>`;
  const parts = cell.map((e) => {
    const its = [...new Set(e.why.map((it) => rawItem(G, it)))].map((t) => `<span class="item">${esc(t)}</span>`).join(' ');
    if (e.type === 's') return `<p><b class="a-s">s${esc(LR.stateLabel(C, e.n))}</b> (desloca): ${name} tem ${its}, com o ponto antes de <code>${esc(sym)}</code>; goto(${name}, ${esc(sym)}) = ${ccName(C, e.n)}.</p>`;
    if (e.type === 'acc') return `<p><b class="a-acc">acc</b>: ${its} é a produção aumentada completa. Aceita quando o próximo token é eof.</p>`;
    const p = G.prods[e.n];
    let rule;
    if (method === 'lr0') rule = 'No LR(0) a redução ocupa <b>todas</b> as colunas de terminais.';
    else if (method === 'slr') rule = `No SLR a redução vai para as colunas de FOLLOW(${esc(p.lhs)}) = {${[...G.FOLLOW[p.lhs]].map(esc).join(', ')}}.`;
    else rule = `No ${METHOD_NAME[method]} a redução vai só para a coluna do lookahead do item (<code>${esc(sym)}</code>).`;
    return `<p><b class="a-r">r${e.n}</b> (reduz ${esc(LR.prodText(G, p))}): ${name} tem o item completo ${its}. ${rule}</p>`;
  });
  const conflict = cell.length > 1 ? `<p class="bad">Conflito ${cell.every((e) => e.type === 'r') ? 'reduce/reduce' : 'shift/reduce'}: duas ações na mesma célula. A gramática não é ${METHOD_NAME[method]}.</p>` : '';
  return conflict + parts.join('');
}

function tableBox(T, opts = {}) {
  const { C, G } = T;
  const nts = G.nonterms.slice(1);
  const wrap = el('div');
  const tw = el('div', { class: 'tbl-wrap' });
  const table = el('table', { class: 'lrtable' });
  const thead = el('thead');
  thead.append(el('tr', {}, el('th', { class: 'st', rowspan: 2 }, 'Estado'), el('th', { colspan: G.terms.length }, 'Ações'), el('th', { colspan: nts.length, class: 'div' }, 'Goto')));
  thead.append(el('tr', {}, ...G.terms.map((t) => el('th', { 'data-col': t }, t)), ...nts.map((n, k) => el('th', { 'data-col': n, class: k === 0 ? 'div' : null }, n))));
  table.append(thead);
  const tbody = el('tbody');
  const why = el('div', { class: 'why panel', hidden: !opts.showWhy });
  why.innerHTML = '<p class="stepinfo">Toque numa célula para ver de onde ela veio.</p>';
  const cells = {};
  C.states.forEach((_, s) => {
    const tr = el('tr', { 'data-row': s });
    tr.append(el('td', { class: 'st' }, LR.stateLabel(C, s)));
    G.terms.forEach((t) => {
      const cell = T.action[s][t];
      let txt = '—';
      let cls = 'c empty';
      if (cell) {
        txt = cell.map((e) => LR.actionText(e, C)).join(' / ');
        cls = cell.length > 1 ? 'c conf' : `c a-${cell[0].type}`;
      }
      const td = el('td', { class: cls }, txt);
      td.onclick = () => select(s, t);
      cells[`${s}|${t}`] = td;
      tr.append(td);
    });
    nts.forEach((n, k) => {
      const j = T.go[s][n];
      const td = el('td', { class: `c ${j === undefined ? 'empty' : 'a-g'}${k === 0 ? ' div' : ''}` }, j === undefined ? '—' : 'g' + LR.stateLabel(C, j));
      td.onclick = () => select(s, n);
      cells[`${s}|${n}`] = td;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  tw.append(table);
  const legend = el('div', { class: 'legend' }, el('span', { class: 'l-s' }, 'sN desloca e vai ao estado N'), el('span', { class: 'l-r' }, 'rN reduz pela produção N'), el('span', { class: 'l-g' }, 'gN goto'), el('span', { class: 'l-acc' }, 'acc aceita'), el('span', { class: 'l-c' }, 'conflito'));
  const prods = el('div', { class: 'grammar', html: G.prods.map((p) => `<span class="num">r${p.idx}:</span> ${esc(LR.prodText(G, p))}${p.idx === 0 ? '   <span class="cm">(aumentada → acc)</span>' : ''}`).join('\n') });
  let conf = null;
  if (T.conflicts.length) {
    conf = el('div', { class: 'note err', html: `<b>${T.conflicts.length} conflito(s):</b> ` + T.conflicts.map((c) => `${ccName(C, c.state)} com <code>${esc(c.term)}</code> (${c.type}: ${c.entries.map((e) => LR.actionText(e, C)).join(' × ')})`).join('; ') + `. A gramática <b>não</b> é ${METHOD_NAME[T.method]}.` });
  } else {
    conf = el('div', { class: 'note ok', html: `Nenhuma célula com duas ações: a gramática <b>é ${METHOD_NAME[T.method]}</b>.` });
  }
  if (opts.prods !== false) wrap.append(prods);
  wrap.append(legend, tw, conf, why);
  let selKey = null;
  function select(s, sym, silent) {
    $$('.sel', table).forEach((x) => x.classList.remove('sel'));
    $$('tr.rowsel', table).forEach((x) => x.classList.remove('rowsel'));
    $$('th.colsel', table).forEach((x) => x.classList.remove('colsel'));
    if (s == null) return;
    selKey = `${s}|${sym}`;
    const td = cells[selKey];
    if (td) td.classList.add('sel');
    const row = $(`tr[data-row="${s}"]`, tbody);
    if (row) row.classList.add('rowsel');
    const th = $$('th[data-col]', thead).find((x) => x.dataset.col === sym);
    if (th) th.classList.add('colsel');
    if (!silent) { why.hidden = false; why.innerHTML = `<p class="stepinfo">Célula [${esc(LR.stateLabel(C, s))}, ${esc(sym)}]</p>` + cellWhy(T, s, sym); }
  }
  return { el: wrap, select };
}

/* ===================== execução com pilha ===================== */
function tokenize(text) { return text.trim() ? text.trim().split(/\s+/) : []; }
const stackStr = (st) => st.map((e) => `(${e.sym},${e.state})`).join('');

function explainStep(T, step) {
  const { C, G } = T;
  const top = step.stack[step.stack.length - 1].state;
  const tok = step.input[0].sym;
  const where = `Ação[${esc(LR.stateLabel(C, top))}, ${esc(tok)}]`;
  if (step.kind === 's') return `<p><b>${where} = s${esc(LR.stateLabel(C, step.target))}</b> → desloca: empilha (<code>${esc(tok)}</code>, ${esc(LR.stateLabel(C, step.target))}) e consome <code>${esc(tok)}</code>.</p>`;
  if (step.kind === 'acc') return `<p><b>${where} = acc</b> → a entrada foi reconhecida. 🎉</p>`;
  if (step.kind === 'err') return `<p><b>${where} vazia</b> → erro sintático: esta entrada não pertence à linguagem.</p>`;
  const p = step.prod;
  const k = step.popped;
  const popTxt = k === 0 ? 'Produção vazia: desempilha <b>0</b> pares e consulta o goto no próprio topo.' : `Desempilha <b>${k}</b> par${k > 1 ? 'es' : ''} (|lado direito| = ${k}).`;
  return `<p><b>${where} = r${p.idx}</b> → reduz <code>${esc(LR.prodText(G, p))}</code>.</p>
    <p>${popTxt} Topo exposto: estado ${esc(LR.stateLabel(C, step.exposed))}. Goto[${esc(LR.stateLabel(C, step.exposed))}, ${esc(p.lhs)}] = ${esc(LR.stateLabel(C, step.target))} → empilha (${esc(p.lhs)}, ${esc(LR.stateLabel(C, step.target))}).</p>
    <p class="stepinfo">A redução não consome entrada: quem consome token é o deslocamento.</p>`;
}

function stackViz(T, step) {
  const { C } = T;
  const box = el('div', { class: 'stackviz', 'aria-label': 'Pilha' });
  const n = step.stack.length;
  step.stack.forEach((e, i) => {
    const f = el('div', { class: 'sframe' }, el('span', { class: 'sy' }, e.sym), el('span', { class: 'ss' }, LR.stateLabel(C, e.state)));
    if (step.kind === 'r' && i >= n - step.popped) f.classList.add('pop');
    if (i === n - 1 && !(step.kind === 'r' && step.popped)) f.classList.add('top');
    box.append(f);
  });
  if (step.kind === 's') box.append(el('div', { class: 'sframe push' }, el('span', { class: 'sy' }, step.input[0].sym), el('span', { class: 'ss' }, LR.stateLabel(C, step.target))));
  if (step.kind === 'r') box.append(el('div', { class: 'sframe push' }, el('span', { class: 'sy' }, step.prod.lhs), el('span', { class: 'ss' }, LR.stateLabel(C, step.target))));
  return box;
}

function traceBox(T, inputText, opts = {}) {
  const wrap = el('div');
  const inp = el('input', { type: 'text', value: inputText, id: nextId('inp'), 'aria-label': 'Entrada (tokens separados por espaço)' });
  const runBtn = el('button', { class: 'btn primary', type: 'button' }, 'Executar');
  const field = el('div', { class: 'field' }, el('label', { for: inp.id }, 'Entrada:'), inp, runBtn);
  if (opts.keys) opts.keys.forEach((k) => field.append(el('button', { class: 'btn', type: 'button', onclick: () => { inp.value = (inp.value.trim() + ' ' + k).trim(); } }, k)));
  if (opts.keys) field.append(el('button', { class: 'btn', type: 'button', onclick: () => { inp.value = ''; } }, 'Limpar'));
  const body = el('div');
  wrap.append(field, el('p', { class: 'stepinfo', style: 'margin:4px 0' }, 'Tokens separados por espaço; o eof é acrescentado automaticamente.'), body);
  const run = () => {
    body.replaceChildren();
    const toks = tokenize(inp.value);
    const bad = toks.filter((t) => !T.G.terms.includes(t) || t === LR.EOF);
    if (bad.length) { body.append(el('p', { class: 'err-msg' }, `Token desconhecido: ${bad.join(', ')}. Terminais desta gramática: ${T.G.terms.filter((t) => t !== LR.EOF).join(' ')}`)); return; }
    const res = LR.run(T, toks);
    const steps = res.steps;
    const left = el('div');
    const right = el('div');
    const grid = el('div', { class: opts.withTable ? 'cols-even' : '' }, left, right);
    const ctrl = el('div');
    const exp = el('div', { class: 'explain' });
    const sviz = el('div');
    const tape = el('div', { class: 'tape', 'aria-label': 'Entrada restante' });
    const tbody = el('tbody');
    steps.forEach((s, i) => {
      tbody.append(el('tr', {}, el('td', {}, i), el('td', {}, '(⊥,0)' + stackStr(s.stack.slice(1).map((e) => ({ sym: e.sym, state: LR.stateLabel(T.C, e.state) })))), el('td', {}, s.input.map((t) => t.sym).join(' ')), el('td', { class: `act-${s.kind}` }, s.kind === 'r' ? `${s.text}: ${LR.prodText(T.G, s.prod)}` : s.text)));
    });
    const traceT = el('div', { class: 'tbl-wrap' }, el('table', { class: 't trace' }, el('thead', {}, el('tr', {}, el('th', {}, 'Passo'), el('th', {}, 'Pilha'), el('th', {}, 'Entrada'), el('th', {}, 'Ação'))), tbody));
    left.append(ctrl, exp, el('div', { class: 'stepinfo' }, 'Pilha (fundo à esquerda, topo à direita; riscado = sai, verde = entra):'), sviz, el('div', { class: 'stepinfo', style: 'margin-top:6px' }, 'Entrada:'), tape, traceT);
    let tb = null;
    if (opts.withTable) { tb = tableBox(T, { prods: true }); right.append(tb.el); }
    body.append(grid, el('div', { class: `note ${res.ok ? 'ok' : 'err'}` }, res.ok ? `Entrada aceita em ${steps.length} passos.` : 'Entrada rejeitada: a pilha chega a uma célula vazia (erro).'));
    makeStepper(ctrl, steps.length, (k) => {
      const s = steps[k];
      exp.className = `explain k-${s.kind}`;
      exp.innerHTML = `<p class="stepinfo">Passo ${k}</p>` + explainStep(T, s);
      sviz.replaceChildren(stackViz(T, s));
      const all = [...toks, LR.EOF];
      tape.replaceChildren(...all.map((t, i) => el('span', { class: i < s.pos ? 'done' : i === s.pos ? 'cur' : '' }, t)));
      [...tbody.children].forEach((tr, i) => { tr.className = i < k ? '' : i === k ? 'now' : 'future'; });
      if (tb) tb.select(s.stack[s.stack.length - 1].state, s.input[0].sym, true);
    }, { ms: 1200 });
  };
  runBtn.onclick = run;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  run();
  return { el: wrap };
}

/* ===================== construção passo a passo ===================== */
function closureReasonsEl(C, st) {
  const G = C.G;
  const withLA = C.kind === 'lr1';
  const ul = el('ul', { class: 'itemlist' });
  const groups = LR.groupItems(C, st.items);
  let sep = false;
  groups.forEach((g) => {
    const li = el('li', {}, LR.itemText(C, g));
    if (g.kernel) { li.append(el('span', { class: 'r' }, st.via || st.members ? 'núcleo (veio do goto)' : 'item inicial (produção aumentada, lookahead eof)')); }
    else {
      if (!sep) { li.classList.add('sepk'); sep = true; }
      const raws = st.items.filter((it) => !it.kernel && it.p === g.p && it.d === g.d);
      const reasons = [];
      raws.forEach((it) => {
        const src = rawItem(G, it.from.item);
        const Y = G.prods[it.p].lhs;
        if (!withLA) { reasons.push(`ponto antes de ${Y} em ${src} ⇒ inclui as produções de ${Y}`); return; }
        const seq = [...it.from.beta, it.from.item.la].join(' ');
        const txt = `de ${src}: FIRST(${seq}) = {${it.from.las.join(', ')}} ⇒ lookahead ${it.la}`;
        if (!reasons.includes(txt)) reasons.push(txt);
      });
      reasons.forEach((r) => li.append(el('span', { class: 'r' }, r)));
    }
    ul.append(li);
  });
  return ul;
}

function constructionBox(C, opts = {}) {
  const G = C.G;
  const wrap = el('div');
  const ctrl = el('div');
  const exp = el('div', { class: 'explain' });
  const diag = el('div', { class: 'diagram' });
  const grid = el('div', { class: 'cols' }, el('div', {}, exp), el('div', {}, diag));
  wrap.append(ctrl, grid);
  const log = C.log;
  makeStepper(ctrl, log.length, (k) => {
    const visible = new Set([0]);
    const visibleEdges = new Set();
    for (let i = 1; i <= k; i++) { visible.add(log[i].to); visibleEdges.add(`${log[i].from}|${log[i].sym}`); }
    const e = log[k];
    if (e.type === 'init') {
      const st = C.states[0];
      exp.className = 'explain';
      exp.replaceChildren(
        el('p', { html: `<b>CC0 = closure({${esc(rawItem(G, st.kernel[0]))}})</b>` }),
        el('p', { class: 'stepinfo' }, C.kind === 'lr1' ? 'Para cada item [X → α • Y β, ℓ] com Y não terminal, entram os itens [Y → • δ, s] para cada s em FIRST(β ℓ). Repete até nada novo aparecer.' : 'Para cada item com o ponto antes de um não terminal Y, entram as produções Y → • δ. Repete até nada novo aparecer.'),
        el('div', { class: 'scroll-x' }, closureReasonsEl(C, st)));
      drawAutomaton(diag, C, { mode: opts.mode || 'kernel', visible, visibleEdges, current: { state: 0 } });
      return;
    }
    const src = C.states[e.from];
    const dst = C.states[e.to];
    exp.className = `explain ${e.isNew ? 'k-s' : 'k-r'}`;
    const srcList = itemListEl(C, src.items, { hl: (g) => G.prods[g.p].rhs[g.d] === e.sym });
    const kids = [
      el('p', { html: `<b>goto(${ccName(C, e.from)}, ${esc(e.sym)})</b>: pegue <i>todos</i> os itens de ${ccName(C, e.from)} com <code>${esc(e.sym)}</code> logo depois do ponto (destacados), avance o ponto e aplique closure.` }),
      el('div', { class: 'scroll-x' }, srcList),
    ];
    if (e.isNew) {
      kids.push(el('p', { html: `Resultado: <b class="good">novo estado ${ccName(C, e.to)}</b>` }), el('div', { class: 'scroll-x' }, closureReasonsEl(C, dst)));
    } else {
      kids.push(el('p', { html: `Resultado: o conjunto obtido <b>já existe</b> — é ${ccName(C, e.to)}. Só acrescentamos a transição ${ccName(C, e.from)} —${esc(e.sym)}→ ${ccName(C, e.to)}.` }));
    }
    kids.push(el('p', { class: 'stepinfo' }, G.isNT(e.sym) ? `Transição por não terminal → vira goto na tabela (g${LR.stateLabel(C, e.to)}).` : `Transição por terminal → vira deslocamento na tabela (s${LR.stateLabel(C, e.to)}).`));
    exp.replaceChildren(...kids);
    drawAutomaton(diag, C, { mode: opts.mode || 'kernel', visible, visibleEdges, current: { state: e.to, edge: [e.from, e.sym] } });
  }, { ms: 1800 });
  return { el: wrap };
}

/* ===================== bancada (autômato | construção | tabela | pilha) ===================== */
function workbench(host, key, o = {}) {
  const m = typeof key === 'string' ? model(key) : key;
  let method = o.method || 'lr1';
  const methods = o.methods || [method];
  const tabsList = o.tabs || ['auto', 'table', 'trace'];
  let tab = o.tab || tabsList[0];
  const TABN = { auto: 'Autômato', build: 'Construção passo a passo', table: 'Tabela Ações/Goto', trace: 'Pilha (execução)' };
  const top = el('div', { class: 'toolbar' });
  if (methods.length > 1) top.append(el('span', { class: 'stepinfo' }, 'Método:'), seg(methods.map((x) => [x, METHOD_NAME[x]]), method, (v) => { method = v; render(); }));
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const body = el('div');
  const btns = tabsList.map((t) => {
    const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(t === tab) }, TABN[t]);
    b.onclick = () => { tab = t; btns.forEach((x) => x.setAttribute('aria-selected', String(x === b))); render(); };
    tabs.append(b);
    return b;
  });
  host.append(top, tabs, body);
  function render() {
    const C = m.C[method];
    const T = m.T[method];
    body.replaceChildren();
    if (tab === 'auto') body.append(automatonBox(C, { mode: o.mode || 'full', table: T }).el);
    if (tab === 'build') {
      if (C.log.length) body.append(constructionBox(C, { mode: o.buildMode || 'full' }).el);
      else body.append(el('div', { class: 'note' }, method === 'lalr' ? 'O autômato LALR não é construído do zero: ele vem da coleção LR(1), fundindo estados com o mesmo núcleo. Escolha LR(1) para ver a construção passo a passo e depois volte aqui para ver o resultado da fusão no Autômato.' : 'Sem passos.'));
    }
    if (tab === 'table') body.append(tableBox(T, { showWhy: true }).el);
    if (tab === 'trace') body.append(traceBox(T, o.input ?? m.spec.input ?? '', { withTable: o.traceTable !== false, keys: o.keys }).el);
  }
  render();
}

/* ===================== árvores (AST, árvore concreta, SDD) ===================== */
function nodeSize(n) {
  const lines = [n.label, ...(n.subs || []).map((s) => s.text)];
  const w = Math.max(...lines.map((l) => String(l).length * CH)) + 18;
  const h = 22 + (n.subs ? n.subs.length * 14 : 0);
  return { w: Math.max(w, 34), h };
}
function layoutForest(roots, o = {}) {
  const gapX = o.gapX ?? 14;
  const gapY = o.gapY ?? 34;
  const levelH = [];
  const walk = (n, d) => { n._sz = nodeSize(n); n._d = d; levelH[d] = Math.max(levelH[d] || 0, n._sz.h); (n.kids || []).forEach((c) => walk(c, d + 1)); };
  roots.forEach((r) => walk(r, 0));
  const levelY = [];
  let acc = 10;
  levelH.forEach((hh, d) => { levelY[d] = acc; acc += hh + gapY; });
  const span = (n) => {
    const kids = n.kids || [];
    if (!kids.length) { n._span = n._sz.w; return n._span; }
    const sum = kids.reduce((s, c) => s + span(c), 0) + gapX * (kids.length - 1);
    n._span = Math.max(n._sz.w, sum);
    return n._span;
  };
  const place = (n, left) => {
    const kids = n.kids || [];
    n._y = levelY[n._d];
    if (!kids.length) { n._x = left + n._span / 2; return; }
    const sum = kids.reduce((s, c) => s + c._span, 0) + gapX * (kids.length - 1);
    let x = left + (n._span - sum) / 2;
    kids.forEach((c) => { place(c, x); x += c._span + gapX; });
    n._x = (kids[0]._x + kids[kids.length - 1]._x) / 2;
  };
  let left = 10;
  roots.forEach((r) => { span(r); place(r, left); left += r._span + 34; });
  return { W: Math.max(left - 24, 60), H: acc - gapY + 14 };
}
function drawForest(host, roots, o = {}) {
  if (!roots.length) { host.replaceChildren(el('p', { class: 'stepinfo', style: 'padding:10px;margin:0' }, o.empty || 'Pilha vazia: nada construído ainda.')); return null; }
  const L = layoutForest(roots, o);
  const s = sv('svg', { viewBox: `0 0 ${L.W} ${L.H}`, width: L.W, height: L.H, class: 'tree', role: 'img', 'aria-label': o.label || 'Árvore' });
  const edges = sv('g');
  const nodes = sv('g');
  const walk = (n) => {
    const { w, h } = n._sz;
    (n.kids || []).forEach((c) => {
      const y1 = n._y + h;
      const y2 = c._y;
      edges.append(sv('path', { class: 'te', d: `M${n._x},${y1} C${n._x},${(y1 + y2) / 2} ${c._x},${(y1 + y2) / 2} ${c._x},${y2}` }));
      walk(c);
    });
    const g = sv('g', { class: `tn${n.kids && n.kids.length ? '' : ' leaf'}${n.cls ? ' ' + n.cls : ''}` });
    if (n.shape === 'pill') g.append(sv('rect', { x: n._x - w / 2, y: n._y, width: w, height: h, rx: Math.min(h / 2, 12) }));
    else g.append(sv('rect', { x: n._x - w / 2, y: n._y, width: w, height: h, rx: 5 }));
    g.append(sv('text', { x: n._x, y: n._y + 15, 'text-anchor': 'middle' }, n.label));
    (n.subs || []).forEach((sb, i) => g.append(sv('text', { class: `sub ${sb.cls || ''}`, x: n._x, y: n._y + 29 + i * 14, 'text-anchor': 'middle' }, sb.text)));
    nodes.append(g);
  };
  roots.forEach(walk);
  s.append(edges, nodes);
  host.replaceChildren(s);
  if (host.classList.contains('diagram')) scrollToFocus(host);
  return s;
}

/* ===================== tradução dirigida por sintaxe sobre o parser LR ===================== */
function lexExpr(text, allowFloat = true, ops = '+-()') {
  const toks = [];
  const re = /\s*(\d+\.\d+|\d+|\S)/g;
  let m;
  while ((m = re.exec(text))) {
    const t = m[1];
    if (/^\d+\.\d+$/.test(t)) { if (!allowFloat) throw new Error(`Literal real não previsto nesta gramática: ${t}`); toks.push({ sym: 'floatLit', text: t, lexeme: t }); }
    else if (/^\d+$/.test(t)) toks.push({ sym: 'intLit', text: t, lexeme: t });
    else if (ops.includes(t)) toks.push({ sym: t, text: t });
    else throw new Error(`Caractere inesperado: "${t}"`);
  }
  if (!toks.length) throw new Error('Digite uma expressão.');
  return toks;
}

/* cfg: key, input, lex, shift(tok)→val, reduce(prod, vals)→{val, act}, view(host, stepIndex, ctx), onDone(res) */
function sdtStepper(host, cfg) {
  const m = model(cfg.key);
  const T = m.T.lalr;
  const inp = el('input', { type: 'text', value: cfg.input, id: nextId('sdt'), 'aria-label': 'Expressão de entrada' });
  const runBtn = el('button', { class: 'btn primary', type: 'button' }, 'Traduzir');
  const field = el('div', { class: 'field' }, el('label', { for: inp.id }, 'Entrada:'), inp, runBtn);
  const body = el('div');
  host.append(field, body);
  const run = () => {
    body.replaceChildren();
    let toks;
    try { toks = cfg.lex(inp.value); } catch (e) { body.append(el('p', { class: 'err-msg' }, e.message)); return; }
    const acts = [];
    const res = LR.run(T, toks, {
      shift: cfg.shift,
      reduce: (p, vals, popped) => { const r = cfg.reduce(p, vals, popped); acts.push(r); return r.val; },
    });
    if (!res.ok) { body.append(el('p', { class: 'err-msg' }, 'Erro sintático: a expressão não segue a gramática.')); return; }
    const steps = res.steps;
    let ri = 0;
    steps.forEach((s) => { if (s.kind === 'r') { const r = acts[ri++]; s.act = r.act || ''; s.out = r.out; } });
    // linhas no formato do caderno: « desloca, → reduz
    const lines = [{ mk: '', form: '• ' + toks.map((t) => t.text).join(' '), act: '' }];
    for (let i = 0; i < steps.length - 1; i++) {
      const s = steps[i];
      const after = steps[i + 1];
      const stackSyms = after.stack.slice(1).map((e) => (e.sym === 'intLit' || e.sym === 'floatLit' ? e.text : e.sym));
      const rest = after.input.filter((t) => t.sym !== LR.EOF).map((t) => t.text);
      lines.push({ mk: s.kind === 'r' ? '→' : '«', kind: s.kind, form: `${stackSyms.join(' ')} <span class="dot">•</span> ${rest.join(' ')}`, act: s.kind === 'r' ? `${LR.prodText(m.G, s.prod)}   ${s.act}` : '' });
    }
    const sent = el('div', { class: 'sentlines', 'aria-label': 'Formas sentenciais' });
    lines.forEach((l, i) => sent.append(el('div', {}, el('span', { class: `mk ${l.kind || ''}` }, l.mk || String(i)), el('span', { html: `${l.form.startsWith('•') ? '<span class="dot">•</span>' + esc(l.form.slice(1)) : l.form}${l.act ? `<span class="act">${esc(l.act)}</span>` : ''}` }))));
    const ctrl = el('div');
    const exp = el('div', { class: 'explain' });
    const viz = el('div');
    const out = el('div');
    body.append(ctrl, el('div', { class: 'cols' }, el('div', {}, exp, el('div', { class: 'stepinfo', style: 'margin:6px 0 4px' }, '« = desloca · → = reduz e executa a ação (formato do caderno)'), sent), el('div', {}, viz)), out);
    makeStepper(ctrl, lines.length, (k) => {
      [...sent.children].forEach((d, i) => { d.className = i < k ? '' : i === k ? 'now' : 'future'; });
      const stackAfter = k === 0 ? steps[0].stack : steps[k].stack; // pilha depois do passo k-1 = snapshot do passo k
      const s = k === 0 ? null : steps[k - 1];
      if (!s) { exp.className = 'explain'; exp.innerHTML = '<p>Início: pilha vazia, ponto antes do primeiro token.</p>'; }
      else if (s.kind === 's') { exp.className = 'explain k-s'; exp.innerHTML = `<p><b>Desloca</b> <code>${esc(s.input[0].text)}</code>. Nenhuma ação semântica ainda: ações executam nas <b>reduções</b>.</p>`; }
      else { exp.className = 'explain k-r'; exp.innerHTML = `<p><b>Reduz</b> <code>${esc(LR.prodText(m.G, s.prod))}</code></p><p>Ação: <code>${esc(s.act)}</code></p>`; }
      let outNow = [];
      for (let i = 0; i < k; i++) if (steps[i].out) outNow = steps[i].out;
      cfg.view(viz, { k, step: s, stack: stackAfter.slice(1), last: k === lines.length - 1, created: s && s.kind === 'r' ? s.val : null, out: outNow });
      out.replaceChildren();
      if (k === lines.length - 1 && cfg.onDone) out.append(cfg.onDone(res.value));
    }, { ms: 1100 });
  };
  runBtn.onclick = run;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  run();
}

/* ===================== slides: montagem de cada widget ===================== */
const W = {};

W.workbench = (h) => {
  const d = h.dataset;
  workbench(h, d.ex, {
    method: d.method, methods: d.methods ? d.methods.split(',') : undefined, tabs: d.tabs ? d.tabs.split(',') : undefined,
    tab: d.tab, mode: d.mode, input: d.input, keys: d.keys ? d.keys.split(',') : undefined, buildMode: d.buildMode,
  });
};

W.closureDemo = (h) => {
  const m = model('ex2');
  const C = m.C.lr1;
  const G = m.G;
  let which = 0;
  const box = el('div');
  const ctrlHost = el('div');
  const pick = seg([[0, 'CC0 (estado inicial)'], [3, 'CC3 = goto(CC0, B)']], which, (v) => { which = v; draw(); });
  h.append(el('div', { class: 'toolbar' }, pick), ctrlHost, box);
  function draw() {
    const st = C.states[which];
    const items = st.items;
    ctrlHost.replaceChildren();
    makeStepper(ctrlHost, items.length, (k) => {
      const shown = items.slice(0, k + 1);
      const cur = items[k];
      const ul = el('ul', { class: 'itemlist' });
      shown.forEach((it, i) => {
        const li = el('li', { class: i === k ? 'hl' : '' }, rawItem(G, it));
        if (!it.kernel && !shown.slice(0, i).some((x) => !x.kernel)) li.classList.add('sepk');
        ul.append(li);
      });
      let why;
      if (cur.kernel) why = which === 0 ? 'Ponto de partida: o item da produção aumentada, com lookahead eof.' : 'Item do núcleo: veio de goto(CC0, B) — o ponto pulou o B nos dois itens [A → • B C, a] e [A → • B C f, a].';
      else {
        const src = cur.from.item;
        const Y = G.prods[cur.p].lhs;
        const seq = [...cur.from.beta, src.la];
        why = `No item ${rawItem(G, src)} o ponto está antes de ${Y}. Depois de ${Y} vem β = ${cur.from.beta.join(' ') || 'ε (nada)'}; lookahead ℓ = ${src.la}. FIRST(${seq.join(' ')}) = {${cur.from.las.join(', ')}} ⇒ entra ${rawItem(G, cur)}.`;
      }
      box.replaceChildren(el('div', { class: 'cols' }, el('div', { class: 'statecard' }, el('h4', {}, `CC${which}`), el('div', { class: 'scroll-x' }, ul)), el('div', { class: 'explain' }, el('p', {}, why))));
    }, { ms: 1500 });
  }
  draw();
};

W.compareMethods = (h) => {
  const m = model(h.dataset.ex);
  let method = h.dataset.method || 'slr';
  const methods = (h.dataset.methods || 'lr0,slr,lr1,lalr').split(',');
  const body = el('div');
  h.append(el('div', { class: 'toolbar' }, el('span', { class: 'stepinfo' }, 'Preencher com:'), seg(methods.map((x) => [x, METHOD_NAME[x]]), method, (v) => { method = v; draw(); })), body);
  const draw = () => body.replaceChildren(tableBox(m.T[method], { showWhy: true, prods: false }).el);
  draw();
};

W.robotCheck = (h) => {
  const m = model('robo');
  const T = m.T.lr1;
  let seq = ['↓', '↑', '↓'];
  const view = el('div');
  const add = (c) => { seq.push(c); draw(); };
  h.append(el('div', { class: 'toolbar' },
    el('button', { class: 'btn', type: 'button', onclick: () => add('↓') }, '↓ põe maçã'),
    el('button', { class: 'btn', type: 'button', onclick: () => add('↑') }, '↑ tira maçã'),
    el('button', { class: 'btn', type: 'button', onclick: () => { seq.pop(); draw(); } }, 'Apagar último'),
    el('button', { class: 'btn', type: 'button', onclick: () => { seq = []; draw(); } }, 'Limpar'),
    ...[['↓ ↓ ↑ ↑', 'válida'], ['↓ ↑ ↓', 'válida'], ['↓ ↑ ↑ ↓', 'inválida'], ['↓ ↑ ↓ ↑ ↑', 'inválida']].map(([s]) => el('button', { class: 'btn', type: 'button', onclick: () => { seq = s.split(' '); draw(); } }, s))), view);
  function draw() {
    let bal = 0;
    let firstBad = -1;
    const bars = seq.map((c, i) => { bal += c === '↓' ? 1 : -1; if (bal < 0 && firstBad < 0) firstBad = i; return bal; });
    const valid = firstBad < 0;
    const res = LR.run(T, seq);
    const W2 = Math.max(seq.length, 1) * 34 + 40;
    const maxB = Math.max(2, ...bars.map(Math.abs));
    const H2 = 120;
    const y0 = H2 / 2;
    const sc = (H2 / 2 - 14) / maxB;
    const s = sv('svg', { viewBox: `0 0 ${W2} ${H2}`, width: W2, height: H2, role: 'img', 'aria-label': 'Saldo de maçãs a cada prefixo' });
    s.append(sv('line', { x1: 20, x2: W2 - 10, y1: y0, y2: y0, stroke: 'var(--ink-3)', 'stroke-dasharray': '4 3' }));
    s.append(sv('text', { x: 4, y: y0 + 4, 'font-size': 11, fill: 'var(--ink-2)' }, '0'));
    bars.forEach((b, i) => {
      const x = 28 + i * 34;
      const hh = Math.abs(b) * sc;
      s.append(sv('rect', { x, y: b >= 0 ? y0 - hh : y0, width: 24, height: Math.max(hh, 1.5), rx: 3, fill: b < 0 ? 'var(--conflict)' : 'var(--marker)' }));
      s.append(sv('text', { x: x + 12, y: H2 - 2, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--ink)' }, seq[i]));
    });
    view.replaceChildren(
      el('p', { class: 'mono', style: 'font-size:1.1rem' }, seq.length ? seq.join(' ') : '(sequência vazia)'),
      el('div', { class: 'diagram', style: 'max-width:100%' }, s),
      el('div', { class: `note ${valid ? 'ok' : 'err'}` }, valid ? 'Válida: nenhum prefixo tira mais maçãs do que pôs.' : `Inválida: no prefixo de tamanho ${firstBad + 1} o saldo fica negativo.`),
      el('p', {}, `Parser LR(1) da gramática: ${res.ok ? 'aceita' : 'rejeita'} em ${res.steps.length} passos — ${res.ok === valid ? 'concorda com a regra do saldo.' : 'DISCORDA (não deveria acontecer).'}`));
  }
  draw();
};

W.lab = (h) => {
  const ta = el('textarea', { class: 'gram', id: 'lab-gram', spellcheck: 'false', 'aria-label': 'Gramática' }, 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id');
  const inp = el('input', { type: 'text', id: 'lab-in', value: 'id + id * id', 'aria-label': 'Entrada de teste' });
  const btn = el('button', { class: 'btn primary', type: 'button' }, 'Construir');
  const out = el('div');
  const presets = [
    ['Expressões', 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id', 'id + id * id'],
    ['Não é SLR (aula)', 'Cmd -> Lhs = Rhs | Rhs\nLhs -> * Rhs | id\nRhs -> Lhs', 'id = * id'],
    ['LR(1) mas não LALR', 'S -> a A d | b B d | a B e | b A e\nA -> c\nB -> c', 'a c d'],
    ['Ambígua', 'E -> E + E | id', 'id + id + id'],
  ];
  h.append(el('div', { class: 'cols' },
    el('div', {}, el('label', { for: 'lab-gram', class: 'stepinfo' }, 'Gramática (uma linha por não terminal; use | para alternativas e ε para vazio). A primeira linha define o símbolo inicial.'), ta,
      el('div', { class: 'toolbar' }, el('span', { class: 'stepinfo' }, 'Exemplos:'), ...presets.map(([n, g, i]) => el('button', { class: 'btn', type: 'button', onclick: () => { ta.value = g; inp.value = i; build(); } }, n)))),
    el('div', {}, el('div', { class: 'field' }, el('label', { for: 'lab-in' }, 'Entrada de teste:'), inp), el('div', { class: 'toolbar' }, btn), el('p', { class: 'stepinfo' }, 'Compare os quatro métodos: o mesmo autômato LR(0) serve ao LR(0) e ao SLR; LR(1) tem lookaheads nos itens; LALR funde estados LR(1) de mesmo núcleo.'))), out);
  function build() {
    out.replaceChildren();
    let m;
    try { m = buildModel({ grammar: ta.value, opts: {}, input: inp.value }); } catch (e) { out.append(el('p', { class: 'err-msg' }, e.message)); return; }
    const G = m.G;
    const summary = el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Método'), el('th', {}, 'Estados'), el('th', {}, 'Conflitos'))),
      el('tbody', {}, ...['lr0', 'slr', 'lr1', 'lalr'].map((k) => el('tr', {}, el('td', {}, METHOD_NAME[k]), el('td', {}, m.C[k].states.length), el('td', { class: m.T[k].conflicts.length ? 'bad' : 'good' }, m.T[k].conflicts.length ? `${m.T[k].conflicts.length} — não é ${METHOD_NAME[k]}` : 'nenhum'))))));
    const ff = el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Não terminal'), el('th', {}, 'FIRST'), el('th', {}, 'FOLLOW'))),
      el('tbody', {}, ...G.nonterms.map((n) => el('tr', {}, el('td', { class: 'mono' }, n), el('td', { class: 'mono' }, `{${[...G.FIRST[n]].join(', ')}}`), el('td', { class: 'mono' }, `{${[...G.FOLLOW[n]].join(', ')}}`))))));
    const wb = el('div');
    out.append(el('h3', {}, 'Resumo'), el('div', { class: 'cols' }, summary, ff), el('h3', {}, 'Bancada'), wb);
    workbench(wb, { ...m, spec: { ...m.spec, input: inp.value } }, { methods: ['lr0', 'slr', 'lr1', 'lalr'], method: 'lr1', tabs: ['auto', 'build', 'table', 'trace'], mode: 'full', input: inp.value });
  }
  btn.onclick = build;
  build();
};

/* ---------- Q2: SDD de números binários (atributos herdados e sintetizados) ---------- */
W.binary = (h) => {
  const inp = el('input', { type: 'text', value: '-110', id: 'bin-in', 'aria-label': 'Número binário com sinal' });
  const btn = el('button', { class: 'btn primary', type: 'button' }, 'Montar árvore');
  const body = el('div');
  h.append(el('div', { class: 'field' }, el('label', { for: 'bin-in' }, 'Número:'), inp, btn), body);
  const T = model('bin').T.lalr;
  const run = () => {
    body.replaceChildren();
    const toks = [...inp.value.replace(/\s/g, '')];
    if (!toks.length || toks.some((c) => !'+-01'.includes(c))) { body.append(el('p', { class: 'err-msg' }, 'Use um sinal seguido de bits, por exemplo -110 ou +101.')); return; }
    let idc = 0;
    const res = LR.run(T, toks, {
      shift: (t) => ({ id: idc++, sym: t.sym, kids: [], attrs: {} }),
      reduce: (p, vals) => ({ id: idc++, sym: p.lhs, prod: p, kids: vals, attrs: {} }),
    });
    if (!res.ok) { body.append(el('p', { class: 'err-msg' }, 'Entrada fora da gramática: Number → Sign List (ex.: -110).')); return; }
    const root = res.value;
    const steps = [];
    const sub = (n, k) => (k ? `${n.sym}₁` : n.sym);
    const visit = (n) => {
      const p = n.prod;
      if (!p) return;
      const rhs = p.rhs.join(' ');
      if (p.lhs === 'Number') {
        const [sg, list] = n.kids;
        list.attrs.pos = 0; steps.push({ n: list, a: 'pos', inh: true, rule: 'List.pos := 0', v: 0 });
        visit(sg); visit(list);
        n.attrs.val = sg.attrs.neg ? -list.attrs.val : list.attrs.val;
        steps.push({ n, a: 'val', rule: `Number.val := ${sg.attrs.neg ? '-List.val' : 'List.val'} (Sign.neg = ${sg.attrs.neg})`, v: n.attrs.val });
      } else if (p.lhs === 'Sign') {
        n.attrs.neg = rhs === '-'; steps.push({ n, a: 'neg', rule: `Sign.neg := ${n.attrs.neg}`, v: n.attrs.neg });
      } else if (p.lhs === 'List' && n.kids.length === 2) {
        const [l1, bit] = n.kids;
        l1.attrs.pos = n.attrs.pos + 1; steps.push({ n: l1, a: 'pos', inh: true, rule: `List₁.pos := List.pos + 1 = ${n.attrs.pos} + 1`, v: l1.attrs.pos });
        bit.attrs.pos = n.attrs.pos; steps.push({ n: bit, a: 'pos', inh: true, rule: `Bit.pos := List.pos = ${n.attrs.pos}`, v: bit.attrs.pos });
        visit(l1); visit(bit);
        n.attrs.val = l1.attrs.val + bit.attrs.val; steps.push({ n, a: 'val', rule: `List.val := List₁.val + Bit.val = ${l1.attrs.val} + ${bit.attrs.val}`, v: n.attrs.val });
      } else if (p.lhs === 'List') {
        const [bit] = n.kids;
        bit.attrs.pos = n.attrs.pos; steps.push({ n: bit, a: 'pos', inh: true, rule: `Bit.pos := List.pos = ${n.attrs.pos}`, v: bit.attrs.pos });
        visit(bit);
        n.attrs.val = bit.attrs.val; steps.push({ n, a: 'val', rule: `List.val := Bit.val = ${bit.attrs.val}`, v: n.attrs.val });
      } else if (p.lhs === 'Bit') {
        n.attrs.val = rhs === '1' ? 2 ** n.attrs.pos : 0;
        steps.push({ n, a: 'val', rule: rhs === '1' ? `Bit.val := 2^Bit.pos = 2^${n.attrs.pos}` : 'Bit.val := 0', v: n.attrs.val });
      }
    };
    visit(root);
    const ctrl = el('div');
    const exp = el('div', { class: 'explain' });
    const diag = el('div', { class: 'diagram' });
    body.append(ctrl, exp, diag);
    makeStepper(ctrl, steps.length + 1, (k) => {
      const known = new Map();
      steps.slice(0, k).forEach((s) => { if (!known.has(s.n.id)) known.set(s.n.id, {}); known.get(s.n.id)[s.a] = s; });
      const cur = k > 0 ? steps[k - 1] : null;
      const conv = (n) => {
        const ks = known.get(n.id) || {};
        const subs = [];
        if (ks.pos) subs.push({ text: `↓ pos=${ks.pos.v}`, cls: 'inh' });
        if (ks.neg) subs.push({ text: `↑ neg=${ks.neg.v}`, cls: 'syn' });
        if (ks.val) subs.push({ text: `↑ val=${ks.val.v}`, cls: 'syn' });
        return { label: n.sym, subs, cls: cur && cur.n.id === n.id ? 'focus' : '', kids: n.kids.map(conv) };
      };
      drawForest(diag, [conv(root)], { gapY: 30 });
      if (!cur) { exp.className = 'explain'; exp.innerHTML = '<p>Árvore construída pelo parser; nenhum atributo calculado ainda. Avance para avaliar na ordem das dependências.</p>'; return; }
      exp.className = `explain ${cur.inh ? 'k-s' : 'k-r'}`;
      exp.innerHTML = `<p><b>${esc(cur.rule)}</b> → ${esc(String(cur.v))}</p><p class="stepinfo">${cur.inh ? 'Atributo <b>herdado</b>: vem do pai (desce na árvore).' : 'Atributo <b>sintetizado</b>: calculado a partir dos filhos (sobe na árvore).'}</p>`;
    }, { ms: 900 });
  };
  btn.onclick = run;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  run();
};

/* ---------- Q2 · Lista 2 · Ex. 1: AST de 1 - (3 + 2) ---------- */
W.astBuild = (h) => {
  let idc = 0;
  const mk = (label, kids = []) => ({ id: idc++, label, kids });
  sdtStepper(h, {
    key: 'expr', input: '1 - (3 + 2)', lex: (t) => { idc = 0; return lexExpr(t); },
    shift: (t) => t,
    reduce: (p, v) => {
      const r = p.rhs.join(' ');
      if (r === 'E + T') { const n = mk('Plus', [v[0], v[2]]); return { val: n, act: 'E.node := mkNodePlus(E₁.node, T.node)' }; }
      if (r === 'E - T') { const n = mk('Minus', [v[0], v[2]]); return { val: n, act: 'E.node := mkNodeMinus(E₁.node, T.node)' }; }
      if (r === 'T') return { val: v[0], act: 'E.node := T.node   (repassa o mesmo nó)' };
      if (r === '( E )') return { val: v[1], act: 'T.node := E.node   (parênteses não viram nó)' };
      if (r === 'intLit') { const n = mk(`Int(${v[0].lexeme})`); return { val: n, act: `T.node := mkNodeInt(${v[0].lexeme})` }; }
      const n = mk(`Float(${v[0].lexeme})`); return { val: n, act: `T.node := mkNodeFloat(${v[0].lexeme})` };
    },
    view: (host, ctx) => {
      const roots = ctx.stack.filter((e) => e.val && e.val.label).map((e) => e.val);
      const createdId = ctx.created && ctx.created.label ? ctx.created.id : -1;
      const conv = (n) => ({ label: n.label, shape: 'pill', cls: n.id === createdId ? 'new' : '', kids: n.kids.map(conv) });
      host.replaceChildren(el('div', { class: 'stepinfo' }, ctx.last ? 'AST final:' : 'Nós da AST apontados pela pilha (.node de cada símbolo):'));
      const d = el('div', { class: 'diagram' });
      host.append(d);
      if (roots.length) drawForest(d, roots.map(conv)); else d.append(el('p', { class: 'stepinfo', style: 'padding:10px' }, 'Nenhum nó criado ainda.'));
    },
  });
};

/* ---------- Q2 · Lista 2 · Ex. 2: interpretador com str/type/val ---------- */
const fmtVal = (type, v) => (type === 'float' ? (Number.isInteger(v) ? v.toFixed(1) : String(parseFloat(v.toPrecision(12)))) : String(v));
W.interp = (h) => {
  const cast = (type, v) => (type === 'float' ? Number(v) : Math.trunc(Number(v)));
  sdtStepper(h, {
    key: 'expr', input: '1 - (3.5 + 2)', lex: (t) => lexExpr(t),
    shift: (t) => t,
    reduce: (p, v) => {
      const r = p.rhs.join(' ');
      if (r === 'E + T' || r === 'E - T') {
        const op = p.rhs[1];
        const type = v[0].type === 'float' || v[2].type === 'float' ? 'float' : 'int';
        const a = cast(type, v[0].val);
        const b = cast(type, v[2].val);
        const val = op === '+' ? a + b : a - b;
        return { val: { str: `(${v[0].str} ${op} ${v[2].str})`, type, val }, act: `E.type := ${type}; E.val := cast(${type}, ${fmtVal(v[0].type, v[0].val)}) ${op} cast(${type}, ${fmtVal(v[2].type, v[2].val)}) = ${fmtVal(type, val)}` };
      }
      if (r === 'T') return { val: v[0], act: 'E.str := T.str; E.type := T.type; E.val := T.val' };
      if (r === '( E )') return { val: v[1], act: 'T.str := E.str; T.type := E.type; T.val := E.val' };
      const type = r === 'intLit' ? 'int' : 'float';
      return { val: { str: v[0].lexeme, type, val: cast(type, v[0].lexeme) }, act: `T.str := "${v[0].lexeme}"; T.type := ${type}; T.val := cast(${type}, "${v[0].lexeme}")` };
    },
    view: (host, ctx) => {
      const rows = ctx.stack.map((e) => el('tr', { class: ctx.created && e.val === ctx.created ? 'now' : '' },
        el('td', { class: 'mono' }, e.sym === 'intLit' || e.sym === 'floatLit' ? `${e.sym} "${e.text}"` : e.sym),
        el('td', { class: 'mono' }, e.val && e.val.str != null ? `"${e.val.str}"` : '—'),
        el('td', { class: 'mono' }, e.val && e.val.type ? e.val.type : '—'),
        el('td', { class: 'mono' }, e.val && e.val.type ? fmtVal(e.val.type, e.val.val) : '—')));
      host.replaceChildren(el('div', { class: 'stepinfo' }, 'Atributos de cada símbolo na pilha (fundo em cima):'),
        el('div', { class: 'tbl-wrap' }, el('table', { class: 't trace' }, el('thead', {}, el('tr', {}, el('th', {}, 'Símbolo'), el('th', {}, '.str'), el('th', {}, '.type'), el('th', {}, '.val'))), el('tbody', {}, ...rows))));
    },
    onDone: (v) => el('div', { class: 'note ok' }, el('div', { class: 'stepinfo' }, 'Start → E { println(E.str + " = " + E.val) } imprime:'), el('div', { class: 'mono', style: 'font-size:1.15rem' }, `${v.str} = ${fmtVal(v.type, v.val)}`)),
  });
};

/* ---------- Q2 · Lista 2 · Ex. 4: pós-fixa e prefixa ---------- */
W.posPre = (h) => {
  let idc = 0;
  sdtStepper(h, {
    key: 'posf', input: '9 + 5 * 2', lex: (t) => { idc = 0; return lexExpr(t, false, '+*'); },
    shift: (t) => ({ id: idc++, label: t.sym === 'intLit' ? `intLit ${t.text}` : t.sym, kids: [], leaf: true, lexeme: t.text }),
    reduce: (p, v) => {
      const r = p.rhs.join(' ');
      const node = { id: idc++, label: p.lhs, kids: v };
      if (r === 'E + T' || r === 'T * F') {
        const op = p.rhs[1];
        node.pos = `${v[0].pos} ${v[2].pos} ${op}`;
        node.pre = `${op} ${v[0].pre} ${v[2].pre}`;
        const L = p.rhs[0];
        return { val: node, act: `${p.lhs}.pos := fmt("%s %s ${op}", ${L}₁.pos, ${p.rhs[2]}.pos) = "${node.pos}" ;  ${p.lhs}.pre := fmt("${op} %s %s", ${L}₁.pre, ${p.rhs[2]}.pre) = "${node.pre}"` };
      }
      if (r === 'intLit') { node.pos = node.pre = v[0].lexeme; return { val: node, act: `F.pos := F.pre := intLit.lexeme = ${v[0].lexeme}` }; }
      node.pos = v[0].pos; node.pre = v[0].pre;
      return { val: node, act: `${p.lhs}.pos := ${p.rhs[0]}.pos ;  ${p.lhs}.pre := ${p.rhs[0]}.pre   (repassa)` };
    },
    view: (host, ctx) => {
      const createdId = ctx.created ? ctx.created.id : -1;
      const conv = (n) => ({ label: n.label, cls: n.id === createdId ? 'new' : '', subs: n.leaf ? [] : [{ text: `pos: ${n.pos}`, cls: 'syn' }, { text: `pre: ${n.pre}`, cls: 'inh' }], kids: n.kids.map(conv) });
      const d = el('div', { class: 'diagram' });
      host.replaceChildren(el('div', { class: 'stepinfo' }, ctx.last ? 'Árvore de sintaxe concreta anotada:' : 'Subárvores concretas na pilha (com .pos e .pre já calculados):'), d);
      drawForest(d, ctx.stack.map((e) => conv(e.val)), { gapY: 26 });
    },
    onDone: (v) => el('div', { class: 'note ok' }, el('div', {}, 'Pós-fixa: ', el('b', { class: 'mono' }, v.pos)), el('div', {}, 'Prefixa: ', el('b', { class: 'mono' }, v.pre))),
  });
};

/* ---------- Q2 · Ex. 4c: impressão imediata (pós-fixa funciona; prefixa exige a árvore) ---------- */
W.printScheme = (h) => {
  let out = [];
  sdtStepper(h, {
    key: 'posf', input: '9 + 5 * 2', lex: (t) => { out = []; return lexExpr(t, false, '+*'); },
    shift: (t) => t,
    reduce: (p, v) => {
      const r = p.rhs.join(' ');
      if (r === 'E + T') { out.push('+'); return { val: null, out: out.slice(), act: 'print("+")' }; }
      if (r === 'T * F') { out.push('*'); return { val: null, out: out.slice(), act: 'print("*")' }; }
      if (r === 'intLit') { out.push(v[0].text); return { val: null, out: out.slice(), act: `print(${v[0].text})` }; }
      return { val: null, act: '{ }   (nada a imprimir)' };
    },
    view: (host, ctx) => {
      const printed = ctx.out;
      host.replaceChildren(el('div', { class: 'stepinfo' }, 'Saída impressa até aqui:'), el('div', { class: 'panel mono', style: 'font-size:1.2rem;min-height:2.4em' }, printed.join(' ') || ' '));
    },
  });
};

W.preorder = (h) => {
  const tree = { label: 'E', kids: [{ label: 'E', kids: [{ label: 'T', kids: [{ label: 'F', kids: [{ label: '9', leaf: true, kids: [] }] }] }] }, { label: '+', leaf: true, op: true, kids: [] }, { label: 'T', kids: [{ label: 'T', kids: [{ label: 'F', kids: [{ label: '5', leaf: true, kids: [] }] }] }, { label: '*', leaf: true, op: true, kids: [] }, { label: 'F', kids: [{ label: '2', leaf: true, kids: [] }] }] }] };
  // Pré-ordem "semântica": no nó binário, imprime o operador antes dos dois operandos.
  const order = [];
  let idc = 0;
  const tag = (n) => { n.id = idc++; n.kids.forEach(tag); };
  tag(tree);
  const pre = (n) => {
    if (n.kids.length === 3) { order.push({ n: n.kids[1], out: n.kids[1].label }); pre(n.kids[0]); pre(n.kids[2]); }
    else if (n.kids.length === 1) pre(n.kids[0]);
    else order.push({ n, out: n.label });
  };
  pre(tree);
  const ctrl = el('div');
  const d = el('div', { class: 'diagram' });
  const o = el('div', { class: 'panel mono', style: 'font-size:1.2rem;margin-top:8px' });
  h.append(ctrl, d, o);
  makeStepper(ctrl, order.length + 1, (k) => {
    const done = new Set(order.slice(0, k).map((x) => x.n.id));
    const cur = k ? order[k - 1].n.id : -1;
    const conv = (n) => ({ label: n.label, cls: n.id === cur ? 'new' : done.has(n.id) ? 'focus' : '', kids: n.kids.map(conv) });
    drawForest(d, [conv(tree)]);
    o.textContent = order.slice(0, k).map((x) => x.out).join(' ') || ' ';
  }, { ms: 900 });
};

/* ---------- Q2 · Ex. 3: a(i) é chamada ou acesso a array? ---------- */
W.applyNode = (h) => {
  const opts = [
    ['fun', 'a é função: FUNCTION A(I)'],
    ['arr', 'a é array: INTEGER A(10)'],
    ['var', 'a é variável simples'],
    ['none', 'a não foi declarado'],
  ];
  const body = el('div');
  h.append(el('div', { class: 'toolbar' }, seg(opts.map(([v, l]) => [v, l]), 'fun', (v) => draw(v))), body);
  function draw(v) {
    const before = { label: 'Apply "a"', shape: 'pill', kids: [{ label: 'ExprList', kids: [{ label: 'Object i', shape: 'pill', kids: [] }] }] };
    let after;
    let note;
    if (v === 'fun') { after = { label: 'Call a', shape: 'pill', cls: 'focus', kids: [{ label: 'Object i', shape: 'pill', kids: [] }] }; note = ['ok', 'lookup("a") devolve uma entrada de <b>função</b>: o nó vira chamada. Verifica-se número e tipos dos argumentos contra os parâmetros; o tipo da expressão é o tipo de retorno.']; }
    else if (v === 'arr') { after = { label: 'ArrayIndex a', shape: 'pill', cls: 'focus', kids: [{ label: 'Object i', shape: 'pill', kids: [] }] }; note = ['ok', 'lookup("a") devolve uma entrada de <b>array</b>: o nó vira acesso a elemento. Verifica-se o número de índices (dimensões) e que cada índice é inteiro; o tipo da expressão é o tipo do elemento.']; }
    else if (v === 'var') { after = { label: 'Apply "a"', shape: 'pill', cls: 'err', kids: [{ label: 'Object i', shape: 'pill', kids: [] }] }; note = ['err', 'lookup("a") encontra uma variável escalar: ela não pode ser chamada nem indexada. Reporta o erro (“a não é função nem array”) e continua.']; }
    else { after = { label: 'Apply "a"', shape: 'pill', cls: 'err', kids: [{ label: 'Object i', shape: 'pill', kids: [] }] }; note = ['err', 'lookup("a") falha: identificador não declarado. Reporta o erro, marca o tipo como NoType/erro e continua a análise.']; }
    const d1 = el('div', { class: 'diagram' });
    const d2 = el('div', { class: 'diagram' });
    body.replaceChildren(el('div', { class: 'cols' }, el('div', {}, el('div', { class: 'stepinfo' }, 'Saída do parser (nó genérico):'), d1), el('div', {}, el('div', { class: 'stepinfo' }, 'Depois da análise semântica:'), d2)), el('div', { class: `note ${note[0]}`, html: note[1] }));
    drawForest(d1, [before]);
    drawForest(d2, [after]);
  }
  draw('fun');
};

/* ---------- Q2 · Ex. 5/6: AST com let horizontal + tabela de símbolos ---------- */
const COOL_AST = {
  id: 'prog', label: 'Program', kids: [
    { id: 'cls', label: 'Class Main : IO', kids: [
      { id: 'attr', label: 'Attr z₀ : String', kids: [{ id: 'strA', label: 'Str "A"', shape: 'pill', kids: [] }] },
      { id: 'meth', label: 'Method main : Object', kids: [
        { id: 'let', label: 'Let (4 filhos)', kids: [
          { id: 'dx', label: 'Decl x₁ : Int', kids: [{ id: 'oz1', label: 'Object z', shape: 'pill', obj: 'z', kids: [] }] },
          { id: 'dy', label: 'Decl y₁ : Int', kids: [
            { id: 'let2', label: 'Let', kids: [
              { id: 'dy2', label: 'Decl y₂ : Int', kids: [{ id: 'i5', label: 'Int 5', shape: 'pill', kids: [] }] },
              { id: 'plus2', label: 'Plus', shape: 'pill', kids: [
                { id: 'oy2', label: 'Object y', shape: 'pill', obj: 'y', kids: [] },
                { id: 'ow', label: 'Object w', shape: 'pill', obj: 'w', kids: [] }] }] }] },
          { id: 'dz', label: 'Decl z₁ : Int', kids: [{ id: 'i10', label: 'Int 10', shape: 'pill', kids: [] }] },
          { id: 'call', label: 'Call out_string', kids: [
            { id: 'self', label: 'Object self', shape: 'pill', obj: 'self', kids: [] },
            { id: 'plusA', label: 'Plus', shape: 'pill', kids: [
              { id: 'plusB', label: 'Plus', shape: 'pill', kids: [
                { id: 'ox', label: 'Object x', shape: 'pill', obj: 'x', kids: [] },
                { id: 'oy', label: 'Object y', shape: 'pill', obj: 'y', kids: [] }] },
              { id: 'oz', label: 'Object z', shape: 'pill', obj: 'z', kids: [] }] }] }] }] }] }] };

const SCOPE_STEPS = [
  { node: 'cls', op: 'enter', scope: 'SMain', parent: null, msg: 'Visita Class Main → enter_scope: cria a tabela S_Main (pai: escopo global com as classes).' },
  { node: 'cls', op: 'insert', scope: 'SMain', entries: [['z₀', 'atributo', 'String'], ['self', 'var', 'SELF_TYPE_Main'], ['main', 'método', '() : Object']], msg: 'Insere as features da classe: atributo z₀ : String, self e o método main (visíveis em toda a classe). out_string vem de IO, no ambiente de métodos.' },
  { node: 'strA', op: 'visit', msg: 'Visita o inicializador "A": literal, nenhuma busca.' },
  { node: 'meth', op: 'visit', msg: 'Visita o método main (sem parâmetros: o escopo de parâmetros ficaria vazio e foi omitido).' },
  { node: 'let', op: 'enter', scope: 'SLet', parent: 'SMain', msg: 'Visita o Let externo → enter_scope: cria S_Let, vazia, com ponteiro para S_Main.' },
  { node: 'oz1', op: 'lookup', name: 'z', path: ['SLet', 'SMain'], found: ['SMain', 'z₀'], msg: 'Declaração de x: primeiro o inicializador. lookup("z"): S_Let ainda está vazia → sobe para S_Main → acha z₀ : String. Anota use(z) → z₀.' },
  { node: 'dx', op: 'insert', scope: 'SLet', entries: [['x₁', 'var', 'Int']], msg: 'Só agora insere x₁ : Int em S_Let (o inicializador foi analisado antes da variável existir).' },
  { node: 'let2', op: 'enter', scope: 'SLet2', parent: 'SLet', msg: 'Inicializador de y é outro Let → enter_scope: cria S_Let2 com pai S_Let.' },
  { node: 'i5', op: 'visit', msg: 'Inicializador 5: literal.' },
  { node: 'dy2', op: 'insert', scope: 'SLet2', entries: [['y₂', 'var', 'Int']], msg: 'Insere y₂ : Int em S_Let2.' },
  { node: 'oy2', op: 'lookup', name: 'y', path: ['SLet2'], found: ['SLet2', 'y₂'], msg: 'lookup("y") a partir de S_Let2 → acha y₂ no próprio escopo. use(y) → y₂.' },
  { node: 'ow', op: 'lookup', name: 'w', path: ['SLet2', 'SLet', 'SMain'], found: null, msg: 'lookup("w"): S_Let2 → S_Let → S_Main → não existe. Reporta “w não declarado” e continua a construção.' },
  { node: 'let2', op: 'exit', scope: 'SLet2', msg: 'Fim do Let interno → exit_scope: volta para S_Let. S_Let2 não é apagada (tabela persistente): use(y) continua apontando para y₂.' },
  { node: 'dy', op: 'insert', scope: 'SLet', entries: [['y₁', 'var', 'Int']], msg: 'Insere y₁ : Int em S_Let — é uma entrada diferente de y₂.' },
  { node: 'i10', op: 'visit', msg: 'Inicializador 10: literal.' },
  { node: 'dz', op: 'insert', scope: 'SLet', entries: [['z₁', 'var', 'Int']], msg: 'Insere z₁ : Int em S_Let. A partir daqui, z dentro do let esconde o atributo z₀.' },
  { node: 'self', op: 'lookup', name: 'self', path: ['SLet', 'SMain'], found: ['SMain', 'self'], msg: 'Corpo: chamada out_string sobre self (implícito). lookup("self") → S_Main.' },
  { node: 'ox', op: 'lookup', name: 'x', path: ['SLet'], found: ['SLet', 'x₁'], msg: 'lookup("x") → x₁ em S_Let.' },
  { node: 'oy', op: 'lookup', name: 'y', path: ['SLet'], found: ['SLet', 'y₁'], msg: 'lookup("y") → y₁ em S_Let (S_Let2 não está no caminho: não é ancestral do escopo atual).' },
  { node: 'oz', op: 'lookup', name: 'z', path: ['SLet'], found: ['SLet', 'z₁'], msg: 'lookup("z") → z₁ em S_Let. Mesmo nome do primeiro uso, outra declaração!' },
  { node: 'let', op: 'exit', scope: 'SLet', msg: 'Fim do Let externo → exit_scope. Depois saem o método e a classe; todas as tabelas continuam existindo.' },
];
const DECL_COLOR = { 'z₀': 'var(--goto)', 'x₁': 'var(--shift)', 'y₁': 'var(--accept)', 'y₂': 'var(--reduce)', 'z₁': 'var(--margin-red)', self: 'var(--ink-2)' };
const SCOPE_NAME = { SMain: 'S_Main', SLet: 'S_Let', SLet2: 'S_Let2' };

function astLabel(id, n = COOL_AST) {
  if (n.id === id) return n.label;
  for (const c of n.kids) { const r = astLabel(id, c); if (r) return r; }
  return null;
}

function replayScopes(k) {
  const scopes = {};
  const order = [];
  let current = null;
  const uses = {};
  const errors = [];
  for (let i = 0; i <= k; i++) {
    const s = SCOPE_STEPS[i];
    if (s.op === 'enter') { scopes[s.scope] = { name: s.scope, parent: s.parent, entries: [], closed: false }; order.push(s.scope); current = s.scope; }
    if (s.op === 'insert') s.entries.forEach((e) => scopes[s.scope].entries.push({ name: e[0], kind: e[1], type: e[2], step: i }));
    if (s.op === 'exit') { scopes[s.scope].closed = true; current = scopes[s.scope].parent; }
    if (s.op === 'lookup') { if (s.found) uses[s.node] = s.found[1]; else { uses[s.node] = null; errors.push(i); } }
  }
  return { scopes, order, current, uses, errors };
}

function scopeTree(state, step) {
  const wrap = el('div', { class: 'scopes' });
  const render = (name, depth) => {
    const sc = state.scopes[name];
    if (!sc) return;
    const cls = ['scopebox'];
    if (state.current === name) cls.push('cur');
    if (step && step.op === 'lookup' && step.path.includes(name)) cls.push('path');
    if (sc.closed) cls.push('closed');
    const rows = sc.entries.map((e) => {
      const tr = el('tr', {}, el('td', { style: `color:${DECL_COLOR[e.name] || 'inherit'};font-weight:700` }, e.name), el('td', {}, e.kind), el('td', {}, e.type));
      if (step && step.op === 'insert' && step.scope === name && e.step === SCOPE_STEPS.indexOf(step)) tr.classList.add('newe');
      if (step && step.op === 'lookup' && step.found && step.found[0] === name && step.found[1] === e.name) tr.classList.add('found');
      return tr;
    });
    if (!rows.length) rows.push(el('tr', { class: 'empty-row' }, el('td', { colspan: 3 }, 'vazia')));
    const box = el('div', { class: cls.join(' ') }, el('div', { class: 'sh' }, SCOPE_NAME[name], el('i', {}, sc.parent ? `pai → ${SCOPE_NAME[sc.parent]}` : 'pai → global')), el('table', {}, el('tbody', {}, ...rows)));
    const row = el('div', { style: `margin-left:${depth * 26}px;margin-top:${depth ? 10 : 0}px;position:relative` }, box);
    if (depth) row.prepend(el('div', { 'aria-hidden': 'true', style: 'position:absolute;left:-16px;top:-10px;width:12px;height:26px;border-left:1.5px solid var(--ink-3);border-bottom:1.5px solid var(--ink-3)' }));
    wrap.append(row);
    state.order.filter((n) => state.scopes[n].parent === name).forEach((c) => render(c, depth + 1));
  };
  render('SMain', 0);
  return wrap;
}

function annotatedAst(focus, uses, errorsAt) {
  const conv = (n) => {
    const o = { label: n.label, shape: n.shape, kids: n.kids.map(conv), subs: [] };
    if (n.obj && n.obj !== 'self' && n.id in uses) {
      if (uses[n.id]) o.subs.push({ text: `use → ${uses[n.id]}`, cls: 'syn' });
      else { o.subs.push({ text: 'erro: não declarado', cls: '' }); o.cls = 'err'; }
    }
    if (n.id === focus) o.cls = (o.cls ? o.cls + ' ' : '') + 'focus';
    return o;
  };
  return conv(COOL_AST);
}

W.coolAst = (h) => {
  const d = el('div', { class: 'diagram' });
  h.append(d);
  drawForest(d, [annotatedAst(null, {}, [])], { gapX: 10 });
};

W.scopeWalk = (h) => {
  const ctrl = el('div');
  const exp = el('div', { class: 'explain' });
  const tables = el('div');
  const ast = el('div', { class: 'diagram' });
  const log = el('ul', { class: 'log' });
  h.append(ctrl, el('div', { class: 'cols-even' }, el('div', {}, exp, el('h3', {}, 'Operações até aqui'), el('div', { class: 'panel', style: 'max-height:220px;overflow:auto;padding:0' }, log)), el('div', {}, el('div', { class: 'stepinfo' }, 'Tabelas (cada uma aponta para o escopo anterior):'), tables)), el('div', { class: 'stepinfo', style: 'margin-top:10px' }, 'AST: nó visitado em azul; cada Object ganha use → declaração.'), ast);
  makeStepper(ctrl, SCOPE_STEPS.length, (k) => {
    const st = replayScopes(k);
    const s = SCOPE_STEPS[k];
    exp.className = `explain ${s.op === 'lookup' && !s.found ? 'k-err' : s.op === 'lookup' ? 'k-acc' : s.op === 'insert' ? 'k-r' : ''}`;
    exp.innerHTML = `<p><b>${{ enter: 'enter_scope', exit: 'exit_scope', insert: 'insert', lookup: `lookup("${s.name}")`, visit: 'visita' }[s.op]}</b></p><p>${esc(s.msg)}</p>`;
    tables.replaceChildren(scopeTree(st, s));
    drawForest(ast, [annotatedAst(s.node, st.uses, st.errors)], { gapX: 10 });
    log.replaceChildren(...SCOPE_STEPS.slice(0, k + 1).map((x, i) => el('li', { class: `${x.op === 'lookup' && !x.found ? 'e' : ''}${i === k ? ' now' : ''}` }, `${i + 1}. ${x.op === 'lookup' ? `lookup(${x.name}) → ${x.found ? x.found[1] : 'ERRO'}` : x.op === 'insert' ? `insert ${x.entries.map((e) => e[0]).join(', ')} em ${SCOPE_NAME[x.scope]}` : x.op === 'enter' ? `enter_scope ${SCOPE_NAME[x.scope]}` : x.op === 'exit' ? `exit_scope ${SCOPE_NAME[x.scope]}` : 'visita ' + astLabel(x.node)}`)));
    if (k === SCOPE_STEPS.length - 1) log.lastChild.scrollIntoView({ block: 'nearest' });
  }, { ms: 1600 });
};

W.useWhy = (h) => {
  let mode = 'use';
  const body = el('div');
  h.append(el('div', { class: 'toolbar' }, seg([['use', 'Com o ponteiro use (gravado na hora)'], ['redo', 'Sem use: refazer lookup depois']], mode, (v) => { mode = v; draw(); })), body);
  const rows = [
    ['z (inicializador de x)', 'z₀ : String', 'z₁ : Int', 'x : Int <- z passa a parecer correto: o erro String ≤ Int some.'],
    ['y (dentro do let interno)', 'y₂ : Int', 'y₁ : Int (se refeito em S_Let) ou y₂ (se refeito em S_Let2)', 'Depende de qual tabela a fase posterior usar; sem use é preciso guardar e reconstruir o escopo exato de cada ponto.'],
    ['w', 'não declarado (erro)', 'não declarado (erro)', 'Igual nos dois casos.'],
    ['x, y, z (corpo)', 'x₁, y₁, z₁', 'x₁, y₁, z₁', 'Iguais: aqui todas as declarações já tinham acontecido.'],
  ];
  function draw() {
    body.replaceChildren(el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Uso'), el('th', {}, mode === 'use' ? 'use aponta para' : 'lookup refeito no fim (S_Let completa)'), el('th', {}, 'Consequência'))),
      el('tbody', {}, ...rows.map((r) => el('tr', {}, el('td', {}, r[0]), el('td', { class: 'mono' + (mode === 'redo' && r[1] !== r[2] ? ' bad' : '') }, mode === 'use' ? r[1] : r[2]), el('td', {}, mode === 'use' ? 'Correto: é a declaração visível no ponto do uso.' : r[3])))))));
  }
  draw();
};

/* ---------- Q3: regras de inferência ---------- */
function rule(prem, conc, name) {
  return `<span class="rule"><span class="rbody"><span class="prem">${prem.map((p) => `<span>${p}</span>`).join('')}</span><span class="bar"></span><span class="conc">${conc}</span></span>${name ? `<span class="rname">[${name}]</span>` : ''}</span>`;
}
W.rule = (h) => {
  const d = h.dataset;
  h.classList.add('rulebox');
  h.innerHTML = rule(d.prem ? d.prem.split('||') : [], d.conc, d.name);
};

const HIER = { Object: null, Int: 'Object', Bool: 'Object', String: 'Object', IO: 'Object', A: 'Object', B: 'A', C: 'A', D: 'B' };
const ancestors = (t) => { const out = []; for (let x = t; x; x = HIER[x]) out.push(x); return out; };
const join = (a, b) => { const A = ancestors(a); return ancestors(b).find((x) => A.includes(x)); };
W.joinCalc = (h) => {
  const pos = { Object: [300, 24], Int: [60, 100], Bool: [160, 100], String: [260, 100], IO: [360, 100], A: [480, 100], B: [430, 176], C: [540, 176], D: [430, 252] };
  let picks = ['D', 'C'];
  const svgHost = el('div', { class: 'diagram', style: 'max-width:640px' });
  const out = el('div');
  h.append(el('p', { class: 'stepinfo' }, 'Toque em dois tipos. A hierarquia é a do quadro (B e C herdam de A; D herda de B), mais os tipos básicos.'), svgHost, out);
  function draw() {
    const s = sv('svg', { viewBox: '0 0 620 290', width: 620, height: 290, class: 'hier', role: 'img', 'aria-label': 'Hierarquia de tipos' });
    for (const [t, p] of Object.entries(HIER)) if (p) s.append(sv('line', { x1: pos[t][0], y1: pos[t][1] - 14, x2: pos[p][0], y2: pos[p][1] + 14 }));
    const j = picks.length === 2 ? join(picks[0], picks[1]) : null;
    const anc = new Set(picks.flatMap(ancestors));
    for (const [t, [x, y]] of Object.entries(pos)) {
      const cls = ['hn'];
      if (picks.includes(t)) cls.push('pick');
      else if (t === j) cls.push('join');
      else if (anc.has(t)) cls.push('anc');
      if (t === j && picks.includes(t)) cls.push('join');
      const g = sv('g', { class: cls.join(' '), tabindex: 0, role: 'button', 'aria-label': t });
      g.append(sv('rect', { x: x - 36, y: y - 14, width: 72, height: 28, rx: 6 }), sv('text', { x, y: y + 5, 'text-anchor': 'middle' }, t));
      const pick = () => { picks = [...picks, t].slice(-2); draw(); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      s.append(g);
    }
    svgHost.replaceChildren(s);
    if (picks.length < 2) { out.replaceChildren(el('p', {}, 'Escolha mais um tipo.')); return; }
    const [a, b] = picks;
    const le = (x, y) => ancestors(x).includes(y);
    out.replaceChildren(el('div', { class: 'note ok', html: `<b>${a} ⊔ ${b} = ${j}</b> — o menor tipo que está acima dos dois. Ancestrais de ${a}: ${ancestors(a).join(' ≤ ')}. Ancestrais de ${b}: ${ancestors(b).join(' ≤ ')}. O primeiro em comum é ${j}.` }),
      el('p', { class: 'mono' }, `${a} ≤ ${b}? ${le(a, b) ? 'sim' : 'não'}   ·   ${b} ≤ ${a}? ${le(b, a) ? 'sim' : 'não'}`),
      el('p', { html: `Uso no <code>if</code>: <code>if e₀ then (e₁ : ${a}) else (e₂ : ${b}) fi : ${a} ⊔ ${b} = ${j}</code>` }));
  }
  draw();
};

/* Passos da verificação de tipos do Ex. 7 (com erros e sem erros) */
const LET_ERR = {
  rows: [
    ['O₁,M,C ⊢ z : <S1>', '<S1> ≤ Int <C1>'],
    ['O₂,M,C ⊢ (let y : Int <- 5 in y + w) : <S2>', '<S2> ≤ Int <C2>'],
    ['O₃,M,C ⊢ 10 : <S3>', '<S3> ≤ Int <C3>'],
    ['O₄,M,C ⊢ out_string(x + y + z) : <S4>', ''],
  ],
  conc: 'O,M,C ⊢ let x : Int <- z, y : Int <- (…), z : Int <- 10 in out_string(x + y + z) : <S4>',
  steps: [
    { fill: {}, env: 0, msg: 'Comece pelo nó raiz (o let) e escreva a regra com incógnitas. Ambientes: O₁ = O (contém z : String, self, …), O₂ = O₁[Int/x], O₃ = O₂[Int/y], O₄ = O₃[Int/z]. Para descobrir T₁′…T₄ é preciso visitar os filhos.' },
    { fill: { S1: 'String' }, env: 1, sub: rule(['O₁(z) = String'], 'O₁,M,C ⊢ z : String', 'Var'), msg: 'Filho 1: o inicializador de x é z. Em O₁ (antes de x, y, z locais existirem) z é o atributo: [Var] dá T₁′ = String.' },
    { fill: { S1: 'String', C1: '✗' }, env: 1, err: 'x : Int inicializado com String (String ≤ Int é falso).', msg: 'Verifica T₁′ ≤ T₁: String ≤ Int? Não — String e Int são irmãos sob Object. Reporta o erro e continua com o tipo DECLARADO: O₂ = O₁[Int/x].' },
    { fill: { S1: 'String', C1: '✗', S2: 'NoType' }, env: 2, err: 'w não declarado (y + w).', sub: rule(['O₂,M,C ⊢ 5 : Int', 'Int ≤ Int', rule(['O₂[Int/y] ⊢ y : Int', 'O₂[Int/y] ⊢ w : NoType'], 'O₂[Int/y],M,C ⊢ y + w : NoType', 'Arit. c/ NoType')], 'O₂,M,C ⊢ (let y : Int <- 5 in y + w) : NoType', 'Let'), msg: 'Filho 2: o let interno. 5 : Int ✓. No corpo, y é o y interno (Int) e w não existe: erro, w : NoType. Pela regra do exercício, Int + NoType = NoType. O let tem o tipo do corpo: T₂′ = NoType.' },
    { fill: { S1: 'String', C1: '✗', S2: 'NoType', C2: '✓' }, env: 2, msg: 'NoType ≤ Int vale (NoType ≤ T para todo T): nenhum erro em cascata. O₃ = O₂[Int/y].' },
    { fill: { S1: 'String', C1: '✗', S2: 'NoType', C2: '✓', S3: 'Int', C3: '✓' }, env: 3, sub: rule(['10 é literal inteiro'], 'O₃,M,C ⊢ 10 : Int', 'Int'), msg: 'Filho 3: 10 : Int e Int ≤ Int ✓. O₄ = O₃[Int/z] — o z local esconde o atributo z : String.' },
    { fill: { S1: 'String', C1: '✗', S2: 'NoType', C2: '✓', S3: 'Int', C3: '✓' }, env: 4, sub: rule([rule(['O₄ ⊢ x : Int', 'O₄ ⊢ y : Int'], 'O₄ ⊢ x + y : Int', 'Arit.'), 'O₄ ⊢ z : Int'], 'O₄,M,C ⊢ (x + y) + z : Int', 'Aritmética'), msg: 'Corpo: argumento x + y + z = (x + y) + z. Em O₄ os três são as variáveis locais Int, então o argumento tem tipo Int.' },
    { fill: { S1: 'String', C1: '✗', S2: 'NoType', C2: '✓', S3: 'Int', C3: '✓', S4: 'SELF_TYPE_Main' }, env: 4, err: 'out_string espera String; recebeu Int (Int ≤ String é falso).', sub: rule(['O₄ ⊢ self : SELF_TYPE_Main', 'O₄ ⊢ x + y + z : Int', 'M(Main, out_string) = (String, SELF_TYPE)', '<span class="bad">Int ≤ String ✗</span>', 'T<sub>R</sub> = SELF_TYPE_Main'], 'O₄,M,C ⊢ out_string(x + y + z) : SELF_TYPE_Main', 'Despacho'), msg: 'Despacho implícito sobre self. Assinatura herdada de IO: out_string(String) : SELF_TYPE. Int ≤ String falha → erro. O tipo de retorno ainda é conhecido: o retorno declarado é SELF_TYPE, então a chamada tem o tipo do receptor, SELF_TYPE_Main. Logo T₄ = SELF_TYPE_Main.' },
    { fill: { S1: 'String', C1: '✗', S2: 'NoType', C2: '✓', S3: 'Int', C3: '✓', S4: 'SELF_TYPE_Main' }, env: 4, msg: 'Conclusão: o let tem tipo T₄ = SELF_TYPE_Main ≤ Object (retorno declarado de main) ✓. Três erros reportados, e a análise percorreu a árvore inteira. (Política alternativa aceitável: dar NoType à chamada inválida.)' },
  ],
};
const LET_OK = {
  rows: [
    ['O₁,M,C ⊢ 10 : <S1>', '<S1> ≤ Int <C1>'],
    ['O₂,M,C ⊢ (let y : Int <- 5 in y + 5) : <S2>', '<S2> ≤ Int <C2>'],
    ['O₃,M,C ⊢ 10 : <S3>', '<S3> ≤ Int <C3>'],
    ['O₄,M,C ⊢ out_int(x + y + z) : <S4>', ''],
  ],
  conc: 'O,M,C ⊢ let x : Int <- 10, y : Int <- (…), z : Int <- 10 in out_int(x + y + z) : <S4>',
  steps: [
    { fill: {}, env: 0, msg: 'Mesma regra de let com 3 declarações; agora sem erros. Escreva a conclusão e as premissas com incógnitas.' },
    { fill: { S1: 'Int', C1: '✓' }, env: 1, sub: rule(['10 é literal inteiro'], 'O₁,M,C ⊢ 10 : Int', 'Int'), msg: 'x: 10 : Int e Int ≤ Int ✓. O₂ = O₁[Int/x].' },
    { fill: { S1: 'Int', C1: '✓', S2: 'Int' }, env: 2, sub: rule(['O₂ ⊢ 5 : Int', 'Int ≤ Int', rule(['O₂[Int/y](y) = Int', 'O₂[Int/y] ⊢ 5 : Int'], 'O₂[Int/y],M,C ⊢ y + 5 : Int', 'Arit.')], 'O₂,M,C ⊢ (let y : Int <- 5 in y + 5) : Int', 'Let'), msg: 'y: o let interno cria O₂[Int/y]; y + 5 : Int; o let interno tem o tipo do corpo: Int.' },
    { fill: { S1: 'Int', C1: '✓', S2: 'Int', C2: '✓', S3: 'Int', C3: '✓' }, env: 3, msg: 'Int ≤ Int ✓ ⇒ O₃ = O₂[Int/y]. z: 10 : Int ✓ ⇒ O₄ = O₃[Int/z].' },
    { fill: { S1: 'Int', C1: '✓', S2: 'Int', C2: '✓', S3: 'Int', C3: '✓', S4: 'SELF_TYPE_Main' }, env: 4, sub: rule(['O₄ ⊢ self : SELF_TYPE_Main', rule(['O₄ ⊢ x + y : Int', 'O₄ ⊢ z : Int'], 'O₄ ⊢ (x + y) + z : Int', 'Arit.'), 'M(Main, out_int) = (Int, SELF_TYPE)', 'Int ≤ Int', 'T<sub>R</sub> = SELF_TYPE_Main'], 'O₄,M,C ⊢ out_int(x + y + z) : SELF_TYPE_Main', 'Despacho'), msg: 'Corpo: argumento Int, out_int espera Int ✓. Retorno SELF_TYPE ⇒ tipo do receptor: SELF_TYPE_Main. (Em execução, imprime 10 + 10 + 10 = 30 e devolve self.)' },
    { fill: { S1: 'Int', C1: '✓', S2: 'Int', C2: '✓', S3: 'Int', C3: '✓', S4: 'SELF_TYPE_Main' }, env: 4, msg: 'Todas as premissas valem: O,M,C ⊢ let … : SELF_TYPE_Main. Nenhum erro.' },
  ],
};
const ENVS_ERR = [
  'O₁ = O = { z : String, self : SELF_TYPE_Main, … }',
  'O₂ = O₁[Int/x]',
  'O₃ = O₂[Int/y]',
  'O₄ = O₃[Int/z]   (z : Int esconde z : String)',
];
function typeStepper(h, data) {
  const ctrl = el('div');
  const board = el('div', { class: 'panel rulebox' });
  const exp = el('div', { class: 'explain' });
  const sub = el('div', { class: 'rulebox' });
  const env = el('div', { class: 'panel mono', style: 'font-size:.85rem' });
  const errs = el('ul', { class: 'log' });
  h.append(ctrl, board, el('div', { class: 'cols-2-1' }, el('div', {}, exp, el('div', { class: 'stepinfo' }, 'Sub-derivação deste passo:'), sub), el('div', {}, el('div', { class: 'stepinfo' }, 'Ambientes:'), env, el('div', { class: 'stepinfo', style: 'margin-top:8px' }, 'Erros reportados:'), el('div', { class: 'panel', style: 'padding:0' }, errs))));
  const fillTxt = (s, f) => s.replace(/<(S\d|C\d)>/g, (_, k) => {
    if (k[0] === 'C') return f[k] ? `<b class="${f[k] === '✓' ? 'good' : 'bad'}">${f[k]}</b>` : '';
    const i = k.slice(1);
    const name = i === '4' ? 'T₄' : `T${'₀₁₂₃₄'[i]}′`;
    return f[k] ? `<span class="slot">${f[k]}</span>` : `<span class="slot empty">${name}</span>`;
  });
  makeStepper(ctrl, data.steps.length, (k) => {
    const s = data.steps[k];
    board.innerHTML = rule(data.rows.map((r) => fillTxt(r[0], s.fill) + (r[1] ? '&nbsp;&nbsp;&nbsp;' + fillTxt(r[1], s.fill) : '')), fillTxt(data.conc, s.fill), 'Let');
    $('.prem', board).style.flexDirection = 'column';
    $('.prem', board).style.alignItems = 'flex-start';
    exp.className = `explain ${s.err ? 'k-err' : ''}`;
    exp.innerHTML = `<p>${esc(s.msg)}</p>`;
    sub.innerHTML = s.sub || '<p class="stepinfo">—</p>';
    env.innerHTML = data.envs.slice(0, s.env + 1).map((x, i) => `<div${i === s.env ? ' style="font-weight:700"' : ''}>${esc(x)}</div>`).join('');
    const all = data.steps.slice(0, k + 1).filter((x) => x.err);
    errs.replaceChildren(...(all.length ? all.map((x, i) => el('li', { class: 'e' }, `${i + 1}. ${x.err}`)) : [el('li', {}, 'nenhum até aqui')]));
  }, { ms: 2600 });
}
const ENVS_OK = ['O₁ = O = { self : SELF_TYPE_Main, … }', 'O₂ = O₁[Int/x]', 'O₃ = O₂[Int/y]', 'O₄ = O₃[Int/z]'];
W.typeErr = (h) => typeStepper(h, { ...LET_ERR, envs: ENVS_ERR });
W.typeOk = (h) => typeStepper(h, { ...LET_OK, envs: ENVS_OK });

/* ===================== navegação entre slides ===================== */
function initDeck() {
  const slides = $$('.slide');
  const index = $('#index');
  const counter = $('#counter');
  const progress = $('#progress');
  const mods = { inicio: 'Início', q1: 'Questão 1 · Análise ascendente', q2: 'Questão 2 · Escopo + SDT', q3: 'Questão 3 · Inferência de tipos', fim: 'Treino final' };
  let curMod = null;
  let ol = null;
  slides.forEach((s, i) => {
    const mod = s.dataset.mod;
    if (mod !== curMod) {
      curMod = mod;
      const [a, b] = mods[mod].split(' · ');
      index.append(el('h3', { html: b ? `<b>${esc(a)}</b> · ${esc(b)}` : esc(a) }));
      ol = el('ol');
      index.append(ol);
    }
    const a = el('a', { href: '#' + s.id }, el('span', { class: 'n' }, String(i + 1).padStart(2, '0')), el('span', { html: esc(s.dataset.title) + (s.dataset.key ? '<span class="star" title="Destaque para a prova">★</span>' : '') }));
    a.addEventListener('click', () => document.body.classList.remove('index-open'));
    ol.append(el('li', {}, a));
  });
  const mounted = new Set();
  const prevA = $('#prev');
  const nextA = $('#next');
  function show(id, scroll = true) {
    let i = slides.findIndex((s) => s.id === id);
    if (i < 0) i = 0;
    slides.forEach((s, j) => { s.hidden = j !== i; });
    const s = slides[i];
    if (!mounted.has(s.id)) {
      mounted.add(s.id);
      $$('[data-w]', s).forEach((hst) => {
        try { W[hst.dataset.w](hst); } catch (e) { console.error(e); hst.append(el('p', { class: 'err-msg' }, 'Erro ao montar este exemplo: ' + e.message)); }
      });
    }
    $$('#index a').forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + s.id ? 'page' : 'false'));
    const cur = $('#index a[aria-current="page"]');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    counter.textContent = `${i + 1} / ${slides.length}`;
    progress.style.width = `${((i + 1) / slides.length) * 100}%`;
    $$('.modtab').forEach((b) => b.setAttribute('aria-current', String(b.dataset.mod === s.dataset.mod)));
    const p = slides[i - 1];
    const n = slides[i + 1];
    prevA.hidden = !p;
    nextA.hidden = !n;
    if (p) { prevA.href = '#' + p.id; $('span', prevA).textContent = p.dataset.title; }
    if (n) { nextA.href = '#' + n.id; $('span', nextA).textContent = n.dataset.title; }
    $('#mprev').disabled = !p;
    $('#mnext').disabled = !n;
    if (scroll) window.scrollTo({ top: 0 });
    document.title = `${s.dataset.title} · Revisão P2 de Compiladores`;
    return i;
  }
  const curIndex = () => slides.findIndex((s) => !s.hidden);
  const go = (d) => { const i = curIndex() + d; if (slides[i]) location.hash = slides[i].id; };
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
  });
  $('#mprev').onclick = () => go(-1);
  $('#mnext').onclick = () => go(1);
  $('#menu').onclick = () => document.body.classList.toggle('index-open');
  $('#scrim').onclick = () => document.body.classList.remove('index-open');
  $$('.modtab').forEach((b) => { b.onclick = () => { const s = slides.find((x) => x.dataset.mod === b.dataset.mod); if (s) location.hash = s.id; }; });
  show(location.hash.slice(1), false);
}
document.addEventListener('DOMContentLoaded', initDeck);
