import Foundation

#if canImport(MWDATCore)
import MWDATCore
#endif

/// Links Blinq Scribe to the vet's glasses through the Meta AI app.
///
/// Connect calls the toolkit's registration: the Meta AI app opens, the vet approves
/// Blinq Scribe, and the Meta AI app sends the vet back through the blinqscribe:// link,
/// which BlinqScribeApp forwards to `Wearables.shared.handleUrl`. The state streams
/// below then report the approval and the paired glasses.
@MainActor
final class GlassesConnection: ObservableObject {
    enum Status: Equatable {
        /// The Meta AI app is missing, or this build can't register yet.
        case unavailable
        /// Not approved in the Meta AI app yet.
        case notConnected
        /// Waiting for the vet to approve in the Meta AI app.
        case connecting
        /// Approved. The glasses may still be out of range: see `linkState`.
        case connected
    }

    enum Link: Equatable {
        case none, nearby, connecting, away
    }

    @Published private(set) var status: Status = .notConnected
    @Published private(set) var link: Link = .none
    @Published private(set) var deviceName: String?
    @Published private(set) var batteryLevel: Int?
    @Published private(set) var needsGlassesUpdate = false
    @Published private(set) var busy = false
    @Published var message: String?

    private var streamTasks: [Task<Void, Never>] = []
    #if canImport(MWDATCore)
    private var linkToken: (any AnyListenerToken)?
    #endif

    init() {
        start()
    }

    /// Plain words for the Settings row and the Today pill.
    var statusLabel: String {
        switch status {
        case .unavailable: return "Not available"
        case .notConnected: return "Not connected"
        case .connecting: return "Approve in the Meta AI app"
        case .connected:
            switch link {
            case .nearby: return "Connected"
            case .connecting: return "Connecting"
            case .away, .none: return "Approved, glasses not nearby"
            }
        }
    }

    var isReady: Bool { status == .connected && link == .nearby }

    private func start() {
        #if canImport(MWDATCore)
        let wearables = Wearables.shared
        apply(wearables.registrationState)
        refreshDevice(wearables.devices)
        streamTasks.append(Task { [weak self] in
            for await state in wearables.registrationStateStream() {
                guard let self else { return }
                self.apply(state)
            }
        })
        streamTasks.append(Task { [weak self] in
            for await ids in wearables.devicesStream() {
                guard let self else { return }
                self.refreshDevice(ids)
            }
        })
        #else
        status = .unavailable
        message = "Glasses SDK is not linked in this build."
        #endif
    }

    /// Opens the Meta AI app so the vet can approve Blinq Scribe.
    func connect() async {
        #if canImport(MWDATCore)
        busy = true
        message = nil
        defer { busy = false }
        do {
            try await Wearables.shared.startRegistration()
        } catch let error as RegistrationError {
            message = Self.text(for: error)
        } catch {
            message = "Couldn't connect. Try again."
        }
        #endif
    }

    /// Removes Blinq Scribe's access in the Meta AI app.
    func disconnect() async {
        #if canImport(MWDATCore)
        busy = true
        message = nil
        defer { busy = false }
        do {
            try await Wearables.shared.startUnregistration()
        } catch let error as UnregistrationError {
            if error != .alreadyUnregistered {
                message = error == .metaAINotInstalled
                    ? "The Meta AI app isn't installed."
                    : "Couldn't disconnect. Try again from the Meta AI app under App connections."
            }
        } catch {
            message = "Couldn't disconnect. Try again."
        }
        #endif
    }

    /// Opens the Meta AI app on the glasses software update screen.
    func openGlassesUpdate() async {
        #if canImport(MWDATCore)
        do {
            try await Wearables.shared.openFirmwareUpdate()
        } catch {
            message = "Open the Meta AI app to update your glasses."
        }
        #endif
    }

    #if canImport(MWDATCore)
    private func apply(_ state: RegistrationState) {
        switch state {
        case .unavailable:
            status = .unavailable
            message = "Install the Meta AI app, pair your glasses and turn on Developer Mode."
        case .available:
            status = .notConnected
        case .registering:
            status = .connecting
        case .registered:
            status = .connected
            message = nil
        }
    }

    private func refreshDevice(_ ids: [DeviceIdentifier]) {
        linkToken = nil
        guard let id = ids.first, let device = Wearables.shared.deviceForIdentifier(id) else {
            deviceName = nil
            batteryLevel = nil
            link = .none
            needsGlassesUpdate = false
            return
        }
        deviceName = device.nameOrId()
        batteryLevel = device.batteryLevel
        needsGlassesUpdate = device.compatibility() == .deviceUpdateRequired
        link = Self.link(for: device.linkState)
        linkToken = device.addLinkStateListener { [weak self] state in
            Task { @MainActor in
                self?.link = GlassesConnection.link(for: state)
            }
        }
    }

    private static func link(for state: LinkState) -> Link {
        switch state {
        case .connected: return .nearby
        case .connecting: return .connecting
        case .disconnected: return .away
        }
    }

    private static func text(for error: RegistrationError) -> String? {
        switch error {
        case .alreadyRegistered:
            return nil
        case .metaAINotInstalled:
            return "Install the Meta AI app and pair your glasses first."
        case .configurationInvalid:
            return "This build isn't set up for glasses yet. Turn on Developer Mode in the Meta AI app, or set MWDAT_APP_ID."
        case .networkUnavailable:
            return "No internet connection. Try again when you're online."
        default:
            return "Couldn't connect. Try again."
        }
    }
    #endif
}
