# Inova Lab — avaliação nos tablets

App Android para os avaliadores da feira do Inova Lab (o site fica em `C:\xampp\htdocs\inova_lab`). Feito com Expo (SDK 57), Expo Router e NativeWind (Tailwind).

**Na feira não há internet.** Por isso:

1. O APK já sai com tudo da feira dentro: os projetos, os critérios de avaliação que o admin cadastrou para a feira (título, descrição e peso) e a lista de avaliadores (os professores ativos). Instalou, está pronto para avaliar.
2. O avaliador toca no próprio nome na lista (sem senha) e avalia tudo no tablet. Os grupos que ele orienta saem da fila dele. Quem não estiver na lista pode digitar o e-mail.
3. Cada critério recebe A, PA ou NA; a menção final é a média ponderada pelo peso de cada critério, a mesma conta do site.
4. Vários avaliadores podem usar o mesmo tablet, um depois do outro. "Trocar avaliador" não apaga nada: as avaliações ficam guardadas no nome de cada um, e quem voltar e escolher o nome de novo continua de onde parou.
5. As avaliações finalizadas de cada avaliador vão para o servidor, no nome dele, quando ele finaliza todos os grupos, passa o tablet adiante ou aperta "Enviar". O servidor confere se é um professor ativo: se não for, as dele ficam no tablet e as dos outros seguem. Sem internet naquela hora, tudo fica guardado e vai sozinho quando a conexão voltar.

A lista de avaliadores vem do `ApiController.php` do site a partir da versão que a inclui no pacote; com um site mais antigo, o app pede o e-mail.

## Gerar o APK

O APK é montado no **EAS Build**, o serviço da Expo na nuvem. No Windows, montar no próprio PC esbarra no limite de 260 caracteres de caminho (a biblioteca `react-native-gesture-handler` gera arquivos com caminhos longos demais).

Uma vez só (já feito para a conta `joaogomes9`):

- No site: `APP_CHAVE_TABLETS` preenchida no `.env`.
- Neste projeto: `.env.local` com o endereço do site e a mesma chave (usado por `npm run pacote` e pelo Expo Go):

  ```ini
  EXPO_PUBLIC_API_URL=http://192.168.0.10/inova_lab
  EXPO_PUBLIC_CHAVE_APP=a-mesma-de-APP_CHAVE_TABLETS
  ```

  O endereço é o que os tablets vão usar para enviar as avaliações depois da feira: tem que ser alcançável por eles (o site publicado, ou o IP do PC com XAMPP na mesma rede).

  Servidor que não usa URLs limpas (o Apache ignora o `.htaccess`, e os links do site são `index.php?_route=...`): termine o endereço em `index.php`, e o app manda as rotas em `?_route=`. É o caso do servidor da escola:

  ```ini
  EXPO_PUBLIC_API_URL=https://caioba.pr.senac.br/Inova-lab/public/index.php
  ```

- No EAS: o mesmo endereço e a mesma chave como variáveis do ambiente `preview`, porque o `.env.local` não sobe para a nuvem:

  ```bash
  npx eas-cli@latest env:set preview --name EXPO_PUBLIC_API_URL --value "https://caioba.pr.senac.br/Inova-lab/public/index.php" --visibility plaintext
  npx eas-cli@latest env:set preview --name EXPO_PUBLIC_CHAVE_APP --value "a-mesma-de-APP_CHAVE_TABLETS" --visibility sensitive
  ```

  Trocou a chave ou o endereço? Atualize nos dois lugares (`.env.local` e EAS). Para conferir: `npx eas-cli@latest env:list preview`.

Com os projetos já enviados pelos grupos e o site no ar:

```bash
npm install
npm run apk
```

O script baixa os projetos, critérios e avaliadores do site para `src/dados/pacote-inicial.json` e manda o projeto para o EAS (perfil `preview` do `eas.json`, que gera `.apk`). Em 10 a 20 minutos aparece o link (e um QR code) para baixar o APK; ele também fica em expo.dev, no projeto, em **Builds**.

O pacote não vai para o git (tem nomes de alunos), mas sobe para o EAS por causa da exceção no `.easignore`; o `.env.local` não sobe.

Para instalar num tablet ligado no USB (com depuração USB ativada):

```bash
adb install -r inova-lab-avaliacao.apk
```

Ou copie o arquivo para o tablet e abra (é preciso permitir "instalar apps de fontes desconhecidas").

Numa máquina sem o limite de caminho (Linux, macOS), dá para montar no próprio computador com `npm run apk:local`, que deixa o APK em `dist-apk/` (precisa do Android Studio com o SDK).

Se um grupo enviar o projeto depois de o APK ser gerado, não precisa gerar de novo: com internet, o tablet atualiza os projetos sozinho ao abrir (ou puxando a lista para baixo).

## Desenvolver

```bash
npx expo start      # abre no Expo Go: aperte "a" com o emulador ligado
npm run pacote      # baixa os projetos do site para src/dados/pacote-inicial.json
```

`src/dados/pacote-inicial.json` não vai para o git (tem nomes de alunos). O `npm install` cria um vazio.

## Código

| Pasta | O quê |
| ----- | ----- |
| `src/app` | Telas: escolha do avaliador (`identificacao.tsx`), lista de grupos (`avaliacao/index.tsx`) e ficha (`avaliacao/[projeto].tsx`) |
| `src/api/cliente.ts` | As duas chamadas à API do site (`/api/tablet/pacote` e `/api/tablet/avaliacoes`) |
| `src/offline` | Banco do tablet (`banco.ts`, `armazem.ts`), regras de salvar (`registrar.ts`) e envio (`envio.ts`) |
| `src/lib/avaliacao.ts` | Menções (A / PA / NA) e o cálculo da menção final ponderada pelos pesos, iguais aos de `Models/Avaliacao.php` (os critérios vêm do pacote) |
| `src/context` | Estado do app e quando enviar |
| `scripts` | `baixar-pacote.mjs`, `gerar-apk-eas.mjs` (`npm run apk`), `gerar-apk.mjs` (`npm run apk:local`) e o `pacote-vazio.mjs` do postinstall |

As regras de salvar a ficha em `src/offline/registrar.ts` repetem as de `Services/RegistroAvaliacao.php` no site: mudou uma, mude a outra.

## Tema

As cores, a fonte (Poppins) e os tamanhos de texto são os tokens de `public/css/input.css` do site, com modo claro e escuro seguindo o sistema (`src/theme/cores.ts` e `tailwind.config.js`).
