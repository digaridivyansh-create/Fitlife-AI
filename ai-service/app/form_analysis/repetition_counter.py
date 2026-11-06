from collections import deque
from statistics import median

from app.form_analysis.service import calculate_angle, PoseAnalysisError

VISIBILITY_THRESHOLD = 0.5
MIN_VALID_FRAMES = 8
SMOOTHING_WINDOW = 3
MIN_PHASE_FRAMES = 2
MAX_FRAME_GAP_MS = 800
SIMULTANEOUS_DEDUPE_MS = 600

JOINTS = {
    "squat": {
        "triplets": [(23, 25, 27), (24, 26, 28)],
        "start_angle": 155.0,
        "active_angle": 115.0,
        "return_angle": 150.0,
    },
    "bicep_curl": {
        "triplets": [(11, 13, 15), (12, 14, 16)],
        "start_angle": 150.0,
        "active_angle": 90.0,
        "return_angle": 140.0,
    },
}


def _single_joint_angle(landmarks, triplet):
    if not landmarks or len(landmarks) != 33:
        return None

    points = {item["index"]: item for item in landmarks}
    a, b, c = triplet

    for index in triplet:
        point = points.get(index)
        if (
            point is None
            or not point.get("in_frame", False)
            or point.get("visibility", 0.0) < VISIBILITY_THRESHOLD
        ):
            return None

    try:
        angle = calculate_angle(
            (points[a]["x"], points[a]["y"]),
            (points[b]["x"], points[b]["y"]),
            (points[c]["x"], points[c]["y"]),
        )
    except (ValueError, ArithmeticError, PoseAnalysisError):
        return None

    return angle if 0.0 <= angle <= 180.0 else None


def _count_cycles(measurements, config):
    valid_count = sum(item is not None for item in measurements)

    if valid_count < MIN_VALID_FRAMES:
        return {
            "events": [],
            "valid_frames": valid_count,
            "movement_phase": "unknown",
        }

    events = []
    state = "waiting_for_start"
    phase_frames = 0
    previous_timestamp = None
    window = deque(maxlen=SMOOTHING_WINDOW)
    final_angle = None

    for measurement in measurements:
        if measurement is None:
            state = "waiting_for_start"
            phase_frames = 0
            previous_timestamp = None
            window.clear()
            continue

        timestamp = measurement["timestamp_ms"]

        if previous_timestamp is not None:
            gap = timestamp - previous_timestamp
            if gap > MAX_FRAME_GAP_MS or gap <= 0:
                state = "waiting_for_start"
                phase_frames = 0
                window.clear()

        previous_timestamp = timestamp
        window.append(measurement["angle"])
        angle = median(window)
        final_angle = angle

        if state == "waiting_for_start":
            if angle >= config["start_angle"]:
                phase_frames += 1
                if phase_frames >= MIN_PHASE_FRAMES:
                    state = "ready"
                    phase_frames = 0
            else:
                phase_frames = 0

        elif state == "ready":
            if angle <= config["active_angle"]:
                phase_frames += 1
                if phase_frames >= MIN_PHASE_FRAMES:
                    state = "active"
                    phase_frames = 0
            else:
                phase_frames = 0

        elif state == "active":
            if angle >= config["return_angle"]:
                phase_frames += 1
                if phase_frames >= MIN_PHASE_FRAMES:
                    events.append(timestamp)
                    state = "ready"
                    phase_frames = 0
            else:
                phase_frames = 0

    if state == "active":
        phase = "lowering_or_flexed"
    elif (
        state == "ready"
        and final_angle is not None
        and final_angle >= config["return_angle"]
    ):
        phase = "returned"
    else:
        phase = "unknown"

    return {
        "events": events,
        "valid_frames": valid_count,
        "movement_phase": phase,
    }


def _collect_side_results(frames, exercise):
    config = JOINTS[exercise]
    measurements = [[] for _ in config["triplets"]]

    for frame in frames:
        timestamp = frame.get("timestamp_ms")
        valid_timestamp = (
            isinstance(timestamp, (int, float))
            and timestamp >= 0
        )

        for side_index, triplet in enumerate(config["triplets"]):
            angle = (
                _single_joint_angle(frame.get("landmarks"), triplet)
                if valid_timestamp
                else None
            )

            measurements[side_index].append(
                {"timestamp_ms": timestamp, "angle": angle}
                if angle is not None
                else None
            )

    return [
        _count_cycles(side_measurements, config)
        for side_measurements in measurements
    ]


def _merge_alternating_events(left_events, right_events):
    return sorted(left_events + right_events)


def _match_bilateral_events(left_events, right_events):
    remaining_right = list(right_events)
    matched = []

    for left_time in left_events:
        candidates = [
            (abs(left_time - right_time), index, right_time)
            for index, right_time in enumerate(remaining_right)
            if abs(left_time - right_time) <= SIMULTANEOUS_DEDUPE_MS
        ]

        if candidates:
            _, index, right_time = min(candidates)
            matched.append(max(left_time, right_time))
            remaining_right.pop(index)

    return matched


def analyze_repetitions(frames, exercise, counting_mode="alternating"):
    if counting_mode not in {"alternating", "bilateral"}:
        raise ValueError("counting_mode must be 'alternating' or 'bilateral'.")

    if exercise not in JOINTS:
        return {
            "repetitions": 0,
            "movement_phase": "unknown",
            "valid_frames": 0,
            "analysis_status": "insufficient_data",
            "reason": "Exercise is not supported by the repetition counter.",
        }

    left, right = _collect_side_results(frames, exercise)

    if exercise == "squat" or counting_mode == "bilateral":
        valid_frames = min(left["valid_frames"], right["valid_frames"])
        events = _match_bilateral_events(left["events"], right["events"])
        reason = (
            "Complete bilateral squat cycles detected."
            if exercise == "squat"
            else "Complete simultaneous bilateral curl cycles detected."
        )
        no_event_reason = (
            "No complete bilateral squat cycle was detected."
            if exercise == "squat"
            else "No complete simultaneous bilateral curl cycle was detected."
        )
    else:
        valid_frames = max(left["valid_frames"], right["valid_frames"])
        events = _merge_alternating_events(left["events"], right["events"])
        reason = "Complete alternating or unilateral curl cycles detected."
        no_event_reason = "No complete curl cycle was detected."

    repetitions = len(events)

    phases = [left["movement_phase"], right["movement_phase"]]
    if "lowering_or_flexed" in phases:
        phase = "lowering_or_flexed"
    elif "returned" in phases:
        phase = "returned"
    else:
        phase = "unknown"

    enough_data = valid_frames >= MIN_VALID_FRAMES
    if not enough_data:
        repetitions = 0
        phase = "unknown"

    return {
        "repetitions": repetitions,
        "movement_phase": phase,
        "valid_frames": valid_frames,
        "analysis_status": (
            "completed" if repetitions > 0 else "insufficient_data"
        ),
        "reason": (
            reason if repetitions > 0
            else no_event_reason if enough_data
            else "Not enough reliable joint measurements."
        ),
    }
