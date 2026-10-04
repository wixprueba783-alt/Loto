import { useEffect, useRef, useState } from 'react';
import { Eye, Check, X, Edit2, Ban, CheckCircle2, Search, Printer, FileDown, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { APPOINTMENTS, BUSINESS_SETTINGS, MONTHS, finalizeAppointmentPaymentWithTicketFolio, getWorkers, loadAdminAppointments, subscribeAdminAppointments, updateAppointmentStatus, updateAppointmentWorker } from '../../data';
import { AppointmentBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ticketToRawBtUrl, splitTaxInclusivePrice } from '../../ticket';
import type { PrintableTicket } from '../../ticket';
import type { Appointment, AppointmentStatus, BranchId, PaymentMethod, User } from '../../types';

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transf.', card: 'Tarjeta' };

function downloadTicketPdf(ticket: PrintableTicket) {
  const { subtotal, tax, total } = splitTaxInclusivePrice(ticket.total);
  const width = 80;
  const margin = 5;
  const contentWidth = width - margin * 2;
  const rows: ({ type: 'divider' } | {
    type: 'text';
    text: string;
    size?: number;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    gap?: number;
  })[] = [
    { type: 'text', text: ticket.businessName, size: 13, bold: true, align: 'center', gap: 2 },
    { type: 'text', text: ticket.address, size: 8, align: 'center' },
    { type: 'divider' },
    { type: 'text', text: 'RECIBO DE PAGO', size: 11, bold: true, align: 'center', gap: 2 },
    { type: 'text', text: `Folio: ${ticket.folio}`, bold: true },
    { type: 'text', text: `Fecha de cita: ${formatDate(ticket.appointment.date)}` },
    { type: 'text', text: `Hora: ${ticket.appointment.time}` },
    { type: 'divider' },
    { type: 'text', text: `Cliente: ${ticket.appointment.clientName}` },
    { type: 'text', text: `Correo: ${ticket.businessEmail}` },
    { type: 'text', text: `Trabajadora: ${ticket.workerName}` },
    ...(ticket.appointment.serviceType
      ? [{ type: 'text' as const, text: `Tipo: ${ticket.appointment.serviceType === 'manicure' ? 'Manicure (manos)' : 'Pedicure (pies)'}` }]
      : []),
    ...(ticket.appointment.services ?? [ticket.appointment.service]).map(service => ({
      type: 'text' as const,
      text: `${service.name}: $${service.price.toFixed(2)}`,
    })),
    ...(ticket.appointment.subservices ?? []).map(subservice => ({
      type: 'text' as const,
      text: `${subservice.name} x${subservice.quantity} uñas ($${subservice.pricePerNail.toFixed(2)} c/u): $${(subservice.pricePerNail * subservice.quantity).toFixed(2)}`,
    })),
    { type: 'divider' },
    { type: 'text', text: `Subtotal: $${subtotal.toFixed(2)}` },
    { type: 'text', text: `IVA (16%): $${tax.toFixed(2)}` },
    { type: 'text', text: `Total: $${total.toFixed(2)}`, size: 11, bold: true, gap: 2 },
    ...ticket.payments.map(payment => ({
      type: 'text' as const,
      text: `Pago ${methodLabel[payment.method]}: $${payment.amount.toFixed(2)}`,
    })),
    { type: 'divider' },
    { type: 'text', text: 'Gracias por tu preferencia', align: 'center', gap: 2 },
  ];

  const measurePdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, 250] });
  let pageHeight = 7;
  rows.forEach(row => {
    if (row.type === 'divider') {
      pageHeight += 5;
      return;
    }
    const size = row.size ?? 9;
    measurePdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
    measurePdf.setFontSize(size);
    const lines = measurePdf.splitTextToSize(row.text, contentWidth);
    pageHeight += lines.length * (size * 0.42 + 1) + (row.gap ?? 1);
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, pageHeight + 5] });
  let y = 7;
  rows.forEach(row => {
    if (row.type === 'divider') {
      y += 1;
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(margin, y, width - margin, y);
      pdf.setLineDashPattern([], 0);
      y += 4;
      return;
    }
    const size = row.size ?? 9;
    pdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(row.text, contentWidth);
    pdf.text(lines, row.align === 'center' ? width / 2 : margin, y, { align: row.align ?? 'left' });
    y += lines.length * (size * 0.42 + 1) + (row.gap ?? 1);
  });
  const fileUrl = URL.createObjectURL(pdf.output('blob'));
  const downloadLink = document.createElement('a');
  downloadLink.href = fileUrl;
  downloadLink.download = `${ticket.folio}.pdf`;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(fileUrl), 30_000);
}

function getTodayDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateFilter(dateKey: string) {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

export function AdminAppointmentsPage({ branchId }: { branchId: BranchId }) {
  const [appts, setAppts] = useState(APPOINTMENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState(getTodayDateKey(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const initialCalendarDate = new Date();
  const [calendarYear, setCalendarYear] = useState(initialCalendarDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarDate.getMonth());
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [viewAppt, setViewAppt] = useState<Appointment | null>(null);
  const [paymentConfirmAppt, setPaymentConfirmAppt] = useState<Appointment | null>(null);
  const [paymentSplits, setPaymentSplits] = useState<{ method: PaymentMethod; amount: number }[]>([]);
  const [paymentTotal, setPaymentTotal] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [ticketOutput, setTicketOutput] = useState<'pdf' | 'rawbt'>('pdf');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaveError, setPaymentSaveError] = useState('');
  const [ticketToPrint, setTicketToPrint] = useState<PrintableTicket | null>(null);
  const [ticketActionMessage, setTicketActionMessage] = useState('');
  const [ticketActionError, setTicketActionError] = useState('');
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [workers, setWorkers] = useState<User[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    getWorkers().then(setWorkers).catch(() => setWorkers([]));
    loadAdminAppointments()
      .then(appointments => setAppts([...appointments]))
      .catch(error => setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las citas.'));
    const unsubscribe = subscribeAdminAppointments(() => setAppts([...APPOINTMENTS]));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!datePickerOpen) return;
    function closeDatePicker(event: MouseEvent) {
      if (event.target instanceof Node && !datePickerRef.current?.contains(event.target)) {
        setDatePickerOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setDatePickerOpen(false);
    }
    document.addEventListener('mousedown', closeDatePicker);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', closeDatePicker);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [datePickerOpen]);

  const daysInCalendarMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstCalendarWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const todayDateKey = getTodayDateKey(new Date());
  const branchAppointments = appts.filter(appointment => (appointment.branchId ?? 'main') === branchId);
  const pendingAppointmentsByDate = branchAppointments.reduce<Record<string, number>>((counts, appointment) => {
    if (appointment.status === 'pending') {
      counts[appointment.date] = (counts[appointment.date] ?? 0) + 1;
    }
    return counts;
  }, {});

  function moveCalendarMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonth + offset, 1);
    setCalendarYear(next.getFullYear());
    setCalendarMonth(next.getMonth());
  }

  function chooseDate(dateKey: string) {
    setDateFrom(dateKey);
    setDatePickerOpen(false);
  }

  function resetDateToToday() {
    setDateFrom(todayDateKey);
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setDatePickerOpen(false);
  }

  const filtered = branchAppointments.filter(a =>
    a.date >= dateFrom &&
    (statusFilter === 'all' || a.status === statusFilter) &&
    (a.clientName.toLowerCase().includes(search.toLowerCase()) ||
    (a.branchId === 'north' ? 'sucursal norte' : 'sucursal principal').includes(search.toLowerCase()) ||
    a.service.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()))
  );

  async function changeStatus(id: string, status: AppointmentStatus) {
    try {
      await updateAppointmentStatus(id, status);
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setViewAppt(null);
      setPaymentConfirmAppt(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo actualizar la cita.');
    }
  }

  function openPaymentConfirmation(appt: Appointment) {
    setPaymentConfirmAppt(appt);
    setPaymentTotal(appt.total);
    setPaymentSplits([{ method: appt.payments[0]?.method ?? 'cash', amount: appt.total }]);
    setPaymentNote(appt.notes || '');
    setTicketOutput('pdf');
    setPaymentSaveError('');
    setShowPriceEditor(false);
    setViewAppt(null);
  }

  const paymentSplitTotal = paymentSplits.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const paymentSplitMatchesTotal = Math.round(paymentSplitTotal * 100) === Math.round(paymentTotal * 100);

  function updatePaymentSplit(index: number, field: 'method' | 'amount', value: string | number) {
    setPaymentSplits(current => current.map((payment, paymentIndex) => {
      if (paymentIndex !== index) return payment;
      if (field === 'method') {
        const method = (['cash', 'transfer', 'card'] as const).find(option => option === value);
        return method ? { ...payment, method } : payment;
      }
      return { ...payment, amount: Math.max(0, Number(value) || 0) };
    }));
  }

  function addPaymentSplit() {
    const usedMethods = new Set(paymentSplits.map(payment => payment.method));
    const nextMethod = (['cash', 'transfer', 'card'] as const).find(method => !usedMethods.has(method));
    if (!nextMethod) return;
    setPaymentSplits(current => [...current, { method: nextMethod, amount: 0 }]);
  }

  function updatePaymentTotal(value: number) {
    const nextTotal = Math.max(0, value);
    setPaymentTotal(nextTotal);
    setPaymentSplits(current => current.map((payment, index) => index === current.length - 1
      ? { ...payment, amount: Math.max(0, Math.round((nextTotal - current.slice(0, -1).reduce((sum, item) => sum + item.amount, 0)) * 100) / 100) }
      : payment));
  }

  async function proceedToPayment(output: 'pdf' | 'rawbt' = ticketOutput) {
    if (!paymentConfirmAppt || paymentSaving) return;
    if (!paymentSplitMatchesTotal || paymentSplits.some(payment => payment.amount < 0) || paymentSplits.every(payment => payment.amount === 0)) {
      setPaymentSaveError('La suma de las formas de pago debe coincidir con el total.');
      return;
    }
    const appointment = paymentConfirmAppt;
    setPaymentSaving(true);
    setPaymentSaveError('');
    try {
      const payments = paymentSplits.filter(payment => payment.amount > 0);
      const folio = await finalizeAppointmentPaymentWithTicketFolio(appointment.id, payments, paymentNote, paymentTotal);

      const paidAppointment: Appointment = {
        ...appointment,
        status: 'completed',
        total: paymentTotal,
        notes: paymentNote,
        payments,
        ticketFolio: folio,
      };
      setAppts(current => current.map(item => item.id === appointment.id ? paidAppointment : item));
      setPaymentConfirmAppt(null);
      setTicketActionMessage('');
      setTicketActionError('');
      const ticketBusiness = appointment.branchId === 'north'
        ? BUSINESS_SETTINGS.secondaryBranch ?? BUSINESS_SETTINGS
        : BUSINESS_SETTINGS;
      const ticket: PrintableTicket = {
        appointment: paidAppointment,
        total: paymentTotal,
        payments,
        workerName: appointment.workerUid
          ? workers.find(worker => worker.uid === appointment.workerUid)?.name ?? 'No disponible'
          : 'Sin asignar',
        businessName: ticketBusiness.businessName,
        businessEmail: ticketBusiness.email || paidAppointment.clientEmail,
        address: ticketBusiness.address,
        folio,
        issuedAt: new Date(),
      };
      setTicketToPrint(ticket);
      if (output === 'rawbt') {
        setTicketActionMessage('Abriendo RawBT...');
        window.location.href = ticketToRawBtUrl(ticket);
      } else {
        try {
          downloadTicketPdf(ticket);
          setTicketActionMessage('Descarga del PDF iniciada.');
        } catch (error) {
          setTicketActionError(error instanceof Error ? error.message : 'No se pudo iniciar la descarga del PDF.');
        }
      }
    } catch (error) {
      setPaymentSaveError(error instanceof Error ? error.message : 'No se pudo guardar el pago. El ticket no se imprimió.');
    } finally {
      setPaymentSaving(false);
    }
  }

  const statusBtns: { label: string; value: AppointmentStatus | 'all' }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Confirmadas', value: 'confirmed' },
    { label: 'Completadas', value: 'completed' },
    { label: 'Canceladas', value: 'cancelled' },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BBA9AD]" />
            <input className="input-field search-field text-sm" placeholder="Buscar por cliente, servicio o ID..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div ref={datePickerRef} className="relative">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={datePickerOpen}
              aria-label={`Filtrar citas desde ${formatDateFilter(dateFrom)}`}
              onClick={() => setDatePickerOpen(open => !open)}
              className="flex min-w-[220px] items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-left transition hover:border-[var(--color-primary)]"
            >
              <span className="text-[10px] font-700 uppercase tracking-wide text-[var(--color-text-muted)]">Desde</span>
              <span className="flex-1 text-sm font-500 text-[var(--color-text)]">{formatDateFilter(dateFrom)}</span>
              <CalendarDays size={16} className="text-[var(--color-primary)]" />
            </button>
            {datePickerOpen && (
              <div
                role="dialog"
                aria-label="Seleccionar fecha inicial"
                className="absolute right-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    disabled={calendarYear === Number(todayDateKey.slice(0, 4)) && calendarMonth === Number(todayDateKey.slice(5, 7)) - 1}
                    onClick={() => moveCalendarMonth(-1)}
                    className="btn-ghost p-2 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <h3 className="font-700 text-[var(--color-text)]">
                    {MONTHS[calendarMonth]} {calendarYear}
                  </h3>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    onClick={() => moveCalendarMonth(1)}
                    className="btn-ghost p-2"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="mb-1 grid grid-cols-7">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                    <div key={day} className="py-1 text-center text-[10px] font-600 text-[var(--color-text-muted)]">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {Array.from({ length: firstCalendarWeekday }, (_, index) => (
                    <div key={`calendar-empty-${index}`} className="h-9" />
                  ))}
                  {Array.from({ length: daysInCalendarMonth }, (_, index) => {
                    const day = index + 1;
                    const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const pendingCount = pendingAppointmentsByDate[dateKey] ?? 0;
                    const isSelected = dateKey === dateFrom;
                    const isToday = dateKey === todayDateKey;
                    const isPast = dateKey < todayDateKey;
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        disabled={isPast}
                        aria-label={`${day} ${MONTHS[calendarMonth]}${pendingCount ? `, ${pendingCount} citas pendientes de confirmar` : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => chooseDate(dateKey)}
                        className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs transition
                          ${isSelected ? 'bg-[var(--color-primary)] font-700 text-[#1A1316]' : 'text-[var(--color-text)] hover:bg-[rgba(217,154,159,0.14)]'}
                          ${isToday && !isSelected ? 'border border-[var(--color-primary)] text-[var(--color-primary)]' : ''}
                          ${isPast ? 'cursor-not-allowed opacity-30 hover:bg-transparent' : ''}`}
                      >
                        {day}
                        {pendingCount > 0 && (
                          <span className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-[#1A1316]' : 'bg-amber-400'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Pendientes de confirmar
                  </span>
                  <button type="button" className="text-xs font-600 text-[var(--color-primary)] hover:underline" onClick={resetDateToToday}>
                    Hoy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusBtns.map(b => (
            <button key={b.value}
              className={`px-3 py-2 rounded-lg text-xs font-600 border transition-all ${statusFilter === b.value
                ? 'bg-[#E8778A] text-white border-[#E8778A]'
                : 'bg-white text-[#6B5A5E] border-[#EDD9CC] hover:border-[#E8778A]'}`}
              onClick={() => setStatusFilter(b.value)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDFAF9] border-b border-[#F5EDE6]">
                {['ID', 'Sucursal', 'Cliente', 'Servicio', 'Fecha', 'Hora', 'Pago', 'Total', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-700 text-[#6B5A5E] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5EDE6]">
              {filtered.map(appt => (
                <tr key={appt.id} className="table-row">
                  <td className="px-4 py-3 text-xs font-600 text-[#BBA9AD]">{appt.id}</td>
                  <td className="px-4 py-3 text-xs text-[#6B5A5E] whitespace-nowrap">{appt.branchId === 'north' ? 'Sucursal Norte' : 'Sucursal principal'}</td>
                  <td className="px-4 py-3">
                    <div className="font-600 text-[#1A1012] whitespace-nowrap">{appt.clientName}</div>
                    <div className="text-xs text-[#BBA9AD]">{appt.clientPhone}</div>
                  </td>
                  <td className="px-4 py-3 font-500 text-[#3D2A2F] whitespace-nowrap">{(appt.services ?? [appt.service]).map(service => service.name).join(' + ')}</td>
                  <td className="px-4 py-3 text-[#6B5A5E] whitespace-nowrap">{formatDate(appt.date)}</td>
                  <td className="px-4 py-3 text-[#6B5A5E]">{appt.time}</td>
                  <td className="px-4 py-3 text-xs text-[#6B5A5E] whitespace-nowrap">
                    {appt.payments.map(p => methodLabel[p.method]).join(' + ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-700 text-[#C1536A]">${appt.total}</td>
                  <td className="px-4 py-3"><AppointmentBadge status={appt.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button title="Ver" className="btn-ghost p-1.5 text-[#6B5A5E]" onClick={() => setViewAppt(appt)}>
                        <Eye size={14} />
                      </button>
                      {appt.status === 'pending' && (
                        <>
                          <button title="Aceptar" className="btn-ghost p-1.5 text-emerald-600" onClick={() => changeStatus(appt.id, 'confirmed')}>
                            <Check size={14} />
                          </button>
                          <button title="Rechazar" className="btn-ghost p-1.5 text-red-400" onClick={() => changeStatus(appt.id, 'cancelled')}>
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {appt.status === 'confirmed' && (
                        <>
                          <button title="Confirmar pago" className="btn-ghost p-1.5 text-blue-600" onClick={() => openPaymentConfirmation(appt)}>
                            <CheckCircle2 size={14} />
                          </button>
                          <button title="Cancelar" className="btn-ghost p-1.5 text-[#BBA9AD]" onClick={() => changeStatus(appt.id, 'cancelled')}>
                            <Ban size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[#BBA9AD] text-sm">
            No se encontraron citas
          </div>
        )}
      </div>

      {/* View modal */}
      {viewAppt && (
        <Modal title={`Cita ${viewAppt.id}`} onClose={() => setViewAppt(null)} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoField label="Cliente" value={viewAppt.clientName} />
              <InfoField label="Teléfono" value={viewAppt.clientPhone} />
              <InfoField label="Correo" value={viewAppt.clientEmail} />
              {viewAppt.serviceType && (
                <InfoField label="Tipo de servicio" value={viewAppt.serviceType === 'manicure' ? 'Manicure (manos)' : 'Pedicure (pies)'} />
              )}
              <InfoField label="Servicios" value={(viewAppt.services ?? [viewAppt.service]).map(service => `${service.name} ($${service.price.toFixed(2)})`).join(' + ')} />
              <InfoField label="Fecha" value={formatDate(viewAppt.date)} />
              <InfoField label="Hora" value={viewAppt.time} />
              <InfoField label="Duración" value={`${viewAppt.duration ?? viewAppt.services?.reduce((sum, service) => sum + service.duration, 0) ?? viewAppt.service.duration} min`} />
              <InfoField label="Total" value={`$${viewAppt.total}`} />
            </div>
            {(viewAppt.subservices ?? []).length > 0 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <div className="mb-2 text-xs font-700 text-[var(--color-text)]">Extras por uña</div>
                {viewAppt.subservices?.map(subservice => (
                  <div key={subservice.id} className="flex justify-between gap-3 py-1 text-xs text-[var(--color-text-muted)]">
                    <span>{subservice.name} · {subservice.quantity} {subservice.quantity === 1 ? 'uña' : 'uñas'} × ${subservice.pricePerNail.toFixed(2)}</span>
                    <strong className="text-[var(--color-text)]">${(subservice.pricePerNail * subservice.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div className="text-xs font-600 text-[#6B5A5E] mb-1">Pagos</div>
              {viewAppt.payments.length > 0
                ? viewAppt.payments.map((p, i) => (
                  <div key={i} className="text-sm text-[#1A1012]">{methodLabel[p.method]}: ${p.amount}</div>
                ))
                : <div className="text-sm text-[#BBA9AD]">Sin pagos registrados</div>
              }
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-600 text-[#6B5A5E]">Estado:</span>
              <AppointmentBadge status={viewAppt.status} />
            </div>
            <div>
              <label className="block text-xs font-600 text-[#6B5A5E] mb-1.5">Trabajadora asignada</label>
              <select
                className="input-field text-sm"
                value={viewAppt.workerUid || ''}
                onChange={async event => {
                  const workerUid = event.target.value || null;
                  await updateAppointmentWorker(viewAppt.id, workerUid);
                  setViewAppt(current => current ? { ...current, workerUid: workerUid || undefined } : current);
                }}
              >
                <option value="">Sin asignar</option>
                {workers.map(worker => <option key={worker.uid} value={worker.uid}>{worker.name}</option>)}
              </select>
            </div>
            {viewAppt.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-[#F5EDE6]">
                <button className="btn-primary flex-1 justify-center" onClick={() => changeStatus(viewAppt.id, 'confirmed')}>
                  <Check size={15} /> Aceptar
                </button>
                <button className="btn-secondary flex-1 justify-center text-red-500 border-red-200" onClick={() => changeStatus(viewAppt.id, 'cancelled')}>
                  <X size={15} /> Rechazar
                </button>
              </div>
            )}
            {viewAppt.status === 'confirmed' && (
              <div className="flex gap-2 pt-2 border-t border-[#F5EDE6]">
                <button className="btn-primary flex-1 justify-center" onClick={() => openPaymentConfirmation(viewAppt)}>
                  <CheckCircle2 size={15} /> Confirmar pago
                </button>
                <button className="btn-secondary flex-1 justify-center" onClick={() => changeStatus(viewAppt.id, 'cancelled')}>
                  <Ban size={15} /> Cancelar
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {paymentConfirmAppt && (
        <Modal title="Proceder al pago" onClose={() => setPaymentConfirmAppt(null)} size="sm">
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FFF1F3] p-4 border border-[#F7D6DC]">
              <p className="text-sm text-[#6B5A5E] mb-3">La cita se marcará como completada cuando se confirme el pago en el local.</p>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <span className="text-[#6B5A5E]">Servicio</span>
                <span className="font-600 text-[#1A1012] text-right">{paymentConfirmAppt.service.name}</span>
              </div>

              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <label className="block text-xs font-600 text-[#3D2A2F]">Formas de pago</label>
                  {paymentSplits.map((payment, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                      <select
                        className="input-field min-w-0"
                        aria-label={`Forma de pago ${index + 1}`}
                        value={payment.method}
                        onChange={event => updatePaymentSplit(index, 'method', event.target.value)}
                      >
                        {(['cash', 'transfer', 'card'] as const)
                          .filter(method => method === payment.method || !paymentSplits.some((item, itemIndex) => itemIndex !== index && item.method === method))
                          .map(method => <option key={method} value={method}>{methodLabel[method]}</option>)}
                      </select>
                      <label className="relative">
                        <span className="sr-only">Importe de {methodLabel[payment.method]}</span>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B5A5E]">$</span>
                        <input
                          className="input-field pl-7"
                          type="number"
                          min="0"
                          step="0.01"
                          value={payment.amount}
                          onChange={event => updatePaymentSplit(index, 'amount', event.target.value)}
                        />
                      </label>
                      {paymentSplits.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost px-2 py-2 text-xs"
                          aria-label={`Quitar ${methodLabel[payment.method]}`}
                          onClick={() => setPaymentSplits(current => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      disabled={paymentSplits.length >= 3}
                      onClick={addPaymentSplit}
                    >
                      + Agregar forma de pago
                    </button>
                    <span className={`text-xs font-600 ${paymentSplitMatchesTotal ? 'text-[#45845D]' : 'text-[#C1536A]'}`}>
                      Aplicado: ${paymentSplitTotal.toFixed(2)} / ${paymentTotal.toFixed(2)}
                    </span>
                  </div>
                  {!paymentSplitMatchesTotal && (
                    <p className="text-xs text-[#C1536A]" role="alert">Distribuye el total completo entre las formas de pago.</p>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Formato del ticket</span>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato del ticket">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={ticketOutput === 'pdf'}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-600 transition-colors ${ticketOutput === 'pdf' ? 'border-[#E8778A] bg-[#FFF1F3] text-[#C1536A]' : 'border-[#EDD9CC] bg-white text-[#6B5A5E]'}`}
                      onClick={() => setTicketOutput('pdf')}
                    >
                      <FileDown size={16} /> Descargar PDF
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={ticketOutput === 'rawbt'}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-600 transition-colors ${ticketOutput === 'rawbt' ? 'border-[#E8778A] bg-[#FFF1F3] text-[#C1536A]' : 'border-[#EDD9CC] bg-white text-[#6B5A5E]'}`}
                      disabled={paymentSaving}
                      onClick={() => {
                        setTicketOutput('rawbt');
                        void proceedToPayment('rawbt');
                      }}
                    >
                      <Printer size={16} /> RawBT
                    </button>
                  </div>
                  {ticketOutput === 'rawbt' && (
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                      Al tocar RawBT se guarda el pago, se completa la cita y se envía el ticket a la impresora.
                    </p>
                  )}
                </div>

                {!showPriceEditor ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#EDD9CC] bg-white px-3 py-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[#BBA9AD]">Total</div>
                      <div className="font-700 text-[#C1536A]">${paymentTotal}</div>
                    </div>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setShowPriceEditor(true)}>
                      Editar precio
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Editar total</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={paymentTotal}
                      onChange={e => updatePaymentTotal(Number(e.target.value || 0))}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Comentario</label>
                  <textarea
                    className="input-field min-h-[78px] resize-none"
                    placeholder="Se aplica un servicio adicional de..."
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {paymentSaveError && <p className="text-sm text-red-500" role="alert">{paymentSaveError}</p>}
              <button
                className="btn-primary flex-1 justify-center"
                disabled={paymentSaving || !paymentSplitMatchesTotal || paymentTotal <= 0}
                onClick={proceedToPayment}
              >
                <Check size={15} /> {paymentSaving ? 'Guardando pago...' : 'Proceder al pago'}
              </button>
              <button className="btn-secondary flex-1 justify-center" onClick={() => setPaymentConfirmAppt(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {ticketToPrint && (
        <>
          <Modal title="Ticket listo para imprimir" onClose={() => setTicketToPrint(null)} size="sm">
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                El pago se guardó correctamente. Elige cómo quieres emitir el ticket.
              </p>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
                <div className="flex justify-between gap-3"><span>Folio</span><strong>{ticketToPrint.folio}</strong></div>
                <div className="flex justify-between gap-3 mt-1"><span>Total</span><strong>${ticketToPrint.total.toFixed(2)}</strong></div>
                {ticketToPrint.payments.map((payment, index) => (
                  <div key={`${payment.method}-${index}`} className="flex justify-between gap-3 mt-1">
                    <span>{methodLabel[payment.method]}</span><strong>${payment.amount.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  className={`btn-primary justify-center ${ticketOutput === 'pdf' ? 'ring-2 ring-[#D99A9F] ring-offset-2 ring-offset-[#1A181B]' : ''}`}
                  onClick={() => {
                    setTicketOutput('pdf');
                    setTicketActionError('');
                    try {
                      downloadTicketPdf(ticketToPrint);
                      setTicketActionMessage('Descarga del PDF iniciada.');
                    } catch (error) {
                      setTicketActionError(error instanceof Error ? error.message : 'No se pudo generar el PDF.');
                    }
                  }}
                >
                  <FileDown size={15} /> Descargar PDF
                </button>
                <button
                  type="button"
                  className={`btn-secondary justify-center ${ticketOutput === 'rawbt' ? 'ring-2 ring-[#D99A9F] ring-offset-2 ring-offset-[#1A181B]' : ''}`}
                  onClick={() => {
                    setTicketOutput('rawbt');
                    setTicketActionError('');
                    setTicketActionMessage('Abriendo RawBT...');
                    try {
                      window.location.href = ticketToRawBtUrl(ticketToPrint);
                    } catch (error) {
                      setTicketActionError(error instanceof Error ? error.message : 'No se pudo abrir RawBT.');
                    }
                  }}
                >
                  <Printer size={15} /> Imprimir con RawBT
                </button>
                <button className="btn-ghost justify-center sm:col-span-2" onClick={() => setTicketToPrint(null)}>
                  Cerrar
                </button>
              </div>
              {ticketActionMessage && <p className="text-sm text-[var(--color-success)]" role="status">{ticketActionMessage}</p>}
              {ticketActionError && <p className="text-sm text-[var(--color-danger)]" role="alert">{ticketActionError}</p>}
              <p className="text-xs text-[var(--color-text-muted)]">RawBT solo funciona en Android. Si Chrome no abre la app, ábrela manualmente para comprobar que reconoce la impresora y vuelve a intentar desde Chrome. En computadora puedes descargar el PDF.</p>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FDFAF9] rounded-lg p-3">
      <div className="text-xs text-[#BBA9AD] font-500 mb-0.5">{label}</div>
      <div className="text-sm font-600 text-[#1A1012]">{value}</div>
    </div>
  );
}
