import type { Metadata } from "next";
import { CommunityFeed } from "../../components/public/CommunityFeed";

export const metadata: Metadata = {
    title: "Hỏi đáp cộng đồng | Miru",
    description:
        "Đặt câu hỏi công khai cho đội ngũ Miru. Câu hỏi sẽ được xem xét và điều hướng tới therapist phù hợp.",
};

export default function HoiDapPage() {
    return <CommunityFeed />;
}
