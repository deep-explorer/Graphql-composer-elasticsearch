/* @flow */

import { InputTypeComposer } from 'graphql-compose';
import type { FieldsMapByElasticType } from '../mappingConverter';
import { getQueryITC } from './Query/Query';
import { getAggBlockITC } from './Aggs/AggBlock';
import prepareArgAggs from './Aggs/converter';
import { getTypeName, getOrSetType, desc } from '../utils';

export type SearchOptsT = {
  prefix?: string,
  postfix?: string,
  fieldMap?: FieldsMapByElasticType,
};

export function getSearchBodyITC(opts: SearchOptsT = {}): InputTypeComposer {
  const name = getTypeName('SearchBody', opts);
  const description = desc(
    `
    [Request Body Search](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-body.html),
  `
  );

  return getOrSetType(name, () =>
    // $FlowFixMe
    InputTypeComposer.create({
      name,
      description,
      fields: {
        query: () => getQueryITC(opts),
        aggs: () => [getAggBlockITC(opts)],
        size: 'Int',
        from: 'Int',
        sort: 'JSON',
        _source: 'JSON',
        script_fields: 'JSON',
        post_filter: () => getQueryITC(opts),
        highlight: 'JSON',
        search_after: 'JSON',

        explain: 'Boolean',
        version: 'Boolean',
        indices_boost: 'JSON',
        min_score: 'Float',

        search_type: 'String',
        rescore: 'JSON',
        docvalue_fields: '[String]',
        stored_fields: '[String]',
      },
    }));
}

export function prepareSearchArgs(
  args: { [argName: string]: any }
): { [argName: string]: any } {
  return prepareArgAggs(args);
}
