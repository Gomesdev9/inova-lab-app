// Gera o APK para instalar nos tablets, já com os projetos da feira dentro.
//
//   npm run apk
//
// 1. baixa os projetos do site (src/dados/pacote-inicial.json);
// 2. gera a pasta android/ a partir do app.json (expo prebuild);
// 3. compila o APK de release com o Gradle;
// 4. copia para dist-apk/.
//
// Precisa do Android SDK (Android Studio) e de um JDK que o Gradle aceite.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baixarPacote } from './baixar-pacote.mjs';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';

function rodar(titulo, comando, argumentos, pasta = raiz) {
  console.log(`\n▶ ${titulo}`);
  const resultado = spawnSync(comando, argumentos, { cwd: pasta, stdio: 'inherit', shell: windows, env: { ...process.env, CI: '1' } });
  if (resultado.status !== 0) {
    console.error(`\n✖ Falhou: ${titulo}`);
    process.exit(resultado.status ?? 1);
  }
}

console.log('▶ Baixando os projetos da feira');
try {
  await baixarPacote();
} catch (erro) {
  console.error(`✖ ${erro.message}`);
  process.exit(1);
}

rodar('Gerando o projeto Android', 'npx', ['expo', 'prebuild', '--platform', 'android', '--clean']);
rodar('Compilando o APK (demora alguns minutos na primeira vez)', windows ? 'gradlew.bat' : './gradlew', ['assembleRelease'], join(raiz, 'android'));

const gerado = join(raiz, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(gerado)) {
  console.error(`✖ O Gradle terminou, mas o APK não está em ${gerado}.`);
  process.exit(1);
}

const hoje = new Date().toISOString().slice(0, 10);
mkdirSync(join(raiz, 'dist-apk'), { recursive: true });
const destino = join(raiz, 'dist-apk', `inova-lab-avaliacao-${hoje}.apk`);
copyFileSync(gerado, destino);

console.log(`\n✔ APK pronto: ${destino}`);
console.log('  Para instalar num tablet ligado no USB (com depuração USB ativada):');
console.log(`  adb install -r "${destino}"`);
