#!/usr/bin/env node

const chalk = require('chalk');
const TestClient = require('./test-client');
const FailureSimulation = require('./failure-simulation');

/**
 * Interactive Cluster Demo
 * Provides guided demonstrations of distributed database features
 */
class ClusterDemo {
    constructor() {
        this.client = new TestClient();
        this.simulation = new FailureSimulation();
    }

    /**
     * Display main menu
     */
    showMenu() {
        console.log(chalk.cyan('\n🎯 Distributed Database Demo Menu\n'));
        console.log('1. 🏥 Check Cluster Health');
        console.log('2. 📝 Store Sample Data');
        console.log('3. 📖 Read Sample Data');
        console.log('4. 📊 Show Data Distribution');
        console.log('5. 🔄 Test Load Balancing');
        console.log('6. 🚨 Failure Detection Demo');
        console.log('7. 🧪 Run Full Test Suite');
        console.log('8. 🛑 Exit\n');
    }

    /**
     * Wait for user input (simplified for demo)
     */
    async waitForInput() {
        return new Promise((resolve) => {
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });
    }

    /**
     * Run interactive demo
     */
    async runDemo() {
        console.log(chalk.magenta('🚀 Welcome to the Distributed Database Demo!'));
        console.log(chalk.yellow('Make sure you have started the cluster nodes first:'));
        console.log('  Terminal 1: npm run start:node1');
        console.log('  Terminal 2: npm run start:node2');
        console.log('  Terminal 3: npm run start:node3');
        
        // Wait for cluster to be ready
        console.log(chalk.yellow('\n⏳ Waiting for cluster to be ready...'));
        await new Promise(resolve => setTimeout(resolve, 3000));

        while (true) {
            this.showMenu();
            console.log(chalk.blue('Enter your choice (1-8): '));
            
            // For demo purposes, let's run the full test suite automatically
            console.log(chalk.green('Running full demonstration automatically...\n'));
            
            await this.runFullDemo();
            break;
        }
    }

    /**
     * Run full automated demonstration
     */
    async runFullDemo() {
        console.log(chalk.magenta('🎬 Starting Full Demonstration\n'));
        
        // Demo 1: Cluster Health
        console.log(chalk.cyan('=== Demo 1: Cluster Health ==='));
        await this.client.getClusterStatus();
        
        await this.pause(2000);
        
        // Demo 2: Data Storage and Replication
        console.log(chalk.cyan('\n=== Demo 2: Data Storage and Replication ==='));
        await this.client.put('demo:user:1', { 
            name: 'Alice Johnson', 
            role: 'Engineer', 
            department: 'Backend' 
        });
        
        await this.client.put('demo:product:laptop', { 
            name: 'MacBook Pro', 
            price: 2499, 
            category: 'Electronics' 
        });
        
        await this.pause(1000);
        
        // Demo 3: Data Retrieval and Consistency
        console.log(chalk.cyan('\n=== Demo 3: Data Retrieval and Consistency ==='));
        await this.client.get('demo:user:1');
        await this.client.get('demo:product:laptop');
        
        await this.pause(1000);
        
        // Demo 4: Data Distribution
        console.log(chalk.cyan('\n=== Demo 4: Data Distribution Across Nodes ==='));
        await this.client.getDataDistribution();
        
        await this.pause(1000);
        
        // Demo 5: Load Balancing
        console.log(chalk.cyan('\n=== Demo 5: Load Balancing Across Nodes ==='));
        for (let i = 0; i < 3; i++) {
            console.log(chalk.gray(`Reading from node: ${this.client.getCurrentNode()}`));
            await this.client.get('demo:user:1');
            this.client.rotateNode();
            await this.pause(500);
        }
        
        await this.pause(1000);
        
        // Demo 6: Explain Key Concepts
        console.log(chalk.cyan('\n=== Demo 6: Key Distributed Systems Concepts ==='));
        this.explainConcepts();
        
        await this.pause(2000);
        
        // Demo 7: Failure Simulation Instructions
        console.log(chalk.cyan('\n=== Demo 7: Failure Detection Instructions ==='));
        this.explainFailureSimulation();
        
        console.log(chalk.magenta('\n🎉 Demonstration completed!'));
        console.log(chalk.green('\n🎓 What you learned:'));
        console.log('  ✅ How consistent hashing partitions data');
        console.log('  ✅ How replication provides fault tolerance');
        console.log('  ✅ How quorum consensus ensures consistency');
        console.log('  ✅ How failure detection maintains availability');
        console.log('  ✅ How the system handles distributed operations');
    }

    /**
     * Explain key distributed systems concepts
     */
    explainConcepts() {
        console.log(chalk.yellow('🧠 Key Concepts Explained:'));
        
        console.log(chalk.blue('\n1. 🔄 Consistent Hashing (Partitioning):'));
        console.log('   - Each key is hashed to a position on a ring');
        console.log('   - Data is stored on the next N nodes clockwise');
        console.log('   - Virtual nodes ensure even distribution');
        console.log('   - Adding/removing nodes minimally affects data placement');
        
        console.log(chalk.blue('\n2. 📋 Replication Strategy:'));
        console.log('   - Each piece of data is stored on multiple nodes');
        console.log('   - Replication factor determines how many copies exist');
        console.log('   - Consecutive nodes in the ring are chosen as replicas');
        console.log('   - Provides fault tolerance and high availability');
        
        console.log(chalk.blue('\n3. 🤝 Quorum Consensus:'));
        console.log('   - Quorum = (Replication Factor / 2) + 1');
        console.log('   - Writes succeed only if majority of replicas respond');
        console.log('   - Reads from majority ensure consistent data');
        console.log('   - Balances consistency with availability');
        
        console.log(chalk.blue('\n4. 💓 Failure Detection:'));
        console.log('   - Nodes send heartbeats every 2 seconds');
        console.log('   - Missing heartbeats for 10 seconds = node failure');
        console.log('   - Failed nodes are removed from the ring');
        console.log('   - System continues operating with remaining nodes');
    }

    /**
     * Explain failure simulation
     */
    explainFailureSimulation() {
        console.log(chalk.red('🚨 To test failure detection:'));
        console.log(chalk.yellow('1. Open a new terminal and run: node failure-simulation.js'));
        console.log(chalk.yellow('2. When prompted, kill one of the node processes (Ctrl+C)'));
        console.log(chalk.yellow('3. Watch how the system detects and handles the failure'));
        console.log(chalk.yellow('4. Observe that data remains available despite the failure'));
        
        console.log(chalk.blue('\n💡 What you\'ll observe:'));
        console.log('  - Automatic failure detection within 10 seconds');
        console.log('  - Cluster continues operating with remaining nodes');
        console.log('  - Data remains accessible from surviving replicas');
        console.log('  - System maintains consistency through quorum reads/writes');
    }

    /**
     * Pause execution for demonstration timing
     */
    async pause(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const demo = new ClusterDemo();
    await demo.runDemo();
}

if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('❌ Demo failed:'), error);
        process.exit(1);
    });
}

module.exports = ClusterDemo;
