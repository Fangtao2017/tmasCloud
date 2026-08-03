const db = require("../db");

exports.getAllDevices = async (req, res) => {
  try {
    const { role, siteIds } = req.user;
    const { gateway_id } = req.query;
    let sql = `
      SELECT d.*, g.name AS gateway_name, g.sn AS gateway_sn
      FROM device d
      LEFT JOIN gateway g ON d.gateway_id = g.id
    `;
    const params = [];
    const conditions = [];

    if (gateway_id) {
      conditions.push("d.gateway_id = ?");
      params.push(gateway_id);
    }

    if (role !== 'admin') {
      if (!siteIds || siteIds.length === 0) return res.json([]);
      conditions.push(`g.site_id IN (${siteIds.map(() => '?').join(',')})`);
      params.push(...siteIds);
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY d.id ASC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("getAllDevices error:", error);
    res.status(500).json({ message: "Failed to fetch devices" });
  }
};

exports.getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT d.*, g.name AS gateway_name, g.sn AS gateway_sn
      FROM device d
      LEFT JOIN gateway g ON d.gateway_id = g.id
      WHERE d.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("getDeviceById error:", error);
    res.status(500).json({ message: "Failed to fetch device" });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, zone, enabled } = req.body;

    const setClauses = [];
    const params = [];

    if (name !== undefined) { setClauses.push("name = ?"); params.push(String(name)); }
    if (zone !== undefined) { setClauses.push("zone = ?"); params.push(zone === '' ? null : String(zone)); }
    if (enabled !== undefined) { setClauses.push("enabled = ?"); params.push(enabled ? 1 : 0); }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    setClauses.push("updated_at = NOW()");
    params.push(id);

    await db.query(`UPDATE device SET ${setClauses.join(", ")} WHERE id = ?`, params);

    const [rows] = await db.query(
      `SELECT d.*, g.name AS gateway_name, g.sn AS gateway_sn
       FROM device d LEFT JOIN gateway g ON d.gateway_id = g.id WHERE d.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Device not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("updateDevice error:", error);
    res.status(500).json({ message: "Failed to update device" });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM device WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Device not found" });
    }
    res.json({ message: "Device deleted" });
  } catch (error) {
    console.error("deleteDevice error:", error);
    res.status(500).json({ message: "Failed to delete device" });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const { gateway_id, name, model, modbus_address, zone, enabled, external_device_id } = req.body;
    if (!gateway_id || !name) {
      return res.status(400).json({ message: "gateway_id and name are required" });
    }

    const extId = external_device_id ?? (modbus_address != null ? String(modbus_address) : null);

    const [result] = await db.query(
      `INSERT INTO device
         (gateway_id, external_device_id, name, device_type, model, modbus_address, zone, enabled, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unknown', NOW(), NOW())`,
      [
        gateway_id,
        extId,
        String(name),
        model ?? null,
        model ?? null,
        modbus_address != null ? Number(modbus_address) : null,
        zone || null,
        enabled != null ? (enabled ? 1 : 0) : 1,
      ]
    );

    const [rows] = await db.query(
      `SELECT d.*, g.name AS gateway_name, g.sn AS gateway_sn
       FROM device d LEFT JOIN gateway g ON d.gateway_id = g.id
       WHERE d.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("createDevice error:", error);
    res.status(500).json({ message: "Failed to create device" });
  }
};
