const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketClient = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');

/**
 * Database Node Implementation
 * Each node stores data, handles replication, and participates in failure detection
 */
class Node {
    constructor(nodeId, port, host = 'localhost') {
        this.nodeId = nodeId;
        this.port = port;
        this.host = host;
        this.address = `${host}:${port}`;
        
        // Data storage - in production this would be persistent storage
        this.data = new Map();
        this.metadata = new Map(); // Stores version vectors and timestamps
        
        // Cluster state
        this.peers = new Map(); // Connected peer nodes
        this.isAlive = true;
        this.lastHeartbeat = new Map(); // Track peer heartbeats
        
        // Replication and consistency
        this.pendingWrites = new Map(); // Track pending write operations
        this.writeTimeout = 5000; // 5 seconds
        
        // Initialize Express server and Socket.IO
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);
        
        this.setupExpress();
        this.setupSocketIO();
        this.startHeartbeat();
        
        console.log(chalk.green(`🚀 Node ${this.nodeId} initialized on ${this.address}`));
    }

    /**
     * Setup Express middleware and routes
     */
    setupExpress() {
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                nodeId: this.nodeId,
                address: this.address,
                isAlive: this.isAlive,
                dataCount: this.data.size,
                peersCount: this.peers.size,
                timestamp: Date.now()
            });
        });

        // Data operations endpoints will be added by the cluster
    }

    /**
     * Setup Socket.IO for peer-to-peer communication
     */
    setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.log(chalk.blue(`📡 Peer connected: ${socket.id}`));

            // Handle peer identification
            socket.on('identify', (peerInfo) => {
                socket.peerId = peerInfo.nodeId;
                this.peers.set(peerInfo.nodeId, {
                    ...peerInfo,
                    socket: socket,
                    lastSeen: Date.now()
                });
                this.lastHeartbeat.set(peerInfo.nodeId, Date.now());
                console.log(chalk.cyan(`🤝 Peer ${peerInfo.nodeId} identified`));
            });

            // Handle heartbeat messages
            socket.on('heartbeat', (data) => {
                if (socket.peerId) {
                    this.lastHeartbeat.set(socket.peerId, Date.now());
                }
            });

            // Handle data replication
            socket.on('replicate_data', (data) => {
                this.handleReplication(data);
            });

            // Handle read requests
            socket.on('read_request', (data, callback) => {
                this.handleReadRequest(data, callback);
            });

            // Handle write requests
            socket.on('write_request', (data, callback) => {
                this.handleWriteRequest(data, callback);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                if (socket.peerId) {
                    console.log(chalk.red(`📵 Peer ${socket.peerId} disconnected`));
                    this.peers.delete(socket.peerId);
                    this.lastHeartbeat.delete(socket.peerId);
                }
            });
        });
    }

    /**
     * Start the node server
     */
    async start() {
        return new Promise((resolve) => {
            this.server.listen(this.port, this.host, () => {
                console.log(chalk.green(`🟢 Node ${this.nodeId} listening on ${this.address}`));
                resolve();
            });
        });
    }

    /**
     * Connect to another node
     */
    async connectToPeer(peerAddress) {
        const [host, port] = peerAddress.split(':');
        const socket = socketClient(`http://${host}:${port}`);
        
        return new Promise((resolve, reject) => {
            socket.on('connect', () => {
                // Identify ourselves to the peer
                socket.emit('identify', {
                    nodeId: this.nodeId,
                    address: this.address
                });
                
                console.log(chalk.green(`🔗 Connected to peer at ${peerAddress}`));
                resolve(socket);
            });

            socket.on('connect_error', (error) => {
                console.log(chalk.red(`❌ Failed to connect to ${peerAddress}: ${error.message}`));
                reject(error);
            });
        });
    }

    /**
     * Store data locally
     */
    storeData(key, value, version = 1) {
        const timestamp = Date.now();
        this.data.set(key, value);
        this.metadata.set(key, {
            version,
            timestamp,
            nodeId: this.nodeId
        });
        
        console.log(chalk.yellow(`💾 Stored locally: ${key} = ${JSON.stringify(value)}`));
    }

    /**
     * Retrieve data locally
     */
    getData(key) {
        const value = this.data.get(key);
        const metadata = this.metadata.get(key);
        
        if (value !== undefined) {
            return { value, metadata };
        }
        return null;
    }

    /**
     * Handle replication from other nodes
     */
    handleReplication(data) {
        const { key, value, metadata } = data;
        const existingMetadata = this.metadata.get(key);
        
        // Simple conflict resolution: latest timestamp wins
        if (!existingMetadata || metadata.timestamp > existingMetadata.timestamp) {
            this.storeData(key, value, metadata.version);
            console.log(chalk.magenta(`🔄 Replicated: ${key} from node ${metadata.nodeId}`));
        }
    }

    /**
     * Handle read requests from other nodes
     */
    handleReadRequest(data, callback) {
        const { key } = data;
        const result = this.getData(key);
        callback(result);
    }

    /**
     * Handle write requests from other nodes
     */
    handleWriteRequest(data, callback) {
        const { key, value, metadata } = data;
        this.storeData(key, value, metadata.version);
        callback({ success: true, nodeId: this.nodeId });
    }

    /**
     * Replicate data to peer nodes
     */
    async replicateToPeers(key, value, metadata, targetNodes) {
        const replicationPromises = [];
        
        for (const nodeId of targetNodes) {
            if (nodeId === this.nodeId) continue; // Don't replicate to self
            
            const peer = this.peers.get(nodeId);
            if (peer && peer.socket) {
                const promise = new Promise((resolve) => {
                    peer.socket.emit('replicate_data', { key, value, metadata }, (response) => {
                        resolve({ nodeId, success: true });
                    });
                    
                    // Timeout after 3 seconds
                    setTimeout(() => {
                        resolve({ nodeId, success: false, error: 'timeout' });
                    }, 3000);
                });
                
                replicationPromises.push(promise);
            }
        }
        
        const results = await Promise.all(replicationPromises);
        return results;
    }

    /**
     * Start heartbeat mechanism for failure detection
     */
    startHeartbeat() {
        setInterval(() => {
            // Send heartbeat to all peers
            this.peers.forEach((peer, nodeId) => {
                if (peer.socket && peer.socket.connected) {
                    peer.socket.emit('heartbeat', {
                        nodeId: this.nodeId,
                        timestamp: Date.now()
                    });
                }
            });

            // Check for failed nodes
            this.checkForFailedNodes();
        }, 2000); // Every 2 seconds
    }

    /**
     * Check for failed nodes based on missed heartbeats
     */
    checkForFailedNodes() {
        const now = Date.now();
        const failureThreshold = 10000; // 10 seconds
        
        this.lastHeartbeat.forEach((lastSeen, nodeId) => {
            if (now - lastSeen > failureThreshold) {
                console.log(chalk.red(`💀 Node ${nodeId} appears to have failed`));
                this.handleNodeFailure(nodeId);
            }
        });
    }

    /**
     * Handle detected node failure
     */
    handleNodeFailure(failedNodeId) {
        // Remove from peers
        this.peers.delete(failedNodeId);
        this.lastHeartbeat.delete(failedNodeId);
        
        // Notify cluster about the failure
        this.broadcastNodeFailure(failedNodeId);
    }

    /**
     * Broadcast node failure to other peers
     */
    broadcastNodeFailure(failedNodeId) {
        this.peers.forEach((peer) => {
            if (peer.socket && peer.socket.connected) {
                peer.socket.emit('node_failure', {
                    failedNodeId,
                    reportedBy: this.nodeId,
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Get node statistics
     */
    getStats() {
        return {
            nodeId: this.nodeId,
            address: this.address,
            isAlive: this.isAlive,
            dataCount: this.data.size,
            peersCount: this.peers.size,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log(chalk.yellow(`🛑 Shutting down node ${this.nodeId}`));
        this.isAlive = false;
        
        // Close all peer connections
        this.peers.forEach((peer) => {
            if (peer.socket) {
                peer.socket.disconnect();
            }
        });
        
        // Close server
        this.server.close();
    }
}

module.exports = Node;
