## Approach — shadcn migration completion (ELE-51)

Per human feedback, finishing the shadcn/ui integration:

1. **ParseSession page** — replace raw gray/blue Tailwind with shadcn Button, Alert, Dialog, Card, Badge, Spinner, Table
2. **History page** — same treatment; use Card, Badge, Button, Spinner, Alert for empty states
3. **PolicyReview** — swap raw checkbox for shadcn Checkbox
4. **App shell** — migrate NavItem to shadcn Sidebar primitives (SidebarProvider already installed)
5. **Fix** `typecheck:renderer` script (references missing tsconfig.renderer.json)

Verification: `npm run typecheck`, `npm run build:renderer`, `npm run lint`
