import XCTest
@testable import BlinqScribe

final class StubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        StubURLProtocol.requests.append(request)
        do {
            guard let handler = StubURLProtocol.handler else {
                throw NSError(domain: "stub", code: 1)
            }
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    static func reset() {
        handler = nil
        requests = []
    }
}

final class ClientTests: XCTestCase {
    private var session: URLSession!

    override func setUp() {
        super.setUp()
        StubURLProtocol.reset()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        session = URLSession(configuration: config)
    }

    override func tearDown() {
        StubURLProtocol.reset()
        session = nil
        super.tearDown()
    }

    private func jsonResponse(_ url: URL, status: Int = 200, body: String) -> (HTTPURLResponse, Data) {
        let response = HTTPURLResponse(url: url, statusCode: status,
                                       httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        return (response, Data(body.utf8))
    }

    private func makeClient(token: String = "") -> BlinqScribeClient {
        BlinqScribeClient(baseURL: URL(string: "http://test.local:8000")!, token: token, session: session)
    }

    func testHealthRequest() async throws {
        StubURLProtocol.handler = { req in
            XCTAssertEqual(req.url?.path, "/health")
            XCTAssertEqual(req.httpMethod, "GET")
            return self.jsonResponse(req.url!, body: #"{"ok":true,"ai":"mock","practice":"mock","stt":"mock","sam":"mock","sms":"mock"}"#)
        }
        let health = try await makeClient().health()
        XCTAssertTrue(health.ok)
        XCTAssertEqual(health.ai, "mock")
    }

    func testScheduleSendsTokenAndParses() async throws {
        StubURLProtocol.handler = { req in
            XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer [REDACTED]")
            XCTAssertEqual(req.url?.path, "/api/schedule")
            let body = #"[{"id":"appt-1","start":"2026-10-29T09:00:00","reason":"Ear scratching","room":"Exam 1","provider_name":"Dr. Ana Rivera","patient":{"id":"pat-1","name":"Biscuit","species":"Canine","breed":"Golden Retriever","alerts":[]},"client":{"id":"cli-1","first_name":"Jordan","last_name":"Lee"}}]"#
            return self.jsonResponse(req.url!, body: body)
        }
        let appts = try await makeClient(token: "tok123").schedule()
        XCTAssertEqual(appts.count, 1)
        XCTAssertEqual(appts[0].patient.name, "Biscuit")
        XCTAssertEqual(appts[0].client.fullName, "Jordan Lee")
    }

    func testStartEncounterBodyAndConsent() async throws {
        StubURLProtocol.handler = { req in
            XCTAssertEqual(req.url?.path, "/api/encounters")
            XCTAssertEqual(req.httpMethod, "POST")
            let body = String(data: req.httpBody ?? Data(), encoding: .utf8) ?? ""
            XCTAssertTrue(body.contains("\"consent_recorded\":true"), body)
            XCTAssertTrue(body.contains("\"source\":\"glasses\""), body)
            XCTAssertTrue(body.contains("\"appointment_id\":\"appt-1\""), body)
            let reply = #"{"id":"enc1","appointment_id":"appt-1","patient_id":"pat-1","consent_recorded":true,"source":"glasses","status":"recording","transcript":"","note":null,"followups":[],"photos":[],"created_at":"2026-10-29T09:00:00Z","signed_at":null,"signed_by":""}"#
            return self.jsonResponse(req.url!, body: reply)
        }
        let enc = try await makeClient().startEncounter(appointmentId: "appt-1")
        XCTAssertEqual(enc.id, "enc1")
        XCTAssertEqual(enc.source, "glasses")
    }

    func testErrorDetailIsSurfaced() async {
        StubURLProtocol.handler = { req in
            self.jsonResponse(req.url!, status: 400, body: #"{"detail":"The owner must agree to recording before we start."}"#)
        }
        do {
            _ = try await makeClient().startEncounter(appointmentId: "appt-1")
            XCTFail("Expected error")
        } catch let error as APIError {
            XCTAssertEqual(error.localizedDescription, "The owner must agree to recording before we start.")
        } catch {
            XCTFail("Wrong error: \(error)")
        }
    }

    func testAudioUploadIsMultipartWithChunkIndex() async throws {
        StubURLProtocol.handler = { req in
            XCTAssertEqual(req.url?.path, "/api/encounters/enc1/audio")
            let contentType = req.value(forHTTPHeaderField: "Content-Type") ?? ""
            XCTAssertTrue(contentType.contains("multipart/form-data"))
            let body = req.httpBody ?? Data()
            let text = String(data: body, encoding: .isoLatin1) ?? ""
            XCTAssertTrue(text.contains("chunk_index"))
            XCTAssertTrue(text.contains("chunk0.wav"))
            let reply = #"{"id":"enc1","appointment_id":"appt-1","patient_id":"pat-1","consent_recorded":true,"source":"glasses","status":"recording","transcript":"hello","note":null,"followups":[],"photos":[],"created_at":"2026-10-29T09:00:00Z","signed_at":null,"signed_by":""}"#
            return self.jsonResponse(req.url!, body: reply)
        }
        let wav = WavChunker.wavData(pcm: Data(count: 3200))
        let enc = try await makeClient().uploadAudio(encounterId: "enc1", wav: wav, chunkIndex: 0)
        XCTAssertEqual(enc.transcript, "hello")
    }

    func testAskBodyShape() async throws {
        StubURLProtocol.handler = { req in
            XCTAssertEqual(req.url?.path, "/api/assistant")
            let body = String(data: req.httpBody ?? Data(), encoding: .utf8) ?? ""
            XCTAssertTrue(body.contains("\"message\":\"who is next\""), body)
            return self.jsonResponse(req.url!, body: #"{"reply":"Next is Miso.","tools_used":["get_schedule"]}"#)
        }
        let reply = try await makeClient().ask(message: "who is next")
        XCTAssertEqual(reply.reply, "Next is Miso.")
        XCTAssertEqual(reply.toolsUsed, ["get_schedule"])
    }
}
