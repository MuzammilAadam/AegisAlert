from pathlib import Path
from typing import Dict

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.joblib"

app = FastAPI(title="Disaster Prediction ML API")


class PredictionInput(BaseModel):
    temperature: float = Field(..., description="Temperature in Celsius")
    humidity: float = Field(..., ge=0, le=100)
    rainfall: float = Field(..., ge=0, description="Rainfall in mm")
    wind_speed: float = Field(..., ge=0, description="Wind speed in km/h")
    sea_level_anomaly: float = Field(..., description="Sea level anomaly in meters")
    soil_moisture: float = Field(..., ge=0, le=100)
    pressure: float = Field(..., gt=0, description="Atmospheric pressure in hPa")
    seismic_activity_index: float = Field(..., ge=0, le=10)
    tectonic_stress: float = Field(..., ge=0, le=10)
    historical_earthquake_frequency: float = Field(..., ge=0, le=10)


class PredictionOutput(BaseModel):
    disaster_probability: float
    disaster_type: str
    class_probabilities: Dict[str, float]


def load_model():
    if not MODEL_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Model file not found. Run `python train_model.py` first.",
        )
    return joblib.load(MODEL_PATH)


@app.get("/health")
def health():
    return {"status": "ok", "model_available": MODEL_PATH.exists()}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput):
    model_bundle = load_model()
    pipeline = model_bundle["pipeline"]
    features = model_bundle["features"]

    frame = pd.DataFrame([{feature: getattr(payload, feature) for feature in features}])
    probabilities = pipeline.predict_proba(frame)[0]
    classes = pipeline.classes_
    class_probabilities = {
        label: round(float(probability) * 100, 2)
        for label, probability in zip(classes, probabilities)
    }

    non_none = {
        label: probability
        for label, probability in class_probabilities.items()
        if label != "none"
    }
    predicted_type = max(non_none, key=non_none.get)
    disaster_probability = non_none[predicted_type]

    if class_probabilities.get("none", 0) > disaster_probability:
        predicted_type = "none"
        disaster_probability = max(0.0, 100 - class_probabilities["none"])

    return PredictionOutput(
        disaster_probability=round(disaster_probability, 2),
        disaster_type=predicted_type,
        class_probabilities=class_probabilities,
    )
