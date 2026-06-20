import { cn } from '@/lib/utils'
import type { StatusSolicitacao, StatusAnalise, Classificacao, Interesse } from '@/types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple'
  className?: string
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block text-[10px] font-semibold px-[7px] py-0.5 rounded-full whitespace-nowrap',
        variant === 'green' && 'bg-green-light text-green-dark',
        variant === 'red' && 'bg-[#FFEBEE] text-[#C62828]',
        variant === 'amber' && 'bg-[#FFF3E0] text-[#E65100]',
        variant === 'blue' && 'bg-[#E3F2FD] text-[#1565C0]',
        variant === 'gray' && 'bg-[#F5F5F5] text-[#616161] border border-[#D5D5D5]',
        variant === 'purple' && 'bg-[#E8EAF6] text-[#283593]',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: StatusSolicitacao }) {
  const map: Record<StatusSolicitacao, { label: string; variant: BadgeProps['variant'] }> = {
    AGUARDANDO_ANALISE: { label: 'Ag. análise', variant: 'amber' },
    EM_ELABORACAO: { label: 'Em elaboração', variant: 'blue' },
    PROPOSTA_ENVIADA: { label: 'Prop. enviada', variant: 'green' },
    CONTRATO_GANHO: { label: 'Contrato ganho', variant: 'green' },
    RECUSADA: { label: 'Recusada', variant: 'red' },
    CANCELADA: { label: 'Cancelada', variant: 'gray' },
    SUSPENSA: { label: 'Suspensa', variant: 'amber' },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function ClassificacaoBadge({ value }: { value: Classificacao | null }) {
  if (!value) return <span className="text-gray-400">—</span>
  const map: Record<Classificacao, { label: string; variant: BadgeProps['variant'] }> = {
    OBRAS: { label: 'Obras', variant: 'gray' },
    PARADAS: { label: 'Paradas', variant: 'gray' },
    OLEO_GAS: { label: 'Óleo e Gás', variant: 'blue' },
    FABRICACOES: { label: 'Fabricações', variant: 'gray' },
  }
  const { label, variant } = map[value]
  return <Badge variant={variant}>{label}</Badge>
}

export function InteresseBadge({ value }: { value: Interesse | null }) {
  if (!value) return <span className="text-gray-400">—</span>
  const map: Record<Interesse, { label: string; variant: BadgeProps['variant'] }> = {
    ALTO: { label: 'Alto', variant: 'green' },
    MEDIO: { label: 'Médio', variant: 'amber' },
    BAIXO: { label: 'Baixo', variant: 'red' },
  }
  const { label, variant } = map[value]
  return <Badge variant={variant}>{label}</Badge>
}

export function StatusAnaliseBadge({ status }: { status: StatusAnalise }) {
  const map: Record<StatusAnalise, { label: string; variant: BadgeProps['variant'] }> = {
    AGUARDANDO: { label: 'Em análise', variant: 'amber' },
    APROVADA: { label: 'Aprovada', variant: 'green' },
    REPROVADA: { label: 'Agradecida', variant: 'red' },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function VersaoBadge({ versao, asSold }: { versao: number; asSold?: boolean }) {
  if (asSold) return <Badge variant="green">As Sold.</Badge>
  return <Badge variant="purple">{`Rev${String(versao - 1).padStart(2, '0')}`}</Badge>
}
