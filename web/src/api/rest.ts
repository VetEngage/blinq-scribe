// REST calls. After the move to GraphQL these stay only for what GraphQL does not carry:
// audio chunk uploads, photo and document uploads, file downloads and health.
import { blobUrl, q, request } from "./http";
import type { Encounter, Health, OutsideDoc } from "./types";

export const rest = {
  health: () => request<Health>("/health", { anonymous: true }),

  /** The owner agreed to recording: saved with the visit before any audio is kept. */
  recordConsent: (encounterId: string) =>
    request<Encounter>(`/api/encounters/${q(encounterId)}/consent`, { method: "POST", body: {} }),

  uploadAudio(encounterId: string, wav: Blob, index: number): Promise<Encounter> {
    const fd = new FormData();
    fd.append("file", wav, `chunk${index}.wav`);
    fd.append("chunk_index", String(index));
    return request<Encounter>(`/api/encounters/${q(encounterId)}/audio`, { body: fd });
  },
  uploadPhoto(encounterId: string, file: File, hint: string): Promise<Encounter> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("hint", hint);
    return request<Encounter>(`/api/encounters/${q(encounterId)}/photos`, { body: fd });
  },
  uploadDocument(patientId: string, file: File): Promise<OutsideDoc> {
    const fd = new FormData();
    fd.append("file", file);
    return request<OutsideDoc>(`/api/patients/${q(patientId)}/documents`, { body: fd });
  },

  /** Press to talk: 503 when the server has no speech model (the browser listens instead). */
  listen(clip: Blob): Promise<{ text: string; via: "model" | "mock" }> {
    const fd = new FormData();
    fd.append("file", clip, "question.wav");
    return request<{ text: string; via: "model" | "mock" }>("/api/speech/listen", { body: fd });
  },

  photoUrl: (encounterId: string, photoId: string) => blobUrl(`/api/encounters/${q(encounterId)}/photos/${q(photoId)}`),
  documentUrl: (patientId: string, docId: string) =>
    blobUrl(`/api/patients/${q(patientId)}/documents/${q(docId)}/file`),
  letterPdfUrl: (id: string) => blobUrl(`/api/letters/${q(id)}.pdf`),
  summaryPdfUrl: (encounterId: string, lang: string) =>
    blobUrl(`/api/encounters/${q(encounterId)}/summary.pdf?lang=${q(lang)}`),
};
