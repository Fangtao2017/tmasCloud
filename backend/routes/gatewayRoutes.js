const express = require("express");
const router = express.Router();
const gatewayController = require("../controllers/gatewayController");
const { getGroups, putGroups } = require("../controllers/groupController");

router.get("/", gatewayController.getAllGateways);
router.get("/:id", gatewayController.getGatewayById);
router.post("/", gatewayController.createGateway);
router.put("/:id", gatewayController.updateGateway);
router.delete("/:id", gatewayController.deleteGateway);

// ── Device Groups ─────────────────────────────────────────
router.get("/:gatewayId/groups", getGroups);
router.put("/:gatewayId/groups", putGroups);

module.exports = router;
