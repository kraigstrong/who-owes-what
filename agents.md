# AGENTS.md

## Architecture rules
- Shared round and hole data are the source of truth.
- Game logic must be implemented as pure calculators where practical.
- Users enter hole outcomes once; all active games derive from that data.
- Base hole scoring is separate from hole contests/awards.
- Course provider raw responses must be mapped into normalized domain models.
- Repositories should be cache-first.
- External provider usage must be replaceable without changing screens or domain logic.
- Nassau must be internally extensible to future presses.
- Preserve data needed for future handicap and net scoring support.
- Centralize configuration and secrets access in one module.

## Secrets and API usage
- Golf Course API key comes from environment variables only.
- `.env` may be a read-only 1Password-mounted virtual FIFO.
- Never rewrite `.env`.
- Never hardcode secrets.
- Do not assume direct client-side API use is permanent; keep the integration boundary clean for a future backend/proxy.
