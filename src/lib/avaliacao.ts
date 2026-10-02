/**
 * A ficha de avaliação, espelhando app/Models/Avaliacao.php do site. Os
 * critérios não são mais fixos: cada feira tem os seus, cadastrados pelo admin
 * (título, descrição e peso), e chegam no pacote junto com cada projeto. Cada
 * critério recebe uma menção — Atendido, Parcialmente atendido ou Não
 * atendido. As contas precisam ser as mesmas de lá, senão a menção que o
 * avaliador vê aqui não bate com a que o site grava.
 */

/** Um critério da ficha, como o admin cadastrou para a feira. */
export type Criterio = {
  /** Identificador estável dentro da feira: é o nome do campo no envio. */
  chave: string;
  titulo: string;
  descricao: string;
  /** Quanto conta na média da ficha (1 a 10). */
  peso: number;
};

/**
 * Cada critério é Atendido (A), Parcialmente atendido (PA) ou Não atendido
 * (NA), como nos indicadores do Senac.
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

export function ehNivel(valor: unknown): valor is Nivel {
  return typeof valor === 'string' && valor in NIVEIS;
}

/**
 * Escala da nota de uma ficha: a média dos critérios, ponderada pelo peso de
 * cada um, de 0 a 1000 — como Avaliacao::NOTA_MAXIMA no site.
 */
export const NOTA_MAXIMA = 1000;

/**
 * A partir de quanto do máximo (em %) a média vira cada menção: 75% ou mais é
 * A, 25% ou mais é PA, abaixo disso NA. As mesmas faixas de
 * Avaliacao::FAIXA_ATENDIDO e FAIXA_PARCIAL.
 */
export const FAIXA_ATENDIDO = 75;
export const FAIXA_PARCIAL = 25;

export const PARECER_MAXIMO = 5000;

/** A menção marcada em cada critério, pela chave. Critério sem menção não aparece. */
export type Niveis = Record<string, Nivel>;

export type Avaliacao = {
  niveis: Niveis;
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
  /** Em minúsculas. O grupo sai da fila de quem tiver este e-mail: ninguém avalia o próprio grupo. */
  orientador_email: string | null;
  evento_nome: string | null;
  notas_liberadas_at: string | null;
  /** Nomes dos integrantes, já baixados para aparecerem sem internet. */
  membros: string[];
  /** A ficha da feira do projeto, na ordem que o admin deixou. */
  criterios: Criterio[];
};

/** Um grupo da fila do avaliador, como filaDeAvaliacao() monta no site. */
export type ItemFila = {
  projeto: Projeto;
  avaliacao: Avaliacao | null;
  situacao: Situacao;
  /** A nota da ficha, de 0 a NOTA_MAXIMA. Só por dentro: a tela mostra a menção. */
  pontos: number;
  marcados: number;
  /** Feira com menções liberadas: a ficha só pode ser lida. */
  travada: boolean;
  /** Mexida no tablet e ainda não aceita pelo servidor. */
  pendente: boolean;
  /** O que o servidor disse na última vez que recebeu esta ficha, se precisar ser lido. */
  aviso: string | null;
};

/**
 * A nota da ficha, de 0 a NOTA_MAXIMA: a média dos critérios marcados,
 * ponderada pelo peso de cada um, como Avaliacao::pontos() no site (com o
 * mesmo arredondamento). Rascunho conta só o que tem — é a menção parcial.
 */
export function pontos(niveis: Niveis | null, criterios: Criterio[]): number {
  if (!niveis) {
    return 0;
  }

  let soma = 0;
  let pesos = 0;

  for (const criterio of criterios) {
    const nivel = niveis[criterio.chave];
    if (!ehNivel(nivel)) {
      continue;
    }

    const peso = Math.max(1, Math.trunc(criterio.peso || 1));
    soma += NIVEIS[nivel].pontos * peso;
    pesos += peso;
  }

  return pesos > 0 ? arredondarComoPhp((soma * (NOTA_MAXIMA / 100)) / pesos) : 0;
}

/** round() do PHP: meio arredonda para longe do zero (o Math.round do JS sobe 2,5 e -2,5 para cima). */
function arredondarComoPhp(valor: number): number {
  return Math.sign(valor) * Math.round(Math.abs(valor));
}

export function criteriosMarcados(niveis: Niveis | null, criterios: Criterio[]): number {
  return niveis ? criterios.filter((criterio) => ehNivel(niveis[criterio.chave])).length : 0;
}

export function situacaoDe(avaliacao: Avaliacao | null): Situacao {
  if (!avaliacao) {
    return 'pendente';
  }

  return avaliacao.status === 'finalizada' ? 'avaliado' : 'em_avaliacao';
}

/** A menção que uma nota representa, como Avaliacao::mencao() no site. */
export function mencao(nota: number, maximo: number = NOTA_MAXIMA): Nivel {
  const porcentagem = maximo > 0 ? (nota * 100) / maximo : 0;

  if (porcentagem >= FAIXA_ATENDIDO) {
    return 'otimo';
  }

  return porcentagem >= FAIXA_PARCIAL ? 'bom' : 'regular';
}

/**
 * A menção da ficha como está agora: com todos os critérios, a final; pela
 * metade, a parcial, contando só os marcados. null sem nenhum marcado.
 */
export function mencaoDaFicha(niveis: Niveis | null, criterios: Criterio[]): Nivel | null {
  return criteriosMarcados(niveis, criterios) > 0 ? mencao(pontos(niveis, criterios)) : null;
}

/** "A (Atendido)", como nas mensagens do site. */
export function descreverMencao(nivel: Nivel): string {
  return `${NIVEIS[nivel].sigla} (${NIVEIS[nivel].rotulo})`;
}

/** Só as menções dos critérios desta ficha, e só as válidas. */
export function limparNiveis(niveis: Record<string, unknown> | null | undefined, criterios: Criterio[]): Niveis {
  const limpos: Niveis = {};
  for (const criterio of criterios) {
    const nivel = niveis?.[criterio.chave];
    if (ehNivel(nivel)) {
      limpos[criterio.chave] = nivel;
    }
  }

  return limpos;
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
