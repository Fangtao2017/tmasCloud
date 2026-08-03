const db = require("../db");

exports.getAllSites = async (req, res) => {
  try {
    const { role, siteIds } = req.user;

    // Non-admin users can only see their assigned sites
    if (role !== 'admin') {
      if (!siteIds || siteIds.length === 0) {
        return res.json([]);
      }
      const placeholders = siteIds.map(() => '?').join(',');
      const [sites] = await db.query(`
        SELECT s.id, s.name, s.code, s.address, s.description, s.created_at,
               COUNT(g.id) AS gateway_count,
               SUM(CASE WHEN g.status = 'online' THEN 1 ELSE 0 END) AS online_gateways
        FROM site s
        LEFT JOIN gateway g ON g.site_id = s.id
        WHERE s.id IN (${placeholders})
        GROUP BY s.id
        ORDER BY s.id ASC
      `, siteIds);
      return res.json(sites);
    }

    const [sites] = await db.query(`
      SELECT s.id, s.name, s.code, s.address, s.description, s.created_at,
             COUNT(g.id) AS gateway_count,
             SUM(CASE WHEN g.status = 'online' THEN 1 ELSE 0 END) AS online_gateways
      FROM site s
      LEFT JOIN gateway g ON g.site_id = s.id
      GROUP BY s.id
      ORDER BY s.id ASC
    `);

    res.json(sites);
  } catch (error) {
    console.error("getAllSites error:", error);
    res.status(500).json({ message: "Failed to fetch sites" });
  }
};
