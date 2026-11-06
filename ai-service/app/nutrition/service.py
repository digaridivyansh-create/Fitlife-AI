from typing import Any

from app.nutrition.analyzer import analyze_food_image, FoodImageError
from app.nutrition.usda import search_food, USDAError


class NutritionAnalysisError(Exception):
    """Raised when nutrition analysis cannot be completed."""


def analyze_meal(image_bytes: bytes) -> dict[str, Any]:
    """
    Analyze a meal image and retrieve USDA food candidates.

    USDA candidates are returned for user confirmation.
    No candidate is silently treated as a confirmed match.
    """

    analysis = analyze_food_image(image_bytes)

    analyzed_items = []

    for index, item in enumerate(analysis.items, start=1):
        item_data = item.model_dump()

        try:
            candidates = search_food(
                item.usda_search_query,
                page_size=5,
            )

            item_data["usda_candidates"] = candidates
            item_data["usda_lookup_status"] = (
                "candidates_found" if candidates else "no_matches"
            )

        except USDAError:
            item_data["usda_candidates"] = []
            item_data["usda_lookup_status"] = "temporarily_unavailable"

        analyzed_items.append({
            "item_number": index,
            **item_data,
        })

    return {
        "status": "analysis_completed",
        "nutrition_status": "awaiting_user_confirmation",
        "items": analyzed_items,
        "overall_notes": analysis.overall_notes,
        "image_quality_warning": analysis.image_quality_warning,
        "disclaimer": (
            "Food identity and portion sizes are estimated from an image. "
            "Review food matches and edible serving weights before "
            "treating nutrition values as final."
        ),
    }


class NutritionConfirmationError(Exception):
    """Raised when confirmed food nutrition cannot be retrieved."""


def calculate_confirmed_meal(items: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Retrieve authoritative USDA nutrient data for user-confirmed foods.

    Nutrient values are calculated on the server using the confirmed
    edible serving weight. Missing USDA nutrient values remain None.
    """
    from app.nutrition.usda import (
        get_food_details,
        calculate_serving_nutrition,
    )

    confirmed_items = []

    for item in items:
        try:
            food_details = get_food_details(item["fdc_id"])

            if food_details.get("fdc_id") != item["fdc_id"]:
                raise NutritionConfirmationError(
                    "USDA returned a different food record."
                )

            serving = calculate_serving_nutrition(
                food_details,
                item["serving_weight_g"],
            )

        except USDAError as error:
            raise NutritionConfirmationError(
                "USDA nutrition data is temporarily unavailable for a selected food."
            ) from error

        except (ValueError, KeyError, TypeError) as error:
            raise NutritionConfirmationError(
                "A selected food or serving weight could not be validated."
            ) from error

        confirmed_items.append({
            "food_name": item["food_name"],
            "fdc_id": serving["fdc_id"],
            "usda_description": serving["food"],
            "serving_weight_g": serving["serving_weight_g"],
            "nutrients": serving["nutrients"],
            "nutrition_source": serving["source"],
            "nutrition_basis": serving["nutrition_basis"],
        })

    totals = {}

    for nutrient in ("calories", "protein", "carbohydrates", "fat"):
        values = [
            item["nutrients"][nutrient]
            for item in confirmed_items
        ]

        totals[nutrient] = (
            round(sum(values), 2)
            if all(value is not None for value in values)
            else None
        )

    return {
        "status": "confirmation_calculated",
        "items": confirmed_items,
        "meal_totals": totals,
        "disclaimer": (
            "Nutrition values are based on USDA FoodData Central records "
            "scaled to user-confirmed serving weights. Actual values may vary."
        ),
    }
