const productService = require('../services/product.service');

async function getOptions(req, res) {
    const productId = req.params.id;
    const result = await productService.getProductOptions(productId);
    if (!result) {
    // Produit n'existe pas
        res.status(404).json({ error: "Produit non trouvé" });
    } else if (result.error) {
    // Proxmox est down
        res.status(503).json({ error: result.error });
    } else {
    // Tout OK
        res.json(result);
    }
}

module.exports = {getOptions};