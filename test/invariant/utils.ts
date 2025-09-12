import fc from 'fast-check';
import { ethers } from 'hardhat';

export const validEthereumAddress = () =>
  fc
    .string({
      minLength: 40,
      maxLength: 40,
      unit: fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
    })
    .map((hex) => '0x' + hex)
    .filter((addr) => ethers.isAddress(addr));


export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function deriveEthAddressFromKey(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}