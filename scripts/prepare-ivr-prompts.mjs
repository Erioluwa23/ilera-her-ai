// Generate public menu recordings once. Secrets are supplied by the operator's
// trusted environment. No phone numbers, PINs or health questions are used here.
import { Client } from "@gradio/client";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = JSON.parse(await readFile(resolve(root, "src/lib/ivr-prompt-scripts.json"), "utf8"));
const args = process.argv.slice(2);
const languages = (args.find((v) => v.startsWith("--languages="))?.slice(12) || "en-NG,yo,ha,ig").split(",");
if (languages.some((v) => !Object.hasOwn(scripts, v))) throw new Error("Choose only en-NG,yo,ha,ig.");
// Entry menus always use English, even in a single native-language pilot.
if (!languages.includes("en-NG")) languages.unshift("en-NG");
const selected = args.find((v) => v.startsWith("--only="))?.slice(7);
const output = resolve(args.find((v) => v.startsWith("--output="))?.slice(9) || resolve(root, "public/audio/ivr"));
const model = "saheedniyi/YarnGPT2b";
const provider = "ileraher_zerogpu_tts";
const names = { "en-NG": "english", yo: "yoruba", ha: "hausa", ig: "igbo" };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const entries = languages.flatMap((language) => Object.entries(scripts[language]).map(([name, text]) => ({ language, name, text })));
if (selected && !entries.some(({ language, name }) => `${language}/${name}` === selected))
  throw new Error("Unknown --only prompt.");
await mkdir(output, { recursive: true });
let manifest = { version: 1, model, provider, files: {} };
try {
  const old = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8"));
  if (old.version === 1 && old.model === model && old.provider === provider && old.files) manifest = old;
} catch { /* Start a new pack. */ }
const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_TOKEN;
const direct = args.includes("--direct-runtime");
if (direct && !token) throw new Error("Supply the existing Hugging Face token securely for direct runtime access.");
// The deployed audio route already verifies the fixed runtime's provenance and
// keeps its token private. Preparing public controls does not need another key.
const app = new URL(args.find((v) => v.startsWith("--app-url="))?.slice(10) || "https://ilera-her-ai.onrender.com");
if (app.protocol !== "https:" || app.username || app.password || app.search || app.hash || app.pathname !== "/")
  throw new Error("Use the application's exact HTTPS origin.");
const client = direct ? await Client.connect("Kolade1/ileraHer-natlas-runtime", { hf_token: token }) : null;
const object = (value) => typeof value === "string" ? JSON.parse(value) : value;
try {
  for (const { language, name, text } of entries) {
    if (selected && `${language}/${name}` !== selected) continue;
    const path = `${language}/${name}.wav`, scriptHash = hash(text);
    try {
      const audio = await readFile(resolve(output, path));
      const old = manifest.files[path];
      if (old?.scriptHash === scriptHash && old.sha256 === hash(audio) && old.bytes === audio.length &&
          audio.length >= 44 && audio.toString("ascii", 0, 4) === "RIFF" && audio.toString("ascii", 8, 12) === "WAVE") {
        console.log(`Already prepared: ${path}`); continue;
      }
    } catch { /* Generate this missing or changed prompt. */ }
    let response;
    if (client) {
      const result = await client.predict("/synthesize", [text, names[language]]);
      const [file, provenance] = result.data.map(object);
      if (provenance?.model !== model || provenance.provider !== provider || provenance.language !== names[language])
        throw new Error(`Unverified model for ${path}.`);
      const url = new URL(file.url);
      if (url.origin !== "https://kolade1-ileraher-natlas-runtime.hf.space" || url.username || url.password || !url.pathname.startsWith("/gradio_api/file="))
        throw new Error("Untrusted prompt download location.");
      response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}` } });
    } else {
      response = await fetch(new URL("/api/voice/audio", app), {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(120000),
        headers: { "content-type": "application/json", origin: app.origin },
        body: JSON.stringify({ text, language }),
      });
      if (response.status === 429) {
        try {
          const error = await response.json();
          if (typeof error.retryAt === "string" && Number.isFinite(Date.parse(error.retryAt)))
            console.error(`Speech quota exhausted; retry at ${new Date(error.retryAt).toISOString()}.`);
        } catch { /* Do not print private upstream error payloads. */ }
        throw new Error("Speech quota exhausted.");
      }
      if (response.headers.get("x-speech-model") !== model || response.headers.get("x-speech-language") !== language ||
          response.headers.get("content-type")?.split(";")[0] !== "audio/wav")
        throw new Error(`Unverified application audio for ${path}.`);
    }
    if (!response.ok || !response.body) throw new Error(`Prompt download failed: ${path}`);
    const chunks = [], reader = response.body.getReader();
    let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("Prompt audio too large."); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const audio = Buffer.concat(chunks);
    if (audio.length < 44 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE")
      throw new Error(`Invalid WAV: ${path}`);
    await mkdir(dirname(resolve(output, path)), { recursive: true });
    await writeFile(resolve(output, path), audio);
    manifest.files[path] = { sha256: hash(audio), scriptHash, bytes: audio.length, contentType: "audio/wav" };
    await writeFile(resolve(output, "manifest.json.tmp"), JSON.stringify(manifest, null, 2) + "\n");
    await rename(resolve(output, "manifest.json.tmp"), resolve(output, "manifest.json"));
    console.log(`Prepared YarnGPT prompt: ${path}`);
  }
} catch {
  console.error("Prompt preparation stopped. Completed recordings are saved; resume after the speech service is available. No fallback voice was generated.");
  process.exitCode = 1;
} finally { client?.close(); }
