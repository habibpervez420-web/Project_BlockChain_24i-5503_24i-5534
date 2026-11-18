// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PokeBattleToken (POKE ERC-20 Currency + 1vCPU Battle Escrow)
 * @notice MG3012 Blockchain Technology for Business - Final Project
 */
contract PokeBattleToken {
    // --- ERC-20 Metadata ---
    string public constant name = "PokeCoin";
    string public constant symbol = "POKE";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // --- Game & Escrow State ---
    address public immutable computerHouseWallet; // Your wallet (starts with 1,000 POKE)
    uint256 public constant HOUSE_INITIAL_COINS = 1000 * 10**18;
    uint256 public constant POOL_RESERVE_COINS = 500 * 10**18;
    uint256 public constant STARTER_FAUCET = 100 * 10**18;
    uint256 public constant BATTLE_STAKE = 50 * 10**18;    // 50 POKE locked to play
    uint256 public constant WINNER_PAYOUT = 100 * 10**18;  // 100 POKE paid if player wins

    mapping(address => bool) public hasClaimedStarter;
    mapping(address => bool) public hasLockedMatch;
    mapping(address => uint256) public playerWins;
    mapping(address => uint256) public computerWins;

    // --- Events ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event StarterClaimed(address indexed player, uint256 amount);
    event StakeLocked(address indexed player, uint256 amount);
    event BattleSettled(address indexed player, bool playerWon, address payoutRecipient, uint256 amount);

    constructor() {
        computerHouseWallet = msg.sender;
        // Mint 1,000 POKE to your Computer/House wallet
        _mint(msg.sender, HOUSE_INITIAL_COINS);
        // Mint 500 POKE into the contract escrow pool to pay player winners
        _mint(address(this), POOL_RESERVE_COINS);
    }

    // --- Standard ERC-20 Functions ---
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(_balances[msg.sender] >= amount, "Insufficient POKE balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Allowance exceeded");
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function _mint(address account, uint256 amount) internal {
        totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _internalTransfer(address from, address to, uint256 amount) internal {
        require(_balances[from] >= amount, "Escrow pool insufficient");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    // --- Core Game Functions ---

    /**
     * @notice 1. Faucet: Gives any new player wallet 100 POKE coins so they can play immediately
     */
    function claimStarterCoins() external {
        require(!hasClaimedStarter[msg.sender], "Starter 100 POKE already claimed!");
        hasClaimedStarter[msg.sender] = true;
        _mint(msg.sender, STARTER_FAUCET);
        emit StarterClaimed(msg.sender, STARTER_FAUCET);
    }

    /**
     * @notice 2. Locks 50 POKE coins from the player's wallet into the contract escrow
     */
    function lockCoinsAndStart() external {
        require(!hasLockedMatch[msg.sender], "Finish your active battle first!");
        require(_balances[msg.sender] >= BATTLE_STAKE, "Need at least 50 POKE coins!");

        // Lock 50 POKE inside contract escrow
        _internalTransfer(msg.sender, address(this), BATTLE_STAKE);
        hasLockedMatch[msg.sender] = true;

        emit StakeLocked(msg.sender, BATTLE_STAKE);
    }

    /**
     * @notice 3. Triggered automatically when HP hits 0:
     *         - Player Wins -> Contract sends 100 POKE to Player
     *         - Computer Wins -> Contract sends the locked 50 POKE to your computerHouseWallet
     */
    function settleBattle(bool playerWon) external {
        require(hasLockedMatch[msg.sender], "No active locked battle");
        hasLockedMatch[msg.sender] = false;

        if (playerWon) {
            playerWins[msg.sender] += 1;
            // Replenish pool if low so demo never stalls
            if (_balances[address(this)] < WINNER_PAYOUT) {
                _mint(address(this), POOL_RESERVE_COINS);
            }
            _internalTransfer(address(this), msg.sender, WINNER_PAYOUT);
            emit BattleSettled(msg.sender, true, msg.sender, WINNER_PAYOUT);
        } else {
            computerWins[msg.sender] += 1;
            // Send the player's locked 50 POKE directly to your Computer/House wallet!
            _internalTransfer(address(this), computerHouseWallet, BATTLE_STAKE);
            emit BattleSettled(msg.sender, false, computerHouseWallet, BATTLE_STAKE);
        }
    }

    /**
     * @notice 4. Single RPC call to load all HUD balances
     */
    function getGameState(address player)
        external
        view
        returns (
            uint256 playerPokeBalance,
            uint256 housePokeBalance,
            bool claimedStarter,
            bool activeMatch,
            uint256 pWins,
            uint256 cWins
        )
    {
        return (
            _balances[player],
            _balances[computerHouseWallet],
            hasClaimedStarter[player],
            hasLockedMatch[player],
            playerWins[player],
            computerWins[player]
        );
    }
}