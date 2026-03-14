import { LoaderCircle, MessageCircle, Send } from 'lucide-react';
import type { MessageRow } from './types';
import { formatDateTime, vi } from './helpers';

type TherapistMessagesSectionProps = {
  messages: MessageRow[];
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  isSendingMessage: boolean;
  onSendMessage: () => Promise<void>;
};

export function TherapistMessagesSection({
  messages,
  messageDraft,
  setMessageDraft,
  isSendingMessage,
  onSendMessage,
}: TherapistMessagesSectionProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MessageCircle size={18} />
        Nhắn tin với nhà trị liệu
      </h3>

      <div className="mb-4 max-h-[380px] space-y-3 overflow-y-auto pr-2">
        {messages.length === 0 ? (
          <div className="text-sm text-white/50">Chưa có tin nhắn nào.</div>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_type === 'client';
            return (
              <div
                key={String(message.id ?? `${message.sender_type}-${message.created_at}`)}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    isMine ? 'bg-miru-primary text-white' : 'bg-white/8 text-white/85'
                  }`}
                >
                  <div>{vi(String(message.message_content ?? ''))}</div>
                  <div
                    className={`mt-2 text-[11px] ${
                      isMine ? 'text-white/70' : 'text-white/40'
                    }`}
                  >
                    {formatDateTime(message.created_at, '')}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={messageDraft}
          onChange={(event) => setMessageDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void onSendMessage();
            }
          }}
          placeholder="Gửi tin nhắn cho nhà trị liệu..."
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 transition-colors focus:border-miru-primary/50 focus:outline-none"
        />
        <button
          onClick={() => void onSendMessage()}
          disabled={!messageDraft.trim() || isSendingMessage}
          className="glass-button flex items-center gap-2 rounded-2xl px-5 py-3 font-medium disabled:opacity-60"
        >
          {isSendingMessage ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
          Gửi
        </button>
      </div>
    </div>
  );
}
