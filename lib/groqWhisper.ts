/**
 * Direct Groq Whisper Ingestion (Next.js Server)
 * Menggunakan model whisper-large-v3-turbo untuk transkripsi audio berkecepatan tinggi (< 1 detik).
 * Menghilangkan latensi double-hop jaringan ke Express service.
 */

export interface TranscribeOptions {
  language?: string;
  filename?: string;
  prompt?: string;
}

/**
 * Mentranskripsikan audio (Buffer, ArrayBuffer, atau Blob) secara langsung ke Groq Whisper API.
 * @param audioBuffer Buffer biner audio
 * @param options Opsi bahasa dan nama file
 * @returns Teks transkrip hasil ucapan
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer | ArrayBuffer | Blob,
  options: TranscribeOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY tidak ditemukan di environment Next.js");
  }

  // Guard audio hening / kosong (< 500 bytes)
  const byteLength =
    audioBuffer instanceof ArrayBuffer
      ? audioBuffer.byteLength
      : audioBuffer instanceof Blob
      ? audioBuffer.size
      : (audioBuffer as Buffer).length;

  if (!audioBuffer || byteLength < 500) {
    return "";
  }

  const filename = options.filename || "audio.webm";
  const language = options.language || "id";

  const form = new FormData();
  let blob: Blob;
  if (audioBuffer instanceof Blob) {
    blob = audioBuffer;
  } else if (audioBuffer instanceof ArrayBuffer) {
    blob = new Blob([audioBuffer], { type: "audio/webm" });
  } else {
    blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" });
  }

  form.append("file", blob, filename);
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", language);
  form.append("response_format", "json");
  if (options.prompt) {
    form.append("prompt", options.prompt);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout guard

  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        `Groq Whisper HTTP ${res.status}: ${errorData?.error?.message || res.statusText}`
      );
    }

    const data = await res.json();
    return (data?.text ?? "").trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error("Transkripsi Groq Whisper timeout (> 20 detik)");
    }
    throw err;
  }
}

