/**
 * Discovery Module - CtrlClaw Setup
 * 
 * Detecta backend automaticamente em ambiente local
 */

export interface DiscoveryResult {
  found: boolean;
  httpUrl?: string;
  wsUrl?: string;
  host?: string;
  port?: number;
  hasSSL?: boolean;
  scenario?: 'local' | 'vps' | 'tunnel' | 'unknown';
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
}

const COMMON_PORTS = [3001, 8080, 8000, 5000, 1337, 3000];
const COMMON_HOSTS = ['localhost', '127.0.0.1'];

/**
 * Descobre backend local automaticamente
 */
export async function discoverLocalBackend(): Promise<DiscoveryResult> {
  for (const host of COMMON_HOSTS) {
    for (const port of COMMON_PORTS) {
      const httpUrl = `http://${host}:${port}`;
      
      try {
        const isClaw = await isClawBackend(httpUrl);
        if (isClaw) {
          return {
            found: true,
            httpUrl,
            wsUrl: `ws://${host}:${port}`,
            host,
            port,
            hasSSL: false,
            scenario: 'local',
            confidence: 'high',
          };
        }
      } catch {
        // Continue to next port
      }
    }
  }

  return {
    found: false,
    scenario: 'unknown',
    confidence: 'low',
    error: 'No backend found in common ports',
  };
}

/**
 * Verifica se URL é um backend Claw
 */
async function isClawBackend(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    
    // Check for Claw indicators
    return (
      data.service?.toLowerCase().includes('claw') ||
      data.name?.toLowerCase().includes('claw') ||
      data.version?.toLowerCase().includes('claw') ||
      data.api?.includes('claw')
    );
  } catch {
    return false;
  }
}

/**
 * Testa conectividade HTTP
 */
export async function testHttpConnection(url: string): Promise<{
  success: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Testa conectividade WebSocket
 */
export async function testWebSocketConnection(url: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`${url}?v=1`);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ success: false, error: 'Timeout' });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({ success: true });
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ success: false, error: 'WebSocket error' });
      };
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create WebSocket',
      });
    }
  });
}

/**
 * Testa CORS
 */
export async function testCors(url: string): Promise<{
  success: boolean;
  headers?: Record<string, string>;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    const corsHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('access-control')) {
        corsHeaders[key] = value;
      }
    });

    return {
      success: Object.keys(corsHeaders).length > 0,
      headers: corsHeaders,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CORS test failed',
    };
  }
}

/**
 * Detecta cenário baseado no ambiente
 */
export function detectScenario(): 'local' | 'vps' | 'tunnel' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const hostname = window.location.hostname;

  // Local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local';
  }

  // Tunnel (Cloudflare)
  if (hostname.includes('trycloudflare.com')) {
    return 'tunnel';
  }

  // VPS (has domain, not local)
  if (hostname.includes('.') && !hostname.includes('localhost')) {
    return 'vps';
  }

  return 'unknown';
}

/**
 * Infere URL WebSocket a partir de URL HTTP
 */
export function inferWebSocketUrl(httpUrl: string): string {
  const url = new URL(httpUrl);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}`;
}
