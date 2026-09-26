import {speechConfigured} from '@/lib/natlas';
import {json} from '@/lib/http';
export const dynamic='force-dynamic';
export function GET(){return json({ok:true,service:'ileraher-ai',version:'0.2.0',commit:process.env.RENDER_GIT_COMMIT?.slice(0,12)||'local',stage:'preview',capabilities:{journal:'device-encrypted-or-session',education:'curated-not-generative',speech:speechConfigured()?'configured-unverified':'unavailable',clinicalValidation:'pending',whatsapp:'not-connected'}});}
