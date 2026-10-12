"use client";
import { useEffect, useState } from "react";
import { AgentCallClient, INITIAL_CALL } from "./agent-call-client";

export function useAgentCall() {
  const [call, setCall] = useState(INITIAL_CALL);
  const [client] = useState(() => new AgentCallClient(setCall));
  useEffect(() => {
    client.mount();
    const leave = () => client.hangup();
    const hide = () => { if (document.visibilityState === "hidden") client.hangup(); };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hide);
      client.unmount();
    };
  }, [client]);
  return { call, client };
}
