// =====================================================
// GENERADOR DE TOKENS ÚNICOS
// src/utils/tokenGenerator.js
// =====================================================

import crypto from 'crypto';

/**
 * Genera un token único para reservas
 */
export function generarTokenReserva() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Genera un código corto (para mostrar al usuario)
 */
export function generarCodigoCorto() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Calcula fecha de expiración
 */
export function calcularExpiracion(minutos) {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() + minutos);
  return ahora;
}

export default {
  generarTokenReserva,
  generarCodigoCorto,
  calcularExpiracion
};