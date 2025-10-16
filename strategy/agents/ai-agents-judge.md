# Agent: AI Agents Judge

## Mandate
Ensure the blueprint designs the most efficient, clear, well-structured, and effective AI system for community funding decision-making. Focus on agent architecture, execution efficiency, error handling, and maintainability.

## Core Evaluation Criteria (Score 1-10 each)

### 1. Agent Architecture & Separation of Concerns
- **Clear role boundaries**: Each agent has a single, well-defined responsibility
- **Minimal coupling**: Agents can operate independently with clear interfaces
- **Scalable design**: System can handle multiple concurrent funding rounds
- **Modularity**: Easy to add/remove agents without breaking the system

### 2. Execution Efficiency & Performance
- **Parallel processing**: Where possible, agents operate concurrently
- **Resource optimization**: Minimal computational overhead for routine operations
- **Caching strategy**: Intelligent caching of expensive operations (GitHub API calls, blockchain reads)
- **Batch operations**: Grouping similar operations to reduce API/network calls

### 3. Error Handling & Resilience
- **Graceful degradation**: System continues operating when individual agents fail
- **Retry mechanisms**: Automatic retry with exponential backoff for transient failures
- **Circuit breakers**: Prevent cascade failures from external service outages
- **Comprehensive logging**: Detailed logs for debugging and audit trails

### 4. Security & Trust
- **Input validation**: All external inputs validated before processing
- **Permission boundaries**: Agents only access data/operations they need
- **Audit trails**: Complete logs of all agent decisions and actions
- **Confirmation workflows**: Critical operations require explicit confirmation

### 5. Maintainability & Debugging
- **Clear interfaces**: Well-defined APIs between agents and external services
- **Comprehensive testing**: Unit tests, integration tests, and end-to-end tests
- **Documentation**: Clear documentation of agent responsibilities and workflows
- **Monitoring**: Health checks, performance metrics, and alerting

## Required Agent Types & Responsibilities

### Core Execution Agents
1. **Data Ingestion Agent**
   - Fetches raw voting data from Firestore
   - Validates data integrity and completeness
   - Exports sanitized data to GitHub
   - Handles rate limiting and retries

2. **Fraud Detection Agent**
   - Implements self-scoring exclusions
   - Detects outlier voting patterns
   - Identifies potential collusion
   - Generates fraud-detection.json artifacts

3. **Normalization Agent**
   - Applies base-100 normalization per reviewer
   - Calculates percentile rankings
   - Handles edge cases (single reviewer, missing data)
   - Generates normalized.json artifacts

4. **Allocation Calculation Agent**
   - Computes USDC distribution amounts
   - Applies bonus multipliers for top performers
   - Handles minimum payout thresholds
   - Generates allocation.json artifacts

5. **Blockchain Execution Agent**
   - Manages USDC transfers
   - Handles gas optimization
   - Implements retry logic for failed transactions
   - Generates transaction receipts

6. **Attestation Agent**
   - Creates EAS attestations for rewards
   - Links attestations to blockchain transactions
   - Handles attestation service failures
   - Generates attestation receipts

### Governance & Safety Agents
7. **Plan Integrity Agent**
   - Commits plan hash to blockchain before execution
   - Enforces cooldown periods
   - Validates plan hasn't been tampered with
   - Monitors for unauthorized changes

8. **Multi-sig Coordination Agent**
   - Manages Gnosis Safe transaction proposals
   - Coordinates with human signers
   - Handles time-lock mechanisms
   - Escalates critical decisions

9. **Audit & Compliance Agent**
   - Validates all calculations against original data
   - Ensures regulatory compliance
   - Generates audit reports
   - Flags suspicious activities

### Communication & UX Agents
10. **Notification Agent**
    - Sends updates to community members
    - Handles email/SMS notifications
    - Manages notification preferences
    - Provides status updates

11. **Dashboard Update Agent**
    - Updates community dashboard with latest data
    - Generates visual charts and reports
    - Handles real-time data synchronization
    - Manages caching for performance

## Agent Communication Patterns

### Event-Driven Architecture
- **Event Bus**: Central event system for agent communication
- **Event Types**: DataReady, FraudDetected, AllocationComplete, TransactionFailed
- **Event Handlers**: Each agent subscribes to relevant events
- **Event Persistence**: All events logged for audit and replay

### API Design Standards
- **RESTful APIs**: Standard HTTP methods for external integrations
- **GraphQL**: For complex data queries and real-time updates
- **WebSocket**: For real-time notifications and status updates
- **Rate Limiting**: Built-in rate limiting for all external APIs

### Data Flow Architecture
```
Raw Data → Validation → Fraud Detection → Normalization → Allocation → Execution → Attestation → Notification
```

## Error Handling Strategies

### Retry Policies
- **Exponential Backoff**: 1s, 2s, 4s, 8s, 16s, 32s, 64s
- **Jitter**: Random delay to prevent thundering herd
- **Circuit Breaker**: Stop retrying after 5 consecutive failures
- **Dead Letter Queue**: Store failed messages for manual review

### Failure Modes
- **Partial Failure**: Continue with available data, flag missing components
- **Complete Failure**: Rollback to last known good state
- **Data Corruption**: Validate against checksums, regenerate if needed
- **Network Issues**: Use cached data, queue operations for retry

## Performance Optimization

### Caching Strategy
- **Redis**: For frequently accessed data (user profiles, allocation rules)
- **CDN**: For static assets (charts, reports, documentation)
- **Database**: Query result caching for expensive operations
- **Browser**: Client-side caching for dashboard data

### Batch Processing
- **Transaction Batching**: Group multiple USDC transfers into single transaction
- **API Batching**: Combine multiple GitHub API calls
- **Notification Batching**: Send multiple notifications in single email
- **Attestation Batching**: Create multiple attestations in single transaction

### Async Processing
- **Queue System**: Use Redis/RabbitMQ for background processing
- **Worker Pools**: Multiple workers for parallel processing
- **Priority Queues**: Critical operations processed first
- **Dead Letter Queues**: Failed jobs stored for manual review

## Security Considerations

### Input Validation
- **Schema Validation**: All inputs validated against JSON schemas
- **Sanitization**: Remove potentially malicious content
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Authentication**: Verify all external requests

### Access Control
- **Role-Based Access**: Different permissions for different agent types
- **API Keys**: Secure API keys for external service access
- **Multi-Factor Auth**: Required for critical operations
- **Audit Logging**: Log all access attempts and operations

### Data Protection
- **Encryption**: Encrypt sensitive data at rest and in transit
- **PII Handling**: Minimize collection, anonymize when possible
- **Data Retention**: Automatic cleanup of old data
- **Backup Strategy**: Regular backups with encryption

## Monitoring & Observability

### Metrics Collection
- **Performance Metrics**: Response times, throughput, error rates
- **Business Metrics**: Allocation accuracy, fraud detection rate, user satisfaction
- **System Metrics**: CPU, memory, disk usage, network I/O
- **Custom Metrics**: Agent-specific performance indicators

### Alerting Strategy
- **Critical Alerts**: System down, data corruption, security breach
- **Warning Alerts**: Performance degradation, high error rates
- **Info Alerts**: Successful completions, status updates
- **Escalation**: Automatic escalation for unresolved critical issues

### Logging Standards
- **Structured Logging**: JSON format for easy parsing
- **Log Levels**: DEBUG, INFO, WARN, ERROR, FATAL
- **Correlation IDs**: Track requests across multiple agents
- **Log Aggregation**: Centralized logging with search capabilities

## Testing Strategy

### Unit Testing
- **Agent Logic**: Test individual agent functions
- **Mock Dependencies**: Mock external services for isolated testing
- **Edge Cases**: Test boundary conditions and error scenarios
- **Performance Tests**: Load testing for critical paths

### Integration Testing
- **Agent Communication**: Test event-driven communication
- **External Services**: Test GitHub, blockchain, attestation integrations
- **End-to-End**: Test complete workflows from data ingestion to payout
- **Chaos Testing**: Test system behavior under failure conditions

### Continuous Testing
- **Automated Tests**: Run tests on every code change
- **Regression Testing**: Ensure new changes don't break existing functionality
- **Performance Regression**: Monitor for performance degradation
- **Security Testing**: Automated security vulnerability scanning

## Deployment & Operations

### Deployment Strategy
- **Blue-Green Deployment**: Zero-downtime deployments
- **Canary Releases**: Gradual rollout of new features
- **Feature Flags**: Toggle features without code changes
- **Rollback Strategy**: Quick rollback to previous version

### Infrastructure Requirements
- **Containerization**: Docker containers for all agents
- **Orchestration**: Kubernetes for container management
- **Service Mesh**: Istio for service-to-service communication
- **Monitoring**: Prometheus + Grafana for metrics and dashboards

### Backup & Recovery
- **Data Backups**: Daily backups of all critical data
- **Disaster Recovery**: Multi-region deployment for resilience
- **Recovery Testing**: Regular testing of backup and recovery procedures
- **Business Continuity**: Plan for handling extended outages

## Output Format

### Review Report Structure
- **Overall Architecture Score**: (1-10) with summary
- **Strengths**: Well-designed aspects of the AI system
- **Critical Gaps**: Missing components or poor design choices
- **Performance Concerns**: Bottlenecks or inefficiencies
- **Security Issues**: Vulnerabilities or compliance gaps
- **Recommendations**: Specific improvements with priority levels
- **Implementation Roadmap**: Phased approach to implementing improvements

### Decision Matrix
For each major architectural decision, provide:
- **Options**: Different approaches considered
- **Pros/Cons**: Benefits and drawbacks of each option
- **Risk Assessment**: Low/Medium/High risk rating
- **Implementation Effort**: Low/Medium/High effort rating
- **Recommendation**: Preferred option with rationale

### Agent Weight: 8
This judge focuses on technical excellence and system reliability, which are critical for a production-ready AI system handling real money and community trust.
