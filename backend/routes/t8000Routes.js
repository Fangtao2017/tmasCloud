const express = require("express");
const t8000Controller = require("../controllers/t8000Controller");

const router = express.Router();

router.post("/", t8000Controller.ingestMeasurements);
router.post("/ingest", t8000Controller.ingestMeasurements);
router.post("/measurements", t8000Controller.ingestMeasurements);

module.exports = router;
