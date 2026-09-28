export type Urgency="routine"|"attention"|"urgent";
export type KnowledgeLanguage="en-NG"|"yo"|"ha"|"ig";
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

const ACOG_FERTILITY:HealthSource={title:"Fertility Awareness-Based Methods of Family Planning",organization:"American College of Obstetricians and Gynecologists (ACOG)",url:"https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning"};
const MEDLINE_MENSTRUATION:HealthSource={title:"Menstruation",organization:"MedlinePlus, U.S. National Library of Medicine",url:"https://medlineplus.gov/menstruation.html"};
const MEDLINE_PAIN:HealthSource={title:"Period Pain",organization:"MedlinePlus, U.S. National Library of Medicine",url:"https://medlineplus.gov/periodpain.html"};
const MEDLINE_BLEEDING:HealthSource={title:"Vaginal or uterine bleeding",organization:"MedlinePlus, U.S. National Library of Medicine",url:"https://medlineplus.gov/ency/article/007496.htm"};
const NHS_IRREGULAR:HealthSource={title:"Irregular periods",organization:"NHS",url:"https://www.nhs.uk/symptoms/irregular-periods/"};

const DISCLAIMER="This is an educational health assessment, not a confirmed medical diagnosis. A qualified healthcare professional should confirm any suspected condition, especially if symptoms are severe, persistent, new, or worsening.";

function base(topic:string,answer:string,possibleCauses:string[],nextSteps:string[],urgency:Urgency,sources:HealthSource[]):HealthAnswer{
  return{topic,answer,possibleCauses,nextSteps,urgency,disclaimer:DISCLAIMER,sources,model:"curated"};
}

export function classifyQuestion(q:string,language:KnowledgeLanguage="en-NG"){
  const x=q.toLowerCase();
  if(language==="yo"){
    if(/lóyún|loyun|oyun|ọjọ́.*oyun|ojo.*oyun|ailewu|safe day/.test(x))return"fertility-awareness";
    if(/ìrora|irora|cramp|inu.*n dun|inú.*n dun/.test(x))return"cramps";
    if(/ẹ̀jẹ̀|eje|bleed|pọ̀.*ẹ̀jẹ̀|po.*eje/.test(x))return"heavy-bleeding";
    if(/pẹ́|pe|oṣù.*ko|osu.*ko|irregular|late/.test(x))return"irregular";
  }
  if(language==="ha"){
    if(/daukar ciki|ɗaukar ciki|haihuwa|kwanakin.*ciki|safe day/.test(x))return"fertility-awareness";
    if(/ciwon ciki|ciwo.*al.?ada|cramp/.test(x))return"cramps";
    if(/jini|zubar.*jini|bleed/.test(x))return"heavy-bleeding";
    if(/makara|al.?ada.*zo|irregular|late/.test(x))return"irregular";
  }
  if(language==="ig"){
    if(/ịtụrụ ime|ituru ime|ime|ụbọchị.*ime|ubochi.*ime|safe day/.test(x))return"fertility-awareness";
    if(/mgbu|afọ|afo|cramp/.test(x))return"cramps";
    if(/ọbara|obara|bleed/.test(x))return"heavy-bleeding";
    if(/oge nsọ.*abịa|oge nso.*abia|late|irregular/.test(x))return"irregular";
  }
  if(/safe day|fertil|ovulat|pregnan|conceiv|avoid pregnancy|birth control/.test(x))return"fertility-awareness";
  if(/cramp|period pain|painful period|dysmenorr/.test(x))return"cramps";
  if(/heavy|bleed|blood|clot|soak|flood|pad every hour|tampon every hour/.test(x))return"heavy-bleeding";
  if(/irregular|late|missed|cycle|amenorr/.test(x))return"irregular";
  if(/pad|hygiene|clean|tampon|cup/.test(x))return"hygiene";
  if(/first period|first menstru|menarche/.test(x))return"first-period";
  return"unknown";
}

export function answerQuestion(q:string,language:KnowledgeLanguage="en-NG"):HealthAnswer{
  const topic=classifyQuestion(q,language);
  if(topic==="fertility-awareness")return base(topic,"There is no completely “safe” day if you are trying to avoid pregnancy. Count cycle day 1 as the first day of menstrual bleeding. If your cycles are consistently 26–32 days long, the Standard Days Method treats days 8–19 as the fertile days, so use a barrier method or avoid vaginal intercourse on those days. Ovulation can shift, and sperm can survive for several days, so calendar estimates can fail—especially with irregular cycles.",[],["Track the first day of each period for several cycles.","If cycles are not consistently 26–32 days, do not rely on the Standard Days Method alone.","Use condoms or another reliable contraceptive if avoiding pregnancy; fertility-awareness methods do not protect against STIs."],"routine",[ACOG_FERTILITY]);
  if(topic==="cramps")return base(topic,"Period cramps are common, but severe, new, progressively worsening, or disabling pain deserves medical assessment.",["Primary dysmenorrhea (period pain without another condition) is common.","Secondary causes such as endometriosis or uterine fibroids are possibilities when pain begins later, worsens over time, or occurs outside the period."],["Use heat and gentle activity if comfortable.","Seek clinical assessment if pain is severe, worsening, occurs outside menstruation, or repeatedly disrupts normal activities."],/faint|collapse|unbearable|10\/10|9\/10/.test(q.toLowerCase())?"urgent":"attention",[MEDLINE_PAIN]);
  if(topic==="heavy-bleeding")return base(topic,"Bleeding that is much heavier than your usual pattern, lasts unusually long, or causes weakness or light-headedness should be medically assessed.",["Hormonal or ovulation-related changes can cause abnormal uterine bleeding.","Fibroids, thyroid problems, pregnancy-related causes, infection, and other gynecologic conditions can also cause abnormal bleeding and require evaluation."],["Track pad/tampon changes, clots, duration, dizziness and weakness.","Seek urgent care if you are soaking through a pad or tampon about every hour for 2–3 hours, feel faint/very weak, or could be pregnant."],/faint|dizz|weak|soak|hour|pregnan|jiri|rauni|orí.*yí|ori.*yi|rẹ̀|re|ike adịghị|ike adighi|isi.*tụ|isi.*tu/.test(q.toLowerCase())?"urgent":"attention",[MEDLINE_BLEEDING]);
  if(topic==="irregular")return base(topic,"Irregular or missed periods can happen for many reasons. A pregnancy test is appropriate when pregnancy is possible, and persistent changes should be discussed with a healthcare professional.",["Pregnancy is a common cause of a missed period.","Stress, major weight change, intense exercise, hormonal contraception, thyroid problems, and polycystic ovary syndrome are among possible causes."],["Track cycle start dates and associated symptoms.","Take a pregnancy test if pregnancy is possible.","Arrange clinical review if irregularity persists, bleeding occurs between periods, or you have other concerning symptoms."],"attention",[NHS_IRREGULAR,MEDLINE_MENSTRUATION]);
  if(topic==="hygiene")return base(topic,"Use clean menstrual products, change or clean them regularly according to product instructions, and wash your hands before and after handling them.",[],["Choose pads, tampons, cups, or period underwear that are comfortable and appropriate for you.","Seek medical advice for fever, severe pain, unusual discharge, or other concerning symptoms."],"routine",[MEDLINE_MENSTRUATION]);
  if(topic==="first-period")return base(topic,"A first period is a normal part of puberty. Early cycles can be irregular while the body settles into a pattern.",[],["Keep a simple record of bleeding dates and symptoms.","Ask a trusted adult or healthcare professional for help with products, severe pain, very heavy bleeding, or anything worrying."],"routine",[MEDLINE_MENSTRUATION]);
  return base("unknown","Tell me the specific menstrual-health question or symptom you want help with. I can directly answer questions about cycle timing, fertility awareness, cramps, heavy bleeding, missed or irregular periods, hygiene, and first periods.",[],["If you have severe pain, fainting, very heavy bleeding, or pregnancy with bleeding/pain, seek prompt in-person medical care."],"routine",[MEDLINE_MENSTRUATION]);
}

const LOCALIZED:Partial<Record<KnowledgeLanguage,Record<string,{answer:string;possibleCauses?:string[];nextSteps:string[];disclaimer:string}>>> = {
  yo:{
    "fertility-awareness":{answer:"Kò sí ọjọ́ tí a lè pè ní ọjọ́ “àìléwu” patapata bí o bá fẹ́ yago fún oyún. Ka ọjọ́ àkọ́kọ́ tí ẹ̀jẹ̀ oṣù bẹ̀rẹ̀ sí ọjọ́ 1. Bí ìyípo oṣù rẹ bá máa ń jẹ́ ọjọ́ 26 sí 32 déédéé, ọjọ́ 8 sí 19 ni a ka sí ọjọ́ tí oyún lè rọrùn jù.",nextSteps:["Máa kọ ọjọ́ tí oṣù rẹ bẹ̀rẹ̀ sílẹ̀ fún ọ̀pọ̀ ìyípo.","Bí ìyípo rẹ kò bá jẹ́ ọjọ́ 26–32 déédéé, má ṣe gbẹ́kẹ̀ lé ìṣírò ọjọ́ nìkan.","Lo kondomu tàbí ọna ìdènà oyún tó dájú bí o bá fẹ́ yago fún oyún."],disclaimer:"Èyí jẹ́ ìmọ̀ ìlera, kì í ṣe àyẹ̀wò arun tó dájú. Jọ̀wọ́ bá onímọ̀ ìlera sọrọ fún ìmúdájú."},
    cramps:{answer:"Ìrora oṣù lè wọ́pọ̀, ṣùgbọ́n ìrora tó lágbára, tó ń burú sí i, tàbí tó ń dá iṣẹ́ ojoojúmọ́ dúró yẹ kí onímọ̀ ìlera ṣàyẹ̀wò rẹ.",possibleCauses:["Ìrora oṣù lasán (primary dysmenorrhea) wọ́pọ̀.","Endometriosis tàbí fibroid lè jẹ́ ọ̀kan lára àwọn ohun tó ṣeé ṣe, pàápàá bí ìrora bá ń burú sí i."],nextSteps:["Ooru lórí ikùn àti ìrìn díẹ̀ lè ràn ọ́ lọ́wọ́.","Wa ìtọju ilera bí ìrora bá lágbára, ń burú sí i, tàbí ń dá ìgbésí ayé rẹ dúró."],disclaimer:"Èyí jẹ́ ìmọ̀ ìlera, kì í ṣe àyẹ̀wò arun tó dájú. Onímọ̀ ìlera gbọ́dọ̀ jẹ́ ẹni tó mú ìwádìí dájú."},
    "heavy-bleeding":{answer:"Ẹ̀jẹ̀ oṣù tó pọ̀ ju bó ṣe máa ń rí lọ, tó pẹ́ ju àṣà rẹ lọ, tàbí tó bá ń mú kí o rẹ̀ tàbí orí yí ọ yẹ kí a ṣàyẹ̀wò rẹ ní ilé ìwòsàn.",possibleCauses:["Àyípadà homonu lè fa ẹ̀jẹ̀ tó pọ̀.","Fibroid, ìṣòro tairodu, oyún, àkóràn tàbí àwọn ìṣòro mìíràn lè tún fa a."],nextSteps:["Kọ iye igba tí o fi ń yí pad/tampon, iye ọjọ́, clot, ìrẹ̀wẹ̀sì àti yíyí orí sílẹ̀.","Wa ìtọju pajawiri bí o bá ń kun pad/tampon ní gbogbo wákàtí fún wákàtí 2–3, bá ń dákú, tàbí bá rẹ̀ gan-an."],disclaimer:"Èyí jẹ́ ìmọ̀ ìlera, kì í ṣe àyẹ̀wò arun tó dájú. Jọ̀wọ́ bá onímọ̀ ìlera sọrọ."},
    irregular:{answer:"Oṣù tó ń pẹ́ tàbí tó ń yí padà lè ní ọ̀pọ̀ ìdí. Bí oyún bá ṣeé ṣe, ṣe ìdánwò oyún; bí àyípadà bá ń bá a lọ, bá onímọ̀ ìlera sọrọ.",possibleCauses:["Oyún jẹ́ ọ̀kan lára ìdí tí oṣù fi lè pẹ́.","Ìdààmú ọkàn, àyípadà iwuwo, eré idaraya tó pọ̀, homonu, tairodu àti PCOS lè ní ipa."],nextSteps:["Máa kọ ọjọ́ tí oṣù rẹ bẹ̀rẹ̀ àti àwọn àmì àìsàn.","Ṣe ìdánwò oyún bí oyún bá ṣeé ṣe.","Wa ìmọ̀ràn ilera bí ìṣòro bá ń tẹ̀síwájú."],disclaimer:"Èyí jẹ́ ìmọ̀ ìlera, kì í ṣe àyẹ̀wò arun tó dájú."},
    unknown:{answer:"Sọ ìbéèrè tàbí àmì àìsàn oṣù rẹ ní kedere. Mo lè ràn ọ́ lọ́wọ́ pẹ̀lú ìrora, ẹ̀jẹ̀ tó pọ̀, oṣù tó pẹ́, ìṣírò ọjọ́ oyún àti ìmótótó oṣù.",nextSteps:["Bí o bá ní ìrora tó lágbára, dákú, ẹ̀jẹ̀ tó pọ̀ gan-an, tàbí oyún pẹ̀lú ẹ̀jẹ̀/ìrora, wa ìtọju ilera kíákíá."],disclaimer:"Èyí jẹ́ ìmọ̀ ìlera, kì í ṣe àyẹ̀wò arun tó dájú."}
  },
  ha:{
    "fertility-awareness":{answer:"Babu ranar da za a ce tana da cikakken “aminci” idan kina son kauce wa daukar ciki. Ki dauki ranar farko ta jinin al’ada a matsayin rana ta 1. Idan zagayowarki kullum yana tsakanin kwanaki 26–32, ana daukar kwanaki 8–19 a matsayin kwanakin da yiwuwar daukar ciki ta fi yawa.",nextSteps:["Ki rika rubuta ranar da al’ada ta fara na wasu zagaye.","Idan zagayowarki ba ya zama kwanaki 26–32 akai-akai, kada ki dogara da lissafin kwanaki kadai.","Yi amfani da kwaroron roba ko wata ingantacciyar hanyar hana daukar ciki idan kina son kauce wa ciki."],disclaimer:"Wannan bayani ne na ilimi game da lafiya, ba tabbataccen ganewar cuta ba ne. Kwararren ma’aikacin lafiya ya kamata ya tabbatar da duk wata cuta da ake zargi."},
    cramps:{answer:"Ciwon al’ada yana iya zama ruwan dare, amma ciwo mai tsanani, sabon ciwo, ko wanda yake kara muni ko hana harkokin yau da kullum ya kamata likita ya duba.",possibleCauses:["Ciwon al’ada na yau da kullum (primary dysmenorrhea) yana da yawa.","Endometriosis ko fibroid na iya kasancewa daga cikin abubuwan da za a bincika idan ciwon yana kara muni."],nextSteps:["Dumi a ciki da motsa jiki mai sauki na iya taimakawa.","Nemi duba na lafiya idan ciwon ya yi tsanani, yana kara muni, ko yana hana ayyukanki."],disclaimer:"Wannan bayani ne na lafiya, ba tabbataccen ganewar cuta ba ne."},
    "heavy-bleeding":{answer:"Jinin al’ada da ya fi yadda kika saba yawa, ya dade fiye da yadda kika saba, ko ya sa kina jin rauni ko jiri yana bukatar duba na lafiya.",possibleCauses:["Canjin hormones na iya haifar da zubar jini mara kyau.","Fibroid, matsalar thyroid, dalilan da suka shafi ciki, kamuwa da cuta da wasu matsalolin mata na iya haifar da hakan."],nextSteps:["Ki lura da yawan sauya pad/tampon, gudan jini, tsawon kwanaki, jiri da rauni.","Nemi kulawar gaggawa idan kina cika pad/tampon kusan kowane awa na tsawon awa 2–3, kina suma, ko kina jin rauni sosai."],disclaimer:"Wannan bayani ne na lafiya, ba tabbataccen ganewar cuta ba ne. Ki tuntubi kwararren ma’aikacin lafiya."},
    irregular:{answer:"Al’adar da ta makara ko ba ta zuwa daidai na iya samun dalilai da yawa. Idan akwai yiwuwar ciki, yi gwajin ciki; idan canjin ya ci gaba, ki tuntubi ma’aikacin lafiya.",possibleCauses:["Ciki yana daga cikin dalilan da suka fi yawan sa al’ada ta makara.","Damuwa, sauyin nauyi, motsa jiki mai yawa, hanyoyin hormonal, matsalar thyroid da PCOS na iya zama dalilai."],nextSteps:["Ki rika rubuta ranakun fara al’ada da alamomi.","Yi gwajin ciki idan ciki zai yiwu.","Nemi duba na lafiya idan rashin daidaiton ya ci gaba."],disclaimer:"Wannan bayani ne na lafiya, ba tabbataccen ganewar cuta ba ne."},
    unknown:{answer:"Ki bayyana tambayarki ko alamarki game da al’ada. Zan iya taimakawa da ciwon al’ada, jini mai yawa, al’ada da ta makara, lissafin haihuwa da tsaftar al’ada.",nextSteps:["Idan kina da ciwo mai tsanani, suma, jini mai yawa sosai, ko ciki tare da jini/ciwo, nemi kulawar lafiya cikin gaggawa."],disclaimer:"Wannan bayani ne na lafiya, ba tabbataccen ganewar cuta ba ne."}
  },
  ig:{
    "fertility-awareness":{answer:"Enweghị ụbọchị e nwere ike ịkpọ ụbọchị “nchekwa” kpamkpam ma ọ bụrụ na ịchọrọ izere ịtụrụ ime. Were ụbọchị mbụ ọbara ịhụ nsọ malitere dịka ụbọchị 1. Ọ bụrụ na okirikiri gị na-adịkarị ụbọchị 26–32, a na-ewere ụbọchị 8–19 dịka ụbọchị ohere ịtụrụ ime dị elu.",nextSteps:["Debe ndekọ ụbọchị mbụ nke ịhụ nsọ ruo ọtụtụ okirikiri.","Ọ bụrụ na okirikiri gị anaghị adị ụbọchị 26–32 mgbe niile, atụkwasịla naanị kalenda obi.","Jiri kondom ma ọ bụ ụzọ mgbochi afọ ime a pụrụ ịdabere na ya ma ọ bụrụ na ịchọrọ izere ime."],disclaimer:"Nke a bụ ozi mmụta gbasara ahụike, ọ bụghị nchọpụta ọrịa e kwadoro. Onye ọkachamara ahụike kwesịrị ikwenye ọrịa ọ bụla a na-enyo enyo."},
    cramps:{answer:"Mgbu oge ịhụ nsọ nwere ike ịdịkarị, mana mgbu siri ike, nke ọhụrụ, nke na-akawanye njọ, ma ọ bụ nke na-egbochi ọrụ kwa ụbọchị kwesịrị ka onye ọkachamara ahụike nyochaa ya.",possibleCauses:["Primary dysmenorrhea, ya bụ mgbu ịhụ nsọ na-enweghị ọrịa ọzọ, bụ ihe a na-ahụkarị.","Endometriosis ma ọ bụ fibroid nwere ike ịbụ ihe ndị a ga-enyocha ma ọ bụrụ na mgbu na-akawanye njọ."],nextSteps:["Okpomọkụ n’afọ na obere mmegharị nwere ike inye aka.","Chọọ nlekọta ahụike ma ọ bụrụ na mgbu siri ike, na-akawanye njọ, ma ọ bụ na-egbochi ndụ kwa ụbọchị."],disclaimer:"Nke a bụ ozi ahụike, ọ bụghị nchọpụta ọrịa e kwadoro."},
    "heavy-bleeding":{answer:"Ọbara ịhụ nsọ nke karịrị ihe ị na-ahụkarị, nke na-adị ogologo karịa ka ọ na-adị, ma ọ bụ nke na-eme ka ike gwụ gị ma ọ bụ isi na-atụ gị kwesịrị ka a nyochaa ya.",possibleCauses:["Mgbanwe homonụ nwere ike ịkpata ọbara na-adịghị ahụkebe.","Fibroid, nsogbu thyroid, nsogbu metụtara ime, ọrịa nje na nsogbu ụmụ nwanyị ndị ọzọ nwekwara ike ịkpata ya."],nextSteps:["Debe ndekọ ugboro ị na-agbanwe pad/tampon, clot, ogologo oge ọbara, isi ọwụwa na adịghị ike.","Chọọ nlekọta mberede ma ọ bụrụ na pad/tampon na-eju kwa elekere ruo awa 2–3, ị na-ada mba, ma ọ bụ ike gwụrụ gị nke ukwuu."],disclaimer:"Nke a bụ ozi ahụike, ọ bụghị nchọpụta ọrịa e kwadoro. Kpọtụrụ onye ọkachamara ahụike."},
    irregular:{answer:"Ịhụ nsọ na-abịa oge na-adịghị ma ọ bụ na-efunahụ nwere ọtụtụ ihe nwere ike ịkpata ya. Ọ bụrụ na ime ga-ekwe omume, mee ule ime; ọ bụrụ na mgbanwe ahụ na-aga n’ihu, kpọtụrụ onye ọkachamara ahụike.",possibleCauses:["Ime bụ otu n’ime ihe a na-ahụkarị na-akpata oge ịhụ nsọ ịla azụ.","Nchekasị, mgbanwe ibu, mmega ahụ siri ike, ọgwụ homonụ, nsogbu thyroid na PCOS nwere ike iso."],nextSteps:["Debe ndekọ ụbọchị ịhụ nsọ na mgbaàmà.","Mee ule ime ma ọ bụrụ na ime ga-ekwe omume.","Chọọ nyocha ahụike ma ọ bụrụ na nsogbu ahụ na-aga n’ihu."],disclaimer:"Nke a bụ ozi ahụike, ọ bụghị nchọpụta ọrịa e kwadoro."},
    unknown:{answer:"Kọwaa ajụjụ ma ọ bụ mgbaàmà gị gbasara ịhụ nsọ. Enwere m ike inye aka gbasara mgbu, ọbara dị ukwuu, ịhụ nsọ na-adịghị abịa n’oge, ụbọchị ọmụmụ na ịdị ọcha.",nextSteps:["Ọ bụrụ na ị nwere mgbu siri ike, ịda mba, ọbara dị ukwuu nke ukwuu, ma ọ bụ ime na ọbara/mgbu, chọọ nlekọta ahụike ngwa ngwa."],disclaimer:"Nke a bụ ozi ahụike, ọ bụghị nchọpụta ọrịa e kwadoro."}
  }
};

export function localizeHealthAnswer(answer:HealthAnswer,language:KnowledgeLanguage):HealthAnswer{
  if(language==="en-NG")return answer;
  const localized=LOCALIZED[language]?.[answer.topic]??LOCALIZED[language]?.unknown;
  if(!localized)return answer;
  return{
    ...answer,
    answer:localized.answer,
    possibleCauses:localized.possibleCauses??answer.possibleCauses,
    nextSteps:localized.nextSteps,
    disclaimer:localized.disclaimer
  };
}

export function evidenceFor(answer:HealthAnswer){
  return{verifiedAnswer:answer.answer,possibleCauses:answer.possibleCauses,nextSteps:answer.nextSteps,urgency:answer.urgency,sources:answer.sources};
}
