'use client';

import { useEffect, useState } from 'react';

export default function TestPage() {
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar configurações disponíveis no cliente
    setConfig({
      BACKEND_ADAPTER: process.env.NEXT_PUBLIC_BACKEND_ADAPTER,
      BACKEND_HTTP_URL: process.env.NEXT_PUBLIC_BACKEND_HTTP_URL,
      BACKEND_WS_URL: process.env.NEXT_PUBLIC_BACKEND_WS_URL,
    });
  }, []);

  const testLogin = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' }),
      });
      
      if (!response.ok) {
        setError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      alert('Login OK! Token: ' + data.token.substring(0, 20) + '...');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!config) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Diagnóstico de Configuração</h1>
      
      <div className="mb-6 p-4 bg-slate-100 rounded">
        <h2 className="font-semibold mb-2">Configurações do Cliente:</h2>
        <pre className="text-sm">{JSON.stringify(config, null, 2)}</pre>
      </div>

      <div className="mb-6">
        <button 
          onClick={testLogin}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Testar Login Direto (fetch)
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded">
          <strong>Erro:</strong> {error}
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 text-sm">
        <h3 className="font-semibold mb-2">Notas:</h3>
        <ul className="list-disc pl-4 space-y-1">
          <li>Se BACKEND_ADAPTER estiver vazio, vai usar &quot;mock&quot;</li>
          <li>Se as URLs estiverem vazias, vai usar localhost:3001</li>
          <li>O teste de login chama diretamente http://localhost:3001/api/auth/login</li>
        </ul>
      </div>
    </div>
  );
}
