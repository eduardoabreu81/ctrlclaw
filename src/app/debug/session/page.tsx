'use client';

import { useState, useEffect } from 'react';

export default function SessionDebugPage() {
  const [sessionData, setSessionData] = useState<string>('{}');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const refreshSessionData = () => {
    if (typeof window === 'undefined') return;
    
    const data: Record<string, any> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          data[key] = JSON.parse(sessionStorage.getItem(key) || '');
        } catch {
          data[key] = sessionStorage.getItem(key);
        }
      }
    }
    setSessionData(JSON.stringify(data, null, 2));
    addLog(`SessionStorage atualizado: ${Object.keys(data).length} chaves`);
  };

  useEffect(() => {
    refreshSessionData();
    
    // Atualizar a cada 2 segundos
    const interval = setInterval(refreshSessionData, 2000);
    return () => clearInterval(interval);
  }, []);

  const clearSession = () => {
    sessionStorage.clear();
    addLog('SessionStorage LIMPO');
    refreshSessionData();
  };

  const simulateLogin = () => {
    addLog('Simulando login...');
    const session = {
      token: 'test-token-' + Date.now(),
      user: { username: 'admin', permissions: ['read', 'write', 'admin'] },
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      obtainedAt: new Date().toISOString()
    };
    sessionStorage.setItem('ctrlclaw_session', JSON.stringify(session));
    addLog('Sessão SIMULADA salva no sessionStorage');
    refreshSessionData();
  };

  const goToChat = () => {
    window.location.href = '/chat';
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SessionStorage Debug</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="p-4 bg-blue-50 rounded mb-4">
            <h2 className="font-semibold mb-2">Ações</h2>
            <div className="space-y-2">
              <button onClick={refreshSessionData} className="w-full px-4 py-2 bg-blue-600 text-white rounded">
                Atualizar Dados
              </button>
              <button onClick={simulateLogin} className="w-full px-4 py-2 bg-green-600 text-white rounded">
                Simular Login (salvar sessão fake)
              </button>
              <button onClick={goToChat} className="w-full px-4 py-2 bg-purple-600 text-white rounded">
                Ir para /chat
              </button>
              <button onClick={clearSession} className="w-full px-4 py-2 bg-red-600 text-white rounded">
                Limpar SessionStorage
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="font-semibold mb-2">Logs</h2>
            <div className="bg-black text-green-400 p-2 rounded text-xs h-40 overflow-auto font-mono">
              {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
          </div>
        </div>
        
        <div>
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="font-semibold mb-2">SessionStorage Atual (atualiza a cada 2s)</h2>
            <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-auto text-xs h-96">
              {sessionData}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
