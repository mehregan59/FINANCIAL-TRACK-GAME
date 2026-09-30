# FINANCIAL-TRACK-GAME

Capital Clash (formerly Financial Track 100) — Interactive Board Game & DIY Craft Kit

https://mehregan59.github.io/FINANCIAL-TRACK-GAME/

Capital Clash is a web-based financial board game and printable craft kit scaled for a 50 cm circular board. Players navigate a 100-sector market perimeter while dialing in portfolio points, market indices, or economic multipliers (000 – 999) using a 3-ring concentric Market Tracker mechanism.

🌐 Online Multiplayer (3 – 10 players, live sync)

Open the site, enter your name, choose how many players (3 to 10) and press Create a room. Share the 5-character room code or the invite link (?room=CODE). Each friend opens the link, types their own name and joins; the lobby shows every seat, filled or waiting. When everyone has arrived the host presses Start Game (or "Start now with N players" if someone did not show up). The board then opens for all players, each with their own coloured pawn.

The Market Tracker in the middle of the board is not moved by hand: the player whose turn it is (or the host) changes it with the MARKET TRACKER DIALS panel, and everyone sees it update live.

In the lobby each player picks a unique avatar (12 to choose from). In the game, the top-left dice is rolled by clicking it (3D tumble with sound; mute button included). When it stops, the player presses Accept and their avatar hops space by space, counting, from the current space forward by the dice number. The player whose turn it is glows (dice dock, banner and player list) and gets a chime.

Turn rules: player 1 (the host) starts, then play goes one by one in seat order; rolling a 6 gives the same player another roll. Under the dice each player has a row: avatar, shares, money and total value (money + shares x Market value). Starting Market value (default 500), money (5000) and shares (5) are set under "Game settings" on the landing page. Pawns are large avatar tokens outside the board ring, never touching, each linked by a line to its space. See BOARD_ITEMS.md for every item on the board.

Everyone sees the same board, dice roll, pawn positions and Market Tracker dials, live. Only the player whose turn it is can roll the dice or change the dials; the host also controls board layout, event pool and shuffling. If the host leaves, another player takes over automatically. A player who refreshes the page can rejoin their seat with the same code. Rooms are exactly the size the host chose, so extra people are turned away.

How it works: the site stays static (GitHub Pages). Live sync uses Supabase Realtime (Broadcast + Presence), so no database tables or server code are needed. The Supabase project URL and publishable key are set in js/config.js (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY). The publishable key is designed to be public; never commit a service_role or secret key. If those two values are empty, the game falls back to a same-browser test mode (rooms work only between tabs of one browser).

Project layout (no build step): index.html (markup only), css/ (styles.css, game.css, ui.css = bright theme, side rails, bank, landing), js/ (config, util, state, audio, dice, board, events-editor, craftkit, transport, multiplayer, lobby, game, main). Turn logic lives in js/game.js, sync in js/multiplayer.js + js/transport.js.

Temporary test feature: in the lobby the host can press "+ Add 2 test players" to add two computer players that roll and accept by themselves, so one person can test the whole game. To remove it later, set TEST_BOTS = false in js/config.js and delete the blocks marked TEST BOTS (js/lobby.js, index.html #botsBtn).

Note: this is a casual, friends-only design. There is no login and no anti-cheat; anyone with the room code can join, and the host's browser decides dice rolls.

✨ Features

🎯 Interactive SVG Board (50 cm Scale)

100 Radial Sector Tiles: Rectangular track segments running from space 1 to 100 around the outer perimeter.

High-Contrast Typography: Radial text alignment starting at the outer perimeter and extending inward, complete with dark stroke halos for high readability.

2 Playable Track Layouts:

100 Perimeter: Single outer track ring.

50/50 Dual: Concentric inner and outer rings (50 tiles each).

🧭 3-Ring Market Tracker (000 – 999)

3 Concentric Center Dials: Hundreds ($0-9$), Tens ($0-9$), and Units ($0-9$).

Aperture Cover Shields: Opaque shield plates hide unselected digits, displaying only the active number through a 12 o'clock viewing window.

Interactive Controls: Drag and rotate rings directly on the SVG canvas, use $[+]$ / $[-]$ step buttons, or type numbers ($000-999$) directly in the input box.

Upright Digit Alignment: Digits auto-counter-rotate relative to ring rotation to remain upright at all times.

🎲 Investor Game Simulator (2 to 10 Players)

Support for 2 to 10 active players with distinct color-coded tokens (P1 – P10).

Integrated 3D dice with sound, Accept button and step-by-step hopping avatars with leaderboard tracking.

✏️ Customizable Event Pool (1 to 20)

20 Editable Event Templates: Distributes events (e.g., Dividend Payout (+3), Bear Market (-2), Crypto Rally (+5)) randomly across tiles 1 to 100.

Custom Event Editor: Add new custom events, edit text in real time, or delete templates.

Financial Presets: Quick-load predefined pools for Wall Street Equities or Crypto & DeFi Ventures.

✂️ 4-Sheet DIY Physical Craft Kit

Printable SVG templates calibrated to cut out and assemble a real 3D physical rotating board game using cardstock and a single brass paper fastener (split pin):

Sheet 1: Main Board Track Base (Spaces 1–100)

Sheet 2: Rotatable Number Dial Rings (0–9)

Sheet 3: Cover Shield Plates (with aperture window cutouts)

Sheet 4: Assembly Diagram & 10 Foldable Standup Investor Pawns

🚀 Quick Start

Because Financial Track 100 is built as a zero-dependency, single-file web application, no installation or build steps are required!

Clone the repository:

git clone https://github.com/mehregan59/FINANCIAL-TRACK-GAME


Open index.html:
Double-click index.html or open it in any modern web browser (Chrome, Firefox, Edge, Safari).

🛠️ Tech Stack

Frontend: Vanilla JavaScript (ES6+), HTML5 SVG DOM manipulation.

Styling: Tailwind CSS (via CDN) & custom CSS print calibration.

Icons & Fonts: FontAwesome 6 & Google Fonts (Inter & Space Grotesk).

🖨️ Physical Board Assembly Guide

To assemble the physical board game from the included 4-Sheet Craft Kit:

Print: Open the "Print 4-Sheet Craft Kit" modal in the application and print all 4 sheets on heavy cardstock (A4 or Letter size).

Cut Out Base & Dials: Cut out the main board circle on Sheet 1 and the 3 number dial rings on Sheet 2.

Cut Out Shields & Apertures: Cut out the 3 shield plates on Sheet 3 and carefully cut out the dashed rectangular window aperture boxes at the top (12 o'clock position).

Stack Layers: Stack from bottom to top:


$$\text{Main Board} \longrightarrow \text{Hundreds Dial} \longrightarrow \text{Hundreds Cover} \longrightarrow \text{Tens Dial} \longrightarrow \text{Tens Cover} \longrightarrow \text{Units Dial} \longrightarrow \text{Units Cover}$$

Fasten: Push a single brass split pin (paper fastener) through the center hole ($+$) to lock all layers together so the dials spin freely!


Screen layout: left rail = dice on top, players wallet below; centre = board; right rail = Bank (Sell/Buy buttons with sounds, not wired yet), a "coming soon" card slot, and the Market Tracker dials. The toolbar (room code, shuffle, layout, board/events, craft kit, print) sits behind the Menu button. The "Start page" button returns to the landing page. Starting values, the event preset and the one-screen player count live in the landing page's Settings.

Game rules (js/rules.js): the game length decides the die, and the roll is the number of spaces moved (no multiplier). Long (default, the full game): normal die 1-6, ~29 turns each; Standard: 10-sided die with numbers 1-9, ~20 turns; Short: 20-sided die with numbers 1-18, ~10 turns; Beginner: the Short die, tile numbers max +/-3, no Skip, guide on. The spare faces (10 on the d10; 19 and 20 on the d20) carry their own numbers and are never rolled. In Short, Standard and Beginner the dice numbers change so players can reach the end of the board; the host picks the length in the lobby (one-screen: Settings), Long is preselected. The landed number is shown big next to the die. All + tiles add up to at most +499 and all - tiles to at least -500; every event gets a number. After each turn the tiles ahead of the furthest pawn are reshuffled, the list is ranked by portfolio (display only, turn order fixed), and the Bull/Bear/Neutral market phase may change at random (Bull: + tiles count 1 extra, Bear: - tiles count 1 extra; big popup + bar above the board). When a pawn reaches space 100 it is the final round: players who have not had their turn this round still play, then the highest total (money + shares x tracker) wins.

Turn flow: roll the dice -> Accept (pawn hops) -> the tile's number is added to (or taken from) the Market Tracker ("(Skip)" = no change, limits 0-999) -> the bank opens for that player only (buy/sell any number of shares at the tracker price) -> End turn. The old "roll again on a 6" rule is gone. The Market Tracker is locked for players; only tiles and the host's "Reset game" (tracker back to the starting value, everyone on Space 1 with the starting money and shares) change it.

Guide: each new room asks once "Quick guide?"; steps already seen (stored in this browser) are not shown again. To teach a new feature add one entry to GUIDE_STEPS in js/guide.js; to glow a control during a phase add its id to FOCUS in js/game.js.

Save / resume (saves expire 24 hours after the last change): the host saves the game after every step (browser + Supabase table). Run supabase/game_saves.sql once in Supabase (SQL Editor). Resume: start page -> same name + same room code -> "Resume a saved game"; the others join with the code and get their seats back by name.
