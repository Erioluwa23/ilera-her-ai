import {twiml} from "@/lib/ivr";

export async function POST(req:Request){
  const origin=new URL(req.url).origin;
  return twiml(
    `<Gather numDigits="1" action="${origin}/api/ivr/record" method="POST" timeout="8">
      <Say>Welcome to IlaraHer. For Nigerian English, press 1. Fun Yoruba, te meji. Domin Hausa, danna uku. Maka Igbo, pịa anọ.</Say>
    </Gather>
    <Redirect method="POST">${origin}/api/ivr/incoming</Redirect>`
  );
}

export const GET=POST;
