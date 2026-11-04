// world/propsChunk.js for /beta: the game's, with its stalls moved to their own sets once the street furniture is up.
export * from '@orig/world/propsChunk.js';
import { buildGlobalProps as gameProps } from '@orig/world/propsChunk.js';
import { stallSets } from './props.js';

export function buildGlobalProps(W) { gameProps(W); stallSets(W); }
