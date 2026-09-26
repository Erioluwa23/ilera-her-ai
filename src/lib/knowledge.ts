export type Urgency="routine"|"attention"|"urgent";
export type HealthSource={title:string;organization:string;url:string};
export type HealthAnswer={
  topic:string;
  answer:string;
  possibleCauses:string[];
  nextSteps:string[];
  urgency:Urgency;
  disclaimer:string;
  sources:HealthSource[];
  model:"curated"|"n-atlas";
};

const ACOG_FERTILITY:HealthSource={
  title:"Fertility Awareness-Based Methods of Family Planning",
  organization:"American College of Obstetricians and Gynecologists (ACOG)",
  url:"https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning"
};
const MEDLINE_MENSTRUATION:HealthSource={
  title:"Menstruation",
  organization:"MedlinePlus, U.S. National Library of Medicine",
  url:"https://medlineplus.gov/menstruation.html"
};
const MEDLINE_PAIN:HealthSource={
  title:"Period Pain",
  organization:"MedlinePlus, U.S. National Library of Medicine",
  url:"https://medlineplus.gov/periodpain.html"
};
const MEDLINE_BLEEDING:HealthSource={
  title:"Vaginal or uterine bleeding",
  organization:"MedlinePlus, U.S. National Library of Medicine",
  url:"https://medlineplus.gov/ency/article/007496.htm"
};
const NHS_IRREGULAR:HealthSource={
  title:"Irregular periods",
  organization:"NHS",
  url:"https://www.nhs.uk/symptoms/irregular-periods/"
};

const DISCLAIMER="This is an educational health assessment, not a confirmed medical diagnosis. A qualified healthcare professional should confirm any suspected condition, especially if symptoms are severe, persistent, new, or worsening.";

function base(topic:string,answer:string,possibleCauses:string[],nextSteps:string[],urgency:Urgency,sources:HealthSource[]):HealthAnswer{
  return{topic,answer,possibleCauses,nextSteps,urgency,disclaimer:DISCLAIMER,sources,model:"curated"};
}

export function classifyQuestion(q:string){
  const x=q.toLowerCase();
  if(/safe day|fertil|ovulat|pregnan|conceiv|avoid pregnancy|birth control/.test(x))return"fertility-awareness";
  if(/cramp|period pain|painful period|dysmenorr/.test(x))return"cramps";
  if(/heavy|bleed|blood|clot|soak|flood|pad every hour|tampon every hour/.test(x))return"heavy-bleeding";
  if(/irregular|late|missed|cycle|amenorr/.test(x))return"irregular";
  if(/pad|hygiene|clean|tampon|cup/.test(x))return"hygiene";
  if(/first period|first menstru|menarche/.test(x))return"first-period";
  return"unknown";
}

export function answerQuestion(q:string):HealthAnswer{
  const topic=classifyQuestion(q);
  if(topic==="fertility-awareness")return base(
    topic,
    "There is no completely “safe” day if you are trying to avoid pregnancy. Count cycle day 1 as the first day of menstrual bleeding. If your cycles are consistently 26–32 days long, the Standard Days Method treats days 8–19 as the fertile days, so use a barrier method or avoid vaginal intercourse on those days. Ovulation can shift, and sperm can survive for several days, so calendar estimates can fail—especially with irregular cycles.",
    [],
    ["Track the first day of each period for several cycles.","If cycles are not consistently 26–32 days, do not rely on the Standard Days Method alone.","Use condoms or another reliable contraceptive if avoiding pregnancy; fertility-awareness methods do not protect against STIs."],
    "routine",
    [ACOG_FERTILITY]
  );
  if(topic==="cramps")return base(
    topic,
    "Period cramps are common, but severe, new, progressively worsening, or disabling pain deserves medical assessment.",
    ["Primary dysmenorrhea (period pain without another condition) is common.","Secondary causes such as endometriosis or uterine fibroids are possibilities when pain begins later, worsens over time, or occurs outside the period."],
    ["Use heat and gentle activity if comfortable.","Seek clinical assessment if pain is severe, worsening, occurs outside menstruation, or repeatedly disrupts normal activities."],
    /faint|collapse|unbearable|10\/10|9\/10/.test(q.toLowerCase())?"urgent":"attention",
    [MEDLINE_PAIN]
  );
  if(topic==="heavy-bleeding")return base(
    topic,
    "Bleeding that is much heavier than your usual pattern, lasts unusually long, or causes weakness or light-headedness should be medically assessed.",
    ["Hormonal or ovulation-related changes can cause abnormal uterine bleeding.","Fibroids, thyroid problems, pregnancy-related causes, infection, and other gynecologic conditions can also cause abnormal bleeding and require evaluation."],
    ["Track pad/tampon changes, clots, duration, dizziness and weakness.","Seek urgent care if you are soaking through a pad or tampon about every hour for 2–3 hours, feel faint/very weak, or could be pregnant."],
    /faint|dizz|weak|soak|hour|pregnan/.test(q.toLowerCase())?"urgent":"attention",
    [MEDLINE_BLEEDING]
  );
  if(topic==="irregular")return base(
    topic,
    "Irregular or missed periods can happen for many reasons. A pregnancy test is appropriate when pregnancy is possible, and persistent changes should be discussed with a healthcare professional.",
    ["Pregnancy is a common cause of a missed period.","Stress, major weight change, intense exercise, hormonal contraception, thyroid problems, and polycystic ovary syndrome are among possible causes."],
    ["Track cycle start dates and associated symptoms.","Take a pregnancy test if pregnancy is possible.","Arrange clinical review if irregularity persists, bleeding occurs between periods, or you have other concerning symptoms."],
    "attention",
    [NHS_IRREGULAR,MEDLINE_MENSTRUATION]
  );
  if(topic==="hygiene")return base(
    topic,
    "Use clean menstrual products, change or clean them regularly according to product instructions, and wash your hands before and after handling them.",
    [],
    ["Choose pads, tampons, cups, or period underwear that are comfortable and appropriate for you.","Seek medical advice for fever, severe pain, unusual discharge, or other concerning symptoms."],
    "routine",
    [MEDLINE_MENSTRUATION]
  );
  if(topic==="first-period")return base(
    topic,
    "A first period is a normal part of puberty. Early cycles can be irregular while the body settles into a pattern.",
    [],
    ["Keep a simple record of bleeding dates and symptoms.","Ask a trusted adult or healthcare professional for help with products, severe pain, very heavy bleeding, or anything worrying."],
    "routine",
    [MEDLINE_MENSTRUATION]
  );
  return base(
    "unknown",
    "Tell me the specific menstrual-health question or symptom you want help with. I can directly answer questions about cycle timing, fertility awareness, cramps, heavy bleeding, missed or irregular periods, hygiene, and first periods.",
    [],
    ["If you have severe pain, fainting, very heavy bleeding, or pregnancy with bleeding/pain, seek prompt in-person medical care."],
    "routine",
    [MEDLINE_MENSTRUATION]
  );
}

export function evidenceFor(answer:HealthAnswer){
  return {
    verifiedAnswer:answer.answer,
    possibleCauses:answer.possibleCauses,
    nextSteps:answer.nextSteps,
    urgency:answer.urgency,
    sources:answer.sources
  };
}
