"use client";
import {useMemo,useState} from "react";
import {assessSymptoms} from "@/lib/safety";
import {averageCycleLength,predictedNextPeriod} from "@/lib/cycle";

type Flow="spotting"|"light"|"medium"|"heavy";
type PeriodLog={id:string;startDate:string;endDate?:string;flow:Flow;pain:number;notes?:string};
const KEY="ileraher-periods-v2";

function load():PeriodLog[]{
  if(typeof window==="undefined")return[];
  try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}
}

export default function Tracker(){
  const [logs,setLogs]=useState<PeriodLog[]>(load);
  const [startDate,setStartDate]=useState(new Date().toISOString().slice(0,10));
  const [endDate,setEndDate]=useState("");
  const [flow,setFlow]=useState<Flow>("medium");
  const [pain,setPain]=useState(3);
  const [notes,setNotes]=useState("");

  const starts=useMemo(()=>logs.map(x=>x.startDate),[logs]);
  const safety=assessSymptoms({pain,heavyBleeding:flow==="heavy"});

  function persist(v:PeriodLog[]){
    const sorted=[...v].sort((a,b)=>b.startDate.localeCompare(a.startDate));
    setLogs(sorted);
    localStorage.setItem(KEY,JSON.stringify(sorted));
  }

  function save(){
    const entry:PeriodLog={
      id:crypto.randomUUID(),
      startDate,
      endDate:endDate||undefined,
      flow,
      pain,
      notes:notes.trim()||undefined
    };
    persist([...logs,entry]);
    setEndDate("");
    setNotes("");
  }

  function remove(id:string){persist(logs.filter(x=>x.id!==id))}

  return <section id="tracker" className="panel">
    <span className="eyebrow">My cycle</span>
    <h2>Save each period, not just one day</h2>
    <p className="muted">Add every period start as a separate record. You can keep multiple cycles, add an end date, and remove mistakes without deleting your whole history.</p>

    <div className="formgrid">
      <label>Period start<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
      <label>Period end (optional)<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
      <label>Typical flow<select value={flow} onChange={e=>setFlow(e.target.value as Flow)}><option>spotting</option><option>light</option><option>medium</option><option>heavy</option></select></label>
      <label>Pain: {pain}/10<input type="range" min="0" max="10" value={pain} onChange={e=>setPain(+e.target.value)}/></label>
      <label className="span2">Notes (optional)<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. cramps stronger than usual"/></label>
    </div>

    <div className={"risk "+safety.level}>{safety.message}</div>
    <button className="btn" onClick={save}>Save period</button>

    <div className="stats">
      <div><b>{averageCycleLength(starts)??"—"}</b><span>average cycle days</span></div>
      <div><b>{predictedNextPeriod(starts)??"—"}</b><span>estimated next period</span></div>
      <div><b>{logs.length}</b><span>saved periods</span></div>
    </div>

    {logs.length>0&&<div className="history">
      <h3>Period history</h3>
      {logs.map(x=><div className="historyrow" key={x.id}>
        <div>
          <strong>{x.startDate}{x.endDate?" → "+x.endDate:""}</strong>
          <span>{x.flow} flow · pain {x.pain}/10{x.notes?" · "+x.notes:""}</span>
        </div>
        <button className="textbtn" onClick={()=>remove(x.id)}>Remove</button>
      </div>)}
      <button className="textbtn danger" onClick={()=>{localStorage.removeItem(KEY);setLogs([])}}>Delete all local cycle data</button>
    </div>}
  </section>;
}