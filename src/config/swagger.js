// src/config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Rifas Solidarias',
      version: '1.0.0',
      description: 'API para gestión de rifas solidarias de instituciones',
      contact: {
        name: 'Huelemu',
        email: 'juan.lacy@huelemu.com.ar'
      }
    },
    servers: [
      {
        url: 'http://localhost:3100',
        description: 'Servidor de desarrollo'
      }
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Rifas Solidarias API'
  }));
};