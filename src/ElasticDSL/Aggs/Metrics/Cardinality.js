/* @flow */

import { InputTypeComposer } from 'graphql-compose';
import { getTypeName, getOrSetType, desc } from '../../../utils';
import { getCommonsScriptITC } from '../../Commons/Script';

export function getCardinalityITC(opts: mixed = {}): InputTypeComposer {
  const name = getTypeName('AggsCardinality', opts);
  const description = desc(
    `
    A single-value metrics aggregation that calculates an approximate count
    of distinct values. Values can be extracted either from specific fields
    in the document or generated by a script.
    [Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-cardinality-aggregation.html)
  `
  );

  return getOrSetType(name, () =>
    // $FlowFixMe
    InputTypeComposer.create({
      name,
      description,
      fields: {
        field: 'String',
        precision_threshold: {
          type: 'Int',
          defaultValue: 3000,
          description: desc(
            `
            Allows to trade memory for accuracy, and defines a unique count
            below which counts are expected to be close to accurate.
          `
          ),
        },
        missing: 'String',
        script: () => getCommonsScriptITC(opts),
      },
    }));
}
