import {describe,expect,it} from "vitest";
import {answerQuestion,classifyQuestion} from "./knowledge";

describe("grounded menstrual-health answers",()=>{
  it("answers fertility-awareness questions directly",()=>{
    expect(classifyQuestion("How do I count my safe days?")).toBe("fertility-awareness");
    const result=answerQuestion("How do I count my safe days?");
    expect(result.answer).toContain("days 8–19");
    expect(result.sources[0]?.organization).toContain("ACOG");
  });

  it("never presents a possible cause as a confirmed diagnosis",()=>{
    const result=answerQuestion("Why are my periods irregular?");
    expect(result.possibleCauses.length).toBeGreaterThan(0);
    expect(result.disclaimer.toLowerCase()).toContain("not a confirmed medical diagnosis");
  });

  it("escalates alarming heavy bleeding language",()=>{
    const result=answerQuestion("I am soaking a pad every hour and feel weak");
    expect(result.urgency).toBe("urgent");
  });
});
