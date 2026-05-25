# Content Registry

Add new content as `.ts` files under this directory, then run:

```bash
node scripts/generate-registry.mjs
```

Supported exports:

- `rooms`
- `monsters`
- `bosses`
- `equipment`
- `consumables`
- `itemEffects`

The generator updates `src/lib/registry/generated.ts`. Application code reads registries from `src/lib/registry/game-registry.ts`.
