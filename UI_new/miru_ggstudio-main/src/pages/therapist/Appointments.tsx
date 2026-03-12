import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import {
  cancelTherapistAppointment,
  completeTherapistAppointment,
  createTherapistAppointment,
  getTherapistAppointments,
  getTherapistClients,
} from '../../services/backend';

type TherapistClientRow = Record<string, unknown>;
type AppointmentRow = Record<string, unknown>;

function getClientId(client: TherapistClientRow) {
  if (typeof client.client_id === 'string' && client.client_id.trim()) {
    return client.client_id;
  }
  if (typeof client.id === 'string' && client.id.trim()) {
    return client.id;
  }
  return '';
}

function getClientName(client: TherapistClientRow | null) {
  if (!client) {
    return 'Than chu';
  }
  const nested = client.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.name === 'string' && user.name.trim()) {
      return user.name;
    }
  }
  if (typeof client.client_id === 'string' && client.client_id.trim()) {
    return client.client_id;
  }
  return 'Than chu';
}

function getAppointmentClientName(
  appointment: AppointmentRow,
  clientsById: Map<string, TherapistClientRow>
) {
  const clientId = typeof appointment.client_id === 'string' ? appointment.client_id : '';
  return getClientName(clientsById.get(clientId) ?? null);
}

function sortAppointments(items: AppointmentRow[]) {
  return [...items].sort((left, right) => {
    const leftValue =
      typeof left.appointment_date === 'string'
        ? new Date(left.appointment_date).getTime()
        : 0;
    const rightValue =
      typeof right.appointment_date === 'string'
        ? new Date(right.appointment_date).getTime()
        : 0;
    return leftValue - rightValue;
  });
}

export function TherapistAppointments() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<TherapistClientRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'completed' | 'cancelled'>(
    'scheduled'
  );
  const [selectedClientId, setSelectedClientId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentType, setAppointmentType] = useState('online');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyAppointmentId, setBusyAppointmentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [clientsResult, appointmentsResult] = await Promise.allSettled([
          getTherapistClients(user.id),
          getTherapistAppointments(user.id),
        ]);

        if (cancelled) {
          return;
        }

        const nextClients =
          clientsResult.status === 'fulfilled' ? clientsResult.value.clients : [];
        const nextAppointments =
          appointmentsResult.status === 'fulfilled'
            ? appointmentsResult.value.appointments
            : [];

        setClients(nextClients);
        setAppointments(sortAppointments(nextAppointments));

        const clientFromUrl = searchParams.get('client');
        setSelectedClientId(
          clientFromUrl ||
            getClientId(nextClients[0] ?? {}) ||
            ''
        );

        const firstFailure =
          clientsResult.status === 'rejected'
            ? clientsResult.reason
            : appointmentsResult.status === 'rejected'
              ? appointmentsResult.reason
              : null;

        if (firstFailure instanceof Error) {
          setError(firstFailure.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [searchParams, user?.id]);

  const clientsById = useMemo(() => {
    const map = new Map<string, TherapistClientRow>();
    clients.forEach((client) => {
      const clientId = getClientId(client);
      if (clientId) {
        map.set(clientId, client);
      }
    });
    return map;
  }, [clients]);

  const filteredAppointments = appointments.filter((appointment) => {
    const status = typeof appointment.status === 'string' ? appointment.status : 'scheduled';
    if (activeTab === 'scheduled') {
      return status === 'scheduled' || status === 'rescheduled' || status === 'no_show';
    }
    if (activeTab === 'completed') {
      return status === 'completed';
    }
    return status === 'cancelled';
  });

  async function handleCreateAppointment() {
    if (!user?.id || !selectedClientId || !appointmentDate) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await createTherapistAppointment(user.id, {
        client_id: selectedClientId,
        appointment_date: new Date(appointmentDate).toISOString(),
        duration_minutes: durationMinutes,
        appointment_type: appointmentType,
        location: location.trim() || undefined,
        meeting_link: meetingLink.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (response.appointment) {
        setAppointments((prev) => sortAppointments([...prev, response.appointment]));
      }

      setAppointmentDate('');
      setDurationMinutes(60);
      setAppointmentType('online');
      setLocation('');
      setMeetingLink('');
      setNotes('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Khong tao duoc lich hen');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelAppointment(appointmentId: number) {
    if (!user?.id) {
      return;
    }
    try {
      setBusyAppointmentId(appointmentId);
      await cancelTherapistAppointment(user.id, appointmentId, 'Cancelled by therapist');
      setAppointments((prev) =>
        prev.map((appointment) =>
          Number(appointment.id) === appointmentId
            ? { ...appointment, status: 'cancelled' }
            : appointment
        )
      );
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Khong huy duoc lich hen');
    } finally {
      setBusyAppointmentId(null);
    }
  }

  async function handleCompleteAppointment(appointmentId: number) {
    if (!user?.id) {
      return;
    }
    try {
      setBusyAppointmentId(appointmentId);
      await completeTherapistAppointment(user.id, appointmentId);
      setAppointments((prev) =>
        prev.map((appointment) =>
          Number(appointment.id) === appointmentId
            ? { ...appointment, status: 'completed' }
            : appointment
        )
      );
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : 'Khong hoan tat duoc lich hen'
      );
    } finally {
      setBusyAppointmentId(null);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Lich hen therapist</h1>
          <p className="text-white/60">
            Tao lich hen moi, theo doi trang thai va cap nhat tien trinh cho tung than chu.
          </p>
        </div>
        {isLoading && (
          <div className="text-sm text-white/40 flex items-center gap-2">
            <LoaderCircle size={16} className="animate-spin" />
            Dang tai
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="grid xl:grid-cols-[360px,1fr] gap-6">
        <div className="glass-panel p-6 rounded-3xl h-fit">
          <h2 className="text-xl font-semibold mb-5">Tao lich hen</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-2 block">Than chu</label>
              <select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-miru-primary/50"
              >
                <option value="">Chon than chu</option>
                {clients.map((client) => {
                  const clientId = getClientId(client);
                  return (
                    <option key={clientId} value={clientId}>
                      {getClientName(client)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-sm text-white/60 mb-2 block">Thoi gian</label>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-miru-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block">Hinh thuc</label>
                <select
                  value={appointmentType}
                  onChange={(event) => setAppointmentType(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-miru-primary/50"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-2 block">Phut</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-miru-primary/50"
                />
              </div>
            </div>

            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Dia diem neu gap truc tiep"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50"
            />

            <input
              type="text"
              value={meetingLink}
              onChange={(event) => setMeetingLink(event.target.value)}
              placeholder="Link meeting neu online"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50"
            />

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ghi chu cho buoi hen..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 resize-none"
            />

            <button
              onClick={handleCreateAppointment}
              disabled={!selectedClientId || !appointmentDate || isSubmitting}
              className="w-full glass-button py-3 rounded-2xl font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <CalendarIcon size={18} />
              )}
              Tao lich hen
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl">
          <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-2xl w-fit">
            {[
              { id: 'scheduled', label: 'Sap toi' },
              { id: 'completed', label: 'Da xong' },
              { id: 'cancelled', label: 'Da huy' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as 'scheduled' | 'completed' | 'cancelled')
                }
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-miru-primary text-[#ffffff]'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredAppointments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
                Chua co lich hen nao trong nhom nay.
              </div>
            ) : (
              filteredAppointments.map((appointment, index) => (
                <motion.div
                  key={String(appointment.id ?? index)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">
                        {getAppointmentClientName(appointment, clientsById)}
                      </div>
                      <div className="text-sm text-white/60 mt-1">
                        {typeof appointment.appointment_date === 'string'
                          ? new Date(appointment.appointment_date).toLocaleString('vi-VN')
                          : 'Khong ro thoi gian'}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-white/50">
                        <span>{String(appointment.type ?? 'online')}</span>
                        <span>{String(appointment.duration_minutes ?? 60)} phut</span>
                        {appointment.client_confirmed ? (
                          <span className="text-green-300">Client da xac nhan</span>
                        ) : (
                          <span className="text-amber-300">Cho client xac nhan</span>
                        )}
                      </div>
                      {typeof appointment.notes === 'string' && appointment.notes && (
                        <p className="mt-3 text-sm text-white/70">{appointment.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-start lg:items-end gap-3">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                        {String(appointment.status ?? 'scheduled')}
                      </span>

                      {(appointment.status === 'scheduled' ||
                        appointment.status === 'rescheduled' ||
                        appointment.status === 'no_show') && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCompleteAppointment(Number(appointment.id))}
                            disabled={busyAppointmentId === Number(appointment.id)}
                            className="rounded-xl bg-green-500/15 px-3 py-2 text-xs font-medium text-green-300 hover:bg-green-500/25 disabled:opacity-50 flex items-center gap-2"
                          >
                            <CheckCircle2 size={14} />
                            {busyAppointmentId === Number(appointment.id)
                              ? 'Dang xu ly...'
                              : 'Hoan tat'}
                          </button>
                          <button
                            onClick={() => handleCancelAppointment(Number(appointment.id))}
                            disabled={busyAppointmentId === Number(appointment.id)}
                            className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-50 flex items-center gap-2"
                          >
                            <XCircle size={14} />
                            Huy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
