/**
 * A ficha de avaliação, espelhando app/Models/Avaliacao.php do site: cinco
 * critérios, cada um com uma menção — Atendido, Parcialmente atendido ou Não
 * atendido — e um parecer opcional. Os valores precisam ser os mesmos de lá,
 * senão a menção que o avaliador vê aqui não bate com a do site.
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

/**
 * A avaliação é por menção, como nos indicadores do Senac: cada critério é
 * Atendido (A), Parcialmente atendido (PA) ou Não atendido (NA).
 *
 * As chaves são as da época em que a escala era Regular/Bom/Ótimo (regular =
 * NA, bom = PA, otimo = A): são os valores que o banco guarda e que a API
 * recebe, então não mudam. A ordem é a das fichas do Senac, do melhor para o
 * pior, e é a ordem dos botões na ficha.
 *
 * Os pontos ficam só por dentro, para tirar a menção da ficha inteira;
 * ninguém vê número.
 */
export const NIVEIS = {
  otimo: { sigla: 'A', rotulo: 'Atendido', pontos: 100 },
  bom: { sigla: 'PA', rotulo: 'Parcialmente atendido', pontos: 50 },
  regular: { sigla: 'NA', rotulo: 'Não atendido', pontos: 0 },
} as const;

export type Nivel = keyof typeof NIVEIS;
export const CHAVES_NIVEIS = Object.keys(NIVEIS) as Nivel[];

/** Pontos máximos de uma ficha: todos os critérios Atendidos. */
export const NOTA_MAXIMA = 500;

/**
 * A partir de quanto do máximo (em %) a média vira cada menção: 75% ou mais é
 * A, 25% ou mais é PA, abaixo disso NA. As mesmas faixas de
 * Avaliacao::FAIXA_ATENDIDO e FAIXA_PARCIAL.
 */
export const FAIXA_ATENDIDO = 75;
export const FAIXA_PARCIAL = 25;
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
  /** Em minúsculas. O grupo sai da fila de quem digitar este e-mail: ninguém avalia o próprio grupo. */
  orientador_email: string | null;
  evento_nome: string | null;
  notas_liberadas_at: string | null;
  /** Nomes dos integrantes, já baixados para aparecerem sem internet. */
  membros: string[];
};

/** Um grupo da fila do avaliador, como filaDeAvaliacao() monta no site. */
export type ItemFila = {
  projeto: Projeto;
  avaliacao: Avaliacao | null;
  situacao: Situacao;
  pontos: number;
  marcados: number;
  /** Feira com menções liberadas: a ficha só pode ser lida. */
  travada: boolean;
  /** Mexida no aparelho e ainda não enviada ao servidor. */
  pendente: boolean;
  /** O que o servidor disse na última vez que recebeu esta ficha, se precisar ser lido. */
  aviso: string | null;
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

/**
 * A menção que uma quantidade de pontos representa, como Avaliacao::mencao()
 * no site: a soma de uma ficha (máximo NOTA_MAXIMA) ou, numa ficha pela
 * metade, só dos critérios já marcados (máximo marcados × 100).
 */
export function mencao(pontosDaFicha: number, maximo: number = NOTA_MAXIMA): Nivel {
  const porcentagem = maximo > 0 ? (pontosDaFicha * 100) / maximo : 0;

  if (porcentagem >= FAIXA_ATENDIDO) {
    return 'otimo';
  }

  return porcentagem >= FAIXA_PARCIAL ? 'bom' : 'regular';
}

/**
 * A menção da ficha como está agora: com todos os critérios, a final; pela
 * metade, a parcial, contando só os marcados. null sem nenhum marcado.
 */
export function mencaoDaFicha(niveis: Partial<Niveis> | null): Nivel | null {
  const marcados = criteriosMarcados(niveis);
  return marcados > 0 ? mencao(pontos(niveis), marcados * 100) : null;
}

/** "A (Atendido)", como nas mensagens do site. */
export function descreverMencao(nivel: Nivel): string {
  return `${NIVEIS[nivel].sigla} (${NIVEIS[nivel].rotulo})`;
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
