export type Flow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleEntry = {date:string; flow:Flow; pain:number; isPeriodStart:boolean; notes:string};
const DAY = 86_400_000;
export function isDate(value:unknown): value is string {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(value+'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10) === value;
}
export function localDate(now = new Date()):string {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function addDays(date:string, days:number):string {
  if(!isDate(date) || !Number.isInteger(days)) throw new Error('Invalid date');
  return new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
}
export function cycleIntervals(starts:string[]):number[] {
  const dates = [...new Set(starts.filter(isDate))].sort();
  return dates.slice(1).map((date,i)=>(Date.parse(date)-Date.parse(dates[i]))/DAY);
}
export function averageCycleLength(starts:string[]):number|null {
  const intervals = cycleIntervals(starts);
  return intervals.length ? Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length) : null;
}
export function cycleDay(lastStart:string,today = new Date()):number|null {
  if(!isDate(lastStart)) return null;
  const day = Math.round((Date.parse(localDate(today))-Date.parse(lastStart))/DAY)+1;
  return day > 0 ? day : null;
}
export function forecast(starts:string[],today=localDate(),paused=false) {
  const dates = [...new Set(starts.filter(d=>isDate(d)&&d<=today))].sort().slice(-7);
  const intervals = cycleIntervals(dates);
  if(paused) return {estimate:null,earliest:null,latest:null,reason:'Forecast paused for your current circumstances.'};
  if(intervals.length<2) return {estimate:null,earliest:null,latest:null,reason:'Log at least three confirmed period starts (two complete cycles). Daily flow logs do not count as new starts.'};
  // These are conservative PRODUCT guardrails, not clinical normality thresholds.
  // Keep every interval visible; do not silently discard unusual cycles.
  if(intervals.some(d=>d<15||d>60) || Math.max(...intervals)-Math.min(...intervals)>10) return {estimate:null,earliest:null,latest:null,reason:'Your recorded starts vary too much for this simple forecast. Review your dates and discuss persistent changes with a clinician.'};
  const median = [...intervals].sort((a,b)=>a-b)[Math.floor(intervals.length/2)];
  const last=dates[dates.length-1];
  const estimate=addDays(last,median);
  return {estimate,earliest:addDays(last,Math.min(...intervals)-2),latest:addDays(last,Math.max(...intervals)+2),reason:estimate<today?'The estimate is in the past. It is not a diagnosis or pregnancy test.':'Approximate planning window, not a calibrated confidence interval. Not for contraception or fertility decisions.'};
}
export function predictedNextPeriod(starts:string[]):string|null {return forecast(starts).estimate;}
export function validateEntry(value:unknown,today=localDate()):CycleEntry {
  if(!value || typeof value!=='object') throw new Error('Invalid entry');
  const v=value as Record<string,unknown>;
  if(!isDate(v.date) || v.date>today || v.date<'2000-01-01') throw new Error('Choose a real date from 2000 through today.');
  if(!['none','spotting','light','medium','heavy'].includes(String(v.flow))) throw new Error('Choose a flow level.');
  if(typeof v.pain!=='number'||!Number.isInteger(v.pain)||v.pain<0||v.pain>10) throw new Error('Pain must be a whole number from 0 to 10.');
  if(typeof v.isPeriodStart!=='boolean') throw new Error('Confirm whether this is a new period start.');
  if(v.isPeriodStart && ['none','spotting'].includes(String(v.flow))) throw new Error('A period start requires menstrual flow, not only spotting.');
  if(typeof v.notes!=='string'||v.notes.length>500) throw new Error('Notes must be 500 characters or fewer.');
  return {date:v.date,flow:v.flow as Flow,pain:v.pain,isPeriodStart:v.isPeriodStart,notes:v.notes};
}
