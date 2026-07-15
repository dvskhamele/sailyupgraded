TODO - fix hydration issues:
- [x] Analyze root causes: Badge renders `<div>`, DialogDescription renders `<p>`
- [ ] Fix ImportContactsDialog.tsx: `<p>` with `<Badge>` inside
- [ ] Fix SearchCreateContactFallback.tsx: check for `<p>` with `<div>`/Badge
- [ ] Fix BasicView.tsx in contacts/[contactId]: check Badge usage
- [ ] Fix data-table-faceted-filter.tsx: check Badge usage
- [ ] Fix enrichment/page.tsx: check Badge usage
- [ ] Fix ContactProductsSection.tsx: check Badge usage
- [ ] Verify TypeScript checks pass
- [ ] Verify build succeeds