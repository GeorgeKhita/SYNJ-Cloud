const cartService = require('../services/cart.service');

async function validateCart(req, res) {
  const { productId, orderId, requested } = req.body;
  const result = await cartService.validateCart(productId, orderId, requested);

  if (!result) {
    res.status(404).json({ error: "Produit non trouvé" });
  } else if (result.error === "LOCK_CONFLICT") {
    res.status(409).json({ error: result.message });
  } else if (result.error) {
    res.status(400).json({ error: result.error });
  } else {
    res.json(result);
  }
}

module.exports = { validateCart };