import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  ShieldCheck,
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
  const therapistVerificationStatus = user?.therapist_status ?? 'not_submitted';
  const needsTherapistVerification =
    user?.role === 'therapist' && !user?.can_access_therapist_portal;
  const therapistVerificationHref =
    therapistVerificationStatus === 'pending' ? '/therapist/review-status' : '/therapist/apply';

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
          {needsTherapistVerification && (
            <div className="glass-panel p-5 md:col-span-2">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-400/14 flex items-center justify-center text-emerald-200 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {therapistVerificationStatus === 'pending'
                      ? 'Hồ sơ xác thực đang chờ duyệt'
                      : therapistVerificationStatus === 'rejected'
                        ? 'Hồ sơ xác thực cần bổ sung'
                        : 'Xác thực tài khoản nhà trị liệu'}
                  </h3>
                  <p className="text-sm text-white/60 mt-1">
                    {therapistVerificationStatus === 'pending'
                      ? 'Bạn đã nộp hồ sơ. Mở trang trạng thái để theo dõi xét duyệt trước khi dùng khu therapist.'
                      : therapistVerificationStatus === 'rejected'
                        ? 'Hồ sơ trước đó chưa đạt. Mở lại biểu mẫu để bổ sung minh chứng nghề nghiệp và gửi duyệt lại.'
                        : 'Tài khoản therapist cần nộp minh chứng nghề nghiệp trước khi vào khu therapist và dùng các công cụ dành cho nhà trị liệu.'}
                  </p>
                  <Link
                    to={therapistVerificationHref}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    {therapistVerificationStatus === 'pending'
                      ? 'Xem trạng thái xét duyệt'
                      : 'Mở hồ sơ xác thực'}
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          )}

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
                <h3 className="text-lg font-semibold">Cài Miru thành app</h3>
                <p className="text-sm text-white/60 mt-1">
                  Cài Miru lên máy để mở nhanh như một ứng dụng riêng.
                </p>
                <button
                  onClick={handleInstallApp}
                  disabled={!canInstall || isInstalling}
                  className="mt-4 glass-button px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                >
                  {isInstalling ? 'Đang cài đặt...' : canInstall ? 'Cài ứng dụng' : 'Đã sẵn sàng trên thiết bị này'}
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
                <h3 className="text-lg font-semibold">Thông báo hệ thống</h3>
                <p className="text-sm text-white/60 mt-1">
                  Nhận thông báo khi Miru phản hồi, nhà trị liệu nhắn tin, giao bài tập mới.
                </p>
                <button
                  onClick={handleEnableNotifications}
                  disabled={notificationPermission === 'granted' || isRequestingNotifications}
                  className="mt-4 glass-button px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                >
                  {isRequestingNotifications
                    ? 'Đang bật thông báo...'
                    : notificationPermission === 'granted'
                      ? 'Thông báo đã được bật'
                      : notificationPermission === 'denied'
                        ? 'Trình duyệt đang chặn thông báo'
                        : 'Bật thông báo'}
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

        <Link
          to="/sharing"
          className="glass-panel mb-8 flex items-start gap-4 p-6 transition-colors hover:bg-white/8"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-miru-primary/20 text-miru-primary">
            <ShieldCheck size={20} />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-lg font-semibold">Chia sẻ dữ liệu với therapist</div>
            <p className="text-sm text-white/60">
              Chọn riêng cho từng therapist mức chia sẻ chat AI, hoạt động trên web, kết quả thang đo và AI insights.
            </p>
          </div>
          <ChevronRight size={18} className="mt-1 text-white/35" />
        </Link>

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
                      className={`flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${item.onClick ? 'cursor-pointer' : ''
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
