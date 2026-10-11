import fs from "fs";
import { expect } from "chai";
import { Name } from "@wharfkit/antelope";
import { nameToBigInt } from "../bn";
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
                'unprivileged contract cannot increase RAM usage of another account within a notify context: alice (net +373 bytes; last increase: +128 bytes, table rows, scope ramnotified, row 6)'
            );
        });
        it('allows billing the notified receiver within a notify context', async () => {
            await ramtest.actions.notify(['ramnotified', 'ramnotified', 7, 8]).send('alice@active');
        });
    });

    describe('table billing', () => {
        const findTable = (scope: string, table = 'rows') => blockchain.store.findTable(
            nameToBigInt(Name.from('ramtest')), nameToBigInt(Name.from(scope)), nameToBigInt(Name.from(table)));

        before(async () => {
            await ramtest.actions.storein(['keep', 'alice', 10, 8]).send('alice@active');
            await ramtest.actions.storein(['keep', 'alice', 11, 8]).send('alice@active');
            await ramtest.actions.storein(['shared', 'bob', 20, 8]).send('bob@active');
        });

        it('rejects a first row in an empty scope billed to a non-authorizer', async () => {
            await expectToThrow(
                ramtest.actions.move(['keep', 'fresh', 'alice', 10]).send('bob@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: alice (net +108 bytes; last increase: +128 bytes, table rows, scope fresh, row 10)'
            );
            expect(findTable('fresh')).to.be.undefined;
            expect(findTable('keep').count).to.equal(4);
        });
        it('allows the same row into a scope that already exists', async () => {
            await ramtest.actions.move(['keep', 'shared', 'alice', 10]).send('bob@active');
        });
        it('refunds the creator of a table that empties', async () => {
            await ramtest.actions.move(['keep', 'fresh', 'alice', 11]).send('bob@active');
            expect(findTable('keep')).to.be.undefined;
            expect(findTable('fresh').count).to.equal(2);
        });
        it('refunds the creator when another account owns the last row', async () => {
            await ramtest.actions.erasein(['shared', 20]).send('alice@active');
            await expectToThrow(
                ramtest.actions.move(['shared', 'other', 'bob', 10]).send('alice@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: bob (net +265 bytes; last increase: +128 bytes, table rows, scope other, row 10)'
            );
            await expectToThrow(
                ramtest.actions.move(['shared', 'other', 'alice', 10]).send('bob@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: alice (net +108 bytes; last increase: +128 bytes, table rows, scope other, row 10)'
            );
        });
        it('bills one table for a table with one secondary index', async () => {
            await expectToThrow(
                ramtest.actions.storein(['single', 'alice', 30, 8]).send('bob@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: alice (net +373 bytes; last increase: +128 bytes, table rows, scope single, row 30)'
            );
        });
        it('bills two tables for a table with two secondary indexes', async () => {
            await expectToThrow(
                ramtest.actions.storepair(['double', 'alice', 31, 8]).send('bob@active'),
                'unprivileged contract cannot increase RAM usage of another account that has not authorized the action: alice (net +617 bytes; last increase: +128 bytes, table pairs.......1, scope double, row 31)'
            );
        });
    });

    describe('privileged contracts', () => {
        it('allows a privileged contract to bill any account', async () => {
            await rampriv.actions.store(['alice', 8, 8]).send('bob@active');
        });
    });
});
