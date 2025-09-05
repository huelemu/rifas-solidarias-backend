import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Backend Rifas Solidarias',
      version: '1.0.0',
      description: 'Documentación de API para Rifas Solidarias',
    },
    servers: [{ url: 'http://localhost:3100' }],
    components: {
      schemas: {
        Institucion: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            logo_url: { type: 'string' },
          },
          required: ['nombre'],
        },
        Rifa: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            precio_boleto: { type: 'number', format: 'decimal' },
            total_boletos: { type: 'integer' },
            fecha_sorteo: { type: 'string', format: 'date' },
            fecha_creacion: { type: 'string', format: 'date-time' },
            estado: { type: 'string', enum: ['activa', 'finalizada', 'cancelada'] },
            institucion_id: { type: 'integer' },
            imagen_url: { type: 'string' },
            premio_descripcion: { type: 'string' },
            institucion_nombre: { type: 'string' },
            institucion_logo: { type: 'string' }
          },
          required: ['nombre', 'precio_boleto', 'total_boletos', 'fecha_sorteo', 'institucion_id'],
        },
        RifaCreate: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            precio_boleto: { type: 'number', format: 'decimal' },
            total_boletos: { type: 'integer' },
            fecha_sorteo: { type: 'string', format: 'date' },
            institucion_id: { type: 'integer' },
            imagen_url: { type: 'string' },
            premio_descripcion: { type: 'string' }
          },
          required: ['nombre', 'precio_boleto', 'total_boletos', 'fecha_sorteo', 'institucion_id'],
        },
        RifaUpdate: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            precio_boleto: { type: 'number', format: 'decimal' },
            total_boletos: { type: 'integer' },
            fecha_sorteo: { type: 'string', format: 'date' },
            estado: { type: 'string', enum: ['activa', 'finalizada', 'cancelada'] },
            imagen_url: { type: 'string' },
            premio_descripcion: { type: 'string' }
          }
        },
        Boleto: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            rifa_id: { type: 'integer' },
            numero_boleto: { type: 'integer' },
            comprador_nombre: { type: 'string' },
            comprador_email: { type: 'string', format: 'email' },
            comprador_telefono: { type: 'string' },
            fecha_compra: { type: 'string', format: 'date-time' },
            estado: { type: 'string', enum: ['reservado', 'pagado', 'cancelado'] }
          },
          required: ['rifa_id', 'numero_boleto', 'comprador_nombre'],
        },
        BoletoCompra: {
          type: 'object',
          properties: {
            numero_boleto: { type: 'integer' },
            comprador_nombre: { type: 'string' },
            comprador_email: { type: 'string', format: 'email' },
            comprador_telefono: { type: 'string' }
          },
          required: ['numero_boleto', 'comprador_nombre', 'comprador_email'],
        }
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};