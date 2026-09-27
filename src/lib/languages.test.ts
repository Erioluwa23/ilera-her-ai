import {describe,expect,it} from "vitest";
import {NATLAS_ASR_MODELS,normalizeLanguage} from "./languages";

describe("N-ATLAS language routing",()=>{
  it("maps Nigerian English to its ASR model",()=>expect(NATLAS_ASR_MODELS["en-NG"]).toBe("NCAIR1/NigerianAccentedEnglish"));
  it("maps Yoruba to its ASR model",()=>expect(NATLAS_ASR_MODELS.yo).toBe("NCAIR1/Yoruba-ASR"));
  it("maps Hausa to its ASR model",()=>expect(NATLAS_ASR_MODELS.ha).toBe("NCAIR1/Hausa-ASR"));
  it("maps Igbo to its ASR model",()=>expect(NATLAS_ASR_MODELS.ig).toBe("NCAIR1/Igbo-ASR"));
  it("falls back safely to Nigerian English",()=>expect(normalizeLanguage("xx")).toBe("en-NG"));
});
