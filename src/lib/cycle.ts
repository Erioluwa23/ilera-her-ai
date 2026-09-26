export type Flow="spotting"|"light"|"medium"|"heavy";
export type CycleEntry={date:string;flow:Flow;pain:number;notes?:string};
const DAY=86_400_000;
export function averageCycleLength(starts:string[]){if(starts.length<2)return null;const d=starts.map(x=>new Date(x+"T00:00:00Z").getTime()).sort((a,b)=>a-b);const gaps=d.slice(1).map((x,i)=>(x-d[i])/DAY).filter(x=>x>=15&&x<=60);return gaps.length?Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length):null}
export function predictedNextPeriod(starts:string[]){const avg=averageCycleLength(starts);if(!avg||!starts.length)return null;const last=new Date([...starts].sort().at(-1)!+"T00:00:00Z");last.setUTCDate(last.getUTCDate()+avg);return last.toISOString().slice(0,10)}
export function cycleDay(lastStart:string,today=new Date()){const start=new Date(lastStart+"T00:00:00Z");return Math.max(1,Math.floor((Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate())-start.getTime())/DAY)+1)}