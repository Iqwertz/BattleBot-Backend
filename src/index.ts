var admin = require("firebase-admin");

var serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://battlebots-30657-default-rtdb.europe-west1.firebasedatabase.app",
});

const maxUserOffTime = 6000;

var userCheckInterval = 3000;

var cleanUpInterval = 300000;

setInterval(() => {
  checkUser();
}, userCheckInterval);

setInterval(() => {
  cleanUp();
}, cleanUpInterval);

function cleanUp() {
  var ref = db.ref("games");
  ref.once("value", function (snapshot: any) {
    //console.log(snapshot.val());
    let mappedGames = formatUserToMap(snapshot.val());
    mappedGames.forEach((game, key) => {
      gameHasLobby(game, key);
    });
  });

  var lRef = db.ref("lobbys");
  lRef.once("value", function (snapshot: any) {
    //console.log(snapshot.val());
    let mappedLobbys = formatUserToMap(snapshot.val());
    mappedLobbys.forEach((lobby, key) => {
      checkPlayerInLobby(lobby);
    });
  });
}

var db = admin.database();
var lobbyRef = db.ref("lobbys");
lobbyRef.on(
  "child_changed",
  (snapshot: any) => {
    if (checkPlayerInLobby(snapshot.val())) {
      checkAdminInLobby(snapshot.val());
    }
  },
  (errorObject: any) => {
    console.log("The read failed: " + errorObject.name);
  }
);

function checkPlayerInLobby(lobby: any): boolean {
  if (!lobby.player) {
    removeLobby(lobby.settings.id);
    removeGame(lobby.settings.id);
    return false;
  }
  return true;
}

function checkAdminInLobby(lobby: any) {
  let mappedPlayer = formatUserToMap(lobby.player);
  let admin = lobby.adminUid;
  if (!mappedPlayer.has(admin)) {
    let newAdmin = getRandomKey(mappedPlayer);
    lobbyRef.child(lobby.settings.id).update({ adminUid: newAdmin });
  }
}

function removeLobby(lobbyId: string) {
  lobbyRef.child(lobbyId).remove();
}

var gamesRef = db.ref("games");
gamesRef.on(
  "child_changed",
  (snapshot: any) => {
    //  console.log(snapshot.val());
  },
  (errorObject: any) => {
    console.log("The read failed: " + errorObject.name);
  }
);

function gameHasLobby(game: any, id: string) {
  var lobbyIdRef = db.ref("lobbys/" + id);
  lobbyIdRef.once("value", function (snapshot: any) {
    if (!snapshot.val()) {
      removeGame(id);
    }
  });
}

function removeGame(id: string) {
  gamesRef.child(id).remove();
}

function checkUser() {
  var userRef = db.ref("user");
  userRef.once("value", function (snapshot: any) {
    let mappedUser = formatUserToMap(snapshot.val());
    mappedUser.forEach((user) => {
      checkLastOnline(user);
      checkLobby(user);
    });
  });
}

function checkLobby(user: any) {
  var lobbyIdRef = db.ref("lobbys/" + user.lobbyId);
  lobbyIdRef.once("value", function (snapshot: any) {
    if (!snapshot.val()) {
      deleteUser(user);
    }
  });
}

function checkLastOnline(user: any) {
  if (
    new Date().getTime() - new Date(user.lastSeen).getTime() >
    maxUserOffTime
  ) {
    deleteUser(user);
  }
}

function deleteUser(user: any) {
  let lobbyId = user.lobbyId;
  let uid = user.uid;

  removeUserFromLobby(lobbyId, uid);
  removeUserFromGame(lobbyId, uid);

  var userRef = db.ref("user");
  userRef.child(uid).remove();
}

function removeUserFromLobby(lobbyId: string, uid: string) {
  if (lobbyId.length > 0 && uid.length > 0) {
    lobbyRef.child(lobbyId).child("player").child(uid).remove();
  }
}

function removeUserFromGame(lobbyId: string, uid: string) {
  if (lobbyId.length > 0 && uid.length > 0) {
    gamesRef.child(lobbyId).child("playerBots").child(uid).remove();
  }
}

function formatUserToMap(obj: any): Map<string, any> {
  let map = new Map();
  for (const key in obj) {
    map.set(key, obj[key]);
  }
  return map;
}

// returns random key from Set or Map
function getRandomKey(collection: any) {
  let keys = Array.from(collection.keys());
  return keys[Math.floor(Math.random() * keys.length)];
}
