import { useState } from 'react';
import { LoaderCircle, MessageCircle, Search, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { repairMojibake } from '../../lib/text';
import { useAuth } from '../../contexts/AuthContext';
import { therapistClientsQueryOptions } from '../../queries/appQueries';

type TherapistClientRow = Record<string, unknown>;

function vi(text: string) {
  return repairMojibake(text);
}

function getClientName(client: TherapistClientRow) {
  const nested = client.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.name === 'string' && user.name.trim()) {
      return vi(user.name);
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

function getClientId(client: TherapistClientRow) {
  if (typeof client.client_id === 'string' && client.client_id.trim()) {
    return client.client_id;
  }

  if (typeof client.id === 'string' && client.id.trim()) {
    return client.id;
  }

  return getClientName(client);
}

export function TherapistClients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const clientsQuery = useQuery({
    ...therapistClientsQueryOptions(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });
  const clients = (clientsQuery.data?.clients ?? []) as TherapistClientRow[];
  const isLoading = clientsQuery.isLoading;
  const error =
    clientsQuery.error instanceof Error ? clientsQuery.error.message : null;

  const filteredClients = clients.filter((client) => {
    const name = getClientName(client).toLowerCase();
    const email = getClientEmail(client).toLowerCase();
    const status = typeof client.status === 'string' ? client.status.toLowerCase() : 'active';

    const matchesSearch =
      !searchQuery.trim() ||
      name.includes(searchQuery.trim().toLowerCase()) ||
      email.includes(searchQuery.trim().toLowerCase());

    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Quản lý thân chủ</h1>
          <p className="text-white/60">
            Chạm vào từng thân chủ để xem tiến độ, giao bài tập, nhắn tin và theo dõi hỗ trợ.
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <LoaderCircle size={16} className="animate-spin" />
            Đang tải
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="glass-panel p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white placeholder:text-white/40 transition-colors focus:border-miru-primary/50 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white transition-colors focus:border-miru-primary/50 focus:outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngưng</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 text-sm text-white/50">
                <th className="px-4 pb-4 font-medium">Thân chủ</th>
                <th className="px-4 pb-4 font-medium">Trạng thái</th>
                <th className="px-4 pb-4 font-medium">Ghép cặp</th>
                <th className="px-4 pb-4 font-medium text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-white/40">
                    Chưa có thân chủ nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client, idx) => {
                  const clientId = getClientId(client);
                  const clientName = getClientName(client);
                  const clientEmail = getClientEmail(client);
                  const status = typeof client.status === 'string' ? client.status : 'active';
                  const pairedAt =
                    typeof client.paired_at === 'string'
                      ? new Date(client.paired_at).toLocaleDateString('vi-VN')
                      : 'Không rõ';

                  return (
                    <motion.tr
                      key={`${clientId}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
                      onClick={() => navigate(`/therapist/clients/${clientId}`)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-miru-primary/20 font-bold text-miru-primary">
                            {clientName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{clientName}</p>
                            <p className="text-sm text-white/50">{clientEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-white/70">{pairedAt}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/therapist/clients/${clientId}`);
                            }}
                          >
                            Giao bài tập
                          </button>
                          <button
                            className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-black/30"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/therapist/messages?client=${clientId}`);
                            }}
                          >
                            <MessageCircle size={14} />
                            Nhắn tin
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {clients.length === 0 && !isLoading && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
            <User size={18} />
            Tài khoản therapist hiện tại chưa có thân chủ nào được ghép cặp trong hệ thống.
          </div>
        )}
      </div>
    </div>
  );
}
