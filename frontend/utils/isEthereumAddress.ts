/**
 * Taken and adapted from https://github.com/ethers-io/ethers.js/blob/v6.11.1/src.ts/address/address.ts
 *
 * Original license:
 * Copyright (c) 2016-2023 Richard Moore
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Checks whether the given address is a valid Ethereum address.
 *
 * `isEthereumAddress("0x8ba1f109551bD432803012645Ac136ddd64DBA72")` -> `true`
 * `isEthereumAddress("8ba1f109551bD432803012645Ac136ddd64DBA72")` -> `true`
 * `isEthereumAddress("8ba1f109551bD432803012645Ac136ddd64DBa72")` -> `false`, invalid checksum
 * `isEthereumAddress("ethereum address")` -> `false`, not an address
 */
import { keccak_256 } from "@noble/hashes/sha3";

export function isEthereumAddress(address: string) {
  if (address.startsWith("0x")) address = address.substring(2);

  if (!/^[0-9a-fA-F]{40}$/u.exec(address)) return false;
  if (!/([A-F].*[a-f])|([a-f].*[A-F])/u.exec(address)) return true;

  const chars = address.toLowerCase().split("");

  const hashed = keccak_256(new Uint8Array(chars.map((char) => char.charCodeAt(0))));

  for (let i = 0; i < 40; i += 2) {
    const value = hashed[i >> 1] ?? 0;
    if (value >> 4 >= 8) chars[i] = (chars[i] ?? "").toUpperCase();
    if ((value & 0x0f) >= 8) chars[i + 1] = (chars[i + 1] ?? "").toUpperCase();
  }

  return chars.join("") === address;
}
