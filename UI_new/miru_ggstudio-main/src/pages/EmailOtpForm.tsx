import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

interface EmailOtpFormProps {
    intent: 'client' | 'therapist';
    returnTo: string;
}

type Step = 'email' | 'code';

export function EmailOtpForm({ intent, returnTo }: EmailOtpFormProps) {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const codeInputRef = useRef<HTMLInputElement>(null);

    // Countdown timer for resend cooldown
    useEffect(() => {
        if (cooldown <= 0) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return;
        }
        cooldownRef.current = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, [cooldown]);

    // Auto-focus code input
    useEffect(() => {
        if (step === 'code') {
            setTimeout(() => codeInputRef.current?.focus(), 200);
        }
    }, [step]);

    const requestCode = useCallback(async () => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('Vui lòng nhập email hợp lệ');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/email/request-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: trimmedEmail,
                    intent,
                    surface: 'app',
                    return_to: returnTo,
                    entry: 'app_login_otp',
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || 'Không thể gửi mã xác thực');
                return;
            }

            setStep('code');
            setCooldown(60);
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [email, intent, returnTo]);

    const verifyCode = useCallback(async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length !== 6) {
            setError('Vui lòng nhập mã 6 chữ số');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/email/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code: trimmedCode,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || 'Mã không đúng hoặc đã hết hạn');
                return;
            }

            if (data.redirect_url) {
                window.location.replace(data.redirect_url);
            }
        } catch {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [code, email]);

    const handleResend = useCallback(async () => {
        if (cooldown > 0) return;
        setCode('');
        setError(null);
        await requestCode();
    }, [cooldown, requestCode]);

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
        >
            <AnimatePresence mode="wait">
                {step === 'email' ? (
                    <motion.div
                        key="email-step"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-3"
                    >
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && !loading && requestCode()}
                            placeholder="Nhập email của bạn"
                            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40
                         py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-miru-primary/50
                         transition-all"
                            disabled={loading}
                            autoFocus
                        />
                        <button
                            onClick={requestCode}
                            disabled={loading || !email.trim()}
                            className="w-full bg-white/10 border border-white/20 hover:bg-white/20
                         text-white transition-all py-3 px-6 rounded-xl font-semibold
                         flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <Mail size={20} />
                            )}
                            Gửi mã xác thực
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="code-step"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-3"
                    >
                        <button
                            onClick={() => {
                                setStep('email');
                                setCode('');
                                setError(null);
                            }}
                            className="text-white/50 hover:text-white/80 text-sm flex items-center gap-1 transition-colors"
                        >
                            <ArrowLeft size={14} />
                            Đổi email
                        </button>

                        <p className="text-white/60 text-sm">
                            Mã đã gửi đến <span className="text-white font-medium">{email}</span>
                        </p>

                        <input
                            ref={codeInputRef}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={code}
                            onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setCode(digits);
                                setError(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && !loading && code.length === 6 && verifyCode()}
                            placeholder="000000"
                            className="w-full bg-white/10 border border-white/20 text-white text-center text-2xl
                         tracking-[0.5em] font-mono py-3 px-4 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-miru-primary/50 transition-all
                         placeholder:tracking-[0.5em] placeholder:text-white/20"
                            disabled={loading}
                        />

                        <button
                            onClick={verifyCode}
                            disabled={loading || code.length !== 6}
                            className="w-full bg-white/10 border border-white/20 hover:bg-white/20
                         text-white transition-all py-3 px-6 rounded-xl font-semibold
                         flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                'Xác nhận'
                            )}
                        </button>

                        <button
                            onClick={handleResend}
                            disabled={cooldown > 0}
                            className="w-full text-sm text-white/40 hover:text-white/70 transition-colors disabled:cursor-not-allowed"
                        >
                            {cooldown > 0
                                ? `Gửi lại mã sau ${cooldown}s`
                                : 'Gửi lại mã'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200 text-center"
                >
                    {error}
                </motion.div>
            )}
        </motion.div>
    );
}
