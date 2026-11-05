import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import type { Encounter } from "../../api/types";

const api = vi.hoisted(() => ({
  encounter: vi.fn(),
  uploadPhoto: vi.fn(),
  updatePhoto: vi.fn(),
  deletePhoto: vi.fn(),
  photoUrl: vi.fn(),
}));
vi.mock("../../api", () => ({ api }));

import { PhotoDialog } from "./PhotoDialog";
import { usePhotoAutosave } from "./usePhotoAutosave";
import { cameraOn } from "../../recorder/camera";

const enc = { id: "enc-1", status: "recording", photos: [] } as unknown as Encounter;

function fakeCamera() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
  return stop;
}

describe("photo capture", () => {
  it("starts this computer's camera and stops it when the dialog closes", async () => {
    const stop = fakeCamera();
    const onState = vi.fn();
    const { rerender } = render(
      <PhotoDialog state={{ mode: "capture" }} onState={onState} e={enc} setCurrent={() => {}} />,
    );
    expect(await screen.findByRole("button", { name: "Take photo" })).toBeEnabled();
    expect(cameraOn()).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onState).toHaveBeenCalledWith(null);
    rerender(<PhotoDialog state={null} onState={onState} e={enc} setCurrent={() => {}} />);
    expect(stop).toHaveBeenCalled();
    expect(cameraOn()).toBe(false);
  });

  it("stops the camera when the vet switches to a file, and takes images only", async () => {
    const stop = fakeCamera();
    render(<PhotoDialog state={{ mode: "capture" }} onState={() => {}} e={enc} setCurrent={() => {}} />);
    await screen.findByRole("button", { name: "Take photo" });
    await userEvent.click(screen.getByRole("radio", { name: "Upload from device" }));
    expect(stop).toHaveBeenCalled();
    const input = screen.getByLabelText("Choose a photo from this device") as HTMLInputElement;
    expect(input.accept).toBe("image/jpeg,image/png");
    await userEvent.upload(input, new File(["x"], "notes.pdf", { type: "application/pdf" }), { applyAccept: false });
    expect(await screen.findByText("Use a JPEG or PNG photo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take photo" })).toBeDisabled();
  });

  it("an upload shows the photo with the outline drawing in, then opens its edit view", async () => {
    fakeCamera();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    let finish: (e: Encounter) => void = () => {};
    api.uploadPhoto.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    const onState = vi.fn();
    const setCurrent = vi.fn();
    render(<PhotoDialog state={{ mode: "capture" }} onState={onState} e={enc} setCurrent={setCurrent} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Upload from device" }));
    await userEvent.upload(
      screen.getByLabelText("Choose a photo from this device"),
      new File(["x"], "ear.png", { type: "image/png" }),
    );
    await userEvent.type(screen.getByLabelText("What is it? (optional)"), "right ear");
    await userEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect(api.uploadPhoto).toHaveBeenCalledWith("enc-1", expect.any(File), "right ear");
    expect(await screen.findByText(/Blinq is describing the photo/)).toBeInTheDocument();
    await act(async () => finish({ ...enc, photos: [{ id: "ph-1" }] } as unknown as Encounter));
    await waitFor(() => expect(onState).toHaveBeenLastCalledWith({ mode: "edit", photoId: "ph-1" }));
    expect(setCurrent).toHaveBeenCalled();
  });
});

const photoOf = (id: string, label = "") => ({
  id,
  label,
  caption: "",
  findings: "",
  segments: [],
  outline: [],
  crop: null,
  rotation: 0,
  in_note: true,
  show_owner: false,
});

describe("retakes", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    api.photoUrl.mockResolvedValue("blob:photo");
  });

  it("a retake from the glasses removes the old photo too", async () => {
    fakeCamera();
    const withOld = { ...enc, photos: [photoOf("old")] } as unknown as Encounter;
    api.encounter.mockReset().mockResolvedValue({ ...withOld, photos: [photoOf("old"), photoOf("new")] });
    api.deletePhoto.mockReset().mockResolvedValue({ ...withOld, photos: [photoOf("new")] });
    const onState = vi.fn();
    render(
      <PhotoDialog state={{ mode: "capture", retakeOf: "old" }} onState={onState} e={withOld} setCurrent={() => {}} />,
    );
    await userEvent.click(await screen.findByRole("radio", { name: "Glasses" }));
    await waitFor(() => expect(api.deletePhoto).toHaveBeenCalledWith("enc-1", "old"), { timeout: 4000 });
    expect(onState).toHaveBeenCalledWith({ mode: "edit", photoId: "new" });
  });

  it("if the old photo can't be removed, says so and offers to remove it again, never a second upload", async () => {
    fakeCamera();
    const withOld = { ...enc, photos: [photoOf("old")] } as unknown as Encounter;
    const both = { ...withOld, photos: [photoOf("old"), photoOf("new", "Retaken")] } as unknown as Encounter;
    api.uploadPhoto.mockReset().mockResolvedValue(both);
    api.deletePhoto
      .mockReset()
      .mockRejectedValueOnce(new Error("Server busy"))
      .mockResolvedValueOnce({ ...withOld, photos: [photoOf("new", "Retaken")] });
    const { rerender } = render(
      <PhotoDialog state={{ mode: "capture", retakeOf: "old" }} onState={() => {}} e={withOld} setCurrent={() => {}} />,
    );
    await userEvent.click(await screen.findByRole("radio", { name: "Upload from device" }));
    await userEvent.upload(
      screen.getByLabelText("Choose a photo from this device"),
      new File(["x"], "ear.png", { type: "image/png" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Take photo" }));
    await waitFor(() => expect(api.deletePhoto).toHaveBeenCalledTimes(1));
    rerender(
      <PhotoDialog state={{ mode: "edit", photoId: "new" }} onState={() => {}} e={both} setCurrent={() => {}} />,
    );
    expect(
      await screen.findByText(/New photo saved; the old one couldn't be removed \(Server busy\)/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The photo was not added/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove the old photo" }));
    await waitFor(() => expect(screen.queryByText(/old one couldn't be removed/)).not.toBeInTheDocument());
    expect(api.deletePhoto).toHaveBeenCalledTimes(2);
    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
  });
});

describe("photo types", () => {
  it("turns away a HEIC before upload, and shows the server's message if one gets through", async () => {
    fakeCamera();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    render(<PhotoDialog state={{ mode: "capture" }} onState={() => {}} e={enc} setCurrent={() => {}} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Upload from device" }));
    const input = screen.getByLabelText("Choose a photo from this device");
    await userEvent.upload(input, new File(["x"], "ear.heic", { type: "image/heic" }), { applyAccept: false });
    expect(await screen.findByText("Use a JPEG or PNG photo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take photo" })).toBeDisabled();
    // A file whose type the browser got wrong: the server's 415 message is shown.
    api.uploadPhoto.mockReset().mockRejectedValue(new Error("Use a JPEG or PNG photo."));
    await userEvent.upload(input, new File(["x"], "ear.png", { type: "image/png" }));
    await userEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect(await screen.findByText("The photo was not added: Use a JPEG or PNG photo.")).toBeInTheDocument();
  });
});

describe("saying capture", () => {
  it("takes the photo when the vet says capture, shows the hint, and stops listening on close", async () => {
    fakeCamera();
    const recs: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onresult: ((ev: unknown) => void) | null;
    }[] = [];
    vi.stubGlobal(
      "SpeechRecognition",
      class {
        continuous = false;
        interimResults = false;
        lang = "";
        onend = null;
        onerror = null;
        onresult: ((ev: unknown) => void) | null = null;
        start = vi.fn();
        stop = vi.fn();
        constructor() {
          recs.push(this);
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
      cb(new Blob(["jpg"], { type: "image/jpeg" })),
    );
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    api.uploadPhoto.mockReset().mockReturnValue(new Promise(() => {}));
    const { rerender } = render(
      <PhotoDialog state={{ mode: "capture" }} onState={() => {}} e={enc} setCurrent={() => {}} />,
    );
    expect(await screen.findByText('Or say "capture"')).toBeInTheDocument();
    const rec = recs.at(-1)!;
    expect(rec.start).toHaveBeenCalled();
    await act(async () =>
      rec.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "okay capture" } }] }),
    );
    await waitFor(() => expect(api.uploadPhoto).toHaveBeenCalledWith("enc-1", expect.any(File), ""));
    rerender(<PhotoDialog state={null} onState={() => {}} e={enc} setCurrent={() => {}} />);
    expect(rec.stop).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("listens for nothing where the browser can't", async () => {
    fakeCamera();
    render(<PhotoDialog state={{ mode: "capture" }} onState={() => {}} e={enc} setCurrent={() => {}} />);
    await screen.findByRole("button", { name: "Take photo" });
    expect(screen.queryByText('Or say "capture"')).not.toBeInTheDocument();
  });
});

describe("photo edit view", () => {
  it("saves an edit still waiting before deleting the photo", async () => {
    api.photoUrl.mockResolvedValue("blob:photo");
    const one = { ...enc, photos: [photoOf("ph-1", "Ear")] } as unknown as Encounter;
    const calls: string[] = [];
    api.updatePhoto.mockReset().mockImplementation(async (_e: string, _p: string, edit: object) => {
      calls.push(`update ${JSON.stringify(edit)}`);
      return one;
    });
    api.deletePhoto.mockReset().mockImplementation(async () => {
      calls.push("delete");
      return { ...one, photos: [] };
    });
    render(<PhotoDialog state={{ mode: "edit", photoId: "ph-1" }} onState={() => {}} e={one} setCurrent={() => {}} />);
    await userEvent.type(await screen.findByLabelText("Label"), " canal");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete photo" }));
    await waitFor(() => expect(calls).toEqual(['update {"label":"Ear canal"}', "delete"]));
  });

  it("is read only once the visit is signed, and says so", async () => {
    api.photoUrl.mockResolvedValue("blob:photo");
    const signed = {
      ...enc,
      status: "signed",
      photos: [
        {
          id: "ph-1",
          label: "Right ear",
          caption: "Red canal",
          findings: "",
          segments: [],
          outline: [],
          crop: null,
          rotation: 0,
          in_note: true,
          show_owner: false,
        },
      ],
    } as unknown as Encounter;
    render(
      <PhotoDialog state={{ mode: "edit", photoId: "ph-1" }} onState={() => {}} e={signed} setCurrent={() => {}} />,
    );
    expect(await screen.findByText(/This visit is signed, so its photos can't be changed/)).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toBeDisabled();
    expect(screen.getByText("Red canal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Description" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Show in the owner's summary/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rotate" })).not.toBeInTheDocument();
  });
});

describe("photo edit view: Blinq's text and Save", () => {
  const described = {
    ...enc,
    photos: [{ ...photoOf("ph-1", "Ear"), caption: "Red, swollen canal", findings: "Brown discharge" }],
  } as unknown as Encounter;

  it("shows Blinq's description as text with Edit; Esc finishes it without closing the dialog", async () => {
    api.photoUrl.mockResolvedValue("blob:photo");
    api.updatePhoto.mockReset().mockResolvedValue(described);
    const onState = vi.fn();
    render(
      <PhotoDialog state={{ mode: "edit", photoId: "ph-1" }} onState={onState} e={described} setCurrent={() => {}} />,
    );
    expect(await screen.findByText("Red, swollen canal")).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toHaveAttribute("placeholder", "Left ear, wound on paw");
    expect(screen.getAllByText("Written by Blinq. Edit it as you like. It never names a diagnosis.")).toHaveLength(1);
    // More detail stays folded until asked for.
    expect(screen.queryByText("Brown discharge")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More detail" }));
    expect(screen.getByText("Brown discharge")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit Description" }));
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveFocus();
    // One at a time: opening the other text closes this one.
    await userEvent.click(screen.getByRole("button", { name: "Edit More detail" }));
    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "More detail" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Edit Description" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Description" }), ", no odor");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    expect(screen.getByText("Red, swollen canal, no odor")).toBeInTheDocument();
    expect(onState).not.toHaveBeenCalledWith(null);
    await waitFor(() =>
      expect(api.updatePhoto).toHaveBeenCalledWith("enc-1", "ph-1", { caption: "Red, swollen canal, no odor" }),
    );
  });

  it("Save sends what's waiting, says Saved, then closes", async () => {
    api.photoUrl.mockResolvedValue("blob:photo");
    let finish: (e: Encounter) => void = () => {};
    api.updatePhoto.mockReset().mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    const onState = vi.fn();
    render(
      <PhotoDialog state={{ mode: "edit", photoId: "ph-1" }} onState={onState} e={described} setCurrent={() => {}} />,
    );
    await userEvent.type(await screen.findByLabelText("Label"), " canal");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(api.updatePhoto).toHaveBeenCalledWith("enc-1", "ph-1", { label: "Ear canal" });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await act(async () => finish(described));
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
    await waitFor(() => expect(onState).toHaveBeenCalledWith(null));
  });

  it("Save stays open and says why when the save fails, and the edit is sent again", async () => {
    api.photoUrl.mockResolvedValue("blob:photo");
    api.updatePhoto.mockReset().mockRejectedValueOnce(new Error("Server busy")).mockResolvedValue(described);
    const onState = vi.fn();
    render(
      <PhotoDialog state={{ mode: "edit", photoId: "ph-1" }} onState={onState} e={described} setCurrent={() => {}} />,
    );
    await userEvent.type(await screen.findByLabelText("Label"), "s");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Not saved: Server busy")).toBeInTheDocument();
    expect(onState).not.toHaveBeenCalledWith(null);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onState).toHaveBeenCalledWith(null));
    expect(api.updatePhoto).toHaveBeenLastCalledWith("enc-1", "ph-1", { label: "Ears" });
  });
});

describe("photo autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends one save with every change made while the vet was still editing", async () => {
    api.updatePhoto.mockReset().mockResolvedValue(enc);
    const { result } = renderHook(() => usePhotoAutosave(enc, "ph-1", () => {}));
    act(() => {
      result.current.queue({ label: "Right ear" });
      result.current.queue({ rotation: 90 });
      result.current.queue({ label: "Right ear canal" });
    });
    expect(result.current.status).toBe("Saving");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(api.updatePhoto).toHaveBeenCalledTimes(1);
    expect(api.updatePhoto).toHaveBeenCalledWith("enc-1", "ph-1", { label: "Right ear canal", rotation: 90 });
    expect(result.current.status).toBe("Saved");
  });

  it("closing the edit view saves what was still waiting", async () => {
    api.updatePhoto.mockReset().mockResolvedValue(enc);
    const { result, unmount } = renderHook(() => usePhotoAutosave(enc, "ph-1", () => {}));
    act(() => result.current.queue({ show_owner: true }));
    unmount();
    await act(async () => {}); // the save goes out on the next tick, after any save already on its way
    expect(api.updatePhoto).toHaveBeenCalledWith("enc-1", "ph-1", { show_owner: true });
  });
});
