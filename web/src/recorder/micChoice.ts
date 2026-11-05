/** The microphone the provider picked for recording on this computer. Empty means the system default. */
const KEY = "blinq_mic";

export function readMic(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveMic(deviceId: string): void {
  try {
    if (deviceId) localStorage.setItem(KEY, deviceId);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private window): the choice lasts only until the page reloads.
  }
}

/** The audio constraints for the chosen mic, or the default device when none is chosen. */
export function micConstraints(deviceId = readMic()): MediaTrackConstraints {
  return deviceId ? { channelCount: 1, deviceId: { exact: deviceId } } : { channelCount: 1 };
}

/** Opens the chosen mic; if it's gone (unplugged), forgets it and opens the default one instead. */
export async function openMic(): Promise<MediaStream> {
  const chosen = readMic();
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: micConstraints(chosen) });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (!chosen || (name !== "OverconstrainedError" && name !== "NotFoundError")) throw err;
    saveMic("");
    return navigator.mediaDevices.getUserMedia({ audio: micConstraints("") });
  }
}
