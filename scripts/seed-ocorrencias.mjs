import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Usa o primeiro contrato ativo e o primeiro usuário disponível
const contrato = await prisma.contrato.findFirst({
  where: { cancelled_at: null },
  orderBy: { id: 'asc' },
})
const user = await prisma.user.findFirst({ orderBy: { id: 'asc' } })

if (!contrato || !user) {
  console.error('Nenhum contrato ou usuário encontrado no banco.')
  process.exit(1)
}
console.log(`Contrato: ${contrato.indice} (id=${contrato.id}) · Autor: ${user.nome} (id=${user.id})`)

// Limpa ocorrências de demonstração anteriores deste contrato
await prisma.ocorrenciaContratual.deleteMany({ where: { contrato_id: contrato.id } })

const D = (s) => new Date(s + 'T12:00:00')

const dados = [
  { codigo: 'OC-0001', tipo: 'INDISPONIBILIDADE_LOCAL', data: '2026-06-28', responsabilidade: 'CLIENTE',     impacto: ['PRAZO', 'CUSTO'],            descricao: 'Frente de serviço liberada com 4 dias de atraso pelo cliente, impactando o cronograma de mobilização da equipe de montagem.', notif: '2026-06-29', anexos: [{ nome: 'notificacao-atraso.pdf', tipo: 'application/pdf' }, { nome: 'foto-area.jpg', tipo: 'image/jpeg' }] },
  { codigo: 'OC-0002', tipo: 'OUTROS',                   data: '2026-06-12', responsabilidade: 'CLIENTE',     impacto: ['MARCO_CONTRATUAL', 'CUSTO'], descricao: 'Solicitação formal do cliente para antecipar marco contratual de comissionamento, exigindo realocação de efetivo.', notif: null, anexos: [{ nome: 'oficio-cliente.pdf', tipo: 'application/pdf' }] },
  { codigo: 'OC-0003', tipo: 'CHUVA',                    data: '2026-06-03', responsabilidade: 'FORCA_MAIOR', impacto: ['PRAZO', 'CRONOGRAMA'],      descricao: 'Chuvas intensas por 2 dias consecutivos interromperam as atividades de içamento e soldagem em campo.', notif: '2026-06-04', anexos: [{ nome: 'boletim-meteorologico.pdf', tipo: 'application/pdf' }, { nome: 'registro-canteiro.png', tipo: 'image/png' }] },
  { codigo: 'OC-0004', tipo: 'OUTROS',                   data: '2026-05-22', responsabilidade: 'IMETAME',     impacto: ['CUSTO'],                     descricao: 'Necessidade de retrabalho em junta soldada reprovada na inspeção por amostragem; custo absorvido pela Imetame.', notif: null, anexos: [] },
  { codigo: 'OC-0005', tipo: 'INDISPONIBILIDADE_LOCAL', data: '2026-05-10', responsabilidade: 'CLIENTE',     impacto: ['PRAZO'],                     descricao: 'Bloqueio de acesso ao costado do equipamento por interferência com obra civil de terceiros do cliente.', notif: '2026-05-11', anexos: [{ nome: 'comunicado-bloqueio.pdf', tipo: 'application/pdf' }] },
  { codigo: 'OC-0006', tipo: 'OUTROS',                   data: '2026-04-29', responsabilidade: 'CLIENTE',     impacto: ['CUSTO', 'OUTROS'],           descricao: 'Mudança de especificação de pintura solicitada pelo cliente após início da aplicação, gerando aditivo de escopo.', notif: null, anexos: [] },
  { codigo: 'OC-0007', tipo: 'PARALISACAO_TERCEIROS',   data: '2026-04-15', responsabilidade: 'TERCEIROS',   impacto: ['PRAZO', 'CRONOGRAMA'],      descricao: 'Paralisação da frente por greve de empresa terceirizada de andaimes contratada pelo cliente.', notif: '2026-04-16', anexos: [{ nome: 'aviso-paralisacao.pdf', tipo: 'application/pdf' }] },
]

for (const o of dados) {
  await prisma.ocorrenciaContratual.create({
    data: {
      contrato_id: contrato.id,
      codigo: o.codigo,
      tipo: o.tipo,
      data: D(o.data),
      responsabilidade: o.responsabilidade,
      impacto: o.impacto,
      descricao: o.descricao,
      data_notificacao_cliente: o.notif ? D(o.notif) : null,
      created_by: user.id,
      anexos: o.anexos.length ? { create: o.anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, url: '#' })) } : undefined,
    },
  })
  console.log(`  + ${o.codigo} (${o.anexos.length} anexo(s))`)
}

console.log(`\n✓ ${dados.length} ocorrências criadas no contrato ${contrato.indice}.`)
await prisma.$disconnect()
