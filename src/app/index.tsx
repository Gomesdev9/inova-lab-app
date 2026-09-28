import { Redirect } from 'expo-router';

// Por enquanto o app só tem a área do avaliador.
export default function Inicio() {
  return <Redirect href="/avaliacao" />;
}
