import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { carregarAvaliador, carregarFila, type Avaliador } from '@/api/avaliacoes';
import type { ItemFila } from '@/lib/avaliacao';

type Aviso = { tipo: 'sucesso' | 'erro'; mensagem: string };

type Estado = {
  avaliador: Avaliador | null;
  fila: ItemFila[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  aviso: Aviso | null;
  avisar: (aviso: Aviso) => void;
  limparAviso: () => void;
};

const Contexto = createContext<Estado | null>(null);

/**
 * A fila fica aqui, e não em cada tela, porque a lista e a ficha mostram os
 * mesmos grupos: finalizar na ficha precisa atualizar o selo na lista.
 */
export function AvaliacaoProvider({ children }: { children: ReactNode }) {
  const [avaliador, setAvaliador] = useState<Avaliador | null>(null);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const aplicar = useCallback((busca: Promise<[Avaliador, ItemFila[]]>) => {
    return busca
      .then(([quem, grupos]) => {
        setAvaliador(quem);
        setFila(grupos);
        setErro(null);
      })
      .catch(() => setErro('Não foi possível carregar a sua fila. Puxe para baixo para tentar de novo.'))
      .finally(() => setCarregando(false));
  }, []);

  const recarregar = useCallback(
    () => aplicar(Promise.all([carregarAvaliador(), carregarFila()])),
    [aplicar]
  );

  useEffect(() => {
    aplicar(Promise.all([carregarAvaliador(), carregarFila()]));
  }, [aplicar]);

  const limparAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo(
    () => ({ avaliador, fila, carregando, erro, recarregar, aviso, avisar: setAviso, limparAviso }),
    [avaliador, fila, carregando, erro, recarregar, aviso, limparAviso]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAvaliacao(): Estado {
  const estado = useContext(Contexto);
  if (!estado) {
    throw new Error('useAvaliacao precisa estar dentro de <AvaliacaoProvider>.');
  }

  return estado;
}
