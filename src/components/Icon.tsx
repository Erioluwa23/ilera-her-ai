import type { CSSProperties } from "react";
const paths = {
  calendar:
    "M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2m2 9h.01M12 14h.01M16 14h.01M8 18h.01",
  chat: "M5 4h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3V6a2 2 0 0 1 2-2m3 8h.01M12 12h.01M16 12h.01",
  logs: "M7 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m2 0v18m4-14h4m-4 5h4m-4 5h3",
  help: "M9 9a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5m-4 6v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M6 10h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2m6 5v2",
  plus: "M12 4v16M4 12h16",
  back: "m15 5-7 7 7 7",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  close: "m6 6 12 12M6 18 18 6",
  edit: "m4 16 12-12 4 4-12 12-5 1 1-5m10-10 4 4",
  check: "m5 12 4 4L20 5",
  drop: "M12 2s-7 9-7 13a7 7 0 0 0 14 0c0-4-7-13-7-13Z",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 2 11 8 16 6-5 13-11 8-16Z",
  moon: "M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z",
  sparkle: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
  leaf: "M4 20c-2-12 4-17 16-16 1 12-4 18-16 16m0 0L16 8",
  wifi: "M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0m-3 4h.01",
  clock: "M12 6v6l5 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  more: "M12 5h.01M12 12h.01M12 19h.01",
  trash: "M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  share: "M12 16V3m-5 5 5-5 5 5M5 12v9h14v-9",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  phone: "m5 3 4 5-3 3c2 4 3 5 7 7l3-3 5 4-2 3C9 23 1 15 2 6l3-3Z",
  play: "m8 4 12 8-12 8V4Z",
  pause: "M8 4v16M16 4v16",
  stop: "M5 5h14v14H5Z",
  reply: "m9 5-6 6 6 6m-6-6h10a7 7 0 0 1 7 7",
  search: "M21 21l-6-6M17 9a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  copy: "M9 8h11v13H9V8M15 8V3H4v13h5",
  smile:
    "M8 9h.01M16 9h.01M7 14a6 6 0 0 0 10 0M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
} as const;
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  size = 24,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Flower({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="ux-flower"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g fill="var(--lilac)">
        <circle cx="50" cy="25" r="23" />
        <circle cx="72" cy="38" r="23" />
        <circle cx="72" cy="63" r="23" />
        <circle cx="50" cy="75" r="23" />
        <circle cx="28" cy="63" r="23" />
        <circle cx="28" cy="38" r="23" />
      </g>
      <circle cx="50" cy="50" r="17" fill="var(--primary)" />
      <circle cx="50" cy="50" r="6" fill="white" />
    </svg>
  );
}
