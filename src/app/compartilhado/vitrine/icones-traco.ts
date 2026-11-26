/**
 * Ícones de traço (24×24, stroke) das telas públicas: página inicial e moldura de acesso.
 * Desenhados para uso com `fill="none"` e `stroke="currentColor"`.
 */
export const ICONES_TRACO = {
  caminhao: 'M3 16V7a1 1 0 0 1 1-1h10v10M14 9h4l3 4v3h-7M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  motorista: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0',
  rota: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  combustivel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3M7 7h4v4H7z',
  recibo: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6M9 16h3',
  manutencao: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5Z',
  grafico: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  confirmar: 'm5 12 5 5 9-10',
  seta: 'M5 12h14M13 6l6 6-6 6'
} as const;

export type NomeIconeTraco = keyof typeof ICONES_TRACO;
