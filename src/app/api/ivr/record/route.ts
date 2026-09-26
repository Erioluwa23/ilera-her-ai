import {twiml} from "@/lib/ivr";
import {IlaraLanguage} from "@/lib/languages";

const digitLanguage:Record<string,IlaraLanguage>={"1":"en-NG","2":"yo","3":"ha","4":"ig"};

export async function POST(req:Request){
  const form=await req.formData();
  const language=digitLanguage[String(form.get("Digits")||"1")]||"en-NG";
  const origin=new URL(req.url).origin;
  const prompts:Record<IlaraLanguage,string>={
    "en-NG":"After the beep, describe your menstrual health question or symptom. Press the hash key when you finish.",
    yo:"Lẹ́yìn ìró náà, sọ ìbéèrè tàbí àmì àìsàn rẹ nípa ìlera oṣù. Tẹ́ àmì hash nígbà tí o bá parí.",
    ha:"Bayan karar, bayyana tambayarka ko alamarka game da lafiyar al'ada. Danna alamar hash idan ka gama.",
    ig:"Mgbe ụda ahụ gasịrị, kwuo ajụjụ ma ọ bụ mgbaàmà gị gbasara ahụike ịhụ nsọ. Pịa hash mgbe ị mechara."
  };
  return twiml(
    `<Say>${prompts[language]}</Say>
     <Record action="${origin}/api/ivr/process?language=${encodeURIComponent(language)}" method="POST" maxLength="45" finishOnKey="#" playBeep="true" trim="trim-silence"/>
     <Say>We did not receive a recording. Please try again.</Say>
     <Redirect method="POST">${origin}/api/ivr/incoming</Redirect>`
  );
}

export const GET=POST;
