import { PhoneError, MAX_CALL_AUDIO_BYTES } from "./phone-pilot";

// Actual duration/codec validation prevents compressed or oversized uploads from entering inference.
export function validatePhoneWav(audio: Buffer) {
  if (audio.length < 44 || audio.length > MAX_CALL_AUDIO_BYTES || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE" || audio.readUInt32LE(4) + 8 !== audio.length)
    throw new PhoneError(400, "Upload a valid phone WAV recording.");
  let offset = 12, rate = 0, block = 0, dataBytes = 0, haveFormat = false, haveData = false;
  while (offset + 8 <= audio.length) {
    const id = audio.toString("ascii", offset, offset + 4), size = audio.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + size > audio.length) throw new PhoneError(400, "Truncated phone recording.");
    if (id === "fmt ") {
      if (haveFormat || size < 16 || audio.readUInt16LE(offset) !== 1 || audio.readUInt16LE(offset + 2) !== 1 || audio.readUInt16LE(offset + 14) !== 16)
        throw new PhoneError(400, "Phone audio must be mono 16 bit PCM.");
      rate = audio.readUInt32LE(offset + 4); block = audio.readUInt16LE(offset + 12); haveFormat = true;
      if (![8000, 16000].includes(rate) || block !== 2 || audio.readUInt32LE(offset + 8) !== rate * block) throw new PhoneError(400, "Unsupported phone audio rate.");
    }
    if (id === "data") { if (haveData) throw new PhoneError(400, "Invalid phone recording."); dataBytes = size; haveData = true; }
    offset += size + size % 2;
  }
  if (!haveFormat || !haveData || !dataBytes || dataBytes % block || dataBytes / (rate * block) > 30 || offset !== audio.length)
    throw new PhoneError(400, "Record between a moment and 30 seconds of speech.");
}
