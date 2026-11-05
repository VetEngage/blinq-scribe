import SwiftUI

struct VisitView: View {
    let appointment: Appointment

    @EnvironmentObject var settings: SettingsStore
    @EnvironmentObject var speaker: Speaker
    @EnvironmentObject var glassesCamera: GlassesCamera

    @StateObject private var pushToTalk = PushToTalk()

    @State private var consent = false
    @State private var encounter: Encounter?
    @State private var starting = false
    @State private var drafting = false
    @State private var capturing = false
    @State private var hint = ""
    @State private var askText = ""
    @State private var asking = false
    @State private var chatHistory: [ChatTurn] = []
    @State private var errorText: String?
    @State private var showPhoneCamera = false
    @State private var photoSourceNote: String?
    @State private var visitLog: [String] = []

    @State private var audio: GlassesAudio?

    private var client: BlinqScribeClient { BlinqScribeClient(settings: settings) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if let errorText {
                    Text(errorText)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if encounter == nil {
                    consentSection
                } else {
                    visitSection
                }
                logSection
            }
            .padding()
        }
        .navigationTitle(appointment.patient.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPhoneCamera) {
            PhoneCameraView { data in
                showPhoneCamera = false
                Task { await uploadPhoto(data: data, fromGlasses: false) }
            } onCancel: {
                showPhoneCamera = false
            }
        }
        .onAppear {
            if audio == nil {
                let store = settings
                let holder = GlassesAudio(clientProvider: { BlinqScribeClient(settings: store) })
                audio = holder
            }
            audio?.updateActiveMic()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(appointment.patient.name).font(.title2).bold()
            Text("\(appointment.patient.species) - \(appointment.patient.breed)")
                .foregroundStyle(.secondary)
            Text(appointment.reason)
            Text("Owner: \(appointment.client.fullName) - \(appointment.room)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if !appointment.patient.alerts.isEmpty {
                ForEach(appointment.patient.alerts, id: \.self) { alert in
                    Text(alert)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.orange.opacity(0.2))
                        .foregroundStyle(Color.orange)
                        .clipShape(Capsule())
                }
            }
        }
    }

    private var consentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle("Owner agreed to recording", isOn: $consent)
            Button {
                Task { await startVisit() }
            } label: {
                if starting { ProgressView() } else { Text("Owner agreed: start visit") }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!consent || starting)
            Text("Recording is not possible until the visit has started.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var visitSection: some View {
        if let audio {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 8) {
                    Image(systemName: audio.activeMic == .glasses ? "eyeglasses" : "iphone")
                    Text("Mic: \(audio.activeMic.rawValue)")
                        .font(.subheadline).bold()
                    if audio.isRecording {
                        Text("Recording")
                            .font(.caption).bold()
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.red.opacity(0.15))
                            .foregroundStyle(Color.red)
                            .clipShape(Capsule())
                    }
                }

                Button {
                    Task { await toggleRecord(audio: audio) }
                } label: {
                    Text(audio.isRecording ? "Stop recording" : "Record")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(audio.isRecording ? Color.red : Color.accentColor)
                .controlSize(.large)

                VStack(alignment: .leading, spacing: 8) {
                    TextField("Photo hint (optional)", text: $hint)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        Task { await capturePhoto() }
                    } label: {
                        if capturing { ProgressView() } else { Text("Capture photo") }
                    }
                    .buttonStyle(.bordered)
                    .disabled(capturing)
                    if let photoSourceNote {
                        Text(photoSourceNote)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let count = encounter?.photos.count, count > 0 {
                        Text("\(count) photo(s) saved.")
                            .font(.footnote)
                    }
                }

                Button {
                    Task { await draftNote() }
                } label: {
                    if drafting { ProgressView() } else { Text("Write the note") }
                }
                .buttonStyle(.bordered)
                .disabled(drafting)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Ask the assistant").font(.headline)
                    HStack {
                        TextField("Who is next?", text: $askText)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await ask() } }
                        Button {
                            pushToTalk.toggle { text in
                                askText = text
                                Task { await ask() }
                            }
                        } label: {
                            Image(systemName: pushToTalk.isListening ? "mic.fill" : "mic")
                        }
                        .accessibilityLabel("Push to talk")
                        Button("Ask") { Task { await ask() } }
                            .disabled(asking || askText.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    if asking { ProgressView("Asking") }
                    if let pushError = pushToTalk.errorText {
                        Text(pushError).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            .onReceive(audio.$log) { newLog in
                visitLog = Array((visitLog + newLog.suffix(1)).suffix(30))
            }
            .onReceive(audio.$errorText) { text in
                if let text { errorText = text }
            }
        }
    }

    private var logSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Visit log").font(.headline)
            if visitLog.isEmpty {
                Text("Uploads and replies will show here.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(visitLog.enumerated()), id: \.offset) { _, line in
                Text(line).font(.footnote)
            }
        }
    }

    private func log(_ text: String) {
        visitLog.append(text)
    }

    private func startVisit() async {
        starting = true
        errorText = nil
        do {
            let enc = try await client.startEncounter(appointmentId: appointment.id)
            encounter = enc
            log("Visit started (\(enc.id))")
            speaker.speak("Visit started")
        } catch {
            errorText = error.localizedDescription
        }
        starting = false
    }

    private func toggleRecord(audio: GlassesAudio) async {
        guard let enc = encounter else { return }
        if audio.isRecording {
            await audio.stopAndFlush()
            log("Recording stopped")
            speaker.speak("Recording stopped")
        } else {
            errorText = nil
            let ok = await audio.start(encounterId: enc.id)
            if ok {
                log("Recording with \(audio.activeMic.rawValue)")
                speaker.speak("Recording")
            } else if let text = audio.errorText {
                errorText = text
            }
        }
    }

    private func capturePhoto() async {
        capturing = true
        errorText = nil
        do {
            let data = try await glassesCamera.captureFromGlasses()
            photoSourceNote = "Photo from glasses camera."
            await uploadPhoto(data: data, fromGlasses: true)
        } catch let error as GlassesCameraError {
            if case .unavailable = error {
                photoSourceNote = "Glasses camera not available. Using the phone camera. \(error.localizedDescription)"
                showPhoneCamera = true
            } else {
                errorText = error.localizedDescription
            }
        } catch {
            photoSourceNote = "Glasses camera not available. Using the phone camera."
            showPhoneCamera = true
        }
        capturing = false
    }

    private func uploadPhoto(data: Data, fromGlasses: Bool) async {
        guard let enc = encounter else { return }
        do {
            let updated = try await client.uploadPhoto(encounterId: enc.id, jpeg: data, hint: hint)
            encounter = updated
            if let last = updated.photos.last, !last.caption.isEmpty {
                log("Photo saved: \(last.caption)")
            } else {
                log("Photo saved")
            }
            speaker.speak("Photo saved")
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func draftNote() async {
        guard let enc = encounter else { return }
        drafting = true
        errorText = nil
        do {
            let updated = try await client.draft(encounterId: enc.id)
            encounter = updated
            let count = updated.followups.count
            log("Note drafted with \(count) follow ups")
            speaker.speak("Note drafted with \(count) follow ups. Review it in the console.")
        } catch {
            errorText = error.localizedDescription
        }
        drafting = false
    }

    private func ask() async {
        let question = askText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        asking = true
        errorText = nil
        do {
            let reply = try await client.ask(message: question, history: chatHistory)
            chatHistory.append(ChatTurn(role: "user", content: question))
            chatHistory.append(ChatTurn(role: "assistant", content: reply.reply))
            log("Assistant: \(reply.reply)")
            speaker.speak(reply.reply)
            askText = ""
        } catch {
            errorText = error.localizedDescription
        }
        asking = false
    }
}
