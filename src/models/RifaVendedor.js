const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RifaVendedor = sequelize.define('RifaVendedor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rifa_institucion_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rifa_instituciones',
      key: 'id'
    }
  },
  vendedor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  numero_desde: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  numero_hasta: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cantidad_asignada: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cantidad_vendida: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  fecha_asignacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'rifa_vendedores',
  timestamps: false
});

module.exports = RifaVendedor;