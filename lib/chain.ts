import TXList from './TXList';
import { verifyLockTX } from './verify';
import { getLockTxTime, getLockTxName, getLockTxPubKey } from './txs';

interface IReadonlyNameInfo {
    readonly [name: string]: {
        readonly txid: string;
        readonly pubKey: Buffer;
        readonly expires: number;
    };
}

interface INameInfo {
    [name: string]: {
        txid: string;
        pubKey: Buffer;
        expires: number;
        invalid?: boolean;
    };
}

function extractInfo(txs: TXList, servicePubKey: Buffer, curHeight: number): IReadonlyNameInfo {
    const map: INameInfo = {};

    for (const txid of ([...txs.getTxids()].reverse() as ReadonlyArray<string>)) {
        const lockTx = txs.getTX(txid);

        // Is this a valid lock tx or another random kind?
        const valid = verifyLockTX(txs.getTX(txid), servicePubKey);
        if (!valid) {
            continue;
        }

        // Determine at what block this tx is spendable
        const height = txs.getHeight(txid);
        const period = getLockTxTime(lockTx);
        const expires = height + period;

        // Has the P2SH fee been spent yet, signalling a revocation?
        const revoked = txs.getOutputSpent(txid, 3);
        if (revoked) {
            continue;
        }

        const pubKey = getLockTxPubKey(lockTx);

        const data = {
            txid,
            pubKey,
            expires,
            invalid: false,
        };

        const name = getLockTxName(lockTx);

        if (map.hasOwnProperty(name) && txs.getHeight(map[name].txid) === height) {
            map[name].invalid = true;
            continue;
        }

        // If this name is already registered, don't replace it
        // Unless the name expired before this tx even existed, in which case include it
        if (!map.hasOwnProperty(name) || map[name].expires < height) {
            map[getLockTxName(lockTx)] = data;
        }
    }

    // Now return only the non-expired names
    const mapNonExp: INameInfo = {};
    for (const key in map) {
        if (map[key].expires >= curHeight && !map[key].invalid) {
            const {invalid, ...dataCpy} = map[key];
            mapNonExp[key] = dataCpy;
        }
    }

    return mapNonExp;
}

export {
    extractInfo,
};
