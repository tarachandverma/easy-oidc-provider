module.exports = {
  apps : [{
    script: 'npm',
    args: 'start',
    watch: './src',
    log: "./logs/server.log",
	max_memory_restart: '300M'
  }]
};
