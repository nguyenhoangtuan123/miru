from __future__ import annotations

from statistics import mean
from typing import Any, Dict, List, Optional

TRAJECTORY_VERSION = "hook1-v1"

STATE_KEEPING_INSIDE = "Giữ mọi thứ một mình"
STATE_OPENING_UP = "Bắt đầu mở lời"
STATE_OVERWHELMED = "Quá tải gần đây"
STATE_STABILIZING = "Đang tìm lại nhịp ổn định"
STATE_PATTERN_REFLECTION = "Đang nhìn lại các mẫu lặp"
STATE_NEEDS_HUMAN_SUPPORT = "Cần thêm điểm tựa người thật"
STATE_LISTENING_CLOSER = "Lắng nghe mình rõ hơn"

PRIMARY_REASON_LABELS = {
    "stress": "áp lực gần đây",
    "anxiety": "lo âu gần đây",
    "sadness": "nỗi buồn kéo dài",
    "loneliness": "cảm giác cô đơn",
    "burnout": "dấu hiệu kiệt sức",
    "relationship": "khó khăn trong mối quan hệ",
    "self_understanding": "nhu cầu hiểu mình rõ hơn",
    "other": "những điều khó gọi tên",
}


def _clamp(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, int(round(value))))


def _safe_mean(values: List[float]) -> float:
    return mean(values) if values else 0.0


def _normalized_text_blob(items: List[str]) -> str:
    return " ".join(text.strip().lower() for text in items if isinstance(text, str) and text.strip())


def _mood_trend(moods: List[Dict[str, Any]]) -> str:
    scores = [float(item.get("emotion_score") or 0) for item in moods if item.get("emotion_score") is not None]
    if len(scores) < 4:
        return "unknown"
    recent = _safe_mean(scores[:3])
    previous = _safe_mean(scores[3:6] or scores[:3])
    delta = recent - previous
    if delta >= 1.0:
        return "improving"
    if delta <= -1.0:
        return "worsening"
    return "steady"


def _assessment_distress_score(latest_self_assessment: Optional[Dict[str, Any]]) -> int:
    result = (latest_self_assessment or {}).get("result") or {}
    severity = str(result.get("severity") or "").lower()
    total_score = result.get("total_score")
    score = 0

    if any(token in severity for token in ["severe", "nặng", "rất cao"]):
        score += 40
    elif any(token in severity for token in ["moderate", "vừa", "cao"]):
        score += 26
    elif any(token in severity for token in ["mild", "nhẹ"]):
        score += 12

    if isinstance(total_score, (int, float)):
        score += min(int(total_score), 30)

    return _clamp(score)


def _feedback_requests_softening(feedback: Optional[Dict[str, Any]]) -> bool:
    if not feedback:
        return False

    feedback_type = str(feedback.get("feedback_type") or "").strip().lower()
    note = str(feedback.get("note") or "").strip().lower()

    if feedback_type in {"not_right", "too_strong", "too_harsh", "not_me"}:
        return True

    return any(token in note for token in ["chưa đúng", "không đúng", "khong dung", "không phải", "khong phai"])


def derive_trajectory_snapshot(inputs: Dict[str, Any]) -> Dict[str, Any]:
    intake = inputs.get("intake") or {}
    latest_self_assessment = inputs.get("latest_self_assessment") or {}
    journals = inputs.get("journals") or []
    moods = inputs.get("moods") or []
    assignments = inputs.get("assignments") or []
    long_term_memories = inputs.get("long_term_memories") or []
    recent_events = inputs.get("recent_events") or []
    previous_snapshots = inputs.get("previous_snapshots") or []
    recent_feedback = inputs.get("recent_feedback")
    analyzed_rows = inputs.get("analyzed_sessions") or []
    has_therapist = bool(inputs.get("has_therapist"))
    has_contact_request = bool(inputs.get("has_contact_request"))

    support_style = str(intake.get("support_style") or "")
    overwhelm_level = str(intake.get("overwhelm_level") or "")
    desired_help_focus = str(intake.get("desired_help_focus") or "")
    primary_reason = str(intake.get("primary_reason") or "")
    wants_therapist = bool(intake.get("wants_therapist_connection"))

    journal_count = len(journals)
    recent_journal_titles = [
        str(item.get("title") or item.get("content") or "").strip()
        for item in journals[:3]
        if isinstance(item, dict)
    ]
    recent_texts = recent_journal_titles + [
        str(item.get("ai_summary") or item.get("facts_content") or "").strip()
        for item in analyzed_rows[:2]
        if isinstance(item, dict)
    ] + [str(item).strip() for item in long_term_memories[:3] if isinstance(item, str)]
    combined_text = _normalized_text_blob(recent_texts)

    assignment_completed_count = sum(
        1 for item in assignments if str(item.get("status") or "").strip().lower() == "completed"
    )
    active_assignment_count = sum(
        1 for item in assignments if str(item.get("status") or "").strip().lower() in {"pending", "in_progress"}
    )

    assessment_distress = _assessment_distress_score(latest_self_assessment)
    mood_scores = [float(item.get("emotion_score") or 0) for item in moods if item.get("emotion_score") is not None]
    latest_mood = mood_scores[0] if mood_scores else None
    average_recent_mood = _safe_mean(mood_scores[:3]) if mood_scores else 0.0
    mood_trend = _mood_trend(moods)

    distress_signal = 0.0
    if overwhelm_level == "high":
        distress_signal += 28
    elif overwhelm_level == "medium":
        distress_signal += 14
    distress_signal += assessment_distress
    if latest_mood is not None:
        if latest_mood <= 3:
            distress_signal += 28
        elif latest_mood <= 5:
            distress_signal += 16
        elif latest_mood >= 7:
            distress_signal -= 10
    if mood_trend == "worsening":
        distress_signal += 12
    elif mood_trend == "improving":
        distress_signal -= 8
    distress_signal = _clamp(distress_signal)

    connection_signal = 0.0
    if has_therapist:
        connection_signal += 34
    if has_contact_request:
        connection_signal += 18
    if wants_therapist:
        connection_signal += 14
    if support_style == "reach_out":
        connection_signal += 18
    elif support_style == "mixed":
        connection_signal += 6
    elif support_style == "keep_inside":
        connection_signal -= 16
    if any(event.get("event_type") == "contact_request_submitted" for event in recent_events):
        connection_signal += 12
    connection_signal = _clamp(connection_signal)

    avoidance_signal = 0.0
    if support_style == "keep_inside":
        avoidance_signal += 24
    if journal_count == 0:
        avoidance_signal += 10
    if any(token in combined_text for token in ["né", "tránh", "im lặng", "thu mình", "một mình", "cô lập"]):
        avoidance_signal += 18
    if has_therapist or support_style == "reach_out":
        avoidance_signal -= 14
    avoidance_signal = _clamp(avoidance_signal)

    agency_signal = 0.0
    if journal_count >= 2:
        agency_signal += 16
    if len(moods) >= 3:
        agency_signal += 12
    if assignment_completed_count > 0:
        agency_signal += 16
    if active_assignment_count > 0:
        agency_signal += 6
    if mood_trend == "improving":
        agency_signal += 14
    if distress_signal >= 70:
        agency_signal -= 18
    agency_signal = _clamp(agency_signal)

    pattern_reflection_signal = 0.0
    if desired_help_focus == "understand_patterns":
        pattern_reflection_signal += 26
    if journal_count >= 2:
        pattern_reflection_signal += 12
    if latest_self_assessment:
        pattern_reflection_signal += 10
    if any(token in combined_text for token in ["lặp", "mẫu", "vòng", "pattern", "thói quen"]):
        pattern_reflection_signal += 14
    pattern_reflection_signal = _clamp(pattern_reflection_signal)

    previous_distress_high = sum(
        1
        for snapshot in previous_snapshots[:3]
        if (
            str(snapshot.get("trajectory_state") or "") == STATE_OVERWHELMED
            or int(((snapshot.get("signals") or {}).get("distress_signal") or 0)) >= 70
        )
    )

    reason_label = PRIMARY_REASON_LABELS.get(primary_reason, "những điều bạn đang trải qua")
    chapter_title = STATE_LISTENING_CLOSER
    reflection_text = (
        "Miru đang ghép những tín hiệu gần đây để hiểu bạn theo nhịp sống thật của bạn, "
        "không cố gắn bạn vào một nhãn cố định nào."
    )
    suggested_next_step = "Hãy tiếp tục một check-in ngắn hoặc vài dòng nhật ký để Miru hiểu bạn rõ hơn."
    trend_summary = "Miru đang ở giai đoạn gom thêm tín hiệu gần đây để phản chiếu sát hơn."

    if distress_signal >= 72:
        chapter_title = STATE_OVERWHELMED
        reflection_text = (
            f"Gần đây bạn có dấu hiệu đang gánh khá nhiều {reason_label}. "
            "Miru nên đi cùng bạn theo nhịp nhẹ hơn, ưu tiên ổn định trước khi đòi hỏi quá nhiều thay đổi."
        )
        suggested_next_step = (
            "Hãy bắt đầu bằng một check-in ngắn hôm nay hoặc chọn một việc rất nhỏ để giảm tải. "
            "Nếu thấy phù hợp, bạn cũng có thể tìm thêm điểm tựa từ người thật."
        )
        trend_summary = "Các tín hiệu gần đây đang nghiêng về trạng thái quá tải và cần nhịp hỗ trợ nhẹ hơn."
    elif previous_distress_high >= 2 and not has_therapist and connection_signal < 35:
        chapter_title = STATE_NEEDS_HUMAN_SUPPORT
        reflection_text = (
            "Miru đang thấy đây không còn chỉ là một đợt chùng xuống ngắn. "
            "Có vẻ bạn sẽ có lợi hơn nếu có thêm một điểm tựa người thật thay vì tiếp tục tự gánh một mình."
        )
        suggested_next_step = (
            "Hãy cân nhắc xem therapist phù hợp hoặc gửi một yêu cầu liên hệ, ngay cả khi bạn chỉ muốn bắt đầu rất chậm."
        )
        trend_summary = "Các tín hiệu quá tải đã lặp lại qua nhiều lần phản chiếu và thiếu điểm tựa bên ngoài."
    elif support_style == "keep_inside" and journal_count < 2 and connection_signal < 40:
        chapter_title = STATE_KEEPING_INSIDE
        reflection_text = (
            "Miru đang thấy bạn có xu hướng giữ lại phần khó nói của mình. "
            "Điều đó rất dễ hiểu, nhưng cũng khiến bạn phải gánh mọi thứ một mình lâu hơn."
        )
        suggested_next_step = (
            "Thử viết thêm 3 dòng về điều đang nặng nhất, hoặc mở lời với một người an toàn nếu hôm nay bạn thấy đủ sức."
        )
        trend_summary = "Nhịp gần đây cho thấy xu hướng thu mình và tự xử lý phần khó một mình."
    elif has_therapist or has_contact_request or wants_therapist or support_style == "reach_out":
        chapter_title = STATE_OPENING_UP
        reflection_text = (
            "Gần đây bạn đang có xu hướng mở ra thêm với sự hỗ trợ xung quanh mình. "
            "Đó là một bước chuyển quan trọng, vì nó cho thấy bạn không còn phải tự chịu đựng mọi thứ một mình nữa."
        )
        suggested_next_step = (
            "Hãy giữ nhịp mở lời này bằng một cập nhật ngắn, một self-test gần đây, hoặc một tin nhắn follow-up nếu bạn đã có therapist."
        )
        trend_summary = "Các tín hiệu mới cho thấy bạn đang dịch chuyển theo hướng kết nối nhiều hơn."
    elif pattern_reflection_signal >= 40 and journal_count >= 1:
        chapter_title = STATE_PATTERN_REFLECTION
        reflection_text = (
            "Bạn dường như đang ở giai đoạn muốn hiểu rõ điều gì đang lặp lại trong cảm xúc và hành vi của mình. "
            "Đây là một nền tốt để Miru phản chiếu lại hành trình của bạn theo thời gian."
        )
        suggested_next_step = "Hãy làm một self-test ngắn hoặc viết thêm vài dòng nhật ký để Miru nhìn rõ mẫu lặp hơn."
        trend_summary = "Các tín hiệu gần đây nghiêng về tự quan sát và nhìn lại những mẫu lặp quen thuộc."
    elif mood_trend == "improving" or (agency_signal >= 35 and distress_signal < 60):
        chapter_title = STATE_STABILIZING
        reflection_text = (
            "Nhìn vào các tín hiệu gần đây, Miru thấy bạn đang dần tìm lại một nhịp ổn định hơn. "
            "Chưa phải mọi thứ đã nhẹ hẳn, nhưng bạn không còn đứng yên ở chỗ cũ."
        )
        suggested_next_step = "Hãy giữ nhịp hiện tại bằng một check-in ngắn hoặc một bài thực hành nhỏ trong khu trị liệu."
        trend_summary = "Nhịp gần đây cho thấy sự ổn định đang quay lại từng chút một."

    if _feedback_requests_softening(recent_feedback) and chapter_title not in {STATE_OVERWHELMED, STATE_NEEDS_HUMAN_SUPPORT}:
        chapter_title = STATE_LISTENING_CLOSER
        reflection_text = (
            "Miru đang điều chỉnh lại cách phản chiếu để bám sát trải nghiệm thật của bạn hơn, "
            "thay vì kết luận quá nhanh từ những tín hiệu còn chưa đủ rõ."
        )
        suggested_next_step = "Bạn có thể chỉnh lại vài câu hỏi ban đầu hoặc tiếp tục check-in để Miru hiểu sát hơn."
        trend_summary = "Miru đang làm mềm cách đọc tín hiệu để phản chiếu bạn chính xác hơn ở giai đoạn này."

    trajectory_state = chapter_title
    input_bits = [
        f"Lý do chính: {PRIMARY_REASON_LABELS.get(primary_reason, 'chưa rõ')}" if primary_reason else None,
        f"Mức quá tải: {overwhelm_level}" if overwhelm_level else None,
        f"Kiểu tìm hỗ trợ: {support_style}" if support_style else None,
        f"Self-test gần nhất: {((latest_self_assessment or {}).get('result') or {}).get('severity')}" if latest_self_assessment else None,
        f"Mood gần đây: {average_recent_mood:.1f}/10" if mood_scores else None,
        "Đã có therapist hoặc đang mở yêu cầu liên hệ" if (has_therapist or has_contact_request) else None,
    ]
    input_summary = "; ".join(bit for bit in input_bits if bit)

    return {
        "trajectory_state": trajectory_state,
        "chapter_title": chapter_title,
        "reflection_text": reflection_text,
        "suggested_next_step": suggested_next_step,
        "trend_summary": trend_summary,
        "input_summary": input_summary,
        "signals": {
            "distress_signal": distress_signal,
            "connection_signal": connection_signal,
            "avoidance_signal": avoidance_signal,
            "agency_signal": agency_signal,
            "pattern_reflection_signal": pattern_reflection_signal,
            "mood_trend": mood_trend,
            "assignment_completed_count": assignment_completed_count,
            "active_assignment_count": active_assignment_count,
        },
        "version": TRAJECTORY_VERSION,
    }


def describe_change(current: Dict[str, Any], previous: Optional[Dict[str, Any]]) -> Optional[str]:
    if not previous:
        return "Miru vừa bắt đầu ghép những tín hiệu đầu tiên để phản chiếu hành trình của bạn."

    current_title = str(current.get("chapter_title") or "")
    previous_title = str(previous.get("chapter_title") or "")
    current_signals = current.get("signals") or {}
    previous_signals = previous.get("signals") or {}

    if current_title and previous_title and current_title != previous_title:
        return f"So với lần trước, chương hiện tại đã dịch chuyển từ “{previous_title}” sang “{current_title}”."

    distress_delta = int(current_signals.get("distress_signal") or 0) - int(previous_signals.get("distress_signal") or 0)
    if distress_delta >= 15:
        return "Mức quá tải gần đây đang tăng lên rõ hơn so với lần phản chiếu trước."
    if distress_delta <= -15:
        return "Mức quá tải gần đây đang dịu xuống hơn so với lần phản chiếu trước."

    agency_delta = int(current_signals.get("agency_signal") or 0) - int(previous_signals.get("agency_signal") or 0)
    if agency_delta >= 15:
        return "Bạn đang có nhiều dấu hiệu chủ động hơn trong cách tự chăm sóc và phản hồi lại khó khăn."
    if agency_delta <= -15:
        return "Nhịp chủ động gần đây có vẻ chậm lại, có thể vì bạn đang mệt hơn hoặc cần thêm khoảng nghỉ."

    connection_delta = int(current_signals.get("connection_signal") or 0) - int(previous_signals.get("connection_signal") or 0)
    if connection_delta >= 15:
        return "Gần đây bạn có xu hướng tìm đến kết nối và hỗ trợ nhiều hơn trước."
    if connection_delta <= -15:
        return "Gần đây bạn có xu hướng giữ mọi thứ riêng mình nhiều hơn trước."

    return "Bức tranh gần đây khá ổn định, nhưng Miru vẫn đang theo dõi những thay đổi nhỏ trong nhịp của bạn."
