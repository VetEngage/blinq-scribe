import { api } from "../api";
import { useSession } from "../api/session";
import { endRecordingSession } from "../recorder/store";
import { stopCamera } from "../recorder/camera";
import { useApp } from "./app";
import { revokeAllBlobs } from "../lib/blobs";
import { stopSpeech } from "../lib/speak";
import { resetApollo } from "../api/apollo";
import { useChat } from "./chat";

/**
 * Nothing from the last person stays on screen or in memory for the next one at this computer. After a
 * timeout (`timedOutUser`), the recording waits for that same person to sign back in.
 */
export function endSession(timedOutUser = ""): void {
  endRecordingSession(timedOutUser);
  stopCamera();
  stopSpeech();
  useSession.getState().clear(); // bumps the epoch, so every pending answer is dropped
  useApp.getState().reset();
  useChat.getState().reset();
  revokeAllBlobs();
  resetApollo();
}

export async function signOut(): Promise<void> {
  await api.logout().catch(() => undefined);
  endSession();
}
