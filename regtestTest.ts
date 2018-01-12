import child_process = require('child_process');
import {
    keyring as KeyRing,
    script as Script,
    coin as Coin,
    amount as Amount,
    Amount as RawAmount,
    util,
} from 'bcoin';
import { genCommitTx, genLockTx, genUnlockTx } from './lib/txs';

const wif = 'cTV3FM3RfiFwmHfX6x43g4Xp8qeLbi15pNELuWF9sV3renVZ63nB';
const ring = KeyRing.fromSecret(wif);
const addr = ring.getAddress().toBase58('testnet');

const serviceWif = 'cRMzGH4towfYVCref4Qz9iyfKaRkvfgVvZ2qk4hExMR7FcpzzVg6';
const serviceRing = KeyRing.fromSecret(serviceWif);
const servicePubKey = serviceRing.getPublicKey();

child_process.exec(`bitcoin-cli -regtest listunspent 0 9999999 "[\\"${addr}\\"]"`, (err, stdout, stderr) => {
    if (err) {
        console.log(err);
        // node couldn't execute the command
        return;
    }

    // the *entire* stdout and stderr (buffered)
    // console.log(`stdout: ${stdout}`);
    // console.log(`stderr: ${stderr}`);
    const unspentData = JSON.parse(stdout);
    // console.log(unspentData);

    const coins = [];
    for (const utxo of unspentData) {
        const amt = Amount.fromBTC(utxo.amount).toSatoshis(true) as number;
        // console.log(typeof(amt));
        // console.log(amt as any instanceof Amount);
        const coinOpts = {
            version: 1,
            height: -1,
            value: amt,
            script: Script.fromRaw(utxo.scriptPubKey, 'hex'),
            hash: util.revHex(utxo.txid),
            index: utxo.vout,
        };
        coins.push(new Coin(coinOpts));
    }

    console.log(coins);

    const commitFee = 500000;
    const registerFee = 500000;
    const escrowFee = 1000000;
    const feeRate = 11000;

    const name = 'colin';
    const locktime = 65535;

    const commitTX = genCommitTx(
        coins, name, locktime, commitFee, registerFee, escrowFee, feeRate, ring, servicePubKey,
    );

    console.log('Commit');
    console.log(commitTX.toRaw().toString('hex'));

    const lockTX = genLockTx(commitTX, name, registerFee, escrowFee, feeRate, ring, servicePubKey, locktime);

    console.log('Lock');
    console.log(lockTX.toRaw().toString('hex'));

    const serviceUnlockTX = genUnlockTx(lockTX, commitTX, feeRate, true, serviceRing, ring.getPublicKey());
    console.log('Unlock');
    console.log(serviceUnlockTX.toRaw().toString('hex'));
});
