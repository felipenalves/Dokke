# Dokke Gesture Stability

## Goal

Make rapid navigation deterministic on the Android WebView and keep the Usage screen usable when its content is taller than the phone viewport.

## Scope

- Vertical screen pager: accept a new swipe immediately after a transition and preserve the destination when a transition is interrupted.
- Horizontal Launchpad pager: preserve the snap destination when a second swipe interrupts the first snap.
- Usage screen: allow native vertical scrolling and hand the gesture to the screen pager only at the scroll edge.
- Usage refresh: preserve the Usage scroll position when the DOM is refreshed.

## Acceptance criteria

- Two vertical swipes in the same direction, with the second starting during the first animation, reach the second destination.
- A vertical swipe that starts in the first 80 ms after a transition reaches its destination instead of being ignored.
- Two horizontal swipes with a 0–10 ms interval advance two Launchpad pages.
- An overflowing Usage document can change `scrollTop` through a native wheel/touch scroll without changing screens.
- A vertical swipe at the top or bottom edge of Usage can still navigate to the adjacent screen.
- Refreshing Usage leaves its previous `scrollTop` intact when the refreshed content still supports that position.
- Existing vertical, horizontal, Usage, native Usage, and Android WebView contracts remain green.

## Constraints

- Keep the implementation in the existing PWA pager and Usage renderer; do not add a gesture library.
- Do not change the OpenUsage data contract.
- Do not modify the macOS native Usage screen for a PWA-only scroll problem.
- Validate with automated browser tests and a real A02 touch pass.
