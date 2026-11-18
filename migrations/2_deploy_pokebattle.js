const PokeBattleToken = artifacts.require("PokeBattleToken");

module.exports = function (deployer) {
  deployer.deploy(PokeBattleToken);
};