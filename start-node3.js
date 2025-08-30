#!/usr/bin/env node

const Cluster = require('./src/Cluster');
const chalk = require('chalk');

async function startNode3() {
    console.log(chalk.cyan('🔗 Starting Node 3 - Joining Cluster'));
    
    const cluster = new Cluster(3); // Replication factor of 3
    
    try {
        // Create and start the third node
        await cluster.createNode('node-3', 3003);
        
        // Join the existing cluster through seed nodes
        await cluster.joinCluster(['localhost:3001', 'localhost:3002']);
        
        console.log(chalk.green('✅ Node 3 started and joined cluster!'));
        console.log(chalk.blue('📍 Node running on: http://localhost:3003'));
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to start node 3:'), error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down gracefully...'));
    process.exit(0);
});

startNode3();
