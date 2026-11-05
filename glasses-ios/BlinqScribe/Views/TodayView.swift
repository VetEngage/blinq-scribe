import SwiftUI

struct TodayView: View {
    @EnvironmentObject var settings: SettingsStore
    @EnvironmentObject var speaker: Speaker

    @State private var appointments: [Appointment] = []
    @State private var brief: Brief?
    @State private var loading = false
    @State private var errorText: String?
    @State private var selected: Appointment?

    private var client: BlinqScribeClient { BlinqScribeClient(settings: settings) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        speakBrief()
                    } label: {
                        Label("Morning brief", systemImage: "speaker.wave.2.fill")
                    }
                    if let brief {
                        Text(brief.spoken)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                if let errorText {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }

                Section("Today") {
                    if loading && appointments.isEmpty {
                        ProgressView("Loading schedule")
                    } else if appointments.isEmpty {
                        Text("No appointments found. Check the server URL in Settings.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(appointments) { appt in
                        Button {
                            selected = appt
                            Task { await speakCard(for: appt) }
                        } label: {
                            AppointmentRow(appointment: appt)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await load() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Reload")
                }
            }
            .refreshable { await load() }
            .navigationDestination(item: $selected) { appt in
                VisitView(appointment: appt)
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true
        errorText = nil
        do {
            async let schedule = client.schedule()
            async let dayBrief = client.brief()
            appointments = try await schedule
            brief = try await dayBrief
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }

    private func speakBrief() {
        if let brief {
            speaker.speak(brief.spoken)
        } else {
            Task {
                await load()
                if let brief { speaker.speak(brief.spoken) }
            }
        }
    }

    private func speakCard(for appt: Appointment) async {
        do {
            let card = try await client.card(appointmentId: appt.id)
            speaker.speak(card.spoken)
        } catch {
            // Opening the visit still works. The spoken card is P1.
        }
    }
}

struct AppointmentRow: View {
    let appointment: Appointment

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(Self.timeFormatter.string(from: appointment.start))
                    .font(.subheadline).bold()
                Text(appointment.patient.name)
                    .font(.headline)
                Spacer()
                Text(appointment.room)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text("\(appointment.patient.species) - \(appointment.patient.breed)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(appointment.reason)
                .font(.subheadline)
            if !appointment.patient.alerts.isEmpty {
                HStack(spacing: 6) {
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
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
