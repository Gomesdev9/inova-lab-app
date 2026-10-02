import { ErroDeEmail, enviarAvaliacoes } from '@/api/cliente';

import { aplicarResultado, fichasParaEnviar, gravarNome, marcarSemResposta, registrarErroDoAvaliador, type EnviosDoAvaliador } from './armazem';

/** Fichas por requisição. O servidor aceita até 300; menos que isso deixa cada envio curto. */
const POR_ENVIO = 50;

export type Relatorio = {
  /** Fichas que o servidor aceitou, somando todos os avaliadores. */
  enviadas: number;
  /** Fichas que voltaram com aviso: recusada ou conflito. */
  comAviso: number;
  /** Avaliadores cujo e-mail o servidor recusou: as fichas deles ficaram no tablet. */
  recusados: { email: string; erro: string }[];
};

let emAndamento: Promise<Relatorio> | null = null;

/**
 * Manda ao servidor as fichas finalizadas de cada avaliador, cada grupo com o
 * e-mail do dono. `devemIr` decide de quem vai agora (quem terminou, quem já
 * passou o tablet adiante, quem apertou "Enviar").
 *
 * O servidor confere cada e-mail antes de gravar: se recusar um, as fichas
 * daquele avaliador ficam no tablet e os outros seguem normalmente. Erro de
 * rede interrompe tudo e sobe, para a próxima tentativa.
 *
 * Quem chega com um envio em andamento espera por ele em vez de começar outro.
 */
export function enviar(devemIr: (avaliador: EnviosDoAvaliador) => boolean): Promise<Relatorio> {
  emAndamento ??= executar(devemIr).finally(() => {
    emAndamento = null;
  });

  return emAndamento;
}

async function executar(devemIr: (avaliador: EnviosDoAvaliador) => boolean): Promise<Relatorio> {
  const relatorio: Relatorio = { enviadas: 0, comAviso: 0, recusados: [] };

  for (const avaliador of (await fichasParaEnviar()).filter(devemIr)) {
    const { email, envios } = avaliador;

    try {
      for (let inicio = 0; inicio < envios.length; inicio += POR_ENVIO) {
        const lote = envios.slice(inicio, inicio + POR_ENVIO);
        const { avaliador: conferido, resultados } = await enviarAvaliacoes(email, lote.map((envio) => envio.ficha));
        const porProjeto = new Map(resultados.map((resultado) => [resultado.projeto_uuid, resultado]));

        await gravarNome(email, conferido.nome);
        await registrarErroDoAvaliador(email, null);

        for (const envio of lote) {
          const resultado = porProjeto.get(envio.ficha.projeto_uuid.toLowerCase());

          if (!resultado) {
            await marcarSemResposta(email, envio.ficha.projeto_uuid);
            relatorio.comAviso++;
            continue;
          }

          await aplicarResultado(email, resultado, envio);
          if (resultado.status === 'aceita') {
            relatorio.enviadas++;
          } else {
            relatorio.comAviso++;
          }
        }
      }
    } catch (erro) {
      if (!(erro instanceof ErroDeEmail)) {
        throw erro;
      }

      await registrarErroDoAvaliador(email, erro.message);
      relatorio.recusados.push({ email, erro: erro.message });
    }
  }

  return relatorio;
}
