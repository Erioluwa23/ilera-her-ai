import {describe,it,expect} from 'vitest';import {rateAllowed,readBounded,guard} from './http';
describe('API guardrails',()=>{
 it('bounds requests without content-length',async()=>await expect(readBounded(new Request('https://test.local',{method:'POST',body:'abcdef'}),3)).rejects.toThrow());
 it('accepts small requests',async()=>expect(new TextDecoder().decode(await readBounded(new Request('https://test.local',{method:'POST',body:'abc'}),3))).toBe('abc'));
 it('applies and expires rate limits',()=>{expect(rateAllowed('test-limit',1,1000)).toBe(true);expect(rateAllowed('test-limit',1,1001)).toBe(false);expect(rateAllowed('test-limit',1,61001)).toBe(true);});
 it('rejects cross-origin requests',()=>expect(guard(new Request('https://app.test/api/ask',{headers:{origin:'https://evil.test'}}),'test')?.status).toBe(403));
});
