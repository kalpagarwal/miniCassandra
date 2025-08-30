#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

/**
 * Test Client for Distributed Database
 * Demonstrates partitioning, replication, and failure handling
 */
class TestClient {
    constructor(nodeAddresses = ['localhost:3001', 'localhost:3002', 'localhost:3003']) {
        this.nodeAddresses = nodeAddresses;
        this.currentNodeIndex = 0;
    }

    /**
     * Get the current active node for requests
     */
    getCurrentNode() {
        return this.nodeAddresses[this.currentNodeIndex];
    }

    /**
     * Rotate to next node (for load balancing simulation)
     */
    rotateNode() {
        this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodeAddresses.length;
    }

    /**
     * Make HTTP request with error handling
     */
    async makeRequest(method, path, data = null) {
        const baseURL = `http://${this.getCurrentNode()}`;
        
        try {
            const config = {
                method,
                url: `${baseURL}${path}`,
                timeout: 5000
            };
            
            if (data) {
                config.data = data;
            }
            
            const response = await axios(config);
            return { success: true, data: response.data };
            
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data || error.message 
            };
        }
    }

    /**
     * Store data in the distributed database
     */
    async put(key, value) {
        console.log(chalk.blue(`\n📝 Storing: ${key} = ${JSON.stringify(value)}`));
        
        const result = await this.makeRequest('PUT', `/data/${key}`, { value });
        
        if (result.success) {
            console.log(chalk.green('✅ Write successful:'));
            console.log(`   - Replicated to: ${result.data.replicaNodes.join(', ')}`);
            console.log(`   - Successful writes: ${result.data.successfulWrites}/${result.data.replicaNodes.length}`);
            console.log(`   - Quorum achieved: ${result.data.quorumAchieved}`);
        } else {
            console.log(chalk.red('❌ Write failed:'), result.error);
        }
        
        return result;
    }

    /**
     * Retrieve data from the distributed database
     */
    async get(key) {
        console.log(chalk.blue(`\n📖 Reading: ${key}`));
        
        const result = await this.makeRequest('GET', `/data/${key}`);
        
        if (result.success) {
            console.log(chalk.green('✅ Read successful:'));
            console.log(`   - Value: ${JSON.stringify(result.data.value)}`);
            console.log(`   - Read from ${result.data.readResults} replica(s)`);
            console.log(`   - Quorum achieved: ${result.data.quorumAchieved}`);
            console.log(`   - Last modified by: ${result.data.metadata.nodeId}`);
        } else {
            console.log(chalk.red('❌ Read failed:'), result.error);
        }
        
        return result;
    }

    /**
     * Get cluster status
     */
    async getClusterStatus() {
        console.log(chalk.blue('\n🏥 Checking cluster status...'));
        
        const result = await this.makeRequest('GET', '/cluster/status');
        
        if (result.success) {
            console.log(chalk.green('✅ Cluster status:'));
            console.log(`   - Total nodes: ${result.data.totalNodes}`);
            console.log(`   - Alive nodes: ${result.data.aliveNodes}`);
            console.log(`   - Replication factor: ${result.data.replicationFactor}`);
            console.log(`   - Quorum size: ${result.data.quorumSize}`);
            
            result.data.nodes.forEach(node => {
                const status = node.status === 'alive' ? '🟢' : '🔴';
                console.log(`   ${status} ${node.nodeId} (${node.address})`);
            });
        } else {
            console.log(chalk.red('❌ Failed to get cluster status:'), result.error);
        }
        
        return result;
    }

    /**
     * Get data distribution
     */
    async getDataDistribution() {
        console.log(chalk.blue('\n📊 Checking data distribution...'));
        
        const result = await this.makeRequest('GET', '/cluster/distribution');
        
        if (result.success) {
            console.log(chalk.green('✅ Data distribution:'));
            Object.entries(result.data).forEach(([key, replicas]) => {
                console.log(`   ${key} -> [${replicas.join(', ')}]`);
            });
        } else {
            console.log(chalk.red('❌ Failed to get data distribution:'), result.error);
        }
        
        return result;
    }

    /**
     * Run comprehensive test suite
     */
    async runTests() {
        console.log(chalk.magenta('\n🧪 Starting Distributed Database Tests\n'));
        
        // Test 1: Check initial cluster status
        await this.getClusterStatus();
        
        // Test 2: Store some data
        await this.put('user:1', { name: 'John Doe', email: 'john@example.com' });
        await this.put('user:2', { name: 'Jane Smith', email: 'jane@example.com' });
        await this.put('product:1', { name: 'Laptop', price: 999.99 });
        await this.put('product:2', { name: 'Mouse', price: 29.99 });
        await this.put('order:1', { userId: 1, productId: 1, quantity: 1 });
        
        // Test 3: Retrieve data
        await this.get('user:1');
        await this.get('product:1');
        await this.get('nonexistent:key');
        
        // Test 4: Check data distribution
        await this.getDataDistribution();
        
        // Test 5: Test from different nodes (load balancing)
        console.log(chalk.yellow('\n🔄 Testing from different nodes...'));
        this.rotateNode();
        console.log(chalk.gray(`Switched to node: ${this.getCurrentNode()}`));
        await this.get('user:2');
        
        this.rotateNode();
        console.log(chalk.gray(`Switched to node: ${this.getCurrentNode()}`));
        await this.get('product:2');
        
        // Test 6: Final cluster status
        await this.getClusterStatus();
        
        console.log(chalk.magenta('\n🎉 Test suite completed!'));
    }
}

// Main execution
async function main() {
    const client = new TestClient();
    
    // Wait a bit for nodes to be ready
    console.log(chalk.yellow('⏳ Waiting for cluster to be ready...'));
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await client.runTests();
}

if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('❌ Test failed:'), error);
        process.exit(1);
    });
}

module.exports = TestClient;
