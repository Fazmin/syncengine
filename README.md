# SyncEngine

**AI-Powered Web Scraping and Database Population Platform**

SyncEngine is an intelligent platform that scrapes websites and populates user databases. It analyzes database structures, maps website patterns, and uses AI to suggest field mappings - with support for both manual (JSON staging) and automatic sync modes.

## Features

### AI-Powered Mapping
- **LLM Integration**: OpenAI/Claude powered intelligent field mapping suggestions
- **Structure Analysis**: Automatic detection of website data patterns
- **Pagination Detection**: Smart detection of query params, path-based, and button pagination

### Dual Sync Modes
- **Manual Mode**: Data staged as JSON for review before committing to database
- **Auto Mode**: Direct insertion into user's database with scheduled jobs

### Web Scraping
- **Hybrid Scraper**: Puppeteer (browser) + Cheerio (HTTP) for maximum compatibility
- **Rate Limiting**: Configurable delays and concurrency controls
- **Authentication**: Support for cookies, headers, and basic auth

### Assignment Management
- **Grid View**: Card-based overview of all assignments with status tracking
- **Extraction Rules**: Visual editor with CSS selector support

### Job Monitoring
- **Real-time Progress**: Track pages processed, rows extracted
- **Process Logs**: Detailed logging for debugging
- **JSON Preview**: Review staged data before committing

### Database Support
- **SQLite**: File-based databases with easy setup (recommended for development)
- **PostgreSQL, MySQL, SQL Server**: Full enterprise database connectors
- Schema analysis and table discovery
- Secure credential encryption (AES-256-GCM)

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **UI Components**: Shadcn UI, Tailwind CSS
- **Database**: SQLite with Prisma ORM (config), SQLite/PostgreSQL/MySQL/SQL Server (user databases)
- **SQLite Driver**: better-sqlite3 for high-performance SQLite connections
- **Web Scraping**: Puppeteer, Cheerio
- **AI**: OpenAI API
- **Scheduling**: node-cron
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd syncengine
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_APP_NAME="SyncEngine"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="your-super-secret-jwt-key"
ENCRYPTION_KEY="your-32-character-encryption-key"

# AI Service (OpenAI)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o"
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

5. Create sample SQLite databases (optional but recommended):
```bash
npx tsx scripts/create-sample-dbs.ts
```

This creates two sample databases in `./data/`:
- **products.db**: E-commerce catalog with categories, products, and reviews
- **customers.db**: Customer data with orders and order items

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

8. Login with OTP authentication:
   - Enter email: `admin@syncengine.local`
   - Check console for OTP code (or configure SMTP in Settings)
   - Enter the 6-digit OTP code

> **Tip**: After logging in, start by adding a Data Source (SQLite recommended) and a Web Source, then create an Assignment to link them together.

## Project Structure

```
syncengine/
├── data/                   # Sample SQLite databases
│   ├── products.db         # E-commerce product catalog
│   └── customers.db        # Customer and orders data
├── prisma/
│   └── schema.prisma       # Database schema
├── scripts/
│   └── create-sample-dbs.ts # Script to create sample databases
├── src/
│   ├── app/
│   │   ├── api/            # API routes
│   │   │   ├── data-sources/   # Database source endpoints
│   │   │   ├── web-sources/    # Web source endpoints
│   │   │   ├── assignments/    # Assignment endpoints
│   │   │   ├── extraction-jobs/# Job endpoints
│   │   │   └── logs/           # Process log endpoints
│   │   └── (dashboard)/    # Protected pages
│   │       ├── data-sources/   # Database source management
│   │       ├── web-sources/    # Web source management
│   │       ├── assignments/    # Assignment management
│   │       ├── extraction-jobs/# Job monitoring
│   │       └── logs/           # Process logs
│   ├── components/
│   │   ├── assignments/    # Assignment components
│   │   │   └── assignment-card.tsx
│   │   └── ui/             # Shadcn UI components
│   ├── lib/
│   │   ├── services/
│   │   │   ├── database-connector.ts # Multi-DB connector (SQLite, PostgreSQL, MySQL, MSSQL)
│   │   │   ├── web-scraper.ts      # Hybrid scraper
│   │   │   ├── ai-mapper.ts        # AI mapping service
│   │   │   ├── extraction-executor.ts # Extraction engine
│   │   │   └── scheduler.ts        # Cron scheduling
│   │   ├── api.ts          # API client
│   │   └── db.ts           # Prisma client
│   └── types/
│       └── index.ts        # TypeScript definitions
└── output/                 # Staged JSON files (gitignored)
```

## Quick Start Workflow

1. **Add a Data Source** (`/data-sources/new`)
   - Select SQLite and choose one of the sample databases (products.db or customers.db)
   - Test the connection to verify it works

2. **Add a Web Source** (`/web-sources/new`)
   - Enter a website URL to scrape
   - Configure scraper type (HTTP for static sites, Browser for JS-heavy sites)
   - Analyze the website structure

3. **Create an Assignment** (`/assignments/new`)
   - Link the web source to a data source table
   - Choose sync mode: Manual (review first) or Auto (direct insert)
   - Configure extraction schedule

4. **Configure Mappings** (`/assignments/:id`)
   - Use AI suggestions to map website fields to database columns
   - Run sample tests to verify extraction
   - Trigger full extraction when ready

5. **Monitor Jobs** (`/extraction-jobs`)
   - Track extraction progress in real-time
   - Review staged data (Manual mode)
   - Commit to database or cancel

## Sample Databases

The project includes two pre-built SQLite databases for testing:

### Products Database (`./data/products.db`)
| Table | Description | Rows |
|-------|-------------|------|
| `categories` | Product categories | 5 |
| `products` | Product catalog with prices, SKUs | 12 |
| `product_reviews` | Customer reviews with ratings | 6 |

### Customers Database (`./data/customers.db`)
| Table | Description | Rows |
|-------|-------------|------|
| `customers` | Customer contact information | 8 |
| `orders` | Order records with statuses | 8 |
| `order_items` | Individual order line items | 12 |

To regenerate the sample databases:
```bash
npx tsx scripts/create-sample-dbs.ts
```

## Core Concepts

### Data Sources
Configure database connections:
- **SQLite**: Select a `.db` file (easiest for development)
- **PostgreSQL/MySQL/MSSQL**: Standard connection settings with SSL support
- Test connections and discover table schemas

### Web Sources
Configure websites to scrape data from:
- Base URL and authentication
- Scraper type (HTTP, Browser, or Hybrid)
- Rate limiting settings
- Pagination pattern detection

### Assignments
Link a web source to a database table:
- Map extracted fields to database columns
- Configure sync mode (Manual or Auto)
- Set extraction schedules
- Visual mapping editor with AI suggestions

### Extraction Jobs
Track extraction executions:
- View real-time progress
- Monitor rows extracted/inserted
- Review staged JSON data (Manual mode)
- Commit to database with one click

### Process Logs
Comprehensive logging of all activities:
- Debug, Info, Warning, Error levels
- URL and row context
- Filterable log viewer

## API Endpoints

### Web Sources
- `GET /api/web-sources` - List all web sources
- `POST /api/web-sources` - Create a new web source
- `GET /api/web-sources/:id` - Get web source details
- `PUT /api/web-sources/:id` - Update a web source
- `DELETE /api/web-sources/:id` - Delete a web source
- `POST /api/web-sources/:id/analyze` - AI analyze website structure
- `POST /api/web-sources/:id/test-scrape` - Test scrape sample page

### Assignments
- `GET /api/assignments` - List all assignments
- `POST /api/assignments` - Create a new assignment
- `GET /api/assignments/:id` - Get assignment details
- `PUT /api/assignments/:id` - Update an assignment
- `DELETE /api/assignments/:id` - Delete an assignment
- `POST /api/assignments/:id/suggest-mapping` - AI suggest mappings
- `POST /api/assignments/:id/sample-test` - Run sample extraction
- `PUT /api/assignments/:id/mappings` - Update extraction rules
- `POST /api/assignments/:id/run` - Trigger extraction

### Extraction Jobs
- `GET /api/extraction-jobs` - List all jobs
- `GET /api/extraction-jobs/:id` - Get job details
- `POST /api/extraction-jobs/:id/commit` - Commit staged data
- `POST /api/extraction-jobs/:id/cancel` - Cancel running job
- `GET /api/extraction-jobs/:id/staged-data` - Get staged JSON
- `GET /api/extraction-jobs/:id/logs` - Get job logs

### Process Logs
- `GET /api/logs` - List logs (filterable)

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access: All features, user management, settings |
| **Supervisor** | Limited access: Web sources, assignments, jobs, logs |

## Authentication Flow

1. User enters email on login page
2. System sends 6-digit OTP (valid for 10 minutes)
3. User enters OTP to authenticate
4. Session lasts 120 minutes

## Development

### Run development server
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

### Database commands
```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:seed       # Seed initial data
npm run db:studio     # Open Prisma Studio
npm run db:reset      # Reset and seed database
```

## Roadmap

- [x] SQLite database connector with file selection
- [x] Sample databases for testing
- [ ] Cloud storage integration (Azure Blob, S3, GCS)
- [ ] Oracle database connector
- [ ] Incremental extraction with change detection
- [ ] API key authentication
- [ ] Rate limiting
- [ ] Multi-tenant support
- [ ] Webhook notifications
- [ ] Export/import assignment configurations
- [ ] Browser extension for selector picking

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.
