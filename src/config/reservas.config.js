// =====================================================
// CONFIGURACIÓN DEL SISTEMA DE RESERVAS
// src/config/reservas.config.js
// =====================================================

export const RESERVA_CONFIG = {
  // Duración de la reserva
  DURACION_MINUTOS: 60,
  
  // Límites
  MAX_NUMEROS_POR_RESERVA: 20,
  MIN_NUMEROS_POR_RESERVA: 1,
  MAX_RESERVAS_SIMULTANEAS_POR_USUARIO: 3,
  MAX_REINTENTOS_POR_DIA: 5,
  
  // Comportamiento
  LIBERAR_AL_EXPIRAR: true,
  GUARDAR_HISTORIAL: true,
  PERMITIR_RENOVACION: false, // Si puede extender la reserva
  
  // Notificaciones
  EMAIL_COMPRADOR: true,
  EMAIL_VENDEDOR: true,
  INCLUIR_WHATSAPP_LINK: true,
  
  // Recordatorios
  ENVIAR_RECORDATORIO_15MIN: true,
  ENVIAR_RECORDATORIO_5MIN: true,
  
  // Estados
  ESTADOS_VALIDOS: ['activa', 'confirmada', 'expirada', 'cancelada', 'rechazada']
};

export const EMAIL_CONFIG = {
  FROM_NAME: 'Rifas Solidarias',
  FROM_EMAIL: process.env.EMAIL_FROM || 'info@huelemu.com.ar',
  REPLY_TO: process.env.EMAIL_REPLY_TO || 'info@huelemu.com.ar'
};

export const WHATSAPP_CONFIG = {
  // Template del mensaje
  MENSAJE_TEMPLATE: (comprador, rifa, numeros) => 
    `Hola, soy ${comprador.nombre}. ` +
    `Acabo de reservar ${numeros.length} número(s) (${numeros.join(', ')}) ` +
    `de la rifa "${rifa.titulo}". ` +
    `¿Podemos coordinar el pago? Gracias!`,
  
  // Formato del número
  formatearNumero: (telefono) => {
    // Remover espacios, guiones, paréntesis
    let numero = telefono.replace(/[\s\-\(\)]/g, '');
    
    // Si empieza con 0, quitarlo
    if (numero.startsWith('0')) {
      numero = numero.substring(1);
    }
    
    // Si no tiene código de país, agregar Argentina
    if (!numero.startsWith('54')) {
      numero = '54' + numero;
    }
    
    return numero;
  }
};

export default {
  RESERVA_CONFIG,
  EMAIL_CONFIG,
  WHATSAPP_CONFIG
};