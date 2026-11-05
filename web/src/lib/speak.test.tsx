import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadAloud } from "../components/ReadAloud";
import { pickBrowserVoice, setServerVoice, setVoiceChoice, speak, stopSpeech } from "./speak";

const voice = (name: string, lang = "en-US") => ({ name, lang }) as SpeechSynthesisVoice;

// A stand-in for the browser's speech: utterances are kept so the test can end them.
class Utterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
const spoken: Utterance[] = [];
const synth = {
  speak: vi.fn((u: Utterance) => spoken.push(u)),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [voice("Samantha"), voice("Google US English"), voice("Daniel", "en-GB")]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// A stand-in Audio element that plays at once and can be finished by the test.
const played: { src: string; pause: ReturnType<typeof vi.fn>; onended: (() => void) | null; playbackRate: number }[] =
  [];
class FakeAudio {
  src: string;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  constructor(src: string) {
    this.src = src;
    played.push(this);
  }
  play() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  spoken.length = 0;
  played.length = 0;
  synth.speak.mockClear();
  synth.cancel.mockClear();
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:clip"), revokeObjectURL: vi.fn() }));
  setVoiceChoice({ voice: "", speed: 1 });
});
afterEach(() => {
  stopSpeech();
  vi.unstubAllGlobals();
});

describe("the browser's voice", () => {
  it("prefers a natural US English voice, and keeps one the vet picked", () => {
    const all = [voice("Samantha"), voice("Google US English"), voice("Daniel", "en-GB")];
    expect(pickBrowserVoice(all)?.name).toBe("Google US English");
    expect(pickBrowserVoice(all, "Daniel")?.name).toBe("Daniel");
    expect(pickBrowserVoice([voice("Amélie", "fr-FR")])).toBeNull();
  });

  it("reads when the server has no natural voice (503), at the chosen speed", async () => {
    setServerVoice(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    setVoiceChoice({ voice: "", speed: 1.2 });
    await speak("Good morning", "brief");
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.voice?.name).toBe("Google US English");
    expect(spoken[0]!.rate).toBe(1.2);
    // Known now: the next read doesn't ask the server again.
    await speak("Again", "brief");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("says vet shorthand in plain words, the way the server's voice does", async () => {
    setServerVoice(false);
    await speak("Biscuit, 6yo, Cefpodoxime SID x10d", "brief");
    expect(spoken[0]!.text).toBe("Biscuit, 6 year old, Cefpodoxime once a day for 10 days");
  });
});

describe("the server's voice", () => {
  it("plays the clip from a blob URL and lets it go when done or stopped", async () => {
    setServerVoice(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["wav"]), { status: 200 })),
    );
    await speak("Good morning", "brief");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect(played).toHaveLength(1);
    expect(spoken).toHaveLength(0);
    act(() => played[0]!.onended?.());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:clip");

    await speak("Once more", "brief");
    stopSpeech();
    expect(played[1]!.pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});

describe("Read aloud", () => {
  it("toggles to Stop while reading, and back when stopped (as on leaving the screen)", async () => {
    setServerVoice(false);
    render(<ReadAloud id="brief" text="Good morning" />);
    const button = screen.getByRole("button", { name: "Read aloud" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Stop" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    // Navigation, sign out and a hidden tab all call stopSpeech.
    act(() => stopSpeech());
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
    act(() => {
      spoken.at(-1)!.onstart?.();
    });
    // A voice that starts after Stop doesn't turn the button back on.
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });

  it("one voice at a time: starting another read stops the first", async () => {
    setServerVoice(false);
    render(
      <>
        <ReadAloud id="brief" text="Brief" />
        <ReadAloud id="eod" text="End of day" iconOnly />
      </>,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Read aloud" })[0]!);
    await userEvent.click(screen.getAllByRole("button", { name: "Read aloud" })[0]!);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Stop" })).toHaveLength(1));
    expect(synth.cancel).toHaveBeenCalled();
  });
});
