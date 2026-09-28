import { useColorScheme } from 'react-native';

import { paletas, type Paleta } from './cores';

/** A paleta em uso agora, em hex — para ícones e o que mais não usa className. */
export function usePaleta(): Paleta {
  return paletas[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
