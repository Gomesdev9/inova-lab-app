import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { baixarPacote, type Avaliador, type Pacote } from '@/api/cliente';
import pacoteDoApk from '@/dados/pacote-inicial.json';
import type { Niveis } from '@/lib/avaliacao';
import {
  dispensarAviso,
  escolherAvaliador,
  guardarPacote,
  lerDados,
  liberarParaOutro,
  marcarEnvioPedido,
  type DadosDoTablet,
} from '@/offline/armazem';
import { enviar } from '@/offline/envio';
import { registrarNoAparelho, type ResultadoSalvar } from '@/offline/registrar';

type Aviso = { tipo: 'sucesso' | 'erro'; mensagem: string };

type Estado = DadosDoTablet & {
  /** O banco do tablet já foi lido. */
  pronto: boolean;
  /** Quem está com o tablet já finalizou todos os grupos da fila dele. */
  todasAvaliadas: boolean;
  /** Finalizadas de todos os avaliadores que ainda não chegaram ao servidor. */
  prontasNoTablet: number;
  online: boolean;
  enviando: boolean;
  /** Por que o último envio falhou (rede, servidor), até o próximo dar certo. */
  falha: string | null;
  escolher: (avaliador: Avaliador) => Promise<void>;
  trocarAvaliador: () => Promise<void>;
  salvar: (uuid: string, niveis: Niveis, comentarios: string, acao: 'rascunho' | 'finalizar') => Promise<ResultadoSalvar>;
  enviarAgora: () => Promise<void>;
  atualizarProjetos: () => Promise<void>;
  dispensarAviso: (uuid: string) => Promise<void>;
  aviso: Aviso | null;
  avisar: (aviso: Aviso) => void;
  limparAviso: () => void;
};

const Contexto = createContext<Estado | null>(null);

/** Enquanto houver ficha esperando e internet, tenta de novo neste intervalo. */
const NOVA_TENTATIVA_MS = 60000;

const semDados: DadosDoTablet = { avaliadores: [], listaCompleta: false, pacoteGeradoEm: null, atual: null, fila: [], noTablet: [] };

function temInternet(estado: NetworkState): boolean {
  return Boolean(estado.isConnected) && estado.isInternetReachable !== false;
}

function tudoAvaliado(dados: DadosDoTablet): boolean {
  return dados.fila.length > 0 && dados.fila.every((item) => item.situacao === 'avaliado');
}

const quantas = (n: number) => (n === 1 ? '1 avaliação' : `${n} avaliações`);

/**
 * O app funciona a partir do que está no tablet. O servidor só entra para
 * atualizar os projetos (quando há internet) e para receber as avaliações.
 *
 * Vários avaliadores usam o mesmo tablet. As fichas de cada um vão ao servidor
 * com o e-mail dele quando ele termina todos os grupos, quando passa o tablet
 * adiante ou quando aperta "Enviar" — e, sem internet nessa hora, assim que a
 * conexão voltar.
 */
export function AvaliacaoProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [dados, setDados] = useState<DadosDoTablet>(semDados);
  const [online, setOnline] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Os ouvintes (rede, app em primeiro plano, intervalo) são registrados uma
  // vez só e precisam do valor atual, não do valor de quando nasceram.
  const onlineAtual = useRef(false);

  const recarregar = useCallback(async () => {
    const atuais = await lerDados();
    setDados(atuais);
    return atuais;
  }, []);

  /**
   * Envia as fichas de quem já pode enviar. `pedido`: o avaliador do tablet
   * apertou o botão, então as dele vão mesmo sem ter terminado tudo.
   */
  const tentarEnviar = useCallback(
    async (pedido: boolean) => {
      const atuais = await lerDados();

      if (atuais.atual && atuais.atual.prontas > 0 && !atuais.atual.envioPedido && (pedido || tudoAvaliado(atuais))) {
        await marcarEnvioPedido(atuais.atual.email);
      }

      if (!atuais.noTablet.some((avaliador) => avaliador.prontas > 0)) {
        return;
      }

      setEnviando(true);
      try {
        const { enviadas, comAviso, recusados } = await enviar((avaliador) => avaliador.envioPedido);
        setFalha(null);

        if (recusados.length > 0) {
          setAviso({ tipo: 'erro', mensagem: recusados.map((recusado) => recusado.erro).join(' ') });
        } else if (comAviso > 0) {
          setAviso({ tipo: 'erro', mensagem: `${comAviso === 1 ? 'Uma avaliação voltou' : `${comAviso} avaliações voltaram`} do servidor com aviso. Confira na lista.` });
        } else if (enviadas > 0) {
          setAviso({ tipo: 'sucesso', mensagem: `${quantas(enviadas)} ${enviadas === 1 ? 'registrada' : 'registradas'} no servidor.` });
        }
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : 'Não foi possível enviar.';
        setFalha(mensagem);
        if (pedido) {
          setAviso({ tipo: 'erro', mensagem });
        }
      } finally {
        await recarregar();
        setEnviando(false);
      }
    },
    [recarregar]
  );

  /** Com internet: busca projetos e avaliadores atualizados e manda o que estiver na hora. */
  const aproveitarInternet = useCallback(async () => {
    try {
      await guardarPacote(await baixarPacote());
      await recarregar();
    } catch {
      // Sem servidor agora: o que veio no APK continua valendo.
    }
    await tentarEnviar(false);
  }, [recarregar, tentarEnviar]);

  // Abre o banco; na primeira vez, põe nele os projetos e avaliadores do APK.
  useEffect(() => {
    guardarPacote(pacoteDoApk as Pacote, true)
      .then(recarregar)
      .finally(() => setPronto(true));
  }, [recarregar]);

  // A internet voltou: atualiza o pacote e envia o que estiver pronto.
  useEffect(() => {
    const aplicar = (estado: NetworkState) => {
      const agora = temInternet(estado);
      const voltou = agora && !onlineAtual.current;
      onlineAtual.current = agora;
      setOnline(agora);

      if (voltou) {
        aproveitarInternet();
      }
    };

    getNetworkStateAsync().then(aplicar);
    const assinatura = addNetworkStateListener(aplicar);
    return () => assinatura.remove();
  }, [aproveitarInternet]);

  // O app voltou para a frente (o tablet pode ter ido para onde há sinal).
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && onlineAtual.current) {
        tentarEnviar(false);
      }
    });
    return () => assinatura.remove();
  }, [tentarEnviar]);

  // Conectado mas sem alcançar o servidor (Wi-Fi sem internet, por exemplo):
  // o evento de rede não vem de novo, então insiste enquanto houver o que mandar.
  const haParaEnviar = dados.noTablet.some((avaliador) => avaliador.prontas > 0 && avaliador.envioPedido);
  useEffect(() => {
    if (!haParaEnviar) {
      return;
    }

    const intervalo = setInterval(() => {
      if (onlineAtual.current) {
        tentarEnviar(false);
      }
    }, NOVA_TENTATIVA_MS);
    return () => clearInterval(intervalo);
  }, [haParaEnviar, tentarEnviar]);

  const escolher = useCallback(
    async (avaliador: Avaliador) => {
      await escolherAvaliador(avaliador);
      setFalha(null);
      await recarregar();
    },
    [recarregar]
  );

  // Passar o tablet adiante não apaga nada: as finalizadas de quem sai vão
  // para o servidor agora, se houver internet, ou depois.
  const trocarAvaliador = useCallback(async () => {
    await liberarParaOutro();
    await recarregar();
    if (onlineAtual.current) {
      tentarEnviar(false);
    }
  }, [recarregar, tentarEnviar]);

  const salvar = useCallback(
    async (uuid: string, niveis: Niveis, comentarios: string, acao: 'rascunho' | 'finalizar') => {
      if (!dados.atual) {
        return { ok: false, salvo: false, mensagem: 'Escolha o seu nome antes de avaliar.' };
      }

      const resultado = await registrarNoAparelho(dados.atual.email, dados.fila, uuid, niveis, comentarios, acao);
      const atuais = await recarregar();

      if (resultado.salvo && tudoAvaliado(atuais)) {
        resultado.mensagem = onlineAtual.current
          ? `${resultado.mensagem} Todos os grupos foram avaliados: enviando as avaliações.`
          : `${resultado.mensagem} Todos os grupos foram avaliados. Sem internet agora: as avaliações ficam no tablet e são enviadas quando a conexão voltar.`;
        tentarEnviar(false);
      }

      return resultado;
    },
    [dados.atual, dados.fila, recarregar, tentarEnviar]
  );

  const atualizarProjetos = useCallback(async () => {
    try {
      const novo = await baixarPacote();
      await guardarPacote(novo);
      await recarregar();
      setAviso({ tipo: 'sucesso', mensagem: `Atualizado: ${novo.projetos.length} projetos e ${novo.avaliadores?.length ?? 0} avaliadores.` });
    } catch (erro) {
      setAviso({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível atualizar os projetos.' });
    }
    await tentarEnviar(false);
  }, [recarregar, tentarEnviar]);

  const dispensar = useCallback(
    async (uuid: string) => {
      if (dados.atual) {
        await dispensarAviso(dados.atual.email, uuid);
        await recarregar();
      }
    },
    [dados.atual, recarregar]
  );

  const limparAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo<Estado>(
    () => ({
      ...dados,
      pronto,
      todasAvaliadas: tudoAvaliado(dados),
      prontasNoTablet: dados.noTablet.reduce((soma, avaliador) => soma + avaliador.prontas, 0),
      online,
      enviando,
      falha,
      escolher,
      trocarAvaliador,
      salvar,
      enviarAgora: () => tentarEnviar(true),
      atualizarProjetos,
      dispensarAviso: dispensar,
      aviso,
      avisar: setAviso,
      limparAviso,
    }),
    [dados, pronto, online, enviando, falha, escolher, trocarAvaliador, salvar, tentarEnviar, atualizarProjetos, dispensar, aviso, limparAviso]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAvaliacao(): Estado {
  const estado = useContext(Contexto);
  if (!estado) {
    throw new Error('useAvaliacao precisa estar dentro de <AvaliacaoProvider>.');
  }

  return estado;
}
