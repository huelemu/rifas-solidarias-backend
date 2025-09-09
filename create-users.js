// create-users.js
// Script para crear usuarios de prueba con contraseñas encriptadas
// Ejecutar con: node create-users.js

import bcrypt from 'bcrypt';
import db from './src/config/db.js';

const users = [
    {
        nombre: 'Admin',
        apellido: 'Global',
        email: 'admin@test.com',
        password: 'admin123',
        rol: 'admin_global'
    },
    {
        nombre: 'Admin',
        apellido: 'Institución',
        email: 'admin.inst@test.com',
        password: 'admin123',
        rol: 'admin_institucion'
    },
    {
        nombre: 'Juan',
        apellido: 'Vendedor',
        email: 'vendedor@test.com',
        password: 'vendedor123',
        rol: 'vendedor'
    },
    {
        nombre: 'María',
        apellido: 'Compradora',
        email: 'comprador@test.com',
        password: 'comprador123',
        rol: 'comprador'
    }
];

async function createTestUsers() {
    console.log('🔄 Creando usuarios de prueba...\n');

    try {
        // Crear institución de prueba si no existe
        const [institutionExists] = await db.execute(
            'SELECT id FROM instituciones WHERE email = ?',
            ['test@institucion.com']
        );

        let institutionId = null;
        if (institutionExists.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO instituciones (nombre, descripcion, email, estado) VALUES (?, ?, ?, ?)',
                ['Institución de Prueba', 'Institución para testing', 'test@institucion.com', 'activa']
            );
            institutionId = result.insertId;
            console.log('✅ Institución de prueba creada con ID:', institutionId);
        } else {
            institutionId = institutionExists[0].id;
            console.log('✅ Institución de prueba ya existe con ID:', institutionId);
        }

        // Crear usuarios
        for (const user of users) {
            try {
                // Verificar si el usuario ya existe
                const [existing] = await db.execute(
                    'SELECT id FROM usuarios WHERE email = ?',
                    [user.email]
                );

                if (existing.length > 0) {
                    console.log(`⚠️  Usuario ${user.email} ya existe, actualizando...`);
                    
                    // Actualizar usuario existente
                    const hashedPassword = await bcrypt.hash(user.password, 12);
                    await db.execute(
                        'UPDATE usuarios SET password = ?, rol = ?, estado = ? WHERE email = ?',
                        [hashedPassword, user.rol, 'activo', user.email]
                    );
                    
                    console.log(`✅ Usuario ${user.email} actualizado`);
                } else {
                    // Crear nuevo usuario
                    const hashedPassword = await bcrypt.hash(user.password, 12);
                    
                    // Agregar institución para roles que la necesitan
                    const userInstitutionId = (user.rol === 'admin_institucion' || user.rol === 'vendedor') 
                        ? institutionId 
                        : null;

                    const [result] = await db.execute(
                        'INSERT INTO usuarios (nombre, apellido, email, password, rol, estado, institucion_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [user.nombre, user.apellido, user.email, hashedPassword, user.rol, 'activo', userInstitutionId]
                    );

                    console.log(`✅ Usuario creado: ${user.email} (ID: ${result.insertId})`);
                }

                console.log(`   📧 Email: ${user.email}`);
                console.log(`   🔑 Password: ${user.password}`);
                console.log(`   👤 Rol: ${user.rol}\n`);

            } catch (error) {
                console.error(`❌ Error creando usuario ${user.email}:`, error.message);
            }
        }

        // Mostrar resumen
        console.log('📊 RESUMEN DE USUARIOS CREADOS:');
        const [allUsers] = await db.execute(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado,
                   i.nombre as institucion_nombre
            FROM usuarios u
            LEFT JOIN instituciones i ON u.institucion_id = i.id
            WHERE u.email LIKE '%test.com'
            ORDER BY u.fecha_creacion DESC
        `);

        allUsers.forEach(user => {
            console.log(`- ${user.email} (${user.rol}) - ${user.estado} - ${user.institucion_nombre || 'Sin institución'}`);
        });

        console.log('\n🎉 ¡Usuarios de prueba creados exitosamente!');
        console.log('\n🔗 Ahora puedes usar estos usuarios para hacer login:');
        console.log('   📧 admin@test.com / 🔑 admin123');
        console.log('   📧 comprador@test.com / 🔑 comprador123');
        console.log('   📧 vendedor@test.com / 🔑 vendedor123');
        console.log('   📧 admin.inst@test.com / 🔑 admin123');

    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        process.exit(0);
    }
}

// Ejecutar script
createTestUsers();