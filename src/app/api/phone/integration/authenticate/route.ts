import { authenticatePhone, phoneFailure, phoneJson, phoneResponse, requirePhoneIntegration } from "@/lib/phone-pilot";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try { requirePhoneIntegration(req); return phoneResponse(await authenticatePhone(await phoneJson(req))); }
  catch (e) { return phoneFailure(e); }
}
