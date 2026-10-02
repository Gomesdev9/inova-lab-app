// Baixa do site os projetos da feira e grava em src/dados/pacote-inicial.json,
// que vai embutido no APK: o tablet já sai instalado com tudo para avaliar,
// sem precisar de internet.
//
//   npm run pacote      (lê o endereço e a chave do .env.local)
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const servidor = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const chave = process.env.EXPO_PUBLIC_CHAVE_APP ?? '';

export async function baixarPacote() {
  if (!servidor || !chave) {
    throw new Error('Preencha EXPO_PUBLIC_API_URL e EXPO_PUBLIC_CHAVE_APP no .env.local.');
  }

  let resposta;
  try {
    // Mesma regra de enderecoDa() em src/api/cliente.ts: endereço terminado em
    // index.php leva a rota em ?_route= (servidor sem URLs limpas).
    const caminho = '/api/tablet/pacote';
    const endereco = /\.php$/i.test(servidor) ? `${servidor}?_route=${encodeURIComponent(caminho)}` : `${servidor}${caminho}`;
    resposta = await fetch(endereco, { headers: { Accept: 'application/json', 'X-Chave-App': chave } });
  } catch {
    throw new Error(`Não foi possível falar com ${servidor}. O Apache e o MySQL estão ligados?`);
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !Array.isArray(dados?.projetos)) {
    throw new Error(dados?.erro ?? `O servidor respondeu com erro (${resposta.status}). Confira o endereço em EXPO_PUBLIC_API_URL.`);
  }

  writeFileSync(new URL('../src/dados/pacote-inicial.json', import.meta.url), JSON.stringify(dados, null, 2) + '\n');

  const feiras = [...new Set(dados.projetos.map((projeto) => projeto.evento_nome ?? 'sem feira'))];
  const avaliadores = Array.isArray(dados.avaliadores) ? dados.avaliadores.length : 0;
  console.log(`Pacote baixado em ${dados.gerado_em}: ${dados.projetos.length} projeto(s) — ${feiras.join(', ') || 'nenhuma feira em andamento'}.`);
  console.log(`${avaliadores} avaliador(es) na lista.`);

  if (dados.projetos.length === 0) {
    console.warn('Atenção: nenhum projeto enviado numa feira em andamento. O APK sairia sem nada para avaliar.');
  }
  if (!Array.isArray(dados.avaliadores)) {
    console.warn('Atenção: o site não mandou a lista de avaliadores (versão antiga do ApiController.php). No tablet, cada um vai ter que digitar o e-mail.');
  }
  const semCriterios = dados.projetos.filter((projeto) => !Array.isArray(projeto.criterios) || projeto.criterios.length === 0);
  if (semCriterios.length > 0) {
    console.warn(`Atenção: ${semCriterios.length} projeto(s) de feira sem critérios de avaliação cadastrados. O admin precisa cadastrar em Critérios antes.`);
  }

  return dados;
}

// Chamado direto (npm run pacote), e não importado pelo gerar-apk.mjs.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  baixarPacote().catch((erro) => {
    console.error(erro.message);
    process.exit(1);
  });
}
