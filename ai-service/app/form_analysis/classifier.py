from app.form_analysis.service import calculate_angle

VISIBILITY_THRESHOLD = 0.5


def classify_exercise_pose(landmarks: list[dict]) -> dict:
    """Classify a likely exercise position from one frame of pose landmarks."""

    if len(landmarks) != 33:
        return {
            "exercise": "unknown",
            "pose": "insufficient_landmarks",
            "confidence": 0.0,
            "joint_angles": {},
        }

    points = {item["index"]: item for item in landmarks}

    required = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

    if any(
        i not in points
        or points[i].get("visibility", 0.0) < VISIBILITY_THRESHOLD
        or not points[i].get("in_frame", False)
        for i in required
    ):
        return {
            "exercise": "unknown",
            "pose": "low_landmark_visibility",
            "confidence": 0.0,
            "joint_angles": {},
        }

    def xy(index):
        return (points[index]["x"], points[index]["y"])

    def angle(a, b, c):
        return calculate_angle(xy(a), xy(b), xy(c))

    angles = {
        "left_knee": angle(23, 25, 27),
        "right_knee": angle(24, 26, 28),
        "left_elbow": angle(11, 13, 15),
        "right_elbow": angle(12, 14, 16),
        "left_hip": angle(11, 23, 25),
        "right_hip": angle(12, 24, 26),
    }

    left_knee = angles["left_knee"]
    right_knee = angles["right_knee"]
    left_elbow = angles["left_elbow"]
    right_elbow = angles["right_elbow"]

    wrist_above_shoulders = (
        points[15]["y"] < points[11]["y"]
        and points[16]["y"] < points[12]["y"]
    )

    left_wrist_near_shoulder = (
        abs(points[15]["x"] - points[11]["x"]) < 0.20
        and abs(points[15]["y"] - points[11]["y"]) < 0.35
    )

    right_wrist_near_shoulder = (
        abs(points[16]["x"] - points[12]["x"]) < 0.20
        and abs(points[16]["y"] - points[12]["y"]) < 0.35
    )

    shoulder_hip_alignment = (
        abs(points[11]["y"] - points[23]["y"]) < 0.25
        and abs(points[12]["y"] - points[24]["y"]) < 0.25
    )

    result = {
        "exercise": "unknown",
        "pose": "unrecognized",
        "confidence": 0.0,
        "joint_angles": {
            name: round(value, 1)
            for name, value in angles.items()
        },
    }

    # Shoulder press: both arms raised above the shoulders.
    if wrist_above_shoulders:
        result.update({
            "exercise": "shoulder_press",
            "pose": "arms_raised",
            "confidence": 0.75,
        })

    # Bicep curl: either arm flexed with its wrist near its shoulder.
    elif (
        (left_elbow < 110 and left_wrist_near_shoulder)
        or (right_elbow < 110 and right_wrist_near_shoulder)
    ):
        result.update({
            "exercise": "bicep_curl",
            "pose": "elbow_flexion",
            "confidence": 0.75,
        })

    # Lunge: one knee is substantially more flexed than the other.
    elif abs(left_knee - right_knee) > 35 and min(left_knee, right_knee) < 120:
        result.update({
            "exercise": "lunge",
            "pose": "asymmetric_knee_flexion",
            "confidence": 0.70,
        })

    # Squat: both knees flexed with relatively symmetrical angles.
    elif (
        left_knee < 115
        and right_knee < 115
        and abs(left_knee - right_knee) <= 30
    ):
        result.update({
            "exercise": "squat",
            "pose": "knees_flexed",
            "confidence": 0.75,
        })

    # Push-up: approximately horizontal body with bent elbows.
    elif shoulder_hip_alignment and (left_elbow + right_elbow) / 2 < 125:
        result.update({
            "exercise": "push_up",
            "pose": "elbows_flexed",
            "confidence": 0.65,
        })

    return result
