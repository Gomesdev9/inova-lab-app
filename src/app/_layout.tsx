import '../global.css';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Aviso } from '@/components/Aviso';
import { AvaliacaoProvider } from '@/context/AvaliacaoContext';
import { paletas, temas } from '@/theme/cores';

export default function Layout() {
  const tema = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [fontesProntas] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });

  if (!fontesProntas) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {/* As variáveis de cor do tema valem para tudo o que está aqui dentro. */}
      <View className="flex-1 bg-surface" style={temas[tema]}>
        <AvaliacaoProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: paletas[tema].surface },
            }}
          />
          <Aviso />
        </AvaliacaoProvider>
        <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      </View>
    </SafeAreaProvider>
  );
}
