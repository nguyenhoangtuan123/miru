import { CalendarClock } from 'lucide-react';
import type { AppointmentRow } from './types';
import { formatDateTime, getAppointmentDescription } from './helpers';

type TherapistAppointmentsSectionProps = {
  appointments: AppointmentRow[];
  onConfirmAppointment: (appointmentId: number) => Promise<void>;
};

export function TherapistAppointmentsSection({
  appointments,
  onConfirmAppointment,
}: TherapistAppointmentsSectionProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <CalendarClock size={18} />
        Lịch hẹn
      </h3>

      <div className="space-y-3">
        {appointments.length === 0 ? (
          <div className="text-sm text-white/50">Chưa có lịch hẹn nào.</div>
        ) : (
          appointments.map((appointment) => (
            <div
              key={String(appointment.id)}
              className="rounded-2xl border border-white/10 bg-black/15 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {formatDateTime(appointment.appointment_date, 'Lịch hẹn')}
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    {getAppointmentDescription(appointment)}
                  </div>
                </div>
                {appointment.client_confirmed ? (
                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-300">
                    Đã xác nhận
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onConfirmAppointment(Number(appointment.id))}
                    className="rounded-full bg-miru-primary/20 px-3 py-1 text-xs text-miru-primary transition-colors hover:bg-miru-primary/30"
                  >
                    Xác nhận
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
