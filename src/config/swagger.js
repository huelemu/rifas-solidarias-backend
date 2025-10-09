// =====================================================
// CONFIGURACIÓN SWAGGER MINIMALISTA
// src/config/swagger.js
// =====================================================

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Rifas Solidarias',
      version: '2.0.0',
      description: 'API para gestión de rifas solidarias',
      contact: {
        name: 'Soporte',
        email: 'jmanuellacy@gmail.com'
      }
    },
    
    servers: [
      {
        url: 'http://localhost:3100',
        description: 'Desarrollo'
      }
    ],

    // ⭐ ESTO ES LO IMPORTANTE: Define el esquema de seguridad
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa tu token JWT (sin "Bearer")'
        }
      },
      
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Descripción del error' }
          }
        }
      },
      
      responses: {
        Unauthorized: {
          description: 'No autorizado - Token inválido o faltante',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        Forbidden: {
          description: 'Prohibido - Sin permisos suficientes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },

    // ⭐ APLICAR SEGURIDAD GLOBAL A TODOS LOS ENDPOINTS
    security: [
      {
        BearerAuth: []
      }
    ],

    tags: [
      { name: 'Sistema', description: 'Health check' },
      { name: 'Autenticación', description: 'Login y registro' },
      { name: 'Usuarios', description: 'Gestión de usuarios' },
      { name: 'Instituciones', description: 'Gestión de instituciones' },
      { name: 'Rifas', description: 'Gestión de rifas' },
      { name: 'Números', description: 'Números de rifas' }
    ]
  },

  apis: ['./index.js', './src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export const setupSwagger = (app) => {
  
  const uiOptions = {
    swaggerOptions: {
      persistAuthorization: true,  // 🔑 Mantiene el token guardado
      filter: true,
      displayRequestDuration: true,
      docExpansion: 'none',  // Todo colapsado por defecto
      defaultModelsExpandDepth: 1,
      tryItOutEnabled: true
    },
    
    // CSS minimalista
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .swagger-ui .info .title { font-size: 2em; margin-bottom: 10px; }
      .swagger-ui .info .description { margin-bottom: 20px; }
      .swagger-ui .scheme-container { 
        background: #f8f9fa; 
        padding: 15px; 
        border-radius: 4px;
        margin-bottom: 20px;
      }
      .swagger-ui .btn.authorize { 
        background: #28a745; 
        border-color: #28a745; 
      }
      .swagger-ui .btn.authorize svg { fill: white; }
      .swagger-ui .opblock { margin-bottom: 10px; }
    `,
    customSiteTitle: 'Rifas Solidarias API'
  };

  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, uiOptions));
  
  console.log('📚 Swagger: http://localhost:3100/api-docs');
};

export default setupSwagger;