import Buffer from "../buffer";

// Mirrors eosio::blockchain_parameters, packed in declaration order
const DEFAULTS: [number, bigint | number][] = [
  [8, 1048576n],  // max_block_net_usage
  [4, 1000],      // target_block_net_usage_pct
  [4, 524288],    // max_transaction_net_usage
  [4, 12],        // base_per_transaction_net_usage
  [4, 500],       // net_usage_leeway
  [4, 20],        // context_free_discount_net_usage_num
  [4, 100],       // context_free_discount_net_usage_den
  [4, 200000],    // max_block_cpu_usage
  [4, 1000],      // target_block_cpu_usage_pct
  [4, 150000],    // max_transaction_cpu_usage
  [4, 100],       // min_transaction_cpu_usage
  [4, 3600],      // max_transaction_lifetime
  [4, 600],       // deferred_trx_expiration_window
  [4, 3888000],   // max_transaction_delay
  [4, 524288],    // max_inline_action_size
  [2, 4],         // max_inline_action_depth
  [2, 6],         // max_authority_depth
];

export const blockchainParametersSize = DEFAULTS.reduce((total, [width]) => total + width, 0);

export function defaultBlockchainParameters(): Buffer {
  const buffer = Buffer.alloc(blockchainParametersSize);
  let offset = 0;
  for (const [width, value] of DEFAULTS) {
    if (width === 8) {
      buffer.writeBigUInt64LE(BigInt(value), offset);
    } else if (width === 4) {
      buffer.writeUInt32LE(Number(value), offset);
    } else {
      buffer[offset] = Number(value) & 0xff;
      buffer[offset + 1] = (Number(value) >> 8) & 0xff;
    }
    offset += width;
  }
  return buffer;
}
