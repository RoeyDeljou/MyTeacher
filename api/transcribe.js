// Vercel Function: מעביר הקלטה ל-Whisper של Groq ומחזיר טקסט.
// לא שומר מפתח ולא שומר הקלטות. המפתח מגיע מהמשתמש בכותרת x-groq-key.
const MAX_BYTES = 4 * 1024 * 1024;
const MODELS = new Set(["whisper-large-v3", "whisper-large-v3-turbo"]);

export async function POST(request) {
  const key = request.headers.get("x-groq-key") || "";
  if (!key.startsWith("gsk_")) return json({ error: "missing_key" }, 401);

  const type = (request.headers.get("content-type") || "audio/webm").split(";")[0];
  if (!type.startsWith("audio/") && !type.startsWith("video/")) return json({ error: "bad_type" }, 415);

  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: "empty" }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "too_large" }, 413);

  const model = MODELS.has(request.headers.get("x-model")) ? request.headers.get("x-model") : "whisper-large-v3";
  const prompt = decodeURIComponent(request.headers.get("x-prompt") || "").slice(0, 600);
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : type.includes("mpeg") ? "mp3" : "webm";

  const form = new FormData();
  form.append("file", new Blob([buf], { type }), "answer." + ext);
  form.append("model", model);
  form.append("language", "he");
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (prompt) form.append("prompt", prompt);

  try {
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: form
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "groq_error", status: r.status, message: (data.error && data.error.message) || "" }, r.status);
    return json({ text: data.text || "" }, 200);
  } catch (e) {
    return json({ error: "upstream_unreachable" }, 502);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
