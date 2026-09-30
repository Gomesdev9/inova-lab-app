import type { Nivel } from '@/lib/avaliacao';

/**
 * Cores do selo de cada menção, as mesmas de mencao_classes() no site: A em
 * verde, PA em amarelo, NA em vermelho. Sem menção (nada marcado), neutro.
 */
export const CORES_MENCAO: Record<Nivel | 'nenhuma', { fundo: string; texto: string }> = {
  otimo: { fundo: 'bg-tertiary-fixed', texto: 'text-on-tertiary-fixed-variant' },
  bom: { fundo: 'bg-amber-100 dark:bg-amber-400/20', texto: 'text-amber-900 dark:text-amber-200' },
  regular: { fundo: 'bg-error-container', texto: 'text-on-error-container' },
  nenhuma: { fundo: 'bg-surface-container', texto: 'text-on-surface-variant' },
};
