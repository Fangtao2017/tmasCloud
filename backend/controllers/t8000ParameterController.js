const db = require("../db");

/**
 * GET /api/t8000-models
 */
exports.getModels = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM t8000_model ORDER BY id");
    res.json(rows);
  } catch (error) {
    console.error("t8000 getModels error:", error);
    res.status(500).json({ message: "Failed to fetch T8000 models" });
  }
};

/**
 * GET /api/t8000-parameters
 * Query: ?model_id=1
 */
exports.getAll = async (req, res) => {
  try {
    const { model_id } = req.query;
    let sql = "SELECT * FROM t8000_parameter ORDER BY model_id, id";
    const params = [];

    if (model_id) {
      sql = "SELECT * FROM t8000_parameter WHERE model_id = ? ORDER BY id";
      params.push(model_id);
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("t8000Parameter getAll error:", error);
    res.status(500).json({ message: "Failed to fetch T8000 parameters" });
  }
};

/**
 * POST /api/t8000-parameters/bulk
 * Body: [{ id, model_id, parameter, attr, unit, bit, data_type, rw, source, channel, lower_limit, upper_limit, runtime }, ...]
 */
exports.bulkInsert = async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Body must be a non-empty array" });
    }

    const values = items.map((item) => [
      item.id,
      item.model_id,
      item.parameter || null,
      item.attr || null,
      item.unit || null,
      item.bit ?? null,
      item.data_type ?? null,
      item.rw ?? null,
      item.source || null,
      item.channel ?? null,
      item.lower_limit ?? null,
      item.upper_limit ?? null,
      item.runtime ?? null,
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

    await db.query(
      `INSERT INTO t8000_parameter
         (id, model_id, parameter, attr, unit, bit, data_type, rw, source, channel, lower_limit, upper_limit, runtime)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         parameter = VALUES(parameter),
         attr = VALUES(attr),
         unit = VALUES(unit),
         bit = VALUES(bit),
         data_type = VALUES(data_type),
         rw = VALUES(rw),
         source = VALUES(source),
         channel = VALUES(channel),
         lower_limit = VALUES(lower_limit),
         upper_limit = VALUES(upper_limit),
         runtime = VALUES(runtime)`,
      values.flat()
    );

    res.json({ message: `Upserted ${items.length} parameters` });
  } catch (error) {
    console.error("t8000Parameter bulkInsert error:", error);
    res.status(500).json({ message: "Failed to insert T8000 parameters" });
  }
};
