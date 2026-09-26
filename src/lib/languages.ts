export type IlaraLanguage="en-NG"|"yo"|"ha"|"ig";

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

export function normalizeLanguage(value?:string|null):IlaraLanguage{
  if(value==="yo"||value==="ha"||value==="ig"||value==="en-NG")return value;
  return "en-NG";
}

export function languageName(code:IlaraLanguage){
  return LANGUAGE_OPTIONS.find(x=>x.code===code)?.label??"Nigerian English";
}
