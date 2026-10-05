(() => {
  "use strict";

  const CONFIG = Object.freeze({
    width: 960,
    height: 360,
    groundY: 294,
    initialSpeed: 300,
    maxSpeed: 720,
    speedIncrease: 8,
    scorePerSecond: 10,
    initialSpawnInterval: 1.45,
    minimumSpawnInterval: 0.82,
    spawnIntervalDecrease: 0.012,
    player: {
      x: 112,
      width: 42,
      height: 48,
      gravity: 2100,
      jumpForce: -760,
      maxFallSpeed: 1250,
      fastFallMultiplier: 3,
      collisionInsetX: 8,
      collisionInsetY: 5,
    },
    colors: {
      ink: "#263b35",
      green: "#4e7959",
      lightGreen: "#c8dfbd",
      ground: "#6b9470",
    },
  });

  const GameState = Object.freeze({
    START: "start",
    PLAYING: "playing",
    PAUSED: "paused",
    GAME_OVER: "game_over",
  });

  const canvas = document.querySelector("#game-canvas");
  const startButton = document.querySelector("#start-button");
  const pauseButton = document.querySelector("#pause-button");
  const statusElement = document.querySelector("#game-status");

  if (!(canvas instanceof HTMLCanvasElement) || !startButton || !pauseButton || !statusElement) {
    throw new Error("Pixel Runner 初始化失敗：找不到必要的 HTML 元素。");
  }

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Pixel Runner 初始化失敗：瀏覽器無法建立 Canvas 2D context。");
  }

  class Player {
    constructor() {
      this.x = CONFIG.player.x;
      this.width = CONFIG.player.width;
      this.height = CONFIG.player.height;
      this.y = CONFIG.groundY - this.height;
      this.velocityY = 0;
      this.gravity = CONFIG.player.gravity;
      this.jumpForce = CONFIG.player.jumpForce;
      this.fastFalling = false;
      this.isGrounded = true;
      this.isJumping = false;
      this.isDead = false;
      this.animationTime = 0;
    }

    jump() {
      if (!this.isGrounded || this.isDead) return false;
      this.velocityY = this.jumpForce;
      this.fastFalling = false;
      this.isGrounded = false;
      this.isJumping = true;
      return true;
    }

    update(deltaTime) {
      this.animationTime += deltaTime;
      if (!this.isJumping || this.isDead) return;

      const gravityMultiplier = this.fastFalling ? CONFIG.player.fastFallMultiplier : 1;
      this.velocityY = Math.min(
        CONFIG.player.maxFallSpeed,
        this.velocityY + this.gravity * gravityMultiplier * deltaTime,
      );
      this.y += this.velocityY * deltaTime;

      if (this.y + this.height >= CONFIG.groundY) {
        this.y = CONFIG.groundY - this.height;
        this.velocityY = 0;
        this.fastFalling = false;
        this.isGrounded = true;
        this.isJumping = false;
      }
    }

    kill() {
      this.isDead = true;
      this.velocityY = 0;
    }

    getCollisionBox() {
      const insetX = CONFIG.player.collisionInsetX;
      const insetY = CONFIG.player.collisionInsetY;
      return {
        x: this.x + insetX,
        y: this.y + insetY,
        width: this.width - insetX * 2,
        height: this.height - insetY * 2,
      };
    }

    draw(ctx) {
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      const running = this.isGrounded && !this.isDead;
      const legFrame = Math.floor(this.animationTime * 12) % 2;
      const bodyColor = this.isDead ? "#a94f47" : CONFIG.colors.ink;

      ctx.fillStyle = bodyColor;
      ctx.fillRect(x + 7, y + 14, 28, 29);
      ctx.fillRect(x + 24, y + 3, 16, 18);
      ctx.fillRect(x + 35, y + 10, 9, 8);

      ctx.fillStyle = "#fffef8";
      ctx.fillRect(x + 33, y + 7, 3, 3);

      ctx.fillStyle = this.isDead ? "#a94f47" : CONFIG.colors.green;
      if (running && legFrame === 0) {
        ctx.fillRect(x + 10, y + 39, 8, 9);
        ctx.fillRect(x + 27, y + 38, 8, 6);
        ctx.fillRect(x + 23, y + 43, 8, 5);
      } else if (running) {
        ctx.fillRect(x + 10, y + 38, 8, 6);
        ctx.fillRect(x + 7, y + 43, 8, 5);
        ctx.fillRect(x + 27, y + 39, 8, 9);
      } else {
        ctx.fillRect(x + 10, y + 39, 8, 9);
        ctx.fillRect(x + 27, y + 39, 8, 9);
      }
    }
  }

  class Obstacle {
    constructor(x, width, height, type, speed) {
      this.x = x;
      this.width = width;
      this.height = height;
      this.y = CONFIG.groundY - height;
      this.speed = speed;
      this.type = type;
      this.spawnTime = 0;
    }

    update(deltaTime) {
      this.x -= this.speed * deltaTime;
      this.spawnTime = Math.min(1, this.spawnTime + deltaTime * 5);
    }

    getCollisionBox() {
      return {
        x: this.x + 3,
        y: this.y + 3,
        width: this.width - 6,
        height: this.height - 3,
      };
    }

    draw(ctx) {
      const scale = 0.72 + this.spawnTime * 0.28;
      const drawWidth = this.width * scale;
      const drawHeight = this.height * scale;
      const drawX = this.x + (this.width - drawWidth) / 2;
      const drawY = CONFIG.groundY - drawHeight;

      ctx.fillStyle = this.type === "large" ? "#a95749" : "#c97553";
      ctx.fillRect(Math.round(drawX), Math.round(drawY), Math.round(drawWidth), Math.round(drawHeight));

      ctx.fillStyle = "#e8a36b";
      ctx.fillRect(Math.round(drawX + 4), Math.round(drawY + 5), 4, 4);
      if (this.width > 25) {
        ctx.fillRect(Math.round(drawX + drawWidth - 9), Math.round(drawY + 13), 4, 4);
      }
      ctx.fillStyle = "#87483f";
      ctx.fillRect(Math.round(drawX + 3), Math.round(drawY + drawHeight - 5), Math.max(4, drawWidth - 6), 5);
    }
  }

  class Game {
    constructor(ctx) {
      this.context = ctx;
      this.state = GameState.START;
      this.player = new Player();
      this.obstacles = [];
      this.elapsedTime = 0;
      this.score = 0;
      this.storageWarning = "";
      this.highScore = this.loadHighScore();
      this.speed = CONFIG.initialSpeed;
      this.spawnTimer = 1;
      this.groundOffset = 0;
      this.backgroundOffset = 0;
      this.clouds = [
        { x: 110, y: 73, size: 1 },
        { x: 405, y: 118, size: 0.7 },
        { x: 730, y: 65, size: 0.9 },
      ];
      this.lastFrameTime = 0;
      this.statusMessage = "";
      this.loop = this.loop.bind(this);
      this.frameRequest = requestAnimationFrame(this.loop);
      this.draw();
      this.syncControls();
    }

    loadHighScore() {
      try {
        return Number.parseInt(localStorage.getItem("pixel-runner-high-score") || "0", 10) || 0;
      } catch (error) {
        this.storageWarning = "瀏覽器未允許本機儲存，最高分無法保留。";
        return 0;
      }
    }

    saveHighScore() {
      try {
        localStorage.setItem("pixel-runner-high-score", String(this.highScore));
      } catch (error) {
        this.storageWarning = "無法儲存最高分；請檢查瀏覽器的儲存權限。";
        this.syncControls();
      }
    }

    start() {
      this.player = new Player();
      this.obstacles = [];
      this.elapsedTime = 0;
      this.score = 0;
      this.speed = CONFIG.initialSpeed;
      this.spawnTimer = 1;
      this.groundOffset = 0;
      this.backgroundOffset = 0;
      this.statusMessage = "";
      this.state = GameState.PLAYING;
      this.lastFrameTime = performance.now();
      this.syncControls();
    }

    togglePause() {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
        this.statusMessage = "遊戲已暫停";
      } else if (this.state === GameState.PAUSED) {
        this.state = GameState.PLAYING;
        this.statusMessage = "";
        this.lastFrameTime = performance.now();
      } else {
        return;
      }
      this.syncControls();
    }

    handleAction() {
      if (this.state === GameState.START || this.state === GameState.GAME_OVER) {
        this.start();
        return;
      }
      if (this.state === GameState.PAUSED) {
        this.togglePause();
        return;
      }
      this.player.jump();
    }

    loop(timestamp) {
      const deltaTime = this.lastFrameTime
        ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.05)
        : 0;
      this.lastFrameTime = timestamp;

      if (this.state === GameState.PLAYING) {
        this.update(deltaTime);
      }
      this.draw();
      this.frameRequest = requestAnimationFrame(this.loop);
    }

    update(deltaTime) {
      this.elapsedTime += deltaTime;
      this.updateDifficulty();
      this.updatePlayer(deltaTime);
      this.updateObstacles(deltaTime);
      this.updateBackground(deltaTime);
      this.updateScore();
      this.checkCollisions();
    }

    updatePlayer(deltaTime) {
      this.player.update(deltaTime);
    }

    updateObstacles(deltaTime) {
      this.spawnTimer -= deltaTime;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        const interval = Math.max(
          CONFIG.minimumSpawnInterval,
          CONFIG.initialSpawnInterval - this.elapsedTime * CONFIG.spawnIntervalDecrease,
        );
        this.spawnTimer = interval * (0.82 + Math.random() * 0.4);
      }

      for (const obstacle of this.obstacles) {
        obstacle.speed = this.speed;
        obstacle.update(deltaTime);
      }
      this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
    }

    spawnObstacle() {
      const roll = Math.random();
      let type;
      let width;
      let height;

      if (roll < 0.38) {
        type = "small";
        width = 24 + Math.floor(Math.random() * 10);
        height = 30 + Math.floor(Math.random() * 15);
      } else if (roll < 0.68) {
        type = "large";
        width = 32 + Math.floor(Math.random() * 12);
        height = 52 + Math.floor(Math.random() * 13);
      } else {
        type = "random";
        width = 18 + Math.floor(Math.random() * 33);
        height = 27 + Math.floor(Math.random() * 44);
      }

      this.obstacles.push(new Obstacle(CONFIG.width + 12, width, height, type, this.speed));
    }

    updateDifficulty() {
      this.speed = Math.min(
        CONFIG.maxSpeed,
        CONFIG.initialSpeed + this.elapsedTime * CONFIG.speedIncrease,
      );
    }

    updateScore() {
      this.score = Math.floor(this.elapsedTime * CONFIG.scorePerSecond);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
      }
    }

    updateBackground(deltaTime) {
      this.groundOffset = (this.groundOffset + this.speed * deltaTime) % 70;
      this.backgroundOffset = (this.backgroundOffset + this.speed * 0.12 * deltaTime) % CONFIG.width;
      for (const cloud of this.clouds) {
        cloud.x -= this.speed * 0.08 * deltaTime;
        if (cloud.x < -100) cloud.x = CONFIG.width + 60;
      }
    }

    checkCollisions() {
      const playerBox = this.player.getCollisionBox();
      for (const obstacle of this.obstacles) {
        const obstacleBox = obstacle.getCollisionBox();
        const intersects = playerBox.x < obstacleBox.x + obstacleBox.width
          && playerBox.x + playerBox.width > obstacleBox.x
          && playerBox.y < obstacleBox.y + obstacleBox.height
          && playerBox.y + playerBox.height > obstacleBox.y;
        if (intersects) {
          this.finish();
          return;
        }
      }
    }

    finish() {
      this.state = GameState.GAME_OVER;
      this.player.kill();
      this.statusMessage = "撞到障礙物了！按 Enter 或點擊畫面再試一次";
      this.syncControls();
    }

    syncControls() {
      startButton.disabled = [GameState.PLAYING, GameState.PAUSED].includes(this.state);
      pauseButton.disabled = ![GameState.PLAYING, GameState.PAUSED].includes(this.state);
      pauseButton.textContent = this.state === GameState.PAUSED ? "繼續" : "暫停";
      startButton.textContent = this.state === GameState.GAME_OVER ? "重新開始" : "開始遊戲";

      let message = this.statusMessage;
      if (!message && this.state === GameState.START) {
        message = "按 Space 或點擊畫面開始";
      } else if (this.state === GameState.PLAYING) {
        message = "奔跑中 — 躲開前方障礙！";
      }
      statusElement.textContent = [message, this.storageWarning].filter(Boolean).join(" ");
    }

    draw() {
      const ctx = this.context;
      ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
      this.drawBackground(ctx);
      this.drawGround(ctx);
      for (const obstacle of this.obstacles) obstacle.draw(ctx);
      this.player.draw(ctx);
      this.drawUI(ctx);

      if (this.state === GameState.START) this.drawStartOverlay(ctx);
      if (this.state === GameState.PAUSED) this.drawPausedOverlay(ctx);
      if (this.state === GameState.GAME_OVER) this.drawGameOverOverlay(ctx);
    }

    drawBackground(ctx) {
      ctx.fillStyle = "#e8f1e7";
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

      ctx.fillStyle = "#d6e7d4";
      for (let index = 0; index < 5; index += 1) {
        const x = index * 250 - (this.backgroundOffset * 0.32) % 250;
        ctx.beginPath();
        ctx.moveTo(x - 50, CONFIG.groundY);
        ctx.lineTo(x + 95, 188 + (index % 2) * 20);
        ctx.lineTo(x + 240, CONFIG.groundY);
        ctx.closePath();
        ctx.fill();
      }

      for (const cloud of this.clouds) this.drawCloud(ctx, cloud);
      ctx.fillStyle = "#b7d1ae";
      for (let index = 0; index < 11; index += 1) {
        const x = (index * 103 + 30 - this.backgroundOffset * 0.5) % (CONFIG.width + 18);
        ctx.fillRect(x, 264 + (index % 3) * 8, 3, 3);
      }
    }

    drawCloud(ctx, cloud) {
      const x = Math.round(cloud.x);
      const y = cloud.y;
      const unit = cloud.size * 10;
      ctx.fillStyle = "rgba(255, 255, 248, 0.82)";
      ctx.fillRect(x, y, unit * 5, unit);
      ctx.fillRect(x + unit, y - unit, unit * 2, unit);
      ctx.fillRect(x + unit * 3, y - unit * 0.6, unit * 1.5, unit * 0.6);
    }

    drawGround(ctx) {
      ctx.fillStyle = CONFIG.colors.ground;
      ctx.fillRect(0, CONFIG.groundY, CONFIG.width, 3);
      ctx.fillStyle = "#a6bf91";
      ctx.fillRect(0, CONFIG.groundY + 3, CONFIG.width, CONFIG.height - CONFIG.groundY);
      ctx.fillStyle = "#87aa7c";
      for (let x = -70 + this.groundOffset; x < CONFIG.width; x += 70) {
        ctx.fillRect(Math.round(x), CONFIG.groundY + 18, 34, 3);
        ctx.fillRect(Math.round(x + 43), CONFIG.groundY + 35, 11, 3);
      }
    }

    drawUI(ctx) {
      ctx.fillStyle = CONFIG.colors.ink;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = '500 17px "DM Mono", monospace';
      ctx.fillText(`SCORE: ${String(this.score).padStart(6, "0")}`, CONFIG.width - 28, 20);
      ctx.fillStyle = "#66806d";
      ctx.font = '500 13px "DM Mono", monospace';
      ctx.fillText(`HI: ${String(this.highScore).padStart(6, "0")}`, CONFIG.width - 29, 46);
    }

    drawStartOverlay(ctx) {
      this.drawMessagePanel(ctx, "READY, RUNNER?", "按 SPACE 或點擊畫面開始", "#3d6951");
    }

    drawPausedOverlay(ctx) {
      this.drawMessagePanel(ctx, "PAUSED", "按 P 或點擊「繼續」回到遊戲", "#3d6951");
    }

    drawGameOverOverlay(ctx) {
      ctx.fillStyle = "rgba(115, 53, 47, 0.12)";
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
      this.drawMessagePanel(
        ctx,
        "GAME OVER",
        `SCORE: ${String(this.score).padStart(6, "0")}   HI: ${String(this.highScore).padStart(6, "0")}`,
        "#a95749",
        "按 ENTER 或點擊畫面重新開始",
      );
    }

    drawMessagePanel(ctx, title, message, accent, detail = "") {
      ctx.fillStyle = "rgba(255, 254, 248, 0.9)";
      ctx.fillRect(270, 111, 420, 130);
      ctx.fillStyle = accent;
      ctx.fillRect(270, 111, 6, 130);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = CONFIG.colors.ink;
      ctx.font = '900 30px "Nunito", sans-serif';
      ctx.fillText(title, CONFIG.width / 2, detail ? 146 : 157);
      ctx.fillStyle = "#718179";
      ctx.font = '700 15px "Nunito", sans-serif';
      ctx.fillText(message, CONFIG.width / 2, detail ? 182 : 197);
      if (detail) {
        ctx.font = '700 13px "Nunito", sans-serif';
        ctx.fillText(detail, CONFIG.width / 2, 213);
      }
    }
  }

  const game = new Game(context);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      game.handleAction();
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      if (game.state === GameState.PLAYING && !game.player.isGrounded) {
        game.player.fastFalling = true;
      }
    } else if (event.code === "Enter") {
      if (game.state === GameState.GAME_OVER || game.state === GameState.START) {
        game.start();
      }
    } else if (event.key.toLowerCase() === "p") {
      game.togglePause();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowDown") {
      game.player.fastFalling = false;
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    game.handleAction();
  });

  startButton.addEventListener("click", () => {
    if (game.state === GameState.START || game.state === GameState.GAME_OVER) {
      game.start();
    }
  });

  pauseButton.addEventListener("click", () => {
    game.togglePause();
  });
})();
