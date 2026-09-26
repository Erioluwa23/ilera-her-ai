import {createHash,randomBytes} from 'node:crypto';
const buckets=new Map<string,{count:number;until:number}>();
const salt=randomBytes(16).toString('hex');
export function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}});}
export function rateAllowed(key:string,limit=20,now=Date.now()):boolean {
 for(const [k,v] of buckets) if(v.until<=now) buckets.delete(k);
 const current=buckets.get(key);
 if(current){if(current.count>=limit)return false;current.count++;return true;}
 if(buckets.size>=5000)return false;
 buckets.set(key,{count:1,until:now+60_000});return true;
}
export function guard(req:Request,scope:string):Response|null {
 const origin=req.headers.get('origin');
 const expected=process.env.APP_ORIGIN||new URL(req.url).origin;
 if(origin && origin!==expected) return json({error:'This request must come from the application.'},403);
 const ip=req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
 const hash=createHash('sha256').update(salt+ip).digest('hex');
 // A global limit remains effective even if a client spoofs an IP header.
 if(!rateAllowed(scope+':global',120)||!rateAllowed(scope+':'+hash,scope==='voice'?5:20)) return json({error:'Too many requests. Please try again in a minute.'},429);
 return null;
}
export async function readBounded(req:Request,maxBytes:number):Promise<ArrayBuffer> {
 const declared=Number(req.headers.get('content-length')||0);
 if(declared>maxBytes)throw new Error('Request too large');
 if(!req.body)throw new Error('Empty request');
 const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Request too large');}chunks.push(value);}} finally {reader.releaseLock();}
 const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out.buffer;
}
