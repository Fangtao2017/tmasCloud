const express = require("express");
const router = express.Router();
const pointController = require("../controllers/pointController");

router.get("/", pointController.getAllPoints);
router.get("/:id", pointController.getPointById);

module.exports = router;
