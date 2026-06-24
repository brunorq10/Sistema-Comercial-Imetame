'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { usePermissions } from '@/hooks/usePermissions'
import { ClienteModal } from '@/components/forms/ClienteModal'
import { UsuarioModal } from '@/components/forms/UsuarioModal'
import { PERFIL_LABELS, RAMO_ATUACAO_LABELS } from '@/types'
import type { ClienteListItem, UsuarioListItem } from '@/types'

type Tab = 'clientes' | 'usuarios'

export default function CadastrosPage() {
  const { pode } = usePermissions()
  const podeCliente = pode('cadastro.cliente.editar')   // criar/editar/inativar têm os mesmos perfis
  const podeUsuario = pode('cadastro.usuario.gerenciar')
  const [tab, setTab] = useState<Tab>('clientes')

  // ── Clientes ──────────────────────────────────────────────────────────────
  const [clientes, setClientes] = useState<ClienteListItem[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [buscaClientes, setBuscaClientes] = useState('')
  const [incluirInativosClientes, setIncluirInativosClientes] = useState(false)
  const [clienteModal, setClienteModal] = useState(false)
  const [editandoCliente, setEditandoCliente] = useState<ClienteListItem | null>(null)

  const fetchClientes = useCallback(async () => {
    setLoadingClientes(true)
    try {
      const params = new URLSearchParams({ full: '1' })
      if (buscaClientes) params.set('busca', buscaClientes)
      if (incluirInativosClientes) params.set('inativo', '1')
      const res = await fetch(`/api/clientes?${params}`)
      const json = await res.json()
      if (json.data) setClientes(json.data)
    } finally {
      setLoadingClientes(false)
    }
  }, [buscaClientes, incluirInativosClientes])

  useEffect(() => { if (tab === 'clientes') fetchClientes() }, [tab, fetchClientes])

  const handleToggleClienteAtivo = async (c: ClienteListItem) => {
    await fetch(`/api/clientes/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !c.ativo }),
    })
    fetchClientes()
  }

  // ── Usuários ──────────────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [buscaUsuarios, setBuscaUsuarios] = useState('')
  const [incluirInativosUsuarios, setIncluirInativosUsuarios] = useState(false)
  const [usuarioModal, setUsuarioModal] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState<UsuarioListItem | null>(null)

  const fetchUsuarios = useCallback(async () => {
    setLoadingUsuarios(true)
    try {
      const params = new URLSearchParams()
      if (buscaUsuarios) params.set('busca', buscaUsuarios)
      if (incluirInativosUsuarios) params.set('inativo', '1')
      const res = await fetch(`/api/usuarios?${params}`)
      const json = await res.json()
      if (json.data) setUsuarios(json.data)
    } finally {
      setLoadingUsuarios(false)
    }
  }, [buscaUsuarios, incluirInativosUsuarios])

  useEffect(() => { if (tab === 'usuarios') fetchUsuarios() }, [tab, fetchUsuarios])

  const handleToggleUsuarioAtivo = async (u: UsuarioListItem) => {
    await fetch(`/api/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !u.ativo }),
    })
    fetchUsuarios()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['clientes', 'usuarios'] as Tab[]).filter((t) => t === 'clientes' ? podeCliente : podeUsuario).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-green-primary text-green-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'clientes' ? 'Clientes' : 'Usuários'}
          </button>
        ))}
      </div>

      {/* ── CLIENTES ──────────────────────────────────────────────────────── */}
      {tab === 'clientes' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ ou contato..."
              value={buscaClientes}
              onChange={(e) => setBuscaClientes(e.target.value)}
              className="flex-1 max-w-sm border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/40"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirInativosClientes}
                onChange={(e) => setIncluirInativosClientes(e.target.checked)}
                className="rounded"
              />
              Incluir inativos
            </label>
            <div className="ml-auto">
              {podeCliente && (
                <Button onClick={() => { setEditandoCliente(null); setClienteModal(true) }}>
                  + Novo Cliente
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Razão Social</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">CNPJ</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cidade / UF</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ramo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  {podeCliente && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {loadingClientes ? (
                  <tr>
                    <td colSpan={podeCliente ? 8 : 7} className="text-center py-10 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={podeCliente ? 8 : 7} className="text-center py-10 text-gray-400">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : clientes.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${!c.ativo ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{c.codigo ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{c.cnpj ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.contato_nome
                        ? <span>{c.contato_nome}{c.contato_email && <><br /><span className="text-xs text-gray-400">{c.contato_email}</span></>}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.cidade || c.estado ? `${c.cidade ?? ''}${c.cidade && c.estado ? ' / ' : ''}${c.estado ?? ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.ramo_atuacao ? RAMO_ATUACAO_LABELS[c.ramo_atuacao] : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.ativo ? 'green' : 'gray'}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    {podeCliente && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setEditandoCliente(c); setClienteModal(true) }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleClienteAtivo(c)}
                            className={`text-xs hover:underline ${c.ativo ? 'text-red-500' : 'text-green-700'}`}
                          >
                            {c.ativo ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ClienteModal
            open={clienteModal}
            onClose={() => setClienteModal(false)}
            onSuccess={() => { setClienteModal(false); fetchClientes() }}
            editando={editandoCliente}
          />
        </>
      )}

      {/* ── USUÁRIOS ──────────────────────────────────────────────────────── */}
      {tab === 'usuarios' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={buscaUsuarios}
              onChange={(e) => setBuscaUsuarios(e.target.value)}
              className="flex-1 max-w-sm border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-primary/40"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirInativosUsuarios}
                onChange={(e) => setIncluirInativosUsuarios(e.target.checked)}
                className="rounded"
              />
              Incluir inativos
            </label>
            <div className="ml-auto">
              {podeUsuario && (
                <Button onClick={() => { setEditandoUsuario(null); setUsuarioModal(true) }}>
                  + Novo Usuário
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Função</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Perfil</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  {podeUsuario && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {loadingUsuarios ? (
                  <tr>
                    <td colSpan={podeUsuario ? 6 : 5} className="text-center py-10 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={podeUsuario ? 6 : 5} className="text-center py-10 text-gray-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : usuarios.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${!u.ativo ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{u.funcao ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="blue">{PERFIL_LABELS[u.perfil]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.ativo ? 'green' : 'gray'}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    {podeUsuario && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setEditandoUsuario(u); setUsuarioModal(true) }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleUsuarioAtivo(u)}
                            className={`text-xs hover:underline ${u.ativo ? 'text-red-500' : 'text-green-700'}`}
                          >
                            {u.ativo ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <UsuarioModal
            open={usuarioModal}
            onClose={() => setUsuarioModal(false)}
            onSuccess={() => { setUsuarioModal(false); fetchUsuarios() }}
            editando={editandoUsuario}
            isAdmin={podeUsuario}
          />
        </>
      )}
    </div>
  )
}
