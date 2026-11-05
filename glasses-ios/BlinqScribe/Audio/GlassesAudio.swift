import AVFoundation
import Foundation

enum ActiveMic: String, Equatable {
    case glasses = "Glasses mic"
    case phone = "Phone mic"

    var shortLabel: String { self == .glasses ? "Glasses" : "Phone" }
}

/// Records from the glasses mic over Bluetooth HFP, falling back to the phone mic.
/// Audio is converted to 16 kHz mono 16-bit PCM and uploaded in 15 second WAV chunks.
final class GlassesAudio: ObservableObject {
    @Published var isRecording = false
    @Published var activeMic: ActiveMic = .phone
    @Published var log: [String] = []
    @Published var errorText: String?

    private let engine = AVAudioEngine()
    private var converter: AVAudioConverter?
    private var chunker = WavChunker()
    private var chunkIndexBase = 0
    private var encounterId: String?
    private var uploadTask: Task<Void, Never>?
    private var pendingUploads: [(index: Int, wav: Data)] = []
    private var isUploading = false
    private var routeObserver: NSObjectProtocol?

    var clientProvider: () -> BlinqScribeClient?
    var onSpeak: ((String) -> Void)?

    init(clientProvider: @escaping () -> BlinqScribeClient?) {
        self.clientProvider = clientProvider
    }

    private func note(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            self?.log.append(text)
            if let count = self?.log.count, count > 60 { self?.log.removeFirst(count - 60) }
        }
    }

    func updateActiveMic() {
        let session = AVAudioSession.sharedInstance()
        let inputs = session.currentRoute.inputs
        let usesGlasses = inputs.contains { $0.portType == .bluetoothHFP || $0.portType == .bluetoothA2DP }
        let next: ActiveMic = usesGlasses ? .glasses : .phone
        DispatchQueue.main.async { [weak self] in self?.activeMic = next }
        // Also check available inputs so the label is right before recording starts.
        if let available = session.availableInputs {
            let hasHFP = available.contains { $0.portType == .bluetoothHFP }
            if usesGlasses == false, hasHFP == false {
                DispatchQueue.main.async { [weak self] in self?.activeMic = .phone }
            }
        }
    }

    func start(encounterId: String) async -> Bool {
        guard !isRecording else { return true }
        self.encounterId = encounterId
        errorText = nil
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try session.setActive(true)
            updateActiveMic()
            note("Mic: \(activeMic.rawValue)")

            let input = engine.inputNode
            let inputFormat = input.outputFormat(forBus: 0)
            guard let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000,
                                                   channels: 1, interleaved: true),
                  let conv = AVAudioConverter(from: inputFormat, to: targetFormat) else {
                errorText = "Could not set up audio conversion."
                return false
            }
            converter = conv
            chunker.reset()

            input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
                self?.handle(buffer: buffer, converter: conv, targetFormat: targetFormat)
            }
            engine.prepare()
            try engine.start()
            await MainActor.run { self.isRecording = true }
            watchRouteChanges()
            return true
        } catch {
            await MainActor.run { self.errorText = error.localizedDescription }
            return false
        }
    }

    private func handle(buffer: AVAudioPCMBuffer, converter: AVAudioConverter, targetFormat: AVAudioFormat) {
        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024
        guard let out = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }
        var error: NSError?
        var consumed = false
        converter.convert(to: out, error: &error) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, out.frameLength > 0, let channel = out.int16ChannelData?[0] else { return }
        let byteCount = Int(out.frameLength) * 2
        let pcm = Data(bytes: channel, count: byteCount)
        let ready = chunker.append(pcm)
        for item in ready { enqueue(index: item.index, wav: item.wav) }
    }

    private func enqueue(index: Int, wav: Data) {
        pendingUploads.append((index, wav))
        note("Chunk \(index) ready (\(wav.count) bytes)")
        drainUploads()
    }

    private func drainUploads() {
        guard !isUploading, let encId = encounterId, let client = clientProvider() else { return }
        guard !pendingUploads.isEmpty else { return }
        isUploading = true
        let batch = pendingUploads
        pendingUploads = []
        uploadTask = Task { [weak self] in
            for item in batch {
                do {
                    _ = try await client.uploadAudio(encounterId: encId, wav: item.wav, chunkIndex: item.index)
                    self?.note("Chunk \(item.index) uploaded")
                } catch {
                    await MainActor.run {
                        self?.errorText = "Chunk \(item.index) failed after 3 tries. \(error.localizedDescription)"
                    }
                    self?.note("Chunk \(item.index) failed")
                }
            }
            await MainActor.run { self?.isUploading = false }
            self?.drainUploads()
        }
    }

    /// Stops recording and uploads the final partial chunk.
    func stopAndFlush() async {
        guard isRecording else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        if let observer = routeObserver { NotificationCenter.default.removeObserver(observer) }
        routeObserver = nil
        await MainActor.run { self.isRecording = false }
        if let last = chunker.flush() {
            // Upload the final chunk now and wait for it.
            if let encId = encounterId, let client = clientProvider() {
                do {
                    _ = try await client.uploadAudio(encounterId: encId, wav: last.wav, chunkIndex: last.index)
                    note("Final chunk \(last.index) uploaded")
                } catch {
                    await MainActor.run {
                        self.errorText = "Final chunk failed after 3 tries. \(error.localizedDescription)"
                    }
                }
            }
            chunker.reset()
        }
        // Wait for the 15 second chunk queue to finish.
        while isUploading {
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func watchRouteChanges() {
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.updateActiveMic()
        }
    }
}
