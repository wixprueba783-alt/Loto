import { useState } from 'react';
import { Check, Edit2, Eye, EyeOff, Plus, Trash2, Upload } from 'lucide-react';
import { SERVICE_SUBSERVICES, addServiceSubservice, deleteServiceSubservice, updateServiceSubservice } from '../../data';
import { Modal } from '../../components/Modal';
import type { ServiceSubservice } from '../../types';

type Draft = Omit<ServiceSubservice, 'id'>;

const emptyDraft: Draft = {
  name: '',
  description: '',
  pricePerNail: 0,
  image: '',
  active: true,
};

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('El navegador no pudo preparar la imagen.'));
        return;
      }

      let width = image.naturalWidth;
      let height = image.naturalHeight;
      const maxDocumentImageBytes = 600 * 1024;
      for (let resize = 0; resize < 8; resize += 1) {
        const scale = Math.min(1, 1600 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (const quality of [0.82, 0.7, 0.58, 0.48]) {
          const blob = await new Promise<Blob | null>(done => canvas.toBlob(done, 'image/webp', quality));
          if (!blob) {
            reject(new Error('No se pudo comprimir la imagen.'));
            return;
          }
          if (blob.size <= maxDocumentImageBytes) {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('No se pudo preparar la imagen para guardarla.'));
            reader.readAsDataURL(blob);
            return;
          }
        }
        width = canvas.width * 0.75;
        height = canvas.height * 0.75;
      }
      reject(new Error('La imagen no se pudo reducir lo suficiente para guardarla en Firestore.'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo abrir la imagen seleccionada.'));
    };
    image.src = objectUrl;
  });
}

export function SpecializedServicesPage() {
  const [items, setItems] = useState<ServiceSubservice[]>(SERVICE_SUBSERVICES);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setModalOpen(true);
    setEditId(null);
    setDraft(emptyDraft);
    setProcessingImage(false);
    setPreview('');
    setError('');
  }

  function openEdit(item: ServiceSubservice) {
    setModalOpen(true);
    setEditId(item.id);
    setDraft({ name: item.name, description: item.description ?? '', pricePerNail: item.pricePerNail, image: item.image, active: item.active });
    setProcessingImage(false);
    setPreview(item.image);
    setError('');
  }

  async function selectImage(selected?: File) {
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size <= 0 || selected.size > 5 * 1024 * 1024) {
      setError('Selecciona una imagen JPG, PNG o WEBP de máximo 5 MB.');
      return;
    }
    setProcessingImage(true);
    setError('');
    try {
      const image = await compressImage(selected);
      setDraft(current => ({ ...current, image }));
      setPreview(image);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'No se pudo preparar la imagen.');
    } finally {
      setProcessingImage(false);
    }
  }

  async function save() {
    const name = draft.name.trim();
    if (!name || !Number.isFinite(draft.pricePerNail) || draft.pricePerNail <= 0 || !draft.image || processingImage) {
      setError('El nombre, la foto y un precio por uña mayor que cero son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = editId ?? `special_${Date.now()}`;
      const data = { ...draft, name, ...(editId ? {} : { createdAt: new Date().toISOString() }) };
      if (editId) {
        await updateServiceSubservice(id, data);
        setItems(current => current.map(item => item.id === id ? { ...item, ...data } : item));
      } else {
        const created = { ...data, id };
        await addServiceSubservice(created);
        setItems(current => [...current, created]);
      }
      setDraft(emptyDraft);
      setPreview('');
      setProcessingImage(false);
      setEditId(null);
      setModalOpen(false);
    } catch (saveError) {
      const code = typeof saveError === 'object' && saveError !== null && 'code' in saveError ? String(saveError.code) : '';
      setError(code === 'permission-denied'
        ? 'Firestore rechazó el guardado: publica las reglas que permiten administrar serviceSubservices.'
        : saveError instanceof Error ? saveError.message : 'No se pudo guardar el servicio especializado.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ServiceSubservice) {
    try {
      const active = !item.active;
      await updateServiceSubservice(item.id, { active });
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, active } : entry));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo actualizar el estado.');
    }
  }

  async function remove(id: string) {
    try {
      await deleteServiceSubservice(id);
      setItems(current => current.filter(item => item.id !== id));
      setDeletingId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el servicio especializado.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-700 text-[var(--color-text)]">Servicios especializados</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Administra extras independientes con precio por uña.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Nuevo especializado</button>
      </header>

      {error && !editId && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">Aún no hay servicios especializados.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <article key={item.id} className="card overflow-hidden">
              <img src={item.image} alt={item.name} className="h-44 w-full object-cover" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-700 text-[var(--color-text)]">{item.name}</h2>
                    {item.description && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.description}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}>
                    {item.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="font-700 text-[var(--color-primary)]">${item.pricePerNail.toFixed(2)} por uña</p>
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1 justify-center" onClick={() => openEdit(item)}><Edit2 size={14} /> Editar</button>
                  <button className="btn-ghost" aria-label={item.active ? 'Desactivar' : 'Activar'} onClick={() => void toggleActive(item)}>
                    {item.active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button className="btn-ghost text-[var(--color-danger)]" aria-label="Eliminar" onClick={() => setDeletingId(item.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editId ? 'Editar especializado' : 'Nuevo especializado'} onClose={() => { setModalOpen(false); setEditId(null); setPreview(''); setDraft(emptyDraft); setError(''); }} size="md">
          <div className="space-y-4">
            <label className="block text-xs text-[var(--color-text-muted)]">Nombre
              <input className="input-field mt-1 text-sm" value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Piedra en una uña" />
            </label>
            <label className="block text-xs text-[var(--color-text-muted)]">Descripción
              <textarea className="input-field mt-1 resize-none text-sm" rows={2} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="block text-xs text-[var(--color-text-muted)]">Precio por uña ($)
              <input className="input-field mt-1 text-sm" type="number" min="0.01" step="0.01" value={draft.pricePerNail || ''} onChange={event => setDraft(current => ({ ...current, pricePerNail: Number(event.target.value) || 0 }))} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">
              <Upload size={15} /> {processingImage ? 'Comprimiendo imagen...' : (preview ? 'Cambiar foto' : 'Subir foto')}
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage} onChange={event => { void selectImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            </label>
            {preview && <img src={preview} alt="Vista previa" className="h-36 w-full rounded-lg object-cover" />}
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))} /> Disponible para las clientas
            </label>
            {error && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={() => void save()} disabled={saving || processingImage}><Check size={15} /> {saving ? 'Guardando en Firestore...' : processingImage ? 'Comprimiendo imagen...' : 'Guardar'}</button>
              <button className="btn-secondary flex-1 justify-center" onClick={() => { setModalOpen(false); setEditId(null); setPreview(''); setDraft(emptyDraft); setError(''); }}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {deletingId && (
        <Modal title="Eliminar especializado" onClose={() => setDeletingId(null)} size="sm">
          <p className="mb-5 text-sm text-[var(--color-text-muted)]">¿Eliminar este servicio especializado del catálogo?</p>
          <div className="flex gap-3">
            <button className="btn-primary flex-1 justify-center" onClick={() => void remove(deletingId)}>Eliminar</button>
            <button className="btn-secondary flex-1 justify-center" onClick={() => setDeletingId(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
