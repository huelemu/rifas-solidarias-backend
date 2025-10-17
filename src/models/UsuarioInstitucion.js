const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UsuarioInstitucion = sequelize.define('UsuarioInstitucion', {
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
    institucion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'instituciones',
        key: 'id'
      }
    },
    rol_institucion: {
      type: DataTypes.ENUM('vendedor', 'coordinador', 'administrador'),
      defaultValue: 'vendedor',
      comment: 'Rol del usuario dentro de la institución'
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    fecha_alta: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'usuarios_instituciones',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['usuario_id', 'institucion_id']
      }
    ]
  });

  return UsuarioInstitucion;
};