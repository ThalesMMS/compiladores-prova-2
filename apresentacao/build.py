#!/usr/bin/env python3
"""Monta apresentacao/index.html (documento completo, abre direto no navegador)
a partir de src/: style.css, engine.js, app.js e slides.html.
Com --fragment SAIDA, grava também a versão sem <html>/<head>/<body> usada para publicar como Artifact.
Também grava ipad-app/Revisao/Web/index.html, que usa as fontes e o dagre locais de Web/vendor (app offline)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
IPAD_WEB = ROOT.parent / "ipad-app" / "Revisao" / "Web"

FONTS = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700"
         "&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400"
         "&family=JetBrains+Mono:wght@400;600&family=Caveat:wght@500;600&display=swap")
DAGRE = "https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"


def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def head(offline=False):
    if offline:
        assets = ['<link rel="stylesheet" href="vendor/fonts.css">']
        script = '<script src="vendor/dagre.min.js"></script>'
    else:
        assets = [
            '<link rel="preconnect" href="https://fonts.googleapis.com">',
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
            f'<link rel="stylesheet" href="{FONTS}">',
        ]
        script = f'<script src="{DAGRE}"></script>'
    return "\n".join([
        "<title>Revisão P2 de Compiladores</title>",
        '<meta name="claude:viewport-fit-sides" content="cover">',
        '<meta name="description" content="Revisão interativa para a P2 de Compiladores: análise LR, tradução dirigida por sintaxe, escopo e inferência de tipos.">',
        *assets,
        f"<style>\n{read('style.css')}\n</style>",
        script,
    ])


def body():
    return "\n".join([
        read("slides.html"),
        f"<script>\n{read('engine.js')}\n</script>",
        f"<script>\n{read('app.js')}\n</script>",
    ])


def document(offline=False):
    return (
        "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        f"{head(offline)}\n</head>\n<body>\n{body()}\n</body>\n</html>\n"
    )


def main():
    full = document()
    (ROOT / "index.html").write_text(full, encoding="utf-8")
    print("index.html", len(full))
    if IPAD_WEB.is_dir():
        ipad = document(offline=True)
        (IPAD_WEB / "index.html").write_text(ipad, encoding="utf-8")
        print(IPAD_WEB / "index.html", len(ipad))
    if "--fragment" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--fragment") + 1])
        frag = f"{head()}\n{body()}\n"
        out.write_text(frag, encoding="utf-8")
        print(out, len(frag))


if __name__ == "__main__":
    main()
