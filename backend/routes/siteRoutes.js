const express = require("express");
const router = express.Router();
const { getAllSites } = require("../controllers/siteController");

router.get("/", getAllSites);

module.exports = router;
