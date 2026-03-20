import { ImageResponse } from "next/og";

export const alt = "Miru public site";
export const size = {
  width: 1200,
  height: 630
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: 56,
          backgroundColor: "#f6f6fb",
          color: "#2d2f33",
          fontFamily: "Arial, sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            borderRadius: 42,
            padding: 44,
            background: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(129,28,217,0.08)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: 58,
                  fontWeight: 800,
                  letterSpacing: "-0.06em",
                  color: "#811cd9"
                }}
              >
                Miru
              </div>
              <div style={{ fontSize: 24, color: "#5a5b60", maxWidth: 560 }}>
                Therapist directory, thư viện bài viết và public site cho tăng trưởng SEO.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 140,
                height: 140,
                borderRadius: 36,
                background: "linear-gradient(135deg, #811cd9 0%, #c185ff 100%)",
                color: "white",
                fontSize: 46,
                fontWeight: 800
              }}
            >
              AI
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 860 }}>
            <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 0.96 }}>
              Hiểu mình sâu hơn, kết nối therapist rõ hơn.
            </div>
            <div style={{ fontSize: 30, color: "#4c3f72", lineHeight: 1.35 }}>
              Public site tách riêng bằng Next.js để landing page, bài viết và hồ sơ therapist được render tốt
              cho tìm kiếm và chia sẻ.
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
