import { useEffect, useState } from 'react'
import { Plus, Search, Package } from 'lucide-react'
import { productApi } from '../../services/api'
import type { Category, Product } from '../../types'
import toast from 'react-hot-toast'
import SearchableSelect from '../../components/SearchableSelect'
import Pagination from '../../components/Pagination'

const LIMIT = 50

export default function ProductsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<'products' | 'categories'>('products')
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCat, setShowAddCat]         = useState(false)

  // Form state
  const [form, setForm] = useState({ category_id: '', name: '', description: '', unit: 'kg', unit_value: '1', brand: '', image_url: '' })
  const [catForm, setCatForm] = useState({ name: '', sort_order: '0', image_url: '' })
  const [uploadingProductImg, setUploadingProductImg] = useState(false)
  const [uploadingCatImg, setUploadingCatImg] = useState(false)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'category') => {
    const file = e.target.files?.[0]
    if (!file) return
    const setUploading = target === 'product' ? setUploadingProductImg : setUploadingCatImg
    setUploading(true)
    try {
      const res = await productApi.uploadImage(file, target === 'product' ? 'products' : 'categories')
      const image_url = res.data.data.image_url
      if (target === 'product') setForm((f) => ({ ...f, image_url }))
      else setCatForm((f) => ({ ...f, image_url }))
    } catch {
      // error toast already shown by the api interceptor
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const loadAll = (p = page) => {
    setLoading(true)
    Promise.all([
      productApi.getCategories(),
      productApi.getMasterProducts({ search, page: String(p), limit: String(LIMIT), ...(catFilter ? { category_id: catFilter } : {}) }),
    ])
      .then(([cats, prods]) => {
        setCategories(cats.data.data)
        setProducts(prods.data.data)
        setTotal(prods.data.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handlePageChange = (p: number) => { setPage(p); loadAll(p) }

  useEffect(() => { setPage(1); loadAll(1) }, [catFilter])

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await productApi.createProduct(form)
      toast.success('Product added to catalog')
      setShowAddProduct(false)
      setForm({ category_id: '', name: '', description: '', unit: 'kg', unit_value: '1', brand: '', image_url: '' })
      loadAll()
    } catch {}
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await productApi.createCategory({ name: catForm.name, sort_order: Number(catForm.sort_order), image_url: catForm.image_url || undefined })
      toast.success('Category created')
      setShowAddCat(false)
      setCatForm({ name: '', sort_order: '0', image_url: '' })
      loadAll()
    } catch {}
  }

  const handleToggleProduct = async (id: string, is_active: boolean) => {
    try {
      await productApi.updateProduct(id, { is_active: !is_active })
      toast.success(is_active ? 'Product deactivated' : 'Product activated')
      loadAll()
    } catch {}
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from the catalog? This can't be undone.`)) return
    try {
      await productApi.deleteProduct(id)
      toast.success('Product removed')
      loadAll()
    } catch {
      // error toast already shown by the api interceptor (e.g. "in use by N shops")
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAddCat(true)} className="btn-secondary">
            <Plus size={16} /> Category
          </button>
          <button onClick={() => setShowAddProduct(true)} className="btn-primary">
            <Plus size={16} /> Product
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['products', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab} {tab === 'products' ? `(${products.length})` : `(${categories.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'products' && (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                className="input pl-9"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No products found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Product', 'Category', 'Unit', 'Brand', 'Status', ''].map((h) => (
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
                              <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover bg-gray-50 border border-gray-100 flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={14} className="text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{p.name}</div>
                              <div className="text-xs text-gray-400 truncate max-w-xs">{p.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="badge badge-blue">{p.category_name}</span></td>
                        <td className="px-4 py-3 text-gray-600">{p.unit_value} {p.unit}</td>
                        <td className="px-4 py-3 text-gray-600">{p.brand || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={p.is_active ? 'badge-green' : 'badge-red'}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleProduct(p.id, p.is_active)}
                              className={`text-xs font-medium ${p.is_active ? 'text-red-500 hover:underline' : 'text-green-600 hover:underline'}`}
                            >
                              {p.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="text-xs font-medium text-gray-400 hover:text-red-600 hover:underline"
                            >
                              Remove
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
        </>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-4 flex items-center gap-3">
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name} className="w-10 h-10 rounded-xl object-cover bg-brand-50 border border-gray-100 flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package size={20} className="text-brand-600" />
                </div>
              )}
              <div>
                <div className="font-medium text-sm">{cat.name}</div>
                <div className="text-xs text-gray-400">Order: {cat.sort_order}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Product to Catalog</h2>
              <button onClick={() => setShowAddProduct(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200 bg-gray-50" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package size={20} className="text-gray-400" />
                  </div>
                )}
                <label className="btn-secondary text-sm cursor-pointer">
                  {uploadingProductImg ? 'Uploading…' : form.image_url ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingProductImg}
                    onChange={(e) => handleImageSelect(e, 'product')}
                  />
                </label>
              </div>
              <SearchableSelect
                value={form.category_id}
                onChange={(v) => setForm({ ...form, category_id: v })}
                placeholder="Select Category *"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <input className="input" placeholder="Product name *" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className="input" placeholder="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <SearchableSelect
                  value={form.unit}
                  onChange={(v) => setForm({ ...form, unit: v })}
                  placeholder="Unit"
                  searchable={false}
                  options={['kg', 'gram', 'litre', 'ml', 'piece', 'dozen', 'bunch', 'pack'].map((u) => ({ value: u, label: u }))}
                />
                <input className="input" placeholder="Unit value (e.g. 1, 0.5, 500)" value={form.unit_value}
                  onChange={(e) => setForm({ ...form, unit_value: e.target.value })} required />
              </div>
              <input className="input" placeholder="Brand (optional)" value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddProduct(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add Category</h2>
              <button onClick={() => setShowAddCat(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div className="flex items-center gap-3">
                {catForm.image_url ? (
                  <img src={catForm.image_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-200 bg-brand-50" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Package size={20} className="text-brand-600" />
                  </div>
                )}
                <label className="btn-secondary text-sm cursor-pointer">
                  {uploadingCatImg ? 'Uploading…' : catForm.image_url ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingCatImg}
                    onChange={(e) => handleImageSelect(e, 'category')}
                  />
                </label>
              </div>
              <input className="input" placeholder="Category name *" value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
              <input className="input" type="number" placeholder="Sort order (0 = first)" value={catForm.sort_order}
                onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCat(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
