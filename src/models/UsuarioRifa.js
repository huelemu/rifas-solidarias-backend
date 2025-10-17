const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UsuarioRifa = sequelize.define('UsuarioRifa', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    rifa_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'rifas',
        key: 'id'
      }
    },
    puede_vender: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Indica si el usuario puede vender números de esta rifa'
    },
    cuota_numeros: {
      type: DataTypes.INTEGER,
      defaultValue: null,
      comment: 'Límite de números que puede vender (null = sin límite)'
    },
    comision_porcentaje: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: null,
      comment: 'Comisión específica para este vendedor en esta rifa'
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    fecha_asignacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'usuarios_rifas',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['usuario_id', 'rifa_id']
      },
      {
        fields: ['usuario_id']
      },
      {
        fields: ['rifa_id']
      }
    ]
  });

  return UsuarioRifa;
};