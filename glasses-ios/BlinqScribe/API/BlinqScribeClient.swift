import Foundation

enum APIError: LocalizedError, Equatable {
    case badURL
    case server(detail: String, status: Int)
    case transport(String)
    case decode(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Server URL is not valid."
        case .server(let detail, _): return detail
        case .transport(let message): return message
        case .decode(let message): return "Could not read server reply. \(message)"
        }
    }
}

final class BlinqScribeClient {
    var baseURL: URL
    var token: String
    let session: URLSession

    init(baseURL: URL, token: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
    }

    convenience init(settings: SettingsStore, session: URLSession = .shared) {
        self.init(baseURL: settings.baseURL, token: settings.token, session: session)
    }

    func refresh(from settings: SettingsStore) {
        baseURL = settings.baseURL
        token = settings.token
    }

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { dec in
            let box = try dec.singleValueContainer()
            let raw = try box.decode(String.self)
            let formatters: [ISO8601DateFormatter] = {
                let withFrac = ISO8601DateFormatter()
                withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                let plain = ISO8601DateFormatter()
                plain.formatOptions = [.withInternetDateTime]
                return [withFrac, plain]
            }()
            for f in formatters { if let d = f.date(from: raw) { return d } }
            let noTZ = DateFormatter()
            noTZ.locale = Locale(identifier: "en_US_POSIX")
            noTZ.timeZone = TimeZone(secondsFromGMT: 0)
            for fmt in ["yyyy-MM-dd'T'HH:mm:ss.SSSSSS", "yyyy-MM-dd'T'HH:mm:ss"] {
                noTZ.dateFormat = fmt
                if let d = noTZ.date(from: raw) { return d }
            }
            throw DecodingError.dataCorruptedError(in: box, debugDescription: "Bad date: \(raw)")
        }
        return decoder
    }

    private static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private func url(_ path: String, query: [URLQueryItem] = []) throws -> URL {
        var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        let basePath = (comps?.path ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let clean = path.hasPrefix("/") ? String(path.dropFirst()) : path
        comps?.path = basePath.isEmpty ? "/\(clean)" : "/\(basePath)/\(clean)"
        if !query.isEmpty { comps?.queryItems = query }
        guard let url = comps?.url else { throw APIError.badURL }
        return url
    }

    private func request(_ url: URL, method: String) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        if !token.isEmpty { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return req
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("No server reply.")
        }
        guard (200..<300).contains(http.statusCode) else {
            if let body = try? JSONDecoder().decode(ErrorBody.self, from: data) {
                throw APIError.server(detail: body.detail, status: http.statusCode)
            }
            let text = String(data: data, encoding: .utf8) ?? ""
            throw APIError.server(detail: text.isEmpty ? "Server error \(http.statusCode)" : text,
                                  status: http.statusCode)
        }
        do {
            return try Self.makeDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decode(error.localizedDescription)
        }
    }

    func health() async throws -> HealthStatus {
        try await send(request(try url("/health"), method: "GET"))
    }

    func schedule(providerId: String = "") async throws -> [Appointment] {
        var query: [URLQueryItem] = []
        if !providerId.isEmpty { query.append(URLQueryItem(name: "provider_id", value: providerId)) }
        return try await send(request(try url("/api/schedule", query: query), method: "GET"))
    }

    func brief(providerId: String = "") async throws -> Brief {
        var query: [URLQueryItem] = []
        if !providerId.isEmpty { query.append(URLQueryItem(name: "provider_id", value: providerId)) }
        return try await send(request(try url("/api/brief", query: query), method: "GET"))
    }

    func card(appointmentId: String) async throws -> PreRoomCard {
        try await send(request(try url("/api/appointments/\(appointmentId)/card"), method: "GET"))
    }

    func startEncounter(appointmentId: String) async throws -> Encounter {
        var req = request(try url("/api/encounters"), method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try Self.makeEncoder().encode(
            NewEncounterBody(appointmentId: appointmentId, consentRecorded: true, source: "glasses"))
        return try await send(req)
    }

    func uploadAudio(encounterId: String, wav: Data, chunkIndex: Int) async throws -> Encounter {
        var lastError: Error?
        for _ in 0..<3 {
            do {
                return try await uploadMultipart(
                    path: "/api/encounters/\(encounterId)/audio",
                    fileData: wav, fileName: "chunk\(chunkIndex).wav", mime: "audio/wav",
                    fields: ["chunk_index": "\(chunkIndex)"])
            } catch let error as APIError {
                if case .server(_, let status) = error, (400..<500).contains(status) { throw error }
                lastError = error
            } catch {
                lastError = error
            }
        }
        throw lastError ?? APIError.transport("Audio upload failed.")
    }

    func uploadPhoto(encounterId: String, jpeg: Data, hint: String) async throws -> Encounter {
        try await uploadMultipart(
            path: "/api/encounters/\(encounterId)/photos",
            fileData: jpeg, fileName: "photo.jpg", mime: "image/jpeg",
            fields: ["hint": hint])
    }

    func draft(encounterId: String) async throws -> Encounter {
        var req = request(try url("/api/encounters/\(encounterId)/draft"), method: "POST")
        req.httpBody = Data()
        return try await send(req)
    }

    func ask(message: String, history: [ChatTurn] = [], providerId: String = "") async throws -> AssistantReply {
        var req = request(try url("/api/assistant"), method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try Self.makeEncoder().encode(
            AssistantRequestBody(message: message, history: history, providerId: providerId))
        return try await send(req)
    }

    private func uploadMultipart(path: String, fileData: Data, fileName: String,
                                 mime: String, fields: [String: String]) async throws -> Encounter {
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = request(try url(path), method: "POST")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        func append(_ string: String) { body.append(Data(string.utf8)) }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        append("Content-Type: \(mime)\r\n\r\n")
        body.append(fileData)
        append("\r\n")
        for (key, value) in fields {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
            append("\(value)\r\n")
        }
        append("--\(boundary)--\r\n")
        req.httpBody = body
        return try await send(req)
    }
}

enum KeychainStore {
    private static let service = "com.vetengage.blinqscribe"
    private static let account = "apiToken"

    static func saveToken(_ token: String) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service,
                                    kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
        guard !token.isEmpty else { return }
        var add = query
        add[kSecValueData as String] = Data(token.utf8)
        SecItemAdd(add as CFDictionary, nil)
    }

    static func loadToken() -> String {
        var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service,
                                    kSecAttrAccount as String: account]
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
}

final class SettingsStore: ObservableObject {
    @Published var serverURLString: String {
        didSet { UserDefaults.standard.set(serverURLString, forKey: Self.urlKey) }
    }
    @Published var token: String {
        didSet { KeychainStore.saveToken(token) }
    }
    @Published var useMockDevice: Bool {
        didSet { UserDefaults.standard.set(useMockDevice, forKey: Self.mockKey) }
    }

    private static let urlKey = "blinq.serverURL"
    private static let mockKey = "blinq.useMockDevice"
    static let defaultURL = "http://192.168.1.10:8000"

    init() {
        serverURLString = UserDefaults.standard.string(forKey: Self.urlKey) ?? Self.defaultURL
        token = KeychainStore.loadToken()
        useMockDevice = UserDefaults.standard.bool(forKey: Self.mockKey)
    }

    var baseURL: URL {
        URL(string: serverURLString.trimmingCharacters(in: .whitespacesAndNewlines)) ?? URL(string: Self.defaultURL)!
    }

    var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }
}
