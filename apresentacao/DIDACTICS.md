# Cobertura didática da apresentação

Base revisada: `948354f9150a3b6b81d60bc48c317bfc72c55ba4`, branch `branch/tender-clarke-21my31`.

Os 32 slides foram revisados. Foram acrescentadas 25 leituras por extenso; 7 slides já tinham explicações suficientes, inclusive os nove cartões com flip de `q3-regras`.

Os complementos ficam em `src/slides.html`, logo após o cabeçalho de cada slide, em elementos nativos `details`/`summary`. Não acrescentam JavaScript nem dependências. Clique, toque, Enter e Espaço abrem e fecham o painel. Os simuladores e os versos existentes são preservados.

## Revisão slide a slide

| Slide | Cobertura | Conteúdo |
|---|---|---|
| `inicio` | Existente, preservada | A capa já explica a navegação, os três objetivos da prova e as correções do material. |
| `q1-roteiro` | Complementada | Do texto da gramática à decisão do parser |
| `q1-itens` | Complementada | O ponto é progresso; o lookahead é contexto |
| `q1-metodos` | Complementada | Quatro maneiras de decidir quando reduzir |
| `q1-aula` | Complementada | Como o parser reconhece id = **id |
| `q1-aula-metodos` | Complementada | Por que FOLLOW pode autorizar uma redução indevida |
| `q1-ex1` | Complementada | Por que aceitar não é a mesma coisa que reduzir |
| `q1-ex2a` | Complementada | De onde vêm c, a e f nos itens do exercício |
| `q1-ex2b` | Complementada | Lendo uma célula como uma instrução |
| `q1-ex2d` | Complementada | Reduzir troca um trecho da pilha, não lê um token |
| `q1-ex3` | Complementada | O saldo precisa ser válido durante todo o percurso |
| `q1-ex4` | Complementada | Reconhecer depois pode ser mais fácil que escolher antes |
| `q1-lab` | Complementada | Como conferir sem depender da numeração dos estados |
| `q1-check` | Existente, preservada | O próprio slide já traduz cada etapa da construção, da tabela e da pilha em instruções e armadilhas. |
| `q2-sdd` | Complementada | Anotar a árvore é fazer os nós trocarem informações |
| `q2-ex1` | Complementada | Como as ações de redução montam a AST |
| `q2-ex2` | Complementada | Uma mesma redução produz texto, tipo e valor |
| `q2-ex3` | Complementada | A sintaxe reconhece a forma; a declaração dá o significado |
| `q2-ex4` | Complementada | Trocar a ordem do operador sem trocar a árvore |
| `q2-ex4c` | Complementada | Por que imprimir cedo demais pode ser irreversível |
| `q2-escopo` | Complementada | O nome local não existe antes da própria declaração |
| `q2-ex6` | Complementada | Como seguir a trilha das tabelas de símbolos |
| `q2-use` | Existente, preservada | O slide já explica o objetivo do ponteiro use com o contraexemplo concreto do z e a persistência das tabelas. |
| `q2-check` | Existente, preservada | Já contém instruções explícitas para cada produção e para entrada, saída e consulta dos escopos. |
| `q3-notacao` | Complementada | Lendo os símbolos como uma frase inteira |
| `q3-subtipo` | Complementada | O if precisa de um tipo que sirva para qualquer ramo |
| `q3-regras` | Existente, preservada | Os nove versos já traduzem as regras em português e incluem exemplos. O conteúdo e o comportamento de flip são preservados. |
| `q3-letn` | Complementada | Um ambiente antes e outro depois de cada declaração |
| `q3-erros` | Complementada | Três erros independentes, sem multiplicar mensagens em cascata |
| `q3-ok` | Complementada | O tipo da chamada não é o tipo do que ela imprime |
| `q3-check` | Existente, preservada | Já oferece modelo de resposta, ordem de visita, sentido da subtipagem e armadilhas. |
| `treino` | Existente, preservada | Já contém doze respostas didáticas expansíveis; duplicá-las em um novo painel prejudicaria o treino. |

## Correções conceituais

- O roteiro distingue a construção dos autômatos LR(0)/SLR, LR(1) e LALR; não atribui toda a diferença apenas à colocação das reduções.
- A tabela de métodos deixa claro que o conflito é entre ações na mesma célula. O item aumentado completo produz aceitação em `eof`, não uma redução comum em toda a linha.

## Manutenção e testes

Depois de editar os textos ou estilos, regenere as duas versões:

```sh
python3 apresentacao/build.py
python3 -m unittest discover -s apresentacao/tests -p test_didactic_coverage.py -v
git diff --check
```

Os testes verificam cobertura dos 32 slides, os nove versos, preservação dos widgets, IDs únicos e a incorporação dos fontes nos HTMLs web e offline. Novos slides devem receber explicação ou ser incluídos explicitamente na lista de cobertura existente.
