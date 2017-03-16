/* @flow */

import { InputTypeComposer } from 'graphql-compose';
import { getTypeName, getOrSetType, desc } from '../../../utils';
import { getCommonsScriptITC } from '../../Commons/Script';

export function getMinITC(opts: mixed = {}): InputTypeComposer {
  const name = getTypeName('AggsMin', opts);
  const description = desc(
    `
    A single-value metrics aggregation that keeps track and returns the minimum
    value among the numeric values extracted from the aggregated documents.
    These values can be extracted either from specific numeric fields
    in the documents, or be generated by a provided script.
    [Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-min-aggregation.html)
  `
  );

  return getOrSetType(name, () =>
    // $FlowFixMe
    InputTypeComposer.create({
      name,
      description,
      fields: {
        field: 'String',
        missing: 'Float',
        script: () => getCommonsScriptITC(opts),
      },
    }));
}
