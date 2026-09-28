import { View } from 'react-native';

/** Fração de 0 a 1. */
export function BarraProgresso({ fracao }: { fracao: number }) {
  const largura = `${Math.round(Math.min(Math.max(fracao, 0), 1) * 100)}%` as const;

  return (
    <View className="h-2 rounded-full bg-surface-container overflow-hidden">
      <View className="h-full rounded-full bg-primary" style={{ width: largura }} />
    </View>
  );
}
