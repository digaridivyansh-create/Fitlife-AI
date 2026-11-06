import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app import main
from app.form_analysis.service import PoseAnalysisError


class FormAnalysisApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.headers = {"X-AI-Service-Token": main.settings.ai_service_token}

    def upload(self, content=b"mock-mp4", content_type="video/mp4", headers=None):
        return self.client.post(
            "/form/analyze-video",
            files={"video": ("exercise.mp4", content, content_type)},
            headers=headers if headers is not None else self.headers,
        )

    def test_missing_token_is_rejected(self):
        self.assertEqual(self.upload(headers={}).status_code, 401)

    def test_invalid_token_is_rejected(self):
        response = self.upload(headers={"X-AI-Service-Token": "invalid-token"})
        self.assertEqual(response.status_code, 401)

    def test_non_mp4_upload_is_rejected(self):
        self.assertEqual(self.upload(content_type="video/quicktime").status_code, 415)

    def test_empty_video_is_rejected(self):
        self.assertEqual(self.upload(content=b"").status_code, 400)

    def test_oversized_video_is_rejected(self):
        with patch.object(main, "MAX_FORM_VIDEO_BYTES", 4):
            response = self.upload(content=b"12345")
        self.assertEqual(response.status_code, 413)

    def test_successful_mocked_analysis_returns_response(self):
        analysis = {
            "frames": [],
            "frames_with_pose": 0,
            "duration_seconds": 1.0,
            "fps": 30.0,
            "frames_analyzed": 2,
            "gemini_frames": [],
        }
        with patch("app.main.run_in_threadpool", new_callable=AsyncMock) as worker:
            worker.return_value = analysis
            response = self.upload()

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["exercise"], "unknown")
        self.assertEqual(body["analysis_status"], "insufficient_data")
        self.assertEqual(body["repetitions"], 0)
        self.assertEqual(body["frames_analyzed"], 2)
        worker.assert_awaited_once()

    def test_pose_analysis_error_returns_bad_request(self):
        with patch(
            "app.main.run_in_threadpool",
            new_callable=AsyncMock,
            side_effect=PoseAnalysisError("Invalid video frames."),
        ):
            response = self.upload()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid video frames.")

    def test_unexpected_processing_error_returns_service_unavailable(self):
        with patch(
            "app.main.run_in_threadpool",
            new_callable=AsyncMock,
            side_effect=RuntimeError("internal test failure"),
        ):
            response = self.upload()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Exercise form analysis is temporarily unavailable.",
        )


if __name__ == "__main__":
    unittest.main()
