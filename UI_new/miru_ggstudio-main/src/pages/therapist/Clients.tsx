import { useEffect, useState } from 'react';
import { LoaderCircle, MoreVertical, Search, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTherapistClients } from '../../services/backend';

type TherapistClientRow = Record<string, unknown>;

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
  const [clients, setClients] = useState<TherapistClientRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadClients = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getTherapistClients(user.id);

        if (!cancelled) {
          setClients(response.clients);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Không tải được danh sách thân chủ'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadClients();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filteredClients = clients.filter((client) => {
    const name = getClientName(client).toLowerCase();
    const email = getClientEmail(client).toLowerCase();
    const status =
      typeof client.status === 'string' ? client.status.toLowerCase() : 'active';

    const matchesSearch =
      !searchQuery.trim() ||
      name.includes(searchQuery.trim().toLowerCase()) ||
      email.includes(searchQuery.trim().toLowerCase());

    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quản lý Thân chủ</h1>
          <p className="text-white/60">
            Danh sách này đang đọc trực tiếp từ `/api/therapist/clients/{'{therapist_id}'}`.
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
          {error}
        </div>
      )}

      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-miru-primary/50 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-miru-primary/50 transition-colors appearance-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-sm">
                <th className="pb-4 font-medium px-4">Thân chủ</th>
                <th className="pb-4 font-medium px-4">Trạng thái</th>
                <th className="pb-4 font-medium px-4">Ghép cặp</th>
                <th className="pb-4 font-medium px-4 text-right">Hành động</th>
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
                  const status =
                    typeof client.status === 'string' ? client.status : 'active';
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
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/therapist/clients/${clientId}`)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-miru-primary/20 flex items-center justify-center text-miru-primary font-bold">
                            {clientName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{clientName}</p>
                            <p className="text-sm text-white/50">{clientEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-white/70 text-sm">{pairedAt}</td>
                      <td className="py-4 px-4 text-right">
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreVertical size={20} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {clients.length === 0 && !isLoading && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50 flex items-center gap-3">
            <User size={18} />
            Tài khoản therapist hiện tại chưa có client nào được ghép cặp trong backend.
          </div>
        )}
      </div>
    </div>
  );
}
