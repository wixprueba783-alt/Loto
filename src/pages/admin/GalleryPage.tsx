import { useState } from 'react';
import { Check, Edit2, Upload, Trash2, GripVertical, X } from 'lucide-react';
import { GALLERY_PHOTOS, SERVICES, addGalleryPhotoFS, deleteGalleryPhotoFS, updateGalleryPhotoFS, updateGalleryPhotoOrderFS } from '../../data';
import type { GalleryPhoto } from '../../types';

export function AdminGalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(GALLERY_PHOTOS);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newService, setNewService] = useState('');
  const [newAlt, setNewAlt] = useState('');
  const [imageError, setImageError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState('');
  const [editingService, setEditingService] = useState('');

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
      setNewUrl(String(reader.result));
      setImageError('');
    };
    reader.readAsDataURL(file);
  }

  function addPhoto() {
    if (!newUrl) return;
    const photo: GalleryPhoto = {
      id: `g${Date.now()}`,
      url: newUrl,
      serviceId: newService || undefined,
      alt: newAlt || 'Fotografía',
      order: photos.length + 1,
    };
    setPhotos(prev => [...prev, photo]);
    addGalleryPhotoFS(photo);
    setNewUrl('');
    setNewService('');
    setNewAlt('');
    setImageError('');
  }

  function deletePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id));
    deleteGalleryPhotoFS(id);
  }

  function startEdit(photo: GalleryPhoto) {
    setEditingId(photo.id);
    setEditingAlt(photo.alt);
    setEditingService(photo.serviceId || '');
  }

  async function saveEdit(photo: GalleryPhoto) {
    const changes = { alt: editingAlt.trim() || 'Fotografía', serviceId: editingService || undefined };
    await updateGalleryPhotoFS(photo.id, changes);
    setPhotos(current => current.map(item => item.id === photo.id ? { ...item, ...changes } : item));
    setEditingId(null);
  }

  function replacePhoto(photo: GalleryPhoto, file?: File) {
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      await updateGalleryPhotoFS(photo.id, { url });
      setPhotos(current => current.map(item => item.id === photo.id ? { ...item, url } : item));
    };
    reader.readAsDataURL(file);
  }

  function handleDragStart(i: number) { setDragIdx(i); }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const updated = [...photos];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(i, 0, moved);
    setPhotos(updated.map((p, idx) => ({ ...p, order: idx + 1 })));
    setDragIdx(i);
  }
  function handleDragEnd() {
    setDragIdx(null);
    updateGalleryPhotoOrderFS(photos);
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="card p-6">
        <h3 className="font-700 text-[#1A1012] mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <Upload size={18} className="text-[#E8778A]" /> Agregar fotografía
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Fotografía</label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[#EDD9CC] rounded-xl p-2.5 hover:bg-[#FDFAF9] transition-colors">
              <Upload size={15} className="text-[#E8778A]" />
              <span className="text-sm text-[#6B5A5E]">Elegir desde el dispositivo</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={e => handleImageChange(e.target.files?.[0])}
              />
            </label>
            {imageError && <p className="text-xs text-red-500 mt-1.5">{imageError}</p>}
          </div>
          <div>
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Servicio asociado</label>
            <select className="input-field text-sm" value={newService} onChange={e => setNewService(e.target.value)}>
              <option value="">Sin asociar</option>
              {SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <input className="input-field text-sm flex-1" placeholder="Descripción / alt text"
            value={newAlt} onChange={e => setNewAlt(e.target.value)} />
          <button className="btn-primary flex-shrink-0" onClick={addPhoto} disabled={!newUrl}>
            <Upload size={15} /> Agregar
          </button>
        </div>

        {/* Unsplash preview */}
        {newUrl && (
          <div className="mt-4">
            <p className="text-xs text-[#BBA9AD] mb-2">Vista previa:</p>
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#F5EDE6]">
              <img src={newUrl} alt="preview" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=200&h=200&fit=crop'; }} />
            </div>
          </div>
        )}
      </div>

      {/* Gallery grid */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>
            Galería ({photos.length} fotos)
          </h3>
          <p className="text-xs text-[#BBA9AD]">Arrastra para reordenar</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, i) => {
            const service = SERVICES.find(s => s.id === photo.serviceId);
            return (
              <div key={photo.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`relative group rounded-xl overflow-hidden bg-[#F5EDE6] cursor-grab active:cursor-grabbing border-2 transition-all ${dragIdx === i ? 'border-[#E8778A] opacity-60' : 'border-transparent'}`}
                style={{ aspectRatio: '1' }}>
                <img src={photo.url} alt={photo.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button className="btn-ghost bg-white/90 p-2 rounded-lg" title="Editar" onClick={() => startEdit(photo)}>
                    <Edit2 size={14} className="text-[#8D5B58]" />
                  </button>
                  <label className="btn-ghost bg-white/90 p-2 rounded-lg cursor-pointer" title="Reemplazar imagen">
                    <Upload size={14} className="text-[#8D5B58]" />
                    <input type="file" accept="image/*" className="hidden" onChange={event => replacePhoto(photo, event.target.files?.[0])} />
                  </label>
                  <button className="btn-ghost bg-white/90 p-2 rounded-lg" title="Eliminar" onClick={() => deletePhoto(photo.id)}>
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
                <div className="absolute top-1.5 left-1.5">
                  <GripVertical size={14} className="text-white/60" />
                </div>
                {service && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white text-[10px] font-600 truncate">{service.name}</p>
                  </div>
                )}
                {editingId === photo.id && (
                  <div className="absolute inset-x-2 bottom-2 z-10 rounded-lg bg-white p-2 shadow-lg" onClick={event => event.stopPropagation()}>
                    <input className="input-field text-xs mb-2" value={editingAlt} onChange={event => setEditingAlt(event.target.value)} placeholder="Descripción" />
                    <select className="input-field text-xs mb-2" value={editingService} onChange={event => setEditingService(event.target.value)}>
                      <option value="">Sin asociar</option>
                      {SERVICES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => setEditingId(null)}><X size={14} /></button>
                      <button className="btn-primary p-1.5" onClick={() => saveEdit(photo)}><Check size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {photos.length === 0 && (
          <div className="text-center py-12 text-[#BBA9AD]">
            <Upload size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay fotografías en la galería</p>
          </div>
        )}
      </div>
    </div>
  );
}
