import type { Appointment } from './types';

export interface PrintableTicket {
  appointment: Appointment;
  total: number;
  payments: Appointment['payments'];
  workerName: string;
  businessName: string;
  businessEmail: string;
  address: string;
  folio: string;
  issuedAt: Date;
}

export function formatTicketDate(date: string) {
  const [year, month, day] = date.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${day} ${months[Number(month) - 1] ?? ''} ${year}`;
}

export function splitTaxInclusivePrice(total: number) {
  const roundedTotal = Math.round((total + Number.EPSILON) * 100) / 100;
  const subtotal = Math.round((roundedTotal / 1.16 + Number.EPSILON) * 100) / 100;
  const tax = Math.round((roundedTotal - subtotal + Number.EPSILON) * 100) / 100;
  return { subtotal, tax, total: roundedTotal };
}

export function ticketToRawBtUrl(ticket: PrintableTicket) {
  const { subtotal, tax, total } = splitTaxInclusivePrice(ticket.total);
  const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transf.', card: 'Tarjeta' };
  type ReceiptRow = {
    text: string;
    fontSize: number;
    bold?: boolean;
    align?: CanvasTextAlign;
    gapAfter?: number;
    separator?: boolean;
  };
  const rows: ReceiptRow[] = [
    { text: ticket.businessName, fontSize: 27, bold: true, align: 'center', gapAfter: 12 },
    { text: ticket.address, fontSize: 22, align: 'center', gapAfter: 22 },
    { text: '', fontSize: 1, separator: true, gapAfter: 8 },
    { text: 'RECIBO DE PAGO', fontSize: 27, bold: true, align: 'center', gapAfter: 16 },
    { text: `Folio: ${ticket.folio}`, fontSize: 24, bold: true },
    { text: `Fecha de cita: ${formatTicketDate(ticket.appointment.date)}`, fontSize: 23 },
    { text: `Hora: ${ticket.appointment.time}`, fontSize: 23, gapAfter: 16 },
    { text: '', fontSize: 1, separator: true, gapAfter: 8 },
    { text: `Cliente: ${ticket.appointment.clientName}`, fontSize: 23 },
    { text: `Correo: ${ticket.businessEmail}`, fontSize: 23 },
    { text: `Trabajadora: ${ticket.workerName}`, fontSize: 23 },
    ...(ticket.appointment.serviceType
      ? [{ text: `Tipo: ${ticket.appointment.serviceType === 'manicure' ? 'Manicure (manos)' : 'Pedicure (pies)'}`, fontSize: 23 }]
      : []),
    ...(ticket.appointment.services ?? [ticket.appointment.service]).map(service =>
      ({ text: `${service.name}: $${service.price.toFixed(2)}`, fontSize: 23 })),
    ...(ticket.appointment.subservices ?? []).map(subservice =>
      ({ text: `${subservice.name} x${subservice.quantity} unas ($${subservice.pricePerNail.toFixed(2)} c/u): $${(subservice.pricePerNail * subservice.quantity).toFixed(2)}`, fontSize: 23 })),
    { text: '', fontSize: 1, separator: true, gapAfter: 8 },
    { text: `Subtotal: $${subtotal.toFixed(2)}`, fontSize: 23 },
    { text: `IVA (16%): $${tax.toFixed(2)}`, fontSize: 23 },
    { text: `Total: $${total.toFixed(2)}`, fontSize: 25, bold: true, gapAfter: 5 },
    ...ticket.payments.map(payment =>
      ({ text: `Pago ${methodLabel[payment.method]}: $${payment.amount.toFixed(2)}`, fontSize: 23 })),
    { text: '', fontSize: 1, separator: true, gapAfter: 14 },
    { text: 'Gracias por tu preferencia', fontSize: 23, align: 'center', gapAfter: 12 },
  ];

  const width = 384;
  const margin = 10;
  const contentWidth = width - margin * 2;
  const measuringCanvas = document.createElement('canvas');
  const measuringContext = measuringCanvas.getContext('2d');
  if (!measuringContext) throw new Error('No se pudo preparar el formato del ticket.');

  const layout = rows.map(row => {
    if (row.separator) return { row, lines: [] as string[] };
    const text = row.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    measuringContext.font = `${row.bold ? 'bold ' : ''}${row.fontSize}px Arial`;
    const lines: string[] = [];
    let currentLine = '';
    for (const word of text.split(/\s+/)) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (currentLine && measuringContext.measureText(candidate).width > contentWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) lines.push(currentLine);
    return { row, lines };
  });
  const bottomPadding = 56;
  const height = 12 + layout.reduce((sum, item) => sum
    + (item.row.separator ? 15 : item.lines.length * (item.row.fontSize + 7))
    + (item.row.gapAfter ?? 7), 0) + bottomPadding;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo dibujar el ticket.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000';
  context.textBaseline = 'top';
  let y = 6;
  for (const { row, lines: wrappedLines } of layout) {
    if (row.separator) {
      context.save();
      context.strokeStyle = '#000';
      context.lineWidth = 2;
      context.setLineDash([7, 7]);
      context.beginPath();
      context.moveTo(margin, y + 6);
      context.lineTo(width - margin, y + 6);
      context.stroke();
      context.restore();
      y += 15 + (row.gapAfter ?? 7);
      continue;
    }
    context.font = `${row.bold ? 'bold ' : ''}${row.fontSize}px Arial`;
    context.textAlign = row.align ?? 'center';
    const x = row.align === 'left' ? margin : row.align === 'right' ? width - margin : width / 2;
    for (const line of wrappedLines) {
      context.fillText(line, x, y);
      y += row.fontSize + 7;
    }
    y += row.gapAfter ?? 7;
  }

  const pixels = context.getImageData(0, 0, width, height).data;
  const bytesPerRow = width / 8;
  const raster = new Uint8Array(bytesPerRow * height);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex++) {
    const offset = pixelIndex * 4;
    if (pixels[offset] < 160) {
      raster[Math.floor(pixelIndex / width) * bytesPerRow + Math.floor((pixelIndex % width) / 8)]
        |= 0x80 >> (pixelIndex % 8);
    }
  }

  const commands = new Uint8Array(10 + raster.length + 6);
  commands.set([
    0x1b, 0x40,
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  commands.set(raster, 10);
  commands.set([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00], 10 + raster.length);
  const binaryChunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < commands.length; index += chunkSize) {
    binaryChunks.push(String.fromCharCode(...commands.subarray(index, index + chunkSize)));
  }
  const base64 = btoa(binaryChunks.join(''));
  return `rawbt:base64,${base64}`;
}
