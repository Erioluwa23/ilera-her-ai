import type { VoiceMessage } from "./voice-chat";
const sessions = new Map<string, VoiceMessage[]>();
export function sessionMessages(owner: string) {
  return sessions.get(owner) || [];
}
export function keepSessionMessages(owner: string, messages: VoiceMessage[]) {
  sessions.set(owner, messages);
}
export function clearVoiceSessions() {
  sessions.clear();
}
