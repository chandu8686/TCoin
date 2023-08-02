// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract TCoin is ERC20, Ownable {
    struct TransactionDetails {
        address from;
        address to;
        uint256 value;
        string message;
        uint256 timestamp;
    }

    // Array to store transaction details
    TransactionDetails[] public transactionDetails;
    mapping(bytes32 => uint256) private transactionHashToIndex;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _supply
    ) ERC20(name, symbol) {
        _mint(msg.sender, _supply * (10 ** decimals()));
    }

    // Function to mint new tokens (Only the owner can call this function)
    function mintTokens(address to, uint256 amount) public onlyOwner {
        _mint(to, amount * (10 ** decimals()));
    }

    // Function to burn tokens (Only the owner can call this function)
    function burnTokens(uint256 amount) public onlyOwner {
        _burn(msg.sender, amount * (10 ** decimals()));
    }

    // Function to transfer tokens and emit event with transaction details
    function transferWithDetails(address to, uint256 amount, string memory message) public {
        require(amount > 0, "Amount must be greater than zero");
        _transfer(msg.sender, to, amount);

        // Emit event with transaction details including the hash and timestamp
        bytes32 txHash = keccak256(abi.encodePacked(msg.sender, to, amount, message, block.timestamp));
        transactionHashToIndex[txHash] = transactionDetails.length;
        transactionDetails.push(TransactionDetails({
            from: msg.sender,
            to: to,
            value: amount,
            message: message,
            timestamp: block.timestamp
        }));
    }

    // Function to transfer ownership to a new address (Only the current owner can call this function)
    function transferOwnership(address newOwner) public override onlyOwner {
        _transferOwnership(newOwner);
    }

    function getTransactionDetailsByIndex(uint256 index) public view returns (
        address from,
        address to,
        uint256 value,
        string memory message,
        uint256 timestamp
    ) {
        require(index < transactionDetails.length, "Invalid index");
        TransactionDetails memory details = transactionDetails[index];
        return (
            details.from,
            details.to,
            details.value,
            details.message,
            details.timestamp
        );
    }


    // Function to retrieve transaction details by transaction hash
    function getTransactionDetailsByHash(bytes32 txHash) public view returns (
        address from,
        address to,
        uint256 value,
        string memory message,
        uint256 timestamp
    ) {
        uint256 index = transactionHashToIndex[txHash];
        require(index > 0 && index <= transactionDetails.length, "Invalid transaction hash");
        TransactionDetails memory details = transactionDetails[index - 1];
        return (
            details.from,
            details.to,
            details.value,
            details.message,
            details.timestamp
        );
    }

    // Function to retrieve the total number of transaction details stored in the array
    function getTotalTransactionDetailsCount() public view returns (uint256) {
        return transactionDetails.length;
    }

    // Function to retrieve all transaction details sequentially using a for loop
    function getAllTransactionDetails() public view returns (TransactionDetails[] memory) {
        uint256 totalCount = transactionDetails.length;
        TransactionDetails[] memory allDetails = new TransactionDetails[](totalCount);
        for (uint256 i = 0; i < totalCount; i++) {
            TransactionDetails memory details = transactionDetails[i];
            allDetails[i] = details;
        }
        return allDetails;
    }
}