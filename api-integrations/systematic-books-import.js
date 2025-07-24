#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Configuration for systematic API coverage
const CONFIG = {
  booksPerBatch: 50,
  totalIntervals: 20,
  maxConcurrent: 3,
  delayBetweenBatches: 2000,
  
  // Strategic intervals to cover the entire API database
  // Based on analysis: API has books from ~1 to ~1,000,000+
  intervals: [
    // Low ID range (early books, often classics)
    { start: 1, end: 10000, step: 500 },
    { start: 10000, end: 50000, step: 2000 },
    
    // Medium-low range (popular books)
    { start: 50000, end: 100000, step: 2500 },
    { start: 100000, end: 200000, step: 5000 },
    
    // Medium range (newer releases)
    { start: 200000, end: 400000, step: 10000 },
    { start: 400000, end: 600000, step: 10000 },
    
    // High range (recent books)
    { start: 600000, end: 800000, step: 10000 },
    { start: 800000, end: 1000000, step: 15000 },
    
    // Very high range (latest releases)
    { start: 1000000, end: 1200000, step: 20000 },
    { start: 1200000, end: 1500000, step: 25000 },
  ]
};

class SystematicBooksImporter {
  constructor() {
    this.activeProcesses = new Set();
    this.totalBatches = 0;
    this.completedBatches = 0;
    this.successfulBatches = 0;
    this.failedBatches = 0;
    this.startTime = Date.now();
    
    // Calculate total batches
    CONFIG.intervals.forEach(interval => {
      const batchCount = Math.ceil((interval.end - interval.start) / interval.step);
      this.totalBatches += batchCount;
    });
  }

  async runProperIntegration(startId, maxBooks) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting batch: ID ${startId}, ${maxBooks} books`);
      
      const scriptPath = path.join(__dirname, 'proper-books-integration.js');
      const process = spawn('node', [scriptPath, startId.toString(), maxBooks.toString()], {
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Log important messages in real-time
        if (text.includes('✅') || text.includes('❌') || text.includes('Import completed')) {
          console.log(`[${startId}] ${text.trim()}`);
        }
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`[${startId}] ERROR: ${data.toString().trim()}`);
      });

      process.on('close', (code) => {
        this.activeProcesses.delete(process);
        this.completedBatches++;
        
        if (code === 0) {
          this.successfulBatches++;
          console.log(`✅ Batch completed successfully: ID ${startId} (${this.completedBatches}/${this.totalBatches})`);
          
          // Extract success metrics from output
          const successMatch = output.match(/Total books inserted: (\d+)/);
          const insertedCount = successMatch ? parseInt(successMatch[1]) : 0;
          
          resolve({
            success: true,
            startId,
            insertedBooks: insertedCount,
            output
          });
        } else {
          this.failedBatches++;
          console.error(`❌ Batch failed: ID ${startId} (exit code: ${code})`);
          console.error(`Error output: ${errorOutput}`);
          
          resolve({
            success: false,
            startId,
            insertedBooks: 0,
            error: errorOutput,
            exitCode: code
          });
        }
      });

      this.activeProcesses.add(process);
    });
  }

  async waitForSlot() {
    while (this.activeProcesses.size >= CONFIG.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  async runSystematicImport() {
    console.log('=== 🌟 SYSTEMATIC BOOKS IMPORT - FULL API COVERAGE 🌟 ===\n');
    console.log(`📊 Configuration:`);
    console.log(`   Books per batch: ${CONFIG.booksPerBatch}`);
    console.log(`   Max concurrent processes: ${CONFIG.maxConcurrent}`);
    console.log(`   Total intervals: ${CONFIG.intervals.length}`);
    console.log(`   Estimated total batches: ${this.totalBatches}`);
    console.log(`   Delay between batches: ${CONFIG.delayBetweenBatches}ms\n`);

    const results = [];
    let batchNumber = 0;

    try {
      for (const interval of CONFIG.intervals) {
        console.log(`\n🎯 Processing interval: ${interval.start} → ${interval.end} (step: ${interval.step})`);
        
        for (let startId = interval.start; startId < interval.end; startId += interval.step) {
          batchNumber++;
          
          // Wait for available slot
          await this.waitForSlot();
          
          console.log(`\n--- Batch ${batchNumber}/${this.totalBatches} ---`);
          console.log(`Progress: ${(this.completedBatches / this.totalBatches * 100).toFixed(1)}%`);
          console.log(`Active processes: ${this.activeProcesses.size}/${CONFIG.maxConcurrent}`);
          
          // Start the batch (non-blocking)
          const resultPromise = this.runProperIntegration(startId, CONFIG.booksPerBatch);
          results.push(resultPromise);
          
          // Small delay between starting batches
          if (this.activeProcesses.size < CONFIG.maxConcurrent) {
            await this.delay(CONFIG.delayBetweenBatches);
          }
        }
      }

      // Wait for all processes to complete
      console.log(`\n⏳ Waiting for all ${results.length} batches to complete...`);
      const allResults = await Promise.all(results);

      // Final statistics
      const totalInserted = allResults.reduce((sum, result) => sum + result.insertedBooks, 0);
      const duration = Date.now() - this.startTime;

      console.log(`\n🎉 SYSTEMATIC IMPORT COMPLETED! 🎉`);
      console.log(`📊 FINAL STATISTICS:`);
      console.log(`   Total batches: ${this.completedBatches}`);
      console.log(`   Successful batches: ${this.successfulBatches}`);
      console.log(`   Failed batches: ${this.failedBatches}`);
      console.log(`   Success rate: ${(this.successfulBatches / this.completedBatches * 100).toFixed(1)}%`);
      console.log(`   Total books imported: ${totalInserted}`);
      console.log(`   Total duration: ${this.formatDuration(duration)}`);
      console.log(`   Average books per minute: ${(totalInserted / (duration / 60000)).toFixed(1)}`);

      // Show interval breakdown
      console.log(`\n📈 INTERVAL BREAKDOWN:`);
      let currentInterval = 0;
      let batchesInInterval = 0;
      let booksInInterval = 0;
      
      allResults.forEach((result, index) => {
        // Calculate which interval this batch belongs to
        while (currentInterval < CONFIG.intervals.length - 1 && 
               result.startId >= CONFIG.intervals[currentInterval].end) {
          if (batchesInInterval > 0) {
            console.log(`   Interval ${CONFIG.intervals[currentInterval].start}-${CONFIG.intervals[currentInterval].end}: ${batchesInInterval} batches, ${booksInInterval} books`);
          }
          currentInterval++;
          batchesInInterval = 0;
          booksInInterval = 0;
        }
        
        batchesInInterval++;
        booksInInterval += result.insertedBooks;
      });
      
      // Print final interval
      if (batchesInInterval > 0) {
        console.log(`   Interval ${CONFIG.intervals[currentInterval].start}-${CONFIG.intervals[currentInterval].end}: ${batchesInInterval} batches, ${booksInInterval} books`);
      }

      return {
        totalBatches: this.completedBatches,
        successfulBatches: this.successfulBatches,
        failedBatches: this.failedBatches,
        totalInserted,
        duration,
        results: allResults
      };

    } catch (error) {
      console.error('❌ Fatal error during systematic import:', error.message);
      throw error;
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Received SIGINT. Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Received SIGTERM. Gracefully shutting down...');
  process.exit(0);
});

// Main execution
async function main() {
  const importer = new SystematicBooksImporter();
  
  try {
    await importer.runSystematicImport();
    process.exit(0);
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SystematicBooksImporter;