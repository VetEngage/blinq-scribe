import Foundation

struct HealthStatus: Codable, Equatable {
    let ok: Bool
    let ai: String
    let practice: String
    let stt: String
    let sam: String
    let sms: String
}

struct Patient: Codable, Equatable {
    let id: String
    let name: String
    let species: String
    let breed: String
    let alerts: [String]
}

struct ClientInfo: Codable, Equatable {
    let id: String
    let firstName: String
    let lastName: String
    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
    }
    var fullName: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }
}

struct Appointment: Codable, Identifiable, Equatable {
    let id: String
    let start: Date
    let reason: String
    let room: String
    let providerName: String
    let patient: Patient
    let client: ClientInfo
    enum CodingKeys: String, CodingKey {
        case id, start, reason, room, patient, client
        case providerName = "provider_name"
    }
}

struct PendingFollowUp: Codable, Equatable {
    let encounterId: String
    let followupId: String
    let kind: String
    let reason: String
    enum CodingKeys: String, CodingKey {
        case encounterId = "encounter_id"
        case followupId = "followup_id"
        case kind, reason
    }
}

struct Brief: Codable, Equatable {
    let spoken: String
    let appointments: [String]
    let pendingFollowups: [PendingFollowUp]
    enum CodingKeys: String, CodingKey {
        case spoken, appointments
        case pendingFollowups = "pending_followups"
    }
}

struct PreRoomCard: Codable, Equatable {
    let spoken: String
    let patient: String
    let owner: String
    let reason: String
    let room: String
    let alerts: [String]
    let promised: [String]
    let history: [String]?
}

struct SoapNote: Codable, Equatable {
    var subjective: String = ""
    var objective: String = ""
    var assessment: String = ""
    var plan: String = ""
    var vitals: [String: String] = [:]
    var medications: [String] = []
    var clientSummary: String = ""
    enum CodingKeys: String, CodingKey {
        case subjective, objective, assessment, plan, vitals, medications
        case clientSummary = "client_summary"
    }
}

struct Slot: Codable, Equatable {
    let start: Date
    let end: Date
    let providerId: String
    let serviceId: String
    let bookingUrl: String
    enum CodingKeys: String, CodingKey {
        case start, end
        case providerId = "provider_id"
        case serviceId = "service_id"
        case bookingUrl = "booking_url"
    }
}

struct FollowUp: Codable, Identifiable, Equatable {
    let id: String
    let kind: String
    let reason: String
    let dueInDays: Int?
    let messageDraft: String
    let suggestedSlots: [Slot]
    let status: String
    enum CodingKeys: String, CodingKey {
        case id, kind, reason, status
        case dueInDays = "due_in_days"
        case messageDraft = "message_draft"
        case suggestedSlots = "suggested_slots"
    }
}

struct Segment: Codable, Equatable {
    let label: String
    let score: Double
    let box: [Double]
    let areaPx: Int?
    enum CodingKeys: String, CodingKey {
        case label, score, box
        case areaPx = "area_px"
    }
}

struct PhotoInfo: Codable, Identifiable, Equatable {
    let id: String
    let path: String
    let caption: String
    let findings: String
    let segments: [Segment]
    let takenAt: Date
    enum CodingKeys: String, CodingKey {
        case id, path, caption, findings, segments
        case takenAt = "taken_at"
    }
}

struct Encounter: Codable, Identifiable, Equatable {
    let id: String
    let appointmentId: String
    let patientId: String
    let consentRecorded: Bool
    let source: String
    var status: String
    var transcript: String
    var note: SoapNote?
    var followups: [FollowUp]
    var photos: [PhotoInfo]
    let createdAt: Date
    var signedAt: Date?
    var signedBy: String
    enum CodingKeys: String, CodingKey {
        case id, status, transcript, note, followups, photos
        case appointmentId = "appointment_id"
        case patientId = "patient_id"
        case consentRecorded = "consent_recorded"
        case source
        case createdAt = "created_at"
        case signedAt = "signed_at"
        case signedBy = "signed_by"
    }
}

struct ChatTurn: Codable, Equatable {
    let role: String
    let content: String
}

struct AssistantRequestBody: Codable {
    let message: String
    let history: [ChatTurn]
    let providerId: String
    enum CodingKeys: String, CodingKey {
        case message, history
        case providerId = "provider_id"
    }
}

struct AssistantReply: Codable, Equatable {
    let reply: String
    let toolsUsed: [String]
    enum CodingKeys: String, CodingKey {
        case reply
        case toolsUsed = "tools_used"
    }
}

struct NewEncounterBody: Codable {
    let appointmentId: String
    let consentRecorded: Bool
    let source: String
    enum CodingKeys: String, CodingKey {
        case appointmentId = "appointment_id"
        case consentRecorded = "consent_recorded"
        case source
    }
}

struct ErrorBody: Codable {
    let detail: String
}
