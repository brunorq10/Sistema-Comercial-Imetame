// ─────────────────────────────────────────────────────────────────────────────
// Paleta semântica compartilhada pelas telas de indicadores (Acordos e
// Comercial) + estilo comum de eixo/grade/tooltip dos gráficos Chart.js delas.
//
// Duas cores "verdes" com papéis diferentes — não é inconsistência:
// - DASHBOARD_INSTITUCIONAL (= token Tailwind `green-primary`): cor de chrome
//   da marca (aba ativa, banda de tabela) — não é usada como valor de dado.
// - DASHBOARD_POSITIVO: cor semântica de "positivo/realizado/aprovado" nos
//   cards de KPI, séries de gráfico e badges.
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_INSTITUCIONAL = '#2E7D32' // chrome/marca (aba ativa, banda de tabela)
export const DASHBOARD_POSITIVO      = '#16A34A' // positivo / realizado / aprovado
export const DASHBOARD_PREVISTO      = '#1565C0' // previsto / neutro / em análise
export const DASHBOARD_ATENCAO       = '#D97706' // atenção / saldo a realizar / pendente
export const DASHBOARD_NEGATIVO      = '#DC2626' // negativo / recusa / perda

// ── Estilo comum de gráfico (Chart.js) ──────────────────────────────────────
// Mesmos valores já usados em src/components/faturamento/ContratoFaturamentoChart.tsx

export const dashboardLegendPlugin = {
  position: 'bottom' as const,
  align: 'center' as const,
  labels: {
    boxWidth: 10,
    boxHeight: 10,
    borderRadius: 2,
    useBorderRadius: true,
    font: { size: 11 },
    padding: 16,
    color: '#374151',
  },
}

export const dashboardTooltipPlugin = {
  backgroundColor: '#1F2937',
  titleColor: '#F9FAFB',
  bodyColor: '#D1D5DB',
  borderColor: '#374151',
  borderWidth: 1,
  padding: 10,
}

export const dashboardXScale = {
  grid: { display: false },
  border: { display: false },
  ticks: { font: { size: 11 }, color: '#6B7280' },
}

export const dashboardYScale = {
  grid: { color: '#F3F4F6', lineWidth: 1 },
  border: { display: false },
  ticks: { font: { size: 10 }, color: '#9CA3AF' },
}
