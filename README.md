# Inova Lab — avaliação nos tablets

App Android para os avaliadores da feira do Inova Lab (o site fica em `C:\xampp\htdocs\inova_lab`). Feito com Expo (SDK 57), Expo Router e NativeWind (Tailwind).

**Na feira não há internet.** Por isso:

1. O APK já sai com os projetos da feira dentro. Instalou, está pronto para avaliar.
2. O avaliador digita só o e-mail (sem senha) e avalia tudo no tablet.
3. Quando ele finaliza todos os grupos, o app envia as avaliações. O servidor confere se o e-mail é de um avaliador cadastrado: se for, grava; se não, nada é gravado e o app pede para corrigir o e-mail. Sem internet naquela hora, as avaliações ficam guardadas e vão sozinhas quando a conexão voltar.
4. Com tudo enviado, "Liberar tablet" deixa o tablet pronto para o próximo avaliador.

## Gerar o APK

Uma vez por máquina:

- Android Studio instalado (com o SDK) e `ANDROID_HOME` configurado.
- No site: `APP_CHAVE_TABLETS` preenchida no `.env`.
- Neste projeto: `.env.local` com o endereço do site e a mesma chave:

  ```ini
  EXPO_PUBLIC_API_URL=http://192.168.0.10/inova_lab/public
  EXPO_PUBLIC_CHAVE_APP=a-mesma-de-APP_CHAVE_TABLETS
  ```

  O endereço é o que os tablets vão usar para enviar as avaliações depois da feira: tem que ser alcançável por eles (o site publicado, ou o IP do PC com XAMPP na mesma rede).

Com os projetos já enviados pelos grupos e o site no ar:

```bash
npm install
npm run apk
```

O script baixa os projetos, compila e deixa o APK em `dist-apk/`. Para instalar num tablet ligado no USB (com depuração USB ativada):

```bash
adb install -r dist-apk/inova-lab-avaliacao-AAAA-MM-DD.apk
```

Ou copie o arquivo para o tablet e abra (é preciso permitir "instalar apps de fontes desconhecidas").

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
| `src/app` | Telas: e-mail (`identificacao.tsx`), lista (`avaliacao/index.tsx`) e ficha (`avaliacao/[projeto].tsx`) |
| `src/api/cliente.ts` | As duas chamadas à API do site (`/api/tablet/pacote` e `/api/tablet/avaliacoes`) |
| `src/offline` | Banco do tablet (`banco.ts`, `armazem.ts`), regras de salvar (`registrar.ts`) e envio (`envio.ts`) |
| `src/lib/avaliacao.ts` | Critérios, níveis e cálculo da nota, iguais aos de `Models/Avaliacao.php` |
| `src/context` | Estado do app e quando enviar |
| `scripts` | `baixar-pacote.mjs`, `gerar-apk.mjs` e o `pacote-vazio.mjs` do postinstall |

As regras de salvar a ficha em `src/offline/registrar.ts` repetem as de `Services/RegistroAvaliacao.php` no site: mudou uma, mude a outra.

## Tema

As cores, a fonte (Poppins) e os tamanhos de texto são os tokens de `public/css/input.css` do site, com modo claro e escuro seguindo o sistema (`src/theme/cores.ts` e `tailwind.config.js`).
