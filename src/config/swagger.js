// =====================================================
// CONFIGURACIÓN COMPLETA DE SWAGGER
// src/config/swagger.js
// =====================================================

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

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
      url: 'https://rifas-solidarias.com/soporte'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    },
    termsOfService: 'https://rifas-solidarias.com/terminos'
  },
  servers: [
    {
      url: 'http://localhost:3100',
      description: 'Servidor de desarrollo local'
    },
    {
      url: 'https://apirifas.huelemu.com.ar',
      description: 'Servidor de producción'
    },
    {
      url: 'https://api-staging.rifas-solidarias.com',
      description: 'Servidor de staging'
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
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Campo por el cual ordenar',
        required: false,
        schema: {
          type: 'string',
          enum: ['id', 'nombre', 'email', 'fecha_creacion', 'fecha_actualizacion']
        }
      },
      OrderParam: {
        name: 'order',
        in: 'query',
        description: 'Dirección del ordenamiento',
        required: false,
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
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
      BadRequest: {
        description: 'Solicitud inválida',
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
                  example: 'Datos de entrada inválidos'
                },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string'
                      },
                      message: {
                        type: 'string'
                      }
                    }
                  }
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
                },
                resource: {
                  type: 'string',
                  example: 'Usuario'
                },
                id: {
                  type: 'integer',
                  example: 123
                }
              }
            }
          }
        }
      },
      InternalServerError: {
        description: 'Error interno del servidor',
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
                  example: 'Error interno del servidor'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time'
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
      description: '🐛 Endpoints de debugging (solo desarrollo)'
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
        persistAuthorization: true, // Mantener autorización entre recargas
        filter: true, // Habilitar filtros
        tryItOutEnabled: true, // Habilitar "Try it out" por defecto
        requestSnippetsEnabled: true, // Mostrar snippets de código
        defaultModelsExpandDepth: 2, // Expandir modelos por defecto
        defaultModelExpandDepth: 2,
        docExpansion: 'list', // 'list', 'full', 'none'
        operationsSorter: 'alpha', // Ordenar operaciones alfabéticamente
        tagsSorter: 'alpha' // Ordenar tags alfabéticamente
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
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 1rem 0;
        }
        .swagger-ui .opblock.opblock-post {
          border-color: #28a745;
        }
        .swagger-ui .opblock.opblock-get {
          border-color: #007bff;
        }
        .swagger-ui .opblock.opblock-put {
          border-color: #ffc107;
        }
        .swagger-ui .opblock.opblock-delete {
          border-color: #dc3545;
        }
        .swagger-ui .opblock-summary {
          font-weight: 600;
        }
      `,
      customSiteTitle: 'Rifas Solidarias API - Documentación',
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
        documentation: '/api-docs',
        health: '/health',
        total_endpoints: Object.keys(specs.paths || {}).length,
        total_tags: specs.tags ? specs.tags.length : 0,
        servers: specs.servers,
        contact: specs.info.contact
      });
    });
    
    console.log('📚 Swagger configurado exitosamente en /api-docs');
    console.log('📊 Información de API disponible en /api-info');
    
  } catch (error) {
    console.error('⚠️ Error configurando Swagger:', error.message);
    
    // Configurar una página simple de documentación como fallback
    app.get('/api-docs', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Rifas Solidarias API</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                background-color: #f8f9fa;
              }
              .container { 
                max-width: 800px; 
                margin: 0 auto; 
                background: white; 
                padding: 30px; 
                border-radius: 8px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 { color: #2c3e50; }
              h2 { color: #34495e; margin-top: 30px; }
              ul { line-height: 1.6; }
              .endpoint { 
                background: #f1f2f6; 
                padding: 10px; 
                margin: 5px 0; 
                border-radius: 4px; 
                font-family: monospace;
              }
              .method { 
                font-weight: bold; 
                padding: 2px 6px; 
                border-radius: 3px; 
                color: white; 
                margin-right: 10px;
              }
              .get { background-color: #007bff; }
              .post { background-color: #28a745; }
              .put { background-color: #ffc107; color: #212529; }
              .delete { background-color: #dc3545; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🎫 Rifas Solidarias API</h1>
              <p><strong>Versión:</strong> 2.0.0</p>
              <p><strong>Estado:</strong> Documentación temporalmente no disponible</p>
              
              <h2>📋 Endpoints Principales Disponibles</h2>
              
              <h3>🔐 Autenticación</h3>
              <div class="endpoint"><span class="method post">POST</span>/auth/register - Registrar usuario</div>
              <div class="endpoint"><span class="method post">POST</span>/auth/login - Iniciar sesión</div>
              <div class="endpoint"><span class="method get">GET</span>/auth/me - Obtener perfil</div>
              <div class="endpoint"><span class="method post">POST</span>/auth/refresh - Renovar token</div>
              <div class="endpoint"><span class="method post">POST</span>/auth/logout - Cerrar sesión</div>
              
              <h3>🏢 Instituciones</h3>
              <div class="endpoint"><span class="method get">GET</span>/instituciones - Listar instituciones</div>
              <div class="endpoint"><span class="method post">POST</span>/instituciones - Crear institución</div>
              <div class="endpoint"><span class="method get">GET</span>/instituciones/{id} - Obtener institución</div>
              <div class="endpoint"><span class="method put">PUT</span>/instituciones/{id} - Actualizar institución</div>
              
              <h3>👥 Usuarios</h3>
              <div class="endpoint"><span class="method get">GET</span>/usuarios - Listar usuarios</div>
              <div class="endpoint"><span class="method post">POST</span>/usuarios - Crear usuario</div>
              <div class="endpoint"><span class="method get">GET</span>/usuarios/{id} - Obtener usuario</div>
              <div class="endpoint"><span class="method put">PUT</span>/usuarios/{id} - Actualizar usuario</div>
              
              <h3>🔧 Sistema</h3>
              <div class="endpoint"><span class="method get">GET</span>/ - Health check básico</div>
              <div class="endpoint"><span class="method get">GET</span>/health - Estado del sistema</div>
              <div class="endpoint"><span class="method get">GET</span>/test-db - Test de base de datos</div>
              
              <h2>🔑 Autenticación</h2>
              <p>Para acceder a endpoints protegidos, incluye el header:</p>
              <div class="endpoint">Authorization: Bearer {tu_access_token}</div>
              
              <h2>📞 Contacto</h2>
              <p>Soporte técnico: <a href="mailto:soporte@rifas-solidarias.com">soporte@rifas-solidarias.com</a></p>
              
              <h2>🔗 Enlaces útiles</h2>
              <ul>
                <li><a href="/health">Estado del sistema</a></li>
                <li><a href="/test-db">Test de base de datos</a></li>
                <li><a href="/api-info">Información de la API</a></li>
              </ul>
            </div>
          </body>
        </html>
      `);
    });
  }
};