# Tax module — public assets

Files under `client/public/` are copied verbatim into `client/dist/` at
`vite build` time and served by Express's static middleware.

## Logos and images

Drop logo PNGs here using the filename referenced from the `communities`
table's `logo_url` column. For Tax America Services that means:

```
client/public/tax/tax-america-services-logo.png
```

After dropping the file in, the landing page header at
`/tax/tax-america-services` will render it automatically — the seed in
`supabase/schema.sql` already points `logo_url` to
`/tax/tax-america-services-logo.png`.

## Replacing or rotating a logo

- Same filename → just overwrite and rebuild.
- Different filename → also update `communities.logo_url` for the row, e.g.

  ```sql
  update public.communities
     set logo_url = '/tax/<new-filename>.png'
   where id = 'tax-america-services';
  ```

- Phase 4b adds an admin UI for uploads so SQL won't be required.

## Sizing

The header CSS (`client/src/tax/styles/tax.css` `.tax-brand__logo`) caps
the logo at `height: 40px; max-width: 220px`. PNGs roughly 600×200 (3:1
aspect) at @2x render crisply on retina screens.
