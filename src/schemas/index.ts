export const PoolInfoRequestSchema = {
  type: 'object',
  properties: {
    poolAddress: { type: 'string' }
  },
  required: ['poolAddress']
};
  
export const PoolInfoResponseSchema = {
  type: 'object',
  properties: {
    poolPrice: { type: 'number' },
    baseTokenAddress: { type: 'string' },
    quoteTokenAddress: { type: 'string' },
  },
  required: ['poolPrice', 'baseTokenAddress', 'quoteTokenAddress']
};

// New schemas for Orca
export const PositionsRequestSchema = {
  type: 'object',
  properties: {
    ownerAddress: { type: 'string' }
  },
  required: ['ownerAddress']
};

export const PositionsResponseSchema = {
  type: 'object',
  properties: {
    positions: { type: 'array', items: { type: 'string' } }
  },
  required: ['positions']
};
