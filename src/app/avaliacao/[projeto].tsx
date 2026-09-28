import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { carregarDetalhe, salvarAvaliacao, type DetalheProjeto } from '@/api/avaliacoes';
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
  formatNota,
  niveisVazios,
  pontos,
  proximoPendente,
  type Criterio,
  type ItemFila,
  type Nivel,
  type Niveis,
} from '@/lib/avaliacao';
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
  const { fila, carregando } = useAvaliacao();
  const paleta = usePaleta();
  const indice = fila.findIndex((item) => item.projeto.uuid === uuid);

  if (carregando) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={paleta.primary} size="large" />
      </View>
    );
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

  // key: ao ir para o próximo grupo, a ficha começa do zero com a dele.
  return <Ficha fila={fila} indice={indice} item={fila[indice]} key={uuid} />;
}

function Ficha({ item, fila, indice }: { item: ItemFila; fila: ItemFila[]; indice: number }) {
  const { recarregar, avisar } = useAvaliacao();
  const navigation = useNavigation();
  const paleta = usePaleta();
  const { top, bottom } = useSafeAreaInsets();
  const { projeto } = item;

  const [niveis, setNiveis] = useState<Niveis>(() =>
    item.avaliacao
      ? Object.fromEntries(CHAVES_CRITERIOS.map((criterio) => [criterio, item.avaliacao![criterio]])) as Niveis
      : niveisVazios()
  );
  const [comentarios, setComentarios] = useState(item.avaliacao?.comentarios ?? '');
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheProjeto | null>(null);
  const [descricaoAberta, setDescricaoAberta] = useState(false);

  // Ref, e não estado: o aviso de saída lê o valor na hora em que o
  // avaliador sai, e não o de quando o listener foi registrado.
  const alterada = useRef(false);

  const marcados = criteriosMarcados(niveis);
  const nota = pontos(niveis);
  const jaFinalizada = item.situacao === 'avaliado';
  const travada = item.travada;
  const temProximo = proximoPendente(fila, indice) !== null;

  useEffect(() => {
    let ativo = true;
    carregarDetalhe(projeto.uuid).then((resposta) => ativo && setDetalhe(resposta));
    return () => {
      ativo = false;
    };
  }, [projeto.uuid]);

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
      const resultado = await salvarAvaliacao(projeto.uuid, niveis, comentarios, acao);
      if (resultado.salvo) {
        alterada.current = false;
      }

      await recarregar();
      avisar({ tipo: resultado.ok ? 'sucesso' : 'erro', mensagem: resultado.mensagem });
      setSalvando(false);

      if (resultado.proximoUuid) {
        router.replace(`/avaliacao/${resultado.proximoUuid}`);
      }
    } catch {
      avisar({ tipo: 'erro', mensagem: 'Não foi possível salvar agora. Confira a conexão e tente de novo.' });
      setSalvando(false);
    }
  };

  // Só http(s): o link do vídeo é digitado pelo grupo.
  const videoUrl = projeto.video_url && /^https?:\/\//i.test(projeto.video_url) ? projeto.video_url : null;
  const materiais = [
    { icone: 'picture-as-pdf' as const, rotulo: 'Resumo (PDF)', url: detalhe?.resumoUrl ?? null },
    { icone: 'image' as const, rotulo: 'Banner', url: detalhe?.bannerUrl ?? null },
    { icone: 'play-circle-outline' as const, rotulo: 'Vídeo', url: videoUrl },
  ].filter((material) => material.url !== null);

  const etiquetas = [projeto.grupo_nome, projeto.categoria, projeto.evento_nome].filter(Boolean) as string[];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingTop: top + 12, paddingBottom: 24, paddingHorizontal: 16, gap: 16 }}
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
        </View>

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
              {detalhe === null ? (
                <Texto className="text-body-sm text-outline">Carregando…</Texto>
              ) : detalhe.membros.length === 0 ? (
                <Texto className="text-body-sm text-outline italic">Nenhum aluno no grupo</Texto>
              ) : (
                <Texto className="text-body-sm text-on-surface">{detalhe.membros.join(' · ')}</Texto>
              )}
            </Dado>
            <Dado rotulo="Escola">
              <Texto className="text-body-sm text-on-surface">{projeto.escola?.trim() || '—'}</Texto>
            </Dado>
            <Dado rotulo="Orientação">
              <Texto className="text-body-sm text-on-surface">{projeto.orientador_nome ?? 'Sem orientador'}</Texto>
            </Dado>
          </View>

          {/* O material que se avalia abre fora do app; a ficha continua como estava. */}
          <View className="flex-row flex-wrap gap-2 mt-stack-md">
            {materiais.map((material) => (
              <Pressable
                accessibilityRole="link"
                className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant active:border-primary active:bg-primary/5"
                key={material.rotulo}
                onPress={() => Linking.openURL(material.url!)}
              >
                <MaterialIcons color={paleta.primary} name={material.icone} size={18} />
                <Texto peso="medium" className="text-label-sm text-primary">
                  {material.rotulo}
                </Texto>
              </Pressable>
            ))}
            {detalhe !== null && materiais.length === 0 && (
              <Texto className="text-label-sm text-outline italic">O grupo não anexou resumo, banner nem vídeo.</Texto>
            )}
          </View>

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
            {CHAVES_NIVEIS.map((nivel) => `${NIVEIS[nivel].rotulo} ${formatNota(NIVEIS[nivel].pontos)}`).join(' · ')}
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

              <View accessibilityLabel={CRITERIOS[criterio].titulo} accessibilityRole="radiogroup" className="flex-row gap-2">
                {CHAVES_NIVEIS.map((nivel) => {
                  const marcado = niveis[criterio] === nivel;
                  return (
                    <Pressable
                      accessibilityLabel={`${NIVEIS[nivel].rotulo}, ${formatNota(NIVEIS[nivel].pontos)}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: marcado, disabled: travada }}
                      className={`flex-1 items-center rounded-xl border px-2 py-2.5 ${
                        marcado ? 'bg-primary border-primary' : `border-outline-variant ${travada ? 'opacity-60' : 'active:border-primary'}`
                      }`}
                      disabled={travada}
                      key={nivel}
                      onPress={() => marcar(criterio, nivel)}
                    >
                      <Texto peso="medium" className={`text-label-md ${marcado ? 'text-on-primary' : 'text-on-surface'}`}>
                        {NIVEIS[nivel].rotulo}
                      </Texto>
                      <Texto className={`text-label-sm opacity-80 ${marcado ? 'text-on-primary' : 'text-on-surface'}`}>
                        {formatNota(NIVEIS[nivel].pontos)}
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

      {/* NOTA E AÇÕES: fixa embaixo, para a nota acompanhar os toques enquanto a ficha rola. */}
      <View
        className="bg-surface-container-lowest border-t border-outline-variant px-margin-mobile pt-4 gap-4 shadow-lg shadow-black/20"
        style={{ paddingBottom: bottom + 12 }}
      >
        <View className="flex-row items-center gap-4">
          <View>
            <Texto peso="medium" className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              {jaFinalizada ? 'Nota deste grupo' : 'Nota parcial'}
            </Texto>
            <View className="flex-row items-baseline gap-1 mt-1">
              <Texto accessibilityLabel={`Nota ${formatNota(nota)} de 5,00`} peso="bold" className="text-[36px] leading-[40px] text-primary">
                {formatNota(nota)}
              </Texto>
              <Texto className="text-body-sm text-outline">/ 5,00</Texto>
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
              As notas desta feira já foram liberadas para os alunos. A avaliação não pode mais ser alterada.
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
