import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ErroDeEmail, baixarPacote, type Pacote } from '@/api/cliente';
import pacoteDoApk from '@/dados/pacote-inicial.json';
import type { Niveis } from '@/lib/avaliacao';
import {
  dispensarAviso,
  gravarEmail,
  guardarPacote,
  lerDados,
  liberarTablet,
  marcarEnvioPedido,
  type DadosDoTablet,
} from '@/offline/armazem';
import { enviar } from '@/offline/envio';
import { registrarNoAparelho, type ResultadoSalvar } from '@/offline/registrar';

type Aviso = { tipo: 'sucesso' | 'erro'; mensagem: string };

type Estado = DadosDoTablet & {
  /** O banco do tablet já foi lido. */
  pronto: boolean;
  /** Todos os grupos da fila estão finalizados. */
  todasAvaliadas: boolean;
  online: boolean;
  enviando: boolean;
  /** Por que o último envio falhou, até o próximo dar certo. */
  falha: string | null;
  /** A falha foi o e-mail: o servidor não conhece. O avaliador precisa corrigir. */
  falhaDeEmail: boolean;
  definirEmail: (email: string) => Promise<void>;
  salvar: (uuid: string, niveis: Niveis, comentarios: string, acao: 'rascunho' | 'finalizar') => Promise<ResultadoSalvar>;
  enviarAgora: () => Promise<void>;
  atualizarProjetos: () => Promise<void>;
  liberar: () => Promise<void>;
  dispensarAviso: (uuid: string) => Promise<void>;
  aviso: Aviso | null;
  avisar: (aviso: Aviso) => void;
  limparAviso: () => void;
};

const Contexto = createContext<Estado | null>(null);

/** Enquanto houver ficha esperando e internet, tenta de novo neste intervalo. */
const NOVA_TENTATIVA_MS = 60000;

const semDados: DadosDoTablet = {
  email: null,
  nome: null,
  envioPedido: false,
  pacoteGeradoEm: null,
  fila: [],
  prontasParaEnviar: 0,
  enviadas: 0,
};

function temInternet(estado: NetworkState): boolean {
  return Boolean(estado.isConnected) && estado.isInternetReachable !== false;
}

function tudoAvaliado(dados: DadosDoTablet): boolean {
  return dados.fila.length > 0 && dados.fila.every((item) => item.situacao === 'avaliado');
}

/**
 * O app funciona a partir do que está no tablet. O servidor só entra em dois
 * momentos: para atualizar os projetos (quando há internet) e para receber as
 * avaliações — o que acontece sozinho quando o avaliador termina todos os
 * grupos, ou quando ele pede, e de novo sempre que a internet volta.
 */
export function AvaliacaoProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [dados, setDados] = useState<DadosDoTablet>(semDados);
  const [online, setOnline] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [falhaDeEmail, setFalhaDeEmail] = useState(false);
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
   * Envia se houver o que enviar e o momento chegou: o avaliador terminou
   * todos os grupos ou já pediu o envio. `pedido` é o toque no botão.
   */
  const tentarEnviar = useCallback(
    async (pedido: boolean) => {
      const atuais = await lerDados();
      const chegouAHora = pedido || atuais.envioPedido || tudoAvaliado(atuais);

      if (!atuais.email || atuais.prontasParaEnviar === 0 || !chegouAHora) {
        return;
      }

      if (!atuais.envioPedido) {
        await marcarEnvioPedido();
      }

      setEnviando(true);
      try {
        const { enviadas, comAviso, nome } = await enviar(atuais.email);
        setFalha(null);
        setFalhaDeEmail(false);

        if (comAviso > 0) {
          setAviso({
            tipo: 'erro',
            mensagem: `${comAviso === 1 ? 'Uma avaliação voltou' : `${comAviso} avaliações voltaram`} do servidor com aviso. Confira na lista.`,
          });
        } else if (enviadas > 0) {
          setAviso({
            tipo: 'sucesso',
            mensagem: `${enviadas === 1 ? 'Avaliação registrada' : `${enviadas} avaliações registradas`} no nome de ${nome}.`,
          });
        }
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : 'Não foi possível enviar.';
        setFalha(mensagem);
        setFalhaDeEmail(erro instanceof ErroDeEmail);
        if (pedido || erro instanceof ErroDeEmail) {
          setAviso({ tipo: 'erro', mensagem });
        }
      } finally {
        await recarregar();
        setEnviando(false);
      }
    },
    [recarregar]
  );

  /** Com internet: busca os projetos atualizados e manda o que estiver na hora. */
  const aproveitarInternet = useCallback(async () => {
    try {
      await guardarPacote(await baixarPacote());
      await recarregar();
    } catch {
      // Sem servidor agora: os projetos do APK continuam valendo.
    }
    await tentarEnviar(false);
  }, [recarregar, tentarEnviar]);

  // Abre o banco; na primeira vez, põe nele os projetos que vieram no APK.
  useEffect(() => {
    guardarPacote(pacoteDoApk as Pacote, true)
      .then(recarregar)
      .finally(() => setPronto(true));
  }, [recarregar]);

  // A internet voltou: atualiza os projetos e envia o que estiver pronto.
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
  // o evento de rede não vem de novo, então insiste.
  useEffect(() => {
    if (dados.prontasParaEnviar === 0 || !(dados.envioPedido || tudoAvaliado(dados))) {
      return;
    }

    const intervalo = setInterval(() => {
      if (onlineAtual.current) {
        tentarEnviar(false);
      }
    }, NOVA_TENTATIVA_MS);
    return () => clearInterval(intervalo);
  }, [dados, tentarEnviar]);

  const definirEmail = useCallback(
    async (email: string) => {
      await gravarEmail(email);
      setFalha(null);
      setFalhaDeEmail(false);
      await recarregar();
      if (onlineAtual.current) {
        tentarEnviar(false);
      }
    },
    [recarregar, tentarEnviar]
  );

  const salvar = useCallback(
    async (uuid: string, niveis: Niveis, comentarios: string, acao: 'rascunho' | 'finalizar') => {
      const resultado = await registrarNoAparelho(dados.fila, uuid, niveis, comentarios, acao);
      const atuais = await recarregar();

      if (resultado.salvo && tudoAvaliado(atuais)) {
        resultado.mensagem = onlineAtual.current
          ? `${resultado.mensagem} Todos os grupos foram avaliados: enviando as avaliações.`
          : `${resultado.mensagem} Todos os grupos foram avaliados. Sem internet agora: as avaliações ficam no tablet e são enviadas quando a conexão voltar.`;
        tentarEnviar(false);
      }

      return resultado;
    },
    [dados.fila, recarregar, tentarEnviar]
  );

  const atualizarProjetos = useCallback(async () => {
    try {
      const novo = await baixarPacote();
      await guardarPacote(novo);
      await recarregar();
      setAviso({ tipo: 'sucesso', mensagem: `Projetos atualizados: ${novo.projetos.length} na feira.` });
    } catch (erro) {
      setAviso({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível atualizar os projetos.' });
    }
    await tentarEnviar(false);
  }, [recarregar, tentarEnviar]);

  const liberar = useCallback(async () => {
    await liberarTablet();
    setFalha(null);
    setFalhaDeEmail(false);
    await recarregar();
  }, [recarregar]);

  const dispensar = useCallback(
    async (uuid: string) => {
      await dispensarAviso(uuid);
      await recarregar();
    },
    [recarregar]
  );

  const limparAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo<Estado>(
    () => ({
      ...dados,
      pronto,
      todasAvaliadas: tudoAvaliado(dados),
      online,
      enviando,
      falha,
      falhaDeEmail,
      definirEmail,
      salvar,
      enviarAgora: () => tentarEnviar(true),
      atualizarProjetos,
      liberar,
      dispensarAviso: dispensar,
      aviso,
      avisar: setAviso,
      limparAviso,
    }),
    [dados, pronto, online, enviando, falha, falhaDeEmail, definirEmail, salvar, tentarEnviar, atualizarProjetos, liberar, dispensar, aviso, limparAviso]
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
