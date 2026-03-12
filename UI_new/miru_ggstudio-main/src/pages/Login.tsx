import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Stethoscope, User } from 'lucide-react';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const clientNextPath = state?.from?.pathname || '/chat';
  const therapistNextPath = state?.from?.pathname?.startsWith('/therapist')
    ? state.from.pathname
    : '/therapist';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] rounded-full bg-miru-primary/20 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 md:p-12 w-full max-w-md text-center z-10"
      >
        <div className="w-20 h-20 bg-miru-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(127,13,242,0.3)]">
          <LogIn size={40} className="text-miru-primary" />
        </div>

        <h1 className="text-3xl font-bold mb-3">Đăng nhập</h1>
        <p className="text-white/60 mb-10">
          Xác thực bằng Google rồi quay lại đúng màn bạn đang cần.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => login('client', clientNextPath)}
            className="w-full bg-white text-black hover:bg-gray-100 transition-colors py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-3"
          >
            <User size={20} />
            Đăng nhập với tư cách Người dùng
          </button>

          <button
            onClick={() => login('therapist', therapistNextPath)}
            className="w-full bg-miru-primary/20 text-miru-primary hover:bg-miru-primary/30 border border-miru-primary/50 transition-colors py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-3"
          >
            <Stethoscope size={20} />
            Đăng nhập với tư cách Nhà trị liệu
          </button>
        </div>
      </motion.div>
    </div>
  );
}
