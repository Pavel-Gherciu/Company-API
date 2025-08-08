const express = require('express');
const matchRoutes = require('./routes/match');

class ApiServer {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
      });
    });

    this.app.use('/api', matchRoutes);
  }

  async start(port = process.env.PORT || 3000) {
    try {
      this.server = this.app.listen(port, () => {
        console.log(`API server running on port ${port}`);
        console.log(`Health: http://localhost:${port}/health`);
        console.log(`Endpoints: http://localhost:${port}/api/`);
      });
      
      return this.server;
    } catch (error) {
      console.error('Failed to start server:', error.message);
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      this.server.close();
      console.log('Server stopped');
    }
  }
}

module.exports = ApiServer;
