import type { Niveis, Projeto } from '@/lib/avaliacao';

/**
 * As duas chamadas à API do site (ApiController.php): baixar os projetos da
 * feira e enviar as avaliações. O app só fala com o servidor por aqui; todo o
 * resto acontece no tablet.
 *
 * O endereço e a chave vêm do .env.local e ficam embutidos no APK quando ele
 * é gerado.
 */
const SERVIDOR = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? '';
const CHAVE = process.env.EXPO_PUBLIC_CHAVE_APP ?? '';

/** Não deu para falar com o servidor: sem internet, servidor fora do ar, tempo esgotado. */
export class ErroDeRede extends Error {}

/** O e-mail digitado não é de um avaliador cadastrado. Nada foi gravado. */
export class ErroDeEmail extends Error {}

/** O servidor respondeu, mas com erro. */
export class ErroDoServidor extends Error {}

const TEMPO_LIMITE_MS = 20000;

export type Pacote = { gerado_em: string | null; projetos: Projeto[] };

export type ConteudoDaFicha = Niveis & { comentarios: string };

export type FichaParaEnviar = ConteudoDaFicha & {
  projeto_uuid: string;
  finalizar: boolean;
  /** A versão que este tablet já tinha enviado, ao mandar uma revisão. */
  anterior: ConteudoDaFicha | null;
};

export type ResultadoDoEnvio = {
  projeto_uuid: string;
  status: 'aceita' | 'conflito' | 'recusada';
  mensagem: string | null;
};

async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
  if (!SERVIDOR || !CHAVE) {
    throw new ErroDoServidor('Este APK foi gerado sem o endereço do servidor ou sem a chave. Gere o APK de novo com o .env.local preenchido.');
  }

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${SERVIDOR}${caminho}`, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        'X-Chave-App': CHAVE,
        ...(corpo !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
  } catch {
    throw new ErroDeRede('Não foi possível falar com o servidor. Confira a internet do tablet.');
  } finally {
    clearTimeout(limite);
  }

  let dados: { erro?: unknown; motivo?: unknown } | null = null;
  try {
    dados = await resposta.json();
  } catch {
    // Resposta que não é JSON: endereço errado ou erro do PHP. Tratado abaixo.
  }

  const erro = typeof dados?.erro === 'string' ? dados.erro : null;

  if (resposta.status === 422 && dados?.motivo === 'email') {
    throw new ErroDeEmail(erro ?? 'Este e-mail não está cadastrado como avaliador.');
  }

  if (!resposta.ok || dados === null) {
    throw new ErroDoServidor(
      erro ?? (dados === null ? 'O servidor não respondeu como esperado. Confira o endereço do servidor.' : `O servidor respondeu com erro (${resposta.status}).`)
    );
  }

  return dados as T;
}

export function baixarPacote() {
  return chamar<Pacote>('/api/tablet/pacote');
}

/** O servidor confere o e-mail antes de gravar qualquer ficha. */
export function enviarAvaliacoes(email: string, avaliacoes: FichaParaEnviar[]) {
  return chamar<{ avaliador: { nome: string }; resultados: ResultadoDoEnvio[] }>('/api/tablet/avaliacoes', { email, avaliacoes });
}
