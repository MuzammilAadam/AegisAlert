# Natural Disaster Prediction System

Predicts natural disaster probability from weather, sea level, and environmental indicators. The app defaults to Solapur, India, visualizes probability trends, stores predictions, and sends email alerts when risk exceeds 70%.

## Project Structure

```text
frontend/   React dashboard
backend/    Node.js Express API server
ml-model/   Python FastAPI model service
dataset/    Sample training data
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB, optional. If `MONGODB_URI` is unset, the backend keeps prediction history in memory.

## 1. Train And Run ML API

```bash
cd ml-model
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python train_model.py
uvicorn app:app --reload --port 8000
```

API: `POST http://localhost:8000/predict`

## 2. Run Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

API: `http://localhost:5000`

Important environment variables:

- `OPENWEATHER_API_KEY`: c87ddd3c3079b89f703b0eea22a6d11a
- `ML_API_URL`: defaults to `http://localhost:8000`.
- `MONGODB_URI`: optional.
- `ALERT_EMAIL_TO`, `SMTP_USER`, `SMTP_PASS`: required for real email alerts.

## 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

## Workflow

1. Frontend loads default city `Solapur`.
2. Backend fetches live weather from OpenWeather if configured, otherwise mock weather.
3. Backend enriches the request with mock sea-level/environment indicators.
4. Backend calls the FastAPI ML service.
5. Prediction is stored in MongoDB or memory.
6. Frontend renders current result and trend chart.
7. If probability is above 70%, backend sends an email alert when SMTP is configured.

## Notes

The included dataset is synthetic but shaped like a realistic starter dataset. Replace `dataset/historical_disasters.csv` with verified regional data before using this system for operational decisions.
