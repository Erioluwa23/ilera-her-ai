import { phoneEvent, phoneFailure, phoneJson, phoneResponse, requirePhoneIntegration } from "@/lib/phone-pilot";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try { requirePhoneIntegration(req, false); return phoneResponse(await phoneEvent(await phoneJson(req))); }
  catch (e) { return phoneFailure(e); }
}
