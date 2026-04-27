// Importation des dépendances
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const router = require('./routes/product.routes');
require('./config/redis.client');
require('./config/db.client');

// Initialisation de l'app express
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialisation des routes
app.get('/health', (req, res) => {
    res.json({ status : "OK"});
});

app.use(router);

// Initialisation du serveur
app.listen(PORT, function(err){
    if (err) console.log("Erreur lors de l'initialisation du serveur ...");
    else console.log("Server listening on Port", PORT);
})