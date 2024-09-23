#!/usr/bin/env node

import { run } from '@oclif/core';
import { asciiLogo } from './index';

run().then(require('@oclif/core/flush')).catch(require('@oclif/core/handle'));