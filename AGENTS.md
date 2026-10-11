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

- Render the existing standalone game in an isolated iframe using bundled raw HTML, CSS, and scripts; this preserves its globals and keeps the original files authoritative for standalone hosting and preview.
- Fit the oval board with a container ResizeObserver and a shared horizontal scale for Tiles and avatars; this uses available centre width without changing side-panel sizing or game movement.
- Mount the existing trade form inside The Bank when opened; reuse the authoritative trade engine rather than duplicating buy/sell logic.
- Bridge strategy snapshots from the isolated game to a React question dialog; server functions validate snapshots and keep model calls secret, without mutating game state.
- Store AI access denials in a server-only circuit-breaker table; prevent further requests until access is restored and the owner clears the block.
- Pre-optimize the strategy dialog's React dependencies in Vite; late dependency optimization can mix React dispatcher generations in an already-open preview.
- The owner panel (/owner) uses backend sign-in plus an admin role in a separate roles table (first account becomes owner); feedback questions, answers and bug reports are read and edited only through role-checked server functions.
- UI text stays English in source; js/i18n.js translates the live DOM (static and script-written text, attributes) from per-language dictionaries (js/i18n-<lang>.js, keys may use {0} placeholders), so new text needs only a dictionary entry, not code changes.
- In-game chat, nudges and remove-votes travel over the room's existing realtime channel; only the host applies a removal to the shared state.
- Live-room reconnects reuse the tab's session player id and request a fresh state ('sync'), so a dropped or reloaded player keeps their seat; js/connection.js owns status and retry.
- Live-room seats are reclaimed with a secret Seat key (js/seat.js): shared state stores only its hash and the host rotates it on every claim; name-based seat matching remains only for seats without a key (older saves).
- The German dictionary translates game names too (Feld, Spielbrett, Bank, Würfel, Ereigniskarte, Spielerportfolio); js/screen-tour.js highlights those German words when German is active.
- Animate Event Card cash from the resolved shared card delta in FX.card; skip card-origin FX.trade animations to show one transfer per accepted event on every screen.
- The market Forecast moves the share price only inside a Tile landing (Tile value + percentage Forecast push in one effect); End turn only advances the Forecast countdown, so there is a single price change and animation per move.
- The standalone game falls back to built-in feedback questions and talks to the backend directly over REST when it has no host page (e.g. static hosting); in the preview it uses the host page bridge.
