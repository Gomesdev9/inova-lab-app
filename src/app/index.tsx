import { Redirect } from 'expo-router';

import { useAvaliacao } from '@/context/AvaliacaoContext';

// Sem e-mail, o tablet ainda não sabe quem vai avaliar: pede primeiro.
export default function Inicio() {
  const { pronto, email } = useAvaliacao();

  if (!pronto) {
    return null;
  }

  return <Redirect href={email ? '/avaliacao' : '/identificacao'} />;
}
