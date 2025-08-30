const crypto = require('crypto');

/**
 * Consistent Hashing Ring Implementation
 * This handles data partitioning across nodes in the distributed system
 */
class ConsistentHashing {
    constructor(replicationFactor = 3, virtualNodes = 150) {
        this.replicationFactor = replicationFactor;
        this.virtualNodes = virtualNodes; // Number of virtual nodes per physical node
        this.ring = new Map(); // Maps hash positions to node IDs
        this.sortedHashes = []; // Sorted array of hash positions
        this.nodes = new Map(); // Maps node IDs to node objects
    }

    /**
     * Hash function using SHA-256
     */
    hash(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    /**
     * Convert hex hash to integer for ring positioning
     */
    hashToPosition(hash) {
        return parseInt(hash.substring(0, 8), 16);
    }

    /**
     * Add a node to the consistent hashing ring
     */
    addNode(nodeId, nodeInfo) {
        this.nodes.set(nodeId, nodeInfo);
        
        // Add virtual nodes to distribute load evenly
        for (let i = 0; i < this.virtualNodes; i++) {
            const virtualNodeKey = `${nodeId}:${i}`;
            const hash = this.hash(virtualNodeKey);
            const position = this.hashToPosition(hash);
            
            this.ring.set(position, nodeId);
        }
        
        // Keep sorted array of hash positions for efficient lookups
        this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
        
        console.log(`✅ Added node ${nodeId} to ring with ${this.virtualNodes} virtual nodes`);
    }

    /**
     * Remove a node from the consistent hashing ring
     */
    removeNode(nodeId) {
        if (!this.nodes.has(nodeId)) {
            return false;
        }

        // Remove all virtual nodes for this physical node
        for (let i = 0; i < this.virtualNodes; i++) {
            const virtualNodeKey = `${nodeId}:${i}`;
            const hash = this.hash(virtualNodeKey);
            const position = this.hashToPosition(hash);
            
            this.ring.delete(position);
        }

        this.nodes.delete(nodeId);
        this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
        
        console.log(`❌ Removed node ${nodeId} from ring`);
        return true;
    }

    /**
     * Find the primary node responsible for a given key
     */
    getNode(key) {
        if (this.sortedHashes.length === 0) {
            return null;
        }

        const hash = this.hash(key);
        const position = this.hashToPosition(hash);

        // Find the first node clockwise from the key's position
        for (const hashPos of this.sortedHashes) {
            if (hashPos >= position) {
                return this.ring.get(hashPos);
            }
        }

        // Wrap around to the first node
        return this.ring.get(this.sortedHashes[0]);
    }

    /**
     * Get replica nodes for a given key (including primary)
     * This implements the replication strategy
     */
    getReplicaNodes(key) {
        if (this.sortedHashes.length === 0) {
            return [];
        }

        const hash = this.hash(key);
        const position = this.hashToPosition(hash);
        const replicas = new Set();
        
        // Find starting position
        let startIndex = 0;
        for (let i = 0; i < this.sortedHashes.length; i++) {
            if (this.sortedHashes[i] >= position) {
                startIndex = i;
                break;
            }
        }

        // Collect unique nodes for replication
        let currentIndex = startIndex;
        while (replicas.size < this.replicationFactor && replicas.size < this.nodes.size) {
            const nodeId = this.ring.get(this.sortedHashes[currentIndex]);
            replicas.add(nodeId);
            
            currentIndex = (currentIndex + 1) % this.sortedHashes.length;
        }

        return Array.from(replicas);
    }

    /**
     * Get all nodes in the cluster
     */
    getAllNodes() {
        return Array.from(this.nodes.keys());
    }

    /**
     * Get node information
     */
    getNodeInfo(nodeId) {
        return this.nodes.get(nodeId);
    }

    /**
     * Get cluster statistics
     */
    getStats() {
        return {
            totalNodes: this.nodes.size,
            virtualNodes: this.virtualNodes,
            replicationFactor: this.replicationFactor,
            ringSize: this.ring.size
        };
    }
}

module.exports = ConsistentHashing;
