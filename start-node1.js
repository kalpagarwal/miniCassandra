#!/usr/bin/env node

const Cluster = require('./src/Cluster');
const chalk = require('chalk');

async function startSeedNode() {
    console.log(chalk.cyan('🌱 Starting Seed Node (Node 1)'));
    
    const cluster = new Cluster(3); // Replication factor of 3
    
    try {
        // Create and start the first node
        await cluster.createNode('node-1', 3001);
        
        console.log(chalk.green('✅ Seed node started successfully!'));
        console.log(chalk.blue('📍 Node running on: http://localhost:3001'));
        console.log(chalk.yellow('💡 Try these endpoints:'));
        console.log('   - PUT /data/:key - Store data');
        console.log('   - GET /data/:key - Retrieve data');
        console.log('   - GET /cluster/status - Cluster status');
        console.log('   - GET /cluster/ring - Ring topology');
        console.log('   - GET /health - Node health');
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to start seed node:'), error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down gracefully...'));
    process.exit(0);
});

startSeedNode();
