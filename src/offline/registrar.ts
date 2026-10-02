import {
  PARECER_MAXIMO,
  criteriosMarcados,
  descreverMencao,
  limparNiveis,
  mencao,
  pontos,
  proximoPendente,
  type ItemFila,
  type Niveis,
} from '@/lib/avaliacao';

import { gravarFicha } from './armazem';

export type ResultadoSalvar = {
  ok: boolean;
  /** Se a ficha foi gravada. Pode vir true com ok false: faltou critério e ela ficou como rascunho. */
  salvo: boolean;
  mensagem: string;
  /** Depois de finalizar: o próximo grupo da fila a abrir, se houver. */
  proximoUuid?: string;
};

/**
 * Salva a ficha do avaliador no tablet, com as mesmas regras e mensagens de
 * RegistroAvaliacao.php no site. Precisa ser igual: no dia da feira ninguém
 * confere com o servidor, e o que o app aceitar aqui é o que vai ser enviado
 * depois. O servidor confere de novo ao receber.
 */
export async function registrarNoAparelho(
  email: string,
  fila: ItemFila[],
  uuid: string,
  niveisMarcados: Niveis,
  comentariosDigitados: string,
  acao: 'rascunho' | 'finalizar'
): Promise<ResultadoSalvar> {
  const indice = fila.findIndex((item) => item.projeto.uuid === uuid);
  const item = fila[indice];

  if (!item) {
    return { ok: false, salvo: false, mensagem: 'Projeto não encontrado ou ainda não enviado.' };
  }

  if (item.travada) {
    return {
      ok: false,
      salvo: false,
      mensagem: 'As menções desta feira já foram liberadas para os alunos, então a avaliação está travada. Fale com a coordenação se precisar corrigir algo.',
    };
  }

  // A ficha é a da feira do projeto, como o admin cadastrou.
  const criterios = item.projeto.criterios;
  if (criterios.length === 0) {
    return { ok: false, salvo: false, mensagem: 'A coordenação ainda não cadastrou os critérios de avaliação desta feira.' };
  }

  const texto = comentariosDigitados.trim();
  if (texto.length > PARECER_MAXIMO) {
    return { ok: false, salvo: false, mensagem: `O parecer ficou com ${texto.length} caracteres, e o limite é ${PARECER_MAXIMO}.` };
  }

  const niveis = limparNiveis(niveisMarcados, criterios);
  const comentarios = texto !== '' ? texto : null;
  const existente = item.avaliacao;
  const jaFinalizada = existente?.status === 'finalizada';
  const faltam = criterios.length - criteriosMarcados(niveis, criterios);

  // Finalizada não volta a ser rascunho: revisar continua valendo, mas
  // sempre com todos os critérios da feira.
  const finalizar = acao === 'finalizar' || jaFinalizada;

  if (!finalizar && !existente && faltam === criterios.length && comentarios === null) {
    return { ok: false, salvo: false, mensagem: 'Marque ao menos um critério ou escreva o parecer antes de salvar o rascunho.' };
  }

  if (finalizar && faltam > 0) {
    if (jaFinalizada) {
      return { ok: false, salvo: false, mensagem: 'Uma avaliação finalizada precisa manter todos os critérios marcados.' };
    }

    // O que já foi marcado não se perde porque faltou um critério.
    await gravarFicha(email, uuid, { niveis, comentarios, status: 'rascunho' });
    return {
      ok: false,
      salvo: true,
      mensagem: `Rascunho salvo, mas ${faltam === 1 ? 'falta 1 critério' : `faltam ${faltam} critérios`} para finalizar.`,
    };
  }

  await gravarFicha(email, uuid, { niveis, comentarios, status: finalizar ? 'finalizada' : 'rascunho' });

  if (!finalizar) {
    return { ok: true, salvo: true, mensagem: 'Rascunho salvo. Você pode voltar e terminar depois.' };
  }

  const final = descreverMencao(mencao(pontos(niveis, criterios)));

  if (jaFinalizada) {
    return { ok: true, salvo: true, mensagem: `Avaliação atualizada. Menção ${final}.` };
  }

  // A fila recebida é a de antes de salvar: este grupo conta como avaliado.
  const depois = fila.map((outro, posicao) => (posicao === indice ? { ...outro, situacao: 'avaliado' as const } : outro));
  const proximo = proximoPendente(depois, indice);

  if (proximo === null) {
    return { ok: true, salvo: true, mensagem: `Avaliação finalizada com menção ${final}. Você avaliou todos os grupos da sua fila.` };
  }

  return {
    ok: true,
    salvo: true,
    mensagem: `Avaliação finalizada com menção ${final}. Este é o próximo grupo da fila.`,
    proximoUuid: depois[proximo].projeto.uuid,
  };
}
