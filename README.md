# karriaro-webdesign-mobile

Mobile-Version von karriaro-webdesign.de unter `m.karriaro-webdesign.de`.

38 statische HTML-Pages — komplett unabhaengig vom Haupt-Repo
[karriaro-webdesign](https://github.com/MuKiz79/karriaro-webdesign).

## Setup

- Hosting: GitHub Pages (main branch, root)
- Custom-Domain: `m.karriaro-webdesign.de` (CNAME-File)
- SSL: GitHub auto-issued
- DNS: CNAME `m` → `mukiz79.github.io` beim Registrar

## Wartung

Mobile-Inhalte werden im Haupt-Repo per `scripts/build-mobile-pages.mjs`
generiert. Nach Aenderung:

```bash
# Im Haupt-Repo:
node scripts/build-mobile-pages.mjs

# Mobile-Files ins Mobile-Repo syncen (siehe bin/sync-mobile.sh):
bash bin/sync-mobile.sh
```

(Sync-Skript wird in Folge-Sprint angelegt.)
