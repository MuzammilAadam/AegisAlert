from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR.parent / "dataset" / "historical_disasters.csv"
MODEL_PATH = BASE_DIR / "model.joblib"

FEATURES = [
    "temperature",
    "humidity",
    "rainfall",
    "wind_speed",
    "sea_level_anomaly",
    "soil_moisture",
    "pressure",
    "seismic_activity_index",
    "tectonic_stress",
    "historical_earthquake_frequency",
]


def train() -> None:
    data = pd.read_csv(DATASET_PATH)
    x = data[FEATURES]
    y = data["disaster_type"]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=42, stratify=y
    )

    numeric_transformer = "passthrough"
    preprocessor = ColumnTransformer(
        transformers=[("numeric", numeric_transformer, FEATURES)]
    )

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=6,
        random_state=42,
        class_weight="balanced",
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", model),
        ]
    )

    pipeline.fit(x_train, y_train)
    predictions = pipeline.predict(x_test)
    print(classification_report(y_test, predictions, zero_division=0))

    joblib.dump({"pipeline": pipeline, "features": FEATURES}, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    train()
