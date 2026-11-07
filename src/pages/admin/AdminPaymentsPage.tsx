import { useEffect, useState } from 'react';
import { APPOINTMENTS, BRANCH_LABEL, BUSINESS_SETTINGS, MONTHS, getAppointmentPaymentSummary, getWorkers, saveAppointmentPaymentProof, updateAppointmentPayment, updateAppointmentStatus } from '../../data';
import { PaymentBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { Check, Download, FileText, Printer, Search, X } from 'lucide-react';
import { TICKET_LOGO_URL, ticketToRawBtUrl, type PrintableTicket } from '../../ticket';
import type { BranchId, PaymentStatus, User } from '../../types';

const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transf.', card: 'Tarjeta' };

const branchSlug: Record<BranchId, string> = { main: 'san-nicolas', north: 'escobedo' };
const exportBranches: BranchId[] = ['main', 'north'];

function getPaymentStatus(appt: typeof APPOINTMENTS[0]): PaymentStatus {
  return getAppointmentPaymentSummary(appt).status;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

function exportAppointments(appointments: typeof APPOINTMENTS, branchId: BranchId) {
  const headers = ['ID', 'Sucursal', 'Cliente', 'Correo', 'Teléfono', 'Servicio', 'Fecha cita', 'Hora', 'Estado cita', 'Total', 'Métodos de pago', 'Pagado', 'Comprobante', 'Creada'];
  const rows = appointments.map(appt => [
    appt.id,
    BRANCH_LABEL[(appt.branchId ?? 'main')],
    appt.clientName,
    appt.clientEmail,
    appt.clientPhone,
    (appt.services ?? [appt.service]).map(service => service.name).join(' + '),
    appt.date,
    appt.time,
    appt.status,
    appt.total,
    getAppointmentPaymentSummary(appt).payments.map(payment => methodLabel[payment.method]).join(' + '),
    getAppointmentPaymentSummary(appt).paid,
    appt.paymentProof ? 'Sí' : 'No',
    appt.createdAt,
  ]);
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = '\ufeff' + [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `historial-${branchSlug[branchId]}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function AdminPaymentsPage({ branchId }: { branchId: BranchId }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [viewAppt, setViewAppt] = useState<typeof APPOINTMENTS[0] | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofError, setProofError] = useState('');
  const [workers, setWorkers] = useState<User[]>([]);
  const [ticketPrintError, setTicketPrintError] = useState('');
  const [ticketToReprint, setTicketToReprint] = useState<PrintableTicket | null>(null);

  useEffect(() => {
    getWorkers()
      .then(setWorkers)
      .catch(error => setTicketPrintError(error instanceof Error ? error.message : 'No se pudo cargar el equipo para reimprimir el ticket.'));
  }, []);

  const branchAppointments = APPOINTMENTS.filter(appointment => (appointment.branchId ?? 'main') === branchId);
  const filtered = branchAppointments.filter(a => {
    const ps = getPaymentStatus(a);
    return (statusFilter === 'all' || ps === statusFilter) &&
      (a.clientName.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()));
  });

  const totalRevenue = branchAppointments.reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).paid, 0);
  const pendingRevenue = branchAppointments.reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).due, 0);
  const partialRevenue = branchAppointments
    .filter(appointment => getPaymentStatus(appointment) === 'partial')
    .reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).paid, 0);

  function reprintTicket(appointment: typeof APPOINTMENTS[number]) {
    const paymentSummary = getAppointmentPaymentSummary(appointment);
    if (paymentSummary.status !== 'paid') return;

    const business = appointment.branchId === 'north'
      ? BUSINESS_SETTINGS.secondaryBranch ?? BUSINESS_SETTINGS
      : BUSINESS_SETTINGS;
    const ticket: PrintableTicket = {
      appointment,
      total: appointment.total,
      payments: paymentSummary.payments,
      workerName: appointment.workerUid
        ? workers.find(worker => worker.uid === appointment.workerUid)?.name ?? 'Trabajadora asignada'
        : 'Sin asignar',
      businessName: business.businessName,
      businessEmail: business.email || appointment.clientEmail,
      address: business.address,
      folio: appointment.ticketFolio || 'Sin folio',
      issuedAt: new Date(),
    };

    setTicketPrintError('');
    setTicketToReprint(ticket);
  }

  function printTicketFromBrowser(ticket: PrintableTicket) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setTicketPrintError('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.');
      return;
    }
    printWindow.opener = null;

    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
    const rows = [
      `<img class="ticket-logo" src="${TICKET_LOGO_URL}" alt="Logo Loto">`,
      `<h1>${escapeHtml(ticket.businessName)}</h1>`,
      `<p class="center">${escapeHtml(ticket.address)}</p>`,
      '<hr><h2>RECIBO DE PAGO</h2>',
      `<p><strong>Folio:</strong> ${escapeHtml(ticket.folio)}</p>`,
      `<p>Fecha de cita: ${escapeHtml(formatDate(ticket.appointment.date))}</p>`,
      `<p>Hora: ${escapeHtml(ticket.appointment.time)}</p><hr>`,
      `<p>Cliente: ${escapeHtml(ticket.appointment.clientName)}</p>`,
      `<p>Correo: ${escapeHtml(ticket.businessEmail)}</p>`,
      `<p>Trabajadora: ${escapeHtml(ticket.workerName)}</p>`,
      ...(ticket.appointment.services ?? [ticket.appointment.service]).map(service =>
        `<p>${escapeHtml(service.name)}: $${service.price.toFixed(2)}</p>`),
      ...(ticket.appointment.subservices ?? []).map(subservice =>
        `<p>${escapeHtml(subservice.name)} x${subservice.quantity}: $${(subservice.pricePerNail * subservice.quantity).toFixed(2)}</p>`),
      '<hr>',
      `<p>Subtotal: $${(ticket.total / 1.16).toFixed(2)}</p>`,
      `<p>IVA (16%): $${(ticket.total - ticket.total / 1.16).toFixed(2)}</p>`,
      `<h2>Total: $${ticket.total.toFixed(2)}</h2>`,
      ...ticket.payments.map(payment =>
        `<p>Pago ${escapeHtml(methodLabel[payment.method])}: $${payment.amount.toFixed(2)}</p>`),
      '<hr><p class="center">Gracias por tu preferencia</p>',
    ];

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="es"><head><meta charset="utf-8"><title>Ticket ${escapeHtml(ticket.folio)}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { width: 72mm; margin: 0 auto; color: #000; font: 12px Arial, sans-serif; }
        .ticket-logo { display: block; width: 34mm; height: 34mm; object-fit: contain; margin: 0 auto 3mm; }
        h1, h2 { font-size: 15px; text-align: center; }
        p { margin: 5px 0; overflow-wrap: anywhere; }
        .center { text-align: center; }
        hr { border: 0; border-top: 1px dashed #000; margin: 9px 0; }
        @media screen { body { margin: 16px auto; } }
      </style></head><body>${rows.join('')}</body></html>`);
    printWindow.document.close();
    const logo = printWindow.document.querySelector<HTMLImageElement>('.ticket-logo');
    if (!logo) {
      printWindow.close();
      setTicketPrintError('No se pudo preparar el logo del ticket para imprimir.');
      return;
    }
    const startPrint = () => {
      printWindow.focus();
      printWindow.print();
    };
    const showLogoError = () => {
      printWindow.close();
      setTicketPrintError('No se pudo cargar el logo del ticket. Inténtalo de nuevo.');
    };
    logo.addEventListener('load', startPrint, { once: true });
    logo.addEventListener('error', showLogoError, { once: true });
    if (logo.complete) {
      if (logo.naturalWidth > 0) startPrint();
      else showLogoError();
    }
  }

  const statusBtns: { label: string; value: PaymentStatus | 'all' }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Parciales', value: 'partial' },
    { label: 'Pagados', value: 'paid' },
    { label: 'Cancelados', value: 'cancelled' },
  ];

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs text-[#6B5A5E] mb-1">Total realmente cobrado</div>
          <div className="text-2xl font-700 text-emerald-600">${totalRevenue}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-[#6B5A5E] mb-1">Saldo pendiente</div>
          <div className="text-2xl font-700 text-amber-600">${pendingRevenue}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-[#6B5A5E] mb-1">Abonos parciales cobrados</div>
          <div className="text-2xl font-700 text-orange-600">${partialRevenue}</div>
        </div>
      </div>
      {ticketPrintError && <p className="text-sm text-red-600" role="alert">{ticketPrintError}</p>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BBA9AD]" />
          <input className="input-field search-field text-sm" placeholder="Buscar por cliente o ID..."
            value={search} onChange={e => setSearch(e.target.value)} />
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
          {exportBranches.map(id => (
            <button key={id} className="btn-secondary text-xs"
              onClick={() => exportAppointments(APPOINTMENTS.filter(appointment => (appointment.branchId ?? 'main') === id), id)}
              title={`Descargar historial de ${BRANCH_LABEL[id]} para Excel`}>
              <Download size={14} /> Excel {BRANCH_LABEL[id]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDFAF9] border-b border-[#F5EDE6]">
                {['Cliente', 'Cita', 'Fecha', 'Total', 'Transf.', 'Efectivo', 'Tarjeta', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-700 text-[#6B5A5E] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5EDE6]">
              {filtered.map(appt => {
                const ps = getPaymentStatus(appt);
                const paymentSummary = getAppointmentPaymentSummary(appt);
                const byMethod = (m: string) => paymentSummary.payments.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0);
                const hasTransfer = paymentSummary.payments.some(p => p.method === 'transfer');
                return (
                  <tr key={appt.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="font-600 text-[#1A1012] whitespace-nowrap">{appt.clientName}</div>
                      <div className="text-xs text-[#BBA9AD]">{appt.clientEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B5A5E]">{(appt.services ?? [appt.service]).map(service => service.name).join(' + ')}</td>
                    <td className="px-4 py-3 text-xs text-[#6B5A5E] whitespace-nowrap">{formatDate(appt.date)}</td>
                    <td className="px-4 py-3 font-700 text-[#C1536A]">
                      <div>${appt.total}</div>
                      {paymentSummary.due > 0 && <div className="mt-0.5 text-[10px] font-500 text-amber-600">Debe ${paymentSummary.due}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B5A5E]">{byMethod('transfer') > 0 ? `$${byMethod('transfer')}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6B5A5E]">{byMethod('cash') > 0 ? `$${byMethod('cash')}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6B5A5E]">{byMethod('card') > 0 ? `$${byMethod('card')}` : '—'}</td>
                    <td className="px-4 py-3"><PaymentBadge status={ps} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button title={hasTransfer ? 'Ver o adjuntar comprobante' : 'Adjuntar comprobante de transferencia'} className="btn-ghost p-1.5 text-[#E8778A]" onClick={() => {
                          setProofError('');
                          setViewAppt(appt);
                        }}>
                          <FileText size={14} />
                        </button>
                        {ps === 'paid' && (
                          <button
                            type="button"
                            title="Reimprimir ticket"
                            aria-label={`Reimprimir ticket de ${appt.clientName}`}
                            className="btn-ghost p-1.5 text-[#6B5A5E]"
                            onClick={() => reprintTicket(appt)}
                          >
                            <Printer size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-[#BBA9AD] text-sm">No se encontraron registros</div>
        )}
      </div>

      {/* Reprint ticket modal */}
      {ticketToReprint && (
        <Modal title="Reimprimir ticket" onClose={() => setTicketToReprint(null)} size="sm">
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FFF1F3] p-4 text-sm">
              <p className="font-700 text-[#C1536A]">{ticketToReprint.appointment.clientName}</p>
              <p className="mt-1 text-xs text-[#6B5A5E]">
                Folio {ticketToReprint.folio} · Total ${ticketToReprint.total.toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              className="btn-primary w-full justify-center"
              onClick={() => printTicketFromBrowser(ticketToReprint)}
            >
              <Printer size={15} /> Imprimir o guardar como PDF
            </button>
            <button
              type="button"
              className="btn-secondary w-full justify-center"
              onClick={async () => {
                try {
                  window.location.href = await ticketToRawBtUrl(ticketToReprint);
                  setTicketPrintError('');
                } catch (error) {
                  setTicketPrintError(error instanceof Error ? error.message : 'No se pudo enviar el ticket a RawBT.');
                }
              }}
            >
              <Printer size={15} /> Enviar a RawBT (Android)
            </button>
            <p className="text-xs text-[#6B5A5E]">
              RawBT requiere Android y la aplicación instalada. En otros dispositivos usa la impresión del navegador.
            </p>
            {ticketPrintError && <p className="text-xs text-red-600" role="alert">{ticketPrintError}</p>}
          </div>
        </Modal>
      )}

      {/* Transfer proof modal */}
      {viewAppt && (
        <Modal title="Comprobante de transferencia" onClose={() => setViewAppt(null)} size="sm">
          <div className="space-y-3">
            <div className="bg-[#FFF1F3] rounded-xl p-4">
              <p className="text-xs font-700 text-[#C1536A] mb-3">Datos de la transferencia</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B5A5E]">Cliente</span><span className="font-600">{viewAppt.clientName}</span></div>
                <div className="flex justify-between"><span className="text-[#6B5A5E]">Monto</span><span className="font-700 text-[#C1536A]">${viewAppt.payments.find(p => p.method === 'transfer')?.amount ?? viewAppt.total}</span></div>
                <div className="flex justify-between"><span className="text-[#6B5A5E]">Fecha cita</span><span className="font-600">{formatDate(viewAppt.date)}</span></div>
              </div>
            </div>
            <div className="border-2 border-dashed border-[#EDD9CC] rounded-xl p-6 text-center text-[#BBA9AD]">
              {viewAppt.paymentProof ? (
                <div className="space-y-2">
                  {viewAppt.paymentProof.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(viewAppt.paymentProof) ? (
                    <a href={viewAppt.paymentProof} target="_blank" rel="noreferrer">
                      <img src={viewAppt.paymentProof} alt={`Comprobante de transferencia de ${viewAppt.clientName}`} className="mx-auto max-h-64 rounded-lg object-contain" />
                    </a>
                  ) : (
                    <a href={viewAppt.paymentProof} target="_blank" rel="noreferrer" className="text-sm text-[#C1536A] underline">
                      Abrir comprobante adjunto
                    </a>
                  )}
                  <p className="text-xs text-emerald-700">Comprobante guardado</p>
                </div>
              ) : (
                <>
                  <FileText size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Comprobante no adjunto</p>
                  <p className="text-xs mt-1">Puedes subir la foto del comprobante aquí</p>
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5" htmlFor="admin-transfer-proof">
                {viewAppt.paymentProof ? 'Cambiar foto del comprobante' : 'Subir foto del comprobante'}
              </label>
              <input
                id="admin-transfer-proof"
                className="input-field text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={proofUploading}
                onChange={async event => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (!file) return;
                  setProofUploading(true);
                  setProofError('');
                  try {
                    const paymentProof = await saveAppointmentPaymentProof(viewAppt.id, file);
                    setViewAppt({ ...viewAppt, paymentProof });
                  } catch (error) {
                    setProofError(error instanceof Error ? error.message : 'No se pudo guardar la foto del comprobante.');
                  } finally {
                    setProofUploading(false);
                  }
                }}
              />
              <p className="text-xs text-[#BBA9AD] mt-1">Imagen JPG, PNG o WEBP; máximo 5 MB. Se almacenará en Firebase Storage y su referencia quedará en la cita.</p>
              {proofUploading && <p className="mt-2 text-xs text-[#C1536A]" role="status">Subiendo comprobante...</p>}
              {proofError && <p className="mt-2 text-xs text-red-600" role="alert">{proofError}</p>}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1 justify-center text-red-500 border-red-200" onClick={async () => {
                await updateAppointmentStatus(viewAppt.id, 'cancelled');
                setViewAppt(null);
              }}>
                <X size={15} /> Cancelar pago
              </button>
              <button className="btn-primary flex-1 justify-center" onClick={async () => {
                const transfer = viewAppt.payments.find(payment => payment.method === 'transfer');
                await updateAppointmentPayment(viewAppt.id, transfer || { method: 'transfer', amount: viewAppt.total });
                setViewAppt(null);
              }} disabled={proofUploading}>
                <Check size={15} /> Finalizar pago
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
