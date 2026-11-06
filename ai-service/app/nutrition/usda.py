import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

NUTRIENT_NAMES = {
    "Energy": "calories",
    "Protein": "protein",
    "Carbohydrate, by difference": "carbohydrates",
    "Total lipid (fat)": "fat",
}


class USDAError(Exception):
    """Raised when USDA nutrition data cannot be retrieved."""


def _get_api_key() -> str:
    api_key = os.getenv("USDA_FDC_API_KEY")
    if not api_key:
        raise USDAError("USDA_FDC_API_KEY is not configured.")
    return api_key


def search_food(query: str, page_size: int = 5) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        raise ValueError("Food search query cannot be empty.")

    if not 1 <= page_size <= 20:
        raise ValueError("page_size must be between 1 and 20.")

    try:
        response = httpx.get(
            f"{USDA_BASE_URL}/foods/search",
            params={
                "api_key": _get_api_key(),
                "query": query,
                "pageSize": page_size,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        data = response.json()

    except httpx.HTTPError as error:
        raise USDAError("USDA food search request failed.") from error

    return [
        {
            "fdc_id": food.get("fdcId"),
            "description": food.get("description"),
            "data_type": food.get("dataType"),
        }
        for food in data.get("foods", [])
    ]


def get_food_details(fdc_id: int) -> dict[str, Any]:
    if fdc_id <= 0:
        raise ValueError("FDC ID must be a positive integer.")

    try:
        response = httpx.get(
            f"{USDA_BASE_URL}/food/{fdc_id}",
            params={"api_key": _get_api_key()},
            timeout=20.0,
        )
        response.raise_for_status()
        food = response.json()

    except httpx.HTTPError as error:
        raise USDAError("USDA food details request failed.") from error

    nutrients = {
        "calories": None,
        "protein": None,
        "carbohydrates": None,
        "fat": None,
    }

    for item in food.get("foodNutrients", []):
        nutrient = item.get("nutrient", {})
        name = nutrient.get("name")
        field = NUTRIENT_NAMES.get(name)

        if not field:
            continue

        amount = item.get("amount")
        unit = (nutrient.get("unitName") or "").lower()

        if amount is None:
            continue

        if field == "calories":
            if unit == "kcal":
                nutrients[field] = float(amount)
            elif unit == "kj" and nutrients[field] is None:
                nutrients[field] = float(amount) / 4.184
        elif unit == "g":
            nutrients[field] = float(amount)

    return {
        "fdc_id": food.get("fdcId"),
        "description": food.get("description"),
        "data_type": food.get("dataType"),
        "basis": "per_100g",
        "nutrients": nutrients,
    }


def calculate_serving_nutrition(
    food_details: dict[str, Any],
    serving_weight_g: float,
) -> dict[str, Any]:
    if not 0 < serving_weight_g <= 5000:
        raise ValueError("Serving weight must be greater than 0 and at most 5000 g.")

    per_100g = food_details["nutrients"]
    multiplier = serving_weight_g / 100.0

    scaled = {
        name: (
            round(value * multiplier, 2)
            if value is not None
            else None
        )
        for name, value in per_100g.items()
    }

    return {
        "fdc_id": food_details["fdc_id"],
        "food": food_details["description"],
        "serving_weight_g": serving_weight_g,
        "nutrients": scaled,
        "source": "USDA FoodData Central",
        "nutrition_basis": "USDA values scaled from per-100g data",
    }
