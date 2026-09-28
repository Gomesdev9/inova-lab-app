import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraProgresso } from '@/components/BarraProgresso';
import { Cartao } from '@/components/Cartao';
import { Selo } from '@/components/Selo';
import { Texto } from '@/components/Texto';
import { useAvaliacao } from '@/context/AvaliacaoContext';
import { proximoPendente, type ItemFila } from '@/lib/avaliacao';
import { usePaleta } from '@/theme/usePaleta';

type Filtro = 'todos' | 'pendentes' | 'avaliados';

const filtros: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'avaliados', rotulo: 'Avaliados' },
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';

  return (primeira + ultima).toUpperCase();
}

/**
 * A fila de avaliação: os projetos enviados por grupos que o avaliador não
 * orienta. No celular do site a lista e a ficha já eram duas telas; aqui
 * também — tocar em um grupo abre a ficha dele.
 */
export default function FilaDeAvaliacao() {
  const { avaliador, fila, carregando, erro, recarregar } = useAvaliacao();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [atualizando, setAtualizando] = useState(false);
  const { top, bottom } = useSafeAreaInsets();
  const paleta = usePaleta();

  const totalAvaliados = fila.filter((item) => item.situacao === 'avaliado').length;
  const proximo = proximoPendente(fila, -1);

  // "Pendentes" inclui quem está em rascunho: é tudo o que falta finalizar.
  const visiveis = useMemo(
    () =>
      fila.filter((item) => {
        if (filtro === 'todos') {
          return true;
        }
        return filtro === 'avaliados' ? item.situacao === 'avaliado' : item.situacao !== 'avaliado';
      }),
    [fila, filtro]
  );

  const puxarParaAtualizar = async () => {
    setAtualizando(true);
    await recarregar();
    setAtualizando(false);
  };

  if (carregando) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={paleta.primary} size="large" />
      </View>
    );
  }

  const cabecalho = (
    <View className="gap-stack-md mb-stack-sm">
      <View>
        <Texto peso="bold" className="text-display-lg text-on-surface">
          Avaliar grupos
        </Texto>
        <Texto className="text-body-md text-on-surface-variant mt-1">
          Projetos já enviados por grupos que você não orienta. Marque os cinco critérios e finalize para registrar a nota.
        </Texto>
      </View>

      {erro && (
        <View className="rounded-2xl bg-error-container p-4">
          <Texto className="text-body-sm text-on-error-container">{erro}</Texto>
        </View>
      )}

      {/* AVALIADOR */}
      {avaliador && (
        <Cartao className="gap-3">
          <Texto peso="medium" className="text-label-sm text-on-surface-variant uppercase tracking-wider">
            Avaliador
          </Texto>
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
              <Texto peso="bold" className="text-body-md text-primary">
                {iniciais(avaliador.nome)}
              </Texto>
            </View>
            <View className="flex-1 min-w-0">
              <Texto peso="medium" className="text-label-md text-on-surface" numberOfLines={1}>
                {avaliador.nome}
              </Texto>
              <Texto className="text-label-sm text-outline" numberOfLines={1}>
                {avaliador.email}
              </Texto>
            </View>
          </View>
          <Texto className="text-body-sm text-on-surface-variant pt-3 border-t border-outline-variant">
            {fila.length} {fila.length === 1 ? 'grupo na fila' : 'grupos na fila'} · {totalAvaliados}{' '}
            {totalAvaliados === 1 ? 'avaliado' : 'avaliados'}
          </Texto>
        </Cartao>
      )}

      {fila.length > 0 && (
        <Cartao className="gap-4">
          <View>
            <View className="flex-row items-center justify-between gap-2">
              <Texto peso="semibold" className="text-headline-sm text-on-surface">
                Meus grupos
              </Texto>
              <Texto peso="medium" className="text-label-sm text-outline">
                {totalAvaliados} de {fila.length} avaliados
              </Texto>
            </View>
            <View className="mt-3">
              <BarraProgresso fracao={totalAvaliados / fila.length} />
            </View>
          </View>

          <View accessibilityLabel="Filtrar grupos" className="flex-row gap-2">
            {filtros.map(({ valor, rotulo }) => {
              const ativo = filtro === valor;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  className={`flex-1 items-center px-2 py-2 rounded-xl border ${ativo ? 'bg-primary border-primary' : 'border-outline-variant'}`}
                  key={valor}
                  onPress={() => setFiltro(valor)}
                >
                  <Texto peso="medium" className={`text-label-sm ${ativo ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                    {rotulo}
                  </Texto>
                </Pressable>
              );
            })}
          </View>

          {proximo !== null && (
            <Link asChild href={`/avaliacao/${fila[proximo].projeto.uuid}`}>
              <Pressable className="flex-row items-center justify-center gap-2 bg-primary px-5 py-3 rounded-xl active:opacity-80">
                <Texto peso="medium" className="text-label-md text-on-primary">
                  Continuar avaliando
                </Texto>
                <MaterialIcons color={paleta['on-primary']} name="arrow-forward" size={18} />
              </Pressable>
            </Link>
          )}
        </Cartao>
      )}
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-surface"
      contentContainerStyle={{ paddingTop: top + 16, paddingBottom: bottom + 24, paddingHorizontal: 16, gap: 8 }}
      data={fila.length > 0 ? visiveis : []}
      keyExtractor={(item) => item.projeto.uuid}
      ListEmptyComponent={
        fila.length === 0 ? (
          <Cartao className="items-center">
            <MaterialIcons color={paleta['on-surface-variant']} name="task-alt" size={40} />
            <Texto peso="bold" className="text-body-md text-on-surface mt-2 text-center">
              Nenhum projeto para avaliar no momento
            </Texto>
            <Texto className="text-body-sm text-on-surface-variant mt-1 text-center">
              Quando um grupo que você não orienta enviar o projeto, ele entra na sua fila aqui.
            </Texto>
          </Cartao>
        ) : (
          <Texto className="text-body-sm text-on-surface-variant text-center py-4">Nenhum grupo neste filtro.</Texto>
        )
      }
      ListFooterComponent={
        fila.length > 0 ? (
          <Texto className="text-label-sm text-outline mt-3 text-center">Os grupos que você orienta não entram na sua fila.</Texto>
        ) : null
      }
      ListHeaderComponent={cabecalho}
      refreshControl={<RefreshControl colors={[paleta.primary]} onRefresh={puxarParaAtualizar} refreshing={atualizando} tintColor={paleta.primary} />}
      renderItem={({ item }) => <GrupoDaFila item={item} />}
    />
  );
}

function GrupoDaFila({ item }: { item: ItemFila }) {
  const detalhes = [item.projeto.categoria, item.projeto.evento_nome].filter(Boolean).join(' · ');

  return (
    <Link asChild href={`/avaliacao/${item.projeto.uuid}`}>
      <Pressable
        accessibilityHint="Abre a ficha de avaliação deste grupo"
        className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 active:border-primary active:bg-primary/5"
      >
        <View className="flex-row items-center justify-between gap-2">
          <Texto peso="semibold" className="flex-1 text-label-sm text-outline" numberOfLines={1}>
            {item.projeto.grupo_nome}
          </Texto>
          <Selo item={item} pequeno />
        </View>
        <Texto peso="semibold" className="text-body-sm text-on-surface mt-1" numberOfLines={2}>
          {item.projeto.titulo}
        </Texto>
        {detalhes !== '' && (
          <Texto className="text-label-sm text-outline mt-0.5" numberOfLines={1}>
            {detalhes}
          </Texto>
        )}
      </Pressable>
    </Link>
  );
}
