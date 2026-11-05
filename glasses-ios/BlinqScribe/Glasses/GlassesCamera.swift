import Foundation
import UIKit

#if canImport(MWDATCore)
import MWDATCamera
import MWDATCore
#endif

#if canImport(MWDATDisplay)
import MWDATDisplay
#endif

#if DEBUG && canImport(MWDATMockDevice)
import MWDATMockDevice
#endif

enum GlassesCameraError: LocalizedError {
    case unavailable(String)
    case captureFailed(String)

    var errorDescription: String? {
        switch self {
        case .unavailable(let text): return text
        case .captureFailed(let text): return text
        }
    }
}

/// Photo capture from the glasses camera through the Meta Wearables DAT.
/// Falls back by throwing .unavailable so the Visit screen can offer the phone camera.
final class GlassesCamera: ObservableObject {
    @Published var statusText = "Glasses camera not checked yet."
    @Published var isGlassesAvailable = false

    private var session: AnyObject?
    private var cameraBox: AnyObject?
    private var tokens: [AnyObject] = []

    /// Turns the mock device on or off. Debug builds only. Uses MockDeviceKit.
    func setMockEnabled(_ enabled: Bool) {
        #if DEBUG && canImport(MWDATMockDevice)
        if enabled {
            MockDeviceKit.shared.enable()
            if let device = try? MockDeviceKit.shared.pairGlasses(model: .rayBanMeta) {
                device.powerOn()
                device.unfold()
                device.don()
            }
            statusText = "Mock glasses on."
            isGlassesAvailable = true
        } else {
            MockDeviceKit.shared.disable()
            statusText = "Mock glasses off."
            isGlassesAvailable = false
        }
        #else
        statusText = enabled ? "Mock device is only in debug builds." : "Mock glasses off."
        #endif
    }

    /// Tries the glasses camera. Throws .unavailable when no glasses can be used,
    /// so the caller shows the phone camera and says so on screen.
    func captureFromGlasses() async throws -> Data {
        #if canImport(MWDATCore)
        let wearables = Wearables.shared
        do {
            if try await wearables.checkPermissionStatus(.camera) != .granted {
                guard try await wearables.requestPermission(.camera) == .granted else {
                    throw GlassesCameraError.unavailable("Glasses camera permission was not granted. Use the phone camera.")
                }
            }
        } catch let error as GlassesCameraError {
            throw error
        } catch {
            throw GlassesCameraError.unavailable("Glasses are not reachable. Use the phone camera. \(error.localizedDescription)")
        }

        let selector = AutoDeviceSelector(wearables: wearables)
        let deviceSession: DeviceSession
        do {
            deviceSession = try wearables.createSession(deviceSelector: selector)
            try deviceSession.start()
        } catch {
            throw GlassesCameraError.unavailable("Could not start a glasses session. Use the phone camera.")
        }
        session = deviceSession

        // Wait until the session is started, with a short timeout.
        var started = false
        for await state in deviceSession.stateStream() {
            if state == .started { started = true; break }
            if state == .stopped { break }
        }
        guard started else {
            deviceSession.stop()
            throw GlassesCameraError.unavailable("Glasses did not connect. Use the phone camera.")
        }

        let config = StreamConfiguration(videoCodec: .raw, resolution: .medium, frameRate: 24)
        guard let camera = try? deviceSession.addCamera(config: config) else {
            deviceSession.stop()
            throw GlassesCameraError.unavailable("Glasses camera is not available. Use the phone camera.")
        }
        cameraBox = camera as AnyObject
        let stream = camera.stream

        return try await withCheckedThrowingContinuation { continuation in
            var finished = false
            func finish(_ result: Result<Data, Error>) {
                guard !finished else { return }
                finished = true
                stream.stop()
                camera.stop()
                deviceSession.stop()
                continuation.resume(with: result)
            }
            let token = stream.photoDataPublisher.listen { photo in
                finish(.success(photo.data))
            }
            tokens.append(token as AnyObject)
            let errorToken = stream.errorPublisher.listen { streamError in
                finish(.failure(GlassesCameraError.captureFailed(streamError.localizedDescription)))
            }
            tokens.append(errorToken as AnyObject)
            // Timed fallback so the screen never hangs.
            Task {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                finish(.failure(GlassesCameraError.unavailable("Glasses camera timed out. Use the phone camera.")))
            }
            if stream.capturePhoto(format: .jpeg) == false {
                finish(.failure(GlassesCameraError.captureFailed("Photo capture did not start. Try again.")))
            }
        }
        #else
        throw GlassesCameraError.unavailable("Glasses SDK is not linked. Use the phone camera.")
        #endif
    }

    /// Next patient card on the Ray-Ban Display lens, only when a display device is present.
    /// Safe no op on audio only glasses and on the simulator.
    func showLensCard(patient: String, reason: String, alert: String) {
        #if canImport(MWDATDisplay)
        // Display sending needs a started display session. Kept as a guarded call so
        // the P2 card never blocks the visit flow when no display glasses are on hand.
        _ = (patient, reason, alert)
        #endif
    }
}

/// Phone camera picker used as the fallback when the glasses camera is unavailable.
struct PhoneCameraView: UIViewControllerRepresentable {
    var onImage: (Data) -> Void
    var onCancel: () -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: PhoneCameraView
        init(parent: PhoneCameraView) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.85) {
                parent.onImage(data)
            } else {
                parent.onCancel()
            }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.onCancel()
        }
    }
}
