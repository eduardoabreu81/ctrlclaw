import type { NextConfig } from "next";

/**
 * Security Headers Configuration
 * 
 * Responsabilidades:
 * - Frontend (Next.js): Headers de segurança HTTP, CSP, HSTS
 * - Proxy (Nginx): TLS termination, rate limiting, WAF rules
 * - Backend: Autenticação, autorização, validação de input
 * 
 * NOTA SOBRE CSP:
 * Em desenvolvimento local, permitimos conexões HTTP/WS para o backend
 * local (localhost:3001). Em produção, apenas conexões seguras (HTTPS/WSS).
 */

// Detecta ambiente de desenvolvimento
// NODE_ENV === 'development' durante 'next dev'
// Para 'next start' (produção local), use CSP_ALLOW_LOCAL=true para permitir localhost
const isDevelopment = process.env.NODE_ENV === 'development';
const allowLocalBackend = process.env.CSP_ALLOW_LOCAL === 'true' || isDevelopment;

console.log('Next.js Config:', { 
  NODE_ENV: process.env.NODE_ENV, 
  isDevelopment, 
  allowLocalBackend,
  CSP: allowLocalBackend ? 'permissive (dev)' : 'strict (prod)'
});

// Base security headers (applies to all environments)
const baseSecurityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

// HSTS - apenas em produção (pode causar problemas em dev local)
const hstsHeader = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
};

// CSP - diferente por ambiente
// Em desenvolvimento: permite conexão com backend local HTTP/WS
// Em produção: apenas conexões seguras HTTPS/WSS
const cspHeader = {
  key: "Content-Security-Policy",
  value: allowLocalBackend
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "font-src 'self'",
        // DEV: Permite conexão com backend local HTTP/WS
        "connect-src 'self' http://localhost:* ws://localhost:* wss: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' blob: data:",
        "font-src 'self'",
        // PROD: Apenas conexões seguras
        "connect-src 'self' wss: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
};

// Monta headers finais
const securityHeaders = allowLocalBackend
  ? [...baseSecurityHeaders, cspHeader]  // Dev/local: sem HSTS, CSP permissivo
  : [...baseSecurityHeaders, hstsHeader, cspHeader];  // Prod: completo

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Security: Disable powered-by header
  poweredByHeader: false,

  // Security: Configure image domains (restrict to trusted sources)
  images: {
    domains: [],
    remotePatterns: [],
  },

  // Environment variables exposed to browser (only non-sensitive)
  env: {
    NEXT_PUBLIC_APP_NAME: "CtrlClaw",
    NEXT_PUBLIC_BACKEND_TYPE: process.env.NEXT_PUBLIC_BACKEND_ADAPTER || "nanoclaw",
  },
};

export default nextConfig;
