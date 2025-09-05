// src/routes/usuarios.js
import express from 'express';
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} from '../controllers/usuarioController.js';

const router = express.Router();

// GET /usuarios - Obtener todos los usuarios
router.get('/', obtenerUsuarios);

// GET /usuarios/:id - Obtener un usuario específico
router.get('/:id', obtenerUsuarioPorId);

// POST /usuarios - Crear nuevo usuario
router.post('/', crearUsuario);

// PUT /usuarios/:id - Actualizar usuario
router.put('/:id', actualizarUsuario);

// DELETE /usuarios/:id - Eliminar usuario
router.delete('/:id', eliminarUsuario);

export default router;