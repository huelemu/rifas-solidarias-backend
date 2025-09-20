// =====================================================
// CONFIGURACIÓN SIMPLE DE SWAGGER
// src/config/swagger.js
// =====================================================

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Rifas Solidarias API',
    version: '2.0.0',
    description: 'API para sistema de rifas solidarias multi-institución',
    contact: {
      name: 'Soporte API',
      email: 'soporte@rifas.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:3100',
      description: 'Servidor de desarrollo'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.js'], // Archivos donde están las definiciones
};

export const setupSwagger = (app) => {
  try {
    const specs = swaggerJSDoc(options);
    
    // Configurar Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Rifas Solidarias API Docs'
    }));
    
    // Endpoint para obtener el JSON de la documentación
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });
    
    console.log('📚 Swagger configurado exitosamente en /api-docs');
    
  } catch (error) {
    console.error('⚠️ Error configurando Swagger:', error.message);
    
    // Configurar una página simple de documentación como fallback
    app.get('/api-docs', (req, res) => {
      res.send(`
        <html>
          <head><title>API Documentation</title></head>
          <body>
            <h1>Rifas Solidarias API</h1>
            <p>Documentación temporalmente no disponible</p>
            <h2>Endpoints disponibles:</h2>
            <ul>
              <li>GET / - Health check</li>
              <li>GET /health - Estado del sistema</li>
              <li>POST /auth/login - Iniciar sesión</li>
              <li>POST /auth/register - Registrarse</li>
              <li>GET /instituciones - Listar instituciones</li>
              <li>GET /usuarios - Listar usuarios</li>
            </ul>
          </body>
        </html>
      `);
    });
  }
};