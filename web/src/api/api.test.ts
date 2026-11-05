import { api, ApiError, onSignedOut } from ".";
import { useSession } from "./session";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let respond: (call: Call) => Response;

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      const call = { url: String(url instanceof Request ? url.url : url), init };
      calls.push(call);
      return respond(call);
    }),
  );
  useSession.getState().setToken("sess-123");
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name);
const gqlBody = (c: Call) =>
  JSON.parse(String(c.init.body)) as { operationName: string; variables: Record<string, unknown> };

describe("api over GraphQL", () => {
  it("sends the session only in the Authorization header", async () => {
    respond = () => json({ data: { schedule: [] } });
    await api.schedule("prov-1");
    const c = calls[0]!;
    expect(c.url).toContain("/graphql");
    expect(c.url).not.toContain("sess-123");
    expect(header(c, "authorization")).toBe("Bearer sess-123");
    expect(gqlBody(c)).toMatchObject({ operationName: "Schedule", variables: { provider: "prov-1", date: null } });
  });

  it("asks for the sample visit about this appointment's pet, signed in", async () => {
    respond = () => json({ data: { sample_transcript: "Owner: Luna has been scratching her ear." } });
    expect(await api.sampleTranscript("appt-4")).toEqual({ text: "Owner: Luna has been scratching her ear." });
    const c = calls[0]!;
    expect(gqlBody(c)).toMatchObject({ operationName: "SampleTranscript", variables: { appointment: "appt-4" } });
    expect(header(c, "authorization")).toBe("Bearer sess-123");
  });

  it("sends a signed note to the PIMS, then reads the visit fresh", async () => {
    respond = (c) =>
      gqlBody(c).operationName === "SendToPims"
        ? json({ data: { send_to_pims: { ok: true, status: "written", detail: "", pims_id: "4471" } } })
        : json({ data: { encounter: { id: "enc-1", write_back: { ok: true, status: "written", pims_id: "4471" } } } });
    const e = await api.sendToPims("enc-1");
    expect(calls.map((c) => gqlBody(c).operationName)).toEqual(["SendToPims", "Encounter"]);
    expect(gqlBody(calls[0]!).variables).toEqual({ id: "enc-1" });
    expect(e.write_back?.pims_id).toBe("4471");
  });

  it("turns a GraphQL error into an ApiError with the server's status and message", async () => {
    respond = () =>
      json({
        data: null,
        errors: [{ message: "Note is already signed", extensions: { code: "CONFLICT", status: 409 } }],
      });
    const err = await api.saveTranscript("enc-1", "text").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).message).toBe("Note is already signed");
  });

  it("signs the vet out when the server says the session is gone", async () => {
    const out = vi.fn();
    onSignedOut(out);
    respond = () => json({ data: null, errors: [{ message: "Please sign in", extensions: { status: 401 } }] });
    await api.brief().catch(() => undefined);
    expect(out).toHaveBeenCalledTimes(1);
  });

  it("sign in returns either a session or the 6 digit code step", async () => {
    respond = () =>
      json({
        data: { sign_in: { token: null, two_factor_required: true, ticket: "t-1", email_hint: "a***@clinic.test" } },
      });
    expect(await api.signIn("ana@clinic.test", "pw", true)).toEqual({
      kind: "code_needed",
      challenge: "t-1",
      sent_to: "a***@clinic.test",
      method: "email",
    });
    // An authenticator app is asked for by name.
    respond = () =>
      json({
        data: {
          sign_in: {
            token: null,
            two_factor_required: true,
            ticket: "t-2",
            two_factor_method: "app",
            email_hint: null,
          },
        },
      });
    expect(await api.signIn("ana@clinic.test", "pw", true)).toMatchObject({ challenge: "t-2", method: "app" });
    expect(gqlBody(calls[0]!).variables).toEqual({ login: "ana@clinic.test", password: "pw", remember: true });
    respond = () =>
      json({
        data: {
          verify_sign_in_code: { token: "new-sess", two_factor_required: false, ticket: null, email_hint: null },
        },
      });
    expect(await api.verifyCode("t-1", "123456")).toBe("new-sess");
  });

  it("saves only the note's own fields", async () => {
    respond = () => json({ data: { save_note: { id: "enc-1" } } });
    const note = {
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      client_summary: "c",
      vitals: { weight: "74 lb" },
      medications: ["x"],
      __typename: "SoapNote",
    };
    await api.saveNote("enc-1", note);
    expect(gqlBody(calls[0]!).variables.note).toEqual({
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      client_summary: "c",
      vitals: { weight: "74 lb" },
      medications: ["x"],
      vitals_by: "",
    });
  });
});

describe("api over REST", () => {
  it("uploads an audio chunk as multipart to its visit", async () => {
    respond = () => json({ id: "enc-9", transcript: "hello" });
    const e = await api.uploadAudio("enc-9", new Blob(["x"], { type: "audio/wav" }), 4);
    const c = calls[0]!;
    expect(c.url).toBe("/api/encounters/enc-9/audio");
    expect(c.init.method).toBe("POST");
    expect(c.init.body).toBeInstanceOf(FormData);
    expect((c.init.body as FormData).get("chunk_index")).toBe("4");
    expect(header(c, "authorization")).toBe("Bearer sess-123");
    expect(header(c, "content-type")).toBeNull(); // the browser sets the multipart boundary
    expect(e.transcript).toBe("hello");
  });

  it("loads files with the header and hands back a blob URL, never a URL with the token", async () => {
    respond = () => new Response(new Blob(["%PDF"]), { status: 200 });
    const created = vi.fn(() => "blob:local/1");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created }));
    const url = await api.summaryPdfUrl("enc-1", "es");
    expect(url).toBe("blob:local/1");
    expect(calls[0]!.url).toBe("/api/encounters/enc-1/summary.pdf?lang=es");
    expect(header(calls[0]!, "authorization")).toBe("Bearer sess-123");
  });
});
