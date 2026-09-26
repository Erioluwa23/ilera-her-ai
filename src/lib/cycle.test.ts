import {describe,it,expect} from 'vitest';
import {averageCycleLength,cycleDay,forecast,isDate,validateEntry,cycleIntervals} from './cycle';
describe('cycle engine',()=>{
 it('uses actual starts',()=>expect(averageCycleLength(['2026-06-01','2026-06-30','2026-07-29'])).toBe(29));
 it('requires two completed cycles',()=>expect(forecast(['2026-06-01','2026-06-30']).estimate).toBeNull());
 it('estimates a range',()=>expect(forecast(['2026-06-01','2026-06-30','2026-07-29'],'2026-08-01')).toMatchObject({estimate:'2026-08-27',earliest:'2026-08-25',latest:'2026-08-29'}));
 it('does not hide very long cycles',()=>{expect(cycleIntervals(['2026-01-01','2026-06-01'])).toEqual([151]);expect(forecast(['2026-01-01','2026-06-01','2026-07-01']).estimate).toBeNull();});
 it('deduplicates starts',()=>expect(averageCycleLength(['2026-06-01','2026-06-01','2026-06-30'])).toBe(29));
 it('supports pausing forecasts',()=>expect(forecast(['2026-06-01','2026-06-30','2026-07-29'],'2026-08-01',true).estimate).toBeNull());
 it('rejects rollover dates',()=>{expect(isDate('2026-02-30')).toBe(false);expect(isDate('2024-02-29')).toBe(true);});
 it('handles future starts',()=>expect(cycleDay('2099-01-01')).toBeNull());
 it('computes the cycle day',()=>expect(cycleDay('2026-09-01',new Date('2026-09-05T12:00:00Z'))).toBe(5));
 it('validates dates and flow',()=>expect(()=>validateEntry({date:'2099-01-01',flow:'heavy',pain:3,isPeriodStart:true,notes:''})).toThrow());
 it('does not treat spotting as a start',()=>expect(()=>validateEntry({date:'2026-01-01',flow:'spotting',pain:3,isPeriodStart:true,notes:''})).toThrow());
 it('rejects invalid pain',()=>expect(()=>validateEntry({date:'2026-01-01',flow:'light',pain:20,isPeriodStart:false,notes:''})).toThrow());
});
