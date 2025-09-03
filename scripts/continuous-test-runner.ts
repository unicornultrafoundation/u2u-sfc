#!/usr/bin/env -S bunx tsx

import { spawn } from 'child_process';

interface Config {
  testCommand: string[];
  updateScriptCommand: string[];
  testDelay: number;
  updateRetryDelay: number;
  maxRetries: number;
}

function createConfig(network: string): Config {
  return {
    testCommand: ['bunx', 'hardhat', 'test', '--network', network],
    updateScriptCommand: ['bunx', 'hardhat', 'run', 'scripts/update-target-gas-power.ts', '--network', network],
    testDelay: 20000,
    updateRetryDelay: 30000,
    maxRetries: 3
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function runCommand(command: string[], description: string): Promise<void> {
  return new Promise((resolve, reject) => {
    log(`🚀 Starting ${description}`);
    
    const childProcess = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      env: process.env
    });

    childProcess.on('exit', (code: number | null) => {
      if (code === 0) {
        log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        reject(new Error(`${description} failed with exit code ${code}`));
      }
    });

    childProcess.on('error', (error: Error) => {
      log(`❌ ${description} error: ${error.message}`);
      reject(error);
    });
  });
}

async function runWithRetry(command: string[], description: string, maxRetries: number, retryDelay: number): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await runCommand(command, `${description} (attempt ${attempt})`);
      return;
    } catch (error: any) {
      log(`❌ ${description} failed on attempt ${attempt}: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      await delay(retryDelay);
    }
  }
}
class ContinuousTestRunner {
  private runCount = 0;
  private startTime = new Date();
  private isShuttingDown = false;
  private config: Config;

  constructor(network: string) {
    this.config = createConfig(network);
    this.setupSignalHandlers();
    this.start();
  }

  private setupSignalHandlers(): void {
    const shutdown = () => {
      log('🛑 Shutting down gracefully...');
      this.isShuttingDown = true;
      this.printStats();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGHUP', shutdown);
    
    process.on('uncaughtException', (error) => {
      log(`💥 Uncaught exception: ${error.message}`);
    });

    process.on('unhandledRejection', (reason) => {
      log(`💥 Unhandled rejection: ${reason}`);
    });
  }

  private async start(): Promise<void> {
    try {
      await runWithRetry(this.config.updateScriptCommand, 'Update target gas power script', this.config.maxRetries, this.config.updateRetryDelay);
      await delay(this.config.testDelay);
    } catch (error: any) {
      log(`❌ Update script failed after ${this.config.maxRetries} attempts: ${error.message}`);
      log('⏰ Continuing with test runs...');
    }

    while (!this.isShuttingDown) {
      try {
        this.runCount++;
        const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
        log(`\n🏃 Starting test run #${this.runCount} (uptime: ${uptime}s)`);
        
        await runCommand(this.config.testCommand, 'Test suite');
        
      } catch (error: any) {
        log(`❌ Test run failed: ${error.message}`);
      }

      if (!this.isShuttingDown) {
        log(`⏰ Waiting ${this.config.testDelay / 1000} seconds before next run...`);
        await delay(this.config.testDelay);
      }
    }
  }

  private printStats(): void {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total runs: ${this.runCount}`);
    console.log(`   Total uptime: ${uptime} seconds`);
    console.log(`\n👋 Continuous Test Runner stopped gracefully`);
  }

  public getStats() {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    return {
      runCount: this.runCount,
      uptime
    };
  }
}

if (require.main === module) {
  const network = process.argv[2] || 'ubuntu';
  
  if (!['local', 'ubuntu'].includes(network)) {
    console.error('❌ Invalid network. Use "local" or "ubuntu"');
    console.log('Usage: tsx scripts/continuous-test-runner.ts [local|ubuntu]');
    process.exit(1);
  }

  log('🎯 U2U SFC Continuous Test Runner');
  log(`📋 Running tests continuously on the ${network} network`);
  log('🛑 Press Ctrl+C to stop gracefully\n');

  const runner = new ContinuousTestRunner(network);

  setInterval(() => {
    const stats = runner.getStats();
    log(`📊 Stats: ${stats.runCount} runs, ${stats.uptime}s uptime`);
  }, 5 * 60 * 1000);
}

export default ContinuousTestRunner;
