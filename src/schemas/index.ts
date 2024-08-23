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
    poolPrice: { type: 'number' }
  },
  required: ['poolPrice']
};