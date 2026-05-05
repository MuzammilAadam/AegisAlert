import { Router } from "express";

const router = Router();

router.post("/email", async (req, res, next) => {
  try {
    res.status(410).json({
      message: "Use /api/email-subscribers. Alert emails are stored separately from users.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/subscribers", async (req, res, next) => {
  try {
    res.status(410).json({
      message: "Use /api/email-subscribers. Alert emails are stored separately from users.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
