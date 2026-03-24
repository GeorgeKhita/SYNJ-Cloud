const proxmox = require('../config/proxmox');

exports.getMemory = async (req, res) => {
    try {
        const status = await proxmox.nodes.pve.status.$get();
        res.json({
            success: true,
            available_memory: status.memory.available,
            total_memory: status.memory.total,
            free_memory: status.memory.free,
            used_memory: status.memory.used
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getCPU = async (req, res) => {
    try {
        const status = await proxmox.nodes.pve.status.$get();
        res.json({
            success: true,
            available_cpu: status.cpu
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getStorage = async (req, res) => {
    try {
        const status = await proxmox.nodes.pve.storage.$get();
        
        const target_storage = status.find(item => item.storage === 'local-lvm');

        if (!target_storage) {
            return res.status(404).json({
                success: false,
                message: "Le stockage spécifié n'a pas été trouvé"
            });
        }

        res.json({
            success: true,
            available_storage: target_storage.avail,
            total_storage: target_storage.total,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};