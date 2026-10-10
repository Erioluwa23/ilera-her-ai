import {describe,it,expect,vi,afterEach} from "vitest";
import {Client,handle_file,upload_files} from "@gradio/client";
import {parseAsrResponse,classifyAsrError,transcribeViaNatlasSpace,inspectNatlasSpace,generateViaNatlasSpace,synthesizeViaYarnSpace,verifiedAudioUrl} from "./natlas-space";
import {NatlasSpeechProvider} from "./natlas";
import {NATLAS_ASR_MODELS,speechLanguageFromUi,type IlaraLanguage} from "./languages";
function wav(){const b=new Uint8Array(48);b.set(new TextEncoder().encode("RIFF"));b.set(new TextEncoder().encode("WAVE"),8);return new Blob([b],{type:"audio/wav"})}

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals()});
const payload={text:"Hello",model:"NCAIR1/NigerianAccentedEnglish",language:"english",provider:"ileraher_zerogpu_asr"};
describe("structured provenance",()=>{
  it.each(Object.keys(NATLAS_ASR_MODELS) as IlaraLanguage[])("validates exact checkpoint for %s",language=>{
    expect(parseAsrResponse([JSON.stringify({...payload,model:NATLAS_ASR_MODELS[language],language:speechLanguageFromUi(language)})],language).model).toBe(NATLAS_ASR_MODELS[language]);
  });
  it.each(["plain text","{",{}, {...payload,model:undefined},{...payload,model:"openai/whisper"},{...payload,language:undefined},{...payload,language:"yoruba"},{...payload,provider:undefined},{...payload,text:" "},{...payload,text:15}])("rejects unverified responses",input=>expect(()=>parseAsrResponse(input,"en-NG")).toThrow());
  it.each([["401 unauthorized","ASR_AUTH"],["403 gated","ASR_AUTH"],["429 quota exceeded","ASR_QUOTA"],["Space building","ASR_STARTING"],["server error","ASR_UPSTREAM"]])("classifies %s",(error,code)=>expect(classifyAsrError(new Error(error)).code).toBe(code));
  it("classifies structured Gradio quota errors",()=>expect(classifyAsrError({message:"GPU quota exceeded"}).code).toBe("ASR_QUOTA"));
  it("never returns upstream secret-bearing errors",()=>expect(classifyAsrError(new Error("server error with secret-health-text")).message).not.toContain("secret-health-text"));
});
describe("Gradio byte upload and lifecycle",()=>{
  function client(events:unknown[]= [{type:"data",data:[payload]}]){
    const cancel=vi.fn().mockResolvedValue(undefined),close_stream=vi.fn();
    const submit=vi.fn((..._args:unknown[])=>Object.assign((async function*(){for(const event of events)yield event})(),{cancel,close_stream}));
    const close=vi.fn(),fetch=vi.fn();
    vi.spyOn(Client,"connect").mockResolvedValue({submit,close,fetch} as unknown as Client);
    return {submit,close,cancel,close_stream};
  }
  it("sends actual Blob bytes to the explicit endpoint",async()=>{
    const c=client();const audio=wav();
    await transcribeViaNatlasSpace(audio,"en-NG");
    expect(c.submit.mock.calls[0][0]).toBe("/transcribe");
    const inputs=c.submit.mock.calls[0][1] as unknown as unknown[];
    // The real installed SDK preserves Blob as an upload input.
    expect(inputs[0]).toBe(audio);expect(inputs[1]).toBe("english");
    expect(handle_file(audio)).toBe(audio);expect(c.close).toHaveBeenCalled();expect(c.close_stream).toHaveBeenCalled();
  });
  it("the installed SDK serializes actual bytes into its multipart upload",async()=>{
    const audio=wav();const send=vi.fn(async(_url:unknown,init:RequestInit)=>{
      const form=init.body as FormData;const file=form.get("files") as Blob;
      expect(file).toBeInstanceOf(Blob);expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(await audio.arrayBuffer()));
      return Response.json(["/tmp/gradio/upload.wav"]);
    });
    const context={fetch:send,options:{},api_prefix:"/gradio_api"} as unknown as Client;
    expect(await upload_files.call(context,"http://owned-runtime",[audio])).toEqual({files:["/tmp/gradio/upload.wav"]});
  });
  it("legacy IVR Blob callers use the same runtime",async()=>{
    const c=client();expect((await new NatlasSpeechProvider().transcribe(wav(),"en-NG")).model).toBe(payload.model);expect(c.submit).toHaveBeenCalled();
  });
  it("closes sessions on provenance failures",async()=>{
    const c=client([{type:"data",data:[{...payload,model:"wrong"}]}]);
    await expect(transcribeViaNatlasSpace(wav(),"en-NG")).rejects.toMatchObject({code:"ASR_PROVENANCE"});expect(c.close).toHaveBeenCalled();expect(c.close_stream).toHaveBeenCalled();
  });
  it("reports queued quota failures even when no data event arrives",async()=>{
    const close=vi.fn(),close_stream=vi.fn();
    // Match the installed SDK: it publishes status only when subscribed.
    vi.spyOn(Client,"connect").mockImplementation(async(_reference,options)=>({
      fetch:vi.fn(),close,
      submit:()=>Object.assign((async function*(){
        if(options?.events?.includes("status"))yield {type:"status",stage:"error",message:"ASR quota exhausted"};
      })(),{cancel:vi.fn().mockResolvedValue(undefined),close_stream}),
    }) as unknown as Client);
    await expect(transcribeViaNatlasSpace(wav(),"en-NG")).rejects.toMatchObject({code:"ASR_QUOTA",status:429});
    expect(close).toHaveBeenCalled();expect(close_stream).toHaveBeenCalled();
  });
  it("cancels the submitted job on client cancellation",async()=>{
    const abort=new AbortController();
    const cancel=vi.fn().mockResolvedValue(undefined),close_stream=vi.fn(),close=vi.fn();
    const job=Object.assign((async function*(){await new Promise(()=>{});yield {type:"data",data:[payload]}})(),{cancel,close_stream});
    vi.spyOn(Client,"connect").mockResolvedValue({submit:()=>job,close,fetch:vi.fn()} as unknown as Client);
    const pending=transcribeViaNatlasSpace(wav(),"en-NG",abort.signal);
    await new Promise(r=>setTimeout(r,10));abort.abort();
    await expect(pending).rejects.toMatchObject({code:"ASR_CANCELLED"});expect(cancel).toHaveBeenCalled();expect(close).toHaveBeenCalled();
  });
  it("bounds runtime startup waits",async()=>{
    vi.useFakeTimers();vi.spyOn(Client,"connect").mockImplementation(()=>new Promise(()=>{}));
    const pending=transcribeViaNatlasSpace(wav(),"en-NG");
    const assertion=expect(pending).rejects.toMatchObject({code:"ASR_TIMEOUT",status:504});
    await vi.advanceTimersByTimeAsync(90001);await assertion;
  });
  it("does not call a Static Space ready",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({sdk:"static",runtime:{stage:"RUNNING"}})));
    expect(await inspectNatlasSpace()).toMatchObject({sdk:"static",ready:false,reachable:false,inferenceTested:false});
  });
});

describe("answer and speech contracts",()=>{
  it("rejects external audio URLs and credentials",()=>{
    for(const url of ["https://evil.test/gradio_api/file=x","https://kolade1-ileraher-natlas-runtime.hf.space/other","https://user:pass@kolade1-ileraher-natlas-runtime.hf.space/gradio_api/file=x"]) expect(()=>verifiedAudioUrl(url)).toThrow();
  });
  it("uses the explicit answer endpoint and verifies N-ATLaS provenance",async()=>{
    const predict=vi.fn().mockResolvedValue({data:[JSON.stringify({text:"Answer",model:"NCAIR1/N-ATLaS",provider:"ileraher_zerogpu_llm",language:"yoruba"})]});
    const close=vi.fn(); vi.spyOn(Client,"connect").mockResolvedValue({predict,close,fetch:vi.fn()} as unknown as Client);
    expect((await generateViaNatlasSpace("Question",{facts:["Reviewed"]},"yo","System")).text).toBe("Answer");
    expect(predict).toHaveBeenCalledWith("/answer",["Question",'{"facts":["Reviewed"]}',"yoruba","System"]);expect(close).toHaveBeenCalled();
    predict.mockResolvedValue({data:[JSON.stringify({text:"Answer",model:"other",provider:"ileraher_zerogpu_llm",language:"yoruba"})]});
    await expect(generateViaNatlasSpace("Question",{},"yo","System")).rejects.toThrow();
  });
  it("downloads only verified WAV audio and closes the client",async()=>{
    const close=vi.fn();vi.spyOn(Client,"connect").mockResolvedValue({predict:vi.fn().mockResolvedValue({data:[{url:"https://kolade1-ileraher-natlas-runtime.hf.space/gradio_api/file=/tmp/reply.wav"},JSON.stringify({model:"saheedniyi/YarnGPT2b",provider:"ileraher_zerogpu_tts",language:"igbo"})]}),close,fetch:vi.fn()} as unknown as Client);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(Buffer.from("RIFFtestWAVEaudio"))));
    expect((await synthesizeViaYarnSpace("Hello","ig")).toString()).toBe("RIFFtestWAVEaudio");expect(close).toHaveBeenCalled();
  });
});
