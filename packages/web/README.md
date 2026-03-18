# @doublehq/web

React frontend for AI Close Copilot — the client-facing dashboard and close management interface.

## Stack

- **React 18** with TypeScript
- **Vite** for development and bundling
- **TanStack Query** for server state (cached queries with key factories)
- **Redux Toolkit** for client-side UI state (filters, active tabs, workflow)
- **React Router** with protected routes and auth context

## Development

```bash
# From monorepo root
npm run dev

# Or standalone
npm run dev --workspace=packages/web
```

## Architecture

```
src/
├── api/           # API client functions (fetch wrappers)
├── context/       # Auth context provider
├── hooks/
│   ├── queries/   # TanStack Query hooks with key factories
│   └── mutations/ # Mutation hooks with optimistic updates
├── pages/         # Page-level components
│   └── tabs/      # Tab components (Overview, Transactions, Questions, etc.)
├── store/
│   └── slices/    # Redux Toolkit slices (dashboardFilters, ui, closeWorkflow)
├── components/    # Reusable UI components (StatusBadge, ProgressBar, etc.)
└── utils/         # Pure business logic (health derivation, sign-off readiness)
```

## Key Patterns

- **Query key factories** — `clientKeys.detail(id)`, `clientKeys.transactions(id)` for consistent cache management
- **Optimistic updates** — Transaction categorization updates the UI instantly, rolls back on error
- **Lazy data loading** — Tab queries use `enabled` flags to fetch only when active
- **Extracted business logic** — Pure functions in `utils/` are tested independently from React components
