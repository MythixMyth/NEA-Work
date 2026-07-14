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

Research notes - custom engine (moved out of CustomEngine.js comments to keep the code readable):
- Engine structure follows freeCodeCamp's "A step-by-step guide to building a simple chess AI" article and Sebastian Lague's chess coding adventure video. Both boil down to minimax + alpha-beta pruning sat on top of a board scoring function, which is the same core loop stockfish runs, just without decades of extra tricks bolted on.
- Piece values are from Michniewski's Simplified Evaluation Function (pawn 100, knight 320, bishop 330, rook 500, queen 900 centipawns). King is worth 0 because it can never actually be captured - checkmate is scored inside the search as +/-100000, nudged by remaining depth so faster mates score better.
- Proper evaluation functions use a separate 64-square bonus table per piece type. I used ONE shared centre-control table instead - the engine is meant to be weak, and its main job is just stopping the bot shuffling rook pawns all game.
- Move ordering: searching captures first makes alpha-beta cut off far more branches, because a strong move found early tightens the alpha/beta window for every move checked after it. The chessprogramming wiki rates move ordering as one of the biggest speedups you get basically for free.
- Weakening method: stockfish applies a randomised bias across its top candidate moves so it drifts toward near-best instead of random. My BlunderChance is cruder - a flat probability of playing a fully random legal move - but flat random blunders read as more "human beginner" at the bottom levels.
- Quiescence search skipped on purpose. Stopping dead at depth 0 means the engine can evaluate halfway through a queen trade and think it is up a whole queen (the horizon effect - it cannot see past its own depth limit). For a 400-1200 bot that misjudgement is honestly a feature, and skipping it keeps response times comfortable.
- Tied best moves are picked at random because a deterministic engine gets "booked" fast - even a weak player learns the winning sequence after two games against it.
- References:
  - https://www.chessprogramming.org/Simplified_Evaluation_Function (piece values)
  - https://www.chessprogramming.org/Alpha-Beta (pruning)
  - https://www.chessprogramming.org/Move_Ordering (captures-first speedup)
  - https://www.chessprogramming.org/Horizon_Effect (why no quiescence hurts, or in my case helps)
  - https://www.freecodecamp.org/news/simple-chess-ai-step-by-step-1d55a9266977/ (base structure)
  - Sebastian Lague - "Coding Adventure: Chess" on youtube (evaluation + search overview)

# Release 0.4
- Built EvaluationService.js, a small messaging "API" service that wraps stockfish in its OWN web worker just for evaluating positions (separate from the opponent worker so the bestmove replies never get mixed up). The rest of the app calls evaluatePosition(fen) and gets a "Promise" (TODO: Add into design - new object i js learned, made sense to use) of { ScoreCp, Mate, BestMove } back - all the UCI text parsing ("info ... score cp", "bestmove") is encapsulated inside the service. Requests queue is bottlenecked, one request at a time since a single engine can only search one position at once.
- UCI reports scores from the side-to-move's perspective, which flips every move and would make the bar jitter, so the service converts everything to white's perspective before resolving (positive = good for white). This is the same convention chess.com and lichess display (TODO - add into design).
- Added an eval bar next to the board (chess.com style) driven by the service. White's share of the bar is 50% plus the evaluation, clamped at +-10 pawns so a normal winning advantage never completely empties the bar - only a found forced mate pins it to full/empty. A small label shows the score in pawns (e.g. 1.2) or M3 for mate, using mix-blend-mode so it stays readable over both halves. The bar animates with a CSS transition so it slides instead of snapping.
- Added the game-over popup Zaki asked for back in 0.1.1 - a proper overlay on the board showing the result ("You won by checkmate!" in bot mode since you are always white, "White wins by checkmate" in local mode, plus specific draw reasons like stalemate/repetition) with a "Play again" button that resets the game. Much clearer than the old top-corner status text, which is still there for in-game states like check.
- Evaluations run at depth 12 which comes back well under a second on the lite single-threaded build, and each new position cancels its state update if a newer move already happened (the Cancelled flag in the effect) so a slow old evaluation cannot overwrite a fresh one.
- The material advantage display from Zaki's note (captured piece SVGs) is still TODO - the eval bar covers "who is winning" for now.

# Release 0.5
- Realised ScoreCP is a bit inappropriate, changed it to ScoreCentripawn