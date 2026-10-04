import { APPOINTMENTS, MONTHS, getAppointmentPaymentSummary } from '../data';
import { PaymentBadge } from '../components/StatusBadge';
import type { BranchId, PaymentStatus, User } from '../types';
import { CreditCard, Hash, TrendingUp } from 'lucide-react';

const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta' };

function getPaymentStatus(appt: typeof APPOINTMENTS[0]): PaymentStatus {
  return getAppointmentPaymentSummary(appt).status;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

export function ClientPaymentsPage({ user, branchId }: { user: User | null; branchId: BranchId }) {
  const myAppts = APPOINTMENTS
    .filter(a => (a.branchId ?? 'main') === branchId && (user?.uid ? a.ownerUid === user.uid : a.clientEmail === user?.email))
    .sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`));
  const total = myAppts.reduce((s, a) => s + a.total, 0);
  const paid = myAppts.reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).paid, 0);
  const pending = myAppts.reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).due, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs text-[#6B5A5E] font-500 mb-1">Total servicios</div>
          <div className="text-2xl font-700 text-[#C1536A]">${total}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-[#6B5A5E] font-500 mb-1">Total pagado</div>
          <div className="text-2xl font-700 text-emerald-600">${paid}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-[#6B5A5E] font-500 mb-1">Pendiente por pagar</div>
          <div className="text-2xl font-700 text-amber-600">${pending}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-[var(--color-border)]">
          <h2 className="font-700 text-[var(--color-text)] flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--color-primary)]" /> Historial de pagos
          </h2>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {myAppts.map(appt => {
            const paymentSummary = getAppointmentPaymentSummary(appt);
            const ps = paymentSummary.status;
            return (
              <div
                key={appt.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 transition-colors hover:bg-[var(--color-surface-raised)] sm:p-5 lg:flex-row lg:items-center"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center flex-shrink-0">
                    <CreditCard size={17} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-700 text-[var(--color-text)] truncate">{(appt.services ?? [appt.service]).map(service => service.name).join(' + ')}</div>
                    {appt.serviceType && (
                      <div className="mt-0.5 text-[10px] font-700 uppercase tracking-wide text-[var(--color-primary)]">
                        {appt.serviceType === 'manicure' ? 'Manicure · manos' : 'Pedicure · pies'}
                      </div>
                    )}
                    <div className="text-sm text-[var(--color-text-muted)] mt-1">{formatDate(appt.date)} · {appt.time}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1"><Hash size={12} />{paymentSummary.payments.length > 0
                      ? paymentSummary.payments.map(p => `${methodLabel[p.method]} $${p.amount}`).join(' + ')
                      : 'Sin registro de pago'}
                    </div>
                    {(appt.subservices ?? []).length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2">
                        {appt.subservices?.map(subservice => (
                          <div key={subservice.id} className="flex justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                            <span>{subservice.name} · {subservice.quantity} {subservice.quantity === 1 ? 'uña' : 'uñas'} × ${subservice.pricePerNail.toFixed(2)}</span>
                            <strong className="text-[var(--color-text)]">${(subservice.quantity * subservice.pricePerNail).toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end lg:gap-5 lg:min-w-[260px]">
                  <div className="text-left lg:text-right">
                    <div className="text-xs text-[var(--color-text-muted)]">Importe</div>
                    <div className="text-xl font-700 text-[var(--color-text)]">${appt.total}</div>
                  </div>
                  <PaymentBadge status={ps} />
                  {paymentSummary.paid > 0 && ps !== 'paid' && (
                    <div className="w-full text-xs text-[var(--color-text-muted)] sm:w-auto">
                      Pagado ${paymentSummary.paid}; resta ${paymentSummary.due}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {myAppts.length === 0 && (
          <div className="px-6 py-14 text-center text-[var(--color-text-muted)]">
            <CreditCard size={36} className="mx-auto mb-3 opacity-40" />
            <p>No hay pagos registrados todavía.</p>
          </div>
        )}
      </div>
    </div>
  );
}
