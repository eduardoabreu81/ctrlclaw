'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  discoverLocalBackend, 
  testHttpConnection, 
  testWebSocketConnection, 
  detectScenario,
  DiscoveryResult 
} from '@/lib/setup/discovery';
import { 
  generateConfig, 
  generateEnvFile, 
  validateConfig,
  SetupConfig,
  suggestConfigForScenario 
} from '@/lib/setup/env-manager';

/**
 * Setup Page - Smart Configuration Assistant
 * Uses Tailwind CSS only (no shadcn components)
 */
export default function SetupPage() {
  const [phase, setPhase] = useState<'scanning' | 'detected' | 'configuring' | 'review'>('scanning');
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [httpStatus, setHttpStatus] = useState<{ success?: boolean; testing?: boolean }>({});
  const [wsStatus, setWsStatus] = useState<{ success?: boolean; testing?: boolean }>({});

  // Scan phase
  useEffect(() => {
    if (phase === 'scanning') {
      const scan = async () => {
        const result = await discoverLocalBackend();
        setDiscovery(result);
        
        const initialConfig = generateConfig(result, {
          scenario: detectScenario(),
        });
        setConfig(initialConfig);
        
        setPhase('detected');
      };
      
      scan();
    }
  }, [phase]);

  // Test connections
  const testConnections = useCallback(async () => {
    if (!config?.httpUrl) return;
    
    setHttpStatus({ testing: true });
    const http = await testHttpConnection(config.httpUrl);
    setHttpStatus({ success: http.success });
    
    setWsStatus({ testing: true });
    const ws = await testWebSocketConnection(config.httpUrl);
    setWsStatus({ success: ws.success });
  }, [config?.httpUrl]);

  useEffect(() => {
    if (phase === 'detected' && config?.httpUrl) {
      testConnections();
    }
  }, [phase, config?.httpUrl, testConnections]);

  const handleManualUrl = (url: string) => {
    if (!config) return;
    
    const wsUrl = url.replace(/^http/, 'ws');
    setConfig({ ...config, httpUrl: url, wsUrl, scenario: 'local' });
    
    setHttpStatus({});
    setWsStatus({});
    testConnections();
  };

  const handleScenarioChange = (scenario: SetupConfig['scenario']) => {
    if (!config) return;
    
    const suggestions = suggestConfigForScenario(scenario);
    setConfig({ ...config, scenario, ...suggestions });
  };

  const handleCopyEnv = () => {
    if (!config) return;
    
    const envContent = generateEnvFile(config);
    navigator.clipboard.writeText(envContent);
    toast.success('Configuration copied to clipboard');
  };

  const handleFinish = () => {
    if (!config) return;
    
    const validation = validateConfig(config);
    if (!validation.valid) {
      toast.error(`Invalid configuration: ${validation.errors.join(', ')}`);
      return;
    }
    
    setPhase('review');
  };

  // --- RENDER PHASES ---

  if (phase === 'scanning') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md text-center p-8 bg-white dark:bg-slate-900 rounded-xl shadow-lg">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Scanning for Backend</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Detecting CtrlClaw backend on common ports...
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'detected') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">CtrlClaw Setup</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Smart configuration assistant detected your environment
            </p>
          </div>

          {/* Detection Results */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {discovery?.found ? (
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              Backend Detection
            </h2>
            
            <div className="space-y-4">
              {discovery?.found ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Detected URL</label>
                    <input 
                      type="text"
                      value={discovery.httpUrl}
                      readOnly
                      className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">WebSocket URL</label>
                    <input 
                      type="text"
                      value={discovery.wsUrl}
                      readOnly
                      className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      No backend detected automatically. You can:
                    </p>
                    <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                      <li>Enter the URL manually below</li>
                      <li>Use Mock mode for development</li>
                      <li>Check if your backend is running</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Backend URL (Manual)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="http://localhost:3001"
                        value={config?.httpUrl || ''}
                        onChange={(e) => handleManualUrl(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg"
                      />
                      <button 
                        onClick={testConnections}
                        disabled={httpStatus.testing}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50"
                      >
                        {httpStatus.testing ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Connection Status */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  httpStatus.success ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  HTTP {httpStatus.testing ? 'testing...' : httpStatus.success ? 'OK' : 'pending'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  wsStatus.success ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  WebSocket {wsStatus.testing ? 'testing...' : wsStatus.success ? 'OK' : 'pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Scenario Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              Deployment Scenario
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Select your deployment mode to apply appropriate defaults
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { value: 'local', label: 'Local Dev', icon: '💻', desc: 'localhost, HTTP' },
                { value: 'vps', label: 'VPS', icon: '🖥️', desc: 'HTTPS + WSS, Domain' },
                { value: 'tunnel', label: 'Secure Tunnel', icon: '🔒', desc: 'Cloudflare, HTTPS' },
              ].map((opt) => (
                <label 
                  key={opt.value}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    config?.scenario === opt.value 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="scenario" 
                    value={opt.value}
                    checked={config?.scenario === opt.value}
                    onChange={() => handleScenarioChange(opt.value as SetupConfig['scenario'])}
                    className="sr-only"
                  />
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-slate-500 text-center">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Mode Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Backend Mode
            </h2>
            
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <label className="font-medium">Use Mock Backend</label>
                <p className="text-sm text-slate-500">
                  Simulate all backend responses (good for development)
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config?.useMock}
                  onChange={(e) => config && setConfig({ ...config, useMock: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {config?.useMock && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Simulated Latency (ms)</label>
                  <input 
                    type="number" 
                    value={config.mockLatency}
                    onChange={(e) => setConfig({ ...config, mockLatency: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Failure Rate (0-1)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="1"
                    value={config.mockFailureRate}
                    onChange={(e) => setConfig({ ...config, mockFailureRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Rescan
            </button>
            <button 
              onClick={handleFinish}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              Review Configuration
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'review' && config) {
    const envContent = generateEnvFile(config);
    
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Review Configuration</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Save this configuration to <code className="text-sm bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">.env.local</code>
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Environment Variables
              </h2>
              <button 
                onClick={handleCopyEnv}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy All
              </button>
            </div>
            
            <pre className="p-4 rounded-lg bg-slate-100 dark:bg-slate-900 text-sm font-mono overflow-x-auto">
              {envContent}
            </pre>
            
            <div className="mt-6 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p>1. Create a file named <code>.env.local</code> in your project root</p>
              <p>2. Paste the content above</p>
              <p>3. Restart your Next.js development server</p>
            </div>
          </div>

          <div className="flex justify-between">
            <button 
              onClick={() => setPhase('detected')}
              className="px-4 py-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Back
            </button>
            <button 
              onClick={() => {
                toast.success('Setup complete! Redirecting...');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Finish Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
