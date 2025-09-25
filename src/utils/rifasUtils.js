// utils/rifasUtils.js
export function generarNumerosRifa(cantidad) {
  const numeros = new Set();
  while (numeros.size < cantidad) {
    const numero = Math.floor(Math.random() * 10000); // rango de números, ajusta si quieres
    numeros.add(numero);
  }
  return Array.from(numeros);
}
