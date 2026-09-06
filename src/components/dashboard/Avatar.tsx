'use client'

// Iniciais coloridas por hash do nome — usado nas tabelas de responsável dos
// dois dashboards (Acordos e Comercial).
export function Avatar({ nome }: { nome: string }) {
  const ini = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  let h = 0; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold flex-shrink-0"
      style={{ backgroundColor: `hsl(${h},55%,42%)` }}
    >
      {ini}
    </span>
  )
}
