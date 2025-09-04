import db from '../config/db.js';

export async function getAllRifas(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM rifas');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
