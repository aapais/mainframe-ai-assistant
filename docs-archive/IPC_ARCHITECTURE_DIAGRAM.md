# IPC Architecture Visual Diagrams
## Comprehensive ASCII Architecture Diagrams

---

## 1. COMPLETE IPC SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                RENDERER PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                          REACT APPLICATION LAYER                           ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐││
│  │  │  Knowledge    │ │   Pattern     │ │   System      │ │   Development   │││
│  │  │  Components   │ │  Components   │ │  Components   │ │   Components    │││
│  │  │  - SearchBar  │ │  - AlertList  │ │  - Dashboard  │ │  - DevTools     │││
│  │  │  - EntryForm  │ │  - PatternViz │ │  - Metrics    │ │  - LogViewer    │││
│  │  │  - ResultList │ │  - RootCause  │ │  - HealthCheck│ │  - CacheViewer  │││
│  │  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
│                            │                                                    │
│  ┌─────────────────────────┴───────────────────────────────────────────────────┐│
│  │                        TYPE-SAFE API CLIENT LAYER                          ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐││
│  │  │  KB API       │ │  Pattern API  │ │  System API   │ │   Cache API     │││
│  │  │  - search()   │ │  - detect()   │ │  - metrics()  │ │  - clear()      │││
│  │  │  - create()   │ │  - analyze()  │ │  - health()   │ │  - stats()      │││
│  │  │  - update()   │ │  - import()   │ │  - status()   │ │  - invalidate() │││
│  │  │  - delete()   │ │  - alerts()   │ │  - report()   │ │  - optimize()   │││
│  │  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
│                            │                                                    │
│  ┌─────────────────────────┴───────────────────────────────────────────────────┐│
│  │                       ERROR BOUNDARY & RETRY LOGIC                         ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   Retry Logic   │ │   Circuit      │ │   Fallback      │ │   Error     │││
│  │  │   - Exponential │ │   Breaker      │ │   Strategies    │ │   Reporting │││
│  │  │   - Backoff     │ │   - Open/Close │ │   - Local Cache │ │   - User    │││
│  │  │   - Max Retries │ │   - Half-Open  │ │   - Offline     │ │   - Telemetr│││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
└──────────────────────────────┼──────────────────────────────────────────────────┘
                               │
          ╔════════════════════╧════════════════════╗
          ║           CONTEXT BRIDGE IPC           ║
          ║        (SECURE COMMUNICATION)          ║
          ╚════════════════════╤════════════════════╝
                               │
┌──────────────────────────────┼──────────────────────────────────────────────────┐
│                              ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                             PRELOAD SCRIPT                                 ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   Input         │ │   Type Guards   │ │   Security      │ │   Response  │││
│  │  │   Validation    │ │   & Runtime     │ │   Sanitization  │ │   Transform │││
│  │  │   - Schema      │ │   Type Check    │ │   - XSS Filter  │ │   - Serializ│││
│  │  │   - Zod Checks  │ │   - Channel     │ │   - SQL Inject  │ │   - Compress│││
│  │  │   - Size Limits │ │   - Whitelist   │ │   - Path Traver │ │   - Encrypt │││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────────────┤
│                                MAIN PROCESS                                      │
│                              ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                            IPC MANAGER CORE                                ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   Channel       │ │   Request       │ │   Security      │ │   Response  │││
│  │  │   Registry      │ │   Router        │ │   Manager       │ │   Builder   │││
│  │  │   - Whitelist   │ │   - Handler Map │ │   - Rate Limit  │ │   - Success │││
│  │  │   - Validation  │ │   - Middleware  │ │   - Auth Check  │ │   - Error   │││
│  │  │   - Metrics     │ │   - Async Queue │ │   - Input Scan  │ │   - Metadata│││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
│                            │                                                    │
│  ┌─────────────────────────┴───────────────────────────────────────────────────┐│
│  │                        PERFORMANCE OPTIMIZATION LAYER                      ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   Adaptive      │ │   Smart Cache   │ │   Request       │ │   Resource  │││
│  │  │   Batching      │ │   Manager       │ │   Streaming     │ │   Monitor   │││
│  │  │   - Size Tune   │ │   - Multi-Layer │ │   - Large Data  │ │   - CPU/RAM │││
│  │  │   - Delay Opt   │ │   - TTL Adapt   │ │   - Chunking    │ │   - Throttle│││
│  │  │   - Priority Q  │ │   - LRU Evict   │ │   - Backpresure │ │   - Alerts  │││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
│                            │                                                    │
│  ┌─────────────────────────┴───────────────────────────────────────────────────┐│
│  │                         ERROR HANDLING & RECOVERY                          ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   Error         │ │   Circuit       │ │   Fallback      │ │   Metrics   │││
│  │  │   Classifier    │ │   Breakers      │ │   Handlers      │ │   Collector │││
│  │  │   - Type Detect │ │   - Per Channel │ │   - Local Cache │ │   - MTTR    │││
│  │  │   - Severity    │ │   - Auto Reset  │ │   - Offline     │ │   - Error % │││
│  │  │   - Recovery    │ │   - Health Mon  │ │   - Degraded    │ │   - Trends  │││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
│                            │                                                    │
│  ┌─────────────────────────┴───────────────────────────────────────────────────┐│
│  │                            SERVICE LAYER                                   ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   Knowledge     │ │   Pattern       │ │   System        │ │   Import    │││
│  │  │   Service       │ │   Detection     │ │   Service       │ │   Export    │││
│  │  │   - Search      │ │   - Clustering  │ │   - Health      │ │   - IDZ     │││
│  │  │   - CRUD Ops    │ │   - Root Cause  │ │   - Metrics     │ │   - JSON    │││
│  │  │   - AI Enhance  │ │   - Alerts      │ │   - Backup      │ │   - CSV     │││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────┬───────────────────────────────────────────────────┘│
│                            │                                                    │
│  ┌─────────────────────────┴───────────────────────────────────────────────────┐│
│  │                           DATA LAYER                                       ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐││
│  │  │   SQLite        │ │   Cache         │ │   File System   │ │   External  │││
│  │  │   Database      │ │   Storage       │ │   Storage       │ │   APIs      │││
│  │  │   - WAL Mode    │ │   - Memory      │ │   - Temp Files  │ │   - Gemini  │││
│  │  │   - FTS Index   │ │   - Persistent  │ │   - Backups     │ │   - Future  │││
│  │  │   - Connection  │ │   - Compression │ │   - Exports     │ │   - Services│││
│  │  │     Pool        │ │   - Eviction    │ │   - Logs        │ │             │││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. REQUEST FLOW ARCHITECTURE

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  RENDERER   │    │   PRELOAD    │    │    MAIN     │    │   SERVICES  │
│   PROCESS   │    │   SCRIPT     │    │   PROCESS   │    │   LAYER     │
└─────┬───────┘    └──────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                   │                  │                  │
      │ 1. API Call       │                  │                  │
      │ electronAPI       │                  │                  │
      │ .searchWithAI()   │                  │                  │
      ├──────────────────►│                  │                  │
      │                   │ 2. Validate      │                  │
      │                   │ & Sanitize       │                  │
      │                   │ Input            │                  │
      │                   ├─────────────────►│                  │
      │                   │                  │ 3. Security      │
      │                   │                  │ Check &          │
      │                   │                  │ Rate Limit       │
      │                   │                  │                  │
      │                   │                  │ 4. Performance   │
      │                   │                  │ Optimization     │
      │                   │                  │ Decision         │
      │                   │                  │ ┌─────────────┐  │
      │                   │                  │ │  Cache Hit? │  │
      │                   │                  │ │     NO      │  │
      │                   │                  │ └─────────────┘  │
      │                   │                  │ ┌─────────────┐  │
      │                   │                  │ │ Batchable?  │  │
      │                   │                  │ │     NO      │  │
      │                   │                  │ └─────────────┘  │
      │                   │                  │ ┌─────────────┐  │
      │                   │                  │ │ Streamable? │  │
      │                   │                  │ │     NO      │  │
      │                   │                  │ └─────────────┘  │
      │                   │                  │                  │
      │                   │                  │ 5. Route to      │
      │                   │                  │ Handler          │
      │                   │                  ├─────────────────►│
      │                   │                  │                  │ 6. Execute
      │                   │                  │                  │ Business
      │                   │                  │                  │ Logic
      │                   │                  │                  │
      │                   │                  │ 7. Response      │
      │                   │                  │ Processing       │
      │                   │                  │◄─────────────────┤
      │                   │                  │                  │
      │                   │                  │ 8. Cache Result  │
      │                   │                  │ (if applicable)  │
      │                   │                  │                  │
      │                   │ 9. Format        │                  │
      │                   │ Response         │                  │
      │                   │◄─────────────────┤                  │
      │                   │                  │                  │
      │ 10. Return        │                  │                  │
      │ Result            │                  │                  │
      │◄──────────────────┤                  │                  │
      │                   │                  │                  │
```

---

## 3. ERROR HANDLING FLOW

```
┌─────────────┐
│   ERROR     │
│  OCCURS     │
└─────┬───────┘
      │
      ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   ERROR     │───►│   CLASSIFY   │───►│   DETERMINE │
│  DETECTION  │    │    ERROR     │    │  SEVERITY   │
└─────────────┘    │  - Type      │    │  - Critical │
                   │  - Code      │    │  - Error    │
                   │  - Context   │    │  - Warning  │
                   └──────────────┘    │  - Info     │
                          │           └─────┬───────┘
                          ▼                 │
                   ┌──────────────┐         ▼
                   │   RETRYABLE  │    ┌─────────────┐
                   │   ANALYSIS   │    │    LOG      │
                   │  - Network   │    │   ERROR     │
                   │  - Timeout   │    │  - Level    │
                   │  - DB Lock   │    │  - Context  │
                   │  - Resource  │    │  - Stack    │
                   └──────┬───────┘    └─────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   RECOVERY   │
                   │   STRATEGY   │
                   └──────┬───────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
         ┌──────────────┐    ┌──────────────┐
         │    RETRY     │    │   FALLBACK   │
         │   LOGIC      │    │   HANDLER    │
         │  - Backoff   │    │  - Cache     │
         │  - Circuit   │    │  - Offline   │
         │  - Breaker   │    │  - Degraded  │
         └──────┬───────┘    └──────┬───────┘
                │                   │
                ▼                   ▼
         ┌──────────────┐    ┌──────────────┐
         │   SUCCESS?   │    │   SUCCESS?   │
         │     YES      │    │     NO       │
         └──────┬───────┘    └──────┬───────┘
                │                   │
                ▼                   ▼
         ┌──────────────┐    ┌──────────────┐
         │   RETURN     │    │   RETURN     │
         │   RESULT     │    │    ERROR     │
         └──────────────┘    └──────────────┘
```

---

## 4. PERFORMANCE OPTIMIZATION ARCHITECTURE

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              PERFORMANCE MONITOR                       │
                    │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │
                    │  │   Channel   │ │   System    │ │    Predictive   │  │
                    │  │  Metrics    │ │  Resources  │ │   Analytics     │  │
                    │  │ - Response  │ │ - CPU/RAM   │ │ - Trend Detect  │  │
                    │  │ - Throughput│ │ - Queue     │ │ - Anomaly       │  │
                    │  │ - Errors    │ │ - Latency   │ │ - Forecasting   │  │
                    │  └─────────────┘ └─────────────┘ └─────────────────┘  │
                    └─────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │              OPTIMIZATION DECISION ENGINE               │
                    │                                                         │
                    │  Request → │ Performance │ → │ Strategy │ → │ Execute │  │
                    │  Analysis    │ Thresholds │   │Selection │   │ Action  │  │
                    │             │ Exceeded?  │   │         │   │        │  │
                    └─────────────────────┬───────────────────────────────────┘
                              ┌───────────┴───────────┐
                              ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │     BATCH       │     │     CACHE       │
                    │  OPTIMIZATION   │     │  OPTIMIZATION   │
                    │                 │     │                 │
                    │  ┌───────────┐  │     │  ┌───────────┐  │
                    │  │ Adaptive  │  │     │  │  Smart    │  │
                    │  │ Sizing    │  │     │  │   TTL     │  │
                    │  └───────────┘  │     │  └───────────┘  │
                    │  ┌───────────┐  │     │  ┌───────────┐  │
                    │  │ Delay     │  │     │  │ Memory    │  │
                    │  │ Tuning    │  │     │  │ Management│  │
                    │  └───────────┘  │     │  └───────────┘  │
                    │  ┌───────────┐  │     │  ┌───────────┐  │
                    │  │ Priority  │  │     │  │ Eviction  │  │
                    │  │ Queuing   │  │     │  │ Strategy  │  │
                    │  └───────────┘  │     │  └───────────┘  │
                    └─────────────────┘     └─────────────────┘
                              │                       │
                              └───────────┬───────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                FEEDBACK LOOP                           │
                    │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │
                    │  │   Measure   │ │   Learn     │ │     Adjust      │  │
                    │  │   Impact    │ │   From      │ │   Parameters    │  │
                    │  │ - Before/   │ │  Results    │ │ - Batch Size    │  │
                    │  │   After     │ │ - Success   │ │ - Cache TTL     │  │
                    │  │ - A/B Test  │ │ - Failure   │ │ - Timeouts      │  │
                    │  └─────────────┘ └─────────────┘ └─────────────────┘  │
                    └─────────────────────────────────────────────────────────┘
```

---

## 5. SECURITY LAYER ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                SECURITY PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                            INPUT LAYER                                    │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐  │  │
│  │  │   Channel       │ │   Size Check    │ │      Malicious Content      │  │  │
│  │  │  Whitelist      │ │  - Max Size     │ │       Detection             │  │  │
│  │  │  - Allowed      │ │  - JSON Depth   │ │  - Script Injection         │  │  │
│  │  │  - Blocked      │ │  - Array Length │ │  - SQL Injection            │  │  │
│  │  │  - Dev Only     │ │  - String Len   │ │  - Path Traversal           │  │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────────────┘  │  │
│  └───────────────────────────┬───────────────────────────────────────────────┘  │
│                              │                                                  │
│  ┌───────────────────────────▼───────────────────────────────────────────────┐  │
│  │                      VALIDATION LAYER                                     │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐  │  │
│  │  │   Schema        │ │   Type Safety   │ │      Business Logic         │  │  │
│  │  │  Validation     │ │  - Runtime      │ │       Validation            │  │  │
│  │  │  - Zod Schemas  │ │  - Type Guards  │ │  - Permission Check         │  │  │
│  │  │  - Required     │ │  - Interface    │ │  - Resource Access          │  │  │
│  │  │  - Optional     │ │  - Constraints  │ │  - Operation Rules          │  │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────────────┘  │  │
│  └───────────────────────────┬───────────────────────────────────────────────┘  │
│                              │                                                  │
│  ┌───────────────────────────▼───────────────────────────────────────────────┐  │
│  │                        RATE LIMITING                                      │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐  │  │
│  │  │   Per Channel   │ │    Per User     │ │       Per Session           │  │  │
│  │  │  - High Freq    │ │  - User Based   │ │  - Session Tracking         │  │  │
│  │  │  - Medium Freq  │ │  - Anonymous    │ │  - Sliding Window           │  │  │
│  │  │  - Low Freq     │ │  - Identified   │ │  - Burst Handling           │  │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────────────┘  │  │
│  └───────────────────────────┬───────────────────────────────────────────────┘  │
│                              │                                                  │
│  ┌───────────────────────────▼───────────────────────────────────────────────┐  │
│  │                      SANITIZATION                                         │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐  │  │
│  │  │   String        │ │    Object       │ │        Array                │  │  │
│  │  │  Sanitization   │ │   Sanitization  │ │      Sanitization           │  │  │
│  │  │  - HTML Strip   │ │  - Key Clean    │ │  - Length Limit             │  │  │
│  │  │  - Script Strip │ │  - Value Clean  │ │  - Content Validate         │  │  │
│  │  │  - Size Limit   │ │  - Depth Limit  │ │  - Type Consistency         │  │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────────────┘  │  │
│  └───────────────────────────┬───────────────────────────────────────────────┘  │
│                              │                                                  │
│                              ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         SECURITY AUDIT                                 │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐  │  │
│  │  │   Event Log     │ │   Threat        │ │      Compliance         │  │  │
│  │  │  - All Requests │ │  Detection      │ │     Reporting           │  │  │
│  │  │  - Violations   │ │  - Pattern      │ │  - Audit Trail          │  │  │
│  │  │  - Anomalies    │ │  - Frequency    │ │  - Policy Check         │  │  │
│  │  │  - Recovery     │ │  - Severity     │ │  - Evidence Chain       │  │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. CACHE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SMART CACHE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           REQUEST FLOW                                  │    │
│  └─────────────────────────────┬───────────────────────────────────────────┘    │
│                                │                                                │
│                                ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        CACHE LOOKUP                                     │    │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────────┐  │    │
│  │  │    L1 Cache     │ │    L2 Cache     │ │        L3 Cache           │  │    │
│  │  │   (Memory)      │ │  (Compressed    │ │     (Persistent)          │  │    │
│  │  │                 │ │    Memory)      │ │                           │  │    │
│  │  │  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌─────────────────────┐  │  │    │
│  │  │  │ Immediate │  │ │  │ Recent    │  │ │  │    Long-term        │  │    │
│  │  │  │ Access    │  │ │  │ Frequent  │  │ │  │    Storage          │  │    │
│  │  │  │ <100ms    │  │ │  │ <500ms    │  │ │  │    <2s              │  │    │
│  │  │  └───────────┘  │ │  └───────────┘  │ │  └─────────────────────┘  │  │    │
│  │  │  TTL: 1-5min   │ │  TTL: 10-30min  │ │  TTL: 1-24 hours         │  │    │
│  │  │  Size: 50MB    │ │  Size: 200MB    │ │  Size: 500MB             │  │    │
│  │  └─────────────────┘ └─────────────────┘ └───────────────────────────┘  │    │
│  └─────┬───────────────────────┬───────────────────────┬─────────────────────┘    │
│        │ HIT                   │ HIT                   │ HIT                      │
│        ▼                       ▼                       ▼                          │
│  ┌─────────────────┐     ┌─────────────────┐    ┌──────────────────────┐         │
│  │   Return        │     │   Decompress    │    │     Load &           │         │
│  │   Directly      │     │   & Return      │    │    Promote           │         │
│  └─────────────────┘     └─────────────────┘    └──────────────────────┘         │
│                                                                                  │
│                                 MISS                                             │
│                                  │                                               │
│                                  ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                       CACHE STRATEGY SELECTION                         │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │              ADAPTIVE TTL CALCULATION                          │    │    │
│  │  │                                                                 │    │    │
│  │  │  TTL = BASE_TTL × (HIT_RATE × FREQ_MULTIPLIER)                 │    │    │
│  │  │                                                                 │    │    │
│  │  │  Where:                                                         │    │    │
│  │  │    - BASE_TTL = Channel specific base time                      │    │    │
│  │  │    - HIT_RATE = Cache hit rate (0-1)                          │    │    │
│  │  │    - FREQ_MULTIPLIER = Access frequency factor                 │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │              COMPRESSION STRATEGY                               │    │    │
│  │  │                                                                 │    │    │
│  │  │  IF (data_size > COMPRESSION_THRESHOLD)                        │    │    │
│  │  │    THEN compress_data()                                         │    │    │
│  │  │    ELSE store_raw()                                             │    │    │
│  │  │                                                                 │    │    │
│  │  │  Threshold: 1KB for JSON, 5KB for binary                       │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                  │                                               │
│                                  ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        EVICTION MANAGEMENT                              │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                    LRU + LFU HYBRID                             │    │    │
│  │  │                                                                 │    │    │
│  │  │  Score = (HIT_COUNT × 0.6) + (RECENCY_FACTOR × 0.4)            │    │    │
│  │  │                                                                 │    │    │
│  │  │  Where:                                                         │    │    │
│  │  │    - HIT_COUNT = Number of hits                                 │    │    │
│  │  │    - RECENCY_FACTOR = 1 / (current_time - last_access)         │    │    │
│  │  │                                                                 │    │    │
│  │  │  Evict entries with lowest scores when memory threshold reached │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. BATCH PROCESSING ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ADAPTIVE BATCHING SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        REQUEST CLASSIFICATION                           │    │
│  └─────────────────────────────┬───────────────────────────────────────────┘    │
│                                │                                                │
│                                ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         BATCH QUEUES                                   │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   HIGH      │  │   MEDIUM    │  │    LOW      │  │   SEARCH    │    │    │
│  │  │ PRIORITY    │  │  PRIORITY   │  │  PRIORITY   │  │   QUEUE     │    │    │
│  │  │             │  │             │  │             │  │             │    │    │
│  │  │ Max Size:5  │  │ Max Size:15 │  │ Max Size:30 │  │ Max Size:10 │    │    │
│  │  │ Delay: 25ms │  │ Delay:100ms │  │ Delay:250ms │  │ Delay: 50ms │    │    │
│  │  │             │  │             │  │             │  │             │    │    │
│  │  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │    │    │
│  │  │ │ Request │ │  │ │ Request │ │  │ │ Request │ │  │ │ Request │ │    │    │
│  │  │ │ Request │ │  │ │ Request │ │  │ │ Request │ │  │ │ Request │ │    │    │
│  │  │ │ Request │ │  │ │ Request │ │  │ │ Request │ │  │ │ Request │ │    │    │
│  │  │ │   ...   │ │  │ │   ...   │ │  │ │   ...   │ │  │ │   ...   │ │    │    │
│  │  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────┬───────────────┬───────────────┬───────────────┬─────────────┘    │
│            │               │               │               │                  │
│            ▼               ▼               ▼               ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    BATCH EXECUTION ENGINE                              │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                  TRIGGER CONDITIONS                             │    │    │
│  │  │                                                                 │    │    │
│  │  │  1. MAX_SIZE reached                                            │    │    │
│  │  │  2. MAX_DELAY exceeded                                          │    │    │
│  │  │  3. Priority upgrade (high priority request added)              │    │    │
│  │  │  4. Resource threshold (CPU/Memory high)                        │    │    │
│  │  │  5. Manual flush                                                │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                 BATCH OPTIMIZATION                              │    │    │
│  │  │                                                                 │    │    │
│  │  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐    │    │    │
│  │  │  │Performance  │────▶│  Adjust     │────▶│   Apply New     │    │    │    │
│  │  │  │ Monitoring  │     │ Parameters  │     │  Configuration  │    │    │    │
│  │  │  │             │     │             │     │                 │    │    │    │
│  │  │  │• Throughput │     │• Batch Size │     │• Queue Settings │    │    │    │
│  │  │  │• Latency    │     │• Delay Time │     │• Priority Rules │    │    │    │
│  │  │  │• Error Rate │     │• Concurrency│     │• Trigger Logic  │    │    │    │
│  │  │  └─────────────┘     └─────────────┘     └─────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                  PARALLEL EXECUTION                             │    │    │
│  │  │                                                                 │    │    │
│  │  │    ┌───────────┐    ┌───────────┐    ┌───────────────────┐     │    │    │
│  │  │    │  Batch 1  │    │  Batch 2  │    │     Batch N       │     │    │    │
│  │  │    │           │    │           │    │                   │     │    │    │
│  │  │    │ Handler   │    │ Handler   │    │    Handler        │     │    │    │
│  │  │    │ Thread    │    │ Thread    │    │    Thread         │     │    │    │
│  │  │    │           │    │           │    │                   │     │    │    │
│  │  │    │ Result    │    │ Result    │    │    Result         │     │    │    │
│  │  │    │ Collector │    │ Collector │    │    Collector      │     │    │    │
│  │  │    └───────────┘    └───────────┘    └───────────────────┘     │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                  │                                               │
│                                  ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                       RESULT AGGREGATION                               │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                   RESPONSE MAPPING                              │    │    │
│  │  │                                                                 │    │    │
│  │  │  Individual Request ID ──────▶ Batch Result Index              │    │    │
│  │  │  Promise Resolver      ──────▶ Success/Error Handling          │    │    │
│  │  │  Metadata Collection   ──────▶ Performance Metrics             │    │    │
│  │  │  Error Isolation       ──────▶ Partial Success Handling        │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

This comprehensive IPC architecture provides a complete visual representation of all the components, flows, and optimization strategies. Each diagram shows specific aspects of the system:

1. **Complete System Architecture** - Overall component relationships
2. **Request Flow** - Step-by-step processing
3. **Error Handling Flow** - Recovery strategies
4. **Performance Optimization** - Adaptive improvements
5. **Security Pipeline** - Multi-layer protection  
6. **Cache System** - Intelligent multi-tier caching
7. **Batch Processing** - Adaptive request batching

The architecture is designed to be production-ready, scalable, and maintainable while providing excellent performance and security for the Mainframe Knowledge Base Assistant application.