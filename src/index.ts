///////////////////////////////////////////////////
//
//Battlebot-Backend
//
//description: This application manages the firebase of the Battlebot game: https://github.com/Iqwertz/BattleBot-Frontend
//            (Ps. While it is a .ts file the code is mainly .js (Interfaces may be implemented in the future))
//
//author: Julius Hussl
//repo: https://github.com/Iqwertz/BattleBot-Backend
//
///////////////////////////////////////////////////

var admin = require("firebase-admin"); //get firebase admin ref

var serviceAccount = require("../serviceAccountKey.json"); // get the admin account credentials

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://battlebots-30657-default-rtdb.europe-west1.firebasedatabase.app",
});

const maxUserOffTime = 6000; //time until a user is deleted if Timestamp isnt updated

var userCheckInterval = 3000; //interval to recheck user status

var cleanUpInterval = 300000; //interval to check database status and clean it up

///////Set user and cleanUp interval/////////
setInterval(() => {
  checkUser();
}, userCheckInterval);

setInterval(() => {
  cleanUp();
}, cleanUpInterval);

/**
 * cleanUp()
 *
 * loops over all games and lobbys and checks if they are valid
 *
 */
function cleanUp() {
  var ref = db.ref("games");
  ref.once("value", function (snapshot: any) {
    let mappedGames = formatUserToMap(snapshot.val()); //format json to map
    mappedGames.forEach((game, key) => {
      gameHasLobby(key); //check if the game has an corresponding lobby
    });
  });

  var lRef = db.ref("lobbys");
  lRef.once("value", function (snapshot: any) {
    let mappedLobbys = formatUserToMap(snapshot.val()); //format json to map
    mappedLobbys.forEach((lobby, key) => {
      checkPlayerInLobby(lobby); //check if player are left in the lobby
    });
  });
}

/**
 *ini lobbys listener and listen for child changes
 */
var db = admin.database();
var lobbyRef = db.ref("lobbys");
lobbyRef.on(
  "child_changed",
  (snapshot: any) => {
    if (checkPlayerInLobby(snapshot.val())) {
      //check if the changed lobby still has player (the functions deletes the lobby if not)
      checkAdminInLobby(snapshot.val()); //check for the admin in the lobby
    }
  },
  (errorObject: any) => {
    console.log("The read failed: " + errorObject.name);
  }
);

/**
 *checks if player are still in the lobby, if not the lobby and the game are removed
 *
 * @param {*} lobby the lobby to check
 * @return {*}  {boolean} returns true when players are still in the lobby
 */
function checkPlayerInLobby(lobby: any): boolean {
  if (!lobby.player) {
    removeLobby(lobby.settings.id);
    removeGame(lobby.settings.id);
    return false;
  }
  return true;
}

/**
 *check if the user assigned to admin is still in the lobby (if not a new user is assigned)
 *
 * @param {*} lobby the lobby to check
 */
function checkAdminInLobby(lobby: any) {
  let mappedPlayer = formatUserToMap(lobby.player);
  let admin = lobby.adminUid;
  if (!mappedPlayer.has(admin)) {
    let newAdmin = getRandomKey(mappedPlayer);
    lobbyRef.child(lobby.settings.id).update({ adminUid: newAdmin });
  }
}

/**
 *removes a lobby from the firebase
 *
 * @param {string} lobbyId the lobbyId to be deleted
 */
function removeLobby(lobbyId: string) {
  lobbyRef.child(lobbyId).remove();
}

/**
 *ini games listener and listen for child changes (it currently has no function)
 */
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

/**
 *checks if a game has a corresponding lobby and removes it if not
 *
 * @param {string} id
 */
function gameHasLobby(id: string) {
  var lobbyIdRef = db.ref("lobbys/" + id);
  lobbyIdRef.once("value", function (snapshot: any) {
    if (!snapshot.val()) {
      removeGame(id);
    }
  });
}

/**
 *removes a lobby from the firebase
 *
 * @param {string} id the id of the game to be deleted
 */
function removeGame(id: string) {
  gamesRef.child(id).remove();
}

/**
 *loops over every user and checks if his existence is justified
 *
 */
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

/**
 *check if the lobby of the user still exists, deletes user if not
 *
 * @param {*} user the user to check
 */
function checkLobby(user: any) {
  var lobbyIdRef = db.ref("lobbys/" + user.lobbyId);
  lobbyIdRef.once("value", function (snapshot: any) {
    if (!snapshot.val()) {
      deleteUser(user);
    }
  });
}

/**
 *checks if the last user timestamp isnt older than maxUserOffTime, deletes user if not
 *
 * @param {*} user the user to check
 */
function checkLastOnline(user: any) {
  if (
    new Date().getTime() - new Date(user.lastSeen).getTime() >
    maxUserOffTime
  ) {
    deleteUser(user);
  }
}

/**
 *deletes a user from all firebase nodes
 *
 * @param {*} user user to delete
 */
function deleteUser(user: any) {
  let lobbyId = user.lobbyId;
  let uid = user.uid;

  removeUserFromLobby(lobbyId, uid); //removes user from a lobby
  removeUserFromGame(lobbyId, uid);

  var userRef = db.ref("user");
  userRef.child(uid).remove();
}

/**
 *removes a user from a Lobby
 *
 * @param {string} lobbyId id of the lobby
 * @param {string} uid id of the user
 */
function removeUserFromLobby(lobbyId: string, uid: string) {
  if (lobbyId.length > 0 && uid.length > 0) {
    lobbyRef.child(lobbyId).child("player").child(uid).remove();
  }
}

/**
 *removes the bot of a user from a game
 *
 * @param {string} lobbyId id of the game (same as lobby)
 * @param {string} uid id of the user
 */
function removeUserFromGame(lobbyId: string, uid: string) {
  if (lobbyId.length > 0 && uid.length > 0) {
    gamesRef.child(lobbyId).child("playerBots").child(uid).remove();
  }
}

/**
 *formats a json to a map
 *
 * @param {*} obj
 * @return {*}  {Map<string, any>}
 */
function formatUserToMap(obj: any): Map<string, any> {
  let map = new Map();
  for (const key in obj) {
    map.set(key, obj[key]);
  }
  return map;
}

/**
 *gets a random key from a collection (map)
 *
 * @param {*} collection
 * @return {*}
 */
function getRandomKey(collection: any) {
  let keys = Array.from(collection.keys());
  return keys[Math.floor(Math.random() * keys.length)];
}
