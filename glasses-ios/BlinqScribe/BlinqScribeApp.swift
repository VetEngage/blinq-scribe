import SwiftUI

#if canImport(MWDATCore)
import MWDATCore
#endif

@main
struct BlinqScribeApp: App {
    @StateObject private var settings = SettingsStore()
    @StateObject private var speaker = Speaker()
    @StateObject private var glassesCamera = GlassesCamera()
    @StateObject private var glasses = GlassesConnection()

    init() {
        #if canImport(MWDATCore)
        do {
            try Wearables.configure()
        } catch {
            // The app still runs with the phone mic and phone camera.
            NSLog("BlinqScribe: Wearables configure failed: \(error.localizedDescription)")
        }
        #endif
    }

    var body: some Scene {
        WindowGroup {
            TabView {
                TodayView()
                    .tabItem { Label("Today", systemImage: "calendar") }
                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape") }
            }
            .environmentObject(settings)
            .environmentObject(speaker)
            .environmentObject(glassesCamera)
            .environmentObject(glasses)
            .onOpenURL { url in
                handleOpenURL(url)
            }
            .onAppear {
                #if DEBUG
                if settings.useMockDevice {
                    glassesCamera.setMockEnabled(true)
                }
                #endif
            }
        }
    }

    /// The Meta AI app sends the vet back here after they approve Blinq Scribe.
    /// Pass every link to the toolkit unchanged; it returns false for links that aren't its own.
    private func handleOpenURL(_ url: URL) {
        #if canImport(MWDATCore)
        Task {
            do {
                _ = try await Wearables.shared.handleUrl(url)
            } catch {
                NSLog("BlinqScribe: handleUrl failed: \(error.localizedDescription)")
            }
        }
        #endif
    }
}
