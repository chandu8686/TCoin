const fs = require('fs');
const express = require("express");
const cors = require("cors");
const {Web3} = require("web3");
const bodyParser = require("body-parser");
const jsonBig = require("json-bigint");

require('dotenv').config();
const PRIVATEKEY = process.env["PRIVATEKEY"];
const ADDRESS = process.env["ADDRESS"];


const app = express();
app.use(cors());
app.use(express.json());

// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Custom JSON serializer for BigInt values
app.set("json spaces", 2);
app.set("json replacer", jsonBig.replacer);


// Replace 'your_polygontest_rpc_url' with the RPC URL of the Polygon testnet (Mumbai)
const rpcUrl = 'https://rpc-mumbai.maticvigil.com/';

// Replace 'your_contract_address' with the actual deployed contract address on the Polygon testnet
const contractAddress = '0xFD361c8A966daC9D55A337f46887Dc6c82D2D5C4';

// Read the contract ABI from the JSON file
const contractABI = JSON.parse(fs.readFileSync('./build/polygon-contracts/TCoin.json', 'utf8'));

// Create a web3 instance using the provided RPC URL
const web3 = new Web3(rpcUrl);

// Create a new web3 instance using the MetaMask provider
// const provider = new Web3.providers.WebsocketProvider(rpcUrl); // Replace with your Polygon RPC URL
// const web3 = new Web3(provider);

// Get the contract instance
const contract = new web3.eth.Contract(contractABI.abi, contractAddress);

// Function to call the 'getTotalTransactionDetailsCount' function from the contract
async function getTotalTransactionDetailsCount() {
  try {
    const count = await contract.methods.getTotalTransactionDetailsCount().call();
    console.log('Total Transaction Details Count:', count);
  } catch (error) {
    console.error('Error fetching total transaction details count:', error);
  }
}

app.get("/tokendetails", async (req, res) => {
  try {
    const name = await contract.methods.name().call();
    const symbol = await contract.methods.symbol().call();
    const supply = await contract.methods.totalSupply().call();
    const Coins = web3.utils.fromWei(supply.toString(), "ether");
    res.json({ name ,symbol , Coins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// Call the function to get the total transaction details count
//getTotalTransactionDetailsCount();

function convertBigIntToString(obj) {
  if (typeof obj === "object") {
    for (const key in obj) {
      if (typeof obj[key] === "bigint") {
        obj[key] = obj[key].toString();
      } else if (typeof obj[key] === "object") {
        convertBigIntToString(obj[key]);
      }
    }
  }
}

function getContractInstance() {
  return new web3.eth.Contract(contractABI.abi, contractAddress);
}

app.post('/transferWithDetails', async (req, res) => {
  try {
    const contract = getContractInstance();

    const { to, amount, message } = req.body;

    // Convert the amount to wei (assuming amount is in ether)
    const amountInWei = web3.utils.toWei(amount.toString(), 'ether');

    // Replace 'fromAddress' with the actual sender's address
    const fromAddress = ADDRESS ;

    // Replace 'privateKey' with the actual private key of the sender
    const privateKey = PRIVATEKEY ;

    const data = contract.methods.transferWithDetails(to, amountInWei, message).encodeABI();
    const gas = await contract.methods.transferWithDetails(to, amountInWei, message).estimateGas({ from: fromAddress });
    const gasPrice = await web3.eth.getGasPrice();
    const nonce = await web3.eth.getTransactionCount(fromAddress);

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        from: fromAddress,
        to: contractAddress,
        gas,
        gasPrice,
        data,
        nonce,
      },
      privateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    res.json({ transactionHash: receipt.transactionHash });
  } catch (error) {
    console.error('Error sending transaction:', error.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get("/tokentransactiondetails", async (req, res) => {
  try {
    const count = await contract.methods.getTotalTransactionDetailsCount().call();
    const value = parseInt(count);

    let transactions = [];
    for (let i = 0; i < value; i++) {
      const details = await contract.methods.getTransactionDetailsByIndex(i).call();
      transactions.push({
        txhash :details.txHash ,
        from: details.from,
        to: details.to,
        value: parseInt(details.value),
        message: details.message,
        timestamp: parseInt(details.timestamp)
      });
    }

    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});



// API endpoint to get the balance of an address
app.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await contract.methods.balanceOf(address).call();
    const formattedResult = web3.utils.fromWei(balance, "ether");
    res.json({ balance: formattedResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});


app.post("/mint", async (req, res) => {
  try {
    const { to, amount } = req.body;
    const accounts = await web3.eth.getAccounts();
    const tx = await contract.methods.mintTokens(to, amount).send({ from: accounts[0] });
    res.json({ txHash: tx.transactionHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});



// API endpoint to burn tokens (Only the contract owner can call this function)
app.post("/burn", async (req, res) => {
  try {
    const { amount } = req.body;
    const accounts = await web3.eth.getAccounts();
    const tx = await contract.methods.burnTokens(amount).send({ from: accounts[0] });
    res.json({ txHash: tx.transactionHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

async function getAllContractTransactions(contractAddress) {
  try {
    // Get the latest block number
    const latestBlockNumber = await web3.eth.getBlockNumber();

    // Specify the contract
    const contract = new web3.eth.Contract(contractABI.abi, contractAddress);

    // Get all the contract events starting from block 1
    const events = await contract.getPastEvents('allEvents', { fromBlock: 1, toBlock: latestBlockNumber });

    // Create an array to store transaction details
    const transactions = [];

    // Loop through each event and collect transaction details
    for (const event of events) {
      // Decode the event data using the ABI and handle BigInt values explicitly
      const eventData = web3.eth.abi.decodeLog(contractABI.abi, event.data, event.topics.slice(1), { bigint: true });

      // Convert BigInt values to strings for display
      const from = eventData.from.toString();
      const to = eventData.to.toString();
      const value = eventData.value.toString();

      // Add transaction details to the array
      transactions.push({
        transactionHash: event.transactionHash,
        eventName: event.event,
        from,
        to,
        value
      });
    }

    return transactions;
  } catch (error) {
    throw new Error('Error fetching contract transactions: ' + error.message);
  }
}

// API endpoint to fetch all contract transactions
app.get('/contract/transactions', async (req, res) => {
  try {
    const transactions = await getAllContractTransactions(contractAddress);
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

 // Function to convert BigInt values to numbers
 function convertBigIntToNumber(value) {
  if (typeof value === 'bigint') {
    return parseInt(value.toString());
  }
  return value;
}

async function getTransactionDetails(txHash) {
  try {
    // Get the receipt for the transaction
    const receipt = await web3.eth.getTransactionReceipt(txHash);

    if (receipt) {
      // Get the event logs from the receipt
      const logs = receipt.logs;

      // Loop through each log and find the Transfer event
      for (const log of logs) {
        if (log.topics[0] === web3.utils.sha3('Transfer(address,address,uint256)')) {
          // Decode the event data to get the values of from, to, and value
          const event = web3.eth.abi.decodeLog(
            [{ type: 'address', name: 'from', indexed: true }, { type: 'address', name: 'to', indexed: true }, { type: 'uint256', name: 'value' }],
            log.data,
            log.topics.slice(1)
          );

          // Prepare the transaction details object
          const transactionDetails = {
            transactionHash: txHash,
            from: event.from,
            to: event.to,
            value: convertBigIntToNumber(event.value), // Convert BigInt to number
          };

          // Return the transaction details
          return transactionDetails;
        }
      }
    } else {
      throw new Error('Receipt not found for the transaction hash:', txHash);
    }
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    throw error;
  }
}


// Define an endpoint to get transaction details
app.get('/getTransactionDetails/:txHash', async (req, res) => {
  try {
    const txHash = req.params.txHash;
    const details = await getTransactionDetails(txHash);
    res.json(details);
  } catch (error) {
    console.error('Error fetching transaction details:', error.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/gtd', async (req, res) => {
  try {
    //const txHash = req.params.txHash;
    //const details = await getTransactionDetails(txHash);
    const details = await contract.methods.getAllTransactionDetails().call();
    
    // Manually convert BigInt values to strings
    const serializedDetails = details.map(transaction => {
      return {
        address1: transaction[0],
        address2: transaction[1],
        amount: transaction[2].toString(), // Convert BigInt to string
        message: transaction[3],
        timestamp: transaction[4].toString(), // Convert BigInt to string
        hash: transaction[5],
      };
    });
    
    res.json(serializedDetails);
  } catch (error) {
    console.error('Error fetching transaction details:', error.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});


const port = 3000; // You can change this to any desired port number
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});



