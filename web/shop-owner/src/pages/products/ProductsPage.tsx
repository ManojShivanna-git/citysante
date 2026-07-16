import { useEffect, useRef, useState } from 'react'
import { Search, Plus, Edit2, Trash2, Package, X, Send, ImagePlus } from 'lucide-react'
import { productApi } from '../../services/api'
import { useShopStore } from '../../store/shopStore'
import type { ShopProduct, CatalogProduct, Category } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import SearchableSelect from '../../components/SearchableSelect'

export default function ProductsPage() {
  const { shop } = useShopStore()
  const [products, setProducts]   = useState<ShopProduct[]>([])
  const [catalog, setCatalog]     = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'stock' | 'add' | 'request'>('stock')
  const [editing, setEditing]     = useState<ShopProduct | null>(null)
  const [editForm, setEditForm]   = useState({ stock_qty: '', price: '', discount_price: '', is_available: true })
  const [addForm, setAddForm]     = useState({ product_id: '', price: '', discount_price: '', stock_qty: '', low_stock_alert: '10' })

  // ── Add from Catalog tab state ─────────────────────────────────────────
  const [catalogQuery, setCatalogQuery]         = useState('')
  const [catalogCatFilter, setCatalogCatFilter] = useState('')
  const [selectedCatalog, setSelectedCatalog]   = useState<CatalogProduct | null>(null)

  // ── Request New Product tab state ───────────────────────────────────────
  type ReqItem = { _id: string; name: string; description: string; unit: string; brand: string; image_url: string }
  const BLANK_REQ = { name: '', description: '', unit: 'kg', brand: '', image_url: '' }
  const [reqList, setReqList]           = useState<ReqItem[]>([])
  const [reqForm, setReqForm]           = useState(BLANK_REQ)
  const [reqEditing, setReqEditing]     = useState<string | null>(null)  // _id of row being edited inline
  const [uploadingReqImg, setUploadingReqImg] = useState(false)
  const [submittingReqs, setSubmittingReqs]   = useState(false)
  const reqImgRef = useRef<HTMLInputElement>(null)

  const load = () => {
    if (!shop) return
    setLoading(true)
    Promise.all([
      productApi.getShopProducts(shop.id, { available_only: 'false', ...(catFilter ? { category_id: catFilter } : {}) }),
      productApi.getCatalog({ limit: '200' }),
      productApi.getCategories(),
    ])
      .then(([sp, cat, cats]) => {
        setProducts(sp.data.data)
        setCatalog(cat.data.data)
        setCategories(cats.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [shop?.id, catFilter])

  // Re-fetch catalog whenever the add tab becomes active (pick up newly added products)
  useEffect(() => {
    if (activeTab === 'add' && shop) {
      productApi.getCatalog({ limit: '500' })
        .then((res) => setCatalog(res.data.data))
        .catch(() => {})
    }
  }, [activeTab])

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    try {
      await productApi.updateStock(editing.id, {
        stock_qty:      editForm.stock_qty      ? Number(editForm.stock_qty)      : undefined,
        price:          editForm.price          ? Number(editForm.price)          : undefined,
        discount_price: editForm.discount_price ? Number(editForm.discount_price) : undefined,
        is_available:   editForm.is_available,
      })
      toast.success('Stock updated')
      setEditing(null)
      load()
    } catch {}
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await productApi.addProduct({
        product_id:      addForm.product_id,
        price:           Number(addForm.price),
        discount_price:  addForm.discount_price ? Number(addForm.discount_price) : null,
        stock_qty:       Number(addForm.stock_qty),
        low_stock_alert: Number(addForm.low_stock_alert),
      })
      toast.success('Product added to your shop')
      setAddForm({ product_id: '', price: '', discount_price: '', stock_qty: '', low_stock_alert: '10' })
      setSelectedCatalog(null)
      setCatalogQuery('')
      load()
      setActiveTab('stock')
    } catch {}
  }

  const handleRemove = async (p: ShopProduct) => {
    if (!confirm(`Remove ${p.name} from your shop? This can't be undone.`)) return
    try {
      await productApi.removeProduct(p.id)
      toast.success('Product removed from your shop')
      load()
    } catch {}
  }

  // Add / update an item in the pending request list
  const handleAddToList = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqForm.name.trim()) { toast.error('Product name is required'); return }
    if (reqEditing) {
      setReqList((prev) => prev.map((item) =>
        item._id === reqEditing ? { ...item, ...reqForm } : item
      ))
      setReqEditing(null)
    } else {
      setReqList((prev) => [...prev, { _id: crypto.randomUUID(), ...reqForm }])
    }
    setReqForm(BLANK_REQ)
  }

  // Submit all pending requests to admin
  const handleSubmitAll = async () => {
    if (reqList.length === 0) { toast.error('Add at least one product to the list'); return }
    setSubmittingReqs(true)
    try {
      await Promise.all(reqList.map((item) => productApi.requestProduct(item)))
      toast.success(`${reqList.length} request${reqList.length > 1 ? 's' : ''} sent to admin`)
      setReqList([])
      setReqForm(BLANK_REQ)
    } catch {
      // error already shown by api interceptor
    } finally {
      setSubmittingReqs(false)
    }
  }

  const handleReqImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingReqImg(true)
    try {
      const res = await productApi.uploadImage(file)
      setReqForm((f) => ({ ...f, image_url: res.data.data.image_url }))
    } catch {
      // error toast already shown by the api interceptor
    } finally {
      setUploadingReqImg(false)
      e.target.value = ''
    }
  }

  // Products not yet in shop
  const existingIds = new Set(products.map((p) => p.product_id))
  const availableCatalog = catalog.filter((p) => !existingIds.has(p.id))

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'stock',   label: `My Stock (${products.length})` },
          { key: 'add',     label: `Add from Catalog (${availableCatalog.length})` },
          { key: 'request', label: `Request New Product${reqList.length > 0 ? ` (${reqList.length})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key as 'stock' | 'add' | 'request')}
            className={clsx('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'stock' && (
        <>
          <div className="card p-3 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input className="input pl-9" placeholder="Search products..." value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            <SearchableSelect
              className="w-48"
              value={catFilter}
              onChange={setCatFilter}
              placeholder="All Categories"
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Product', 'Category', 'Price', 'Discount', 'Stock', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-gray-50 border border-gray-100 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-gray-400">{p.unit_value} {p.unit}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="badge-blue">{p.category_name}</span></td>
                      <td className="px-4 py-3 font-semibold">₹{p.price}</td>
                      <td className="px-4 py-3 text-gray-500">{p.discount_price ? `₹${p.discount_price}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'font-medium',
                          p.stock_qty === 0 ? 'text-red-600' :
                          p.stock_qty <= p.low_stock_alert ? 'text-yellow-600' : 'text-gray-900'
                        )}>
                          {p.stock_qty}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={p.is_available ? 'badge-green' : 'badge-red'}>
                          {p.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => {
                            setEditing(p)
                            setEditForm({
                              stock_qty: String(p.stock_qty),
                              price: String(p.price),
                              discount_price: p.discount_price ? String(p.discount_price) : '',
                              is_available: p.is_available,
                            })
                          }} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleRemove(p)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'add' && (() => {
        // Filter: search + category
        const q = catalogQuery.toLowerCase()
        const visibleCatalog = catalog.filter((p) => {
          const matchCat  = !catalogCatFilter || p.category_id === catalogCatFilter
          const matchText = !q || p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)
          return matchCat && matchText
        })

        // Unique categories that appear in the current catalog
        const catalogCats = Array.from(
          new Map(catalog.map((p) => [p.category_id, p.category_name])).entries()
        )

        return (
          <div className="space-y-4">
            {/* ── Search + Refresh ── */}
            <div className="card p-3 flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input className="input pl-9" placeholder="Search catalog…" value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)} />
              </div>
              <button
                onClick={() => {
                  productApi.getCatalog({ limit: '500' })
                    .then((res) => { setCatalog(res.data.data); toast.success('Catalog refreshed') })
                    .catch(() => {})
                }}
                className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
                title="Reload catalog to see newly added products"
              >
                🔄 Refresh
              </button>
            </div>

            {/* ── Category filter chips ── */}
            {catalogCats.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCatalogCatFilter('')}
                  className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    !catalogCatFilter ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400')}
                >
                  All ({catalog.length})
                </button>
                {catalogCats.map(([id, name]) => {
                  const count = catalog.filter((p) => p.category_id === id).length
                  return (
                    <button key={id}
                      onClick={() => setCatalogCatFilter(id === catalogCatFilter ? '' : id)}
                      className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                        catalogCatFilter === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400')}
                    >
                      {name} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Configure & Add panel (shown when a product is selected) ── */}
            {selectedCatalog && (
              <div className="card border-2 border-brand-400 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selectedCatalog.image_url
                      ? <img src={selectedCatalog.image_url} className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                      : <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
                    }
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedCatalog.name}</h3>
                      <p className="text-xs text-gray-400">{selectedCatalog.unit_value} {selectedCatalog.unit}{selectedCatalog.brand ? ` · ${selectedCatalog.brand}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedCatalog(null); setAddForm({ product_id: '', price: '', discount_price: '', stock_qty: '', low_stock_alert: '10' }) }}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <form onSubmit={handleAddProduct} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹) *</label>
                      <input className="input" type="number" placeholder="0" value={addForm.price}
                        onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Discount Price (₹)</label>
                      <input className="input" type="number" placeholder="Optional" value={addForm.discount_price}
                        onChange={(e) => setAddForm({ ...addForm, discount_price: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Opening Stock *</label>
                      <input className="input" type="number" placeholder="0" value={addForm.stock_qty}
                        onChange={(e) => setAddForm({ ...addForm, stock_qty: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Low Stock Alert</label>
                      <input className="input" type="number" placeholder="10" value={addForm.low_stock_alert}
                        onChange={(e) => setAddForm({ ...addForm, low_stock_alert: e.target.value })} />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary w-full justify-center">
                    <Plus size={16} /> Add to My Shop
                  </button>
                </form>
              </div>
            )}

            {/* ── Product list ── */}
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : visibleCatalog.length === 0 ? (
              <div className="card p-12 text-center">
                <Package size={36} className="mx-auto mb-3 text-gray-200" />
                <p className="font-medium text-gray-500">
                  {catalog.length === 0 ? 'No products in the master catalog yet' : 'No products match your search'}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {catalog.length === 0
                    ? 'Ask an admin to add products, or click Refresh if you just added one.'
                    : 'Try clearing the search or category filter.'}
                </p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Product', 'Category', 'Unit', 'Brand', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleCatalog.map((p) => {
                      const alreadyInShop = existingIds.has(p.id)
                      return (
                        <tr key={p.id}
                          className={clsx(
                            'transition-colors',
                            alreadyInShop ? 'opacity-50' : 'hover:bg-brand-50 cursor-pointer',
                            selectedCatalog?.id === p.id && 'bg-brand-50'
                          )}
                          onClick={() => {
                            if (alreadyInShop) return
                            setSelectedCatalog(p)
                            setAddForm((f) => ({ ...f, product_id: p.id }))
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        >
                          {/* Product */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0" />
                                : <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center"><Package size={14} className="text-gray-300" /></div>
                              }
                              <span className="font-medium text-gray-900">{p.name}</span>
                            </div>
                          </td>
                          {/* Category */}
                          <td className="px-4 py-3">
                            <span className="badge-blue">{p.category_name}</span>
                          </td>
                          {/* Unit */}
                          <td className="px-4 py-3 text-gray-500 text-xs">{p.unit_value} {p.unit}</td>
                          {/* Brand */}
                          <td className="px-4 py-3 text-gray-400 text-xs">{p.brand || '—'}</td>
                          {/* Action */}
                          <td className="px-4 py-3 text-right">
                            {alreadyInShop ? (
                              <span className="badge-green text-xs">Already Added</span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedCatalog(p)
                                  setAddForm((f) => ({ ...f, product_id: p.id }))
                                  window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                className={clsx(
                                  'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                                  selectedCatalog?.id === p.id
                                    ? 'bg-brand-600 text-white border-brand-600'
                                    : 'bg-white text-brand-600 border-brand-300 hover:bg-brand-50'
                                )}
                              >
                                {selectedCatalog?.id === p.id ? '✓ Selected' : '+ Add'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Request New Product tab ── */}
      {activeTab === 'request' && (
        <div className="space-y-5">
          {/* ── Add / Edit form ── */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-1">
              {reqEditing ? '✏️ Edit Request' : '➕ Add to Request List'}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Build a list of products you want added to the master catalog, then submit all at once.
            </p>

            <form onSubmit={handleAddToList} className="space-y-4">
              {/* Image upload */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {reqForm.image_url ? (
                    <img src={reqForm.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus size={24} className="text-gray-300" />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2">
                    {uploadingReqImg ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Uploading…
                      </span>
                    ) : (
                      <><ImagePlus size={14} /> {reqForm.image_url ? 'Change Image' : 'Upload Image'}</>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingReqImg}
                      onChange={handleReqImageSelect}
                    />
                  </label>
                  {reqForm.image_url && (
                    <button type="button"
                      onClick={() => setReqForm((f) => ({ ...f, image_url: '' }))}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X size={11} /> Remove image
                    </button>
                  )}
                  <p className="text-xs text-gray-400">PNG, JPG, WebP · optional</p>
                </div>
              </div>

              {/* Name + Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Product Name *</label>
                  <input className="input" placeholder="e.g. Amul Butter" value={reqForm.name}
                    onChange={(e) => setReqForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <input className="input" placeholder="e.g. Amul" value={reqForm.brand}
                    onChange={(e) => setReqForm((f) => ({ ...f, brand: e.target.value }))} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input className="input" placeholder="Short description (optional)" value={reqForm.description}
                  onChange={(e) => setReqForm((f) => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Unit */}
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                <SearchableSelect
                  value={reqForm.unit}
                  onChange={(v) => setReqForm((f) => ({ ...f, unit: v }))}
                  searchable={false}
                  options={['kg', 'gram', 'litre', 'ml', 'piece', 'dozen', 'bunch', 'pack'].map((u) => ({ value: u, label: u }))}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                {reqEditing && (
                  <button type="button" onClick={() => { setReqEditing(null); setReqForm(BLANK_REQ) }}
                    className="btn-secondary">
                    Cancel Edit
                  </button>
                )}
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <Plus size={15} />
                  {reqEditing ? 'Update Item' : 'Add to List'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Pending list ── */}
          {reqList.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Pending Requests
                  <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {reqList.length}
                  </span>
                </h3>
                <button onClick={() => { if (confirm('Clear all pending requests?')) { setReqList([]); setReqEditing(null); setReqForm(BLANK_REQ) } }}
                  className="text-xs text-red-400 hover:text-red-600">
                  Clear all
                </button>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Image', 'Name', 'Brand', 'Unit', 'Description', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reqList.map((item) => (
                    <tr key={item._id}
                      className={clsx('hover:bg-gray-50 transition-colors', reqEditing === item._id && 'bg-orange-50')}>
                      {/* Thumbnail */}
                      <td className="px-4 py-3 w-14">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package size={14} className="text-gray-300" />
                          </div>
                        )}
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px]">
                        <div className="truncate">{item.name}</div>
                      </td>
                      {/* Brand */}
                      <td className="px-4 py-3 text-gray-500 max-w-[100px]">
                        <div className="truncate">{item.brand || '—'}</div>
                      </td>
                      {/* Unit */}
                      <td className="px-4 py-3">
                        <span className="badge-blue">{item.unit}</span>
                      </td>
                      {/* Description */}
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px]">
                        <div className="truncate">{item.description || '—'}</div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setReqEditing(item._id)
                              setReqForm({ name: item.name, description: item.description, unit: item.unit, brand: item.brand, image_url: item.image_url })
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setReqList((prev) => prev.filter((r) => r._id !== item._id))
                              if (reqEditing === item._id) { setReqEditing(null); setReqForm(BLANK_REQ) }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Submit all */}
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <p className="text-sm text-gray-500">
                  Admin will review and add approved products to the master catalog.
                </p>
                <button
                  onClick={handleSubmitAll}
                  disabled={submittingReqs}
                  className="btn-primary flex items-center gap-2 disabled:opacity-60"
                >
                  {submittingReqs ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                  ) : (
                    <><Send size={15} /> Submit All ({reqList.length})</>
                  )}
                </button>
              </div>
            </div>
          )}

          {reqList.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <Package size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-500">No products in the list yet</p>
              <p className="text-sm mt-1">Fill the form above and click "Add to List"</p>
            </div>
          )}
        </div>
      )}

      {/* Edit stock modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Update: {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <form onSubmit={handleUpdateStock} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock Quantity</label>
                <input className="input" type="number" value={editForm.stock_qty}
                  onChange={(e) => setEditForm({ ...editForm, stock_qty: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹)</label>
                  <input className="input" type="number" value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discount (₹)</label>
                  <input className="input" type="number" value={editForm.discount_price}
                    onChange={(e) => setEditForm({ ...editForm, discount_price: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.is_available}
                  onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                  className="w-4 h-4 accent-brand-600" />
                <span className="text-sm">Mark as available</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
