/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js').Block;
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {BlockClass} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
    async _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            let height = await self.getChainHeight();
            // Check to make sure block is not genesis block:
            if (height > 0) {
                // If not set blocks previous hash to the
                // most previous added block:
                const previousBlock = await self.getBlockByHeight(height - 1)
                block.previousBlockHash = previousBlock.hash;
            } else {
                height = 0;
            }

            // Set block height, hash, and timestamp:
            block.height = height;
            block.time = Date.now();
            block.hash = SHA256(JSON.stringify(block)).toString();

            // Push block to chain and update chain height:
            self.chain.push(block);
            self.height = height + 1;

            // Resolve the block:
            resolve(block);
        }).catch(e => console.error(e));
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            const timestamp = new Date().getTime().toString().slice(0,-3);
            resolve(`${address}:${timestamp}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address
     * @param {*} message
     * @param {*} signature
     * @param {*} star
     */
    async submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // Get the timestamp from the message:
            const timestamp = parseInt(message.split(":")[1]);
            // Get the current time:
            const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
            // Get difference between dates:
            const timeDifference = currentTime - timestamp;
            // Verify that time difference is less than 5 minutes:
            if (timeDifference <= 5 * 60) {
                // Verify the address:
                if (bitcoinMessage.verify(message, address, signature)) {
                    // Create new block and add it to the chain:
                    let block = new BlockClass({ star, owner: address });
                    await self._addBlock(block);
                    resolve(block);
                } else {
                    reject("Message was not verified.");
                }
            } else {
                reject("Request has timed out.");
            }
        }).catch(e => console.error(e));
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash
     */
    async getBlockByHash(hash) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // Get chain height:
            let height = await self.getChainHeight();
            // Iterate through chain:
            for(let i = 0; i < height; i++) {
                // Get the block at the current height:
                const block = await self.getBlockByHeight(i);
                // Check if the blocks hash is the same as the passed in hash:
                if (block.hash === hash) {
                    resolve(block);
                    return;
                }
            }
            resolve(null);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address
     */
    async getStarsByWalletAddress(address) {
        let self = this;
        let stars = [];
        return new Promise(async (resolve, reject) => {
            // Get blockchain height:
            let height = await self.getChainHeight();
            // Iterate through chain:
            for (let i = 1; i < height; i++) {
                // Get the block:
                let block = await self.getBlockByHeight(i);
                // Get block body:
                let blockBody = await block.getBData();
                // Check if the address on the block is the same
                // as the parameter address:
                if (blockBody.owner === address) {
                    stars.push(block);
                }
            }
            resolve(stars);
        }).catch(e => console.log(e));
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    async validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            // Get chain height:
            let height = await self.getChainHeight();
            // Iterate through the chain:
            for(let i = 1; i < height; i++) {
                // Get the current block:
                const block = await self.getBlockByHeight(i);
                // Get previous block:
                const previousBlock = await self.getBlockByHash(block.previousBlockHash);
                // Validate the current block and make sure blockchain isn't broken:
                const isValid = await block.validate() && previousBlock;

                if (!isValid) {
                    // Push block to errorLog:
                    errorLog.push(block);
                }
            }
            resolve(errorLog);
        }).catch(e => console.error(e));
    }

}

module.exports.Blockchain = Blockchain;