const TOKEN_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /eyJ[A-Za-z0-9_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /cookie\s*[:=]\s*[^\s,;]+/gi,
  /authorization\s*[:=]\s*[^\s,;]+/gi,
];

export function maskEmail(value: string | null | undefined) {
  if (!value) return null;
  const [local, domain] = value.trim().toLowerCase().split("@");
  if (!local || !domain) return "***";
  const shown = local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2);
  return `${shown}***@${domain}`;
}

export function sanitizeMessage(value: unknown) {
  let message = typeof value === "string" ? value : String(value ?? "Unknown error");
  for (const pattern of TOKEN_PATTERNS) message = message.replace(pattern, "[REDACTED]");
  return message.slice(0, 1000);
}

export function assertSafeId(id: string) {
  if (!/^[a-z0-9_-]{8,80}$/i.test(id)) throw new Error("Invalid identifier");
}

