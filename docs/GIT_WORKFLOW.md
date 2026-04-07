# Git Workflow - CtrlClaw

**Guia para versionamento organizado do projeto**

---

## Checklist Pré-Commit

### 1. Arquivos que DEVEM ser commitados ✅

```
# Configuração
.env.example          # Template de configuração (SEM segredos)
.gitignore           # Regras de ignore atualizadas
package.json         # Dependências
next.config.ts       # Config Next.js
tsconfig.json        # Config TypeScript
postcss.config.mjs   # Config PostCSS
eslint.config.mjs    # Config ESLint

# Código fonte
src/                 # Todo o código fonte
  app/              # Rotas Next.js
  features/         # Funcionalidades
  components/       # Componentes compartilhados
  lib/              # Bibliotecas core
  hooks/            # React hooks
  types/            # TypeScript types

# Backend mock (para desenvolvimento)
test-backend/        # Mock backend
  server.mjs        # Servidor mock
  package.json      # Deps do mock

# Scripts
scripts/            # Scripts utilitários
  setup.mjs        # Setup wizard

# Documentação
docs/               # Documentação técnica
README.md          # README principal
LICENSE            # Licença MIT
ARCHITECTURE.md    # Arquitetura do projeto
AGENTS.md          # Guia para agentes

# Assets
public/            # Assets estáticos
```

### 2. Arquivos que NÃO DEVEM ser commitados ❌

```
# Secrets e configurações locais
.env
.env.local
.env.*.local

# Dependências
node_modules/

# Build output
.next/
dist/
build/

# Logs
*.log
*.err
npm-debug.log*

# Arquivos temporários
*.tmp
*.temp
.cache/

# IDE
.vscode/settings.json  # (exceto config compartilhada)
.idea/
*.swp

# Dados de sessão
.specstory/
kimi-export-*.md

# Lock files (opcional - pode incluir se quiser reprodutibilidade)
# package-lock.json  # Incluir para CI/CD consistente
```

### 3. Verificação de Segurança 🔒

Antes de cada commit, verifique:

```bash
# Não há segredos no código?
grep -r "password\|secret\|token\|key" src/ --include="*.ts" --include="*.tsx" | grep -v "// " | grep -v "/\*"

# .env.local está no .gitignore?
cat .gitignore | grep "\.env"

# Não há logs ou erros?
ls *.log *.err 2>/dev/null && echo "❌ Remover logs" || echo "✅ Sem logs"
```

---

## Estratégia de Commits

### Opção 1: Commits por Fase (Recomendado)

Criar commits históricos que representam o marco de cada fase:

```bash
# Fase 1: Foundation
git add .
git commit -m "fase-1: foundation - Next.js, TypeScript, Tailwind, shadcn/ui

- Setup Next.js 15 with App Router
- TypeScript strict mode
- Tailwind CSS 4 configuration
- shadcn/ui integration
- Security headers and CSP setup
- Project structure and conventions

Refs: ARCHITECTURE.md#fase-1"

# Fase 2: Backend Adapter
git add .
git commit -m "fase-2: backend adapter pattern

- ClawBackendAdapter interface
- NanoClawAdapter structure
- MockAdapter for development
- Backend factory and configuration
- Environment-based backend selection

Refs: ARCHITECTURE.md#fase-2"

# Fase 3: Auth, WebSocket, Stores
git add .
git commit -m "fase-3: auth, websocket and state management

- Authentication service with session persistence
- WebSocket manager with reconnection
- Zustand stores (auth, chat, runtime)
- useWebSocket and useAuth hooks
- Session timeout and idle detection

Refs: ARCHITECTURE.md#fase-3"

# Fase 4: UI Layout
git add .
git commit -m "fase-4: main layout and UI components

- App layout with sidebar
- ChatContainer component
- MessageList, MessageInput, MessageBubble
- ConnectionStatus indicator
- IdleWarning component

Refs: ARCHITECTURE.md#fase-4"

# Fase 5: Smart Setup
git add .
git commit -m "fase-5: smart setup and local integration

- Discovery engine (port scanning)
- Env-manager (.env.local generation)
- Setup wizard (/setup page)
- CLI setup script (scripts/setup.mjs)
- CSP/CORS fixes for local development
- Login persistence fix

Refs: ARCHITECTURE.md#fase-5"

# Fase 6: Functional Chat
git add .
git commit -m "fase-6: functional chat with stability

- Backend mock with chat endpoints
- Chat service with HTTP API
- WebSocket message events
- Message deduplication
- History lazy loading
- Conversation sidebar
- Deep link support (/chat/:id)
- Race condition protection
- Toast notifications
- Retry with exponential backoff
- Loading states and error handling

Refs: ARCHITECTURE.md#fase-6"

# Fase 7: Memory and Context (WIP)
git add .
git commit -m "fase-7: memory and context foundation

- IndexedDB schema (metadados only)
- Memory service with limits
- Context service with sliding window
- MockSummarizer for development
- ContextPanel UI component
- Conversation search by keywords/tags
- Context assembly with truncation
- Security: no message content in IndexedDB

Refs: ARCHITECTURE.md#fase-7"
```

### Opção 2: Commits Incrementais (Desenvolvimento Ativo)

Para desenvolvimento contínuo, usar commits menores:

```bash
# Padrão de mensagem:
# <tipo>: <descrição curta>
#
# <corpo explicativo>

feat: add ContextPanel component for context visualization

- Shows context status (active/truncated/loading)
- Displays summary and recent messages
- Includes reload and clear actions
- Progress bar for context usage

Refs: fase-7

fix: prevent duplicate messages in chat store

- Check message.id before adding
- Update existing messages instead of duplicating

Refs: fase-6
```

Tipos de commit:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `refactor`: Refatoração de código
- `test`: Testes
- `chore`: Tarefas de manutenção

---

## Branches

### Estrutura Proposta

```
main                    # Produção estável
├── develop             # Desenvolvimento (opcional)
├── feature/fase-7      # Feature branches
├── hotfix/...          # Correções urgentes
└── docs/...            # Atualizações de docs
```

### Para este projeto

Dado o tamanho atual, recomendo:

1. **main** - Branch principal com código estável
2. **feature/*** - Branches para novas features (ex: `feature/semantic-search`)

Comandos:

```bash
# Criar nova feature branch
git checkout -b feature/context-injection

# Trabalhar...
git add .
git commit -m "feat: implement context injection to agents"

# Voltar para main e merge
git checkout main
git merge feature/context-injection
git branch -d feature/context-injection
```

---

## Primeiro Push (Setup Inicial)

```bash
# 1. Verificar status
git status

# 2. Verificar o que vai subir
git add --dry-run .

# 3. Adicionar arquivos (exceto ignorados)
git add .

# 4. Criar commit inicial
# (escolher Opção 1 ou 2 acima)

# 5. Verificar commit
git log --oneline -1
git show --stat

# 6. Adicionar remote (se necessário)
git remote add origin https://github.com/eduardoabreu81/ctrlclaw.git

# 7. Push
# Para repositório novo:
git push -u origin main

# Ou force push se necessário (cuidado!)
git push -u origin main --force
```

---

## Verificações Finais

Antes do primeiro push, execute:

```bash
# 1. Verificar arquivos grandes
find . -type f -size +1M ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./.next/*"

# 2. Verificar secrets
npm run lint  # Se configurado
# ou
grep -r "BEGIN RSA\|BEGIN OPENSSH\|apikey\|api_key" src/ --include="*.ts"

# 3. Verificar build
npm run build

# 4. Verificar TypeScript
npx tsc --noEmit

# 5. Verificar o que será enviado
git ls-files | wc -l  # Quantidade de arquivos
du -sh .git           # Tamanho do repo
```

---

## Recuperação de Erros

### Se subiu arquivo sensível acidentalmente

```bash
# 1. Adicionar ao .gitignore
echo "arquivo-sensivel.env" >> .gitignore

# 2. Remover do git (mas manter local)
git rm --cached arquivo-sensivel.env

# 3. Commit
git commit -m "fix: remove sensitive file from repo"

# 4. Se já fez push (⚠️ histórico permanece visível)
git push

# 5. Para remover do histórico completamente (⚠️ reescreve histórico)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch arquivo-sensivel.env' \
  HEAD
```

### Se quiser recomeçar o histórico

```bash
# Cuidado: perde todo histórico!
rm -rf .git
git init
git add .
git commit -m "feat: initial commit - CtrlClaw v1"
git remote add origin https://github.com/eduardoabreu81/ctrlclaw.git
git push -u origin main --force
```

---

## Resumo para Primeiro Push

```bash
# 1. Preparação
# - .gitignore atualizado ✅
# - .env.example criado ✅
# - Logs removidos ✅
# - README.md pronto ✅
# - LICENSE adicionado ✅

# 2. Verificação
git status                    # Ver arquivos unstaged
git add --dry-run .          # Simular add
git add .                    # Adicionar tudo

# 3. Commit
# (usar mensagens da Opção 1 - Commits por Fase)

# 4. Push
git remote -v                # Verificar remote
git push -u origin main      # Push inicial

# 5. Verificação no GitHub
# - Abrir https://github.com/eduardoabreu81/ctrlclaw
# - Verificar arquivos
# - Verificar se .env.local NÃO está lá
```

---

*Documentação de workflow Git - CtrlClaw*
