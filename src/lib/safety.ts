export type SafetyLevel='routine'|'attention'|'urgent';
export type SymptomInput={pain:number;heavyBleeding?:boolean;fainting?:boolean;severeWeakness?:boolean;pregnancyPossible?:boolean;fever?:boolean;breathlessness?:boolean;chestPain?:boolean;suddenSeverePain?:boolean;oneSidedPain?:boolean;shoulderTipPain?:boolean;bleeding?:boolean;prolongedBleeding?:boolean;betweenPeriods?:boolean};
export const SAFETY_SOURCES = [
 {title:'NHS: heavy periods',url:'https://www.nhs.uk/conditions/heavy-periods/'},
 {title:'NHS: period pain',url:'https://www.nhs.uk/symptoms/period-pain/'},
 {title:'NHS: ectopic pregnancy symptoms',url:'https://www.nhs.uk/conditions/ectopic-pregnancy/symptoms/'}
];
export function assessSymptoms(i:SymptomInput):{level:SafetyLevel;title:string;message:string} {
 if(!Number.isInteger(i.pain)||i.pain<0||i.pain>10) throw new Error('Pain must be 0 to 10.');
 if(i.fainting||i.chestPain||i.breathlessness||i.suddenSeverePain||(i.heavyBleeding&&i.severeWeakness)||(i.pregnancyPossible&&(i.pain>=8||i.shoulderTipPain))) return {level:'urgent',title:'Seek emergency care now',message:'Go to the nearest emergency department or contact your local emergency service. Ask someone to help you get there; do not wait for this app. These symptoms need in-person assessment, whatever the cause.'};
 if(i.pregnancyPossible&&(i.pain>0||i.bleeding||i.heavyBleeding||i.oneSidedPain)) return {level:'urgent',title:'Get urgent medical assessment today',message:'Possible pregnancy with pain or bleeding needs prompt in-person medical assessment, even without a positive pregnancy test. If pain is sudden or severe, you feel faint, or you have shoulder-tip pain, seek emergency care now.'};
 if(i.pain>=8||i.fever) return {level:'attention',title:'Seek prompt medical advice',message:'Severe or worsening pain, or fever, deserves prompt assessment by a qualified clinician. Seek emergency care if symptoms are sudden, intense or accompanied by fainting.'};
 if(i.heavyBleeding||i.prolongedBleeding||i.betweenPeriods||i.severeWeakness) return {level:'attention',title:'Arrange a clinical assessment',message:'Unusual, prolonged or heavy bleeding, bleeding between periods, or marked weakness should be assessed. Do not assume these changes are just your period. Seek urgent care if you become faint or very unwell.'};
 return {level:'routine',title:'Keep paying attention to how you feel',message:'No emergency trigger was identified in the answers selected. This limited checklist cannot rule out illness. Seek care for persistent, worsening, unusual or worrying symptoms, even when no alert appears.'};
}
