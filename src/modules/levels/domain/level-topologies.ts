/** The variants that are played by levels (`levelGameId` of the contract). */
export type LevelGameId = 'hexa-fit' | 'hexa-sort';

/** The cell shapes a player can choose (RN-TOP-30). */
export type Topology = 'hex' | 'square' | 'tri' | 'cube';

/** What a level declares: a topology, or `any` for a Hexa Sort level without initial stacks (RN-COM-75). */
export type LevelTopology = Topology | 'any';

/**
 * The topologies that are delivered when the app asks for `topology`. A Hexa Sort level that declares `any` is
 * played with the shape the player chose, so it comes with every topology; Hexa Fit has no `any` (RN-COM-75).
 */
export function topologiesToDeliver(
  gameId: LevelGameId,
  topology: Topology,
): readonly LevelTopology[] {
  return gameId === 'hexa-sort' ? [topology, 'any'] : [topology];
}
