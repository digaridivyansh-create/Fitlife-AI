import os
from io import BytesIO
from pathlib import Path as FilePath

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError

from app.nutrition.schemas import FoodImageAnalysis

load_dotenv(dotenv_path=".env")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "AVIF"}

PROMPT = """
You are the food recognition component of FitLife AI.

Analyze the supplied photograph and identify distinct visible food items.

For each item:
- Give the most likely food name.
- Give a concise USDA FoodData Central search query.
- Estimate the edible portion weight in grams.
- Give a confidence score between 0 and 1.
- Record uncertain ingredients, food identity, and preparation methods.
- Set requires_user_confirmation to true when identification or portion size
  is uncertain. In general, ask the user to review photo-based estimates.

Important rules:
- Do not invent hidden ingredients, cooking oils, or seasonings.
- Do not claim exact portion measurements from an image.
- Distinguish visually identifiable foods from ambiguous foods.
- If a food could be several things, explain the ambiguity.
- Flag photographs that appear to be stock images, illustrations, or
  digitally generated.
- Return only information supported by visible evidence.
"""


class FoodImageError(Exception):
    """Raised when food image analysis cannot be completed."""


def _prepare_image(image_bytes: bytes) -> tuple[bytes, str]:
    if not image_bytes:
        raise ValueError("Uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 10 MB upload limit.")

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image_format = (image.format or "").upper()

            if image_format not in ALLOWED_FORMATS:
                raise ValueError(
                    "Unsupported image format. Use JPEG, PNG, WEBP, or AVIF."
                )

            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large.")

            image.load()
            image = image.convert("RGB")
            image.thumbnail((1600, 1600))

            output = BytesIO()
            image.save(output, format="JPEG", quality=90)

            return output.getvalue(), "image/jpeg"

    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("Uploaded file is not a valid supported image.") from error


def analyze_food_image(image_bytes: bytes) -> FoodImageAnalysis:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise FoodImageError("Gemini API is not configured.")

    prepared_bytes, mime_type = _prepare_image(image_bytes)

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                PROMPT,
                types.Part.from_bytes(
                    data=prepared_bytes,
                    mime_type=mime_type,
                ),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=FoodImageAnalysis,
                temperature=0.1,
            ),
        )

        if not response.text:
            raise FoodImageError("Gemini returned an empty analysis.")

        return FoodImageAnalysis.model_validate_json(response.text)

    except FoodImageError:
        raise
    except Exception as error:
        raise FoodImageError(
            "Food image analysis service is temporarily unavailable."
        ) from error
