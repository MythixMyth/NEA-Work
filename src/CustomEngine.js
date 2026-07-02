import { Chess } from 'chess.js'

/*
  Custom engine for the 400-1200 range. Stockfish's UCI_Elo option has a hard floor of 1320
  (see the 0.2 research in ReleaseNotes) so anything weaker has to be hand made. Structure is
  based on freeCodeCamp's "A step-by-step guide to building a simple chess AI" article and
  Sebastian Lague's chess coding adventure video. minimax with alpha-beta pruning sat 
  on top of a "board scoring" function, which is the same core loop stockfish uses,
  just without decades of extra tricks bolted on. 
  (Javascript is not FAST enough to run extra features such as quiscience search with realistic response times)
*/

// Centipawn values from Michniewski's Simplified Evaluation Function (chessprogramming wiki).
// King is 0 because it can never actually be captured - checkmate is scored inside the search.
const PieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

/*
  Positional bonus per square. Proper evaluation functions use a separate 64 square table for
  every piece type, but that felt overkill for a deliberately weak engine, so this is one shared
  table that just rewards being near the middle. Enough to stop the bot shuffling rook pawns all game.
*/
const CentreBonus = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 5, 5, 5, 5, 5, 5, 0,
  0, 5, 10, 10, 10, 10, 5, 0,
  0, 5, 10, 20, 20, 10, 5, 0,
  0, 5, 10, 20, 20, 10, 5, 0,
  0, 5, 10, 10, 10, 10, 5, 0,
  0, 5, 5, 5, 5, 5, 5, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
]

/*
  
  Depth + blunder pairs per target elo. Depth does most of the heavy lifting (depth 1 literally
  cannot see the reply to its own move) and BlunderChance is the odds of ignoring the search
  entirely and playing a random legal move. Stockfish weakens itself in a smarter way - it applies
  a randomised bias across its top candidate moves so it drifts towards near-best instead of
  random - but flat random blunders read as more "human beginner" for the bottom levels. (weaken the custom chess engine)
  Numbers are first guesses, to be calibrated through playtesting like the stage boundaries were.
*/
export const EngineLevels = [ // Hardcoding the configs later used in function "findBestMove"
  { Elo: 400, Depth: 1, BlunderChance: 0.3 },
  { Elo: 600, Depth: 1, BlunderChance: 0.15 },
  { Elo: 800, Depth: 2, BlunderChance: 0.1 },
  { Elo: 1000, Depth: 2, BlunderChance: 0.03 },
  { Elo: 1200, Depth: 3, BlunderChance: 0.01 }, 
]

// Scores a position from white's point of view in centipawns, negative meaning black is better off.
function evaluateBoard(game) {
  const Board = game.board()
  let Score = 0 
  /*
     2d linear search for each square on the board.
    evaluating score for each square using rank bonus + piece values
  */ 
  for (let Rank = 0; Rank < 8; Rank++) {
    for (let File = 0; File < 8; File++) {
      const Piece = Board[Rank][File]
      if (!Piece) continue
      const Value = PieceValues[Piece.type] + CentreBonus[Rank * 8 + File]
      Score += Piece.color === 'w' ? Value : -Value
    }
  }
  return Score
}

/*
  Trying captures first makes alpha-beta cut off far more branches, since finding a strong move
  early tightens the alpha/beta window for every move checked after it. The chessprogramming wiki
  calls this move ordering and rates it one of the biggest speedups you get basically for free.
*/
function orderMoves(moves) {
  return moves.slice().sort((moveA, moveB) => {
    const ScoreA = moveA.captured ? PieceValues[moveA.captured] : 0
    const ScoreB = moveB.captured ? PieceValues[moveB.captured] : 0
    return ScoreB - ScoreA
  })
}

/*
  Minimax walks the tree of possible move sequences assuming white always picks the highest
  scoring branch and black the lowest. Alpha and beta carry the best score each side is already
  guaranteed somewhere else in the tree - the moment a branch cannot beat that guarantee we stop
  searching it. Same final answer as plain minimax, it just skips the pointless work.

  One thing real engines add that I am deliberately leaving out is quiscience (heuristic) search. Stopping
  dead at depth 0 means the engine can evaluate halfway through a queen trade and think it is up
  a whole queen (the horizon effect, does not look in foresight). For a 400-1200 bot those misjudgements are... a feature.
*/
function minimax(game, depth, alpha, beta, isMaximising) {
  if (game.isCheckmate()){
    return isMaximising 
    ? -100000 - depth
    : 100000 + depth
  }
  if (game.isDraw()) return 0
  if (depth === 0) return evaluateBoard(game)

  const Moves = orderMoves(game.moves({ verbose: true }))

  if (isMaximising) {
    let BestScore = -Infinity // javascript way of using math.inf, first time for everything
    for (const Move of Moves) {
      game.move(Move)
      BestScore = Math.max(BestScore, minimax(game, depth - 1, alpha, beta, false))
      game.undo()
      alpha = Math.max(alpha, BestScore)
      if (beta <= alpha) break
    }
    return BestScore
  }

  let BestScore = Infinity
  for (const Move of Moves) {
    game.move(Move)
    BestScore = Math.min(BestScore, minimax(game, depth - 1, alpha, beta, true))
    game.undo()
    beta = Math.min(beta, BestScore)
    if (beta <= alpha) break
  }
  return BestScore
}

/*
  Root of the search. Takes the FEN string as the abstraction boundary (same as the stockfish
  worker takes "position fen ...") so the front end never needs to know which engine it is
  talking to. Plays the first ply here to keep hold of the actual move objects, then lets
  minimax score everything underneath. Equal scoring moves are collected and picked from at
  random so the bot does not replay the identical game every time.
*/
export function findBestMove(fen, levelIndex) {
  const Game = new Chess(fen)
  const Level = EngineLevels[levelIndex]
  const Moves = Game.moves({ verbose: true })
  if (Moves.length === 0) return null

  if (Math.random() < Level.BlunderChance) {
    return Moves[Math.floor(Math.random() * Moves.length)] // Leaving margin for error.
  }

  const BotIsWhite = Game.turn() === 'w'
  let BestScore = -Infinity
  let BestMoves = []

  for (const Move of orderMoves(Moves)) {
    Game.move(Move)
    const WhiteScore = minimax(Game, Level.Depth - 1, -Infinity, Infinity, !BotIsWhite)
    Game.undo()
    const Score = BotIsWhite ? WhiteScore : -WhiteScore // Score for bot team
    if (Score > BestScore) {
      BestScore = Score
      BestMoves = [Move]
    } else if (Score === BestScore) {
      BestMoves.push(Move)
    }
  }

  return BestMoves[Math.floor(Math.random() * BestMoves.length)]
}
