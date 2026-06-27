import type { SVGProps } from 'react'

// ════════════════════════════════════════════════════════════════════════════
// Tipos e impactos de Interação (Linha do Tempo de Negociação) — fonte única.
// ════════════════════════════════════════════════════════════════════════════

type IconType = (props: SVGProps<SVGSVGElement>) => JSX.Element

const svg = (children: JSX.Element) => (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" width={20} height={20} {...props}
  >
    {children}
  </svg>
)

// Ícones inline (estilo lucide) — evita nova dependência
const IconUsers: IconType = svg(<>
  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
</>)
const IconGavel: IconType = svg(<>
  <path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8" />
  <path d="m16 16 6-6" />
  <path d="m8 8 6-6" />
  <path d="m9 7 8 8" />
  <path d="m21 11-8-8" />
</>)
const IconMessage: IconType = svg(<>
  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
</>)
const IconTarget: IconType = svg(<>
  <circle cx="12" cy="12" r="10" />
  <circle cx="12" cy="12" r="6" />
  <circle cx="12" cy="12" r="2" />
</>)
const IconPencil: IconType = svg(<>
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  <path d="m15 5 4 4" />
</>)
const IconDots: IconType = svg(<>
  <circle cx="12" cy="12" r="1" />
  <circle cx="19" cy="12" r="1" />
  <circle cx="5" cy="12" r="1" />
</>)

export interface TipoInteracaoCfg {
  value: string
  label: string
  cor: string      // cor de destaque (texto/borda)
  corBg: string    // fundo claro quando selecionado
  icon: IconType
}

// Tipos de Informação (Linha do Tempo de Negociação)
export const TIPOS_INTERACAO: TipoInteracaoCfg[] = [
  { value: 'REUNIAO_CALL',      label: 'Reunião / Call',      cor: '#15803D', corBg: '#ECFDF3', icon: IconUsers },
  { value: 'DEFINICAO_INTERNA', label: 'Definição Interna',   cor: '#185FA5', corBg: '#EAF2FB', icon: IconGavel },
  { value: 'FEEDBACK_CLIENTE',  label: 'Feedback Cliente',    cor: '#A32D2D', corBg: '#FCEDED', icon: IconMessage },
  { value: 'DEFINICAO_ESCOPO',  label: 'Definição de Escopo', cor: '#B45309', corBg: '#FEF6EC', icon: IconPencil },
  { value: 'CONCORRENCIA',      label: 'Concorrência',        cor: '#7C3AED', corBg: '#F3EDFE', icon: IconTarget },
  { value: 'OUTROS',            label: 'Outros',              cor: '#6B7280', corBg: '#F3F4F6', icon: IconDots },
]

export const TIPO_INTERACAO_MAP: Record<string, TipoInteracaoCfg> = Object.fromEntries(
  TIPOS_INTERACAO.map((t) => [t.value, t]),
)
