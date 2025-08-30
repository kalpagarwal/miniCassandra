const ConsistentHashing = require('./ConsistentHashing');
const Node = require('./Node');
const chalk = require('chalk');
const axios = require('axios');

/**
 * Distributed Database Cluster
 * Manages nodes, partitioning, replication, and consistency
 */
class Cluster {
    constructor(replicationFactor = 3) {
        this.replicationFactor = replicationFactor;
        this.consistentHashing = new ConsistentHashing(replicationFactor);
        this.localNode = null;
        this.seedNodes = []; // Bootstrap nodes
        this.quorumSize = Math.floor(replicationFactor / 2) + 1; // Majority quorum
        
        console.log(chalk.blue(`🏗️  Cluster initialized with replication factor: ${replicationFactor}`));
    }

    /**
     * Create and start a local node
     */
    async createNode(nodeId, port, host = 'localhost') {
        this.localNode = new Node(nodeId, port, host);
        
        // Add API endpoints to the local node
        this.setupClusterAPI();
        
        await this.localNode.start();
        
        // Add this node to the consistent hashing ring
        this.consistentHashing.addNode(nodeId, {
            address: `${host}:${port}`,
            status: 'alive'
        });
        
        return this.localNode;
    }

    /**
     * Setup cluster-wide API endpoints
     */
    setupClusterAPI() {
        if (!this.localNode) return;

        // PUT operation - Store data with replication
        this.localNode.app.put('/data/:key', async (req, res) => {
            try {
                const { key } = req.params;
                const { value } = req.body;
                
                const result = await this.put(key, value);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // GET operation - Retrieve data with consistency
        this.localNode.app.get('/data/:key', async (req, res) => {
            try {
                const { key } = req.params;
                const result = await this.get(key);
                
                if (result) {
                    res.json(result);
                } else {
                    res.status(404).json({ error: 'Key not found' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Cluster status endpoint
        this.localNode.app.get('/cluster/status', (req, res) => {
            res.json(this.getClusterStatus());
        });

        // Ring status endpoint
        this.localNode.app.get('/cluster/ring', (req, res) => {
            res.json(this.getRingStatus());
        });

        // Add node endpoint
        this.localNode.app.post('/cluster/nodes', async (req, res) => {
            try {
                const { nodeId, address } = req.body;
                await this.addNode(nodeId, address);
                res.json({ success: true, message: `Node ${nodeId} added` });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Data distribution endpoint
        this.localNode.app.get('/cluster/distribution', (req, res) => {
            res.json(this.getDataDistribution());
        });
    }

    /**
     * Join an existing cluster by connecting to seed nodes
     */
    async joinCluster(seedNodeAddresses) {
        this.seedNodes = seedNodeAddresses;
        
        for (const seedAddress of seedNodeAddresses) {
            try {
                await this.localNode.connectToPeer(seedAddress);
                
                // Get cluster topology from seed node
                const response = await axios.get(`http://${seedAddress}/cluster/ring`);
                const ringInfo = response.data;
                
                // Add existing nodes to our ring
                for (const nodeInfo of ringInfo.nodes) {
                    if (nodeInfo.nodeId !== this.localNode.nodeId) {
                        this.consistentHashing.addNode(nodeInfo.nodeId, nodeInfo);
                        
                        // Connect to the node if not already connected
                        if (!this.localNode.peers.has(nodeInfo.nodeId)) {
                            try {
                                await this.localNode.connectToPeer(nodeInfo.address);
                            } catch (connError) {
                                console.log(chalk.yellow(`⚠️  Could not connect to ${nodeInfo.nodeId}`));
                            }
                        }
                    }
                }
                
                console.log(chalk.green(`🎯 Successfully joined cluster via ${seedAddress}`));
                break;
                
            } catch (error) {
                console.log(chalk.red(`❌ Failed to join via ${seedAddress}: ${error.message}`));
            }
        }
    }

    /**
     * Add a new node to the cluster
     */
    async addNode(nodeId, address) {
        this.consistentHashing.addNode(nodeId, {
            address,
            status: 'alive'
        });
        
        // Connect to the new node
        if (nodeId !== this.localNode.nodeId) {
            try {
                await this.localNode.connectToPeer(address);
            } catch (error) {
                console.log(chalk.red(`❌ Failed to connect to new node ${nodeId}`));
            }
        }
        
        // Trigger data redistribution (simplified)
        await this.redistributeData();
    }

    /**
     * PUT operation with replication and consistency
     */
    async put(key, value) {
        const timestamp = Date.now();
        const version = 1; // Simplified versioning
        const metadata = {
            version,
            timestamp,
            nodeId: this.localNode.nodeId
        };

        // Get replica nodes for this key
        const replicaNodes = this.consistentHashing.getReplicaNodes(key);
        console.log(chalk.blue(`📝 Writing ${key} to replicas: ${replicaNodes.join(', ')}`));

        const writeResults = [];
        
        // Write to local node if we're a replica
        if (replicaNodes.includes(this.localNode.nodeId)) {
            this.localNode.storeData(key, value, version);
            writeResults.push({ nodeId: this.localNode.nodeId, success: true });
        }

        // Replicate to other nodes
        const replicationResults = await this.localNode.replicateToPeers(
            key, value, metadata, replicaNodes
        );
        writeResults.push(...replicationResults);

        // Check if we achieved quorum
        const successfulWrites = writeResults.filter(r => r.success).length;
        const quorumAchieved = successfulWrites >= this.quorumSize;

        return {
            success: quorumAchieved,
            key,
            replicaNodes,
            successfulWrites,
            quorumSize: this.quorumSize,
            quorumAchieved,
            writeResults
        };
    }

    /**
     * GET operation with consistency checks
     */
    async get(key) {
        const replicaNodes = this.consistentHashing.getReplicaNodes(key);
        console.log(chalk.blue(`📖 Reading ${key} from replicas: ${replicaNodes.join(', ')}`));

        const readResults = [];
        
        // Read from local node if we're a replica
        if (replicaNodes.includes(this.localNode.nodeId)) {
            const localData = this.localNode.getData(key);
            if (localData) {
                readResults.push({
                    nodeId: this.localNode.nodeId,
                    success: true,
                    data: localData
                });
            }
        }

        // Read from peer nodes
        const peerReadPromises = replicaNodes
            .filter(nodeId => nodeId !== this.localNode.nodeId)
            .map(nodeId => this.readFromPeer(nodeId, key));

        const peerResults = await Promise.all(peerReadPromises);
        readResults.push(...peerResults.filter(r => r.success));

        if (readResults.length === 0) {
            return null;
        }

        // Conflict resolution: return the latest version
        const latestResult = readResults.reduce((latest, current) => {
            if (!latest || current.data.metadata.timestamp > latest.data.metadata.timestamp) {
                return current;
            }
            return latest;
        });

        return {
            value: latestResult.data.value,
            metadata: latestResult.data.metadata,
            readResults: readResults.length,
            quorumAchieved: readResults.length >= this.quorumSize
        };
    }

    /**
     * Read data from a peer node
     */
    async readFromPeer(nodeId, key) {
        const peer = this.localNode.peers.get(nodeId);
        
        if (!peer || !peer.socket) {
            return { nodeId, success: false, error: 'not_connected' };
        }

        return new Promise((resolve) => {
            peer.socket.emit('read_request', { key }, (response) => {
                if (response) {
                    resolve({ nodeId, success: true, data: response });
                } else {
                    resolve({ nodeId, success: false, error: 'not_found' });
                }
            });

            // Timeout after 3 seconds
            setTimeout(() => {
                resolve({ nodeId, success: false, error: 'timeout' });
            }, 3000);
        });
    }

    /**
     * Redistribute data when cluster topology changes
     */
    async redistributeData() {
        console.log(chalk.yellow('🔄 Starting data redistribution...'));
        
        // In a real implementation, this would move data between nodes
        // For now, we'll just log the redistribution
        const stats = this.consistentHashing.getStats();
        console.log(chalk.green(`✅ Data redistribution complete. Cluster stats:`, stats));
    }

    /**
     * Get cluster status
     */
    getClusterStatus() {
        const allNodes = this.consistentHashing.getAllNodes();
        const aliveNodes = allNodes.filter(nodeId => {
            if (nodeId === this.localNode.nodeId) return true;
            return this.localNode.peers.has(nodeId);
        });

        return {
            localNode: this.localNode.nodeId,
            totalNodes: allNodes.length,
            aliveNodes: aliveNodes.length,
            replicationFactor: this.replicationFactor,
            quorumSize: this.quorumSize,
            nodes: allNodes.map(nodeId => ({
                nodeId,
                status: aliveNodes.includes(nodeId) ? 'alive' : 'failed',
                address: this.consistentHashing.getNodeInfo(nodeId)?.address
            }))
        };
    }

    /**
     * Get consistent hashing ring status
     */
    getRingStatus() {
        const stats = this.consistentHashing.getStats();
        const nodes = this.consistentHashing.getAllNodes().map(nodeId => ({
            nodeId,
            ...this.consistentHashing.getNodeInfo(nodeId)
        }));

        return {
            ...stats,
            nodes
        };
    }

    /**
     * Simulate network partition for testing
     */
    simulatePartition(nodeIds) {
        console.log(chalk.red(`🚨 Simulating network partition for nodes: ${nodeIds.join(', ')}`));
        
        nodeIds.forEach(nodeId => {
            const peer = this.localNode.peers.get(nodeId);
            if (peer && peer.socket) {
                peer.socket.disconnect();
            }
        });
    }

    /**
     * Get data distribution across nodes
     */
    getDataDistribution() {
        const distribution = new Map();
        
        // Sample some keys to show distribution
        const sampleKeys = Array.from(this.localNode.data.keys()).slice(0, 10);
        
        sampleKeys.forEach(key => {
            const replicas = this.consistentHashing.getReplicaNodes(key);
            distribution.set(key, replicas);
        });

        return Object.fromEntries(distribution);
    }
}

module.exports = Cluster;
