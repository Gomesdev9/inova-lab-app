import {
  CHAVES_CRITERIOS,
  NIVEIS,
  PARECER_MAXIMO,
  criteriosMarcados,
  formatNota,
  pontos,
  proximoPendente,
  situacaoDe,
  type Avaliacao,
  type ItemFila,
  type Niveis,
  type Projeto,
} from '@/lib/avaliacao';

import { avaliadorMock, detalhesMock, fichasMock, projetosMock } from './mock';

/**
 * Tudo o que a tela de avaliação pede ao servidor passa por aqui.
 *
 * O site ainda não tem API JSON: as rotas de /orientador/avaliacao devolvem
 * HTML e dependem da sessão PHP com CSRF. Enquanto isso, este módulo responde
 * com dados de exemplo e repete as regras de OrientadorController::avaliacaoSalvar,
 * para a tela já se comportar como vai se comportar de verdade. Quando a API
 * existir, só o corpo destas funções muda.
 */

export type Avaliador = { nome: string; email: string };

export type DetalheProjeto = {
  membros: string[];
  resumoUrl: string | null;
  bannerUrl: string | null;
};

export type ResultadoSalvar = {
  ok: boolean;
  /** Se a ficha foi gravada. Pode vir true com ok false: faltou critério e ela ficou como rascunho. */
  salvo: boolean;
  mensagem: string;
  /** Depois de finalizar: o próximo grupo da fila a abrir, se houver. */
  proximoUuid?: string;
};

// As fichas deste avaliador, por uuid do projeto. No servidor é a tabela
// avaliacoes; aqui vive só enquanto o app está aberto.
const fichas = new Map<string, Avaliacao>(Object.entries(fichasMock));

const espera = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

function montarFila(): ItemFila[] {
  return projetosMock.map((projeto: Projeto) => {
    const avaliacao = fichas.get(projeto.uuid) ?? null;

    return {
      projeto,
      avaliacao,
      situacao: situacaoDe(avaliacao),
      pontos: pontos(avaliacao),
      marcados: criteriosMarcados(avaliacao),
      travada: projeto.notas_liberadas_at !== null,
    };
  });
}

export async function carregarAvaliador(): Promise<Avaliador> {
  await espera(150);
  return avaliadorMock;
}

export async function carregarFila(): Promise<ItemFila[]> {
  await espera();
  return montarFila();
}

export async function carregarDetalhe(uuid: string): Promise<DetalheProjeto> {
  await espera(200);
  return detalhesMock[uuid] ?? { membros: [], resumoUrl: null, bannerUrl: null };
}

/**
 * "rascunho" guarda o que já foi marcado, mesmo incompleto; "finalizar" exige
 * os cinco critérios. Mesmas mensagens do site.
 */
export async function salvarAvaliacao(
  uuid: string,
  niveis: Niveis,
  comentariosDigitados: string,
  acao: 'rascunho' | 'finalizar'
): Promise<ResultadoSalvar> {
  await espera();

  const projeto = projetosMock.find((item) => item.uuid === uuid);
  if (!projeto) {
    return { ok: false, salvo: false, mensagem: 'Projeto não encontrado ou ainda não enviado.' };
  }

  if (projeto.notas_liberadas_at !== null) {
    return {
      ok: false,
      salvo: false,
      mensagem:
        'As notas desta feira já foram liberadas para os alunos, então a avaliação está travada. Fale com a coordenação se precisar corrigir algo.',
    };
  }

  if (CHAVES_CRITERIOS.some((criterio) => niveis[criterio] !== null && !(niveis[criterio]! in NIVEIS))) {
    return { ok: false, salvo: false, mensagem: 'Escolha Regular, Bom ou Ótimo em cada critério.' };
  }

  const texto = comentariosDigitados.trim();
  if (texto.length > PARECER_MAXIMO) {
    return { ok: false, salvo: false, mensagem: `O parecer ficou com ${texto.length} caracteres, e o limite é ${PARECER_MAXIMO}.` };
  }

  const comentarios = texto !== '' ? texto : null;
  const existente = fichas.get(uuid);
  const jaFinalizada = existente?.status === 'finalizada';
  const faltam = CHAVES_CRITERIOS.length - criteriosMarcados(niveis);

  // Finalizada não volta a ser rascunho: revisar continua valendo, mas
  // sempre com os cinco critérios.
  const finalizar = acao === 'finalizar' || jaFinalizada;

  if (!finalizar && !existente && faltam === CHAVES_CRITERIOS.length && comentarios === null) {
    return { ok: false, salvo: false, mensagem: 'Marque ao menos um critério ou escreva o parecer antes de salvar o rascunho.' };
  }

  if (finalizar && faltam > 0) {
    if (jaFinalizada) {
      return { ok: false, salvo: false, mensagem: 'Uma avaliação finalizada precisa manter os cinco critérios marcados.' };
    }

    // O que já foi marcado não se perde porque faltou um critério.
    fichas.set(uuid, { ...niveis, comentarios, status: 'rascunho' });
    return {
      ok: false,
      salvo: true,
      mensagem: `Rascunho salvo, mas ${faltam === 1 ? 'falta 1 critério' : `faltam ${faltam} critérios`} para finalizar.`,
    };
  }

  fichas.set(uuid, { ...niveis, comentarios, status: finalizar ? 'finalizada' : 'rascunho' });

  if (!finalizar) {
    return { ok: true, salvo: true, mensagem: 'Rascunho salvo. Você pode voltar e terminar depois.' };
  }

  const nota = formatNota(pontos(niveis));

  if (jaFinalizada) {
    return { ok: true, salvo: true, mensagem: `Avaliação atualizada. Nota ${nota} de 5,00.` };
  }

  const fila = montarFila();
  const proximo = proximoPendente(fila, fila.findIndex((item) => item.projeto.uuid === uuid));

  if (proximo === null) {
    return { ok: true, salvo: true, mensagem: `Avaliação finalizada com nota ${nota}. Você avaliou todos os grupos da sua fila.` };
  }

  return {
    ok: true,
    salvo: true,
    mensagem: `Avaliação finalizada com nota ${nota}. Este é o próximo grupo da fila.`,
    proximoUuid: fila[proximo].projeto.uuid,
  };
}
