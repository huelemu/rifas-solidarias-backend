const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const Numero = sequelize.define('Numero', {
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
  numero: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  participante_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'participantes',
      key: 'id'
    }
  },
  institucion_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'instituciones',
      key: 'id'
    }
  },
  vendedor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM('disponible', 'reservado', 'vendido'),
    defaultValue: 'disponible'
  },
  qr_code: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL del código QR generado'
  },
  hash_verificacion: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Hash para verificación de autenticidad'
  },
  impreso: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si el número fue impreso'
  },
  fecha_impresion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  fecha_venta: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'numeros_rifa',  // ✅ NOMBRE CORRECTO
  timestamps: true,
  createdAt: 'creado_en',
  updatedAt: 'actualizado_en',
  hooks: {
    beforeCreate: async (numero) => {
      // Generar hash de verificación único
      if (!numero.hash_verificacion) {
        const data = `${numero.rifa_id}-${numero.numero}-${Date.now()}`;
        numero.hash_verificacion = crypto
          .createHash('sha256')
          .update(data)
          .digest('hex');
      }
    }
  }
});

module.exports = Numero;