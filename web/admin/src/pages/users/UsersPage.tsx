import { useEffect, useState } from 'react'
import { Search, UserCheck, UserX } from 'lucide-react'
import { adminApi } from '../../services/api'
import type { User } from '../../types'
import toast from 'react-hot-toast'
import SearchableSelect from '../../components/SearchableSelect'
import Pagination from '../../components/Pagination'

const LIMIT = 20

export default function UsersPage() {
  const [users, setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole]     = useState('')
  const [page, setPage]     = useState(1)
  const [total, setTotal]   = useState(0)

  const load = (p = page) => {
    setLoading(true)
    const params: Record<string, string> = { page: String(p), limit: String(LIMIT) }
    if (search) params.search = search
    if (role) params.role = role
    adminApi.getUsers(params)
      .then((res) => { setUsers(res.data.data); setTotal(res.data.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handlePageChange = (p: number) => { setPage(p); load(p) }

  useEffect(() => { setPage(1); load(1) }, [role])

  const handleToggle = async (id: string, name: string, active: boolean) => {
    try {
      await adminApi.toggleUser(id)
      toast.success(`${name} ${active ? 'deactivated' : 'activated'}`)
      load()
    } catch {}
  }

  const roleBadge = (r: string) => {
    const map: Record<string, string> = {
      customer:    'badge-blue',
      shop_owner:  'badge-green',
      rider:       'badge-yellow',
      admin:       'badge-purple',
      super_admin: 'badge-red',
    }
    return map[r] || 'badge-gray'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <span className="badge badge-blue">{total} total</span>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="input pl-9" placeholder="Search by name or email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <SearchableSelect
          className="w-44"
          value={role}
          onChange={setRole}
          placeholder="All Roles"
          searchable={false}
          options={[
            { value: '', label: 'All Roles' },
            ...['customer', 'shop_owner', 'rider', 'admin', 'super_admin'].map((r) => ({
              value: r,
              label: r.replace('_', ' '),
            })),
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['User', 'Phone', 'Role', 'Verified', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{u.name}</div>
                          <div className="text-xs text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                    <td className="px-4 py-3">
                      <span className={roleBadge(u.role)}>{u.role.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={u.is_verified ? 'badge-green' : 'badge-yellow'}>
                        {u.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                        {u.is_active ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!['admin', 'super_admin'].includes(u.role) && (
                        <button
                          onClick={() => handleToggle(u.id, u.name, u.is_active)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            u.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {u.is_active ? <><UserX size={13} /> Block</> : <><UserCheck size={13} /> Unblock</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > LIMIT && (
          <div className="px-4 border-t border-gray-100">
            <Pagination page={page} total={total} limit={LIMIT} onChange={handlePageChange} />
          </div>
        )}
      </div>
    </div>
  )
}
