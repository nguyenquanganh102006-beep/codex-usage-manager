import type { NextConfig } from "next";

process.env.NEXT_TELEMETRY_DISABLED = "1";

const nextConfig: NextConfig = {
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const contentSecurityPolicy = [
      "default-src 'self'",
      `connect-src 'self'${isDevelopment ? " ws:" : ""}`,
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
  },
};

export default nextConfig;
