# 🎮 Monster Battle — Web3 GBA Arena (`PokeBattle_Truffle`)

![Solidity](https://img.shields.io/badge/Solidity-Smart%20Contract-363636?logo=solidity)
![Truffle](https://img.shields.io/badge/Truffle-Suite-5E464D?logo=truffle)
![Phaser 3](https://img.shields.io/badge/Phaser-3-blueviolet)
![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-2535A0)

A retro Game Boy Advance (GBA)-inspired turn-based monster battle web game powered by **Phaser 3** and integrated with an Ethereum / Truffle smart contract (`PokeBattleToken`) using **Ethers.js v6**. Players connect via **MetaMask** on a local **Ganache** blockchain to claim starter `POKE` tokens, stake coins in escrow, battle against an AI-controlled Plankton, and settle rewards on-chain.

---

## ✨ Features

### 🔗 Web3 Staking & On-Chain Settlement
* **Starter Faucet:** Claim `100 POKE` starter coins directly from the smart contract (`claimStarterCoins`).
* **Battle Escrow:** Lock `50 POKE` into escrow (`lockCoinsAndStart`) before entering the arena.
* **Automated Payouts:** Winning a battle triggers `settleBattle(true)` to reward `100 POKE`; losing or fleeing (`RUN`) triggers `settleBattle(false)`, sending the staked `50 POKE` to the House Wallet.
* **Peer-to-Peer Transfers:** Built-in `POKE` token transfer bar in the lobby (`transfer`).

### 🕹️ Retro GBA Battle Engine (Phaser 3)
* **Procedural Pixel-Art VFX:** Rendered via Phaser's Graphics API, including jagged Lightning Bolts, glowing Energy Orbs, Laser Beams, Diagonal Slashes, Shockwaves, and rising Healing `+` Sparkles.
* **Dynamic Animations:** Animated idle breathing, attack lunges, hit flashes, camera shakes, and faint animations.
* **Adaptive Opponent AI:** Weighted computer opponent AI (`ComputerAI`) that adjusts its move selection when either fighter drops to low HP.

### 🎛️ Full Match Controls
* **Home Lobby:** Displays live `ETH` and `POKE` wallet balances alongside on-chain win/loss record tracking.
* **Utility Bar:** Top bar featuring a **Pause / Resume** overlay and instant **Restart** functionality.

---

## 📁 Project Structure

```text
PokeBattle_Truffle/
├── assets/
│   ├── battle_ground.jpeg      # Forest battle arena background
│   ├── opponent.png            # Plankton sprite
│   └── player.png              # Pikachu sprite
├── build/
│   └── contracts/
│       └── PokeBattleToken.json
├── contracts/
│   └── PokeBattleToken.sol     # ERC-20 & battle escrow smart contract
├── frontend/
│   ├── index.html              # Game & Web3 lobby UI
│   ├── script.js               # Consolidated Phaser 3 + Ethers.js v6 logic
│   └── style.css               # Retro GBA pixel styling
├── migrations/
│   └── 2_deploy_pokebattle.js  # Truffle deployment script
├── truffle-config.js           # Truffle network configuration
└── README.md
```

---

## 🛠️ Prerequisites

Ensure the following tools are installed before running the project:

* **Node.js** (v16+ recommended)
* **Truffle** (`npm install -g truffle`)
* **Ganache** (Desktop GUI or `ganache-cli`)
* **MetaMask** browser extension
* **Local Web Server** (VS Code Live Server or XAMPP Apache)

---

## 🚀 Setup & Deployment Guide

### 1. Start Local Blockchain (Ganache)
1. Open **Ganache** and launch a workspace.
2. Note the **RPC Server URL** (typically `http://127.0.0.1:7545` or `http://127.0.0.1:8545`) and **Network / Chain ID** (`1337` or `5777`).

### 2. Compile & Deploy the Smart Contract
Open a terminal in the `PokeBattle_Truffle/` root directory and run:

```bash
truffle compile
truffle migrate --reset
```

Copy the deployed `PokeBattleToken` contract address from the terminal output and verify it matches **line 4** of `frontend/script.js`:

```javascript
const CONTRACT_ADDRESS = "0x7f5eB3C68C6c24979683877d66D746EF89F5627c";
```

### 3. Configure MetaMask
1. Open **MetaMask → Add a custom network** and enter:
   * **Network Name:** `Ganache Local`
   * **New RPC URL:** `http://127.0.0.1:7545` *(match your active Ganache port)*
   * **Chain ID:** `1337` *(or `5777`)*
   * **Currency Symbol:** `ETH`
2. In Ganache, click the **Key** icon next to a test account *(use a separate account from the contract deployer/House wallet)* and copy its **Private Key**.
3. In MetaMask, go to **Account Selector → Add account or hardware wallet → Import account** and paste the Private Key.

### 4. Launch the Frontend
* **Using VS Code Live Server:** Open the root `PokeBattle_Truffle/` folder in VS Code, right-click `frontend/index.html`, and select **Open with Live Server**.
* **Using XAMPP:** Start **Apache** and navigate to `http://localhost/PokeBattle_Truffle/frontend/index.html`.

> **Important:** Always serve from the root `PokeBattle_Truffle/` directory so relative asset paths (`../assets/...`) resolve properly.

---

## ⚔️ How to Play

1. Click **CONNECT WALLET** in the top-right bar and approve the MetaMask connection.
2. Click **CLAIM 100 POKE** to mint your starter balance.
3. Click **LOCK 50 POKE TO FIGHT** and confirm the escrow transaction in MetaMask.
4. Choose your action each turn inside the arena:

| Action | Options / Effect |
| :--- | :--- |
| **FIGHT** | **Quick Strike** (high accuracy), **Power Blast** (medium damage), or **Super Attack** (high-damage lightning strike) |
| **BAG (2)** | Use a **Potion** to restore `30 HP` |
| **RUN** | Forfeit the match *(settles on-chain as a loss)* |

5. When a monster faints, confirm the final MetaMask prompt to settle the match and update your on-chain `POKE` balance and win/loss record.

---

## 🔧 Troubleshooting

* **MetaMask shows `0 ETH` after importing:** Ensure MetaMask's active network filter is set to `Ganache Local` and that the wallet address still exists in your currently running Ganache session.
* **`Invalid nonce` or stuck transactions after restarting Ganache:** Open **MetaMask → Settings → Advanced → Clear activity tab data** to reset your local transaction history.
* **Missing images in the arena:** Verify that `battle_ground.jpeg`, `player.png`, and `opponent.png` are inside `PokeBattle_Truffle/assets/` and that the web server root is `PokeBattle_Truffle/`.