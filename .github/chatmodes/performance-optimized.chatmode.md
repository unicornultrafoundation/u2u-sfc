# Ultra-High-Performance MCP Development Assistant

## Performance Optimization Research Summary

This chatmode configuration has been optimized based on comprehensive research using MCP tools:

### Research Sources (via Context7 MCP)
- **Go-Ethereum Performance**: `/ethereum/go-ethereum` - Cryptographic optimizations, memory management, assembly optimizations
- **Hardhat TypeScript**: `/nomicfoundation/hardhat` - Compilation optimization, plugin ecosystem, testing performance
- **Grafana Monitoring**: `/grafana/grafana` - Container performance, monitoring optimization, database connection pooling

### Key Performance Patterns Identified

#### 1. Blockchain Core (Go) Optimizations
```go
// Constant-time operations (from libsecp256k1)
func divsteps_n_matrix(delta, f, g int) (int, [4]int) {
    u, v, q, r := 1, 0, 0, 1 // Identity matrix
    for i := 0; i < N; i++ {
        if delta > 0 && g&1 == 1 {
            delta, f, g, u, v, q, r = 1-delta, g, (g-f)>>1, 2*q, 2*r, q-u, r-v
        } else if g&1 == 1 {
            delta, f, g, u, v, q, r = 1+delta, f, (g+f)>>1, 2*u, 2*v, q+u, r+v
        } else {
            delta, f, g, u, v, q, r = 1+delta, f, g>>1, 2*u, 2*v, q, r
        }
    }
    return delta, [4]int{u, v, q, r}
}

// Database connection optimization
func configureDatabasePool() {
    maxOpen := 100      // Maximum concurrent connections
    maxIdle := 100      // Maximum idle connections
    maxLifetime := 14400 // 4 hours connection lifetime
}
```

#### 2. Smart Contract (TypeScript) Optimizations
```typescript
// Dynamic imports for CLI performance
async function loadHardhatPlugin() {
    const { plugin } = await import("@nomicfoundation/hardhat-ethers");
    return plugin;
}

// Optimized Hardhat configuration
const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.19",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    },
                    evmVersion: "paris"
                }
            }
        ]
    },
    networks: {
        hardhat: {
            chainId: 1337,
            gas: "auto",
            gasPrice: "auto"
        }
    }
};
```

#### 3. Monitoring & Infrastructure Optimizations
```yaml
# Optimized Docker Compose for performance
version: '3.8'
services:
  grafana:
    image: grafana/grafana-enterprise
    environment:
      - GF_LOG_LEVEL=info  # Optimize log level
      - GF_DATABASE_MAX_OPEN_CONNS=100
      - GF_DATABASE_MAX_IDLE_CONNS=100
    volumes:
      - grafana_storage:/var/lib/grafana
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  prometheus:
    image: prom/prometheus:latest
    command:
      - --config.file=/etc/prometheus.yaml
      - --web.enable-remote-write-receiver
      - --enable-feature=exemplar-storage
      - --storage.tsdb.retention.time=15d  # Optimize retention
    volumes:
      - prometheus_data:/prometheus
```

### Advanced Performance Monitoring

```promql
# Key performance metrics to monitor
rate(grafana_alerting_rule_evaluations_total[5m])  # Alert evaluation rate
rate(node_disk_io_time_seconds_total[5m])         # Disk I/O performance
go_memstats_alloc_bytes / go_memstats_sys_bytes   # Memory efficiency
```

### Tool Utilization Strategy

1. **Sequential Thinking MCP**: Used for all multi-step optimizations
2. **Context7 MCP**: Research latest performance patterns before implementation
3. **Codacy MCP**: Validate code quality after every performance optimization
4. **Memory MCP**: Build knowledge graphs of optimization patterns
5. **GitHub MCP**: Document and share performance improvements
6. **DeepWiki MCP**: Analyze repository-wide optimization opportunities

### Performance Benchmarking Framework

```bash
# Go benchmarking
go test -bench=. -benchmem -cpuprofile=cpu.prof
go tool pprof -http=:8080 cpu.prof

# TypeScript/Hardhat testing with gas reporting
REPORT_GAS=true npx hardhat test

# Container performance monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

This configuration ensures maximum performance through systematic tool utilization and evidence-based optimization strategies.