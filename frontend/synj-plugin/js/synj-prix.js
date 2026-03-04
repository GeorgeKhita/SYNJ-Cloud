// SYNJ — Prix dynamique en temps réel (P11)

const config = {
    base: 8,           // Prix de base en €
    ramParGo: 3,       // € par Go de RAM
    stockageParGo: 0.02, // € par Go de stockage
    cpuParCoeur: 3     // € par cœur CPU
  }
  
  function calculerPrix() {
    const ram = document.querySelector('select[data-attribute_name="attribute_ram"]');
    const stockage = document.querySelector('select[data-attribute_name="attribute_stockage"]');
    const cpu = document.querySelector('select[data-attribute_name="attribute_cpu"]');
  
    if (!ram || !stockage || !cpu) return;
  
    const ramVal = ram.value ? parseFloat(ram.value) : 0;
    const stockageVal = stockage.value ? parseFloat(stockage.value) : 0;
    const cpuVal = cpu.value ? parseFloat(cpu.value) : 0;
  
    let affichage = document.querySelector('#synj-prix');
    if (!affichage) {
      affichage = document.createElement('div');
      affichage.id = 'synj-prix';
      affichage.style.cssText = `
        background:rgb(0, 0, 0);
        border: 2px solid rgb(0, 0, 0);
        color:rgb(255, 255, 255);
        padding: 16px 20px;
        border-radius: 8px;
        margin: 16px 0;
        font-size: 22px;
        font-weight: bold;
      `;
      const zone = document.querySelector('.wp-block-post-title');
      if (zone) zone.insertAdjacentElement('afterend', affichage);
    }
  
    // N'affiche le prix que si tout est sélectionné
    if (ramVal === 0 || stockageVal === 0 || cpuVal === 0) {
      affichage.style.display = 'none';
      return;
    }
  
    const prix = config.base 
      + (ramVal * config.ramParGo)
      + (stockageVal * config.stockageParGo)
      + (cpuVal * config.cpuParCoeur);

      affichage.style.display = 'block';
      affichage.style.opacity = '0';
      affichage.style.transition = 'opacity 0.2s ease';
      
      setTimeout(() => {
        affichage.textContent = `Prix estimé : ${prix.toFixed(2)} €`;
        affichage.style.opacity = '1';
      }, 200);
  }
  
  // Recalcule à chaque changement
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', calculerPrix);
    });
    calculerPrix();
  });

// Cacher le prix statique WooCommerce
const prixWooCommerce = document.querySelector('.woocommerce-Price-amount');
if (prixWooCommerce) {
  prixWooCommerce.closest('p.price, span.price')
    ? prixWooCommerce.closest('p.price, span.price').style.display = 'none'
    : prixWooCommerce.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    // Écoute les changements sur tous les selects
    document.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', calculerPrix);
    });
  
    // Écoute aussi le clic sur "Effacer"
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('reset_variations')) {
        setTimeout(calculerPrix, 100);
      }
    });
  
    calculerPrix();
  });