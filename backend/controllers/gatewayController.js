const db = require("../db");

exports.getAllGateways = async (req, res) => {
  try {
    const { role, siteIds } = req.user;

    if (role !== 'admin') {
      if (!siteIds || siteIds.length === 0) return res.json([]);
      const placeholders = siteIds.map(() => '?').join(',');
      const [rows] = await db.query(`
        SELECT 
          id, site_id, name, sn, gateway_type, ip_address, port, username,
          status, mqtt_status, polling_interval_sec, last_seen,
          last_mqtt_connected_at, last_mqtt_disconnected_at, remarks, created_at, updated_at
        FROM gateway
        WHERE site_id IN (${placeholders})
        ORDER BY id DESC
      `, siteIds);
      return res.json(rows);
    }

    const [rows] = await db.query(`
      SELECT 
        id, site_id, name, sn, gateway_type, ip_address, port, username,
        status, mqtt_status, polling_interval_sec, last_seen,
        last_mqtt_connected_at, last_mqtt_disconnected_at, remarks, created_at, updated_at
      FROM gateway
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("getAllGateways error:", error);
    res.status(500).json({ message: "Failed to fetch gateways" });
  }
};

exports.getGatewayById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        id,
        site_id,
        name,
        sn,
        gateway_type,
        ip_address,
        port,
        username,
        status,
        mqtt_status,
        polling_interval_sec,
        last_seen,
        last_mqtt_connected_at,
        last_mqtt_disconnected_at,
        remarks,
        created_at,
        updated_at
      FROM gateway
      WHERE id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Gateway not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("getGatewayById error:", error);
    res.status(500).json({ message: "Failed to fetch gateway" });
  }
};

exports.createGateway = async (req, res) => {
  try {
    const {
      site_id = null,
      name,
      sn = null,
      gateway_type = "T8000",
      ip_address,
      port = 80,
      username = null,
      password = null,
      status = "offline",
      polling_interval_sec = 30,
      remarks = null
    } = req.body;

    if (!name || !ip_address) {
      return res.status(400).json({
        message: "name and ip_address are required"
      });
    }

    if (gateway_type === "T8000" && !sn) {
      return res.status(400).json({
        message: "sn is required for T8000 gateways"
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO gateway
      (
        site_id,
        name,
        sn,
        gateway_type,
        ip_address,
        port,
        username,
        password,
        status,
        polling_interval_sec,
        remarks
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        site_id,
        name,
        sn,
        gateway_type,
        ip_address,
        port,
        username,
        password,
        status,
        polling_interval_sec,
        remarks
      ]
    );

    const [rows] = await db.query(
      `SELECT * FROM gateway WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("createGateway error:", error);
    res.status(500).json({ message: "Failed to create gateway" });
  }
};

exports.updateGateway = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      site_id = null,
      name,
      sn = null,
      gateway_type = "T8000",
      ip_address,
      port = 80,
      username = null,
      password = null,
      status = "offline",
      polling_interval_sec = 30,
      remarks = null
    } = req.body;

    if (!name || !ip_address) {
      return res.status(400).json({
        message: "name and ip_address are required"
      });
    }

    if (gateway_type === "T8000" && !sn) {
      return res.status(400).json({
        message: "sn is required for T8000 gateways"
      });
    }

    const [result] = await db.query(
      `
      UPDATE gateway
      SET
        site_id = ?,
        name = ?,
        sn = ?,
        gateway_type = ?,
        ip_address = ?,
        port = ?,
        username = ?,
        password = ?,
        status = ?,
        polling_interval_sec = ?,
        remarks = ?
      WHERE id = ?
      `,
      [
        site_id,
        name,
        sn,
        gateway_type,
        ip_address,
        port,
        username,
        password,
        status,
        polling_interval_sec,
        remarks,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Gateway not found" });
    }

    const [rows] = await db.query(
      `SELECT * FROM gateway WHERE id = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error("updateGateway error:", error);
    res.status(500).json({ message: "Failed to update gateway" });
  }
};

exports.deleteGateway = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `DELETE FROM gateway WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Gateway not found" });
    }

    res.json({ message: "Gateway deleted successfully" });
  } catch (error) {
    console.error("deleteGateway error:", error);
    res.status(500).json({ message: "Failed to delete gateway" });
  }
};
