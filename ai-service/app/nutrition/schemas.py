from pydantic import BaseModel, Field, model_validator


class FoodItemAnalysis(BaseModel):
    food_name: str = Field(
        description="Likely name of the visible food item."
    )

    usda_search_query: str = Field(
        description="Concise food description suitable for USDA FoodData Central search."
    )

    estimated_weight_g: float = Field(
        description="Estimated edible portion weight in grams, greater than 0 and at most 5000."
    )

    confidence: float = Field(
        description="Model confidence between 0 and 1."
    )

    uncertainty_notes: list[str] = Field(
        default_factory=list,
        description="Visual uncertainties, ambiguous ingredients, or preparation details."
    )

    requires_user_confirmation: bool = Field(
        default=True,
        description="Whether the user should review this food identification or portion estimate."
    )

    @model_validator(mode="after")
    def validate_estimates(self):
        if not 0 < self.estimated_weight_g <= 5000:
            raise ValueError("Estimated weight must be between 0 and 5000 grams.")

        if not 0 <= self.confidence <= 1:
            raise ValueError("Confidence must be between 0 and 1.")

        return self


class FoodImageAnalysis(BaseModel):
    items: list[FoodItemAnalysis] = Field(
        description="Food items visibly identified in the photograph."
    )

    overall_notes: list[str] = Field(
        default_factory=list,
        description="Overall image quality, portion estimation limitations, or important caveats."
    )

    image_quality_warning: str | None = Field(
        default=None,
        description="Warning if the image is unsuitable for reliable food estimation."
    )

    @model_validator(mode="after")
    def validate_items(self):
        if not 1 <= len(self.items) <= 20:
            raise ValueError("Analysis must contain between 1 and 20 food items.")

        return self


class FoodConfirmationItem(BaseModel):
    food_name: str = Field(
        min_length=1,
        max_length=200,
        description="Food name confirmed or corrected by the user."
    )

    fdc_id: int = Field(
        gt=0,
        description="Selected USDA FoodData Central ID."
    )

    serving_weight_g: float = Field(
        gt=0,
        le=5000,
        allow_inf_nan=False,
        description="User-confirmed edible serving weight in grams."
    )

    @model_validator(mode="after")
    def validate_food_name(self):
        self.food_name = self.food_name.strip()

        if not self.food_name:
            raise ValueError("Food name cannot be empty.")

        return self


class FoodConfirmationRequest(BaseModel):
    items: list[FoodConfirmationItem] = Field(
        min_length=1,
        max_length=20,
        description="Food items selected and confirmed by the user."
    )
