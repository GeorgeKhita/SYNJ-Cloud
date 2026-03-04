// SYNJ — Messages UX ressources (P13)
// Modifie la valeur de ram, stockage et cpu pour tester les 3 cas

const ressources = {
    ram: 8,      // Change à 0 pour tester "indisponible"
    stockage: 40, // Change à 1 pour tester "limité"
    cpu: 2,
    ramMin: 2    // Minimum requis pour ce produit
  }
  
  function afficherMessageRessources() {
    // Récupère la zone du produit
    const zone = document.querySelector('.wp-block-post-title');
    
    if (!zone) return;
  
    let message = '';
    let couleur = '';
  
    if (ressources.ram === 0 || ressources.stockage === 0 || ressources.cpu === 0) {
      // Cas 1 : Aucune ressource
      message = '🔴 Temporairement indisponible';
      couleur = '#ef4444';
  
    } else if (ressources.ram < ressources.ramMin) {
      // Cas 2 : Ressources insuffisantes
      message = '🔴 Ressources temporairement insuffisantes';
      couleur = '#f97316';
  
    } else if (ressources.ram <= 2) {
      // Cas 3 : Ressources limitées
      message = '⚠️ Ressources limitées – disponibilité en temps réel';
      couleur = '#f59e0b';
    }
  
    if (message) {
      const div = document.createElement('div');
      div.style.cssText = `
        background: ${couleur}22;
        border: 2px solid ${couleur};
        color: ${couleur};
        padding: 12px 16px;
        border-radius: 8px;
        margin: 16px 0;
        font-weight: bold;
        font-size: 14px;
      `;
      div.textContent = message;
      zone.insertAdjacentElement('afterend', div);
    }
  }
  
  document.addEventListener('DOMContentLoaded', afficherMessageRessources);