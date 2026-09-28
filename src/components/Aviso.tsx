import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAvaliacao } from '@/context/AvaliacaoContext';
import { usePaleta } from '@/theme/usePaleta';

import { Texto } from './Texto';

/** O toast do site: aparece no topo, some sozinho e some ao tocar. */
export function Aviso() {
  const { aviso, limparAviso } = useAvaliacao();
  const { top } = useSafeAreaInsets();
  const paleta = usePaleta();

  useEffect(() => {
    if (!aviso) {
      return;
    }

    const temporizador = setTimeout(limparAviso, 5000);
    return () => clearTimeout(temporizador);
  }, [aviso, limparAviso]);

  if (!aviso) {
    return null;
  }

  const erro = aviso.tipo === 'erro';

  return (
    <View className="absolute left-0 right-0 px-margin-mobile" pointerEvents="box-none" style={{ top: top + 8 }}>
      <Pressable
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        className={`flex-row items-start gap-3 rounded-2xl p-4 shadow-lg shadow-black/20 ${erro ? 'bg-error-container' : 'bg-inverse-surface'}`}
        onPress={limparAviso}
      >
        <MaterialIcons
          color={erro ? paleta['on-error-container'] : paleta['tertiary-fixed']}
          name={erro ? 'error-outline' : 'check-circle-outline'}
          size={20}
        />
        <Texto className={`flex-1 text-body-sm ${erro ? 'text-on-error-container' : 'text-inverse-on-surface'}`}>
          {aviso.mensagem}
        </Texto>
      </Pressable>
    </View>
  );
}
