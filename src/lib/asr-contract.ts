export const MAX_AUDIO_BYTES=25*1024*1024;
export class AsrError extends Error{
  constructor(public code:string,public status:number,message:string){super(message)}
}

const AUDIO_TYPES=new Set(["audio/wav","audio/x-wav","audio/wave","audio/mpeg","audio/mp3","audio/ogg","audio/webm","video/webm","audio/mp4","audio/x-m4a","audio/aac","audio/flac","audio/x-flac"]);
export async function validateAudio(audio:Blob){
  if(!audio.size)throw new AsrError("AUDIO_EMPTY",400,"Audio must not be empty.");
  if(audio.size>MAX_AUDIO_BYTES)throw new AsrError("AUDIO_TOO_LARGE",413,"Audio exceeds the 25 MB limit.");
  const type=audio.type.split(";")[0].toLowerCase();
  if(type&&!AUDIO_TYPES.has(type)&&type!=="application/octet-stream")throw new AsrError("AUDIO_FORMAT",415,"Unsupported audio format.");
  const b=new Uint8Array(await audio.slice(0,16).arrayBuffer());
  const text=new TextDecoder().decode(b);
  const format=text.startsWith("RIFF")&&text.slice(8,12)==="WAVE"?"wav":text.startsWith("OggS")?"ogg":text.startsWith("fLaC")?"flac":b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3?"webm":text.slice(4,8)==="ftyp"?"mp4":text.startsWith("ID3")||b[0]===0xff&&(b[1]&0xe0)===0xe0?"mpeg":null;
  if(!format)throw new AsrError("AUDIO_FORMAT",415,"Audio container is invalid or unsupported.");
  if(type&&type!=="application/octet-stream"){
    const allowed:Record<string,string[]>={wav:["audio/wav","audio/x-wav","audio/wave"],ogg:["audio/ogg"],flac:["audio/flac","audio/x-flac"],webm:["audio/webm","video/webm"],mp4:["audio/mp4","audio/x-m4a"],mpeg:["audio/mpeg","audio/mp3","audio/aac"]};
    if(!allowed[format].includes(type))throw new AsrError("AUDIO_FORMAT",415,"Audio type does not match its container.");
  }
}

// Bound the streamed multipart body before formData() allocates it. Allow a
// small envelope above the audio limit; oversized chunks are never retained.
export async function readAudioForm(req:Request):Promise<FormData>{
  const limit=MAX_AUDIO_BYTES+64*1024;
  const type=req.headers.get("content-type")||"";
  if(!type.toLowerCase().startsWith("multipart/form-data;"))throw new AsrError("UPLOAD_INVALID",400,"Use a multipart audio upload.");
  if(Number(req.headers.get("content-length"))>limit)throw new AsrError("AUDIO_TOO_LARGE",413,"Upload exceeds the size limit.");
  if(!req.body)throw new AsrError("UPLOAD_INVALID",400,"Audio is required.");
  const reader=req.body.getReader();
  const deadline=AbortSignal.timeout(30000);
  let total=0;
  const chunks:Uint8Array<ArrayBuffer>[]=[];
  const cancel=()=>{void reader.cancel().catch(()=>{})};
  deadline.addEventListener("abort",cancel,{once:true});req.signal.addEventListener("abort",cancel,{once:true});
  try{
    while(true){
      if(req.signal.aborted)throw new AsrError("ASR_CANCELLED",499,"Upload cancelled.");
      if(deadline.aborted)throw new AsrError("UPLOAD_TIMEOUT",408,"Upload timed out.");
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>limit){await reader.cancel();throw new AsrError("AUDIO_TOO_LARGE",413,"Upload exceeds the size limit.")}
      chunks.push(new Uint8Array(value));
    }
    if(deadline.aborted)throw new AsrError("UPLOAD_TIMEOUT",408,"Upload timed out.");
    if(req.signal.aborted)throw new AsrError("ASR_CANCELLED",499,"Upload cancelled.");
    try{return await new Response(new Blob(chunks),{headers:{"content-type":type}}).formData()}catch{throw new AsrError("UPLOAD_INVALID",400,"Malformed multipart upload.")}
  }finally{deadline.removeEventListener("abort",cancel);req.signal.removeEventListener("abort",cancel);reader.releaseLock()}
}
