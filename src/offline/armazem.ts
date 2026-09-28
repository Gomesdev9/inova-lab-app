import type { FichaParaEnviar, Pacote, ResultadoDoEnvio } from '@/api/cliente';
import {
  CHAVES_CRITERIOS,
  criteriosMarcados,
  pontos,
  situacaoDe,
  type Avaliacao,
  type ItemFila,
  type Niveis,
  type Projeto,
} from '@/lib/avaliacao';

import { banco } from './banco';

/** Tudo o que o app guarda no tablet, lido e escrito só por aqui. */

type LinhaFicha = Niveis & {
  projeto_uuid: string;
  comentarios: string | null;
  status: 'rascunho' | 'finalizada';
  pendente: number;
  alterada_em: string | null;
  aviso: string | null;
  enviada: string | null;
};

export type Config = {
  /** O e-mail que o avaliador digitou, em minúsculas. */
  email: string | null;
  /** O nome que o servidor devolveu ao aceitar o e-mail. Só existe depois de um envio. */
  nome: string | null;
  /** O avaliador pediu para enviar (ou terminou tudo): dali em diante o envio é automático. */
  envioPedido: boolean;
};

export type DadosDoTablet = Config & {
  pacoteGeradoEm: string | null;
  fila: ItemFila[];
  /** Finalizadas que ainda não foram aceitas pelo servidor. */
  prontasParaEnviar: number;
  /** Finalizadas que o servidor aceitou. */
  enviadas: number;
};

export async function lerConfig(): Promise<Config> {
  const db = await banco();
  const linhas = await db.getAllAsync<{ chave: string; valor: string | null }>('SELECT * FROM config');
  const config = Object.fromEntries(linhas.map((linha) => [linha.chave, linha.valor]));

  return { email: config.email ?? null, nome: config.nome ?? null, envioPedido: config.envio_pedido === '1' };
}

async function gravarConfig(chave: string, valor: string | null): Promise<void> {
  const db = await banco();
  await db.runAsync('INSERT OR REPLACE INTO config (chave, valor) VALUES (?, ?)', [chave, valor]);
}

/** Trocar o e-mail desfaz a confirmação: o nome era do e-mail anterior. */
export async function gravarEmail(email: string): Promise<void> {
  const atual = (await lerConfig()).email;
  const novo = email.trim().toLowerCase();

  await gravarConfig('email', novo);
  if (atual !== novo) {
    await gravarConfig('nome', null);
  }
}

export const gravarNome = (nome: string) => gravarConfig('nome', nome);
export const marcarEnvioPedido = () => gravarConfig('envio_pedido', '1');

function avaliacaoDaLinha(linha: LinhaFicha | undefined): Avaliacao | null {
  if (!linha) {
    return null;
  }

  return {
    ...(Object.fromEntries(CHAVES_CRITERIOS.map((criterio) => [criterio, linha[criterio]])) as Niveis),
    comentarios: linha.comentarios,
    status: linha.status,
  };
}

/**
 * A fila deste avaliador: os projetos da feira menos os grupos que ele
 * orienta, cada um com a ficha que está no tablet.
 */
export async function lerDados(): Promise<DadosDoTablet> {
  const db = await banco();
  const config = await lerConfig();
  const pacote = await db.getFirstAsync<{ projetos: string; gerado_em: string | null }>('SELECT * FROM pacote WHERE id = 1');
  const linhas = await db.getAllAsync<LinhaFicha>('SELECT * FROM fichas');
  const porProjeto = new Map(linhas.map((linha) => [linha.projeto_uuid, linha]));
  const projetos: Projeto[] = pacote ? JSON.parse(pacote.projetos) : [];

  return {
    ...config,
    pacoteGeradoEm: pacote?.gerado_em ?? null,
    prontasParaEnviar: linhas.filter((linha) => linha.pendente && linha.status === 'finalizada').length,
    enviadas: linhas.filter((linha) => !linha.pendente && linha.status === 'finalizada' && !linha.aviso).length,
    fila: projetos
      .filter((projeto) => !config.email || projeto.orientador_email !== config.email)
      .map((projeto) => {
        const linha = porProjeto.get(projeto.uuid);
        const avaliacao = avaliacaoDaLinha(linha);

        return {
          projeto,
          avaliacao,
          situacao: situacaoDe(avaliacao),
          pontos: pontos(avaliacao),
          marcados: criteriosMarcados(avaliacao),
          travada: projeto.notas_liberadas_at !== null,
          pendente: Boolean(linha?.pendente),
          aviso: linha?.aviso ?? null,
        };
      }),
  };
}

/**
 * Guarda os projetos da feira. `soSeMaisNovo`: o pacote que vem no APK só
 * entra se o tablet não tiver um mais recente (baixado do servidor ou de um
 * APK anterior).
 */
export async function guardarPacote(pacote: Pacote, soSeMaisNovo = false): Promise<boolean> {
  const db = await banco();

  if (soSeMaisNovo) {
    const atual = await db.getFirstAsync<{ gerado_em: string | null }>('SELECT gerado_em FROM pacote WHERE id = 1');
    if (atual && (pacote.gerado_em === null || (atual.gerado_em !== null && atual.gerado_em >= pacote.gerado_em))) {
      return false;
    }
  }

  await db.runAsync('INSERT OR REPLACE INTO pacote (id, projetos, gerado_em) VALUES (1, ?, ?)', [
    JSON.stringify(pacote.projetos),
    pacote.gerado_em,
  ]);

  return true;
}

/** Grava a ficha no tablet. Ela fica pendente até o servidor aceitar. */
export async function gravarFicha(uuid: string, avaliacao: Avaliacao): Promise<void> {
  const db = await banco();

  await db.runAsync(
    `INSERT INTO fichas (projeto_uuid, funcionalidade, usabilidade, originalidade, conclusao, apresentacao, comentarios, status, pendente, alterada_em, aviso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)
     ON CONFLICT (projeto_uuid) DO UPDATE SET
       funcionalidade = excluded.funcionalidade,
       usabilidade = excluded.usabilidade,
       originalidade = excluded.originalidade,
       conclusao = excluded.conclusao,
       apresentacao = excluded.apresentacao,
       comentarios = excluded.comentarios,
       status = excluded.status,
       pendente = 1,
       alterada_em = excluded.alterada_em,
       aviso = NULL`,
    [uuid, ...CHAVES_CRITERIOS.map((criterio) => avaliacao[criterio]), avaliacao.comentarios, avaliacao.status, new Date().toISOString()]
  );
}

export type Envio = { ficha: FichaParaEnviar; alteradaEm: string | null };

/** Só vão as finalizadas: rascunho é trabalho pela metade e fica no tablet. */
export async function fichasParaEnviar(): Promise<Envio[]> {
  const db = await banco();
  const linhas = await db.getAllAsync<LinhaFicha>("SELECT * FROM fichas WHERE pendente = 1 AND status = 'finalizada'");

  return linhas.map((linha) => ({
    alteradaEm: linha.alterada_em,
    ficha: {
      projeto_uuid: linha.projeto_uuid,
      ...(Object.fromEntries(CHAVES_CRITERIOS.map((criterio) => [criterio, linha[criterio]])) as Niveis),
      comentarios: linha.comentarios ?? '',
      finalizar: true,
      anterior: linha.enviada ? JSON.parse(linha.enviada) : null,
    },
  }));
}

/**
 * Registra a resposta do servidor para uma ficha enviada. Se o avaliador
 * mexeu nela de novo enquanto o envio acontecia, ela continua pendente: a
 * versão nova vai no próximo envio.
 */
export async function aplicarResultado(resultado: ResultadoDoEnvio, envio: Envio): Promise<void> {
  const db = await banco();
  const aceita = resultado.status === 'aceita';
  const conteudo = {
    ...Object.fromEntries(CHAVES_CRITERIOS.map((criterio) => [criterio, envio.ficha[criterio]])),
    comentarios: envio.ficha.comentarios,
  };

  await db.runAsync(
    `UPDATE fichas
     SET pendente = CASE WHEN alterada_em IS ? THEN 0 ELSE pendente END,
         aviso = ?,
         enviada = CASE WHEN ? THEN ? ELSE enviada END
     WHERE projeto_uuid = ?`,
    [envio.alteradaEm, aceita ? null : resultado.mensagem, aceita ? 1 : 0, JSON.stringify(conteudo), resultado.projeto_uuid]
  );
}

/** Ficha enviada que o servidor nem reconheceu: sai da fila de envio com um aviso. */
export async function marcarSemResposta(uuid: string): Promise<void> {
  const db = await banco();
  await db.runAsync("UPDATE fichas SET pendente = 0, aviso = 'O servidor não reconheceu esta avaliação.' WHERE projeto_uuid = ?", [uuid]);
}

/** Tira o aviso depois que o avaliador leu. */
export async function dispensarAviso(uuid: string): Promise<void> {
  const db = await banco();
  await db.runAsync('UPDATE fichas SET aviso = NULL WHERE projeto_uuid = ?', [uuid]);
}

/** Deixa o tablet pronto para o próximo avaliador: apaga fichas e e-mail, mantém os projetos. */
export async function liberarTablet(): Promise<void> {
  const db = await banco();
  await db.execAsync('DELETE FROM fichas; DELETE FROM config;');
}
