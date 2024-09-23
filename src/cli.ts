#!/usr/bin/env node

import { run } from '@oclif/core';

run().then(require('@oclif/core/flush')).catch(require('@oclif/core/handle'));