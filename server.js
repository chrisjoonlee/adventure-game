const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');
const { url } = require('inspector');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === 'GET' && req.url === "/") {
      const htmlFile = fs.readFileSync("views/new-player.html", "utf-8");
      const rooms = world.availableRoomsToString();
      const htmlPage = htmlFile.replace(/#{availableRooms}/g, rooms);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(htmlPage);
    }

    // Phase 2: POST /player
    if (req.method === "POST" && req.url === "/player") {
      if (!player) {
        const currentRoom = world.rooms[req.body.roomId];
        player = new Player(req.body.name, currentRoom);

        res.statusCode = 302;
        res.setHeader("Location", `/rooms/${req.body.roomId}`);
        return res.end();
      }
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === "GET" && req.url.startsWith("/rooms/")) {
      // If no player exists, go back to the home page
      if (!player) {
        res.statusCode = 302;
        res.setHeader("Location", "/");
        return res.end();
      }

      const urlParts = req.url.split("/");

      if (urlParts.length >= 3) {
        const roomId = urlParts[2];
        const room = world.rooms[roomId];

        // If the URL roomId is not the same as the player's roomId
        const playerRoomId = world.getRoomId(player.currentRoom.name);
        if (roomId !== playerRoomId) {
          res.statusCode = 302;
          res.setHeader("Location", `/rooms/${playerRoomId}`);
          return res.end();
        }

        // Get a room page
        if (urlParts.length === 3) {
          const roomItems = room.itemsToString();
          const exits = room.exitsToString();
          const inventory = player.inventoryToString();

          const htmlFile = fs.readFileSync("views/room.html", "utf-8");
          const htmlPage = htmlFile
            .replace(/#{roomName}/g, room.name)
            .replace(/#{inventory}/g, inventory)
            .replace(/#{roomItems}/g, roomItems)
            .replace(/#{exits}/g, exits);

          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html");
          return res.end(htmlPage);
        }

        // Phase 4: GET /rooms/:roomId/:direction
        if (urlParts.length === 4) {
          const direction = urlParts[3].slice(0, 1);
          const newRoom = player.move(direction);
          const newRoomId = world.getRoomId(newRoom.name);

          res.statusCode = 302;
          res.setHeader("Location", `/rooms/${newRoomId}`);
          return res.end();
        }
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === "POST" && req.url.startsWith("/items/")) {
      const urlParts = req.url.split("/");
      if (urlParts.length === 4) {
        const itemId = urlParts[2];
        const action = urlParts[3];

        switch (action) {
          case 'drop':
            player.dropItem(itemId);
            break;
          case 'eat':
            player.eatItem(itemId);
            break;
          case 'take':
            player.takeItem(itemId);
        }

        const roomId = world.getRoomId(player.currentRoom.name);

        res.statusCode = 302;
        res.setHeader("Location", `/rooms/${roomId}`);
        return res.end();
      }
    }

    // Phase 6: Redirect if no matching route handlers
    if (!player) {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      return res.end();
    }

    const roomId = world.getRoomId(player.currentRoom.name);

    res.statusCode = 302;
    res.setHeader("Location", `/rooms/${roomId}`);
    return res.end();
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));