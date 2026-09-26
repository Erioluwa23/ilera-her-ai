import {validateEntry,type CycleEntry} from './cycle';
export const VAULT_KEY='ileraher-v2-vault';
export type Journal={version:2;entries:CycleEntry[];paused:boolean};
export type Envelope={version:2;kdf:'PBKDF2-SHA256';iterations:600000;salt:string;iv:string;ciphertext:string};
export const emptyJournal=():Journal=>({version:2,entries:[],paused:false});
function encode(bytes:Uint8Array):string {let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function decode(s:string):Uint8Array<ArrayBuffer> {return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
export function validateJournal(value:unknown):Journal {
 if(!value||typeof value!=='object')throw new Error('Invalid journal');
 const v=value as Record<string,unknown>;
 if(v.version!==2||typeof v.paused!=='boolean'||!Array.isArray(v.entries)||v.entries.length>3660)throw new Error('Unsupported journal');
 const entries=v.entries.map(e=>validateEntry(e));
 if(new Set(entries.map(e=>e.date)).size!==entries.length)throw new Error('Duplicate journal dates');
 return {version:2,paused:v.paused,entries};
}
export function parseEnvelope(text:string):Envelope {
 if(text.length>4_000_000)throw new Error('Backup too large');
 const v=JSON.parse(text) as Partial<Envelope>;
 if(v.version!==2||v.kdf!=='PBKDF2-SHA256'||v.iterations!==600000||typeof v.salt!=='string'||typeof v.iv!=='string'||typeof v.ciphertext!=='string')throw new Error('Unsupported encrypted backup');
 if(decode(v.salt).length!==16||decode(v.iv).length!==12||decode(v.ciphertext).length<16)throw new Error('Invalid encrypted backup');
 return v as Envelope;
}
export async function deriveKey(passphrase:string,salt:Uint8Array<ArrayBuffer>):Promise<CryptoKey> {
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function newVault(passphrase:string) {
 if(passphrase.length<12)throw new Error('Use at least 12 characters for your passphrase.');
 const salt=crypto.getRandomValues(new Uint8Array(16));
 return {key:await deriveKey(passphrase,salt),salt:encode(salt)};
}
export async function seal(journal:Journal,key:CryptoKey,salt:string):Promise<string> {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(validateJournal(journal))));
 const envelope:Envelope={version:2,kdf:'PBKDF2-SHA256',iterations:600000,salt,iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};
 return JSON.stringify(envelope);
}
export async function unlock(text:string,passphrase:string) {
 try {
  const envelope=parseEnvelope(text);const key=await deriveKey(passphrase,decode(envelope.salt));
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv)},key,decode(envelope.ciphertext));
  return {journal:validateJournal(JSON.parse(new TextDecoder().decode(bytes))),key,salt:envelope.salt};
 } catch {throw new Error('Could not unlock. Check your passphrase and backup file.');}
}
export function clearDeviceData() {
 for(const key of [VAULT_KEY,'ileraher-cycle-v1','ileraher-consent-v1'])localStorage.removeItem(key);
}
