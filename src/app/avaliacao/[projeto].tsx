import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraProgresso } from '@/components/BarraProgresso';
import { Cartao } from '@/components/Cartao';
import { Selo } from '@/components/Selo';
import { Texto } from '@/components/Texto';
import { useAvaliacao } from '@/context/AvaliacaoContext';
import {
  CHAVES_CRITERIOS,
  CHAVES_NIVEIS,
  CRITERIOS,
  NIVEIS,
  PARECER_MAXIMO,
  criteriosMarcados,
  mencaoDaFicha,
  niveisVazios,
  proximoPendente,
  type Criterio,
  type ItemFila,
  type Nivel,
  type Niveis,
} from '@/lib/avaliacao';
import { CORES_MENCAO } from '@/theme/mencoes';
import { usePaleta } from '@/theme/usePaleta';

const TOTAL_CRITERIOS = CHAVES_CRITERIOS.length;

function voltarParaFila() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/avaliacao');
  }
}

export default function FichaDeAvaliacao() {
  const { projeto: uuid } = useLocalSearchParams<{ projeto: string }>();
  const { fila, pronto, email } = useAvaliacao();
  const paleta = usePaleta();
  const indice = fila.findIndex((item) => item.projeto.uuid === uuid);

  if (!pronto) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={paleta.primary} size="large" />
      </View>
    );
  }

  if (!email) {
    return <Redirect href="/identificacao" />;
  }

  if (indice === -1) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-margin-mobile gap-4">
        <Texto peso="bold" className="text-body-md text-on-surface text-center">
          Este grupo não está na sua fila
        </Texto>
        <Texto className="text-body-sm text-on-surface-variant text-center">
          O projeto pode ter sido reaberto pelo grupo, ou a feira já foi finalizada.
        </Texto>
        <Pressable className="px-5 py-3 rounded-xl bg-primary" onPress={() => router.replace('/avaliacao')}>
          <Texto peso="medium" className="text-label-md text-on-primary">
            Voltar para a fila
          </Texto>
        </Pressable>
      </View>
    );
  }

  // key: ao ir para o próximo grupo, a ficha começa do zero com a dele. O
  // aviso entra na key porque ele chega junto com a versão do servidor (numa
  // recusa ou conflito), e a tela precisa mostrar essa, e não a antiga.
  const item = fila[indice];
  return <Ficha fila={fila} indice={indice} item={item} key={`${uuid}:${item.aviso ?? ''}`} />;
}

function Ficha({ item, fila, indice }: { item: ItemFila; fila: ItemFila[]; indice: number }) {
  const { salvar: salvarFicha, avisar, dispensarAviso } = useAvaliacao();
  const navigation = useNavigation();
  const paleta = usePaleta();
  const { top, bottom } = useSafeAreaInsets();
  // No tablet a ficha fica numa coluna de até 760px no meio da tela, e a barra
  // de baixo acompanha a mesma coluna.
  const { width } = useWindowDimensions();
  const lateral = Math.max(16, (width - 760) / 2 + 16);
  const { projeto } = item;

  const [niveis, setNiveis] = useState<Niveis>(() =>
    item.avaliacao
      ? Object.fromEntries(CHAVES_CRITERIOS.map((criterio) => [criterio, item.avaliacao![criterio]])) as Niveis
      : niveisVazios()
  );
  const [comentarios, setComentarios] = useState(item.avaliacao?.comentarios ?? '');
  const [salvando, setSalvando] = useState(false);
  const [descricaoAberta, setDescricaoAberta] = useState(false);

  // Ref, e não estado: o aviso de saída lê o valor na hora em que o
  // avaliador sai, e não o de quando o listener foi registrado.
  const alterada = useRef(false);

  const marcados = criteriosMarcados(niveis);
  // A mesma conta do site, refeita a cada toque. Parcial, conta só os
  // critérios já marcados.
  const mencaoAtual = mencaoDaFicha(niveis);
  const coresMencao = CORES_MENCAO[mencaoAtual ?? 'nenhuma'];
  const jaFinalizada = item.situacao === 'avaliado';
  const travada = item.travada;
  const temProximo = proximoPendente(fila, indice) !== null;

  // Voltar para a lista com a ficha pela metade perderia os cliques sem
  // aviso: pergunta antes, como o site faz ao trocar de grupo.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (evento) => {
        if (!alterada.current) {
          return;
        }

        evento.preventDefault();
        const sair = () => {
          alterada.current = false;
          navigation.dispatch(evento.data.action);
        };

        if (Platform.OS === 'web') {
          if (window.confirm('Descartar as alterações desta avaliação?')) {
            sair();
          }
          return;
        }

        Alert.alert('Descartar alterações?', 'Você mexeu na avaliação e ainda não salvou.', [
          { text: 'Continuar avaliando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: sair },
        ]);
      }),
    [navigation]
  );

  const marcar = (criterio: Criterio, nivel: Nivel) => {
    alterada.current = true;
    setNiveis((atuais) => ({ ...atuais, [criterio]: nivel }));
  };

  const escrever = (texto: string) => {
    alterada.current = true;
    setComentarios(texto);
  };

  const salvar = async (acao: 'rascunho' | 'finalizar') => {
    setSalvando(true);
    try {
      // Salva no tablet: funciona sem internet, e o envio vem depois.
      const resultado = await salvarFicha(projeto.uuid, niveis, comentarios, acao);
      if (resultado.salvo) {
        alterada.current = false;
      }

      avisar({ tipo: resultado.ok ? 'sucesso' : 'erro', mensagem: resultado.mensagem });
      setSalvando(false);

      if (resultado.proximoUuid) {
        router.replace(`/avaliacao/${resultado.proximoUuid}`);
      }
    } catch {
      avisar({ tipo: 'erro', mensagem: 'Não foi possível salvar no tablet. Tente de novo.' });
      setSalvando(false);
    }
  };

  // Só http(s): o link do vídeo é digitado pelo grupo. Abre fora do app, e
  // só com internet — o resto da ficha não depende dele.
  const videoUrl = projeto.video_url && /^https?:\/\//i.test(projeto.video_url) ? projeto.video_url : null;

  const etiquetas = [projeto.grupo_nome, projeto.categoria, projeto.evento_nome].filter(Boolean) as string[];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingTop: top + 12, paddingBottom: 24, paddingHorizontal: lateral, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Topo: de onde veio e como voltar para a lista. */}
        <View>
          <View className="flex-row items-center justify-between gap-2 mb-1">
            <View className="flex-row items-center gap-2 flex-1 min-w-0">
              <Selo item={item} />
              <Texto peso="medium" className="flex-1 text-label-sm text-outline" numberOfLines={1}>
                {projeto.grupo_nome}
              </Texto>
            </View>
            <Pressable accessibilityRole="link" className="flex-row items-center py-1" hitSlop={8} onPress={voltarParaFila}>
              <MaterialIcons color={paleta.primary} name="chevron-left" size={18} />
              <Texto peso="semibold" className="text-label-sm text-primary">
                Trocar grupo
              </Texto>
            </Pressable>
          </View>
          <Texto peso="bold" className="text-headline-md text-on-surface">
            Avaliar grupo
          </Texto>
          {item.pendente && (
            <View className="flex-row items-center gap-1 mt-1">
              <MaterialIcons color={paleta.secondary} name={jaFinalizada ? 'cloud-upload' : 'edit-note'} size={16} />
              <Texto peso="medium" className="text-label-sm text-secondary">
                {jaFinalizada ? 'Salva no tablet, falta enviar ao servidor' : 'Rascunho salvo no tablet'}
              </Texto>
            </View>
          )}
        </View>

        {/* O que o servidor respondeu da última vez que recebeu esta ficha. */}
        {item.aviso && (
          <View className="flex-row items-start gap-3 rounded-2xl bg-error-container p-4">
            <MaterialIcons color={paleta['on-error-container']} name="error-outline" size={20} />
            <Texto className="flex-1 text-body-sm text-on-error-container">{item.aviso}</Texto>
            <Pressable accessibilityLabel="Dispensar aviso" accessibilityRole="button" hitSlop={8} onPress={() => dispensarAviso(projeto.uuid)}>
              <MaterialIcons color={paleta['on-error-container']} name="close" size={20} />
            </Pressable>
          </View>
        )}

        {/* GRUPO AVALIADO */}
        <Cartao>
          <Texto peso="semibold" className="text-headline-sm text-on-surface">
            Grupo avaliado
          </Texto>
          <Texto peso="bold" className="text-headline-md text-on-surface mt-3">
            {projeto.titulo}
          </Texto>
          <View className="flex-row flex-wrap gap-2 mt-3">
            {etiquetas.map((etiqueta) => (
              <View className="px-3 py-1 rounded-full bg-surface-container" key={etiqueta}>
                <Texto peso="medium" className="text-label-sm text-on-surface-variant">
                  {etiqueta}
                </Texto>
              </View>
            ))}
          </View>

          <View className="gap-4 mt-stack-md pt-stack-md border-t border-outline-variant">
            <Dado rotulo="Integrantes">
              {projeto.membros.length === 0 ? (
                <Texto className="text-body-sm text-outline italic">Nenhum aluno no grupo</Texto>
              ) : (
                <Texto className="text-body-sm text-on-surface">{projeto.membros.join(' · ')}</Texto>
              )}
            </Dado>
            <Dado rotulo="Escola">
              <Texto className="text-body-sm text-on-surface">{projeto.escola?.trim() || '—'}</Texto>
            </Dado>
            <Dado rotulo="Orientação">
              <Texto className="text-body-sm text-on-surface">{projeto.orientador_nome ?? 'Sem orientador'}</Texto>
            </Dado>
          </View>

          {videoUrl && (
            <Pressable
              accessibilityRole="link"
              className="flex-row items-center self-start gap-1.5 px-3 py-2 mt-stack-md rounded-xl border border-outline-variant active:border-primary active:bg-primary/5"
              onPress={() => Linking.openURL(videoUrl)}
            >
              <MaterialIcons color={paleta.primary} name="play-circle-outline" size={18} />
              <Texto peso="medium" className="text-label-sm text-primary">
                Vídeo
              </Texto>
            </Pressable>
          )}

          {projeto.descricao?.trim() ? (
            <View className="mt-4">
              <Pressable
                accessibilityState={{ expanded: descricaoAberta }}
                className="flex-row items-center gap-1 self-start py-1"
                onPress={() => setDescricaoAberta((aberta) => !aberta)}
              >
                <MaterialIcons color={paleta.primary} name={descricaoAberta ? 'expand-less' : 'expand-more'} size={18} />
                <Texto peso="semibold" className="text-label-sm text-primary">
                  {descricaoAberta ? 'Esconder a descrição' : 'Ler a descrição do projeto'}
                </Texto>
              </Pressable>
              {descricaoAberta && <Texto className="mt-2 text-body-sm text-on-surface">{projeto.descricao}</Texto>}
            </View>
          ) : null}
        </Cartao>

        {/* CRITÉRIOS */}
        <Cartao>
          <Texto peso="semibold" className="text-headline-sm text-on-surface">
            Critérios de avaliação
          </Texto>
          <Texto peso="medium" className="text-label-sm text-outline mt-1">
            {CHAVES_NIVEIS.map((nivel) => `${NIVEIS[nivel].sigla} = ${NIVEIS[nivel].rotulo}`).join(' · ')}
          </Texto>

          {CHAVES_CRITERIOS.map((criterio, posicao) => (
            <View className={`py-stack-md gap-3 ${posicao > 0 ? 'border-t border-outline-variant' : ''} ${posicao === TOTAL_CRITERIOS - 1 ? 'pb-0' : ''}`} key={criterio}>
              <View>
                <View className="flex-row items-baseline gap-2">
                  <Texto peso="medium" className="text-label-sm text-outline">
                    {String(posicao + 1).padStart(2, '0')}
                  </Texto>
                  <Texto peso="medium" className="flex-1 text-label-md text-on-surface">
                    {CRITERIOS[criterio].titulo}
                  </Texto>
                </View>
                <Texto className="text-body-sm text-on-surface-variant mt-1">{CRITERIOS[criterio].descricao}</Texto>
              </View>

              {/* items-stretch: os três botões ficam da mesma altura, mesmo quando
                  "Parcialmente atendido" quebra em duas linhas. */}
              <View accessibilityLabel={CRITERIOS[criterio].titulo} accessibilityRole="radiogroup" className="flex-row items-stretch gap-2">
                {CHAVES_NIVEIS.map((nivel) => {
                  const marcado = niveis[criterio] === nivel;
                  return (
                    <Pressable
                      accessibilityLabel={NIVEIS[nivel].rotulo}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: marcado, disabled: travada }}
                      className={`flex-1 items-center justify-center rounded-xl border px-2 py-2.5 ${
                        marcado ? 'bg-primary border-primary' : `border-outline-variant ${travada ? 'opacity-60' : 'active:border-primary'}`
                      }`}
                      disabled={travada}
                      key={nivel}
                      onPress={() => marcar(criterio, nivel)}
                    >
                      <Texto peso="bold" className={`text-headline-sm ${marcado ? 'text-on-primary' : 'text-on-surface'}`}>
                        {NIVEIS[nivel].sigla}
                      </Texto>
                      <Texto className={`text-label-sm leading-tight text-center opacity-80 ${marcado ? 'text-on-primary' : 'text-on-surface'}`}>
                        {NIVEIS[nivel].rotulo}
                      </Texto>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Cartao>

        {/* PARECER */}
        <Cartao>
          <View className="flex-row items-center justify-between gap-2">
            <Texto peso="semibold" className="text-headline-sm text-on-surface">
              Parecer do avaliador
            </Texto>
            <Texto peso="medium" className="text-label-sm text-outline">
              Opcional
            </Texto>
          </View>
          <Texto peso="semibold" className="text-label-sm text-on-surface-variant mt-3">
            Comentários para o grupo
          </Texto>
          <TextInput
            accessibilityLabel="Comentários para o grupo"
            className="font-poppins w-full mt-1 p-3 rounded-xl border border-outline-variant bg-surface text-body-sm text-on-surface min-h-32"
            editable={!travada}
            maxLength={PARECER_MAXIMO}
            multiline
            onChangeText={escrever}
            placeholder="Pontos fortes, sugestões de melhoria e observações sobre a entrega."
            placeholderTextColor={paleta.outline}
            textAlignVertical="top"
            value={comentarios}
          />
          <Texto className="text-label-sm text-outline mt-1 text-right">
            {comentarios.length}/{PARECER_MAXIMO}
          </Texto>
        </Cartao>
      </ScrollView>

      {/* MENÇÃO E AÇÕES: fixa embaixo, para a menção acompanhar os toques enquanto a ficha rola. */}
      <View
        className="bg-surface-container-lowest border-t border-outline-variant pt-4 gap-4 shadow-lg shadow-black/20"
        style={{ paddingBottom: bottom + 12, paddingHorizontal: lateral }}
      >
        <View className="flex-row items-center gap-4">
          <View
            accessibilityLabel={`${jaFinalizada ? 'Menção deste grupo' : 'Menção parcial'}: ${mencaoAtual ? NIVEIS[mencaoAtual].rotulo : 'nenhum critério marcado'}`}
            accessible
          >
            <Texto peso="medium" className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              {jaFinalizada ? 'Menção deste grupo' : 'Menção parcial'}
            </Texto>
            <View className="flex-row items-center gap-2 mt-1">
              <View className={`min-w-12 h-12 px-2 rounded-xl items-center justify-center ${coresMencao.fundo}`}>
                <Texto peso="bold" className={`text-[26px] leading-[32px] ${coresMencao.texto}`}>
                  {mencaoAtual ? NIVEIS[mencaoAtual].sigla : '—'}
                </Texto>
              </View>
              <Texto className="text-body-sm text-on-surface-variant max-w-36">
                {mencaoAtual ? NIVEIS[mencaoAtual].rotulo : 'Nenhum critério marcado'}
              </Texto>
            </View>
          </View>
          <View className="flex-1">
            <BarraProgresso fracao={marcados / TOTAL_CRITERIOS} />
            <Texto className="text-label-sm text-on-surface-variant mt-1.5">
              {marcados} de {TOTAL_CRITERIOS} critérios avaliados
            </Texto>
          </View>
        </View>

        {travada ? (
          <View className="flex-row items-center gap-2">
            <MaterialIcons color={paleta['on-surface-variant']} name="lock-outline" size={20} />
            <Texto className="flex-1 text-body-sm text-on-surface-variant">
              As menções desta feira já foram liberadas para os alunos. A avaliação não pode mais ser alterada.
            </Texto>
          </View>
        ) : (
          <View className="flex-row gap-2">
            {!jaFinalizada && (
              <Pressable
                accessibilityRole="button"
                className={`items-center justify-center px-4 py-3 rounded-xl border border-outline-variant active:border-primary ${salvando ? 'opacity-50' : ''}`}
                disabled={salvando}
                onPress={() => salvar('rascunho')}
              >
                <Texto peso="medium" className="text-label-sm text-on-surface">
                  Salvar rascunho
                </Texto>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: salvando || marcados < TOTAL_CRITERIOS }}
              className={`flex-1 flex-row items-center justify-center gap-2 bg-primary px-4 py-3 rounded-xl active:opacity-80 ${
                salvando || marcados < TOTAL_CRITERIOS ? 'opacity-50' : ''
              }`}
              disabled={salvando || marcados < TOTAL_CRITERIOS}
              onPress={() => salvar('finalizar')}
            >
              {salvando ? (
                <ActivityIndicator color={paleta['on-primary']} size="small" />
              ) : (
                <MaterialIcons color={paleta['on-primary']} name={jaFinalizada ? 'save' : 'task-alt'} size={18} />
              )}
              <Texto peso="medium" className="shrink text-label-sm text-on-primary text-center">
                {jaFinalizada ? 'Salvar alterações' : temProximo ? 'Finalizar e ir ao próximo' : 'Finalizar avaliação'}
              </Texto>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View>
      <Texto peso="medium" className="text-label-sm text-on-surface-variant uppercase tracking-wider">
        {rotulo}
      </Texto>
      <View className="mt-1">{children}</View>
    </View>
  );
}
