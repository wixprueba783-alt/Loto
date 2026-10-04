import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Check, X, Upload } from 'lucide-react';
import { SERVICES, addServiceFS, updateServiceFS, deleteServiceFS, SERVICE_CATEGORIES, syncServiceCategories } from '../../data';
import { Modal } from '../../components/Modal';
import type { Service } from '../../types';

type ServiceForm = Omit<Service, 'id'> & { id?: string };

const emptyForm: ServiceForm = {
  name: '', description: '', price: 0, duration: 60,
  image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format',
  category: 'Manicura', active: true,
};

export function AdminCatalogPage() {
  const [services, setServices] = useState<Service[]>(SERVICES);
  const [categories, setCategories] = useState<string[]>(SERVICE_CATEGORIES);
  const [featuredIds, setFeaturedIds] = useState<string[]>(SERVICES.filter(s => s.featured).map(s => s.id));
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  async function updateCategories(next: string[]) {
    const cleaned = Array.from(new Set(next.map(c => c.trim()).filter(Boolean)));
    const finalCategories = cleaned.length > 0 ? cleaned : SERVICE_CATEGORIES;

    await syncServiceCategories(finalCategories);
    setCategories(finalCategories);

    if (!finalCategories.includes(form.category)) {
      setForm(prev => ({ ...prev, category: finalCategories[0] }));
    }
  }

  async function saveCategory() {
    const value = categoryDraft.trim();
    if (!value) {
      setCategoryError('Escribe un nombre para la categoría.');
      return;
    }

    if (categories.some(cat => cat.toLowerCase() === value.toLowerCase())) {
      setCategoryError('Esa categoría ya existe.');
      return;
    }

    const next = [...categories, value];
    try {
      await updateCategories(next);
      setForm(prev => ({ ...prev, category: value }));
      setCategoryDraft('');
      setCategoryError('');
      setCategoryModal(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'No se pudo guardar la categoría.');
    }
  }

  async function removeCategory(name: string) {
    if (categories.length <= 1) {
      setCategoryError('Debe existir al menos una categoría.');
      return;
    }

    const next = categories.filter(cat => cat !== name);
    try {
      await updateCategories(next);
      setCategoryError('');
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'No se pudo actualizar la categoría.');
    }
  }

  function openCreate() {
    setForm({ ...emptyForm, category: categories[0] || 'Manicura' });
    setEditId(null);
    setImageError('');
    setModal('create');
  }

  function openEdit(s: Service) {
    setForm({ ...s });
    setEditId(s.id);
    setImageError('');
    setModal('edit');
  }

  function handleImageChange(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Selecciona un archivo de imagen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('La imagen debe pesar menos de 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, image: String(reader.result) }));
      setImageError('');
    };
    reader.readAsDataURL(file);
  }

  async function saveService() {
    setSaveError('');
    setSaving(true);
    try {
      const serviceId = modal === 'create' ? `s${Date.now()}` : editId;
      if (!serviceId) throw new Error('No se encontró el servicio que se va a editar.');
      const savedForm: ServiceForm = {
        id: form.id,
        name: form.name,
        description: form.description,
        price: form.price,
        duration: form.duration,
        image: form.image,
        category: form.category,
        active: form.active,
        featured: form.featured,
      };
      if (modal === 'create') {
      const newService = { ...savedForm, id: serviceId } as Service;
      await addServiceFS(newService);
      setServices(prev => [...prev, newService]);
      } else if (editId) {
        await updateServiceFS(editId, savedForm);
      setServices(prev => prev.map(s => s.id === editId ? { ...savedForm, id: editId } as Service : s));
      }
      setModal(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el servicio.');
    } finally {
      setSaving(false);
    }
  }

  function toggleActive(id: string) {
    const current = services.find(s => s.id === id);
    if (!current) return;

    const nextActive = !current.active;
    setServices(prev => prev.map(s => s.id === id ? { ...s, active: nextActive, featured: nextActive ? s.featured : false } : s));
    if (nextActive) {
      setFeaturedIds(prev => prev.includes(id) ? prev : prev);
    } else {
      setFeaturedIds(prev => prev.filter(fid => fid !== id));
    }
    updateServiceFS(id, { active: nextActive, featured: nextActive ? current.featured : false });
  }

  function toggleFeatured(id: string) {
    setServices(prev => prev.map(s => {
      if (s.id !== id) return s;
      return { ...s, featured: !s.featured };
    }));

    const current = services.find(s => s.id === id);
    if (!current) return;

    const nextFeatured = !current.featured;
    setFeaturedIds(prev => {
      const next = nextFeatured ? [...prev, id].slice(-6) : prev.filter(fid => fid !== id);
      return next;
    });

    const next = nextFeatured ? [...featuredIds, id].slice(-6) : featuredIds.filter(fid => fid !== id);
    setServices(prev => prev.map(s => s.id === id ? { ...s, featured: nextFeatured } : s));
    updateServiceFS(id, { featured: nextFeatured });
    if (next.length > 0) {
      Promise.all(next.map(serviceId => updateServiceFS(serviceId, { featured: true }))).catch(() => undefined);
    }
  }

  function confirmDelete(id: string) { setDeleteId(id); }
  function doDelete() {
    if (deleteId) {
      setServices(prev => prev.filter(s => s.id !== deleteId));
      deleteServiceFS(deleteId);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-[#6B5A5E]">{services.length} servicios registrados</div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-secondary" onClick={() => setCategoryModal(true)}><Plus size={16} /> Nueva categoría</button>
          <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Nuevo servicio</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-700 text-[#1A1012]">Categorías</h3>
          <span className="text-xs text-[#BBA9AD]">{categories.length} activas</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <div key={category} className="inline-flex items-center gap-2 rounded-full border border-[#EDD9CC] bg-[#FFF1F3] px-3 py-1.5 text-xs font-600 text-[#C1536A]">
              <span>{category}</span>
              <button className="text-[#BBA9AD] hover:text-red-500" onClick={() => removeCategory(category)} aria-label={`Eliminar ${category}`}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map(service => (
          <div key={service.id} className={`card overflow-hidden ${!service.active ? 'opacity-60' : ''}`}>
            <div className="relative h-40 overflow-hidden bg-[#F5EDE6]">
              <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${service.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-700 text-[#1A1012] text-sm leading-tight">{service.name}</h3>
                <span className="text-xs text-[#BBA9AD] bg-[#F7F4F2] px-2 py-0.5 rounded ml-2 flex-shrink-0">{service.category}</span>
              </div>
              <p className="text-xs text-[#6B5A5E] line-clamp-2 mb-3 leading-relaxed">{service.description}</p>
              <div className="flex items-center justify-between mb-3">
                <span className="font-700 text-[#C1536A] text-lg">${service.price}</span>
                <span className="text-xs text-[#BBA9AD]">{service.duration} min</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 justify-center text-xs py-1.5" onClick={() => openEdit(service)}>
                  <Edit2 size={13} /> Editar
                </button>
                <button className="btn-ghost p-1.5 text-[#BBA9AD]" onClick={() => toggleActive(service.id)} title={service.active ? 'Desactivar' : 'Activar'}>
                  {service.active ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button className="btn-ghost p-1.5 text-[#BBA9AD] hover:text-red-400" onClick={() => confirmDelete(service.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5EDE6] flex items-center justify-between">
                <span className="text-xs font-600 text-[#6B5A5E]">Destacado</span>
                <button
                  className={`btn-ghost px-2 py-1 text-xs ${service.featured ? 'text-[#C1536A]' : 'text-[#BBA9AD]'}`}
                  onClick={() => toggleFeatured(service.id)}
                  disabled={!service.active}
                >
                  {service.featured ? 'Sí' : 'No'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Nuevo servicio' : 'Editar servicio'} onClose={() => setModal(null)} size="md">
          <div className="space-y-4">
            {[
              { key: 'name', label: 'Nombre', type: 'text', placeholder: 'Manicura clásica' },
              { key: 'price', label: 'Precio ($)', type: 'number', placeholder: '220' },
              { key: 'duration', label: 'Duración (min)', type: 'number', placeholder: '45' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">{f.label}</label>
                <input className="input-field text-sm" type={f.type} placeholder={f.placeholder}
                  value={String(form[f.key as keyof ServiceForm] || '')}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Imagen del servicio</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[#EDD9CC] rounded-xl p-3 hover:bg-[#FDFAF9] transition-colors">
                <Upload size={16} className="text-[#E8778A]" />
                <span className="text-sm text-[#6B5A5E]">Elegir imagen desde el dispositivo</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={e => handleImageChange(e.target.files?.[0])}
                />
              </label>
              {form.image && (
                <img src={form.image} alt="Vista previa del servicio" className="mt-3 h-28 w-full rounded-xl object-cover" />
              )}
              {imageError && <p className="text-xs text-red-500 mt-1.5">{imageError}</p>}
            </div>
            <div>
              <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Categoría</label>
              <select className="input-field text-sm" value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Descripción</label>
              <textarea className="input-field text-sm resize-none" rows={3}
                placeholder="Describe el servicio..."
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`toggle-track ${form.active ? 'is-on bg-[#E8778A]' : 'bg-[#EDD9CC]'}`}
                  onClick={() => setForm(prev => ({ ...prev, active: !prev.active }))}>
                  <div className="toggle-thumb" />
                </div>
                <span className="text-sm font-500 text-[#3D2A2F]">Servicio activo</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              {saveError && <p className="text-xs text-red-500" role="alert">{saveError}</p>}
              <button className="btn-primary flex-1 justify-center" onClick={saveService} disabled={saving}>
                <Check size={15} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn-secondary flex-1 justify-center" onClick={() => setModal(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {categoryModal && (
        <Modal title="Nueva categoría" onClose={() => { setCategoryModal(false); setCategoryDraft(''); setCategoryError(''); }} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Nombre</label>
              <input className="input-field text-sm" value={categoryDraft} placeholder="Ej. Gel, Acrílico..."
                onChange={e => { setCategoryDraft(e.target.value); setCategoryError(''); }} />
            </div>
            {categoryError && <p className="text-xs text-red-500">{categoryError}</p>}
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={saveCategory}><Check size={15} /> Guardar</button>
              <button className="btn-secondary flex-1 justify-center" onClick={() => { setCategoryModal(false); setCategoryDraft(''); setCategoryError(''); }}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Eliminar servicio" onClose={() => setDeleteId(null)} size="sm">
          <p className="text-sm text-[#6B5A5E] mb-5">
            ¿Estás segura de que deseas eliminar este servicio? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button className="btn-primary flex-1 justify-center bg-red-500 hover:bg-red-600" onClick={doDelete}
              style={{ background: '#EF4444', boxShadow: 'none' }}>
              <Trash2 size={14} /> Eliminar
            </button>
            <button className="btn-secondary flex-1 justify-center" onClick={() => setDeleteId(null)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
