# Setup Local - CtrlClaw

Guia completo para rodar o projeto localmente.

---

## Requisitos

- Node.js 18+
- npm ou yarn
- Git

---

## 1. Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd ctrlclaw

# Instale dependências
npm install
```

---

## 2. Configuração

### 2.1 Criar arquivo de ambiente

```bash
cp .env.example .env.local
```

### 2.2 Configurar para Mock (desenvolvimento)

Edite `.env.local`:

```bash
# Modo de desenvolvimento
NODE_ENV=development

# Backend Mock
BACKEND_ADAPTER=mock
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001

# Frontend
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Segurança
SESSION_TTL_MINUTES=30
IDLE_TIMEOUT_MINUTES=30
ABSOLUTE_TIMEOUT_HOURS=24
```

---

## 3. Rodar o Projeto

### 3.1 Modo Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### 3.2 Credenciais de Teste (Mock)

| Usuário | Senha | Permissões |
|---------|-------|------------|
| admin | admin123 | read, write, admin |
| user | user123 | read, write |

---

## 4. Alternar para Backend Real

### 4.1 Configurar variáveis

```bash
# Edite .env.local
BACKEND_ADAPTER=nanoclaw
CLAW_API_URL=https://seu-backend.com
CLAW_WS_URL=wss://seu-backend.com
FRONTEND_URL=https://seu-frontend.com
ALLOWED_ORIGINS=https://seu-frontend.com
```

### 4.2 Rebuild

```bash
npm run build
npm start
```

---

## 5. Estrutura de Desenvolvimento

```
ctrlclaw/
├── src/
│   ├── app/           # Rotas Next.js
│   ├── features/      # Auth, Chat, Agents
│   ├── adapters/      # Backend adapters
│   ├── lib/           # Utilitários
│   ├── hooks/         # React hooks
│   ├── stores/        # Zustand stores
│   └── types/         # TypeScript
├── docs/              # Documentação
├── .env.local         # Configuração local
└── package.json
```

---

## 6. Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build produção
npm run build

# Servir build
npm start

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## 7. Troubleshooting

### Porta 3000 ocupada

```bash
# Use outra porta
npm run dev -- --port 3001
```

### Erro de CORS

Verifique se `ALLOWED_ORIGINS` inclui a URL do frontend.

### WebSocket não conecta

Verifique se `CLAW_WS_URL` está correto (ws:// para HTTP, wss:// para HTTPS).

---

## Próximos Passos

- [Variáveis de Ambiente](environment.md)
- [Status do Projeto](status-fase4.md)
- [Limitações](limitacoes-v1.md)
