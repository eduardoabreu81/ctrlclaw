/**
 * Environment Manager - CtrlClaw Setup
 * 
 * Gerencia a geração de configurações baseado em detecção e input do usuário
 */

import { DiscoveryResult } from './discovery';

export interface SetupConfig {
  // Cenário detectado ou escolhido
  scenario: 'local' | 'vps' | 'tunnel' | 'unknown';
  
  // Backend real
  httpUrl?: string;
  wsUrl?: string;
  
  // Mock para desenvolvimento
  useMock: boolean;
  mockLatency: number;
  mockFailureRate: number;
  
  // Segurança
  corsOrigin: string;
  maxRequestsPerMinute: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  
  // Sessão
  sessionDuration: number;
  idleTimeout: number;
  idleWarning: number;
}

export const DEFAULT_CONFIG: SetupConfig = {
  scenario: 'local',
  httpUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3001',
  useMock: false,
  mockLatency: 100,
  mockFailureRate: 0,
  corsOrigin: 'http://localhost:3000',
  maxRequestsPerMinute: 60,
  maxLoginAttempts: 5,
  lockoutDuration: 15,
  sessionDuration: 1440, // 24 hours
  idleTimeout: 30,
  idleWarning: 5,
};

/**
 * Gera configuração baseada na descoberta e input do usuário
 */
export function generateConfig(
  discovery: DiscoveryResult,
  overrides: Partial<SetupConfig> = {}
): SetupConfig {
  const baseConfig = discovery.found
    ? createConfigFromDiscovery(discovery)
    : DEFAULT_CONFIG;

  return {
    ...baseConfig,
    ...overrides,
  };
}

function createConfigFromDiscovery(discovery: DiscoveryResult): SetupConfig {
  const corsOrigin = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'http://localhost:3000';

  const config: SetupConfig = {
    scenario: discovery.scenario ?? 'local',
    httpUrl: discovery.httpUrl,
    wsUrl: discovery.wsUrl,
    useMock: false,
    mockLatency: 100,
    mockFailureRate: 0,
    corsOrigin,
    maxRequestsPerMinute: discovery.scenario === 'vps' ? 30 : 60,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    sessionDuration: 1440,
    idleTimeout: 30,
    idleWarning: 5,
  };

  // Adjust for scenario
  switch (discovery.scenario) {
    case 'tunnel':
      config.sessionDuration = 240; // 4 hours for tunnels
      break;
    case 'vps':
      config.sessionDuration = 480; // 8 hours for VPS
      break;
  }

  return config;
}

/**
 * Gera arquivo .env.local
 */
export function generateEnvFile(config: SetupConfig): string {
  const lines = [
    '# CtrlClaw Environment Configuration',
    `# Generated at ${new Date().toISOString()}`,
    '',
    '# Deployment Scenario: local | vps | tunnel',
    `NEXT_PUBLIC_DEPLOYMENT_SCENARIO=${config.scenario}`,
    '',
  ];

  if (!config.useMock && config.httpUrl) {
    lines.push(
      '# Backend Configuration',
      `NEXT_PUBLIC_BACKEND_HTTP_URL=${config.httpUrl}`,
      `NEXT_PUBLIC_BACKEND_WS_URL=${config.wsUrl}`,
      ''
    );
  }

  lines.push(
    '# Backend Adapter: nanoclaw | mock | openclaw',
    `NEXT_PUBLIC_BACKEND_ADAPTER=${config.useMock ? 'mock' : 'nanoclaw'}`,
    ''
  );

  if (config.useMock) {
    lines.push(
      '# Mock Configuration',
      `NEXT_PUBLIC_MOCK_LATENCY=${config.mockLatency}`,
      `NEXT_PUBLIC_MOCK_FAILURE_RATE=${config.mockFailureRate}`,
      ''
    );
  }

  lines.push(
    '# Security',
    `NEXT_PUBLIC_CORS_ORIGIN=${config.corsOrigin}`,
    `NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE=${config.maxRequestsPerMinute}`,
    `NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS=${config.maxLoginAttempts}`,
    `NEXT_PUBLIC_LOCKOUT_DURATION=${config.lockoutDuration}`,
    '',
    '# Session',
    `NEXT_PUBLIC_SESSION_DURATION_MINUTES=${config.sessionDuration}`,
    `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=${config.idleTimeout}`,
    `NEXT_PUBLIC_IDLE_WARNING_MINUTES=${config.idleWarning}`,
    ''
  );

  return lines.join('\n');
}

/**
 * Valida configuração
 */
export function validateConfig(config: SetupConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.useMock) {
    if (!config.httpUrl) {
      errors.push('HTTP URL is required when not using mock');
    } else {
      try {
        new URL(config.httpUrl);
      } catch {
        errors.push('Invalid HTTP URL format');
      }
    }

    if (!config.wsUrl) {
      errors.push('WebSocket URL is required when not using mock');
    } else {
      try {
        new URL(config.wsUrl);
      } catch {
        errors.push('Invalid WebSocket URL format');
      }
    }
  }

  if (config.mockFailureRate < 0 || config.mockFailureRate > 1) {
    errors.push('Mock failure rate must be between 0 and 1');
  }

  if (config.maxRequestsPerMinute < 1) {
    errors.push('Max requests per minute must be at least 1');
  }

  if (config.sessionDuration < 1) {
    errors.push('Session duration must be at least 1 minute');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sugere configuração baseada no cenário
 */
export function suggestConfigForScenario(scenario: SetupConfig['scenario']): Partial<SetupConfig> {
  switch (scenario) {
    case 'local':
      return {
        corsOrigin: 'http://localhost:3000',
        maxRequestsPerMinute: 60,
        sessionDuration: 1440,
        idleTimeout: 30,
      };

    case 'vps':
      return {
        corsOrigin: typeof window !== 'undefined' ? window.location.origin : '',
        maxRequestsPerMinute: 30,
        sessionDuration: 480,
        idleTimeout: 30,
      };

    case 'tunnel':
      return {
        corsOrigin: '*', // Allow any for tunnels
        maxRequestsPerMinute: 20,
        sessionDuration: 240,
        idleTimeout: 15,
      };

    default:
      return {};
  }
}
