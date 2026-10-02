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
  -- Configurações do tablet. Na versão 1: o e-mail digitado pelo avaliador,
  -- o nome que o servidor confirmou e se o envio já foi pedido. Na 2, só o
  -- e-mail de quem está com o tablet agora.
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
  `
  -- Versão 2: vários avaliadores no mesmo tablet, e critérios que o admin
  -- cadastra por feira (não mais as cinco colunas fixas).

  -- A lista de avaliadores vem no pacote, para o avaliador escolher o nome.
  ALTER TABLE pacote ADD COLUMN avaliadores TEXT;

  -- Cada avaliador que já usou este tablet.
  --   envio_pedido: ele terminou ou passou o tablet adiante; as fichas
  --                 finalizadas dele vão para o servidor quando houver internet.
  --   erro:         o servidor recusou o e-mail dele (conta desativada...).
  CREATE TABLE avaliadores_tablet (
    email TEXT PRIMARY KEY NOT NULL,
    nome TEXT,
    envio_pedido INTEGER NOT NULL DEFAULT 0,
    erro TEXT
  );

  INSERT INTO avaliadores_tablet (email, nome, envio_pedido)
  SELECT valor,
         (SELECT valor FROM config WHERE chave = 'nome'),
         COALESCE((SELECT valor = '1' FROM config WHERE chave = 'envio_pedido'), 0)
  FROM config WHERE chave = 'email' AND valor IS NOT NULL;

  -- As fichas passam a ser de um avaliador, e as menções vão num JSON
  -- (chave do critério => nível). As da versão 1 ficam com o e-mail que
  -- estava no tablet.
  CREATE TABLE fichas_v2 (
    avaliador_email TEXT NOT NULL,
    projeto_uuid TEXT NOT NULL,
    niveis TEXT NOT NULL DEFAULT '{}',
    comentarios TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    pendente INTEGER NOT NULL DEFAULT 1,
    alterada_em TEXT,
    aviso TEXT,
    enviada TEXT,
    PRIMARY KEY (avaliador_email, projeto_uuid)
  );

  INSERT INTO fichas_v2 (avaliador_email, projeto_uuid, niveis, comentarios, status, pendente, alterada_em, aviso, enviada)
  SELECT COALESCE((SELECT valor FROM config WHERE chave = 'email'), ''),
         projeto_uuid,
         json_object('funcionalidade', funcionalidade, 'usabilidade', usabilidade, 'originalidade', originalidade,
                     'conclusao', conclusao, 'apresentacao', apresentacao),
         comentarios, status, pendente, alterada_em, aviso,
         CASE WHEN enviada IS NULL THEN NULL ELSE json_object(
           'criterios', json_object(
             'funcionalidade', json_extract(enviada, '$.funcionalidade'),
             'usabilidade', json_extract(enviada, '$.usabilidade'),
             'originalidade', json_extract(enviada, '$.originalidade'),
             'conclusao', json_extract(enviada, '$.conclusao'),
             'apresentacao', json_extract(enviada, '$.apresentacao')),
           'comentarios', json_extract(enviada, '$.comentarios')) END
  FROM fichas;

  DROP TABLE fichas;
  ALTER TABLE fichas_v2 RENAME TO fichas;

  -- config guarda só quem está com o tablet agora (chave "email").
  DELETE FROM config WHERE chave IN ('nome', 'envio_pedido');
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
