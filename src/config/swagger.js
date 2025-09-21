// =====================================================
// CONFIGURACIÓN SWAGGER COMPLETA Y CORREGIDA
// src/config/swagger.js
// =====================================================

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Rifas Solidarias',
      version: '2.0.0',
      description: `
        API completa para el sistema de rifas solidarias multi-institución.
        
        **Características principales:**
        - 🔐 Autenticación JWT con roles
        - 🏢 Gestión multi-institución
        - 🎪 Sistema completo de rifas
        - 💰 Gestión de ventas y números
        - 📊 Reportes y estadísticas
        
        **Para comenzar:**
        1. Regístrate con POST /auth/register
        2. Inicia sesión con POST /auth/login
        3. Usa el token en el botón "Authorize" arriba
      `,
      contact: {
        name: 'Soporte Técnico Huelemu',
        email: 'juan.lacy@huelemu.com.ar',
        url: 'https://huelemu.com.ar'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3100',
        description: 'Servidor de desarrollo local'
      },
      {
        url: 'https://apirifas.huelemu.com.ar',
        description: 'Servidor de producción'
      }
    ],
    
    // =====================================================
    // PATHS MANUALES PARA RIFAS
    // =====================================================
    paths: {
      '/rifas/test/health': {
        get: {
          tags: ['Sistema'],
          summary: 'Health check del módulo de rifas',
          responses: {
            200: {
              description: 'Módulo funcionando correctamente',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      message: { type: 'string', example: 'Módulo de rifas funcionando correctamente' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/rifas/publicas': {
        get: {
          tags: ['Rifas Públicas'],
          summary: 'Listar rifas públicas activas',
          parameters: [
            {
              in: 'query',
              name: 'page',
              schema: { type: 'integer', default: 1 },
              description: 'Número de página'
            },
            {
              in: 'query',
              name: 'limit',
              schema: { type: 'integer', default: 10 },
              description: 'Elementos por página'
            }
          ],
          responses: {
            200: {
              description: 'Lista de rifas activas',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Rifa' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      '/rifas/publicas/{id}': {
        get: {
          tags: ['Rifas Públicas'],
          summary: 'Ver detalles de rifa pública',
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' },
              description: 'ID de la rifa'
            }
          ],
          responses: {
            200: {
              description: 'Detalles de la rifa',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/Rifa' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            404: { $ref: '#/components/responses/NotFoundError' }
          }
        }
      },
      '/rifas/publicas/{id}/numeros': {
        get: {
          tags: ['Números'],
          summary: 'Ver números disponibles de rifa pública',
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' },
              description: 'ID de la rifa'
            },
            {
              in: 'query',
              name: 'estado',
              schema: { type: 'string', enum: ['disponible', 'vendido', 'reservado'] },
              description: 'Filtrar por estado del número'
            }
          ],
          responses: {
            200: {
              description: 'Lista de números de la rifa',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/NumeroRifa' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      '/rifas': {
        get: {
          tags: ['Rifas'],
          summary: 'Listar rifas (requiere autenticación)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'query',
              name: 'estado',
              schema: { type: 'string', enum: ['borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'] },
              description: 'Filtrar por estado'
            },
            {
              in: 'query',
              name: 'page',
              schema: { type: 'integer', default: 1 }
            }
          ],
          responses: {
            200: {
              description: 'Lista de rifas',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Rifa' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/UnauthorizedError' }
          }
        },
        post: {
          tags: ['Rifas'],
          summary: 'Crear nueva rifa (solo admins)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CrearRifaRequest' }
              }
            }
          },
          responses: {
            201: {
              description: 'Rifa creada exitosamente',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/Rifa' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            400: { $ref: '#/components/responses/ValidationError' },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            403: { $ref: '#/components/responses/ForbiddenError' }
          }
        }
      },
      '/rifas/{id}': {
        get: {
          tags: ['Rifas'],
          summary: 'Obtener detalles de una rifa',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' },
              description: 'ID de la rifa'
            }
          ],
          responses: {
            200: {
              description: 'Detalles de la rifa',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/Rifa' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            404: { $ref: '#/components/responses/NotFoundError' }
          }
        },
        put: {
          tags: ['Rifas'],
          summary: 'Actualizar rifa (solo admins)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    nombre: { type: 'string' },
                    descripcion: { type: 'string' },
                    estado: { type: 'string', enum: ['borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'] }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Rifa actualizada exitosamente',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            403: { $ref: '#/components/responses/ForbiddenError' }
          }
        }
      },
      '/rifas/{id}/numeros': {
        get: {
          tags: ['Números'],
          summary: 'Obtener números de una rifa',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'integer' }
            },
            {
              in: 'query',
              name: 'estado',
              schema: { type: 'string', enum: ['disponible', 'vendido', 'reservado'] }
            }
          ],
          responses: {
            200: {
              description: 'Lista de números de la rifa',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/NumeroRifa' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/UnauthorizedError' }
          }
        }
      },
      '/rifas/{rifa_id}/estadisticas': {
        get: {
          tags: ['Rifas'],
          summary: 'Obtener estadísticas de la rifa',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'rifa_id',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          responses: {
            200: {
              description: 'Estadísticas de la rifa',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          nombre: { type: 'string' },
                          numeros_vendidos: { type: 'integer' },
                          recaudado: { type: 'number' },
                          porcentaje_vendido: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/UnauthorizedError' }
          }
        }
      }
    },

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa tu access token JWT obtenido del login'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['success', 'error'],
              example: 'success'
            },
            message: {
              type: 'string',
              example: 'Operación exitosa'
            },
            data: {
              type: 'object',
              description: 'Datos de respuesta'
            },
            pagination: {
              type: 'object',
              properties: {
                current_page: { type: 'integer', example: 1 },
                total_pages: { type: 'integer', example: 5 },
                total_items: { type: 'integer', example: 47 },
                items_per_page: { type: 'integer', example: 10 }
              }
            }
          }
        },
        
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['error'],
              example: 'error'
            },
            message: {
              type: 'string',
              example: 'Descripción del error'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },

        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@test.com'
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'test123'
            }
          }
        },

        RegisterRequest: {
          type: 'object',
          required: ['nombre', 'apellido', 'email', 'password'],
          properties: {
            nombre: {
              type: 'string',
              example: 'Juan'
            },
            apellido: {
              type: 'string',
              example: 'Pérez'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'juan.perez@email.com'
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'password123'
            },
            telefono: {
              type: 'string',
              example: '+541234567890'
            },
            rol: {
              type: 'string',
              enum: ['admin_global', 'admin_institucion', 'vendedor', 'comprador'],
              default: 'comprador'
            },
            institucion_id: {
              type: 'integer',
              example: 1
            }
          }
        },

        Usuario: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            nombre: {
              type: 'string',
              example: 'Juan'
            },
            apellido: {
              type: 'string',
              example: 'Pérez'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'juan.perez@email.com'
            },
            telefono: {
              type: 'string',
              example: '+541234567890'
            },
            rol: {
              type: 'string',
              enum: ['admin_global', 'admin_institucion', 'vendedor', 'comprador'],
              example: 'vendedor'
            },
            estado: {
              type: 'string',
              enum: ['activo', 'inactivo', 'bloqueado'],
              example: 'activo'
            },
            institucion_id: {
              type: 'integer',
              example: 1
            },
            institucion_nombre: {
              type: 'string',
              example: 'Fundación Ejemplo'
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        Institucion: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            nombre: {
              type: 'string',
              example: 'Fundación Ejemplo'
            },
            descripcion: {
              type: 'string',
              example: 'Descripción de la institución'
            },
            direccion: {
              type: 'string',
              example: 'Av. Ejemplo 123, Buenos Aires'
            },
            telefono: {
              type: 'string',
              example: '+541134567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contacto@fundacion.org'
            },
            estado: {
              type: 'string',
              enum: ['activa', 'inactiva'],
              example: 'activa'
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        Rifa: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            nombre: {
              type: 'string',
              example: 'Rifa Solidaria Ejemplo'
            },
            descripcion: {
              type: 'string',
              example: 'Descripción de la rifa solidaria'
            },
            cantidad_numeros: {
              type: 'integer',
              minimum: 10,
              example: 1000
            },
            precio_numero: {
              type: 'number',
              minimum: 0.01,
              example: 50.00
            },
            fecha_inicio: {
              type: 'string',
              format: 'date-time'
            },
            fecha_fin: {
              type: 'string',
              format: 'date-time'
            },
            fecha_sorteo: {
              type: 'string',
              format: 'date-time'
            },
            estado: {
              type: 'string',
              enum: ['borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'],
              example: 'activa'
            },
            institucion_promotora_id: {
              type: 'integer',
              example: 1
            },
            institucion_nombre: {
              type: 'string',
              example: 'Fundación Ejemplo'
            },
            creado_por: {
              type: 'integer',
              example: 1
            },
            numeros_vendidos: {
              type: 'integer',
              example: 150
            },
            numeros_disponibles: {
              type: 'integer',
              example: 850
            },
            recaudado: {
              type: 'number',
              example: 7500.00
            },
            porcentaje_vendido: {
              type: 'number',
              example: 15.0
            }
          }
        },

        CrearRifaRequest: {
          type: 'object',
          required: ['nombre', 'cantidad_numeros', 'precio_numero', 'fecha_inicio', 'fecha_fin', 'fecha_sorteo'],
          properties: {
            nombre: {
              type: 'string',
              minLength: 3,
              maxLength: 100,
              example: 'Rifa Solidaria 2025'
            },
            descripcion: {
              type: 'string',
              maxLength: 500,
              example: 'Rifa para recaudar fondos para...'
            },
            cantidad_numeros: {
              type: 'integer',
              minimum: 10,
              maximum: 10000,
              example: 1000
            },
            precio_numero: {
              type: 'number',
              minimum: 0.01,
              example: 50.00
            },
            fecha_inicio: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T00:00:00Z'
            },
            fecha_fin: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-31T23:59:59Z'
            },
            fecha_sorteo: {
              type: 'string',
              format: 'date-time',
              example: '2025-02-01T20:00:00Z'
            },
            institucion_promotora_id: {
              type: 'integer',
              example: 1
            }
          }
        },

        NumeroRifa: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            rifa_id: {
              type: 'integer',
              example: 1
            },
            numero: {
              type: 'integer',
              example: 123
            },
            estado: {
              type: 'string',
              enum: ['disponible', 'reservado', 'vendido'],
              example: 'disponible'
            },
            comprador_nombre: {
              type: 'string',
              example: 'María González'
            },
            fecha_venta: {
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
              },
              example: {
                status: 'error',
                message: 'Token de acceso requerido',
                code: 'UNAUTHORIZED'
              }
            }
          }
        },
        
        ForbiddenError: {
          description: 'Sin permisos suficientes',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                status: 'error',
                message: 'No tienes permisos para realizar esta acción',
                code: 'FORBIDDEN'
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
              },
              example: {
                status: 'error',
                message: 'Recurso no encontrado',
                code: 'NOT_FOUND'
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
              },
              example: {
                status: 'error',
                message: 'Datos inválidos',
                errors: [
                  {
                    field: 'email',
                    message: 'Formato de email inválido'
                  }
                ]
              }
            }
          }
        }
      }
    },
    
    tags: [
      {
        name: 'Sistema',
        description: 'Endpoints de health check y testing'
      },
      {
        name: 'Autenticación',
        description: 'Registro, login y gestión de tokens JWT'
      },
      {
        name: 'Usuarios',
        description: 'Gestión de usuarios del sistema'
      },
      {
        name: 'Instituciones',
        description: 'Gestión de instituciones participantes'
      },
      {
        name: 'Rifas',
        description: 'Gestión completa de rifas y sorteos'
      },
      {
        name: 'Rifas Públicas',
        description: 'Endpoints públicos para rifas activas'
      },
      {
        name: 'Números',
        description: 'Gestión de números de rifas'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './index.js'
  ]
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  const swaggerUiOptions = {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; font-size: 2.5em; }
      .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; border-radius: 8px; }
      .swagger-ui .btn.authorize { background-color: #007bff; border-color: #007bff; }
      .swagger-ui .btn.authorize:hover { background-color: #0056b3; }
    `,
    customSiteTitle: 'API Rifas Solidarias - Documentación',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      tryItOutEnabled: true
    }
  };

  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));
  
  console.log('📚 Swagger configurado correctamente:');
  console.log('   📖 Interfaz: http://localhost:3100/api-docs');
  console.log('   📄 JSON: http://localhost:3100/swagger.json');
};

export default { setupSwagger, specs };