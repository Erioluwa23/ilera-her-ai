import {describe,it,expect} from 'vitest';import {answerQuestion,articles} from './knowledge';import {validateTranscript} from './natlas';
describe('education and provider boundary',()=>{
 it('labels curated answers honestly',()=>expect(answerQuestion('period cramps').mode).toBe('curated-education'));
 it('provides sources',()=>expect(answerQuestion('cramps').articles[0].source.url).toContain('nhs.uk'));
 it('raises a caution for urgent words',()=>expect(answerQuestion('I am fainting and bleeding').caution).toBe(true));
 it('abstains on unrelated topics',()=>expect(answerQuestion('capital of Finland').articles).toHaveLength(0));
 it('sources all articles',()=>expect(articles.every(a=>a.source.url.startsWith('https://'))).toBe(true));
 it('rejects mismatched transcript language',()=>expect(()=>validateTranscript({text:'test',language:'ig'},'yo')).toThrow());
 it('rejects empty transcripts',()=>expect(()=>validateTranscript({text:''},'en-NG')).toThrow());
});
