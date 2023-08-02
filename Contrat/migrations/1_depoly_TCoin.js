const Token = artifacts.require('TCoin');

module.exports = function (deployer) {
    deployer.deploy(Token, 'Techouts', 'TOC', 21000000);
};