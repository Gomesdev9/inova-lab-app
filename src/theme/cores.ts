import { vars } from 'nativewind';

/**
 * As paletas clara e escura do site, com os mesmos valores. O layout raiz
 * aplica uma delas como variáveis CSS, e as classes (bg-surface,
 * text-primary, ...) seguem sozinhas. O hex também fica à mão para o que não
 * aceita className: ícones, placeholder, barra de status.
 */
const claro = {
  primary: '#003fb1',
  'on-primary': '#ffffff',
  'primary-container': '#1a56db',
  secondary: '#7127e5',
  'on-secondary': '#ffffff',
  tertiary: '#005439',
  'tertiary-fixed': '#85f8c4',
  'on-tertiary-fixed-variant': '#005137',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
  surface: '#f8f9ff',
  'on-surface': '#121c28',
  'on-surface-variant': '#434654',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#eef4ff',
  'surface-container': '#e5eeff',
  'surface-container-high': '#dfe9fa',
  'surface-container-highest': '#d9e3f4',
  'inverse-surface': '#27313e',
  'inverse-on-surface': '#eaf1ff',
  outline: '#737686',
  'outline-variant': '#c3c5d7',
};

export type Paleta = typeof claro;

const escuro: Paleta = {
  primary: '#b5c4ff',
  'on-primary': '#002b75',
  'primary-container': '#0047c4',
  secondary: '#d2bbff',
  'on-secondary': '#3f008c',
  tertiary: '#68dba9',
  'tertiary-fixed': '#85f8c4',
  'on-tertiary-fixed-variant': '#005137',
  error: '#ffb4ab',
  'on-error': '#690005',
  'error-container': '#93000a',
  'on-error-container': '#ffdad6',
  surface: '#111318',
  'on-surface': '#e2e2e9',
  'on-surface-variant': '#c4c6d0',
  'surface-container-lowest': '#0c0e13',
  'surface-container-low': '#191c20',
  'surface-container': '#1d2024',
  'surface-container-high': '#272a2f',
  'surface-container-highest': '#32353a',
  'inverse-surface': '#e2e2e9',
  'inverse-on-surface': '#2e3036',
  outline: '#8e9099',
  'outline-variant': '#44474e',
};

export const paletas = { light: claro, dark: escuro };

/** '#003fb1' → '0 63 177', o formato que o rgb(var() / alpha) espera. */
function canais(hex: string): string {
  const numero = parseInt(hex.slice(1), 16);
  return `${(numero >> 16) & 255} ${(numero >> 8) & 255} ${numero & 255}`;
}

function comoVariaveis(paleta: Paleta) {
  return vars(
    Object.fromEntries(Object.entries(paleta).map(([nome, hex]) => [`--color-${nome}`, canais(hex)]))
  );
}

export const temas = {
  light: comoVariaveis(claro),
  dark: comoVariaveis(escuro),
};
