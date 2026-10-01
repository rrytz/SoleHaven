<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store catalog and size-level stock in Cloud tables, and create orders only through the transactional database function; this prevents client-side price manipulation and overselling.
- Keep the guest cart in browser storage until authenticated checkout; the database always reprices and verifies stock at order creation.
- Keep all product imagery mapped through local optimized assets; the original generated photography remains brand-consistent without external hotlinks.
