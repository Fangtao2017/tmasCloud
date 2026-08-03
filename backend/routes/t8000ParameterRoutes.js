const express = require("express");
const router = express.Router();
const controller = require("../controllers/t8000ParameterController");

router.get("/", controller.getAll);
router.post("/bulk", controller.bulkInsert);

module.exports = router;
