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
    servers: [{ url: 'http://localhost:3000' }],
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
            fecha_creacion: { type: 'string', format: 'date-time' },
          },
          required: ['nombre'],
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
