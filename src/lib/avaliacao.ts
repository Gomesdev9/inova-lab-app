/**
 * A ficha de avaliação, espelhando app/Models/Avaliacao.php do site: cinco
 * critérios, cada um Regular, Bom ou Ótimo, e um parecer opcional. Os valores
 * precisam ser os mesmos de lá, senão a nota que o avaliador vê aqui não bate
 * com a que o servidor grava.
 */

export const CRITERIOS = {
  funcionalidade: {
    titulo: 'Funcionalidade',
    descricao: 'O projeto executa todas as tarefas propostas de forma estável, sem travamentos ou erros críticos.',
  },
  usabilidade: {
    titulo: 'Usabilidade e visual',
    descricao: 'A interface é intuitiva, o design é agradável e o projeto proporciona uma boa experiência de uso.',
  },
  originalidade: {
    titulo: 'Originalidade',
    descricao: 'O projeto apresenta uma solução criativa, inovadora ou um diferencial claro em relação a projetos similares.',
  },
  conclusao: {
    titulo: 'Nível de conclusão',
    descricao: 'O projeto foi entregue polido e completo, ou ainda faltam funcionalidades para a sua conclusão.',
  },
  apresentacao: {
    titulo: 'Apresentação e entrega',
    descricao: 'O grupo demonstrou domínio técnico sobre o projeto e o apresentou de forma clara.',
  },
} as const;

export type Criterio = keyof typeof CRITERIOS;
export const CHAVES_CRITERIOS = Object.keys(CRITERIOS) as Criterio[];

/** Em centésimos (0,30 · 0,70 · 1,00), inteiro para a soma não virar 2,6999. */
export const NIVEIS = {
  regular: { rotulo: 'Regular', pontos: 30 },
  bom: { rotulo: 'Bom', pontos: 70 },
  otimo: { rotulo: 'Ótimo', pontos: 100 },
} as const;

export type Nivel = keyof typeof NIVEIS;
export const CHAVES_NIVEIS = Object.keys(NIVEIS) as Nivel[];

export const NOTA_MAXIMA = 500;
export const PARECER_MAXIMO = 5000;

export type Niveis = Record<Criterio, Nivel | null>;

export type Avaliacao = Niveis & {
  comentarios: string | null;
  status: 'rascunho' | 'finalizada';
};

export type Situacao = 'pendente' | 'em_avaliacao' | 'avaliado';

export type Projeto = {
  uuid: string;
  titulo: string;
  categoria: string | null;
  escola: string | null;
  descricao: string | null;
  video_url: string | null;
  grupo_nome: string;
  orientador_nome: string | null;
  evento_nome: string | null;
  notas_liberadas_at: string | null;
};

/** Um grupo da fila do avaliador, como filaDeAvaliacao() monta no site. */
export type ItemFila = {
  projeto: Projeto;
  avaliacao: Avaliacao | null;
  situacao: Situacao;
  pontos: number;
  marcados: number;
  /** Feira com notas liberadas: a ficha só pode ser lida. */
  travada: boolean;
};

export function niveisVazios(): Niveis {
  return Object.fromEntries(CHAVES_CRITERIOS.map((criterio) => [criterio, null])) as Niveis;
}

/** Soma dos critérios marcados, em centésimos. Rascunho soma só o que tem. */
export function pontos(niveis: Partial<Niveis> | null): number {
  if (!niveis) {
    return 0;
  }

  return CHAVES_CRITERIOS.reduce((total, criterio) => {
    const nivel = niveis[criterio];
    return total + (nivel ? NIVEIS[nivel].pontos : 0);
  }, 0);
}

export function criteriosMarcados(niveis: Partial<Niveis> | null): number {
  return niveis ? CHAVES_CRITERIOS.filter((criterio) => niveis[criterio]).length : 0;
}

export function situacaoDe(avaliacao: Avaliacao | null): Situacao {
  if (!avaliacao) {
    return 'pendente';
  }

  return avaliacao.status === 'finalizada' ? 'avaliado' : 'em_avaliacao';
}

/** 270 → '2,70', como o format_nota() do site. */
export function formatNota(centesimos: number): string {
  return (centesimos / 100).toFixed(2).replace('.', ',');
}

/**
 * Próximo grupo depois de `depoisDe` que ainda não foi avaliado, dando a volta
 * na fila: quem pulou um grupo no começo chega nele no fim. Com -1, é o
 * primeiro pendente.
 */
export function proximoPendente(fila: ItemFila[], depoisDe: number): number | null {
  const total = fila.length;

  for (let passo = 1; passo <= total; passo++) {
    const indice = (depoisDe + passo) % total;

    if (indice !== depoisDe && fila[indice].situacao !== 'avaliado') {
      return indice;
    }
  }

  return null;
}
