/* @flow */
/* eslint-disable no-param-reassign */

import {
  Resolver,
  TypeComposer,
  InputTypeComposer,
  isObject,
} from 'graphql-compose';
import type {
  ResolveParams,
  ProjectionType,
} from 'graphql-compose/lib/definition';
import type { FieldsMapByElasticType } from '../mappingConverter';
import ElasticApiParser from '../ElasticApiParser';
import type { ElasticApiVersion } from '../ElasticApiParser';
import {
  getSearchBodyITC,
  prepareBodyInResolve,
} from '../elasticDSL/SearchBody';
import { getSearchOutputTC } from '../types/SearchOutput';

export type ElasticSearchResolverOpts = {
  [name: string]: mixed,
  prefix?: string,
  elasticApiVersion?: ElasticApiVersion,
};

export default function createSearchResolver(
  fieldMap: FieldsMapByElasticType,
  sourceTC: TypeComposer,
  elasticClient?: mixed,
  opts?: ElasticSearchResolverOpts = {}
): Resolver<*, *> {
  if (!fieldMap || !fieldMap._all) {
    throw new Error(
      'First arg for Resolver search() should be fieldMap of FieldsMapByElasticType type.'
    );
  }

  if (!(sourceTC instanceof TypeComposer)) {
    throw new Error(
      'Second arg for Resolver search() should be instance of TypeComposer.'
    );
  }

  const prefix = opts.prefix || 'Es';

  const parser = new ElasticApiParser({
    elasticClient,
    version: opts.elasticApiVersion || '5_0',
    prefix,
  });

  const searchITC = getSearchBodyITC({
    prefix,
    fieldMap,
  });

  searchITC.removeField(['size', 'from', '_source', 'explain', 'version']);

  const searchFC = parser.generateFieldConfig('search', {
    index: 'cv',
    type: 'cv',
  });

  const argsConfigMap = Object.assign({}, searchFC.args, {
    body: {
      type: searchITC.getType(),
    },
  });

  delete argsConfigMap.index; // index can not be changed, it hardcoded in searchFC
  delete argsConfigMap.type; // type can not be changed, it hardcoded in searchFC
  delete argsConfigMap.explain; // added automatically if requested _shard, _node, _explanation
  delete argsConfigMap.version; // added automatically if requested _version
  delete argsConfigMap._source; // added automatically due projection
  delete argsConfigMap._sourceExclude; // added automatically due projection
  delete argsConfigMap._sourceInclude; // added automatically due projection
  delete argsConfigMap.trackScores; // added automatically due projection (is _scrore requested with sort)

  delete argsConfigMap.size;
  delete argsConfigMap.from;
  // $FlowFixMe
  argsConfigMap.limit = 'Int';
  // $FlowFixMe
  argsConfigMap.skip = 'Int';

  const bodyITC = InputTypeComposer.create(argsConfigMap.body.type);
  argsConfigMap.query = bodyITC.getField('query');
  argsConfigMap.aggs = bodyITC.getField('aggs');
  argsConfigMap.highlight = bodyITC.getField('highlight');

  const topLevelArgs = [
    'limit',
    'skip',
    'q',
    'opts',
    'query',
    'aggs',
    'highlight',
  ];
  argsConfigMap.opts = InputTypeComposer.create({
    name: `${sourceTC.getTypeName()}Opts`,
    fields: Object.assign({}, argsConfigMap),
  }).removeField(topLevelArgs);
  Object.keys(argsConfigMap).forEach(argKey => {
    if (!topLevelArgs.includes(argKey)) {
      delete argsConfigMap[argKey];
    }
  });

  const type = getSearchOutputTC({ prefix, fieldMap, sourceTC });
  type
    .addFields({
      // $FlowFixMe
      count: 'Int',
      // $FlowFixMe
      max_score: 'Float',
      // $FlowFixMe
      hits: [type.get('hits.hits')],
    })
    .reorderFields([
      'hits',
      'count',
      'aggregations',
      'max_score',
      'took',
      'timed_out',
      '_shards',
    ]);

  // $FlowFixMe
  return new Resolver({
    type,
    name: 'search',
    kind: 'query',
    args: argsConfigMap,
    resolve: async (rp: ResolveParams<*, *>) => {
      let args: Object = rp.args || {};
      const projection = rp.projection || {};
      if (!args.body) args.body = {};

      if ({}.hasOwnProperty.call(args, 'limit')) {
        args.size = args.limit;
        delete args.limit;
      }

      if ({}.hasOwnProperty.call(args, 'skip')) {
        args.from = args.skip;
        delete args.skip;
      }

      const { hits = {} } = projection;

      if (typeof hits === 'object') {
        // Turn on explain if in projection requested this fields:
        if (hits._shard || hits._node || hits._explanation) {
          args.body.explain = true;
        }

        if (hits._version) {
          args.body.version = true;
        }

        if (!hits._source) {
          args.body._source = false;
        } else {
          // $FlowFixMe
          args.body._source = toDottedList(hits._source);
        }

        if (hits._score) {
          args.body.track_scores = true;
        }
      }

      if (args.query) {
        args.body.query = args.query;
        delete args.query;
      }

      if (args.aggs) {
        args.body.aggs = args.aggs;
        delete args.aggs;
      }

      if (args.opts) {
        args = {
          ...args.opts,
          ...args,
          body: { ...args.opts.body, ...args.body },
        };
        delete args.opts;
      }

      if (args.body) {
        args.body = prepareBodyInResolve(args.body, fieldMap);
      }

      // $FlowFixMe
      const res: any = await searchFC.resolve(
        rp.source,
        args,
        rp.context,
        rp.info
      );

      res.count = res.hits.total;
      res.max_score = res.hits.max_score;
      res.hits = res.hits.hits;

      return res;
    },
  }).reorderArgs(['q', 'query', 'aggs', 'limit', 'skip']);
}

export function toDottedList(
  projection: ProjectionType,
  prev?: string[]
): string[] | boolean {
  let result = [];
  Object.keys(projection).forEach(k => {
    if (isObject(projection[k])) {
      // $FlowFixMe
      const tmp = toDottedList(projection[k], prev ? [...prev, k] : [k]);
      if (Array.isArray(tmp)) {
        result = result.concat(tmp);
        return;
      }
    }

    if (prev) {
      result.push([...prev, k].join('.'));
    } else {
      result.push(k);
    }
  });
  return result.length > 0 ? result : true;
}
