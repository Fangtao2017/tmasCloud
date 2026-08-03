const db = require("../db");

// Parameters that represent instantaneous power (kW) — used for Current Load & Peak Demand
const POWER_PARAMS = ["active_pwr", "active_pwr_total"];

// Parameters that represent cumulative energy (kWh) — used for Today Energy
const ENERGY_PARAMS = ["import_energy", "import_energy_total"];

const ENERGY_MODEL_IDS = [10, 11, 12];

exports.getSiteEnergySummary = async (req, res) => {
  try {
    const { site_id } = req.params;

    // 1. Current Load: sum latest_value of power params for this site
    const [currentLoadRows] = await db.query(
      `
      SELECT COALESCE(SUM(CAST(p.latest_value AS DECIMAL(12,3))), 0) AS current_load_kw
      FROM point p
      JOIN device d ON p.device_id = d.id
      JOIN gateway g ON d.gateway_id = g.id
      JOIN t8000_parameter tp ON tp.id = CAST(p.param_id AS UNSIGNED)
      WHERE g.site_id = ?
        AND tp.model_id IN (${ENERGY_MODEL_IDS.join(",")})
        AND tp.parameter IN (${POWER_PARAMS.map(() => "?").join(",")})
        AND p.latest_value IS NOT NULL
      `,
      [site_id, ...POWER_PARAMS]
    );

    // 2. Today Energy: per device, (max - min) of import_energy today, then sum across devices
    const [todayEnergyRows] = await db.query(
      `
      SELECT COALESCE(SUM(device_delta), 0) AS today_energy_kwh
      FROM (
        SELECT p.id AS point_id,
               MAX(CAST(m.value_double AS DECIMAL(12,3))) - MIN(CAST(m.value_double AS DECIMAL(12,3))) AS device_delta
        FROM measurement m
        JOIN point p ON m.point_id = p.id
        JOIN device d ON p.device_id = d.id
        JOIN gateway g ON d.gateway_id = g.id
        JOIN t8000_parameter tp ON tp.id = CAST(p.param_id AS UNSIGNED)
        WHERE g.site_id = ?
          AND tp.model_id IN (${ENERGY_MODEL_IDS.join(",")})
          AND tp.parameter IN (${ENERGY_PARAMS.map(() => "?").join(",")})
          AND DATE(m.source_timestamp) = CURDATE()
          AND m.value_double IS NOT NULL
        GROUP BY p.id
      ) AS deltas
      `,
      [site_id, ...ENERGY_PARAMS]
    );

    // 3. Peak Demand: max power reading today across all power-type points
    const [peakRows] = await db.query(
      `
      SELECT COALESCE(MAX(CAST(m.value_double AS DECIMAL(12,3))), 0) AS peak_demand_kw,
             MAX(m.source_timestamp) AS peak_time
      FROM measurement m
      JOIN (
        SELECT p.id
        FROM point p
        JOIN device d ON p.device_id = d.id
        JOIN gateway g ON d.gateway_id = g.id
        JOIN t8000_parameter tp ON tp.id = CAST(p.param_id AS UNSIGNED)
        WHERE g.site_id = ?
          AND tp.model_id IN (${ENERGY_MODEL_IDS.join(",")})
          AND tp.parameter IN (${POWER_PARAMS.map(() => "?").join(",")})
      ) AS pwr_points ON m.point_id = pwr_points.id
      WHERE DATE(m.source_timestamp) = CURDATE()
        AND m.value_double IS NOT NULL
      `,
      [site_id, ...POWER_PARAMS]
    );

    // 4. Device count (energy meter devices only)
    const [deviceCountRows] = await db.query(
      `
      SELECT COUNT(DISTINCT d.id) AS meter_count
      FROM device d
      JOIN gateway g ON d.gateway_id = g.id
      JOIN point p ON p.device_id = d.id
      JOIN t8000_parameter tp ON tp.id = CAST(p.param_id AS UNSIGNED)
      WHERE g.site_id = ?
        AND tp.model_id IN (${ENERGY_MODEL_IDS.join(",")})
      `,
      [site_id]
    );

    res.json({
      current_load_kw: parseFloat(currentLoadRows[0].current_load_kw) || 0,
      today_energy_kwh: parseFloat(todayEnergyRows[0].today_energy_kwh) || 0,
      peak_demand_kw: parseFloat(peakRows[0].peak_demand_kw) || 0,
      peak_time: peakRows[0].peak_time ?? null,
      meter_count: parseInt(deviceCountRows[0].meter_count) || 0,
    });
  } catch (error) {
    console.error("getSiteEnergySummary error:", error);
    res.status(500).json({ message: "Failed to fetch energy summary" });
  }
};
