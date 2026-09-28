import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * O banco SQLite do tablet. É ele que deixa o app funcionar sem internet na
 * feira: os projetos (que já vêm no APK) e as fichas preenchidas ficam aqui
 * até poderem ir para o servidor.
 *
 * Mudança de estrutura entra como uma nova versão em MIGRACOES, nunca editando
 * uma que já rodou: um tablet pode estar com fichas não enviadas.
 */
const MIGRACOES = [
  `
  -- Configurações do tablet: o e-mail digitado pelo avaliador, o nome que o
  -- servidor confirmou para ele e se o envio já foi pedido.
  CREATE TABLE config (
    chave TEXT PRIMARY KEY NOT NULL,
    valor TEXT
  );

  -- Os projetos da feira: uma linha só, trocada inteira a cada atualização.
  CREATE TABLE pacote (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    projetos TEXT NOT NULL,
    gerado_em TEXT
  );

  -- A ficha do avaliador para cada projeto.
  --   pendente:    1 = finalizada ou em rascunho no tablet, ainda não aceita pelo servidor.
  --   alterada_em: muda a cada edição; diz se o avaliador mexeu de novo durante um envio.
  --   aviso:       o que o servidor respondeu, quando recusou a ficha.
  --   enviada:     a última versão que o servidor aceitou (JSON). Vai junto ao
  --                reenviar uma revisão, para o servidor saber que a ficha que
  --                ele tem veio deste tablet e pode ser trocada.
  CREATE TABLE fichas (
    projeto_uuid TEXT PRIMARY KEY NOT NULL,
    funcionalidade TEXT,
    usabilidade TEXT,
    originalidade TEXT,
    conclusao TEXT,
    apresentacao TEXT,
    comentarios TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    pendente INTEGER NOT NULL DEFAULT 1,
    alterada_em TEXT,
    aviso TEXT,
    enviada TEXT
  );
  `,
];

let aberto: Promise<SQLiteDatabase> | null = null;

export function banco(): Promise<SQLiteDatabase> {
  aberto ??= abrir();
  return aberto;
}

async function abrir(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('inova-lab-tablet.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const versao = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;

  for (let proxima = versao; proxima < MIGRACOES.length; proxima++) {
    await db.withExclusiveTransactionAsync(async (transacao) => {
      await transacao.execAsync(MIGRACOES[proxima]);
      await transacao.execAsync(`PRAGMA user_version = ${proxima + 1};`);
    });
  }

  return db;
}
