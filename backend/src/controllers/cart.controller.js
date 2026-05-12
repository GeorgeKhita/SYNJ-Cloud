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

async function checkout(req, res) {
  const { productId, orderId, requested, os } = req.body;
  const userId = req.user.userId;

  if (!productId || !orderId || !requested) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  const result = await cartService.checkout(userId, productId, orderId, requested, os);

  if (!result) {
    res.status(404).json({ error: "Produit non trouvé" });
  } else if (result.error) {
    res.status(400).json({ error: result.error });
  } else {
    res.json(result);
  }
}

module.exports = { validateCart, checkout };