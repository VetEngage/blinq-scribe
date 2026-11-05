// This computer's camera for exam photos. Like the mic, it belongs to one open capture view: closing
// it, leaving the visit or signing out stops every track, so the camera light never stays on.
// Every stream handed out is tracked until stopped, even one that arrives after the view that asked
// for it has gone, so no request can leave the camera running.
const streams = new Set<MediaStream>();

export async function startCamera(): Promise<MediaStream> {
  const s = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1920 } },
    audio: false,
  });
  streams.add(s);
  return s;
}

/** Stops one stream, or every camera stream when none is named. */
export function stopCamera(only?: MediaStream): void {
  for (const s of only ? [only] : [...streams]) {
    s.getTracks().forEach((tr) => tr.stop());
    streams.delete(s);
  }
}

export const cameraOn = (): boolean => streams.size > 0;

/** One still from the live view, as a JPEG file ready to upload. */
export async function grabFrame(video: HTMLVideoElement): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("The camera didn't give a picture. Try again.");
  return new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
}
