// Script de debugging para verificar qué está pasando con el usuario de prueba
import db from '../src/config/db.js';

async function debugTestUser() {
  console.log('\n🔍 DEBUG: Verificando usuario de prueba\n');
  
  const TEST_EMAIL = 'juan.lacy@gmail.com'; // CAMBIA ESTO
  
  try {
    // 1. Verificar si el usuario existe
    console.log('1️⃣  Buscando usuario con email:', TEST_EMAIL);
    const [usuarios] = await db.execute(
      'SELECT id, nombre, apellido, email, email_verificado FROM usuarios WHERE email = ?',
      [TEST_EMAIL]
    );
    
    if (usuarios.length > 0) {
      console.log('✅ Usuario encontrado:');
      console.log(JSON.stringify(usuarios[0], null, 2));
      
      const userId = usuarios[0].id;
      
      // 2. Verificar registros relacionados
      console.log('\n2️⃣  Verificando registros relacionados...');
      
      const [verifications] = await db.execute(
        'SELECT * FROM email_verifications WHERE usuario_id = ?',
        [userId]
      );
      console.log(`   - Email verifications: ${verifications.length} registros`);
      
      const [resets] = await db.execute(
        'SELECT * FROM password_resets WHERE usuario_id = ?',
        [userId]
      );
      console.log(`   - Password resets: ${resets.length} registros`);
      
      // 3. Intentar insertar en password_resets
      console.log('\n3️⃣  Intentando insertar token de reset...');
      try {
        const token = 'test_token_' + Date.now();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hora
        
        await db.execute(
          'INSERT INTO password_resets (usuario_id, token, expires_at) VALUES (?, ?, ?)',
          [userId, token, expiresAt]
        );
        console.log('✅ Token insertado exitosamente');
        
        // Limpiar
        await db.execute('DELETE FROM password_resets WHERE token = ?', [token]);
        console.log('✅ Token de prueba eliminado');
        
      } catch (error) {
        console.error('❌ Error insertando token:');
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.sqlMessage);
      }
      
    } else {
      console.log('❌ Usuario NO encontrado. Creando uno...');
      
      try {
        const [result] = await db.execute(
          `INSERT INTO usuarios (nombre, apellido, email, password, email_verificado) 
           VALUES (?, ?, ?, ?, ?)`,
          ['Test', 'Usuario', TEST_EMAIL, '$2b$10$dummyHashForTesting', true]
        );
        
        console.log('✅ Usuario creado con ID:', result.insertId);
        console.log('\n💡 Ahora puedes ejecutar tus tests de email');
        
      } catch (error) {
        console.error('❌ Error creando usuario:', error.message);
      }
    }
    
    // 4. Verificar constraints
    console.log('\n4️⃣  Verificando foreign key constraints...');
    const [constraints] = await db.execute(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_NAME IN ('password_resets', 'email_verifications')
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);
    
    console.log('\n   Foreign Keys encontradas:');
    constraints.forEach(c => {
      console.log(`   ${c.TABLE_NAME}.${c.COLUMN_NAME} → ${c.REFERENCED_TABLE_NAME}.${c.REFERENCED_COLUMN_NAME}`);
    });
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error(error);
  } finally {
    await db.end();
    console.log('\n✅ Debug completado\n');
  }
}

debugTestUser();