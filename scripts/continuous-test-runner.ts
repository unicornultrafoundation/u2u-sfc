#!/usr/bin/env tsx

import { spawn, ChildProcess } from 'child_process';
import { createWriteStream, WriteStream } from 'fs';
import path from 'path';

/**
 * Continuous Test Runner for U2U SFC Project
 * 
 * Runs `bunx hardhat test --network ubuntu` continuously, restarting on any failure.
 * Features:
 * - Automatic restart on process exit/crash
 * - Comprehensive logging with timestamps
 * - Graceful shutdown handling
 * - Process monitoring and statistics
 * - Log rotation to prevent disk space issues
 */
class ContinuousTestRunner {
  private process: ChildProcess | null = null;
  private logStream: WriteStream | null = null;
  private runCount = 0;
  private startTime = new Date();
  private isShuttingDown = false;
  private restartDelay = 100000; // 100 seconds between restarts
  private testDelay = 10000; // 10 seconds between test runs
  private maxLogSize = 100 * 1024 * 1024; // 100MB max log file size

  private readonly command = 'bunx';
  private readonly args = ['hardhat', 'test', '--network', 'ubuntu'];
  private readonly logDir = path.join(process.cwd(), 'logs');
  private readonly logFile = path.join(this.logDir, `test-runner-${Date.now()}.log`);

  constructor() {
    this.setupLogging();
    this.setupSignalHandlers();
    this.start();
  }

  private setupLogging(): void {
    try {
      // Ensure logs directory exists
      const fs = require('fs');
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create log stream
      this.logStream = createWriteStream(this.logFile, { flags: 'a' });
      
      this.log('🚀 Continuous Test Runner Started');
      this.log(`📁 Log file: ${this.logFile}`);
      this.log(`⚙️  Command: ${this.command} ${this.args.join(' ')}`);
    } catch (error) {
      console.error('❌ Failed to setup logging:', error);
      process.exit(1);
    }
  }

  private setupSignalHandlers(): void {
    // Handle graceful shutdown
    const shutdown = (signal: string) => {
      this.log(`🛑 Received ${signal}, shutting down gracefully...`);
      this.isShuttingDown = true;
      
      if (this.process) {
        this.log('⏹️  Killing test process...');
        this.process.kill('SIGTERM');
        
        // Force kill after 10 seconds if still running
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.log('💀 Force killing test process...');
            this.process.kill('SIGKILL');
          }
        }, 10000);
      }

      // Close log stream and exit
      setTimeout(() => {
        this.cleanup();
        process.exit(0);
      }, 2000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.log(`💥 Uncaught exception: ${error.message}`);
      this.log(`📋 Stack trace: ${error.stack}`);
      // Don't exit, just log and continue
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.log(`💥 Unhandled rejection at ${promise}: ${reason}`);
      // Don't exit, just log and continue
    });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // Write to console
    console.log(`[${timestamp}] ${message}`);
    
    // Write to log file if available
    if (this.logStream && this.logStream.writable) {
      this.logStream.write(logMessage);
      
      // Check log file size and rotate if needed
      this.checkLogRotation();
    }
  }

  private checkLogRotation(): void {
    try {
      const fs = require('fs');
      const stats = fs.statSync(this.logFile);
      
      if (stats.size > this.maxLogSize) {
        this.log('📋 Rotating log file...');
        this.logStream?.end();
        
        // Archive current log
        const archiveFile = this.logFile.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(this.logFile, archiveFile);
        
        // Create new log stream
        this.logStream = createWriteStream(this.logFile, { flags: 'a' });
        this.log('📋 Log rotation completed');
      }
    } catch (error) {
      // Ignore rotation errors, keep running
      // console.warn('⚠️  Log rotation failed:', error);
    }
  }

  private async start(): Promise<void> {
    // Run the update-target-gas-power script first
    await this.runUpdateTargetGasPowerScript();

    await delay(5000);

    if (this.isShuttingDown) return;

    this.runCount++;
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    
    this.log(`\n🏃 Starting test run #${this.runCount} (uptime: ${uptime}s)`);
    this.log(`📋 Working directory: ${process.cwd()}`);

    try {
      // Spawn the test process
      this.process = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          // Ensure bun/bunx is available
          PATH: process.env.PATH,
          NODE_ENV: process.env.NODE_ENV || 'test'
        },
        shell: process.platform === 'win32' // Use shell on Windows
      });

      // Handle process startup
      this.process.on('spawn', () => {
        this.log(`✅ Test process spawned (PID: ${this.process?.pid})`);
      });

      // Handle stdout
      this.process.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          // Split output into lines and log each one
          output.split('\n').forEach((line: string) => {
            if (line.trim()) {
              this.log(`📤 ${line.trim()}`);
            }
          });
        }
      });

      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        const error = data.toString().trim();
        if (error) {
          error.split('\n').forEach((line: string) => {
            if (line.trim()) {
              this.log(`❌ ${line.trim()}`);
            }
          });
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.log(`🏁 Test process exited (code: ${code}, signal: ${signal})`);
        
        if (!this.isShuttingDown) {
          this.log(`⏰ Waiting ${this.testDelay}ms before next test run...`);
          setTimeout(() => this.start(), this.testDelay);
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.log(`💥 Process error: ${error.message}`);
        
        // Common error handling
        if (error.message.includes('ENOENT')) {
          this.log('❌ Command not found. Make sure bunx is installed and available in PATH');
          this.log('💡 Try: npm install -g bun or curl -fsSL https://bun.sh/install | bash');
        }
        
        if (!this.isShuttingDown) {
          this.log(`⏰ Restarting in ${this.testDelay}ms...`);
          setTimeout(() => this.start(), this.testDelay);
        }
      });

      // Prevent process from hanging
      this.process.unref();

    } catch (error: any) {
      this.log(`💥 Failed to start process: ${error.message}`);
      
      if (!this.isShuttingDown) {
        this.log(`⏰ Retrying in ${this.testDelay}ms...`);
        setTimeout(() => this.start(), this.testDelay);
      }
    }
  }

  private async runUpdateTargetGasPowerScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('🎢 Running update-target-gas-power script...');
      
      const updateProcess = spawn('bunx', ['hardhat', 'run', 'scripts/update-target-gas-power.ts', '--network', 'ubuntu'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          // Pass through environment variables for configuration
          CONSTANTS_MANAGER_ADDRESS: process.env.CONSTANTS_MANAGER_ADDRESS,
          TARGET_GAS_POWER: process.env.TARGET_GAS_POWER
        }
      });

      let stdout = '';
      let stderr = '';

      // Capture output
      updateProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log each line from the update script
        output.split('\n').forEach((line: string) => {
          if (line.trim()) {
            this.log(`📤 ${line.trim()}`);
          }
        });
      });

      updateProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        error.split('\n').forEach((line: string) => {
          if (line.trim()) {
            this.log(`❌ ${line.trim()}`);
          }
        });
      });

      updateProcess.on('exit', (code, signal) => {
        if (code === 0) {
          this.log('✅ Update target gas power script completed successfully');
          resolve();
        } else {
          this.log(`❌ Update target gas power script failed (code: ${code}, signal: ${signal})`);
          this.log('☠️  Terminating continuous test runner due to update failure');
          this.cleanup();
          reject(new Error(`Update script failed with code ${code}`));
        }
      });

      updateProcess.on('error', (error) => {
        this.log(`💥 Failed to run update script: ${error.message}`);
        if (error.message.includes('ENOENT')) {
          this.log('💡 Make sure bun is installed: curl -fsSL https://bun.sh/install | bash');
        }
        this.cleanup();
        reject(error);
      });

      // Set a timeout for the update script (2 minutes)
      setTimeout(() => {
        if (!updateProcess.killed) {
          this.log('⏰ Update script timed out, killing process...');
          updateProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!updateProcess.killed) {
              updateProcess.kill('SIGKILL');
            }
          }, 5000);
          this.cleanup();
          reject(new Error('Update script timed out'));
        }
      }, 120000); // 2 minutes timeout
    });
  }

  private cleanup(): void {
    this.log('🧹 Cleaning up resources...');
    
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }

    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total runs: ${this.runCount}`);
    console.log(`   Total uptime: ${uptime} seconds`);
    console.log(`   Log file: ${this.logFile}`);
    console.log(`\n👋 Continuous Test Runner stopped gracefully`);
  }

  // Public method to get current statistics
  public getStats() {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    return {
      runCount: this.runCount,
      uptime,
      isRunning: this.process !== null && !this.process.killed,
      pid: this.process?.pid,
      logFile: this.logFile
    };
  }
}

// Start the continuous test runner
if (require.main === module) {
  console.log('🎯 U2U SFC Continuous Test Runner');
  console.log('📋 This will run tests continuously on the ubuntu network');
  console.log('🛑 Press Ctrl+C to stop gracefully\n');

  const runner = new ContinuousTestRunner();

  // Optional: Print stats every 5 minutes
  setInterval(() => {
    const stats = runner.getStats();
    console.log(`\n📊 Stats: ${stats.runCount} runs, ${stats.uptime}s uptime, PID: ${stats.pid || 'N/A'}`);
  }, 5 * 60 * 1000);
}

export default ContinuousTestRunner;

const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
