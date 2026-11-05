import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readMic } from "../../recorder/micChoice";
import { MicPicker } from "./MicPicker";

const device = (deviceId: string, label: string, kind = "audioinput") => ({ deviceId, label, kind }) as MediaDeviceInfo;

describe("MicPicker", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => [
          device("default", "Default - MacBook Mic"),
          device("mac", "MacBook Mic"),
          device("usb", ""),
          device("cam", "FaceTime Camera", "videoinput"),
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it("lists the mics and remembers the one picked", async () => {
    const user = userEvent.setup();
    render(<MicPicker />);
    const trigger = await screen.findByRole("button", { name: "Microphone: System default" });
    await user.click(trigger);
    expect(await screen.findByRole("menuitemradio", { name: "System default" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "MacBook Mic" })).toBeInTheDocument();
    // A mic without a label yet (no permission) still shows, numbered.
    expect(screen.getByRole("menuitemradio", { name: "Microphone 2" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "FaceTime Camera" })).toBeNull();
    await user.click(screen.getByRole("menuitemradio", { name: "MacBook Mic" }));
    expect(readMic()).toBe("mac");
    expect(await screen.findByRole("button", { name: "Microphone: MacBook Mic" })).toBeInTheDocument();
  });
});
