// =====================================================
// CONFIGURACIÓN COMPLETA DE SWAGGER CON SOPORTE DE PRODUCCIÓN
// src/config/swagger.js
// =====================================================

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Detección automática de entorno
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DOMAIN === 'apirifas.huelemu.com.ar' ||
                     process.env.HOST === 'apirifas.huelemu.com.ar' ||
                     process.env.HOSTING === 'huelemu';

const API_URL = isProduction ? 'https://apirifas.huelemu.com.ar' : `http://localhost:${process.env.PORT || 3100}`;
const FRONTEND_URL = isProduction ? 'https://rifas.huelemu.com.ar' : 'http://localhost:4200';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Rifas Solidarias API',
    version: '2.0.0',
    description: `
# API para Sistema de Rifas Solidarias Multi-Institución

Esta API permite gestionar un sistema completo de rifas solidarias donde múltiples instituciones pueden:
- Crear y gestionar rifas
- Participar en rifas de otras instituciones
- Vender números de rifa
- Gestionar usuarios y roles
- Obtener reportes y estadísticas

## Entorno actual:
- **Modo**: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}
- **API URL**: ${API_URL}
- **Frontend URL**: ${FRONTEND_URL}

## Características principales:
- 🔐 **Autenticación JWT** con refresh tokens
- 👥 **Sistema de roles** (admin_global, admin_institucion, vendedor, comprador)
- 🏢 **Multi-institución** (cada institución puede gestionar sus propias rifas)
- 🎫 **Gestión de rifas** completa con números, sorteos y comisiones
- 📊 **Reportes y estadísticas** detalladas
- 🔧 **Endpoints de debugging** para desarrollo

## Roles del sistema:
- **admin_global**: Acceso completo al sistema
- **admin_institucion**: Gestión completa de su institución
- **vendedor**: Venta de números de rifa
- **comprador**: Compra de números y participación en rifas

## Flujo típico:
1. Registro/Login de usuario
2. Creación de rifa por institución promotora
3. Participación de otras instituciones
4. Asignación de números a vendedores
5. Venta de números a compradores
6. Sorteo y determinación de ganador
7. Cálculo y distribución de comisiones
    `,
    contact: {
      name: 'Soporte Técnico - Rifas Solidarias',
      email: 'soporte@rifas-solidarias.com',
      url: isProduction ? 'https://rifas.huelemu.com.ar/soporte' : 'http://localhost:4200/soporte'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: isProduction ? [
    {
      url: 'https://apirifas.huelemu.com.ar',
      description: '🚀 Servidor de producción (Huelemu)'
    },
    {
      url: 'http://localhost:3100',
      description: '🔧 Servidor de desarrollo local'
    }
  ] : [
    {
      url: 'http://localhost:3100',
      description: '🔧 Servidor de desarrollo local'
    },
    {
      url: 'https://apirifas.huelemu.com.ar',
      description: '🚀 Servidor de producción (Huelemu)'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingresa tu token JWT en el formato: Bearer {token}'
      }
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Número de página para paginación',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Cantidad de elementos por página',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      }
    },
    responses: {
      Success: {
        description: 'Operación exitosa',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'success'
                },
                message: {
                  type: 'string',
                  example: 'Operación completada exitosamente'
                },
                data: {
                  type: 'object'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            }
          }
        }
      },
      Unauthorized: {
        description: 'No autenticado - Token requerido o inválido',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'error'
                },
                message: {
                  type: 'string',
                  example: 'Token de acceso requerido'
                },
                code: {
                  type: 'string',
                  example: 'MISSING_TOKEN'
                }
              }
            }
          }
        }
      },
      Forbidden: {
        description: 'Acceso denegado - Permisos insuficientes',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'error'
                },
                message: {
                  type: 'string',
                  example: 'No tienes permisos para realizar esta acción'
                },
                required_role: {
                  type: 'string',
                  example: 'admin_global'
                }
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Recurso no encontrado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'error'
                },
                message: {
                  type: 'string',
                  example: 'Recurso no encontrado'
                }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Sistema',
      description: '🔧 Endpoints de monitoreo y estado del sistema'
    },
    {
      name: 'Autenticación',
      description: '🔐 Gestión de autenticación y autorización'
    },
    {
      name: 'Usuarios',
      description: '👥 Gestión de usuarios del sistema'
    },
    {
      name: 'Instituciones',
      description: '🏢 Gestión de instituciones y organizaciones'
    },
    {
      name: 'Rifas',
      description: '🎫 Gestión de rifas y sorteos (próximamente)'
    },
    {
      name: 'Debug',
      description: '🐛 Endpoints de debugging (solo desarrollo)',
      externalDocs: {
        description: 'Solo disponible en modo desarrollo',
        url: isProduction ? '#' : `${API_URL}/debug/usuarios`
      }
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './index.js'
  ]
};

export const setupSwagger = (app) => {
  try {
    const specs = swaggerJSDoc(options);
    
    // Configuración personalizada de Swagger UI
    const swaggerOptions = {
      explorer: true,
      swaggerOptions: {
        persistAuthorization: true,
        filter: true,
        tryItOutEnabled: true,
        requestSnippetsEnabled: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        docExpansion: 'list',
        operationsSorter: 'alpha',
        tagsSorter: 'alpha',
        url: `${API_URL}/api-docs.json`
      },
      customCss: `
        .swagger-ui .topbar { 
          background-color: #2c3e50; 
          border-bottom: 3px solid #3498db;
        }
        .swagger-ui .topbar .download-url-wrapper { 
          display: none; 
        }
        .swagger-ui .info .title {
          color: #2c3e50;
        }
        .swagger-ui .scheme-container {
          background: ${isProduction ? '#e8f5e8' : '#f8f9fa'};
          border: 1px solid ${isProduction ? '#28a745' : '#dee2e6'};
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 1rem 0;
        }
        .swagger-ui .info .description::before {
          content: "${isProduction ? '🚀 PRODUCCIÓN' : '🔧 DESARROLLO'}";
          display: block;
          font-weight: bold;
          color: ${isProduction ? '#28a745' : '#007bff'};
          margin-bottom: 1rem;
          padding: 0.5rem;
          background: ${isProduction ? '#d4edda' : '#e7f3ff'};
          border-radius: 0.25rem;
          text-align: center;
        }
      `,
      customSiteTitle: `Rifas Solidarias API - ${isProduction ? 'Producción' : 'Desarrollo'}`,
      customfavIcon: '/favicon.ico'
    };
    
    // Configurar Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
    
    // Endpoint para obtener el JSON de la documentación
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });
    
    // Endpoint para información de la API
    app.get('/api-info', (req, res) => {
      res.json({
        name: specs.info.title,
        version: specs.info.version,
        description: 'API para sistema de rifas solidarias',
        environment: isProduction ? 'production' : 'development',
        api_url: API_URL,
        frontend_url: FRONTEND_URL,
        documentation: `${API_URL}/api-docs`,
        health: `${API_URL}/health`,
        total_endpoints: Object.keys(specs.paths || {}).length,
        total_tags: specs.tags ? specs.tags.length : 0,
        servers: specs.servers,
        contact: specs.info.contact,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log(`📚 Swagger configurado en ${API_URL}/api-docs`);
    console.log(`📊 Entorno: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
    
  } catch (error) {
    console.error('⚠️ Error configurando Swagger:', error.message);
    
    // Página de fallback con URLs dinámicas
    app.get('/api-docs', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Rifas Solidarias API - ${isProduction ? 'Producción' : 'Desarrollo'}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 40px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
              }
              .container { 
                max-width: 900px; 
                margin: 0 auto; 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              }
              .badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.8em;
                font-weight: bold;
                margin-bottom: 10px;
                ${isProduction ? 
                  'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 
                  'background: #cce5ff; color: #004085; border: 1px solid #99d6ff;'
                }
              }
              h1 { color: #2c3e50; }
              .endpoint { 
                background: #f1f2f6; 
                padding: 12px; 
                margin: 8px 0; 
                border-radius: 6px; 
                font-family: monospace;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="badge">${isProduction ? '🚀 PRODUCCIÓN' : '🔧 DESARROLLO'}</div>
              <h1>🎫 Rifas Solidarias API</h1>
              <p><strong>API URL:</strong> ${API_URL}</p>
              <p><strong>Frontend:</strong> ${FRONTEND_URL}</p>
              <p>Documentación completa temporalmente no disponible</p>
              
              <h2>Endpoints principales:</h2>
              <div class="endpoint">GET ${API_URL}/health</div>
              <div class="endpoint">POST ${API_URL}/auth/login</div>
              <div class="endpoint">GET ${API_URL}/instituciones</div>
              
              <p>Contacto: <a href="mailto:soporte@rifas-solidarias.com">soporte@rifas-solidarias.com</a></p>
            </div>
          </body>
        </html>
      `);
    });
  }
};