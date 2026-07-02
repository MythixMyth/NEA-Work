# Release 0.1
- Created chess board visuals using react-js + chessjs for the game object. Using functions with javascript to hook onto the API from chessjs to extend logic onto the users experience, for example visualising legal moves. Prototyping a real-life application of picking a piece to move and not-withdrawing.

# Release 0.1.1
- Removed piece locking as it was frustrating to novice users, might consider making it an optional rule in the future for advanced users.
- Importing stockfish and researching stockfish.js API from npm packagemanager.
- Created releasenotes markdown file to track progress throughout development easier.
Notes for todays games: 
- Zaki (Novice) Said I should display "x Won by checkmate" in a larger popup instead of updating the top right text for status. Also mentioned for me to use material advantage with piece SVGs for whatever material youve taken (truncated visual). - See Chess.com for reference.

# Release 0.2
- Integrated stockfish (18 lite, single-threaded build) as a web worker so the engine runs off the main thread and doesn't freeze the board while calculating.
- Added an Opponent section to the panel with a Local/Bot mode toggle. Switching modes resets the game so you always start a bot game from the initial position.
- Bot difficulty is a slider with 5 levels mapped to Elo ratings (1320 up to 2750), grouped into Beginner/Intermediate/Advanced stages. Using UCI_LimitStrength + UCI_Elo so stockfish plays at a human-ish level instead of full strength.
- Bot always plays black and responds to your moves automatically (800ms think time). The status text shows "Bot is thinking..." while it calculates.
- Locked player input during the bot's turn so you can't move black's pieces or select their squares in bot mode.
- Might revisit the stage boundaries later - 1320 as "Beginner" is still quite strong for a true novice, ties into the note from 0.1.1 about TRUE beginners.

Research notes - expanding levels down to 400 / 600 / 800 / 1000 / 1200:
- Found the blocker: UCI_Elo has a hard minimum of 1320 in the official docs (min 1320, max 3190), so my current slider literally cannot go lower through that option. Explains why level 1 still crushes novices.
- The docs recommend Skill Level (0-20) for going weaker. It works by taking at least 4 candidate moves (expandable with MultiPV) and applying a randomised bias so slightly worse moves get picked. Important gotcha: UCI_Elo OVERRIDES Skill Level if both are set, so I need to turn UCI_LimitStrength off for the new low tiers.
- Problem with Skill Level alone: even at 0 the engine is still tactically sharp at full depth, nowhere near a 400 rated human. Lichess solves this by pairing low skill with hard depth caps (their level 4-8 map to roughly 1600/1700/1900/2200/2600), so my plan is the same idea - combine Skill Level with "go depth N" instead of movetime.
- Draft mapping to calibrate through playtesting: 400 = skill 0 + depth 1, 600 = skill 1 + depth 1, 800 = skill 2 + depth 2, 1000 = skill 4 + depth 3, 1200 = skill 6 + depth 4. These are guesses, will test against Zaki and adjust.
- If depth caps still feel too robotic (shallow stockfish blunders differently to humans), fallback idea is MultiPV - ask for 4-5 lines and pick a weighted-random one myself in the move handler. Full manual control over blunder rate.
- Also looked at Maia, a neural net trained on human games per rating band. Plays the most human-like but only covers 1100-1900 and would mean running an lc0 net in the browser, way too heavy for this. Ruled out, but good reference for what "human-like weak play" means.
- References:
  - https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html (UCI_Elo min/max, Skill Level)
  - https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html (how weakening picks suboptimal moves)
  - https://lichess.org/forum/general-chess-discussion/what-are-the-elo-ratings-for-stockfish-levels-4-5-6-7-and-8 (lichess level -> elo estimates)
  - https://lichess.org/forum/general-chess-discussion/question-about-maia-bots (Maia rating bands)

# Release 0.3
- Built CustomEngine.js (ill name it later. I have reused logic from my initial solution written in lua - was too slow), a hand-written engine covering the 400-1200 range that stockfish's UCI_Elo floor (1320) locked me out of. Decided writing my own was better than fighting stockfish's options anyway, it shows the actual computational methods instead of hiding them behind an API. (pretty easy, Its fairly simple + a lot of prescedants to work with)
- Core is minimax with alpha-beta pruning, searching to a configurable depth per level. Added capture-first move ordering since alpha-beta prunes way more branches when a strong move sets the window early (chessprogramming wiki rates move ordering as one of the biggest "free" speed-ups).
- Evaluation heuristic is Michniewski's simplified centipawn values plus one shared centre-control bonus table. Deliberately did NOT use per-piece square tables, the engine is supposed to be weak, and one table is easier to justify in the writeup.
- The engine takes a FEN string and returns a move, same abstraction boundary as the stockfish worker ("position fen ..."), so the front end will not "care" which engine it is talking to when I wire the levels together. (composition mogs inheritance)
- Difficulty mapping (from the 0.2 research) became an EngineLevels config: 400/600/800/1000/1200 elo mapped to depth 1/1/2/2/3 plus a random-blunder chance going 30% down to 1%. Tied best moves get picked at random so the bot does not always replay identical games.
- Deliberately skipped quiescence search, stopping dead at depth 0 means the engine can misjudge mid-trade (horizon effect), which for a beginner bot is honestly a feature, and javascript might not be fast enough for it at sane response times anyway.
- Testing cases: plays e4 from the start position, takes a hanging queen 8/8 times at level 4, finds mate in one at level 5. Depth 1-2 responds in milliseconds but depth 3 took ~1.5s in a tactical position, so level 5 (1200) needs to run async with the BotThinking state like stockfish does, not inline in the click handler. (I have not included wiring-in in the commit as its not finished and I need more stresstesting with current numbers to identify the necessary elo range and elo labels to each level.)
- TODO: playtest the depth/blunder numbers against real novices (zaki, myself and maybe Fidyan an intermediate) and adjust, same as the stage boundaries.