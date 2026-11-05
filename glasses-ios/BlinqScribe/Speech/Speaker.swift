import AVFoundation
import Foundation
import Speech

/// Speaks short confirmations. Uses the active audio route, so speech comes
/// out of the glasses speakers when the glasses are connected over Bluetooth.
final class Speaker: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    @Published var isSpeaking = false

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .word) }
        let utterance = AVSpeechUtterance(string: trimmed)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        DispatchQueue.main.async { [weak self] in self?.isSpeaking = true }
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in self?.isSpeaking = false }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in self?.isSpeaking = false }
    }
}

/// Push to talk for Ask, using on device speech recognition when available.
/// Kept simple on purpose: one short dictation, then the text is sent to the server.
final class PushToTalk: NSObject, ObservableObject {
    @Published var isListening = false
    @Published var errorText: String?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func toggle(onResult: @escaping (String) -> Void) {
        if isListening { stop(); return }
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard status == .authorized else {
                    self?.errorText = "Speech recognition is not allowed. Type your question instead."
                    return
                }
                self?.start(onResult: onResult)
            }
        }
    }

    private func start(onResult: @escaping (String) -> Void) {
        guard let recognizer, recognizer.isAvailable else {
            errorText = "Speech recognition is not available right now."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
            try session.setActive(true)
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = false
            request = req
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                self?.request?.append(buffer)
            }
            engine.prepare()
            try engine.start()
            isListening = true
            task = recognizer.recognitionTask(with: req) { [weak self] result, _ in
                guard let self else { return }
                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString
                    DispatchQueue.main.async {
                        self.stop()
                        if !text.isEmpty { onResult(text) }
                    }
                }
            }
        } catch {
            errorText = error.localizedDescription
        }
    }

    func stop() {
        if engine.isRunning {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
    }
}
