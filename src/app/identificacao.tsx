import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Avaliador } from '@/api/cliente';
import { Cartao } from '@/components/Cartao';
import { Texto } from '@/components/Texto';
import { useAvaliacao } from '@/context/AvaliacaoContext';
import type { AvaliadorNoTablet } from '@/offline/armazem';
import { usePaleta } from '@/theme/usePaleta';

// Só a forma: se o e-mail existe mesmo, quem diz é o servidor, na hora do envio.
const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "José Antônio" casa com "jose", "antonio" e "José". */
const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/**
 * A entrada do app: a lista dos avaliadores (os professores ativos, que vêm
 * no pacote), para cada um tocar no próprio nome. Sem senha: na feira não há
 * internet para conferir nada. O nome escolhido decide os grupos que saem da
 * fila (os que ele orienta) e em nome de quem as avaliações são enviadas.
 *
 * Quem não estiver na lista (cadastrado depois de o APK ser gerado) pode
 * digitar o e-mail; o servidor confere no envio.
 */
export default function Identificacao() {
  const { avaliadores, listaCompleta, noTablet, prontasNoTablet, pacoteGeradoEm, escolher } = useAvaliacao();
  const paleta = usePaleta();
  const { top, bottom } = useSafeAreaInsets();
  const [busca, setBusca] = useState('');
  const [digitarEmail, setDigitarEmail] = useState(avaliadores.length === 0);
  const [email, setEmail] = useState('');

  const doTablet = useMemo(() => new Map(noTablet.map((avaliador) => [avaliador.email, avaliador])), [noTablet]);
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return termo ? avaliadores.filter((avaliador) => semAcento(avaliador.nome).includes(termo)) : avaliadores;
  }, [avaliadores, busca]);
  const comPendencia = noTablet.filter((avaliador) => avaliador.prontas > 0).length;

  const entrar = async (avaliador: Avaliador) => {
    await escolher(avaliador);
    router.replace('/avaliacao');
  };

  // Confirma antes: avaliar no nome errado mandaria as avaliações para outra pessoa.
  const confirmar = (avaliador: Avaliador) => {
    const pergunta = `Você é ${avaliador.nome}?`;
    const explicacao = 'As avaliações que você fizer neste tablet vão no seu nome.';

    if (Platform.OS === 'web') {
      if (window.confirm(`${pergunta} ${explicacao}`)) {
        entrar(avaliador);
      }
      return;
    }

    Alert.alert(pergunta, explicacao, [
      { text: 'Não', style: 'cancel' },
      { text: 'Sou eu', onPress: () => entrar(avaliador) },
    ]);
  };

  const emailValido = PARECE_EMAIL.test(email.trim());

  const cabecalho = (
    <View className="gap-stack-md mb-stack-sm">
      <View>
        <Texto peso="bold" className="text-display-lg text-on-surface">
          Quem vai avaliar?
        </Texto>
        <Texto className="text-body-md text-on-surface-variant mt-1">
          {avaliadores.length === 0
            ? 'Digite o seu e-mail para começar a avaliar os projetos da feira.'
            : listaCompleta
              ? 'Toque no seu nome para começar a avaliar os projetos da feira.'
              : 'Toque no seu nome para começar. Se ele não estiver na lista, digite o seu e-mail logo abaixo.'}
        </Texto>
      </View>

      {prontasNoTablet > 0 && (
        <View className="flex-row items-start gap-3 rounded-2xl bg-surface-container-low border border-outline-variant p-4">
          <MaterialIcons color={paleta['on-surface-variant']} name="cloud-upload" size={20} />
          <Texto className="flex-1 text-body-sm text-on-surface-variant">
            Neste tablet: {prontasNoTablet === 1 ? '1 avaliação' : `${prontasNoTablet} avaliações`} de{' '}
            {comPendencia === 1 ? '1 avaliador' : `${comPendencia} avaliadores`} aguardando envio. Elas vão sozinhas para o servidor quando houver internet.
          </Texto>
        </View>
      )}

      {!pacoteGeradoEm && (
        <View className="rounded-2xl bg-error-container p-4">
          <Texto className="text-body-sm text-on-error-container">
            Este tablet está sem os dados da feira. Conecte à internet ou instale o APK gerado com os projetos.
          </Texto>
        </View>
      )}

      {avaliadores.length > 0 && (
        <View className="flex-row items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3">
          <MaterialIcons color={paleta.outline} name="search" size={20} />
          <TextInput
            accessibilityLabel="Buscar pelo nome"
            autoCorrect={false}
            className="font-poppins flex-1 py-3 text-body-md text-on-surface"
            onChangeText={setBusca}
            placeholder="Buscar pelo nome"
            placeholderTextColor={paleta.outline}
            value={busca}
          />
        </View>
      )}
    </View>
  );

  const rodape = (
    <View className="mt-stack-md">
      {!digitarEmail ? (
        <Pressable accessibilityRole="button" className="self-center py-2 px-3" onPress={() => setDigitarEmail(true)}>
          <Texto peso="semibold" className="text-label-md text-primary">
            Não achou seu nome? Digite o e-mail
          </Texto>
        </Pressable>
      ) : (
        <Cartao className="gap-3">
          <Texto peso="semibold" className="text-label-sm text-on-surface-variant">
            E-mail do avaliador
          </Texto>
          <TextInput
            accessibilityLabel="E-mail do avaliador"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            className="font-poppins w-full px-3 py-3 rounded-xl border border-outline-variant bg-surface text-body-md text-on-surface"
            inputMode="email"
            onChangeText={setEmail}
            placeholder="nome@escola.edu.br"
            placeholderTextColor={paleta.outline}
            value={email}
          />
          <Texto className="text-label-sm text-outline">
            O mesmo do cadastro no Inova Lab. Ele é conferido quando as avaliações forem enviadas.
          </Texto>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !emailValido }}
            className={`items-center bg-primary px-5 py-3 rounded-xl active:opacity-80 ${emailValido ? '' : 'opacity-50'}`}
            disabled={!emailValido}
            onPress={() => confirmar({ nome: email.trim().toLowerCase(), email: email.trim() })}
          >
            <Texto peso="medium" className="text-label-md text-on-primary">
              Começar a avaliar
            </Texto>
          </Pressable>
        </Cartao>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface">
      <FlatList
        contentContainerStyle={{ paddingTop: top + 24, paddingBottom: bottom + 24, paddingHorizontal: 16, gap: 8, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        data={visiveis}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(avaliador) => avaliador.email}
        ListEmptyComponent={
          avaliadores.length > 0 ? <Texto className="text-body-sm text-on-surface-variant text-center py-4">Ninguém com esse nome.</Texto> : null
        }
        ListFooterComponent={rodape}
        ListHeaderComponent={cabecalho}
        renderItem={({ item }) => <LinhaAvaliador avaliador={item} noTablet={doTablet.get(item.email)} aoTocar={() => confirmar(item)} />}
      />
    </KeyboardAvoidingView>
  );
}

function LinhaAvaliador({ avaliador, noTablet, aoTocar }: { avaliador: Avaliador; noTablet?: AvaliadorNoTablet; aoTocar: () => void }) {
  const paleta = usePaleta();
  const feitas = noTablet ? noTablet.prontas + noTablet.enviadas + noTablet.rascunhos : 0;

  return (
    <Pressable
      accessibilityHint="Começa a avaliar com este nome"
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 active:border-primary active:bg-primary/5"
      onPress={aoTocar}
    >
      <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
        <Texto peso="bold" className="text-body-md text-primary">
          {iniciais(avaliador.nome)}
        </Texto>
      </View>
      <View className="flex-1 min-w-0">
        <Texto peso="semibold" className="text-body-md text-on-surface" numberOfLines={1}>
          {avaliador.nome}
        </Texto>
        {feitas > 0 && (
          <Texto className={`text-label-sm ${noTablet?.erro ? 'text-error' : 'text-outline'}`} numberOfLines={1}>
            {noTablet?.erro
              ? 'O servidor recusou o e-mail: avaliações paradas no tablet'
              : noTablet && noTablet.prontas > 0
                ? `${noTablet.prontas === 1 ? '1 avaliação' : `${noTablet.prontas} avaliações`} neste tablet aguardando envio`
                : `${feitas === 1 ? '1 avaliação' : `${feitas} avaliações`} neste tablet`}
          </Texto>
        )}
      </View>
      <MaterialIcons color={paleta.outline} name="chevron-right" size={22} />
    </Pressable>
  );
}
