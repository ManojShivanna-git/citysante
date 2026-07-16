import { useEffect, useState } from 'react'
import { Search, CheckCircle, XCircle, PauseCircle, PlayCircle, Star, Award, RefreshCw, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../services/api'
import type { Shop, Zone } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import SearchableSelect from '../../components/SearchableSelect'
import Pagination from '../../components/Pagination'

const BADGES = ['citysante_verified', 'zones_best', 'top_seller', 'fast_delivery']

function StatusBadge({ status }: { status: Shop['status'] }) {
  const map = {
    active:    'badge-green',
    pending:   'badge-yellow',
    suspended: 'badge-red',
    rejected:  'badge-gray',
  }
  return <span className={map[status]}>{status}</span>
}

const LIMIT = 20

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Shop | null>(null)
  const [computingBadges, setComputingBadges] = useState(false)
  const [page, setPage]   = useState(1)
  const [total, setTotal] = useState(0)

  const load = (p = page) => {
    setLoading(true)
    const params: Record<string, string> = { page: String(p), limit: String(LIMIT) }
    if (filter !== 'all') params.status = filter
    if (search) params.search = search
    adminApi.getShops(params)
      .then((res) => { setShops(res.data.data); setTotal(res.data.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handlePageChange = (p: number) => { setPage(p); load(p) }

  useEffect(() => { setPage(1); load(1) }, [filter])
  useEffect(() => {
    adminApi.getZones().then((res) => setZones(res.data.data)).catch(() => {})
  }, [])

  const zoneName = (zoneId: string | null) => zones.find((z) => z.id === zoneId)?.name

  const handleAssignZone = async (shopId: string, zoneId: string) => {
    try {
      await adminApi.assignShopZone(shopId, zoneId)
      toast.success('Zone assigned')
      load()
      if (selected?.id === shopId) {
        setSelected({ ...selected, zone_id: zoneId })
      }
    } catch {}
  }

  const handleReview = async (id: string, status: 'active' | 'rejected', zoneId?: string | null) => {
    if (status === 'active' && !zoneId) {
      toast.error('Assign a zone before approving — click the shop name to open details')
      return
    }
    try {
      await adminApi.reviewShop(id, status)
      toast.success(`Shop ${status === 'active' ? 'approved' : 'rejected'}`)
      load()
      setSelected(null)
    } catch {}
  }

  const handleSuspend = async (id: string) => {
    try {
      await adminApi.suspendShop(id, 'Policy violation')
      toast.success('Shop suspended')
      load()
      setSelected(null)
    } catch {}
  }

  const handleReactivate = async (id: string) => {
    try {
      await adminApi.reactivateShop(id)
      toast.success('Shop reactivated')
      load()
      setSelected(null)
    } catch {}
  }

  const handleRecomputeBadges = async () => {
    setComputingBadges(true)
    try {
      const res = await adminApi.runBadgeCompute()
      const { awarded } = res.data
      toast.success(`Badges recomputed — zones_best: ${awarded.zones_best}, top_seller: ${awarded.top_seller}, fast_delivery: ${awarded.fast_delivery}`)
      load()
    } catch {
      toast.error('Badge computation failed')
    } finally {
      setComputingBadges(false)
    }
  }

  const handleBadge = async (shopId: string, badge: string, has: boolean) => {
    try {
      if (has) {
        await adminApi.removeBadge(shopId, badge)
        toast.success('Badge removed')
      } else {
        await adminApi.awardBadge(shopId, badge)
        toast.success('Badge awarded')
      }
      load()
      if (selected?.id === shopId) {
        const res = await adminApi.getShops({ search: selected.name })
        setSelected(res.data.data[0] || null)
      }
    } catch {}
  }

  const filtered = shops.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shops</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecomputeBadges}
            disabled={computingBadges}
            className="btn-secondary text-sm flex items-center gap-2"
            title="Recompute zones_best, top_seller, fast_delivery badges from live order data"
          >
            <RefreshCw size={14} className={computingBadges ? 'animate-spin' : ''} />
            {computingBadges ? 'Computing…' : 'Recompute Badges'}
          </button>
          <span className="badge badge-blue">{shops.length} total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Search shops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        {['all', 'pending', 'active', 'suspended', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              filter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No shops found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Shop', 'City', 'Type', 'Zone', 'Rating', 'Status', 'Open', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((shop) => (
                  <tr key={shop.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/shops/${shop.id}`}
                        className="font-medium text-brand-600 hover:underline">
                        {shop.name}
                      </Link>
                      <div className="text-xs text-gray-400">{shop.owner_name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{shop.city}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-blue capitalize">{shop.zone_category}</span>
                    </td>
                    <td className="px-4 py-3">
                      {shop.zone_id ? (
                        <span className="badge-green">{zoneName(shop.zone_id) || 'Assigned'}</span>
                      ) : (
                        <span className="badge badge-red flex items-center gap-1 w-fit">
                          <AlertTriangle size={11} /> No Zone
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star size={14} fill="currentColor" />
                        <span className="text-gray-700 text-sm">{shop.rating || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={shop.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={shop.is_open ? 'badge-green' : 'badge-gray'}>
                        {shop.is_open ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {shop.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleReview(shop.id, 'active', shop.zone_id)}
                              className={clsx(
                                'p-1.5 rounded-lg',
                                shop.zone_id
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-gray-300 cursor-not-allowed'
                              )}
                              title={shop.zone_id ? 'Approve' : 'Assign a zone first'}
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => handleReview(shop.id, 'rejected', shop.zone_id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Reject">
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        {shop.status === 'active' && (
                          <button onClick={() => handleSuspend(shop.id)}
                            className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg" title="Suspend">
                            <PauseCircle size={16} />
                          </button>
                        )}
                        {shop.status === 'suspended' && (
                          <button onClick={() => handleReactivate(shop.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Reactivate">
                            <PlayCircle size={16} />
                          </button>
                        )}
                        <button onClick={() => setSelected(shop)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Badges">
                          <Award size={16} />
                        </button>
                      </div>
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

      {/* Badge Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Zone</label>
              <SearchableSelect
                className="mt-1"
                value={selected.zone_id || ''}
                onChange={(v) => v && handleAssignZone(selected.id, v)}
                placeholder="Unassigned — pick a zone"
                options={zones.map((z) => ({ value: z.id, label: `${z.name} (${z.city})` }))}
              />
              <p className="text-xs text-gray-400 mt-1">Used by the zone coverage dashboard to count this shop.</p>
            </div>

            <p className="text-sm text-gray-500">Toggle badges for this shop</p>
            <div className="space-y-2">
              {BADGES.map((badge) => {
                const has = selected.badges?.includes(badge)
                return (
                  <div key={badge} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium capitalize">{badge.replace(/_/g, ' ')}</span>
                    <button
                      onClick={() => handleBadge(selected.id, badge, !!has)}
                      className={clsx('btn text-xs', has ? 'btn-danger' : 'btn-primary')}
                    >
                      {has ? 'Remove' : 'Award'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
