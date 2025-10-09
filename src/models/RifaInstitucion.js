const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RifaInstitucion = sequelize.define('RifaInstitucion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rifa_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rifas',
      key: 'id'
    }
  },
  institucion_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'instituciones',
      key: 'id'
    }
  },
  numero_desde: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Número inicial del bloque asignado'
  },
  numero_hasta: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Número final del bloque asignado'
  },
  cantidad_numeros: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Cantidad total de números asignados'
  },
  fecha_asignacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.ENUM('activo', 'agotado', 'suspendido'),
    defaultValue: 'activo'
  }
}, {
  tableName: 'rifa_instituciones',
  timestamps: false
});

module.exports = RifaInstitucion;