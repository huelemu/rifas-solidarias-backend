// src/config/swagger.js - Configuración Swagger con autenticación JWT
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Rifas Solidarias',
      version: '1.0.0',
      description: 'API REST para gestión de rifas solidarias con autenticación JWT',
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
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa tu access token JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            message: {
              type: 'string',
              example: 'Descripción del error'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            }
          }
        },
        Usuario: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del usuario'
            },
            nombre: {
              type: 'string',
              description: 'Nombre del usuario'
            },
            apellido: {
              type: 'string',
              description: 'Apellido del usuario'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email único del usuario'
            },
            telefono: {
              type: 'string',
              description: 'Número de teléfono'
            },
            dni: {
              type: 'string',
              description: 'Documento de identidad'
            },
            rol: {
              type: 'string',
              enum: ['admin_global', 'admin_institucion', 'vendedor', 'comprador'],
              description: 'Rol del usuario en el sistema'
            },
            estado: {
              type: 'string',
              enum: ['activo', 'inactivo'],
              description: 'Estado actual del usuario'
            },
            institucion_id: {
              type: 'integer',
              description: 'ID de la institución asociada'
            },
            institucion_nombre: {
              type: 'string',
              description: 'Nombre de la institución asociada'
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación del usuario'
            },
            ultimo_login: {
              type: 'string',
              format: 'date-time',
              description: 'Último inicio de sesión'
            }
          }
        },
        Institucion: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único de la institución'
            },
            nombre: {
              type: 'string',
              description: 'Nombre de la institución'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción de la institución'
            },
            direccion: {
              type: 'string',
              description: 'Dirección física'
            },
            telefono: {
              type: 'string',
              description: 'Teléfono de contacto'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email de contacto'
            },
            logo_url: {
              type: 'string',
              description: 'URL del logo'
            },
            estado: {
              type: 'string',
              enum: ['activa', 'inactiva'],
              description: 'Estado de la institución'
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de acceso requerido o inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'No tienes permisos para esta acción',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Error de validación de datos',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Autenticación',
        description: 'Endpoints para registro, login y gestión de tokens'
      },
      {
        name: 'Usuarios',
        description: 'Gestión de usuarios del sistema'
      },
      {
        name: 'Instituciones',
        description: 'Gestión de instituciones'
      },
      {
        name: 'Sistema',
        description: 'Endpoints de testing y estado del sistema'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

const specs = swaggerJSDoc(options);

// Configuración personalizada de Swagger UI
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #2c3e50; }
    .swagger-ui .scheme-container { background: #f8f9fa; }
  `,
  customSiteTitle: 'API Rifas Solidarias - Documentación',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true
  }
};

export const setupSwagger = (app) => {
  // Endpoint para el JSON de Swagger
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Documentación interactiva
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));
  
  console.log('📚 Swagger configurado en /api-docs');
};