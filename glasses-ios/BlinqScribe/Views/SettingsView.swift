import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: SettingsStore
    @EnvironmentObject var glassesCamera: GlassesCamera
    @EnvironmentObject var glasses: GlassesConnection

    @State private var testing = false
    @State private var testResult: String?
    @State private var testOk = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Server URL", text: $settings.serverURLString)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    SecureField("API token (optional)", text: $settings.token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button {
                        Task { await testConnection() }
                    } label: {
                        if testing { ProgressView() } else { Text("Test connection") }
                    }
                    .disabled(testing)
                    if let testResult {
                        Text(testResult)
                            .foregroundStyle(testOk ? Color.green : Color.red)
                    }
                    Text("Server URL is saved on this phone. The token is saved in the Keychain.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Glasses") {
                    LabeledContent("Status") {
                        Text(glasses.statusLabel)
                            .foregroundStyle(glasses.isReady ? Color.green : Color.secondary)
                    }
                    if let name = glasses.deviceName {
                        LabeledContent("Glasses", value: name)
                    }
                    if let battery = glasses.batteryLevel {
                        LabeledContent("Battery", value: "\(battery)%")
                    }
                    switch glasses.status {
                    case .connected:
                        Button("Disconnect glasses", role: .destructive) {
                            Task { await glasses.disconnect() }
                        }
                        .disabled(glasses.busy)
                    case .connecting:
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Finish in the Meta AI app, then come back.")
                        }
                    case .notConnected, .unavailable:
                        Button {
                            Task { await glasses.connect() }
                        } label: {
                            if glasses.busy { ProgressView() } else { Text("Connect glasses") }
                        }
                        .disabled(glasses.busy)
                    }
                    if glasses.needsGlassesUpdate {
                        Button("Update glasses software") {
                            Task { await glasses.openGlassesUpdate() }
                        }
                    }
                    if let message = glasses.message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    Text("Connect opens the Meta AI app so you can approve Blinq Scribe. Pair your glasses there first and turn on Developer Mode.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                #if DEBUG
                Section("Glasses testing") {
                    Toggle("Mock device", isOn: $settings.useMockDevice)
                        .onChange(of: settings.useMockDevice) { _, on in
                            glassesCamera.setMockEnabled(on)
                        }
                    Text(glassesCamera.statusText)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Text("Mock device uses MockDeviceKit so the app can be tested without glasses. Debug builds only.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                #endif

                Section("App") {
                    LabeledContent("Version", value: settings.appVersion)
                    LabeledContent("Server", value: settings.serverURLString)
                }
            }
            .navigationTitle("Settings")
        }
    }

    private func testConnection() async {
        testing = true
        testResult = nil
        let client = BlinqScribeClient(settings: settings)
        do {
            let health = try await client.health()
            testOk = health.ok
            testResult = "Connected. AI: \(health.ai). Practice: \(health.practice). Speech: \(health.stt). SAM: \(health.sam). Texts: \(health.sms)."
        } catch {
            testOk = false
            testResult = error.localizedDescription
        }
        testing = false
    }
}
