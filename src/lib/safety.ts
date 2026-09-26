export type SafetyLevel="routine"|"attention"|"urgent";
export type SymptomInput={pain:number;heavyBleeding?:boolean;fainting?:boolean;severeWeakness?:boolean;pregnancyPossible?:boolean;fever?:boolean};
export function assessSymptoms(i:SymptomInput):{level:SafetyLevel;message:string}{
 if(i.fainting||(i.heavyBleeding&&i.severeWeakness)||(i.pregnancyPossible&&i.pain>=8))return{level:"urgent",message:"These symptoms may need urgent medical attention. Please seek in-person medical care now."};
 if(i.pain>=8||i.heavyBleeding||i.fever)return{level:"attention",message:"This pattern deserves assessment by a qualified healthcare professional, especially if it persists or worsens."};
 return{level:"routine",message:"Keep tracking how you feel. Seek professional care if symptoms become severe, unusual for you, or worrying."};
}