import express from 'express';
import cors from 'cors';
import { setupSwagger } from './src/config/swagger.js';
import institucionRoutes from './src/routes/instituciones.js';
import rifasRoutes from './src/routes/rifas.js';

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use('/instituciones', institucionRoutes);
app.use('/rifas', rifasRoutes);

// Documentación Swagger
setupSwagger(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));



// Prueba