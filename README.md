# Inova Lab — app

App mobile do Inova Lab (o site fica em `C:\xampp\htdocs\inova_lab`), feito com Expo (SDK 57), Expo Router e NativeWind (Tailwind).

## Rodar

```bash
npm install
npx expo start
```

Abra no Expo Go (QR code), no emulador Android (`a`) ou no navegador (`w`).

## O que tem

- **Avaliação** (`src/app/avaliacao`): a fila de grupos do avaliador e a ficha com os cinco critérios, a nota ao vivo, o parecer, o rascunho e o "finalizar e ir ao próximo". As regras são as mesmas de `OrientadorController::avaliacaoSalvar` e de `Models/Avaliacao.php` no site.

## Dados

O site ainda não tem API JSON: as rotas devolvem HTML e usam a sessão PHP. Por isso o app responde com dados de exemplo (`src/api/mock.ts`). Toda chamada passa por `src/api/avaliacoes.ts`, que é o único arquivo a mudar quando a API existir.

## Tema

As cores, a fonte (Poppins) e os tamanhos de texto são os tokens de `public/css/input.css` do site, com modo claro e escuro seguindo o sistema (`src/theme/cores.ts` e `tailwind.config.js`).
