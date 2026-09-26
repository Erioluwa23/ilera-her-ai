import {describe,it,expect} from 'vitest';import {assessSymptoms} from './safety';
describe('conservative safety checklist',()=>{
 it('does not claim to rule out illness',()=>expect(assessSymptoms({pain:3}).message).toContain('cannot rule out'));
 it.each([{pain:3,fainting:true},{pain:4,heavyBleeding:true,severeWeakness:true},{pain:2,chestPain:true},{pain:9,suddenSeverePain:true},{pain:8,pregnancyPossible:true},{pain:1,pregnancyPossible:true,shoulderTipPain:true},{pain:3,breathlessness:true}])('escalates emergency flags %j',i=>expect(assessSymptoms(i).title).toBe('Seek emergency care now'));
 it('escalates pregnancy with mild pain',()=>expect(assessSymptoms({pain:2,pregnancyPossible:true}).level).toBe('urgent'));
 it('escalates pregnancy with bleeding',()=>expect(assessSymptoms({pain:0,pregnancyPossible:true,bleeding:true}).level).toBe('urgent'));
 it('flags severe pain for assessment',()=>expect(assessSymptoms({pain:9}).level).toBe('attention'));
 it('flags prolonged bleeding',()=>expect(assessSymptoms({pain:0,prolongedBleeding:true}).level).toBe('attention'));
 it('rejects invalid values',()=>expect(()=>assessSymptoms({pain:NaN})).toThrow());
});
