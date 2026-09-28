import { View } from 'react-native';

import { formatNota, type ItemFila } from '@/lib/avaliacao';

import { Texto } from './Texto';

// As mesmas três situações da fila do site, com as mesmas cores.
const selos = {
  pendente: { rotulo: 'Pendente', fundo: 'bg-surface-container-high', texto: 'text-on-surface-variant' },
  em_avaliacao: { rotulo: 'Em avaliação', fundo: 'bg-secondary/10', texto: 'text-secondary' },
  avaliado: { rotulo: 'Avaliado', fundo: 'bg-tertiary-fixed', texto: 'text-on-tertiary-fixed-variant' },
};

export function Selo({ item, pequeno = false }: { item: ItemFila; pequeno?: boolean }) {
  const selo = selos[item.situacao];
  const rotulo = item.situacao === 'avaliado' ? `${selo.rotulo} · ${formatNota(item.pontos)}` : selo.rotulo;

  return (
    <View className={`shrink-0 px-2.5 py-0.5 rounded-full ${selo.fundo}`}>
      <Texto peso="semibold" className={`${pequeno ? 'text-[11px]' : 'text-label-sm'} ${selo.texto}`}>
        {rotulo}
      </Texto>
    </View>
  );
}
