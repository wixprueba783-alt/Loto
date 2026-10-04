import { useState } from 'react';
import { Clock, Calendar, Search, Star } from 'lucide-react';
import { SERVICES, SERVICE_CATEGORIES } from '../data';
import type { Page, Service } from '../types';

interface Props {
  setPage: (p: Page) => void;
  setBookingService?: (s: Service) => void;
}

export function CatalogPage({ setPage, setBookingService }: Props) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Todos');
  const categories = ['Todos', ...SERVICE_CATEGORIES];

  const filtered = SERVICES.filter(s =>
    s.active &&
    (cat === 'Todos' || s.category === cat) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BBA9AD] pointer-events-none" />
          <input className="input-field search-field" placeholder="Buscar servicio..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c}
              className={`px-3 py-2 rounded-lg text-xs font-600 transition-all border ${cat === c
                ? 'bg-[#E8778A] text-white border-[#E8778A]'
                : 'bg-white text-[#6B5A5E] border-[#EDD9CC] hover:border-[#E8778A] hover:text-[#E8778A]'
              }`}
              onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(service => (
          <ServiceCard key={service.id} service={service}
            onBook={() => {
              if (setBookingService) setBookingService(service);
              setPage('booking');
            }} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[#BBA9AD]">
          <Search size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-500">No se encontraron servicios</p>
          <p className="text-sm mt-1">Intenta con otros términos de búsqueda</p>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service, onBook }: { service: Service; onBook: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card overflow-hidden group flex flex-col">
      <div className="relative h-48 overflow-hidden bg-[#F5EDE6]">
        <img src={service.image} alt={service.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-3 right-3">
          <span className="text-xs font-600 px-2.5 py-1 rounded-full bg-white/90 text-[#C1536A] shadow-sm">
            {service.category}
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-700 text-[#1A1012] text-base leading-tight">{service.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs text-[#6B5A5E] font-500">4.9</span>
          </div>
        </div>
        <p className={`text-sm text-[#6B5A5E] leading-relaxed mb-3 ${expanded ? '' : 'line-clamp-2'}`}>
          {service.description}
        </p>
        {service.description.length > 80 && (
          <button className="text-xs text-[#E8778A] font-500 mb-3 text-left" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
        )}
        <div className="flex items-center justify-between mb-4 mt-auto pt-3 border-t border-[#F5EDE6]">
          <span className="text-2xl font-700 text-[#C1536A]">${service.price}</span>
          <span className="flex items-center gap-1 text-xs text-[#6B5A5E] bg-[#F7F4F2] px-2.5 py-1 rounded-lg">
            <Clock size={12} /> {service.duration} min
          </span>
        </div>
        <button className="btn-primary w-full justify-center" onClick={onBook}>
          <Calendar size={15} /> Agendar
        </button>
      </div>
    </div>
  );
}
