/**
 * Memory Feature - Barrel Export
 * 
 * Fase 7: Memória, Contexto e Agentes
 */

// Services
export { getMemoryService, resetMemoryService, MemoryService } from './services/memory-service';
export { getContextService, resetContextService, ContextService, CONTEXT_LIMITS } from './services/context-service';

// Hooks
export { useMemory } from './hooks/use-memory';

// Components
export { ContextPanel } from './components/ContextPanel';
export { ConversationSearch } from './components/ConversationSearch';
