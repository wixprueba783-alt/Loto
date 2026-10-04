import type { AppointmentStatus, PaymentStatus } from '../types';

const apptColors: Record<AppointmentStatus, string> = {
  pending: 'status-chip status-chip-warning',
  confirmed: 'status-chip status-chip-success',
  cancelled: 'status-chip status-chip-danger',
  completed: 'status-chip status-chip-info',
};

const apptDots: Record<AppointmentStatus, string> = {
  pending: 'status-dot-warning',
  confirmed: 'status-dot-success',
  cancelled: 'status-dot-danger',
  completed: 'status-dot-info',
};

const apptLabels: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const payColors: Record<PaymentStatus, string> = {
  pending: 'status-chip status-chip-warning',
  partial: 'status-chip status-chip-warning',
  paid: 'status-chip status-chip-success',
  cancelled: 'status-chip status-chip-danger',
};

const payDots: Record<PaymentStatus, string> = {
  pending: 'status-dot-warning',
  partial: 'status-dot-warning',
  paid: 'status-dot-success',
  cancelled: 'status-dot-danger',
};

const payLabels: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-600 tracking-[0.01em] ${apptColors[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${apptDots[status]}`} />
      {apptLabels[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-600 tracking-[0.01em] ${payColors[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${payDots[status]}`} />
      {payLabels[status]}
    </span>
  );
}
