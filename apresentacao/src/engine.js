/* Motor LR: gramática → FIRST/FOLLOW → coleções LR(0)/LR(1) → LALR → tabela Ações/Goto → execução com pilha.
   Tudo o que a apresentação mostra sobre autômatos e tabelas sai daqui (nada é digitado à mão). */
const LR = (() => {
  const EOF = 'eof';
  const EPS = 'ε';

  function splitRhs(s) {
    const t = s.trim();
    if (t === '' || t === EPS || t === 'eps') return [];
    return t.split(/\s+/).filter((x) => x !== EPS);
  }

  /* Formato: "A -> α | β" (ou →). Linhas iniciadas por "|" continuam a produção anterior. */
  function parseGrammar(text, opts = {}) {
    const lines = text.split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean);
    const raw = [];
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^(\S+)\s*(?:->|→|::=)\s*(.*)$/);
      let lhs, rest;
      if (m) { lhs = m[1]; rest = m[2]; cur = lhs; }
      else if (line.startsWith('|') && cur) { lhs = cur; rest = line.slice(1); }
      else throw new Error(`Não entendi a linha "${line}". Use o formato  A -> x y | z`);
      for (const alt of rest.split('|')) raw.push({ lhs, rhs: splitRhs(alt) });
    }
    if (!raw.length) throw new Error('A gramática está vazia.');

    const lhsSet = new Set(raw.map((p) => p.lhs));
    const first = raw[0];
    const firstCount = raw.filter((p) => p.lhs === first.lhs).length;
    const usedOnRhs = raw.some((p) => p.rhs.includes(first.lhs));
    const looksAugmented = firstCount === 1 && first.rhs.length === 1 && lhsSet.has(first.rhs[0]) && !usedOnRhs;
    const augmented = opts.augmented ?? looksAugmented;

    let prods;
    if (augmented) {
      prods = raw;
    } else {
      let name = opts.startName || (lhsSet.has('Start') ? 'Goal' : 'Start');
      while (lhsSet.has(name)) name += "'";
      prods = [{ lhs: name, rhs: [first.lhs] }, ...raw];
    }
    prods = prods.map((p, idx) => ({ ...p, idx }));

    const nonterms = [];
    for (const p of prods) if (!nonterms.includes(p.lhs)) nonterms.push(p.lhs);
    let terms = [];
    for (const p of prods) for (const s of p.rhs) if (!nonterms.includes(s) && !terms.includes(s)) terms.push(s);
    if (opts.termOrder) {
      const extra = terms.filter((t) => !opts.termOrder.includes(t));
      terms = [...opts.termOrder.filter((t) => terms.includes(t)), ...extra];
    }
    terms.push(EOF);

    const G = {
      prods, nonterms, terms, start: prods[0].lhs, origStart: prods[0].rhs[0],
      isNT: (s) => nonterms.includes(s),
      prodsOf: {},
    };
    for (const nt of nonterms) G.prodsOf[nt] = prods.filter((p) => p.lhs === nt);
    computeFirstFollow(G);
    return G;
  }

  function computeFirstFollow(G) {
    const FIRST = {};
    for (const t of G.terms) FIRST[t] = new Set([t]);
    for (const nt of G.nonterms) FIRST[nt] = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of G.prods) {
        const f = firstOfSeq(G, p.rhs, FIRST);
        for (const x of f) if (!FIRST[p.lhs].has(x)) { FIRST[p.lhs].add(x); changed = true; }
      }
    }
    G.FIRST = FIRST;
    const FOLLOW = {};
    for (const nt of G.nonterms) FOLLOW[nt] = new Set();
    FOLLOW[G.start].add(EOF);
    changed = true;
    while (changed) {
      changed = false;
      for (const p of G.prods) {
        p.rhs.forEach((s, i) => {
          if (!G.isNT(s)) return;
          const f = firstOfSeq(G, p.rhs.slice(i + 1));
          for (const x of f) {
            if (x === EPS) continue;
            if (!FOLLOW[s].has(x)) { FOLLOW[s].add(x); changed = true; }
          }
          if (f.has(EPS)) for (const x of FOLLOW[p.lhs]) if (!FOLLOW[s].has(x)) { FOLLOW[s].add(x); changed = true; }
        });
      }
    }
    G.FOLLOW = FOLLOW;
  }

  /* FIRST de uma sequência; contém ε quando a sequência inteira pode sumir. */
  function firstOfSeq(G, seq, FIRST = G.FIRST) {
    const out = new Set();
    for (const s of seq) {
      const f = FIRST[s] || new Set([s]);
      for (const x of f) if (x !== EPS) out.add(x);
      if (!f.has(EPS)) return out;
    }
    out.add(EPS);
    return out;
  }

  const sortBy = (order) => (a, b) => order.indexOf(a) - order.indexOf(b);

  function itemKey(it) { return it.la == null ? `${it.p}.${it.d}` : `${it.p}.${it.d}.${it.la}`; }
  function coreKey(it) { return `${it.p}.${it.d}`; }

  /* closure com o registro de "por que" cada item entrou (para a explicação passo a passo). */
  function closure(G, kernel, withLA) {
    const items = kernel.map((it) => ({ ...it, kernel: true }));
    const seen = new Set(items.map(itemKey));
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const rhs = G.prods[it.p].rhs;
      const Y = rhs[it.d];
      if (Y === undefined || !G.isNT(Y)) continue;
      const beta = rhs.slice(it.d + 1);
      let las = [null];
      if (withLA) {
        const f = firstOfSeq(G, [...beta, it.la]);
        las = [...f].filter((x) => x !== EPS).sort(sortBy(G.terms));
      }
      for (const q of G.prodsOf[Y]) {
        for (const la of las) {
          const n = { p: q.idx, d: 0, la, kernel: false, from: { item: it, beta, las } };
          const k = itemKey(n);
          if (!seen.has(k)) { seen.add(k); items.push(n); }
        }
      }
    }
    return items;
  }

  function nextSymbols(G, items) {
    const out = [];
    for (const it of items) {
      const X = G.prods[it.p].rhs[it.d];
      if (X !== undefined && !out.includes(X)) out.push(X);
    }
    return out;
  }

  function gotoKernel(G, items, X) {
    const k = [];
    const seen = new Set();
    for (const it of items) {
      if (G.prods[it.p].rhs[it.d] === X) {
        const n = { p: it.p, d: it.d + 1, la: it.la };
        const key = itemKey(n);
        if (!seen.has(key)) { seen.add(key); k.push(n); }
      }
    }
    return k;
  }

  const kernelKey = (kernel) => kernel.map(itemKey).sort().join('|');

  /* Coleção canônica por busca em largura: estados numerados na ordem em que aparecem. */
  function buildCollection(G, kind, opts = {}) {
    const withLA = kind === 'lr1';
    const k0 = [{ p: 0, d: 0, la: withLA ? EOF : null }];
    const states = [{ kernel: k0, items: closure(G, k0, withLA), via: null }];
    const byKey = new Map([[kernelKey(k0), 0]]);
    const trans = [{}];
    const log = [{ type: 'init', state: 0 }];
    for (let i = 0; i < states.length; i++) {
      for (const X of nextSymbols(G, states[i].items)) {
        const kernel = gotoKernel(G, states[i].items, X);
        const key = kernelKey(kernel);
        let j = byKey.get(key);
        const isNew = j === undefined;
        if (isNew) {
          j = states.length;
          byKey.set(key, j);
          states.push({ kernel, items: closure(G, kernel, withLA), via: { from: i, sym: X } });
          trans.push({});
        }
        trans[i][X] = j;
        log.push({ type: 'goto', from: i, sym: X, to: j, isNew });
      }
    }
    let C = { G, kind, states, trans, log };
    if (opts.statePaths) C = renumber(C, opts.statePaths);
    return C;
  }

  /* Renumera os estados para coincidir com a numeração usada em aula (caminhos a partir de CC0). */
  function renumber(C, paths) {
    const order = [];
    for (const path of paths) {
      let s = 0;
      for (const X of splitRhs(path)) {
        s = C.trans[s][X];
        if (s === undefined) throw new Error(`Caminho inválido: ${path}`);
      }
      if (!order.includes(s)) order.push(s);
    }
    C.states.forEach((_, i) => { if (!order.includes(i)) order.push(i); });
    const map = {};
    order.forEach((old, nw) => { map[old] = nw; });
    const states = order.map((old) => {
      const st = C.states[old];
      return { ...st, via: st.via ? { from: map[st.via.from], sym: st.via.sym } : null };
    });
    const trans = order.map((old) => {
      const t = {};
      for (const [X, j] of Object.entries(C.trans[old])) t[X] = map[j];
      return t;
    });
    const created = new Set([0]);
    const log = C.log.map((e) => {
      if (e.type !== 'goto') return e;
      const to = map[e.to];
      const isNew = !created.has(to);
      created.add(to);
      return { ...e, from: map[e.from], to, isNew };
    });
    return { ...C, states, trans, log };
  }

  /* LALR: funde estados LR(1) com o mesmo núcleo LR(0). */
  function mergeLALR(C1) {
    const coreOf = (st) => st.items.map(coreKey).filter((v, i, a) => a.indexOf(v) === i).sort().join('|');
    const groups = [];
    const groupOf = [];
    const byCore = new Map();
    C1.states.forEach((st, i) => {
      const k = coreOf(st);
      if (!byCore.has(k)) { byCore.set(k, groups.length); groups.push([]); }
      const g = byCore.get(k);
      groups[g].push(i);
      groupOf[i] = g;
    });
    const states = groups.map((members) => {
      const items = [];
      const seen = new Set();
      for (const m of members) for (const it of C1.states[m].items) {
        const key = itemKey(it);
        if (!seen.has(key)) { seen.add(key); items.push(it); }
      }
      return { kernel: items.filter((i) => i.kernel), items, members, via: null };
    });
    const trans = groups.map((members) => {
      const t = {};
      for (const [X, j] of Object.entries(C1.trans[members[0]])) t[X] = groupOf[j];
      return t;
    });
    const label = (g) => groups[g].join('/');
    return { G: C1.G, kind: 'lalr', states, trans, groups, groupOf, label, log: [] };
  }

  function stateLabel(C, i) { return C.label ? C.label(i) : String(i); }

  /* Tabela Ações/Goto. method: lr0 | slr | lr1 | lalr. Cada célula guarda as ações e o motivo. */
  function buildTable(C, method) {
    const G = C.G;
    const action = C.states.map(() => ({}));
    const go = C.states.map(() => ({}));
    const add = (s, t, entry) => {
      const cell = (action[s][t] ||= []);
      const same = cell.find((e) => e.type === entry.type && e.n === entry.n);
      if (same) same.why.push(...entry.why);
      else cell.push(entry);
    };
    C.states.forEach((st, s) => {
      for (const [X, j] of Object.entries(C.trans[s])) {
        if (G.isNT(X)) go[s][X] = j;
      }
      for (const it of st.items) {
        const p = G.prods[it.p];
        const X = p.rhs[it.d];
        if (X !== undefined) {
          if (!G.isNT(X)) add(s, X, { type: 's', n: C.trans[s][X], why: [it] });
          continue;
        }
        if (it.p === 0) { add(s, EOF, { type: 'acc', why: [it] }); continue; }
        let las;
        if (method === 'lr0') las = G.terms;
        else if (method === 'slr') las = [...G.FOLLOW[p.lhs]];
        else las = [it.la];
        for (const t of las) add(s, t, { type: 'r', n: it.p, why: [it] });
      }
    });
    const conflicts = [];
    action.forEach((row, s) => {
      for (const t of G.terms) {
        const cell = row[t];
        if (cell && cell.length > 1) {
          const kinds = cell.map((e) => (e.type === 'r' ? 'reduce' : 'shift'));
          const type = kinds.every((k) => k === 'reduce') ? 'reduce/reduce' : 'shift/reduce';
          conflicts.push({ state: s, term: t, type, entries: cell });
        }
      }
    });
    return { C, G, method, action, go, conflicts };
  }

  function actionText(e, C) {
    if (e.type === 'acc') return 'acc';
    if (e.type === 's') return 's' + stateLabel(C, e.n);
    return 'r' + e.n;
  }

  /* Executa o parser. hooks.shift(tok) e hooks.reduce(prod, vals) produzem atributos (tradução dirigida). */
  function run(T, tokens, hooks = {}) {
    const { C, G } = T;
    const input = [...tokens.map((t) => (typeof t === 'string' ? { sym: t, text: t } : t)), { sym: EOF, text: EOF }];
    const stack = [{ sym: '⊥', state: 0, val: undefined }];
    const steps = [];
    let pos = 0;
    for (let guard = 0; guard < 10000; guard++) {
      const s = stack[stack.length - 1].state;
      const tok = input[pos];
      const cell = (T.action[s] || {})[tok.sym];
      const snap = { stack: stack.map((e) => ({ ...e })), input: input.slice(pos), pos };
      if (!cell || !cell.length) {
        steps.push({ ...snap, kind: 'err', text: 'erro', note: `nenhuma ação em [${stateLabel(C, s)}, ${tok.sym}]` });
        return { steps, ok: false };
      }
      const e = cell[0];
      const conflict = cell.length > 1;
      if (e.type === 'acc') {
        steps.push({ ...snap, kind: 'acc', text: 'aceita', conflict });
        return { steps, ok: true, value: stack[stack.length - 1].val };
      }
      if (e.type === 's') {
        steps.push({ ...snap, kind: 's', text: actionText(e, C), target: e.n, token: tok, conflict });
        const val = hooks.shift ? hooks.shift(tok) : tok.text;
        stack.push({ sym: tok.sym, state: e.n, val, text: tok.text });
        pos++;
        continue;
      }
      const p = G.prods[e.n];
      const k = p.rhs.length;
      const popped = stack.splice(stack.length - k, k);
      const exposed = stack[stack.length - 1].state;
      const target = T.go[exposed][p.lhs];
      const val = hooks.reduce ? hooks.reduce(p, popped.map((x) => x.val), popped) : undefined;
      steps.push({ ...snap, kind: 'r', text: actionText(e, C), prod: p, popped: k, exposed, target, conflict, val });
      if (target === undefined) {
        steps.push({ stack: stack.map((x) => ({ ...x })), input: input.slice(pos), pos, kind: 'err', text: 'erro', note: `goto(${exposed}, ${p.lhs}) indefinido` });
        return { steps, ok: false };
      }
      stack.push({ sym: p.lhs, state: target, val });
    }
    return { steps, ok: false };
  }

  function prodText(G, p, dot = -1) {
    const rhs = [...p.rhs];
    if (dot >= 0) rhs.splice(dot, 0, '•');
    return `${p.lhs} → ${rhs.length ? rhs.join(' ') : 'ε'}`;
  }

  /* Agrupa itens LR(1) de mesmo núcleo: [A → α•β, {a, b}] */
  function groupItems(C, items) {
    const G = C.G;
    const out = [];
    const byCore = new Map();
    for (const it of items) {
      const k = coreKey(it);
      if (!byCore.has(k)) {
        const g = { p: it.p, d: it.d, las: [], kernel: it.kernel, text: prodText(G, G.prods[it.p], it.d) };
        byCore.set(k, g);
        out.push(g);
      }
      const g = byCore.get(k);
      if (it.la != null && !g.las.includes(it.la)) g.las.push(it.la);
    }
    for (const g of out) g.las.sort(sortBy(G.terms));
    return out;
  }

  function itemText(C, g) {
    if (!g.las.length) return g.text;
    const la = g.las.length === 1 ? g.las[0] : `{${g.las.join(', ')}}`;
    return `[${g.text}, ${la}]`;
  }

  return {
    EOF, EPS, parseGrammar, firstOfSeq, buildCollection, mergeLALR, buildTable, run,
    prodText, groupItems, itemText, stateLabel, actionText, splitRhs, closure, gotoKernel, itemKey,
  };
})();
if (typeof module !== 'undefined') module.exports = LR;
