const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

let players = [];
let waitingPlayers = [];

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    handleClientMessage(ws, data);
  });

  ws.on("close", () => {
    players = players.filter((player) => player.ws !== ws);
    broadcastPlayerList();
  });
});

function handleClientMessage(ws, data) {
  switch (data.type) {
    case "join":
      handleJoin(ws, data.name);
      break;
    case "choice":
      handleChoice(ws, data.choice);
      break;
    case "playAgain":
      handlePlayAgain(ws);
      break;
  }
}
function handleJoin(ws, name) {
  if (players.length < 2) {
    players.push({ ws, name, choice: null });
    broadcastPlayerList();

    if (players.length === 2) {
      startGame();
    }
  } else {
    waitingPlayers.push({ ws, name });
    broadcastWaitingList();
  }
}

function broadcastWaitingList() {
  const waitingPlayerNames = waitingPlayers.map((player) => player.name);
  waitingPlayers.forEach((player) => {
    player.ws.send(
      JSON.stringify({
        type: "waitingList",
        waitingPlayers: waitingPlayerNames,
      })
    );
  });
}
function handleChoice(ws, choice) {
  const player = players.find((p) => p.ws === ws);
  if (player) {
    player.choice = choice;
    broadcastPlayerList();

    const allChoicesMade = players.every((p) => p.choice !== null);
    if (allChoicesMade) {
      resolveRound();
    }
  }
}
function handlePlayAgain(ws) {
  const player = players.find((p) => p.ws === ws);
  if (player) {
    player.choice = null;
    broadcastPlayerList();

    const allPlayersReady = players.every((p) => p.choice === null);
    if (allPlayersReady) {
      if (waitingPlayers.length > 0) {
        if (players.length < 2) {
          const waitingPlayer = waitingPlayers.shift();
          players.push({
            ws: waitingPlayer.ws,
            name: waitingPlayer.name,
            choice: null,
          });
          broadcastPlayerList();
          startGame();
        }
      } else {
        broadcastPlayerList();
      }
    }
  }
}
function startGame() {
  console.log("startGame called");
  if (waitingPlayers.length > 0) {
    const waitingPlayer = waitingPlayers.shift();
    players.push({
      ws: waitingPlayer.ws,
      name: waitingPlayer.name,
      choice: null,
    });
  }
  players.forEach((player) => {
    player.ws.send(JSON.stringify({ type: "startGame" }));
  });
}
function resolveRound() {
  const choices = players.map((player) => player.choice);
  const winner = getRoundWinner(choices);
  if (winner) {
    broadcastResult(winner, {
      yourChoice: choices[0],
      opponentChoice: choices[1],
    });
  }
  players.forEach((player) => {
    player.choice = null;
  });
  setTimeout(() => {
    players.forEach((player) => {
      player.choice = null;
    });
    broadcastPlayerList();
  }, 2000);
}

function getRoundWinner(choices) {
  const [choice1, choice2] = choices;

  if (choice1 === choice2) {
    return null;
  } else if (
    (choice1 === "rock" && choice2 === "scissors") ||
    (choice1 === "paper" && choice2 === "rock") ||
    (choice1 === "scissors" && choice2 === "paper")
  ) {
    return choice1;
  } else {
    return choice2;
  }
}
function broadcastResult(winner, choices) {
  const winningPlayer = players.find((player) => player.choice === winner);
  if (winningPlayer) {
    players.forEach((player) => {
      player.ws.send(
        JSON.stringify({
          type: "roundResult",
          winner: winningPlayer.name,
          choices: {
            yourChoice: choices.yourChoice,
            opponentChoice: getOpponentChoice(player),
          },
        })
      );
    });
  }
}
function getOpponentChoice(player) {
  const otherPlayer = players.find((p) => p !== player);
  return otherPlayer ? otherPlayer.choice : null;
}
function broadcastPlayerList() {
  const playerNames = players.map((player) => player.name);
  players.forEach((player) => {
    player.ws.send(
      JSON.stringify({ type: "playerList", players: playerNames })
    );
  });
}

// const PORT = process.env.PORT || 3000;

// server.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
