import { enviarAvaliacoes } from '@/api/cliente';

import { aplicarResultado, fichasParaEnviar, gravarNome, marcarSemResposta } from './armazem';

/** Fichas por requisição. O servidor aceita até 300; menos que isso deixa cada envio curto. */
const POR_ENVIO = 50;

export type Relatorio = {
  /** Fichas que o servidor aceitou. */
  enviadas: number;
  /** Fichas que voltaram com aviso: recusada ou conflito. */
  comAviso: number;
  /** O nome do avaliador, como está no cadastro. */
  nome: string | null;
};

let emAndamento: Promise<Relatorio> | null = null;

/**
 * Manda as fichas finalizadas com o e-mail do avaliador. O servidor confere o
 * e-mail antes de gravar qualquer uma: se não estiver cadastrado, vem
 * ErroDeEmail e nada muda no tablet.
 *
 * Várias coisas pedem envio (a internet voltou, o avaliador terminou, o
 * botão); quem chega com um em andamento espera por ele em vez de começar outro.
 */
export function enviar(email: string): Promise<Relatorio> {
  emAndamento ??= executar(email).finally(() => {
    emAndamento = null;
  });

  return emAndamento;
}

async function executar(email: string): Promise<Relatorio> {
  const envios = await fichasParaEnviar();
  const relatorio: Relatorio = { enviadas: 0, comAviso: 0, nome: null };

  for (let inicio = 0; inicio < envios.length; inicio += POR_ENVIO) {
    const lote = envios.slice(inicio, inicio + POR_ENVIO);
    const { avaliador, resultados } = await enviarAvaliacoes(email, lote.map((envio) => envio.ficha));
    const porProjeto = new Map(resultados.map((resultado) => [resultado.projeto_uuid, resultado]));

    relatorio.nome = avaliador.nome;
    await gravarNome(avaliador.nome);

    for (const envio of lote) {
      const resultado = porProjeto.get(envio.ficha.projeto_uuid.toLowerCase());

      if (!resultado) {
        await marcarSemResposta(envio.ficha.projeto_uuid);
        relatorio.comAviso++;
        continue;
      }

      await aplicarResultado(resultado, envio);
      if (resultado.status === 'aceita') {
        relatorio.enviadas++;
      } else {
        relatorio.comAviso++;
      }
    }
  }

  return relatorio;
}
