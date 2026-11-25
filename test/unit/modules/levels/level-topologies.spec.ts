import { describe, expect, it } from '@jest/globals';
import { topologiesToDeliver } from '../../../../src/modules/levels/domain/level-topologies.js';

describe('RN-COM-75 · which topologies are delivered with the one that was asked', () => {
  it.each(['hex', 'square', 'tri', 'cube'] as const)(
    'should_deliver_the_topology_and_any_when_the_variant_is_hexa_sort (%s)',
    (topology) => {
      // Act
      const topologies = topologiesToDeliver('hexa-sort', topology);

      // Assert
      expect(topologies).toEqual([topology, 'any']);
    },
  );

  it.each(['hex', 'square', 'tri', 'cube'] as const)(
    'should_deliver_only_the_topology_when_the_variant_is_hexa_fit (%s)',
    (topology) => {
      // Act
      const topologies = topologiesToDeliver('hexa-fit', topology);

      // Assert
      expect(topologies).toEqual([topology]);
    },
  );
});
