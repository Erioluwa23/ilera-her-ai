export type IlaraLanguage="en-NG"|"yo"|"ha"|"ig";
export type SpeechLanguage="english"|"yoruba"|"hausa"|"igbo";

export const LANGUAGE_OPTIONS=[
  {code:"en-NG" as const,label:"Nigerian English",short:"English"},
  {code:"yo" as const,label:"Yorùbá",short:"Yorùbá"},
  {code:"ha" as const,label:"Hausa",short:"Hausa"},
  {code:"ig" as const,label:"Igbo",short:"Igbo"}
];

export const NATLAS_ASR_MODELS:Record<IlaraLanguage,string>={
  "en-NG":"NCAIR1/NigerianAccentedEnglish",
  yo:"NCAIR1/Yoruba-ASR",
  ha:"NCAIR1/Hausa-ASR",
  ig:"NCAIR1/Igbo-ASR"
};

export const SPEECH_MODEL_REGISTRY:Record<SpeechLanguage,string>={
  english:"NCAIR1/NigerianAccentedEnglish",
  yoruba:"NCAIR1/Yoruba-ASR",
  hausa:"NCAIR1/Hausa-ASR",
  igbo:"NCAIR1/Igbo-ASR"
};

const LANGUAGE_ALIASES:Record<string,SpeechLanguage>={
  en:"english",
  "en-ng":"english",
  english:"english",
  "nigerian english":"english",
  yo:"yoruba",
  yor:"yoruba",
  yoruba:"yoruba",
  ha:"hausa",
  hau:"hausa",
  hausa:"hausa",
  ig:"igbo",
  ibo:"igbo",
  igbo:"igbo"
};

export function normalizeLanguage(value?:string|null):IlaraLanguage{
  if(value==="yo"||value==="ha"||value==="ig"||value==="en-NG")return value;
  const speech=normalizeSpeechLanguage(value);
  return speech==="yoruba"?"yo":speech==="hausa"?"ha":speech==="igbo"?"ig":"en-NG";
}

export function normalizeSpeechLanguage(value?:string|null):SpeechLanguage{
  const key=(value||"english").trim().toLowerCase();
  return LANGUAGE_ALIASES[key]||"english";
}

export function speechLanguageFromUi(code:IlaraLanguage):SpeechLanguage{
  return code==="yo"?"yoruba":code==="ha"?"hausa":code==="ig"?"igbo":"english";
}

export function languageName(code:IlaraLanguage){
  return LANGUAGE_OPTIONS.find(x=>x.code===code)?.label??"Nigerian English";
}
