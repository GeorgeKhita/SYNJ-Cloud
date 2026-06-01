import * as productService from '../services/product.service.js';

export async function list(req, res) {
  const products = await productService.listProducts(req.query.type);
  res.json({ products });
}

export async function get(req, res) {
  const product = await productService.getProduct(Number(req.params.id));
  res.json({ product });
}

export async function calculatePrice(req, res) {
  const result = await productService.calculatePrice(Number(req.params.id), req.body.resources);
  res.json(result);
}
