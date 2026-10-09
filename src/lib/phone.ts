export function normalizePhone(input: string) {
  const raw = input.trim().replace(/[\s().-]/g, "");
  let normalized = raw;

  if (/^0\d{10}$/.test(raw)) {
    normalized = `+234${raw.slice(1)}`;
  } else if (/^234\d{10}$/.test(raw)) {
    normalized = `+${raw}`;
  } else if (/^\d{10,15}$/.test(raw)) {
    normalized = `+${raw}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Enter a valid phone number");
  }
  return normalized;
}
