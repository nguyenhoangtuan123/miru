from __future__ import annotations

from typing import Any, Dict, List


PHQ_GAD_CHOICES: List[Dict[str, Any]] = [
    {"value": 0, "label": "Không hề"},
    {"value": 1, "label": "Vài ngày"},
    {"value": 2, "label": "Hơn một nửa số ngày"},
    {"value": 3, "label": "Gần như mỗi ngày"},
]

DASS_CHOICES: List[Dict[str, Any]] = [
    {"value": 0, "label": "Không đúng với tôi"},
    {"value": 1, "label": "Đúng với tôi phần nào"},
    {"value": 2, "label": "Đúng với tôi khá nhiều"},
    {"value": 3, "label": "Rất đúng với tôi"},
]


ASSESSMENT_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "phq9": {
        "id": "phq9",
        "short_code": "PHQ-9",
        "name": "PHQ-9",
        "description": "Thang sàng lọc mức độ triệu chứng trầm cảm trong 2 tuần gần đây.",
        "instructions": "Chọn mức độ phù hợp nhất với trải nghiệm của bạn trong 2 tuần gần đây.",
        "scoring_mode": "total_score",
        "questions": [
            {"key": "interest", "prompt": "Ít hứng thú hoặc ít niềm vui khi làm mọi việc.", "choices": PHQ_GAD_CHOICES},
            {"key": "down", "prompt": "Cảm thấy buồn bã, chán nản hoặc tuyệt vọng.", "choices": PHQ_GAD_CHOICES},
            {"key": "sleep", "prompt": "Khó ngủ, ngủ không yên hoặc ngủ quá nhiều.", "choices": PHQ_GAD_CHOICES},
            {"key": "energy", "prompt": "Cảm thấy mệt mỏi hoặc thiếu năng lượng.", "choices": PHQ_GAD_CHOICES},
            {"key": "appetite", "prompt": "Ăn kém hoặc ăn quá nhiều.", "choices": PHQ_GAD_CHOICES},
            {"key": "self_worth", "prompt": "Cảm thấy mình tệ, thất bại hoặc làm gia đình thất vọng.", "choices": PHQ_GAD_CHOICES},
            {"key": "focus", "prompt": "Khó tập trung vào việc đọc báo, xem TV hay công việc hằng ngày.", "choices": PHQ_GAD_CHOICES},
            {"key": "movement", "prompt": "Cử động hoặc nói chậm bất thường, hoặc bồn chồn hơn thường lệ.", "choices": PHQ_GAD_CHOICES},
            {"key": "self_harm", "prompt": "Có ý nghĩ rằng tốt hơn là mình không nên tồn tại hoặc muốn làm hại bản thân.", "choices": PHQ_GAD_CHOICES},
        ],
    },
    "gad7": {
        "id": "gad7",
        "short_code": "GAD-7",
        "name": "GAD-7",
        "description": "Thang sàng lọc mức độ lo âu lan tỏa trong 2 tuần gần đây.",
        "instructions": "Chọn mức độ phù hợp nhất với trải nghiệm của bạn trong 2 tuần gần đây.",
        "scoring_mode": "total_score",
        "questions": [
            {"key": "nervous", "prompt": "Cảm thấy lo lắng, bồn chồn hoặc căng như dây đàn.", "choices": PHQ_GAD_CHOICES},
            {"key": "control", "prompt": "Không thể ngừng hoặc kiểm soát sự lo lắng.", "choices": PHQ_GAD_CHOICES},
            {"key": "worry_many", "prompt": "Lo lắng quá mức về nhiều việc khác nhau.", "choices": PHQ_GAD_CHOICES},
            {"key": "relax", "prompt": "Khó thư giãn.", "choices": PHQ_GAD_CHOICES},
            {"key": "restless", "prompt": "Bồn chồn đến mức khó ngồi yên.", "choices": PHQ_GAD_CHOICES},
            {"key": "irritable", "prompt": "Dễ cáu gắt hoặc khó chịu.", "choices": PHQ_GAD_CHOICES},
            {"key": "afraid", "prompt": "Cảm thấy sợ như thể điều gì tồi tệ sắp xảy ra.", "choices": PHQ_GAD_CHOICES},
        ],
    },
    "dass21": {
        "id": "dass21",
        "short_code": "DASS-21",
        "name": "DASS-21",
        "description": "Thang sàng lọc mức độ trầm cảm, lo âu và căng thẳng trong tuần vừa qua.",
        "instructions": "Đánh dấu mức độ phù hợp nhất với trải nghiệm của bạn trong tuần vừa qua.",
        "scoring_mode": "subscales",
        "questions": [
            {"key": "stress_1", "prompt": "Tôi cảm thấy khó thả lỏng hoặc hạ căng thẳng.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "anxiety_1", "prompt": "Tôi nhận thấy mình bị khô miệng.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "depression_1", "prompt": "Tôi gần như không cảm nhận được cảm xúc tích cực nào.", "choices": DASS_CHOICES, "subscale": "depression"},
            {"key": "anxiety_2", "prompt": "Tôi thấy khó thở dù không gắng sức nhiều.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "depression_2", "prompt": "Tôi thấy khó bắt đầu làm việc hay chủ động làm điều gì đó.", "choices": DASS_CHOICES, "subscale": "depression"},
            {"key": "stress_2", "prompt": "Tôi phản ứng thái quá trước các tình huống.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "anxiety_3", "prompt": "Tôi bị run rẩy, ví dụ run tay.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "stress_3", "prompt": "Tôi cảm thấy mình đang dùng quá nhiều năng lượng thần kinh.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "anxiety_4", "prompt": "Tôi lo về những tình huống có thể khiến mình hoảng sợ hoặc bẽ mặt.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "depression_3", "prompt": "Tôi cảm thấy không có gì đáng để mong đợi ở phía trước.", "choices": DASS_CHOICES, "subscale": "depression"},
            {"key": "stress_4", "prompt": "Tôi nhận ra mình dễ bị kích động.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "stress_5", "prompt": "Tôi thấy khó thư giãn.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "depression_4", "prompt": "Tôi cảm thấy buồn rầu và xuống tinh thần.", "choices": DASS_CHOICES, "subscale": "depression"},
            {"key": "stress_6", "prompt": "Tôi khó chịu khi bị cản trở lúc đang làm việc.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "anxiety_5", "prompt": "Tôi cảm thấy mình gần như rơi vào hoảng loạn.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "depression_5", "prompt": "Tôi không thể thấy hào hứng với bất cứ điều gì.", "choices": DASS_CHOICES, "subscale": "depression"},
            {"key": "depression_6", "prompt": "Tôi cảm thấy bản thân không có nhiều giá trị.", "choices": DASS_CHOICES, "subscale": "depression"},
            {"key": "stress_7", "prompt": "Tôi thấy mình khá dễ tự ái hoặc dễ chạm tự ái.", "choices": DASS_CHOICES, "subscale": "stress"},
            {"key": "anxiety_6", "prompt": "Tôi cảm nhận tim đập mạnh bất thường dù không vận động.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "anxiety_7", "prompt": "Tôi thấy sợ hãi dù không có lý do rõ ràng.", "choices": DASS_CHOICES, "subscale": "anxiety"},
            {"key": "depression_7", "prompt": "Tôi cảm thấy cuộc sống không còn nhiều ý nghĩa.", "choices": DASS_CHOICES, "subscale": "depression"},
        ],
    },
}


def template_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "id": definition["id"],
            "short_code": definition["short_code"],
            "name": definition["name"],
            "description": definition["description"],
            "instructions": definition["instructions"],
            "question_count": len(definition["questions"]),
            "scoring_mode": definition["scoring_mode"],
        }
        for definition in ASSESSMENT_DEFINITIONS.values()
    ]


def question_rows(template_id: str) -> List[Dict[str, Any]]:
    definition = ASSESSMENT_DEFINITIONS[template_id]
    return [
        {
            "order_index": index,
            "key": question["key"],
            "prompt": question["prompt"],
            "choices": question["choices"],
            "subscale": question.get("subscale"),
        }
        for index, question in enumerate(definition["questions"], start=1)
    ]


def _band(score: int, ranges: List[tuple[int, int, str]]) -> str:
    for lower, upper, label in ranges:
        if lower <= score <= upper:
            return label
    return ranges[-1][2]


def score_assessment(template_id: str, answers_by_key: Dict[str, int]) -> Dict[str, Any]:
    if template_id == "phq9":
        total = sum(int(answers_by_key.get(question["key"], 0)) for question in ASSESSMENT_DEFINITIONS["phq9"]["questions"])
        severity = _band(
            total,
            [
                (0, 4, "Tối thiểu"),
                (5, 9, "Nhẹ"),
                (10, 14, "Trung bình"),
                (15, 19, "Trung bình nặng"),
                (20, 27, "Nặng"),
            ],
        )
        return {
            "total_score": total,
            "severity": severity,
            "interpretation": f"PHQ-9 cho thấy mức triệu chứng trầm cảm ở ngưỡng {severity.lower()}. Đây là kết quả sàng lọc, không phải chẩn đoán lâm sàng cuối cùng.",
            "subscale_scores": {},
        }

    if template_id == "gad7":
        total = sum(int(answers_by_key.get(question["key"], 0)) for question in ASSESSMENT_DEFINITIONS["gad7"]["questions"])
        severity = _band(
            total,
            [
                (0, 4, "Tối thiểu"),
                (5, 9, "Nhẹ"),
                (10, 14, "Trung bình"),
                (15, 21, "Nặng"),
            ],
        )
        return {
            "total_score": total,
            "severity": severity,
            "interpretation": f"GAD-7 cho thấy mức triệu chứng lo âu ở ngưỡng {severity.lower()}. Đây là kết quả sàng lọc, không phải chẩn đoán lâm sàng cuối cùng.",
            "subscale_scores": {},
        }

    if template_id == "dass21":
        subscales = {"depression": 0, "anxiety": 0, "stress": 0}
        for question in ASSESSMENT_DEFINITIONS["dass21"]["questions"]:
            subscale = question.get("subscale")
            if subscale:
                subscales[subscale] += int(answers_by_key.get(question["key"], 0))

        scaled = {
            "depression": subscales["depression"] * 2,
            "anxiety": subscales["anxiety"] * 2,
            "stress": subscales["stress"] * 2,
        }
        subscale_scores = {
            "depression": {
                "score": scaled["depression"],
                "severity": _band(
                    scaled["depression"],
                    [
                        (0, 9, "Bình thường"),
                        (10, 13, "Nhẹ"),
                        (14, 20, "Trung bình"),
                        (21, 27, "Nặng"),
                        (28, 100, "Rất nặng"),
                    ],
                ),
            },
            "anxiety": {
                "score": scaled["anxiety"],
                "severity": _band(
                    scaled["anxiety"],
                    [
                        (0, 7, "Bình thường"),
                        (8, 9, "Nhẹ"),
                        (10, 14, "Trung bình"),
                        (15, 19, "Nặng"),
                        (20, 100, "Rất nặng"),
                    ],
                ),
            },
            "stress": {
                "score": scaled["stress"],
                "severity": _band(
                    scaled["stress"],
                    [
                        (0, 14, "Bình thường"),
                        (15, 18, "Nhẹ"),
                        (19, 25, "Trung bình"),
                        (26, 33, "Nặng"),
                        (34, 100, "Rất nặng"),
                    ],
                ),
            },
        }
        headline = ", ".join(
            [
                f"Trầm cảm: {subscale_scores['depression']['severity']}",
                f"Lo âu: {subscale_scores['anxiety']['severity']}",
                f"Căng thẳng: {subscale_scores['stress']['severity']}",
            ]
        )
        return {
            "total_score": scaled["depression"] + scaled["anxiety"] + scaled["stress"],
            "severity": headline,
            "interpretation": "DASS-21 cho biết mức độ sàng lọc trên ba trục trầm cảm, lo âu và căng thẳng. Therapist cần kết hợp thêm phỏng vấn lâm sàng trước khi đưa ra kết luận cuối cùng.",
            "subscale_scores": subscale_scores,
        }

    raise ValueError(f"Unsupported assessment template: {template_id}")
