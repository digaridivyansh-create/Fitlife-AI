import unittest

from app.form_analysis.repetition_counter import analyze_repetitions


def make_landmarks(left_angle=170, right_angle=170, exercise="bicep_curl"):
    landmarks = [
        {
            "index": index,
            "x": 0.0,
            "y": 0.0,
            "in_frame": True,
            "visibility": 1.0,
        }
        for index in range(33)
    ]

    if exercise == "bicep_curl":
        triplets = ((11, 13, 15), (12, 14, 16))
    else:
        triplets = ((23, 25, 27), (24, 26, 28))

    for triplet, target_angle in zip(triplets, (left_angle, right_angle)):
        a, b, c = triplet
        radians = __import__("math").radians(180 - target_angle)

        landmarks[a]["x"], landmarks[a]["y"] = 0.0, 0.0
        landmarks[b]["x"], landmarks[b]["y"] = 1.0, 0.0
        landmarks[c]["x"] = 1.0 + __import__("math").cos(radians)
        landmarks[c]["y"] = __import__("math").sin(radians)

    return landmarks


def make_frame(timestamp_ms, left_angle=170, right_angle=170, exercise="bicep_curl"):
    return {
        "timestamp_ms": timestamp_ms,
        "landmarks": make_landmarks(left_angle, right_angle, exercise),
    }


def make_cycle(start_ms, side="left", exercise="bicep_curl"):
    frames = []
    for offset, angle in enumerate([170] * 4 + [60] * 4 + [170] * 4):
        left_angle = angle if side == "left" else 170
        right_angle = angle if side == "right" else 170

        if exercise == "squat":
            left_angle = right_angle = angle

        frames.append(
            make_frame(
                start_ms + offset * 100,
                left_angle,
                right_angle,
                exercise,
            )
        )
    return frames


class RepetitionCounterTests(unittest.TestCase):

    def test_one_left_arm_curl(self):
        result = analyze_repetitions(
            make_cycle(0, side="left"),
            "bicep_curl",
        )
        self.assertEqual(result["repetitions"], 1)

    def test_two_consecutive_left_arm_curls(self):
        frames = make_cycle(0, "left") + make_cycle(1200, "left")
        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 2)

    def test_alternating_left_and_right_curls(self):
        frames = make_cycle(0, "left") + make_cycle(1200, "right")
        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 2)

    def test_simultaneous_both_arm_curls_count_once(self):
        frames = make_cycle(0, "left")
        for frame in frames:
            angle = 170
            if 400 <= frame["timestamp_ms"] <= 700:
                angle = 60
            elif 800 <= frame["timestamp_ms"] <= 1100:
                angle = 170
            frame["landmarks"] = make_landmarks(angle, angle)

        result = analyze_repetitions(frames, "bicep_curl", counting_mode="bilateral")
        self.assertEqual(result["repetitions"], 1)

    def test_one_bilateral_squat(self):
        frames = make_cycle(0, exercise="squat")
        result = analyze_repetitions(frames, "squat")
        self.assertEqual(result["repetitions"], 1)

    def test_unsupported_exercise_returns_zero(self):
        result = analyze_repetitions([], "jumping_jack")
        self.assertEqual(result["repetitions"], 0)
        self.assertEqual(result["analysis_status"], "insufficient_data")

    def test_insufficient_frames_do_not_count_repetitions(self):
        frames = [
            make_frame(index * 100, 170, 170)
            for index in range(5)
        ]
        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 0)
        self.assertEqual(result["analysis_status"], "insufficient_data")


    def test_low_visibility_landmarks_are_rejected(self):
        frames = make_cycle(0, "left")
        for frame in frames:
            for index in (11, 13, 15):
                frame["landmarks"][index]["visibility"] = 0.2

        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 0)

    def test_missing_landmarks_are_rejected(self):
        frames = make_cycle(0, "left")
        for frame in frames:
            frame["landmarks"] = None

        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 0)

    def test_invalid_timestamps_do_not_count_repetitions(self):
        frames = make_cycle(0, "left")
        for frame in frames:
            frame["timestamp_ms"] = -1

        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 0)

    def test_incomplete_curl_cycle_is_not_counted(self):
        frames = [
            make_frame(index * 100, 170 if index < 4 else 60, 170)
            for index in range(8)
        ]

        result = analyze_repetitions(frames, "bicep_curl")
        self.assertEqual(result["repetitions"], 0)

if __name__ == "__main__":
    unittest.main()
