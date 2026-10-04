import { useEffect, useState } from 'react';
import { ArrowUpRight, Calendar, Clock, Star, Phone, MapPin, ChevronRight, Sparkles, Camera, MessageCircle, ShieldCheck, Gem, Users } from 'lucide-react';
import { BUSINESS_SETTINGS, GALLERY_PHOTOS, SERVICES, getNextAvailableDays } from '../data';
import type { BranchId, Page, Role } from '../types';

interface Props {
  setPage: (p: Page) => void;
  role: Role;
  setBookingService?: (s: any) => void;
  branchId: BranchId;
  onSelectBranch: (branchId: BranchId) => void;
};

const SCHEDULE = [
  { day: 'Lunes – Viernes', hours: '09:00–19:00' },
  { day: 'Sábado', hours: '09:00–17:00' },
  { day: 'Domingo', hours: 'Bajo disposición' },
];

export function HomePage({ setPage, role, setBookingService, branchId, onSelectBranch }: Props) {
  const isNorthBranch = branchId === 'north';
  const northSettings = BUSINESS_SETTINGS.secondaryBranch;
  const branchName = isNorthBranch ? northSettings?.businessName || 'Sucursal Norte' : BUSINESS_SETTINGS.businessName;
  const branchTagline = isNorthBranch ? northSettings?.tagline || BUSINESS_SETTINGS.tagline : BUSINESS_SETTINGS.tagline;
  const branchPhone = isNorthBranch ? northSettings?.phone || BUSINESS_SETTINGS.phone : BUSINESS_SETTINGS.phone;
  const branchEmail = isNorthBranch ? northSettings?.email || BUSINESS_SETTINGS.email : BUSINESS_SETTINGS.email;
  const branchAddress = isNorthBranch ? northSettings?.address || 'Configura la dirección de esta sucursal' : BUSINESS_SETTINGS.address;
  const branchInstagram = isNorthBranch ? northSettings?.instagram || BUSINESS_SETTINGS.instagram : BUSINESS_SETTINGS.instagram;
  const branchFacebook = isNorthBranch ? northSettings?.facebook || BUSINESS_SETTINGS.facebook : BUSINESS_SETTINGS.facebook;
  const branchWhatsapp = isNorthBranch ? northSettings?.whatsapp || BUSINESS_SETTINGS.whatsapp : BUSINESS_SETTINGS.whatsapp;
  const branchLatitude = isNorthBranch ? northSettings?.latitude : BUSINESS_SETTINGS.latitude;
  const branchLongitude = isNorthBranch ? northSettings?.longitude : BUSINESS_SETTINGS.longitude;
  const featured = SERVICES.filter(service => service.active && service.featured).slice(0, 6);
  const hasCoordinates = Boolean(branchLatitude && branchLongitude);
  const mapQuery = hasCoordinates
    ? `${branchLatitude},${branchLongitude}`
    : branchAddress;
  const defaultDuration = SERVICES.find(service => service.active)?.duration || 60;
  const [nextSlots, setNextSlots] = useState(() => getNextAvailableDays(defaultDuration, 3, branchId));

  useEffect(() => {
    const refresh = () => setNextSlots(getNextAvailableDays(defaultDuration, 3, branchId));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [defaultDuration, SERVICES.length, BUSINESS_SETTINGS.appointmentDuration, branchId]);

  return (
    <div className="space-y-0 bg-[#080708]">
      <section className="relative min-h-[560px] overflow-hidden bg-[#0D0B0C]">
        <img
          src="https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1600&h=1000&fit=crop&auto=format"
          alt="Manos con uñas cuidadas y diseño elegante"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#111012_0%,rgba(17,16,18,.98)_30%,rgba(17,16,18,.74)_46%,rgba(8,7,8,.2)_68%,transparent_84%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080708]/90 via-[#080708]/35 to-transparent" />

        <div className="relative z-10 mx-auto min-h-[560px] max-w-[1400px] px-5 pb-16 sm:px-8 lg:px-11">
          <nav className="flex min-h-[72px] items-center justify-between gap-4 border-b border-white/10 text-white/80">
            <button className="flex shrink-0 items-center gap-3 text-left" onClick={() => setPage('home')} aria-label="Loto, ir al inicio">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-primary)]/60">
                <Sparkles size={16} />
              </span>
              <span className="text-[10px] font-600 uppercase tracking-[0.12em] sm:text-xs">Loto Nails &amp; Spa</span>
            </button>
            <span className="hidden flex-1 text-center text-[10px] uppercase tracking-[0.12em] text-white/80 md:block">
              Selecciona tu sucursal para empezar
            </span>
            <div className="hidden shrink-0 items-center gap-4 text-[10px] uppercase tracking-[0.12em] sm:flex sm:gap-5 lg:gap-8">
              <button className="transition-colors hover:text-white" onClick={() => setPage('home')}>Inicio</button>
              <button className="transition-colors hover:text-white" onClick={() => setPage('catalog')}>Servicios</button>
              <button className="transition-colors hover:text-white" onClick={() => document.getElementById('about-loto')?.scrollIntoView({ behavior: 'smooth' })}>Nosotros</button>
              <button
                className="rounded border border-white/50 px-4 py-2 transition-colors hover:border-[var(--color-primary)]"
                onClick={() => setPage('booking')}
              >
                Reservar
              </button>
            </div>
          </nav>

          <div className="grid gap-8 pb-24 pt-5 md:grid-cols-[minmax(0,.78fr)_minmax(430px,1.22fr)] md:gap-8 md:pt-6">
            <div className="pt-1 md:pt-5">
              <p className="mb-5 text-xs font-700 uppercase tracking-[0.2em] text-[var(--color-primary)] sm:text-sm">
                Belleza al alcance de tus manos
              </p>
              <h1 className="text-[clamp(2.8rem,5.8vw,5.2rem)] font-500 leading-[.8] tracking-[-.035em] text-[#FFFDFC]" style={{ fontFamily: 'var(--font-display)' }}>
                UÑAS QUE<br /><em className="font-400 text-[var(--color-primary)]">Empoderan.</em>
              </h1>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/65 sm:text-base">
                {branchTagline}. Cuidado experto para tu belleza natural.
              </p>
            </div>

            <div>
              <div className="rounded-2xl border border-white/15 bg-[#242326]/90 p-4 shadow-lg backdrop-blur-sm sm:p-5">
                <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
                  {([
                    {
                      id: 'main' as const,
                      title: BUSINESS_SETTINGS.businessName || 'Sucursal Principal',
                      description: 'Experiencia Loto exclusiva y servicios premium',
                    },
                    {
                      id: 'north' as const,
                      title: northSettings?.businessName || 'Sucursal Norte',
                      description: 'Nuevas instalaciones y técnicas de vanguardia',
                    },
                  ]).map(branch => {
                    const selected = branch.id === branchId;
                    return (
                      <div
                        key={branch.id}
                        className="flex min-h-[180px] min-w-0 flex-col rounded-xl border p-4 transition-colors sm:min-h-[195px] sm:p-5"
                        style={{
                          borderColor: selected ? 'var(--color-primary)' : 'rgba(255,255,255,.16)',
                          backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 9%, transparent)' : 'rgba(255,255,255,.025)',
                        }}
                      >
                        <div className="flex min-h-14 items-center justify-center gap-2 text-center">
                          <MapPin size={22} className="shrink-0 text-[var(--color-primary)]" />
                          <h3 className="text-lg font-500 leading-tight text-white sm:text-xl" style={{ fontFamily: 'var(--font-display)' }}>
                            {branch.title}
                          </h3>
                        </div>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onSelectBranch(branch.id)}
                          className="mt-3 rounded-lg border border-white/25 bg-black/35 px-3 py-2.5 text-sm font-600 text-white/85 transition hover:border-[var(--color-primary)] hover:bg-black/55"
                        >
                          {selected ? 'Sucursal seleccionada' : 'Seleccionar esta sucursal'}
                        </button>
                        <p className="mt-3 text-center text-xs leading-relaxed text-white/60 sm:text-sm">
                          {branch.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 left-5 right-5 z-10 grid grid-cols-1 gap-3 text-[9px] uppercase tracking-[0.06em] text-white/75 sm:left-8 sm:right-auto sm:grid-cols-3 sm:gap-5 lg:left-11">
            <span className="flex items-center gap-1.5"><Gem size={14} className="shrink-0 text-[var(--color-primary)]" />Productos premium</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="shrink-0 text-[var(--color-primary)]" />Higiene y seguridad</span>
            <span className="flex items-center gap-1.5"><Users size={14} className="shrink-0 text-[var(--color-primary)]" />Técnicas expertas</span>
          </div>
        </div>
      </section>

      <section id="about-loto" className="bg-[#111012] text-white px-6 sm:px-10 lg:px-16 py-16 lg:py-20">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[.8fr_1.2fr] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[#D99A9F] text-xs font-700 tracking-[0.2em] uppercase mb-4">Te damos la bienvenida a {branchName}</p>
            <h2 className="text-5xl sm:text-6xl font-500 leading-[.88]" style={{ fontFamily: 'var(--font-display)' }}>BELLEZA. CUIDADO.<br /><span className="text-[#D99A9F]">CONFIANZA.</span></h2>
            <p className="text-white/60 text-sm leading-7 max-w-md mt-6">Creamos una pausa hermosa en tu día: productos seleccionados, herramientas impecables y manos expertas para que cada visita se sienta especial.</p>
            <p className="text-[#D99A9F] text-2xl mt-6" style={{ fontFamily: 'var(--font-display)' }}>Date un gusto ♡</p>
          </div>
          <img className="w-full h-[300px] lg:h-[370px] object-cover rounded-sm" src="https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&h=700&fit=crop&auto=format" alt="Interior elegante del salón" />
        </div>
      </section>

      {/* Featured services */}
      <section className="bg-[#111012] px-6 sm:px-10 lg:px-16 py-16">
        <div className="max-w-[1400px] mx-auto grid xl:grid-cols-[300px_minmax(0,1fr)] gap-12 xl:items-end">
          <div>
          <h2 className="text-4xl sm:text-5xl font-500 leading-[.86] text-[#2B1D1E]" style={{ fontFamily: 'var(--font-display)' }}>SERVICIOS<br /><span className="text-[#B96F72]">QUE NOS</span><br />DISTINGUEN</h2>
          <button className="btn-ghost text-sm text-[#E8778A]" onClick={() => setPage('catalog')}>
            Explorar servicios <ArrowUpRight size={14} />
          </button>
        </div>
        {featured.length === 0 ? (
          <div className="card p-6 text-sm text-[#6B5A5E]">No hay servicios destacados activos por el momento.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {featured.map(service => (
              <div key={service.id} className="bg-white overflow-hidden group cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all"
                onClick={() => { if (setBookingService) setBookingService(service); setPage('booking'); }}>
                <div className="h-48 overflow-hidden bg-[#F5EDE6]">
                  <img src={service.image} alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="p-4">
                  <h3 className="font-600 text-[#1A1012] text-sm mb-1">{service.name}</h3>
                  <p className="text-xs text-[#6B5A5E] mb-3 line-clamp-2 leading-relaxed">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-700 text-[#C1536A] text-base">${service.price}</span>
                    <span className="text-xs text-[#BBA9AD] flex items-center gap-1">
                      <Clock size={11} /> {service.duration} min
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0D0B0C] text-white px-6 sm:px-10 lg:px-16 py-20">
        <div className="absolute right-0 inset-y-0 w-1/2 opacity-45"><img className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=1000&h=700&fit=crop&auto=format" alt="Esmalte rosa y flores" /><div className="absolute inset-0 bg-gradient-to-r from-[#0D0B0C] to-transparent" /></div>
        <div className="relative max-w-[1400px] mx-auto">
          <p className="text-[#D99A9F] text-xs font-700 tracking-[.24em] uppercase">¿Lista para brillar?</p>
          <h2 className="text-5xl sm:text-6xl font-500 leading-[.88] mt-4" style={{ fontFamily: 'var(--font-display)' }}>RESERVA TU<br /><span className="text-[#D99A9F]">CITA HOY</span></h2>
          <p className="text-white/65 text-sm mt-5">Disfruta un momento de lujo y sal sintiéndote radiante.</p>
          <button className="btn-primary !text-[#211719] !rounded-none mt-7" onClick={() => setPage('booking')}>Reservar ahora <ArrowUpRight size={16} /></button>
        </div>
      </section>

      {/* Next available slots */}
      <section>
        <h2 className="text-xl font-700 text-[#1A1012] mb-5" style={{ fontFamily: 'var(--font-display)' }}>
          Próximos horarios disponibles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {nextSlots.map(slot => (
            <div key={slot.date} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  {slot.label && <div className="text-xs font-600 text-[#E8778A] uppercase tracking-wide mb-0.5">{slot.label}</div>}
                  <div className="text-sm font-600 text-[#1A1012] capitalize">{slot.day}</div>
                </div>
                <Calendar size={16} className="text-[#BBA9AD]" />
              </div>
              <div className="flex flex-wrap gap-2">
                {slot.times.map(t => (
                  <button key={t} className="time-slot text-xs py-1.5 px-3"
                    onClick={() => setPage('booking')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {nextSlots.length === 0 && <div className="card p-6 text-sm text-[#6B5A5E]">No hay horarios disponibles próximamente.</div>}
      </section>

      {/* Gallery preview */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>
            Galería
          </h2>
          {role === 'admin' && (
            <button className="btn-ghost text-sm text-[#E8778A]" onClick={() => setPage('admin-gallery')}>
              Administrar →
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {GALLERY_PHOTOS.map(photo => (
            <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-[#F5EDE6] group cursor-pointer">
              <img src={photo.url} alt={photo.alt}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
            </div>
          ))}
        </div>
      </section>

      {/* Info: schedule + contact */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] flex items-center justify-center">
              <Clock size={18} className="text-[#E8778A]" />
            </div>
            <h3 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Horarios de atención</h3>
          </div>
          <div className="space-y-3">
            {SCHEDULE.map((s, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-[#F5EDE6] last:border-0">
                <span className="text-sm font-500 text-[#3D2A2F]">{s.day}</span>
                <span className={`text-sm font-600 ${s.hours === 'Cerrado' ? 'text-[#BBA9AD]' : 'text-[#C1536A]'}`}>
                  {s.hours}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] flex items-center justify-center">
              <Phone size={18} className="text-[#E8778A]" />
            </div>
            <h3 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Contáctanos</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-[#E8778A] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-[#BBA9AD] font-500">Teléfono / WhatsApp</div>
                <div className="text-sm font-600 text-[#1A1012]">{branchPhone}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-[#E8778A] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-[#BBA9AD] font-500">Dirección</div>
                <div className="text-sm font-600 text-[#1A1012]">{branchAddress}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star size={16} className="text-[#E8778A] mt-0.5 flex-shrink-0" />
              <div className="w-full">
                <div className="text-xs text-[#BBA9AD] font-500 mb-2">Redes sociales</div>
                <div className="flex items-center gap-2">
                  <a href={`https://instagram.com/${branchInstagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#F5EDE6] bg-[#FFF1F3] text-[#C1536A] hover:shadow-sm transition-all" aria-label="Instagram">
                    <Camera size={16} />
                  </a>
                  <a href={`https://facebook.com/${branchFacebook.replace(/^https?:\/\/|www\./i, '').replace(/\//g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#F5EDE6] bg-[#FFF1F3] text-[#C1536A] hover:shadow-sm transition-all" aria-label="Facebook">
                    <span className="text-sm font-800 leading-none">f</span>
                  </a>
                  <a href={`https://wa.me/${branchWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#F5EDE6] bg-[#FFF1F3] text-[#C1536A] hover:shadow-sm transition-all" aria-label="WhatsApp">
                    <MessageCircle size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] flex items-center justify-center">
              <MapPin size={18} className="text-[#E8778A]" />
            </div>
            <div>
              <h3 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Ubicación</h3>
              <p className="text-sm text-[#6B5A5E]">{branchAddress}</p>
            </div>
          </div>
        </div>
        <iframe
          title="Mapa de la dirección del negocio"
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
          className="w-full h-72 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {hasCoordinates && (
          <a className="block px-6 py-3 text-sm text-[#C1536A] hover:underline" target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}>
            Abrir esta ubicación en Google Maps
          </a>
        )}
      </section>

      <footer className="bg-[#111012] text-white px-6 sm:px-10 lg:px-16 py-12">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 rounded-full border border-[#D99A9F] flex items-center justify-center"><Sparkles size={15} className="text-[#D99A9F]" /></div><span className="font-600 tracking-[0.12em] uppercase text-sm">{branchName}</span></div>
            <p className="text-white/55 text-sm leading-6">{branchTagline}.</p>
          </div>
          <div>
            <div className="text-[#D99A9F] text-xs tracking-[0.18em] uppercase mb-4">Navegación</div>
            <div className="flex flex-col items-start gap-2 text-sm text-white/65"><button onClick={() => setPage('home')}>Inicio</button><button onClick={() => setPage('catalog')}>Servicios</button><button onClick={() => setPage('booking')}>Reservar cita</button></div>
          </div>
          <div>
            <div className="text-[#D99A9F] text-xs tracking-[0.18em] uppercase mb-4">Contacto</div>
            <div className="space-y-2 text-sm text-white/65"><p>{branchPhone}</p><p>{branchEmail}</p><p>{branchAddress}</p></div>
          </div>
          <div>
            <div className="text-[#D99A9F] text-xs tracking-[0.18em] uppercase mb-4">Horarios</div>
            <div className="space-y-2 text-sm text-white/65">{SCHEDULE.map(schedule => <p key={schedule.day} className="flex justify-between gap-4"><span>{schedule.day}</span><span>{schedule.hours}</span></p>)}</div>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto border-t border-white/10 mt-10 pt-5 text-xs text-white/35 flex flex-wrap justify-between gap-3"><span>© {new Date().getFullYear()} {branchName}</span><span>Una experiencia creada con detalle.</span></div>
      </footer>
    </div>
  );
}
