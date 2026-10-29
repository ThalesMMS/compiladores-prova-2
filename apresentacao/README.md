# Revisão P2 de Compiladores

Apresentação interativa para as três questões da prova:

1. Análise sintática ascendente (autômato LR e tabela Ações/Goto) — Lista 1 e o exemplo `Cmd → Lhs = Rhs | Rhs` do quadro.
2. Escopo + tradução dirigida por sintaxe — Lista 2, exercícios 1 a 6.
3. Inferência de tipos — regras do quadro e Lista 2, exercício 7.

## Como abrir

Abra `index.html` no navegador. Use ← e → para trocar de slide. Com internet, a página carrega as fontes e a biblioteca de layout de grafos (dagre); sem internet ela funciona com fontes do sistema e um layout de autômato mais simples.

## Como alterar

O conteúdo fica em `src/`:

- `slides.html`: texto dos slides;
- `engine.js`: motor LR (FIRST/FOLLOW, coleções LR(0)/LR(1), LALR, tabela e execução com pilha);
- `app.js`: simuladores e navegação;
- `style.css`: visual.

Depois de editar, gere o `index.html` de novo:

```bash
python3 apresentacao/build.py
```
