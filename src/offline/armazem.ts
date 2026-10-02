import type { Avaliador, ConteudoDaFicha, FichaParaEnviar, Pacote, ResultadoDoEnvio } from '@/api/cliente';
import {
  criteriosMarcados,
  limparNiveis,
  pontos,
  situacaoDe,
  type Avaliacao,
  type ItemFila,
  type Projeto,
} from '@/lib/avaliacao';

import { banco } from './banco';

/**
 * Tudo o que o app guarda no tablet, lido e escrito só por aqui.
 *
 * Vários avaliadores usam o mesmo tablet, um depois do outro: cada ficha é
 * de um avaliador (pelo e-mail), e trocar de avaliador não apaga nada. As
 * fichas de quem já passou ficam guardadas até o servidor aceitar.
 */

type LinhaFicha = {
  avaliador_email: string;
  projeto_uuid: string;
  niveis: string;
  comentarios: string | null;
  status: 'rascunho' | 'finalizada';
  pendente: number;
  alterada_em: string | null;
  aviso: string | null;
  enviada: string | null;
};

type LinhaAvaliador = { email: string; nome: string | null; envio_pedido: number; erro: string | null };

/** Um avaliador que já usou este tablet, com a situação das fichas dele. */
export type AvaliadorNoTablet = {
  email: string;
  nome: string;
  /** Terminou ou passou o tablet adiante: as finalizadas dele vão sozinhas quando houver internet. */
  envioPedido: boolean;
  /** O servidor recusou o e-mail dele no último envio. */
  erro: string | null;
  /** Finalizadas que ainda não chegaram ao servidor. */
  prontas: number;
  /** Finalizadas que o servidor aceitou. */
  enviadas: number;
  rascunhos: number;
};

export type DadosDoTablet = {
  /** Quem pode avaliar, em ordem de nome. */
  avaliadores: Avaliador[];
  /**
   * true: a lista veio do site (todos os professores ativos). false: o site
   * ainda não manda a lista, e ela é montada com os orientadores dos projetos
   * — fica faltando quem não orienta grupo, que digita o e-mail.
   */
  listaCompleta: boolean;
  pacoteGeradoEm: string | null;
  /** Quem está com o tablet agora. */
  atual: AvaliadorNoTablet | null;
  /** A fila de quem está com o tablet: a feira menos os grupos que ele orienta. */
  fila: ItemFila[];
  /** Todos os avaliadores com alguma ficha neste tablet. */
  noTablet: AvaliadorNoTablet[];
};

const normalizar = (email: string) => email.trim().toLowerCase();

function lerJson<T>(texto: string | null, padrao: T): T {
  if (!texto) {
    return padrao;
  }

  try {
    return JSON.parse(texto) as T;
  } catch {
    return padrao;
  }
}

export async function lerEmailAtual(): Promise<string | null> {
  const db = await banco();
  return (await db.getFirstAsync<{ valor: string | null }>("SELECT valor FROM config WHERE chave = 'email'"))?.valor ?? null;
}

/** O avaliador escolheu o nome dele (ou digitou o e-mail): o tablet passa a ser dele. */
export async function escolherAvaliador(avaliador: Avaliador): Promise<void> {
  const db = await banco();
  const email = normalizar(avaliador.email);

  await db.withExclusiveTransactionAsync(async (transacao) => {
    await transacao.runAsync("INSERT OR REPLACE INTO config (chave, valor) VALUES ('email', ?)", [email]);
    await transacao.runAsync(
      `INSERT INTO avaliadores_tablet (email, nome) VALUES (?, ?)
       ON CONFLICT (email) DO UPDATE SET nome = COALESCE(excluded.nome, avaliadores_tablet.nome)`,
      [email, avaliador.nome.trim() || null]
    );
  });
}

/**
 * O avaliador devolveu o tablet. Nada se apaga: se ele tem avaliação
 * finalizada, ela fica marcada para ir ao servidor quando houver internet.
 */
export async function liberarParaOutro(): Promise<void> {
  const db = await banco();
  const email = await lerEmailAtual();

  await db.withExclusiveTransactionAsync(async (transacao) => {
    if (email) {
      await transacao.runAsync(
        `UPDATE avaliadores_tablet SET envio_pedido = 1
         WHERE email = ? AND EXISTS (SELECT 1 FROM fichas WHERE avaliador_email = ? AND status = 'finalizada')`,
        [email, email]
      );
    }
    await transacao.runAsync("DELETE FROM config WHERE chave = 'email'");
  });
}

export async function marcarEnvioPedido(email: string): Promise<void> {
  const db = await banco();
  await db.runAsync('UPDATE avaliadores_tablet SET envio_pedido = 1 WHERE email = ?', [email]);
}

export async function gravarNome(email: string, nome: string): Promise<void> {
  const db = await banco();
  await db.runAsync('UPDATE avaliadores_tablet SET nome = ? WHERE email = ?', [nome, email]);
}

/** O que o servidor disse sobre o e-mail do avaliador no último envio (null = aceitou). */
export async function registrarErroDoAvaliador(email: string, erro: string | null): Promise<void> {
  const db = await banco();
  await db.runAsync('UPDATE avaliadores_tablet SET erro = ? WHERE email = ?', [erro, email]);
}

function avaliacaoDaLinha(linha: LinhaFicha | undefined, projeto: Projeto): Avaliacao | null {
  if (!linha) {
    return null;
  }

  return {
    niveis: limparNiveis(lerJson<Record<string, unknown>>(linha.niveis, {}), projeto.criterios ?? []),
    comentarios: linha.comentarios,
    status: linha.status,
  };
}

export async function lerDados(): Promise<DadosDoTablet> {
  const db = await banco();
  const email = await lerEmailAtual();
  const pacote = await db.getFirstAsync<{ projetos: string; avaliadores: string | null; gerado_em: string | null }>(
    'SELECT * FROM pacote WHERE id = 1'
  );
  const linhas = await db.getAllAsync<LinhaFicha>('SELECT * FROM fichas');
  const avaliadoresTablet = await db.getAllAsync<LinhaAvaliador>('SELECT * FROM avaliadores_tablet');

  const projetos: Projeto[] = lerJson(pacote?.projetos ?? null, []);
  const daLista = lerJson<Avaliador[]>(pacote?.avaliadores ?? null, []);
  const listaCompleta = daLista.length > 0;
  // Site com o ApiController antigo não manda a lista: usa os orientadores dos
  // projetos, que pelo menos já vêm no pacote, para ninguém ficar sem nome.
  const orientadores = projetos
    .filter((projeto) => projeto.orientador_email && projeto.orientador_nome)
    .map((projeto) => ({ nome: projeto.orientador_nome!, email: projeto.orientador_email! }));
  const porEmail = new Map(
    (listaCompleta ? daLista : orientadores).map((avaliador) => [normalizar(avaliador.email), { nome: avaliador.nome.trim(), email: normalizar(avaliador.email) }])
  );
  const avaliadores = [...porEmail.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const nomePeloPacote = new Map(avaliadores.map((avaliador) => [avaliador.email, avaliador.nome]));

  const resumo = (linha: LinhaAvaliador): AvaliadorNoTablet => {
    const dele = linhas.filter((ficha) => ficha.avaliador_email === linha.email);
    return {
      email: linha.email,
      nome: linha.nome ?? nomePeloPacote.get(linha.email) ?? linha.email,
      envioPedido: Boolean(linha.envio_pedido),
      erro: linha.erro,
      prontas: dele.filter((ficha) => ficha.pendente && ficha.status === 'finalizada').length,
      enviadas: dele.filter((ficha) => !ficha.pendente && ficha.status === 'finalizada' && !ficha.aviso).length,
      rascunhos: dele.filter((ficha) => ficha.status === 'rascunho').length,
    };
  };

  const noTablet = avaliadoresTablet.map(resumo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const linhaAtual = email ? avaliadoresTablet.find((linha) => linha.email === email) : undefined;
  const fichasDoAtual = new Map(linhas.filter((ficha) => ficha.avaliador_email === email).map((ficha) => [ficha.projeto_uuid, ficha]));

  return {
    avaliadores,
    listaCompleta,
    pacoteGeradoEm: pacote?.gerado_em ?? null,
    atual: linhaAtual ? resumo(linhaAtual) : null,
    noTablet,
    fila: !email
      ? []
      : projetos
          .filter((projeto) => projeto.orientador_email !== email)
          .map((projeto) => {
            const criterios = projeto.criterios ?? [];
            const linha = fichasDoAtual.get(projeto.uuid);
            const avaliacao = avaliacaoDaLinha(linha, projeto);

            return {
              projeto: { ...projeto, criterios },
              avaliacao,
              situacao: situacaoDe(avaliacao),
              pontos: pontos(avaliacao?.niveis ?? null, criterios),
              marcados: criteriosMarcados(avaliacao?.niveis ?? null, criterios),
              travada: projeto.notas_liberadas_at !== null,
              pendente: Boolean(linha?.pendente),
              aviso: linha?.aviso ?? null,
            };
          }),
  };
}

/**
 * Guarda os projetos e os avaliadores da feira. `soSeMaisNovo`: o pacote que
 * vem no APK só entra se o tablet não tiver um mais recente (baixado do
 * servidor ou de um APK anterior).
 */
export async function guardarPacote(pacote: Pacote, soSeMaisNovo = false): Promise<boolean> {
  const db = await banco();

  if (soSeMaisNovo) {
    const atual = await db.getFirstAsync<{ gerado_em: string | null }>('SELECT gerado_em FROM pacote WHERE id = 1');
    if (atual && (pacote.gerado_em === null || (atual.gerado_em !== null && atual.gerado_em >= pacote.gerado_em))) {
      return false;
    }
  }

  await db.runAsync('INSERT OR REPLACE INTO pacote (id, projetos, avaliadores, gerado_em) VALUES (1, ?, ?, ?)', [
    JSON.stringify(pacote.projetos),
    JSON.stringify(pacote.avaliadores ?? []),
    pacote.gerado_em,
  ]);

  return true;
}

/** Grava a ficha do avaliador no tablet. Ela fica pendente até o servidor aceitar. */
export async function gravarFicha(email: string, uuid: string, avaliacao: Avaliacao): Promise<void> {
  const db = await banco();

  await db.runAsync(
    `INSERT INTO fichas (avaliador_email, projeto_uuid, niveis, comentarios, status, pendente, alterada_em, aviso)
     VALUES (?, ?, ?, ?, ?, 1, ?, NULL)
     ON CONFLICT (avaliador_email, projeto_uuid) DO UPDATE SET
       niveis = excluded.niveis,
       comentarios = excluded.comentarios,
       status = excluded.status,
       pendente = 1,
       alterada_em = excluded.alterada_em,
       aviso = NULL`,
    [email, uuid, JSON.stringify(avaliacao.niveis), avaliacao.comentarios, avaliacao.status, new Date().toISOString()]
  );
}

export type Envio = { ficha: FichaParaEnviar; alteradaEm: string | null };

export type EnviosDoAvaliador = { email: string; envioPedido: boolean; envios: Envio[] };

/**
 * As fichas que esperam envio, separadas por avaliador: cada grupo vai ao
 * servidor com o e-mail do dono. Só vão as finalizadas — rascunho é trabalho
 * pela metade e fica no tablet.
 */
export async function fichasParaEnviar(): Promise<EnviosDoAvaliador[]> {
  const db = await banco();
  const linhas = await db.getAllAsync<LinhaFicha>("SELECT * FROM fichas WHERE pendente = 1 AND status = 'finalizada'");
  const pedidos = new Map(
    (await db.getAllAsync<LinhaAvaliador>('SELECT * FROM avaliadores_tablet')).map((linha) => [linha.email, Boolean(linha.envio_pedido)])
  );
  const porAvaliador = new Map<string, Envio[]>();

  for (const linha of linhas) {
    const envios = porAvaliador.get(linha.avaliador_email) ?? [];
    envios.push({
      alteradaEm: linha.alterada_em,
      ficha: {
        projeto_uuid: linha.projeto_uuid,
        criterios: lerJson(linha.niveis, {}),
        comentarios: linha.comentarios ?? '',
        finalizar: true,
        anterior: lerJson<ConteudoDaFicha | null>(linha.enviada, null),
      },
    });
    porAvaliador.set(linha.avaliador_email, envios);
  }

  return [...porAvaliador].map(([email, envios]) => ({ email, envioPedido: pedidos.get(email) ?? false, envios }));
}

/**
 * Registra a resposta do servidor para uma ficha enviada. Se o avaliador
 * mexeu nela de novo enquanto o envio acontecia, ela continua pendente: a
 * versão nova vai no próximo envio.
 */
export async function aplicarResultado(email: string, resultado: ResultadoDoEnvio, envio: Envio): Promise<void> {
  const db = await banco();
  const aceita = resultado.status === 'aceita';
  const conteudo: ConteudoDaFicha = { criterios: envio.ficha.criterios, comentarios: envio.ficha.comentarios };

  await db.runAsync(
    `UPDATE fichas
     SET pendente = CASE WHEN alterada_em IS ? THEN 0 ELSE pendente END,
         aviso = ?,
         enviada = CASE WHEN ? THEN ? ELSE enviada END
     WHERE avaliador_email = ? AND projeto_uuid = ?`,
    [envio.alteradaEm, aceita ? null : resultado.mensagem, aceita ? 1 : 0, JSON.stringify(conteudo), email, resultado.projeto_uuid]
  );
}

/** Ficha enviada que o servidor nem reconheceu: sai da fila de envio com um aviso. */
export async function marcarSemResposta(email: string, uuid: string): Promise<void> {
  const db = await banco();
  await db.runAsync(
    "UPDATE fichas SET pendente = 0, aviso = 'O servidor não reconheceu esta avaliação.' WHERE avaliador_email = ? AND projeto_uuid = ?",
    [email, uuid]
  );
}

/** Tira o aviso depois que o avaliador leu. */
export async function dispensarAviso(email: string, uuid: string): Promise<void> {
  const db = await banco();
  await db.runAsync('UPDATE fichas SET aviso = NULL WHERE avaliador_email = ? AND projeto_uuid = ?', [email, uuid]);
}
