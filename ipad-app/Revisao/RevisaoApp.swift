import SwiftUI

@main
struct RevisaoApp: App {
    var body: some Scene {
        WindowGroup {
            SlidesView()
                .ignoresSafeArea()
                .background(Color("Paper"))
        }
    }
}
