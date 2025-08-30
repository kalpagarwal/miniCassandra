#!/usr/bin/env node

const Cluster = require('./src/Cluster');
const chalk = require('chalk');

async function startNode2() {
    console.log(chalk.cyan('🔗 Starting Node 2 - Joining Cluster'));
    
    const cluster = new Cluster(3); // Replication factor of 3
    
    try {
        // Create and start the second node
        await cluster.createNode('node-2', 3002);
        
        // Join the existing cluster
        await cluster.joinCluster(['localhost:3001']);
        
        console.log(chalk.green('✅ Node 2 started and joined cluster!'));
        console.log(chalk.blue('📍 Node running on: http://localhost:3002'));
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to start node 2:'), error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down gracefully...'));
    process.exit(0);
});

startNode2();
