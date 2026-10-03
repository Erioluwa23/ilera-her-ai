import {describe,it,expect,vi,afterEach} from "vitest";
import {readAudioForm,validateAudio,MAX_AUDIO_BYTES} from "./asr-contract";
import {normalizeLanguage,normalizeSpeechLanguage} from "./languages";

export function wav(){
  const b=new Uint8Array(48);b.set(new TextEncoder().encode("RIFF"),0);b.set(new TextEncoder().encode("WAVE"),8);
  return new Blob([b],{type:"audio/wav"});
}
afterEach(()=>vi.restoreAllMocks());
describe("language aliases",()=>{
  it.each([
    ["en","en-NG","english"],["en-ng","en-NG","english"],["english","en-NG","english"],["nigerian english","en-NG","english"],
    ["yo","yo","yoruba"],["yor","yo","yoruba"],["yoruba","yo","yoruba"],
    ["ha","ha","hausa"],["hau","ha","hausa"],["hausa","ha","hausa"],
    ["ig","ig","igbo"],["ibo","ig","igbo"],["igbo","ig","igbo"]
  ])("normalizes %s",(alias,ui,speech)=>{expect(normalizeLanguage(alias)).toBe(ui);expect(normalizeSpeechLanguage(alias)).toBe(speech)});
  it.each(["xx","fr","en-US","whisper"," ",""])("rejects %s",value=>expect(()=>normalizeLanguage(value)).toThrow());
});
describe("bounded audio uploads",()=>{
  it("accepts recognized WAV bytes",async()=>expect(await validateAudio(wav())).toBeUndefined());
  it("rejects empty uploads",async()=>expect(validateAudio(new Blob([]))).rejects.toMatchObject({code:"AUDIO_EMPTY"}));
  it("rejects oversized payloads before reading bytes",async()=>{
    const file=new Blob([new Uint8Array(MAX_AUDIO_BYTES+1)]);const read=vi.spyOn(file,"arrayBuffer");
    await expect(validateAudio(file)).rejects.toMatchObject({status:413});expect(read).not.toHaveBeenCalled();
  });
  it("rejects false audio and unsupported types",async()=>{
    await expect(validateAudio(new Blob(["not speech"],{type:"audio/webm"}))).rejects.toMatchObject({status:415});
    await expect(validateAudio(new Blob([await wav().arrayBuffer()],{type:"text/plain"}))).rejects.toMatchObject({status:415});
    await expect(validateAudio(new Blob([await wav().arrayBuffer()],{type:"audio/ogg"}))).rejects.toMatchObject({status:415});
  });
  it("rejects malformed multipart",async()=>{
    await expect(readAudioForm(new Request("http://app",{method:"POST",body:"bad",headers:{"content-type":"multipart/form-data; boundary=test"}}))).rejects.toMatchObject({code:"UPLOAD_INVALID"});
  });
  it("bounds chunked uploads without content length",async()=>{
    const cancel=vi.fn();
    const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_AUDIO_BYTES+65537))},cancel});
    const req=new Request("http://app",{method:"POST",body,duplex:"half",headers:{"content-type":"multipart/form-data; boundary=a"}} as RequestInit);
    await expect(readAudioForm(req)).rejects.toMatchObject({status:413});expect(cancel).toHaveBeenCalled();
  });
});
