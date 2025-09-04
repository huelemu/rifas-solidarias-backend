import db from '../config/db.js';

// Export **nombrado**
export async function getAllInstituciones(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM instituciones');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Crear institución
export async function createInstitucion(req, res) {
  const { nombre, descripcion, logo_url } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO instituciones (nombre, descripcion, logo_url) VALUES (?, ?, ?)',
      [nombre, descripcion, logo_url]
    );
    res.json({ id: result.insertId, nombre, descripcion, logo_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Editar institución
export async function updateInstitucion(req, res) {
  const { id } = req.params;
  const { nombre, descripcion, logo_url } = req.body;
  try {
    await db.query(
      'UPDATE instituciones SET nombre=?, descripcion=?, logo_url=? WHERE id=?',
      [nombre, descripcion, logo_url, id]
    );
    res.json({ id, nombre, descripcion, logo_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Borrar institución
export async function deleteInstitucion(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM instituciones WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
