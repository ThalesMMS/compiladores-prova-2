# App de iPad da Revisão P2

Mostra a apresentação (`apresentacao/`) em tela cheia, sem internet: as fontes e o dagre estão em `Revisao/Web/vendor`. Reabre no último slide visto.

## Instalar no iPad

1. Conecte o iPad no Mac (cabo, na primeira vez) e toque em **Confiar**.
2. No iPad: **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor** → ativar (o iPad reinicia).
3. Abra `Revisao.xcodeproj` no Xcode.
4. Em **Signing & Capabilities**, confira o **Team** (vem com `H4Q6WN7NV5`; troque se o seu time for outro). Se o Xcode pedir, entre com seu Apple ID em **Xcode → Settings → Accounts**.
5. Escolha o iPad no seletor de destino, no topo, e aperte **▶ Run** (⌘R).

Com conta paga do Apple Developer Program o app vale por 1 ano; com Apple ID gratuito, por 7 dias (depois é só rodar de novo pelo Xcode).

## Atualizar o conteúdo

Edite `apresentacao/src/` e rode:

```bash
python3 apresentacao/build.py
```

Isso regrava `apresentacao/index.html` e `ipad-app/Revisao/Web/index.html`. Depois, rode o app de novo pelo Xcode.

O projeto do Xcode é gerado a partir de `project.yml` (`xcodegen generate`); só precisa disso se mudar arquivos ou configurações do projeto.
