#!/usr/bin/env node
/**
 * CtrlClaw CLI Setup Script
 * 
 * Usage:
 *   node scripts/setup.mjs [--detect-only] [--output=.env.local]
 * 
 * Options:
 *   --detect-only    Only detect backend, don't write config
 *   --output         Output file (default: .env.local)
 *   --mock           Use mock backend
 *   --scenario       Force scenario: local|vps|tunnel
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (q) => new Promise(r => rl.question(q, r));

const COMMON_PORTS = [3001, 8080, 8000, 5000, 1337];
const COMMON_HOSTS = ['localhost', '127.0.0.1'];

async function detectBackend() {
  console.log('🔍 Scanning for CtrlClaw backend...\n');
  
  for (const host of COMMON_HOSTS) {
    for (const port of COMMON_PORTS) {
      const url = `http://${host}:${port}`;
      process.stdout.write(`  Testing ${url}... `);
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${url}/api/health`, {
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (response.ok) {
          const data = await response.json();
          if (data.service?.toLowerCase().includes('claw') || 
              data.name?.toLowerCase().includes('claw')) {
            console.log('✅ Found!');
            return { url, host, port, found: true };
          }
        }
        console.log('❌');
      } catch {
        console.log('❌');
      }
    }
  }
  
  return { found: false };
}

function generateEnv(config) {
  const lines = [
    '# CtrlClaw Environment Configuration',
    `# Generated at ${new Date().toISOString()}`,
    '',
    '# Deployment Scenario: local | vps | tunnel',
    `NEXT_PUBLIC_DEPLOYMENT_SCENARIO=${config.scenario}`,
    '',
  ];

  if (!config.useMock) {
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
      `NEXT_PUBLIC_MOCK_LATENCY=${config.mockLatency || 100}`,
      `NEXT_PUBLIC_MOCK_FAILURE_RATE=${config.mockFailureRate || 0}`,
      ''
    );
  }

  lines.push(
    '# Security',
    `NEXT_PUBLIC_CORS_ORIGIN=${config.corsOrigin || 'http://localhost:3000'}`,
    'NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE=60',
    'NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS=5',
    'NEXT_PUBLIC_LOCKOUT_DURATION=15',
    '',
    '# Session',
    'NEXT_PUBLIC_SESSION_DURATION_MINUTES=1440',
    'NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=30',
    'NEXT_PUBLIC_IDLE_WARNING_MINUTES=5',
    ''
  );

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const detectOnly = args.includes('--detect-only');
  const useMock = args.includes('--mock');
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1] || '.env.local';
  const forcedScenario = args.find(a => a.startsWith('--scenario='))?.split('=')[1];
  
  console.log('╔════════════════════════════════════╗');
  console.log('║     CtrlClaw Setup Assistant       ║');
  console.log('╚════════════════════════════════════╝\n');
  
  const detection = await detectBackend();
  
  if (detectOnly) {
    if (detection.found) {
      console.log(`\n✅ Backend detected at: ${detection.url}`);
      process.exit(0);
    } else {
      console.log('\n❌ No backend detected');
      process.exit(1);
    }
  }
  
  let config = {
    httpUrl: detection.found ? detection.url : 'http://localhost:3001',
    wsUrl: detection.found ? detection.url.replace(/^http/, 'ws') : 'ws://localhost:3001',
    useMock,
    scenario: forcedScenario || 'local'
  };
  
  if (!detection.found && !useMock) {
    console.log('\n⚠️  No backend detected automatically');
    const manualUrl = await question('Enter backend URL (or press Enter for default): ');
    if (manualUrl.trim()) {
      config.httpUrl = manualUrl;
      config.wsUrl = manualUrl.replace(/^http/, 'ws');
    }
  }
  
  // Só pergunta sobre mock se:
  // 1. Não passou flag --mock explicitamente
  // 2. Não encontrou backend automaticamente
  if (!useMock && !detection.found) {
    const useMockAnswer = await question('\nUse mock backend? (y/N): ');
    config.useMock = useMockAnswer.toLowerCase() === 'y';
  }
  
  if (config.useMock && !useMock) {
    // Só pergunta latência se não passou --mock (usa default)
    const latency = await question('Mock latency in ms (default: 100): ');
    config.mockLatency = parseInt(latency) || 100;
  } else if (config.useMock) {
    // Flag --mock: usa valores default
    config.mockLatency = 100;
    config.mockFailureRate = 0;
  }
  
  console.log('\n📝 Generated configuration:');
  const envContent = generateEnv(config);
  console.log('\n' + envContent);
  
  if (existsSync(outputFile)) {
    const overwrite = await question(`\n${outputFile} exists. Overwrite? (y/N): `);
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled');
      rl.close();
      return;
    }
  }
  
  writeFileSync(outputFile, envContent);
  console.log(`\n✅ Configuration saved to ${outputFile}`);
  console.log('\nNext steps:');
  console.log('  1. Review the configuration');
  console.log('  2. Run: npm run dev');
  
  rl.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
