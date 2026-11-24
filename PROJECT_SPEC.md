# GLOBAL SOLANA PREDICTION-MARKET AGGREGATOR
## Five-Stage Codex Development Plan

**Project positioning:** One market. Multiple venues. Smarter execution.

**Product:** A global, Solana-powered prediction-market aggregation and execution platform.

**Core instruction:** Build this project in five sequential stages. Do not attempt to implement all five stages at once. Preserve the architecture, code quality, security requirements, and product direction across every stage.

---

# STEP 1 — FOUNDATION AND PROJECT ARCHITECTURE

You are the lead software architect and senior full-stack engineer.

Your first responsibility is to establish the technical foundation of the prediction-market aggregator.

### Objectives

1. Inspect the existing repository before making changes.
2. Identify existing code, dependencies, configuration, and incomplete features.
3. Establish a modular, scalable architecture.
4. Set up the frontend using:
   - Next.js
   - React
   - TypeScript
   - Tailwind CSS
   - shadcn/ui
   - Solana Wallet Adapter
   - TanStack Query
5. Establish the backend using:
   - Node.js
   - TypeScript
   - NestJS or an appropriately justified alternative
   - PostgreSQL
   - Redis
   - REST APIs
   - WebSocket infrastructure
6. Prepare the Solana development environment using Rust and Anchor.
7. Design the initial database schema.
8. Establish authentication, authorization, logging, error handling, and configuration management.
9. Create a clean, professional dashboard interface.

### Main application sections

- Explore
- Markets
- Trade
- Arbitrage Opportunities
- Portfolio
- Analytics
- Liquidity
- Developers/API
- Settings

### Design direction

Create a modern financial technology interface with:

- Professional dark/light themes
- Responsive desktop and mobile layouts
- Market cards
- Probability indicators
- Price charts
- Navigation sidebar
- Search and filtering
- Portfolio overview
- Clear loading, empty, and error states

### Database foundations

Prepare the initial models for:

- Users
- Wallets
- Venues
- Venue accounts
- Markets
- Canonical events
- Outcomes
- Orders
- Executions
- Positions
- Transactions
- Price history
- Audit logs

### Rules

Do not invent API credentials, venue endpoints, contract addresses, or unsupported integrations.

Use clearly labelled mock data only when necessary for frontend development.

Keep mock data separate from production services.

### Definition of done

- Application starts successfully.
- Frontend and backend communicate.
- Database migrations work.
- Core navigation works.
- Responsive layouts work.
- Configuration and environment variables are documented.
- Basic tests pass.

At completion, report what was built, what was tested, what remains incomplete, and any architectural decisions that need approval.

Do not begin Step 2 until Step 1 is stable.

---

# STEP 2 — MARKET DATA AND VENUE AGGREGATION

You are now responsible for building the platform's multi-venue market aggregation infrastructure.

### Objectives

Integrate supported prediction-market venues, subject to actual API access, venue terms, and jurisdictional restrictions.

Potential integrations include:

- Polymarket
- Kalshi
- Supported Solana-native prediction-market venues
- Additional venues through a modular adapter system

Do not assume every venue supports trading, public data, or the same API capabilities.

### Venue adapter architecture

Create a separate adapter for each venue.

Each adapter should handle:

- Venue authentication where required
- Market discovery
- Market metadata
- Price retrieval
- Order-book retrieval where available
- Historical market data where available
- Market status
- Outcome information
- Resolution information
- Rate limits
- API errors
- Data freshness

Use a common internal interface so new venues can be added without rewriting the entire application.

### Canonical Market Registry

Build a system that identifies equivalent prediction markets across different venues.

For example:

A market asking whether Bitcoin will exceed a specified price by a particular date may exist on multiple platforms.

The system must compare:

- Event description
- Outcome definitions
- Resolution criteria
- Expiration dates
- Time zones
- Thresholds
- Currency
- Settlement source

Classify matches as:

1. Exact equivalent
2. Probable equivalent
3. Similar but different
4. Non-equivalent

Never combine two markets simply because their descriptions look similar.

### Frontend features

Build:

- Unified market discovery
- Venue filters
- Category filters
- Search
- Market comparison
- Probability comparison
- Volume and liquidity indicators
- Market detail pages
- Historical price charts

Clearly identify the original venue for every market.

### Data infrastructure

Implement:

- Data caching
- Scheduled synchronization
- WebSocket updates where supported
- Retry mechanisms
- Rate-limit handling
- Data freshness indicators
- Duplicate detection
- Market reconciliation

### Definition of done

- At least one genuine venue integration works end to end.
- Additional venue adapters can be added independently.
- Markets are normalized correctly.
- Equivalent markets are matched cautiously.
- The UI distinguishes real data from mock data.
- Data freshness and errors are visible.
- Automated tests validate normalization and matching.

Do not begin Step 3 until market data is reliable.

---

# STEP 3 — TRADING ENGINE AND UNIFIED PORTFOLIO

Build the platform's trading and execution infrastructure.

The aggregator must distinguish between viewing markets and executing actual trades.

### Wallet connectivity

Implement supported Solana wallet connections using Solana Wallet Adapter.

Support external wallet connectivity first.

Design the architecture so optional embedded-wallet functionality can be added later.
Configure Solana RPC connectivity for this project.

Use environment variables rather than hardcoded RPC endpoints.

Requirements:

1. Support Devnet and Mainnet.
2. Configure HTTP RPC and WebSocket connections.
3. Read SOLANA_NETWORK, SOLANA_RPC_URL, and SOLANA_WS_URL from environment variables.
4. Create a reusable Solana connection/provider service.
5. Integrate the RPC provider with Solana Wallet Adapter and the PREDICT PM-AMM SDK.
6. Keep API keys and private credentials out of frontend source code and Git.
7. Add environment validation and clear connection errors.
8. Implement retry handling, timeouts, and RPC health checks.
9. Document how to configure the RPC provider.
10. Use Devnet for all development and testing initially.

Do not invent RPC credentials. I will supply the actual provider endpoints.

Do not enable real-money trading or Mainnet execution during initial development.
### Smart Order Router

Build an execution engine that evaluates supported venues before recommending or submitting an order.

It must consider:

- Available liquidity
- Bid and ask prices
- Trading fees
- Spread
- Price impact
- Slippage
- Network costs
- Quote freshness
- Venue availability
- Settlement risk

Calculate the estimated all-in execution cost.

Where supported, identify the venue offering the best net execution.

### Quote simulation

Implement:

- Quote retrieval
- Quote comparison
- Order-size simulation
- Slippage estimation
- Fee estimation
- Execution preview

Never present a simulated quote as a guaranteed execution price.

### Order management

Build:

- Order submission
- Order status
- Order cancellation where supported
- Partial-fill handling
- Execution history
- Error recovery
- Transaction reconciliation

Use idempotency keys to prevent duplicate orders.

Never assume cross-venue execution is atomic.

Require explicit user authorization before submitting trades.

### Unified portfolio

Build a portfolio dashboard showing:

- Connected wallets
- Positions across supported venues
- Average entry price
- Current market value
- Realized profit and loss
- Unrealized profit and loss
- Exposure
- Potential payout
- Settlement status
- Transaction history

Clearly distinguish verified positions from imported or estimated positions.

### Definition of done

- Wallet connection works.
- Quote simulation works.
- Trading works only through genuinely supported execution integrations.
- Orders can be tracked.
- Partial fills and failures are handled safely.
- Portfolio information reconciles with venue records.
- Users can understand execution costs before trading.

Do not begin Step 4 until trading and portfolio accounting are reliable.

---

# STEP 4 — PM-AMM, ARBITRAGE AND RISK INTELLIGENCE

Build the platform's advanced market infrastructure.

This stage should provide differentiation beyond simply displaying markets from multiple platforms.

### A. :::writing{variant="document" id="73519"}
## REQUIRED INTEGRATION: EXISTING PREDICT SOLANA PM-AMM

Integrate the existing open-source PREDICT PM-AMM protocol before considering development of a replacement AMM.

Official documentation:
https://predict-pm-amm.dev/

Builder documentation:
https://predict-pm-amm.dev/hackathon.md

SDK:
`@pm-amm/sdk`

### Integration requirements

1. Study the official documentation, GitHub repository, SDK, and deployed program.
2. Install and configure the official SDK.
3. Connect to the correct Solana cluster.
4. Integrate market creation, market reads, swaps, liquidity deposits, liquidity withdrawals, and winnings claims where supported.
5. Build a frontend interface for interacting with supported PREDICT markets.
6. Integrate PREDICT market data into the canonical market registry.
7. Connect its liquidity and trading functionality to the platform's unified portfolio.
8. Implement transaction monitoring and reconciliation.
9. Validate all program addresses, account layouts, token mint addresses, and instruction requirements against official documentation.
10. Build and test on Devnet before considering Mainnet.

### Important security requirements

The existing protocol must undergo independent security assessment before production use.

Investigate its documented limitations, including centralized resolution, upgrade authority, lack of an independent audit, and multi-outcome probability drift.

Do not imply that integrating the SDK makes the protocol audited or risk-free.

Do not deploy a replacement PM-AMM unless there is a clearly documented technical or commercial reason.

### Expected result

The aggregator should support PREDICT as a native Solana liquidity and trading integration, while maintaining a modular architecture that allows other prediction-market venues to be connected independently.
:::

### B. Liquidity management

Build:

- Liquidity pools
- Liquidity-provider deposits
- Withdrawals
- Pool analytics
- Liquidity utilization
- Fee accounting
- Exposure monitoring
- Risk limits

Clearly disclose liquidity-provider risks.

Never promise guaranteed returns.

### C. Arbitrage and opportunity detection

Build an opportunity engine that compares equivalent markets across venues.

Identify:

- Probability discrepancies
- Price differences
- Potential arbitrage
- Liquidity differences
- Execution-cost differences

Distinguish between:

1. Statistical opportunity
2. Potential executable opportunity
3. Verified executable opportunity

Before displaying an executable opportunity, validate both sides, market equivalence, fees, liquidity, settlement conditions, and execution risks.

Do not advertise theoretical price differences as guaranteed profit.

Do not execute trades autonomously without explicit authorization and configured risk limits.

### D. Analytics

Build:

- Probability history
- Market movement
- Venue comparisons
- Liquidity analytics
- Trading volume
- Execution quality
- Opportunity history
- Portfolio performance

### E. Risk controls

Implement:

- Position limits
- Slippage limits
- Spending limits
- Circuit breakers
- Venue outage detection
- Stale quote protection
- Market suspension
- Emergency trading controls

### Definition of done

- PM-AMM mathematical models are tested.
- Liquidity accounting is consistent.
- Arbitrage detection checks actual execution conditions.
- Risk controls work.
- Analytics use validated data.
- No unverified opportunity is represented as guaranteed profit.

Do not begin Step 5 until all advanced features have passed their internal tests.

---

# STEP 5 — SECURITY, COMPLIANCE, TESTING AND PRODUCTION LAUNCH

You are now acting as the security lead, quality assurance engineer, DevOps engineer, and production readiness reviewer.

Your task is to make the entire platform safe, reliable, and suitable for a controlled production rollout.

### A. Smart-contract security

Review:

- Signer validation
- Account ownership
- Program-derived addresses
- Integer precision
- Arithmetic overflow
- Collateral accounting
- Token transfers
- External program calls
- Oracle manipulation
- Replay protection
- Unauthorized withdrawals
- Settlement logic

Run automated tests and arrange independent audits before mainnet deployment.

### B. Backend and frontend security

Review:

- Authentication
- Authorization
- API abuse
- SQL injection
- Cross-site scripting
- CSRF
- SSRF
- Rate limiting
- Session security
- Secret management
- Webhook validation
- Input validation
- Dependency vulnerabilities

### C. Trading security

Test:

- Stale quotes
- Duplicate orders
- Partial fills
- Venue outages
- Failed transactions
- Settlement mismatches
- Manipulated prices
- Liquidity disappearance
- Oracle failures
- Reconciliation errors

### D. Compliance

Design jurisdiction-aware access controls.

Review:

- Venue-specific terms
- Applicable financial and gambling regulations
- Geographic restrictions
- KYC/AML requirements where applicable
- Sanctions screening where required
- Age and account eligibility
- Restricted market categories
- Responsible trading disclosures

Do not assume that a non-custodial or decentralized architecture removes regulatory obligations.

Global availability must not mean unrestricted trading access.

### E. Performance and reliability

Test:

- Concurrent users
- API response times
- WebSocket stability
- Database performance
- Caching
- RPC failures
- Queue recovery
- High-volume market updates
- Backup and restoration
- Disaster recovery

Implement monitoring, alerts, audit trails, and operational dashboards.

### F. Production deployment

Prepare:

- Production infrastructure
- CI/CD pipelines
- Environment separation
- Database backups
- Monitoring
- Error tracking
- Incident response
- Rollback procedures
- Documentation
- Deployment checklist

Start with a controlled rollout in jurisdictions and venues where operation is authorized.

### Final definition of done

The platform must have:

- Working frontend
- Working backend
- Reliable market aggregation
- Supported trading integrations
- Unified portfolio
- Tested PM-AMM
- Validated arbitrage detection
- Security reviews
- Compliance controls
- Automated tests
- Monitoring and recovery procedures
- Production documentation

Never deploy unaudited contracts or represent incomplete functionality as production-ready.

---

# GLOBAL DEVELOPMENT RULES

These rules apply to all five stages:

1. Inspect the repository before changing code.
2. Preserve working functionality.
3. Build incrementally.
4. Use modular architecture.
5. Never fabricate APIs, credentials, contract addresses, or integrations.
6. Clearly label mock data and simulated functionality.
7. Never claim that a trade executed unless the venue confirms it.
8. Never expose private keys, secrets, or sensitive user data.
9. Write tests alongside features.
10. Document important architectural decisions.
11. Report incomplete work honestly.
12. Do not skip a stage's definition of done.

**At the end of every stage, provide:**

- Features completed
- Files created or modified
- Tests executed and their results
- Known bugs
- Security concerns
- Incomplete functionality
- Recommended next actions

**Important:** Do not automatically move through all five stages. Complete one stage, report the results, and wait for approval before proceeding to the next.
