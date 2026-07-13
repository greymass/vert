import fs from "fs";
import { Name } from "@wharfkit/antelope";
import { Blockchain } from "../blockchain";
import { expectToThrow } from "../../helpers";

const blockchain = new Blockchain()

const wasm = fs.readFileSync('contracts/ram.restrict/ram.restrict.wasm')
const abi = fs.readFileSync('contracts/ram.restrict/ram.restrict.abi', 'utf8')

const ramtest = blockchain.createAccount({
    name: Name.from('ramtest'),
    wasm,
    abi,
});
const ramnotified = blockchain.createAccount({
    name: Name.from('ramnotified'),
    wasm,
    abi,
});
const rampriv = blockchain.createAccount({
    name: Name.from('rampriv'),
    wasm,
    abi,
    privileged: true,
});
blockchain.createAccounts('alice', 'bob')

describe('ram restrictions', () => {
    describe('emplace', () => {
        it('allows a new row billed to an authorizer', async () => {
            await ramtest.actions.store(['alice', 1, 8]).send('alice@active');
        });
        it('allows a new row billed to the receiver contract', async () => {
            await ramtest.actions.store(['ramtest', 2, 8]).send('alice@active');
        });
        it('rejects a new row billed to a non-authorizer', async () => {
            await expectToThrow(
                ramtest.actions.store(['bob', 3, 8]).send('alice@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: bob (net +265 bytes; last increase: +128 bytes, table rows, scope ramtest, row 3)'
            );
        });
        it('allows a new row billed to one of multiple authorizers', async () => {
            await ramtest.actions.store(['bob', 4, 8]).send([
                { actor: 'alice', permission: 'active' },
                { actor: 'bob', permission: 'active' },
            ]);
        });
    });

    describe('modify', () => {
        it('rejects growing a row billed to a non-authorizer', async () => {
            await expectToThrow(
                ramtest.actions.modify(['alice', 1, 80]).send('bob@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: alice (net +72 bytes; last increase: +72 bytes, table rows, scope ramtest, row 1)'
            );
        });
        it('allows a same-size modification of a row billed to a non-authorizer', async () => {
            await ramtest.actions.modify(['alice', 1, 8]).send('bob@active');
        });
        it('allows shrinking a row billed to a non-authorizer', async () => {
            await ramtest.actions.modify(['alice', 1, 4]).send('bob@active');
        });
        it('allows growing a row billed to the contract itself', async () => {
            await ramtest.actions.modify(['ramtest', 2, 80]).send('bob@active');
        });
        it('allows grow-then-shrink netting to zero for a non-authorizer', async () => {
            await ramtest.actions.store(['alice', 5, 8]).send('alice@active');
            await ramtest.actions.growshrink([5, 100, 8]).send('bob@active');
        });
    });

    describe('payer change', () => {
        it('rejects re-billing a row to a payer who did not authorize', async () => {
            await expectToThrow(
                ramtest.actions.modify(['bob', 1, 4]).send('alice@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: bob (net +133 bytes; last increase: +133 bytes, table rows, scope ramtest, row 1)'
            );
        });
        it('allows re-billing a row to a payer who authorized', async () => {
            await ramtest.actions.modify(['bob', 1, 4]).send('bob@active');
        });
    });

    describe('erase', () => {
        it('allows erasing a row billed to a non-authorizer', async () => {
            await ramtest.actions.erase([1]).send('alice@active');
        });
    });

    describe('notifications', () => {
        it('rejects billing any non-receiver account within a notify context', async () => {
            await expectToThrow(
                ramtest.actions.notify(['ramnotified', 'alice', 6, 8]).send('alice@active'),
                'unprivileged contract cannot increase RAM usage of another account within a notify context: alice (net +265 bytes; last increase: +128 bytes, table rows, scope ramnotified, row 6)'
            );
        });
        it('allows billing the notified receiver within a notify context', async () => {
            await ramtest.actions.notify(['ramnotified', 'ramnotified', 7, 8]).send('alice@active');
        });
    });

    describe('privileged contracts', () => {
        it('allows a privileged contract to bill any account', async () => {
            await rampriv.actions.store(['alice', 8, 8]).send('bob@active');
        });
    });
});
