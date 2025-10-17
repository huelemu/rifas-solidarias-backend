/**
 * Genera link de WhatsApp con mensaje preformateado
 */
export function generarLinkWhatsApp(vendedor, comprador, rifa, numeros) {
  try {
    // Formatear teléfono del vendedor
    const telefono = WHATSAPP_CONFIG.formatearNumero(vendedor.telefono);
    
    // Generar mensaje base
    let mensaje = WHATSAPP_CONFIG.MENSAJE_TEMPLATE(comprador, rifa, numeros);
    
    // ✅ AGREGAR ALIAS MP SI EXISTE
    if (vendedor.alias_mp) {
      mensaje += `\n💳 Alias: ${vendedor.alias_mp}`;
    }
    
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