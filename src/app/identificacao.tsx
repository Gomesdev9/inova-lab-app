import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cartao } from '@/components/Cartao';
import { Texto } from '@/components/Texto';
import { useAvaliacao } from '@/context/AvaliacaoContext';
import { usePaleta } from '@/theme/usePaleta';

// Só a forma: se o e-mail existe mesmo, quem diz é o servidor, na hora do envio.
const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A única identificação do app: o e-mail do avaliador. Sem senha, porque na
 * feira não há internet para conferir nada. O e-mail serve para tirar da fila
 * os grupos que ele orienta e, no envio, para o servidor saber em nome de
 * quem gravar — se não estiver cadastrado, nada é gravado e o app pede para
 * corrigir.
 */
export default function Identificacao() {
  const { email: atual, falhaDeEmail, falha, definirEmail, pacoteGeradoEm } = useAvaliacao();
  const paleta = usePaleta();
  const { top, bottom } = useSafeAreaInsets();
  const [email, setEmail] = useState(atual ?? '');
  const [salvando, setSalvando] = useState(false);

  const valido = PARECE_EMAIL.test(email.trim());
  const corrigindo = atual !== null;

  const continuar = async () => {
    if (!valido || salvando) {
      return;
    }

    setSalvando(true);
    await definirEmail(email);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/avaliacao');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingTop: top + 32, paddingBottom: bottom + 24, paddingHorizontal: 16, flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-xl self-center gap-stack-md">
          <View>
            <Texto peso="bold" className="text-display-lg text-on-surface">
              {corrigindo ? 'Corrigir e-mail' : 'Avaliação da feira'}
            </Texto>
            <Texto className="text-body-md text-on-surface-variant mt-1">
              {corrigindo
                ? 'As avaliações já feitas continuam salvas no tablet e vão no nome do e-mail corrigido.'
                : 'Digite o seu e-mail para começar. Ele é o mesmo do cadastro no Inova Lab.'}
            </Texto>
          </View>

          {falhaDeEmail && falha && (
            <View className="rounded-2xl bg-error-container p-4">
              <Texto className="text-body-sm text-on-error-container">{falha}</Texto>
            </View>
          )}

          <Cartao className="gap-4">
            <View>
              <Texto peso="semibold" className="text-label-sm text-on-surface-variant">
                E-mail do avaliador
              </Texto>
              <TextInput
                accessibilityLabel="E-mail do avaliador"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                autoFocus
                className="font-poppins w-full mt-1 px-3 py-3 rounded-xl border border-outline-variant bg-surface text-body-md text-on-surface"
                inputMode="email"
                onChangeText={setEmail}
                onSubmitEditing={continuar}
                placeholder="nome@escola.edu.br"
                placeholderTextColor={paleta.outline}
                returnKeyType="go"
                textContentType="emailAddress"
                value={email}
              />
              <Texto className="text-label-sm text-outline mt-1">
                O e-mail é conferido quando as avaliações forem enviadas. Não precisa de internet agora.
              </Texto>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valido || salvando }}
              className={`items-center bg-primary px-5 py-3 rounded-xl active:opacity-80 ${valido && !salvando ? '' : 'opacity-50'}`}
              disabled={!valido || salvando}
              onPress={continuar}
            >
              <Texto peso="medium" className="text-label-md text-on-primary">
                {corrigindo ? 'Salvar e-mail' : 'Começar a avaliar'}
              </Texto>
            </Pressable>
          </Cartao>

          {!pacoteGeradoEm && (
            <Texto className="text-body-sm text-error text-center">
              Este tablet está sem os projetos da feira. Conecte à internet ou instale o APK gerado com os projetos.
            </Texto>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
