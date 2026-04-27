const config = require('../config/products.config');
const { default_node } = require('../config/proxmox.config');
const resources = require('../proxmox/resources');
const tiers = require('../utils/generateTiers');

async function getProductOptions(productId) {
    const product = config[productId];
    if(product){
        const resource = await resources.getResources(default_node);
        if (!resource) {
            return { error: "Ressources temporairement indisponibles" };
        }
        const ramTiers = tiers.generateTiers(resource.ram, product.base_resources.ram, 1);
        const cpuTiers = tiers.generateTiers(resource.cpu, product.base_resources.cpu, 1);
        const storageTiers = product.addons.storage_price 
            ? tiers.generateTiers(resource.storage, product.base_resources.storage, 20)
            : [];
        return {
            product: product,
            tiers: {
                ram: ramTiers,
                cpu: cpuTiers,
                storage: storageTiers
            }
        };
    } else {
        return null;
    } 

}

module.exports = {getProductOptions};