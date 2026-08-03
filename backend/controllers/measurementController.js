const db = require("../db");

exports.getMeasurements = async (req, res) => {
  try {
    const { point_id, device_id, gateway_id, start, end, limit = 100 } = req.query;

    let sql = `
      SELECT m.id, m.point_id, m.value_double, m.value_text, m.quality, m.source_timestamp,
             p.param_id, p.point_name, p.gateway_id,
             d.name AS device_name, d.external_device_id
      FROM measurement m
      JOIN point p ON m.point_id = p.id
      JOIN device d ON p.device_id = d.id
    `;
    const conditions = [];
    const params = [];

    if (point_id) {
      conditions.push("m.point_id = ?");
      params.push(point_id);
    }

    if (device_id) {
      conditions.push("p.device_id = ?");
      params.push(device_id);
    }

    if (gateway_id) {
      conditions.push("p.gateway_id = ?");
      params.push(gateway_id);
    }

    if (start) {
      conditions.push("m.source_timestamp >= ?");
      params.push(start);
    }

    if (end) {
      conditions.push("m.source_timestamp <= ?");
      params.push(end);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 10000);
    sql += " ORDER BY m.source_timestamp DESC LIMIT ?";
    params.push(safeLimit);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("getMeasurements error:", error);
    res.status(500).json({ message: "Failed to fetch measurements" });
  }
};

exports.getLatestByDevice = async (req, res) => {
  try {
    const { device_id } = req.params;

    const [rows] = await db.query(
      `
      SELECT p.id AS point_id, p.param_id, p.point_name, p.point_type,
             p.latest_value, p.latest_timestamp,
             tp.parameter AS parameter_name, tp.unit, tp.attr,
             tp.lower_limit, tp.upper_limit, tp.rw
      FROM point p
      LEFT JOIN t8000_parameter tp ON tp.id = CAST(p.param_id AS UNSIGNED)
      WHERE p.device_id = ?
      ORDER BY CAST(p.param_id AS UNSIGNED) ASC
      `,
      [device_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("getLatestByDevice error:", error);
    res.status(500).json({ message: "Failed to fetch latest measurements" });
  }
};
