const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Rifa = require('./Rifa');
const Numero = require('./Numero');
const Participante = require('./Participante');
const Premio = require('./Premio');
const Institucion = require('./Institucion');
const RifaInstitucion = require('./RifaInstitucion');
const RifaVendedor = require('./RifaVendedor');
const UsuarioInstitucion = require('./UsuarioInstitucion')(sequelize); // ⬅️ NUEVO

// ==========================================
// RELACIONES EXISTENTES (mantenés)
// ==========================================

// Rifa - Números
Rifa.hasMany(Numero, { foreignKey: 'rifa_id', as: 'numeros' });
Numero.belongsTo(Rifa, { foreignKey: 'rifa_id', as: 'rifa' });

// Participante - Números
Participante.hasMany(Numero, { foreignKey: 'participante_id', as: 'numeros' });
Numero.belongsTo(Participante, { foreignKey: 'participante_id', as: 'participante' });

// Rifa - Premios
Rifa.hasMany(Premio, { foreignKey: 'rifa_id', as: 'premios' });
Premio.belongsTo(Rifa, { foreignKey: 'rifa_id', as: 'rifa' });

// ==========================================
// RELACIONES RIFAS - INSTITUCIONES (mantenés)
// ==========================================

// Rifa N:M Instituciones (a través de rifa_instituciones)
Rifa.belongsToMany(Institucion, {
  through: RifaInstitucion,
  foreignKey: 'rifa_id',
  otherKey: 'institucion_id',
  as: 'instituciones'
});

Institucion.belongsToMany(Rifa, {
  through: RifaInstitucion,
  foreignKey: 'institucion_id',
  otherKey: 'rifa_id',
  as: 'rifas'
});

// RifaInstitucion - Relaciones directas
RifaInstitucion.belongsTo(Rifa, { foreignKey: 'rifa_id', as: 'rifa' });
RifaInstitucion.belongsTo(Institucion, { foreignKey: 'institucion_id', as: 'institucion' });

// RifaInstitucion - Vendedores
RifaInstitucion.hasMany(RifaVendedor, { 
  foreignKey: 'rifa_institucion_id', 
  as: 'vendedores' 
});

RifaVendedor.belongsTo(RifaInstitucion, { 
  foreignKey: 'rifa_institucion_id', 
  as: 'rifaInstitucion' 
});

// ==========================================
// NUEVAS RELACIONES - USUARIOS-INSTITUCIONES
// ==========================================

// Usuario N:M Institucion (a través de usuarios_instituciones) ⬅️ NUEVO
Usuario.belongsToMany(Institucion, {
  through: UsuarioInstitucion,
  foreignKey: 'usuario_id',
  otherKey: 'institucion_id',
  as: 'instituciones'
});

Institucion.belongsToMany(Usuario, {
  through: UsuarioInstitucion,
  foreignKey: 'institucion_id',
  otherKey: 'usuario_id',
  as: 'usuarios'
});

// Acceso directo a la tabla pivot ⬅️ NUEVO
Usuario.hasMany(UsuarioInstitucion, {
  foreignKey: 'usuario_id',
  as: 'institucion_relaciones'
});

UsuarioInstitucion.belongsTo(Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

UsuarioInstitucion.belongsTo(Institucion, {
  foreignKey: 'institucion_id',
  as: 'institucion'
});

// ==========================================
// RELACIONES VENDEDORES (mantenés)
// ==========================================

// Vendedor (Usuario) - Asignaciones
Usuario.hasMany(RifaVendedor, { foreignKey: 'vendedor_id', as: 'asignaciones' });
RifaVendedor.belongsTo(Usuario, { foreignKey: 'vendedor_id', as: 'vendedor' });

// Número - Institución
Numero.belongsTo(Institucion, { foreignKey: 'institucion_id', as: 'institucion' });
Institucion.hasMany(Numero, { foreignKey: 'institucion_id', as: 'numeros' });

// Número - Vendedor
Numero.belongsTo(Usuario, { foreignKey: 'vendedor_id', as: 'vendedor' });
Usuario.hasMany(Numero, { foreignKey: 'vendedor_id', as: 'numeros_asignados' });

module.exports = {
  sequelize,
  Usuario,
  Rifa,
  Numero,
  Participante,
  Premio,
  Institucion,
  RifaInstitucion,
  RifaVendedor,
  UsuarioInstitucion  // ⬅️ AGREGAR
};