import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAvaliacao } from '@/context/AvaliacaoContext';
import { usePaleta } from '@/theme/usePaleta';

import { Texto } from './Texto';

/** '2026-09-27 23:03:25' → '27/09 às 23:03'. A data vem do relógio do servidor. */
function formatarData(data: string): string {
  const [dia, hora] = data.split(' ');
  const [, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes} às ${hora.slice(0, 5)}`;
}

const quantas = (n: number) => (n === 1 ? '1 avaliação' : `${n} avaliações`);

type Tom = 'neutro' | 'alerta' | 'sucesso';
type Icone = 'cloud-off' | 'cloud-upload' | 'cloud-done' | 'error-outline' | 'check-circle-outline' | 'edit-note';

/**
 * O que está acontecendo com as avaliações, no topo da lista. No dia sem
 * internet é por aqui que o avaliador sabe que pode seguir avaliando, e no
 * fim, que tudo chegou ao servidor.
 */
export function StatusEnvio({ aoLiberar }: { aoLiberar: () => void }) {
  const { email, nome, online, enviando, falha, falhaDeEmail, prontasParaEnviar, enviadas, todasAvaliadas, envioPedido, fila, pacoteGeradoEm, enviarAgora } =
    useAvaliacao();
  const paleta = usePaleta();
  const avaliados = fila.filter((item) => item.situacao === 'avaliado').length;

  let tom: Tom = 'neutro';
  let icone: Icone = 'edit-note';
  let titulo: string;
  let texto: string | null = null;
  let acao: { rotulo: string; aoTocar: () => void } | null = null;

  if (falhaDeEmail) {
    tom = 'alerta';
    icone = 'error-outline';
    titulo = 'E-mail não cadastrado';
    texto = `${falha ?? ''} As avaliações continuam salvas no tablet.`;
    acao = { rotulo: 'Corrigir e-mail', aoTocar: () => router.push('/identificacao') };
  } else if (enviando) {
    icone = 'cloud-upload';
    titulo = `Enviando ${quantas(prontasParaEnviar)}…`;
    texto = 'Conferindo o e-mail no servidor.';
  } else if (prontasParaEnviar > 0 && (todasAvaliadas || envioPedido)) {
    if (!online) {
      icone = 'cloud-off';
      titulo = todasAvaliadas ? 'Avaliação concluída' : 'Envio pedido';
      texto = `Sem internet agora. ${quantas(prontasParaEnviar)} ${prontasParaEnviar === 1 ? 'fica guardada' : 'ficam guardadas'} no tablet e ${prontasParaEnviar === 1 ? 'é enviada' : 'são enviadas'} sozinha${prontasParaEnviar === 1 ? '' : 's'} quando a conexão voltar.`;
    } else if (falha) {
      tom = 'alerta';
      icone = 'error-outline';
      titulo = 'Não foi possível enviar';
      texto = `${falha} O app tenta de novo sozinho.`;
      acao = { rotulo: 'Tentar agora', aoTocar: enviarAgora };
    } else {
      icone = 'cloud-upload';
      titulo = `${quantas(prontasParaEnviar)} para enviar`;
      acao = { rotulo: 'Enviar agora', aoTocar: enviarAgora };
    }
  } else if (todasAvaliadas && prontasParaEnviar === 0 && enviadas > 0) {
    tom = 'sucesso';
    icone = 'check-circle-outline';
    titulo = 'Tudo enviado!';
    texto = `${quantas(enviadas)} ${enviadas === 1 ? 'registrada' : 'registradas'} no nome de ${nome ?? email}. O tablet pode ser liberado para o próximo avaliador.`;
    acao = { rotulo: 'Liberar tablet', aoTocar: aoLiberar };
  } else {
    titulo = `${avaliados} de ${fila.length} grupos avaliados`;
    texto = online
      ? 'Tudo fica salvo no tablet. Quando você finalizar todos os grupos, as avaliações são enviadas.'
      : 'Sem internet, e tudo bem: tudo fica salvo no tablet. Quando você finalizar todos os grupos, as avaliações são enviadas assim que houver conexão.';
    if (prontasParaEnviar > 0 && online) {
      acao = { rotulo: 'Enviar já', aoTocar: enviarAgora };
    }
  }

  const fundo = { neutro: 'bg-surface-container-low border border-outline-variant', alerta: 'bg-error-container', sucesso: 'bg-tertiary-fixed' }[tom];
  const corTitulo = { neutro: 'text-on-surface', alerta: 'text-on-error-container', sucesso: 'text-on-tertiary-fixed-variant' }[tom];
  const corTexto = { neutro: 'text-on-surface-variant', alerta: 'text-on-error-container', sucesso: 'text-on-tertiary-fixed-variant' }[tom];
  const corIcone = { neutro: paleta['on-surface-variant'], alerta: paleta['on-error-container'], sucesso: paleta['on-tertiary-fixed-variant'] }[tom];

  return (
    <View accessibilityLiveRegion="polite" className={`rounded-2xl p-4 gap-2 ${fundo}`}>
      <View className="flex-row items-center gap-3">
        {enviando ? <ActivityIndicator color={paleta.primary} size="small" /> : <MaterialIcons color={corIcone} name={icone} size={22} />}
        <Texto peso="semibold" className={`flex-1 text-body-md ${corTitulo}`}>
          {titulo}
        </Texto>
        {acao && !enviando && (
          <Pressable accessibilityRole="button" className="rounded-xl bg-primary px-4 py-2 active:opacity-80" onPress={acao.aoTocar}>
            <Texto peso="medium" className="text-label-sm text-on-primary">
              {acao.rotulo}
            </Texto>
          </Pressable>
        )}
      </View>
      {texto && <Texto className={`text-body-sm ${corTexto}`}>{texto}</Texto>}
      <Texto className={`text-label-sm ${tom === 'neutro' ? 'text-outline' : corTexto}`}>
        {pacoteGeradoEm ? `Projetos da feira de ${formatarData(pacoteGeradoEm)}` : 'Sem os projetos da feira'} · {online ? 'com internet' : 'sem internet'}
      </Texto>
    </View>
  );
}
