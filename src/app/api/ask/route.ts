import {answerQuestion} from '@/lib/knowledge';
import {guard,json,readBounded} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 const rejected=guard(req,'ask');if(rejected)return rejected;
 if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON is required.'},415);
 try {
  const body=JSON.parse(new TextDecoder().decode(await readBounded(req,8192)));
  if(!body||typeof body.question!=='string'||body.question.trim().length<3||body.question.length>1000)return json({error:'Enter a question between 3 and 1000 characters.'},400);
  return json(answerQuestion(body.question));
 } catch {return json({error:'The request was invalid or too large.'},400);}
}
