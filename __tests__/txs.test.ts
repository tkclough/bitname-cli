jest.mock('randombytes');

import {
    coin as Coin,
    keyring as KeyRing,
    tx as TX,
} from 'bcoin';

import {
    genRedeemScript,
    genLockTx,
    genUnlockTx,
    genCommitTx,
} from '../lib/txs';
import {
    BadUserPublicKeyError,
    BadServicePublicKeyError,
    BadLockTransactionError,
} from '../lib/errors';

import * as fs from 'fs';
import * as path from 'path';

describe('tx generation', () => {
    it('generates a valid redeem script', () => {
        const serviceKey = Buffer.from('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc', 'hex');
        const userKey = Buffer.from('030589ee559348bd6a7325994f9c8eff12bd5d73cc683142bd0dd1a17abc99b0dc', 'hex');
        const script = genRedeemScript(userKey, serviceKey, 5);

        const expected = [
            'OP_IF',
            userKey.toString('hex'),
            'OP_CHECKSIG',
            'OP_ELSE',
            'OP_5',
            'OP_CHECKSEQUENCEVERIFY',
            'OP_DROP',
            serviceKey.toString('hex'),
            'OP_CHECKSIG',
            'OP_ENDIF',
        ];

        expect(script.toASM().split(' ')).toEqual(expected);
    });

    it('fails if user pubkey is invalid', () => {
        const serviceKey = Buffer.from('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc', 'hex');
        const userKey = Buffer.from('030000000000000000000000000000000000000000000000000000000000000000', 'hex');
        expect(() => {
            genRedeemScript(userKey, serviceKey, 5);
        }).toThrowError(BadUserPublicKeyError);
    });

    it('fails if service pubkey is invalid', () => {
        const serviceKey = Buffer.from('021111111111111111111111111111111111111111111111111111111111111111', 'hex');
        const userKey = Buffer.from('030589ee559348bd6a7325994f9c8eff12bd5d73cc683142bd0dd1a17abc99b0dc', 'hex');
        expect(() => {
            genRedeemScript(userKey, serviceKey, 1);
        }).toThrowError(BadServicePublicKeyError);
    });

    it('generates locking transactions', () => {
        const serviceKey = Buffer.from('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc', 'hex');

        const wif = 'cNJFgo1driFnPcBdBX8BrJrpxchBWXwXCvNH5SoSkdcF6JXXwHMm';
        const userRing = KeyRing.fromSecret(wif);

        const testCoin = {
            version: 1,
            height: -1,
            value: 100000000,
            hash: '453bbd02d4ef04be090ec79691e7f1749ac14141456c3394a513055fbc904bac',
        };

        const coins = [new Coin(testCoin)];

        // const tx = genLockTx(coins, 'google', 1, 1, 10, userRing, serviceKey, 1);

        const commitTX = genCommitTx(coins, 'google', 400, 150, 1000, 1, userRing, serviceKey);

        const tx = genLockTx(commitTX, 'google', 20, 20, 1, userRing, serviceKey, 400);

        expect(tx.hash('hex')).toBe('194b2c60b2bdee8e8b207da88cb48f6c75ad038068ba6998e3f50ad9d4ba6548');
    });

    it('generates user unlocking transaction', () => {
        const ctxDataPath = path.resolve(__dirname, 'data', 'valid_commit_tx.tx');
        const ctxData = fs.readFileSync(ctxDataPath, 'utf8').trim();
        const ctx = TX.fromRaw(ctxData, 'hex');

        const txDataPath = path.resolve(__dirname, 'data', 'valid_lock_tx.tx');
        const txData = fs.readFileSync(txDataPath, 'utf8').trim();

        const lockTX = TX.fromRaw(txData, 'hex');

        const wif = 'cUBuNVHb5HVpStD1XbHgafDH1QSRwcxUTJmueQLnyzwz1f5wmRZB';
        const userRing = KeyRing.fromSecret(wif);

        const tx = genUnlockTx(lockTX, ctx, 1, false, userRing, userRing.getPublicKey());

        expect(tx.hash('hex')).toBe('4427f7965d1f9697376dd35955aada422a67c1a7c83983a9403929a1c23459e3');
    });

    it('generates service unlocking transaction', () => {
        const ctxDataPath = path.resolve(__dirname, 'data', 'valid_commit_tx.tx');
        const ctxData = fs.readFileSync(ctxDataPath, 'utf8').trim();
        const ctx = TX.fromRaw(ctxData, 'hex');

        const txDataPath = path.resolve(__dirname, 'data', 'valid_lock_tx.tx');
        const txData = fs.readFileSync(txDataPath, 'utf8').trim();

        const lockTX = TX.fromRaw(txData, 'hex');

        const wif = 'cUBuNVHb5HVpStD1XbHgafDH1QSRwcxUTJmueQLnyzwz1f5wmRZB';
        const userRing = KeyRing.fromSecret(wif);

        const tx = genUnlockTx(lockTX, ctx, 1, true, userRing, userRing.getPublicKey());

        expect(tx.hash('hex')).toBe('ff2a93a6121400cba5059e2a3e18a99cb15e71a81e6f5018fea21a46dcacef45');
    });

    it('errors on unlocking with incorrect user pubkey', () => {
        const ctxDataPath = path.resolve(__dirname, 'data', 'valid_commit_tx.tx');
        const ctxData = fs.readFileSync(ctxDataPath, 'utf8').trim();
        const ctx = TX.fromRaw(ctxData, 'hex');

        const txDataPath = path.resolve(__dirname, 'data', 'valid_lock_tx.tx');
        const txData = fs.readFileSync(txDataPath, 'utf8').trim();

        const lockTX = TX.fromRaw(txData, 'hex');

        const wif = 'cUTaW9nuwpwfuZLkgY98qnfdbzokta2BKxnQ43HyGf7jLEwe1Big';
        const userRing = KeyRing.fromSecret(wif);

        const serviceKey = Buffer.from('030589ee559348bd6a7325994f9c8eff12bd5d73cc683142bd0dd1a17abc99b0dc', 'hex');

        expect(() => {
            genUnlockTx(lockTX, ctx, 1, false, userRing, serviceKey);
        }).toThrow(BadLockTransactionError);
    });

    it('errors on unlocking with incorrect service pubkey', () => {
        const ctxDataPath = path.resolve(__dirname, 'data', 'valid_commit_tx.tx');
        const ctxData = fs.readFileSync(ctxDataPath, 'utf8').trim();
        const ctx = TX.fromRaw(ctxData, 'hex');

        const txDataPath = path.resolve(__dirname, 'data', 'valid_lock_tx.tx');
        const txData = fs.readFileSync(txDataPath, 'utf8').trim();

        const lockTX = TX.fromRaw(txData, 'hex');

        const wif = 'cUTaW9nuwpwfuZLkgY98qnfdbzokta2BKxnQ43HyGf7jLEwe1Big';
        const serviceRing = KeyRing.fromSecret(wif);

        const userKey = Buffer.from('030589ee559348bd6a7325994f9c8eff12bd5d73cc683142bd0dd1a17abc99b0dc', 'hex');

        expect(() => {
            genUnlockTx(lockTX, ctx, 1, true, serviceRing, userKey);
        }).toThrow(BadLockTransactionError);
    });

    it('errors on unlocking with incorrect privkey', () => {
        const ctxDataPath = path.resolve(__dirname, 'data', 'valid_commit_tx.tx');
        const ctxData = fs.readFileSync(ctxDataPath, 'utf8').trim();
        const ctx = TX.fromRaw(ctxData, 'hex');

        const txDataPath = path.resolve(__dirname, 'data', 'valid_lock_tx.tx');
        const txData = fs.readFileSync(txDataPath, 'utf8').trim();

        const lockTX = TX.fromRaw(txData, 'hex');

        const wif = 'cNJFgo1driFnPcBdBX8BrJrpxchBWXwXCvNH5SoSkdcF6JXXwHMm';
        const userRing = KeyRing.fromSecret(wif);

        expect(() => {
            genUnlockTx(lockTX, ctx, 1, false, userRing, userRing.getPublicKey());
        }).toThrow(BadLockTransactionError);
    });
});
