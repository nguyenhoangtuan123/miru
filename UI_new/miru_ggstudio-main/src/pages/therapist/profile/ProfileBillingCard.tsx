import type { Dispatch, SetStateAction } from 'react';
import type { TherapistBillingProfileForm } from '../../../services/profiles';

type Props = {
  billingForm: TherapistBillingProfileForm;
  savingBilling: boolean;
  setBillingForm: Dispatch<SetStateAction<TherapistBillingProfileForm>>;
  onSaveBilling: () => void;
};

export function ProfileBillingCard({
  billingForm,
  savingBilling,
  setBillingForm,
  onSaveBilling,
}: Props) {
  return (
    <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        Thanh toán nội bộ
      </h2>
      <div className="mt-4 grid gap-4">
        <input
          value={billingForm.payment_mode ?? ''}
          onChange={(event) =>
            setBillingForm((current) => ({
              ...current,
              payment_mode: event.target.value,
            }))
          }
          placeholder="Hình thức thanh toán"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <input
          value={billingForm.bank_account_name ?? ''}
          onChange={(event) =>
            setBillingForm((current) => ({
              ...current,
              bank_account_name: event.target.value,
            }))
          }
          placeholder="Tên chủ tài khoản"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <input
          value={billingForm.bank_name ?? ''}
          onChange={(event) =>
            setBillingForm((current) => ({
              ...current,
              bank_name: event.target.value,
            }))
          }
          placeholder="Ngân hàng"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <input
          value={billingForm.bank_account_number ?? ''}
          onChange={(event) =>
            setBillingForm((current) => ({
              ...current,
              bank_account_number: event.target.value,
            }))
          }
          placeholder="Số tài khoản"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <input
          value={billingForm.momo_phone ?? ''}
          onChange={(event) =>
            setBillingForm((current) => ({
              ...current,
              momo_phone: event.target.value,
            }))
          }
          placeholder="Số MoMo / ZaloPay"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <textarea
          value={billingForm.transfer_note ?? ''}
          onChange={(event) =>
            setBillingForm((current) => ({
              ...current,
              transfer_note: event.target.value,
            }))
          }
          rows={3}
          placeholder="Cú pháp chuyển khoản"
          className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <button
          onClick={onSaveBilling}
          disabled={savingBilling}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          {savingBilling ? 'Đang lưu...' : 'Lưu thông tin thanh toán'}
        </button>
      </div>
    </section>
  );
}
