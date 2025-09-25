# SSO Architecture Overview

## 🏗️ System Architecture

The Mainframe AI Assistant SSO system follows a microservices architecture with emphasis on security, scalability, and maintainability.

## 📐 High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Application]
        B[Mobile App]
        C[Desktop App]
    end

    subgraph "CDN/WAF Layer"
        D[CloudFlare/AWS WAF]
        E[Content Delivery Network]
    end

    subgraph "API Gateway Layer"
        F[API Gateway]
        G[Load Balancer]
        H[Rate Limiter]
    end

    subgraph "Authentication Services"
        I[SSO Service]
        J[Token Service]
        K[Session Manager]
        L[MFA Service]
    end

    subgraph "Identity Providers"
        M[Google OAuth]
        N[Microsoft Entra]
        O[SAML Provider]
        P[LDAP/AD]
    end

    subgraph "Data Layer"
        Q[User Database]
        R[Session Store]
        S[Token Cache]
        T[Audit Logs]
    end

    subgraph "Security Layer"
        U[Encryption Service]
        V[Key Management]
        W[Security Monitor]
        X[Fraud Detection]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I

    I --> J
    I --> K
    I --> L
    I --> M
    I --> N
    I --> O
    I --> P

    J --> S
    K --> R
    I --> Q
    I --> T

    I --> U
    J --> V
    K --> W
    I --> X

    style I fill:#e1f5fe
    style J fill:#e8f5e8
    style K fill:#fff3e0
    style L fill:#fce4ec
```

## 🔧 Component Architecture

### Authentication Service Core

```mermaid
graph LR
    subgraph "SSO Service"
        A[Request Handler]
        B[Provider Manager]
        C[Token Generator]
        D[Session Manager]
        E[Security Validator]
    end

    subgraph "Provider Adapters"
        F[Google Adapter]
        G[Microsoft Adapter]
        H[SAML Adapter]
        I[LDAP Adapter]
    end

    subgraph "Security Components"
        J[PKCE Handler]
        K[State Validator]
        L[Token Validator]
        M[Rate Limiter]
    end

    A --> B
    B --> F
    B --> G
    B --> H
    B --> I

    A --> C
    A --> D
    A --> E

    E --> J
    E --> K
    E --> L
    E --> M

    style A fill:#bbdefb
    style B fill:#c8e6c9
    style E fill:#ffcdd2
```

## 🌊 Authentication Flow Diagrams

### OAuth 2.0 with PKCE Flow

```mermaid
sequenceDiagram
    participant U as User/Browser
    participant A as Application
    participant S as SSO Service
    participant P as OAuth Provider
    participant D as Database

    Note over U,D: Secure OAuth 2.0 Flow with PKCE

    U->>A: 1. Access Protected Resource
    A->>A: 2. Generate PKCE Challenge
    A->>S: 3. Initiate Auth (code_challenge, state)
    S->>S: 4. Store Challenge & State
    S->>U: 5. Redirect to Provider
    U->>P: 6. Authenticate with Provider
    P->>P: 7. User Consent
    P->>S: 8. Callback (code, state)
    S->>S: 9. Validate State
    S->>P: 10. Exchange Code for Tokens (code_verifier)
    P->>S: 11. Return ID Token & Access Token
    S->>S: 12. Validate Tokens
    S->>D: 13. Store/Update User
    S->>S: 14. Generate Application Tokens
    S->>A: 15. Return Tokens + User Info
    A->>U: 16. Access Granted

    Note over S,P: PKCE prevents authorization code interception
    Note over S,D: Secure token storage with encryption
```

### SAML 2.0 SSO Flow

```mermaid
sequenceDiagram
    participant U as User/Browser
    participant A as Application (SP)
    participant S as SSO Service
    participant I as SAML Identity Provider

    Note over U,I: SAML 2.0 Single Sign-On Flow

    U->>A: 1. Access Protected Resource
    A->>S: 2. Initiate SAML Auth
    S->>S: 3. Generate SAML Request
    S->>U: 4. Redirect to IdP (SAMLRequest)
    U->>I: 5. Authenticate at IdP
    I->>I: 6. Generate SAML Response
    I->>S: 7. POST SAML Response
    S->>S: 8. Validate SAML Response
    S->>S: 9. Extract User Attributes
    S->>S: 10. Generate Session
    S->>A: 11. Return User Info
    A->>U: 12. Access Granted

    Note over S,I: SAML Response includes digital signature
    Note over S: Attribute mapping and role assignment
```

### Session Management Flow

```mermaid
stateDiagram-v2
    [*] --> Anonymous

    Anonymous --> Authenticating: Login Request
    Authenticating --> Authenticated: Success
    Authenticating --> Failed: Error
    Failed --> Anonymous: Retry/Timeout

    Authenticated --> Active: Activity
    Authenticated --> Idle: Inactivity
    Idle --> Active: User Activity
    Idle --> Expired: Timeout

    Active --> Expired: Max Session Time
    Active --> Renewed: Refresh Token

    Renewed --> Active: Success
    Renewed --> Expired: Refresh Failed

    Expired --> Anonymous: Session Cleanup
    Failed --> Anonymous: Error Handling

    note right of Authenticated
        Secure session with:
        - JWT tokens
        - Session fingerprinting
        - IP validation
    end note

    note right of Expired
        Automatic cleanup:
        - Token invalidation
        - Session removal
        - Audit logging
    end note
```

## 🔐 Security Architecture

### Defense in Depth Model

```mermaid
graph TB
    subgraph "Layer 7: Application Security"
        A1[Input Validation]
        A2[Authentication Logic]
        A3[Authorization Checks]
        A4[Secure Coding Practices]
    end

    subgraph "Layer 6: Data Security"
        B1[Encryption at Rest]
        B2[Encryption in Transit]
        B3[Key Management]
        B4[Data Classification]
    end

    subgraph "Layer 5: Network Security"
        C1[TLS/HTTPS]
        C2[VPN Access]
        C3[Network Segmentation]
        C4[DDoS Protection]
    end

    subgraph "Layer 4: Host Security"
        D1[OS Hardening]
        D2[Antivirus/EDR]
        D3[Patch Management]
        D4[Container Security]
    end

    subgraph "Layer 3: Perimeter Security"
        E1[Web Application Firewall]
        E2[API Gateway]
        E3[Rate Limiting]
        E4[IP Whitelisting]
    end

    subgraph "Layer 2: Internal Network"
        F1[Network Access Control]
        F2[Microsegmentation]
        F3[Zero Trust Network]
        F4[Network Monitoring]
    end

    subgraph "Layer 1: Physical Security"
        G1[Data Center Security]
        G2[Hardware Security]
        G3[Environmental Controls]
        G4[Access Controls]
    end

    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4

    B1 --> C1
    B2 --> C2
    B3 --> C3
    B4 --> C4

    C1 --> D1
    C2 --> D2
    C3 --> D3
    C4 --> D4

    D1 --> E1
    D2 --> E2
    D3 --> E3
    D4 --> E4

    E1 --> F1
    E2 --> F2
    E3 --> F3
    E4 --> F4

    F1 --> G1
    F2 --> G2
    F3 --> G3
    F4 --> G4

    style A1 fill:#ffebee
    style B1 fill:#e3f2fd
    style C1 fill:#e8f5e8
    style D1 fill:#fff3e0
    style E1 fill:#f3e5f5
    style F1 fill:#e0f2f1
    style G1 fill:#fafafa
```

### Token Architecture

```mermaid
graph TB
    subgraph "Token Ecosystem"
        A[Access Token]
        B[Refresh Token]
        C[ID Token]
        D[Session Token]
    end

    subgraph "Token Properties"
        A1[JWT Structure]
        A2[Short Lifespan 15min]
        A3[Stateless Design]
        A4[Permission Claims]

        B1[Opaque Structure]
        B2[Long Lifespan 30d]
        B3[Database Stored]
        B4[Family Rotation]

        C1[OIDC Standard]
        C2[User Identity]
        C3[Profile Claims]
        C4[Provider Specific]

        D1[Session Binding]
        D2[Browser Storage]
        D3[CSRF Protection]
        D4[Secure Cookie]
    end

    subgraph "Security Controls"
        S1[Digital Signatures]
        S2[Encryption at Rest]
        S3[Secure Transmission]
        S4[Token Introspection]
        S5[Automatic Rotation]
        S6[Revocation Lists]
    end

    A --> A1
    A --> A2
    A --> A3
    A --> A4

    B --> B1
    B --> B2
    B --> B3
    B --> B4

    C --> C1
    C --> C2
    C --> C3
    C --> C4

    D --> D1
    D --> D2
    D --> D3
    D --> D4

    A1 --> S1
    A2 --> S5
    B3 --> S2
    C2 --> S3
    D4 --> S4
    B4 --> S6

    style A fill:#e1f5fe
    style B fill:#e8f5e8
    style C fill:#fff3e0
    style D fill:#fce4ec
```

## 🏭 Deployment Architecture

### Container Architecture

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        subgraph "Authentication Namespace"
            A[SSO Service Pod]
            B[Token Service Pod]
            C[Session Manager Pod]
            D[MFA Service Pod]
        end

        subgraph "Data Namespace"
            E[PostgreSQL Pod]
            F[Redis Cluster]
            G[MongoDB Pod]
        end

        subgraph "Security Namespace"
            H[Key Management Pod]
            I[Security Monitor Pod]
            J[Audit Logger Pod]
        end

        subgraph "Ingress"
            K[NGINX Ingress]
            L[Cert Manager]
            M[External DNS]
        end
    end

    subgraph "External Services"
        N[Google OAuth]
        O[Microsoft Entra]
        P[SAML Providers]
    end

    subgraph "Monitoring Stack"
        Q[Prometheus]
        R[Grafana]
        S[ELK Stack]
        T[AlertManager]
    end

    K --> A
    K --> B
    K --> C
    K --> D

    A --> E
    A --> F
    B --> F
    C --> F

    A --> H
    B --> H
    C --> I
    D --> J

    A --> N
    A --> O
    A --> P

    I --> Q
    J --> S
    Q --> R
    Q --> T

    style A fill:#bbdefb
    style E fill:#c8e6c9
    style H fill:#ffcdd2
    style K fill:#fff3e0
```

### Microservices Breakdown

#### SSO Service

```yaml
# SSO Service Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sso-service
  namespace: auth
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sso-service
  template:
    metadata:
      labels:
        app: sso-service
    spec:
      containers:
      - name: sso
        image: mainframe-ai/sso-service:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 📊 Data Architecture

### Database Design

```mermaid
erDiagram
    USERS ||--o{ USER_SESSIONS : has
    USERS ||--o{ REFRESH_TOKENS : owns
    USERS ||--o{ AUDIT_LOGS : generates
    USERS ||--o{ MFA_DEVICES : configures

    USERS {
        uuid id PK
        string email UK
        string provider
        string provider_id
        jsonb profile
        timestamp created_at
        timestamp updated_at
        boolean email_verified
        boolean active
        string[] roles
    }

    USER_SESSIONS {
        uuid id PK
        uuid user_id FK
        string session_token
        string ip_address
        string user_agent
        string device_fingerprint
        timestamp created_at
        timestamp last_accessed
        timestamp expires_at
        boolean active
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        string family_id
        string token_hash
        timestamp created_at
        timestamp expires_at
        boolean revoked
        string revocation_reason
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string event_type
        string event_category
        jsonb event_data
        string ip_address
        string user_agent
        timestamp created_at
        string correlation_id
    }

    MFA_DEVICES {
        uuid id PK
        uuid user_id FK
        string device_type
        string device_name
        string encrypted_secret
        timestamp created_at
        timestamp last_used
        boolean active
        integer backup_codes[]
    }

    OAUTH_STATES {
        string state PK
        uuid user_id FK
        string provider
        string redirect_uri
        string code_challenge
        timestamp created_at
        timestamp expires_at
    }

    SECURITY_EVENTS {
        uuid id PK
        string event_type
        string severity
        jsonb event_details
        string source_ip
        timestamp created_at
        string correlation_id
        boolean resolved
    }
```

### Caching Strategy

```mermaid
graph TB
    subgraph "Application Layer"
        A[SSO Service]
        B[Token Service]
        C[Session Manager]
    end

    subgraph "Cache Layers"
        D[L1: In-Memory Cache]
        E[L2: Redis Cluster]
        F[L3: Database]
    end

    subgraph "Cache Types"
        G[Token Validation Cache]
        H[User Profile Cache]
        I[Session Cache]
        J[Rate Limit Cache]
        K[Provider Metadata Cache]
    end

    A --> D
    B --> D
    C --> D

    D --> E
    E --> F

    D --> G
    D --> H
    E --> I
    E --> J
    E --> K

    style D fill:#e3f2fd
    style E fill:#e8f5e8
    style F fill:#fff3e0

    note right of G
        TTL: 15 minutes
        Keys: token_hash
        Size: ~10MB
    end note

    note right of H
        TTL: 1 hour
        Keys: user_id
        Size: ~50MB
    end note

    note right of I
        TTL: Session lifetime
        Keys: session_id
        Size: ~100MB
    end note
```

## ⚡ Performance Architecture

### Scalability Strategy

```mermaid
graph LR
    subgraph "Horizontal Scaling"
        A[Load Balancer]
        B[SSO Service 1]
        C[SSO Service 2]
        D[SSO Service 3]
        E[Auto Scaler]
    end

    subgraph "Vertical Scaling"
        F[Resource Limits]
        G[Memory Management]
        H[CPU Optimization]
    end

    subgraph "Data Scaling"
        I[Read Replicas]
        J[Write Sharding]
        K[Cache Partitioning]
    end

    subgraph "Geographic Distribution"
        L[CDN Edge Locations]
        M[Regional Deployments]
        N[Data Replication]
    end

    A --> B
    A --> C
    A --> D
    E --> A

    B --> F
    C --> G
    D --> H

    B --> I
    C --> J
    D --> K

    I --> L
    J --> M
    K --> N

    style A fill:#bbdefb
    style E fill:#c8e6c9
    style I fill:#ffcdd2
    style L fill:#fff3e0
```

### Performance Metrics

| Component | Target SLA | Current Performance |
|-----------|------------|-------------------|
| **Authentication** | < 200ms | 150ms average |
| **Token Validation** | < 50ms | 35ms average |
| **Session Creation** | < 100ms | 85ms average |
| **Provider Callback** | < 300ms | 250ms average |
| **Throughput** | 10,000 req/s | 12,000 req/s |
| **Availability** | 99.9% | 99.95% |

## 🔄 Integration Architecture

### API Gateway Integration

```yaml
# Kong/NGINX Configuration
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: sso-service-routing
proxy:
  path: /api/v2/auth
  connect_timeout: 10000
  read_timeout: 10000
  write_timeout: 10000
upstream:
  healthchecks:
    active:
      healthy:
        interval: 10
      unhealthy:
        interval: 10
route:
  methods:
  - GET
  - POST
  - PUT
  - DELETE
  strip_path: false
  preserve_host: true
```

### Service Mesh Integration

```yaml
# Istio Service Mesh Configuration
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: sso-service-authz
spec:
  selector:
    matchLabels:
      app: sso-service
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/auth/sa/api-gateway"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/v2/auth/*"]
  - when:
    - key: request.headers[authorization]
      values: ["Bearer *"]
```

## 📈 Monitoring Architecture

### Observability Stack

```mermaid
graph TB
    subgraph "Application Metrics"
        A[Authentication Metrics]
        B[Performance Metrics]
        C[Error Metrics]
        D[Business Metrics]
    end

    subgraph "Infrastructure Metrics"
        E[CPU/Memory Usage]
        F[Network Metrics]
        G[Disk I/O]
        H[Container Metrics]
    end

    subgraph "Security Metrics"
        I[Failed Logins]
        J[Rate Limit Hits]
        K[Token Anomalies]
        L[Suspicious Activity]
    end

    subgraph "Monitoring Tools"
        M[Prometheus]
        N[Grafana]
        O[AlertManager]
        P[PagerDuty]
    end

    subgraph "Logging Stack"
        Q[Application Logs]
        R[Audit Logs]
        S[Security Logs]
        T[ELK Stack]
    end

    A --> M
    B --> M
    C --> M
    D --> M

    E --> M
    F --> M
    G --> M
    H --> M

    I --> M
    J --> M
    K --> M
    L --> M

    M --> N
    M --> O
    O --> P

    Q --> T
    R --> T
    S --> T

    style M fill:#e3f2fd
    style N fill:#e8f5e8
    style T fill:#fff3e0
```

## 🚀 Future Architecture Considerations

### Planned Enhancements

1. **Zero-Trust Architecture**
   - Continuous authentication verification
   - Context-aware access controls
   - Device trust evaluation

2. **AI-Powered Security**
   - Behavioral analytics
   - Anomaly detection
   - Automated threat response

3. **Passwordless Authentication**
   - WebAuthn/FIDO2 support
   - Biometric authentication
   - Hardware security keys

4. **Edge Computing**
   - Edge authentication nodes
   - Reduced latency
   - Improved user experience

---

**Next**: Explore specific [Integration Examples](../integration/) or [Performance Tuning](../performance/) guides.