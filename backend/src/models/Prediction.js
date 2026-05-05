import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, index: true },
    input: { type: Object, required: true },
    prediction: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

export default mongoose.models.Prediction ||
  mongoose.model("Prediction", predictionSchema);
