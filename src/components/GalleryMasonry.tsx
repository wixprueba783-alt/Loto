import { useState } from 'react';
import { GALLERY_PHOTOS } from '../data';

export function GalleryMasonry() {
  const [selected, setSelected] = useState<any>(null);
  const photos = [...GALLERY_PHOTOS].sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
        {photos.map(photo => (
          <div
            key={photo.id}
            onClick={() => setSelected(photo)}
            className="break-inside-avoid mb-4 rounded-2xl overflow-hidden bg-white shadow-sm cursor-pointer transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-xl hover:brightness-105 group"
          >
            <img src={photo.url} alt={photo.alt} className="w-full object-cover" />
            <div className="p-3">
              <p className="text-xs text-[#6B5A5E] group-hover:text-[#C1536A] transition-colors">{photo.alt}</p>
            </div>
          </div>
        ))}
        {photos.length === 0 && (
          <div className="text-center py-16 text-[#BBA9AD] col-span-full">No hay fotografías en la galería</div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden grid grid-cols-1 md:grid-cols-2" onClick={e => e.stopPropagation()}>
            <div className="bg-[#F5EDE6] flex items-center justify-center">
              <img src={selected.url} alt={selected.alt} className="w-full h-full object-contain max-h-[90vh]" />
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>{selected.alt}</h2>
                <button className="btn-ghost p-2" onClick={() => setSelected(null)}>✕</button>
              </div>
              <p className="text-sm text-[#6B5A5E]">Por Loto Nails & Spa</p>
              <p className="text-sm text-[#3D2A2F] leading-relaxed">
                {selected.alt}. Reserva tu cita y luce increíble.
                <button className="text-[#C1536A] ml-1 font-600">Ver más</button>
              </p>
              <div className="flex gap-3 pt-2">
                <button className="btn-ghost p-2">❤️</button>
                <button className="btn-ghost p-2">🔗</button>
                <button className="btn-ghost p-2">🔖</button>
              </div>
              <div>
                <h3 className="font-600 text-[#1A1012] mb-3">Recomendaciones</h3>
                <div className="grid grid-cols-3 gap-2">
                  {photos.filter(p => p.id !== selected.id).slice(0, 6).map(p => (
                    <div key={p.id} onClick={() => setSelected(p)} className="rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg">
                      <img src={p.url} alt={p.alt} className="w-full aspect-square object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
