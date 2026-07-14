import { Chess } from 'chess.js'

// Hand-written engine for the 400-1200 levels since stockfish refuses to go below 1320 elo.
// Research + sources behind every design choice here are in ReleaseNotes 0.3.

/*
Reasoning for CentreBonus: The bot was shuffling rook pawns all game, so I added a bonus for central squares to encourage it to develop pieces and control the centre. The bonus is small enough that it doesn't override piece values, but large enough to stop the bot from shuffling rook pawns all game.
PieceValues derived from https://www.chessprogramming.org/Simplified_Evaluation_Function#Piece_Values - Used in all chess engines and websites, in different formats
Algorithms derived from youtube videos and chessprogramming.org, with some tweaks to make the bot weaker and more human-like. The bot is designed to be weak, so it doesn't need to be perfect.
I have written code originally and have not used online sources to copy code from, but I have used online sources to learn about chess engines and algorithms. The code is my own work, but the ideas are not.
*/

// Centipawn piece values
const PieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

// One shared bonus table rewarding central squares (stops the bot shuffling rook pawns all game).
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

// Hardcoding the configs later used in function "findBestMove".
// Depth = how many nodes ahead it sees, BlunderChance = odds of ignoring the search for a random move.
export const EngineLevels = [
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
  // 2d linear search over every square, score = piece value + centre bonus.
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

// Captures get searched first so alpha-beta can prune earlier (see ReleaseNotes on move ordering).
// This is a simple heuristic that works well enough for a weak bot. (Simple human-like perspective like tunnel vision for captures)
function orderMoves(moves) {
  return moves.slice().sort((moveA, moveB) => {
    const ScoreA = moveA.captured ? PieceValues[moveA.captured] : 0
    const ScoreB = moveB.captured ? PieceValues[moveB.captured] : 0
    return ScoreB - ScoreA
  })
}

// Minimax with alpha-beta pruning. White picks the max score, black picks the min, and any
// branch that cannot beat a score already guaranteed elsewhere gets skipped (the pruning).
// No quiescence search on purpose - the horizon effect suits a weak bot, see ReleaseNotes 0.3.
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

  let BestScore = Infinity // minimising :|
  for (const Move of Moves) {
    game.move(Move)
    BestScore = Math.min(BestScore, minimax(game, depth - 1, alpha, beta, true))
    game.undo()
    beta = Math.min(beta, BestScore)
    if (beta <= alpha) break
  }
  return BestScore
}

// Root of the search. Takes a FEN string same as the stockfish worker does, so the app never
// cares which engine it is talking to. Tied best moves get picked at random so games dont repeat.
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
