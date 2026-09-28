/**
 * Mesmos tokens do site (public/css/input.css do inova_lab). As cores vêm de
 * variáveis CSS que o layout raiz troca entre claro e escuro (src/theme), por
 * isso aqui só se diz o nome de cada uma.
 */
const tokens = [
  'primary',
  'on-primary',
  'primary-container',
  'secondary',
  'on-secondary',
  'tertiary',
  'tertiary-fixed',
  'on-tertiary-fixed-variant',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'surface',
  'on-surface',
  'on-surface-variant',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'inverse-surface',
  'inverse-on-surface',
  'outline',
  'outline-variant',
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(tokens.map((nome) => [nome, `rgb(var(--color-${nome}) / <alpha-value>)`])),
      fontFamily: {
        poppins: ['Poppins_400Regular'],
        'poppins-medium': ['Poppins_500Medium'],
        'poppins-semibold': ['Poppins_600SemiBold'],
        'poppins-bold': ['Poppins_700Bold'],
      },
      fontSize: {
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.64px' }],
        'headline-md': ['24px', { lineHeight: '32px' }],
        'headline-sm': ['20px', { lineHeight: '28px' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'label-md': ['14px', { lineHeight: '20px', letterSpacing: '0.7px' }],
        'label-sm': ['12px', { lineHeight: '16px' }],
      },
      spacing: {
        'stack-sm': '12px',
        'stack-md': '24px',
        'stack-lg': '48px',
        gutter: '24px',
        'margin-mobile': '16px',
      },
    },
  },
  plugins: [],
};
