import Link from "next/link";

import { formatPrice, serviceModeLabel } from "../../lib/format";
import type { PublicTherapist } from "../../lib/types";

type TherapistCardProps = {
  therapist: PublicTherapist;
};

export function TherapistCard({ therapist }: TherapistCardProps) {
  return (
    <Link href={`/therapists/${therapist.therapist_id}`} className="surface-card therapist-card">
      <div className="therapist-header">
        <div className="avatar-tile" aria-hidden="true">
          {therapist.avatar_image?.url ? (
            <img src={therapist.avatar_image.url} alt={therapist.display_name} />
          ) : (
            therapist.display_name.charAt(0)
          )}
        </div>

        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontFamily: "var(--font-headline)", fontSize: 24 }}>
              {therapist.display_name}
            </strong>
            {therapist.is_verified ? <span className="verified-pill">Đã xác minh</span> : null}
          </div>
          {therapist.headline ? (
            <div className="muted-copy" style={{ marginTop: 8 }}>
              {therapist.headline}
            </div>
          ) : null}
        </div>
      </div>

      <div className="chip-row">
        <span className="chip">{serviceModeLabel(therapist.service_mode)}</span>
        <span className="chip">{formatPrice(therapist.starting_price_vnd, therapist.pricing_unit)}</span>
      </div>

      <p className="article-excerpt" style={{ margin: 0 }}>
        {therapist.bio || "Hồ sơ therapist đang được hoàn thiện thêm trên Miru."}
      </p>

      {therapist.specializations.length > 0 ? (
        <div className="chip-row">
          {therapist.specializations.slice(0, 3).map((item) => (
            <span className="chip" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="article-meta" style={{ marginTop: "auto" }}>
        <span>{therapist.accepting_new_clients ? "Đang nhận thân chủ" : "Tạm kín lịch"}</span>
        <span>&bull;</span>
        <span>{therapist.contact_request_count} yêu cầu liên hệ</span>
      </div>
    </Link>
  );
}
