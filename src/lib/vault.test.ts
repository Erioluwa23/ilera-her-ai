import {describe,it,expect} from 'vitest';import {emptyJournal,newVault,seal,unlock,parseEnvelope,validateJournal} from './vault';
describe('encrypted journal',()=>{
 it('round trips with no plaintext storage',async()=>{const v=await newVault('a long test passphrase');const journal=emptyJournal();journal.entries.push({date:'2026-01-01',flow:'medium',pain:3,isPeriodStart:true,notes:'sensitive-test-note'});const text=await seal(journal,v.key,v.salt);expect(text).not.toContain('sensitive-test-note');expect((await unlock(text,'a long test passphrase')).journal).toEqual(journal);});
 it('rejects an incorrect passphrase',async()=>{const v=await newVault('a long test passphrase');const text=await seal(emptyJournal(),v.key,v.salt);await expect(unlock(text,'incorrect password')).rejects.toThrow('Could not unlock');});
 it('uses a fresh IV on every write',async()=>{const v=await newVault('another test passphrase');const a=await seal(emptyJournal(),v.key,v.salt);const b=await seal(emptyJournal(),v.key,v.salt);expect(parseEnvelope(a).iv).not.toBe(parseEnvelope(b).iv);});
 it('rejects malformed backups',()=>expect(()=>parseEnvelope('{}')).toThrow());
 it('rejects invalid journals',()=>expect(()=>validateJournal({version:2,entries:'not-an-array',paused:false})).toThrow());
 it('rejects weak passphrases',async()=>await expect(newVault('short')).rejects.toThrow());
});
