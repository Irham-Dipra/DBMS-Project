// utils/scheduler.js
const pool = require('../db');

class UserReactivationScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60 * 60 * 1000; // Check every hour (60 minutes * 60 seconds * 1000 ms)
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('User reactivation scheduler is already running');
      return;
    }

    console.log('Starting user reactivation scheduler...');
    this.isRunning = true;
    
    // Run immediately on start
    this.checkAndReactivateUsers();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndReactivateUsers();
    }, this.checkInterval);

    console.log(`User reactivation scheduler started. Checking every ${this.checkInterval / 1000 / 60} minutes.`);
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('User reactivation scheduler is not running');
      return;
    }

    console.log('Stopping user reactivation scheduler...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('User reactivation scheduler stopped.');
  }

  // Check for users that need to be reactivated and reactivate them
  async checkAndReactivateUsers() {
    try {
      console.log('Checking for users to auto-reactivate...');
      
      const startTime = Date.now();
      const result = await pool.query('SELECT auto_reactivate_users()');
      const endTime = Date.now();
      
      const reactivatedCount = result.rows[0]?.auto_reactivate_users || 0;
      
      if (reactivatedCount > 0) {
        console.log(`✅ Successfully auto-reactivated ${reactivatedCount} users (took ${endTime - startTime}ms)`);
      } else {
        console.log(`ℹ️  No users needed reactivation (check took ${endTime - startTime}ms)`);
      }

      // Optional: Clean up old history records (older than 1 year)
      await this.cleanupOldHistory();

    } catch (error) {
      console.error('❌ Error during auto-reactivation check:', error);
      
      // If there's a database connection error, try to reconnect
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
        console.log('Database connection issue detected. Will retry on next cycle.');
      }
    }
  }

  // Clean up old deactivation history records
  async cleanupOldHistory() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const result = await pool.query(`
        DELETE FROM user_deactivation_history 
        WHERE created_at < $1
      `, [oneYearAgo]);
      
      if (result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} old deactivation history records`);
      }
    } catch (error) {
      console.error('Error cleaning up old history:', error);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      checkIntervalMinutes: this.checkInterval / 1000 / 60,
      nextCheck: this.isRunning ? new Date(Date.now() + this.checkInterval) : null
    };
  }

  // Set a custom check interval (in minutes)
  setCheckInterval(minutes) {
    if (minutes < 1 || minutes > 1440) { // 1 minute to 24 hours
      throw new Error('Check interval must be between 1 and 1440 minutes');
    }
    
    this.checkInterval = minutes * 60 * 1000;
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop();
      this.start();
    }
    
    console.log(`Check interval updated to ${minutes} minutes`);
  }

  // Manual trigger for reactivation check (useful for testing)
  async manualCheck() {
    console.log('Manual reactivation check triggered...');
    await this.checkAndReactivateUsers();
  }
}

// Create a singleton instance
const reactivationScheduler = new UserReactivationScheduler();

module.exports = reactivationScheduler;