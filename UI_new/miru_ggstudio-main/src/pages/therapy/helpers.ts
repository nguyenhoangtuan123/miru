import { repairMojibake } from '../../lib/text';
import type { AppointmentRow, PairingRecord } from './types';

export function vi(text: string) {
  return repairMojibake(text);
}

export function getTherapistInfo(pairing: PairingRecord) {
  if (!pairing || typeof pairing !== 'object') {
    return null;
  }

  const therapist = pairing.therapist;
  if (therapist && typeof therapist === 'object') {
    return therapist as Record<string, unknown>;
  }

  return null;
}

export function formatAssignmentStatus(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'Đã hoàn thành';
    case 'in_progress':
      return 'Đang thực hiện';
    case 'cancelled':
      return 'Đã hủy';
    case 'skipped':
      return 'Đã bỏ qua';
    default:
      return 'Chờ bắt đầu';
  }
}

export function formatPriority(priority?: string | null) {
  switch ((priority || '').toLowerCase()) {
    case 'high':
      return 'Cao';
    case 'low':
      return 'Thấp';
    default:
      return 'Trung bình';
  }
}

export function formatAssignmentType(type?: string | null) {
  switch ((type || '').toLowerCase()) {
    case 'exercise':
      return 'Bài thực hành';
    case 'reading':
      return 'Đọc tài liệu';
    case 'journal':
      return 'Viết nhật ký';
    case 'meditation':
      return 'Thực hành thư giãn';
    case 'other':
      return 'Khác';
    default:
      return 'Công việc';
  }
}

export function getProgressWidth(progress?: number) {
  const safe = Number.isFinite(progress) ? Number(progress) : 0;
  return `${Math.max(0, Math.min(100, safe))}%`;
}

export function formatDateTime(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString('vi-VN');
}

export function getAppointmentDescription(appointment: AppointmentRow) {
  if (typeof appointment.notes === 'string' && appointment.notes.trim()) {
    return vi(appointment.notes);
  }

  if (typeof appointment.type === 'string' && appointment.type.trim()) {
    return vi(appointment.type);
  }

  if (typeof appointment.appointment_type === 'string' && appointment.appointment_type.trim()) {
    return vi(appointment.appointment_type);
  }

  return 'Buổi hẹn trị liệu';
}
