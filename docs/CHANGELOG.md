# Changelog

## 2.10.8-notification-center (2026-02-25)

### Added
- Added a Notification Center in the menu with unread badge count.
- Added cross-context notifications for non-active chats (DM while in group, group while in DM).
- Added clickable notifications that switch instantly to the target chat room.

### Changed
- Added passive room subscriptions so background chats can surface notifications without replacing active chat history.
- Added room-scoped presence payloads (`user_joined`, `user_left`, `user_list_updated`) to improve per-room online accuracy.

### Fixed
- Prevented non-active-room messages from being appended to the currently open chat.
- Improved disconnect cleanup by removing sockets from all joined rooms.

## 2.10.1-call-hotfix (2026-02-24)

### Changed
- Standardized WebRTC signaling to canonical events across client and server:
  - call:offer
  - call:answer
  - call:ice-candidate
  - call:reject / call:rejected
  - call:end / call:ended
- Removed frontend reliance on legacy signaling aliases and switched listener/emit paths to canonical event constants.
- Removed backend legacy alias emits (call:incoming, call:answered) and finalized canonical-only routing.
- Added shared event-constant maps in frontend and backend to prevent future naming drift.

### Fixed
- Fixed call recording state mismatch so call recording UI/state is consistent during auto-record and cleanup.
- Fixed screen-share toggle/restore behavior to reliably switch back to camera without recursive stale-state issues.
- Added stronger call-start and answer error handling for media permission/device errors.
- Added connection timeout handling for unanswered calls and ensured timeout cleanup on all exit paths.
- Added call/media/ringtone cleanup hardening for socket teardown/unmount scenarios.
- Improved local/remote video rendering reliability and mobile video layout behavior.

### Docs
- Updated calling protocol documentation and reliability notes in CALLING_GUIDE.md.
- Added migration/cutover notes reflecting canonical-only signaling runtime.
