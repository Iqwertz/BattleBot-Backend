var admin = require("firebase-admin");

var serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://battlebots-30657-default-rtdb.europe-west1.firebasedatabase.app",
});

const maxUserOffTime = 10000;

var userCheckInterval = 5000;

setInterval(() => {
  checkUser();
}, userCheckInterval);

var db = admin.database();
var lobbyRef = db.ref("lobbys");
lobbyRef.on(
  "child_changed",
  (snapshot: any) => {
    console.log(snapshot.val());
  },
  (errorObject: any) => {
    console.log("The read failed: " + errorObject.name);
  }
);

var gamesRef = db.ref("games");
gamesRef.on(
  "child_changed",
  (snapshot: any) => {
    console.log(snapshot.val());
  },
  (errorObject: any) => {
    console.log("The read failed: " + errorObject.name);
  }
);

function checkUser() {
  var userRef = db.ref("user");
  userRef.once("value", function (snapshot: any) {
    //console.log(snapshot.val());
    let mappedUser = formatUserToMap(snapshot.val());
    mappedUser.forEach((user) => {
      checkLastOnline(user);
      checkLobby(user);
    });
  });
}

function checkLobby(user: any) {
  var lobbyIdRef = db.ref("lobby");
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
  lobbyRef.child(lobbyId).child("player").child(uid).remove();
}

function removeUserFromGame(lobbyId: string, uid: string) {
  gamesRef.child(lobbyId).child("playerBots").child(uid).remove();
}

function formatUserToMap(obj: any): Map<string, any> {
  let map = new Map();
  for (const key in obj) {
    map.set(key, obj[key]);
  }
  return map;
}
