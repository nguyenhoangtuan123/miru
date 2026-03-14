import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  IdCard,
  LoaderCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
} from '../../services/backend';
import {
  therapistAssignmentsQueryOptions,
  therapistClientsQueryOptions,
  therapistCrisesQueryOptions,
} from '../../queries/appQueries';

type TherapistClientRow = Record<string, unknown>;
type TherapistAssignmentRow = Record<string, unknown>;
type TherapistCrisisRow = Record<string, unknown>;

function getClientName(client: TherapistClientRow) {
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

  return 'Thân chủ';
}

function getClientEmail(client: TherapistClientRow) {
  const nested = client.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.email === 'string' && user.email.trim()) {
      return user.email;
    }
  }

  return 'Chưa có email';
}

function getAssignmentClientName(assignment: TherapistAssignmentRow) {
  const nested = assignment.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.name === 'string' && user.name.trim()) {
      return user.name;
    }
  }

  if (typeof assignment.client_id === 'string' && assignment.client_id.trim()) {
    return assignment.client_id;
  }

  return 'Thân chủ';
}

function getCrisisClientName(crisis: TherapistCrisisRow) {
  const nested = crisis.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.name === 'string' && user.name.trim()) {
      return user.name;
    }
  }

  if (typeof crisis.client_id === 'string' && crisis.client_id.trim()) {
    return crisis.client_id;
  }

  return 'Thân chủ';
}

export function TherapistDashboard() {
  const { user } = useAuth();
  const therapistId = user?.id ?? '';
  const canUseTherapistQueries = Boolean(user?.id && user.can_access_therapist_portal);
  const clientsQuery = useQuery({
    ...therapistClientsQueryOptions(therapistId),
    enabled: canUseTherapistQueries,
  });
  const assignmentsQuery = useQuery({
    ...therapistAssignmentsQueryOptions(therapistId),
    enabled: canUseTherapistQueries,
  });
  const crisesQuery = useQuery({
    ...therapistCrisesQueryOptions(therapistId),
    enabled: canUseTherapistQueries,
  });

  const clients = (clientsQuery.data?.clients ?? []) as TherapistClientRow[];
  const assignments = (assignmentsQuery.data?.assignments ?? []) as TherapistAssignmentRow[];
  const crises = (crisesQuery.data?.crises ?? []) as TherapistCrisisRow[];
  const isLoading =
    clientsQuery.isLoading || assignmentsQuery.isLoading || crisesQuery.isLoading;
  const error =
    clientsQuery.error ?? assignmentsQuery.error ?? crisesQuery.error;

  const stats = [
    {
      label: 'Thân chủ',
      value: String(clients.length),
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-400/20',
    },
    {
      label: 'Bài tập đã giao',
      value: String(assignments.length),
      icon: ClipboardList,
      color: 'text-purple-400',
      bg: 'bg-purple-400/20',
    },
    {
      label: 'Khủng hoảng mở',
      value: String(crises.length),
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-400/20',
    },
    {
      label: 'Hoàn thành',
      value: String(
        assignments.filter((item) => item.status === 'completed').length
      ),
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-400/20',
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Chào bác sĩ {user?.name?.split(' ').pop()},
          </h1>
          <p className="text-white/60">
            Dashboard này đang dùng dữ liệu thật từ `/api/therapist/*`.
          </p>
        </div>
        {isLoading && (
          <div className="text-sm text-white/40 flex items-center gap-2">
            <LoaderCircle size={16} className="animate-spin" />
            Đang tải
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error instanceof Error ? error.message : 'Không tải được dashboard therapist'}
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Link
          to="/therapist/profile"
          className="glass-panel flex items-start gap-4 rounded-[28px] border border-white/10 p-6 transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-miru-primary/18 text-miru-primary">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Hồ sơ công khai</h2>
            <p className="mt-2 text-sm leading-7 text-white/60">
              Cập nhật phần giới thiệu, chuyên môn, kênh liên hệ và chứng chỉ để hiển thị trên danh bạ công khai.
            </p>
          </div>
        </Link>

        <Link
          to="/therapist/client-profiles"
          className="glass-panel flex items-start gap-4 rounded-[28px] border border-white/10 p-6 transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-400/14 text-sky-200">
            <IdCard size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Hồ sơ riêng tư thân chủ</h2>
            <p className="mt-2 text-sm leading-7 text-white/60">
              Xem phan gioi thieu va gallery ma than chu da chon chia se sau khi pairing active.
            </p>
          </div>
        </Link>
      </div>

      {crises.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4"
        >
          <div className="p-2 bg-red-500/20 rounded-full text-red-400 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-red-400 font-semibold mb-1">Có cảnh báo khủng hoảng</h3>
            <p className="text-white/80 text-sm mb-2">
              {getCrisisClientName(crises[0])} vừa được đánh dấu là cần chú ý.
            </p>
            {typeof crises[0].message_snippet === 'string' && (
              <p className="text-sm text-white/60">{crises[0].message_snippet}</p>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.08 }}
              className="glass-panel p-6 flex flex-col items-center justify-center text-center"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${stat.bg} ${stat.color}`}
              >
                <Icon size={24} />
              </div>
              <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
              <p className="text-sm text-white/60">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Bài tập gần đây</h2>
            <span className="text-sm text-white/40">Từ backend</span>
          </div>
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                Chưa có bài tập nào được giao.
              </div>
            ) : (
              assignments.slice(0, 3).map((assignment) => (
                <div
                  key={String(assignment.id ?? assignment.title)}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl"
                >
                  <h4 className="font-medium">{String(assignment.title ?? 'Bài tập')}</h4>
                  <p className="text-xs text-white/50 mt-1">
                    {getAssignmentClientName(assignment)}
                  </p>
                  {typeof assignment.description === 'string' && (
                    <p className="text-sm text-white/70 mt-3 line-clamp-2">
                      {assignment.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Thân chủ của bạn</h2>
            <span className="text-sm text-white/40">{clients.length} người</span>
          </div>
          <div className="space-y-4">
            {clients.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                Chưa có thân chủ nào được ghép cặp cho tài khoản này.
              </div>
            ) : (
              clients.slice(0, 4).map((client) => (
                <div
                  key={String(client.id ?? client.client_id ?? getClientName(client))}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-medium">{getClientName(client)}</h4>
                    <p className="text-xs text-white/50 mt-1">{getClientEmail(client)}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    {typeof client.status === 'string' ? client.status : 'active'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
