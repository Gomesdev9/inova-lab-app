// Gera o APK dos tablets no EAS Build (nuvem da Expo), já com os projetos da
// feira dentro.
//
//   npm run apk
//
// 1. baixa os projetos, critérios e avaliadores do site (src/dados/pacote-inicial.json);
// 2. manda o projeto para o EAS e espera o APK (perfil "preview" do eas.json).
//
// O endereço e a chave do servidor vêm das variáveis do EAS, ambiente
// "preview" (eas env:list preview), e não do .env.local, que não sobe. O
// pacote sobe por causa da exceção no .easignore.
//
// No fim, o EAS mostra o link para baixar o APK (e um QR code para abrir no tablet).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { baixarPacote } from './baixar-pacote.mjs';

const raiz = fileURLToPath(new URL('..', import.meta.url));

console.log('▶ Baixando os projetos da feira');
try {
  await baixarPacote();
} catch (erro) {
  console.error(`✖ ${erro.message}`);
  process.exit(1);
}

console.log('\n▶ Gerando o APK no EAS Build (a fila e a compilação levam alguns minutos)');
const resultado = spawnSync('npx', ['--yes', 'eas-cli@latest', 'build', '--platform', 'android', '--profile', 'preview', '--non-interactive'], {
  cwd: raiz,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(resultado.status ?? 1);
