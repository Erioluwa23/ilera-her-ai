export function xmlEscape(input:string){
  return input.replace(/[<>&'"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]!));
}

export function twiml(body:string){
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,{
    headers:{"content-type":"text/xml; charset=utf-8","cache-control":"no-store"}
  });
}
