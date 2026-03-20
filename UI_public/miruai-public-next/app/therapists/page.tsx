import { TherapistCard } from "../../components/public/TherapistCard";
import { filterByKeyword } from "../../lib/format";
import { getPublicTherapists } from "../../lib/data";

type TherapistsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export const metadata = {
  title: "Danh bạ therapist"
};

export default async function TherapistsPage({ searchParams }: TherapistsPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const keyword = resolvedSearchParams.q || "";
  const therapists = await getPublicTherapists(24);
  const filteredTherapists = filterByKeyword(
    therapists,
    keyword,
    (therapist) =>
      `${therapist.display_name} ${therapist.headline || ""} ${therapist.bio || ""} ${therapist.specializations.join(" ")}`
  );

  return (
    <div className="page-gap">
      <header className="section-head">
        <div className="eyebrow">Danh bạ therapist</div>
        <h1 className="section-title">Tìm một người thật phù hợp với cách bạn muốn được đồng hành.</h1>
        <p className="section-copy">
          Hồ sơ therapist công khai trên Miru cho biết cách làm việc, hình thức hỗ trợ, giá khởi điểm và việc
          họ có đang nhận thân chủ mới hay không.
        </p>
      </header>

      <form className="search-shell" action="/therapists">
        <input
          className="search-input"
          type="search"
          name="q"
          defaultValue={keyword}
          placeholder="Tìm theo tên therapist hoặc chuyên môn..."
        />
      </form>

      {filteredTherapists.length > 0 ? (
        <div className="therapist-grid">
          {filteredTherapists.map((therapist) => (
            <TherapistCard key={therapist.therapist_id} therapist={therapist} />
          ))}
        </div>
      ) : (
        <div className="surface-card empty-card">
          Không tìm thấy therapist phù hợp với từ khoá hiện tại.
        </div>
      )}
    </div>
  );
}
