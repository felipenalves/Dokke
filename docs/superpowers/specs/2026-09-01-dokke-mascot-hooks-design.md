# Dokke Mascot Activity Hooks

## Goal

Make the Usage mascot react to the real-time state of the selected AI without
changing the Dokke-owned usage, token, cost, quota, history, or trend
pipelines.

## Scope

The first implementation covers lifecycle activity only: `working`, `waiting`,
`idle`, and `error`. The current providers are Claude, Codex, Antigravity, and
Grok. A provider receives a hook integration only when its local hook format is
known; the existing local transcript scanner remains the fallback.

No prompt text, tool arguments, credentials, tokens, costs, or transcript
contents are sent through the mascot event path.

## Architecture

1. A small Dokke hook entry point reads the provider payload from stdin,
   normalizes only the provider/session/event/timestamp fields, and posts the
   event to the Dokke server on loopback. It has a short timeout and always
   exits successfully so the agent terminal cannot be blocked by Dokke.
2. `server.js` exposes a loopback-only activity event endpoint. It validates a
   small allowlisted payload and hands it to the activity monitor.
3. `usage/activity.js` keeps an in-memory state per provider/session. A fresh
   hook state has precedence over the file scanner. Hook state expires, and
   scanner results resume automatically when no recent hook event is available.
4. Provider installers add only lifecycle hooks by default, preserve existing
   user hooks, are idempotent, and remove only Dokke-managed entries. Install
   status is reported instead of silently hiding errors.
5. The native Usage screen continues polling the existing activity snapshot.
   The mascot maps the activity state to its existing animation without
   altering its size, layout, mood, or usage display.

## Event mapping

The normalized event mapper accepts provider-specific names but emits only the
following states:

- start/prompt/turn/tool activity -> `working`
- permission/question/approval request -> `waiting`
- stop/after-agent/session end -> `idle`
- explicit provider failure -> `error`

Unknown events are ignored rather than treated as `idle`. Duplicate events for
the same provider/session do not create duplicate visible transitions.

## Safety

- The event endpoint accepts loopback requests only, even when the server also
  serves authenticated LAN clients.
- The hook payload is size-limited and rejects unknown or malformed values.
- Hook installation writes only the provider's managed entries and uses an
  atomic write or a temporary backup before replacing configuration.
- The hook command resolves the current Dokke runtime path; it must not point
  to a stale development checkout after packaging.
- Hook transport failure is observationally silent to the agent.

## Verification

Node tests will cover event normalization, state precedence, expiration,
duplicate handling, endpoint validation, and provider installer merge/uninstall
behavior. Existing usage tests must remain green and continue proving that
usage resources and trends are unchanged. Native tests will verify that
`working` drives the mascot writing animation and that other states remain
static, including Reduce Motion.

The final manual check must launch the current Dokke server and native binary,
install the managed hooks explicitly, invoke a real terminal agent event, and
confirm the selected mascot changes state. It must also confirm that stopping
the current process removes no user-authored hook entries.
