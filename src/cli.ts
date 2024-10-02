#!/usr/bin/env node

import { run } from '@oclif/core';
import { asciiLogo, startServer } from './index';

// Add a new command to start the server
if (process.argv[2] === 'start-server') {
  console.log(asciiLogo);
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} else {
  // Run the existing CLI commands
  run().then(require('@oclif/core/flush')).catch(require('@oclif/core/handle'));
}