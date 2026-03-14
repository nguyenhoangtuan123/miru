import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useConsent } from '../../contexts/ConsentContext';
import {
  Bell,
  ChevronRight,
  Copy,
  Download,
  Globe,
  Key,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { usePwa } from '../../contexts/PwaContext';
import { createTherapistPairingCode } from '../../services/backend';
import { repairMojibake } from '../../lib/text';

export function TherapistSettings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { consent } = useConsent();
  const { canInstall, installApp, notificationPermission, enableNotifications } = usePwa();
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);

  async function handleGenerateCode() {
    if (!user?.id) {
      return;
    }

    try {
      setIsGeneratingCode(true);
      setPairingError(null);
      const response = await createTherapistPairingCode(user.id);
      setPairingCode(
        typeof response.pairing?.pairing_code === 'string'
          ? response.pairing.pairing_code
          : null
      );
    } catch (error) {
      setPairingError(
        error instanceof Error ? repairMojibake(error.message) : 'Không tạo được mã kết nối'
      );
    } finally {
      setIsGeneratingCode(false);
    }
  }

  async function handleCopyCode() {
    if (!pairingCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pairingCode);
    } catch {
      // Ignore clipboard failures in unsupported browsers.
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

  const settingsGroups = [
    {
      title: 'Tài khoản',
      items: [
        { icon: User, label: 'Thông tin cá nhân', value: '' },
        { icon: Shield, label: 'Bảo mật', value: '' },
        { icon: Key, label: 'Xác thực', value: 'Google OAuth' },
      ],
    },
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
              {user?.name?.charAt(0) || 'T'}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{repairMojibake(user?.name || 'Nhà trị liệu')}</h2>
            <p className="text-white/50 text-sm">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-miru-primary/20 text-miru-primary rounded-md text-xs font-medium">
              Nhà trị liệu
            </span>
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
                  Cai dashboard therapist de mo nhanh nhu mot ung dung rieng tren may.
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
                  Nhan thong bao khi than chu nhan tin, AI canh bao va cac su kien quan trong.
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Mã kết nối thân chủ</h3>
              <p className="text-sm text-white/60">
                Tạo mã rồi gửi cho thân chủ để họ kết nối với bạn.
              </p>
            </div>
            <button
              onClick={handleGenerateCode}
              disabled={isGeneratingCode}
              className="glass-button px-4 py-2 rounded-xl font-medium disabled:opacity-60"
            >
              {isGeneratingCode ? 'Đang tạo...' : pairingCode ? 'Tạo mã mới' : 'Tạo mã'}
            </button>
          </div>

          {pairingCode && (
            <div className="mt-6 rounded-2xl border border-miru-primary/30 bg-miru-primary/10 p-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">
                  Pairing Code
                </div>
                <div className="text-3xl font-bold tracking-[0.35em] text-miru-primary">
                  {pairingCode}
                </div>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Copy size={16} />
                Sao chép
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
                      } text-white`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} className="text-white/50" />
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
            className="w-full glass-panel p-4 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-white/10 transition-colors font-medium"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
