import { SFCUnitTestI } from '../../typechain-types';
import { BigNumberish, TransactionResponse } from 'ethers';
import { ethers } from 'hardhat';

class ValidatorMetrics {
  public readonly offlineTime: BigNumberish;
  public readonly offlineBlocks: BigNumberish;
  public readonly uptime: BigNumberish;
  public readonly originatedTxsFee: BigNumberish;

  constructor(offlineTime: BigNumberish, offlineBlocks: BigNumberish, uptime: BigNumberish, originatedTxsFee: BigNumberish) {
    this.offlineTime = offlineTime;
    this.offlineBlocks = offlineBlocks;
    this.uptime = uptime;
    this.originatedTxsFee = originatedTxsFee;
  }
}

class BlockchainNode {
  public readonly sfc: SFCUnitTestI;
  public validatorWeights: Map<bigint, bigint>;
  public nextValidatorWeights: Map<bigint, bigint>;

  constructor(sfc: SFCUnitTestI) {
    this.sfc = sfc;
    this.validatorWeights = new Map();
    this.nextValidatorWeights = new Map();
  }

  async handleTx(tx: TransactionResponse) {
    const iface = new ethers.Interface(['event UpdateValidatorWeight(uint256 indexed validatorID, uint256 weight)']);
    const logs = (await tx.wait())!.logs;
    for (const log of logs) {
      const parsedLog = iface.parseLog(log);
      if (parsedLog?.name === 'UpdateValidatorWeight') {
        const validatorID = parsedLog.args.validatorID;
        const weight = parsedLog.args.weight;
        if (weight == 0) {
          this.nextValidatorWeights.delete(validatorID);
        } else {
          this.nextValidatorWeights.set(validatorID, weight);
        }
      }
    }
  }

  async sealEpoch(duration: number, validatorMetrics?: Map<bigint, ValidatorMetrics>) {
    const validatorIds = Array.from(this.validatorWeights.keys());
    const nextValidatorIds = Array.from(this.nextValidatorWeights.keys());

    // unpack metrics
    const [offlineTimes, offlineBlocks, uptimes, originatedTxsFees] = validatorIds.reduce(
      (acc, id) => {
        let m = new ValidatorMetrics(0, 0, duration, 0n);
        if (validatorMetrics && validatorMetrics.has(id)) {
          m = validatorMetrics.get(id)!;
        }
        acc[0].push(m.offlineTime);
        acc[1].push(m.offlineBlocks);
        acc[2].push(m.uptime);
        acc[3].push(m.originatedTxsFee);
        return acc;
      },
      [[], [], [], []] as [BigNumberish[], BigNumberish[], BigNumberish[], BigNumberish[]],
    );

    await this.sfc.advanceTime(duration);
    await this.handleTx(await this.sfc.sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFees, 0));
    await this.handleTx(await this.sfc.sealEpochValidators(nextValidatorIds));

    // update validators
    this.validatorWeights = new Map(this.nextValidatorWeights);
  }
}

export { BlockchainNode, ValidatorMetrics };