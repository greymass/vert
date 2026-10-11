# VeRT

**VM emulation RunTime for WASM-based blockchain contracts**

VeRT is a virtual machine emulator for Antelope blockchains.
It uses the built-in WebAssembly object in JavaScript, so can be executed on any modern browsers or runtime environments without additional dependencies.
It doesn't support the full specification of each blockchain state-machine, but can be used to run and test smart contracts before deployment.
The focus of VeRT is on the better compatibility than the performance, so it can be integrated with development pipelines.

- Run and test smart contracts
- Minimum dependencies (No native wrapper, docker or remote connection)
- Volatile key-value store with state rollback 

## Requirement

- WebAssembly binary with exported memory
- Nodejs v18 or higher (JavaScript runtime with WebAssembly BigInt support)

## Installation

```shell
npm install @greymass/vert
```

## Example usage

```typescript
import { Blockchain, nameToBigInt, expectToThrow } from "@greymass/vert";
import { assert } from "chai";

// instantiate the blockchain emulator
const blockchain = new Blockchain()

// Load a contract
const contract = blockchain.createContract(
    // The account to set the contract on
    'accountname', 
    // The path to the contract's wasm/abi
    // both wasm and abi files should be named yourcontract.wasm and yourcontract.abi
    'build/yourcontract' 
)


// You can clear the tables in the 
// contract before each test
beforeEach(async () => {
    blockchain.resetTables()
})

describe('Testing Suite', () => {
    it('should do X', async () => {
        // Create some accounts to work with
        const [alice, bob] = blockchain.createAccounts('alice', 'bob')
        
        // Will call a normal action. 
        // Returns an array of results if the action returns a value (array since inlines can also return values)
        const result = await contract.actions.youraction([param1, param2]).send();
        // You can also specify the authorization for the action
        // .send('alice@active')
        // default is the contract's account itself with 'active' permission
        
        // Will call a normal action, or a readonly action.
        // Returns a return value from the action, or null (no array)
        const readonlyResult = await contract.actions.youraction([param]).read();

        // You can get table data from the contract, though readonly actions 
        // are the preferred way to get data from external sources (web apps, apis, etc)
        const rows = contract.tables.yourtable(
            nameToBigInt('scope')
        ).getTableRow(
            nameToBigInt('primary.key')
        );

        // if you called 'print' in your contract, you can access the console output
        // after the action is executed
        console.log(contract.bc.console);

        // You can verify that an action throws an error
        expectToThrow(
            contract.actions.badaction([]).send(),
            'This will be "some error" from inside check(false, "some error")'
        )
    });
});
```



## RAM restrictions

VeRT bills RAM for every row a contract writes and enforces the RAM_RESTRICTIONS rules that nodeos applies in `apply_context::exec_one`. Each row costs the size of its serialized data plus a fixed per-row overhead, and each secondary index costs a fixed amount per entry, matching the `billable_size_v` constants in nodeos. The first row stored in a table scope also bills its payer 108 bytes for the table itself, and removing the last primary or secondary row refunds those bytes to the account that paid for the table, even when another account owned that row. Each secondary index after the first lives in its own table and bills its own 108 bytes. Deltas are tracked per payer and evaluated when the action returns, so each action, inline action, and notification is judged on its own.

An unprivileged contract that ends an action having increased another account's RAM usage throws, with two exceptions: the account authorized the action, or the contract is the account being billed. Inside a notification context, increasing another account's RAM always throws, because a notified contract has no authorization to spend on someone else's behalf. Privileged accounts skip the check entirely.

A test suite that passed on earlier versions of VeRT can fail here, and that failure is usually a real defect: the contract is billing RAM to an account that did not agree to pay for it, which nodeos would reject on chain. The error message names the account, the net byte increase, and the table, scope, and primary key of the row that last increased it. Fix the contract by billing the row to an account that authorized the action, most often the action's own signer.

## Test

```shell
npm run test
```

## Lineage

VeRT was written by Jeeyong "conr2d" Um and published as `vert` in 2021, then maintained by the EOS Network Foundation as `@eosnetwork/vert` and by the Vaulta Foundation as `@vaulta/vert`. Upstream development stopped after version 2.1.1 in August 2025 and the project has no maintainer.

Greymass continues the project as `@greymass/vert`, starting at version 3.0.0 to carry the upstream version history forward. The license remains MIT and the original copyright notices are intact. Releases before 3.0.0 live in the [upstream repository](https://github.com/VaultaFoundation/vert).

