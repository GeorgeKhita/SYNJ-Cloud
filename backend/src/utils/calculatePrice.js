function calculatePrice(product, requested) {
  const extra_ram = requested.ram - product.base_resources.ram;
  const extra_cpu = requested.cpu - product.base_resources.cpu;
  const extra_storage = requested.storage - product.base_resources.storage;

  let total = product.base_price;
  total += extra_ram * product.addons.ram_price;
  total += extra_cpu * product.addons.cpu_price;

  // le stockage seulement si le produit en propose
  if (product.addons.storage_price) {
    total += extra_storage * product.addons.storage_price;
  }

  return total;
}

module.exports = {calculatePrice};