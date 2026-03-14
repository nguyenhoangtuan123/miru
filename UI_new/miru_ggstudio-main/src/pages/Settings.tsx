import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useConsent } from '../contexts/ConsentContext';
import {
  Bell,
  ChevronRight,
  Download,
  Globe,
  Link2,
  LogOut,
  Moon,
  Stethoscope,
  Sun,
  Trash2,
} from 'lucide-react';
import { usePwa } from '../contexts/PwaContext';
import {
  connectToTherapist,
  deleteAllMemories,
  getClientTherapist,
} from '../services/backend';
import { repairMojibake } from '../lib/text';

export function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { consent } = useConsent();
  const { canInstall, installApp, notificationPermission, enableNotifications } = usePwa();
  const [isDeleting, setIsDeleting] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [pairing, setPairing] = useState<Record<string, unknown> | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadPairing = async () => {
      try {
        const response = await getClientTherapist(user.id);
        if (!cancelled) {
          setPairing((response.pairing as Record<string, unknown> | null) ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setPairing(null);
          setPairingError(error instanceof Error ? error.message : null);
        }
      }
    };

    void loadPairing();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleConnectTherapist() {
    if (!user?.id || !pairingCode.trim()) {
      return;
    }

    try {
      setIsConnecting(true);
      setPairingError(null);
      const response = await connectToTherapist(user.id, pairingCode.trim().toUpperCase());
      setPairing((response.pairing as Record<string, unknown> | null) ?? null);
      setPairingCode('');
    } catch (error) {
      setPairingError(
        error instanceof Error ? error.message : 'Không kết nối được nhà trị liệu'
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDeleteData() {
    if (!user?.id) {
      alert('Chưa có user để xóa dữ liệu.');
      return;
    }

    if (
      !window.confirm(
        'Bạn có chắc chắn muốn xóa toàn bộ dữ liệu memory? Hành động này không thể hoàn tác.'
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await deleteAllMemories(user.id);

      if (!response.success) {
        throw new Error(response.error ?? 'Không xóa được dữ liệu');
      }

      alert('Đã xóa dữ liệu memory thành công.');
    } catch (error) {
      console.error('Failed to delete data:', error);
      alert(error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa dữ liệu');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleInstallApp() {
    try {
      setIsInstalling(true);
      await installApp();
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleEnableNotifications() {
    try {
      setIsRequestingNotifications(true);
      await enableNotifications();
    } finally {
      setIsRequestingNotifications(false);
    }
  }

  const therapist = pairing?.therapist && typeof pairing.therapist === 'object'
    ? (pairing.therapist as Record<string, unknown>)
    : null;

  const settingsGroups = [
    {
      title: 'Tùy chọn ứng dụng',
      items: [
        { icon: Bell, label: 'Thông báo', value: 'Bật' },
        {
          icon: theme === 'dark' ? Moon : Sun,
          label: 'Giao diện',
          value: theme === 'dark' ? 'Tối' : 'Sáng',
          onClick: toggleTheme,
        },
        { icon: Globe, label: 'Ngôn ngữ', value: 'Tiếng Việt' },
      ],
    },
    {
      title: 'Dữ liệu',
      items: [
        {
          icon: Trash2,
          label: isDeleting ? 'Đang xóa dữ liệu...' : 'Xóa toàn bộ memory',
          value: '',
          danger: true,
          onClick: handleDeleteData,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-miru-bg p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Cài đặt</h1>

        <div className="glass-panel p-6 flex items-center gap-5 mb-8">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-miru-primary/20 flex items-center justify-center text-2xl font-bold text-miru-primary border-2 border-white/10">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{repairMojibake(user?.name || 'Người dùng')}</h2>
            <p className="text-white/50 text-sm">{user?.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5">
            <div className="text-sm uppercase tracking-[0.25em] text-white/40 mb-2">
              Cam kết sử dụng
            </div>
            <h3 className="text-lg font-semibold">Đã chấp thuận</h3>
            <p className="text-sm text-white/60 mt-1">
              {consent?.accepted_at
                ? `Lần gần nhất: ${new Date(consent.accepted_at).toLocaleString('vi-VN')}`
                : 'Chưa có thời điểm xác nhận'}
            </p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-miru-primary/20 flex items-center justify-center text-miru-primary shrink-0">
                <Download size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Cai Miru thanh app</h3>
                <p className="text-sm text-white/60 mt-1">
                  Cai Miru len may de mo nhanh nhu mot ung dung rieng.
                </p>
                <button
                  onClick={handleInstallApp}
                  disabled={!canInstall || isInstalling}
                  className="mt-4 glass-button px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                >
                  {isInstalling ? 'Dang cai dat...' : canInstall ? 'Cai ung dung' : 'Da san sang tren thiet bi nay'}
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-miru-primary/20 flex items-center justify-center text-miru-primary shrink-0">
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Thong bao he thong</h3>
                <p className="text-sm text-white/60 mt-1">
                  Nhan thong bao khi Miru phan hoi, nha tri lieu nhan tin, giao bai tap moi.
                </p>
                <button
                  onClick={handleEnableNotifications}
                  disabled={notificationPermission === 'granted' || isRequestingNotifications}
                  className="mt-4 glass-button px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                >
                  {isRequestingNotifications
                    ? 'Dang bat thong bao...'
                    : notificationPermission === 'granted'
                      ? 'Thong bao da duoc bat'
                      : notificationPermission === 'denied'
                        ? 'Trinh duyet dang chan thong bao'
                        : 'Bat thong bao'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 mb-8">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-miru-primary/20 flex items-center justify-center text-miru-primary shrink-0">
              <Stethoscope size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Liên kết nhà trị liệu</h3>
              <p className="text-sm text-white/60">
                Nhập mã mà nhà trị liệu gửi cho bạn để bắt đầu nhận bài tập và nhắn tin.
              </p>
            </div>
          </div>

          {therapist ? (
            <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">
                Đã kết nối
              </div>
              <div className="text-lg font-semibold">{repairMojibake(String(therapist.name ?? 'Nhà trị liệu'))}</div>
              <div className="text-sm text-white/60 mt-1">{String(therapist.email ?? '')}</div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={pairingCode}
                  onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                  placeholder="Nhập pairing code..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 transition-colors tracking-[0.25em]"
                />
              </div>
              <button
                onClick={handleConnectTherapist}
                disabled={isConnecting || !pairingCode.trim()}
                className="glass-button px-5 py-3 rounded-2xl font-medium disabled:opacity-60"
              >
                {isConnecting ? 'Đang kết nối...' : 'Kết nối'}
              </button>
            </div>
          )}

          {pairingError && (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {pairingError}
            </div>
          )}
        </div>

        <div className="space-y-8">
          {settingsGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 px-4">
                {group.title}
              </h3>
              <div className="glass-panel overflow-hidden">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      onClick={item.onClick}
                      className={`flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                        item.onClick ? 'cursor-pointer' : ''
                      } ${item.danger ? 'text-red-400' : 'text-white'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          size={20}
                          className={item.danger ? 'text-red-400' : 'text-white/50'}
                        />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.value && (
                          <span className="text-sm text-white/50">{item.value}</span>
                        )}
                        <ChevronRight size={18} className="text-white/20" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={logout}
            className="w-full glass-panel p-4 flex items-center justify-center gap-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
