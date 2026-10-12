# Identity V Cooldown Tracker — Requirements Specification

**Version:** 1.0 Draft  
**Project Type:** Mobile-first Web Application  
**Target:** MVP deployment before 18:00

## 1. Project Overview

Identity V Cooldown Tracker is a mobile-first web application designed to help players track hunter auxiliary trait cooldowns during matches.

The application allows players to record skill usage and predict when skills will become available again, reducing the need for mental calculations during gameplay.

The MVP focuses on a fast, single-screen interface that can be used on a secondary mobile device while playing Identity V.

## 2. User Stories

| ID | User Story | Priority |
|---|---|---|
| US-01 | As a player, I want all essential controls on a single mobile screen so that I can use the tracker without scrolling. | Must |
| US-02 | As a player, I want to start a match timer so that I can track elapsed match time. | Must |
| US-03 | As a player, I want to see which skills are available and their remaining cooldowns so that I can predict when they can be used. | Must |
| US-04 | As a player, I want to record skill usage with one tap so that I can immediately start tracking its cooldown. | Must |
| US-05 | As a player, I want to see skill usage and next availability timestamps so that I can compare them with the in-game timer. | Must |
| US-06 | As a player, I want the selected skill to swap with the top-left skill so that I can monitor it easily without rearranging every other skill. | Must |
| US-07 | As a player, I want to correct an accidental skill selection without manually entering timestamps. | Must |
| US-08 | As a player, I want to reset the tracker after a match so that I can start a new game. | Must |

## 3. Functional Requirements

### FR-01 — Match Timer
- A Start button begins the match timer at 00:00.
- The timer counts upwards in MM:SS format.
- The timer remains visible at the top of the interface.
- Elapsed time must be calculated from timestamps rather than accumulated interval ticks.

### FR-02 — Skill Tracking
- Support six skills: Blink, Warp, Excitement, Patroller, Abnormal, and Teleport.
- All six skill cards must be displayed in a 2-column × 3-row grid.
- Each skill has a configurable initial availability time and subsequent cooldown duration.
- Skills display their current availability state and remaining cooldown.
- Skills that are unavailable must appear visually disabled.
- A waterline-style animation represents remaining cooldown progress.
- Tapping an available skill records its usage immediately and begins its next cooldown.
- No confirmation dialog is required for skill activation.

### FR-03 — Skill Position Swap
- The selected skill swaps positions with the skill in the top-left position.
- Other skill positions remain unchanged.
- If the selected skill is already in the top-left position, no swap occurs.
- Skill cooldown data must remain associated with the correct skill.

### FR-04 — Skill Detail Modal
- After recording a skill activation, display a dismissible bottom modal.
- The modal displays the selected skill, its usage timestamp, and its next ready timestamp.
- All timestamps use match elapsed time in MM:SS format.
- The modal must have a clearly visible close button.
- Background interactions are disabled while the modal is open.

### FR-05 — Correction
- Provide a Change/Undo mechanism to correct accidental skill selections.
- Corrections must not require manual timestamp entry.
- The previous skill state and position must be recoverable.
- Exact correction interaction to be finalised before implementation.

### FR-06 — Reset
- Provide a Reset Match button.
- Display a confirmation dialog before resetting.
- Confirming resets the match timer, all skill states, usage records, and default card order.
- Cancelling leaves the current match unchanged.

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | The interface must fit on the target iPhone screen without scrolling during normal gameplay. |
| NFR-02 | Skill activation must require only one tap. |
| NFR-03 | Timer calculations must remain accurate after the browser is backgrounded or the phone is locked. |
| NFR-04 | The application must work in a modern mobile browser. |
| NFR-05 | The MVP must not require user accounts or a backend service. |
| NFR-06 | Skill states and timestamps must remain readable at a glance. |

## 5. Acceptance Criteria

- Starting a match displays an increasing timer beginning at 00:00.
- All six skill cards and essential controls are accessible without scrolling on the target device.
- Skill availability and cooldown values update according to configured timing rules.
- Activating a skill records the match timestamp immediately.
- Activating skill 4 from the default order `123456` produces `423156`.
- Activating a skill already in position 1 does not change the order.
- The modal displays the correct Used at and Ready at timestamps.
- Closing the modal allows further skill interactions.
- Reset requires confirmation and restores the initial match state.
- Returning to the app after backgrounding recalculates the correct elapsed time.

## 6. Out of Scope — MVP

- Peepers tracking
- User accounts and authentication
- Cloud synchronisation
- Match history and analytics
- Multiplayer collaboration
- Native iOS/Android applications
- Automatic detection of in-game skill usage

## 7. Open Questions

- OQ-01: Verify initial availability times and subsequent cooldown durations for all six skills.
- OQ-02: Define the exact Change/Undo interaction, including how a mistaken skill activation is corrected.
- OQ-03: Decide whether match state must survive a full browser refresh.
- OQ-04: Confirm behaviour for skills with special cooldown mechanics or multiple charges.