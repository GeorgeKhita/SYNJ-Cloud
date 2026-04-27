function generateTiers(available, min, step){
    if(available < min){
        return [];
    } else {
        const tiers = [];        // la liste vide
        for (let i = min; i <= available; i += step) {
        tiers.push(i);         // ajouter i dans la liste
        }
        return tiers;
    }
    
}

module.exports = {generateTiers};