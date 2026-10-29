import SwiftUI
import WebKit

/// Mostra Web/index.html (gerado por apresentacao/build.py) e reabre no último slide visto.
struct SlidesView: UIViewRepresentable {
    private static let lastSlideKey = "lastSlide"

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "Paper")
        // O CSS já usa env(safe-area-inset-*); sem isto o WKWebView desloca o conteúdo e o env() vira 0.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        webView.isInspectable = true

        let web = Bundle.main.url(forResource: "Web", withExtension: nil)!
        var page = URLComponents(url: web.appendingPathComponent("index.html"), resolvingAgainstBaseURL: false)!
        page.fragment = UserDefaults.standard.string(forKey: Self.lastSlideKey)
        webView.loadFileURL(page.url!, allowingReadAccessTo: web)

        // A troca de slide só muda o #hash, então observa a URL em vez de esperar navegações.
        context.coordinator.observation = webView.observe(\.url) { webView, _ in
            if let slide = webView.url?.fragment, !slide.isEmpty {
                UserDefaults.standard.set(slide, forKey: Self.lastSlideKey)
            }
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        var observation: NSKeyValueObservation?

        // Links para fora do app abrem no Safari.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, !url.isFileURL {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}
