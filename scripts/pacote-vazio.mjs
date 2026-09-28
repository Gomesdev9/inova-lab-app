// Roda no postinstall. O app importa src/dados/pacote-inicial.json, que não
// vai para o git (tem nomes de alunos): sem ele o projeto nem compila. Aqui
// ele nasce vazio; "npm run pacote" põe os projetos de verdade.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const arquivo = new URL('../src/dados/pacote-inicial.json', import.meta.url);

if (!existsSync(arquivo)) {
  mkdirSync(new URL('.', arquivo), { recursive: true });
  writeFileSync(arquivo, JSON.stringify({ gerado_em: null, projetos: [] }, null, 2) + '\n');
  console.log('src/dados/pacote-inicial.json criado vazio. Rode "npm run pacote" para baixar os projetos da feira.');
}
