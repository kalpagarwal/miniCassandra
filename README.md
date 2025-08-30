# Distributed Database - Cassandra-like Implementation

This is a simplified implementation of a distributed database system similar to Apache Cassandra, built in Node.js. It demonstrates key concepts of distributed systems including **partitioning**, **replication**, and **failure detection**.

## 🏗️ Architecture Overview

### Core Components

1. **ConsistentHashing.js** - Implements consistent hashing for data partitioning
2. **Node.js** - Individual database nodes with storage and peer communication
3. **Cluster.js** - Orchestrates the distributed system operations

### Key Features

- ✅ **Consistent Hashing**: Distributes data evenly across nodes
- ✅ **Replication**: Configurable replication factor (default: 3)
- ✅ **Quorum Consistency**: Majority reads/writes for consistency
- ✅ **Failure Detection**: Heartbeat-based failure detection
- ✅ **Automatic Recovery**: Handles node failures gracefully
- ✅ **REST API**: HTTP endpoints for database operations

## 📚 Distributed Systems Concepts Implemented

### 1. Partitioning (Consistent Hashing)

```javascript
// Data is distributed using consistent hashing
const hash = crypto.createHash('sha256').update(key).digest('hex');
const position = parseInt(hash.substring(0, 8), 16);

// Virtual nodes ensure even distribution
for (let i = 0; i < virtualNodes; i++) {
    const virtualNodeKey = `${nodeId}:${i}`;
    // ... hash and place on ring
}
```

**Why Consistent Hashing?**
- Minimizes data movement when nodes join/leave
- Provides even load distribution
- Scales horizontally

### 2. Replication Strategy

```javascript
// Get N replicas for a key (where N = replication factor)
getReplicaNodes(key) {
    // Find primary node and next N-1 nodes clockwise
    const replicas = new Set();
    while (replicas.size < this.replicationFactor) {
        // Add consecutive nodes for replication
    }
    return Array.from(replicas);
}
```

**Replication Benefits:**
- **Fault Tolerance**: Data survives node failures
- **High Availability**: Multiple copies ensure availability
- **Load Distribution**: Reads can be served from any replica

### 3. Failure Detection

```javascript
// Heartbeat mechanism
setInterval(() => {
    peers.forEach(peer => {
        peer.socket.emit('heartbeat', { nodeId, timestamp });
    });
    checkForFailedNodes();
}, 2000);

// Failure detection
checkForFailedNodes() {
    const failureThreshold = 10000; // 10 seconds
    if (now - lastSeen > failureThreshold) {
        handleNodeFailure(nodeId);
    }
}
```

**Failure Detection Features:**
- **Heartbeat Protocol**: Regular health checks between nodes
- **Timeout-based Detection**: Nodes marked failed after threshold
- **Gossip Protocol**: Failure information spreads through cluster

### 4. Quorum Consistency

```javascript
// Quorum = (Replication Factor / 2) + 1
const quorumSize = Math.floor(replicationFactor / 2) + 1;

// Writes succeed only if quorum is achieved
const successfulWrites = writeResults.filter(r => r.success).length;
const quorumAchieved = successfulWrites >= quorumSize;
```

**Consistency Guarantees:**
- **Write Consistency**: Majority of replicas must acknowledge
- **Read Consistency**: Read from majority to ensure latest data
- **Conflict Resolution**: Latest timestamp wins

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

```bash
cd simple-node-app
npm install
```

### Running the Cluster

**Terminal 1 - Start Seed Node:**
```bash
node start-node1.js
```

**Terminal 2 - Start Node 2:**
```bash
node start-node2.js
```

**Terminal 3 - Start Node 3:**
```bash
node start-node3.js
```

**Terminal 4 - Run Tests:**
```bash
node test-client.js
```

## 📡 API Endpoints

### Data Operations

- `PUT /data/:key` - Store data with replication
- `GET /data/:key` - Retrieve data with consistency checks

### Cluster Management

- `GET /cluster/status` - Current cluster state
- `GET /cluster/ring` - Consistent hashing ring topology
- `GET /cluster/distribution` - Data distribution across nodes
- `GET /health` - Individual node health

### Example Usage

```bash
# Store data
curl -X PUT http://localhost:3001/data/user:123 \\
  -H "Content-Type: application/json" \\
  -d '{"value": {"name": "John Doe", "email": "john@example.com"}}'

# Retrieve data
curl http://localhost:3001/data/user:123

# Check cluster status
curl http://localhost:3001/cluster/status
```

## 🧪 Testing Scenarios

### 1. Basic Operations
```bash
node test-client.js
```

### 2. Failure Simulation
- Kill one node (Ctrl+C)
- Observe failure detection in other nodes
- Test read/write operations continue working

### 3. Partitioning Test
- Start with 1 node
- Add 2 more nodes
- Observe data redistribution

## 🔍 Understanding the Implementation

### Data Flow for PUT Operation

1. **Client Request**: `PUT /data/user:123`
2. **Hash Key**: Calculate hash position for "user:123"
3. **Find Replicas**: Get N nodes responsible for this key
4. **Coordinate Write**: Write to all replica nodes
5. **Quorum Check**: Ensure majority of writes succeed
6. **Response**: Return success/failure to client

### Data Flow for GET Operation

1. **Client Request**: `GET /data/user:123`
2. **Hash Key**: Calculate hash position for "user:123"
3. **Find Replicas**: Get N nodes that should have this key
4. **Read from Replicas**: Query all available replicas
5. **Conflict Resolution**: Return latest version (by timestamp)
6. **Response**: Return data to client

### Failure Detection Process

1. **Heartbeat**: Every 2 seconds, nodes send heartbeats
2. **Timeout Detection**: If no heartbeat for 10 seconds → failed
3. **Failure Propagation**: Failed node info spreads via gossip
4. **Ring Update**: Remove failed node from consistent hash ring
5. **Automatic Recovery**: System continues with remaining nodes

## 🎯 Key Learning Points

### 1. Consistent Hashing Benefits
- **Minimal Data Movement**: Only 1/N data moves when adding/removing nodes
- **Load Balancing**: Virtual nodes ensure even distribution
- **Fault Tolerance**: System works even with node failures

### 2. Replication Strategies
- **Multiple Copies**: Each key stored on N nodes
- **Replica Selection**: Consecutive nodes in hash ring
- **Consistency Models**: Quorum-based consistency

### 3. Failure Handling
- **Detection**: Heartbeat + timeout mechanism
- **Recovery**: Automatic removal of failed nodes
- **Availability**: System remains available with partial failures

### 4. CAP Theorem Trade-offs
- **Consistency**: Quorum reads/writes
- **Availability**: System works with node failures
- **Partition Tolerance**: Handles network splits

## 🔧 Configuration

### Node Configuration
```javascript
const cluster = new Cluster(replicationFactor);
await cluster.createNode(nodeId, port, host);
```

### Tunable Parameters
- `replicationFactor`: Number of replicas (default: 3)
- `virtualNodes`: Virtual nodes per physical node (default: 150)
- `heartbeatInterval`: Heartbeat frequency (default: 2s)
- `failureThreshold`: Failure detection timeout (default: 10s)

## 🚨 Production Considerations

This is a simplified educational implementation. For production use, consider:

- **Persistent Storage**: Replace in-memory maps with disk storage
- **Security**: Add authentication and encryption
- **Monitoring**: Add comprehensive metrics and logging
- **Performance**: Optimize for high throughput
- **Backup/Recovery**: Implement data backup and recovery
- **Network Optimization**: Use more efficient protocols than HTTP/Socket.IO

## 📝 File Structure

```
simple-node-app/
├── src/
│   ├── ConsistentHashing.js  # Partitioning logic
│   ├── Node.js              # Individual node implementation
│   └── Cluster.js           # Cluster orchestration
├── start-node1.js           # Seed node startup
├── start-node2.js           # Second node startup
├── start-node3.js           # Third node startup
├── test-client.js           # Test client
└── README.md               # This file
```
## 📂 File Descriptions

Below is a summary of the main files in this project and their roles:

### `Cluster.js`
**Purpose:** Central controller for the distributed database.

- **Node Management:** Creates, joins, and removes nodes from the cluster.
- **Replication Coordination:** Ensures data is replicated according to the configured replication factor.
- **Consistent Hashing:** Maintains the hash ring and assigns data partitions to nodes.
- **Failure Detection:** Monitors node health and manages recovery when nodes fail.
- **Cluster APIs:** Provides endpoints for cluster status, ring topology, and data distribution.

### `Node.js`
**Purpose:** Implements the logic for a single database node.

- **Local Storage:** Manages the node’s own key-value store (in-memory for this demo).
- **Peer Communication:** Handles messaging with other nodes for replication and heartbeats.
- **API Server:** Exposes REST endpoints for data operations and health checks.
- **Replication Handling:** Processes replication requests from peers.
- **Failure Detection:** Sends and receives heartbeat messages.
- **Conflict Resolution:** Uses timestamps or vector clocks to resolve data conflicts.

### `start-node{N}.js`
**Purpose:** Entry-point scripts to launch individual nodes (e.g., `start-node1.js`, `start-node2.js`).  
`Each node mimics a database server`

- **Node Initialization:** Sets up a new node with specific parameters (ID, port, host).
- **Cluster Connection:** Connects the node to the cluster as a seed or by joining existing nodes.
- **API Server Startup:** Starts the REST API server for database operations and health checks.

*Tip:* Run each script in a separate terminal to simulate a multi-node cluster.

### `test-client.js`
**Purpose:** Automated client for testing the cluster.

- **API Automation:** Sends PUT and GET requests to nodes.
- **Usage Simulation:** Mimics client operations to verify partitioning, replication, and consistency.
- **Failure Testing:** Tests cluster behavior during node failures and recovery.
- **Validation:** Checks data distribution and availability across the cluster.

*Tip:* Run `node test-client.js` to validate your cluster’s core features and robustness.

## 🎓 Learning Exercises

1. **Modify Replication Factor**: Change from 3 to 5 and observe behavior
2. **Implement Write-ahead Log**: Add durability to writes
3. **Add Merkle Trees**: Implement anti-entropy for data synchronization
4. **Network Partitions**: Simulate and handle network splits
5. **Load Testing**: Test with thousands of concurrent operations

## 📖 Further Reading

- [Cassandra Architecture](https://cassandra.apache.org/doc/latest/architecture/)
- [Consistent Hashing Paper](https://en.wikipedia.org/wiki/Consistent_hashing)
- [CAP Theorem](https://en.wikipedia.org/wiki/CAP_theorem)
- [Distributed Systems Concepts](https://en.wikipedia.org/wiki/Distributed_computing)
