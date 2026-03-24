const express = require('express');
const cors = require('cors');
const availabilityRoutes = require('./routes/availability');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Utilisation des routes avec un préfixe
app.use('/availability', availabilityRoutes);

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});