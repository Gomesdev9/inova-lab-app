import { Redirect } from 'expo-router';

import { useAvaliacao } from '@/context/AvaliacaoContext';

// Sem ninguém com o tablet, mostra a lista para o avaliador escolher o nome.
export default function Inicio() {
  const { pronto, atual } = useAvaliacao();

  if (!pronto) {
    return null;
  }

  return <Redirect href={atual ? '/avaliacao' : '/identificacao'} />;
}
