'use client'

import { useSubstituicoes } from '@/hooks/useSubstituicoes'
import { formatDate } from '@/lib/utils'

// Banner exibido no topo de Meu Painel (Orçamentos e Acordos) quando há uma
// substituição temporária vigente envolvendo o usuário — como substituto
// (Cadastros > Substituições, Tipo 1) ou como titular sendo substituído.
export function SubstituicaoBanner() {
  const { substituindo, sendoSubstituidoPor, loading } = useSubstituicoes()
  if (loading || (substituindo.length === 0 && sendoSubstituidoPor.length === 0)) return null

  return (
    <div className="space-y-1.5 mb-3">
      {substituindo.map((s) => (
        <div key={`sub-${s.id}`} className="bg-[#E3F2FD] border border-[#90CAF9] text-[#1565C0] text-[11px] px-3 py-2 rounded-md">
          Você está substituindo <strong>{s.titular.nome}</strong> até {formatDate(s.ate)}.
        </div>
      ))}
      {sendoSubstituidoPor.map((s) => (
        <div key={`sido-${s.id}`} className="bg-[#FFF3E0] border border-[#FFCC80] text-[#E65100] text-[11px] px-3 py-2 rounded-md">
          <strong>{s.substituto.nome}</strong> está te substituindo até {formatDate(s.ate)}.
        </div>
      ))}
    </div>
  )
}
