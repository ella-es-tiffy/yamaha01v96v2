# CHANGELOG - YAMAHA 01V96 PRO TOUCH

## [v0.75d] - 2024-12-24
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
