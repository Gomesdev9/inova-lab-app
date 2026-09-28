import type { Avaliacao, Projeto } from '@/lib/avaliacao';

import type { Avaliador, DetalheProjeto } from './avaliacoes';

/** Dados de exemplo enquanto o site não tem API. Nomes fictícios. */

export const avaliadorMock: Avaliador = {
  nome: 'Marina Albuquerque',
  email: 'marina.albuquerque@escola.edu.br',
};

const feira = 'Feira de Ciências 2026';

export const projetosMock: Projeto[] = [
  {
    uuid: 'a1f3c2d0-0001-4c7a-9b1e-000000000001',
    titulo: 'HortaSense: irrigação automática com sensores de umidade',
    categoria: 'Tecnologia',
    escola: 'E.E. Professor Lima',
    descricao:
      'Um sistema com Arduino que mede a umidade do solo e liga a irrigação só quando precisa.\n\nOs dados vão para um painel web onde a turma acompanha o consumo de água da horta da escola.',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    grupo_nome: 'Grupo Raiz',
    orientador_nome: 'Carlos Menezes',
    evento_nome: feira,
    notas_liberadas_at: null,
  },
  {
    uuid: 'a1f3c2d0-0002-4c7a-9b1e-000000000002',
    titulo: 'Libras Já: app para aprender sinais do dia a dia',
    categoria: 'Educação',
    escola: 'E.E. Professor Lima',
    descricao: 'Aplicativo com vídeos curtos e quiz para ensinar os sinais mais usados na escola.',
    video_url: null,
    grupo_nome: 'Mãos que Falam',
    orientador_nome: 'Patrícia Nogueira',
    evento_nome: feira,
    notas_liberadas_at: null,
  },
  {
    uuid: 'a1f3c2d0-0003-4c7a-9b1e-000000000003',
    titulo: 'Filtro de água com carvão de casca de coco',
    categoria: 'Meio ambiente',
    escola: 'Colégio Horizonte',
    descricao: null,
    video_url: 'https://vimeo.com/76979871',
    grupo_nome: 'Equipe Aqua',
    orientador_nome: null,
    evento_nome: feira,
    notas_liberadas_at: null,
  },
  {
    uuid: 'a1f3c2d0-0004-4c7a-9b1e-000000000004',
    titulo: 'Rota Segura: mapa colaborativo de calçadas acessíveis',
    categoria: 'Tecnologia',
    escola: 'Colégio Horizonte',
    descricao: 'Moradores marcam no mapa buracos, rampas e obstáculos, e o app sugere o caminho mais acessível.',
    video_url: null,
    grupo_nome: 'Caminhantes',
    orientador_nome: 'Carlos Menezes',
    evento_nome: feira,
    notas_liberadas_at: null,
  },
  {
    uuid: 'a1f3c2d0-0005-4c7a-9b1e-000000000005',
    titulo: 'Bioplástico de amido de mandioca',
    categoria: 'Química',
    escola: 'E.E. Professor Lima',
    descricao: 'Comparação de resistência e tempo de decomposição entre o bioplástico e sacolas comuns.',
    video_url: null,
    grupo_nome: 'Grupo Verde',
    orientador_nome: 'Patrícia Nogueira',
    evento_nome: 'Mostra de Inverno 2026',
    // Feira com notas já liberadas: aparece para mostrar a ficha travada.
    notas_liberadas_at: '2026-07-15 18:00:00',
  },
];

/** Fichas que já existem ao abrir: um rascunho pela metade e uma finalizada na feira travada. */
export const fichasMock: Record<string, Avaliacao> = {
  'a1f3c2d0-0002-4c7a-9b1e-000000000002': {
    funcionalidade: 'bom',
    usabilidade: 'otimo',
    originalidade: null,
    conclusao: null,
    apresentacao: null,
    comentarios: null,
    status: 'rascunho',
  },
  'a1f3c2d0-0005-4c7a-9b1e-000000000005': {
    funcionalidade: 'otimo',
    usabilidade: 'bom',
    originalidade: 'otimo',
    conclusao: 'bom',
    apresentacao: 'otimo',
    comentarios: 'Ótima pesquisa e boa comparação com as sacolas comuns. Vale registrar melhor as medições de resistência.',
    status: 'finalizada',
  },
};

export const detalhesMock: Record<string, DetalheProjeto> = {
  'a1f3c2d0-0001-4c7a-9b1e-000000000001': {
    membros: ['Ana Beatriz', 'João Pedro', 'Luiza Martins', 'Rafael Costa'],
    resumoUrl: 'https://example.com/resumo.pdf',
    bannerUrl: 'https://example.com/banner.png',
  },
  'a1f3c2d0-0002-4c7a-9b1e-000000000002': {
    membros: ['Beatriz Rocha', 'Gabriel Lopes', 'Sofia Andrade'],
    resumoUrl: 'https://example.com/resumo.pdf',
    bannerUrl: null,
  },
  'a1f3c2d0-0003-4c7a-9b1e-000000000003': {
    membros: ['Heitor Dias', 'Isabela Freitas'],
    resumoUrl: null,
    bannerUrl: null,
  },
  'a1f3c2d0-0004-4c7a-9b1e-000000000004': {
    membros: [],
    resumoUrl: null,
    bannerUrl: 'https://example.com/banner.png',
  },
  'a1f3c2d0-0005-4c7a-9b1e-000000000005': {
    membros: ['Lucas Prado', 'Manuela Reis', 'Theo Almeida'],
    resumoUrl: 'https://example.com/resumo.pdf',
    bannerUrl: 'https://example.com/banner.png',
  },
};
