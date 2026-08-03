const db = require("../db");

exports.getAllPoints = async (req, res) => {
  try {
    const { gateway_id, device_id } = req.query;
    let sql = `
      SELECT p.*, d.name AS device_name, d.external_device_id, g.name AS gateway_name, g.sn AS gateway_sn
      FROM point p
      LEFT JOIN device d ON p.device_id = d.id
      LEFT JOIN gateway g ON p.gateway_id = g.id
    `;
    const conditions = [];
    const params = [];

    if (gateway_id) {
      conditions.push("p.gateway_id = ?");
      params.push(gateway_id);
    }

    if (device_id) {
      conditions.push("p.device_id = ?");
      params.push(device_id);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY p.device_id ASC, p.param_id ASC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("getAllPoints error:", error);
    res.status(500).json({ message: "Failed to fetch points" });
  }
};

exports.getPointById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT p.*, d.name AS device_name, d.external_device_id, g.name AS gateway_name, g.sn AS gateway_sn
      FROM point p
      LEFT JOIN device d ON p.device_id = d.id
      LEFT JOIN gateway g ON p.gateway_id = g.id
      WHERE p.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Point not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("getPointById error:", error);
    res.status(500).json({ message: "Failed to fetch point" });
  }
};
