> [!IMPORTANT]
> SoleHaven runs on a user-owned Supabase project. Nothing in this repository
> should depend on Lovable-managed infrastructure. Avoid rewriting published git
> history — force pushing, or rebasing/amending/squashing commits that are
> already pushed.

- Store catalog and size-level stock in Cloud tables, and create orders only through the transactional database function; this prevents client-side price manipulation and overselling.
- Keep the guest cart in browser storage until authenticated checkout; the database always reprices and verifies stock at order creation.
- Keep all product imagery mapped through local optimized assets; the original generated photography remains brand-consistent without external hotlinks.
