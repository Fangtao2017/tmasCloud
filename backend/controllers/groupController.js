const db = require("../db");

// GET /api/gateways/:gatewayId/groups
async function getGroups(req, res) {
  try {
    const gatewayId = Number(req.params.gatewayId);
    const [rows] = await db.query(
      `SELECT id, name, color, device_ids, collapsed
       FROM device_group
       WHERE gateway_id = ?
       ORDER BY sort_order, id`,
      [gatewayId]
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        deviceIds: JSON.parse(r.device_ids ?? "[]"),
        collapsed: !!r.collapsed,
      }))
    );
  } catch (err) {
    console.error("getGroups error:", err);
    return res.status(500).json({ message: "Failed to fetch groups" });
  }
}

// PUT /api/gateways/:gatewayId/groups
// Replaces the entire group list for a gateway (bulk upsert)
async function putGroups(req, res) {
  try {
    const gatewayId = Number(req.params.gatewayId);
    const groups = req.body;

    if (!Array.isArray(groups)) {
      return res.status(400).json({ message: "Body must be an array of groups" });
    }

    await db.withTransaction(async (conn) => {
      await conn.query("DELETE FROM device_group WHERE gateway_id = ?", [gatewayId]);
      if (groups.length > 0) {
        await conn.query(
          `INSERT INTO device_group (id, gateway_id, name, color, device_ids, collapsed, sort_order)
           VALUES ?`,
          [
            groups.map((g, i) => [
              String(g.id),
              gatewayId,
              String(g.name || "Group").slice(0, 100),
              String(g.color || "#003A70").slice(0, 20),
              JSON.stringify(Array.isArray(g.deviceIds) ? g.deviceIds : []),
              g.collapsed ? 1 : 0,
              i,
            ]),
          ]
        );
      }
    });

    return res.json(groups);
  } catch (err) {
    console.error("putGroups error:", err);
    return res.status(500).json({ message: "Failed to save groups" });
  }
}

module.exports = { getGroups, putGroups };
