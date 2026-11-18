// ==========================================
// 1. SMART CONTRACT CONFIGURATION (TRUFFLE / GANACHE)
// ==========================================
const CONTRACT_ADDRESS = "0x7f5eB3C68C6c24979683877d66D746EF89F5627c";

const ABI = [
    "function claimStarterCoins() external",
    "function lockCoinsAndStart() external",
    "function settleBattle(bool playerWon) external",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function getGameState(address player) external view returns (uint256 playerPokeBalance, uint256 housePokeBalance, bool claimedStarter, bool activeMatch, uint256 pWins, uint256 cWins)"
];

let provider, signer, contract, userAddress;
let isMatchLocked = false;

// ==========================================
// 2. CREATURE DATA & FACTORY
// ==========================================
const CREATURE_DATA = {
    player: {
        id: "pikachu",
        name: "Pikachu",
        maxHp: 100,
        hp: 100,
        image: "../assets/player.png",
        attacks: [
            { name: "Quick Strike", minDamage: 12, maxDamage: 18, accuracy: 0.95, effectType: "slash" },
            { name: "Power Blast", minDamage: 20, maxDamage: 28, accuracy: 0.80, effectType: "orb" },
            { name: "Super Attack", minDamage: 30, maxDamage: 40, accuracy: 0.65, effectType: "lightning" }
        ]
    },
    opponent: {
        id: "plankton",
        name: "Plankton",
        maxHp: 100,
        hp: 100,
        image: "../assets/opponent.png",
        attacks: [
            { name: "Chum Toss", minDamage: 10, maxDamage: 16, accuracy: 0.95, effectType: "lob" },
            { name: "Laser Beam", minDamage: 18, maxDamage: 26, accuracy: 0.80, effectType: "laser" },
            { name: "Evil Scheme", minDamage: 28, maxDamage: 38, accuracy: 0.65, effectType: "shockwave" }
        ]
    }
};

function createCreature(type) {
    return JSON.parse(JSON.stringify(CREATURE_DATA[type]));
}

// ==========================================
// 3. COMPUTER OPPONENT AI
// ==========================================
const ComputerAI = {
    chooseAttack(computerCreature, playerCreature) {
        const attacks = computerCreature.attacks;

        if (playerCreature.hp <= 25) return attacks[1];
        if (computerCreature.hp <= 25) return attacks[2];

        const roll = Math.random();
        if (roll < 0.50) return attacks[0];
        if (roll < 0.85) return attacks[1];
        return attacks[2];
    }
};

// ==========================================
// 4. PHASER BATTLE ARENA & VISUAL EFFECTS
// ==========================================
class BattleArenaScene extends Phaser.Scene {
    constructor() {
        super({ key: "BattleArenaScene" });
        this.playerSprite = null;
        this.opponentSprite = null;
    }

    preload() {
        this.load.image("battle-bg", "../assets/battle_ground.jpeg");
        this.load.image("player-sprite", "../assets/player.png");
        this.load.image("opponent-sprite", "../assets/opponent.png");
    }

    create() {
        const bg = this.add.image(470, 235, "battle-bg");
        bg.setDisplaySize(940, 470);

        // Plankton at top-right dirt clearing
        this.opponentSprite = this.add.image(660, 255, "opponent-sprite");
        this.opponentSprite.setDisplaySize(120, 120);

        // Pikachu at bottom-left dirt clearing
        this.playerSprite = this.add.image(280, 330, "player-sprite");
        this.playerSprite.setDisplaySize(175, 175);

        // GBA idle breathing animation
        this.tweens.add({
            targets: [this.playerSprite, this.opponentSprite],
            y: "-=6",
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }

    setPaused(paused) {
        if (paused) {
            this.tweens.pauseAll();
        } else {
            this.tweens.resumeAll();
        }
    }

    playAttack(attacker, effectType = "slash", onImpact) {
        const attackerSprite = attacker === "player" ? this.playerSprite : this.opponentSprite;
        const defenderSprite = attacker === "player" ? this.opponentSprite : this.playerSprite;
        const defenderKey = attacker === "player" ? "opponent" : "player";

        if (!attackerSprite || !defenderSprite) {
            if (onImpact) onImpact();
            return;
        }

        const lungeDistance = attacker === "player" ? 45 : -45;

        this.tweens.add({
            targets: attackerSprite,
            x: attackerSprite.x + lungeDistance,
            duration: 120,
            yoyo: true,
            onYoyo: () => {
                this.triggerEffect(effectType, attackerSprite, defenderSprite, () => {
                    this.playHitFlash(defenderKey);
                    if (onImpact) onImpact();
                });
            }
        });
    }

    triggerEffect(effectType, fromSprite, toSprite, onComplete) {
        switch (effectType) {
            case "lightning":
                this.spawnLightningBolt(toSprite.x, toSprite.y, onComplete);
                break;
            case "orb":
                this.spawnProjectileOrb(fromSprite.x, fromSprite.y, toSprite.x, toSprite.y, 0xffea00, onComplete);
                break;
            case "laser":
                this.spawnLaserBeam(fromSprite.x, fromSprite.y - 20, toSprite.x, toSprite.y, onComplete);
                break;
            case "lob":
                this.spawnProjectileOrb(fromSprite.x, fromSprite.y, toSprite.x, toSprite.y, 0x66bb6a, onComplete);
                break;
            case "shockwave":
                this.spawnShockwave(toSprite.x, toSprite.y, onComplete);
                break;
            case "slash":
            default:
                this.spawnSlashEffect(toSprite.x, toSprite.y, onComplete);
                break;
        }
    }

    spawnLightningBolt(targetX, targetY, onComplete) {
        const gfx = this.add.graphics();
        gfx.setDepth(20);

        this.cameras.main.flash(180, 255, 255, 180);
        this.cameras.main.shake(220, 0.012);

        const points = [
            { x: targetX - 35, y: 0 },
            { x: targetX + 20, y: targetY * 0.35 },
            { x: targetX - 25, y: targetY * 0.45 },
            { x: targetX + 30, y: targetY * 0.78 },
            { x: targetX - 10, y: targetY * 0.82 },
            { x: targetX, y: targetY + 15 }
        ];

        gfx.lineStyle(14, 0xffaa00, 0.55);
        gfx.beginPath();
        gfx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => gfx.lineTo(p.x, p.y));
        gfx.strokePath();

        gfx.lineStyle(6, 0xffff55, 1);
        gfx.beginPath();
        gfx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => gfx.lineTo(p.x, p.y));
        gfx.strokePath();

        gfx.fillStyle(0xffffff, 0.9);
        gfx.fillCircle(targetX, targetY, 24);

        this.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: 320,
            onComplete: () => {
                gfx.destroy();
                if (onComplete) onComplete();
            }
        });
    }

    spawnProjectileOrb(startX, startY, endX, endY, color, onComplete) {
        const orb = this.add.circle(startX, startY, 18, color, 1);
        orb.setStrokeStyle(4, 0xffffff);
        orb.setDepth(20);

        this.tweens.add({
            targets: orb,
            x: endX,
            y: endY,
            scale: 1.35,
            duration: 280,
            ease: "Quad.easeIn",
            onComplete: () => {
                this.cameras.main.shake(140, 0.008);
                orb.destroy();
                if (onComplete) onComplete();
            }
        });
    }

    spawnLaserBeam(startX, startY, endX, endY, onComplete) {
        const gfx = this.add.graphics();
        gfx.setDepth(20);

        gfx.lineStyle(12, 0xff1744, 0.6);
        gfx.beginPath();
        gfx.moveTo(startX, startY);
        gfx.lineTo(endX, endY);
        gfx.strokePath();

        gfx.lineStyle(4, 0xffffff, 1);
        gfx.beginPath();
        gfx.moveTo(startX, startY);
        gfx.lineTo(endX, endY);
        gfx.strokePath();

        this.cameras.main.shake(150, 0.008);

        this.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: 260,
            onComplete: () => {
                gfx.destroy();
                if (onComplete) onComplete();
            }
        });
    }

    spawnSlashEffect(targetX, targetY, onComplete) {
        const gfx = this.add.graphics();
        gfx.setDepth(20);

        gfx.lineStyle(5, 0xffffff, 1);
        gfx.beginPath();
        gfx.moveTo(targetX - 35, targetY - 35);
        gfx.lineTo(targetX + 35, targetY + 35);
        gfx.moveTo(targetX + 35, targetY - 35);
        gfx.lineTo(targetX - 35, targetY + 35);
        gfx.strokePath();

        this.tweens.add({
            targets: gfx,
            alpha: 0,
            scale: 1.2,
            duration: 220,
            onComplete: () => {
                gfx.destroy();
                if (onComplete) onComplete();
            }
        });
    }

    spawnShockwave(targetX, targetY, onComplete) {
        const ring = this.add.circle(targetX, targetY, 15);
        ring.setStrokeStyle(6, 0xab47bc);
        ring.setDepth(20);

        this.cameras.main.shake(200, 0.01);

        this.tweens.add({
            targets: ring,
            scale: 4.5,
            alpha: 0,
            duration: 340,
            onComplete: () => {
                ring.destroy();
                if (onComplete) onComplete();
            }
        });
    }

    playHealEffect() {
        if (!this.playerSprite) return;
        const baseX = this.playerSprite.x;
        const baseY = this.playerSprite.y;

        for (let i = 0; i < 6; i++) {
            const offsetX = Phaser.Math.Between(-55, 55);
            const offsetY = Phaser.Math.Between(-30, 40);
            const plus = this.add.text(baseX + offsetX, baseY + offsetY, "+", {
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "18px",
                color: "#4caf50",
                stroke: "#ffffff",
                strokeThickness: 3
            }).setDepth(20);

            this.tweens.add({
                targets: plus,
                y: plus.y - 45,
                alpha: 0,
                duration: 650,
                delay: i * 60,
                onComplete: () => plus.destroy()
            });
        }
    }

    playHitFlash(target) {
        const sprite = target === "player" ? this.playerSprite : this.opponentSprite;
        if (!sprite) return;

        this.tweens.add({
            targets: sprite,
            alpha: 0.15,
            duration: 75,
            yoyo: true,
            repeat: 3
        });
    }

    playFaint(target) {
        const sprite = target === "player" ? this.playerSprite : this.opponentSprite;
        if (!sprite) return;

        this.tweens.add({
            targets: sprite,
            y: sprite.y + 40,
            alpha: 0,
            duration: 450,
            ease: "Power2"
        });
    }

    resetSprites() {
        this.tweens.resumeAll();
        if (this.opponentSprite) {
            this.opponentSprite.setPosition(660, 255);
            this.opponentSprite.setAlpha(1);
        }
        if (this.playerSprite) {
            this.playerSprite.setPosition(280, 330);
            this.playerSprite.setAlpha(1);
        }
    }
}

window.initPhaserArena = function () {
    if (window.phaserArenaInstance) return;
    window.phaserArenaInstance = new Phaser.Game({
        type: Phaser.AUTO,
        width: 940,
        height: 470,
        parent: "phaser-arena",
        pixelArt: true,
        transparent: true,
        scene: [BattleArenaScene]
    });
};

// ==========================================
// 5. TURN-BASED BATTLE ENGINE + ON-CHAIN SETTLEMENT
// ==========================================
class BattleManager {
    constructor(player, opponent, uiCallbacks) {
        this.player = player;
        this.opponent = opponent;
        this.ui = uiCallbacks;
        this.isPlayerTurn = true;
        this.isGameOver = false;
        this.isPaused = false;
        this.potions = 2;
        this.turnsTaken = 0;
        this.pendingTimer = null;
    }

    getArenaScene() {
        return window.phaserArenaInstance?.scene?.getScene("BattleArenaScene");
    }

    setPaused(paused) {
        this.isPaused = paused;
        const scene = this.getArenaScene();
        if (scene) scene.setPaused(paused);
    }

    destroy() {
        this.isGameOver = true;
        if (this.pendingTimer) clearTimeout(this.pendingTimer);
    }

    calculateDamage(attack) {
        if (Math.random() > attack.accuracy) return 0;
        return (
            Math.floor(Math.random() * (attack.maxDamage - attack.minDamage + 1)) +
            attack.minDamage
        );
    }

    scheduleStep(callback, delay) {
        this.pendingTimer = setTimeout(() => {
            if (this.isGameOver) return;
            if (this.isPaused) {
                this.scheduleStep(callback, 200);
                return;
            }
            callback();
        }, delay);
    }

    executePlayerAttack(attackIndex) {
        if (!this.isPlayerTurn || this.isGameOver || this.isPaused) return;

        this.isPlayerTurn = false;
        this.turnsTaken++;
        this.ui.toggleControls(false);
        this.ui.setTurnIndicator("BATTLE IN PROGRESS...");

        const attack = this.player.attacks[attackIndex];
        const damage = this.calculateDamage(attack);
        const scene = this.getArenaScene();

        this.ui.setDialogue(`${this.player.name} used ${attack.name}!`);

        const applyDamage = async () => {
            if (this.isGameOver) return;
            if (damage === 0) {
                this.ui.setDialogue(`${this.player.name}'s attack missed!`);
            } else {
                this.opponent.hp = Math.max(0, this.opponent.hp - damage);
                this.ui.updateHealth();
                this.ui.setDialogue(`Hit! ${this.opponent.name} took ${damage} damage!`);
            }

            if (await this.checkGameOver()) return;
            this.scheduleStep(() => this.executeComputerTurn(), 1400);
        };

        if (scene && damage > 0) {
            scene.playAttack("player", attack.effectType, applyDamage);
        } else {
            this.scheduleStep(applyDamage, 400);
        }
    }

    usePotion() {
        if (!this.isPlayerTurn || this.isGameOver || this.isPaused) return;

        if (this.potions <= 0) {
            this.ui.setDialogue("Your bag is empty! No potions left.");
            return;
        }

        if (this.player.hp >= this.player.maxHp) {
            this.ui.setDialogue(`${this.player.name} is already at full HP!`);
            return;
        }

        this.isPlayerTurn = false;
        this.turnsTaken++;
        this.ui.toggleControls(false);
        this.ui.setTurnIndicator("USING ITEM...");

        this.potions--;
        const healAmount = 30;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
        this.ui.updateHealth();
        this.ui.updateBagLabel(this.potions);
        this.ui.setDialogue(`Used a Potion! Restored ${healAmount} HP.`);

        const scene = this.getArenaScene();
        if (scene) scene.playHealEffect();

        this.scheduleStep(() => this.executeComputerTurn(), 1400);
    }

    executeComputerTurn() {
        if (this.isGameOver) return;

        this.ui.setTurnIndicator(`${this.opponent.name.toUpperCase()}'S TURN`);
        const attack = ComputerAI.chooseAttack(this.opponent, this.player);
        const damage = this.calculateDamage(attack);
        const scene = this.getArenaScene();

        this.ui.setDialogue(`Wild ${this.opponent.name} used ${attack.name}!`);

        const applyDamage = async () => {
            if (this.isGameOver) return;
            if (damage === 0) {
                this.ui.setDialogue(`Wild ${this.opponent.name}'s attack missed!`);
            } else {
                this.player.hp = Math.max(0, this.player.hp - damage);
                this.ui.updateHealth();
                this.ui.setDialogue(`${this.player.name} took ${damage} damage!`);
            }

            if (await this.checkGameOver()) return;

            this.scheduleStep(() => {
                this.isPlayerTurn = true;
                this.ui.toggleControls(true);
                this.ui.setTurnIndicator("YOUR TURN");
                this.ui.setDialogue(`What will ${this.player.name} do?`);
            }, 1300);
        };

        if (scene && damage > 0) {
            scene.playAttack("opponent", attack.effectType, applyDamage);
        } else {
            this.scheduleStep(applyDamage, 400);
        }
    }

    async forfeitBattle() {
        if (!this.isPlayerTurn || this.isGameOver || this.isPaused) return;
        this.isGameOver = true;
        this.ui.toggleControls(false);
        this.ui.setTurnIndicator("SETTLING ON-CHAIN...");
        this.ui.setDialogue("You ran away! Confirm MetaMask to settle match...");

        await this.ui.onMatchFinished(false, "You fled! 50 POKE sent to House Wallet.");
    }

    async checkGameOver() {
        const scene = this.getArenaScene();

        if (this.opponent.hp <= 0) {
            this.isGameOver = true;
            this.ui.setTurnIndicator("VICTORY!");
            if (scene) scene.playFaint("opponent");
            this.ui.setDialogue(`${this.opponent.name} fainted! YOU WIN 100 POKE! Confirm in MetaMask...`);

            await this.ui.onMatchFinished(true, `VICTORY! You defeated ${this.opponent.name} and won 100 POKE!`);
            return true;
        }

        if (this.player.hp <= 0) {
            this.isGameOver = true;
            this.ui.setTurnIndicator("DEFEAT!");
            if (scene) scene.playFaint("player");
            this.ui.setDialogue(`${this.player.name} fainted! Sending 50 POKE to House Wallet...`);

            await this.ui.onMatchFinished(false, `DEFEAT! ${this.player.name} fainted. 50 POKE sent to House.`);
            return true;
        }

        return false;
    }
}

// ==========================================
// 6. MAIN CONTROLLER (WEB3 + UI NAVIGATION)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Web3 Elements
    const connectBtn = document.getElementById("connectBtn");
    const claimBtn = document.getElementById("claimBtn");
    const lockStakeBtn = document.getElementById("lockStakeBtn");
    const sendPokeBtn = document.getElementById("sendPokeBtn");
    const netBadge = document.getElementById("netBadge");
    const recordText = document.getElementById("recordText");
    const playerPokeText = document.getElementById("playerPokeText");
    const housePokeText = document.getElementById("housePokeText");
    const lobbyStatusText = document.getElementById("lobbyStatusText");

    // Screens & Overlays
    const homeScreen = document.getElementById("home-screen");
    const gameScreen = document.getElementById("game-screen");
    const pauseOverlay = document.getElementById("pause-overlay");

    // Navigation & Utility Buttons
    const pauseBtn = document.getElementById("pause-btn");
    const quickRestartBtn = document.getElementById("quick-restart-btn");
    const resumeBtn = document.getElementById("resume-btn");
    const pauseRestartBtn = document.getElementById("pause-restart-btn");
    const pauseHomeBtn = document.getElementById("pause-home-btn");
    const restartBtn = document.getElementById("restart-btn");
    const resultHomeBtn = document.getElementById("result-home-btn");

    // Battle UI Elements
    const turnIndicator = document.getElementById("turn-indicator");
    const dialogueBox = document.getElementById("dialogue");
    const menuButtons = document.querySelector(".menu-buttons");
    const attackMenu = document.getElementById("attack-menu");
    const resultMenu = document.getElementById("result-menu");
    const resultMessage = document.getElementById("result-message");

    // Action Buttons
    const fightBtn = document.getElementById("fight-btn");
    const bagBtn = document.getElementById("bag-btn");
    const creaturesBtn = document.getElementById("creatures-btn");
    const runBtn = document.getElementById("run-btn");
    const backBtn = document.getElementById("back-btn");
    const attackBtns = document.querySelectorAll(".attack-btn");

    // Health & Name UI
    const playerHpText = document.getElementById("player-hp");
    const opponentHpText = document.getElementById("opponent-hp");
    const playerHealthBar = document.getElementById("player-health");
    const opponentHealthBar = document.getElementById("opponent-health");
    const playerNameTitle = document.getElementById("player-name");
    const opponentNameTitle = document.getElementById("opponent-name");

    let battle = null;

    // --- Web3: Connect MetaMask to Ganache ---
    async function connectWallet() {
        if (!window.ethereum) {
            lobbyStatusText.textContent = "MetaMask not detected! Please install or unlock MetaMask.";
            return;
        }

        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();

            netBadge.textContent = "GANACHE";
            netBadge.classList.add("online");
            connectBtn.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;

            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
            sendPokeBtn.disabled = false;

            await syncState();
        } catch (err) {
            lobbyStatusText.textContent = `Wallet Error: ${err.reason || err.message}`;
        }
    }

    // --- Web3: Sync Smart Contract State ---
    async function syncState() {
        if (!contract || !userAddress) return;

        const state = await contract.getGameState(userAddress);
        const playerCoins = Number(ethers.formatEther(state.playerPokeBalance)).toFixed(0);
        const houseCoins = Number(ethers.formatEther(state.housePokeBalance)).toFixed(0);

        playerPokeText.textContent = playerCoins;
        housePokeText.textContent = houseCoins;
        recordText.textContent = `SCORE: ${state.pWins}W - ${state.cWins}L`;

        claimBtn.disabled = state.claimedStarter;
        claimBtn.textContent = state.claimedStarter ? "CLAIMED" : "CLAIM 100 POKE";

        isMatchLocked = state.activeMatch;
        if (isMatchLocked) {
            lockStakeBtn.disabled = false;
            lockStakeBtn.textContent = "RESUME ACTIVE MATCH";
            lobbyStatusText.textContent = "50 POKE is already locked in escrow! Click to enter battle.";
        } else {
            lockStakeBtn.disabled = Number(playerCoins) < 50;
            lockStakeBtn.textContent = "LOCK 50 POKE TO FIGHT";
            lobbyStatusText.textContent =
                Number(playerCoins) < 50
                    ? "Click 'CLAIM 100 POKE' first to get starter coins!"
                    : "Click 'LOCK 50 POKE TO FIGHT' to stake 50 POKE and battle Plankton!";
        }
    }

    // --- Web3: Claim 100 Starter POKE ---
    async function handleClaim() {
        try {
            claimBtn.disabled = true;
            lobbyStatusText.textContent = "Minting 100 POKE starter coins... Confirm in MetaMask.";
            const tx = await contract.claimStarterCoins();
            await tx.wait();
            await syncState();
        } catch (err) {
            claimBtn.disabled = false;
            lobbyStatusText.textContent = `Claim error: ${err.reason || err.message}`;
        }
    }

    // --- Web3: Lock 50 POKE in Escrow & Launch Battle ---
    async function handleLockStakeAndStart() {
        try {
            lockStakeBtn.disabled = true;

            if (!isMatchLocked) {
                lobbyStatusText.textContent = "Locking 50 POKE coins in battle escrow... Confirm in MetaMask.";
                const tx = await contract.lockCoinsAndStart();
                await tx.wait();
                await syncState();
            }

            startNewBattle();
        } catch (err) {
            lockStakeBtn.disabled = false;
            lobbyStatusText.textContent = `Stake error: ${err.reason || err.message}`;
        }
    }

    // --- Web3: Settle Match On-Chain ---
    async function settleMatchOnChain(playerWon, bannerText) {
        try {
            if (contract) {
                const tx = await contract.settleBattle(playerWon);
                await tx.wait();
                await syncState();
            }
            showResultMenu(bannerText);
        } catch (err) {
            dialogueBox.textContent = `Settlement error: ${err.reason || err.message}`;
            showResultMenu(`Match ended (On-chain sync failed: ${err.reason || "Rejected"})`);
        }
    }

    // --- Web3: Transfer POKE Coins ---
    async function handleSendPoke() {
        const to = document.getElementById("toAddr").value.trim();
        const amt = document.getElementById("pokeAmt").value.trim();

        if (!ethers.isAddress(to) || !amt || Number(amt) <= 0) {
            lobbyStatusText.textContent = "Enter a valid 0x address and POKE amount.";
            return;
        }

        try {
            sendPokeBtn.disabled = true;
            lobbyStatusText.textContent = `Transferring ${amt} POKE... Confirm in MetaMask.`;
            const tx = await contract.transfer(to, ethers.parseEther(amt));
            await tx.wait();
            lobbyStatusText.textContent = `Successfully sent ${amt} POKE!`;
            document.getElementById("pokeAmt").value = "";
            await syncState();
        } catch (err) {
            lobbyStatusText.textContent = `Transfer error: ${err.reason || err.message}`;
        } finally {
            sendPokeBtn.disabled = false;
        }
    }

    // --- Battle UI Helpers ---
    function getHealthColor(percent) {
        if (percent > 50) return "#38a34a";
        if (percent > 20) return "#e6b800";
        return "#d93829";
    }

    function updateHealthUI() {
        const playerPercent = (battle.player.hp / battle.player.maxHp) * 100;
        const opponentPercent = (battle.opponent.hp / battle.opponent.maxHp) * 100;

        playerHpText.textContent = battle.player.hp;
        opponentHpText.textContent = battle.opponent.hp;

        playerHealthBar.style.width = `${playerPercent}%`;
        opponentHealthBar.style.width = `${opponentPercent}%`;

        playerHealthBar.style.backgroundColor = getHealthColor(playerPercent);
        opponentHealthBar.style.backgroundColor = getHealthColor(opponentPercent);
    }

    function showResultMenu(message) {
        pauseBtn.disabled = true;
        menuButtons.classList.add("hidden");
        attackMenu.classList.add("hidden");
        resultMessage.textContent = message;
        resultMenu.classList.remove("hidden");
    }

    function setPausedState(paused) {
        if (!battle || battle.isGameOver) return;
        battle.setPaused(paused);
        pauseBtn.textContent = paused ? "RESUME" : "PAUSE";
        if (paused) {
            pauseOverlay.classList.remove("hidden");
        } else {
            pauseOverlay.classList.add("hidden");
        }
    }

    async function goToHomeScreen() {
        if (battle) {
            battle.destroy();
            battle = null;
        }
        pauseOverlay.classList.add("hidden");
        gameScreen.classList.add("hidden");
        homeScreen.classList.remove("hidden");
        await syncState();
    }

    function startNewBattle() {
        if (battle) battle.destroy();

        homeScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        pauseOverlay.classList.add("hidden");
        pauseBtn.textContent = "PAUSE";
        pauseBtn.disabled = false;

        window.initPhaserArena();

        const player = createCreature("player");
        const opponent = createCreature("opponent");

        playerNameTitle.textContent = player.name;
        opponentNameTitle.textContent = opponent.name;

        const scene = window.phaserArenaInstance?.scene?.getScene("BattleArenaScene");
        if (scene) scene.resetSprites();

        resultMenu.classList.add("hidden");
        attackMenu.classList.add("hidden");
        menuButtons.classList.remove("hidden");
        bagBtn.textContent = "BAG (2)";
        turnIndicator.textContent = "YOUR TURN";

        battle = new BattleManager(player, opponent, {
            setDialogue: (text) => {
                dialogueBox.textContent = text;
            },
            setTurnIndicator: (text) => {
                turnIndicator.textContent = text;
            },
            updateHealth: updateHealthUI,
            updateBagLabel: (count) => {
                bagBtn.textContent = `BAG (${count})`;
            },
            toggleControls: (enabled) => {
                document.querySelectorAll(".battle-controls button").forEach(btn => {
                    if (btn.id !== "restart-btn" && btn.id !== "result-home-btn") {
                        btn.disabled = !enabled;
                    }
                });
            },
            onMatchFinished: settleMatchOnChain
        });

        document.querySelectorAll(".battle-controls button").forEach(btn => {
            btn.disabled = false;
        });

        attackBtns.forEach((btn, index) => {
            btn.textContent = player.attacks[index].name;
        });

        updateHealthUI();
        dialogueBox.textContent = `50 POKE locked! A wild ${opponent.name} appeared! What will you do?`;
    }

    // --- Event Listeners ---
    connectBtn.addEventListener("click", connectWallet);
    claimBtn.addEventListener("click", handleClaim);
    lockStakeBtn.addEventListener("click", handleLockStakeAndStart);
    sendPokeBtn.addEventListener("click", handleSendPoke);

    pauseBtn.addEventListener("click", () => setPausedState(!battle?.isPaused));
    resumeBtn.addEventListener("click", () => setPausedState(false));

    quickRestartBtn.addEventListener("click", startNewBattle);
    pauseRestartBtn.addEventListener("click", startNewBattle);

    restartBtn.addEventListener("click", async () => {
        restartBtn.disabled = true;
        resultMessage.textContent = "Locking 50 POKE for next match... Confirm in MetaMask.";
        try {
            if (contract && !isMatchLocked) {
                const tx = await contract.lockCoinsAndStart();
                await tx.wait();
                await syncState();
            }
            startNewBattle();
        } catch (err) {
            resultMessage.textContent = `Stake failed: ${err.reason || err.message}`;
        } finally {
            restartBtn.disabled = false;
        }
    });

    pauseHomeBtn.addEventListener("click", goToHomeScreen);
    resultHomeBtn.addEventListener("click", goToHomeScreen);

    fightBtn.addEventListener("click", () => {
        if (battle?.isPaused) return;
        menuButtons.classList.add("hidden");
        attackMenu.classList.remove("hidden");
    });

    backBtn.addEventListener("click", () => {
        attackMenu.classList.add("hidden");
        menuButtons.classList.remove("hidden");
    });

    attackBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (battle?.isPaused) return;
            const attackIndex = parseInt(btn.getAttribute("data-attack"), 10);
            attackMenu.classList.add("hidden");
            menuButtons.classList.remove("hidden");
            battle.executePlayerAttack(attackIndex);
        });
    });

    bagBtn.addEventListener("click", () => battle?.usePotion());

    creaturesBtn.addEventListener("click", () => {
        if (battle?.isPaused) return;
        dialogueBox.textContent = `${battle.player.name} is already in battle!`;
    });

    runBtn.addEventListener("click", () => battle?.forfeitBattle());

    if (window.ethereum) {
        window.ethereum.on("accountsChanged", () => connectWallet());
    }
});