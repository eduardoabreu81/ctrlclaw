'use client';

import { useEffect, useState } from 'react';

export default function AuthDebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [sessionStorageData, setSessionStorageData] = useState<string>('{}');

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    addLog('Página de diagnóstico carregada');
    
    // Verificar sessionStorage
    const data: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        data[key] = sessionStorage.getItem(key) || '';
      }
    }
    setSessionStorageData(JSON.stringify(data, null, 2));
    addLog(`SessionStorage keys: ${Object.keys(data).join(', ') || '(vazio)'}`);
  }, []);

  const testFullLoginFlow = async () => {
    setLogs([]);
    
    // 1. Verificar sessionStorage antes
    addLog('=== TESTE FLUXO COMPLETO ===');
    addLog('1. Verificando sessionStorage antes do login...');
    const before = sessionStorage.getItem('ctrlclaw_session');
    addLog(`   sessionStorage antes: ${before ? 'TEM DADOS' : 'VAZIO'}`);

    // 2. Fazer login
    addLog('2. Fazendo POST /api/auth/login...');
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' })
      });
      
      const data = await response.json();
      addLog(`   Status: ${response.status}`);
      addLog(`   Token recebido: ${data.token ? data.token.substring(0, 20) + '...' : 'NENHUM'}`);
      addLog(`   ExpiresIn: ${data.expiresIn}`);
      addLog(`   Username: ${data.username}`);

      if (response.ok && data.token) {
        // 3. Salvar no sessionStorage (simular o que o AuthService deveria fazer)
        addLog('3. Salvando sessão no sessionStorage...');
        const session = {
          token: data.token,
          user: data.user,
          expiresAt: new Date(Date.now() + data.expiresIn * 1000).toISOString(),
          obtainedAt: new Date().toISOString()
        };
        sessionStorage.setItem('ctrlclaw_session', JSON.stringify(session));
        addLog('   ✅ Sessão salva no sessionStorage');

        // 4. Verificar sessionStorage depois
        addLog('4. Verificando sessionStorage depois...');
        const after = sessionStorage.getItem('ctrlclaw_session');
        addLog(`   sessionStorage depois: ${after ? 'TEM DADOS' : 'VAZIO'}`);

        // 5. Atualizar display
        const allData: Record<string, string> = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) allData[key] = sessionStorage.getItem(key) || '';
        }
        setSessionStorageData(JSON.stringify(allData, null, 2));

        addLog('5. ✅ FLUXO COMPLETO OK');
        addLog('   Próximo passo: navegar para /chat');
      }
    } catch (e: any) {
      addLog(`   ❌ Erro: ${e.message}`);
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem('ctrlclaw_session');
    addLog('SessionStorage limpo');
    setSessionStorageData('{}');
  };

  const goToChat = () => {
    window.location.href = '/chat';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔍 Diagnóstico de Autenticação</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controles */}
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h2 className="font-semibold mb-3">Ações</h2>
            <div className="space-y-2">
              <button 
                onClick={testFullLoginFlow}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Testar Fluxo Completo de Login
              </button>
              <button 
                onClick={clearSession}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Limpar SessionStorage
              </button>
              <button 
                onClick={goToChat}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Ir para /chat
              </button>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <h2 className="font-semibold mb-2">Análise do Problema</h2>
            <ul className="text-sm space-y-1 list-disc pl-4">
              <li>Login funciona (token é recebido)</li>
              <li>Mas sessão não persiste após redirect</li>
              <li>Causa provável: <code>rememberMe=false</code> no LoginForm</li>
              <li>Sem persistência, sessão se perde no reload</li>
            </ul>
          </div>
        </div>

        {/* SessionStorage */}
        <div className="p-4 bg-gray-100 rounded-lg">
          <h2 className="font-semibold mb-2">SessionStorage Atual</h2>
          <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-auto max-h-60">
            {sessionStorageData}
          </pre>
        </div>
      </div>

      {/* Logs */}
      <div className="mt-6 p-4 bg-black text-green-400 rounded-lg font-mono text-sm">
        <h2 className="font-semibold mb-2 text-white">Logs</h2>
        <div className="space-y-1 max-h-80 overflow-auto">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
          {logs.length === 0 && <span className="text-gray-500">Nenhum log ainda...</span>}
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
        <h2 className="font-semibold mb-2">Como Diagnosticar</h2>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Abra o DevTools (F12) → Console</li>
          <li>Clique em "Testar Fluxo Completo de Login"</li>
          <li>Observe se o sessionStorage é preenchido</li>
          <li>Clique em "Ir para /chat"</li>
          <li>Se for redirecionado de volta para login, o problema é confirmado</li>
        </ol>
      </div>
    </div>
  );
}
