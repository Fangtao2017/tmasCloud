const express = require("express");
const router = express.Router();
const measurementController = require("../controllers/measurementController");

router.get("/", measurementController.getMeasurements);
router.get("/latest/device/:device_id", measurementController.getLatestByDevice);

module.exports = router;
