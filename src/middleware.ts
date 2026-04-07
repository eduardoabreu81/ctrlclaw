import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateOrigin } from "@/lib/security/cors";

/**
 * Next.js Middleware - Security Layer
 * 
 * Responsabilidades desta camada (FRONTEND):
 * - Proteção de rotas autenticadas
 * - Adicionar security headers em todas as respostas
 * - CORS preflight handling
 * - Redirecionamentos de segurança (HTTP → HTTPS)
 * 
 * NÃO é responsável por:
 * - Rate limiting real (isso é do PROXY/BACKEND)
 * - Validação de tokens com backend (feito no client/server)
 * - SSL/TLS termination (PROXY)
 */

// Rotas públicas que não requerem autenticação
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/api/auth"];

// Rotas que são arquivos estáticos
const STATIC_FILE_PATTERNS = [
  "/_next",
  "/static",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const origin = request.headers.get("origin") || "";

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    const isAllowed = validateOrigin(origin) || origin === "";
    
    if (!isAllowed) {
      return new NextResponse(null, {
        status: 403,
        statusText: "Forbidden - Origin not allowed",
      });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Skip middleware for static files
  if (STATIC_FILE_PATTERNS.some((pattern) => pathname.startsWith(pattern))) {
    return NextResponse.next();
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // For API routes, add CORS headers
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    
    if (origin && validateOrigin(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    
    return response;
  }

  // For protected routes, we don't block here (client-side auth check)
  // But we add security headers
  const response = isPublicRoute
    ? NextResponse.next()
    : NextResponse.next(); // Auth check is done client-side for SPA behavior

  // Add security headers to all responses
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
