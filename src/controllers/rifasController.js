import db from '../config/db.js';

// Obtener todas las rifas
export async function getAllRifas(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT r.*, i.nombre as institucion_nombre, i.logo_url as institucion_logo
      FROM rifas r 
      LEFT JOIN instituciones i ON r.institucion_id = i.id
      ORDER BY r.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Obtener rifa por ID
export async function getRifaById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT r.*, i.nombre as institucion_nombre, i.logo_url as institucion_logo
      FROM rifas r 
      LEFT JOIN instituciones i ON r.institucion_id = i.id
      WHERE r.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Crear nueva rifa
export async function createRifa(req, res) {
  const { 
    nombre, 
    descripcion, 
    precio_boleto, 
    total_boletos, 
    fecha_sorteo, 
    institucion_id,
    imagen_url,
    premio_descripcion 
  } = req.body;
  
  try {
    const [result] = await db.query(`
      INSERT INTO rifas (
        nombre, descripcion, precio_boleto, total_boletos, 
        fecha_sorteo, institucion_id, imagen_url, premio_descripcion,
        fecha_creacion, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'activa')
    `, [nombre, descripcion, precio_boleto, total_boletos, fecha_sorteo, institucion_id, imagen_url, premio_descripcion]);
    
    res.status(201).json({ 
      id: result.insertId, 
      nombre, 
      descripcion, 
      precio_boleto, 
      total_boletos, 
      fecha_sorteo, 
      institucion_id,
      imagen_url,
      premio_descripcion
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Actualizar rifa
export async function updateRifa(req, res) {
  const { id } = req.params;
  const { 
    nombre, 
    descripcion, 
    precio_boleto, 
    total_boletos, 
    fecha_sorteo, 
    estado,
    imagen_url,
    premio_descripcion 
  } = req.body;
  
  try {
    await db.query(`
      UPDATE rifas SET 
        nombre=?, descripcion=?, precio_boleto=?, total_boletos=?, 
        fecha_sorteo=?, estado=?, imagen_url=?, premio_descripcion=?
      WHERE id=?
    `, [nombre, descripcion, precio_boleto, total_boletos, fecha_sorteo, estado, imagen_url, premio_descripcion, id]);
    
    res.json({ id, nombre, descripcion, precio_boleto, total_boletos, fecha_sorteo, estado, imagen_url, premio_descripcion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Eliminar rifa
export async function deleteRifa(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM rifas WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Obtener boletos de una rifa
export async function getBoletosByRifa(req, res) {
  const { rifaId } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT * FROM boletos 
      WHERE rifa_id = ? 
      ORDER BY numero_boleto
    `, [rifaId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Comprar boleto
export async function comprarBoleto(req, res) {
  const { rifaId } = req.params;
  const { numero_boleto, comprador_nombre, comprador_email, comprador_telefono } = req.body;
  
  try {
    // Verificar que el boleto no esté vendido
    const [existing] = await db.query(
      'SELECT * FROM boletos WHERE rifa_id = ? AND numero_boleto = ?', 
      [rifaId, numero_boleto]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'El boleto ya está vendido' });
    }
    
    // Insertar boleto
    const [result] = await db.query(`
      INSERT INTO boletos (
        rifa_id, numero_boleto, comprador_nombre, 
        comprador_email, comprador_telefono, fecha_compra, estado
      ) VALUES (?, ?, ?, ?, ?, NOW(), 'pagado')
    `, [rifaId, numero_boleto, comprador_nombre, comprador_email, comprador_telefono]);
    
    res.status(201).json({ 
      id: result.insertId,
      rifa_id: rifaId,
      numero_boleto,
      comprador_nombre,
      comprador_email,
      comprador_telefono
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}