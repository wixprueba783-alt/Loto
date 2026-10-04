import { useEffect, useState } from 'react';
import { Check, Clock, Calendar, ChevronRight, ChevronLeft, Banknote, CreditCard, ArrowLeft, Minus, Plus } from 'lucide-react';
import { SERVICES, SERVICE_SUBSERVICES, BLOCKED_DAYS, MONTHS, WEEKDAYS, getAvailableTimes, getAvailability, refreshBusySlots } from '../data';
import type { Page, Service, Role, PaymentMethod, BranchId, Appointment } from '../types';

interface Props {
  setPage: (p: Page) => void;
  role: Role;
  user?: { name: string; email: string; phone: string } | null;
  initialService?: Service;
  branchId: BranchId;
  onConfirm: (appt: {
    service: Service;
    services: Service[];
    date: string;
    time: string;
    contact: { name: string; email: string; phone: string };
    payments: Appointment['payments'];
    total: number;
    subservices: NonNullable<Appointment['subservices']>;
    duration: number;
    paymentProof?: string;
  }) => Promise<void>;
}

const STEPS = ['Servicios principales', 'Servicio especializado', 'Fecha', 'Hora', 'Datos', 'Pago'];

export function BookingPage({ setPage, role, user, initialService, branchId, onConfirm }: Props) {
  const [step, setStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<Service[]>(initialService ? [initialService] : []);
  const service = selectedServices[0] ?? null;
  const [selectedSubservices, setSelectedSubservices] = useState<Record<string, number>>({});
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [contact, setContact] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: string }[]>([{ method: 'cash', amount: initialService ? String(initialService.price) : '0' }]);
  const [proofFile, setProofFile] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [, setClock] = useState(Date.now());
  const [busySlotsLoading, setBusySlotsLoading] = useState(false);
  const [busySlotsError, setBusySlotsError] = useState('');
  const [busySlotsRefreshVersion, setBusySlotsRefreshVersion] = useState(0);
  const [verifiedBusySlotsKey, setVerifiedBusySlotsKey] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setBusySlotsLoading(true);
    setBusySlotsError('');
    setVerifiedBusySlotsKey('');
    refreshBusySlots(selectedDate)
      .then(() => {
        if (!cancelled) setVerifiedBusySlotsKey(`${branchId}:${selectedDate}`);
      })
      .catch(error => {
        console.error(`No se pudieron actualizar los horarios ocupados del ${selectedDate}:`, error);
        if (!cancelled) setBusySlotsError('No se pudieron verificar las reservas de este día. Intenta de nuevo.');
      })
      .finally(() => {
        if (!cancelled) setBusySlotsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate, branchId, busySlotsRefreshVersion]);

  const selectedPaymentMethod = payments[0]?.method ?? 'cash';
  const selectedAddOns = SERVICE_SUBSERVICES.filter(subservice => subservice.active)
    .filter(subservice => (selectedSubservices[subservice.id] ?? 0) > 0)
    .map(subservice => ({
      id: subservice.id,
      name: subservice.name,
      pricePerNail: subservice.pricePerNail,
      quantity: selectedSubservices[subservice.id],
    }));
  const addOnsTotal = selectedAddOns.reduce((sum, subservice) => sum + subservice.pricePerNail * subservice.quantity, 0);
  const servicesTotal = selectedServices.reduce((sum, selected) => sum + selected.price, 0);
  const bookingDuration = selectedServices.reduce((sum, selected) => sum + selected.duration, 0);
  const bookingTotal = Math.round(((servicesTotal + addOnsTotal + Number.EPSILON) * 100)) / 100;

  // Calendar helpers
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const isBlocked = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return BLOCKED_DAYS.some(b => b.date === dateStr && (b.branchId ?? 'main') === branchId);
  };
  const isPast = (d: number) => {
    const current = new Date();
    const selected = new Date(year, month, d);
    const startOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    return selected < startOfToday;
  };
  const noAvailabilityMessage = 'Lo sentimos, no hay horarios disponibles para este día. Por favor intenta con otro día. Gracias';

  const busySlotsVerified = verifiedBusySlotsKey === `${branchId}:${selectedDate}`;
  const availableTimes = service && selectedDate && busySlotsVerified && !busySlotsLoading && !busySlotsError
    ? getAvailableTimes(selectedDate, bookingDuration, branchId)
    : [];

  useEffect(() => {
    setPayments(current => current.map(payment => ({ ...payment, amount: String(bookingTotal) })));
  }, [bookingTotal]);

  function updatePayment(i: number, field: 'method' | 'amount', val: string) {
    setPayments(current => current.map((p, idx) => {
      if (idx !== i) return p;
      if (field === 'amount') return { ...p, amount: String(bookingTotal) };
      return { ...p, method: val as PaymentMethod, amount: String(bookingTotal) };
    }));
  }

  async function handleConfirm() {
    if (!service || bookingSubmitting) return;
    setBookingSubmitting(true);
    setBookingError('');
    const appt = {
      service, services: selectedServices, duration: bookingDuration, date: selectedDate, time: selectedTime,
      contact, payments: [],
      total: bookingTotal,
      subservices: selectedAddOns,
      paymentProof: role === 'admin' && selectedPaymentMethod === 'transfer' ? proofFile || undefined : undefined,
    };
    try {
      await onConfirm(appt);
      setConfirmed(true);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'No se pudo reservar ese horario. Elige otra hora.');
    } finally {
      setBookingSubmitting(false);
    }
  }

  if (confirmed && service) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}>
            <Check size={28} color="#1A1316" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-700 text-[#1A1012] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            ¡Cita enviada!
          </h2>
          <p className="text-sm text-[#6B5A5E] mb-6 leading-relaxed">
            Tu cita ha sido enviada correctamente y está <strong>pendiente de confirmación</strong>.
            Te notificaremos por correo electrónico.
          </p>
          <div className="bg-[#FFF1F3] rounded-xl p-4 text-left space-y-2.5 mb-6">
            {selectedServices.map(selected => <Row key={selected.id} label={selected.name} value={`$${selected.price.toFixed(2)}`} />)}
            {selectedAddOns.map(addOn => (
              <Row
                key={addOn.id}
                label={`${addOn.name} · ${addOn.quantity} ${addOn.quantity === 1 ? 'uña' : 'uñas'}`}
                value={`$${(addOn.pricePerNail * addOn.quantity).toFixed(2)}`}
              />
            ))}
            <Row label="Fecha" value={formatDate(selectedDate)} />
            <Row label="Hora" value={selectedTime} />
            <Row label="Duración" value={`${bookingDuration} min`} />
            <Row label="Total" value={`$${bookingTotal.toFixed(2)}`} />
            <Row label="Pago" value={payments.map(p => `${methodLabel(p.method)}: $${p.amount || 0}`).join(' + ')} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#6B5A5E]">Estado</span>
              <span className="text-xs font-600 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pendiente</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1 justify-center" onClick={() => setPage('home')}>
              Volver al inicio
            </button>
            {role !== 'guest' && (
              <button className="btn-primary flex-1 justify-center" onClick={() => setPage('my-appointments')}>
                Ver cita
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`step-indicator ${i < step ? 'step-done' : i === step ? 'step-active' : 'step-inactive'}`}>
                {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <span className={`text-xs font-600 hidden sm:block ${i === step ? 'text-[#C1536A]' : i < step ? 'text-[#6B5A5E]' : 'text-[#BBA9AD]'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px mx-3 flex-shrink-0 ${i < step ? 'bg-[#C1536A]' : 'bg-[#EDD9CC]'}`} style={{ width: 24 }} />
            )}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {/* Step 0: Service */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-700 text-[#1A1012] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              ¿Qué servicio deseas?
            </h2>
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">Puedes elegir varios servicios. El precio y el tiempo se suman automáticamente.</p>
            <h3 className="mb-3 text-sm font-700 text-[var(--color-text)]">Selecciona uno o más servicios</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICES.filter(s => s.active).map(s => (
                <button key={s.id}
                  aria-pressed={selectedServices.some(selected => selected.id === s.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${selectedServices.some(selected => selected.id === s.id) ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]' : 'border-[var(--color-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-muted)]'}`}
                  onClick={() => {
                    const next = selectedServices.some(selected => selected.id === s.id)
                      ? selectedServices.filter(selected => selected.id !== s.id)
                      : [...selectedServices, s];
                    setSelectedServices(next);
                    const nextTotal = next.reduce((sum, selected) => sum + selected.price, 0) + addOnsTotal;
                    setPayments(current => current.map(payment => ({ ...payment, amount: String(nextTotal) })));
                  }}>
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-surface)] flex-shrink-0">
                      <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-600 text-sm text-[var(--color-text)]">{s.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] line-clamp-1 mt-0.5">{s.description}</div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-sm font-700 text-[var(--color-primary)]">${s.price}</span>
                        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1"><Clock size={11} />{s.duration} min</span>
                      </div>
                    </div>
                    {selectedServices.some(selected => selected.id === s.id) && (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#C1536A] flex items-center justify-center">
                        <Check size={12} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {service && (
              <div className="mt-5 flex flex-wrap justify-between gap-2 rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm">
                <span className="text-[var(--color-text-muted)]">{selectedServices.length} servicio(s) · {bookingDuration} min</span>
                <strong className="text-[var(--color-primary)]">${servicesTotal.toFixed(2)}</strong>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button className="btn-primary" disabled={!service} onClick={() => setStep(1)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Specialized services */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-700 text-[#1A1012] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Servicios especializados
            </h2>
            <p className="mb-5 text-sm text-[var(--color-text-muted)]">Elige los detalles que deseas. El precio se cobra por uña; indica cuántas uñas llevarán cada detalle.</p>
            <div className="space-y-3">
              {SERVICE_SUBSERVICES.filter(item => item.active).map(item => {
                const quantity = selectedSubservices[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    {item.image && <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-700 text-[var(--color-text)]">{item.name}</div>
                      {item.description && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{item.description}</p>}
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">${item.pricePerNail.toFixed(2)} por uña</div>
                    </div>
                    {quantity === 0 ? (
                      <button type="button" className="btn-secondary shrink-0 px-3 py-2 text-xs" onClick={() => setSelectedSubservices(current => ({ ...current, [item.id]: 1 }))}>Agregar</button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" aria-label={`Quitar una uña de ${item.name}`} className="btn-ghost rounded-full border border-[var(--color-border)] p-1.5" onClick={() => setSelectedSubservices(current => ({ ...current, [item.id]: Math.max(0, quantity - 1) }))}><Minus size={14} /></button>
                        <span className="min-w-14 text-center text-xs font-600 text-[var(--color-text)]">{quantity} {quantity === 1 ? 'uña' : 'uñas'}</span>
                        <button type="button" aria-label={`Agregar una uña de ${item.name}`} disabled={quantity >= 10} className="btn-ghost rounded-full border border-[var(--color-border)] p-1.5 disabled:opacity-40" onClick={() => setSelectedSubservices(current => ({ ...current, [item.id]: Math.min(10, quantity + 1) }))}><Plus size={14} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {SERVICE_SUBSERVICES.every(item => !item.active) && <p className="rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">No hay servicios especializados disponibles. Puedes continuar sin extras.</p>}
            <div className="mt-5 space-y-2 rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm">
              {selectedServices.map(item => <div key={item.id} className="flex justify-between"><span>{item.name}</span><span>${item.price.toFixed(2)}</span></div>)}
              {selectedAddOns.map(item => <div key={item.id} className="flex justify-between"><span>{item.name} × {item.quantity} {item.quantity === 1 ? 'uña' : 'uñas'}</span><span>${(item.pricePerNail * item.quantity).toFixed(2)}</span></div>)}
              <div className="flex justify-between border-t border-[var(--color-border)] pt-2 font-700"><span>Total</span><span>${bookingTotal.toFixed(2)}</span></div>
            </div>
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(0)}><ChevronLeft size={16} /> Atrás</button>
              <button className="btn-primary" onClick={() => setStep(2)}>Continuar <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* Step 2: Date */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-700 text-[#1A1012] mb-5" style={{ fontFamily: 'var(--font-display)' }}>
              Selecciona una fecha
            </h2>
            <div className="max-w-sm mx-auto">
              <div className="flex items-center justify-between mb-4">
                <button className="btn-ghost p-1.5" onClick={() => { if (month > 0) setMonth(m => m - 1); else { setMonth(11); setYear(y => y - 1); } }}>
                  <ChevronLeft size={18} />
                </button>
                <span className="font-600 text-[#1A1012]">{MONTHS[month]} {year}</span>
                <button className="btn-ghost p-1.5" onClick={() => { if (month < 11) setMonth(m => m + 1); else { setMonth(0); setYear(y => y + 1); } }}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-600 text-[#BBA9AD] py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(firstDay).fill(null).map((_, i) => <div key={i} />)}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const d = i + 1;
                  const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const blocked = isBlocked(d);
                  const past = isPast(d);
                  const sunday = new Date(year, month, d).getDay() === 0;
                  const availability = getAvailability(ds, branchId);
                  const disabled = blocked || past || (sunday && !availability.enabled);
                  const selected = ds === selectedDate;
                  const now = new Date();
                  const today = year === now.getFullYear() && month === now.getMonth() && d === now.getDate();
                  return (
                    <button key={d} disabled={disabled}
                      className={`calendar-day mx-auto ${selected ? 'selected' : ''} ${disabled ? (blocked ? 'blocked' : 'disabled') : ''} ${today && !selected ? 'today' : ''}`}
                      onClick={() => { if (!disabled) { setSelectedDate(ds); setSelectedTime(''); } }}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#6B5A5E]">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#F7F4F2] border border-[#EDD9CC] inline-block" />Bloqueado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-[#E8778A] inline-block" />Hoy</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: 'var(--color-primary)' }} />Seleccionado</span>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={16} /> Atrás</button>
              <button className="btn-primary" disabled={!selectedDate} onClick={() => setStep(3)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Time */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-700 text-[#1A1012] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Selecciona un horario
            </h2>
            <p className="text-sm text-[#6B5A5E] mb-5">{formatDate(selectedDate)}</p>
            {!busySlotsVerified && busySlotsLoading && <p className="text-sm text-[#BBA9AD] text-center py-5">Verificando horarios reservados...</p>}
            {busySlotsError && (
              <div role="alert" className="py-5 text-center">
                <p className="text-sm text-red-500">{busySlotsError}</p>
                <button className="btn-ghost mt-2 text-xs" onClick={() => setBusySlotsRefreshVersion(version => version + 1)}>Reintentar</button>
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {availableTimes.map(t => {
                return (
                  <button key={t}
                    className={`time-slot ${selectedTime === t ? 'selected' : ''}`}
                    onClick={() => setSelectedTime(t)}>
                    {t}
                  </button>
                );
              })}
            </div>
            {busySlotsVerified && !busySlotsLoading && !busySlotsError && availableTimes.length === 0 && <p className="text-sm text-[#BBA9AD] text-center py-5">{noAvailabilityMessage}</p>}
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(2)}><ChevronLeft size={16} /> Atrás</button>
              <button className="btn-primary" disabled={!selectedTime || !busySlotsVerified || busySlotsLoading || !!busySlotsError} onClick={() => setStep(4)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Contact data */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-700 text-[#1A1012] mb-5" style={{ fontFamily: 'var(--font-display)' }}>
              {role !== 'guest' ? 'Tus datos de contacto' : 'Ingresa tus datos'}
            </h2>
            {role !== 'guest' && (
              <div className="bg-[#FFF1F3] rounded-xl p-3 mb-4 text-xs text-[#C1536A] font-500 flex items-center gap-2">
                <Check size={14} />
                Datos cargados automáticamente desde tu perfil
              </div>
            )}
            <div className="space-y-4">
              {['name', 'email', 'phone'].map(field => (
                <div key={field}>
                  <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">
                    {field === 'name' ? 'Nombre completo' : field === 'email' ? 'Correo electrónico' : 'Teléfono'}
                  </label>
                  <input className="input-field" type={field === 'email' ? 'email' : 'text'}
                    placeholder={field === 'name' ? 'Sofía Martínez' : field === 'email' ? 'sofia@email.com' : '555-234-5678'}
                    value={contact[field as keyof typeof contact]}
                    onChange={e => setContact(c => ({ ...c, [field]: e.target.value }))}
                    readOnly={role !== 'guest' && !!user}
                    style={{ background: role !== 'guest' && user ? 'var(--color-surface)' : undefined }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(3)}><ChevronLeft size={16} /> Atrás</button>
              <button className="btn-primary"
                disabled={!contact.name || !contact.email || !contact.phone}
                onClick={() => setStep(5)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 5 && service && (
          <div>
            <h2 className="text-xl font-700 text-[#1A1012] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Método de pago
            </h2>
            <div className="bg-[#FFF1F3] rounded-xl p-4 mb-5 flex items-center justify-between">
              <span className="text-sm font-600 text-[#1A1012]">Total de la cita</span>
              <span className="text-xl font-700 text-[#C1536A]">${bookingTotal.toFixed(2)}</span>
            </div>

            <div className="border border-[#EDD9CC] rounded-xl p-4 space-y-3">
              <div className="text-sm font-600 text-[#1A1012]">Selecciona el método</div>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'transfer', 'card'] as PaymentMethod[]).map(m => (
                  <button key={m}
                    className={`payment-method-card flex flex-col items-center gap-1.5 py-3 ${selectedPaymentMethod === m ? 'selected' : ''}`}
                    onClick={() => updatePayment(0, 'method', m)}>
                    {m === 'cash' ? <Banknote size={18} className="text-[#6B5A5E]" /> :
                      m === 'transfer' ? <ArrowLeft size={18} className="text-[#6B5A5E]" style={{ transform: 'rotate(180deg)' }} /> :
                        <CreditCard size={18} className="text-[#6B5A5E]" />}
                    <span className="text-xs font-600">{methodLabel(m)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 p-4 bg-[#F7F4F2] rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B5A5E]">Total</span>
                <span className="font-700 text-[#1A1012]">${bookingTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B5A5E]">Método seleccionado</span>
                <span className="font-600 text-[#C1536A]">{methodLabel(selectedPaymentMethod)}</span>
              </div>
            </div>

            {role === 'admin' && selectedPaymentMethod === 'transfer' && (
              <div className="mt-4">
                <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Comprobante de transferencia</label>
                <input
                  className="input-field text-sm"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file || file.size > 900 * 1024) return;
                    const reader = new FileReader();
                    reader.onload = () => setProofFile(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
                <p className="text-xs text-[#BBA9AD] mt-1">Máximo 900 KB. Se enviará a la administradora.</p>
                {proofFile && <p className="text-xs text-emerald-600 mt-1">Comprobante adjuntado</p>}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(4)}><ChevronLeft size={16} /> Atrás</button>
              <button className="btn-primary" disabled={bookingSubmitting} onClick={handleConfirm}>
                <Check size={16} /> {bookingSubmitting ? 'Guardando...' : 'Apartar cita'}
              </button>
            </div>
            {bookingError && <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">{bookingError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-[#6B5A5E]">{label}</span>
      <span className="text-xs font-600 text-[#1A1012]">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-[#6B5A5E]">{label}</span>
      <span className="text-xs font-600 text-[#3D2A2F]">{value}</span>
    </div>
  );
}

function formatDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day} de ${MONTHS[parseInt(m) - 1]} de ${y}`;
}

function methodLabel(m: PaymentMethod) {
  return m === 'cash' ? 'Efectivo' : m === 'transfer' ? 'Transferencia' : 'Tarjeta';
}
