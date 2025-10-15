// =====================================================
// SERVICIO DE WHATSAPP
// src/services/whatsappService.js
// =====================================================

import { WHATSAPP_CONFIG } from '../config/reservas.config.js';

/**
 * Genera link de WhatsApp con mensaje preformateado
 */
export function generarLinkWhatsApp(vendedor, comprador, rifa, numeros) {
  try {
    // Formatear teléfono del vendedor
    const telefono = WHATSAPP_CONFIG.formatearNumero(vendedor.telefono);
    
    // Generar mensaje
    const mensaje = WHATSAPP_CONFIG.MENSAJE_TEMPLATE(comprador, rifa, numeros);
    
    // Codificar mensaje para URL
    const mensajeCodificado = encodeURIComponent(mensaje);
    
    // Construir link
    const link = `https://wa.me/${telefono}?text=${mensajeCodificado}`;
    
    return link;
  } catch (error) {
    console.error('❌ Error generando link de WhatsApp:', error);
    return null;
  }
}

/**
 * Valida formato de número de teléfono
 */
export function validarTelefono(telefono) {
  if (!telefono) return false;
  
  // Remover caracteres no numéricos
  const numeros = telefono.replace(/\D/g, '');
  
  // Debe tener al menos 10 dígitos
  return numeros.length >= 10;
}

export default {
  generarLinkWhatsApp,
  validarTelefono
};