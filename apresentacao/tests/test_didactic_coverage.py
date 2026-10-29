"""Regression tests for the static presentation; only Python stdlib is needed."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
EXISTING = {'inicio', 'q1-check', 'q2-use', 'q2-check', 'q3-regras', 'q3-check', 'treino'}
SUPPLEMENTED = {
    'q1-roteiro', 'q1-itens', 'q1-metodos', 'q1-aula', 'q1-aula-metodos',
    'q1-ex1', 'q1-ex2a', 'q1-ex2b', 'q1-ex2d', 'q1-ex3', 'q1-ex4', 'q1-lab',
    'q2-sdd', 'q2-ex1', 'q2-ex2', 'q2-ex3', 'q2-ex4', 'q2-ex4c', 'q2-escopo', 'q2-ex6',
    'q3-notacao', 'q3-subtipo', 'q3-letn', 'q3-erros', 'q3-ok',
}


class Deck(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.slides, self.ids, self.panels, self.widgets = [], [], [], []
        self.text, self.summaries, self.backs = {}, [], 0
        self.slide = None
        self.in_summary = False
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get('class') or '').split()
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'section' and 'slide' in classes:
            self.slide = a['id']
            self.slides.append(self.slide)
            self.text[self.slide] = ''
        if 'data-w' in a:
            self.widgets.append(a)
        if 'didactic-note' in classes:
            self.panels.append((tag, a, self.slide))
        if tag == 'summary':
            self.in_summary = True
            self.summaries.append('')
        if 'rule-explanation' in classes:
            self.backs += 1

    def handle_data(self, data):
        if self.slide:
            self.text[self.slide] += data
        if self.in_summary:
            self.summaries[-1] += data

    def handle_endtag(self, tag):
        if tag == 'section':
            self.slide = None
        if tag == 'summary':
            self.in_summary = False


class DidacticCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT/'src/slides.html').read_text(encoding='utf-8')
        cls.css = (ROOT/'src/style.css').read_text(encoding='utf-8')
        cls.deck = Deck(cls.source)
        cls.web = (ROOT/'index.html').read_text(encoding='utf-8')
        cls.ipad = (ROOT.parent/'ipad-app/Revisao/Web/index.html').read_text(encoding='utf-8')

    def test_all_32_slides_are_accounted_for(self):
        self.assertEqual(set(self.deck.slides), EXISTING | SUPPLEMENTED)
        self.assertEqual(len(self.deck.slides), 32)

    def test_exactly_25_native_panels(self):
        self.assertEqual(len(self.deck.panels), 25)
        self.assertEqual(Counter(p[1]['data-didactic-for'] for p in self.deck.panels), Counter(SUPPLEMENTED))
        for tag, attrs, owner in self.deck.panels:
            with self.subTest(slide=owner):
                self.assertEqual(tag, 'details')
                self.assertEqual(attrs['data-didactic-for'], owner)
                self.assertEqual(attrs['id'], owner + '-por-extenso')
                self.assertNotIn('open', attrs)
                self.assertNotIn('onclick', attrs)

    def test_all_panels_have_reading_example_and_caution(self):
        for slide in SUPPLEMENTED:
            with self.subTest(slide=slide):
                text = self.deck.text[slide]
                self.assertIn('Em palavras', text)
                self.assertIn('Exemplo, passo a passo', text)
                self.assertIn('Não confunda', text)
                self.assertGreater(len(text), 600)

    def test_summary_labels_are_present(self):
        labels = [s for s in self.deck.summaries if s.startswith('Por extenso:')]
        self.assertEqual(len(labels), 25)
        self.assertTrue(all(len(s) > 30 for s in labels))

    def test_unique_ids(self):
        self.assertEqual(len(self.deck.ids), len(set(self.deck.ids)))

    def test_nine_rule_backs_are_preserved(self):
        self.assertEqual(self.deck.backs, 9)
        source = re.search(r'<section class="slide" id="q3-regras".*?</section>', self.source, re.S).group()
        self.assertEqual(source.count('class="rule-explanation"'), 9)
        self.assertEqual(source.count('class="rulecard"'), 9)
        self.assertIn('data-w="ruleFlips"', source)
        self.assertNotIn('didactic-note', source)

    def test_lr_construction_correction(self):
        self.assertNotIn('o passo 4: em quais colunas entram as reduções', self.deck.text['q1-roteiro'])
        self.assertIn('LR(1) acrescenta lookaheads', self.deck.text['q1-roteiro'])
        self.assertNotIn('estado com item completo não pode ter mais nada', self.deck.text['q1-metodos'])
        self.assertIn('acc só em eof', self.deck.text['q1-metodos'])

    def test_exercise_type_systems_are_not_conflated(self):
        self.assertIn('não substitui a regra específica', self.deck.text['q3-notacao'])
        self.assertIn('Não a aplique automaticamente', self.deck.text['q2-ex2'])

    def test_recovery_is_not_presented_as_a_valid_program(self):
        text = self.deck.text['q3-erros']
        self.assertIn('isso não torna o programa válido', text)
        self.assertIn('NoType', text)
        self.assertIn('Terceiro:', text)
        self.assertIn('SELF_TYPE_Main', text)

    def test_no_new_widgets_inside_panels(self):
        for part in re.findall(r'<details class="didactic-note".*?</details>', self.source, re.S):
            self.assertNotIn('data-w=', part)
            self.assertNotIn('<script', part)
            self.assertNotIn('onclick=', part)

    def test_generated_versions_contain_exact_source_and_css(self):
        for name, generated in [('web', self.web), ('ipad', self.ipad)]:
            with self.subTest(version=name):
                self.assertEqual(generated.count(self.source), 1)
                self.assertEqual(generated.count(self.css), 1)
                parsed = Deck(generated)
                self.assertEqual(parsed.slides, self.deck.slides)
                self.assertEqual(parsed.panels, self.deck.panels)
                self.assertEqual(parsed.widgets, self.deck.widgets)

    def test_existing_javascript_is_embedded_unchanged(self):
        for filename in ('app.js', 'engine.js'):
            expected = (ROOT/'src'/filename).read_text(encoding='utf-8')
            for generated in (self.web, self.ipad):
                self.assertIn('<script>\n' + expected + '\n</script>', generated)

    def test_ipad_assets_are_still_offline(self):
        head = self.ipad.split('</head>', 1)[0]
        self.assertIn('href="vendor/fonts.css"', head)
        self.assertIn('src="vendor/dagre.min.js"', head)
        self.assertNotIn('https://fonts.googleapis.com', head)
        self.assertNotIn('https://cdnjs.cloudflare.com', head)

    def test_responsive_native_styles_exist(self):
        self.assertIn('.didactic-note > summary:focus-visible', self.css)
        self.assertIn('.didactic-note code { white-space: normal; overflow-wrap: anywhere; }', self.css)


if __name__ == '__main__':
    unittest.main()
