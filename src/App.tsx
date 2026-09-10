import { useDeferredValue, useEffect, useState } from 'react'
import { Check, ExternalLink, FolderOpen, RefreshCw, Search, Tag, Thermometer, Upload } from 'lucide-react'
import './App.css'
import type { AppInfo, Catalog, Material } from './types'

const emptyCatalog: Catalog = { materials: [], updatedAt: '' }
function average(minimum: number | null, maximum: number | null): string {
  if (minimum == null && maximum == null) return 'Not specified'
  if (minimum == null) return `${maximum} C`
  if (maximum == null) return `${minimum} C`
  return `${Math.round((minimum + maximum) / 2)} C (${minimum}-${maximum})`
}
function friendlyError(error: unknown): string { return error instanceof Error ? error.message : String(error) }

function App() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [catalog, setCatalog] = useState(emptyCatalog)
  const [selected, setSelected] = useState<Material | null>(null)
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('all')
  const [type, setType] = useState('all')
  const [template, setTemplate] = useState('')
  const [profileName, setProfileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const deferredQuery = useDeferredValue(query.toLowerCase())

  useEffect(() => {
    Promise.all([window.openPrintTag.getInfo(), window.openPrintTag.loadCatalog()]).then(([appInfo, savedCatalog]) => {
      const firstMaterial = savedCatalog.materials[0] ?? null
      setInfo(appInfo); setTemplate(appInfo.templates[0]?.id ?? ''); setCatalog(savedCatalog); setSelected(firstMaterial)
      if (firstMaterial) setProfileName(`${firstMaterial.brandName} ${firstMaterial.name}`)
    }).catch((error) => setNotice(friendlyError(error)))
  }, [])

  function selectMaterial(material: Material): void {
    setSelected(material)
    setProfileName(`${material.brandName} ${material.name}`)
  }

  const brands = [...new Set(catalog.materials.map((material) => material.brandName))].sort()
  const types = [...new Set(catalog.materials.map((material) => material.type))].sort()
  const visible = catalog.materials.filter((material) => {
    const text = `${material.name} ${material.brandName} ${material.type}`.toLowerCase()
    return text.includes(deferredQuery) && (brand === 'all' || material.brandName === brand) && (type === 'all' || material.type === type)
  }).slice(0, 300)

  async function sync(): Promise<void> {
    setBusy(true); setNotice('Downloading OpenPrintTag database...')
    try {
      const next = await window.openPrintTag.syncCatalog()
      setCatalog(next)
      if (next.materials[0]) selectMaterial(next.materials[0])
      setNotice(`${next.materials.length.toLocaleString()} FFF materials ready.`)
    } catch (error) { setNotice(friendlyError(error)) } finally { setBusy(false) }
  }
  async function install(): Promise<void> {
    if (!selected || !template) return
    setBusy(true); setNotice('Installing profile...')
    try {
      const path = await window.openPrintTag.installProfile({ material: selected, template, profileName })
      setNotice(`Installed ${path}. Restart PrusaSlicer to load it.`)
    } catch (error) { setNotice(friendlyError(error)) } finally { setBusy(false) }
  }

  return <main>
    <header className="topbar">
      <div className="brandmark"><Tag size={18} /><span>OPENPRINTTAG</span><b>to PrusaSlicer</b></div>
      <div className="header-actions">
        <span className="catalog-date">{catalog.updatedAt ? `Synced ${new Date(catalog.updatedAt).toLocaleDateString()}` : 'Catalog not synced'}</span>
        <button className="secondary icon-label" onClick={() => void window.openPrintTag.revealProfiles()} title="Open profile folder"><FolderOpen size={16} /> Profiles</button>
        <button className="primary icon-label" onClick={() => void sync()} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''} /> Sync catalog</button>
      </div>
    </header>
    <section className="workspace">
      <aside className="filters">
        <p className="section-label">LIBRARY</p>
        <div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials" aria-label="Search materials" /></div>
        <label>Brand<select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="all">All brands</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Material<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="source-stat"><strong>{catalog.materials.length.toLocaleString()}</strong><span>FFF materials</span></div>
        <div className="source-stat"><strong>{brands.length.toLocaleString()}</strong><span>brands</span></div>
        {info && <p className="config-path" title={info.configDirectory}>{info.configDirectory}</p>}
      </aside>
      <section className="results" aria-label="Materials">
        <div className="results-head"><span>{visible.length === 300 ? '300+' : visible.length} results</span><span>OpenPrintTag database</span></div>
        {catalog.materials.length === 0 ? <div className="empty"><Tag size={30} /><h2>No local catalog</h2><button className="primary icon-label" onClick={() => void sync()} disabled={busy}><RefreshCw size={16} /> Sync catalog</button></div> : visible.map((material) =>
          <button key={material.slug} className={`material-row ${selected?.slug === material.slug ? 'selected' : ''}`} onClick={() => selectMaterial(material)}>
            <span className="swatch" style={{ backgroundColor: material.color?.slice(0, 7) || '#d8d6cd' }} />
            <span className="material-copy"><strong>{material.name}</strong><small>{material.brandName}</small></span><span className="type-chip">{material.type}</span>
          </button>)}
      </section>
      <aside className="detail">
        {selected ? <>
          <div className="detail-title"><span className="large-swatch" style={{ backgroundColor: selected.color?.slice(0, 7) || '#d8d6cd' }} /><div><p>{selected.brandName}</p><h1>{selected.name}</h1></div></div>
          <a className="source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={14} /></a>
          <div className="mapping"><p className="section-label">PROFILE VALUES</p>
            <div><span><Thermometer size={15} /> Nozzle</span><strong>{average(selected.minPrintTemperature, selected.maxPrintTemperature)}</strong></div>
            <div><span><Thermometer size={15} /> Bed</span><strong>{average(selected.minBedTemperature, selected.maxBedTemperature)}</strong></div>
            <div><span>Type</span><strong>{selected.type}</strong></div><div><span>Density</span><strong>{selected.density == null ? 'Not specified' : `${selected.density} g/cm3`}</strong></div>
            <div><span>Chamber</span><strong>{selected.chamberTemperature == null ? 'Not specified' : `${selected.chamberTemperature} C`}</strong></div>
          </div>
          <div className="install-form"><p className="section-label">INSTALL</p>
            <label>Base preset<select value={template} onChange={(event) => setTemplate(event.target.value)}>{info?.templates.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.source})</option>)}</select></label>
            <label>Profile name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label>
            {info?.templates.length === 0 && <p className="warning">Create one custom filament preset in PrusaSlicer first.</p>}
            <button className="install-button" onClick={() => void install()} disabled={busy || !template || !profileName.trim()}><Upload size={17} /> Install profile</button>
            <p className="preserve"><Check size={14} /> Base cooling, flow, and compatibility are preserved.</p>
          </div>
        </> : <div className="empty"><Tag size={30} /><h2>Select a material</h2></div>}
      </aside>
    </section>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">x</button></div>}
  </main>
}
export default App