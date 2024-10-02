#!/usr/bin/env node

import { run } from '@oclif/core';
import { asciiLogo, startServer } from './index';

if (process.argv[2] === 'start') {
  console.log(asciiLogo);
  process.env.SERVER_RUNNING = 'true';
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} else {
  // console.log(asciiLogo);
  run()
    .then(require('@oclif/core/flush'))
    .catch(require('@oclif/core/handle'));
}