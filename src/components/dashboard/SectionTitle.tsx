'use client'

// Sub-rótulo de seção das telas de indicadores: cinza, maiúsculo, pequeno.
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] mt-5 mb-2">{children}</h3>
}
