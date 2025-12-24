# CHANGELOG - YAMAHA 01V96 PRO TOUCH

## [v0.985d] - 2024-12-24 (Bugfix/Feature)
### Fixed
- **EQ Section Logic Restriction**: The Save/Restore/Backup logic (for Gain/HPF) is now **strictly limited to the Low Band**.
- **Change**: `lmid`, `hmid`, and `high` bands will now behave as standard parametric bands (or standard defaults) regardless of their Q value, preventing any accidental "Gain Off" behavior or backup/restore logic from triggering on those bands.
- **Affected Functions**: `handleEQChange` (Logic checks now require `band === 'low'`) and `syncStoredGains` (Loops only over `['low']`).

## [v0.984d] - 2024-12-24 (Bugfix)
### Fixed
- **EQ Section**: Fixed a visual glitch where entering HPF mode from Shelf mode (Q > 0 -> 0) would momentarily show **"-18 dB"** instead of skipping directly to **"OFF"**.
- **Fix**: The Q state is now optimistically updated to 0 *before* the Gain update trigger, ensuring the UI correctly applies the HPF logic (OFF) during the transition.
- **UI Update**: Changed the display label for Max Gain in HPF mode from **"+18.0 dB"** to **"ON"** as requested, to clearly indicate the switch-like behavior.

## [v0.983d] - 2024-12-24 (Bugfix)
### Fixed
- **EQ Section**: Fixed a visual glitch where restoring Low Gain would incorrectly snap the knob to 100% (+18dB) or 0% (OFF) despite the value being correct (e.g., 0.1dB).
- **Cause**: The `updateKnobUI` function was still reading the old HPF state (Q=0) when rendering the restored gain, triggering the binary "HPF Snap" visualization logic.
- **Fix**: The Q state is now optimistically updated *immediately* inside the restoration block, ensuring `updateKnobUI` knows the system is back in "Shelf Mode" and renders the knob linearily.

## [v0.982d] - 2024-12-24 (Bugfix)
### Fixed
- **EQ Section**: Implemented robust **Gain Backup**:
  - `syncStoredGains()` runs on every full state update (e.g. boot/bank switch), backing up all current valid gains.
  - While editing gain (Q>0), the value is now continuously backed up to `storedGains`, ensuring the very last value is saved before any switch to HPF.

## [v0.981d] - 2024-12-24 (Bugfix)
### Fixed
- **Core UI**: Finally removed the stubborn legacy block inside `onMove` that was causing `ReferenceError: band is not defined`.
- **Status**: The pointer interaction logic is now clean and exclusively uses the centralized `handleEQChange` method. All knobs should again be fully functional and stable.

## [v0.97d] - 2024-12-24 (Previous)
### Fixed
- **Core UI**: Fixed a `ReferenceError` (undefined variables `band`/`chObj`) in the pointer interaction logic that caused **all EQ knobs (wheels) to become unresponsive**.
- **Cause**: Redundant legacy logic for HPF switching was left in the `onMove` handler after moving it to the centralized `handleEQChange` function.
- **Result**: Removed the buggy legacy code. EQ knobs are now fully functional and correctly use the centralized `handleEQChange` logic for all interactions.

## [v0.96d] - 2024-12-24 (Previous)
### Fixed
- **Core UI**: Fixed a SyntaxError in the pointer interaction logic that caused the UI to fail initialization ("Section weg").
- **EQ Section**: **Centralized Logic (handleEQChange)**:
  - All EQ interactions (Click, Drag, Wheel) now route through a single, robust handler.
  - This ensures that **Save/Restore logic** and **HPF Toggle logic** are applied consistently regardless of input method.
  - **State-Based Transitions**: The system now detects HPF/Shelf transitions based on the *actual internal state* rather than transient start values, significantly improving reliability ("Scuffed Toggle Fix").

## [v0.94d] - 2024-12-24 (Previous)
### Fixed
- **WebSocket Sync**: Added a dedicated `data.type === 'eq'` handler in the frontend WebSocket listener.
- **Why?**: Previously, individual EQ parameter updates from the server refreshed the UI knobs but **failed to update the internal state object**. This caused logic dependent on state (like the Low Gain HPF toggle check `if (state.eq.low.q === 0)`) to read stale data, leading to incorrect behavior (e.g., gain acting binary even after Q was changed to Shelf).
- **Result**: The internal state now stays perfectly in sync with the hardware/server, ensuring the toggle logic only activates when Q is *actually* 0.

## [v0.93d] - 2024-12-24 (Previous)
### Fixed
- **EQ Section**: Implemented **Optimistic State Updates** for EQ parameters. This ensures that when you change a parameter (like Q), the internal state is updated immediately.
- **EQ Section**: This fixes the issue where the Low Gain toggle logic might "stick" to the previous Q value (e.g., behaving like HPF/Binary even after Q was changed to Shelf) because the application was waiting for the server echo before updating its logic state.

## [v0.92d] - 2024-12-24 (Previous)
### Fixed
- **Core UI**: Fixed a critical bug where **encoders starting at 0** were incorrectly treated as missing values and defaulted to 64 (Center), causing them to "jump" to the middle on the first touch.
- **Core UI**: This ensures that when a value is OFF (0), it correctly stays at 0 when you start interacting with it, allowing for smooth fine adjustments from the minimum value.

## [v0.91d] - 2024-12-24 (Previous)
### Changed
- **EQ Section**: **Directional Toggle Logic** for HPF Gain:
  - If Gain is **OFF (0)**: Turning the knob **UP** snaps it to **ON (127)**. Turning it DOWN (further left) keeps it OFF.
  - If Gain is **ON (127)**: Turning the knob **DOWN** snaps it to **OFF (0)**. Turning it UP (further right) keeps it ON.
  - This prevents accidental toggles when trying to "force" the knob into its current state.

## [v0.90d] - 2024-12-24 (Previous)
### Changed
- **EQ Section**: **HPF (Low Q=0) Logic Update**:
  - Entering HPF mode (Q=0) now **forces** the Gain to 0 (OFF) immediately.
  - While in HPF mode, the Gain knob acts as a **strict ON/OFF toggle**: Turning it moves it instantly between 0 (OFF) and 127 (+18dB). No intermediate values are possible.
  - Leaving HPF mode restores the previous continuous gain value.

## [v0.89d] - 2024-12-24 (Previous)
### Added
- **EQ Section**: Implemented **Binary Gain Switch** for Low Band HPF. If HPF (Q=0) is active, the Gain knob can only be **OFF** (0) or **ON** (127 / +18dB). No intermediate values are allowed.
### Changed
- **EQ Section**: Confirmed **Continuous Gain** for All other modes (Q > 0). The gain is fully adjustable (-18dB to +18dB) and the 'OFF' label is hidden when not in HPF mode.

## [v0.88d] - 2024-12-24 (Previous)
### Fixed
- **EQ Section**: Refined **Low Band Gain** OFF-logic. It now only displays "OFF" if the shelf/filter is set to **HPF** (Q=0).
- **EQ Section**: If the Low Band is in Parametric or Shelf mode (Q > 0), the minimum gain position now correctly shows **-18.0 dB** instead of "OFF".

## [v0.87d] - 2024-12-24 (Previous)
### Fixed
- **EQ Section**: Removed 'OFF' and 'Snap' logic for the **HIGH** band gain (B8 21). This band now remains fully manual and visible, as requested.
- **EQ Section**: The HPF (Low band Q=0) snap and restore logic remains active, but is now strictly limited to the Low band.

## [v0.86d] - 2024-12-24 (Previous)
### Added
- **EQ Section**: Implemented **LPF** (High Q=0) and **HPF** (Low Q=0) sync logic for both bands.
- **EQ Section**: Implemented **Gain Restore**: Moving Q back out of the filter zone restores the previous Gain value automatically.
- **EQ Section**: Implemented **Snap-Toggle**: When Gain is "OFF" due to an active filter, moving the Gain encoder instantly jumps it to **+18dB (ON)**.

## [v0.85d] - 2024-12-24 (Previous)
### Changed
- **EQ Section**: Refined Gain-OFF logic. HPF snap (Gain -> OFF) now strictly applies to the **LOW** band only. **HIGH** band gain now remains active/visible at all times as requested.
- **UI Stability**: Stabilized the EQ knob layout by giving the value displays a fixed height and line-height, preventing visual "jumps" when switching between labels (e.g., 'OFF' vs 'dB').

## [v0.84d] - 2024-12-24 (Previous)
### Added
- **EQ Section**: Implemented "ATT" (Attenuation) encoder with -96dB to +12dB range mapping.
- **EQ Section**: Added "TYPE 1" and "TYPE 2" buttons for global EQ algorithm selection.
### Changed
- **EQ Section**: Refined band labels. Middle bands are now labeled "MID-LOW" and "MID-HIGH".
- **EQ Section**: High band Q=0 is now labeled "HPF" as requested.
- **EQ Section**: Fixed "OFF" logic to strictly apply to Low and High bands, keeping Mid-LOW/HIGH gains active at all times.

## [v0.83d] - 2024-12-24 (Previous)
### Changed
- **EQ Section**: Refined Filter-Gain interaction. When Low (HPF) or High (LPF) bands are in filter mode, the Gain knob now correctly snaps to "OFF" and forces the UI encoder to the minimum position to match hardware logic.

## [v0.82d] - 2024-12-24 (Previous)
### Added
- **EQ Section**: Implemented real-world value mapping for knobs. Gain now shows dB (-18 to +18) with an "OFF" state at minimum. Frequency uses a logarithmic scale (20Hz to 20kHz). Q display includes hardware-accurate labels like HPF, LPF, and Shelves.

## [v0.80d] - 2024-12-24 (Previous)
### Changed
- **System**: Adjusted DEFAULT Meter Refresh Rate from 30s to **8s**. This addresses the 10-second timeout of the 01V96 mixer, ensuring the meter stream remains active without large gaps.

## [v0.78d] - 2024-12-24
### Fixed
- **Server**: Fixed routing for the `/dev` folder. Static files inside `/dev` (like the Sniffer) are now correctly served, resolving the 404 error.

## [v0.77d] - 2024-12-24 (Previous)
### Added
- **Developer Tools**: Created "Meter-Stream Sniffer" (`/dev/meter_sniffer.html`). This external diagnostic tool monitors MIDI traffic density and detects stream dropouts (Heartbeat) to debug mixer buffer behavior.

## [v0.76d] - 2024-12-24 (Previous)
### Added
- **Developer Panel**: Added a safety warning for the "METER REFRESH RATE" setting. It warns about potential MIDI stream crashes and the necessary mixer restart if the interval is set too low.

## [v0.75d] - 2024-12-24 (Previous)
### Changed
- **EQ Section**: Refined Header design. Large, high-contrast **EQ [CH]** indicator and a very thin, letter-spaced "4-Band Parametric Equalizer" sub-label for a more premium hardware look.

## [v0.74d] - 2024-12-24 (Previous)
### Added
- **Developer Panel**: Added "METER REFRESH RATE" slider (1s - 60s). This control allows manual adjustment of the meter request interval to fix lagginess/stream dropouts.
### Fixed
- **Meter Engine**: Implemented a safety-guarded (Min 1s) metering poll to keep the MIDI meter stream alive without overloading the mixer.

## [v0.73d] - 2024-12-24 (Previous)
### Added
- **Menu Bar**: Replaced "VIEW HEX" button with a cleaner gear icon (⚙️).
### Fixed
- **EQ Section**: Fixed channel selection display ("CH SELECT") which was not updating correctly.
- **UI Design**: Redesigned EQ header for better readability: bold **EQ [CH]** followed by a thin-styled 4-Band Parametric EQ label.

## [v0.71d] - 2024-12-24
### Changed
- **Fader Section**: Slowed down FX button square-wave blink from 1s to 4s (2s ON / 2s OFF) for a very calm visual presence.

## [v0.70d] - 2024-12-24 (Previous)
### Fixed
- **Fader Section**: Pan hex values (e.g., `(40)`) in the display are now correctly synced with the "VIEW HEX" toggle. They are hidden by default and only appear when debug mode is active.

## [v0.69d] - 2024-12-24 (Previous)
### Changed
- **Fader Section**: Slowed down FX button square-wave blink from 0.5s to 1s for a more relaxed visual feedback.

## [v0.68d] - 2024-12-24 (Previous)
### Added
- **Workflow Optimization**: Refined `agents.md` to prioritize small, iterative changes and established clear naming for UI sections (Fader, EQ, Header).

## [v0.66d] - 2024-12-24 (Previous)
### Added
- **Guidelines Update**: Added specific rules for `/dev` folder usage in `agents.md`.
- **Infrastructure**: Established `/dev` as a persistent scratchpad for AI testing and sniffer scripts.

## [v0.65d] - 2024-12-24
### Changed
- **Project Structure**: Cleaned up root directory. Moved all 70+ sniffer and debug scripts into the `/dev` folder.
- **Organization**: Root directory now only contains core production files.

## [v0.64d] - 2024-12-24
### Changed
- **FX Animation**: Switched from sine to symmetric square-wave blink (0.5s on/off).
- **Changelog UI**: Integrated directly under the menu bar. Full-width layout.
- **UX Navigation**: Any bank or channel selection now automatically hides the changelog.

## [v0.63d] - 2024-12-24
### Added
- New **Changelog Overlay**: A full-screen premium UI overlay to view the latest updates directly in the app.
- Multi-button layout in header: Added "VER" button to toggle the changelog.

## [v0.62d] - 2024-12-24 (Previous)
### Changed
- **Deep FX Sinus-Pulse**: Increased dimming range (0.3 to 1.0) and added glow-pulse for better visibility.
- **UI Refinement**: Removed 'h' suffix from all MIDI hex values for cleaner look.
- **Styles**: Matched channel name boxes with Pan display aesthetics.
- **UX**: Enabled permanent visibility of EQ value displays.

## [v0.61d] - 2024-12-24 (Previous)
### Added
- Initial support for channel name syncing and styling.
- Extended fader height to fill screen.
